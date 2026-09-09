export interface Stage {
  id: number;
  name: string;
  sort_order: number;
  calculation_type: string;
}

export interface Order {
  id: number;
  order_number: string;
  client_name?: string;
  quantity: number;
  required_stages: number[];
  status: string;
  created_at: string;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  deleted_at?: string | null;
}

export interface StageExecution {
  id: number;
  order_id: number;
  stage_id: number;
  user_id?: number;
  start_time?: string;
  end_time: string;
  status: string;
}

export interface ProgressLog {
  id?: number;
  order_id: number;
  stage_id: number;
  user_id?: number;
  quantidade_boa_incremento: number;
  created_at: string;
}

export interface VolumeBucket {
  label: string;
  orders: number;
  pieces: number;
}

/**
 * Returns the ID of the last 'por_peca' stage for a specific order based on its required_stages workflow.
 */
export function getLastPorPecaStageId(orderRequiredStages: number[], allStages: Stage[]): number | null {
  if (!orderRequiredStages || orderRequiredStages.length === 0) return null;
  const stageMap = new Map<number, Stage>();
  allStages.forEach(s => stageMap.set(s.id, s));

  const reqStages = orderRequiredStages
    .map(id => stageMap.get(id))
    .filter((s): s is Stage => !!s);

  const porPecaStages = reqStages.filter(s => s.calculation_type === 'por_peca');
  if (porPecaStages.length > 0) {
    porPecaStages.sort((a, b) => a.sort_order - b.sort_order);
    return porPecaStages[porPecaStages.length - 1].id;
  }

  reqStages.sort((a, b) => a.sort_order - b.sort_order);
  return reqStages.length > 0 ? reqStages[reqStages.length - 1].id : null;
}

/**
 * Calculates finalized production volume for orders within an optional date range.
 * Counts each piece ONCE when it completes/progresses through the LAST 'por_peca' stage of that order's route.
 */
export function calculateFinishedPieces(
  orders: Order[],
  allStages: Stage[],
  executions: StageExecution[],
  progressLogs: ProgressLog[],
  startDateIso?: string,
  endDateIso?: string
): { totalPieces: number; totalOrders: number; orderBreakdown: Map<number, number> } {

  const activeOrdersMap = new Map<number, Order>();
  orders.forEach(o => {
    if (!o.deleted_at && o.status !== 'Cancelado') {
      activeOrdersMap.set(o.id, o);
    }
  });

  const orderFinishedPieces = new Map<number, number>();

  const isBetween = (iso: string) => {
    if (startDateIso && iso < startDateIso) return false;
    if (endDateIso && iso > endDateIso) return false;
    return true;
  };

  // 1. Check completed stage_executions on the LAST stage
  for (const ex of executions) {
    if (ex.status !== 'Finalizado' || !ex.end_time) continue;
    if (!isBetween(ex.end_time)) continue;

    const ord = activeOrdersMap.get(ex.order_id);
    if (!ord) continue;

    const lastStageId = getLastPorPecaStageId(ord.required_stages, allStages);
    if (ex.stage_id === lastStageId) {
      orderFinishedPieces.set(ord.id, Math.max(orderFinishedPieces.get(ord.id) || 0, ord.quantity));
    }
  }

  // 2. Check piece increment logs on the LAST stage
  for (const log of progressLogs) {
    if (!log.created_at || !isBetween(log.created_at)) continue;
    const ord = activeOrdersMap.get(log.order_id);
    if (!ord) continue;

    const lastStageId = getLastPorPecaStageId(ord.required_stages, allStages);
    if (log.stage_id === lastStageId) {
      const current = orderFinishedPieces.get(ord.id) || 0;
      const inc = log.quantidade_boa_incremento || 0;
      orderFinishedPieces.set(ord.id, Math.min(ord.quantity, current + inc));
    }
  }

  // 3. Fallback for delivered orders without explicit last-stage execution in logs
  for (const ord of activeOrdersMap.values()) {
    if (ord.status === 'Entregue' && ord.delivered_at && isBetween(ord.delivered_at)) {
      if (!orderFinishedPieces.has(ord.id)) {
        orderFinishedPieces.set(ord.id, ord.quantity);
      }
    }
  }

  let totalPieces = 0;
  for (const qty of orderFinishedPieces.values()) {
    totalPieces += qty;
  }

  return {
    totalPieces,
    totalOrders: orderFinishedPieces.size,
    orderBreakdown: orderFinishedPieces
  };
}

