-- ============================================================================
-- MIGRATION: PCP Fase 1 - Fundacao
-- ============================================================================

-- 1. PCP SETTINGS
CREATE TABLE IF NOT EXISTS public.pcp_settings (
    id SERIAL PRIMARY KEY,
    dias_atencao INT DEFAULT 4,
    dias_urgente INT DEFAULT 2,
    dias_critico INT DEFAULT 0,
    peso_atraso INT DEFAULT 1000,
    peso_bloqueio INT DEFAULT -1000,
    peso_qtd_pendente INT DEFAULT 5,
    peso_etapa_nao_iniciada INT DEFAULT 50,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

INSERT INTO public.pcp_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. ALTER ORDERS TABLE
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS pcp_status TEXT DEFAULT 'AGUARDANDO LIBERAÇÃO',
ADD COLUMN IF NOT EXISTS pcp_priority TEXT DEFAULT 'NORMAL',
ADD COLUMN IF NOT EXISTS pcp_priority_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS pcp_is_blocked BOOLEAN DEFAULT false;

-- 3. PCP BLOCKS
CREATE TABLE IF NOT EXISTS public.pcp_blocks (
    id SERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
    motivo TEXT NOT NULL,
    observacao TEXT,
    bloqueado_por TEXT,
    data_bloqueio TIMESTAMPTZ DEFAULT NOW(),
    desbloqueado_por TEXT,
    data_desbloqueio TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- 4. ALTER TINY STOCK CACHE FOR RESERVATIONS
ALTER TABLE public.tiny_stock_cache
ADD COLUMN IF NOT EXISTS stock_reserved INT DEFAULT 0;

-- 5. PCP NECESSIDADES
CREATE TABLE IF NOT EXISTS public.pcp_producao_necessidades (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
    item_id TEXT,
    sku TEXT,
    product_type TEXT,
    fabric TEXT,
    color TEXT,
    size TEXT,
    qty_vendida INT NOT NULL DEFAULT 0,
    qty_estoque_fisico INT DEFAULT 0,
    qty_estoque_reservado INT DEFAULT 0,
    qty_em_producao INT DEFAULT 0,
    qty_necessaria INT GENERATED ALWAYS AS (
        GREATEST(0, qty_vendida - GREATEST(0, qty_estoque_fisico - qty_estoque_reservado) - qty_em_producao)
    ) STORED,
    status TEXT DEFAULT 'AGUARDANDO_PRODUCAO',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PCP AUDIT LOG
CREATE TABLE IF NOT EXISTS public.pcp_audit_log (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
    usuario TEXT,
    acao TEXT NOT NULL,
    entidade TEXT NOT NULL,
    valor_anterior JSONB,
    valor_novo JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pcp_necessidades_order_id ON public.pcp_producao_necessidades(order_id);
CREATE INDEX IF NOT EXISTS idx_pcp_necessidades_sku ON public.pcp_producao_necessidades(sku);
CREATE INDEX IF NOT EXISTS idx_orders_pcp_priority_score ON public.orders(pcp_priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_orders_pcp_is_blocked ON public.orders(pcp_is_blocked);
CREATE INDEX IF NOT EXISTS idx_pcp_blocks_active ON public.pcp_blocks(order_id) WHERE is_active = true;

-- 8. Backfill existing orders into pcp_producao_necessidades
-- Insert missing items for existing non-cancelled and non-delivered orders
INSERT INTO public.pcp_producao_necessidades (order_id, item_id, sku, product_type, size, qty_vendida)
SELECT 
    o.id,
    COALESCE(i->>'codigo', i->>'sku', 'ITEM_' || o.id || '_' || row_number() over (partition by o.id)) as item_id,
    COALESCE(i->>'codigo', i->>'sku') as sku,
    o.product_type,
    COALESCE(i->>'tamanho', i->>'size') as size,
    CAST(COALESCE(i->>'quantidade', i->>'quantity', '0') AS INT) as qty_vendida
FROM public.orders o
CROSS JOIN LATERAL jsonb_array_elements(o.items) as i
WHERE o.status NOT IN ('Cancelado', 'Entregue')
AND NOT EXISTS (
    SELECT 1 FROM public.pcp_producao_necessidades pn WHERE pn.order_id = o.id AND pn.sku = COALESCE(i->>'codigo', i->>'sku')
);

