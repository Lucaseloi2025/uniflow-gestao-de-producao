-- ============================================================================
-- MIGRATION: Add Corte Allocations Table for Consolidated Cutting Panel
-- ============================================================================
-- Description:
-- Creates table corte_allocations to track cut piece allocations per order/item
-- for auditability, traceability, and automatic reallocation on order cancellation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS corte_allocations (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL,
    product_type TEXT,
    color TEXT,
    size TEXT,
    quantidade_alocada INT NOT NULL CHECK (quantidade_alocada > 0),
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'reallocated', 'released'
    user_id BIGINT,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_corte_allocations_order_id ON corte_allocations(order_id);
CREATE INDEX IF NOT EXISTS idx_corte_allocations_item_key ON corte_allocations(item_key);
CREATE INDEX IF NOT EXISTS idx_corte_allocations_status ON corte_allocations(status);
