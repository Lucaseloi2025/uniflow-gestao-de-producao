-- ============================================================================
-- MIGRATION: Add Olist ERP Integration & Size Grid Columns to Orders Table
-- ============================================================================
-- Description:
-- Adds columns to track Olist ERP order references (idempotency) and store the
-- granular size breakdown (items array) for imported custom uniform orders.
-- ============================================================================

-- 1. Add Olist order reference columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS olist_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS olist_order_number TEXT;

-- 2. Add JSONB column for items (grade de tamanhos)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 3. Create index on olist_order_id for fast idempotency lookups
CREATE INDEX IF NOT EXISTS idx_orders_olist_order_id ON orders(olist_order_id) WHERE olist_order_id IS NOT NULL;
