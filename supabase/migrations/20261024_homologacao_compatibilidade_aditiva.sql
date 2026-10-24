-- ============================================================================
-- MIGRATION ADITIVA E NÃO-DESTRUTIVA DE HOMOLOGAÇÃO (FASE 2 / MÉTRICAS E ETAPAS)
-- Projeto: UniFlow Gestão de Produção (ComfortPro)
-- Ambiente: Supabase Produção (dkyvzxmocppbydtpsgyu)
-- Segurança:
--   - 100% Aditiva e Idempotente (IF NOT EXISTS).
--   - Nenhuma tabela, pedido, apontamento ou histórico é apagado.
--   - Execução em bloco transacional atômico (BEGIN ... COMMIT).
-- ============================================================================

BEGIN;

-- 1. Colunas aditivas em public.stages (slug e meta_diaria)
ALTER TABLE public.stages
  ADD COLUMN IF NOT EXISTS slug TEXT NULL,
  ADD COLUMN IF NOT EXISTS meta_diaria NUMERIC NULL;

-- 2. Colunas aditivas em public.order_progress_logs e stage_executions
ALTER TABLE public.order_progress_logs
  ADD COLUMN IF NOT EXISTS quantidade_boa INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_perdida INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_retrabalho INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_transferida INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS invalidated_by BIGINT NULL,
  ADD COLUMN IF NOT EXISTS invalidation_reason TEXT NULL;

ALTER TABLE public.stage_executions
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS invalidated_by BIGINT NULL,
  ADD COLUMN IF NOT EXISTS invalidation_reason TEXT NULL;

-- 2.1. Desativação segura da constraint legada restritiva em public.stages
ALTER TABLE public.stages
  DROP CONSTRAINT IF EXISTS stages_calculation_type_check;

ALTER TABLE public.stages
  ADD CONSTRAINT stages_calculation_type_check
  CHECK (calculation_type IN ('por_peca', 'por_pedido', 'por_kit_dtf', 'por_metro', 'por_lote', 'por_unidade', 'por_item') OR calculation_type IS NULL);

-- 3. Normalização segura das unidades produtivas nas etapas existentes
-- 3.1. Ficha de aprovação: cálculo por_pedido (1 ficha por pedido)
UPDATE public.stages
SET calculation_type = 'por_pedido',
    slug = COALESCE(slug, 'FICHA_APROVACAO')
WHERE (LOWER(name) LIKE '%ficha%' OR LOWER(name) LIKE '%aprova%')
  AND COALESCE(calculation_type, '') <> 'por_pedido';

-- 3.2. Impressão DTF: ativação e cálculo por_kit_dtf
UPDATE public.stages
SET calculation_type = 'por_kit_dtf',
    slug = COALESCE(slug, 'DTF'),
    active = 1
WHERE LOWER(name) LIKE '%dtf%';

