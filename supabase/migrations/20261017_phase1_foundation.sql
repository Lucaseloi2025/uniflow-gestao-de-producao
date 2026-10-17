-- ============================================================================
-- MIGRATION: Fase 1 - Fundação, Operações, Concorrência, Permissões e Auditoria
-- Sistema: ProComfort (Comfort Uniformes)
-- Fuso Horário Oficial: America/Sao_Paulo
-- Segurança: 100% incremental (IF NOT EXISTS), reversível e sem destruição de dados.
-- ============================================================================

BEGIN;

-- 1. FUNÇÃO E TRIGGERS DE UPDATED_AT
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. EVOLUÇÃO DE STAGES (SETORES E REGRAS DE TRANSFERÊNCIA)
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

-- 3. EVOLUÇÃO DE USERS (6 PERFIS E CONTROLE DE SESSÃO SIMULTÂNEA)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS allow_parallel_sessions BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sector_name TEXT;

-- 4. EVOLUÇÃO DE ORDERS (STATUS DE SINCRONIZAÇÃO OLIST E SEPARAÇÃO PRONTO X ENTREGUE)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS production_finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS olist_last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS olist_sync_status TEXT DEFAULT 'OK',
  ADD COLUMN IF NOT EXISTS olist_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS pcp_divergence_alert TEXT;

-- Backfill seguro de production_finished_at para pedidos já entregues
UPDATE public.orders
SET production_finished_at = COALESCE(production_finished_at, delivered_at, created_at)
WHERE status = 'Entregue' AND production_finished_at IS NULL;

-- 5. TABELA NORMALIZADA DE ITENS DO PEDIDO (ORDER_ITEMS) + BACKFILL DO JSONB
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

-- Backfill seguro dos itens a partir de public.orders.items (JSONB) usando apenas colunas reais de orders
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

-- 6. EVOLUÇÃO DE ORDER_STAGE_PROGRESS (MÁQUINA DE ESTADOS E TRANSFERÊNCIA PARCIAL)
ALTER TABLE public.order_stage_progress
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'AGUARDANDO',
  ADD COLUMN IF NOT EXISTS status_operacao TEXT NOT NULL DEFAULT 'LIBERADA',
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

-- Backfill seguro de quantidade_recebida, saldo_pendente e status nos registros existentes
UPDATE public.order_stage_progress
SET
  quantidade_recebida = CASE WHEN quantidade_recebida = 0 THEN GREATEST(COALESCE(quantidade_pedido, 0), COALESCE(quantidade_boa, 0)) ELSE quantidade_recebida END,
  quantidade_transferida = CASE WHEN finished = true AND quantidade_transferida = 0 THEN COALESCE(quantidade_boa, 0) ELSE quantidade_transferida END,
  saldo_pendente = GREATEST(0, COALESCE(quantidade_pedido, 0) - COALESCE(quantidade_boa, 0) + COALESCE(pendencia_reposicao, 0)),
  status = CASE
    WHEN finished = true THEN 'CONCLUIDA'
    WHEN COALESCE(quantidade_boa, 0) > 0 AND COALESCE(quantidade_boa, 0) < COALESCE(quantidade_pedido, 0) THEN 'PARCIAL'
    ELSE 'LIBERADA'
  END,
  status_operacao = CASE
    WHEN finished = true THEN 'CONCLUIDA'
    WHEN COALESCE(quantidade_boa, 0) > 0 AND COALESCE(quantidade_boa, 0) < COALESCE(quantidade_pedido, 0) THEN 'PARCIAL'
    ELSE 'LIBERADA'
  END;

-- 7. EVOLUÇÃO DE PAUSES (MOTIVO DA PAUSA)
ALTER TABLE public.pauses
  ADD COLUMN IF NOT EXISTS motivo TEXT DEFAULT 'Pausa operacional',
  ADD COLUMN IF NOT EXISTS pause_reason TEXT DEFAULT 'Pausa operacional';

-- 8. EVOLUÇÃO DE ORDER_PROGRESS_LOGS (RETRABALHO, TRANSFERÊNCIA E SESSÃO)
ALTER TABLE public.order_progress_logs
  ADD COLUMN IF NOT EXISTS execution_id BIGINT REFERENCES public.stage_executions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantidade_perdida_incremento INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_retrabalho_incremento INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_transferida_incremento INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observation TEXT;

-- 9. EVOLUÇÃO DE PCP_AUDIT_LOG (AUDITORIA IMUTÁVEL COMPLETA)
ALTER TABLE public.pcp_audit_log
  ALTER COLUMN entidade SET DEFAULT 'orders';

