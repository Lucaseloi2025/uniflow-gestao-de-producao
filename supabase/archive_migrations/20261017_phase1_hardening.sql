-- ============================================================================
-- PROCOMFORT - MIGRATION INCREMENTAL DE HARDENING E FINALIZAÇÃO DA FASE 1
-- Arquivo: supabase/migrations/20261017_phase1_hardening.sql
-- Foco: Autenticação Real, RLS & Auditoria Append-Only, Concorrência via Índices
--       Parciais, Idempotência Atômica, Overrides Seguros e RPC de Perda.
-- ============================================================================

-- 1. IDENTIDADE E VÍNCULO SEGURO COM SUPABASE AUTH (UUID)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users (auth_user_id);

-- 2. SUPORTE A LOGS DE PERDA COM METADADOS COMPLETOS
ALTER TABLE public.order_loss_logs
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS stage_name TEXT,
  ADD COLUMN IF NOT EXISTS quantidade_perdida INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS motivo_detalhe TEXT,
  ADD COLUMN IF NOT EXISTS etapa_reentrada_id BIGINT,
  ADD COLUMN IF NOT EXISTS etapa_reentrada_name TEXT;

ALTER TABLE public.order_progress_logs
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS quantidade_boa_incremento INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS order_item_id BIGINT,
  ADD COLUMN IF NOT EXISTS is_reposition BOOLEAN DEFAULT false;

-- 3. ÍNDICES ÚNICOS PARCIAIS PARA CONCORRÊNCIA ESTRITA (NÍVEL DE BANCO)
-- a) Apenas 1 execução ativa/pausada por operador
CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_executions_active_operator
ON public.stage_executions (user_id)
WHERE status IN ('Em andamento', 'Pausado');

-- b) Apenas 1 execução aberta por pedido + etapa + item
CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_executions_open_stage_order_item
ON public.stage_executions (order_id, stage_id, COALESCE(order_item_id, -1))
WHERE status IN ('Em andamento', 'Pausado');

