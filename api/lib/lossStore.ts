import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getDefaultLossReasons, calculateLossReport, sumDailyPieceIncrements } from '../../src/lib/lossUtils.ts';
import { OrderStageProgress, OrderLossLog, LossReasonSetting, LossReportData } from '../../src/types.ts';

dotenv.config();

const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || "").trim();
const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder");

// In-memory data structures with database sync & fallback file persistence
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
    if (dbLosses) {
      lossLogsStore = dbLosses;
    }
  } catch (e) {}

  // Try to load progress_logs from Supabase
  try {
    const { data: dbProgressLogs } = await supabase.from('order_progress_logs').select('*');
    if (dbProgressLogs) {
      progressLogsStore = dbProgressLogs;
    }
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
  // Try persisting to Supabase if table exists
  try {
    await supabase.from('loss_reason_settings').upsert(settings);
  } catch (e) {}
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
        order_id: orderId,
        stage_id: stageId,
        quantidade_pedido: orderQty,
        quantidade_boa: isFinished ? orderQty : 0,
        quantidade_perdida: 0,
        pendencia_reposicao: 0,
        finished: isFinished
      };
      stageProgressStore.set(key, prog);
      // Try to persist to DB
      try {
        await supabase.from('order_stage_progress').upsert(prog);
      } catch (e) {}
    } else {
      // Ensure quantidade_pedido matches order quantity if updated
      if (order.quantity && prog.quantidade_pedido !== order.quantity) {
        prog.quantidade_pedido = order.quantity;
      }
    }
    results.push(prog);
  }

  return results;
}

export async function logProgress(
  orderId: number,
  stageId: number,
  userId: number,
  userName: string,
  incremento: number
): Promise<{ success: boolean; progress: OrderStageProgress; log: any }> {
  await initStore();

  const progressList = await getStageProgressForOrder(orderId);
  const key = `${orderId}_${stageId}`;
  let prog = stageProgressStore.get(key);

  if (!prog) {
    const { data: order } = await supabase.from('orders').select('quantity').eq('id', orderId).single();
    prog = {
      order_id: orderId,
      stage_id: stageId,
      quantidade_pedido: order?.quantity || 0,
      quantidade_boa: 0,
      quantidade_perdida: 0,
      pendencia_reposicao: 0,
      finished: false
    };
  }

  // Update good quantity
  prog.quantidade_boa = Math.max(0, prog.quantidade_boa + incremento);

  // If this stage had pending replacement, clear/reduce pendency
  if (prog.pendencia_reposicao > 0) {
    prog.pendencia_reposicao = Math.max(0, prog.pendencia_reposicao - incremento);
  }

  // Fetch stage calculation type
  const { data: stageInfo } = await supabase.from('stages').select('calculation_type').eq('id', stageId).single();
  const calcType = stageInfo?.calculation_type || 'por_peca';

  if (calcType === 'por_peca') {
    prog.finished = prog.quantidade_boa >= prog.quantidade_pedido;
  }

  stageProgressStore.set(key, prog);
  try {
    await supabase.from('order_stage_progress').upsert(prog);
  } catch (e) {}

  const logEntry = {
    id: progressLogsStore.length + 1,
    order_id: orderId,
    stage_id: stageId,
    user_id: userId,
    user_name: userName,
    quantidade_boa_incremento: incremento,
    created_at: new Date().toISOString()
  };
  progressLogsStore.push(logEntry);

  try {
    await supabase.from('order_progress_logs').insert(logEntry);
  } catch (e) {}

  return { success: true, progress: prog, log: logEntry };
}