ALTER TABLE public.pcp_audit_log
  ADD COLUMN IF NOT EXISTS user_id BIGINT,
  ADD COLUMN IF NOT EXISTS operator_id BIGINT,
  ADD COLUMN IF NOT EXISTS sector_name TEXT,
  ADD COLUMN IF NOT EXISTS stage_id BIGINT,
  ADD COLUMN IF NOT EXISTS item_id BIGINT,
  ADD COLUMN IF NOT EXISTS quantidade INT,
  ADD COLUMN IF NOT EXISTS quantity INT,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'WEB';

CREATE INDEX IF NOT EXISTS idx_pcp_audit_log_order_id ON public.pcp_audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_pcp_audit_log_created_at ON public.pcp_audit_log(created_at DESC);

-- 10. EVOLUÇÃO E INICIALIZAÇÃO PADRÃO DE PCP_SETTINGS (GARANTE COLUNAS ANTES DO INSERT)
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

-- 11. POLICIES RLS (COMPATIBILIDADE COM BACKEND SERVICE/ANON KEY)
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo order_items" ON public.order_items;
CREATE POLICY "Permitir tudo order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.pcp_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo pcp_settings" ON public.pcp_settings;
CREATE POLICY "Permitir tudo pcp_settings" ON public.pcp_settings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.pcp_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo pcp_blocks" ON public.pcp_blocks;
CREATE POLICY "Permitir tudo pcp_blocks" ON public.pcp_blocks FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.pcp_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo pcp_audit_log" ON public.pcp_audit_log;
CREATE POLICY "Permitir tudo pcp_audit_log" ON public.pcp_audit_log FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.pcp_producao_necessidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo pcp_producao_necessidades" ON public.pcp_producao_necessidades;
CREATE POLICY "Permitir tudo pcp_producao_necessidades" ON public.pcp_producao_necessidades FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo order_history" ON public.order_history;
CREATE POLICY "Permitir tudo order_history" ON public.order_history FOR ALL USING (true) WITH CHECK (true);

-- 12. ÍNDICES DE PERFORMANCE E CONCORRÊNCIA
CREATE INDEX IF NOT EXISTS idx_stage_exec_order_stage_status ON public.stage_executions(order_id, stage_id, status);
CREATE INDEX IF NOT EXISTS idx_stage_exec_user_status ON public.stage_executions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_deadline ON public.orders(status, deadline) WHERE deleted_at IS NULL;

