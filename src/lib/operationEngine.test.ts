import assert from 'node:assert/strict';
import 'dotenv/config';
import app, { supabaseAdmin as sb } from '../../api/index';
import {
  canTransitionOperationStatus,
  resolveOperationStatus,
  calculatePartialProductionAndTransfer,
  hasPermission,
  canOverrideSingleSession,
  getSaoPauloDateString,
  StageProgressState,
  UserRole,
  PermissionAction,
} from './operationEngine';

function runOperationEngineUnitTests() {
  console.log('=== [1/2] Running Phase 1 OperationEngine Unit Tests ===');

  // 1. State Machine Transitions (8 official states)
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
    stage_id: 5,
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
    stage_id: 8,
    quantidade_pedido: 100,
    quantidade_recebida: 0,
    quantidade_boa: 0,
    quantidade_perdida: 0,
    quantidade_retrabalho: 0,
    quantidade_transferida: 0,
    pendencia_reposicao: 0,
    finished: false,
  };

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
  assert.equal(step2.transferredDelta, 40);
  assert.equal(step2.updatedCurrentStage.quantidade_transferida, 100);
  assert.equal(step2.updatedNextStage?.quantidade_recebida, 100);

  // 4. Complete 6-Profile RBAC Matrix Validation
  const roles: UserRole[] = ['Administrador', 'PCP', 'Supervisor', 'Operador', 'Comercial', 'Visualização'];
  const actions: PermissionAction[] = [
    'manage_users',
    'manage_pcp',
    'override_priority',
    'block_unblock_order',
    'reopen_stage',
    'override_concurrent_session',
    'execute_operation',
    'edit_commercial_order',
    'view_reports',
  ];

  const expectedMatrix: Record<UserRole, PermissionAction[]> = {
    Administrador: actions,
    Admin: actions,
    PCP: [
      'manage_pcp',
      'override_priority',
      'block_unblock_order',
      'reopen_stage',
      'execute_operation',
      'view_reports',
    ],
    Supervisor: [
      'manage_pcp',
      'override_priority',
      'block_unblock_order',
      'reopen_stage',
      'override_concurrent_session',
      'execute_operation',
      'view_reports',
    ],
    Operador: ['execute_operation'],
    Produção: ['execute_operation'],
    Comercial: ['edit_commercial_order', 'view_reports'],
    Visualização: ['view_reports'],
  };

  for (const role of roles) {
    for (const action of actions) {
      const expected = expectedMatrix[role].includes(action);
      const actual = hasPermission(role, action);
      assert.equal(actual, expected, `RBAC mismatch for role=${role}, action=${action}`);
    }
  }

  assert.equal(canOverrideSingleSession('Operador', true), false);
  assert.equal(canOverrideSingleSession('Supervisor', true), true);
  assert.equal(canOverrideSingleSession('Supervisor', false), false);

  // 5. Timezone Helper (America/Sao_Paulo)
  const spDate = getSaoPauloDateString(new Date('2026-10-17T15:00:00Z'));
  assert.equal(spDate, '2026-10-17');

  console.log('✅ Unit tests passed: State Machine, Partial Transfer (60+40=100), 6-Profile RBAC Matrix, Timezone.');
}

