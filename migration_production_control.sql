-- ============================================================================
-- MIGRATION: Controle Real do Chao de Fabrica - ProComfort PCP
-- ============================================================================
-- Tabelas criadas:
--   1. cut_plans         - Plano de corte formal (PC-2026-00125)
--   2. cut_plan_items    - Itens do plano com rastreabilidade por pedido/item
--   3. production_movements - Log auditavel de todas as movimentacoes
-- ============================================================================

-- 1. CUT_PLANS
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
    snapshot_json   JSONB,
    notes           TEXT,
    created_by      TEXT,
    released_at     TIMESTAMPTZ,
    cut_completed_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cut_plans_status      ON public.cut_plans(status);
CREATE INDEX IF NOT EXISTS idx_cut_plans_plan_number ON public.cut_plans(plan_number);
CREATE INDEX IF NOT EXISTS idx_cut_plans_created_at  ON public.cut_plans(created_at DESC);

-- 2. CUT_PLAN_ITEMS
CREATE TABLE IF NOT EXISTS public.cut_plan_items (
    id                   BIGSERIAL PRIMARY KEY,
    plan_id              BIGINT NOT NULL REFERENCES public.cut_plans(id) ON DELETE CASCADE,
    order_id             BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_cut_plan_items_plan_id      ON public.cut_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_cut_plan_items_order_id     ON public.cut_plan_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cut_plan_items_status       ON public.cut_plan_items(status);
CREATE INDEX IF NOT EXISTS idx_cut_plan_items_item_key     ON public.cut_plan_items(item_key);
CREATE INDEX IF NOT EXISTS idx_cut_plan_items_order_status ON public.cut_plan_items(order_id, status, item_key);

-- 3. PRODUCTION_MOVEMENTS
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

CREATE INDEX IF NOT EXISTS idx_prod_movements_plan_id ON public.production_movements(plan_id);
CREATE INDEX IF NOT EXISTS idx_prod_movements_order_id ON public.production_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_prod_movements_type ON public.production_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_prod_movements_created ON public.production_movements(created_at DESC);

-- 4. RLS POLICIES
ALTER TABLE public.cut_plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cut_plan_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo cut_plans"            ON public.cut_plans;
DROP POLICY IF EXISTS "Permitir tudo cut_plan_items"       ON public.cut_plan_items;
DROP POLICY IF EXISTS "Permitir tudo production_movements" ON public.production_movements;

CREATE POLICY "Permitir tudo cut_plans"
    ON public.cut_plans FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir tudo cut_plan_items"
    ON public.cut_plan_items FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir tudo production_movements"
    ON public.production_movements FOR ALL USING (true) WITH CHECK (true);

-- 5. FUNCAO AUXILIAR: get_committed_quantities
CREATE OR REPLACE FUNCTION public.get_committed_quantities()
RETURNS TABLE(order_id BIGINT, item_key TEXT, qty_committed INT)
LANGUAGE sql STABLE
AS $$
    SELECT
        cpi.order_id,
        cpi.item_key,
        COALESCE(SUM(cpi.quantity_planned), 0)::INT AS qty_committed
    FROM public.cut_plan_items cpi
    WHERE cpi.status IN (
        'CUT_RELEASED', 'CUT_COMPLETED', 'IN_SEWING',
        'SEWING_COMPLETED', 'IN_CUSTOMIZATION', 'COMPLETED'
    )
    GROUP BY cpi.order_id, cpi.item_key;
$$;

-- 6. TRIGGER updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cut_plans_updated_at      ON public.cut_plans;
DROP TRIGGER IF EXISTS trg_cut_plan_items_updated_at ON public.cut_plan_items;

CREATE TRIGGER trg_cut_plans_updated_at
    BEFORE UPDATE ON public.cut_plans
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_cut_plan_items_updated_at
    BEFORE UPDATE ON public.cut_plan_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
