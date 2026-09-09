import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// ── Inline types (evita importar do frontend) ────────────────────────────────
interface OrderStageProgress {
  id?: number;
  order_id: number;
  stage_id: number;
  quantidade_pedido: number;
  quantidade_boa: number;
  quantidade_perdida: number;
  pendencia_reposicao: number;
  finished: boolean;
}

interface OrderLossLog {
  id?: number;
  order_id: number;
  stage_id: number;
  stage_name: string;
  user_id: number;
  user_name: string;
  quantidade_perdida: number;
  motivo: string;
  motivo_detalhe: string;
  etapa_reentrada_id: number;
  etapa_reentrada_name: string;
  created_at: string;
}

interface LossReasonSetting {
  motivo: string;
  etapa_reentrada_id: number;
}

interface LossReportData {
  summary: { total_perdido: number; pct_perda: number; total_pedidos_com_perda: number; impacto_prazo_horas: number };
  perdas_por_setor: any[];
  perdas_por_motivo: any[];
  impacto_pedidos: any[];
}

// ── Inline utils (evita importar do frontend) ────────────────────────────────
function getDefaultLossReasons(stages: { id: number; name: string; sort_order?: number }[]): LossReasonSetting[] {
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

function sumDailyPieceIncrements(
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
    if (dateStr === targetDateStr) return sum + (log.quantidade_boa_incremento || 0);
    return sum;
  }, 0);
}

function calculateLossReport(
  lossLogs: OrderLossLog[],
  orders: { id: number; order_number: string; client_name: string; total_time_seconds: number; status: string; quantity: number }[] = [],
  stages: { id: number; name: string }[] = []
): LossReportData {
  const stageMap = new Map<number, string>();
  stages.forEach(s => stageMap.set(s.id, s.name));
  const totalLost = lossLogs.reduce((sum, l) => sum + (l.quantidade_perdida || 0), 0);
  const sectorMap = new Map<number, { stage_name: string; lost: number; orderIds: Set<number> }>();
  const reasonMap = new Map<string, { motivo: string; stage_name: string; lost: number }>();
  const orderLostMap = new Map<number, number>();
  lossLogs.forEach(log => {
    const stageName = log.stage_name || stageMap.get(log.stage_id) || `Etapa #${log.stage_id}`;
    const sec = sectorMap.get(log.stage_id) || { stage_name: stageName, lost: 0, orderIds: new Set() };
    sec.lost += log.quantidade_perdida; sec.orderIds.add(log.order_id);
    sectorMap.set(log.stage_id, sec);
    const reasonKey = `${log.motivo}|${stageName}`;
    const r = reasonMap.get(reasonKey) || { motivo: log.motivo, stage_name: stageName, lost: 0 };
    r.lost += log.quantidade_perdida;
    reasonMap.set(reasonKey, r);
    const prev = orderLostMap.get(log.order_id) || 0;
    orderLostMap.set(log.order_id, prev + log.quantidade_perdida);
  });
  const perdas_por_setor = Array.from(sectorMap.entries()).map(([stage_id, val]) => ({
    stage_id, stage_name: val.stage_name, quantidade_perdida: val.lost,
    pct_total: totalLost > 0 ? Math.round((val.lost / totalLost) * 1000) / 10 : 0,
    pedidos_afetados: val.orderIds.size
  })).sort((a, b) => b.quantidade_perdida - a.quantidade_perdida);
  const perdas_por_motivo = Array.from(reasonMap.values()).map(val => ({
    motivo: val.motivo, stage_name: val.stage_name, quantidade_perdida: val.lost,
    pct_total: totalLost > 0 ? Math.round((val.lost / totalLost) * 1000) / 10 : 0
  })).sort((a, b) => b.quantidade_perdida - a.quantidade_perdida);
  const ordersWithLoss = orders.filter(o => orderLostMap.has(o.id));
  const ordersWithoutLoss = orders.filter(o => !orderLostMap.has(o.id) && o.total_time_seconds > 0);
  const avgSecondsWithoutLoss = ordersWithoutLoss.length > 0
    ? ordersWithoutLoss.reduce((sum, o) => sum + o.total_time_seconds, 0) / ordersWithoutLoss.length : 0;
  const impacto_pedidos = ordersWithLoss.map(o => {
    const leadTimeLossHours = Math.round((o.total_time_seconds / 3600) * 10) / 10;
    const leadTimeNoLossHours = Math.round((avgSecondsWithoutLoss / 3600) * 10) / 10;
    const extraHours = Math.max(0, Math.round((leadTimeLossHours - leadTimeNoLossHours) * 10) / 10);
    return { order_id: o.id, order_number: o.order_number, client_name: o.client_name,
      quantidade_perdida: orderLostMap.get(o.id) || 0, lead_time_com_perda_horas: leadTimeLossHours,
      lead_time_medio_sem_perda_horas: leadTimeNoLossHours, atraso_adicional_horas: extraHours };
  });
  const totalPiecesProduced = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
  const pct_perda = totalPiecesProduced > 0 ? Math.round((totalLost / totalPiecesProduced) * 1000) / 10 : 0;
  const avgExtraDelay = impacto_pedidos.length > 0
    ? Math.round((impacto_pedidos.reduce((sum, i) => sum + i.atraso_adicional_horas, 0) / impacto_pedidos.length) * 10) / 10 : 0;
  return {
    summary: { total_perdido: totalLost, pct_perda, total_pedidos_com_perda: orderLostMap.size, impacto_prazo_horas: avgExtraDelay },
    perdas_por_setor, perdas_por_motivo, impacto_pedidos
  };
}

