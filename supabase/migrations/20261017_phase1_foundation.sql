-- ============================================================================
-- MIGRATION: Fase 1 - Fundacao, Operacoes, Concorrencia, Permissoes e Auditoria
-- Sistema: ProComfort (Comfort Uniformes)
-- Fuso Horario Oficial: America/Sao_Paulo
-- Seguranca: 100% incremental (IF NOT EXISTS), sem destruicao de dados historicos.
-- ============================================================================

BEGIN;

-- 1. EVOLUCAO DE STAGES (SETORES E REGRAS DE TRANSFERENCIA)
ALTER TABLE public.stages
  ADD COLUMN IF NOT EXISTS sector_name TEXT DEFAULT 'Produção',
  ADD COLUMN IF NOT EXISTS allows_partial_transfer BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_productive BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS setup_time_seconds INT DEFAULT 0;

UPDATE public.stages SET sector_name = 'Preparação / Arte' WHERE name ILIKE '%ficha%' OR name ILIKE '%arte%';
UPDATE public.stages SET sector_name = 'Separação / Estoque' WHERE name ILIKE '%separa%';
UPDATE public.stages SET sector_name = 'Corte' WHERE name ILIKE '%corte%';
UPDATE public.stages SET sector_name = 'Costura' WHERE name ILIKE '%costura%';
UPDATE public.stages SET sector_name = 'Personalização' WHERE name ILIKE '%dtf%' OR name ILIKE '%silk%' OR name ILIKE '%sublima%' OR name ILIKE '%estampa%' OR name ILIKE '%bordado%' OR name ILIKE '%revela%';
UPDATE public.stages SET sector_name = 'Conferência / Embalagem' WHERE name ILIKE '%confer%' OR name ILIKE '%embala%';

-- 2. EVOLUCAO DE USERS (6 PERFIS E CONTROLE DE SESSAO SIMULTANEA)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS allow_parallel_sessions BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sector_name TEXT;

-- 3. EVOLUCAO DE ORDERS (STATUS DE SINCRONIZACAO OLIST E SEPARACAO PRONTO X ENTREGUE)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS production_finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS olist_last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS olist_sync_status TEXT DEFAULT 'OK',
  ADD COLUMN IF NOT EXISTS olist_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS pcp_divergence_alert TEXT;

-- 4. TABELA NORMALIZADA DE ITENS DO PEDIDO (ORDER_ITEMS)
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
  route_stages INT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'AGUARDANDO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id, item_index)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON public.order_items(sku);

-- 5. EVOLUCAO DE ORDER_STAGE_PROGRESS (MAQUINA DE ESTADOS E TRANSFERENCIA PARCIAL)
ALTER TABLE public.order_stage_progress
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'AGUARDANDO',
  ADD COLUMN IF NOT EXISTS quantidade_recebida INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_retrabalho INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_transferida INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS route_position INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill seguro de quantidade_recebida e status nos registros existentes
UPDATE public.order_stage_progress
SET
  quantidade_recebida = CASE WHEN quantidade_recebida = 0 THEN GREATEST(quantidade_pedido, quantidade_boa) ELSE quantidade_recebida END,
  quantidade_transferida = CASE WHEN finished = true AND quantidade_transferida = 0 THEN quantidade_boa ELSE quantidade_transferida END,
  status = CASE
    WHEN finished = true THEN 'CONCLUIDA'
    WHEN quantidade_boa > 0 AND quantidade_boa < quantidade_pedido THEN 'PARCIAL'
    ELSE 'LIBERADA'
  END
WHERE status = 'AGUARDANDO';

-- 6. EVOLUCAO DE PAUSES (MOTIVO DA PAUSA)
ALTER TABLE public.pauses
  ADD COLUMN IF NOT EXISTS pause_reason TEXT DEFAULT 'Pausa operacional';

-- 7. EVOLUCAO DE ORDER_PROGRESS_LOGS (RETRABALHO, TRANSFERENCIA E SESSAO)
ALTER TABLE public.order_progress_logs
  ADD COLUMN IF NOT EXISTS execution_id BIGINT REFERENCES public.stage_executions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantidade_perdida_incremento INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_retrabalho_incremento INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_transferida_incremento INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observation TEXT;

-- 8. EVOLUCAO DE PCP_AUDIT_LOG (AUDITORIA IMUTAVEL COMPLETA)
ALTER TABLE public.pcp_audit_log
  ADD COLUMN IF NOT EXISTS user_id BIGINT,
  ADD COLUMN IF NOT EXISTS operator_id BIGINT,
  ADD COLUMN IF NOT EXISTS sector_name TEXT,
  ADD COLUMN IF NOT EXISTS stage_id BIGINT,
  ADD COLUMN IF NOT EXISTS item_id BIGINT,
  ADD COLUMN IF NOT EXISTS quantity INT,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'WEB';

CREATE INDEX IF NOT EXISTS idx_pcp_audit_log_order_id ON public.pcp_audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_pcp_audit_log_created_at ON public.pcp_audit_log(created_at DESC);

-- 9. INDICES DE PERFORMANCE E CONCORRENCIA (PROTECAO CONTRA CLIQUE DUPLO)
CREATE INDEX IF NOT EXISTS idx_stage_exec_order_stage_status ON public.stage_executions(order_id, stage_id, status);
CREATE INDEX IF NOT EXISTS idx_stage_exec_user_status ON public.stage_executions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_deadline ON public.orders(status, deadline) WHERE deleted_at IS NULL;

-- Impede duas sessoes 'Em andamento' para a mesma ordem + etapa + operador (clique duplo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_exec_order_stage_user
  ON public.stage_executions (order_id, stage_id, user_id)
  WHERE status = 'Em andamento';

COMMIT;

-- ============================================================================
-- PLANO DE REVERSAO (ROLLBACK) - EXECUTAR APENAS SE NECESSARIO REVERTER A FASE 1
-- ============================================================================
-- DROP INDEX IF EXISTS public.idx_unique_active_exec_order_stage_user;
-- DROP TABLE IF EXISTS public.order_items;
-- ALTER TABLE public.order_stage_progress
--   DROP COLUMN IF EXISTS status,
--   DROP COLUMN IF EXISTS quantidade_recebida,
--   DROP COLUMN IF EXISTS quantidade_retrabalho,
--   DROP COLUMN IF EXISTS quantidade_transferida,
--   DROP COLUMN IF EXISTS route_position,
--   DROP COLUMN IF EXISTS released_at,
--   DROP COLUMN IF EXISTS started_at,
--   DROP COLUMN IF EXISTS completed_at,
--   DROP COLUMN IF EXISTS blocked_reason;
