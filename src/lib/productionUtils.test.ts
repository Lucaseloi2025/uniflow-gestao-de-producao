import { describe, it, expect } from 'vitest';
import {
  Stage,
  Order,
  StageExecution,
  getLastPorPecaStageId,
  calculateFinishedPieces,
  calculateFinishedPiecesByPeriod
} from './productionUtils';

describe('productionUtils — Métricas de Produção e Contagem Única', () => {
  const mockStages: Stage[] = [
    { id: 1, name: 'Ficha de aprovação', sort_order: 1, calculation_type: 'por_pedido' },
    { id: 6, name: 'Sublimação', sort_order: 2, calculation_type: 'por_peca' },
    { id: 2, name: 'Corte', sort_order: 3, calculation_type: 'por_peca' },
    { id: 7, name: 'Costura', sort_order: 4, calculation_type: 'por_peca' },
    { id: 8, name: 'Conferência', sort_order: 5, calculation_type: 'por_peca' },
  ];

  it('deve contar as peças concluídas apenas uma vez na última etapa da rota (50 peças e não 200)', () => {
    const order1: Order = {
      id: 101,
      order_number: 'PED-101',
      quantity: 50,
      required_stages: [1, 6, 2, 7, 8],
      status: 'Em Produção',
      created_at: '2026-08-10T10:00:00Z'
    };

    const executionsOrder1: StageExecution[] = [
      { id: 1, order_id: 101, stage_id: 6, status: 'Finalizado', end_time: '2026-08-11T10:00:00Z' },
      { id: 2, order_id: 101, stage_id: 2, status: 'Finalizado', end_time: '2026-08-12T10:00:00Z' },
      { id: 3, order_id: 101, stage_id: 7, status: 'Finalizado', end_time: '2026-08-13T10:00:00Z' },
      { id: 4, order_id: 101, stage_id: 8, status: 'Finalizado', end_time: '2026-08-14T10:00:00Z' },
    ];

    const lastStageId = getLastPorPecaStageId(order1.required_stages, mockStages);
    expect(lastStageId).toBe(8);

    const calc1 = calculateFinishedPieces([order1], mockStages, executionsOrder1, [], '2026-08-01T00:00:00Z', '2026-08-31T23:59:59Z');
    expect(calc1.totalPieces).toBe(50);
    expect(calc1.totalOrders).toBe(1);
  });

  it('deve resolver corretamente rota customizada encerrando em Costura (#7)', () => {
    const order2: Order = {
      id: 102,
      order_number: 'PED-102',
      quantity: 30,
      required_stages: [1, 2, 7],
      status: 'Em Produção',
      created_at: '2026-08-10T10:00:00Z'
    };

    const executionsOrder2: StageExecution[] = [
      { id: 5, order_id: 102, stage_id: 2, status: 'Finalizado', end_time: '2026-08-12T10:00:00Z' },
      { id: 6, order_id: 102, stage_id: 7, status: 'Finalizado', end_time: '2026-08-13T10:00:00Z' },
    ];

    const lastStageId2 = getLastPorPecaStageId(order2.required_stages, mockStages);
    expect(lastStageId2).toBe(7);

    const calc2 = calculateFinishedPieces([order2], mockStages, executionsOrder2, [], '2026-08-01T00:00:00Z', '2026-08-31T23:59:59Z');
    expect(calc2.totalPieces).toBe(30);
  });

  it('deve agrupar volumes finalizados por período corretamente', () => {
    const order1: Order = {
      id: 101,
      order_number: 'PED-101',
      quantity: 50,
      required_stages: [1, 6, 2, 7, 8],
      status: 'Em Produção',
      created_at: '2026-08-10T10:00:00Z'
    };
    const order2: Order = {
      id: 102,
      order_number: 'PED-102',
      quantity: 30,
      required_stages: [1, 2, 7],
      status: 'Em Produção',
      created_at: '2026-08-10T10:00:00Z'
    };

    const allExecutions: StageExecution[] = [
      { id: 4, order_id: 101, stage_id: 8, status: 'Finalizado', end_time: '2026-08-14T10:00:00Z' },
      { id: 6, order_id: 102, stage_id: 7, status: 'Finalizado', end_time: '2026-08-13T10:00:00Z' },
    ];

    const bucketsMonth = calculateFinishedPiecesByPeriod([order1, order2], mockStages, allExecutions, [], 'month', '2026-08-01T00:00:00Z', '2026-08-31T23:59:59Z');
    expect(bucketsMonth).toHaveLength(1);
    expect(bucketsMonth[0]?.pieces).toBe(80);
    expect(bucketsMonth[0]?.orders).toBe(2);
  });
});
