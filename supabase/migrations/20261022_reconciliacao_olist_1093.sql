-- ==============================================================================
-- RECONCILIAÇÃO AUDITÁVEL — PEDIDO #OLIST-1093 (Studio Pilates Ventura)
-- ID do Pedido: 3224 | Quantidade Total: 152 peças | Operador: Felipe comfort (15)
-- Objetivo: Transferir apontamento de 148 peças da etapa 1 (Ficha) para etapa 17 (Estampagem)
-- e atualizar saldo restante para 4 peças na Estampagem sem duplicação de dados.
-- ==============================================================================

BEGIN;

-- 1. Transferir os logs de apontamento das 148 peças para a etapa 17 (Estampagem)
UPDATE public.order_progress_logs
SET stage_id = 17,
    observation = COALESCE(observation, '') || ' [Reconciliado: transferido da etapa 1 para etapa 17 - Estampagem]'
WHERE order_id = 3224 AND stage_id = 1 AND quantidade_boa_incremento = 148;

-- 2. Atualizar o progresso da etapa 17 (Estampagem): 148 produzidas, 4 restantes, status PARCIAL
UPDATE public.order_stage_progress
SET quantidade_boa = 148,
    saldo_pendente = 4,
    status_operacao = 'PARCIAL',
    finished = false,
    updated_at = NOW()
WHERE order_id = 3224 AND stage_id = 17;

-- 3. Normalizar a etapa 1 (Ficha de aprovação): concluída documentalmente (1 unidade, saldo 0)
UPDATE public.order_stage_progress
SET quantidade_pedido = 1,
    quantidade_boa = 1,
    saldo_pendente = 0,
    status_operacao = 'CONCLUIDA',
    finished = true,
    updated_at = NOW()
WHERE order_id = 3224 AND stage_id = 1;

-- 4. Sincronizar a coluna orders.stages_status do pedido 3224
UPDATE public.orders
SET stages_status = jsonb_set(
      jsonb_set(
        COALESCE(stages_status, '{}'::jsonb),
        '{17}',
        '{"id": 17, "name": "Estampagem", "status": "Em andamento", "finished": false, "sort_order": 13, "quantidade_boa": 148, "saldo_pendente": 4, "total_pecas": 152, "status_operacao": "PARCIAL"}'::jsonb,
        true
      ),
      '{1}',
      '{"id": 1, "name": "Ficha de aprovação", "status": "Concluído", "finished": true, "sort_order": 1, "quantidade_boa": 1, "saldo_pendente": 0, "total_pecas": 1, "status_operacao": "CONCLUIDA"}'::jsonb,
      true
    ),
    updated_at = NOW()
WHERE id = 3224;

-- 5. Registrar em pcp_audit_log
INSERT INTO public.pcp_audit_log (
  entidade, order_id, stage_id, user_id, usuario, acao,
  quantidade, motivo, valor_anterior, valor_novo, origem, created_at
) VALUES (
  'orders', 3224, 17, 15, 'Felipe comfort', 'RECONCILIACAO_APONTAMENTO_PARCIAL',
  148, 'Reconciliação de 148 peças da Ficha de Aprovação para Estampagem',
  '{"etapa_origem": 1, "qtd_boa_origem": 148, "saldo_17_anterior": 152}'::jsonb,
  '{"etapa_destino": 17, "qtd_boa": 148, "saldo_pendente": 4}'::jsonb,
  'SISTEMA_RECONCILIACAO', NOW()
);

-- 6. Registrar em order_history
INSERT INTO public.order_history (
  order_id, usuario, acao, antes, depois, action, details, created_at
) VALUES (
  3224, 'Sistema', 'RECONCILIACAO_APONTAMENTO',
  '{"etapa_17_qtd": 0, "etapa_17_saldo": 152}',
  '{"etapa_17_qtd": 148, "etapa_17_saldo": 4, "motivo": "Transferido apontamento de 148 peças da Ficha para Estampagem"}',
  'RECONCILIACAO_APONTAMENTO',
  'Transferido apontamento de 148 peças da Ficha para Estampagem. Saldo restante na Estampagem: 4 peças.',
  NOW()
);

COMMIT;
