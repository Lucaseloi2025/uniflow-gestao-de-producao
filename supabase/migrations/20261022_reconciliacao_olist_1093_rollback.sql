-- ==============================================================================
-- ROLLBACK — RECONCILIAÇÃO DO PEDIDO #OLIST-1093 (Studio Pilates Ventura)
-- ==============================================================================

BEGIN;

UPDATE public.order_progress_logs
SET stage_id = 1
WHERE order_id = 3224 AND stage_id = 17 AND quantidade_boa_incremento = 148;

UPDATE public.order_stage_progress
SET quantidade_boa = 0, saldo_pendente = 152, status_operacao = 'LIBERADA', finished = false
WHERE order_id = 3224 AND stage_id = 17;

UPDATE public.order_stage_progress
SET quantidade_pedido = 152, quantidade_boa = 148, saldo_pendente = 4, status_operacao = 'PARCIAL', finished = true
WHERE order_id = 3224 AND stage_id = 1;

COMMIT;