// ── Supabase client ──────────────────────────────────────────────────────────
const DEFAULT_SUPABASE_URL = "https://dkyvzxmocppbydtpsgyu.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXZ6eG1vY3BwYnlkdHBzZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzU0NDksImV4cCI6MjA4NzU1MTQ0OX0.2s2RJevOZr2Na0bigWqR5rxt5bNtB6GIS6-N_TlpFgk";

const supabaseUrl = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── In-memory data structures ────────────────────────────────────────────────
const stageProgressStore = new Map<string, OrderStageProgress>(); // Key: `${order_id}_${stage_id}`
let lossLogsStore: OrderLossLog[] = [];
let progressLogsStore: { id?: number; order_id: number; stage_id: number; user_id: number; user_name?: string; quantidade_boa_incremento: number; created_at: string }[] = [];
let lossReasonSettingsStore: LossReasonSetting[] = [];
let isInitialized = false;

async function initStore() {
  if (isInitialized) return;
  isInitialized = true;

  // Try to load loss_reason_settings from Supabase if table exists
  try {
    const { data: dbReasons } = await supabase.from('loss_reason_settings').select('*');
    if (dbReasons && dbReasons.length > 0) {
      lossReasonSettingsStore = dbReasons;
    }
  } catch (err) {
    // Table not created yet
  }

  // Load stages to ensure default reason settings are mapped
  if (lossReasonSettingsStore.length === 0) {
    try {
      const { data: stages } = await supabase.from('stages').select('id, name, sort_order');
      if (stages) {
        lossReasonSettingsStore = getDefaultLossReasons(stages);
      }
    } catch (e) {
      lossReasonSettingsStore = getDefaultLossReasons([
        { id: 1, name: 'Ficha de aprovação', sort_order: 1 },
        { id: 2, name: 'Corte', sort_order: 2 },
        { id: 12, name: 'Separação estoque', sort_order: 4 },
        { id: 5, name: 'DTF', sort_order: 7 },
        { id: 7, name: 'Costura', sort_order: 12 },
        { id: 8, name: 'Conferência', sort_order: 13 }
      ]);
    }
  }

  // Try to load loss_logs from Supabase
  try {
    const { data: dbLosses } = await supabase.from('order_loss_logs').select('*');
    if (dbLosses) { lossLogsStore = dbLosses; }
  } catch (e) {}

  // Try to load progress_logs from Supabase
  try {
    const { data: dbProgressLogs } = await supabase.from('order_progress_logs').select('*');
    if (dbProgressLogs) { progressLogsStore = dbProgressLogs; }
  } catch (e) {}

  // Try to load order_stage_progress from Supabase
  try {
    const { data: dbProgress } = await supabase.from('order_stage_progress').select('*');
    if (dbProgress) {
      dbProgress.forEach((p: OrderStageProgress) => {
        stageProgressStore.set(`${p.order_id}_${p.stage_id}`, p);
      });
    }
  } catch (e) {}
}

export async function getLossReasons(): Promise<LossReasonSetting[]> {
  await initStore();
  return lossReasonSettingsStore;
}

export async function updateLossReasons(settings: LossReasonSetting[]): Promise<LossReasonSetting[]> {
  await initStore();
  lossReasonSettingsStore = settings;
  try { await supabase.from('loss_reason_settings').upsert(settings); } catch (e) {}
  return lossReasonSettingsStore;
}

