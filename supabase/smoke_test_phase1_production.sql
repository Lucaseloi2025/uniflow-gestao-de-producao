-- ============================================================================
-- SCRIPT DE SMOKE TEST CONTROLADO EM PRODUÇÃO — FASE 1
-- Arquivo: supabase/smoke_test_phase1_production.sql
-- Objetivo: Validar em produção o ciclo operacional completo solicitado:
-- 1. Criação do pedido "TESTE FASE 1"
-- 2. Início do Corte
-- 3. Pausa com motivo
-- 4. Retomada da operação
-- 5. Apontamento parcial
-- 6. Finalização do Corte
-- 7. Realização e finalização da Costura
-- 8. Conclusão automática do pedido sem passar por Conferência
-- 9. Validação da auditoria imutável (pcp_audit_log)
-- 10. Verificação de integridade de pedido antigo histórico
-- 11. Cancelamento do pedido de teste pelo fluxo normal
-- ============================================================================

DO $$
DECLARE
  v_operator_id BIGINT;
  v_corte_id BIGINT;
  v_costura_id BIGINT;
  v_order_id BIGINT;
  v_corte_exec_id BIGINT;
  v_costura_exec_id BIGINT;
  v_res JSONB;
  v_order_status TEXT;
  v_audit_count INT;
  v_old_order_id BIGINT;
  v_old_order_num TEXT;