-- 4. TABELA DEDICADA DE CONTROLE DE IDEMPOTÊNCIA ATÔMICA
CREATE TABLE IF NOT EXISTS public.idempotency_requests (
  id BIGSERIAL PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL,
  order_id BIGINT,
  stage_id BIGINT,
  order_item_id BIGINT,
  user_id BIGINT NOT NULL,
  payload_hash TEXT NOT NULL,
  response_json JSONB,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_requests_key ON public.idempotency_requests (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_requests_order ON public.idempotency_requests (order_id, stage_id);

-- 5. AUDITORIA ESTRITAMENTE APPEND-ONLY (PCP_AUDIT_LOG)
-- Remove qualquer risco de exclusão por CASCADE em foreign keys
ALTER TABLE public.pcp_audit_log DROP CONSTRAINT IF EXISTS pcp_audit_log_order_id_fkey;
ALTER TABLE public.pcp_audit_log
  ADD CONSTRAINT pcp_audit_log_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.trg_prevent_pcp_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'A tabela pcp_audit_log é estritamente append-only. Operações de UPDATE ou DELETE são proibidas.';
END;
$$;

DROP TRIGGER IF EXISTS trg_pcp_audit_log_immutable ON public.pcp_audit_log;
CREATE TRIGGER trg_pcp_audit_log_immutable
BEFORE UPDATE OR DELETE ON public.pcp_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.trg_prevent_pcp_audit_log_modification();

-- 6. POLÍTICAS RLS E PRIVILÉGIOS DE BANCO (SET ROLE anon vs authenticated)
-- Remover políticas abertas legadas (FOR ALL USING true)
DROP POLICY IF EXISTS "Permitir tudo order_items" ON public.order_items;
DROP POLICY IF EXISTS "Permitir tudo pcp_settings" ON public.pcp_settings;
DROP POLICY IF EXISTS "Permitir tudo pcp_blocks" ON public.pcp_blocks;
DROP POLICY IF EXISTS "Permitir tudo pcp_audit_log" ON public.pcp_audit_log;
DROP POLICY IF EXISTS "Permitir tudo pcp_producao_necessidades" ON public.pcp_producao_necessidades;
DROP POLICY IF EXISTS "Permitir tudo order_history" ON public.order_history;

-- Habilitar RLS em todas as tabelas operacionais
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_stage_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_stage_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_loss_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcp_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcp_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcp_producao_necessidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Revogar DML direto de anon em todas as tabelas públicas
DO $$
DECLARE
  v_role_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'anon') INTO v_role_exists;
  IF v_role_exists THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
  END IF;
  SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') INTO v_role_exists;
  IF v_role_exists THEN
    REVOKE UPDATE, DELETE ON public.pcp_audit_log FROM authenticated;
    REVOKE UPDATE, DELETE ON public.idempotency_requests FROM authenticated;
  END IF;
END $$;

-- Criar políticas restritivas de leitura para usuários autenticados
DROP POLICY IF EXISTS "authenticated_select_orders" ON public.orders;
CREATE POLICY "authenticated_select_orders" ON public.orders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_select_order_items" ON public.order_items;
CREATE POLICY "authenticated_select_order_items" ON public.order_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_select_stages" ON public.stages;
CREATE POLICY "authenticated_select_stages" ON public.stages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_select_stage_executions" ON public.stage_executions;
CREATE POLICY "authenticated_select_stage_executions" ON public.stage_executions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_select_order_stage_progress" ON public.order_stage_progress;
CREATE POLICY "authenticated_select_order_stage_progress" ON public.order_stage_progress FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_select_order_item_stage_progress" ON public.order_item_stage_progress;
CREATE POLICY "authenticated_select_order_item_stage_progress" ON public.order_item_stage_progress FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_select_order_progress_logs" ON public.order_progress_logs;
CREATE POLICY "authenticated_select_order_progress_logs" ON public.order_progress_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_select_order_loss_logs" ON public.order_loss_logs;
CREATE POLICY "authenticated_select_order_loss_logs" ON public.order_loss_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_select_pcp_audit_log" ON public.pcp_audit_log;
CREATE POLICY "authenticated_select_pcp_audit_log" ON public.pcp_audit_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_select_pcp_settings" ON public.pcp_settings;
CREATE POLICY "authenticated_select_pcp_settings" ON public.pcp_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_select_pcp_blocks" ON public.pcp_blocks;
CREATE POLICY "authenticated_select_pcp_blocks" ON public.pcp_blocks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_select_users" ON public.users;
CREATE POLICY "authenticated_select_users" ON public.users FOR SELECT TO authenticated USING (true);

-- 7. RPC TRANSACIONAL ATÔMICA: rpc_record_loss
CREATE OR REPLACE FUNCTION public.rpc_record_loss(
  p_order_id BIGINT,
  p_stage_id BIGINT,
  p_user_id BIGINT,
  p_lost_qty INT,
  p_reason TEXT,
  p_reason_detail TEXT DEFAULT NULL,
  p_reentry_stage_id BIGINT DEFAULT NULL,
  p_order_item_id BIGINT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user RECORD;
  v_order RECORD;
  v_prog RECORD;
  v_reentry_prog RECORD;
  v_stage_name TEXT;
  v_reentry_stage_name TEXT;
  v_target_reentry_id BIGINT;
  v_prev_good INT;
  v_prev_lost INT;
  v_new_lost INT;
  v_target_qty INT;
  v_inserted_loss_id BIGINT;
  v_now_brt TEXT;
BEGIN
  v_now_brt := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS.MSOF');

  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RETURN jsonb_build_object('error', 'p_user_id é obrigatório.', 'code', 'USER_ID_REQUIRED', 'http_status', 401);
  END IF;

  SELECT id, name, role, active INTO v_user
  FROM public.users WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Usuário não encontrado no cadastro oficial.', 'code', 'USER_NOT_FOUND', 'http_status', 401);
  END IF;

  IF v_user.active = 0 THEN
    RETURN jsonb_build_object('error', 'Acesso bloqueado: usuário inativo.', 'code', 'USER_INACTIVE', 'http_status', 403);
  END IF;

  IF v_user.role IN ('Visualização', 'Comercial') THEN
    RETURN jsonb_build_object('error', 'Perfil ' || v_user.role || ' não pode registrar perdas produtivas.', 'code', 'INSUFFICIENT_ROLE', 'http_status', 403);
  END IF;

  IF p_lost_qty IS NULL OR p_lost_qty <= 0 THEN
    RETURN jsonb_build_object('error', 'Quantidade perdida deve ser maior que 0.', 'code', 'INVALID_QUANTITY', 'http_status', 400);
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('error', 'Motivo da perda é obrigatório.', 'code', 'REASON_REQUIRED', 'http_status', 400);
  END IF;

  IF p_reason = 'Outro' AND (p_reason_detail IS NULL OR trim(p_reason_detail) = '') THEN
    RETURN jsonb_build_object('error', 'Detalhamento obrigatório para o motivo Outro.', 'code', 'REASON_DETAIL_REQUIRED', 'http_status', 400);
  END IF;

  SELECT id, order_number, status, pcp_is_blocked, deleted_at, quantity INTO v_order
  FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND OR v_order.deleted_at IS NOT NULL OR v_order.status IN ('Cancelado', 'Pronto', 'Entregue') THEN
    RETURN jsonb_build_object('error', 'Pedido inexistente, excluído, finalizado ou cancelado.', 'code', 'ORDER_INVALID', 'http_status', 400);
  END IF;

  IF v_order.pcp_is_blocked THEN
    RETURN jsonb_build_object('error', 'Pedido #' || v_order.order_number || ' está BLOQUEADO pelo PCP.', 'code', 'ORDER_BLOCKED', 'http_status', 400);
  END IF;

  SELECT name INTO v_stage_name FROM public.stages WHERE id = p_stage_id;
  v_stage_name := COALESCE(v_stage_name, 'Etapa #' || p_stage_id);

  v_target_reentry_id := COALESCE(p_reentry_stage_id, p_stage_id);
  SELECT name INTO v_reentry_stage_name FROM public.stages WHERE id = v_target_reentry_id;
  v_reentry_stage_name := COALESCE(v_reentry_stage_name, 'Etapa #' || v_target_reentry_id);

  -- Atualizar progresso da etapa onde ocorreu a perda
  SELECT * INTO v_prog FROM public.order_stage_progress
  WHERE order_id = p_order_id AND stage_id = p_stage_id FOR UPDATE;

  v_target_qty := COALESCE(v_prog.quantidade_pedido, v_order.quantity);
  v_prev_good := COALESCE(v_prog.quantidade_boa, 0);
  v_prev_lost := COALESCE(v_prog.quantidade_perdida, 0);
  v_new_lost := v_prev_lost + p_lost_qty;

  INSERT INTO public.order_stage_progress (
    order_id, stage_id, quantidade_pedido, quantidade_boa, quantidade_perdida,
    pendencia_reposicao, saldo_pendente, finished, status, status_operacao, updated_at
  )
  VALUES (
    p_order_id, p_stage_id, v_target_qty, v_prev_good, v_new_lost,
    COALESCE(v_prog.pendencia_reposicao, 0), GREATEST(0, v_target_qty - v_prev_good),
    false, 'PARCIAL', 'PARCIAL', NOW()
  )
  ON CONFLICT (order_id, stage_id) DO UPDATE SET
    quantidade_perdida = v_new_lost,
    finished = false,
    status = 'PARCIAL',
    status_operacao = 'PARCIAL',
    updated_at = NOW();

  -- Se houver etapa de reentrada, registrar a pendência de reposição nela
  IF v_target_reentry_id IS NOT NULL THEN
    INSERT INTO public.order_stage_progress (
      order_id, stage_id, quantidade_pedido, quantidade_boa, quantidade_perdida,
      pendencia_reposicao, saldo_pendente, finished, status, status_operacao, updated_at
    )
    VALUES (
      p_order_id, v_target_reentry_id, v_target_qty, 0, 0,
      p_lost_qty, v_target_qty + p_lost_qty, false, 'PARCIAL', 'PARCIAL', NOW()
    )
    ON CONFLICT (order_id, stage_id) DO UPDATE SET
      pendencia_reposicao = COALESCE(public.order_stage_progress.pendencia_reposicao, 0) + p_lost_qty,
      saldo_pendente = GREATEST(0, public.order_stage_progress.quantidade_pedido - COALESCE(public.order_stage_progress.quantidade_boa, 0)) + COALESCE(public.order_stage_progress.pendencia_reposicao, 0) + p_lost_qty,
      finished = false,
      status = 'PARCIAL',
      status_operacao = 'PARCIAL',
      updated_at = NOW();
  END IF;

  -- Gravar no histórico de perdas
  INSERT INTO public.order_loss_logs (
    order_id, stage_id, stage_name, user_id, user_name,
    quantidade_perdida, motivo, motivo_detalhe,
    etapa_reentrada_id, etapa_reentrada_name, created_at
  )
  VALUES (
    p_order_id, p_stage_id, v_stage_name, v_user.id, v_user.name,
    p_lost_qty, p_reason, p_reason_detail,
    v_target_reentry_id, v_reentry_stage_name, NOW()
  )
  RETURNING id INTO v_inserted_loss_id;

  -- Auditoria oficial append-only
  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, user_id, usuario, acao,
    quantidade, motivo, observacao, origem, created_at
  )
  VALUES (
    'order_loss_logs', p_order_id, p_stage_id, v_user.id, v_user.name, 'REGISTRAR_PERDA',
    p_lost_qty, p_reason, p_reason_detail, 'RPC:rpc_record_loss', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'loss_log_id', v_inserted_loss_id,
    'order_id', p_order_id,
    'stage_id', p_stage_id,
    'quantidade_perdida', v_new_lost,
    'etapa_reentrada_id', v_target_reentry_id,
    'http_status', 200
  );
END;
$$;

-- 8. RPC: rpc_start_operation (ATUALIZADA COM HARDENING DE ITEM E SUPERVISOR)
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
  v_item RECORD;
  v_existing_exec RECORD;
  v_existing_operator_exec RECORD;
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

  IF v_user.role IN ('Visualização', 'Comercial') THEN
    RETURN jsonb_build_object('error', 'Perfil ' || v_user.role || ' não possui permissão para iniciar operações.', 'code', 'INSUFFICIENT_ROLE', 'http_status', 403);
  END IF;

  -- Validação de Supervisor Override
  IF COALESCE(p_supervisor_override, false) THEN
    IF v_user.role NOT IN ('Administrador', 'PCP', 'Supervisor') THEN
      RETURN jsonb_build_object(
        'error', 'Apenas Administrador, PCP ou Supervisor podem aplicar intervenção formal de supervisor.',
        'code', 'SUPERVISOR_OVERRIDE_FORBIDDEN',
        'http_status', 403
      );
    END IF;
    IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
      RETURN jsonb_build_object(
        'error', 'Justificativa não vazia é obrigatória para intervenção de supervisor.',
        'code', 'OVERRIDE_REASON_REQUIRED',
        'http_status', 400
      );
    END IF;
  END IF;

  SELECT id, order_number, status, pcp_is_blocked, deleted_at, required_stages, quantity
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.deleted_at IS NOT NULL OR v_order.status IN ('Cancelado', 'Pronto', 'Entregue') THEN
    RETURN jsonb_build_object('error', 'Pedido inexistente, excluído, pronto ou cancelado.', 'code', 'ORDER_INVALID', 'http_status', 400);
  END IF;

  IF v_order.pcp_is_blocked THEN
    RETURN jsonb_build_object('error', 'Pedido #' || v_order.order_number || ' está BLOQUEADO pelo PCP.', 'code', 'ORDER_BLOCKED', 'http_status', 400);
  END IF;

  -- Validação de Item: deve pertencer ao pedido
  IF p_order_item_id IS NOT NULL THEN
    SELECT id, order_id, route_stages INTO v_item
    FROM public.order_items
    WHERE id = p_order_item_id FOR UPDATE;

    IF NOT FOUND OR v_item.order_id <> p_order_id THEN
      RETURN jsonb_build_object('error', 'Item informado não pertence a este pedido.', 'code', 'ITEM_NOT_IN_ORDER', 'http_status', 400);
    END IF;

    IF v_item.route_stages IS NOT NULL AND jsonb_typeof(to_jsonb(v_item.route_stages)) = 'array' THEN
      IF NOT (to_jsonb(v_item.route_stages) @> to_jsonb(p_stage_id) OR to_jsonb(v_item.route_stages) @> to_jsonb(p_stage_id::text)) THEN
        RETURN jsonb_build_object('error', 'Esta etapa não faz parte da rota do item.', 'code', 'STAGE_NOT_IN_ITEM_ROUTE', 'http_status', 400);
      END IF;
    END IF;
  END IF;

  -- Clique duplo ou execução já existente nesta etapa
  SELECT id, user_id, status
  INTO v_existing_exec
  FROM public.stage_executions
  WHERE order_id = p_order_id AND stage_id = p_stage_id
    AND COALESCE(order_item_id, -1) = COALESCE(p_order_item_id, -1)
    AND status IN ('Em andamento', 'Pausado')
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_exec.user_id = p_user_id THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'execution_id', v_existing_exec.id,
        'status_operacao', CASE WHEN v_existing_exec.status = 'Pausado' THEN 'PAUSADA' ELSE 'EM_ANDAMENTO' END,
        'http_status', 200
      );
    ELSE
      RETURN jsonb_build_object(
        'error', 'Esta etapa/item já está aberta pelo operador #' || v_existing_exec.user_id,
        'code', 'CONCURRENT_STAGE_EXECUTION',
        'http_status', 409
      );
    END IF;
  END IF;

  -- 1 execução ativa por operador
  IF NOT COALESCE(v_user.allow_parallel_sessions, false) AND NOT COALESCE(p_supervisor_override, false) THEN
    SELECT id, order_id, stage_id
    INTO v_existing_operator_exec
    FROM public.stage_executions
    WHERE user_id = p_user_id AND status IN ('Em andamento', 'Pausado')
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'error', 'Operador já possui operação ativa ou pausada no Pedido #' || v_existing_operator_exec.order_id,
        'code', 'OPERATOR_ALREADY_ACTIVE',
        'http_status', 409
      );
    END IF;
  END IF;

  -- Inserção atômica com tratamento de violação de concorrência
  BEGIN
    INSERT INTO public.stage_executions (
      order_id, stage_id, user_id, order_item_id, start_time, status, total_time_seconds
    )
    VALUES (
      p_order_id, p_stage_id, v_user.id, p_order_item_id, NOW(), 'Em andamento', 0
    )
    RETURNING id INTO v_new_exec_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'error', 'Conflito de concorrência no banco: operador ou etapa já em execução.',
      'code', 'CONCURRENT_EXECUTION_CONFLICT',
      'http_status', 409
    );
  END;

  -- Inicializar ou atualizar progresso
  INSERT INTO public.order_stage_progress (
    order_id, stage_id, quantidade_pedido, quantidade_boa, quantidade_perdida,
    pendencia_reposicao, saldo_pendente, finished, status, status_operacao, started_at, updated_at
  )
  VALUES (
    p_order_id, p_stage_id, v_order.quantity, 0, 0,
    0, v_order.quantity, false, 'EM_ANDAMENTO', 'EM_ANDAMENTO', NOW(), NOW()
  )
  ON CONFLICT (order_id, stage_id) DO UPDATE SET
    status = 'EM_ANDAMENTO',
    status_operacao = 'EM_ANDAMENTO',
    started_at = COALESCE(public.order_stage_progress.started_at, NOW()),
    updated_at = NOW();

  IF p_order_item_id IS NOT NULL THEN
    INSERT INTO public.order_item_stage_progress (
      order_id, order_item_id, stage_id, quantidade_meta, quantidade_boa,
      quantidade_perdida, status_operacao, started_at, updated_at
    )
    VALUES (
      p_order_id, p_order_item_id, p_stage_id, 1, 0,
      0, 'EM_ANDAMENTO', NOW(), NOW()
    )
    ON CONFLICT (order_id, order_item_id, stage_id) DO UPDATE SET
      status_operacao = 'EM_ANDAMENTO',
      updated_at = NOW();
  END IF;

  IF v_order.status = 'Entrada' THEN
    UPDATE public.orders SET status = 'Em Produção', pcp_status = 'EM_PRODUCAO' WHERE id = p_order_id;
  END IF;

  IF COALESCE(p_supervisor_override, false) THEN
    INSERT INTO public.pcp_audit_log (
      entidade, order_id, stage_id, user_id, usuario, acao,
      motivo, observacao, origem, created_at
    )
    VALUES (
      'stage_executions', p_order_id, p_stage_id, v_user.id, v_user.name,
      'SUPERVISOR_OVERRIDE_START', p_motivo, 'Intervenção formal de supervisor', 'RPC:rpc_start_operation', NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'execution_id', v_new_exec_id,
    'status_operacao', 'EM_ANDAMENTO',
    'http_status', 200
  );