export async function getStageProgressForOrder(orderId: number, orderData?: any): Promise<OrderStageProgress[]> {
  await initStore();

  let order = orderData;
  if (!order) {
    const { data } = await supabase.from('orders').select('*').eq('id', orderId).single();
    order = data;
  }

  if (!order) return [];

  const requiredStages: number[] = Array.isArray(order.required_stages) ? order.required_stages : [];
  const stagesStatus: any[] = Array.isArray(order.stages_status) ? order.stages_status : [];

  const results: OrderStageProgress[] = [];

  for (const stageId of requiredStages) {
    const key = `${orderId}_${stageId}`;
    let prog = stageProgressStore.get(key);

    if (!prog) {
      const st = stagesStatus.find((s: any) => Number(s.id) === Number(stageId));
      const isFinished = st ? !!st.finished : false;
      const orderQty = order.quantity || 0;
      prog = {
        order_id: orderId, stage_id: stageId, quantidade_pedido: orderQty,
        quantidade_boa: isFinished ? orderQty : 0, quantidade_perdida: 0,
        pendencia_reposicao: 0, finished: isFinished
      };
      stageProgressStore.set(key, prog);
    } else {
      if (order.quantity && prog.quantidade_pedido !== order.quantity) {
        prog.quantidade_pedido = order.quantity;
      }
    }
    results.push(prog);
  }

  return results;
}

export function enrichOrdersWithProgressSync(orders: any[]): void {
  if (!orders || orders.length === 0) return;

  for (const order of orders) {
    if (!Array.isArray(order.stages_status)) {
      order.stages_status = [];
    }

    const orderQty = order.quantity || 0;

    order.stages_status = order.stages_status.map((st: any) => {
      const stageId = Number(st.id);
      const key = `${order.id}_${stageId}`;
      let prog = stageProgressStore.get(key);

      if (!prog) {
        const isFinished = !!st.finished;
        prog = {
          order_id: order.id, stage_id: stageId, quantidade_pedido: orderQty,
          quantidade_boa: isFinished ? orderQty : 0, quantidade_perdida: 0,
          pendencia_reposicao: 0, finished: isFinished
        };
        stageProgressStore.set(key, prog);
      } else if (orderQty && prog.quantidade_pedido !== orderQty) {
        prog.quantidade_pedido = orderQty;
      }

      return {
        ...st, finished: prog.finished, quantidade_boa: prog.quantidade_boa,
        quantidade_perdida: prog.quantidade_perdida, pendencia_reposicao: prog.pendencia_reposicao,
        quantidade_pedido: orderQty
      };
    });
  }
}

export async function logProgress(
  orderId: number, stageId: number, userId: number, userName: string, incremento: number
): Promise<{ success: boolean; progress: OrderStageProgress; log: any }> {
  await initStore();

  const key = `${orderId}_${stageId}`;
  let prog = stageProgressStore.get(key);

  if (!prog) {
    const { data: order } = await supabase.from('orders').select('quantity').eq('id', orderId).single();
    prog = {
      order_id: orderId, stage_id: stageId, quantidade_pedido: order?.quantity || 0,
      quantidade_boa: 0, quantidade_perdida: 0, pendencia_reposicao: 0, finished: false
    };
  }

  prog.quantidade_boa = Math.max(0, prog.quantidade_boa + incremento);
  if (prog.pendencia_reposicao > 0) {
    prog.pendencia_reposicao = Math.max(0, prog.pendencia_reposicao - incremento);
  }

  const { data: stageInfo } = await supabase.from('stages').select('calculation_type').eq('id', stageId).single();
  const calcType = stageInfo?.calculation_type || 'por_peca';
  if (calcType === 'por_peca') {
    prog.finished = prog.quantidade_boa >= prog.quantidade_pedido;
  }

  stageProgressStore.set(key, prog);
  try { await supabase.from('order_stage_progress').upsert(prog); } catch (e) {}

  const logEntry = {
    id: progressLogsStore.length + 1, order_id: orderId, stage_id: stageId,
    user_id: userId, user_name: userName, quantidade_boa_incremento: incremento,
    created_at: new Date().toISOString()
  };
  progressLogsStore.push(logEntry);
  try { await supabase.from('order_progress_logs').insert(logEntry); } catch (e) {}

  return { success: true, progress: prog, log: logEntry };
}