-- 4. Atualização da RPC interna public.pcp_apply_stage_progress (respeita quantidade_pedido por etapa)
CREATE OR REPLACE FUNCTION public.pcp_apply_stage_progress(
  p_order_id BIGINT,
  p_stage_id BIGINT,
  p_user_id BIGINT,
  p_good_inc INT DEFAULT 0,
  p_lost_inc INT DEFAULT 0,
  p_rework_inc INT DEFAULT 0,
  p_transfer_inc INT DEFAULT 0,
  p_next_stage_id BIGINT DEFAULT NULL,
  p_observation TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_is_reposition BOOLEAN DEFAULT false,
  p_order_item_id BIGINT DEFAULT NULL,
  p_supervisor_override BOOLEAN DEFAULT false,
  p_override_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user RECORD;
  v_order RECORD;
  v_item RECORD;
  v_stage RECORD;
  v_prog RECORD;
  v_item_prog RECORD;
  v_target_qty INT := 0;
  v_current_good INT := 0;
  v_current_lost INT := 0;
  v_current_rework INT := 0;
  v_current_transferred INT := 0;
  v_current_repl INT := 0;
  v_new_good INT;
  v_new_lost INT;
  v_new_rework INT;
  v_new_transferred INT;
  v_new_repl INT;
  v_new_pending INT;
  v_avail_to_transfer INT;
  v_rep_effective INT := 0;
  v_route_stages JSONB;
  v_stage_arr BIGINT[];
  v_idx INT;
  v_expected_next BIGINT := NULL;
  v_status_op TEXT;
  v_is_finished BOOLEAN;
  v_next_status TEXT;
  v_total_items INT := 0;
  v_finished_items INT := 0;
  v_is_order_finished BOOLEAN;
  v_order_status_op TEXT;
  v_now_sp TEXT := TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS-03:00');
BEGIN
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RETURN jsonb_build_object('error', 'p_user_id é obrigatório.', 'code', 'USER_ID_REQUIRED', 'http_status', 401);
  END IF;

  SELECT id, name, role, active
  INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Usuário não encontrado no cadastro oficial.', 'code', 'USER_NOT_FOUND', 'http_status', 401);
  END IF;

  IF v_user.active = 0 THEN
    RETURN jsonb_build_object('error', 'Acesso bloqueado: usuário inativo.', 'code', 'USER_INACTIVE', 'http_status', 403);
  END IF;

  IF v_user.role IN ('Visualização', 'Comercial') THEN
    RETURN jsonb_build_object('error', 'Seu perfil (' || v_user.role || ') não possui permissão para registrar produção.', 'code', 'INSUFFICIENT_ROLE', 'http_status', 403);
  END IF;

  IF COALESCE(p_supervisor_override, false) THEN
    IF v_user.role NOT IN ('Administrador', 'Supervisor', 'PCP') THEN
      RETURN jsonb_build_object(
        'error', 'Apenas Administrador, Supervisor ou PCP possuem autorização para supervisor override.',
        'code', 'SUPERVISOR_OVERRIDE_FORBIDDEN',
        'http_status', 403
      );
    END IF;

    IF trim(COALESCE(p_override_reason, '')) = '' AND trim(COALESCE(p_observation, '')) = '' THEN
      RETURN jsonb_build_object(
        'error', 'Justificativa obrigatória para supervisor override.',
        'code', 'OVERRIDE_REASON_REQUIRED',
        'http_status', 400
      );
    END IF;
  END IF;

  IF COALESCE(p_good_inc, 0) < 0 OR COALESCE(p_lost_inc, 0) < 0 OR COALESCE(p_rework_inc, 0) < 0 OR COALESCE(p_transfer_inc, 0) < 0 THEN
    RETURN jsonb_build_object('error', 'Quantidades não podem ser negativas.', 'code', 'INVALID_QUANTITY', 'http_status', 400);
  END IF;

  SELECT id, order_number, status, pcp_is_blocked, quantity, required_stages, deleted_at
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.deleted_at IS NOT NULL OR v_order.status IN ('Cancelado', 'Pronto', 'Entregue') THEN
    RETURN jsonb_build_object('error', 'Pedido inexistente, excluído, pronto ou cancelado.', 'code', 'ORDER_INVALID', 'http_status', 400);
  END IF;

  IF v_order.pcp_is_blocked THEN
    RETURN jsonb_build_object('error', 'Pedido bloqueado pelo PCP.', 'code', 'ORDER_BLOCKED', 'http_status', 400);
  END IF;

  IF p_order_item_id IS NOT NULL THEN
    SELECT * INTO v_item
    FROM public.order_items
    WHERE id = p_order_item_id AND order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Item do pedido não encontrado.', 'code', 'ITEM_NOT_FOUND', 'http_status', 404);
    END IF;

    v_target_qty := v_item.quantity;
    v_route_stages := CASE
      WHEN jsonb_typeof(v_item.route_stages) = 'array' AND jsonb_array_length(v_item.route_stages) > 0 THEN v_item.route_stages
      ELSE to_jsonb(v_order.required_stages)
    END;
  ELSE
    v_target_qty := COALESCE(v_order.quantity, 1);
    v_route_stages := to_jsonb(v_order.required_stages);
  END IF;

  IF jsonb_typeof(v_route_stages) = 'array' THEN
    SELECT ARRAY(
      SELECT (elem::TEXT)::BIGINT
      FROM jsonb_array_elements_text(v_route_stages) AS elem
      WHERE elem ~ '^\d+$'
    ) INTO v_stage_arr;

    v_idx := array_position(v_stage_arr, p_stage_id);
    IF v_idx IS NULL THEN
      RETURN jsonb_build_object('error', 'Etapa informada não faz parte da rota produtiva.', 'code', 'STAGE_NOT_IN_ROUTE', 'http_status', 400);
    END IF;

    IF v_idx < array_length(v_stage_arr, 1) THEN
      v_expected_next := v_stage_arr[v_idx + 1];
    END IF;
  END IF;

  IF p_next_stage_id IS NOT NULL THEN
    IF v_expected_next IS NULL OR p_next_stage_id <> v_expected_next THEN
      RETURN jsonb_build_object('error', 'Etapa informada não corresponde à próxima etapa na rota.', 'code', 'INVALID_NEXT_STAGE', 'http_status', 400);
    END IF;
  END IF;

  SELECT id, name, COALESCE(calculation_type, 'por_peca') AS calculation_type
  INTO v_stage
  FROM public.stages
  WHERE id = p_stage_id;

  IF p_order_item_id IS NOT NULL THEN
    SELECT * INTO v_item_prog
    FROM public.order_item_stage_progress
    WHERE order_item_id = p_order_item_id AND stage_id = p_stage_id
    FOR UPDATE;

    IF FOUND THEN
      v_current_good := COALESCE(v_item_prog.quantidade_boa, 0);
      v_current_lost := COALESCE(v_item_prog.quantidade_perdida, 0);
      v_current_rework := COALESCE(v_item_prog.quantidade_retrabalho, 0);
      v_current_transferred := COALESCE(v_item_prog.quantidade_transferida, 0);
      v_current_repl := COALESCE(v_item_prog.pendencia_reposicao, 0);
    END IF;
  ELSE
    SELECT * INTO v_prog
    FROM public.order_stage_progress
    WHERE order_id = p_order_id AND stage_id = p_stage_id
    FOR UPDATE;

    IF FOUND THEN
      IF COALESCE(v_prog.quantidade_pedido, 0) > 0 THEN
        v_target_qty := v_prog.quantidade_pedido;
      END IF;
      v_current_good := COALESCE(v_prog.quantidade_boa, 0);
      v_current_lost := COALESCE(v_prog.quantidade_perdida, 0);
      v_current_rework := COALESCE(v_prog.quantidade_retrabalho, 0);
      v_current_transferred := COALESCE(v_prog.quantidade_transferida, 0);
      v_current_repl := COALESCE(v_prog.pendencia_reposicao, 0);
    END IF;
  END IF;

  IF COALESCE(p_transfer_inc, 0) > 0 AND (v_current_good + COALESCE(p_good_inc, 0)) = 0 THEN
    RETURN jsonb_build_object('error', 'Transferência não permitida com produção zero.', 'code', 'TRANSFER_WITHOUT_PRODUCTION', 'http_status', 400);
  END IF;

  v_avail_to_transfer := (v_current_good + COALESCE(p_good_inc, 0)) - v_current_transferred;
  IF COALESCE(p_transfer_inc, 0) > v_avail_to_transfer THEN
    RETURN jsonb_build_object(
      'error', format('Quantidade a transferir (%s) excede o saldo de peças boas disponíveis para transferência (%s).', p_transfer_inc, v_avail_to_transfer),
      'code', 'TRANSFER_EXCEEDS_AVAILABLE',
      'available_to_transfer', v_avail_to_transfer,
      'http_status', 400
    );
  END IF;

  IF (v_current_good + COALESCE(p_good_inc, 0)) > v_target_qty AND NOT COALESCE(p_supervisor_override, false) THEN
    RETURN jsonb_build_object(
      'error', format('Produção acumulada (%s) ultrapassa a quantidade necessária (%s). Requer autorização formal (supervisor_override).', (v_current_good + COALESCE(p_good_inc, 0)), v_target_qty),
      'code', 'PRODUCTION_EXCEEDS_TARGET',
      'target_quantity', v_target_qty,
      'http_status', 400
    );
  END IF;

  v_new_good := v_current_good + COALESCE(p_good_inc, 0);
  v_new_lost := v_current_lost + COALESCE(p_lost_inc, 0);
  v_new_rework := v_current_rework + COALESCE(p_rework_inc, 0);
  v_new_transferred := v_current_transferred + COALESCE(p_transfer_inc, 0);

  IF COALESCE(p_is_reposition, false) THEN
    v_rep_effective := LEAST(v_current_repl, COALESCE(p_good_inc, 0));
    v_new_repl := GREATEST(0, v_current_repl - v_rep_effective);
  ELSE
    v_new_repl := v_current_repl + COALESCE(p_lost_inc, 0);
  END IF;

  v_new_pending := GREATEST(0, v_target_qty - v_new_good);

  IF v_stage.calculation_type = 'por_pedido' THEN
    v_is_finished := (v_new_good > 0);
  ELSE
    v_is_finished := (v_target_qty > 0 AND v_new_good >= v_target_qty AND v_new_repl = 0);
  END IF;

  IF v_is_finished THEN
    v_status_op := 'CONCLUIDA';
  ELSIF v_new_good > 0 THEN
    v_status_op := 'PARCIAL';
  ELSE
    v_status_op := 'EM_ANDAMENTO';
  END IF;

  IF p_order_item_id IS NOT NULL THEN
    INSERT INTO public.order_item_stage_progress (
      order_id, order_item_id, stage_id, quantidade_item, quantidade_meta,
      quantidade_recebida, quantidade_boa, quantidade_perdida, quantidade_retrabalho,
      quantidade_transferida, pendencia_reposicao, saldo_pendente, finished,
      status_operacao, completed_at, updated_at
    )
    VALUES (
      p_order_id, p_order_item_id, p_stage_id, v_target_qty, v_target_qty,
      v_target_qty, v_new_good, v_new_lost, v_new_rework,
      v_new_transferred, v_new_repl, v_new_pending, v_is_finished,
      v_status_op, CASE WHEN v_is_finished THEN NOW() ELSE NULL END, NOW()
    )
    ON CONFLICT (order_item_id, stage_id) DO UPDATE SET
      quantidade_boa = EXCLUDED.quantidade_boa,
      quantidade_perdida = EXCLUDED.quantidade_perdida,
      quantidade_retrabalho = EXCLUDED.quantidade_retrabalho,
      quantidade_transferida = EXCLUDED.quantidade_transferida,
      pendencia_reposicao = EXCLUDED.pendencia_reposicao,
      saldo_pendente = EXCLUDED.saldo_pendente,
      finished = EXCLUDED.finished,
      status_operacao = EXCLUDED.status_operacao,
      completed_at = COALESCE(EXCLUDED.completed_at, public.order_item_stage_progress.completed_at),
      updated_at = NOW();

    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE oisp.finished = true)
    INTO v_total_items, v_finished_items
    FROM public.order_items oi
    LEFT JOIN public.order_item_stage_progress oisp
      ON oisp.order_item_id = oi.id AND oisp.stage_id = p_stage_id
    WHERE oi.order_id = p_order_id
      AND (
        (jsonb_typeof(oi.route_stages) = 'array' AND (to_jsonb(oi.route_stages) @> to_jsonb(p_stage_id) OR to_jsonb(oi.route_stages) @> to_jsonb(p_stage_id::text)))
        OR
        ((oi.route_stages IS NULL OR jsonb_array_length(oi.route_stages) = 0) AND (to_jsonb(v_order.required_stages) @> to_jsonb(p_stage_id) OR to_jsonb(v_order.required_stages) @> to_jsonb(p_stage_id::text)))
      );

    v_is_order_finished := (v_total_items > 0 AND v_total_items = v_finished_items);
    v_order_status_op := CASE
      WHEN v_is_order_finished THEN 'CONCLUIDA'
      WHEN v_finished_items > 0 OR v_new_good > 0 THEN 'PARCIAL'
      ELSE 'EM_ANDAMENTO'
    END;
  ELSE
    v_is_order_finished := v_is_finished;
    v_order_status_op := v_status_op;
  END IF;

  INSERT INTO public.order_stage_progress (
    order_id, stage_id, quantidade_pedido, quantidade_recebida,
    quantidade_boa, quantidade_perdida, quantidade_retrabalho,
    quantidade_transferida, pendencia_reposicao, saldo_pendente,
    finished, status, status_operacao, completed_at, updated_at
  )
  VALUES (
    p_order_id, p_stage_id, v_target_qty, v_target_qty,
    v_new_good, v_new_lost, v_new_rework,
    v_new_transferred, v_new_repl, v_new_pending,
    v_is_order_finished, v_order_status_op, v_order_status_op,
    CASE WHEN v_is_order_finished THEN NOW() ELSE NULL END, NOW()
  )
  ON CONFLICT (order_id, stage_id) DO UPDATE SET
    quantidade_boa = CASE WHEN p_order_item_id IS NULL THEN EXCLUDED.quantidade_boa ELSE public.order_stage_progress.quantidade_boa + COALESCE(p_good_inc, 0) END,
    quantidade_perdida = CASE WHEN p_order_item_id IS NULL THEN EXCLUDED.quantidade_perdida ELSE public.order_stage_progress.quantidade_perdida + COALESCE(p_lost_inc, 0) END,
    quantidade_retrabalho = CASE WHEN p_order_item_id IS NULL THEN EXCLUDED.quantidade_retrabalho ELSE public.order_stage_progress.quantidade_retrabalho + COALESCE(p_rework_inc, 0) END,
    quantidade_transferida = CASE WHEN p_order_item_id IS NULL THEN EXCLUDED.quantidade_transferida ELSE public.order_stage_progress.quantidade_transferida + COALESCE(p_transfer_inc, 0) END,
    pendencia_reposicao = CASE WHEN p_order_item_id IS NULL THEN EXCLUDED.pendencia_reposicao ELSE public.order_stage_progress.pendencia_reposicao + (v_new_repl - v_current_repl) END,
    saldo_pendente = GREATEST(0, public.order_stage_progress.quantidade_pedido - (public.order_stage_progress.quantidade_boa + COALESCE(p_good_inc, 0))),
    finished = CASE WHEN p_order_item_id IS NULL THEN EXCLUDED.finished ELSE v_is_order_finished END,
    status = CASE WHEN p_order_item_id IS NULL THEN EXCLUDED.status ELSE v_order_status_op END,
    status_operacao = CASE WHEN p_order_item_id IS NULL THEN EXCLUDED.status_operacao ELSE v_order_status_op END,
    completed_at = CASE WHEN (CASE WHEN p_order_item_id IS NULL THEN EXCLUDED.finished ELSE v_is_order_finished END) THEN NOW() ELSE NULL END,
    updated_at = NOW();

  IF p_next_stage_id IS NOT NULL AND COALESCE(p_transfer_inc, 0) > 0 THEN
    SELECT status_operacao INTO v_next_status
    FROM public.order_stage_progress
    WHERE order_id = p_order_id AND stage_id = p_next_stage_id;

    IF v_next_status IS NULL OR v_next_status = 'AGUARDANDO' THEN
      v_next_status := 'LIBERADA';
    END IF;

    INSERT INTO public.order_stage_progress (
      order_id, stage_id, quantidade_pedido, quantidade_recebida,
      quantidade_boa, quantidade_perdida, quantidade_retrabalho, quantidade_transferida,
      pendencia_reposicao, saldo_pendente, finished, status, status_operacao, released_at, updated_at
    )
    VALUES (
      p_order_id, p_next_stage_id, v_order.quantity, p_transfer_inc,
      0, 0, 0, 0, 0, v_order.quantity, false, v_next_status, v_next_status, NOW(), NOW()
    )
    ON CONFLICT (order_id, stage_id) DO UPDATE SET
      quantidade_recebida = public.order_stage_progress.quantidade_recebida + p_transfer_inc,
      status_operacao = CASE
        WHEN public.order_stage_progress.status_operacao IN ('EM_ANDAMENTO','PAUSADA','PARCIAL','BLOQUEADA','CONCLUIDA')
        THEN public.order_stage_progress.status_operacao
        ELSE 'LIBERADA'
      END,
      status = CASE
        WHEN public.order_stage_progress.status IN ('EM_ANDAMENTO','PAUSADA','PARCIAL','BLOQUEADA','CONCLUIDA')
        THEN public.order_stage_progress.status
        ELSE 'LIBERADA'
      END,
      updated_at = NOW();
  END IF;

  INSERT INTO public.order_progress_logs (
    order_id, stage_id, user_id, user_name,
    quantidade_boa, quantidade_boa_incremento,
    quantidade_perdida, quantidade_perdida_incremento,
    quantidade_retrabalho, quantidade_retrabalho_incremento,
    quantidade_transferida, quantidade_transferida_incremento,
    idempotency_key, order_item_id, is_reposition, observation, created_at
  )
  VALUES (
    p_order_id, p_stage_id, v_user.id, v_user.name,
    v_new_good, p_good_inc,
    v_new_lost, p_lost_inc,
    v_new_rework, p_rework_inc,
    v_new_transferred, p_transfer_inc,
    p_idempotency_key, p_order_item_id, p_is_reposition, p_observation, NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'quantidade_pedido', v_target_qty,
    'quantidade_boa', v_new_good,
    'quantidade_perdida', v_new_lost,
    'quantidade_retrabalho', v_new_rework,
    'quantidade_transferida', v_new_transferred,
    'pendencia_reposicao', v_new_repl,
    'saldo_pendente', v_new_pending,
    'finished', v_is_order_finished,
    'status_operacao', v_order_status_op,
    'timestamp_sp', v_now_sp,
    'http_status', 200
  );
