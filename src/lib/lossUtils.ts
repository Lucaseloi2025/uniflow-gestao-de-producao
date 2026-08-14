import { OrderLossLog, LossReasonSetting, LossReportData, SectorLossItem, ReasonLossItem, OrderImpactItem } from '../types';

export interface StageProgressInput {
  quantidade_boa: number;
  quantidade_pedido: number;
  calculation_type?: 'por_pedido' | 'por_peca' | 'por_lote';
}

/**
  * Evaluates whether a stage can be marked as finished.
  * For "por_peca" stages, it can only finish if quantidade_boa >= quantidade_pedido.
  * For "por_pedido" stages, completion is binary.
  */
export function canFinishStage(input: StageProgressInput): { canFinish: boolean; remaining: number } {
  if (input.calculation_type === 'por_pedido') {
    return { canFinish: true, remaining: 0 };
  }
  const remaining = Math.max(0, input.quantidade_pedido - input.quantidade_boa);
  return {
    canFinish: input.quantidade_boa >= input.quantidade_pedido,
    remaining
  };
}

/**
  * Returns default loss reason settings mapped to stage names/IDs.
  */
export function getDefaultLossReasons(stages: { id: number; name: string; sort_order?: number }[]): LossReasonSetting[] {
  const findStageIdByName = (name: string, fallbackId: number): number => {
    const found = stages.find(s => s.name.toLowerCase().trim() === name.toLowerCase().trim());
    return found ? found.id : fallbackId;
  };

  const sortedStages = [...stages].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const firstStageId = sortedStages.length > 0 ? sortedStages[0].id : 1;
  const corteId = findStageIdByName('Corte', firstStageId);
  const estoqueId = findStageIdByName('Separação estoque', corteId);
  const dtfId = findStageIdByName('DTF', corteId);
  const costuraId = findStageIdByName('Costura', corteId);

  return [
    { motivo: 'Falta de matéria-prima/peça (estoque)', etapa_reentrada_id: estoqueId },
    { motivo: 'Defeito de corte', etapa_reentrada_id: corteId },
    { motivo: 'Falha na estampa/DTF', etapa_reentrada_id: dtfId },
    { motivo: 'Defeito de costura', etapa_reentrada_id: costuraId },
    { motivo: 'Extravio', etapa_reentrada_id: firstStageId },
    { motivo: 'Reprovado na conferência (qualidade)', etapa_reentrada_id: corteId },
    { motivo: 'Outro', etapa_reentrada_id: firstStageId },
  ];
}

/**
  * Filters and sums incremental good pieces recorded on a specific date (YYYY-MM-DD in local time).
  */
export function sumDailyPieceIncrements(
  logs: { created_at: string; quantidade_boa_incremento: number; stage_id?: number; user_id?: number }[],
  targetDateStr: string,
  stageId?: number,
  userId?: number
): number {
  return logs.reduce((sum, log) => {
    if (stageId !== undefined && stageId !== null && log.stage_id !== stageId) return sum;
    if (userId !== undefined && userId !== null && log.user_id !== userId) return sum;
    
    const d = new Date(log.created_at);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    if (dateStr === targetDateStr) {
      return sum + (log.quantidade_boa_incremento || 0);
    }
    return sum;
  }, 0);
}

/**
  * Aggregates loss logs into the loss report structure.
  */