END;
$$;

-- 9. LIMPAR SOBRECARGAS ANTERIORES E RECRIAR CANÔNICA: rpc_record_production
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'rpc_record_production' AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE';
  END LOOP;
END $$;

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
  p_supervisor_override BOOLEAN DEFAULT false,
  p_override_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_payload_hash TEXT;
  v_idemp RECORD;
  v_result JSONB;
  v_user RECORD;
  v_exec RECORD;
BEGIN
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object(
      'error', 'Chave de idempotência (idempotency_key) é obrigatória para apontamento de produção.',
      'code', 'IDEMPOTENCY_KEY_REQUIRED',
      'http_status', 400
    );
  END IF;

  -- 1. Validação do usuário
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RETURN jsonb_build_object('error', 'p_user_id é obrigatório.', 'code', 'USER_ID_REQUIRED', 'http_status', 401);
  END IF;

  SELECT id, name, role, active INTO v_user
  FROM public.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Usuário não encontrado.', 'code', 'USER_NOT_FOUND', 'http_status', 401);
  END IF;

  IF v_user.active = 0 THEN
    RETURN jsonb_build_object('error', 'Usuário inativo.', 'code', 'USER_INACTIVE', 'http_status', 403);
  END IF;

  IF v_user.role IN ('Visualização', 'Comercial') THEN
    RETURN jsonb_build_object('error', 'Perfil ' || v_user.role || ' não possui permissão para apontar produção.', 'code', 'INSUFFICIENT_ROLE', 'http_status', 403);
  END IF;

  -- 2. Validação de Posse de Execução: Operador só aponta na sua própria execução ativa
  SELECT id, user_id, status INTO v_exec
  FROM public.stage_executions
  WHERE order_id = p_order_id AND stage_id = p_stage_id
    AND COALESCE(order_item_id, -1) = COALESCE(p_order_item_id, -1)
    AND status IN ('Em andamento', 'Pausado')
  ORDER BY id DESC LIMIT 1;

  IF FOUND THEN
    IF v_exec.user_id <> p_user_id THEN
      IF v_user.role NOT IN ('Administrador', 'Supervisor', 'PCP') THEN
        RETURN jsonb_build_object(
          'error', 'Operador não é o proprietário da execução ativa nesta etapa.',
          'code', 'EXECUTION_OWNERSHIP_MISMATCH',
          'http_status', 403
        );
      ELSIF NOT COALESCE(p_supervisor_override, false) OR trim(COALESCE(p_override_reason, '')) = '' THEN
        RETURN jsonb_build_object(
          'error', 'Apontamento em execução de outro operador requer supervisor_override=true e justificativa.',
          'code', 'SUPERVISOR_OVERRIDE_REQUIRED',
          'http_status', 403
        );
      END IF;
    END IF;
  END IF;

  v_payload_hash := md5(
    p_order_id::text || ':' ||
    p_stage_id::text || ':' ||
    COALESCE(p_order_item_id, -1)::text || ':' ||
    COALESCE(p_good_inc, 0)::text || ':' ||
    COALESCE(p_lost_inc, 0)::text || ':' ||
    COALESCE(p_rework_inc, 0)::text || ':' ||
    COALESCE(p_transfer_inc, 0)::text || ':' ||
    COALESCE(p_next_stage_id, -1)::text || ':' ||
    COALESCE(p_is_reposition, false)::text
  );

  -- Verificar se a chave já existe
  SELECT * INTO v_idemp
  FROM public.idempotency_requests
  WHERE idempotency_key = trim(p_idempotency_key)
  FOR UPDATE;

  IF FOUND THEN
    IF v_idemp.payload_hash = v_payload_hash AND v_idemp.order_id = p_order_id AND v_idemp.stage_id = p_stage_id THEN
      IF v_idemp.status = 'COMPLETED' THEN
        RETURN v_idemp.response_json || jsonb_build_object('idempotent_replay', true, 'http_status', 200);
      ELSIF v_idemp.status = 'PROCESSING' THEN
        RETURN jsonb_build_object('error', 'Requisição idêntica já em processamento.', 'code', 'CONCURRENT_REQUEST', 'http_status', 409);
      END IF;
    ELSE
      RETURN jsonb_build_object(
        'error', 'Conflito de idempotência: a mesma chave foi utilizada com payload ou destino divergente.',
        'code', 'IDEMPOTENCY_CONFLICT',
        'http_status', 409
      );
    END IF;
  ELSE
    INSERT INTO public.idempotency_requests (
      idempotency_key, action, order_id, stage_id, order_item_id, user_id, payload_hash, status
    )
    VALUES (
      trim(p_idempotency_key), 'RECORD_PRODUCTION', p_order_id, p_stage_id, p_order_item_id, p_user_id, v_payload_hash, 'PROCESSING'
    );
  END IF;

  -- Chamar o aplicador atômico de progresso
  v_result := public.pcp_apply_stage_progress(
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

  IF v_result->>'error' IS NOT NULL THEN
    UPDATE public.idempotency_requests
    SET status = 'FAILED', response_json = v_result, updated_at = NOW()
    WHERE idempotency_key = trim(p_idempotency_key);
    RETURN v_result;
  END IF;

  UPDATE public.idempotency_requests
  SET status = 'COMPLETED', response_json = v_result, updated_at = NOW()
  WHERE idempotency_key = trim(p_idempotency_key);

  RETURN v_result;
END;
$$;

-- 10. SEGURANÇA DAS RPCS: REVOKE PUBLIC / ANON / AUTHENTICATED -> GRANT SERVICE_ROLE
DO $$
DECLARE
  f_name TEXT;
  r RECORD;
BEGIN
  FOREACH f_name IN ARRAY ARRAY[
    'pcp_apply_stage_progress',
    'rpc_record_production',
    'rpc_start_operation',
    'rpc_pause_operation',
    'rpc_resume_operation',
    'rpc_finish_operation',
    'rpc_record_loss'
  ] LOOP
    FOR r IN (
      SELECT oid::regprocedure AS func_sig
      FROM pg_proc
      WHERE proname = f_name AND pronamespace = 'public'::regnamespace
    ) LOOP
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.func_sig || ' FROM PUBLIC';
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.func_sig || ' FROM anon';
      END IF;
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.func_sig || ' FROM authenticated';
      END IF;
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.func_sig || ' TO service_role';
      END IF;
    END LOOP;
  END LOOP;
END $$;