export async function logLoss(
  orderId: number, stageId: number, userId: number, userName: string,
  quantidadePerdida: number, motivo: string, motivoDetalhe?: string, etapaReentradaIdInput?: number
): Promise<{ success: boolean; progress: OrderStageProgress; lossLog: OrderLossLog; reentradaStageId: number }> {
  await initStore();

  const key = `${orderId}_${stageId}`;
  let prog = stageProgressStore.get(key);

  if (!prog) {
    const { data: order } = await supabase.from('orders').select('quantity').eq('id', orderId).single();
    prog = {
      order_id: orderId, stage_id: stageId, quantidade_pedido: order?.quantity || 0,
      quantidade_boa: 0, quantidade_perdida: 0, pendencia_reposicao: 0, finished: false
    };
  }

  prog.quantidade_perdida += quantidadePerdida;
  if (prog.quantidade_boa < prog.quantidade_pedido) { prog.finished = false; }
  stageProgressStore.set(key, prog);
  try { await supabase.from('order_stage_progress').upsert(prog); } catch (e) {}

  let reentradaStageId = etapaReentradaIdInput;
  if (!reentradaStageId) {
    const reasonSetting = lossReasonSettingsStore.find(r => r.motivo.toLowerCase() === motivo.toLowerCase());
    reentradaStageId = reasonSetting ? reasonSetting.etapa_reentrada_id : stageId;
  }

  let etapaReentradaName = '';
  try { const { data: st } = await supabase.from('stages').select('name').eq('id', reentradaStageId).single(); etapaReentradaName = st?.name || `Etapa #${reentradaStageId}`; } catch (e) {}

  let stageName = '';
  try { const { data: st } = await supabase.from('stages').select('name').eq('id', stageId).single(); stageName = st?.name || `Etapa #${stageId}`; } catch (e) {}

  const lossLog: OrderLossLog = {
    id: lossLogsStore.length + 1, order_id: orderId, stage_id: stageId, stage_name: stageName,
    user_id: userId, user_name: userName, quantidade_perdida: quantidadePerdida, motivo,
    motivo_detalhe: motivoDetalhe || '', etapa_reentrada_id: reentradaStageId,
    etapa_reentrada_name: etapaReentradaName, created_at: new Date().toISOString()
  };
  lossLogsStore.push(lossLog);
  try { await supabase.from('order_loss_logs').insert(lossLog); } catch (e) {}

  const reentradaKey = `${orderId}_${reentradaStageId}`;
  let reentradaProg = stageProgressStore.get(reentradaKey);
  if (!reentradaProg) {
    reentradaProg = {
      order_id: orderId, stage_id: reentradaStageId, quantidade_pedido: prog.quantidade_pedido,
      quantidade_boa: 0, quantidade_perdida: 0, pendencia_reposicao: 0, finished: false
    };
  }
  reentradaProg.pendencia_reposicao += quantidadePerdida;
  reentradaProg.finished = false;
  stageProgressStore.set(reentradaKey, reentradaProg);
  try { await supabase.from('order_stage_progress').upsert(reentradaProg); } catch (e) {}

  return { success: true, progress: prog, lossLog, reentradaStageId };
}

export async function validateStageFinish(
  orderId: number, stageId: number
): Promise<{ canFinish: boolean; message?: string; remaining?: number }> {
  await initStore();

  const { data: stageInfo } = await supabase.from('stages').select('name, calculation_type').eq('id', stageId).single();
  const calcType = stageInfo?.calculation_type || 'por_peca';
  if (calcType === 'por_pedido') return { canFinish: true };

  const progressList = await getStageProgressForOrder(orderId);
  const prog = progressList.find(p => p.stage_id === stageId);
  if (!prog) return { canFinish: true };

  if (prog.quantidade_boa < prog.quantidade_pedido) {
    const remaining = prog.quantidade_pedido - prog.quantidade_boa;
    return {
      canFinish: false, remaining,
      message: `Não é possível finalizar a etapa '${stageInfo?.name || stageId}': faltam ${remaining} peças boas para atingir o total de ${prog.quantidade_pedido} peças do pedido. Registre a produção das peças de reposição antes de finalizar.`
    };
  }
  return { canFinish: true };
}

export async function getLossReportDataStore(startDate?: string, endDate?: string): Promise<LossReportData> {
  await initStore();

  let filteredLogs = [...lossLogsStore];
  if (startDate) {
    const startMs = new Date(startDate).getTime();
    filteredLogs = filteredLogs.filter(l => new Date(l.created_at).getTime() >= startMs);
  }
  if (endDate) {
    const endMs = new Date(endDate).getTime();
    filteredLogs = filteredLogs.filter(l => new Date(l.created_at).getTime() <= endMs);
  }

  let orders: any[] = [];
  try { const { data } = await supabase.from('orders').select('id, order_number, client_name, total_time_seconds, status, quantity'); if (data) orders = data; } catch (e) {}

  let stages: any[] = [];
  try { const { data } = await supabase.from('stages').select('id, name'); if (data) stages = data; } catch (e) {}

  return calculateLossReport(filteredLogs, orders, stages);
}

export async function getProgressLogs(): Promise<any[]> {
  await initStore();
  return progressLogsStore;
}