export function calculateLossReport(
  lossLogs: OrderLossLog[],
  orders: { id: number; order_number: string; client_name: string; total_time_seconds: number; status: string; quantity: number }[] = [],
  stages: { id: number; name: string }[] = []
): LossReportData {
  const stageMap = new Map<number, string>();
  stages.forEach(s => stageMap.set(s.id, s.name));

  const totalLost = lossLogs.reduce((sum, l) => sum + (l.quantidade_perdida || 0), 0);

  // Group by sector/stage
  const sectorMap = new Map<number, { stage_name: string; lost: number; orderIds: Set<number> }>();
  // Group by reason + stage
  const reasonMap = new Map<string, { motivo: string; stage_name: string; lost: number }>();
  // Group lost by order
  const orderLostMap = new Map<number, number>();

  lossLogs.forEach(log => {
    const stageName = log.stage_name || stageMap.get(log.stage_id) || `Etapa #${log.stage_id}`;
    
    // Sector aggregation
    const sec = sectorMap.get(log.stage_id) || { stage_name: stageName, lost: 0, orderIds: new Set() };
    sec.lost += log.quantidade_perdida;
    sec.orderIds.add(log.order_id);
    sectorMap.set(log.stage_id, sec);

    // Reason aggregation
    const reasonKey = `${log.motivo}|${stageName}`;
    const r = reasonMap.get(reasonKey) || { motivo: log.motivo, stage_name: stageName, lost: 0 };
    r.lost += log.quantidade_perdida;
    reasonMap.set(reasonKey, r);

    // Order aggregation
    const prev = orderLostMap.get(log.order_id) || 0;
    orderLostMap.set(log.order_id, prev + log.quantidade_perdida);
  });

  const perdas_por_setor: SectorLossItem[] = Array.from(sectorMap.entries()).map(([stage_id, val]) => ({
    stage_id,
    stage_name: val.stage_name,
    quantidade_perdida: val.lost,
    pct_total: totalLost > 0 ? Math.round((val.lost / totalLost) * 1000) / 10 : 0,
    pedidos_afetados: val.orderIds.size
  })).sort((a, b) => b.quantidade_perdida - a.quantidade_perdida);

  const perdas_por_motivo: ReasonLossItem[] = Array.from(reasonMap.values()).map(val => ({
    motivo: val.motivo,
    stage_name: val.stage_name,
    quantidade_perdida: val.lost,
    pct_total: totalLost > 0 ? Math.round((val.lost / totalLost) * 1000) / 10 : 0
  })).sort((a, b) => b.quantidade_perdida - a.quantidade_perdida);

  // Impact on lead time
  const ordersWithLoss = orders.filter(o => orderLostMap.has(o.id));
  const ordersWithoutLoss = orders.filter(o => !orderLostMap.has(o.id) && o.total_time_seconds > 0);

  const avgSecondsWithoutLoss = ordersWithoutLoss.length > 0
    ? ordersWithoutLoss.reduce((sum, o) => sum + o.total_time_seconds, 0) / ordersWithoutLoss.length
    : 0;

  const impacto_pedidos: OrderImpactItem[] = ordersWithLoss.map(o => {
    const leadTimeLossHours = Math.round((o.total_time_seconds / 3600) * 10) / 10;
    const leadTimeNoLossHours = Math.round((avgSecondsWithoutLoss / 3600) * 10) / 10;
    const extraHours = Math.max(0, Math.round((leadTimeLossHours - leadTimeNoLossHours) * 10) / 10);
    return {
      order_id: o.id,
      order_number: o.order_number,
      client_name: o.client_name,
      quantidade_perdida: orderLostMap.get(o.id) || 0,
      lead_time_com_perda_horas: leadTimeLossHours,
      lead_time_medio_sem_perda_horas: leadTimeNoLossHours,
      atraso_adicional_horas: extraHours
    };
  });

  const totalPiecesProduced = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
  const pct_perda = totalPiecesProduced > 0 ? Math.round((totalLost / totalPiecesProduced) * 1000) / 10 : 0;
  
  const avgExtraDelay = impacto_pedidos.length > 0
    ? Math.round((impacto_pedidos.reduce((sum, i) => sum + i.atraso_adicional_horas, 0) / impacto_pedidos.length) * 10) / 10
    : 0;

  return {
    summary: {
      total_perdido: totalLost,
      pct_perda,
      total_pedidos_com_perda: orderLostMap.size,
      impacto_prazo_horas: avgExtraDelay
    },
    perdas_por_setor,
    perdas_por_motivo,
    impacto_pedidos
  };
}
