-- =====================================================================================
-- PROPOSTA DE RECONCILIAÇÃO AUDITÁVEL DOS CASOS DE TESTE (ETAPA J)
-- ATENÇÃO: NÃO EXECUTAR EM PRODUÇÃO SEM AUTORIZAÇÃO EXPLÍCITA DO RESPONSÁVEL.
-- Nenhum registro é apagado (DELETE proibido). Todas as correções preservam o histórico
-- original e registram trilha formal em public.pcp_audit_log.
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- CASO 1: #OLIST-1039 (order_id = 3173, Stark Studio Pilates, 60 peças)
-- Diagnóstico:
--   - Execução #2474 (10:25:14 -> 10:25:25) finalizou a etapa Estampagem (17), porém sem
--     incremento de peças (p_good_inc = 0), mantendo saldo_pendente = 60.
--   - Execução #2476 (10:25:38 -> 10:25:47) apontou 60 peças boas (log #346) e concluiu
--     a etapa 17 (60/60, saldo 0), atualizando o pedido para Pronto.
--   - Confirmado: NÃO houve duplicação de 60 + 60 = 120 peças em order_progress_logs.
--   - Ação: Marcar a execução vazia #2474 como invalidada por duplicidade operacional
--     (invalidated_at + observation auditável) mantendo a execução válida #2476 (60 peças).
-- =====================================================================================

UPDATE public.stage_executions
SET
  invalidated_at = NOW(),
  invalidation_reason = 'Sessão duplicada sem apontamento de peças (substituída pela execução válida #2476 com 60 peças).',
  observation = COALESCE(observation, '') || ' [INVALIDADO: Sessão vazia duplicada antes da execução #2476]'
WHERE id = 2474
  AND order_id = 3173
  AND stage_id = 17
  AND invalidated_at IS NULL;

INSERT INTO public.pcp_audit_log (order_id, stage_id, acao, detalhes, usuario, dados_antes, dados_depois)
VALUES (
  3173,
  17,
  'RECONCILIACAO_AUDITORIA_FASE2',
  'Reconciliação #OLIST-1039: execução vazia #2474 marcada como invalidada; execução #2476 preservada com 60 peças boas e pedido Pronto.',
  'Auditoria Técnica Fase 2',
  jsonb_build_object('execution_id_invalidated', 2474, 'execution_id_kept', 2476, 'quantidade_boa', 60),
  jsonb_build_object('status_pedido', 'Pronto', 'quantidade_boa_oficial', 60, 'saldo_restante', 0)
);

-- =====================================================================================
-- CASO 2: #OLIST-1093 (order_id = 3224, Studio Pilates Ventura, 152 peças, Operador Felipe id=15)
-- Diagnóstico:
--   - Em 2026-04-21 10:33:16, Felipe apontou 148 peças boas (log #347, idempotency_key
--     prog_3224_1_1776767596684_0f92b3h), que foram gravadas em stage_id = 1 (Ficha de aprovação)
--     e pausa na execução #2477.
--   - A etapa operacional real executada por Felipe na Estamparia é Estampagem (stage_id = 17),
--     onde também foi aberta a execução #2468.
--   - Ação:
--     1) Concluir Ficha de aprovação (stage_id = 1) como 152/152 concluída (pré-requisito liberado)
--        e encerrar a execução pausada #2477;
--     2) Reclassificar o apontamento #347 de 148 peças do Felipe para Estampagem (stage_id = 17);
--     3) Atualizar order_stage_progress da Estampagem (stage_id = 17) para:
--        quantidade_pedido = 152, quantidade_boa = 148, saldo_pendente = 4,
--        finished = false, status_operacao = 'EM_ANDAMENTO';
--     4) Sincronizar orders.stages_status do pedido 3224 para refletir 148/152 concluídas
--        e 4 peças restantes na Estampagem.
-- =====================================================================================

-- 2.1. Encerrar a execução pausada #2477 da etapa 1 (Ficha de aprovação)
UPDATE public.stage_executions
SET
  status = 'Finalizado',
  end_time = COALESCE(end_time, NOW()),
  observation = COALESCE(observation, '') || ' [RECONCILIACAO_FASE2: Apontamento de 148 peças reclassificado para Estampagem (stage_id=17)]'
WHERE id = 2477
  AND order_id = 3224
  AND stage_id = 1;

-- 2.2. Reclassificar o log #347 (148 peças boas de Felipe) para stage_id = 17 (Estampagem)
UPDATE public.order_progress_logs
SET
  stage_id = 17,
  observacao = COALESCE(observacao, '') || ' [RECONCILIACAO_FASE2: Vinculado à etapa Estampagem (stage_id=17) do operador Felipe]'
WHERE id = 347
  AND order_id = 3224
  AND user_id = 15
  AND quantidade_boa_incremento = 148;

