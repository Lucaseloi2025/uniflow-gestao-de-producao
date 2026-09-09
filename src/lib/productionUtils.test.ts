import {
  Stage,
  Order,
  StageExecution,
  ProgressLog,
  getLastPorPecaStageId,
  calculateFinishedPieces,
  calculateFinishedPiecesByPeriod
} from './productionUtils';

// Mock stages configuration
const mockStages: Stage[] = [
  { id: 1, name: 'Ficha de aprovação', sort_order: 1, calculation_type: 'por_pedido' },
  { id: 6, name: 'Sublimação', sort_order: 2, calculation_type: 'por_peca' },
  { id: 2, name: 'Corte', sort_order: 3, calculation_type: 'por_peca' },
  { id: 7, name: 'Costura', sort_order: 4, calculation_type: 'por_peca' },
  { id: 8, name: 'Conferência', sort_order: 5, calculation_type: 'por_peca' },
];

function runTests() {
  console.log("=== Running Unit Tests for productionUtils ===");
  let passed = 0;
  let failed = 0;

  const assertEqual = (actual: any, expected: any, testName: string) => {
    if (actual === expected || JSON.stringify(actual) === JSON.stringify(expected)) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      failed++;
    }
  };

  // Test 1: Order with 50 pieces and 4 stages (Corte, Sublimação, Costura, Conferência)
  // Must count 50 pieces ONCE (not 50 x 4 = 200 pieces)
  const order1: Order = {
    id: 101,
    order_number: 'PED-101',
    quantity: 50,
    required_stages: [1, 6, 2, 7, 8], // Last por_peca stage is #8 (Conferência)
    status: 'Em Produção',
    created_at: '2026-08-10T10:00:00Z'
  };

  // Executions for ALL 4 stages of Order 1
  const executionsOrder1: StageExecution[] = [
    { id: 1, order_id: 101, stage_id: 6, status: 'Finalizado', end_time: '2026-08-11T10:00:00Z' },
    { id: 2, order_id: 101, stage_id: 2, status: 'Finalizado', end_time: '2026-08-12T10:00:00Z' },
    { id: 3, order_id: 101, stage_id: 7, status: 'Finalizado', end_time: '2026-08-13T10:00:00Z' },
    { id: 4, order_id: 101, stage_id: 8, status: 'Finalizado', end_time: '2026-08-14T10:00:00Z' },
  ];

  // Test 1.1: Verify last stage resolution
  const lastStageId = getLastPorPecaStageId(order1.required_stages, mockStages);
  assertEqual(lastStageId, 8, "Test 1.1: Last stage for Order 1 should be #8 (Conferência)");

  // Test 1.2: Calculate total finished pieces for August 2026
  const calc1 = calculateFinishedPieces([order1], mockStages, executionsOrder1, [], '2026-08-01T00:00:00Z', '2026-08-31T23:59:59Z');
  assertEqual(calc1.totalPieces, 50, "Test 1.2: Total volume for Order 1 with 4 finished stages should be 50 pieces (NOT 200)");
  assertEqual(calc1.totalOrders, 1, "Test 1.2: Total orders count should be 1");

  // Test 2: Custom route ending at Costura (#7) (no Conferência)
  const order2: Order = {
    id: 102,
    order_number: 'PED-102',
    quantity: 30,
    required_stages: [1, 2, 7], // Ends at Costura (#7)
    status: 'Em Produção',
    created_at: '2026-08-10T10:00:00Z'
  };

  const executionsOrder2: StageExecution[] = [
    { id: 5, order_id: 102, stage_id: 2, status: 'Finalizado', end_time: '2026-08-12T10:00:00Z' },
    { id: 6, order_id: 102, stage_id: 7, status: 'Finalizado', end_time: '2026-08-13T10:00:00Z' },
  ];

  const lastStageId2 = getLastPorPecaStageId(order2.required_stages, mockStages);
  assertEqual(lastStageId2, 7, "Test 2.1: Last stage for Order 2 should be #7 (Costura)");

  const calc2 = calculateFinishedPieces([order2], mockStages, executionsOrder2, [], '2026-08-01T00:00:00Z', '2026-08-31T23:59:59Z');
  assertEqual(calc2.totalPieces, 30, "Test 2.2: Total volume for Order 2 ending at Costura should be 30 pieces");

  // Test 3: Grouping volume by period (month & week)
  const allOrders = [order1, order2];
  const allExecutions = [...executionsOrder1, ...executionsOrder2];
  const bucketsMonth = calculateFinishedPiecesByPeriod(allOrders, mockStages, allExecutions, [], 'month', '2026-08-01T00:00:00Z', '2026-08-31T23:59:59Z');
  
  assertEqual(bucketsMonth.length, 1, "Test 3.1: Should return 1 month bucket for August 2026");
  assertEqual(bucketsMonth[0]?.pieces, 80, "Test 3.2: August 2026 total volume should be 50 + 30 = 80 pieces (NOT 260 pieces)");
  assertEqual(bucketsMonth[0]?.orders, 2, "Test 3.3: August 2026 total orders count should be 2");

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