export async function logLoss(
  orderId: number,
  stageId: number,
  userId: number,
  userName: string,
  quantidadePerdida: number,
  motivo: string,
  motivoDetalhe?: string,
  etapaReentradaIdInput?: number
): Promise<{ success: boolean; progress: OrderStageProgress; lossLog: OrderLossLog; reentradaStageId: number }> {
  await initStore();

  const progressList = await getStageProgressForOrder(orderId);
  const key = `${orderId}_${stageId}`;
  let prog = stageProgressStore.get(key);

  if (!prog) {
    const { data: order } = await supabase.from('orders').select('quantity').eq('id', orderId).single();
    prog = {
      order_id: orderId,
      stage_id: stageId,
      quantidade_pedido: order?.quantity || 0,
      quantidade_boa: 0,
      quantidade_perdida: 0,
      pendencia_reposicao: 0,
      finished: false
    };
  }

  // 1. Update current stage loss count
  prog.quantidade_perdida += quantidadePerdida;
  // Perda breaks finished condition if quantidade_boa was assuming NO loss or if completion requires replacing
  if (prog.quantidade_boa < prog.quantidade_pedido) {
    prog.finished = false;
  }
  stageProgressStore.set(key, prog);
  try {
    await supabase.from('order_stage_progress').upsert(prog);
  } catch (e) {}

  // 2. Determine re-entry stage
  let reentradaStageId = etapaReentradaIdInput;
  if (!reentradaStageId) {
    const reasonSetting = lossReasonSettingsStore.find(r => r.motivo.toLowerCase() === motivo.toLowerCase());
    reentradaStageId = reasonSetting ? reasonSetting.etapa_reentrada_id : stageId;
  }

  // Get stage name for re-entry
  let etapaReentradaName = '';
  try {
    const { data: st } = await supabase.from('stages').select('name').eq('id', reentradaStageId).single();
    etapaReentradaName = st?.name || `Etapa #${reentradaStageId}`;
  } catch (e) {}

  let stageName = '';
  try {
    const { data: st } = await supabase.from('stages').select('name').eq('id', stageId).single();
    stageName = st?.name || `Etapa #${stageId}`;
  } catch (e) {}

  // 3. Create loss log
  const lossLog: OrderLossLog = {
    id: lossLogsStore.length + 1,
    order_id: orderId,
    stage_id: stageId,
    stage_name: stageName,
    user_id: userId,
    user_name: userName,
    quantidade_perdida: quantidadePerdida,
    motivo,
    motivo_detalhe: motivoDetalhe || '',
    etapa_reentrada_id: reentradaStageId,
    etapa_reentrada_name: etapaReentradaName,
    created_at: new Date().toISOString()
  };
  lossLogsStore.push(lossLog);
  try {
    await supabase.from('order_loss_logs').insert(lossLog);
  } catch (e) {}

  // 4. Add reposição pendency to re-entry stage
  const reentradaKey = `${orderId}_${reentradaStageId}`;
  let reentradaProg = stageProgressStore.get(reentradaKey);
  if (!reentradaProg) {
    reentradaProg = {
      order_id: orderId,
      stage_id: reentradaStageId,
      quantidade_pedido: prog.quantidade_pedido,
      quantidade_boa: 0,
      quantidade_perdida: 0,
      pendencia_reposicao: 0,
      finished: false
    };
  }
  reentradaProg.pendencia_reposicao += quantidadePerdida;
  reentradaProg.finished = false; // Must re-process replacement pieces
  stageProgressStore.set(reentradaKey, reentradaProg);
  try {
    await supabase.from('order_stage_progress').upsert(reentradaProg);
  } catch (e) {}

  return {
    success: true,
    progress: prog,
    lossLog,
    reentradaStageId
  };
}

export async function validateStageFinish(
  orderId: number,
  stageId: number
): Promise<{ canFinish: boolean; message?: string; remaining?: number }> {
  await initStore();

  const { data: stageInfo } = await supabase.from('stages').select('name, calculation_type').eq('id', stageId).single();
  const calcType = stageInfo?.calculation_type || 'por_peca';

  if (calcType === 'por_pedido') {
    return { canFinish: true };
  }

  const progressList = await getStageProgressForOrder(orderId);
  const prog = progressList.find(p => p.stage_id === stageId);

  if (!prog) {
    return { canFinish: true };
  }

  if (prog.quantidade_boa < prog.quantidade_pedido) {
    const remaining = prog.quantidade_pedido - prog.quantidade_boa;
    return {
      canFinish: false,
      remaining,
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
  try {
    const { data } = await supabase.from('orders').select('id, order_number, client_name, total_time_seconds, status, quantity');
    if (data) orders = data;
  } catch (e) {}

  let stages: any[] = [];
  try {
    const { data } = await supabase.from('stages').select('id, name');
    if (data) stages = data;
  } catch (e) {}

  return calculateLossReport(filteredLogs, orders, stages);
}

export async function getProgressLogs(): Promise<any[]> {
  await initStore();
  return progressLogsStore;
}