/**
 * Formats a date string into a bucket key based on the period ('day', 'week', 'month').
 */
function getBucketKey(isoStr: string, period: 'day' | 'week' | 'month'): string {
  const d = new Date(isoStr);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');

  if (period === 'day') {
    return `${year}-${month}-${day}`;
  }

  if (period === 'month') {
    return `${year}-${month}`;
  }

  // Week bucket: find Monday of the week
  const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon...
  const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mon = new Date(d.getTime() - diffToMon * 24 * 60 * 60 * 1000);
  const monYear = mon.getUTCFullYear();
  const monMonth = String(mon.getUTCMonth() + 1).padStart(2, '0');
  const monDay = String(mon.getUTCDate()).padStart(2, '0');
  return `Semana ${monDay}/${monMonth}`;
}

/**
 * Calculates finalized production volume grouped by period (day, week, or month).
 */
export function calculateFinishedPiecesByPeriod(
  orders: Order[],
  allStages: Stage[],
  executions: StageExecution[],
  progressLogs: ProgressLog[],
  period: 'day' | 'week' | 'month',
  startDateIso?: string,
  endDateIso?: string
): VolumeBucket[] {

  const activeOrdersMap = new Map<number, Order>();
  orders.forEach(o => {
    if (!o.deleted_at && o.status !== 'Cancelado') {
      activeOrdersMap.set(o.id, o);
    }
  });

  const isBetween = (iso: string) => {
    if (startDateIso && iso < startDateIso) return false;
    if (endDateIso && iso > endDateIso) return false;
    return true;
  };

  const bucketMap = new Map<string, { ordersSet: Set<number>; pieces: number }>();

  const addToBucket = (bucketKey: string, orderId: number, pieces: number) => {
    if (!bucketMap.has(bucketKey)) {
      bucketMap.set(bucketKey, { ordersSet: new Set(), pieces: 0 });
    }
    const b = bucketMap.get(bucketKey)!;
    if (!b.ordersSet.has(orderId)) {
      b.ordersSet.add(orderId);
      b.pieces += pieces;
    }
  };

  // 1. Process executions of the LAST stage
  for (const ex of executions) {
    if (ex.status !== 'Finalizado' || !ex.end_time) continue;
    if (!isBetween(ex.end_time)) continue;

    const ord = activeOrdersMap.get(ex.order_id);
    if (!ord) continue;

    const lastStageId = getLastPorPecaStageId(ord.required_stages, allStages);
    if (ex.stage_id === lastStageId) {
      const key = getBucketKey(ex.end_time, period);
      addToBucket(key, ord.id, ord.quantity);
    }
  }

  // 2. Process logs of the LAST stage
  for (const log of progressLogs) {
    if (!log.created_at || !isBetween(log.created_at)) continue;
    const ord = activeOrdersMap.get(log.order_id);
    if (!ord) continue;

    const lastStageId = getLastPorPecaStageId(ord.required_stages, allStages);
    if (log.stage_id === lastStageId) {
      const key = getBucketKey(log.created_at, period);
      addToBucket(key, ord.id, log.quantidade_boa_incremento || ord.quantity);
    }
  }

  // 3. Fallback for delivered orders
  for (const ord of activeOrdersMap.values()) {
    if (ord.status === 'Entregue' && ord.delivered_at && isBetween(ord.delivered_at)) {
      const key = getBucketKey(ord.delivered_at, period);
      addToBucket(key, ord.id, ord.quantity);
    }
  }

  const result: VolumeBucket[] = [];
  const sortedKeys = Array.from(bucketMap.keys()).sort();
  for (const key of sortedKeys) {
    const b = bucketMap.get(key)!;
    result.push({
      label: key,
      orders: b.ordersSet.size,
      pieces: b.pieces
    });
  }

  return result;
}
