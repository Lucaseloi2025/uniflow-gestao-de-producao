-- ============================================================================
-- MIGRATION: 20261017_phase1_finalization.sql
-- PROCOMFORT — FINALIZAÇÃO TÉCNICA ESTRITA E ROBUSTA DA FASE 1
--
-- Requisitos atendidos integralmente:
--   1. Validação estrita de quantidade: nunca fabricar quantidades (sem GREATEST(order.quantity, quantidade_boa)).
--      Finalizar com 0 peças boas retorna INVALID_QUANTITY. Quantidade menor que meta permanece PARCIAL.
--   2. Idempotência obrigatória no apontamento com idempotency_key único.
--   3. Validações quantitativas completas (não-negativos, transferência limitada ao saldo disponível,
--      bloqueio de transferência com produção zero, bloqueio de superprodução sem supervisor_override).
--   4. Atomicidade e rollback em rpc_finish_operation antes de alterar stage_executions.
--   5. Autorização rigorosa: p_user_id obrigatório, verificação direta em public.users, bloqueio
--      irrevogável para Visualização e Comercial (mesmo com override), trava de posse (operador só age na sua execução).
--   6. Rota dinâmica sem IDs fixos (removidos 2, 7, 12).
--   7. Preservação de status da próxima etapa (EM_ANDAMENTO, PAUSADA, PARCIAL, BLOQUEADA, CONCLUIDA).
--   8. Tratamento formal de perdas e reposição (perda de 2 + reposição de 2 conclui com exatamente meta original).
--   9. Compatibilidade com order_items (tabela order_item_stage_progress, item A não conclui item B).
--  10. Conclusão da última etapa define status = 'Pronto' (nunca 'Entregue').
--  11. Execução exclusiva por service_role (REVOKE anon, authenticated, PUBLIC).
-- ============================================================================

BEGIN;

-- 1. REMOVER A CONSTRAINT ANTIGA ANTES DO UPDATE (EVITA ERRO 23514)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. BACKFILL SEGURO DOS PERFIS LEGADOS EM PUBLIC.USERS
UPDATE public.users
SET role = 'Administrador'
WHERE role ILIKE 'admin%';

UPDATE public.users
SET role = 'Operador'
WHERE role ILIKE 'produ%' OR role ILIKE 'operador%';

UPDATE public.users
SET role = 'Visualização'
WHERE role ILIKE 'visualiza%';

-- 3. CONSTRAINT FINAL ESTRITA: APENAS OS SEIS PERFIS OFICIAIS
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Administrador', 'PCP', 'Supervisor', 'Operador', 'Comercial', 'Visualização'));

-- 4. AUDITORIA PRESERVADA: REMOVER ON DELETE CASCADE DE PCP_AUDIT_LOG
ALTER TABLE public.pcp_audit_log DROP CONSTRAINT IF EXISTS pcp_audit_log_order_id_fkey;
ALTER TABLE public.pcp_audit_log
  ADD CONSTRAINT pcp_audit_log_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- 5. EVOLUÇÃO DAS TABELAS PARA IDEMPOTÊNCIA, REPOSIÇÃO E ORDER_ITEMS
ALTER TABLE public.order_progress_logs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reposition BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_progress_logs_idempotency
  ON public.order_progress_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.stage_executions
  ADD COLUMN IF NOT EXISTS order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL;

ALTER TABLE public.order_loss_logs
  ADD COLUMN IF NOT EXISTS order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reposition BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reposicao_quantidade INT DEFAULT 0;