-- 2.3. Marcar Ficha de aprovação (stage_id = 1) como etapa concluída para liberar Estampagem
UPDATE public.order_stage_progress
SET
  quantidade_pedido = 152,
  quantidade_boa = 152,
  saldo_pendente = 0,
  finished = true,
  status = 'CONCLUIDA',
  status_operacao = 'CONCLUIDA',
  completed_at = COALESCE(completed_at, NOW()),
  updated_at = NOW()
WHERE order_id = 3224
  AND stage_id = 1;

-- 2.4. Atualizar progresso oficial da Estampagem (stage_id = 17) para 148/152 (restantes: 4)
INSERT INTO public.order_stage_progress (
  order_id, stage_id, quantidade_pedido, quantidade_boa, quantidade_perdida,
  saldo_pendente, pendencia_reposicao, finished, status, status_operacao, updated_at
)
VALUES (
  3224, 17, 152, 148, 0,
  4, 0, false, 'EM_ANDAMENTO', 'EM_ANDAMENTO', NOW()
)
ON CONFLICT (order_id, stage_id) DO UPDATE SET
  quantidade_pedido = 152,
  quantidade_boa = 148,
  saldo_pendente = 4,
  finished = false,
  status = 'EM_ANDAMENTO',
  status_operacao = 'EM_ANDAMENTO',
  completed_at = NULL,
  updated_at = NOW();

-- 2.5. Sincronizar stages_status em orders (order_id = 3224)
UPDATE public.orders
SET
  stages_status = (
    SELECT jsonb_agg(
      CASE
        WHEN (elem->>'id')::int = 1 THEN
          elem || jsonb_build_object('finished', true, 'status', 'Concluído', 'status_operacao', 'CONCLUIDA', 'quantidade_boa', 152, 'saldo_pendente', 0)
        WHEN (elem->>'id')::int = 17 THEN
          elem || jsonb_build_object('finished', false, 'status', 'Em andamento', 'status_operacao', 'EM_ANDAMENTO', 'quantidade_boa', 148, 'saldo_pendente', 4)
        ELSE elem
      END
    )
    FROM jsonb_array_elements(COALESCE(stages_status, '[]'::jsonb)) AS elem
  ),
  updated_at = NOW()
WHERE id = 3224;

INSERT INTO public.pcp_audit_log (order_id, stage_id, acao, detalhes, usuario, dados_antes, dados_depois)
VALUES (
  3224,
  17,
  'RECONCILIACAO_AUDITORIA_FASE2',
  'Reconciliação #OLIST-1093: apontamento #347 de 148 peças do operador Felipe consolidado na Estampagem (17) com saldo restante = 4 peças (148/152).',
  'Auditoria Técnica Fase 2',
  jsonb_build_object('log_id', 347, 'stage_id_anterior', 1, 'quantidade_boa', 148, 'exec_pausada_etapa_1', 2477),
  jsonb_build_object('stage_id_atual', 17, 'quantidade_prevista', 152, 'quantidade_concluida', 148, 'saldo_restante', 4)
);

-- =====================================================================================
-- CASO 3: #PED-1122 (order_id = 3304, Ana Paula, 1 peça, Operador Felipe id=15, Estampagem id=17)
-- Diagnóstico:
--   - Execução #2478 está ativa (status = 'Em andamento') para Felipe (user_id = 15) na
--     etapa Estampagem (stage_id = 17), com 0/1 peças concluídas e saldo_pendente = 1.
--   - O problema era exclusivamente no frontend (MinhaFila.tsx exigia que o pedido estivesse
--     nos 100 primeiros de orders para abrir o modal de finalização).
--   - Nenhuma alteração de dados é necessária no banco para #PED-1122; o operador já pode
--     clicar em FINALIZAR e concluir 1/1 peça normalmente.
-- =====================================================================================

COMMIT;

-- =====================================================================================
-- SCRIPT DE ROLLBACK (CASO NECESSÁRIO REVERTER A RECONCILIAÇÃO ACIMA)
-- =====================================================================================
/*
BEGIN;

UPDATE public.stage_executions
SET invalidated_at = NULL, invalidation_reason = NULL
WHERE id = 2474 AND order_id = 3173;

UPDATE public.order_progress_logs
SET stage_id = 1
WHERE id = 347 AND order_id = 3224;

UPDATE public.stage_executions
SET status = 'Pausado', end_time = NULL
WHERE id = 2477 AND order_id = 3224;

UPDATE public.order_stage_progress
SET quantidade_boa = 148, saldo_pendente = 4, finished = false, status_operacao = 'PAUSADA', completed_at = NULL
WHERE order_id = 3224 AND stage_id = 1;

UPDATE public.order_stage_progress
SET quantidade_boa = 0, saldo_pendente = 152, finished = false, status_operacao = 'EM_ANDAMENTO'
WHERE order_id = 3224 AND stage_id = 17;

COMMIT;
*/
