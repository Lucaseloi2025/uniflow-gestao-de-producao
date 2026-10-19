import { describe, it, expect } from 'vitest';
import {
  canFinishStage,
  getDefaultLossReasons,
  sumDailyPieceIncrements,
  calculateLossReport
} from './lossUtils';
import { OrderLossLog } from '../types';

describe('lossUtils — Regras de Perdas e Apontamento Diário', () => {
  it('deve avaliar corretamente as regras de conclusão por peça e por pedido', () => {
    const test1 = canFinishStage({ quantidade_boa: 25, quantidade_pedido: 50, calculation_type: 'por_peca' });
    expect(test1.canFinish).toBe(false);
    expect(test1.remaining).toBe(25);

    const test2 = canFinishStage({ quantidade_boa: 50, quantidade_pedido: 50, calculation_type: 'por_peca' });
    expect(test2.canFinish).toBe(true);
    expect(test2.remaining).toBe(0);

    const test3 = canFinishStage({ quantidade_boa: 52, quantidade_pedido: 50, calculation_type: 'por_peca' });
    expect(test3.canFinish).toBe(true);
    expect(test3.remaining).toBe(0);

    const test4 = canFinishStage({ quantidade_boa: 0, quantidade_pedido: 50, calculation_type: 'por_pedido' });
    expect(test4.canFinish).toBe(true);
    expect(test4.remaining).toBe(0);
  });

  it('deve mapear corretamente os motivos padrão de perdas para as etapas', () => {
    const mockStages = [
      { id: 1, name: 'Ficha de aprovação', sort_order: 1 },
      { id: 2, name: 'Corte', sort_order: 2 },
      { id: 12, name: 'Separação estoque', sort_order: 4 },
      { id: 5, name: 'DTF', sort_order: 7 },
      { id: 7, name: 'Costura', sort_order: 12 }
    ];
    const defaultReasons = getDefaultLossReasons(mockStages);
    expect(defaultReasons).toHaveLength(7);

    const corteMapping = defaultReasons.find(r => r.motivo === 'Defeito de corte');
    expect(corteMapping?.etapa_reentrada_id).toBe(2);

    const estoqueMapping = defaultReasons.find(r => r.motivo === 'Falta de matéria-prima/peça (estoque)');
    expect(estoqueMapping?.etapa_reentrada_id).toBe(12);

    const extravioMapping = defaultReasons.find(r => r.motivo === 'Extravio');
    expect(extravioMapping?.etapa_reentrada_id).toBe(1);
  });

  it('deve somar incrementos diários de peças por data em America/Sao_Paulo (40 para etapa 2 e 70 no total)', () => {
    const today = '2026-08-13';
    const logs = [
      { created_at: '2026-08-13T10:00:00Z', quantidade_boa_incremento: 25, stage_id: 2, user_id: 10 },
      { created_at: '2026-08-13T14:30:00Z', quantidade_boa_incremento: 15, stage_id: 2, user_id: 10 },
      { created_at: '2026-08-12T16:00:00Z', quantidade_boa_incremento: 50, stage_id: 2, user_id: 10 }, // ontem em SP
      { created_at: '2026-08-13T15:00:00Z', quantidade_boa_incremento: 30, stage_id: 5, user_id: 10 }, // etapa 5
    ];

    const todayStage2Sum = sumDailyPieceIncrements(logs, today, 2);
    expect(todayStage2Sum).toBe(40);

    const todayAllSum = sumDailyPieceIncrements(logs, today);
    expect(todayAllSum).toBe(70);
  });

  it('deve consolidar o relatório analítico de perdas por setor e pedido', () => {
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

    const mockStages = [
      { id: 1, name: 'Ficha de aprovação', sort_order: 1 },
      { id: 2, name: 'Corte', sort_order: 2 },
      { id: 12, name: 'Separação estoque', sort_order: 4 },
      { id: 5, name: 'DTF', sort_order: 7 },
      { id: 7, name: 'Costura', sort_order: 12 }
    ];

    const mockOrders = [
      { id: 101, order_number: 'PED-101', client_name: 'Cliente A', total_time_seconds: 7200, status: 'Em Produção', quantity: 50 },
      { id: 102, order_number: 'PED-102', client_name: 'Cliente B', total_time_seconds: 10800, status: 'Em Produção', quantity: 100 },
      { id: 103, order_number: 'PED-103', client_name: 'Cliente C', total_time_seconds: 3600, status: 'Entregue', quantity: 50 },
    ];

    const report = calculateLossReport(mockLossLogs, mockOrders, mockStages);
    expect(report.summary.total_perdido).toBe(10);
    expect(report.summary.total_pedidos_com_perda).toBe(2);
    expect(report.perdas_por_setor).toHaveLength(2);
    expect(report.perdas_por_setor[0].stage_name).toBe('Corte');
    expect(report.perdas_por_setor[0].quantidade_perdida).toBe(8);
  });
});
