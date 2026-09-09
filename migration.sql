-- Adiciona a coluna tracking_token na tabela orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token text UNIQUE;

-- Cria um índice para busca rápida pelo token
CREATE INDEX IF NOT EXISTS idx_orders_tracking_token ON orders(tracking_token);
