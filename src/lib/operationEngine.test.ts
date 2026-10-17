import assert from 'node:assert/strict';
import {
  canTransitionOperationStatus,
  resolveOperationStatus,
  calculatePartialProductionAndTransfer,
  hasPermission,
  canOverrideSingleSession,
  getSaoPauloDateString,
  StageProgressState,
} from './operationEngine';

function runOperationEngineTests() {
  console.log('Running Phase 1 OperationEngine tests...');

  // 1. State Machine Transitions
  assert.equal(canTransitionOperationStatus('AGUARDANDO', 'LIBERADA').allowed, true);
  assert.equal(canTransitionOperationStatus('LIBERADA', 'EM_ANDAMENTO').allowed, true);
  assert.equal(canTransitionOperationStatus('EM_ANDAMENTO', 'PAUSADA').allowed, true);
  assert.equal(canTransitionOperationStatus('PAUSADA', 'EM_ANDAMENTO').allowed, true);
  assert.equal(canTransitionOperationStatus('EM_ANDAMENTO', 'PARCIAL').allowed, true);
  assert.equal(canTransitionOperationStatus('PARCIAL', 'CONCLUIDA').allowed, true);
  assert.equal(canTransitionOperationStatus('CONCLUIDA', 'EM_ANDAMENTO', false).allowed, false);
  assert.equal(canTransitionOperationStatus('CONCLUIDA', 'EM_ANDAMENTO', true).allowed, true);
  assert.equal(canTransitionOperationStatus('AGUARDANDO', 'CONCLUIDA').allowed, false);

  // 2. Deterministic Status Resolution
  assert.equal(
    resolveOperationStatus({
      quantidadePedido: 100,
      quantidadeBoa: 0,
      isFirstStageInRoute: false,
      previousStageFinished: false,
      previousStageTransferredQty: 0,
    }),
    'AGUARDANDO'
  );

  assert.equal(
    resolveOperationStatus({
      quantidadePedido: 100,
      quantidadeBoa: 0,
      isFirstStageInRoute: false,
      previousStageFinished: false,
      previousStageTransferredQty: 60,
    }),
    'LIBERADA'
  );

  assert.equal(
    resolveOperationStatus({
      quantidadePedido: 100,
      quantidadeBoa: 60,
      isFirstStageInRoute: true,
      previousStageFinished: true,
      activeExecutionStatus: null,
    }),
    'PARCIAL'
  );

  assert.equal(
    resolveOperationStatus({
      quantidadePedido: 100,
      quantidadeBoa: 100,
      isFirstStageInRoute: true,
      previousStageFinished: true,
      activeExecutionStatus: null,
    }),
    'CONCLUIDA'
  );

  assert.equal(
    resolveOperationStatus({
      isBlocked: true,
      quantidadePedido: 100,
      quantidadeBoa: 60,
      isFirstStageInRoute: true,
      previousStageFinished: true,
    }),
    'BLOQUEADA'
  );

  // 3. Partial Production & Stage-to-Stage Formal Transfer (60/100 then 40/100 without duplication)
  const initialStage1: StageProgressState = {
    order_id: 5001,
    stage_id: 5, // Ex: DTF
    quantidade_pedido: 100,
    quantidade_recebida: 100,
    quantidade_boa: 0,
    quantidade_perdida: 0,
    quantidade_retrabalho: 0,
    quantidade_transferida: 0,
    pendencia_reposicao: 0,
    finished: false,
  };

  const initialStage2: StageProgressState = {
    order_id: 5001,
    stage_id: 8, // Ex: Conferência
    quantidade_pedido: 100,
    quantidade_recebida: 0,
    quantidade_boa: 0,
    quantidade_perdida: 0,
    quantidade_retrabalho: 0,
    quantidade_transferida: 0,
    pendencia_reposicao: 0,
    finished: false,
  };

  // Step 3a: Operator produces 60 good pieces out of 100
  const step1 = calculatePartialProductionAndTransfer({
    currentStage: initialStage1,
    nextStage: initialStage2,
    incremento_bom: 60,
    incremento_perdido: 2,
    incremento_retrabalho: 3,
    transferToNextStage: true,
  });

  assert.equal(step1.updatedCurrentStage.quantidade_boa, 60);
  assert.equal(step1.updatedCurrentStage.quantidade_perdida, 2);
  assert.equal(step1.updatedCurrentStage.quantidade_retrabalho, 3);
  assert.equal(step1.updatedCurrentStage.saldo_pendente, 40);
  assert.equal(step1.updatedCurrentStage.finished, false);
  assert.equal(step1.updatedCurrentStage.status_operacao, 'PARCIAL');
  assert.equal(step1.transferredDelta, 60);
  assert.equal(step1.updatedCurrentStage.quantidade_transferida, 60);
  assert.equal(step1.updatedNextStage?.quantidade_recebida, 60);
  assert.equal(step1.updatedNextStage?.status_operacao, 'LIBERADA');

  // Step 3b: Operator completes remaining 40 good pieces
  const step2 = calculatePartialProductionAndTransfer({
    currentStage: step1.updatedCurrentStage,
    nextStage: step1.updatedNextStage,
    incremento_bom: 40,
    transferToNextStage: true,
  });

  assert.equal(step2.updatedCurrentStage.quantidade_boa, 100);
  assert.equal(step2.updatedCurrentStage.saldo_pendente, 0);
  assert.equal(step2.updatedCurrentStage.finished, true);
  assert.equal(step2.updatedCurrentStage.status_operacao, 'CONCLUIDA');
  // Crucial check: only 40 incremental pieces transferred, total in next stage is 100 (NEVER 160!)
  assert.equal(step2.transferredDelta, 40);
  assert.equal(step2.updatedCurrentStage.quantidade_transferida, 100);
  assert.equal(step2.updatedNextStage?.quantidade_recebida, 100);

  // 4. RBAC Permissions for all 6 profiles
  assert.equal(hasPermission('Admin', 'manage_users'), true);
  assert.equal(hasPermission('PCP', 'manage_users'), false);
  assert.equal(hasPermission('PCP', 'override_priority'), true);
  assert.equal(hasPermission('Supervisor', 'override_concurrent_session'), true);
  assert.equal(hasPermission('Operador', 'override_concurrent_session'), false);
  assert.equal(hasPermission('Operador', 'execute_operation'), true);
  assert.equal(hasPermission('Produção', 'execute_operation'), true);
  assert.equal(hasPermission('Comercial', 'edit_commercial_order'), true);
  assert.equal(hasPermission('Comercial', 'execute_operation'), false);
  assert.equal(hasPermission('Visualização', 'view_reports'), true);
  assert.equal(hasPermission('Visualização', 'execute_operation'), false);

  assert.equal(canOverrideSingleSession('Operador', true), false);
  assert.equal(canOverrideSingleSession('Supervisor', true), true);
  assert.equal(canOverrideSingleSession('Supervisor', false), false);

  // 5. Timezone Helper
  const spDate = getSaoPauloDateString(new Date('2026-10-17T15:00:00Z'));
  assert.equal(spDate, '2026-10-17');

  console.log('✅ All Phase 1 OperationEngine tests passed!');
}

runOperationEngineTests();