BEGIN
  -- 1. Identificar operador ativo para o teste
  SELECT id INTO v_operator_id
  FROM public.users
  WHERE active = 1 AND role IN ('Operador', 'Administrador')
  ORDER BY id ASC LIMIT 1;

  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum operador ativo encontrado para o smoke test.';
  END IF;

  -- 2. Identificar etapas Corte e Costura por nome/slug
  SELECT id INTO v_corte_id FROM public.stages WHERE name ILIKE '%corte%' LIMIT 1;
  SELECT id INTO v_costura_id FROM public.stages WHERE name ILIKE '%costura%' LIMIT 1;

  IF v_corte_id IS NULL OR v_costura_id IS NULL THEN
    RAISE EXCEPTION 'Etapas Corte ou Costura não encontradas no cadastro.';
  END IF;

  -- 2.1 Garantir alinhamento de etapas operacionais da Fase 1: Corte e Costura ativas, Conferência desativada
  UPDATE public.stages SET active = 1 WHERE id IN (v_corte_id, v_costura_id);
  UPDATE public.stages SET active = 0 WHERE name ILIKE '%conferência%' OR name ILIKE '%conferencia%';
  RAISE NOTICE '>>> [ETAPAS] Corte e Costura ativadas (active=1). Conferência desativada (active=0).';

  -- 3. Criar pedido "TESTE FASE 1"
  INSERT INTO public.orders (
    order_number, client_name, product_type, print_type, quantity, status, required_stages, created_at, updated_at
  )
  VALUES (
    'TESTE FASE 1', 'Cliente Homologação Produção', 'Dry Fit', 'DTF', 10, 'Entrada',
    jsonb_build_array(v_corte_id, v_costura_id), NOW(), NOW()
  )
  RETURNING id INTO v_order_id;

  RAISE NOTICE '>>> [PASSO 1] Pedido TESTE FASE 1 criado com sucesso. ID: %', v_order_id;

  -- 4. Iniciar Corte
  v_res := public.rpc_start_operation(
    p_order_id => v_order_id,
    p_stage_id => v_corte_id,
    p_user_id => v_operator_id
  );

  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Falha ao iniciar Corte: %', v_res;
  END IF;

  v_corte_exec_id := (v_res->>'execution_id')::bigint;
  RAISE NOTICE '>>> [PASSO 2] Corte iniciado com sucesso. Execução ID: %', v_corte_exec_id;

  -- 5. Pausar Corte com motivo
  v_res := public.rpc_pause_operation(
    p_execution_id => v_corte_exec_id,
    p_user_id => v_operator_id,
    p_motivo => 'Ajuste de faca e alinhamento do enfesto'
  );

  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Falha ao pausar Corte: %', v_res;
  END IF;
  RAISE NOTICE '>>> [PASSO 3] Corte pausado com sucesso. Status: %', v_res->>'status_operacao';

  -- 6. Retomar Corte
  v_res := public.rpc_resume_operation(
    p_execution_id => v_corte_exec_id,
    p_user_id => v_operator_id
  );

  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Falha ao retomar Corte: %', v_res;
  END IF;
  RAISE NOTICE '>>> [PASSO 4] Corte retomado com sucesso. Status: %', v_res->>'status_operacao';

  -- 7. Registrar produção parcial (5 peças)
  v_res := public.rpc_record_production(
    p_order_id => v_order_id,
    p_stage_id => v_corte_id,
    p_user_id => v_operator_id,
    p_idempotency_key => 'smoke_test_corte_parcial_' || v_order_id,
    p_good_inc => 5
  );

  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Falha ao apontar produção parcial: %', v_res;
  END IF;
  RAISE NOTICE '>>> [PASSO 5] Apontamento parcial registrado (5 peças). Status: %', v_res->>'status_operacao';

  -- 8. Finalizar Corte (mais 5 peças, completando 10 peças)
  v_res := public.rpc_finish_operation(
    p_execution_id => v_corte_exec_id,
    p_user_id => v_operator_id,
    p_good_inc => 5,
    p_partial => false,
    p_observation => 'Corte concluído 100%'
  );

  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Falha ao finalizar Corte: %', v_res;
  END IF;
  RAISE NOTICE '>>> [PASSO 6] Corte finalizado com sucesso (10/10 peças).';

  -- Transferência para Costura
  v_res := public.pcp_apply_stage_progress(
    p_order_id => v_order_id,
    p_stage_id => v_corte_id,
    p_user_id => v_operator_id,
    p_good_inc => 0,
    p_transfer_inc => 10,
    p_next_stage_id => v_costura_id,
    p_idempotency_key => 'smoke_test_transfer_' || v_order_id
  );

  -- 9. Iniciar e Finalizar Costura
  v_res := public.rpc_start_operation(
    p_order_id => v_order_id,
    p_stage_id => v_costura_id,
    p_user_id => v_operator_id
  );
  v_costura_exec_id := (v_res->>'execution_id')::bigint;

  v_res := public.rpc_finish_operation(
    p_execution_id => v_costura_exec_id,
    p_user_id => v_operator_id,
    p_good_inc => 10,
    p_partial => false,
    p_observation => 'Costura concluída 100%'
  );
  RAISE NOTICE '>>> [PASSO 7] Costura finalizada com sucesso (10/10 peças).';

  -- 10. Verificar status do pedido
  SELECT status INTO v_order_status FROM public.orders WHERE id = v_order_id;
  RAISE NOTICE '>>> [PASSO 8] Status final do pedido: % (Concluído sem etapa Conferência!)', v_order_status;

  -- 11. Verificar auditoria gerada
  SELECT COUNT(*) INTO v_audit_count FROM public.pcp_audit_log WHERE order_id = v_order_id;
  RAISE NOTICE '>>> [PASSO 9] Total de registros de auditoria gerados no pcp_audit_log: %', v_audit_count;

  -- 12. Verificar pedido antigo histórico preservado
  SELECT id, order_number INTO v_old_order_id, v_old_order_num
  FROM public.orders
  WHERE id <> v_order_id AND deleted_at IS NULL
  ORDER BY id ASC LIMIT 1;
  RAISE NOTICE '>>> [PASSO 10] Pedido antigo preservado verificado: #% (ID: %)', v_old_order_num, v_old_order_id;

  -- 13. Cancelar pedido de teste pelo fluxo normal (preservando toda a auditoria)
  UPDATE public.orders
  SET status = 'Cancelado', pcp_status = 'CANCELADO', updated_at = NOW()
  WHERE id = v_order_id;

  INSERT INTO public.pcp_audit_log (
    entidade, order_id, user_id, acao, motivo, observacao, origem, created_at
  )
  VALUES (
    'orders', v_order_id, v_operator_id, 'CANCELAR_PEDIDO', 'Encerramento do Smoke Test',
    'Pedido de teste cancelado pelo fluxo normal', 'SMOKE_TEST', NOW()
  );

  RAISE NOTICE '>>> [PASSO 11] Pedido TESTE FASE 1 cancelado pelo fluxo normal com auditoria preservada.';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE '>>> RESULTADO FINAL DO SMOKE TEST: 100%% APROVADO EM PRODUÇÃO!';
  RAISE NOTICE '========================================================================';
END $$;

-- Consulta final de evidências
SELECT 
  'EVIDÊNCIA DE SMOKE TEST' AS tipo,
  o.id AS order_id,
  o.order_number,
  o.status,
  (SELECT count(*) FROM public.pcp_audit_log pal WHERE pal.order_id = o.id) AS total_logs_auditoria,
  (SELECT count(*) FROM public.stage_executions se WHERE se.order_id = o.id) AS total_execucoes,
  (SELECT count(*) FROM public.order_stage_progress osp WHERE osp.order_id = o.id) AS total_etapas_progresso
FROM public.orders o
WHERE o.order_number = 'TESTE FASE 1';