END;
$$;

-- 5. Atualização da RPC public.rpc_finish_operation
CREATE OR REPLACE FUNCTION public.rpc_finish_operation(
  p_execution_id BIGINT,
  p_user_id BIGINT,
  p_good_inc INT DEFAULT 0,
  p_partial BOOLEAN DEFAULT false,
  p_observation TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_supervisor_override BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user RECORD;
  v_exec RECORD;
  v_stage RECORD;
  v_order RECORD;
  v_open_pause RECORD;
  v_pause_dur INT;
  v_total_pause INT := 0;
  v_total_exec INT := 0;
  v_total_order_time INT := 0;
  v_prog RECORD;
  v_rec_res JSONB;
  v_current_good INT := 0;
  v_target_qty INT;
  v_is_completed BOOLEAN;
  v_status_op TEXT;
  v_stage_arr BIGINT[];
  v_all_finished BOOLEAN := false;
  v_new_order_status TEXT;
  v_now_sp TEXT := TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS-03:00');
  v_item RECORD;
  v_item_target_qty INT;
  v_item_prog RECORD;
  v_item_is_completed BOOLEAN;
  v_item_good INT := 0;
  v_req_item RECORD;
  v_stage_in_item_route BOOLEAN;
  v_total_items_in_stage INT := 0;
  v_finished_items_in_stage INT := 0;
BEGIN
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RETURN jsonb_build_object('error', 'p_user_id é obrigatório.', 'code', 'USER_ID_REQUIRED', 'http_status', 401);
  END IF;

  SELECT id, name, role, active
  INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Usuário não encontrado no cadastro oficial.', 'code', 'USER_NOT_FOUND', 'http_status', 401);
  END IF;

  IF v_user.active = 0 THEN
    RETURN jsonb_build_object('error', 'Acesso bloqueado: usuário inativo.', 'code', 'USER_INACTIVE', 'http_status', 403);
  END IF;

  IF v_user.role IN ('Visualização', 'Comercial') THEN
    RETURN jsonb_build_object('error', 'Seu perfil (' || v_user.role || ') não possui permissão para finalizar operações.', 'code', 'INSUFFICIENT_ROLE', 'http_status', 403);
  END IF;

  SELECT * INTO v_exec
  FROM public.stage_executions
  WHERE id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Execução não encontrada.', 'code', 'EXECUTION_NOT_FOUND', 'http_status', 404);
  END IF;

  IF v_exec.status = 'Pausado' THEN
    RETURN jsonb_build_object(
      'error', 'Operação está pausada. Retome a operação antes de finalizá-la.',
      'code', 'EXECUTION_PAUSED',
      'http_status', 400
    );
  END IF;

  IF v_exec.status <> 'Em andamento' AND v_exec.status <> 'Finalizado' THEN
    RETURN jsonb_build_object(
      'error', 'Execução não está em andamento para finalização (status: ' || v_exec.status || ').',
      'code', 'EXECUTION_NOT_RUNNING',
      'http_status', 400
    );
  END IF;

  IF v_exec.status = 'Finalizado' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'total_time', COALESCE(v_exec.total_time_seconds, 0),
      'timestamp_sp', v_now_sp,
      'http_status', 200
    );
  END IF;

  IF COALESCE(p_supervisor_override, false) THEN
    IF v_user.role NOT IN ('Administrador', 'Supervisor', 'PCP') THEN
      RETURN jsonb_build_object(
        'error', 'Apenas Administrador, Supervisor ou PCP possuem autorização para supervisor override.',
        'code', 'SUPERVISOR_OVERRIDE_FORBIDDEN',
        'http_status', 403
      );
    END IF;

    IF trim(COALESCE(p_observation, '')) = '' THEN
      RETURN jsonb_build_object(
        'error', 'Justificativa obrigatória para supervisor override.',
        'code', 'OVERRIDE_REASON_REQUIRED',
        'http_status', 400
      );
    END IF;
  END IF;

  IF v_exec.user_id <> p_user_id THEN
    IF v_user.role NOT IN ('Administrador', 'Supervisor', 'PCP') THEN
      RETURN jsonb_build_object(
        'error', 'Operador somente pode finalizar sua própria execução.',
        'code', 'FORBIDDEN_NOT_OWNER',
        'http_status', 403
      );
    ELSIF NOT COALESCE(p_supervisor_override, false) OR trim(COALESCE(p_observation, '')) = '' THEN
      RETURN jsonb_build_object(
        'error', 'Ação em execução de outro operador requer supervisor_override=true e justificativa.',
        'code', 'SUPERVISOR_OVERRIDE_REQUIRED',
        'http_status', 403
      );
    END IF;
  END IF;

  SELECT name, COALESCE(calculation_type, 'por_peca') AS calculation_type
  INTO v_stage
  FROM public.stages
  WHERE id = v_exec.stage_id;

  SELECT id, COALESCE(quantity, 1) AS quantity, required_stages, status, deleted_at
  INTO v_order
  FROM public.orders
  WHERE id = v_exec.order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.deleted_at IS NOT NULL OR v_order.status IN ('Cancelado', 'Pronto', 'Entregue') THEN
    RETURN jsonb_build_object('error', 'Pedido inexistente, excluído, pronto ou cancelado.', 'code', 'ORDER_INVALID', 'http_status', 400);
  END IF;

  v_target_qty := v_order.quantity;

  IF v_exec.order_item_id IS NOT NULL THEN
    SELECT * INTO v_item FROM public.order_items WHERE id = v_exec.order_item_id;
    v_item_target_qty := COALESCE(v_item.quantity, 1);
  END IF;

  IF COALESCE(p_good_inc, 0) > 0 THEN
    v_rec_res := public.pcp_apply_stage_progress(
      p_order_id := v_exec.order_id,
      p_stage_id := v_exec.stage_id,
      p_user_id := p_user_id,
      p_good_inc := p_good_inc,
      p_lost_inc := 0,
      p_rework_inc := 0,
      p_transfer_inc := 0,
      p_next_stage_id := NULL,
      p_observation := p_observation,
      p_idempotency_key := COALESCE(p_idempotency_key, 'fin_' || p_execution_id || '_' || p_good_inc),
      p_is_reposition := false,
      p_order_item_id := v_exec.order_item_id,
      p_supervisor_override := p_supervisor_override,
      p_override_reason := p_observation
    );

    IF v_rec_res->>'error' IS NOT NULL THEN
      RETURN v_rec_res;
    END IF;
  END IF;

  SELECT * INTO v_prog
  FROM public.order_stage_progress
  WHERE order_id = v_exec.order_id AND stage_id = v_exec.stage_id
  FOR UPDATE;

  IF FOUND AND COALESCE(v_prog.quantidade_pedido, 0) > 0 THEN
    v_target_qty := v_prog.quantidade_pedido;
  END IF;

  v_current_good := COALESCE(v_prog.quantidade_boa, 0);

  IF v_exec.order_item_id IS NOT NULL THEN
    SELECT * INTO v_item_prog
    FROM public.order_item_stage_progress
    WHERE order_item_id = v_exec.order_item_id AND stage_id = v_exec.stage_id
    FOR UPDATE;

    v_item_good := COALESCE(v_item_prog.quantidade_boa, 0);

    IF v_stage.calculation_type = 'por_peca' THEN
      IF v_item_good = 0 THEN
        RETURN jsonb_build_object(
          'error', 'Não é possível finalizar a operação do item com quantidade boa zero.',
          'code', 'INVALID_QUANTITY',
          'http_status', 400
        );
      END IF;

      v_item_is_completed := (NOT COALESCE(p_partial, false))
        AND (v_item_good >= v_item_target_qty)
        AND (COALESCE(v_item_prog.pendencia_reposicao, 0) = 0);
    ELSE
      v_item_is_completed := NOT COALESCE(p_partial, false);
    END IF;

    UPDATE public.order_item_stage_progress
    SET finished = v_item_is_completed,
        status_operacao = CASE WHEN v_item_is_completed THEN 'CONCLUIDA' ELSE 'PARCIAL' END,
        completed_at = CASE WHEN v_item_is_completed THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE order_item_id = v_exec.order_item_id AND stage_id = v_exec.stage_id;
  END IF;

  v_total_items_in_stage := 0;
  v_finished_items_in_stage := 0;

  FOR v_req_item IN (
    SELECT oi.id, oi.quantity, oi.route_stages
    FROM public.order_items oi
    WHERE oi.order_id = v_exec.order_id
  ) LOOP
    v_stage_in_item_route := false;
    IF jsonb_typeof(v_req_item.route_stages) = 'array' AND jsonb_array_length(v_req_item.route_stages) > 0 THEN
      v_stage_in_item_route := EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v_req_item.route_stages) AS elem
        WHERE elem ~ '^\d+$' AND (elem::TEXT)::BIGINT = v_exec.stage_id
      );
    ELSE
      v_stage_in_item_route := EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(to_jsonb(v_order.required_stages)) AS elem
        WHERE elem ~ '^\d+$' AND (elem::TEXT)::BIGINT = v_exec.stage_id
      );
    END IF;

    IF v_stage_in_item_route THEN
      v_total_items_in_stage := v_total_items_in_stage + 1;
      IF EXISTS (
        SELECT 1 FROM public.order_item_stage_progress oisp
        WHERE oisp.order_item_id = v_req_item.id
          AND oisp.stage_id = v_exec.stage_id
          AND oisp.finished = true
      ) THEN
        v_finished_items_in_stage := v_finished_items_in_stage + 1;
      END IF;
    END IF;
  END LOOP;

  IF v_total_items_in_stage > 0 AND v_exec.order_item_id IS NOT NULL THEN
    v_is_completed := (v_finished_items_in_stage >= v_total_items_in_stage)
      AND (NOT COALESCE(p_partial, false))
      AND (v_current_good >= v_target_qty)
      AND (COALESCE(v_prog.pendencia_reposicao, 0) = 0);
  ELSE
    IF v_stage.calculation_type = 'por_peca' THEN
      IF v_current_good = 0 THEN
        RETURN jsonb_build_object(
          'error', 'Não é possível finalizar a operação com quantidade boa zero.',
          'code', 'INVALID_QUANTITY',
          'http_status', 400
        );
      END IF;

      v_is_completed := (NOT COALESCE(p_partial, false))
        AND (v_current_good >= v_target_qty)
        AND (COALESCE(v_prog.pendencia_reposicao, 0) = 0);
    ELSE
      v_is_completed := NOT COALESCE(p_partial, false);
    END IF;
  END IF;

  v_status_op := CASE
    WHEN v_is_completed THEN 'CONCLUIDA'
    WHEN v_current_good > 0 THEN 'PARCIAL'
    ELSE 'EM_ANDAMENTO'
  END;

  SELECT id, start_pause INTO v_open_pause
  FROM public.pauses
  WHERE execution_id = p_execution_id AND end_pause IS NULL
  ORDER BY id DESC LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_pause_dur := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_open_pause.start_pause)))::INT);
    UPDATE public.pauses
    SET end_pause = NOW(), duration_seconds = v_pause_dur
    WHERE id = v_open_pause.id;
  END IF;

  SELECT COALESCE(SUM(COALESCE(duration_seconds, 0)), 0)::INT
  INTO v_total_pause
  FROM public.pauses
  WHERE execution_id = p_execution_id;

  v_total_exec := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_exec.start_time)))::INT - v_total_pause);

  UPDATE public.stage_executions
  SET end_time = NOW(),
      total_time_seconds = v_total_exec,
      status = 'Finalizado',
      updated_at = NOW()
  WHERE id = p_execution_id;

  SELECT COALESCE(SUM(COALESCE(total_time_seconds, 0)), 0)::INT
  INTO v_total_order_time
  FROM public.stage_executions
  WHERE order_id = v_exec.order_id;

  UPDATE public.orders
  SET total_time_seconds = v_total_order_time, updated_at = NOW()
  WHERE id = v_exec.order_id;

  UPDATE public.order_stage_progress
  SET finished = v_is_completed,
      status = v_status_op,
      status_operacao = v_status_op,
      completed_at = CASE WHEN v_is_completed THEN NOW() ELSE completed_at END,
      updated_at = NOW()
  WHERE order_id = v_exec.order_id AND stage_id = v_exec.stage_id;

  v_new_order_status := v_order.status;
  IF v_is_completed THEN
    IF jsonb_typeof(to_jsonb(v_order.required_stages)) = 'array' THEN
      SELECT ARRAY(
        SELECT (elem::TEXT)::BIGINT
        FROM jsonb_array_elements_text(to_jsonb(v_order.required_stages)) AS elem
        WHERE elem ~ '^\d+$'
      ) INTO v_stage_arr;

      IF array_length(v_stage_arr, 1) > 0 THEN
        SELECT bool_and(COALESCE(osp.finished, false))
        INTO v_all_finished
        FROM unnest(v_stage_arr) AS req_stage_id
        LEFT JOIN public.order_stage_progress osp
          ON osp.order_id = v_exec.order_id AND osp.stage_id = req_stage_id;
      END IF;
    END IF;

    IF COALESCE(v_all_finished, false) THEN
      UPDATE public.orders
      SET status = 'Pronto',
          pcp_status = 'PRONTO',
          production_finished_at = NOW(),
          updated_at = NOW()
      WHERE id = v_exec.order_id;
      v_new_order_status := 'Pronto';
    ELSIF v_order.status = 'Entrada' THEN
      UPDATE public.orders
      SET status = 'Em Produção', pcp_status = 'EM_PRODUCAO', updated_at = NOW()
      WHERE id = v_exec.order_id;
      v_new_order_status := 'Em Produção';
    END IF;
  END IF;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, user_id, usuario, acao,
    quantidade, observacao, valor_anterior, valor_novo, valor_antigo, origem, created_at
  )
  VALUES (
    'stage_executions', v_exec.order_id, v_exec.stage_id, v_user.id, v_user.name,
    CASE WHEN v_is_completed THEN 'FIM_OPERACAO_CONCLUIDA' ELSE 'FIM_SESSAO_PARCIAL' END,
    v_current_good, p_observation,
    jsonb_build_object('execution_id', p_execution_id, 'status_operacao', v_exec.status),
    jsonb_build_object(
      'execution_id', p_execution_id,
      'total_time_seconds', v_total_exec,
      'quantidade_boa', v_current_good,
      'status_operacao', v_status_op,
      'order_status', v_new_order_status,
      'timestamp_sp', v_now_sp
    ),
    jsonb_build_object('execution_id', p_execution_id, 'status_operacao', v_exec.status),
    'RPC', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'total_time', v_total_exec,
    'order_status', v_new_order_status,
    'status_operacao', v_status_op,
    'finished', v_is_completed,
    'timestamp_sp', v_now_sp,
    'http_status', 200
  );
END;
$$;

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO FINAL (SOMENTE LEITURA)
-- ============================================================================
SELECT id, name, slug, calculation_type, active, meta_diaria
FROM public.stages
ORDER BY sort_order;
