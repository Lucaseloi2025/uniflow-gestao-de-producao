-- ============================================================================
-- PROCOMFORT - MIGRATION DE DEPLOY CONSOLIDADO E FINAL DA FASE 1
-- Arquivo: supabase/migrations/20261018_phase1_deploy_complete.sql
-- Sistema: Comfort Uniformes (Uniflow / ProComfort)
-- Fuso Horário Oficial: America/Sao_Paulo (-03:00)
-- Características: 100% Autocontido, Transacional (Atomic Rollback), Idempotente e Seguro.
-- Reúne integralmente: Fundação, Finalização e Hardening da Fase 1 corrigidos.
-- ============================================================================

BEGIN;

-- Forçar timezone America/Sao_Paulo nesta transação
SET LOCAL timezone = 'America/Sao_Paulo';

-- ============================================================================
-- 1. FUNÇÕES AUXILIARES E TRIGGERS DE UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 1.1 CRIAÇÃO RESILIENTE DAS TABELAS BASE (IF NOT EXISTS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 1,
  active INT DEFAULT 1,
  calculation_type TEXT DEFAULT 'por_peca',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'Operador',
  active INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT,
  client_name TEXT,
  product_type TEXT,
  quantity INT DEFAULT 1,
  status TEXT DEFAULT 'Entrada',
  pcp_status TEXT DEFAULT 'AGUARDANDO LIBERAÇÃO',
  pcp_is_blocked BOOLEAN DEFAULT false,
  items JSONB DEFAULT '[]'::jsonb,
  stages_status JSONB DEFAULT '[]'::jsonb,
  total_via_corte INT DEFAULT 0,
  required_stages JSONB DEFAULT '[]'::jsonb,
  total_time_seconds INT DEFAULT 0,
  deadline TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  production_finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_index INT NOT NULL DEFAULT 0,
  sku TEXT,
  description TEXT,
  product_type TEXT,
  fabric TEXT,
  color TEXT,
  size TEXT,
  quantity INT NOT NULL DEFAULT 1,
  route_stages JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'AGUARDANDO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_order_items_order_index UNIQUE(order_id, item_index),
  CONSTRAINT chk_order_items_quantity_positive CHECK (quantity >= 0)
);