async function runLiveApiAndDatabaseTests() {
  console.log('\n=== [2/2] Running Live API & Supabase Integration Tests ===');

  // Start Express server on an ephemeral port
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  let testOrderId: number | null = null;
  const createdExecIds: number[] = [];

  try {
    // A. Verify existing historical data preservation & backfill
    const [ordersCountRes, progCountRes, execCountRes, pausesCountRes, usersRes] = await Promise.all([
      sb.from('orders').select('*', { count: 'exact', head: true }),
      sb.from('order_stage_progress').select('*', { count: 'exact', head: true }),
      sb.from('stage_executions').select('*', { count: 'exact', head: true }),
      sb.from('pauses').select('*', { count: 'exact', head: true }),
      sb.from('users').select('id, name, role').eq('active', 1).limit(5),
    ]);

    assert.ok((ordersCountRes.count || 0) >= 800, `Expected >= 800 historical orders preserved, got ${ordersCountRes.count}`);
    assert.ok((progCountRes.count || 0) >= 350, `Expected >= 350 stage progress rows preserved, got ${progCountRes.count}`);
    assert.ok((execCountRes.count || 0) >= 1300, `Expected >= 1300 stage executions preserved, got ${execCountRes.count}`);
    assert.ok((pausesCountRes.count || 0) >= 900, `Expected >= 900 pauses preserved, got ${pausesCountRes.count}`);
    console.log(
      `✅ Historical Data Verified: orders=${ordersCountRes.count}, order_stage_progress=${progCountRes.count}, stage_executions=${execCountRes.count}, pauses=${pausesCountRes.count}`
    );

    const testOperatorId = usersRes.data?.[0]?.id || 1;
    // Make sure testOperatorId has no lingering active executions before starting test
    const { data: preExistingActive } = await sb
      .from('stage_executions')
      .select('id, user_id')
      .eq('status', 'Em andamento');
    const busyUserIds = new Set((preExistingActive || []).map((e: any) => Number(e.user_id)));
    const freeOperator = (usersRes.data || []).find((u: any) => !busyUserIds.has(Number(u.id)));
    const operatorId = freeOperator ? Number(freeOperator.id) : Number(testOperatorId);

    const { data: sampleOrder } = await sb.from('orders').select('product_type, print_type').limit(1).single();
    const validProductType = sampleOrder?.product_type || 'Vestuário';
    const validPrintType = sampleOrder?.print_type || 'DTF';

    // B. Create isolated temporary order for E2E operational flow test
    const { data: insertedOrder, error: createOrderErr } = await sb
      .from('orders')
      .insert({
        order_number: `TEST-HOMOLOG-${Date.now()}`,
        client_name: 'CLIENTE HOMOLOGACAO FASE 1 (TEMP)',
        product_type: validProductType,
        print_type: validPrintType,
        quantity: 100,
        deadline: '2026-10-25',
        status: 'Em Produção',
        pcp_status: 'EM_PRODUCAO',
        required_stages: [5, 8], // 5 = DTF, 8 = Conferência Final
        items: [
          {
            sku: 'CAM-DTF-M',
            description: 'Camiseta Algodão Preta M',
            product_type: 'Camiseta',
            fabric: 'Algodão',
            color: 'Preta',
            size: 'M',
            quantity: 100,
          },
        ],
      })
      .select('id, order_number')
      .single();

    assert.equal(createOrderErr, null, `Failed to create temporary test order: ${createOrderErr?.message}`);
    testOrderId = Number(insertedOrder!.id);
    console.log(`✅ Created isolated test order #${testOrderId} (${insertedOrder!.order_number}) with 100 pieces, route=[5, 8]`);

    // C. Test Anti-Double-Click & Start Execution (POST /api/executions/start)
    const [startRes1, startRes2] = await Promise.all([
      fetch(`${baseUrl}/api/executions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'Operador',
          'x-user-name': 'Operador Homologacao',
        },
        body: JSON.stringify({ order_id: testOrderId, stage_id: 5, user_id: operatorId }),
      }),
      fetch(`${baseUrl}/api/executions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'Operador',
          'x-user-name': 'Operador Homologacao',
        },
        body: JSON.stringify({ order_id: testOrderId, stage_id: 5, user_id: operatorId }),
      }),
    ]);

    const body1 = await startRes1.json();
    const body2 = await startRes2.json();
    const statuses = [startRes1.status, startRes2.status].sort();
    // One succeeds with 200 and the concurrent duplicate either hits the in-flight lock (429) or idempotent check (200 with same id)
    assert.ok(
      (statuses[0] === 200 && statuses[1] === 429) || (statuses[0] === 200 && statuses[1] === 200 && body1.id === body2.id),
      `Expected anti-double-click protection (200+429 or idempotent same ID), got statuses=${statuses.join(',')} body1=${JSON.stringify(body1)} body2=${JSON.stringify(body2)}`
    );

    const execId1 = Number(body1.id || body2.id);
    assert.ok(execId1 > 0, 'Valid execution ID must be returned');
    createdExecIds.push(execId1);

    // Verify in DB that ONLY 1 execution row was created for (testOrderId, stage 5)
    const { data: activeRowsInDb } = await sb
      .from('stage_executions')
      .select('id')
      .eq('order_id', testOrderId)
      .eq('stage_id', 5)
      .eq('status', 'Em andamento');
    assert.equal(activeRowsInDb?.length, 1, 'Anti-double-click must guarantee exactly 1 active execution in DB');
    console.log(`✅ Start & Anti-Double-Click Verified: execution_id=${execId1}, active rows in DB=${activeRowsInDb?.length}`);

    // D. Test Concurrency Rule: Operator cannot have 2 active sessions simultaneously without supervisor override
    const concurrentBlockedRes = await fetch(`${baseUrl}/api/executions/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Operador',
        'x-user-name': 'Operador Homologacao',
      },
      body: JSON.stringify({ order_id: testOrderId, stage_id: 8, user_id: operatorId }),
    });
    const concurrentBlockedBody = await concurrentBlockedRes.json();
    assert.equal(concurrentBlockedRes.status, 409, 'Second simultaneous active session for same operator must return 409 Conflict');
    assert.equal(concurrentBlockedBody.code, 'OPERATOR_ALREADY_ACTIVE');

    // Test Supervisor Override allows second session when authorized
    const supervisorOverrideRes = await fetch(`${baseUrl}/api/executions/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Supervisor',
        'x-user-name': 'Supervisor Homologacao',
      },
      body: JSON.stringify({ order_id: testOrderId, stage_id: 8, user_id: operatorId, supervisor_override: true }),
    });
    const supervisorOverrideBody = await supervisorOverrideRes.json();
    assert.equal(supervisorOverrideRes.status, 200, 'Supervisor override must allow concurrent session');
    if (supervisorOverrideBody.id) {
      createdExecIds.push(Number(supervisorOverrideBody.id));
      await sb.from('stage_executions').delete().eq('id', Number(supervisorOverrideBody.id));
    }
    console.log('✅ Operator Single-Active-Session Concurrency & Supervisor Override Verified (409 blocked vs 200 override).');

    // E. Test Pause (POST /api/executions/:id/pause) and Resume (POST /api/executions/:id/resume)
    const pauseRes = await fetch(`${baseUrl}/api/executions/${execId1}/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Operador',
        'x-user-name': 'Operador Homologacao',
      },
      body: JSON.stringify({ motivo: 'Ajuste de tensão da máquina' }),
    });
    const pauseBody = await pauseRes.json();
    assert.equal(pauseRes.status, 200);
    assert.equal(pauseBody.status_operacao, 'PAUSADA');

    const { data: openPauses } = await sb
      .from('pauses')
      .select('id, start_pause, end_pause')
      .eq('execution_id', execId1)
      .is('end_pause', null);
    assert.equal(openPauses?.length, 1, 'Pause must create an open row in public.pauses');

    const resumeRes = await fetch(`${baseUrl}/api/executions/${execId1}/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Operador',
        'x-user-name': 'Operador Homologacao',
      },
      body: JSON.stringify({}),
    });
    const resumeBody = await resumeRes.json();
    assert.equal(resumeRes.status, 200);
    assert.equal(resumeBody.status_operacao, 'EM_ANDAMENTO');

    const { data: closedPause } = await sb
      .from('pauses')
      .select('id, end_pause, duration_seconds')
      .eq('id', openPauses![0].id)
      .single();
    assert.ok(closedPause?.end_pause !== null, 'Resume must close the active pause in public.pauses');
    console.log('✅ Pause & Resume Verified: pause recorded and closed with duration_seconds in public.pauses.');

    // F. Test Partial Production (60/100) + Formal Stage Transfer + Stateless Reload Persistence
    const partialRes = await fetch(`${baseUrl}/api/orders/${testOrderId}/stages/5/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Operador',
        'x-user-name': 'Operador Homologacao',
      },
      body: JSON.stringify({
        incremento: 60,
        quantidade_perdida: 0,
        quantidade_retrabalho: 2,
        observacao: 'Primeiro lote parcial de 60 peças boas enviado para conferência',
        transfer_to_next: true,
        user_id: operatorId,
        user_name: 'Operador Homologacao',
      }),
    });
    const partialBody = await partialRes.json();
    assert.equal(partialRes.status, 200);
    assert.equal(partialBody.progress.quantidade_boa, 60);
    assert.equal(partialBody.progress.saldo_pendente, 40);
    assert.equal(partialBody.progress.finished, false);
    assert.equal(partialBody.progress.status_operacao, 'PARCIAL');
    assert.equal(partialBody.transferred_delta, 60);
    assert.equal(partialBody.next_stage_progress?.stage_id, 8);
    assert.equal(partialBody.next_stage_progress?.quantidade_recebida, 60);
    assert.equal(partialBody.next_stage_progress?.status_operacao, 'LIBERADA');

    // G. Finish first work session while stage is still partial (60/100)
    const finishPartialRes = await fetch(`${baseUrl}/api/executions/${execId1}/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Operador',
        'x-user-name': 'Operador Homologacao',
      },
      body: JSON.stringify({
        partial: true,
        observation: 'Sessão encerrada com 60/100 peças concluídas',
      }),
    });
    const finishPartialBody = await finishPartialRes.json();
    assert.equal(finishPartialRes.status, 200);
    assert.equal(finishPartialBody.status_operacao, 'PARCIAL');
    assert.equal(finishPartialBody.saldo_pendente, 40);
    assert.equal(finishPartialBody.order_status, 'Em Produção', 'Order must NEVER be closed when stage is partial');

    // H. Verify Stateless Persistence (simulating browser refresh / new serverless instance)
    const reloadProgressRes = await fetch(`${baseUrl}/api/orders/${testOrderId}/stage-progress`);
    assert.equal(reloadProgressRes.status, 200);
    const reloadProgressList: any[] = await reloadProgressRes.json();
    const stage5Reloaded = reloadProgressList.find((p) => Number(p.stage_id) === 5);
    const stage8Reloaded = reloadProgressList.find((p) => Number(p.stage_id) === 8);

    assert.equal(stage5Reloaded?.quantidade_boa, 60, 'Reloaded stage 5 must persist 60 good pieces from Supabase');
    assert.equal(stage5Reloaded?.saldo_pendente, 40, 'Reloaded stage 5 must have 40 pending pieces');
    assert.equal(stage5Reloaded?.finished, false, 'Reloaded stage 5 must remain unfinished (PARCIAL)');
    assert.equal(stage5Reloaded?.status_operacao, 'PARCIAL');
    assert.ok(stage8Reloaded, 'Next stage (8) must exist in reloaded progress');
    console.log('✅ Partial Production (60/100) & Stateless Page Reload Persistence Verified from Supabase.');

    // I. Complete remaining 40 pieces on Stage 5 (60 + 40 = 100) -> Stage 5 CONCLUIDA, Order still Em Produção
    const startSession2Res = await fetch(`${baseUrl}/api/executions/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Operador',
        'x-user-name': 'Operador Homologacao',
      },
      body: JSON.stringify({ order_id: testOrderId, stage_id: 5, user_id: operatorId }),
    });
    const startSession2Body = await startSession2Res.json();
    assert.equal(startSession2Res.status, 200);
    const execId2 = Number(startSession2Body.id);
    createdExecIds.push(execId2);

    const finishStage5Res = await fetch(`${baseUrl}/api/executions/${execId2}/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Operador',
        'x-user-name': 'Operador Homologacao',
      },
      body: JSON.stringify({
        quantidade_boa_incremento: 40,
        partial: false,
        observation: 'Restante de 40 peças concluído (total 100/100)',
      }),
    });
    const finishStage5Body = await finishStage5Res.json();
    assert.equal(finishStage5Res.status, 200);
    assert.equal(finishStage5Body.status_operacao, 'CONCLUIDA');
    assert.equal(finishStage5Body.saldo_pendente, 0);
    assert.equal(
      finishStage5Body.order_status,
      'Em Produção',
      'Completing intermediate stage 5 must NEVER close the whole order while stage 8 is pending'
    );
    console.log('✅ Stage 5 Full Completion (60+40=100) Verified: status_operacao=CONCLUIDA, order_status remains Em Produção.');

    // J. Test RBAC HTTP Enforcement across all 6 profiles and 3 middleware tiers
    const rbacProfiles: Array<{
      role: string;
      expectAdmin200: boolean;
      expectPriority200: boolean;
      expectExpedir200: boolean;
    }> = [
      { role: 'Administrador', expectAdmin200: true, expectPriority200: true, expectExpedir200: true },
      { role: 'PCP', expectAdmin200: false, expectPriority200: true, expectExpedir200: true },
      { role: 'Supervisor', expectAdmin200: false, expectPriority200: true, expectExpedir200: true },
      { role: 'Operador', expectAdmin200: false, expectPriority200: false, expectExpedir200: false },
      { role: 'Comercial', expectAdmin200: false, expectPriority200: false, expectExpedir200: true },
      { role: 'Visualização', expectAdmin200: false, expectPriority200: false, expectExpedir200: false },
    ];

    for (const prof of rbacProfiles) {
      const adminRes = await fetch(`${baseUrl}/api/users/9999999`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': prof.role,
          'x-user-name': `Teste ${prof.role}`,
        },
        body: JSON.stringify({ active: true }),
      });
      const expectedAdminStatus = prof.expectAdmin200 ? 200 : 403;
      assert.equal(
        adminRes.status,
        expectedAdminStatus,
        `Profile ${prof.role} on PATCH /api/users/:id expected HTTP ${expectedAdminStatus}, got ${adminRes.status}`
      );

      const prioRes = await fetch(`${baseUrl}/api/pcp-phase1/ordens/${testOrderId}/prioridade_manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': prof.role,
          'x-user-name': `Teste ${prof.role}`,
        },
        body: JSON.stringify({ priority: 'ALTA', motivo: `Teste RBAC ${prof.role}` }),
      });
      const expectedPrioStatus = prof.expectPriority200 ? 200 : 403;
      assert.equal(
        prioRes.status,
        expectedPrioStatus,
        `Profile ${prof.role} on /prioridade_manual expected HTTP ${expectedPrioStatus}, got ${prioRes.status}`
      );

      const expRes = await fetch(`${baseUrl}/api/orders/${testOrderId}/expedir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': prof.role,
          'x-user-name': `Teste ${prof.role}`,
        },
        body: JSON.stringify({ observacao: `Teste Expedir RBAC ${prof.role}` }),
      });
      const expectedExpStatus = prof.expectExpedir200 ? 200 : 403;
      assert.equal(
        expRes.status,
        expectedExpStatus,
        `Profile ${prof.role} on /expedir expected HTTP ${expectedExpStatus}, got ${expRes.status}`
      );
    }
    console.log('✅ HTTP RBAC Middleware Verified for all 6 profiles (Administrador, PCP, Supervisor, Operador, Comercial, Visualização).');

    // K. Verify Audit Log Persistence for the test order
    const auditRes = await fetch(`${baseUrl}/api/pcp-phase1/audit-log?order_id=${testOrderId}`);
    assert.equal(auditRes.status, 200);
    const auditLogs: any[] = await auditRes.json();
    assert.ok(auditLogs.length >= 4, `Expected >= 4 immutable audit events recorded for test order, got ${auditLogs.length}`);
    console.log(`✅ Immutable Audit Trail Verified: ${auditLogs.length} events persisted in Supabase for order #${testOrderId}.`);
  } finally {
    // Clean up temporary test rows so production database remains 100% clean
    if (createdExecIds.length > 0) {
      await sb.from('pauses').delete().in('execution_id', createdExecIds);
      await sb.from('stage_executions').delete().in('id', createdExecIds);
    }
    if (testOrderId) {
      await sb.from('stage_observations').delete().eq('order_id', testOrderId);
      await sb.from('order_progress_logs').delete().eq('order_id', testOrderId);
      await sb.from('order_loss_logs').delete().eq('order_id', testOrderId);
      await sb.from('order_stage_progress').delete().eq('order_id', testOrderId);
      await sb.from('pcp_audit_log').delete().eq('order_id', testOrderId);
      await sb.from('order_history').delete().eq('order_id', testOrderId);
      await sb.from('orders').delete().eq('id', testOrderId);
      console.log(`🧹 Cleaned up temporary test order #${testOrderId} and all child records.`);
    }
    server.close();
  }
}

async function main() {
  runOperationEngineUnitTests();
  await runLiveApiAndDatabaseTests();
  console.log('\n🎉 ALL PHASE 1 HOMOLOGATION TESTS PASSED!');
}

main().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