-- Tabela normalizada para rastreamento de progresso por item x etapa
CREATE TABLE IF NOT EXISTS public.order_item_stage_progress (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id BIGINT NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
  quantidade_item INT NOT NULL DEFAULT 1,
  quantidade_recebida INT NOT NULL DEFAULT 0,
  quantidade_boa INT NOT NULL DEFAULT 0,
  quantidade_perdida INT NOT NULL DEFAULT 0,
  quantidade_retrabalho INT NOT NULL DEFAULT 0,
  quantidade_transferida INT NOT NULL DEFAULT 0,
  pendencia_reposicao INT NOT NULL DEFAULT 0,
  saldo_pendente INT NOT NULL DEFAULT 0,
  finished BOOLEAN NOT NULL DEFAULT false,
  status_operacao TEXT NOT NULL DEFAULT 'AGUARDANDO',
  released_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_order_item_stage UNIQUE (order_item_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_order_item_stage_prog_order ON public.order_item_stage_progress(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_stage_prog_item ON public.order_item_stage_progress(order_item_id);

-- ============================================================================
-- 6. RPC: pcp_apply_stage_progress
-- ============================================================================
DROP FUNCTION IF EXISTS public.pcp_apply_stage_progress(BIGINT, BIGINT, BIGINT, TEXT, INT, INT, INT, INT, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.pcp_apply_stage_progress(BIGINT, BIGINT, BIGINT, INT, INT, INT, INT, BIGINT, TEXT, TEXT, BOOLEAN, BIGINT, BOOLEAN);

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
  p_supervisor_override BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user RECORD;
  v_order RECORD;
  v_stage RECORD;
  v_item RECORD;
  v_prog RECORD;
  v_item_prog RECORD;
  v_next_prog RECORD;
  v_next_item_prog RECORD;
  v_existing_log RECORD;
  v_target_qty INT;
  v_current_good INT := 0;
  v_current_lost INT := 0;
  v_current_rework INT := 0;
  v_current_transferred INT := 0;
  v_current_repl INT := 0;
  v_new_good INT;
  v_new_lost INT;
  v_new_rework INT;
  v_new_repl INT;
  v_new_transferred INT;
  v_new_pending INT;
  v_rep_effective INT := 0;
  v_avail_to_transfer INT;
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
  v_now_brt TEXT;
BEGIN
  v_now_brt := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS.MSOF');

  -- 1. Validação estrita do usuário
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

  -- 2. Validação de não-negatividade
  IF COALESCE(p_good_inc, 0) < 0 OR COALESCE(p_lost_inc, 0) < 0 OR COALESCE(p_rework_inc, 0) < 0 OR COALESCE(p_transfer_inc, 0) < 0 THEN
    RETURN jsonb_build_object('error', 'Quantidades não podem ser negativas.', 'code', 'INVALID_QUANTITY', 'http_status', 400);
  END IF;

  -- 3. Idempotência por chave
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT id, order_id, stage_id, quantidade_boa_incremento
    INTO v_existing_log
    FROM public.order_progress_logs
    WHERE idempotency_key = trim(p_idempotency_key);

    IF FOUND THEN
      SELECT * INTO v_prog
      FROM public.order_stage_progress
      WHERE order_id = p_order_id AND stage_id = p_stage_id;

      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'message', 'Apontamento já processado com esta chave de idempotência.',
        'quantidade_boa', COALESCE(v_prog.quantidade_boa, 0),
        'saldo_pendente', COALESCE(v_prog.saldo_pendente, 0),
        'status_operacao', COALESCE(v_prog.status_operacao, 'LIBERADA'),
        'http_status', 200
      );
    END IF;
  END IF;

  -- 4. Trava e validação do pedido
  SELECT id, order_number, status, pcp_is_blocked, quantity, required_stages
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado.', 'code', 'ORDER_NOT_FOUND', 'http_status', 404);
  END IF;

  IF v_order.pcp_is_blocked THEN
    RETURN jsonb_build_object('error', 'Pedido bloqueado pelo PCP.', 'code', 'ORDER_BLOCKED', 'http_status', 400);
  END IF;

  -- 5. Se houver item especificado, validação do item do pedido
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

  -- 6. Rota dinâmica sem IDs fixos
  IF jsonb_typeof(v_route_stages) = 'array' THEN
    SELECT ARRAY(
      SELECT (elem::TEXT)::BIGINT
      FROM jsonb_array_elements_text(v_route_stages) AS elem
      WHERE elem ~ '^\d+$'
    ) INTO v_stage_arr;

    v_idx := array_position(v_stage_arr, p_stage_id);
    IF v_idx IS NOT NULL AND v_idx < array_length(v_stage_arr, 1) THEN
      v_expected_next := v_stage_arr[v_idx + 1];
    END IF;
  END IF;

  -- Se foi solicitada transferência para próxima etapa, validar se é de fato a próxima etapa da rota
  IF p_next_stage_id IS NOT NULL THEN
    IF v_expected_next IS NULL OR p_next_stage_id <> v_expected_next THEN
      RETURN jsonb_build_object('error', 'Etapa informada não corresponde à próxima etapa na rota.', 'code', 'INVALID_NEXT_STAGE', 'http_status', 400);
    END IF;
  END IF;

  SELECT id, name, COALESCE(calculation_type, 'por_peca') AS calculation_type
  INTO v_stage
  FROM public.stages
  WHERE id = p_stage_id;

  -- 7. Buscar progresso atual
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
      v_current_good := COALESCE(v_prog.quantidade_boa, 0);
      v_current_lost := COALESCE(v_prog.quantidade_perdida, 0);
      v_current_rework := COALESCE(v_prog.quantidade_retrabalho, 0);
      v_current_transferred := COALESCE(v_prog.quantidade_transferida, 0);
      v_current_repl := COALESCE(v_prog.pendencia_reposicao, 0);
    END IF;
  END IF;

  -- 8. Validações de transferência
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

  -- 9. Validação de superprodução
  IF (v_current_good + COALESCE(p_good_inc, 0)) > v_target_qty AND NOT COALESCE(p_supervisor_override, false) THEN
    RETURN jsonb_build_object(
      'error', format('Produção acumulada (%s) ultrapassa a quantidade necessária (%s). Requer autorização formal (supervisor_override).', (v_current_good + COALESCE(p_good_inc, 0)), v_target_qty),
      'code', 'PRODUCTION_EXCEEDS_TARGET',
      'target_quantity', v_target_qty,
      'http_status', 400
    );
  END IF;

  -- 10. Cálculo de perdas e reposição (perda de 2 + reposição de 2 conclui com meta original)
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
  ELSIF v_new_good > 0 OR v_new_transferred > 0 THEN
    v_status_op := 'PARCIAL';
  ELSE
    v_status_op := 'LIBERADA';
  END IF;

  -- 11. Gravação por Item (se aplicável)
  IF p_order_item_id IS NOT NULL THEN
    INSERT INTO public.order_item_stage_progress (
      order_id, order_item_id, stage_id, quantidade_item, quantidade_recebida,
      quantidade_boa, quantidade_perdida, quantidade_retrabalho, quantidade_transferida,
      pendencia_reposicao, saldo_pendente, finished, status_operacao,
      completed_at, updated_at
    )
    VALUES (
      p_order_id, p_order_item_id, p_stage_id, v_target_qty, v_target_qty,
      v_new_good, v_new_lost, v_new_rework, v_new_transferred,
      v_new_repl, v_new_pending, v_is_finished, v_status_op,
      CASE WHEN v_is_finished THEN NOW() ELSE NULL END, NOW()
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
  END IF;

  -- 12. Gravação de progresso no nível de pedido (order_stage_progress)
  -- Se o pedido tiver múltiplos itens, o total reflete a agregação
  IF p_order_item_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_total_items FROM public.order_items WHERE order_id = p_order_id;
    SELECT COUNT(*) INTO v_finished_items FROM public.order_item_stage_progress WHERE order_id = p_order_id AND stage_id = p_stage_id AND finished = true;

    IF v_total_items > 1 AND v_finished_items < v_total_items THEN
      v_is_order_finished := false;
      v_order_status_op := 'PARCIAL';
    ELSE
      v_is_order_finished := v_is_finished;
      v_order_status_op := v_status_op;
    END IF;

    INSERT INTO public.order_stage_progress (
      order_id, stage_id, quantidade_pedido, quantidade_recebida,
      quantidade_boa, quantidade_perdida, quantidade_retrabalho, quantidade_transferida,
      pendencia_reposicao, saldo_pendente, finished, status, status_operacao, updated_at
    )
    VALUES (
      p_order_id, p_stage_id, v_order.quantity, v_order.quantity,
      v_new_good, v_new_lost, v_new_rework, v_new_transferred,
      v_new_repl, v_new_pending, v_is_order_finished, v_order_status_op, v_order_status_op, NOW()
    )
    ON CONFLICT (order_id, stage_id) DO UPDATE SET
      quantidade_boa = (SELECT COALESCE(SUM(quantidade_boa), 0) FROM public.order_item_stage_progress WHERE order_id = p_order_id AND stage_id = p_stage_id),
      quantidade_perdida = (SELECT COALESCE(SUM(quantidade_perdida), 0) FROM public.order_item_stage_progress WHERE order_id = p_order_id AND stage_id = p_stage_id),
      quantidade_retrabalho = (SELECT COALESCE(SUM(quantidade_retrabalho), 0) FROM public.order_item_stage_progress WHERE order_id = p_order_id AND stage_id = p_stage_id),
      quantidade_transferida = (SELECT COALESCE(SUM(quantidade_transferida), 0) FROM public.order_item_stage_progress WHERE order_id = p_order_id AND stage_id = p_stage_id),
      pendencia_reposicao = (SELECT COALESCE(SUM(pendencia_reposicao), 0) FROM public.order_item_stage_progress WHERE order_id = p_order_id AND stage_id = p_stage_id),
      saldo_pendente = (SELECT COALESCE(SUM(saldo_pendente), 0) FROM public.order_item_stage_progress WHERE order_id = p_order_id AND stage_id = p_stage_id),
      finished = (
        (SELECT COUNT(*) FROM public.order_item_stage_progress WHERE order_id = p_order_id AND stage_id = p_stage_id AND finished = true) >=
        (SELECT COUNT(*) FROM public.order_items WHERE order_id = p_order_id)
      ),
      status_operacao = CASE
        WHEN (SELECT COUNT(*) FROM public.order_item_stage_progress WHERE order_id = p_order_id AND stage_id = p_stage_id AND finished = true) >=
             (SELECT COUNT(*) FROM public.order_items WHERE order_id = p_order_id) THEN 'CONCLUIDA'
        WHEN (SELECT COALESCE(SUM(quantidade_boa), 0) FROM public.order_item_stage_progress WHERE order_id = p_order_id AND stage_id = p_stage_id) > 0 THEN 'PARCIAL'
        ELSE public.order_stage_progress.status_operacao
      END,
      status = CASE
        WHEN (SELECT COUNT(*) FROM public.order_item_stage_progress WHERE order_id = p_order_id AND stage_id = p_stage_id AND finished = true) >=
             (SELECT COUNT(*) FROM public.order_items WHERE order_id = p_order_id) THEN 'CONCLUIDA'
        WHEN (SELECT COALESCE(SUM(quantidade_boa), 0) FROM public.order_item_stage_progress WHERE order_id = p_order_id AND stage_id = p_stage_id) > 0 THEN 'PARCIAL'
        ELSE public.order_stage_progress.status
      END,
      updated_at = NOW();
  ELSE
    INSERT INTO public.order_stage_progress (
      order_id, stage_id, quantidade_pedido, quantidade_recebida,
      quantidade_boa, quantidade_perdida, quantidade_retrabalho, quantidade_transferida,
      pendencia_reposicao, saldo_pendente, finished, status, status_operacao, completed_at, updated_at
    )
    VALUES (
      p_order_id, p_stage_id, v_target_qty, v_target_qty,
      v_new_good, v_new_lost, v_new_rework, v_new_transferred,
      v_new_repl, v_new_pending, v_is_finished, v_status_op, v_status_op,
      CASE WHEN v_is_finished THEN NOW() ELSE NULL END, NOW()
    )
    ON CONFLICT (order_id, stage_id) DO UPDATE SET
      quantidade_boa = EXCLUDED.quantidade_boa,
      quantidade_perdida = EXCLUDED.quantidade_perdida,
      quantidade_retrabalho = EXCLUDED.quantidade_retrabalho,
      quantidade_transferida = EXCLUDED.quantidade_transferida,
      pendencia_reposicao = EXCLUDED.pendencia_reposicao,
      saldo_pendente = EXCLUDED.saldo_pendente,
      finished = EXCLUDED.finished,
      status = EXCLUDED.status,
      status_operacao = EXCLUDED.status_operacao,
      completed_at = COALESCE(EXCLUDED.completed_at, public.order_stage_progress.completed_at),
      updated_at = NOW();
  END IF;

  -- 13. Preservação de status da próxima etapa ao receber transferência
  IF p_next_stage_id IS NOT NULL AND COALESCE(p_transfer_inc, 0) > 0 THEN
    SELECT * INTO v_next_prog
    FROM public.order_stage_progress
    WHERE order_id = p_order_id AND stage_id = p_next_stage_id
    FOR UPDATE;

    -- REGRA ESTRITA: Preserva EM_ANDAMENTO, PAUSADA, PARCIAL, BLOQUEADA ou CONCLUIDA!
    -- Somente altera AGUARDANDO (ou novo registro) para LIBERADA.
    IF v_next_prog IS NULL OR v_next_prog.status_operacao IS NULL OR v_next_prog.status_operacao IN ('AGUARDANDO', 'LIBERADA') THEN
      v_next_status := 'LIBERADA';
    ELSE
      v_next_status := v_next_prog.status_operacao;
    END IF;

    INSERT INTO public.order_stage_progress (
      order_id, stage_id, quantidade_pedido, quantidade_recebida,
      quantidade_boa, quantidade_perdida, pendencia_reposicao, saldo_pendente,
      finished, status, status_operacao, released_at, updated_at
    )
    VALUES (
      p_order_id, p_next_stage_id, v_order.quantity, p_transfer_inc,
      0, 0, 0, v_order.quantity,
      false, v_next_status, v_next_status, NOW(), NOW()
    )
    ON CONFLICT (order_id, stage_id) DO UPDATE SET
      quantidade_recebida = public.order_stage_progress.quantidade_recebida + p_transfer_inc,
      status = CASE
        WHEN public.order_stage_progress.status_operacao IN ('EM_ANDAMENTO', 'PAUSADA', 'PARCIAL', 'BLOQUEADA', 'CONCLUIDA')
        THEN public.order_stage_progress.status
        ELSE 'LIBERADA'
      END,
      status_operacao = CASE
        WHEN public.order_stage_progress.status_operacao IN ('EM_ANDAMENTO', 'PAUSADA', 'PARCIAL', 'BLOQUEADA', 'CONCLUIDA')
        THEN public.order_stage_progress.status_operacao
        ELSE 'LIBERADA'
      END,
      updated_at = NOW();

    -- Se item especificado, atualiza também a próxima etapa do item
    IF p_order_item_id IS NOT NULL THEN
      SELECT * INTO v_next_item_prog
      FROM public.order_item_stage_progress
      WHERE order_item_id = p_order_item_id AND stage_id = p_next_stage_id
      FOR UPDATE;

      INSERT INTO public.order_item_stage_progress (
        order_id, order_item_id, stage_id, quantidade_item, quantidade_recebida,
        quantidade_boa, quantidade_perdida, pendencia_reposicao, saldo_pendente,
        finished, status_operacao, released_at, updated_at
      )
      VALUES (
        p_order_id, p_order_item_id, p_next_stage_id, v_target_qty, p_transfer_inc,
        0, 0, 0, v_target_qty,
        false, v_next_status, NOW(), NOW()
      )
      ON CONFLICT (order_item_id, stage_id) DO UPDATE SET
        quantidade_recebida = public.order_item_stage_progress.quantidade_recebida + p_transfer_inc,
        status_operacao = CASE
          WHEN public.order_item_stage_progress.status_operacao IN ('EM_ANDAMENTO', 'PAUSADA', 'PARCIAL', 'BLOQUEADA', 'CONCLUIDA')
          THEN public.order_item_stage_progress.status_operacao
          ELSE 'LIBERADA'
        END,
        updated_at = NOW();
    END IF;
  END IF;

  -- 14. Logs de progresso e perdas com idempotência e autoridade do banco
  IF COALESCE(p_good_inc, 0) > 0 THEN
    INSERT INTO public.order_progress_logs (
      order_id, stage_id, user_id, user_name, quantidade_boa_incremento,
      idempotency_key, order_item_id, is_reposition, created_at
    )
    VALUES (
      p_order_id, p_stage_id, v_user.id, v_user.name, p_good_inc,
      p_idempotency_key, p_order_item_id, COALESCE(p_is_reposition, false), NOW()
    );
  END IF;

  IF COALESCE(p_lost_inc, 0) > 0 THEN
    INSERT INTO public.order_loss_logs (
      order_id, stage_id, user_id, user_name,
      quantidade_perdida, motivo, motivo_detalhe,
      etapa_reentrada_id, order_item_id, created_at
    )
    VALUES (
      p_order_id, p_stage_id, v_user.id, v_user.name,
      p_lost_inc, COALESCE(p_observation, 'Perda em processo'), 'Apontamento via RPC',
      p_stage_id, p_order_item_id, NOW()
    );
  END IF;

  -- 15. Auditoria oficial
  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, user_id, usuario, acao,
    quantidade, observacao, valor_novo, origem, created_at
  )
  VALUES (
    'order_stage_progress', p_order_id, p_stage_id, v_user.id, v_user.name,
    'APONTAMENTO_PRODUCAO', p_good_inc, p_observation,
    jsonb_build_object(
      'quantidade_boa', v_new_good,
      'quantidade_perdida', v_new_lost,
      'pendencia_reposicao', v_new_repl,
      'saldo_pendente', v_new_pending,
      'status_operacao', v_status_op,
      'finished', v_is_finished,
      'next_stage_id', p_next_stage_id,
      'idempotency_key', p_idempotency_key,
      'order_item_id', p_order_item_id,
      'timestamp_sp', v_now_brt
    ),
    'RPC', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'status_operacao', v_status_op,
    'saldo_pendente', v_new_pending,
    'quantidade_boa', v_new_good,
    'quantidade_perdida', v_new_lost,
    'quantidade_transferida', v_new_transferred,
    'pendencia_reposicao', v_new_repl,
    'finished', v_is_finished,
    'next_stage_id', p_next_stage_id,
    'timestamp_sp', v_now_brt,
    'http_status', 200
  );
END;
$$;

-- ============================================================================
-- 7. RPC: rpc_record_production (Idempotência obrigatória)
-- ============================================================================
DROP FUNCTION IF EXISTS public.rpc_record_production(BIGINT, BIGINT, BIGINT, TEXT, INT, INT, INT, INT, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_record_production(BIGINT, BIGINT, BIGINT, INT, INT, INT, INT, BIGINT, TEXT, TEXT, BOOLEAN, BIGINT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.rpc_record_production(
  p_order_id BIGINT,
  p_stage_id BIGINT,
  p_user_id BIGINT,
  p_idempotency_key TEXT,
  p_good_inc INT DEFAULT 0,
  p_lost_inc INT DEFAULT 0,
  p_rework_inc INT DEFAULT 0,
  p_transfer_inc INT DEFAULT NULL,
  p_next_stage_id BIGINT DEFAULT NULL,
  p_observation TEXT DEFAULT NULL,
  p_is_reposition BOOLEAN DEFAULT false,
  p_order_item_id BIGINT DEFAULT NULL,
  p_supervisor_override BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object(
      'error', 'p_idempotency_key (request_id) é obrigatório para garantir idempotência no apontamento.',
      'code', 'IDEMPOTENCY_KEY_REQUIRED',
      'http_status', 400
    );
  END IF;

  RETURN public.pcp_apply_stage_progress(
    p_order_id := p_order_id,
    p_stage_id := p_stage_id,
    p_user_id := p_user_id,
    p_good_inc := COALESCE(p_good_inc, 0),
    p_lost_inc := COALESCE(p_lost_inc, 0),
    p_rework_inc := COALESCE(p_rework_inc, 0),
    p_transfer_inc := COALESCE(p_transfer_inc, 0),
    p_next_stage_id := p_next_stage_id,
    p_observation := p_observation,
    p_idempotency_key := trim(p_idempotency_key),
    p_is_reposition := COALESCE(p_is_reposition, false),
    p_order_item_id := p_order_item_id,
    p_supervisor_override := COALESCE(p_supervisor_override, false)
  );
END;
$$;

-- ============================================================================
-- 8. RPC: rpc_start_operation
-- ============================================================================
DROP FUNCTION IF EXISTS public.rpc_start_operation(BIGINT, BIGINT, BIGINT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.rpc_start_operation(BIGINT, BIGINT, BIGINT, BIGINT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_start_operation(
  p_order_id BIGINT,
  p_stage_id BIGINT,
  p_user_id BIGINT,
  p_order_item_id BIGINT DEFAULT NULL,
  p_supervisor_override BOOLEAN DEFAULT false,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user RECORD;
  v_order RECORD;
  v_existing_exec RECORD;
  v_existing_other_user RECORD;
  v_prev_prog RECORD;
  v_route_stages JSONB;
  v_stage_arr BIGINT[];
  v_idx INT;
  v_prev_stage_id BIGINT;
  v_new_exec_id BIGINT;
  v_now_brt TEXT;
BEGIN
  v_now_brt := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS.MSOF');

  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RETURN jsonb_build_object('error', 'p_user_id é obrigatório.', 'code', 'USER_ID_REQUIRED', 'http_status', 401);
  END IF;

  SELECT id, name, role, active, allow_parallel_sessions
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

  -- Bloqueio absoluto para Visualização e Comercial mesmo com supervisor_override
  IF v_user.role IN ('Visualização', 'Comercial') THEN
    RETURN jsonb_build_object('error', 'Seu perfil (' || v_user.role || ') não possui permissão para executar operações produtivas.', 'code', 'INSUFFICIENT_ROLE', 'http_status', 403);
  END IF;

  SELECT id, order_number, status, pcp_is_blocked, deleted_at, required_stages, quantity
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.deleted_at IS NOT NULL OR v_order.status = 'Cancelado' THEN
    RETURN jsonb_build_object('error', 'Pedido inexistente, excluído ou cancelado.', 'code', 'ORDER_INVALID', 'http_status', 400);
  END IF;

  IF v_order.pcp_is_blocked THEN
    RETURN jsonb_build_object('error', 'Pedido #' || v_order.order_number || ' está BLOQUEADO pelo PCP.', 'code', 'ORDER_BLOCKED', 'http_status', 400);
  END IF;

  -- Proteção contra clique duplo na mesma etapa pelo mesmo operador
  SELECT id, user_id, start_time
  INTO v_existing_exec
  FROM public.stage_executions
  WHERE order_id = p_order_id AND stage_id = p_stage_id AND status = 'Em andamento'
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_exec.user_id = p_user_id THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'id', v_existing_exec.id,
        'execution_id', v_existing_exec.id,
        'status_operacao', 'EM_ANDAMENTO',
        'message', 'Operação já se encontra em andamento para este operador.',
        'http_status', 200
      );
    ELSE
      RETURN jsonb_build_object(
        'error', 'Esta etapa já está sendo executada por outro operador (ID #' || v_existing_exec.user_id || ').',
        'code', 'CONCURRENT_STAGE_EXECUTION',
        'existing_execution_id', v_existing_exec.id,
        'http_status', 409
      );
    END IF;
  END IF;

  -- Operador não pode multitarefar sem permissão
  IF NOT COALESCE(v_user.allow_parallel_sessions, false) AND v_user.role NOT IN ('Administrador', 'Supervisor', 'PCP') THEN
    SELECT id, order_id, stage_id
    INTO v_existing_other_user
    FROM public.stage_executions
    WHERE user_id = p_user_id AND status = 'Em andamento'
    LIMIT 1;

    IF FOUND AND NOT COALESCE(p_supervisor_override, false) THEN
      RETURN jsonb_build_object(
        'error', 'Você já possui outra operação em andamento (Pedido #' || v_existing_other_user.order_id || '). Pause ou finalize-a antes.',
        'code', 'OPERATOR_ALREADY_ACTIVE',
        'active_order_id', v_existing_other_user.order_id,
        'http_status', 409
      );
    END IF;
  END IF;

  -- Validação dinâmica da rota
  v_route_stages := to_jsonb(v_order.required_stages);
  IF jsonb_typeof(v_route_stages) = 'array' THEN
    SELECT ARRAY(
      SELECT (elem::TEXT)::BIGINT
      FROM jsonb_array_elements_text(v_route_stages) AS elem
      WHERE elem ~ '^\d+$'
    ) INTO v_stage_arr;

    v_idx := array_position(v_stage_arr, p_stage_id);
    IF v_idx IS NOT NULL AND v_idx > 1 AND NOT COALESCE(p_supervisor_override, false) THEN
      v_prev_stage_id := v_stage_arr[v_idx - 1];

      SELECT * INTO v_prev_prog
      FROM public.order_stage_progress
      WHERE order_id = p_order_id AND stage_id = v_prev_stage_id;

      IF v_prev_prog IS NULL OR (NOT v_prev_prog.finished AND COALESCE(v_prev_prog.quantidade_transferida, 0) = 0) THEN
        RETURN jsonb_build_object(
          'error', 'A etapa anterior (#' || v_prev_stage_id || ') ainda não transferiu peças nem foi concluída para este pedido.',
          'code', 'PREVIOUS_STAGE_NOT_READY',
          'http_status', 400
        );
      END IF;
    END IF;
  END IF;

  INSERT INTO public.stage_executions (
    order_id, stage_id, user_id, order_item_id, start_time, status, total_time_seconds
  )
  VALUES (
    p_order_id, p_stage_id, v_user.id, p_order_item_id, NOW(), 'Em andamento', 0
  )
  RETURNING id INTO v_new_exec_id;

  INSERT INTO public.order_stage_progress (
    order_id, stage_id, quantidade_pedido, quantidade_recebida,
    quantidade_boa, quantidade_perdida, pendencia_reposicao, saldo_pendente,
    finished, status, status_operacao, started_at, updated_at
  )
  VALUES (
    p_order_id, p_stage_id, v_order.quantity, v_order.quantity,
    0, 0, 0, v_order.quantity,
    false, 'EM_ANDAMENTO', 'EM_ANDAMENTO', NOW(), NOW()
  )
  ON CONFLICT (order_id, stage_id) DO UPDATE SET
    status_operacao = 'EM_ANDAMENTO',
    status = 'EM_ANDAMENTO',
    started_at = COALESCE(public.order_stage_progress.started_at, NOW()),
    updated_at = NOW();

  IF v_order.status = 'Entrada' THEN
    UPDATE public.orders
    SET status = 'Em Produção', pcp_status = 'EM_PRODUCAO'
    WHERE id = p_order_id;
  END IF;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, user_id, usuario, acao,
    observacao, valor_novo, origem, created_at
  )
  VALUES (
    'stage_executions', p_order_id, p_stage_id, v_user.id, v_user.name,
    'INICIO_OPERACAO', p_motivo,
    jsonb_build_object(
      'execution_id', v_new_exec_id,
      'order_item_id', p_order_item_id,
      'status_operacao', 'EM_ANDAMENTO',
      'timestamp_sp', v_now_brt
    ),
    'RPC', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'id', v_new_exec_id,
    'execution_id', v_new_exec_id,
    'status_operacao', 'EM_ANDAMENTO',
    'timestamp_sp', v_now_brt,
    'http_status', 200
  );
END;
$$;

-- ============================================================================
-- 9. RPC: rpc_pause_operation (Trava de posse e autorização)
-- ============================================================================
DROP FUNCTION IF EXISTS public.rpc_pause_operation(BIGINT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_pause_operation(BIGINT, TEXT, TEXT, TEXT, BIGINT);
DROP FUNCTION IF EXISTS public.rpc_pause_operation(BIGINT, BIGINT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.rpc_pause_operation(
  p_execution_id BIGINT,
  p_user_id BIGINT,
  p_motivo TEXT DEFAULT 'Pausa operacional',
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
  v_open_pause RECORD;
  v_now_brt TEXT;
BEGIN
  v_now_brt := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS.MSOF');

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
    RETURN jsonb_build_object('error', 'Seu perfil (' || v_user.role || ') não possui permissão para pausar operações.', 'code', 'INSUFFICIENT_ROLE', 'http_status', 403);
  END IF;

  SELECT * INTO v_exec
  FROM public.stage_executions
  WHERE id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Execução não encontrada.', 'code', 'EXECUTION_NOT_FOUND', 'http_status', 404);
  END IF;

  IF v_exec.status = 'Pausado' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status_operacao', 'PAUSADA', 'http_status', 200);
  END IF;

  IF v_exec.status = 'Finalizado' THEN
    RETURN jsonb_build_object('error', 'Não é possível pausar uma execução finalizada.', 'code', 'ALREADY_FINISHED', 'http_status', 400);
  END IF;

  -- Trava de Posse: Operador só pausa sua própria execução
  IF v_exec.user_id <> p_user_id THEN
    IF v_user.role NOT IN ('Administrador', 'Supervisor', 'PCP') THEN
      RETURN jsonb_build_object(
        'error', 'Operador somente pode pausar sua própria execução.',
        'code', 'FORBIDDEN_NOT_OWNER',
        'http_status', 403
      );
    ELSIF NOT COALESCE(p_supervisor_override, false) OR trim(COALESCE(p_motivo, '')) = '' THEN
      RETURN jsonb_build_object(
        'error', 'Ação em execução de outro operador requer supervisor_override=true e justificativa.',
        'code', 'SUPERVISOR_OVERRIDE_REQUIRED',
        'http_status', 403
      );
    END IF;
  END IF;

  SELECT id INTO v_open_pause
  FROM public.pauses
  WHERE execution_id = p_execution_id AND end_pause IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.pauses (execution_id, start_pause, motivo)
    VALUES (p_execution_id, NOW(), COALESCE(p_motivo, 'Pausa operacional'));
  END IF;

  UPDATE public.stage_executions
  SET status = 'Pausado'
  WHERE id = p_execution_id;

  UPDATE public.order_stage_progress
  SET status_operacao = 'PAUSADA',
      status = 'PAUSADA',
      updated_at = NOW()
  WHERE order_id = v_exec.order_id AND stage_id = v_exec.stage_id;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, user_id, usuario, acao,
    motivo, valor_anterior, valor_novo, origem, created_at
  )
  VALUES (
    'stage_executions', v_exec.order_id, v_exec.stage_id, v_user.id, v_user.name,
    'PAUSA_OPERACAO', p_motivo,
    jsonb_build_object('status_operacao', 'EM_ANDAMENTO'),
    jsonb_build_object('execution_id', p_execution_id, 'status_operacao', 'PAUSADA', 'motivo', p_motivo, 'supervisor_override', p_supervisor_override, 'timestamp_sp', v_now_brt),
    'RPC', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'status_operacao', 'PAUSADA',
    'motivo', p_motivo,
    'timestamp_sp', v_now_brt,
    'http_status', 200
  );
END;
$$;

-- ============================================================================
-- 10. RPC: rpc_resume_operation (Trava de posse e autorização)
-- ============================================================================
DROP FUNCTION IF EXISTS public.rpc_resume_operation(BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_resume_operation(BIGINT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.rpc_resume_operation(BIGINT, TEXT, TEXT, BOOLEAN, BIGINT);
DROP FUNCTION IF EXISTS public.rpc_resume_operation(BIGINT, BIGINT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_resume_operation(
  p_execution_id BIGINT,
  p_user_id BIGINT,
  p_supervisor_override BOOLEAN DEFAULT false,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user RECORD;
  v_exec RECORD;
  v_other_active RECORD;
  v_open_pause RECORD;
  v_pause_duration INT := 0;
  v_now_brt TEXT;
BEGIN
  v_now_brt := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS.MSOF');

  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RETURN jsonb_build_object('error', 'p_user_id é obrigatório.', 'code', 'USER_ID_REQUIRED', 'http_status', 401);
  END IF;

  SELECT id, name, role, active, allow_parallel_sessions
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
    RETURN jsonb_build_object('error', 'Seu perfil (' || v_user.role || ') não possui permissão para retomar operações.', 'code', 'INSUFFICIENT_ROLE', 'http_status', 403);
  END IF;

  SELECT * INTO v_exec
  FROM public.stage_executions
  WHERE id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Execução não encontrada.', 'code', 'EXECUTION_NOT_FOUND', 'http_status', 404);
  END IF;

  IF v_exec.status = 'Em andamento' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status_operacao', 'EM_ANDAMENTO', 'http_status', 200);
  END IF;

  IF v_exec.status = 'Finalizado' THEN
    RETURN jsonb_build_object('error', 'Não é possível retomar uma execução finalizada.', 'code', 'ALREADY_FINISHED', 'http_status', 400);
  END IF;

  -- Trava de Posse: Operador só retoma sua própria execução
  IF v_exec.user_id <> p_user_id THEN
    IF v_user.role NOT IN ('Administrador', 'Supervisor', 'PCP') THEN
      RETURN jsonb_build_object(
        'error', 'Operador somente pode retomar sua própria execução.',
        'code', 'FORBIDDEN_NOT_OWNER',
        'http_status', 403
      );
    ELSIF NOT COALESCE(p_supervisor_override, false) OR trim(COALESCE(p_motivo, '')) = '' THEN
      RETURN jsonb_build_object(
        'error', 'Ação em execução de outro operador requer supervisor_override=true e justificativa.',
        'code', 'SUPERVISOR_OVERRIDE_REQUIRED',
        'http_status', 403
      );
    END IF;
  END IF;

  -- Operador não pode ter outra operação ativa simultaneamente ao retomar
  IF NOT COALESCE(v_user.allow_parallel_sessions, false) AND v_user.role NOT IN ('Administrador', 'Supervisor', 'PCP') THEN
    SELECT se.id, se.order_id, se.stage_id, o.order_number
    INTO v_other_active
    FROM public.stage_executions se
    LEFT JOIN public.orders o ON o.id = se.order_id
    WHERE se.user_id = p_user_id
      AND se.status = 'Em andamento'
      AND se.id <> p_execution_id
    LIMIT 1;

    IF FOUND AND NOT COALESCE(p_supervisor_override, false) THEN
      RETURN jsonb_build_object(
        'error', format('Você já possui outra operação em andamento no pedido #%s. Pause ou finalize antes de retomar esta.', COALESCE(v_other_active.order_number, v_other_active.order_id::TEXT)),
        'code', 'OPERATOR_ALREADY_ACTIVE',
        'http_status', 409
      );
    END IF;
  END IF;

  SELECT id, start_pause INTO v_open_pause
  FROM public.pauses
  WHERE execution_id = p_execution_id AND end_pause IS NULL
  ORDER BY id DESC LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_pause_duration := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_open_pause.start_pause)))::INT);
    UPDATE public.pauses
    SET end_pause = NOW(),
        duration_seconds = v_pause_duration
    WHERE id = v_open_pause.id;
  END IF;

  UPDATE public.stage_executions
  SET status = 'Em andamento'
  WHERE id = p_execution_id;

  UPDATE public.order_stage_progress
  SET status_operacao = 'EM_ANDAMENTO',
      status = 'EM_ANDAMENTO',
      updated_at = NOW()
  WHERE order_id = v_exec.order_id AND stage_id = v_exec.stage_id;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, user_id, usuario, acao,
    observacao, valor_anterior, valor_novo, origem, created_at
  )
  VALUES (
    'stage_executions', v_exec.order_id, v_exec.stage_id, v_user.id, v_user.name,
    'RETOMADA_OPERACAO', p_motivo,
    jsonb_build_object('status_operacao', 'PAUSADA'),
    jsonb_build_object('execution_id', p_execution_id, 'status_operacao', 'EM_ANDAMENTO', 'pause_duration_seconds', v_pause_duration, 'supervisor_override', p_supervisor_override, 'timestamp_sp', v_now_brt),
    'RPC', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'status_operacao', 'EM_ANDAMENTO',
    'pause_duration_seconds', v_pause_duration,
    'timestamp_sp', v_now_brt,
    'http_status', 200
  );
END;
$$;

-- ============================================================================
-- 11. RPC: rpc_finish_operation (Atômica, com validação antes de alterar estado)
-- ============================================================================
DROP FUNCTION IF EXISTS public.rpc_finish_operation(BIGINT, INT, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_finish_operation(BIGINT, INT, BOOLEAN, TEXT, TEXT, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_finish_operation(BIGINT, BIGINT, INT, BOOLEAN, TEXT, TEXT, BOOLEAN);

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
  v_now_brt TEXT;
BEGIN
  v_now_brt := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS.MSOF');

  -- 1. Validação do usuário
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

  -- 2. Lock e validação da execução
  SELECT * INTO v_exec
  FROM public.stage_executions
  WHERE id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Execução não encontrada.', 'code', 'EXECUTION_NOT_FOUND', 'http_status', 404);
  END IF;

  IF v_exec.status = 'Finalizado' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'total_time', COALESCE(v_exec.total_time_seconds, 0),
      'http_status', 200
    );
  END IF;

  -- Trava de Posse: Operador só finaliza sua própria execução
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

  SELECT id, COALESCE(quantity, 1) AS quantity, required_stages, status
  INTO v_order
  FROM public.orders
  WHERE id = v_exec.order_id
  FOR UPDATE;

  v_target_qty := v_order.quantity;

  -- 3. Se houver incremento na finalização, chama pcp_apply_stage_progress e valida retorno antes de tocar em stage_executions
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
      p_supervisor_override := p_supervisor_override
    );

    -- ATOMICIDADE: Se falhou, retorna erro sem alterar execução nem progresso
    IF v_rec_res->>'error' IS NOT NULL THEN
      RETURN v_rec_res;
    END IF;
  END IF;

  -- 4. Validação de quantidade efetivamente produzida
  SELECT * INTO v_prog
  FROM public.order_stage_progress
  WHERE order_id = v_exec.order_id AND stage_id = v_exec.stage_id
  FOR UPDATE;

  v_current_good := COALESCE(v_prog.quantidade_boa, 0);

  IF v_stage.calculation_type = 'por_peca' THEN
    -- Finalizar com quantidade boa zero deve retornar INVALID_QUANTITY
    IF v_current_good = 0 THEN
      RETURN jsonb_build_object(
        'error', 'Não é possível finalizar a operação com quantidade boa zero.',
        'code', 'INVALID_QUANTITY',
        'http_status', 400
      );
    END IF;

    -- Quantidade menor que a meta deve permanecer PARCIAL
    IF COALESCE(p_partial, false) OR v_current_good < v_target_qty OR COALESCE(v_prog.pendencia_reposicao, 0) > 0 THEN
      v_is_completed := false;
      v_status_op := 'PARCIAL';
    ELSE
      v_is_completed := true;
      v_status_op := 'CONCLUIDA';
    END IF;
  ELSE
    v_is_completed := (v_current_good > 0 OR NOT COALESCE(p_partial, false));
    v_status_op := CASE WHEN v_is_completed THEN 'CONCLUIDA' ELSE 'PARCIAL' END;
  END IF;

  -- 5. Passou em todas as validações: agora sim finaliza a execução
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
      status = 'Finalizado'
  WHERE id = p_execution_id;

  SELECT COALESCE(SUM(COALESCE(total_time_seconds, 0)), 0)::INT
  INTO v_total_order_time
  FROM public.stage_executions
  WHERE order_id = v_exec.order_id;

  UPDATE public.orders
  SET total_time_seconds = v_total_order_time
  WHERE id = v_exec.order_id;

  -- 6. Atualizar order_stage_progress sem jamais fabricar quantidade via GREATEST(order.quantity, ...)
  UPDATE public.order_stage_progress
  SET
    finished = v_is_completed,
    status = v_status_op,
    status_operacao = v_status_op,
    saldo_pendente = GREATEST(0, v_target_qty - v_current_good),
    completed_at = CASE WHEN v_is_completed THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE order_id = v_exec.order_id AND stage_id = v_exec.stage_id;

  -- 7. Se etapa concluída, verificar se todas as etapas do pedido foram concluídas
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

    -- REGRA ESTRITA: Conclusão da última etapa define 'Pronto' (NUNCA 'Entregue').
    IF COALESCE(v_all_finished, false) THEN
      UPDATE public.orders
      SET status = 'Pronto',
          pcp_status = 'PRONTO',
          production_finished_at = NOW()
      WHERE id = v_exec.order_id;
      v_new_order_status := 'Pronto';
    ELSIF v_order.status = 'Entrada' THEN
      UPDATE public.orders
      SET status = 'Em Produção', pcp_status = 'EM_PRODUCAO'
      WHERE id = v_exec.order_id;
      v_new_order_status := 'Em Produção';
    END IF;
  END IF;

  -- 8. Auditoria
  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, user_id, usuario, acao,
    quantidade, observacao, valor_novo, origem, created_at
  )
  VALUES (
    'stage_executions', v_exec.order_id, v_exec.stage_id, v_user.id, v_user.name,
    CASE WHEN v_is_completed THEN 'FIM_OPERACAO_CONCLUIDA' ELSE 'FIM_SESSAO_PARCIAL' END,
    v_current_good, p_observation,
    jsonb_build_object(
      'execution_id', p_execution_id,
      'total_time_seconds', v_total_exec,
      'quantidade_boa', v_current_good,
      'status_operacao', v_status_op,
      'order_status', v_new_order_status,
      'supervisor_override', p_supervisor_override,
      'timestamp_sp', v_now_brt
    ),
    'RPC', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'total_time', v_total_exec,
    'order_status', v_new_order_status,
    'status_operacao', v_status_op,
    'saldo_pendente', GREATEST(0, v_target_qty - v_current_good),
    'quantidade_boa', v_current_good,
    'finished', v_is_completed,
    'timestamp_sp', v_now_brt,
    'http_status', 200
  );
END;
$$;

-- ============================================================================
-- 12. GRANTS E REVOKES ESTRITOS (EXECUÇÃO EXCLUSIVA VIA SERVICE_ROLE)
-- ============================================================================
REVOKE ALL ON FUNCTION public.pcp_apply_stage_progress(BIGINT, BIGINT, BIGINT, INT, INT, INT, INT, BIGINT, TEXT, TEXT, BOOLEAN, BIGINT, BOOLEAN) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.pcp_apply_stage_progress(BIGINT, BIGINT, BIGINT, INT, INT, INT, INT, BIGINT, TEXT, TEXT, BOOLEAN, BIGINT, BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_record_production(BIGINT, BIGINT, BIGINT, TEXT, INT, INT, INT, INT, BIGINT, TEXT, BOOLEAN, BIGINT, BOOLEAN) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_record_production(BIGINT, BIGINT, BIGINT, TEXT, INT, INT, INT, INT, BIGINT, TEXT, BOOLEAN, BIGINT, BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_start_operation(BIGINT, BIGINT, BIGINT, BIGINT, BOOLEAN, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_start_operation(BIGINT, BIGINT, BIGINT, BIGINT, BOOLEAN, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_pause_operation(BIGINT, BIGINT, TEXT, BOOLEAN) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_pause_operation(BIGINT, BIGINT, TEXT, BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_resume_operation(BIGINT, BIGINT, BOOLEAN, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_resume_operation(BIGINT, BIGINT, BOOLEAN, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_finish_operation(BIGINT, BIGINT, INT, BOOLEAN, TEXT, TEXT, BOOLEAN) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_finish_operation(BIGINT, BIGINT, INT, BOOLEAN, TEXT, TEXT, BOOLEAN) TO service_role;

COMMIT;