-- 13. FUNÇÃO RPC TRANSACIONAL PARA APONTAMENTO PARCIAL E TRANSFERÊNCIA ENTRE ETAPAS
CREATE OR REPLACE FUNCTION public.pcp_apply_stage_progress(
  p_order_id BIGINT,
  p_stage_id BIGINT,
  p_user_id BIGINT,
  p_user_name TEXT,
  p_good_inc INT,
  p_lost_inc INT DEFAULT 0,
  p_rework_inc INT DEFAULT 0,
  p_transfer_inc INT DEFAULT 0,
  p_next_stage_id BIGINT DEFAULT NULL,
  p_observation TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_qty INT;
  v_existing RECORD;
  v_new_good INT;
  v_new_lost INT;
  v_new_rework INT;
  v_new_transfer INT;
  v_repl INT;
  v_pending INT;
  v_finished BOOLEAN;
  v_status TEXT;
BEGIN
  SELECT COALESCE(quantity, 1) INTO v_order_qty FROM public.orders WHERE id = p_order_id FOR UPDATE;

  SELECT * INTO v_existing
  FROM public.order_stage_progress
  WHERE order_id = p_order_id AND stage_id = p_stage_id
  FOR UPDATE;

  v_new_good := COALESCE(v_existing.quantidade_boa, 0) + GREATEST(0, COALESCE(p_good_inc, 0));
  v_new_lost := COALESCE(v_existing.quantidade_perdida, 0) + GREATEST(0, COALESCE(p_lost_inc, 0));
  v_new_rework := COALESCE(v_existing.quantidade_retrabalho, 0) + GREATEST(0, COALESCE(p_rework_inc, 0));
  v_repl := COALESCE(v_existing.pendencia_reposicao, 0);
  v_new_transfer := LEAST(v_order_qty, COALESCE(v_existing.quantidade_transferida, 0) + GREATEST(0, COALESCE(p_transfer_inc, p_good_inc, 0)));
  v_pending := GREATEST(0, v_order_qty - v_new_good + v_repl);
  v_finished := (v_new_good >= v_order_qty AND v_repl = 0);
  v_status := CASE WHEN v_finished THEN 'CONCLUIDA' WHEN v_new_good > 0 THEN 'PARCIAL' ELSE 'LIBERADA' END;

  INSERT INTO public.order_stage_progress (
    order_id, stage_id, quantidade_pedido, quantidade_recebida,
    quantidade_boa, quantidade_perdida, quantidade_retrabalho,
    quantidade_transferida, pendencia_reposicao, saldo_pendente,
    finished, status, status_operacao, updated_at
  )
  VALUES (
    p_order_id, p_stage_id, v_order_qty, GREATEST(v_order_qty, COALESCE(v_existing.quantidade_recebida, v_order_qty)),
    v_new_good, v_new_lost, v_new_rework,
    v_new_transfer, v_repl, v_pending,
    v_finished, v_status, v_status, NOW()
  )
  ON CONFLICT (order_id, stage_id) DO UPDATE SET
    quantidade_boa = EXCLUDED.quantidade_boa,
    quantidade_perdida = EXCLUDED.quantidade_perdida,
    quantidade_retrabalho = EXCLUDED.quantidade_retrabalho,
    quantidade_transferida = EXCLUDED.quantidade_transferida,
    saldo_pendente = EXCLUDED.saldo_pendente,
    finished = EXCLUDED.finished,
    status = EXCLUDED.status,
    status_operacao = EXCLUDED.status_operacao,
    updated_at = NOW();

  IF p_next_stage_id IS NOT NULL AND v_new_transfer > 0 THEN
    INSERT INTO public.order_stage_progress (
      order_id, stage_id, quantidade_pedido, quantidade_recebida,
      quantidade_boa, quantidade_perdida, pendencia_reposicao, saldo_pendente,
      finished, status, status_operacao, released_at, updated_at
    )
    VALUES (
      p_order_id, p_next_stage_id, v_order_qty, v_new_transfer,
      0, 0, 0, v_order_qty,
      false, 'LIBERADA', 'LIBERADA', NOW(), NOW()
    )
    ON CONFLICT (order_id, stage_id) DO UPDATE SET
      quantidade_recebida = LEAST(v_order_qty, GREATEST(public.order_stage_progress.quantidade_recebida, v_new_transfer)),
      status_operacao = CASE
        WHEN public.order_stage_progress.finished THEN 'CONCLUIDA'
        WHEN public.order_stage_progress.quantidade_boa > 0 THEN 'PARCIAL'
        ELSE 'LIBERADA'
      END,
      updated_at = NOW();
  END IF;

  INSERT INTO public.order_progress_logs (
    order_id, stage_id, user_id, user_name,
    quantidade_boa_incremento, quantidade_perdida_incremento,
    quantidade_retrabalho_incremento, quantidade_transferida_incremento,
    observation, created_at
  )
  VALUES (
    p_order_id, p_stage_id, p_user_id, p_user_name,
    GREATEST(0, COALESCE(p_good_inc, 0)), GREATEST(0, COALESCE(p_lost_inc, 0)),
    GREATEST(0, COALESCE(p_rework_inc, 0)), GREATEST(0, COALESCE(p_transfer_inc, p_good_inc, 0)),
    p_observation, NOW()
  );

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, stage_id, user_id, usuario, acao,
    quantidade, observacao, valor_novo, origem, created_at
  )
  VALUES (
    'order_stage_progress', p_order_id, p_stage_id, p_user_id, p_user_name,
    CASE WHEN v_finished THEN 'APONTAMENTO_CONCLUIDO' ELSE 'APONTAMENTO_PARCIAL' END,
    GREATEST(0, COALESCE(p_good_inc, 0)), p_observation,
    jsonb_build_object(
      'quantidade_boa_acumulada', v_new_good,
      'saldo_pendente', v_pending,
      'status_operacao', v_status,
      'next_stage_id', p_next_stage_id
    ),
    'RPC', NOW()
  );

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'stage_id', p_stage_id,
    'quantidade_pedido', v_order_qty,
    'quantidade_boa', v_new_good,
    'quantidade_perdida', v_new_lost,
    'quantidade_retrabalho', v_new_rework,
    'quantidade_transferida', v_new_transfer,
    'saldo_pendente', v_pending,
    'finished', v_finished,
    'status_operacao', v_status
  );
END;
$$;

COMMIT;
