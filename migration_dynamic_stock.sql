-- ============================================================================
-- MIGRATION: Cache de Estoque Dinâmico (Tiny ERP)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tiny_stock_cache (
    id_produto TEXT PRIMARY KEY,
    sku TEXT,
    stock_available INT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS policies
ALTER TABLE public.tiny_stock_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" 
ON public.tiny_stock_cache FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable insert access for authenticated users" 
ON public.tiny_stock_cache FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" 
ON public.tiny_stock_cache FOR UPDATE 
TO authenticated 
USING (true);
