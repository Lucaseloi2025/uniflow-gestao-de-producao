import {
  canFinishStage,
  getDefaultLossReasons,
  sumDailyPieceIncrements,
  calculateLossReport
} from './lossUtils';
import { OrderLossLog } from '../types';

function runTests() {
  console.log('--- Running lossUtils tests ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Test Stage Completion Rules
  const test1 = canFinishStage({ quantidade_boa: 25, quantidade_pedido: 50, calculation_type: 'por_peca' });
  assert(!test1.canFinish && test1.remaining === 25, 'Por peça: 25/50 cannot finish, 25 remaining');

  const test2 = canFinishStage({ quantidade_boa: 50, quantidade_pedido: 50, calculation_type: 'por_peca' });
  assert(test2.canFinish && test2.remaining === 0, 'Por peça: 50/50 can finish, 0 remaining');

  const test3 = canFinishStage({ quantidade_boa: 52, quantidade_pedido: 50, calculation_type: 'por_peca' });
  assert(test3.canFinish && test3.remaining === 0, 'Por peça: 52/50 can finish, 0 remaining');

  const test4 = canFinishStage({ quantidade_boa: 0, quantidade_pedido: 50, calculation_type: 'por_pedido' });
  assert(test4.canFinish && test4.remaining === 0, 'Por pedido: binary stage can finish regardless of count');

  // 2. Test Default Loss Reason Mappings
  const mockStages = [
    { id: 1, name: 'Ficha de aprovação', sort_order: 1 },
    { id: 2, name: 'Corte', sort_order: 2 },
    { id: 12, name: 'Separação estoque', sort_order: 4 },
    { id: 5, name: 'DTF', sort_order: 7 },
    { id: 7, name: 'Costura', sort_order: 12 }
  ];
  const defaultReasons = getDefaultLossReasons(mockStages);
  assert(defaultReasons.length === 7, '7 default loss reasons generated');
  
  const corteMapping = defaultReasons.find(r => r.motivo === 'Defeito de corte');
  assert(corteMapping?.etapa_reentrada_id === 2, 'Defeito de corte maps to Corte (id 2)');

  const estoqueMapping = defaultReasons.find(r => r.motivo === 'Falta de matéria-prima/peça (estoque)');
  assert(estoqueMapping?.etapa_reentrada_id === 12, 'Falta de matéria-prima maps to Separação estoque (id 12)');

  const extravioMapping = defaultReasons.find(r => r.motivo === 'Extravio');
  assert(extravioMapping?.etapa_reentrada_id === 1, 'Extravio maps to first stage (id 1)');

  // 3. Test Daily Partial Increment Summing
  const today = '2026-08-13';
  const logs = [
    { created_at: '2026-08-13T10:00:00Z', quantidade_boa_incremento: 25, stage_id: 2, user_id: 10 },
    { created_at: '2026-08-13T14:30:00Z', quantidade_boa_incremento: 15, stage_id: 2, user_id: 10 },
    { created_at: '2026-08-12T16:00:00Z', quantidade_boa_incremento: 50, stage_id: 2, user_id: 10 }, // yesterday
    { created_at: '2026-08-13T15:00:00Z', quantidade_boa_incremento: 30, stage_id: 5, user_id: 10 }, // different stage
  ];
  const todayStage2Sum = sumDailyPieceIncrements(logs, today, 2);
  assert(todayStage2Sum === 40, `Today partial increment for stage 2 is 40 (got ${todayStage2Sum})`);

  const todayAllSum = sumDailyPieceIncrements(logs, today);
  assert(todayAllSum === 70, `Today partial increment for all stages is 70 (got ${todayAllSum})`);

  // 4. Test Loss Report Aggregation
  const mockLossLogs: OrderLossLog[] = [
    {
      id: 1,
      order_id: 101,
      stage_id: 2,
      stage_name: 'Corte',
      user_id: 5,
      user_name: 'João',
      quantidade_perdida: 3,
      motivo: 'Defeito de corte',
      etapa_reentrada_id: 2,
      created_at: '2026-08-13T10:00:00Z'
    },
    {
      id: 2,
      order_id: 101,
      stage_id: 5,
      stage_name: 'DTF',
      user_id: 6,
      user_name: 'Maria',
      quantidade_perdida: 2,
      motivo: 'Falha na estampa/DTF',
      etapa_reentrada_id: 5,
      created_at: '2026-08-13T11:00:00Z'
    },
    {
      id: 3,
      order_id: 102,
      stage_id: 2,
      stage_name: 'Corte',
      user_id: 5,
      user_name: 'João',
      quantidade_perdida: 5,
      motivo: 'Defeito de corte',
      etapa_reentrada_id: 2,
      created_at: '2026-08-13T12:00:00Z'
    }
  ];

  const mockOrders = [
    { id: 101, order_number: 'PED-101', client_name: 'Cliente A', total_time_seconds: 7200, status: 'Em Produção', quantity: 50 },
    { id: 102, order_number: 'PED-102', client_name: 'Cliente B', total_time_seconds: 10800, status: 'Em Produção', quantity: 100 },
    { id: 103, order_number: 'PED-103', client_name: 'Cliente C', total_time_seconds: 3600, status: 'Entregue', quantity: 50 },
  ];

  const report = calculateLossReport(mockLossLogs, mockOrders, mockStages);
  assert(report.summary.total_perdido === 10, 'Report total_perdido is 10');
  assert(report.summary.total_pedidos_com_perda === 2, 'Report total_pedidos_com_perda is 2');
  assert(report.perdas_por_setor.length === 2, 'Report perdas_por_setor has 2 sectors');
  assert(report.perdas_por_setor[0].stage_name === 'Corte' && report.perdas_por_setor[0].quantidade_perdida === 8, 'Corte is top sector with 8 losses');

  console.log(`\nTest Summary: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