CREATE TABLE IF NOT EXISTS public.stage_executions (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL REFERENCES public.stages(id),
  user_id BIGINT NOT NULL REFERENCES public.users(id),
  order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Em andamento',
  total_time_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pauses (
  id BIGSERIAL PRIMARY KEY,
  execution_id BIGINT NOT NULL REFERENCES public.stage_executions(id) ON DELETE CASCADE,
  start_pause TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_pause TIMESTAMPTZ,
  duration_seconds INT DEFAULT 0,
  motivo TEXT DEFAULT 'Pausa operacional',
  pause_reason TEXT DEFAULT 'Pausa operacional',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_stage_progress (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL REFERENCES public.stages(id),
  quantidade_pedido INT NOT NULL DEFAULT 0,
  quantidade_recebida INT NOT NULL DEFAULT 0,
  quantidade_boa INT NOT NULL DEFAULT 0,
  quantidade_perdida INT NOT NULL DEFAULT 0,
  quantidade_retrabalho INT NOT NULL DEFAULT 0,
  quantidade_transferida INT NOT NULL DEFAULT 0,
  pendencia_reposicao INT NOT NULL DEFAULT 0,
  saldo_pendente INT NOT NULL DEFAULT 0,
  finished BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'AGUARDANDO',
  status_operacao TEXT NOT NULL DEFAULT 'AGUARDANDO',
  route_position INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_order_stage_progress UNIQUE(order_id, stage_id)
);

CREATE TABLE IF NOT EXISTS public.order_item_stage_progress (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id BIGINT NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
  quantidade_item INT NOT NULL DEFAULT 1,
  quantidade_meta INT NOT NULL DEFAULT 1,
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_order_item_stage_progress UNIQUE(order_item_id, stage_id)
);

CREATE TABLE IF NOT EXISTS public.order_progress_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL REFERENCES public.stages(id),
  user_id BIGINT NOT NULL REFERENCES public.users(id),
  execution_id BIGINT REFERENCES public.stage_executions(id) ON DELETE SET NULL,
  order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL,
  user_name TEXT,
  quantidade_boa INT DEFAULT 0,
  quantidade_boa_incremento INT NOT NULL DEFAULT 0,
  quantidade_perdida_incremento INT NOT NULL DEFAULT 0,
  quantidade_retrabalho_incremento INT NOT NULL DEFAULT 0,
  quantidade_transferida_incremento INT NOT NULL DEFAULT 0,
  is_reposition BOOLEAN DEFAULT false,
  idempotency_key TEXT,
  observation TEXT,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_loss_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL REFERENCES public.stages(id),
  user_id BIGINT NOT NULL REFERENCES public.users(id),
  order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL,
  user_name TEXT,
  stage_name TEXT,
  quantidade_perdida INT NOT NULL DEFAULT 0,
  motivo TEXT NOT NULL,
  motivo_detalhe TEXT,
  etapa_reentrada_id BIGINT REFERENCES public.stages(id) ON DELETE SET NULL,
  etapa_reentrada_name TEXT,
  is_reposition BOOLEAN DEFAULT false,
  reposicao_quantidade INT DEFAULT 0,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pcp_audit_log (
  id BIGSERIAL PRIMARY KEY,
  entidade TEXT DEFAULT 'orders',
  order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
  stage_id BIGINT,
  user_id BIGINT,
  operator_id BIGINT,
  usuario TEXT,
  acao TEXT NOT NULL,
  quantidade INT,
  motivo TEXT,
  observacao TEXT,
  valor_anterior JSONB,
  valor_antigo JSONB,
  valor_novo JSONB,
  detalhes JSONB,
  sector_name TEXT,
  item_id BIGINT,
  origem TEXT DEFAULT 'WEB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pcp_settings (
  id SERIAL PRIMARY KEY,
  dias_atencao INT DEFAULT 4,
  dias_urgente INT DEFAULT 2,
  corte_capacidade_dia INT NOT NULL DEFAULT 200,
  costura_capacidade_dia INT NOT NULL DEFAULT 120,
  personalizacao_capacidade_dia INT NOT NULL DEFAULT 150,
  revisao_capacidade_dia INT NOT NULL DEFAULT 200,
  lead_time_corte INT NOT NULL DEFAULT 1,
  lead_time_costura INT NOT NULL DEFAULT 2,
  lead_time_personalizacao INT NOT NULL DEFAULT 1,
  lead_time_revisao INT NOT NULL DEFAULT 1,
  dias_alerta_risco INT NOT NULL DEFAULT 2,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pcp_blocks (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pcp_producao_necessidades (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id TEXT,
  sku TEXT,
  qty_vendida INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.producao_necessidades (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number TEXT,
  sku TEXT,
  product_type TEXT,
  fabric TEXT,
  color TEXT,
  size TEXT,
  qty_pedida INT DEFAULT 0,
  qty_reservada INT DEFAULT 0,
  qty_estoque_fisico INT DEFAULT 0,
  qty_estoque_disp INT DEFAULT 0,
  qty_em_op INT DEFAULT 0,
  qty_op_comprometida INT DEFAULT 0,
  qty_op_livre INT DEFAULT 0,
  qty_necessaria INT DEFAULT 0,
  status TEXT DEFAULT 'NECESSITA_NOVO_CORTE',
  plano_corte_id BIGINT,
  estoque_consultado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.planos_de_corte (
  id BIGSERIAL PRIMARY KEY,
  plano_numero TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'RASCUNHO',
  fabric TEXT,
  color TEXT,
  tipo_tecido TEXT,
  largura_util NUMERIC,
  qty_planejada INT NOT NULL DEFAULT 0,
  qty_aprovada INT DEFAULT 0,
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  revalidado_em TIMESTAMPTZ,
  enfesto_data JSONB,
  pedidos_ids JSONB,
  necessidades_ids JSONB,
  created_by TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ordens_de_producao (
  id BIGSERIAL PRIMARY KEY,
  plano_corte_id BIGINT REFERENCES public.planos_de_corte(id) ON DELETE SET NULL,
  tiny_op_id TEXT,
  tiny_op_numero TEXT,
  sku TEXT,
  product_type TEXT,
  fabric TEXT,
  color TEXT,
  size TEXT,
  qty_total INT NOT NULL DEFAULT 0,
  qty_concluida INT NOT NULL DEFAULT 0,
  qty_pendente INT NOT NULL DEFAULT 0,
  qty_comprometida INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDENTE_CADASTRO_TINY',
  tipo TEXT NOT NULL DEFAULT 'VINCULADA_PLANO',
  observacao TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_history (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  usuario TEXT,
  acao TEXT,
  antes JSONB,
  depois JSONB,
  detalhes TEXT,
  action TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.idempotency_requests (
  id BIGSERIAL PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
  order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_idempotency_status CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED'))
);

-- ============================================================================
-- 2. EVOLUÇÃO DE STAGES (SETORES E METADADOS PRODUTIVOS)
-- ============================================================================

ALTER TABLE public.stages
  ADD COLUMN IF NOT EXISTS sector_name TEXT DEFAULT 'Produção',
  ADD COLUMN IF NOT EXISTS allows_partial_transfer BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_productive BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'por_peca',
  ADD COLUMN IF NOT EXISTS setup_time_seconds INT DEFAULT 0;

UPDATE public.stages SET sector_name = 'Preparação / Arte' WHERE (name ILIKE '%ficha%' OR name ILIKE '%arte%') AND sector_name IS DISTINCT FROM 'Preparação / Arte';
UPDATE public.stages SET sector_name = 'Separação / Estoque' WHERE name ILIKE '%separa%' AND sector_name IS DISTINCT FROM 'Separação / Estoque';
UPDATE public.stages SET sector_name = 'Corte' WHERE name ILIKE '%corte%' AND sector_name IS DISTINCT FROM 'Corte';
UPDATE public.stages SET sector_name = 'Costura' WHERE name ILIKE '%costura%' AND sector_name IS DISTINCT FROM 'Costura';
UPDATE public.stages SET sector_name = 'Personalização' WHERE (name ILIKE '%dtf%' OR name ILIKE '%silk%' OR name ILIKE '%sublima%' OR name ILIKE '%estampa%' OR name ILIKE '%bordado%' OR name ILIKE '%revela%') AND sector_name IS DISTINCT FROM 'Personalização';
UPDATE public.stages SET sector_name = 'Conferência / Embalagem' WHERE (name ILIKE '%confer%' OR name ILIKE '%embala%') AND sector_name IS DISTINCT FROM 'Conferência / Embalagem';

-- ============================================================================
-- 3. EVOLUÇÃO DE USERS (6 PERFIS OFICIAIS E VÍNCULO AUTH UUID)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'Operador',
  active INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS allow_parallel_sessions BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sector_name TEXT,
  ADD COLUMN IF NOT EXISTS active INT DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users (auth_user_id);

-- Dropar constraint legada antes de atualizar os papéis para não colidir com o check antigo
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Migração segura de TODOS os perfis legados antes de aplicar a constraint canônica
UPDATE public.users SET role = 'Administrador' WHERE role ILIKE 'admin%' OR role IN ('Admin', 'admin', 'ADMIN');
UPDATE public.users SET role = 'Operador' WHERE role ILIKE 'produ%' OR role IN ('Produção', 'producao', 'Producao', 'Operador de Produção', 'OP', 'OPERADOR');
UPDATE public.users SET role = 'Supervisor' WHERE role ILIKE 'supervis%';
UPDATE public.users SET role = 'PCP' WHERE role ILIKE 'pcp%';
UPDATE public.users SET role = 'Comercial' WHERE role ILIKE 'comercial%';
UPDATE public.users SET role = 'Visualização' WHERE role ILIKE 'visuali%' OR role IN ('Visualizacao', 'Viewer', 'Leitura');

-- Verificação estrita de papéis: Proibido fallback silencioso para Operador.
-- Se houver qualquer perfil desconhecido (ex: Financeiro, Estoque), interromper a transação.
DO $$
DECLARE
  v_rec RECORD;
  v_unknown_list TEXT := '';
BEGIN
  FOR v_rec IN (
    SELECT id, name, role
    FROM public.users
    WHERE role NOT IN ('Administrador', 'PCP', 'Supervisor', 'Operador', 'Comercial', 'Visualização')
  ) LOOP
    v_unknown_list := v_unknown_list || format(' [ID: %s, Nome: %s, Perfil: %s]', v_rec.id, v_rec.name, v_rec.role);
  END LOOP;

  IF v_unknown_list <> '' THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Perfis de usuários desconhecidos encontrados no banco que exigem decisão manual:%', v_unknown_list;
  END IF;
END $$;

ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Administrador', 'PCP', 'Supervisor', 'Operador', 'Comercial', 'Visualização'));

-- Vínculo seguro de usuários legados com o Supabase Auth (auth.users)
-- Apenas quando auth.users existir e houver correspondência unívoca por e-mail normalizado
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    UPDATE public.users u
    SET auth_user_id = au.id
    FROM auth.users au
    WHERE u.auth_user_id IS NULL
      AND u.email IS NOT NULL
      AND au.email IS NOT NULL
      AND LOWER(TRIM(u.email)) = LOWER(TRIM(au.email))
      AND (
        SELECT COUNT(*) FROM auth.users sub_au
        WHERE LOWER(TRIM(sub_au.email)) = LOWER(TRIM(u.email))
      ) = 1;

    -- Usuário legado de teste com domínio inexistente ('Luan@silk') e que não possui correspondente em auth.users é marcado como inativo (active=0), preservando 100% o registro histórico no banco
    UPDATE public.users
    SET active = 0
    WHERE active = 1
      AND auth_user_id IS NULL
      AND email ILIKE '%@silk%';
  END IF;
END $$;

-- Validação transacional estrita de integridade dos usuários com Auth
DO $$
DECLARE
  v_rec RECORD;
  v_err_list TEXT := '';
BEGIN
  -- 1. Usuário ativo com e-mail vazio ou nulo
  FOR v_rec IN (
    SELECT id, name, role FROM public.users
    WHERE active = 1 AND (email IS NULL OR TRIM(email) = '')
  ) LOOP
    v_err_list := v_err_list || format(' [ID: %s, Nome: %s (E-mail vazio)]', v_rec.id, v_rec.name);
  END LOOP;
  IF v_err_list <> '' THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Usuários ativos com e-mail vazio ou nulo no cadastro:%', v_err_list;
  END IF;

  -- 2. Vários usuários internos vinculados ao mesmo auth_user_id
  v_err_list := '';
  FOR v_rec IN (
    SELECT auth_user_id, count(*) AS total, string_agg(name || ' (ID:' || id::text || ')', ', ') AS usuarios
    FROM public.users
    WHERE auth_user_id IS NOT NULL
    GROUP BY auth_user_id
    HAVING count(*) > 1
  ) LOOP
    v_err_list := v_err_list || format(' [Auth UUID: %s, Usuários: %s]', v_rec.auth_user_id, v_rec.usuarios);
  END LOOP;
  IF v_err_list <> '' THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Dois ou mais usuários internos vinculados ao mesmo auth_user_id:%', v_err_list;
  END IF;

  -- 3. Se auth.users existir: verificar e-mails duplicados em auth.users e usuários ativos sem vínculo
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    v_err_list := '';
    FOR v_rec IN (
      SELECT LOWER(TRIM(email)) AS email_norm, count(*) AS total
      FROM auth.users
      WHERE email IS NOT NULL AND TRIM(email) <> ''
      GROUP BY LOWER(TRIM(email))
      HAVING count(*) > 1
    ) LOOP
      v_err_list := v_err_list || format(' [E-mail duplicado em auth.users: %s (%s registros)]', v_rec.email_norm, v_rec.total);
    END LOOP;
    IF v_err_list <> '' THEN
      RAISE EXCEPTION 'MIGRATION ABORTED: Correspondência ambígua/duplicada por e-mail em auth.users:%', v_err_list;
    END IF;

    v_err_list := '';
    FOR v_rec IN (
      SELECT id, name, email, role FROM public.users
      WHERE active = 1 AND auth_user_id IS NULL
    ) LOOP
      v_err_list := v_err_list || format(' [ID: %s, Nome: %s, E-mail: %s, Perfil: %s]', v_rec.id, v_rec.name, v_rec.email, v_rec.role);
    END LOOP;
    IF v_err_list <> '' THEN
      RAISE EXCEPTION 'MIGRATION ABORTED: Usuários ativos sem conta correspondente em auth.users (active=1 AND auth_user_id IS NULL):%', v_err_list;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_auth_user_id'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT uq_users_auth_user_id UNIQUE (auth_user_id);
  END IF;
END $$;

-- ============================================================================
-- 4. EVOLUÇÃO DE ORDERS (SEPARAÇÃO PRONTO X ENTREGUE E METADADOS OLIST)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT,
  client_name TEXT,
  product_type TEXT,
  quantity INT DEFAULT 1,
  status TEXT DEFAULT 'Entrada',
  pcp_status TEXT DEFAULT 'AGUARDANDO LIBERAÇÃO',
  pcp_is_blocked BOOLEAN DEFAULT false,
  items JSONB DEFAULT '[]'::jsonb,
  stages_status JSONB DEFAULT '[]'::jsonb,
  total_via_corte INT DEFAULT 0,
  required_stages JSONB DEFAULT '[]'::jsonb,
  total_time_seconds INT DEFAULT 0,
  deadline TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  production_finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stages_status JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_via_corte INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_type TEXT,
  ADD COLUMN IF NOT EXISTS required_stages JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS order_number TEXT,
  ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pcp_is_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pcp_status TEXT DEFAULT 'ENTRADA',
  ADD COLUMN IF NOT EXISTS pcp_priority TEXT DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS pcp_priority_score INT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS total_time_seconds INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS production_finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS olist_last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS olist_sync_status TEXT DEFAULT 'OK',
  ADD COLUMN IF NOT EXISTS olist_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS pcp_divergence_alert TEXT;

UPDATE public.orders
SET production_finished_at = COALESCE(production_finished_at, delivered_at, created_at)
WHERE status = 'Entregue' AND production_finished_at IS NULL;

-- ============================================================================
-- 5. TABELA NORMALIZADA DE ITENS DO PEDIDO (ORDER_ITEMS) + BACKFILL
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_index INT NOT NULL DEFAULT 0,
  sku TEXT,
  description TEXT,
  product_type TEXT,
  fabric TEXT,
  color TEXT,
  size TEXT,
  quantity INT NOT NULL DEFAULT 1,
  route_stages JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'AGUARDANDO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_order_items_order_index UNIQUE(order_id, item_index),
  CONSTRAINT chk_order_items_quantity_positive CHECK (quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON public.order_items(sku);

DROP TRIGGER IF EXISTS trg_order_items_updated_at ON public.order_items;
CREATE TRIGGER trg_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill dos itens a partir do JSONB em public.orders.items
INSERT INTO public.order_items (
  order_id,
  item_index,
  sku,
  description,
  product_type,
  fabric,
  color,
  size,
  quantity,
  route_stages,
  status
)
SELECT
  o.id AS order_id,
  (elem.ordinality - 1)::INT AS item_index,
  COALESCE(elem.value->>'sku', elem.value->>'codigo', '') AS sku,
  COALESCE(elem.value->>'description', elem.value->>'descricao', o.product_type, '') AS description,
  COALESCE(elem.value->>'product_type', elem.value->>'model', o.product_type, '') AS product_type,
  COALESCE(elem.value->>'fabric', elem.value->>'tecido', '') AS fabric,
  COALESCE(elem.value->>'color', elem.value->>'cor', '') AS color,
  COALESCE(elem.value->>'size', elem.value->>'tamanho', 'UN') AS size,
  GREATEST(
    1,
    CASE
      WHEN (elem.value->>'quantity') ~ '^\d+$' THEN (elem.value->>'quantity')::INT
      WHEN (elem.value->>'quantidade') ~ '^\d+$' THEN (elem.value->>'quantidade')::INT
      ELSE 1
    END
  ) AS quantity,
  COALESCE(o.required_stages, '[]'::jsonb) AS route_stages,
  CASE WHEN o.status = 'Entregue' THEN 'CONCLUIDA' WHEN o.status = 'Cancelado' THEN 'CANCELADA' ELSE 'LIBERADA' END AS status
FROM public.orders o
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END
) WITH ORDINALITY AS elem(value, ordinality)
ON CONFLICT (order_id, item_index) DO NOTHING;

-- ============================================================================
-- 6. EVOLUÇÃO DE ORDER_STAGE_PROGRESS (MÁQUINA DE ESTADOS E CONTROLE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_stage_progress (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL REFERENCES public.stages(id),
  quantidade_pedido INT NOT NULL DEFAULT 0,
  quantidade_recebida INT NOT NULL DEFAULT 0,
  quantidade_boa INT NOT NULL DEFAULT 0,
  quantidade_perdida INT NOT NULL DEFAULT 0,
  quantidade_retrabalho INT NOT NULL DEFAULT 0,
  quantidade_transferida INT NOT NULL DEFAULT 0,
  pendencia_reposicao INT NOT NULL DEFAULT 0,
  saldo_pendente INT NOT NULL DEFAULT 0,
  finished BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'AGUARDANDO',
  status_operacao TEXT NOT NULL DEFAULT 'AGUARDANDO',
  route_position INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_order_stage_progress UNIQUE(order_id, stage_id)
);

ALTER TABLE public.order_stage_progress
  ADD COLUMN IF NOT EXISTS quantidade_pedido INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_boa INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_perdida INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pendencia_reposicao INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finished BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'AGUARDANDO',
  ADD COLUMN IF NOT EXISTS status_operacao TEXT NOT NULL DEFAULT 'AGUARDANDO',
  ADD COLUMN IF NOT EXISTS quantidade_recebida INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_retrabalho INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_transferida INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_pendente INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS route_position INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_order_stage_progress'
  ) THEN
    ALTER TABLE public.order_stage_progress
      ADD CONSTRAINT uq_order_stage_progress UNIQUE(order_id, stage_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_stage_progress_status_operacao'
  ) THEN
    ALTER TABLE public.order_stage_progress
      ADD CONSTRAINT chk_order_stage_progress_status_operacao
      CHECK (status_operacao IN ('AGUARDANDO','LIBERADA','EM_ANDAMENTO','PAUSADA','PARCIAL','BLOQUEADA','CONCLUIDA','CANCELADA'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_order_stage_progress_updated_at ON public.order_stage_progress;
CREATE TRIGGER trg_order_stage_progress_updated_at
  BEFORE UPDATE ON public.order_stage_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

UPDATE public.order_stage_progress osp
SET
  quantidade_recebida = CASE WHEN quantidade_recebida = 0 THEN GREATEST(COALESCE(quantidade_pedido, 0), COALESCE(quantidade_boa, 0)) ELSE quantidade_recebida END,
  quantidade_transferida = CASE WHEN finished = true AND quantidade_transferida = 0 THEN COALESCE(quantidade_boa, 0) ELSE quantidade_transferida END,
  saldo_pendente = GREATEST(0, COALESCE(quantidade_pedido, 0) - COALESCE(quantidade_boa, 0) + COALESCE(pendencia_reposicao, 0)),
  status_operacao = CASE
    WHEN o.status = 'Cancelado' THEN 'CANCELADA'
    WHEN o.pcp_is_blocked = true THEN 'BLOQUEADA'
    WHEN EXISTS (
      SELECT 1 FROM public.stage_executions se 
      WHERE se.order_id = osp.order_id AND se.stage_id = osp.stage_id AND se.status = 'Em andamento'
    ) THEN 'EM_ANDAMENTO'
    WHEN EXISTS (
      SELECT 1 FROM public.stage_executions se 
      WHERE se.order_id = osp.order_id AND se.stage_id = osp.stage_id AND se.status = 'Pausado'
    ) THEN 'PAUSADA'
    WHEN osp.finished = true THEN 'CONCLUIDA'
    WHEN COALESCE(osp.quantidade_boa, 0) > 0 THEN 'PARCIAL'
    WHEN COALESCE(osp.quantidade_recebida, 0) > 0 THEN 'LIBERADA'
    WHEN (
      SELECT (elem::text)::bigint
      FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(to_jsonb(o.required_stages)) = 'array' THEN to_jsonb(o.required_stages) ELSE '[]'::jsonb END) WITH ORDINALITY AS t(elem, ord)
      WHERE ord = 1
      LIMIT 1
    ) = osp.stage_id THEN 'LIBERADA'
    ELSE 'AGUARDANDO'
  END
FROM public.orders o
WHERE o.id = osp.order_id;

UPDATE public.order_stage_progress
SET status = status_operacao;

-- ============================================================================
-- 7. TABELA NORMALIZADA: ORDER_ITEM_STAGE_PROGRESS (MULTI-ITENS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_item_stage_progress (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id BIGINT NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
  quantidade_item INT NOT NULL DEFAULT 1,
  quantidade_meta INT NOT NULL DEFAULT 1,
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_order_item_stage_progress UNIQUE(order_item_id, stage_id),
  CONSTRAINT chk_order_item_stage_status CHECK (status_operacao IN ('AGUARDANDO','LIBERADA','EM_ANDAMENTO','PAUSADA','PARCIAL','BLOQUEADA','CONCLUIDA','CANCELADA'))
);

CREATE INDEX IF NOT EXISTS idx_order_item_stage_progress_order ON public.order_item_stage_progress(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_stage_progress_stage ON public.order_item_stage_progress(stage_id);

DROP TRIGGER IF EXISTS trg_order_item_stage_progress_updated_at ON public.order_item_stage_progress;
CREATE TRIGGER trg_order_item_stage_progress_updated_at
  BEFORE UPDATE ON public.order_item_stage_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 8. EVOLUÇÃO DE STAGE_EXECUTIONS E PAUSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stage_executions (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL REFERENCES public.stages(id),
  user_id BIGINT NOT NULL REFERENCES public.users(id),
  order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Em andamento',
  total_time_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stage_executions
  ADD COLUMN IF NOT EXISTS order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_time_seconds INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.pauses (
  id BIGSERIAL PRIMARY KEY,
  execution_id BIGINT NOT NULL REFERENCES public.stage_executions(id) ON DELETE CASCADE,
  start_pause TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_pause TIMESTAMPTZ,
  duration_seconds INT DEFAULT 0,
  motivo TEXT DEFAULT 'Pausa operacional',
  pause_reason TEXT DEFAULT 'Pausa operacional',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pauses
  ADD COLUMN IF NOT EXISTS motivo TEXT DEFAULT 'Pausa operacional',
  ADD COLUMN IF NOT EXISTS pause_reason TEXT DEFAULT 'Pausa operacional';

-- ============================================================================
-- 9. EVOLUÇÃO DE ORDER_PROGRESS_LOGS E ORDER_LOSS_LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_progress_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL REFERENCES public.stages(id),
  user_id BIGINT NOT NULL REFERENCES public.users(id),
  execution_id BIGINT REFERENCES public.stage_executions(id) ON DELETE SET NULL,
  order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL,
  user_name TEXT,
  quantidade_boa INT DEFAULT 0,
  quantidade_boa_incremento INT NOT NULL DEFAULT 0,
  quantidade_perdida_incremento INT NOT NULL DEFAULT 0,
  quantidade_retrabalho_incremento INT NOT NULL DEFAULT 0,
  quantidade_transferida_incremento INT NOT NULL DEFAULT 0,
  is_reposition BOOLEAN DEFAULT false,
  idempotency_key TEXT,
  observation TEXT,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.order_progress_logs
  ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS stage_id BIGINT REFERENCES public.stages(id),
  ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS execution_id BIGINT REFERENCES public.stage_executions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS quantidade_boa_incremento INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_perdida_incremento INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_retrabalho_incremento INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_transferida_incremento INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reposition BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS observation TEXT,
  ADD COLUMN IF NOT EXISTS response_payload JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_progress_logs_idempotency
  ON public.order_progress_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.order_loss_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL REFERENCES public.stages(id),
  user_id BIGINT NOT NULL REFERENCES public.users(id),
  order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL,
  user_name TEXT,
  stage_name TEXT,
  quantidade_perdida INT NOT NULL DEFAULT 0,
  motivo TEXT NOT NULL,
  motivo_detalhe TEXT,
  etapa_reentrada_id BIGINT REFERENCES public.stages(id) ON DELETE SET NULL,
  etapa_reentrada_name TEXT,
  is_reposition BOOLEAN DEFAULT false,
  reposicao_quantidade INT DEFAULT 0,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.order_loss_logs
  ADD COLUMN IF NOT EXISTS order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reposition BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reposicao_quantidade INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS stage_name TEXT,
  ADD COLUMN IF NOT EXISTS quantidade_perdida INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS motivo_detalhe TEXT,
  ADD COLUMN IF NOT EXISTS etapa_reentrada_id BIGINT,
  ADD COLUMN IF NOT EXISTS etapa_reentrada_name TEXT;

-- ============================================================================
-- 10. PCP_AUDIT_LOG IMUTÁVEL (APPEND-ONLY COM SUPORTE A ON DELETE SET NULL)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pcp_audit_log (
  id BIGSERIAL PRIMARY KEY,
  entidade TEXT DEFAULT 'orders',
  order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
  stage_id BIGINT,
  user_id BIGINT,
  operator_id BIGINT,
  usuario TEXT,
  acao TEXT NOT NULL,
  quantidade INT,
  motivo TEXT,
  observacao TEXT,
  valor_anterior JSONB,
  valor_antigo JSONB,
  valor_novo JSONB,
  detalhes JSONB,
  sector_name TEXT,
  item_id BIGINT,
  origem TEXT DEFAULT 'WEB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pcp_audit_log
  ADD COLUMN IF NOT EXISTS entidade TEXT DEFAULT 'orders',
  ADD COLUMN IF NOT EXISTS order_id BIGINT,
  ADD COLUMN IF NOT EXISTS user_id BIGINT,
  ADD COLUMN IF NOT EXISTS operator_id BIGINT,
  ADD COLUMN IF NOT EXISTS sector_name TEXT,
  ADD COLUMN IF NOT EXISTS stage_id BIGINT,
  ADD COLUMN IF NOT EXISTS item_id BIGINT,
  ADD COLUMN IF NOT EXISTS usuario TEXT,
  ADD COLUMN IF NOT EXISTS acao TEXT,
  ADD COLUMN IF NOT EXISTS quantidade INT,
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS valor_anterior JSONB,
  ADD COLUMN IF NOT EXISTS valor_antigo JSONB,
  ADD COLUMN IF NOT EXISTS valor_novo JSONB,
  ADD COLUMN IF NOT EXISTS detalhes JSONB,
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'WEB',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.pcp_audit_log DROP CONSTRAINT IF EXISTS pcp_audit_log_order_id_fkey;
ALTER TABLE public.pcp_audit_log
  ADD CONSTRAINT pcp_audit_log_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pcp_audit_log_order_id ON public.pcp_audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_pcp_audit_log_created_at ON public.pcp_audit_log(created_at DESC);

-- Trigger de Imutabilidade Absoluta: Rejeita incondicionalmente qualquer UPDATE ou DELETE.
-- Suporte estrito a ON DELETE SET NULL: Permite exclusivamente a anulação de order_id decorrente
-- da remoção referencial do pedido correspondente, mantendo a integridade e histórico perenes de auditoria.
CREATE OR REPLACE FUNCTION public.fn_prevent_pcp_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Operação proibida: a tabela pcp_audit_log é estritamente append-only.'
      USING ERRCODE = '55000';
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.order_id IS NOT NULL AND NEW.order_id IS NULL)
       AND pg_trigger_depth() >= 2
       AND NOT EXISTS (SELECT 1 FROM public.orders WHERE id = OLD.order_id)
       AND NEW.id = OLD.id
       AND NEW.entidade IS NOT DISTINCT FROM OLD.entidade
       AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id
       AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
       AND NEW.operator_id IS NOT DISTINCT FROM OLD.operator_id
       AND NEW.usuario IS NOT DISTINCT FROM OLD.usuario
       AND NEW.acao IS NOT DISTINCT FROM OLD.acao
       AND NEW.quantidade IS NOT DISTINCT FROM OLD.quantidade
       AND NEW.motivo IS NOT DISTINCT FROM OLD.motivo
       AND NEW.observacao IS NOT DISTINCT FROM OLD.observacao
       AND NEW.valor_anterior IS NOT DISTINCT FROM OLD.valor_anterior
       AND NEW.valor_antigo IS NOT DISTINCT FROM OLD.valor_antigo
       AND NEW.valor_novo IS NOT DISTINCT FROM OLD.valor_novo
       AND NEW.detalhes IS NOT DISTINCT FROM OLD.detalhes
       AND NEW.sector_name IS NOT DISTINCT FROM OLD.sector_name
       AND NEW.item_id IS NOT DISTINCT FROM OLD.item_id
       AND NEW.origem IS NOT DISTINCT FROM OLD.origem
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Operação proibida: a tabela pcp_audit_log é estritamente append-only.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pcp_audit_log_immutable ON public.pcp_audit_log;
CREATE TRIGGER trg_pcp_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.pcp_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_pcp_audit_mutation();

-- ============================================================================
-- 11. PCP_SETTINGS, PCP_BLOCKS, PCP_NECESSIDADES E ORDER_HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pcp_settings (
  id SERIAL PRIMARY KEY,
  dias_atencao INT DEFAULT 4,
  dias_urgente INT DEFAULT 2,
  corte_capacidade_dia INT NOT NULL DEFAULT 200,
  costura_capacidade_dia INT NOT NULL DEFAULT 120,
  personalizacao_capacidade_dia INT NOT NULL DEFAULT 150,
  revisao_capacidade_dia INT NOT NULL DEFAULT 200,
  lead_time_corte INT NOT NULL DEFAULT 1,
  lead_time_costura INT NOT NULL DEFAULT 2,
  lead_time_personalizacao INT NOT NULL DEFAULT 1,
  lead_time_revisao INT NOT NULL DEFAULT 1,
  dias_alerta_risco INT NOT NULL DEFAULT 2,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pcp_settings
  ADD COLUMN IF NOT EXISTS corte_capacidade_dia INT NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS costura_capacidade_dia INT NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS personalizacao_capacidade_dia INT NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS revisao_capacidade_dia INT NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS lead_time_corte INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lead_time_costura INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS lead_time_personalizacao INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lead_time_revisao INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS dias_alerta_risco INT NOT NULL DEFAULT 2;

CREATE TABLE IF NOT EXISTS public.pcp_blocks (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL,
  observacao TEXT,
  bloqueado_por TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  desbloqueado_por TEXT,
  data_desbloqueio TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pcp_blocks
  ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS bloqueado_por TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS desbloqueado_por TEXT,
  ADD COLUMN IF NOT EXISTS data_desbloqueio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.pcp_producao_necessidades (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id TEXT,
  sku TEXT,
  qty_vendida INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_history (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  usuario TEXT,
  acao TEXT,
  antes JSONB,
  depois JSONB,
  detalhes TEXT,
  action TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.order_history
  ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS usuario TEXT,
  ADD COLUMN IF NOT EXISTS acao TEXT,
  ADD COLUMN IF NOT EXISTS antes JSONB,
  ADD COLUMN IF NOT EXISTS depois JSONB,
  ADD COLUMN IF NOT EXISTS detalhes TEXT,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO public.pcp_settings (
  id,
  corte_capacidade_dia,
  costura_capacidade_dia,
  personalizacao_capacidade_dia,
  revisao_capacidade_dia,
  lead_time_corte,
  lead_time_costura,
  lead_time_personalizacao,
  lead_time_revisao,
  dias_alerta_risco
)
VALUES (1, 200, 120, 150, 200, 1, 2, 1, 1, 2)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.pcp_priorities (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  score INT NOT NULL DEFAULT 100,
  motivo TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 12. TABELA DEDICADA DE CONTROLE DE IDEMPOTÊNCIA ATÔMICA
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.idempotency_requests (
  id BIGSERIAL PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
  order_item_id BIGINT REFERENCES public.order_items(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_idempotency_status CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_idempotency_requests_lookup
  ON public.idempotency_requests (idempotency_key, order_id, stage_id);

-- ============================================================================
-- 12.1 TABELAS DE CORTE CONSOLIDADO E ENFESTO TÉCNICO
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.corte_allocations (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  product_type TEXT,
  color TEXT,
  size TEXT,
  quantidade_alocada INT NOT NULL CHECK (quantidade_alocada > 0),
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'reallocated', 'released'
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corte_allocations_order_id ON public.corte_allocations(order_id);
CREATE INDEX IF NOT EXISTS idx_corte_allocations_item_key ON public.corte_allocations(item_key);
CREATE INDEX IF NOT EXISTS idx_corte_allocations_status ON public.corte_allocations(status);

CREATE TABLE IF NOT EXISTS public.optitex_riscos_validados (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  fabric TEXT,
  color TEXT,
  tipo_tecido TEXT,
  comprimento_metros NUMERIC(10,3),
  largura_metros NUMERIC(10,3),
  area_metros2 NUMERIC(10,3),
  eficiencia_optitex_pct NUMERIC(5,2),
  grades JSONB,
  composicao TEXT,
  pdf_url TEXT,
  validated_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optitex_riscos_model ON public.optitex_riscos_validados(model);

CREATE TABLE IF NOT EXISTS public.approved_enfesto_plans (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  fabric TEXT,
  color TEXT,
  largura_util NUMERIC(10,3),
  comprimento_total_enfesto NUMERIC(10,3),
  camadas_totais INT,
  metragem_linear_total NUMERIC(10,3),
  kg_total NUMERIC(10,3),
  aproveitamento_medio_pct NUMERIC(5,2),
  grades JSONB,
  riscos JSONB,
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approved_enfesto_plans_model ON public.approved_enfesto_plans(model);

CREATE TABLE IF NOT EXISTS public.ramado_decisions (
  id BIGSERIAL PRIMARY KEY,
  model TEXT NOT NULL,
  fabric TEXT,
  color TEXT,
  tipo_tecido TEXT,
  decision TEXT NOT NULL, -- 'APROVADO_OTIMIZADO' | 'MANTIDO_EXATO'
  plano_exato JSONB,
  plano_otimizado JSONB,
  excedente_proposto JSONB,
  excedente_total NUMERIC DEFAULT 0,
  riscos_antes NUMERIC DEFAULT 0,
  riscos_depois NUMERIC DEFAULT 0,
  ganho_operacional JSONB,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ramado_decisions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ramado_decisions_idempotency
  ON public.ramado_decisions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ramado_decisions_model ON public.ramado_decisions(model);

CREATE TABLE IF NOT EXISTS public.producao_excedentes (
  id BIGSERIAL PRIMARY KEY,
  decision_id BIGINT REFERENCES public.ramado_decisions(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  fabric TEXT,
  color TEXT,
  size TEXT NOT NULL,
  quantidade INT NOT NULL CHECK (quantidade > 0),
  origem TEXT DEFAULT 'EXCEDENTE_DE_PRODUCAO',
  destino TEXT DEFAULT 'ESTOQUE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_producao_excedentes_model ON public.producao_excedentes(model);

-- ============================================================================
-- 13. ÍNDICES ÚNICOS PARCIAIS PARA CONCORRÊNCIA ESTRITA NO BANCO
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_executions_active_operator
  ON public.stage_executions (user_id)
  WHERE status IN ('Em andamento', 'Pausado');

CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_executions_open_stage_order_item
  ON public.stage_executions (order_id, stage_id, COALESCE(order_item_id, -1))
  WHERE status IN ('Em andamento', 'Pausado');

CREATE INDEX IF NOT EXISTS idx_stage_exec_order_stage_status ON public.stage_executions(order_id, stage_id, status);
CREATE INDEX IF NOT EXISTS idx_stage_exec_user_status ON public.stage_executions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_deadline ON public.orders(status, deadline) WHERE deleted_at IS NULL;

-- ============================================================================
-- 14. POLÍTICAS RLS E SEGURANÇA ESTRITA POR PAPEL
-- ============================================================================
-- Habilitar RLS em todas as tabelas produtivas
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_stage_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_stage_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_loss_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcp_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcp_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcp_producao_necessidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_necessidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos_de_corte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_de_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pcp_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 14.1 Remover políticas RLS pré-existentes EXCLUSIVAMENTE nas tabelas da Fase 1
-- Preserva intactas as políticas de quaisquer tabelas externas ou módulos não pertencentes à Fase 1
DO $$
DECLARE
  v_tbl TEXT;
  v_pol RECORD;
  v_phase1_tables TEXT[] := ARRAY[
    'orders', 'order_items', 'stages', 'stage_executions', 'pauses',
    'order_stage_progress', 'order_item_stage_progress', 'order_loss_logs',
    'order_progress_logs', 'pcp_settings', 'pcp_blocks', 'pcp_audit_log',
    'pcp_producao_necessidades', 'producao_necessidades', 'planos_de_corte', 'ordens_de_producao',
    'pcp_priorities', 'order_history', 'idempotency_requests',
    'users'
  ];
BEGIN
  FOREACH v_tbl IN ARRAY v_phase1_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl) THEN
      FOR v_pol IN (
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = v_tbl
      ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_tbl);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- 14.2 Revogar DML direto de anon e authenticated ESTRITAMENTE nas tabelas, sequências e RPCs da Fase 1
DO $$
DECLARE
  v_anon_exists BOOLEAN;
  v_auth_exists BOOLEAN;
  v_sr_exists BOOLEAN;
  v_tbl TEXT;
  v_seq RECORD;
  v_rpc RECORD;
  v_phase1_tables TEXT[] := ARRAY[
    'orders', 'order_items', 'stages', 'stage_executions', 'pauses',
    'order_stage_progress', 'order_item_stage_progress', 'order_loss_logs',
    'order_progress_logs', 'pcp_settings', 'pcp_blocks', 'pcp_audit_log',
    'pcp_producao_necessidades', 'producao_necessidades', 'planos_de_corte', 'ordens_de_producao',
    'pcp_priorities', 'order_history', 'idempotency_requests',
    'users'
  ];
  v_phase1_rpcs TEXT[] := ARRAY[
    'pcp_apply_stage_progress',
    'rpc_start_operation',
    'rpc_pause_operation',
    'rpc_resume_operation',
    'rpc_finish_operation',
    'rpc_record_production',
    'rpc_record_loss',
    'pcp_tx_recalcular_necessidades',
    'pcp_tx_criar_plano_corte',
    'pcp_tx_aprovar_plano_corte',
    'pcp_tx_registrar_op',
    'pcp_tx_registrar_numero_tiny_op',
    'pcp_tx_bloquear_ordem',
    'pcp_tx_desbloquear_ordem',
    'pcp_tx_alterar_prioridade',
    'pcp_tx_reabrir_etapa',
    'pcp_tx_expedir_ordem'
  ];
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'anon') INTO v_anon_exists;
  SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') INTO v_auth_exists;
  SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'service_role') INTO v_sr_exists;

  -- 1. Revogar em cada tabela da Fase 1 individualmente (preserva tabelas externas)
  FOREACH v_tbl IN ARRAY v_phase1_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl) THEN
      IF v_anon_exists THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon;', v_tbl);
      END IF;
      IF v_auth_exists THEN
        EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM authenticated;', v_tbl);
        EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated;', v_tbl);
      END IF;
      IF v_sr_exists THEN
        EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role;', v_tbl);
      END IF;
    END IF;
  END LOOP;

  -- 2. Revogar sequências exclusivamente pertencentes às tabelas da Fase 1
  FOR v_seq IN (
    SELECT s.relname AS seq_name
    FROM pg_class s
    JOIN pg_depend d ON d.objid = s.oid
    JOIN pg_class t ON d.refobjid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE s.relkind = 'S'
      AND n.nspname = 'public'
      AND t.relname = ANY(v_phase1_tables)
  ) LOOP
    IF v_anon_exists THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon;', v_seq.seq_name);
    END IF;
    IF v_sr_exists THEN
      EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role;', v_seq.seq_name);
    END IF;
  END LOOP;

  -- 3. Revogar execução direta das 7 RPCs da Fase 1 de anon, authenticated e PUBLIC
  FOR v_rpc IN (
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(v_phase1_rpcs)
  ) LOOP
    IF v_anon_exists THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, PUBLIC;', v_rpc.proname, v_rpc.args);
    END IF;
    IF v_auth_exists THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated;', v_rpc.proname, v_rpc.args);
    END IF;
    IF v_sr_exists THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role;', v_rpc.proname, v_rpc.args);
    END IF;
  END LOOP;
END $$;

-- 14.3 Helpers SECURITY DEFINER protegidos contra recursão de RLS
CREATE OR REPLACE FUNCTION public.is_management_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
      AND role IN ('Administrador', 'PCP', 'Supervisor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_audit_reader()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
      AND role IN ('Administrador', 'PCP')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_management_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_audit_reader() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_management_user() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_audit_reader() FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_management_user() TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_audit_reader() TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_management_user() TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_audit_reader() TO service_role';
  END IF;
END $$;

-- 14.4 Políticas unificadas de menor privilégio para authenticated
CREATE POLICY "authenticated_select_orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_order_items" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_stages" ON public.stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_order_stage_progress" ON public.order_stage_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_order_item_stage_progress" ON public.order_item_stage_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_order_progress_logs" ON public.order_progress_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_pcp_blocks" ON public.pcp_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_pcp_producao_necessidades" ON public.pcp_producao_necessidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_producao_necessidades" ON public.producao_necessidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_planos_de_corte" ON public.planos_de_corte FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_ordens_de_producao" ON public.ordens_de_producao FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_pcp_priorities" ON public.pcp_priorities FOR SELECT TO authenticated USING (true);

-- Menor privilégio: stage_executions e order_loss_logs apenas para gestão ou próprio operador
CREATE POLICY "authenticated_select_stage_executions" ON public.stage_executions FOR SELECT TO authenticated
USING (
  public.is_management_user()
  OR user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "authenticated_select_order_loss_logs" ON public.order_loss_logs FOR SELECT TO authenticated
USING (
  public.is_management_user()
  OR user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

-- Menor privilégio: pcp_settings e idempotency_requests apenas para gestão
CREATE POLICY "authenticated_select_pcp_settings" ON public.pcp_settings FOR SELECT TO authenticated
USING (
  public.is_management_user()
);

CREATE POLICY "authenticated_select_idempotency_requests" ON public.idempotency_requests FOR SELECT TO authenticated
USING (
  public.is_management_user()
);

-- Menor privilégio: order_history para gestão e Comercial
CREATE POLICY "authenticated_select_order_history" ON public.order_history FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
      AND role IN ('Administrador', 'PCP', 'Supervisor', 'Comercial')
  )
);

-- Leitura restrita da auditoria: apenas Administrador e PCP (via helper SECURITY DEFINER sem recursão)
CREATE POLICY "authenticated_select_pcp_audit_log" ON public.pcp_audit_log FOR SELECT TO authenticated
USING (
  public.is_audit_reader()
);

-- Leitura restrita de usuários: próprio usuário ou gestão (Administrador, PCP, Supervisor via helper)
CREATE POLICY "authenticated_select_users" ON public.users FOR SELECT TO authenticated
USING (
  auth_user_id = auth.uid() OR public.is_management_user()
);

-- ============================================================================
-- 15. RPC INTERNA: PCP_APPLY_STAGE_PROGRESS (MOTOR ATÔMICO E DINÂMICO)
-- ============================================================================
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

  -- Validação centralizada de Supervisor Override
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

    -- Cálculo seguro de conclusão multi-item:
    -- Conta TODOS os order_items do pedido que contêm esta etapa em sua rota,
    -- e verifica se TODOS já estão com finished = true.
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
    p_order_id, p_stage_id, v_order.quantity, v_order.quantity,
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

  -- Transferência para a próxima etapa
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

    -- Criar ou atualizar progresso individual da próxima etapa para o item transferido
    IF p_order_item_id IS NOT NULL THEN
      INSERT INTO public.order_item_stage_progress (
        order_id, order_item_id, stage_id, quantidade_item, quantidade_meta,
        quantidade_recebida, quantidade_boa, quantidade_perdida, quantidade_retrabalho,
        quantidade_transferida, pendencia_reposicao, saldo_pendente, finished,
        status_operacao, released_at, updated_at
      )
      VALUES (
        p_order_id, p_order_item_id, p_next_stage_id, v_target_qty, v_target_qty,
        p_transfer_inc, 0, 0, 0,
        0, 0, v_target_qty, false,
        'LIBERADA', NOW(), NOW()
      )
      ON CONFLICT (order_item_id, stage_id) DO UPDATE SET
        quantidade_recebida = public.order_item_stage_progress.quantidade_recebida + p_transfer_inc,
        status_operacao = CASE
          WHEN public.order_item_stage_progress.status_operacao IN ('EM_ANDAMENTO','PAUSADA','PARCIAL','BLOQUEADA','CONCLUIDA')
          THEN public.order_item_stage_progress.status_operacao
          ELSE 'LIBERADA'
        END,
        updated_at = NOW();
    END IF;
  END IF;

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

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, user_id, usuario, acao,
    quantidade, observacao, valor_anterior, valor_novo, valor_antigo, origem, created_at
  )
  VALUES (
    'order_stage_progress', p_order_id, p_stage_id, v_user.id, v_user.name,
    CASE WHEN COALESCE(p_is_reposition, false) THEN 'APONTAMENTO_REPOSICAO' ELSE 'APONTAMENTO_PRODUCAO' END,
    COALESCE(p_good_inc, 0), COALESCE(p_override_reason, p_observation),
    jsonb_build_object('quantidade_boa', v_current_good, 'quantidade_perdida', v_current_lost, 'pendencia_reposicao', v_current_repl),
    jsonb_build_object(
      'order_id', p_order_id,
      'stage_id', p_stage_id,
      'order_item_id', p_order_item_id,
      'good_inc', p_good_inc,
      'lost_inc', p_lost_inc,
      'rework_inc', p_rework_inc,
      'transfer_inc', p_transfer_inc,
      'next_stage_id', p_next_stage_id,
      'quantidade_boa_total', v_new_good,
      'status_operacao', v_status_op,
      'supervisor_override', p_supervisor_override,
      'idempotency_key', p_idempotency_key
    ),
    jsonb_build_object('quantidade_boa', v_current_good, 'quantidade_perdida', v_current_lost, 'pendencia_reposicao', v_current_repl),
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
    'timestamp_sp', v_now_sp,
    'http_status', 200
  );
END;
$$;

-- ============================================================================
-- 16. RPC: RPC_START_OPERATION
-- ============================================================================
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
  v_now_sp TEXT := TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS-03:00');
BEGIN
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

  IF COALESCE(p_supervisor_override, false) THEN
    IF v_user.role NOT IN ('Administrador', 'Supervisor', 'PCP') THEN
      RETURN jsonb_build_object(
        'error', 'Apenas Administrador, Supervisor ou PCP podem realizar override.',
        'code', 'SUPERVISOR_OVERRIDE_FORBIDDEN',
        'http_status', 403
      );
    END IF;

    IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
      RETURN jsonb_build_object(
        'error', 'Motivo obrigatório para realização de supervisor override.',
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

  -- Resolução da rota da etapa
  IF p_order_item_id IS NOT NULL THEN
    SELECT * INTO v_item
    FROM public.order_items
    WHERE id = p_order_item_id FOR UPDATE;

    IF NOT FOUND OR v_item.order_id <> p_order_id THEN
      RETURN jsonb_build_object('error', 'Item informado não pertence a este pedido.', 'code', 'ITEM_NOT_IN_ORDER', 'http_status', 400);
    END IF;

    v_route_stages := CASE
      WHEN jsonb_typeof(v_item.route_stages) = 'array' AND jsonb_array_length(v_item.route_stages) > 0 THEN v_item.route_stages
      ELSE to_jsonb(v_order.required_stages)
    END;
  ELSE
    v_route_stages := to_jsonb(v_order.required_stages);
  END IF;

  -- Validação estrita de pertencimento da etapa à rota
  IF jsonb_typeof(v_route_stages) <> 'array' OR jsonb_array_length(v_route_stages) = 0 THEN
    RETURN jsonb_build_object('error', 'Rota produtiva não definida para este pedido/item.', 'code', 'STAGE_NOT_IN_ROUTE', 'http_status', 400);
  END IF;

  SELECT ARRAY(
    SELECT (elem::TEXT)::BIGINT
    FROM jsonb_array_elements_text(v_route_stages) AS elem
    WHERE elem ~ '^\d+$'
  ) INTO v_stage_arr;

  v_idx := array_position(v_stage_arr, p_stage_id);
  IF v_idx IS NULL THEN
    IF p_order_item_id IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'Esta etapa não faz parte da rota do item.', 'code', 'STAGE_NOT_IN_ITEM_ROUTE', 'http_status', 400);
    ELSE
      RETURN jsonb_build_object('error', 'Esta etapa não faz parte da rota produtiva.', 'code', 'STAGE_NOT_IN_ROUTE', 'http_status', 400);
    END IF;
  END IF;

  -- Validação da etapa anterior (por item ou por pedido)
  IF v_idx > 1 AND NOT COALESCE(p_supervisor_override, false) THEN
    v_prev_stage_id := v_stage_arr[v_idx - 1];

    IF p_order_item_id IS NOT NULL THEN
      SELECT quantidade_boa, quantidade_transferida, finished
      INTO v_prev_prog
      FROM public.order_item_stage_progress
      WHERE order_item_id = p_order_item_id AND stage_id = v_prev_stage_id;

      IF NOT FOUND OR (COALESCE(v_prev_prog.quantidade_boa, 0) = 0 AND COALESCE(v_prev_prog.quantidade_transferida, 0) = 0 AND NOT COALESCE(v_prev_prog.finished, false)) THEN
        RETURN jsonb_build_object(
          'error', 'A etapa anterior do item ainda não produziu ou transferiu peças.',
          'code', 'PREVIOUS_STAGE_NOT_READY',
          'http_status', 400
        );
      END IF;
    ELSE
      SELECT quantidade_boa, quantidade_transferida, finished
      INTO v_prev_prog
      FROM public.order_stage_progress
      WHERE order_id = p_order_id AND stage_id = v_prev_stage_id;

      IF NOT FOUND OR (COALESCE(v_prev_prog.quantidade_boa, 0) = 0 AND COALESCE(v_prev_prog.quantidade_transferida, 0) = 0 AND NOT COALESCE(v_prev_prog.finished, false)) THEN
        RETURN jsonb_build_object(
          'error', 'A etapa anterior da rota ainda não produziu ou transferiu peças.',
          'code', 'PREVIOUS_STAGE_NOT_READY',
          'http_status', 400
        );
      END IF;
    END IF;
  END IF;

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
        'timestamp_sp', v_now_sp,
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

  BEGIN
    INSERT INTO public.stage_executions (
      order_id, stage_id, order_item_id, user_id,
      start_time, status, total_time_seconds, created_at, updated_at
    )
    VALUES (
      p_order_id, p_stage_id, p_order_item_id, p_user_id,
      NOW(), 'Em andamento', 0, NOW(), NOW()
    )
    RETURNING id INTO v_new_exec_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id, user_id, status INTO v_existing_exec
    FROM public.stage_executions
    WHERE order_id = p_order_id AND stage_id = p_stage_id
      AND COALESCE(order_item_id, -1) = COALESCE(p_order_item_id, -1)
      AND status IN ('Em andamento', 'Pausado')
    LIMIT 1;

    IF FOUND THEN
      IF v_existing_exec.user_id = p_user_id THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true, 'execution_id', v_existing_exec.id, 'status_operacao', 'EM_ANDAMENTO', 'timestamp_sp', v_now_sp, 'http_status', 200);
      ELSE
        RETURN jsonb_build_object('error', 'Etapa já iniciada por outro operador.', 'code', 'CONCURRENT_STAGE_EXECUTION', 'http_status', 409);
      END IF;
    ELSE
      RETURN jsonb_build_object('error', 'Conflito de concorrência com sessão ativa.', 'code', 'OPERATOR_ALREADY_ACTIVE', 'http_status', 409);
    END IF;
  END;

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
      order_id, order_item_id, stage_id, quantidade_item, quantidade_meta,
      quantidade_recebida, quantidade_boa, quantidade_perdida, status_operacao, started_at, updated_at
    )
    VALUES (
      p_order_id, p_order_item_id, p_stage_id, COALESCE(v_item.quantity, 1), COALESCE(v_item.quantity, 1),
      COALESCE(v_item.quantity, 1), 0, 0, 'EM_ANDAMENTO', NOW(), NOW()
    )
    ON CONFLICT (order_item_id, stage_id) DO UPDATE SET
      status_operacao = 'EM_ANDAMENTO',
      started_at = COALESCE(public.order_item_stage_progress.started_at, NOW()),
      updated_at = NOW();
  END IF;

  IF v_order.status = 'Entrada' THEN
    UPDATE public.orders SET status = 'Em Produção', pcp_status = 'EM_PRODUCAO' WHERE id = p_order_id;
  END IF;

  IF COALESCE(p_supervisor_override, false) THEN
    INSERT INTO public.pcp_audit_log (
      entidade, order_id, stage_id, user_id, usuario, acao,
      motivo, observacao, valor_anterior, valor_novo, valor_antigo, origem, created_at
    )
    VALUES (
      'stage_executions', p_order_id, p_stage_id, v_user.id, v_user.name,
      'SUPERVISOR_OVERRIDE_START', p_motivo, 'Intervenção formal de supervisor',
      NULL, jsonb_build_object('supervisor_override', true, 'motivo', p_motivo, 'execution_id', v_new_exec_id),
      NULL, 'RPC:rpc_start_operation', NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'execution_id', v_new_exec_id,
    'status_operacao', 'EM_ANDAMENTO',
    'timestamp_sp', v_now_sp,
    'http_status', 200
  );
END;
$$;

-- ============================================================================
-- 17. RPC: RPC_PAUSE_OPERATION
-- ============================================================================
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
  v_order RECORD;
  v_open_pause RECORD;
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
    RETURN jsonb_build_object('error', 'Seu perfil (' || v_user.role || ') não possui permissão para pausar operações.', 'code', 'INSUFFICIENT_ROLE', 'http_status', 403);
  END IF;

  SELECT * INTO v_exec
  FROM public.stage_executions
  WHERE id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Execução não encontrada.', 'code', 'EXECUTION_NOT_FOUND', 'http_status', 404);
  END IF;

  SELECT status, deleted_at INTO v_order FROM public.orders WHERE id = v_exec.order_id;
  IF NOT FOUND OR v_order.deleted_at IS NOT NULL OR v_order.status IN ('Cancelado', 'Pronto', 'Entregue') THEN
    RETURN jsonb_build_object('error', 'Pedido inexistente, excluído, pronto ou cancelado.', 'code', 'ORDER_INVALID', 'http_status', 400);
  END IF;

  IF v_exec.status = 'Pausado' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status_operacao', 'PAUSADA', 'timestamp_sp', v_now_sp, 'http_status', 200);
  END IF;

  IF v_exec.status = 'Finalizado' THEN
    RETURN jsonb_build_object('error', 'Não é possível pausar uma execução finalizada.', 'code', 'ALREADY_FINISHED', 'http_status', 400);
  END IF;

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
  WHERE execution_id = p_execution_id AND end_pause IS NULL;

  IF NOT FOUND THEN
    INSERT INTO public.pauses (execution_id, start_pause, motivo)
    VALUES (p_execution_id, NOW(), COALESCE(p_motivo, 'Pausa operacional'));
  END IF;

  UPDATE public.stage_executions
  SET status = 'Pausado', updated_at = NOW()
  WHERE id = p_execution_id;

  UPDATE public.order_stage_progress
  SET status_operacao = 'PAUSADA', status = 'PAUSADA', updated_at = NOW()
  WHERE order_id = v_exec.order_id AND stage_id = v_exec.stage_id;

  IF v_exec.order_item_id IS NOT NULL THEN
    UPDATE public.order_item_stage_progress
    SET status_operacao = 'PAUSADA', updated_at = NOW()
    WHERE order_item_id = v_exec.order_item_id AND stage_id = v_exec.stage_id;
  END IF;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, user_id, usuario, acao,
    motivo, observacao, valor_anterior, valor_novo, valor_antigo, origem, created_at
  )
  VALUES (
    'stage_executions', v_exec.order_id, v_exec.stage_id, v_user.id, v_user.name,
    'PAUSA_OPERACAO', p_motivo, 'Execução pausada via sistema',
    jsonb_build_object('execution_id', p_execution_id, 'status_operacao', v_exec.status),
    jsonb_build_object('execution_id', p_execution_id, 'status_operacao', 'PAUSADA', 'motivo', p_motivo, 'supervisor_override', p_supervisor_override),
    jsonb_build_object('execution_id', p_execution_id, 'status_operacao', v_exec.status),
    'RPC', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'execution_id', p_execution_id,
    'status_operacao', 'PAUSADA',
    'timestamp_sp', v_now_sp,
    'http_status', 200
  );
END;
$$;

-- ============================================================================
-- 18. RPC: RPC_RESUME_OPERATION
-- ============================================================================
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
  v_order RECORD;
  v_open_pause RECORD;
  v_pause_duration INT := 0;
  v_other_exec RECORD;
  v_now_sp TEXT := TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS-03:00');
BEGIN
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

  SELECT status, deleted_at INTO v_order FROM public.orders WHERE id = v_exec.order_id;
  IF NOT FOUND OR v_order.deleted_at IS NOT NULL OR v_order.status IN ('Cancelado', 'Pronto', 'Entregue') THEN
    RETURN jsonb_build_object('error', 'Pedido inexistente, excluído, pronto ou cancelado.', 'code', 'ORDER_INVALID', 'http_status', 400);
  END IF;

  IF v_exec.status = 'Em andamento' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status_operacao', 'EM_ANDAMENTO', 'timestamp_sp', v_now_sp, 'http_status', 200);
  END IF;

  IF v_exec.status = 'Finalizado' THEN
    RETURN jsonb_build_object('error', 'Não é possível retomar uma execução finalizada.', 'code', 'ALREADY_FINISHED', 'http_status', 400);
  END IF;

  IF v_exec.user_id <> p_user_id THEN
    IF v_user.role NOT IN ('Administrador', 'Supervisor', 'PCP') THEN
      RETURN jsonb_build_object(
        'error', 'Operador somente pode retomar sua própria execução.',
        'code', 'FORBIDDEN_NOT_OWNER',
        'http_status', 403
      );
    ELSIF NOT COALESCE(p_supervisor_override, false) OR trim(COALESCE(p_motivo, '')) = '' THEN
      RETURN jsonb_build_object(
        'error', 'Ação em execução de outro operador requer supervisor_override=true e justificativa não vazia.',
        'code', 'SUPERVISOR_OVERRIDE_REQUIRED',
        'http_status', 403
      );
    END IF;
  END IF;

  IF NOT COALESCE(v_user.allow_parallel_sessions, false) AND NOT COALESCE(p_supervisor_override, false) THEN
    SELECT id, order_id, stage_id
    INTO v_other_exec
    FROM public.stage_executions se
    WHERE se.user_id = p_user_id
      AND se.status IN ('Em andamento', 'Pausado')
      AND se.id <> p_execution_id
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'error', 'Operador já possui operação ativa no Pedido #' || v_other_exec.order_id,
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
    SET end_pause = NOW(), duration_seconds = v_pause_duration
    WHERE id = v_open_pause.id;
  END IF;

  UPDATE public.stage_executions
  SET status = 'Em andamento', updated_at = NOW()
  WHERE id = p_execution_id;

  UPDATE public.order_stage_progress
  SET status_operacao = 'EM_ANDAMENTO', status = 'EM_ANDAMENTO', updated_at = NOW()
  WHERE order_id = v_exec.order_id AND stage_id = v_exec.stage_id;

  IF v_exec.order_item_id IS NOT NULL THEN
    UPDATE public.order_item_stage_progress
    SET status_operacao = 'EM_ANDAMENTO', updated_at = NOW()
    WHERE order_item_id = v_exec.order_item_id AND stage_id = v_exec.stage_id;
  END IF;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, user_id, usuario, acao,
    motivo, observacao, valor_anterior, valor_novo, valor_antigo, origem, created_at
  )
  VALUES (
    'stage_executions', v_exec.order_id, v_exec.stage_id, v_user.id, v_user.name,
    'RETOMADA_OPERACAO', p_motivo, 'Execução retomada via sistema',
    jsonb_build_object('execution_id', p_execution_id, 'status_operacao', v_exec.status),
    jsonb_build_object(
      'execution_id', p_execution_id,
      'actor_id', v_user.id,
      'original_owner_id', v_exec.user_id,
      'status_operacao', 'EM_ANDAMENTO',
      'pause_duration_seconds', v_pause_duration,
      'supervisor_override', p_supervisor_override,
      'motivo', p_motivo
    ),
    jsonb_build_object('execution_id', p_execution_id, 'status_operacao', v_exec.status),
    'RPC', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'execution_id', p_execution_id,
    'status_operacao', 'EM_ANDAMENTO',
    'pause_duration_seconds', v_pause_duration,
    'timestamp_sp', v_now_sp,
    'http_status', 200
  );
END;
$$;

-- ============================================================================
-- 19. RPC: RPC_FINISH_OPERATION (TRANSAÇÃO COMPLETA, PRONTO E NUNCA ENTREGUE)
-- ============================================================================
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

  v_current_good := COALESCE(v_prog.quantidade_boa, 0);

  -- 1. Determinação de conclusão do ITEM individual (se houver order_item_id)
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

  -- 2. Determinação de conclusão da etapa GLOBAL:
  -- Conta TODOS os order_items do pedido cuja rota inclui esta etapa (inclusive os que ainda não possuem linha em order_item_stage_progress).
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

  IF v_total_items_in_stage > 0 THEN
    v_is_completed := (v_finished_items_in_stage >= v_total_items_in_stage)
      AND (NOT COALESCE(p_partial, false))
      AND (v_current_good >= v_order.quantity)
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
    'timestamp_sp', v_now_sp,
    'http_status', 200
  );
END;
$$;

-- ============================================================================
-- 20. RPC: RPC_RECORD_PRODUCTION (IDEMPOTÊNCIA ATÔMICA E POSSE DE OPERADOR)
-- ============================================================================
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
  v_inserted_id BIGINT;
BEGIN
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object(
      'error', 'Chave de idempotência (idempotency_key) é obrigatória para apontamento de produção.',
      'code', 'IDEMPOTENCY_KEY_REQUIRED',
      'http_status', 400
    );
  END IF;

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

  -- 1. Exigência estrita de execução ativa
  SELECT id, user_id, status INTO v_exec
  FROM public.stage_executions
  WHERE order_id = p_order_id AND stage_id = p_stage_id
    AND COALESCE(order_item_id, -1) = COALESCE(p_order_item_id, -1)
    AND status IN ('Em andamento', 'Pausado')
  ORDER BY id DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Nenhuma execução ativa encontrada para este pedido, etapa e item.',
      'code', 'NO_ACTIVE_EXECUTION',
      'http_status', 409
    );
  END IF;

  -- 2. Proibição de apontamento durante pausa
  IF v_exec.status = 'Pausado' THEN
    RETURN jsonb_build_object(
      'error', 'Operação está pausada. Retome a operação antes de apontar produção.',
      'code', 'EXECUTION_PAUSED',
      'http_status', 409
    );
  END IF;

  IF v_exec.status <> 'Em andamento' THEN
    RETURN jsonb_build_object(
      'error', 'Execução não está em andamento (status: ' || v_exec.status || ').',
      'code', 'EXECUTION_NOT_RUNNING',
      'http_status', 409
    );
  END IF;

  -- 3. Centralização de supervisor override: Operador nunca pode usar override
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

  -- 4. Verificação de posse de execução: não proprietário exige override com justificativa
  IF v_exec.user_id <> p_user_id THEN
    IF v_user.role NOT IN ('Administrador', 'Supervisor', 'PCP') THEN
      RETURN jsonb_build_object(
        'error', 'Operador não é o proprietário da execução ativa nesta etapa.',
        'code', 'EXECUTION_OWNERSHIP_MISMATCH',
        'http_status', 403
      );
    ELSIF NOT COALESCE(p_supervisor_override, false) OR (trim(COALESCE(p_override_reason, '')) = '' AND trim(COALESCE(p_observation, '')) = '') THEN
      RETURN jsonb_build_object(
        'error', 'Apontamento em execução de outro operador requer supervisor_override=true e justificativa.',
        'code', 'SUPERVISOR_OVERRIDE_REQUIRED',
        'http_status', 403
      );
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

  -- Reserva atômica de idempotência sob concorrência real
  INSERT INTO public.idempotency_requests (
    idempotency_key, action, order_id, stage_id, order_item_id, user_id, payload_hash, status
  )
  VALUES (
    trim(p_idempotency_key), 'RECORD_PRODUCTION', p_order_id, p_stage_id, p_order_item_id, p_user_id, v_payload_hash, 'PROCESSING'
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    -- A linha já existia! Bloqueia e inspeciona o estado
    SELECT * INTO v_idemp
    FROM public.idempotency_requests
    WHERE idempotency_key = trim(p_idempotency_key)
    FOR UPDATE;

    IF v_idemp.payload_hash <> v_payload_hash OR v_idemp.order_id <> p_order_id OR v_idemp.stage_id <> p_stage_id THEN
      RETURN jsonb_build_object(
        'error', 'Conflito de idempotência: a mesma chave foi utilizada com payload ou destino divergente.',
        'code', 'IDEMPOTENCY_CONFLICT',
        'http_status', 409
      );
    END IF;

    IF v_idemp.status = 'COMPLETED' THEN
      RETURN v_idemp.response_json || jsonb_build_object('idempotent_replay', true, 'http_status', 200);
    ELSIF v_idemp.status = 'PROCESSING' THEN
      RETURN jsonb_build_object('error', 'Requisição idêntica já em processamento.', 'code', 'CONCURRENT_REQUEST', 'http_status', 409);
    END IF;
  END IF;

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
    p_supervisor_override := COALESCE(p_supervisor_override, false),
    p_override_reason := p_override_reason
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

-- ============================================================================
-- 21. RPC: RPC_RECORD_LOSS (PERDAS TRANSACIONAIS E REPOSIÇÃO COM IDEMPOTÊNCIA)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_record_loss(
  p_order_id BIGINT,
  p_stage_id BIGINT,
  p_user_id BIGINT,
  p_lost_qty INT,
  p_reason TEXT,
  p_reason_detail TEXT DEFAULT NULL,
  p_reentry_stage_id BIGINT DEFAULT NULL,
  p_order_item_id BIGINT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
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
  v_exec RECORD;
  v_stage_name TEXT;
  v_reentry_stage_name TEXT;
  v_target_reentry_id BIGINT;
  v_prog RECORD;
  v_target_qty INT;
  v_prev_good INT;
  v_prev_lost INT;
  v_new_lost INT;
  v_inserted_loss_id BIGINT;
  v_payload_hash TEXT;
  v_idemp RECORD;
  v_inserted_id BIGINT;
  v_result JSONB;
  v_now_sp TEXT := TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS-03:00');
  v_item RECORD;
  v_stage_in_route BOOLEAN;
BEGIN
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

  -- Validação de Supervisor Override
  IF COALESCE(p_supervisor_override, false) THEN
    IF v_user.role NOT IN ('Administrador', 'Supervisor', 'PCP') THEN
      RETURN jsonb_build_object(
        'error', 'Apenas Administrador, Supervisor ou PCP possuem autorização para supervisor override.',
        'code', 'SUPERVISOR_OVERRIDE_FORBIDDEN',
        'http_status', 403
      );
    END IF;
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

  -- 1. Exigência estrita de execução ativa para registrar perda
  SELECT id, user_id, status INTO v_exec
  FROM public.stage_executions
  WHERE order_id = p_order_id AND stage_id = p_stage_id
    AND COALESCE(order_item_id, -1) = COALESCE(p_order_item_id, -1)
    AND status IN ('Em andamento', 'Pausado')
  ORDER BY id DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Nenhuma execução ativa encontrada para este pedido, etapa e item para apontamento de perda.',
      'code', 'NO_ACTIVE_EXECUTION',
      'http_status', 409
    );
  END IF;

  IF v_exec.status = 'Pausado' THEN
    RETURN jsonb_build_object(
      'error', 'Operação está pausada. Retome a operação antes de registrar perda.',
      'code', 'EXECUTION_PAUSED',
      'http_status', 409
    );
  END IF;

  IF v_exec.status <> 'Em andamento' THEN
    RETURN jsonb_build_object(
      'error', 'Execução não está em andamento (status: ' || v_exec.status || ').',
      'code', 'EXECUTION_NOT_RUNNING',
      'http_status', 409
    );
  END IF;

  -- Validação de posse da execução ativa: não proprietário requer supervisor override com justificativa
  IF v_exec.user_id <> p_user_id THEN
    IF v_user.role NOT IN ('Administrador', 'Supervisor', 'PCP') THEN
      RETURN jsonb_build_object(
        'error', 'Operador somente pode apontar perdas em sua própria execução ativa.',
        'code', 'EXECUTION_OWNERSHIP_MISMATCH',
        'http_status', 403
      );
    ELSIF NOT COALESCE(p_supervisor_override, false) OR trim(COALESCE(p_override_reason, p_reason)) = '' THEN
      RETURN jsonb_build_object(
        'error', 'Ação em execução de outro operador requer supervisor_override=true e justificativa.',
        'code', 'SUPERVISOR_OVERRIDE_REQUIRED',
        'http_status', 403
      );
    END IF;
  END IF;

  -- Chave de idempotência é estritamente obrigatória para apontamento de perda
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object(
      'error', 'Chave de idempotência (idempotency_key) é estritamente obrigatória para apontamento de perda.',
      'code', 'IDEMPOTENCY_KEY_REQUIRED',
      'http_status', 400
    );
  END IF;

  SELECT id, order_number, status, pcp_is_blocked, deleted_at, quantity, required_stages INTO v_order
  FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND OR v_order.deleted_at IS NOT NULL OR v_order.status IN ('Cancelado', 'Pronto', 'Entregue') THEN
    RETURN jsonb_build_object('error', 'Pedido inexistente, excluído, pronto ou cancelado.', 'code', 'ORDER_INVALID', 'http_status', 400);
  END IF;

  IF v_order.pcp_is_blocked THEN
    RETURN jsonb_build_object('error', 'Pedido #' || v_order.order_number || ' está BLOQUEADO pelo PCP.', 'code', 'ORDER_BLOCKED', 'http_status', 400);
  END IF;

  -- Validação estrita de item e rota da etapa
  IF p_order_item_id IS NOT NULL THEN
    SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id;
    IF NOT FOUND OR v_item.order_id <> p_order_id THEN
      RETURN jsonb_build_object('error', 'Item informado não pertence a este pedido.', 'code', 'ITEM_NOT_IN_ORDER', 'http_status', 400);
    END IF;

    v_stage_in_route := false;
    IF jsonb_typeof(v_item.route_stages) = 'array' AND jsonb_array_length(v_item.route_stages) > 0 THEN
      v_stage_in_route := EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v_item.route_stages) AS elem
        WHERE elem ~ '^\d+$' AND (elem::TEXT)::BIGINT = p_stage_id
      );
    ELSE
      v_stage_in_route := EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(to_jsonb(v_order.required_stages)) AS elem
        WHERE elem ~ '^\d+$' AND (elem::TEXT)::BIGINT = p_stage_id
      );
    END IF;

    IF NOT v_stage_in_route THEN
      RETURN jsonb_build_object('error', 'Esta etapa não faz parte da rota do item.', 'code', 'STAGE_NOT_IN_ITEM_ROUTE', 'http_status', 400);
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(to_jsonb(v_order.required_stages)) AS elem
      WHERE elem ~ '^\d+$' AND (elem::TEXT)::BIGINT = p_stage_id
    ) THEN
      RETURN jsonb_build_object('error', 'Esta etapa não faz parte da rota produtiva do pedido.', 'code', 'STAGE_NOT_IN_ROUTE', 'http_status', 400);
    END IF;
  END IF;

  -- Idempotência atômica para registro de perda (se informada)
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    v_payload_hash := md5(
      p_order_id::text || ':' ||
      p_stage_id::text || ':' ||
      COALESCE(p_order_item_id, -1)::text || ':' ||
      p_lost_qty::text || ':' ||
      COALESCE(p_reason, '') || ':' ||
      COALESCE(p_reason_detail, '') || ':' ||
      COALESCE(p_reentry_stage_id, -1)::text
    );

    INSERT INTO public.idempotency_requests (
      idempotency_key, action, order_id, stage_id, order_item_id, user_id, payload_hash, status
    )
    VALUES (
      trim(p_idempotency_key), 'RECORD_LOSS', p_order_id, p_stage_id, p_order_item_id, p_user_id, v_payload_hash, 'PROCESSING'
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NULL THEN
      SELECT * INTO v_idemp
      FROM public.idempotency_requests
      WHERE idempotency_key = trim(p_idempotency_key)
      FOR UPDATE;

      IF v_idemp.payload_hash <> v_payload_hash OR v_idemp.order_id <> p_order_id OR v_idemp.stage_id <> p_stage_id THEN
        RETURN jsonb_build_object(
          'error', 'Conflito de idempotência: a mesma chave foi utilizada com payload ou destino divergente.',
          'code', 'IDEMPOTENCY_CONFLICT',
          'http_status', 409
        );
      END IF;

      IF v_idemp.status = 'COMPLETED' THEN
        RETURN v_idemp.response_json || jsonb_build_object('idempotent_replay', true, 'http_status', 200);
      ELSIF v_idemp.status = 'PROCESSING' THEN
        RETURN jsonb_build_object('error', 'Requisição idêntica já em processamento.', 'code', 'CONCURRENT_REQUEST', 'http_status', 409);
      END IF;
    END IF;
  END IF;

  SELECT name INTO v_stage_name FROM public.stages WHERE id = p_stage_id;
  v_stage_name := COALESCE(v_stage_name, 'Etapa #' || p_stage_id);

  v_target_reentry_id := COALESCE(p_reentry_stage_id, p_stage_id);
  SELECT name INTO v_reentry_stage_name FROM public.stages WHERE id = v_target_reentry_id;
  v_reentry_stage_name := COALESCE(v_reentry_stage_name, 'Etapa #' || v_target_reentry_id);

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

  IF v_target_reentry_id IS NOT NULL THEN
    INSERT INTO public.order_stage_progress (
      order_id, stage_id, quantidade_pedido, quantidade_recebida, quantidade_boa, quantidade_perdida,
      pendencia_reposicao, saldo_pendente, finished, status, status_operacao, updated_at
    )
    VALUES (
      p_order_id, v_target_reentry_id, v_target_qty, 0, 0, 0,
      p_lost_qty, v_target_qty, false, 'PARCIAL', 'PARCIAL', NOW()
    )
    ON CONFLICT (order_id, stage_id) DO UPDATE SET
      pendencia_reposicao = COALESCE(public.order_stage_progress.pendencia_reposicao, 0) + p_lost_qty,
      saldo_pendente = GREATEST(0, public.order_stage_progress.quantidade_pedido - COALESCE(public.order_stage_progress.quantidade_boa, 0)) + COALESCE(public.order_stage_progress.pendencia_reposicao, 0) + p_lost_qty,
      finished = false,
      status = 'PARCIAL',
      status_operacao = 'PARCIAL',
      updated_at = NOW();
  END IF;

  IF p_order_item_id IS NOT NULL THEN
    INSERT INTO public.order_item_stage_progress (
      order_id, order_item_id, stage_id, quantidade_item, quantidade_meta,
      quantidade_recebida, quantidade_boa, quantidade_perdida, pendencia_reposicao,
      saldo_pendente, finished, status_operacao, updated_at
    )
    VALUES (
      p_order_id, p_order_item_id, p_stage_id, COALESCE(v_item.quantity, 1), COALESCE(v_item.quantity, 1),
      0, 0, p_lost_qty, 0,
      COALESCE(v_item.quantity, 1), false, 'PARCIAL', NOW()
    )
    ON CONFLICT (order_item_id, stage_id) DO UPDATE SET
      quantidade_perdida = public.order_item_stage_progress.quantidade_perdida + p_lost_qty,
      finished = false,
      status_operacao = 'PARCIAL',
      updated_at = NOW();

    -- Reposição por item
    IF v_target_reentry_id IS NOT NULL THEN
      INSERT INTO public.order_item_stage_progress (
        order_id, order_item_id, stage_id, quantidade_item, quantidade_meta,
        quantidade_recebida, quantidade_boa, quantidade_perdida, pendencia_reposicao,
        saldo_pendente, finished, status_operacao, updated_at
      )
      VALUES (
        p_order_id, p_order_item_id, v_target_reentry_id, COALESCE(v_item.quantity, 1), COALESCE(v_item.quantity, 1),
        0, 0, 0, p_lost_qty,
        COALESCE(v_item.quantity, 1) + p_lost_qty, false, 'PARCIAL', NOW()
      )
      ON CONFLICT (order_item_id, stage_id) DO UPDATE SET
        pendencia_reposicao = public.order_item_stage_progress.pendencia_reposicao + p_lost_qty,
        saldo_pendente = GREATEST(0, public.order_item_stage_progress.quantidade_meta - public.order_item_stage_progress.quantidade_boa) + public.order_item_stage_progress.pendencia_reposicao + p_lost_qty,
        finished = false,
        status_operacao = 'PARCIAL',
        updated_at = NOW();
    END IF;
  END IF;

  INSERT INTO public.order_loss_logs (
    order_id, stage_id, stage_name, user_id, user_name,
    quantidade_perdida, motivo, motivo_detalhe,
    etapa_reentrada_id, etapa_reentrada_name, order_item_id, created_at
  )
  VALUES (
    p_order_id, p_stage_id, v_stage_name, v_user.id, v_user.name,
    p_lost_qty, p_reason, p_reason_detail,
    v_target_reentry_id, v_reentry_stage_name, p_order_item_id, NOW()
  )
  RETURNING id INTO v_inserted_loss_id;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, user_id, usuario, acao,
    quantidade, motivo, observacao, valor_anterior, valor_novo, valor_antigo, origem, created_at
  )
  VALUES (
    'order_loss_logs', p_order_id, p_stage_id, v_user.id, v_user.name, 'REGISTRAR_PERDA',
    p_lost_qty, p_reason, p_reason_detail,
    jsonb_build_object('quantidade_perdida_anterior', v_prev_lost),
    jsonb_build_object(
      'actor_id', v_user.id,
      'original_owner_id', v_exec.user_id,
      'lost_qty', p_lost_qty,
      'quantidade_perdida_nova', v_new_lost,
      'motivo', p_reason,
      'supervisor_override', p_supervisor_override,
      'reentry_stage_id', v_target_reentry_id,
      'order_item_id', p_order_item_id
    ),
    jsonb_build_object('quantidade_perdida_anterior', v_prev_lost),
    'RPC:rpc_record_loss', NOW()
  );

  v_result := jsonb_build_object(
    'success', true,
    'loss_log_id', v_inserted_loss_id,
    'order_id', p_order_id,
    'stage_id', p_stage_id,
    'order_item_id', p_order_item_id,
    'quantidade_perdida', v_new_lost,
    'etapa_reentrada_id', v_target_reentry_id,
    'timestamp_sp', v_now_sp,
    'http_status', 200
  );

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    UPDATE public.idempotency_requests
    SET status = 'COMPLETED', response_json = v_result, updated_at = NOW()
    WHERE idempotency_key = trim(p_idempotency_key);
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 21.1 RPC TRANSAÇÃO ATÔMICA: RECALCULAR NECESSIDADES E AUDITORIA
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pcp_tx_recalcular_necessidades(
  p_necessidades JSONB,
  p_usuario TEXT,
  p_detalhes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_total INT := 0;
  v_order_ids BIGINT[];
  v_now_sp TEXT;
BEGIN
  v_now_sp := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS-03:00');

  IF p_necessidades IS NOT NULL AND jsonb_array_length(p_necessidades) > 0 THEN
    SELECT array_agg(DISTINCT (elem->>'order_id')::BIGINT)
    INTO v_order_ids
    FROM jsonb_array_elements(p_necessidades) elem
    WHERE elem->>'order_id' IS NOT NULL;

    IF v_order_ids IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
      DELETE FROM public.producao_necessidades
      WHERE order_id = ANY(v_order_ids)
        AND status IN ('NECESSITA_NOVO_CORTE', 'AGUARDANDO_PRODUCAO_EXISTENTE', 'COBERTO_PELO_ESTOQUE');
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_necessidades) LOOP
      INSERT INTO public.producao_necessidades (
        order_id,
        order_number,
        sku,
        product_type,
        fabric,
        color,
        size,
        qty_pedida,
        qty_reservada,
        qty_estoque_fisico,
        qty_estoque_disp,
        qty_em_op,
        qty_op_comprometida,
        qty_op_livre,
        qty_necessaria,
        status,
        estoque_consultado_em,
        updated_at
      ) VALUES (
        (v_item->>'order_id')::BIGINT,
        v_item->>'order_number',
        v_item->>'sku',
        v_item->>'product_type',
        v_item->>'fabric',
        v_item->>'color',
        v_item->>'size',
        COALESCE((v_item->>'qty_pedida')::INT, 0),
        COALESCE((v_item->>'qty_reservada')::INT, 0),
        COALESCE((v_item->>'qty_estoque_fisico')::INT, 0),
        COALESCE((v_item->>'qty_estoque_disp')::INT, 0),
        COALESCE((v_item->>'qty_em_op')::INT, 0),
        COALESCE((v_item->>'qty_op_comprometida')::INT, 0),
        COALESCE((v_item->>'qty_op_livre')::INT, 0),
        COALESCE((v_item->>'qty_necessaria')::INT, 0),
        COALESCE(v_item->>'status', 'NECESSITA_NOVO_CORTE'),
        CASE WHEN (v_item->>'estoque_consultado_em') IS NOT NULL THEN (v_item->>'estoque_consultado_em')::TIMESTAMPTZ ELSE NULL END,
        NOW()
      );
      v_total := v_total + 1;
    END LOOP;
  END IF;

  -- Auditoria Atômica Obrigatória
  INSERT INTO public.pcp_audit_log (
    entidade,
    acao,
    usuario,
    quantidade,
    valor_novo,
    detalhes,
    origem,
    created_at
  ) VALUES (
    'producao_necessidades',
    'NECESSIDADES_RECALCULADAS',
    COALESCE(p_usuario, 'Sistema'),
    v_total,
    COALESCE(p_detalhes, '{}'::jsonb),
    COALESCE(p_detalhes, '{}'::jsonb),
    'RPC:pcp_tx_recalcular_necessidades',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'total_recalculadas', v_total,
    'timestamp_sp', v_now_sp
  );
END;
$$;

-- ============================================================================
-- 21.2 RPC TRANSAÇÃO ATÔMICA: CRIAR PLANO DE CORTE E AUDITORIA
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pcp_tx_criar_plano_corte(
  p_plano JSONB,
  p_necessidades_ids BIGINT[],
  p_usuario TEXT,
  p_detalhes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_id BIGINT;
  v_plano_row RECORD;
  v_now_sp TEXT;
  v_qty_planejada INT;
BEGIN
  v_now_sp := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS-03:00');
  v_qty_planejada := COALESCE((p_plano->>'qty_planejada')::INT, 0);

  INSERT INTO public.planos_de_corte (
    plano_numero,
    status,
    fabric,
    color,
    tipo_tecido,
    largura_util,
    qty_planejada,
    enfesto_data,
    pedidos_ids,
    necessidades_ids,
    created_by,
    idempotency_key,
    created_at,
    updated_at
  ) VALUES (
    p_plano->>'plano_numero',
    COALESCE(p_plano->>'status', 'RASCUNHO'),
    p_plano->>'fabric',
    p_plano->>'color',
    p_plano->>'tipo_tecido',
    CASE WHEN (p_plano->>'largura_util') IS NOT NULL THEN (p_plano->>'largura_util')::NUMERIC ELSE NULL END,
    v_qty_planejada,
    COALESCE(p_plano->'enfesto_data', '{}'::jsonb),
    COALESCE(p_plano->'pedidos_ids', '[]'::jsonb),
    COALESCE(to_jsonb(p_necessidades_ids), '[]'::jsonb),
    COALESCE(p_usuario, 'Sistema'),
    p_plano->>'idempotency_key',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_inserted_id;

  -- Vincular necessidades
  IF p_necessidades_ids IS NOT NULL AND array_length(p_necessidades_ids, 1) > 0 THEN
    UPDATE public.producao_necessidades
    SET status = 'INCLUIDO_EM_PLANO',
        plano_corte_id = v_inserted_id,
        updated_at = NOW()
    WHERE id = ANY(p_necessidades_ids);
  END IF;

  -- Auditoria Atômica
  INSERT INTO public.pcp_audit_log (
    entidade,
    acao,
    usuario,
    quantidade,
    valor_novo,
    detalhes,
    origem,
    created_at
  ) VALUES (
    'planos_de_corte',
    'PLANO_CRIADO',
    COALESCE(p_usuario, 'Sistema'),
    v_qty_planejada,
    jsonb_build_object(
      'status', 'CRIADO',
      'plano_id', v_inserted_id,
      'plano_numero', p_plano->>'plano_numero',
      'fabric', p_plano->>'fabric',
      'color', p_plano->>'color',
      'qty_planejada', v_qty_planejada
    ),
    COALESCE(p_detalhes, '{}'::jsonb) || jsonb_build_object('plano_id', v_inserted_id),
    'RPC:pcp_tx_criar_plano_corte',
    NOW()
  );

  SELECT * INTO v_plano_row FROM public.planos_de_corte WHERE id = v_inserted_id;

  RETURN to_jsonb(v_plano_row);
END;
$$;

-- ============================================================================
-- 21.3 RPC TRANSAÇÃO ATÔMICA: APROVAR PLANO DE CORTE E AUDITORIA
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pcp_tx_aprovar_plano_corte(
  p_plano_id BIGINT,
  p_qty_aprovada INT,
  p_usuario TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano RECORD;
  v_updated_plano RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_now_sp TEXT;
  v_nec_id BIGINT;
BEGIN
  v_now_sp := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS-03:00');

  SELECT * INTO v_plano FROM public.planos_de_corte WHERE id = p_plano_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLANO_NOT_FOUND: Plano não encontrado (id=%)', p_plano_id;
  END IF;

  IF v_plano.status = 'APROVADO' THEN
    RETURN jsonb_build_object('success', true, 'already_approved', true, 'plano', to_jsonb(v_plano));
  END IF;

  IF v_plano.status NOT IN ('RASCUNHO', 'AGUARDANDO_APROVACAO') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Plano não pode ser aprovado no status atual: %', v_plano.status;
  END IF;

  UPDATE public.planos_de_corte
  SET status = 'APROVADO',
      qty_aprovada = p_qty_aprovada,
      aprovado_por = p_usuario,
      aprovado_em = v_now,
      revalidado_em = v_now,
      idempotency_key = p_idempotency_key,
      updated_at = v_now
  WHERE id = p_plano_id
  RETURNING * INTO v_updated_plano;

  -- Atualizar necessidades vinculadas
  IF v_plano.necessidades_ids IS NOT NULL AND jsonb_typeof(v_plano.necessidades_ids) = 'array' THEN
    FOR v_nec_id IN
      SELECT (elem#>>'{}')::BIGINT
      FROM jsonb_array_elements(v_plano.necessidades_ids) elem
      WHERE (elem#>>'{}') ~ '^[0-9]+$'
    LOOP
      UPDATE public.producao_necessidades
      SET status = 'PLANO_APROVADO',
          updated_at = v_now
      WHERE id = v_nec_id;
    END LOOP;
  END IF;

  -- Auditoria Atômica
  INSERT INTO public.pcp_audit_log (
    entidade,
    acao,
    usuario,
    quantidade,
    valor_anterior,
    valor_novo,
    detalhes,
    origem,
    created_at
  ) VALUES (
    'planos_de_corte',
    'PLANO_APROVADO',
    COALESCE(p_usuario, 'Sistema'),
    p_qty_aprovada,
    jsonb_build_object('status', v_plano.status),
    jsonb_build_object('status', 'PLANO_APROVADO', 'plano_id', p_plano_id, 'qty_aprovada', p_qty_aprovada),
    jsonb_build_object('plano_id', p_plano_id, 'idempotency_key', p_idempotency_key),
    'RPC:pcp_tx_aprovar_plano_corte',
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'plano', to_jsonb(v_updated_plano),
    'timestamp_sp', v_now_sp
  );
END;
$$;

-- ============================================================================
-- 21.4 RPC TRANSAÇÃO ATÔMICA: REGISTRAR OP (TINY OU MANUAL) E AUDITORIA
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pcp_tx_registrar_op(
  p_op_data JSONB,
  p_acao TEXT,
  p_usuario TEXT,
  p_detalhes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_id BIGINT;
  v_op_row RECORD;
  v_plano_id BIGINT;
  v_qty_total INT;
  v_status TEXT;
  v_now_sp TEXT;
BEGIN
  v_now_sp := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS-03:00');
  v_plano_id := CASE WHEN (p_op_data->>'plano_corte_id') IS NOT NULL THEN (p_op_data->>'plano_corte_id')::BIGINT ELSE NULL END;
  v_qty_total := COALESCE((p_op_data->>'qty_total')::INT, 0);
  v_status := COALESCE(p_op_data->>'status', 'PENDENTE_CADASTRO_TINY');

  INSERT INTO public.ordens_de_producao (
    plano_corte_id,
    tiny_op_id,
    tiny_op_numero,
    sku,
    product_type,
    fabric,
    color,
    size,
    qty_total,
    qty_concluida,
    qty_pendente,
    qty_comprometida,
    status,
    tipo,
    observacao,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    v_plano_id,
    p_op_data->>'tiny_op_id',
    p_op_data->>'tiny_op_numero',
    p_op_data->>'sku',
    p_op_data->>'product_type',
    p_op_data->>'fabric',
    p_op_data->>'color',
    p_op_data->>'size',
    v_qty_total,
    0,
    v_qty_total,
    0,
    v_status,
    COALESCE(p_op_data->>'tipo', CASE WHEN v_plano_id IS NOT NULL THEN 'VINCULADA_PLANO' ELSE 'REPOSICAO' END),
    p_op_data->>'observacao',
    COALESCE(p_usuario, 'Sistema'),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_inserted_id;

  -- Se vinculada a plano e com Tiny criado, atualizar plano para EM_CORTE
  IF v_plano_id IS NOT NULL AND (p_op_data->>'tiny_op_id') IS NOT NULL AND trim(p_op_data->>'tiny_op_id') <> '' THEN
    UPDATE public.planos_de_corte
    SET status = 'EM_CORTE', updated_at = NOW()
    WHERE id = v_plano_id;
  END IF;

  -- Auditoria Atômica
  INSERT INTO public.pcp_audit_log (
    entidade,
    acao,
    usuario,
    quantidade,
    valor_novo,
    detalhes,
    origem,
    created_at
  ) VALUES (
    'ordens_de_producao',
    COALESCE(p_acao, 'OP_REGISTRADA_MANUAL'),
    COALESCE(p_usuario, 'Sistema'),
    v_qty_total,
    jsonb_build_object(
      'op_id', v_inserted_id,
      'status', v_status,
      'tiny_op_id', p_op_data->>'tiny_op_id'
    ),
    COALESCE(p_detalhes, '{}'::jsonb) || jsonb_build_object('op_id', v_inserted_id),
    'RPC:pcp_tx_registrar_op',
    NOW()
  );

  SELECT * INTO v_op_row FROM public.ordens_de_producao WHERE id = v_inserted_id;

  RETURN to_jsonb(v_op_row);
END;
$$;

-- ============================================================================
-- 21.5 RPC TRANSAÇÃO ATÔMICA: REGISTRAR NÚMERO TINY NA OP E AUDITORIA
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pcp_tx_registrar_numero_tiny_op(
  p_op_id BIGINT,
  p_tiny_op_numero TEXT,
  p_tiny_op_id TEXT,
  p_usuario TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op RECORD;
  v_updated_op RECORD;
  v_final_tiny_id TEXT;
  v_now_sp TEXT;
BEGIN
  v_now_sp := to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS-03:00');

  SELECT * INTO v_op FROM public.ordens_de_producao WHERE id = p_op_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OP_NOT_FOUND: Ordem de produção não encontrada (id=%)', p_op_id;
  END IF;

  v_final_tiny_id := COALESCE(p_tiny_op_id, p_tiny_op_numero);

  UPDATE public.ordens_de_producao
  SET tiny_op_numero = p_tiny_op_numero,
      tiny_op_id = v_final_tiny_id,
      status = 'ABERTA',
      updated_at = NOW()
  WHERE id = p_op_id
  RETURNING * INTO v_updated_op;

  -- Auditoria Atômica
  INSERT INTO public.pcp_audit_log (
    entidade,
    acao,
    usuario,
    valor_novo,
    detalhes,
    origem,
    created_at
  ) VALUES (
    'ordens_de_producao',
    'OP_NUMERO_TINY_REGISTRADO',
    COALESCE(p_usuario, 'Sistema'),
    jsonb_build_object(
      'op_id', p_op_id,
      'tiny_op_numero', p_tiny_op_numero,
      'tiny_op_id', v_final_tiny_id,
      'status', 'ABERTA'
    ),
    jsonb_build_object(
      'op_id', p_op_id,
      'tiny_op_numero', p_tiny_op_numero,
      'tiny_op_id', p_tiny_op_id
    ),
    'RPC:pcp_tx_registrar_numero_tiny_op',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'op', to_jsonb(v_updated_op),
    'timestamp_sp', v_now_sp
  );
END;
$$;

-- ============================================================================
-- 21.6 RPC: PCP_TX_BLOQUEAR_ORDEM (BLOQUEIO TRANSACIONAL ATÔMICO COM AUDITORIA)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pcp_tx_bloquear_ordem(
  p_order_id BIGINT,
  p_motivo TEXT,
  p_observacao TEXT DEFAULT NULL,
  p_usuario TEXT DEFAULT 'PCP/Supervisor',
  p_stage_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_order RECORD;
  v_block_id BIGINT;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('error', 'order_id é obrigatório.', 'code', 'ORDER_ID_REQUIRED', 'http_status', 400);
  END IF;
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RETURN jsonb_build_object('error', 'O motivo do bloqueio é obrigatório.', 'code', 'REASON_REQUIRED', 'http_status', 400);
  END IF;

  SELECT id, order_number, pcp_is_blocked, pcp_status, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado.', 'code', 'ORDER_NOT_FOUND', 'http_status', 404);
  END IF;

  INSERT INTO public.pcp_blocks (
    order_id, motivo, observacao, bloqueado_por, is_active, created_at
  ) VALUES (
    p_order_id, trim(p_motivo), p_observacao, COALESCE(p_usuario, 'PCP/Supervisor'), true, NOW()
  ) RETURNING id INTO v_block_id;

  UPDATE public.orders
  SET pcp_is_blocked = true,
      pcp_status = 'BLOQUEADO',
      updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, usuario, acao, motivo, observacao,
    valor_anterior, valor_novo, detalhes, origem, created_at
  ) VALUES (
    'orders', p_order_id, p_stage_id, COALESCE(p_usuario, 'PCP/Supervisor'),
    'BLOQUEIO_PEDIDO', trim(p_motivo), p_observacao,
    jsonb_build_object('pcp_is_blocked', COALESCE(v_order.pcp_is_blocked, false), 'pcp_status', v_order.pcp_status),
    jsonb_build_object('pcp_is_blocked', true, 'pcp_status', 'BLOQUEADO', 'motivo', trim(p_motivo), 'observacao', p_observacao),
    jsonb_build_object('block_id', v_block_id),
    'RPC:pcp_tx_bloquear_ordem', NOW()
  );

  RETURN jsonb_build_object('success', true, 'status_operacao', 'BLOQUEADA', 'http_status', 200);
END;
$$;

-- ============================================================================
-- 21.7 RPC: PCP_TX_DESBLOQUEAR_ORDEM (DESBLOQUEIO TRANSACIONAL ATÔMICO)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pcp_tx_desbloquear_ordem(
  p_order_id BIGINT,
  p_motivo TEXT DEFAULT 'Impedimento resolvido',
  p_usuario TEXT DEFAULT 'PCP/Supervisor'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_order RECORD;
  v_next_status TEXT;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('error', 'order_id é obrigatório.', 'code', 'ORDER_ID_REQUIRED', 'http_status', 400);
  END IF;

  SELECT id, order_number, pcp_is_blocked, pcp_status, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado.', 'code', 'ORDER_NOT_FOUND', 'http_status', 404);
  END IF;

  UPDATE public.pcp_blocks
  SET is_active = false,
      desbloqueado_por = COALESCE(p_usuario, 'PCP/Supervisor'),
      data_desbloqueio = NOW()
  WHERE order_id = p_order_id AND is_active = true;

  v_next_status := CASE WHEN v_order.status = 'Em Produção' THEN 'EM_PRODUCAO' ELSE 'AGUARDANDO LIBERAÇÃO' END;

  UPDATE public.orders
  SET pcp_is_blocked = false,
      pcp_status = v_next_status,
      updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, usuario, acao, motivo,
    valor_anterior, valor_novo, origem, created_at
  ) VALUES (
    'orders', p_order_id, COALESCE(p_usuario, 'PCP/Supervisor'),
    'DESBLOQUEIO_PEDIDO', COALESCE(p_motivo, 'Impedimento resolvido'),
    jsonb_build_object('pcp_is_blocked', COALESCE(v_order.pcp_is_blocked, false), 'pcp_status', COALESCE(v_order.pcp_status, 'BLOQUEADO')),
    jsonb_build_object('pcp_is_blocked', false, 'pcp_status', v_next_status),
    'RPC:pcp_tx_desbloquear_ordem', NOW()
  );

  RETURN jsonb_build_object('success', true, 'next_pcp_status', v_next_status, 'http_status', 200);
END;
$$;

-- ============================================================================
-- 21.8 RPC: PCP_TX_ALTERAR_PRIORIDADE (ALTERAÇÃO TRANSACIONAL DE PRIORIDADE)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pcp_tx_alterar_prioridade(
  p_order_id BIGINT,
  p_priority TEXT,
  p_score INT DEFAULT NULL,
  p_motivo TEXT DEFAULT NULL,
  p_usuario TEXT DEFAULT 'PCP'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_order RECORD;
  v_new_priority TEXT;
  v_new_score INT;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('error', 'order_id é obrigatório.', 'code', 'ORDER_ID_REQUIRED', 'http_status', 400);
  END IF;

  SELECT id, order_number, pcp_priority, pcp_priority_score
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado.', 'code', 'ORDER_NOT_FOUND', 'http_status', 404);
  END IF;

  v_new_priority := COALESCE(NULLIF(trim(p_priority), ''), 'CRÍTICA');
  IF p_score IS NOT NULL THEN
    v_new_score := p_score;
  ELSIF v_new_priority = 'CRÍTICA' THEN
    v_new_score := 1000;
  ELSIF v_new_priority = 'ALTA' THEN
    v_new_score := 500;
  ELSE
    v_new_score := 100;
  END IF;

  UPDATE public.orders
  SET pcp_priority = v_new_priority,
      pcp_priority_score = v_new_score,
      updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, usuario, acao, motivo,
    valor_anterior, valor_novo, origem, created_at
  ) VALUES (
    'orders', p_order_id, COALESCE(p_usuario, 'PCP'),
    'ALTERACAO_PRIORIDADE_MANUAL',
    COALESCE(p_motivo, 'Prioridade manual alterada para ' || v_new_priority),
    jsonb_build_object('pcp_priority', COALESCE(v_order.pcp_priority, 'NORMAL'), 'pcp_priority_score', COALESCE(v_order.pcp_priority_score, 0)),
    jsonb_build_object('pcp_priority', v_new_priority, 'pcp_priority_score', v_new_score, 'motivo', COALESCE(p_motivo, 'Definição manual pelo PCP')),
    'RPC:pcp_tx_alterar_prioridade', NOW()
  );

  RETURN jsonb_build_object('success', true, 'pcp_priority', v_new_priority, 'pcp_priority_score', v_new_score, 'http_status', 200);
END;
$$;

-- ============================================================================
-- 21.9 RPC: PCP_TX_REABRIR_ETAPA (REABERTURA TRANSACIONAL ATÔMICA COM AUDITORIA)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pcp_tx_reabrir_etapa(
  p_order_id BIGINT,
  p_stage_id BIGINT,
  p_motivo TEXT DEFAULT NULL,
  p_usuario TEXT DEFAULT 'Supervisor/Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_order RECORD;
  v_prog RECORD;
  v_open_exec_ids BIGINT[];
  v_updated_status TEXT;
BEGIN
  IF p_order_id IS NULL OR p_stage_id IS NULL THEN
    RETURN jsonb_build_object('error', 'order_id e stage_id são obrigatórios.', 'code', 'PARAMS_REQUIRED', 'http_status', 400);
  END IF;

  SELECT id, status, quantity INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado.', 'code', 'ORDER_NOT_FOUND', 'http_status', 404);
  END IF;

  -- Localiza execuções abertas na etapa
  SELECT array_agg(id) INTO v_open_exec_ids
  FROM public.stage_executions
  WHERE order_id = p_order_id AND stage_id = p_stage_id AND status <> 'Finalizado';

  IF v_open_exec_ids IS NOT NULL AND array_length(v_open_exec_ids, 1) > 0 THEN
    UPDATE public.pauses
    SET end_pause = NOW(), duration_seconds = 0
    WHERE execution_id = ANY(v_open_exec_ids) AND end_pause IS NULL;

    UPDATE public.stage_executions
    SET status = 'Finalizado', end_time = NOW()
    WHERE id = ANY(v_open_exec_ids);
  END IF;

  SELECT * INTO v_prog
  FROM public.order_stage_progress
  WHERE order_id = p_order_id AND stage_id = p_stage_id
  FOR UPDATE;

  UPDATE public.order_stage_progress
  SET finished = false, quantidade_boa = 0, updated_at = NOW()
  WHERE order_id = p_order_id AND stage_id = p_stage_id;

  v_updated_status := v_order.status;
  IF p_stage_id = 1 THEN
    v_updated_status := 'Entrada';
    UPDATE public.orders
    SET status = 'Entrada', delivered_at = NULL, pcp_status = 'AGUARDANDO LIBERAÇÃO', updated_at = NOW()
    WHERE id = p_order_id;
  ELSIF v_order.status = 'Entregue' THEN
    v_updated_status := 'Em Produção';
    UPDATE public.orders
    SET status = 'Em Produção', delivered_at = NULL, pcp_status = 'EM_PRODUCAO', updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, usuario, acao, motivo,
    valor_anterior, valor_novo, origem, created_at
  ) VALUES (
    'order_stage_progress', p_order_id, p_stage_id, COALESCE(p_usuario, 'Supervisor/Admin'),
    'REABERTURA_ETAPA', COALESCE(p_motivo, 'Reabertura manual da etapa'),
    jsonb_build_object('finished', COALESCE(v_prog.finished, true), 'quantidade_boa', COALESCE(v_prog.quantidade_boa, 0)),
    jsonb_build_object('finished', false, 'quantidade_boa', 0, 'status_operacao', 'LIBERADA', 'order_status', v_updated_status),
    'RPC:pcp_tx_reabrir_etapa', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_status', v_updated_status,
    'status_operacao', 'LIBERADA',
    'http_status', 200
  );
END;
$$;

-- ============================================================================
-- 21.10 RPC: PCP_TX_EXPEDIR_ORDEM (EXPEDIÇÃO / ENTREGA ATÔMICA COM AUDITORIA)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pcp_tx_expedir_ordem(
  p_order_id BIGINT,
  p_observacao TEXT DEFAULT NULL,
  p_usuario TEXT DEFAULT 'Comercial/Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('error', 'order_id é obrigatório.', 'code', 'ORDER_ID_REQUIRED', 'http_status', 400);
  END IF;

  SELECT id, order_number, status, pcp_status, delivered_at
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado.', 'code', 'ORDER_NOT_FOUND', 'http_status', 404);
  END IF;

  UPDATE public.orders
  SET status = 'Entregue',
      pcp_status = 'EXPEDIDO_ENTREGUE',
      delivered_at = NOW(),
      updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, usuario, acao, observacao,
    valor_anterior, valor_novo, origem, created_at
  ) VALUES (
    'orders', p_order_id, COALESCE(p_usuario, 'Comercial/Admin'),
    'EXPEDICAO_ENTREGA_CLIENTE', COALESCE(p_observacao, 'Pedido expedido e entregue ao cliente'),
    jsonb_build_object('status', v_order.status, 'pcp_status', v_order.pcp_status, 'delivered_at', v_order.delivered_at),
    jsonb_build_object('status', 'Entregue', 'pcp_status', 'EXPEDIDO_ENTREGUE', 'delivered_at', NOW()),
    'RPC:pcp_tx_expedir_ordem', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'Entregue',
    'pcp_status', 'EXPEDIDO_ENTREGUE',
    'delivered_at', NOW(),
    'http_status', 200
  );
END;
$$;

-- ============================================================================
-- 21.1 RPC: PCP_TX_REGISTER_CONSOLIDATED_CUTTING (TRANSAÇÃO ATÔMICA DE CORTE CONSOLIDADO)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pcp_tx_register_consolidated_cutting(
  p_item_key TEXT,
  p_quantidade_cortada NUMERIC,
  p_user_id BIGINT,
  p_allocations JSONB DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_corte_stage RECORD;
  v_corte_stage_id BIGINT;
  v_existing_log RECORD;
  v_alloc RECORD;
  v_order RECORD;
  v_alloc_qty INT;
  v_order_id BIGINT;
  v_total_allocated INT := 0;
  v_affected_order_ids BIGINT[] := '{}';
  v_allocations_result JSONB := '[]'::JSONB;
  v_audit_old JSONB;
  v_items_arr JSONB;
  v_stages_arr JSONB;
  v_item_elem JSONB;
  v_stage_elem JSONB;
  v_new_items JSONB;
  v_new_stages JSONB;
  v_item_matched BOOLEAN;
  v_stage_matched BOOLEAN;
  v_current_good INT;
  v_req_qty INT;
  v_stage_finished BOOLEAN;
  v_alloc_log_id BIGINT;
  v_final_result JSONB;
  v_orders_cursor CURSOR FOR
    SELECT o.id, o.order_number, o.items, o.stages_status, o.quantity, o.total_via_corte, o.deadline
    FROM public.orders o
    WHERE o.deleted_at IS NULL
      AND o.status NOT IN ('Entregue', 'Cancelado')
    ORDER BY o.deadline ASC NULLS LAST, o.id ASC
    FOR UPDATE;
  v_remaining_to_alloc INT;
  v_cur_order RECORD;
  v_order_needed INT;
  v_alloc_for_order INT;
BEGIN
  -- 1. Idempotência / Anti-duplicação (prevenção de duplo clique)
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_log
    FROM public.order_progress_logs
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      IF v_existing_log.response_payload IS NOT NULL THEN
        RETURN v_existing_log.response_payload;
      END IF;
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'item_key', p_item_key,
        'message', 'Operação já processada com sucesso anteriormente (idempotency key reconhecida)'
      );
    END IF;
  END IF;

  -- 2. Validação rigorosa do Ator (apenas da identidade autenticada)
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED: Identificação do operador obrigatória na sessão' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, email, role INTO v_user
  FROM public.users
  WHERE id = p_user_id AND active = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_INACTIVE: Operador não encontrado ou inativo (id=%)', p_user_id USING ERRCODE = '42501';
  END IF;

  -- 3. Localização dinâmica da etapa de Corte por slug/nome estável (NUNCA ID fixo)
  SELECT id, name, sort_order INTO v_corte_stage
  FROM public.stages
  WHERE active = 1 AND (lower(name) = 'corte' OR lower(name) LIKE '%corte%')
  ORDER BY sort_order ASC
  LIMIT 1;

  IF v_corte_stage.id IS NULL THEN
    RAISE EXCEPTION 'CORTE_STAGE_NOT_FOUND: Etapa ativa de corte não configurada' USING ERRCODE = 'P0002';
  END IF;
  v_corte_stage_id := v_corte_stage.id;

  -- 4. Validação de parâmetros
  IF p_item_key IS NULL OR trim(p_item_key) = '' THEN
    RAISE EXCEPTION 'INVALID_ITEM_KEY: Item a cortar é obrigatório' USING ERRCODE = '22023';
  END IF;

  IF p_quantidade_cortada IS NULL OR p_quantidade_cortada <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY: Quantidade cortada deve ser maior que zero' USING ERRCODE = '22003';
  END IF;

  -- 5. Se allocations foi fornecido pelo backend, processar sob lock FOR UPDATE
  IF p_allocations IS NOT NULL AND jsonb_array_length(p_allocations) > 0 THEN
    FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(
      order_id BIGINT,
      quantidade_alocada INT,
      product_type TEXT,
      color TEXT,
      size TEXT
    )
    LOOP
      v_order_id := v_alloc.order_id;
      v_alloc_qty := v_alloc.quantidade_alocada;

      IF v_alloc_qty <= 0 THEN
        CONTINUE;
      END IF;

      SELECT * INTO v_order
      FROM public.orders
      WHERE id = v_order_id AND deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: Pedido % não encontrado ou indisponível', v_order_id USING ERRCODE = 'P0002';
      END IF;

      IF v_order.status IN ('Entregue', 'Cancelado') THEN
        RAISE EXCEPTION 'ORDER_STATUS_INVALID: Pedido % em status % não permite alocação', v_order_id, v_order.status USING ERRCODE = '22023';
      END IF;

      v_audit_old := jsonb_build_object(
        'items', v_order.items,
        'stages_status', v_order.stages_status
      );

      v_items_arr := CASE
        WHEN v_order.items IS NULL THEN '[]'::JSONB
        WHEN jsonb_typeof(v_order.items) = 'array' THEN v_order.items
        ELSE '[]'::JSONB
      END;
      v_new_items := '[]'::JSONB;
      v_item_matched := false;

      FOR v_item_elem IN SELECT * FROM jsonb_array_elements(v_items_arr)
      LOOP
        IF NOT v_item_matched AND (
          v_item_elem->>'item_key' = p_item_key OR
          (v_alloc.size IS NOT NULL AND (v_item_elem->>'size' = v_alloc.size OR v_item_elem->>'tamanho' = v_alloc.size))
        ) THEN
          v_item_elem := jsonb_set(
            v_item_elem,
            '{qty_corte_allocated}',
            to_jsonb(COALESCE((v_item_elem->>'qty_corte_allocated')::INT, 0) + v_alloc_qty)
          );
          v_item_matched := true;
        END IF;
        v_new_items := v_new_items || jsonb_build_array(v_item_elem);
      END LOOP;

      v_stages_arr := CASE
        WHEN v_order.stages_status IS NULL THEN '[]'::JSONB
        WHEN jsonb_typeof(v_order.stages_status) = 'array' THEN v_order.stages_status
        ELSE '[]'::JSONB
      END;
      v_new_stages := '[]'::JSONB;
      v_stage_matched := false;
      v_stage_finished := false;
      v_current_good := 0;

      FOR v_stage_elem IN SELECT * FROM jsonb_array_elements(v_stages_arr)
      LOOP
        IF (v_stage_elem->>'id')::BIGINT = v_corte_stage_id THEN
          v_current_good := COALESCE((v_stage_elem->>'quantidade_boa')::INT, 0) + v_alloc_qty;
          v_req_qty := COALESCE((v_stage_elem->>'quantidade_pedido')::INT, v_order.total_via_corte, v_order.quantity, 1);
          v_stage_finished := (v_current_good >= v_req_qty);
          v_stage_elem := jsonb_set(v_stage_elem, '{quantidade_boa}', to_jsonb(v_current_good));
          v_stage_elem := jsonb_set(v_stage_elem, '{finished}', to_jsonb(v_stage_finished));
          v_stage_matched := true;
        END IF;
        v_new_stages := v_new_stages || jsonb_build_array(v_stage_elem);
      END LOOP;

      IF NOT v_stage_matched THEN
        v_current_good := v_alloc_qty;
        v_req_qty := COALESCE(v_order.total_via_corte, v_order.quantity, 1);
        v_stage_finished := (v_current_good >= v_req_qty);
        v_new_stages := v_new_stages || jsonb_build_array(jsonb_build_object(
          'id', v_corte_stage_id,
          'name', v_corte_stage.name,
          'quantidade_pedido', v_req_qty,
          'quantidade_boa', v_current_good,
          'quantidade_perdida', 0,
          'finished', v_stage_finished
        ));
      END IF;

      UPDATE public.orders
      SET items = v_new_items,
          stages_status = v_new_stages,
          updated_at = NOW()
      WHERE id = v_order_id;

      INSERT INTO public.order_stage_progress (
        order_id, stage_id, quantidade_pedido, quantidade_boa, quantidade_perdida,
        pendencia_reposicao, finished, status_operacao, updated_at
      )
      VALUES (
        v_order_id, v_corte_stage_id, v_req_qty, v_current_good, 0, 0,
        v_stage_finished, CASE WHEN v_stage_finished THEN 'CONCLUIDA' ELSE 'EM_ANDAMENTO' END, NOW()
      )
      ON CONFLICT (order_id, stage_id) DO UPDATE SET
        quantidade_boa = EXCLUDED.quantidade_boa,
        finished = EXCLUDED.finished,
        status_operacao = EXCLUDED.status_operacao,
        updated_at = NOW();

      INSERT INTO public.corte_allocations (
        order_id, item_key, product_type, color, size,
        quantidade_alocada, status, user_id, user_name, idempotency_key, created_at
      )
      VALUES (
        v_order_id, p_item_key, v_alloc.product_type, v_alloc.color, v_alloc.size,
        v_alloc_qty, 'active', v_user.id, v_user.name, p_idempotency_key, NOW()
      )
      RETURNING id INTO v_alloc_log_id;

      INSERT INTO public.order_progress_logs (
        order_id, stage_id, user_id, user_name,
        quantidade_boa_incremento, idempotency_key, created_at
      )
      VALUES (
        v_order_id, v_corte_stage_id, v_user.id, v_user.name,
        v_alloc_qty, p_idempotency_key, NOW()
      );

      INSERT INTO public.pcp_audit_log (
        entidade, order_id, stage_id, user_id, usuario, acao,
        quantidade, valor_anterior, valor_novo, detalhes, origem, created_at
      )
      VALUES (
        'corte_allocations',
        v_order_id,
        v_corte_stage_id,
        v_user.id,
        v_user.name,
        'CORTE_CONSOLIDADO',
        v_alloc_qty,
        v_audit_old,
        jsonb_build_object(
          'item_key', p_item_key,
          'quantidade_alocada', v_alloc_qty,
          'corte_stage_id', v_corte_stage_id,
          'finished', v_stage_finished,
          'corte_allocation_id', v_alloc_log_id
        ),
        jsonb_build_object(
          'idempotency_key', p_idempotency_key,
          'product_type', v_alloc.product_type,
          'color', v_alloc.color,
          'size', v_alloc.size
        ),
        'RPC:pcp_tx_register_consolidated_cutting',
        NOW()
      );

      v_total_allocated := v_total_allocated + v_alloc_qty;
      v_affected_order_ids := array_append(v_affected_order_ids, v_order_id);
      v_allocations_result := v_allocations_result || jsonb_build_array(jsonb_build_object(
        'id', v_alloc_log_id,
        'order_id', v_order_id,
        'order_number', v_order.order_number,
        'item_key', p_item_key,
        'product_type', v_alloc.product_type,
        'color', v_alloc.color,
        'size', v_alloc.size,
        'quantidade_alocada', v_alloc_qty,
        'status', 'active',
        'user_id', v_user.id,
        'user_name', v_user.name,
        'created_at', NOW()
      ));
    END LOOP;
  ELSE
    -- Alocação direta nos pedidos pendentes
    v_remaining_to_alloc := p_quantidade_cortada::INT;

    OPEN v_orders_cursor;
    LOOP
      FETCH v_orders_cursor INTO v_cur_order;
      EXIT WHEN NOT FOUND OR v_remaining_to_alloc <= 0;

      v_order_needed := COALESCE(v_cur_order.total_via_corte, v_cur_order.quantity, 1);
      v_alloc_for_order := LEAST(v_remaining_to_alloc, v_order_needed);

      IF v_alloc_for_order <= 0 THEN
        CONTINUE;
      END IF;

      v_order_id := v_cur_order.id;

      INSERT INTO public.order_stage_progress (
        order_id, stage_id, quantidade_pedido, quantidade_boa, quantidade_perdida,
        pendencia_reposicao, finished, status_operacao, updated_at
      )
      VALUES (
        v_order_id, v_corte_stage_id, v_order_needed, v_alloc_for_order, 0, 0,
        (v_alloc_for_order >= v_order_needed),
        CASE WHEN v_alloc_for_order >= v_order_needed THEN 'CONCLUIDA' ELSE 'EM_ANDAMENTO' END,
        NOW()
      )
      ON CONFLICT (order_id, stage_id) DO UPDATE SET
        quantidade_boa = public.order_stage_progress.quantidade_boa + v_alloc_for_order,
        finished = (public.order_stage_progress.quantidade_boa + v_alloc_for_order >= public.order_stage_progress.quantidade_pedido),
        updated_at = NOW();

      INSERT INTO public.corte_allocations (
        order_id, item_key, quantidade_alocada, status, user_id, user_name, idempotency_key, created_at
      )
      VALUES (
        v_order_id, p_item_key, v_alloc_for_order, 'active', v_user.id, v_user.name, p_idempotency_key, NOW()
      )
      RETURNING id INTO v_alloc_log_id;

      INSERT INTO public.order_progress_logs (
        order_id, stage_id, user_id, user_name,
        quantidade_boa_incremento, idempotency_key, created_at
      )
      VALUES (
        v_order_id, v_corte_stage_id, v_user.id, v_user.name,
        v_alloc_for_order, p_idempotency_key, NOW()
      );

      INSERT INTO public.pcp_audit_log (
        entidade, order_id, stage_id, user_id, usuario, acao,
        quantidade, valor_anterior, valor_novo, detalhes, origem, created_at
      )
      VALUES (
        'corte_allocations',
        v_order_id,
        v_corte_stage_id,
        v_user.id,
        v_user.name,
        'CORTE_CONSOLIDADO',
        v_alloc_for_order,
        '{}'::JSONB,
        jsonb_build_object('item_key', p_item_key, 'quantidade_alocada', v_alloc_for_order, 'stage_id', v_corte_stage_id),
        jsonb_build_object('idempotency_key', p_idempotency_key),
        'RPC:pcp_tx_register_consolidated_cutting',
        NOW()
      );

      v_total_allocated := v_total_allocated + v_alloc_for_order;
      v_remaining_to_alloc := v_remaining_to_alloc - v_alloc_for_order;
      v_affected_order_ids := array_append(v_affected_order_ids, v_order_id);
      v_allocations_result := v_allocations_result || jsonb_build_array(jsonb_build_object(
        'id', v_alloc_log_id,
        'order_id', v_order_id,
        'order_number', v_cur_order.order_number,
        'item_key', p_item_key,
        'quantidade_alocada', v_alloc_for_order,
        'status', 'active',
        'user_id', v_user.id,
        'user_name', v_user.name,
        'created_at', NOW()
      ));
    END LOOP;
    CLOSE v_orders_cursor;
  END IF;

  IF v_total_allocated <= 0 THEN
    RAISE EXCEPTION 'NO_DEMAND_ALLOCATED: Não há demanda pendente ou pedidos disponíveis para o item %', p_item_key USING ERRCODE = '22023';
  END IF;

  v_final_result := jsonb_build_object(
    'success', true,
    'item_key', p_item_key,
    'total_cut', p_quantidade_cortada,
    'total_allocated', v_total_allocated,
    'unallocated_remaining', GREATEST(0, (p_quantidade_cortada::INT - v_total_allocated)),
    'affected_order_ids', to_jsonb(v_affected_order_ids),
    'allocations', v_allocations_result
  );

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    UPDATE public.order_progress_logs
    SET response_payload = v_final_result
    WHERE idempotency_key = p_idempotency_key;
  END IF;

  RETURN v_final_result;
END;
$$;

-- ============================================================================
-- 21.2 RPC: PCP_TX_RECORD_RAMADO_DECISION (TRANSAÇÃO ATÔMICA DECISÃO RAMADO)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pcp_tx_record_ramado_decision(
  p_model TEXT,
  p_fabric TEXT,
  p_color TEXT,
  p_tipo_tecido TEXT,
  p_decision TEXT,
  p_plano_exato JSONB,
  p_plano_otimizado JSONB,
  p_excedente_proposto JSONB,
  p_excedente_total NUMERIC,
  p_riscos_antes NUMERIC,
  p_riscos_depois NUMERIC,
  p_ganho_operacional JSONB,
  p_user_id BIGINT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_decision_id BIGINT;
  v_surplus_key TEXT;
  v_surplus_qty INT;
  v_surplus_items JSONB := '[]'::JSONB;
  v_exc_record_id BIGINT;
  v_decision_record JSONB;
  v_existing_decision RECORD;
BEGIN
  -- 0. Idempotência (Prevenção de duplicidade por duplo clique)
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_decision
    FROM public.ramado_decisions
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'decision', jsonb_build_object(
          'id', v_existing_decision.id,
          'model', v_existing_decision.model,
          'fabric', v_existing_decision.fabric,
          'color', v_existing_decision.color,
          'tipo_tecido', v_existing_decision.tipo_tecido,
          'decision', v_existing_decision.decision,
          'excedente_total', v_existing_decision.excedente_total,
          'user_id', v_existing_decision.user_id,
          'user_name', v_existing_decision.user_name,
          'idempotency_key', v_existing_decision.idempotency_key,
          'created_at', v_existing_decision.created_at
        ),
        'excedentes_gerados', '[]'::JSONB
      );
    END IF;
  END IF;

  -- 1. Validar Ator
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED: Identificação do operador obrigatória na sessão' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, email, role INTO v_user
  FROM public.users
  WHERE id = p_user_id AND active = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_INACTIVE: Operador não encontrado ou inativo (id=%)', p_user_id USING ERRCODE = '42501';
  END IF;

  -- 2. Validar Parâmetros
  IF p_model IS NULL OR trim(p_model) = '' THEN
    RAISE EXCEPTION 'INVALID_MODEL: Modelo é obrigatório' USING ERRCODE = '22023';
  END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('APROVADO_OTIMIZADO', 'MANTIDO_EXATO') THEN
    RAISE EXCEPTION 'INVALID_DECISION: Decisão deve ser APROVADO_OTIMIZADO ou MANTIDO_EXATO' USING ERRCODE = '22023';
  END IF;

  -- 3. Inserir em ramado_decisions
  INSERT INTO public.ramado_decisions (
    model, fabric, color, tipo_tecido, decision,
    plano_exato, plano_otimizado, excedente_proposto,
    excedente_total, riscos_antes, riscos_depois, ganho_operacional,
    user_id, user_name, idempotency_key, created_at
  )
  VALUES (
    p_model, COALESCE(p_fabric, 'RAMADO'), COALESCE(p_color, ''), COALESCE(p_tipo_tecido, 'RAMADO'), p_decision,
    p_plano_exato, p_plano_otimizado, p_excedente_proposto,
    COALESCE(p_excedente_total, 0), COALESCE(p_riscos_antes, 0), COALESCE(p_riscos_depois, 0), p_ganho_operacional,
    v_user.id, v_user.name, p_idempotency_key, NOW()
  )
  RETURNING id INTO v_decision_id;

  -- 4. Se APROVADO_OTIMIZADO, gerar excedentes em producao_excedentes
  IF p_decision = 'APROVADO_OTIMIZADO' AND p_excedente_proposto IS NOT NULL AND jsonb_typeof(p_excedente_proposto) = 'object' THEN
    FOR v_surplus_key, v_surplus_qty IN
      SELECT key, value::INT
      FROM jsonb_each_text(p_excedente_proposto)
    LOOP
      IF v_surplus_qty > 0 THEN
        INSERT INTO public.producao_excedentes (
          decision_id, model, fabric, color, size, quantidade, origem, destino, created_at
        )
        VALUES (
          v_decision_id, p_model, COALESCE(p_fabric, 'RAMADO'), COALESCE(p_color, ''),
          v_surplus_key, v_surplus_qty, 'EXCEDENTE_DE_PRODUCAO', 'ESTOQUE', NOW()
        )
        RETURNING id INTO v_exc_record_id;

        v_surplus_items := v_surplus_items || jsonb_build_array(jsonb_build_object(
          'id', v_exc_record_id,
          'decision_id', v_decision_id,
          'model', p_model,
          'fabric', COALESCE(p_fabric, 'RAMADO'),
          'color', COALESCE(p_color, ''),
          'size', v_surplus_key,
          'quantidade', v_surplus_qty,
          'origem', 'EXCEDENTE_DE_PRODUCAO',
          'destino', 'ESTOQUE',
          'created_at', NOW()
        ));
      END IF;
    END LOOP;
  END IF;

  -- 5. Registrar auditoria em pcp_audit_log
  INSERT INTO public.pcp_audit_log (
    entidade, user_id, usuario, acao,
    valor_anterior, valor_novo, detalhes, origem, created_at
  )
  VALUES (
    'ramado_decisions',
    v_user.id,
    v_user.name,
    'DECISAO_RAMADO',
    '{}'::JSONB,
    jsonb_build_object(
      'decision_id', v_decision_id,
      'model', p_model,
      'decision', p_decision,
      'excedente_total', p_excedente_total
    ),
    jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'excedentes_count', jsonb_array_length(v_surplus_items)
    ),
    'RPC:pcp_tx_record_ramado_decision',
    NOW()
  );

  v_decision_record := jsonb_build_object(
    'id', v_decision_id,
    'model', p_model,
    'fabric', COALESCE(p_fabric, 'RAMADO'),
    'color', COALESCE(p_color, ''),
    'tipo_tecido', COALESCE(p_tipo_tecido, 'RAMADO'),
    'decision', p_decision,
    'excedente_total', COALESCE(p_excedente_total, 0),
    'user_id', v_user.id,
    'user_name', v_user.name,
    'created_at', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'decision', v_decision_record,
    'excedentes_gerados', v_surplus_items
  );
END;
$$;

-- ============================================================================
-- 21.3 TABELAS E RPCS DO FLUXO DE PLANOS DE CORTE, RESET E CANCELAMENTO
-- ============================================================================

-- Sequence segura e concorrente para geração de números de planos de corte
CREATE SEQUENCE IF NOT EXISTS public.cut_plans_plan_number_seq START WITH 1 INCREMENT BY 1;

-- Tabelas de Controle de Planos de Corte
CREATE TABLE IF NOT EXISTS public.cut_plans (
    id              BIGSERIAL PRIMARY KEY,
    plan_number     TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'PENDING_CUT',
    fabric          TEXT,
    color           TEXT,
    tipo_tecido     TEXT,
    largura_util    TEXT,
    qty_planned     INT NOT NULL DEFAULT 0,
    qty_cut         INT NOT NULL DEFAULT 0,
    qty_sewing      INT NOT NULL DEFAULT 0,
    qty_sewing_done INT NOT NULL DEFAULT 0,
    faccao_id       BIGINT,
    snapshot_json   JSONB,
    notes           TEXT,
    created_by      TEXT,
    released_at     TIMESTAMPTZ,
    cut_completed_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cut_plan_items (
    id                   BIGSERIAL PRIMARY KEY,
    plan_id              BIGINT REFERENCES public.cut_plans(id) ON DELETE CASCADE,
    order_id             BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
    order_number         TEXT,
    order_item_id        TEXT,
    sku                  TEXT,
    product_type         TEXT NOT NULL,
    fabric               TEXT,
    color                TEXT,
    size                 TEXT NOT NULL,
    item_key             TEXT NOT NULL,
    quantity_planned     INT NOT NULL DEFAULT 0,
    quantity_cut         INT NOT NULL DEFAULT 0,
    quantity_sewing      INT NOT NULL DEFAULT 0,
    quantity_sewing_done INT NOT NULL DEFAULT 0,
    status               TEXT NOT NULL DEFAULT 'PENDING_CUT',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.production_movements (
    id            BIGSERIAL PRIMARY KEY,
    plan_id       BIGINT REFERENCES public.cut_plans(id) ON DELETE SET NULL,
    plan_item_id  BIGINT REFERENCES public.cut_plan_items(id) ON DELETE SET NULL,
    order_id      BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
    order_number  TEXT,
    plan_number   TEXT,
    movement_type TEXT NOT NULL,
    sku           TEXT,
    product_type  TEXT,
    size          TEXT,
    item_key      TEXT,
    qty_before    INT NOT NULL DEFAULT 0,
    qty_after     INT NOT NULL DEFAULT 0,
    quantity      INT NOT NULL DEFAULT 0,
    notes         TEXT,
    user_name     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dtf_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dtf_location TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

ALTER TABLE public.stages
  ADD COLUMN IF NOT EXISTS real_average_time NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_count INT DEFAULT 0;

-- RPC 21.3.1: pcp_tx_create_cut_plan
CREATE OR REPLACE FUNCTION public.pcp_tx_create_cut_plan(
  p_fabric TEXT,
  p_color TEXT,
  p_tipo_tecido TEXT,
  p_largura_util TEXT,
  p_items JSONB,
  p_notes TEXT,
  p_user_id BIGINT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_seq BIGINT;
  v_year TEXT;
  v_plan_number TEXT;
  v_plan_id BIGINT;
  v_qty_planned INT := 0;
  v_item RECORD;
  v_existing_plan RECORD;
  v_plan_row JSONB;
BEGIN
  -- 0. Idempotência
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_plan
    FROM public.cut_plans
    WHERE notes LIKE '%' || p_idempotency_key || '%'
       OR plan_number = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'id', v_existing_plan.id,
        'plan_number', v_existing_plan.plan_number,
        'status', v_existing_plan.status,
        'qty_planned', v_existing_plan.qty_planned
      );
    END IF;
  END IF;

  -- 1. Validar Ator
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED: Identificação do operador obrigatória na sessão' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, email, role INTO v_user
  FROM public.users
  WHERE id = p_user_id AND active = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_INACTIVE: Operador não encontrado ou inativo (id=%)', p_user_id USING ERRCODE = '42501';
  END IF;

  -- 2. Validar Parâmetros
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_ITEMS: Itens do plano são obrigatórios' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    order_id BIGINT,
    quantity_planned INT
  ) LOOP
    v_qty_planned := v_qty_planned + COALESCE(v_item.quantity_planned, 0);
  END LOOP;

  IF v_qty_planned <= 0 THEN
    RAISE EXCEPTION 'INVALID_QTY_PLANNED: Quantidade planejada deve ser maior que zero' USING ERRCODE = '22003';
  END IF;

  -- 3. Trava de linha nos pedidos envolvidos
  PERFORM id
  FROM public.orders
  WHERE id IN (
    SELECT (x.order_id)::BIGINT
    FROM jsonb_to_recordset(p_items) AS x(order_id BIGINT)
    WHERE x.order_id IS NOT NULL
  )
  FOR UPDATE;

  -- 4. Gerar plan_number concorrente e seguro via sequence
  v_seq := nextval('public.cut_plans_plan_number_seq');
  v_year := to_char(NOW(), 'YYYY');
  v_plan_number := 'PC-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');

  -- 5. Inserir em cut_plans
  INSERT INTO public.cut_plans (
    plan_number, fabric, color, tipo_tecido, largura_util,
    qty_planned, qty_cut, qty_sewing, qty_sewing_done,
    snapshot_json, notes, created_by, status, created_at, updated_at
  )
  VALUES (
    v_plan_number, p_fabric, p_color, p_tipo_tecido, p_largura_util,
    v_qty_planned, 0, 0, 0,
    p_items,
    CASE WHEN p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> ''
         THEN COALESCE(p_notes, '') || ' [idempotency:' || p_idempotency_key || ']'
         ELSE p_notes
    END,
    v_user.name, 'PENDING_CUT', NOW(), NOW()
  )
  RETURNING id INTO v_plan_id;

  -- 6. Inserir itens em cut_plan_items e production_movements
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    order_id BIGINT,
    order_number TEXT,
    order_item_id TEXT,
    sku TEXT,
    product_type TEXT,
    fabric TEXT,
    color TEXT,
    size TEXT,
    item_key TEXT,
    quantity_planned INT
  ) LOOP
    INSERT INTO public.cut_plan_items (
      plan_id, order_id, order_number, order_item_id, sku,
      product_type, fabric, color, size, item_key,
      quantity_planned, quantity_cut, quantity_sewing, quantity_sewing_done,
      status, created_at, updated_at
    )
    VALUES (
      v_plan_id, v_item.order_id, v_item.order_number, v_item.order_item_id, v_item.sku,
      COALESCE(v_item.product_type, 'PRODUTO'), COALESCE(v_item.fabric, p_fabric), COALESCE(v_item.color, p_color),
      COALESCE(v_item.size, 'UN'), COALESCE(v_item.item_key, ''),
      COALESCE(v_item.quantity_planned, 0), 0, 0, 0,
      'PENDING_CUT', NOW(), NOW()
    );

    INSERT INTO public.production_movements (
      plan_id, order_id, order_number, plan_number,
      movement_type, sku, product_type, size, item_key,
      qty_before, qty_after, quantity, notes, user_name, created_at
    )
    VALUES (
      v_plan_id, v_item.order_id, v_item.order_number, v_plan_number,
      'PLAN_CREATED', v_item.sku, v_item.product_type, v_item.size, v_item.item_key,
      0, COALESCE(v_item.quantity_planned, 0), COALESCE(v_item.quantity_planned, 0),
      COALESCE(p_notes, 'Plano de corte criado'), v_user.name, NOW()
    );
  END LOOP;

  -- 7. Auditoria atômica
  INSERT INTO public.pcp_audit_log (
    entidade, user_id, usuario, acao,
    quantidade, valor_anterior, valor_novo, detalhes, origem, created_at
  )
  VALUES (
    'cut_plans',
    v_user.id,
    v_user.name,
    'CRIAR_PLANO_CORTE',
    v_qty_planned,
    '{}'::JSONB,
    jsonb_build_object(
      'plan_id', v_plan_id,
      'plan_number', v_plan_number,
      'qty_planned', v_qty_planned,
      'fabric', p_fabric,
      'color', p_color
    ),
    jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'items_count', jsonb_array_length(p_items)
    ),
    'RPC:pcp_tx_create_cut_plan',
    NOW()
  );

  v_plan_row := jsonb_build_object(
    'id', v_plan_id,
    'plan_number', v_plan_number,
    'fabric', p_fabric,
    'color', p_color,
    'tipo_tecido', p_tipo_tecido,
    'largura_util', p_largura_util,
    'qty_planned', v_qty_planned,
    'status', 'PENDING_CUT',
    'created_by', v_user.name,
    'created_at', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_plan_id,
    'plan', v_plan_row,
    'plan_number', v_plan_number
  );
END;
$$;

-- RPC 21.3.2: pcp_tx_release_cut_plan
CREATE OR REPLACE FUNCTION public.pcp_tx_release_cut_plan(
  p_plan_id BIGINT,
  p_user_id BIGINT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_plan RECORD;
  v_item RECORD;
BEGIN
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED: Identificação do operador obrigatória na sessão' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, email, role INTO v_user
  FROM public.users
  WHERE id = p_user_id AND active = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_INACTIVE: Operador não encontrado ou inativo (id=%)', p_user_id USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_plan
  FROM public.cut_plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND: Plano % não encontrado', p_plan_id USING ERRCODE = 'P0002';
  END IF;

  IF v_plan.status = 'CUT_RELEASED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'plan_number', v_plan.plan_number,
      'status', 'CUT_RELEASED'
    );
  END IF;

  IF v_plan.status <> 'PENDING_CUT' THEN
    RAISE EXCEPTION 'INVALID_STATUS: Apenas planos PENDING_CUT podem ser liberados (status atual: %)', v_plan.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.cut_plans
  SET status = 'CUT_RELEASED',
      released_at = NOW(),
      updated_at = NOW()
  WHERE id = p_plan_id;

  UPDATE public.cut_plan_items
  SET status = 'CUT_RELEASED',
      updated_at = NOW()
  WHERE plan_id = p_plan_id;

  FOR v_item IN
    SELECT * FROM public.cut_plan_items WHERE plan_id = p_plan_id
  LOOP
    INSERT INTO public.production_movements (
      plan_id, plan_item_id, order_id, order_number, plan_number,
      movement_type, sku, product_type, size, item_key,
      qty_before, qty_after, quantity, notes, user_name, created_at
    )
    VALUES (
      p_plan_id, v_item.id, v_item.order_id, v_item.order_number, v_plan.plan_number,
      'CUT_RELEASED', v_item.sku, v_item.product_type, v_item.size, v_item.item_key,
      v_item.quantity_planned, v_item.quantity_planned, v_item.quantity_planned,
      'Liberado para corte', v_user.name, NOW()
    );
  END LOOP;

  INSERT INTO public.pcp_audit_log (
    entidade, user_id, usuario, acao,
    quantidade, valor_anterior, valor_novo, detalhes, origem, created_at
  )
  VALUES (
    'cut_plans',
    v_user.id,
    v_user.name,
    'LIBERAR_PLANO_CORTE',
    v_plan.qty_planned,
    jsonb_build_object('status', v_plan.status),
    jsonb_build_object('status', 'CUT_RELEASED', 'released_at', NOW()),
    jsonb_build_object('plan_id', p_plan_id, 'plan_number', v_plan.plan_number, 'idempotency_key', p_idempotency_key),
    'RPC:pcp_tx_release_cut_plan',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'plan_number', v_plan.plan_number,
    'status', 'CUT_RELEASED'
  );
END;
$$;

-- RPC 21.3.3: pcp_tx_complete_cut_plan
CREATE OR REPLACE FUNCTION public.pcp_tx_complete_cut_plan(
  p_plan_id BIGINT,
  p_qty_cut_actual NUMERIC,
  p_user_id BIGINT,
  p_notes TEXT DEFAULT NULL,
  p_item_quantities JSONB DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_plan RECORD;
  v_item RECORD;
  v_qty_cut_actual INT;
  v_qty_planned INT;
  v_qty_return INT;
  v_it_cut INT;
  v_it_planned INT;
  v_it_return INT;
  v_ratio NUMERIC;
BEGIN
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED: Identificação do operador obrigatória na sessão' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, email, role INTO v_user
  FROM public.users
  WHERE id = p_user_id AND active = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_INACTIVE: Operador não encontrado ou inativo (id=%)', p_user_id USING ERRCODE = '42501';
  END IF;

  IF p_qty_cut_actual IS NULL OR p_qty_cut_actual < 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY: Quantidade cortada deve ser >= 0' USING ERRCODE = '22003';
  END IF;
  v_qty_cut_actual := p_qty_cut_actual::INT;

  SELECT * INTO v_plan
  FROM public.cut_plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND: Plano % não encontrado', p_plan_id USING ERRCODE = 'P0002';
  END IF;

  IF v_plan.status = 'CUT_COMPLETED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'plan_number', v_plan.plan_number,
      'status', 'CUT_COMPLETED',
      'qty_cut', v_plan.qty_cut
    );
  END IF;

  IF v_plan.status <> 'CUT_RELEASED' THEN
    RAISE EXCEPTION 'INVALID_STATUS: Plano deve estar em CUT_RELEASED (status atual: %)', v_plan.status USING ERRCODE = '22023';
  END IF;

  v_qty_planned := COALESCE(v_plan.qty_planned, 0);
  v_qty_return := GREATEST(0, v_qty_planned - v_qty_cut_actual);

  UPDATE public.cut_plans
  SET status = 'CUT_COMPLETED',
      qty_cut = v_qty_cut_actual,
      cut_completed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_plan_id;

  FOR v_item IN
    SELECT * FROM public.cut_plan_items WHERE plan_id = p_plan_id FOR UPDATE
  LOOP
    v_it_planned := COALESCE(v_item.quantity_planned, 0);
    IF p_item_quantities IS NOT NULL AND (p_item_quantities->>(v_item.id::TEXT)) IS NOT NULL THEN
      v_it_cut := (p_item_quantities->>(v_item.id::TEXT))::INT;
    ELSE
      v_ratio := CASE WHEN v_qty_planned > 0 THEN v_it_planned::NUMERIC / v_qty_planned::NUMERIC ELSE 0 END;
      v_it_cut := round(v_qty_cut_actual * v_ratio);
    END IF;

    v_it_return := GREATEST(0, v_it_planned - v_it_cut);

    UPDATE public.cut_plan_items
    SET status = 'CUT_COMPLETED',
        quantity_cut = v_it_cut,
        updated_at = NOW()
    WHERE id = v_item.id;

    IF v_it_return > 0 THEN
      INSERT INTO public.cut_plan_items (
        plan_id, order_id, order_number, order_item_id, sku,
        product_type, fabric, color, size, item_key,
        quantity_planned, quantity_cut, quantity_sewing, quantity_sewing_done,
        status, created_at, updated_at
      )
      VALUES (
        p_plan_id, v_item.order_id, v_item.order_number, v_item.order_item_id, v_item.sku,
        v_item.product_type, v_item.fabric, v_item.color, v_item.size, v_item.item_key,
        v_it_return, 0, 0, 0,
        'PENDING_CUT', NOW(), NOW()
      );
    END IF;

    INSERT INTO public.production_movements (
      plan_id, plan_item_id, order_id, order_number, plan_number,
      movement_type, sku, product_type, size, item_key,
      qty_before, qty_after, quantity, notes, user_name, created_at
    )
    VALUES (
      p_plan_id, v_item.id, v_item.order_id, v_item.order_number, v_plan.plan_number,
      'CUT_COMPLETED', v_item.sku, v_item.product_type, v_item.size, v_item.item_key,
      v_it_planned, v_it_cut, v_it_cut,
      COALESCE(p_notes, 'Corte concluído'), v_user.name, NOW()
    );
  END LOOP;

  INSERT INTO public.pcp_audit_log (
    entidade, user_id, usuario, acao,
    quantidade, valor_anterior, valor_novo, detalhes, origem, created_at
  )
  VALUES (
    'cut_plans',
    v_user.id,
    v_user.name,
    'CONCLUIR_CORTE_PLANO',
    v_qty_cut_actual,
    jsonb_build_object('status', v_plan.status, 'qty_planned', v_qty_planned),
    jsonb_build_object('status', 'CUT_COMPLETED', 'qty_cut', v_qty_cut_actual, 'qty_return', v_qty_return),
    jsonb_build_object('plan_id', p_plan_id, 'plan_number', v_plan.plan_number, 'idempotency_key', p_idempotency_key),
    'RPC:pcp_tx_complete_cut_plan',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'qty_planned', v_qty_planned,
    'qty_cut', v_qty_cut_actual,
    'qty_returned_to_pending', v_qty_return,
    'status', 'CUT_COMPLETED'
  );
END;
$$;

-- RPC 21.3.4: pcp_tx_send_cut_plan_sewing
CREATE OR REPLACE FUNCTION public.pcp_tx_send_cut_plan_sewing(
  p_plan_id BIGINT,
  p_qty_sewing NUMERIC,
  p_user_id BIGINT,
  p_faccao_id BIGINT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_plan RECORD;
  v_item RECORD;
  v_qty_sewing INT;
  v_qty_cut_plan INT;
  v_it_sewing INT;
  v_ratio NUMERIC;
BEGIN
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED: Identificação do operador obrigatória na sessão' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, email, role INTO v_user
  FROM public.users
  WHERE id = p_user_id AND active = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_INACTIVE: Operador não encontrado ou inativo (id=%)', p_user_id USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_plan
  FROM public.cut_plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND: Plano % não encontrado', p_plan_id USING ERRCODE = 'P0002';
  END IF;

  IF v_plan.status = 'IN_SEWING' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'plan_number', v_plan.plan_number,
      'status', 'IN_SEWING',
      'qty_sewing', v_plan.qty_sewing
    );
  END IF;

  IF v_plan.status <> 'CUT_COMPLETED' THEN
    RAISE EXCEPTION 'INVALID_STATUS: Plano deve estar em CUT_COMPLETED para envio à costura (status atual: %)', v_plan.status USING ERRCODE = '22023';
  END IF;

  v_qty_cut_plan := GREATEST(1, COALESCE(v_plan.qty_cut, 1));
  v_qty_sewing := CASE WHEN p_qty_sewing IS NOT NULL AND p_qty_sewing > 0 THEN p_qty_sewing::INT ELSE v_qty_cut_plan END;

  UPDATE public.cut_plans
  SET status = 'IN_SEWING',
      qty_sewing = v_qty_sewing,
      faccao_id = p_faccao_id,
      updated_at = NOW()
  WHERE id = p_plan_id;

  FOR v_item IN
    SELECT * FROM public.cut_plan_items
    WHERE plan_id = p_plan_id AND status = 'CUT_COMPLETED'
    FOR UPDATE
  LOOP
    v_ratio := COALESCE(v_item.quantity_cut, 0)::NUMERIC / v_qty_cut_plan::NUMERIC;
    v_it_sewing := round(v_qty_sewing * v_ratio);

    UPDATE public.cut_plan_items
    SET status = 'IN_SEWING',
        quantity_sewing = v_it_sewing,
        updated_at = NOW()
    WHERE id = v_item.id;

    INSERT INTO public.production_movements (
      plan_id, plan_item_id, order_id, order_number, plan_number,
      movement_type, sku, product_type, size, item_key,
      qty_before, qty_after, quantity, notes, user_name, created_at
    )
    VALUES (
      p_plan_id, v_item.id, v_item.order_id, v_item.order_number, v_plan.plan_number,
      'SEWING_SENT', v_item.sku, v_item.product_type, v_item.size, v_item.item_key,
      COALESCE(v_item.quantity_cut, 0), COALESCE(v_item.quantity_cut, 0), COALESCE(v_item.quantity_cut, 0),
      COALESCE(p_notes, 'Enviado para costura'), v_user.name, NOW()
    );
  END LOOP;

  INSERT INTO public.pcp_audit_log (
    entidade, user_id, usuario, acao,
    quantidade, valor_anterior, valor_novo, detalhes, origem, created_at
  )
  VALUES (
    'cut_plans',
    v_user.id,
    v_user.name,
    'ENVIAR_COSTURA_PLANO',
    v_qty_sewing,
    jsonb_build_object('status', v_plan.status, 'qty_cut', v_plan.qty_cut),
    jsonb_build_object('status', 'IN_SEWING', 'qty_sewing', v_qty_sewing, 'faccao_id', p_faccao_id),
    jsonb_build_object('plan_id', p_plan_id, 'plan_number', v_plan.plan_number, 'idempotency_key', p_idempotency_key),
    'RPC:pcp_tx_send_cut_plan_sewing',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'qty_sewing', v_qty_sewing,
    'status', 'IN_SEWING'
  );
END;
$$;

-- RPC 21.3.5: pcp_tx_return_cut_plan_sewing
CREATE OR REPLACE FUNCTION public.pcp_tx_return_cut_plan_sewing(
  p_plan_id BIGINT,
  p_qty_returned NUMERIC,
  p_user_id BIGINT,
  p_item_quantities JSONB DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_plan RECORD;
  v_item RECORD;
  v_qty_returned INT;
  v_qty_in_sewing INT;
  v_qty_still_sewing INT;
  v_new_status TEXT;
  v_it_returned INT;
  v_it_still_sewing INT;
  v_ratio NUMERIC;
  v_fully_returned_orders BIGINT[] := '{}';
  v_order_id BIGINT;
  v_order RECORD;
  v_target_stage_ids BIGINT[];
  v_stage_id BIGINT;
BEGIN
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED: Identificação do operador obrigatória na sessão' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, email, role INTO v_user
  FROM public.users
  WHERE id = p_user_id AND active = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_INACTIVE: Operador não encontrado ou inativo (id=%)', p_user_id USING ERRCODE = '42501';
  END IF;

  v_qty_returned := COALESCE(p_qty_returned, 0)::INT;
  IF v_qty_returned < 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY: Quantidade retornada deve ser >= 0' USING ERRCODE = '22003';
  END IF;

  SELECT * INTO v_plan
  FROM public.cut_plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND: Plano % não encontrado', p_plan_id USING ERRCODE = 'P0002';
  END IF;

  IF v_plan.status <> 'IN_SEWING' THEN
    RAISE EXCEPTION 'INVALID_STATUS: Plano deve estar em IN_SEWING para registrar retorno (status atual: %)', v_plan.status USING ERRCODE = '22023';
  END IF;

  v_qty_in_sewing := COALESCE(v_plan.qty_sewing, 0);
  v_qty_still_sewing := GREATEST(0, v_qty_in_sewing - v_qty_returned);
  v_new_status := CASE WHEN v_qty_still_sewing <= 0 THEN 'SEWING_COMPLETED' ELSE 'IN_SEWING' END;

  UPDATE public.cut_plans
  SET status = v_new_status,
      qty_sewing_done = COALESCE(qty_sewing_done, 0) + v_qty_returned,
      qty_sewing = v_qty_still_sewing,
      updated_at = NOW()
  WHERE id = p_plan_id;

  INSERT INTO public.production_movements (
    plan_id, order_id, plan_number, movement_type,
    qty_before, qty_after, quantity, notes, user_name, created_at
  )
  VALUES (
    p_plan_id, NULL, v_plan.plan_number, 'SEWING_RETURNED',
    v_qty_in_sewing, v_qty_still_sewing, v_qty_returned,
    COALESCE(p_notes, 'Retorno de costura'), v_user.name, NOW()
  );

  FOR v_item IN
    SELECT * FROM public.cut_plan_items
    WHERE plan_id = p_plan_id AND status = 'IN_SEWING'
    FOR UPDATE
  LOOP
    IF p_item_quantities IS NOT NULL AND (p_item_quantities->>(v_item.id::TEXT)) IS NOT NULL THEN
      v_it_returned := (p_item_quantities->>(v_item.id::TEXT))::INT;
    ELSE
      v_ratio := CASE WHEN v_qty_in_sewing > 0 THEN COALESCE(v_item.quantity_sewing, 0)::NUMERIC / v_qty_in_sewing::NUMERIC ELSE 0 END;
      v_it_returned := round(v_qty_returned * v_ratio);
    END IF;

    v_it_still_sewing := GREATEST(0, COALESCE(v_item.quantity_sewing, 0) - v_it_returned);

    UPDATE public.cut_plan_items
    SET status = CASE WHEN v_it_still_sewing <= 0 THEN 'SEWING_COMPLETED' ELSE 'IN_SEWING' END,
        quantity_sewing_done = COALESCE(quantity_sewing_done, 0) + v_it_returned,
        quantity_sewing = v_it_still_sewing,
        updated_at = NOW()
    WHERE id = v_item.id;

    IF v_it_returned > 0 THEN
      INSERT INTO public.production_movements (
        plan_id, plan_item_id, order_id, order_number, plan_number,
        movement_type, sku, product_type, size, item_key,
        qty_before, qty_after, quantity, notes, user_name, created_at
      )
      VALUES (
        p_plan_id, v_item.id, v_item.order_id, v_item.order_number, v_plan.plan_number,
        'SEWING_RETURNED', v_item.sku, v_item.product_type, v_item.size, v_item.item_key,
        COALESCE(v_item.quantity_sewing, 0), v_it_still_sewing, v_it_returned,
        COALESCE(p_notes, 'Retornou da costura'), v_user.name, NOW()
      );
    END IF;

    IF v_it_still_sewing <= 0 AND v_item.order_id IS NOT NULL THEN
      IF NOT (v_item.order_id = ANY(v_fully_returned_orders)) THEN
        v_fully_returned_orders := array_append(v_fully_returned_orders, v_item.order_id);
      END IF;
    END IF;
  END LOOP;

  IF array_length(v_fully_returned_orders, 1) > 0 THEN
    SELECT array_agg(id) INTO v_target_stage_ids
    FROM public.stages
    WHERE active = 1 AND (lower(name) LIKE '%corte%' OR lower(name) LIKE '%costura%' OR lower(name) LIKE '%confecc%');

    FOREACH v_order_id IN ARRAY v_fully_returned_orders LOOP
      SELECT * INTO v_order FROM public.orders WHERE id = v_order_id FOR UPDATE;
      IF FOUND THEN
        FOREACH v_stage_id IN ARRAY COALESCE(v_target_stage_ids, '{}'::BIGINT[]) LOOP
          INSERT INTO public.order_stage_progress (
            order_id, stage_id, quantidade_pedido, quantidade_boa, quantidade_perdida,
            pendencia_reposicao, finished, status_operacao, updated_at
          )
          VALUES (
            v_order_id, v_stage_id, COALESCE(v_order.quantity, 1), COALESCE(v_order.quantity, 1), 0,
            0, true, 'CONCLUIDA', NOW()
          )
          ON CONFLICT (order_id, stage_id) DO UPDATE SET
            quantidade_boa = EXCLUDED.quantidade_boa,
            finished = true,
            status_operacao = 'CONCLUIDA',
            updated_at = NOW();
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.pcp_audit_log (
    entidade, user_id, usuario, acao,
    quantidade, valor_anterior, valor_novo, detalhes, origem, created_at
  )
  VALUES (
    'cut_plans',
    v_user.id,
    v_user.name,
    'RETORNO_COSTURA_PLANO',
    v_qty_returned,
    jsonb_build_object('status', v_plan.status, 'qty_sewing', v_qty_in_sewing),
    jsonb_build_object('status', v_new_status, 'qty_sewing', v_qty_still_sewing, 'qty_returned', v_qty_returned),
    jsonb_build_object('plan_id', p_plan_id, 'plan_number', v_plan.plan_number, 'idempotency_key', p_idempotency_key),
    'RPC:pcp_tx_return_cut_plan_sewing',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'qty_returned', v_qty_returned,
    'qty_still_in_sewing', v_qty_still_sewing,
    'status', v_new_status
  );
END;
$$;

-- RPC 21.3.6: pcp_tx_cancel_cut_plan
CREATE OR REPLACE FUNCTION public.pcp_tx_cancel_cut_plan(
  p_plan_id BIGINT,
  p_user_id BIGINT,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_plan RECORD;
  v_item RECORD;
BEGIN
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED: Identificação do operador obrigatória na sessão' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, email, role INTO v_user
  FROM public.users
  WHERE id = p_user_id AND active = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_INACTIVE: Operador não encontrado ou inativo (id=%)', p_user_id USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_plan
  FROM public.cut_plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND: Plano % não encontrado', p_plan_id USING ERRCODE = 'P0002';
  END IF;

  IF v_plan.status = 'CANCELLED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'status', 'CANCELLED',
      'qty_returned_to_pending', v_plan.qty_planned
    );
  END IF;

  IF v_plan.status NOT IN ('PENDING_CUT', 'CUT_RELEASED') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Apenas planos PENDING_CUT e CUT_RELEASED podem ser cancelados (status atual: %)', v_plan.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.cut_plans
  SET status = 'CANCELLED',
      updated_at = NOW()
  WHERE id = p_plan_id;

  UPDATE public.cut_plan_items
  SET status = 'CANCELLED',
      updated_at = NOW()
  WHERE plan_id = p_plan_id;

  FOR v_item IN
    SELECT * FROM public.cut_plan_items WHERE plan_id = p_plan_id
  LOOP
    INSERT INTO public.production_movements (
      plan_id, plan_item_id, order_id, order_number, plan_number,
      movement_type, sku, product_type, size, item_key,
      qty_before, qty_after, quantity, notes, user_name, created_at
    )
    VALUES (
      p_plan_id, v_item.id, v_item.order_id, v_item.order_number, v_plan.plan_number,
      'PLAN_CANCELLED', v_item.sku, v_item.product_type, v_item.size, v_item.item_key,
      v_item.quantity_planned, 0, v_item.quantity_planned,
      COALESCE(p_reason, 'Liberação cancelada — quantidades retornam para pendência de corte'),
      v_user.name, NOW()
    );
  END LOOP;

  INSERT INTO public.pcp_audit_log (
    entidade, user_id, usuario, acao,
    quantidade, valor_anterior, valor_novo, detalhes, origem, created_at
  )
  VALUES (
    'cut_plans',
    v_user.id,
    v_user.name,
    'CANCELAR_PLANO_CORTE',
    v_plan.qty_planned,
    jsonb_build_object('status', v_plan.status),
    jsonb_build_object('status', 'CANCELLED', 'reason', p_reason),
    jsonb_build_object('plan_id', p_plan_id, 'plan_number', v_plan.plan_number, 'idempotency_key', p_idempotency_key),
    'RPC:pcp_tx_cancel_cut_plan',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'CANCELLED',
    'qty_returned_to_pending', v_plan.qty_planned,
    'message', v_plan.qty_planned || ' peças retornaram para pendência de corte'
  );
END;
$$;

-- RPC 21.3.7: pcp_tx_reset_production
CREATE OR REPLACE FUNCTION public.pcp_tx_reset_production(
  p_confirmation_text TEXT,
  p_user_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_orders_count INT := 0;
BEGIN
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED: Identificação do administrador obrigatória na sessão' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, email, role INTO v_user
  FROM public.users
  WHERE id = p_user_id AND active = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_INACTIVE: Usuário não encontrado ou inativo (id=%)', p_user_id USING ERRCODE = '42501';
  END IF;

  IF lower(v_user.role) NOT IN ('administrador', 'admin') THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE: Apenas Administradores podem executar o reset total de produção' USING ERRCODE = '42501';
  END IF;

  IF p_confirmation_text IS NULL OR trim(p_confirmation_text) <> 'RESETAR_PRODUCAO_CONFIRMADO' THEN
    RAISE EXCEPTION 'CONFIRMATION_TEXT_INVALID: Texto de confirmação incorreto para reset de produção' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.pauses;
  DELETE FROM public.stage_executions;
  DELETE FROM public.order_loss_logs;
  DELETE FROM public.order_progress_logs;
  DELETE FROM public.order_stage_progress;
  DELETE FROM public.production_movements;
  DELETE FROM public.cut_plan_items;
  DELETE FROM public.cut_plans;
  DELETE FROM public.corte_allocations;
  DELETE FROM public.producao_excedentes;

  UPDATE public.orders
  SET total_time_seconds = 0
  WHERE deleted_at IS NULL;

  UPDATE public.stages
  SET real_average_time = 0,
      execution_count = 0;

  UPDATE public.orders
  SET stages_status = COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_set(
          jsonb_set(elem.value, '{finished}', 'false'::jsonb),
          '{in_progress}', 'false'::jsonb
        )
      )
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(stages_status) = 'array' THEN stages_status ELSE '[]'::jsonb END
      ) AS elem(value)
    ),
    '[]'::jsonb
  )
  WHERE stages_status IS NOT NULL AND jsonb_typeof(stages_status) = 'array' AND jsonb_array_length(stages_status) > 0;

  GET DIAGNOSTICS v_orders_count = ROW_COUNT;

  INSERT INTO public.pcp_audit_log (
    entidade, user_id, usuario, acao,
    quantidade, valor_anterior, valor_novo, detalhes, origem, created_at
  )
  VALUES (
    'production_reset',
    v_user.id,
    v_user.name,
    'RESET_PRODUCAO',
    0,
    '{}'::JSONB,
    jsonb_build_object('reset_completed', true, 'orders_reset', v_orders_count),
    jsonb_build_object('confirmed_by', v_user.email, 'timestamp', NOW()),
    'RPC:pcp_tx_reset_production',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Histórico de relatórios e tempos resetados com sucesso! Os pedidos foram preservados.',
    'orders_reset', v_orders_count
  );
END;
$$;

-- RPC 21.3.8: pcp_tx_cancel_order
CREATE OR REPLACE FUNCTION public.pcp_tx_cancel_order(
  p_order_id BIGINT,
  p_user_id BIGINT,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_order RECORD;
  v_alloc RECORD;
  v_receiving_order RECORD;
  v_remaining_alloc INT;
  v_transfer_qty INT;
  v_reallocated_count INT := 0;
  v_now TIMESTAMPTZ := NOW();
  v_old_data JSONB;
BEGIN
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED: Identificação do operador obrigatória na sessão' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, email, role INTO v_user
  FROM public.users
  WHERE id = p_user_id AND active = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_INACTIVE: Usuário não encontrado ou inativo (id=%)', p_user_id USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: Pedido % não encontrado', p_order_id USING ERRCODE = 'P0002';
  END IF;

  IF v_order.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'ORDER_DELETED: Pedido excluído não pode ser cancelado' USING ERRCODE = '22023';
  END IF;

  IF v_order.status = 'Cancelado' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'order_id', p_order_id,
      'status', 'Cancelado',
      'message', 'Pedido já estava cancelado'
    );
  END IF;

  v_old_data := to_jsonb(v_order);

  UPDATE public.orders
  SET status = 'Cancelado',
      cancelled_at = v_now,
      cancelled_by = v_user.name,
      updated_at = v_now
  WHERE id = p_order_id;

  INSERT INTO public.order_history (
    order_id, usuario, acao, antes, depois, detalhes, created_at
  )
  VALUES (
    p_order_id,
    v_user.name,
    'cancelou',
    v_old_data,
    jsonb_build_object('status', 'Cancelado', 'cancelled_at', v_now, 'cancelled_by', v_user.name),
    COALESCE(p_reason, 'Cancelamento do pedido'),
    v_now
  );

  FOR v_alloc IN
    SELECT * FROM public.corte_allocations
    WHERE order_id = p_order_id AND status = 'active'
    FOR UPDATE
  LOOP
    v_remaining_alloc := v_alloc.quantidade_alocada;

    FOR v_receiving_order IN
      SELECT * FROM public.orders
      WHERE id <> p_order_id
        AND deleted_at IS NULL
        AND status NOT IN ('Entregue', 'Cancelado')
      ORDER BY deadline ASC NULLS LAST, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining_alloc <= 0;
      v_transfer_qty := LEAST(v_remaining_alloc, COALESCE(v_receiving_order.quantity, 1));

      IF v_transfer_qty > 0 THEN
        INSERT INTO public.corte_allocations (
          order_id, item_key, quantidade_alocada, status, user_id, user_name, idempotency_key, created_at
        )
        VALUES (
          v_receiving_order.id, v_alloc.item_key, v_transfer_qty, 'active', v_user.id, v_user.name,
          p_idempotency_key, v_now
        );
        v_remaining_alloc := v_remaining_alloc - v_transfer_qty;
        v_reallocated_count := v_reallocated_count + 1;
      END IF;
    END LOOP;

    UPDATE public.corte_allocations
    SET status = 'cancelled'
    WHERE id = v_alloc.id;
  END LOOP;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, user_id, usuario, acao,
    quantidade, valor_anterior, valor_novo, detalhes, origem, created_at
  )
  VALUES (
    'orders',
    p_order_id,
    v_user.id,
    v_user.name,
    'CANCELAR_PEDIDO',
    COALESCE(v_order.quantity, 0),
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'Cancelado', 'cancelled_at', v_now, 'cancelled_by', v_user.name),
    jsonb_build_object(
      'reason', p_reason,
      'reallocated_count', v_reallocated_count,
      'idempotency_key', p_idempotency_key
    ),
    'RPC:pcp_tx_cancel_order',
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'Cancelado',
    'reallocated_count', v_reallocated_count
  );
END;
$$;

-- ============================================================================
-- 22. SEGURANÇA DAS RPCS: REVOKE PUBLIC / ANON / AUTHENTICATED -> GRANT SERVICE_ROLE
-- ============================================================================
DO $$
DECLARE
  f_name TEXT;
  r RECORD;
BEGIN
  FOREACH f_name IN ARRAY ARRAY[
    'pcp_apply_stage_progress',
    'rpc_start_operation',
    'rpc_pause_operation',
    'rpc_resume_operation',
    'rpc_finish_operation',
    'rpc_record_production',
    'rpc_record_loss',
    'pcp_tx_recalcular_necessidades',
    'pcp_tx_criar_plano_corte',
    'pcp_tx_aprovar_plano_corte',
    'pcp_tx_registrar_op',
    'pcp_tx_registrar_numero_tiny_op',
    'pcp_tx_bloquear_ordem',
    'pcp_tx_desbloquear_ordem',
    'pcp_tx_alterar_prioridade',
    'pcp_tx_reabrir_etapa',
    'pcp_tx_expedir_ordem',
    'pcp_tx_register_consolidated_cutting',
    'pcp_tx_record_ramado_decision',
    'pcp_tx_create_cut_plan',
    'pcp_tx_release_cut_plan',
    'pcp_tx_complete_cut_plan',
    'pcp_tx_send_cut_plan_sewing',
    'pcp_tx_return_cut_plan_sewing',
    'pcp_tx_cancel_cut_plan',
    'pcp_tx_reset_production',
    'pcp_tx_cancel_order'
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

-- RLS e Permissões nas Tabelas de Corte e Planos
ALTER TABLE IF EXISTS public.corte_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.optitex_riscos_validados ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.approved_enfesto_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ramado_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.producao_excedentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cut_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cut_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_movements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.corte_allocations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.optitex_riscos_validados FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.approved_enfesto_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ramado_decisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.producao_excedentes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cut_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cut_plan_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.production_movements FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corte_allocations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.optitex_riscos_validados TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approved_enfesto_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ramado_decisions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.producao_excedentes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cut_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cut_plan_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_movements TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;


