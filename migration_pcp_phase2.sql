-- ============================================================================
-- MIGRATION: PCP Fase 2 - Chao de Fabrica
-- ============================================================================

-- 1. PLANOS DE CORTE (NUVEM)
CREATE TABLE IF NOT EXISTS public.pcp_cut_plans (
    id BIGSERIAL PRIMARY KEY,
    plano_numero TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'AGUARDANDO_CORTE', -- AGUARDANDO_CORTE, EM_CORTE, ENVIADO_COSTURA, CONCLUIDO
    fabric TEXT NOT NULL,
    color TEXT NOT NULL,
    tipo_tecido TEXT,
    largura_util DECIMAL,
    qty_planejada INT NOT NULL DEFAULT 0,
    qty_aprovada INT DEFAULT 0,
    enfesto_data JSONB, -- dados de metragens e camadas
    pedidos_ids JSONB, -- array de IDs de orders que geraram a demanda
    is_manual BOOLEAN DEFAULT false,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LOTES DE COSTURA (FACCÃO)
CREATE TABLE IF NOT EXISTS public.pcp_sewing_batches (
    id BIGSERIAL PRIMARY KEY,
    cut_plan_id BIGINT REFERENCES public.pcp_cut_plans(id) ON DELETE CASCADE,
    lote_numero TEXT UNIQUE NOT NULL,
    costureira_nome TEXT NOT NULL,
    status TEXT DEFAULT 'EM_COSTURA', -- EM_COSTURA, AGUARDANDO_CONFERENCIA, CONCLUIDO
    qty_enviada INT NOT NULL,
    qty_retornada_boa INT DEFAULT 0,
    qty_retornada_defeito INT DEFAULT 0,
    data_envio TIMESTAMPTZ DEFAULT NOW(),
    data_previsao_retorno TIMESTAMPTZ,
    data_retorno_real TIMESTAMPTZ,
    created_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ALOCAÇÃO DE PEÇAS (DISTRIBUIÇÃO)
CREATE TABLE IF NOT EXISTS public.pcp_stock_allocations (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
    sewing_batch_id BIGINT REFERENCES public.pcp_sewing_batches(id) ON DELETE SET NULL,
    sku TEXT NOT NULL,
    size TEXT NOT NULL,
    qty_allocated INT NOT NULL,
    allocated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_pcp_cut_plans_status ON public.pcp_cut_plans(status);
CREATE INDEX IF NOT EXISTS idx_pcp_sewing_batches_cut_plan_id ON public.pcp_sewing_batches(cut_plan_id);
CREATE INDEX IF NOT EXISTS idx_pcp_stock_allocations_order_id ON public.pcp_stock_allocations(order_id);

