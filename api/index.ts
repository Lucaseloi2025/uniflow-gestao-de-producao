import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// ── Inline: lossStore ──────────────────────────────────────────────────────────
// (Inlined to avoid cross-file .ts import issues on Vercel @vercel/node runtime)

interface OrderStageProgress {
  id?: number; order_id: number; stage_id: number;
  quantidade_pedido: number; quantidade_boa: number;
  quantidade_perdida: number; pendencia_reposicao: number; finished: boolean;
}
interface OrderLossLog {
  id?: number; order_id: number; stage_id: number; stage_name: string;
  user_id: number; user_name: string; quantidade_perdida: number; motivo: string;
  motivo_detalhe: string; etapa_reentrada_id: number; etapa_reentrada_name: string; created_at: string;
}
interface LossReasonSetting { motivo: string; etapa_reentrada_id: number; }
interface LossReportData {
  summary: { total_perdido: number; pct_perda: number; total_pedidos_com_perda: number; impacto_prazo_horas: number };
  perdas_por_setor: any[]; perdas_por_motivo: any[]; impacto_pedidos: any[];
}

function _getDefaultLossReasons(stages: { id: number; name: string; sort_order?: number }[]): LossReasonSetting[] {
  const find = (name: string, fb: number) => stages.find(s => s.name.toLowerCase().trim() === name.toLowerCase().trim())?.id ?? fb;
  const sorted = [...stages].sort((a, b) => (a.sort_order||0)-(b.sort_order||0));
  const first = sorted[0]?.id ?? 1;
  const corte = find('Corte', first); const estoque = find('Separação estoque', corte);
  const dtf = find('DTF', corte); const costura = find('Costura', corte);
  return [
    { motivo: 'Falta de matéria-prima/peça (estoque)', etapa_reentrada_id: estoque },
    { motivo: 'Defeito de corte', etapa_reentrada_id: corte },
    { motivo: 'Falha na estampa/DTF', etapa_reentrada_id: dtf },
    { motivo: 'Defeito de costura', etapa_reentrada_id: costura },
    { motivo: 'Extravio', etapa_reentrada_id: first },
    { motivo: 'Reprovado na conferência (qualidade)', etapa_reentrada_id: corte },
    { motivo: 'Outro', etapa_reentrada_id: first },
  ];
}
function _calculateLossReport(lossLogs: OrderLossLog[], orders: any[]=[], stages: any[]=[]): LossReportData {
  const stageMap = new Map<number, string>(); stages.forEach(s => stageMap.set(s.id, s.name));
  const totalLost = lossLogs.reduce((s, l) => s + (l.quantidade_perdida||0), 0);
  const sectorMap = new Map<number, any>(); const reasonMap = new Map<string, any>(); const orderLostMap = new Map<number, number>();
  lossLogs.forEach(log => {
    const sn = log.stage_name || stageMap.get(log.stage_id) || `Etapa #${log.stage_id}`;
    const sec = sectorMap.get(log.stage_id) || { stage_name: sn, lost: 0, orderIds: new Set() };
    sec.lost += log.quantidade_perdida; sec.orderIds.add(log.order_id); sectorMap.set(log.stage_id, sec);
    const rk = `${log.motivo}|${sn}`; const r = reasonMap.get(rk) || { motivo: log.motivo, stage_name: sn, lost: 0 };
    r.lost += log.quantidade_perdida; reasonMap.set(rk, r);
    orderLostMap.set(log.order_id, (orderLostMap.get(log.order_id)||0) + log.quantidade_perdida);
  });
  const perdas_por_setor = Array.from(sectorMap.entries()).map(([sid, v]) => ({ stage_id: sid, stage_name: v.stage_name, quantidade_perdida: v.lost, pct_total: totalLost>0?Math.round(v.lost/totalLost*1000)/10:0, pedidos_afetados: v.orderIds.size })).sort((a,b)=>b.quantidade_perdida-a.quantidade_perdida);
  const perdas_por_motivo = Array.from(reasonMap.values()).map(v => ({ motivo: v.motivo, stage_name: v.stage_name, quantidade_perdida: v.lost, pct_total: totalLost>0?Math.round(v.lost/totalLost*1000)/10:0 })).sort((a,b)=>b.quantidade_perdida-a.quantidade_perdida);
  const owl = orders.filter(o => orderLostMap.has(o.id)); const nwl = orders.filter(o => !orderLostMap.has(o.id) && o.total_time_seconds>0);
  const avg = nwl.length>0?nwl.reduce((s,o)=>s+o.total_time_seconds,0)/nwl.length:0;
  const impacto_pedidos = owl.map(o => { const a=Math.round(o.total_time_seconds/3600*10)/10,b=Math.round(avg/3600*10)/10; return { order_id:o.id, order_number:o.order_number, client_name:o.client_name, quantidade_perdida:orderLostMap.get(o.id)||0, lead_time_com_perda_horas:a, lead_time_medio_sem_perda_horas:b, atraso_adicional_horas:Math.max(0,Math.round((a-b)*10)/10) }; });
  const ttp = orders.reduce((s,o)=>s+(o.quantity||0),0);
  return { summary: { total_perdido:totalLost, pct_perda:ttp>0?Math.round(totalLost/ttp*1000)/10:0, total_pedidos_com_perda:orderLostMap.size, impacto_prazo_horas:impacto_pedidos.length>0?Math.round(impacto_pedidos.reduce((s,i)=>s+i.atraso_adicional_horas,0)/impacto_pedidos.length*10)/10:0 }, perdas_por_setor, perdas_por_motivo, impacto_pedidos };
}

const _lossStageProgressStore = new Map<string, OrderStageProgress>();
let _lossLogsStore: OrderLossLog[] = [];
let _progressLogsStore: any[] = [];
let _lossReasonSettingsStore: LossReasonSetting[] = [];
let _lossStoreInitialized = false;

async function _initLossStore(sb: any) {
  if (_lossStoreInitialized) return;
  _lossStoreInitialized = true;
  try { const { data } = await sb.from('loss_reason_settings').select('*'); if (data?.length) _lossReasonSettingsStore = data; } catch(e) {}
  if (_lossReasonSettingsStore.length === 0) {
    try { const { data } = await sb.from('stages').select('id, name, sort_order'); if (data) _lossReasonSettingsStore = _getDefaultLossReasons(data); }
    catch(e) { _lossReasonSettingsStore = _getDefaultLossReasons([{id:1,name:'Ficha de aprovação',sort_order:1},{id:2,name:'Corte',sort_order:2},{id:12,name:'Separação estoque',sort_order:4},{id:5,name:'DTF',sort_order:7},{id:7,name:'Costura',sort_order:12},{id:8,name:'Conferência',sort_order:13}]); }
  }
  try { const { data } = await sb.from('order_loss_logs').select('*'); if (data) _lossLogsStore = data; } catch(e) {}
  try { const { data } = await sb.from('order_progress_logs').select('*'); if (data) _progressLogsStore = data; } catch(e) {}
  try { const { data } = await sb.from('order_stage_progress').select('*'); if (data) data.forEach((p: any) => _lossStageProgressStore.set(`${p.order_id}_${p.stage_id}`, p)); } catch(e) {}
}
async function getLossReasons(sb: any) { await _initLossStore(sb); return _lossReasonSettingsStore; }
async function updateLossReasons(sb: any, settings: LossReasonSetting[]) { await _initLossStore(sb); _lossReasonSettingsStore = settings; try { await sb.from('loss_reason_settings').upsert(settings); } catch(e) {} return _lossReasonSettingsStore; }
async function getStageProgressForOrder(sb: any, orderId: number, orderData?: any) {
  await _initLossStore(sb);
  let order = orderData || (await sb.from('orders').select('*').eq('id', orderId).single()).data;
  if (!order) return [];
  const requiredStages: number[] = Array.isArray(order.required_stages) ? order.required_stages : [];
  const stagesStatus: any[] = Array.isArray(order.stages_status) ? order.stages_status : [];

  // Buscar progresso atualizado direto do banco para evitar cache local dessincronizado
  try {
    const { data: dbProg } = await sb.from('order_stage_progress').select('*').eq('order_id', orderId);
    if (dbProg) {
      dbProg.forEach((p: any) => {
        _lossStageProgressStore.set(`${p.order_id}_${p.stage_id}`, p);
      });
    }
  } catch (err) {
    console.warn('[API] Falha ao buscar progresso atualizado no getStageProgressForOrder:', err);
  }

  return requiredStages.map(stageId => {
    const key = `${orderId}_${stageId}`;
    let prog = _lossStageProgressStore.get(key);
    if (!prog) {
      const st = stagesStatus.find((s: any) => Number(s.id) === Number(stageId));
      const qty = order.quantity || 0;
      prog = { order_id: orderId, stage_id: stageId, quantidade_pedido: qty, quantidade_boa: st?.finished ? qty : 0, quantidade_perdida: 0, pendencia_reposicao: 0, finished: !!st?.finished };
      _lossStageProgressStore.set(key, prog);
    } else if (order.quantity && prog.quantidade_pedido !== order.quantity) { prog.quantidade_pedido = order.quantity; }
    return prog;
  });
}
function enrichOrdersWithProgressSync(orders: any[]) {
  if (!orders?.length) return;
  for (const order of orders) {
    if (!Array.isArray(order.stages_status)) order.stages_status = [];
    const qty = order.quantity || 0;
    order.stages_status = order.stages_status.map((st: any) => {
      const key = `${order.id}_${Number(st.id)}`;
      let prog = _lossStageProgressStore.get(key);
      if (!prog) { prog = { order_id: order.id, stage_id: Number(st.id), quantidade_pedido: qty, quantidade_boa: st.finished ? qty : 0, quantidade_perdida: 0, pendencia_reposicao: 0, finished: !!st.finished }; _lossStageProgressStore.set(key, prog); }
      else if (qty && prog.quantidade_pedido !== qty) prog.quantidade_pedido = qty;
      return { ...st, finished: prog.finished, quantidade_boa: prog.quantidade_boa, quantidade_perdida: prog.quantidade_perdida, pendencia_reposicao: prog.pendencia_reposicao, quantidade_pedido: qty };
    });
  }
}
async function logProgress(sb: any, orderId: number, stageId: number, userId: number, userName: string, incremento: number) {
  await _initLossStore(sb);
  
  // Buscar progresso atualizado direto do banco para evitar cache local dessincronizado
  try {
    const { data: dbProg } = await sb.from('order_stage_progress').select('*').eq('order_id', orderId).eq('stage_id', stageId).maybeSingle();
    if (dbProg) {
      _lossStageProgressStore.set(`${orderId}_${stageId}`, dbProg);
    }
  } catch (err) {
    console.warn('[API] Falha ao sincronizar progresso no logProgress:', err);
  }

  const key = `${orderId}_${stageId}`;
  let prog = _lossStageProgressStore.get(key) || { order_id: orderId, stage_id: stageId, quantidade_pedido: (await sb.from('orders').select('quantity').eq('id', orderId).single()).data?.quantity || 0, quantidade_boa: 0, quantidade_perdida: 0, pendencia_reposicao: 0, finished: false };
  prog.quantidade_boa = Math.max(0, prog.quantidade_boa + incremento);
  if (prog.pendencia_reposicao > 0) prog.pendencia_reposicao = Math.max(0, prog.pendencia_reposicao - incremento);
  const calcType = (await sb.from('stages').select('calculation_type').eq('id', stageId).single()).data?.calculation_type || 'por_peca';
  if (calcType === 'por_peca') prog.finished = prog.quantidade_boa >= prog.quantidade_pedido;
  _lossStageProgressStore.set(key, prog);
  try { await sb.from('order_stage_progress').upsert(prog); } catch(e) {}
  const logEntry = { order_id: orderId, stage_id: stageId, user_id: userId, user_name: userName, quantidade_boa_incremento: incremento, created_at: new Date().toISOString() };
  _progressLogsStore.push(logEntry);
  try { await sb.from('order_progress_logs').insert(logEntry); } catch(e) {}
  return { success: true, progress: prog, log: logEntry };
}
async function logLoss(sb: any, orderId: number, stageId: number, userId: number, userName: string, qtd: number, motivo: string, det?: string, retId?: number) {
  await _initLossStore(sb);
  
  // Buscar progresso atualizado direto do banco para evitar cache local dessincronizado
  try {
    const { data: dbProg } = await sb.from('order_stage_progress').select('*').eq('order_id', orderId).eq('stage_id', stageId).maybeSingle();
    if (dbProg) {
      _lossStageProgressStore.set(`${orderId}_${stageId}`, dbProg);
    }
  } catch (err) {
    console.warn('[API] Falha ao sincronizar progresso no logLoss:', err);
  }

  const key = `${orderId}_${stageId}`;
  let prog = _lossStageProgressStore.get(key) || { order_id: orderId, stage_id: stageId, quantidade_pedido: (await sb.from('orders').select('quantity').eq('id', orderId).single()).data?.quantity || 0, quantidade_boa: 0, quantidade_perdida: 0, pendencia_reposicao: 0, finished: false };
  prog.quantidade_perdida += qtd; if (prog.quantidade_boa < prog.quantidade_pedido) prog.finished = false;
  _lossStageProgressStore.set(key, prog); try { await sb.from('order_stage_progress').upsert(prog); } catch(e) {}
  const rs = retId || _lossReasonSettingsStore.find(r => r.motivo.toLowerCase() === motivo.toLowerCase())?.etapa_reentrada_id || stageId;
  const sn = (await sb.from('stages').select('name').eq('id', stageId).single()).data?.name || `Etapa #${stageId}`;
  const rn = (await sb.from('stages').select('name').eq('id', rs).single()).data?.name || `Etapa #${rs}`;
  const lossLog: OrderLossLog = { id: _lossLogsStore.length+1, order_id: orderId, stage_id: stageId, stage_name: sn, user_id: userId, user_name: userName, quantidade_perdida: qtd, motivo, motivo_detalhe: det||'', etapa_reentrada_id: rs, etapa_reentrada_name: rn, created_at: new Date().toISOString() };
  _lossLogsStore.push(lossLog); try { await sb.from('order_loss_logs').insert(lossLog); } catch(e) {}
  
  // Buscar progresso da reentrada para evitar dessincronizar
  try {
    const { data: dbProgReentry } = await sb.from('order_stage_progress').select('*').eq('order_id', orderId).eq('stage_id', rs).maybeSingle();
    if (dbProgReentry) {
      _lossStageProgressStore.set(`${orderId}_${rs}`, dbProgReentry);
    }
  } catch (err) {
    console.warn('[API] Falha ao sincronizar progresso de reentrada no logLoss:', err);
  }

  const rk = `${orderId}_${rs}`; let rp = _lossStageProgressStore.get(rk) || { order_id: orderId, stage_id: rs, quantidade_pedido: prog.quantidade_pedido, quantidade_boa: 0, quantidade_perdida: 0, pendencia_reposicao: 0, finished: false };
  rp.pendencia_reposicao += qtd; rp.finished = false; _lossStageProgressStore.set(rk, rp); try { await sb.from('order_stage_progress').upsert(rp); } catch(e) {}
  return { success: true, progress: prog, lossLog, reentradaStageId: rs };
}
async function validateStageFinish(sb: any, orderId: number, stageId: number) {
  await _initLossStore(sb);
  const si = (await sb.from('stages').select('name, calculation_type').eq('id', stageId).single()).data;
  if (si?.calculation_type === 'por_pedido') return { canFinish: true };
  const prog = (await getStageProgressForOrder(sb, orderId)).find((p: any) => p.stage_id === stageId);
  if (!prog || prog.quantidade_boa >= prog.quantidade_pedido) return { canFinish: true };
  const remaining = prog.quantidade_pedido - prog.quantidade_boa;
  return { canFinish: false, remaining, message: `Não é possível finalizar a etapa '${si?.name||stageId}': faltam ${remaining} peças boas para atingir o total de ${prog.quantidade_pedido} peças do pedido.` };
}
async function getLossReportDataStore(sb: any, startDate?: string, endDate?: string) {
  await _initLossStore(sb);
  let logs = [..._lossLogsStore];
  if (startDate) { const ms = new Date(startDate).getTime(); logs = logs.filter(l => new Date(l.created_at).getTime() >= ms); }
  if (endDate) { const ms = new Date(endDate).getTime(); logs = logs.filter(l => new Date(l.created_at).getTime() <= ms); }
  let orders: any[] = []; try { const { data } = await sb.from('orders').select('id, order_number, client_name, total_time_seconds, status, quantity'); if (data) orders = data; } catch(e) {}
  let stages: any[] = []; try { const { data } = await sb.from('stages').select('id, name'); if (data) stages = data; } catch(e) {}
  return _calculateLossReport(logs, orders, stages);
}
async function getProgressLogs(sb: any) { await _initLossStore(sb); return _progressLogsStore; }

// ── Inline: timerUtils ─────────────────────────────────────────────────────
interface PauseRecord { id?: number; execution_id?: number; start_pause: string; end_pause?: string | null; duration_seconds?: number | null; }
interface ExecutionRecord { id?: number; start_time: string; end_time?: string | null; status: 'Em andamento' | 'Pausado' | 'Finalizado'; total_time_seconds?: number; pauses?: PauseRecord[]; }
interface CalculatedTimes { totalAccumulatedSeconds: number; currentSessionSeconds: number; isPaused: boolean; }

function calculateExecutionTimes(execution: ExecutionRecord, pauses: PauseRecord[] = [], nowMs: number = Date.now()): CalculatedTimes {
    if (!execution || !execution.start_time) return { totalAccumulatedSeconds: 0, currentSessionSeconds: 0, isPaused: false };
    const startTimeMs = new Date(execution.start_time).getTime();
    const allPauses = pauses && pauses.length > 0 ? pauses : (execution.pauses || []);
    let completedPauseSeconds = 0; let openPause: PauseRecord | null = null; const completedEndPauseTimes: number[] = [];
    for (const p of allPauses) {
        if (p.duration_seconds !== null && p.duration_seconds !== undefined && p.end_pause) { completedPauseSeconds += Math.max(0, p.duration_seconds); completedEndPauseTimes.push(new Date(p.end_pause).getTime()); }
        else if (p.end_pause === null || p.end_pause === undefined) { openPause = p; }
        else if (p.start_pause && p.end_pause) { const dur = Math.max(0, Math.floor((new Date(p.end_pause).getTime() - new Date(p.start_pause).getTime()) / 1000)); completedPauseSeconds += dur; completedEndPauseTimes.push(new Date(p.end_pause).getTime()); }
    }
    const isPaused = execution.status === 'Pausado' || openPause !== null;
    if (execution.status === 'Finalizado') { let ft = execution.total_time_seconds; if (ft === undefined || ft === null) { const endMs = execution.end_time ? new Date(execution.end_time).getTime() : nowMs; ft = Math.max(0, Math.floor((endMs - startTimeMs) / 1000) - completedPauseSeconds); } return { totalAccumulatedSeconds: Math.max(0, Math.floor(ft)), currentSessionSeconds: 0, isPaused: false }; }
    if (isPaused) { const psMs = openPause && openPause.start_pause ? new Date(openPause.start_pause).getTime() : nowMs; const gross = Math.max(0, Math.floor((psMs - startTimeMs) / 1000)); return { totalAccumulatedSeconds: Math.max(0, gross - completedPauseSeconds), currentSessionSeconds: 0, isPaused: true }; }
    const grossElapsed = Math.max(0, Math.floor((nowMs - startTimeMs) / 1000));
    const totalAccumulatedSeconds = Math.max(0, grossElapsed - completedPauseSeconds);
    let currentSessionStartMs = startTimeMs;
    if (completedEndPauseTimes.length > 0) { const latestEndPauseMs = Math.max(...completedEndPauseTimes); if (latestEndPauseMs > startTimeMs) currentSessionStartMs = latestEndPauseMs; }
    return { totalAccumulatedSeconds, currentSessionSeconds: Math.max(0, Math.floor((nowMs - currentSessionStartMs) / 1000)), isPaused: false };
}

// ── Inline: goalsUtils ─────────────────────────────────────────────────────
interface ExecutionActivity { user_id: number; stage_id: number; end_time: string; quantity: number; }
interface GoalConfig { stage_id: number; user_id?: number | null; meta_diaria: number | null; }
const GOAL_THRESHOLDS = { GREEN: 1.0, YELLOW: 0.7 };

function getGoalStatus(percentage: number | null): 'verde' | 'amarelo' | 'vermelho' | 'sem_meta' {
    if (percentage === null || percentage === undefined || isNaN(percentage)) return 'sem_meta';
    if (percentage >= GOAL_THRESHOLDS.GREEN) return 'verde';
    if (percentage >= GOAL_THRESHOLDS.YELLOW) return 'amarelo';
    return 'vermelho';
}

function calculateWorkedDays(activities: ExecutionActivity[], userId: number, startDateStr: string, endDateStr: string): number {
    const start = new Date(startDateStr); const end = new Date(endDateStr);
    const userActivities = activities.filter(act => { if (act.user_id !== userId) return false; const d = new Date(act.end_time); return d >= start && d <= end; });
    if (userActivities.length === 0) return 1;
    const activeDates = new Set<string>();
    userActivities.forEach(act => { const d = new Date(act.end_time); activeDates.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); });
    return activeDates.size;
}

function resolveGoal(stageGoalDefault: number | null | undefined, collaboratorOverrides: GoalConfig[], userId: number, stageId: number): number | null {
    const override = collaboratorOverrides.find(g => g.user_id === userId && g.stage_id === stageId);
    if (override && override.meta_diaria !== null && override.meta_diaria !== undefined) return override.meta_diaria;
    return stageGoalDefault !== undefined ? stageGoalDefault : null;
}
// ──────────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Enable CORS for all requests
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-role, x-user-name');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Normalize req.url so /api/... routes match whether Vercel preserves or strips /api
app.use((req, _res, next) => {
    if (!req.url.startsWith('/api/') && req.url !== '/api') {
        req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    next();
});

const DEFAULT_SUPABASE_URL = "https://dkyvzxmocppbydtpsgyu.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXZ6eG1vY3BwYnlkdHBzZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzU0NDksImV4cCI6MjA4NzU1MTQ0OX0.2s2RJevOZr2Na0bigWqR5rxt5bNtB6GIS6-N_TlpFgk";

const rawSupabaseUrl = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const supabaseUrl = (rawSupabaseUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "")) || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey
);

const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceRoleKey || supabaseAnonKey
);

// Utilizando memória ao invés de disco local
const storage = multer.memoryStorage();
const upload = multer({ storage });

function checkError(error: any, res: express.Response, msg = "Erro interno") {
    if (error) {
        console.error(`[INTERNAL ERROR] ${msg}:`, error);
        // Avoid exposing raw database errors to the client
        res.status(500).json({ error: msg });
        return true;
    }
    return false;
}

const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = req.headers['x-user-role'];
    if (role !== 'Admin') {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores podem realizar esta ação." });
    }
    next();
};

const isAdminOrComercial = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = req.headers['x-user-role'];
    if (role !== 'Admin' && role !== 'Comercial') {
        return res.status(403).json({ error: "Acesso negado. Ação permitida apenas para Administração ou Comercial." });
    }
    next();
};

// ── Supabase status (health check) ────────────────────────────────────────
app.get("/api/supabase/status", async (_req, res) => {
    const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .limit(1);
    if (error)
        return res.status(500).json({
            status: "error",
            message: error.message,
            hint: "Verifique se a tabela 'users' existe no Supabase.",
        });
    return res.json({ status: "success", message: "Supabase SDK funcionando!", sample_data: data });
});

// ── Dashboard Stats ───────────────────────────────────────────────────────
app.get("/api/dashboard/stats", async (req, res) => {
    const { startDate, endDate, product_type, print_type } = req.query;
    const { data, error } = await supabase.rpc("get_dashboard_stats_v2", {
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_product_type: product_type || null,
        p_print_type: print_type || null,
    });
    if (checkError(error, res, "Erro no dashboard")) return;
    return res.json(data);
});

// ── Production Config & Goals ─────────────────────────────────────────────
app.get("/api/config", async (req, res) => {
    const isAdminUser = req.headers["x-user-role"] === "Admin";
    const { data, error } = await supabase.from("config_producao").select("*").single();
    if (checkError(error, res)) return;
    if (!isAdminUser && data) {
        delete data.meta_custo_por_peca;
    }
    return res.json(data);
});

app.patch("/api/config", isAdmin, async (req, res) => {
    const { jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes, meta_diaria_pedidos, meta_diaria_pecas, meta_custo_por_peca, auto_pause_time_weekday, auto_pause_time_friday, auto_pause_time_lunch } = req.body;
    const updates: any = {};
    if (jornada_horas !== undefined) updates.jornada_horas = jornada_horas;
    if (operadores_ativos !== undefined) updates.operadores_ativos = operadores_ativos;
    if (eficiencia_percentual !== undefined) updates.eficiencia_percentual = eficiencia_percentual;
    if (dias_uteis_mes !== undefined) updates.dias_uteis_mes = dias_uteis_mes;
    if (meta_diaria_pedidos !== undefined) updates.meta_diaria_pedidos = meta_diaria_pedidos;
    if (meta_diaria_pecas !== undefined) updates.meta_diaria_pecas = meta_diaria_pecas;
    if (meta_custo_por_peca !== undefined) updates.meta_custo_por_peca = meta_custo_por_peca;
    if (auto_pause_time_weekday !== undefined) updates.auto_pause_time_weekday = auto_pause_time_weekday;
    if (auto_pause_time_friday !== undefined) updates.auto_pause_time_friday = auto_pause_time_friday;
    if (auto_pause_time_lunch !== undefined) updates.auto_pause_time_lunch = auto_pause_time_lunch;
    const { data, error } = await supabase
        .from("config_producao")
        .update(updates)
        .eq("id", 1)
        .select()
        .single();
    if (checkError(error, res)) return;
    return res.json(data);
});

// ── Reports ───────────────────────────────────────────────────────────────
app.get("/api/reports", async (req, res) => {
    const isAdminUser = req.headers["x-user-role"] === "Admin";
    const { period, user_id, stage_id, startDate, endDate, print_type } = req.query;
    const { data, error } = await supabase.rpc("get_reports", {
        p_period: period || "day",
        p_user_id: user_id ? Number(user_id) : null,
        p_stage_id: stage_id ? Number(stage_id) : null,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_print_type: print_type || null
    });

    if (checkError(error, res, "Erro nos relatórios")) return;

    if (data) {
        // Calcular produção detalhada por etapa dentro do período selecionado (ajustado para timezone)
        const tzOffset = req.query.tzOffset ? Number(req.query.tzOffset) : 180; // padrão 180 (BRT -03:00)

        const getUtcRange = (dateStr: string, isEnd = false) => {
            const parts = dateStr.split('-');
            const y = Number(parts[0]);
            const m = Number(parts[1]) - 1;
            const d = Number(parts[2]);
            const utcDate = new Date(Date.UTC(y, m, d, isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0));
            utcDate.setUTCMinutes(utcDate.getUTCMinutes() + tzOffset);
            return utcDate.toISOString();
        };

        const todayStr = new Date().toISOString().split('T')[0];
        const startIso = getUtcRange((startDate as string) || todayStr, false);
        const endIso = getUtcRange((endDate as string) || todayStr, true);

        try {
            const { data: periodExecutions } = await supabaseAdmin
                .from("stage_executions")
                .select(`
                    id,
                    end_time,
                    stage_id,
                    user_id,
                    stages(name),
                    users(name),
                    orders(order_number, client_name, quantity)
                `)
                .eq("status", "Finalizado")
                .gte("end_time", startIso)
                .lte("end_time", endIso);

            const stageProductionMap = new Map();
            if (periodExecutions) {
                periodExecutions.forEach((ex: any) => {
                    const stageName = ex.stages?.name || `Etapa #${ex.stage_id}`;
                    const orderQty = ex.orders?.quantity || 0;
                    const orderNumber = ex.orders?.order_number || "-";
                    const clientName = ex.orders?.client_name || "-";
                    const operatorName = ex.users?.name || "Operador";

                    if (!stageProductionMap.has(stageName)) {
                        stageProductionMap.set(stageName, {
                            stage_name: stageName,
                            completed_count: 0,
                            total_pieces: 0,
                            details: []
                        });
                    }

                    const stageProd = stageProductionMap.get(stageName);
                    stageProd.completed_count += 1;
                    stageProd.total_pieces += orderQty;
                    stageProd.details.push({
                        order_number: orderNumber,
                        client_name: clientName,
                        quantity: orderQty,
                        operator: operatorName,
                        finished_at: ex.end_time
                    });
                });
            }
            data.production_by_stage = Array.from(stageProductionMap.values());

            // Enriquecer orders_list com as etapas concluídas para cada pedido no período
            if (Array.isArray(data.orders_list) && data.orders_list.length > 0) {
                data.orders_list.forEach((ord: any) => {
                    const orderExecutions = periodExecutions ? periodExecutions.filter((ex: any) => ex.order_id === ord.order_id) : [];
                    if (orderExecutions.length > 0) {
                        ord.stages_worked_in_period = orderExecutions.map((ex: any) => ({
                            stage_name: ex.stages?.name || `Etapa #${ex.stage_id}`,
                            finished_at: ex.end_time,
                            operator: ex.users?.name || "Operador"
                        }));
                    } else {
                        ord.stages_worked_in_period = [];
                    }
                });
            }
        } catch (err) {
            console.error("Erro ao calcular produção por etapa no relatório:", err);
            data.production_by_stage = [];
        }

        if (!isAdminUser) {
            if (data.summary) {
                data.summary.total_labor_cost = 0;
            }
            if (Array.isArray(data.costsByCollaborator)) {
                data.costsByCollaborator = data.costsByCollaborator.map((item: any) => ({
                    ...item,
                    hourly_cost: 0,
                    total_cost: 0,
                    cost_per_piece: 0,
                    totalCost: 0,
                    costPerPiece: 0
                }));
            }
            if (data.costsByOrder) {
                data.costsByOrder = [];
            }
        }
    }

    return res.json(data);
});

// ── Order Templates ───────────────────────────────────────────────────────
app.get("/api/order-templates", async (_req, res) => {
    const { data, error } = await supabase
        .from("order_templates")
        .select("*");
    if (checkError(error, res)) return;
    return res.json(data);
});

app.post("/api/order-templates", isAdmin, async (req, res) => {
    const { name, product_type, print_type, quantity, observations, required_stages } = req.body;
    const { data, error } = await supabase
        .from("order_templates")
        .insert({
            name,
            product_type,
            print_type,
            quantity: Number(quantity) || 0,
            observations,
            required_stages: required_stages || []
        })
        .select()
        .single();
    if (checkError(error, res)) return;
    return res.json(data);
});

app.patch("/api/order-templates/:id", isAdmin, async (req, res) => {
    const { name, product_type, print_type, quantity, observations, required_stages } = req.body;
    const { error } = await supabase
        .from("order_templates")
        .update({
            name,
            product_type,
            print_type,
            quantity: quantity !== undefined ? Number(quantity) : undefined,
            observations,
            required_stages
        })
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

app.delete("/api/order-templates/:id", isAdmin, async (req, res) => {
    const { error } = await supabase
        .from("order_templates")
        .delete()
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// ── Delivery Forecast ─────────────────────────────────────────────────────
app.get("/api/orders/delivery-forecast", async (_req, res) => {
    try {
        // 1. Active orders (not delivered, not cancelled, not deleted)
        const { data: rawOrders, error: ordersErr } = await supabase
            .from("orders")
            .select("id, order_number, client_name, quantity, deadline, status, required_stages, print_type, product_type, created_at")
            .is("deleted_at", null)
            .not("status", "in", '("Entregue","Cancelado")')
            .order("deadline", { ascending: true });

        if (ordersErr) throw ordersErr;
        if (!rawOrders || rawOrders.length === 0) return res.json([]);

        // 2. All stages sorted
        const { data: allStages, error: stagesErr } = await supabase
            .from("stages")
            .select("id, name, sort_order, ideal_time, real_average_time, execution_count, calculation_type")
            .eq("active", 1)
            .order("sort_order", { ascending: true });

        if (stagesErr) throw stagesErr;

        // 3. Capacity config
        const { data: configRows } = await supabase
            .from("config_producao")
            .select("jornada_horas, operadores_ativos, eficiencia_percentual")
            .limit(1);

        const config = configRows?.[0] || { jornada_horas: 8, operadores_ativos: 2, eficiencia_percentual: 0.85 };
        // Minutes available per day per sector (shared pool)
        const dailyCapacityMinutes = config.jornada_horas * 60 * config.operadores_ativos * config.eficiencia_percentual;

        // 4. Build lookup: stageId → baseTimeSeconds (Ideal vs Real)
        const timeByStage: Record<number, number> = {};

        const stageDefaults: Record<string, number> = {
            "Ficha de aprovação": 1.5 * 60,
            "Separação / Corte": 2 * 60,
            "Revelação de Tela": 2 * 60,
            "Silk": 5 * 60,
            "DTF": 4 * 60,
            "Sublimação": 3 * 60,
            "Costura": 2.5 * 60,
            "Conferência": 1 * 60,
            "Embalagem": 0.5 * 60,
        };

        for (const stage of (allStages || [])) {
            let baseSecs = 0;
            const executionCount = stage.execution_count || 0;
            
            // Regra: se < 10 registros, usa tempo ideal. Se >= 10, usa tempo medio real.
            if (executionCount >= 10 && stage.real_average_time > 0) {
                baseSecs = stage.real_average_time;
            } else if (stage.ideal_time > 0) {
                baseSecs = stage.ideal_time;
            } else {
                baseSecs = stageDefaults[stage.name] ?? 2 * 60;
            }
            // Multiplicador default? Não, agora tempo_base equivale ao tempo total da etapa
            timeByStage[stage.id] = baseSecs;
            (timeByStage as any)[`${stage.id}_type`] = stage.calculation_type || 'por_peca';
        }

        // 5. Simulate queue — orders already sorted by deadline (most urgent first)
        // sectorAvailableAt: when can a sector next accept work (in ms)
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const sectorAvailableAt: Record<number, number> = {};
        for (const stage of (allStages || [])) {
            sectorAvailableAt[stage.id] = now.getTime();
        }

        const helper = {
            addWorkingDays: (startMs: number, days: number): number => {
                // Simple approximation: 5/7 of days are working days
                // Use calendar days = workingDays / (5/7) = workingDays * 1.4
                const calendarMs = days * 1.4 * 24 * 60 * 60 * 1000;
                return startMs + calendarMs;
            }
        };

        const forecasts: any[] = [];

        for (const order of (rawOrders || [])) {
            // Determine which stages this order needs
            let orderStageIds: number[] = [];
            if (order.required_stages && order.required_stages.length > 0) {
                orderStageIds = order.required_stages;
            } else {
                orderStageIds = (allStages || []).map((s: any) => s.id);
            }

            // Sort by sort_order
            const orderStages = (allStages || [])
                .filter((s: any) => orderStageIds.includes(s.id))
                .sort((a: any, b: any) => a.sort_order - b.sort_order);

            let prevStageEndMs = now.getTime();
            const stageForecastDetails: any[] = [];
            let bottleneckStage: string | null = null;
            let maxQueueDays = -1;

            for (const stage of orderStages) {
                const calcType = (timeByStage as any)[`${stage.id}_type`];
                let baseSecs = (timeByStage[stage.id] ?? 2 * 60);
                
                if (calcType === 'por_peca') {
                    baseSecs *= (order.quantity || 1);
                } else if (calcType === 'por_lote') {
                    baseSecs *= Math.ceil((order.quantity || 1) / 10);
                }
                
                const totalMinutes = baseSecs / 60;
                const execDays = totalMinutes / dailyCapacityMinutes; // working days

                const sectorAvail = sectorAvailableAt[stage.id] ?? now.getTime();
                const startMs = Math.max(prevStageEndMs, sectorAvail);

                const queueDays = Math.max(0, (sectorAvail - now.getTime()) / (24 * 60 * 60 * 1000) / 1.4);
                const endMs = helper.addWorkingDays(startMs, execDays);

                // Update sector availability
                sectorAvailableAt[stage.id] = endMs;
                prevStageEndMs = endMs;

                stageForecastDetails.push({
                    stageId: stage.id,
                    stageName: stage.name,
                    startDate: new Date(startMs).toISOString().split("T")[0],
                    endDate: new Date(endMs).toISOString().split("T")[0],
                    queueDays: Math.round(queueDays * 10) / 10,
                    execDays: Math.round(execDays * 10) / 10,
                });

                const totalDelay = queueDays + execDays;
                if (totalDelay > maxQueueDays) {
                    maxQueueDays = totalDelay;
                    bottleneckStage = stage.name;
                }
            }

            const predictedDate = new Date(prevStageEndMs);
            const deadline = new Date(order.deadline);
            deadline.setHours(23, 59, 59, 0);

            const deadlineDaysFromNow = Math.max(1, (deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            const predictedDaysFromNow = Math.max(0, (predictedDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

            const riskIndex = predictedDaysFromNow / deadlineDaysFromNow;
            const riskLevel = riskIndex <= 0.8 ? "safe" : riskIndex <= 1.0 ? "warning" : "danger";

            forecasts.push({
                orderId: order.id,
                orderNumber: order.order_number,
                clientName: order.client_name,
                quantity: order.quantity,
                printType: order.print_type,
                productType: order.product_type,
                deadline: order.deadline,
                predictedDate: predictedDate.toISOString().split("T")[0],
                riskIndex: Math.round(riskIndex * 100) / 100,
                riskLevel,
                bottleneckStage,
                stageForecasts: stageForecastDetails,
            });
        }

        // Sort by risk descending (highest risk first)
        forecasts.sort((a, b) => b.riskIndex - a.riskIndex);
        return res.json(forecasts);

    } catch (err: any) {
        console.error("[Forecast] Error:", err);
        return res.status(500).json({ error: "Erro no cálculo de previsão" });
    }
});


// ── Orders ────────────────────────────────────────────────────────────────
app.get("/api/orders", async (req, res) => {
    const { search, stage_id, stage_status, product_type, print_type } = req.query;
    const { data, error } = await supabase.rpc("get_orders_with_stages", {
        p_search: search || null,
        p_stage_id: stage_id ? Number(stage_id) : null,
        p_stage_status: stage_status || null,
        p_product_type: product_type || null,
        p_print_type: print_type || null,
    });
    if (checkError(error, res, "Erro ao buscar pedidos")) return;

    if (data && data.length > 0) {
        const orderIds = data.map((o: any) => o.id);
        const { data: executions } = await supabaseAdmin
            .from("stage_executions")
            .select("order_id, status, stage_id, end_time, users(name)")
            .in("order_id", orderIds);

        const operatorMap = new Map();
        const activeStageExecutionMap = new Map();
        const latestFinishedStageMap = new Map();
        if (executions) {
            executions.forEach((ex: any) => {
                if (ex.status === "Em andamento") {
                    operatorMap.set(ex.order_id, ex.users?.name || null);
                }
                if (ex.status === "Em andamento" || ex.status === "Pausado") {
                    const existing = activeStageExecutionMap.get(ex.order_id);
                    if (!existing || existing.status === "Pausado") {
                        activeStageExecutionMap.set(ex.order_id, {
                            status: ex.status,
                            stage_id: ex.stage_id,
                            operator: ex.users?.name || null
                        });
                    }
                } else if (ex.status === "Finalizado" && ex.end_time) {
                    const existing = latestFinishedStageMap.get(ex.order_id);
                    if (!existing || new Date(ex.end_time) > new Date(existing.end_time)) {
                        latestFinishedStageMap.set(ex.order_id, {
                            stage_id: ex.stage_id,
                            end_time: ex.end_time,
                            operator: ex.users?.name || null
                        });
                    }
                }
            });
        }

        const { data: dbProgress } = await supabaseAdmin
            .from("order_stage_progress")
            .select("*")
            .in("order_id", orderIds);

        if (dbProgress) {
            dbProgress.forEach((p: any) => {
                _lossStageProgressStore.set(`${p.order_id}_${p.stage_id}`, p);
            });
        }

        enrichOrdersWithProgressSync(data);

        // Fetch stage_observations for these orders to find the most recent observation of the active stage
        let observationsMap = new Map();
        try {
            const { data: obsData } = await supabaseAdmin
                .from("stage_observations")
                .select("order_id, stage_id, observation, created_at")
                .in("order_id", orderIds)
                .order("created_at", { ascending: false });

            if (obsData) {
                obsData.forEach((obs: any) => {
                    const key = `${obs.order_id}_${obs.stage_id}`;
                    if (!observationsMap.has(key)) {
                        observationsMap.set(key, {
                            observation: obs.observation,
                            created_at: obs.created_at
                        });
                    }
                });
            }
        } catch (err) {
            console.warn("[API] Failed to fetch stage_observations for orders list:", err);
        }

        for (const order of data) {
            order.current_operator = operatorMap.get(order.id) || null;
            order.active_stage_execution = activeStageExecutionMap.get(order.id) || null;
            
            // Enrich with active stage name and active stage observation
            const activeStage = (order.stages_status || []).find((s: any) => !s.finished);
            order.active_stage_name = activeStage?.name || null;
            order.active_stage_observation = null;
            
            const unfinishedStages = (order.stages_status || []).filter((s: any) => !s.finished);
            let newestObs = null;
            for (const st of unfinishedStages) {
                const obsKey = `${order.id}_${st.id}`;
                const obsObj = observationsMap.get(obsKey);
                if (obsObj) {
                    const obsTime = new Date(obsObj.created_at).getTime();
                    if (!newestObs || obsTime > newestObs.time) {
                        newestObs = {
                            text: obsObj.observation,
                            time: obsTime
                        };
                    }
                }
            }
            order.active_stage_observation = newestObs ? newestObs.text : null;

            // Enrich with latest finished stage
            const latestFinished = latestFinishedStageMap.get(order.id);
            order.latest_finished_stage = null;
            if (latestFinished) {
                const stageObj = (order.stages_status || []).find((s: any) => s.id === latestFinished.stage_id);
                order.latest_finished_stage = {
                    stage_id: latestFinished.stage_id,
                    stage_name: stageObj?.name || `Etapa #${latestFinished.stage_id}`,
                    end_time: latestFinished.end_time,
                    operator: latestFinished.operator
                };
            }
        }
    }

    return res.json(data);
});

app.get("/api/orders/:id/stage-observations", async (req, res) => {
    const orderId = Number(req.params.id);
    const { data, error } = await supabaseAdmin
        .from("stage_observations")
        .select("*, users(name)")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
    
    if (error) {
        console.warn(`[API] stage_observations query failed:`, error.message);
        return res.json([]);
    }
    
    const enriched = (data || []).map((o: any) => ({
        ...o,
        user_name: o.users?.name || 'Operador'
    }));
    
    return res.json(enriched);
});

app.post("/api/orders", upload.array("art_files", 10), async (req, res) => {
    const { client_name, product_type, print_type, quantity, deadline, observations, required_stages, num_colors } = req.body;
    const order_number = `PED-${Date.now().toString().slice(-6)}`;
    const art_urls: string[] = [];

    const files = (req as any).files;
    const uploadErrors: string[] = [];
    console.log(`[API] Criando pedido. Arquivos recebidos: ${files?.length || 0}`);
    if (files && Array.isArray(files)) {
        for (const file of files) {
            const fileExt = file.originalname.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `pedidos/${fileName}`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from('artes')
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true
                });

            if (uploadError) {
                console.error(`[API] Erro no upload da arte (${file.originalname}):`, uploadError);
                uploadErrors.push(`${file.originalname}: ${uploadError.message}`);
                continue;
            }

            const { data: publicUrlData } = supabaseAdmin.storage.from('artes').getPublicUrl(filePath);
            art_urls.push(publicUrlData.publicUrl);
        }
    }

    if (uploadErrors.length > 0) {
        return res.status(400).json({ 
            error: "Falha no upload de alguns arquivos", 
            details: uploadErrors 
        });
    }

    // 2. Estimate time
    const { data: estimateData } = await supabase
        .from("orders")
        .select("total_time_seconds")
        .eq("product_type", product_type)
        .eq("print_type", print_type)
        .eq("num_colors", Number(num_colors) || 1)
        .eq("status", "Entregue");

    const totalSeconds = estimateData?.reduce(
        (sum: number, r: any) => sum + (r.total_time_seconds || 0), 0
    ) ?? 0;
    const estimated_time = estimateData && estimateData.length > 0
        ? Math.round(totalSeconds / estimateData.length)
        : 3600;

    // 3. Create order
    const { data, error } = await supabase
        .from("orders")
        .insert({
            order_number,
            client_name: client_name || "Cliente Avulso",
            product_type,
            print_type,
            num_colors: Number(num_colors) || 1,
            quantity: Number(quantity),
            deadline,
            observations,
            estimated_time_seconds: estimated_time,
            art_url: art_urls[0] || null, // Primary image
            art_urls: art_urls, // All images
            required_stages: required_stages ? (typeof required_stages === 'string' ? JSON.parse(required_stages) : required_stages) : [],
        })
        .select("id")
        .single();

    if (checkError(error, res, "Erro ao criar pedido")) return;
    console.log(`[API] Pedido criado: ${order_number}. Imagens: ${art_urls.length}`);
    return res.json({ id: data.id, order_number, art_url: art_urls[0] || null, art_urls });
});

// Soft delete — mantém histórico de execuções intacto
app.delete("/api/orders/:id", isAdmin, async (req, res) => {
    const { id } = req.params;
    const usuario = (req.headers["x-user-name"] as string) || "Admin";

    // 1. Fetch current order before soft-deleting
    const { data: order, error: fetchErr } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", Number(id))
        .single();

    if (fetchErr || !order) return res.status(404).json({ error: "Pedido não encontrado" });
    if (order.deleted_at) return res.status(400).json({ error: "Pedido já foi excluído" });

    // 2. Soft delete — only update deleted_at and deleted_by
    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
        .from("orders")
        .update({ deleted_at: now, deleted_by: usuario })
        .eq("id", Number(id));

    if (checkError(updateErr, res, "Erro ao excluir pedido")) return;

    // 3. Log to order_history
    await supabaseAdmin.from("order_history").insert({
        order_id: Number(id),
        usuario,
        acao: "excluiu",
        antes: order,
        depois: null,
    });

    console.log(`[API] Pedido ${id} marcado como excluído (soft delete) por ${usuario}`);
    return res.json({ success: true });
});

app.post("/api/orders/:id/images", upload.array("art_files", 10), async (req, res) => {
    const { id } = req.params;
    const files = (req as any).files;

    if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    // 1. Get current order images
    const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("art_urls, art_url")
        .eq("id", Number(id))
        .single();

    if (fetchError || !order) {
        return res.status(404).json({ error: "Pedido não encontrado" });
    }

    const current_urls = order.art_urls || [];
    const new_urls: string[] = [];

    // 2. Upload new files
    const uploadErrors: string[] = [];
    for (const file of files) {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `pedidos/${fileName}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('artes')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (uploadError) {
            console.error(`[API] Erro no upload da arte (${file.originalname}):`, uploadError);
            uploadErrors.push(`${file.originalname}: ${uploadError.message}`);
            continue;
        }

        const { data: publicUrlData } = supabaseAdmin.storage.from('artes').getPublicUrl(filePath);
        new_urls.push(publicUrlData.publicUrl);
    }

    if (uploadErrors.length > 0) {
        return res.status(400).json({ 
            error: "Falha no upload de alguns arquivos", 
            details: uploadErrors 
        });
    }

    const updated_urls = [...current_urls, ...new_urls];

    // 3. Update order
    const { error: updateError } = await supabase
        .from("orders")
        .update({
            art_urls: updated_urls,
            art_url: order.art_url || updated_urls[0] // Set primary if missing
        })
        .eq("id", Number(id));

    if (checkError(updateError, res, "Erro ao atualizar imagens do pedido")) return;

    return res.json({ success: true, art_urls: updated_urls });
});

app.patch("/api/orders/:id/status", async (req, res) => {
    const { status } = req.body;
    const updates: any = { status };
    if (status === 'Entregue') {
        updates.delivered_at = new Date().toISOString();
    } else {
        updates.delivered_at = null;
    }
    const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// Full order edit with validation and audit log
app.patch("/api/orders/:id", isAdminOrComercial, async (req, res) => {
    const orderId = Number(req.params.id);
    const usuario = (req.headers["x-user-name"] as string) || "Admin";
    const confirmFinalized = req.headers["x-confirm-finalized"] === "true";

    const { client_name, product_type, print_type, quantity, deadline, observations, required_stages, num_colors, art_urls, art_url } = req.body;

    // ── Validations ──────────────────────────────────────────────────────────
    if (quantity !== undefined && Number(quantity) <= 0) {
        return res.status(400).json({ error: "Quantidade deve ser maior que zero" });
    }
    if (num_colors !== undefined && Number(num_colors) < 1) {
        return res.status(400).json({ error: "Número de cores deve ser pelo menos 1" });
    }

    // 1. Fetch current order for audit log + finalized check
    const { data: currentOrder, error: fetchErr } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

    if (fetchErr || !currentOrder) return res.status(404).json({ error: "Pedido não encontrado" });
    if (currentOrder.deleted_at) return res.status(400).json({ error: "Não é possível editar um pedido excluído" });
    if (currentOrder.status === "Entregue" && !confirmFinalized) {
        return res.status(409).json({ error: "CONFIRM_FINALIZED", message: "Este pedido já foi entregue. Deseja mesmo editá-lo?" });
    }

    // 2. Build update payload with only provided fields
    const updates: any = {};
    if (client_name !== undefined) updates.client_name = client_name;
    if (product_type !== undefined) updates.product_type = product_type;
    if (print_type !== undefined) updates.print_type = print_type;
    if (quantity !== undefined) updates.quantity = Number(quantity);
    if (deadline !== undefined) updates.deadline = deadline || null;
    if (observations !== undefined) updates.observations = observations;
    if (required_stages !== undefined) updates.required_stages = required_stages;
    if (num_colors !== undefined) updates.num_colors = Number(num_colors);
    if (art_urls !== undefined) updates.art_urls = art_urls;
    if (art_url !== undefined) updates.art_url = art_url;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    // 3. Perform update
    const { error: updateErr } = await supabaseAdmin
        .from("orders")
        .update(updates)
        .eq("id", orderId);

    if (checkError(updateErr, res, "Erro ao atualizar pedido")) return;

    // 4. Log to order_history
    await supabaseAdmin.from("order_history").insert({
        order_id: orderId,
        usuario,
        acao: "editou",
        antes: currentOrder,
        depois: { ...currentOrder, ...updates },
    });

    return res.json({ success: true });
});

// Cancel order — keeps history, removes from capacity calculations
app.patch("/api/orders/:id/cancel", isAdminOrComercial, async (req, res) => {
    const orderId = Number(req.params.id);
    const usuario = (req.headers["x-user-name"] as string) || "Admin";

    const { data: currentOrder, error: fetchErr } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

    if (fetchErr || !currentOrder) return res.status(404).json({ error: "Pedido não encontrado" });
    if (currentOrder.deleted_at) return res.status(400).json({ error: "Pedido excluído não pode ser cancelado" });
    if (currentOrder.status === "Cancelado") return res.status(400).json({ error: "Pedido já está cancelado" });

    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
        .from("orders")
        .update({ status: "Cancelado", cancelled_at: now, cancelled_by: usuario })
        .eq("id", orderId);

    if (checkError(updateErr, res, "Erro ao cancelar pedido")) return;

    await supabaseAdmin.from("order_history").insert({
        order_id: orderId,
        usuario,
        acao: "cancelou",
        antes: currentOrder,
        depois: { ...currentOrder, status: "Cancelado", cancelled_at: now, cancelled_by: usuario },
    });

    return res.json({ success: true });
});

// Order history / audit log
app.get("/api/orders/:id/history", isAdminOrComercial, async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("order_history")
        .select("*")
        .eq("order_id", Number(req.params.id))
        .order("created_at", { ascending: false });
    if (checkError(error, res, "Erro ao buscar histórico")) return;
    return res.json(data || []);
});

// ── Stages ────────────────────────────────────────────────────────────────
app.get("/api/stages", async (_req, res) => {
    const { data, error } = await supabase
        .from("stages")
        .select("*")
        .eq("active", 1)
        .order("sort_order");
    if (checkError(error, res)) return;
    return res.json(data);
});

app.post("/api/stages", async (req, res) => {
    const { name, average_time_seconds, ideal_time, calculation_type, meta_diaria } = req.body;
    const { data: maxData } = await supabase
        .from("stages")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();
    const sort_order = (maxData?.sort_order || 0) + 1;

    const { data, error } = await supabase
        .from("stages")
        .insert({ 
            name, 
            sort_order, 
            average_time_seconds: Number(average_time_seconds) || 0,
            ideal_time: Number(ideal_time) || Number(average_time_seconds) || 0,
            calculation_type: calculation_type || 'por_peca',
            meta_diaria: meta_diaria !== undefined && meta_diaria !== null ? Number(meta_diaria) : null
        })
        .select()
        .single();
    if (checkError(error, res)) return;
    return res.json(data);
});

app.patch("/api/stages/:id", async (req, res) => {
    const { name, active, sort_order, average_time_seconds, ideal_time, calculation_type, meta_diaria } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (active !== undefined) updates.active = active;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (average_time_seconds !== undefined) updates.average_time_seconds = Number(average_time_seconds);
    if (ideal_time !== undefined) updates.ideal_time = Number(ideal_time);
    if (calculation_type !== undefined) updates.calculation_type = calculation_type;
    if (meta_diaria !== undefined) updates.meta_diaria = meta_diaria !== null ? Number(meta_diaria) : null;

    const { error } = await supabase
        .from("stages")
        .update(updates)
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

app.delete("/api/stages/:id", async (req, res) => {
    const { error } = await supabase
        .from("stages")
        .update({ active: 0 })
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// ── Loss Reasons & Re-entry Configuration ──────────────────────────────────
app.get("/api/loss-reasons", async (_req, res) => {
    try {
        const reasons = await getLossReasons(supabase);
        return res.json(reasons);
    } catch (err: any) {
        console.error("[API] Erro ao buscar motivos de perda:", err);
        return res.status(500).json({ error: "Erro ao buscar motivos de perda" });
    }
});

app.patch("/api/loss-reasons", isAdmin, async (req, res) => {
    try {
        const { reasons } = req.body;
        if (!Array.isArray(reasons)) {
            return res.status(400).json({ error: "Parâmetro 'reasons' deve ser um array." });
        }
        const updated = await updateLossReasons(supabase, reasons);
        return res.json({ success: true, reasons: updated });
    } catch (err: any) {
        console.error("[API] Erro ao atualizar motivos de perda:", err);
        return res.status(500).json({ error: "Erro ao atualizar motivos de perda" });
    }
});

// ── Partial Progress & Loss Logging ────────────────────────────────────────
app.get("/api/orders/:id/stage-progress", async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const progressList = await getStageProgressForOrder(supabaseAdmin, orderId);
        return res.json(progressList);
    } catch (err: any) {
        console.error("[API] Erro ao buscar progresso do pedido:", err);
        return res.status(500).json({ error: "Erro ao buscar progresso do pedido" });
    }
});

app.post("/api/orders/:id/stages/:stageId/progress", async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const stageId = Number(req.params.stageId);
        const { incremento, user_id, user_name } = req.body;

        if (!incremento || Number(incremento) <= 0) {
            return res.status(400).json({ error: "Quantidade incremental deve ser maior que 0." });
        }

        const result = await logProgress(
            supabaseAdmin,
            orderId,
            stageId,
            Number(user_id) || 1,
            user_name || "Operador",
            Number(incremento)
        );
        return res.json(result);
    } catch (err: any) {
        console.error("[API] Erro ao registrar progresso parcial:", err);
        return res.status(500).json({ error: "Erro ao registrar progresso parcial" });
    }
});

app.post("/api/orders/:id/stages/:stageId/loss", async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const stageId = Number(req.params.stageId);
        const { quantidade_perdida, motivo, motivo_detalhe, etapa_reentrada_id, user_id, user_name } = req.body;

        if (!quantidade_perdida || Number(quantidade_perdida) <= 0) {
            return res.status(400).json({ error: "Quantidade perdida deve ser maior que 0." });
        }
        if (!motivo) {
            return res.status(400).json({ error: "Motivo da perda é obrigatório." });
        }
        if (motivo === "Outro" && (!motivo_detalhe || !motivo_detalhe.trim())) {
            return res.status(400).json({ error: "Campo livre obrigatório para o motivo 'Outro'." });
        }

        const result = await logLoss(
            supabaseAdmin,
            orderId,
            stageId,
            Number(user_id) || 1,
            user_name || "Operador",
            Number(quantidade_perdida),
            motivo,
            motivo_detalhe,
            etapa_reentrada_id ? Number(etapa_reentrada_id) : undefined
        );

        return res.json(result);
    } catch (err: any) {
        console.error("[API] Erro ao registrar perda:", err);
        return res.status(500).json({ error: "Erro ao registrar perda" });
    }
});

// ── Loss & Rework Bottleneck Report ────────────────────────────────────────
app.get("/api/reports/losses", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await getLossReportDataStore(supabase, startDate as string, endDate as string);
        return res.json(data);
    } catch (err: any) {
        console.error("[API] Erro ao gerar relatório de perdas:", err);
        return res.status(500).json({ error: "Erro ao gerar relatório de perdas" });
    }
});

// ── Collaborator Stage Goals Overrides ─────────────────────────────────────
app.get("/api/collaborator-goals", async (_req, res) => {
    const { data, error } = await supabase
        .from("collaborator_stage_goals")
        .select("*, users(name), stages(name)");
    if (checkError(error, res)) return;
    const formatted = (data || []).map((item: any) => ({
        ...item,
        user_name: item.users?.name,
        stage_name: item.stages?.name
    }));
    return res.json(formatted);
});

app.post("/api/collaborator-goals", async (req, res) => {
    const { user_id, stage_id, meta_diaria } = req.body;
    const { data, error } = await supabase
        .from("collaborator_stage_goals")
        .upsert({
            user_id: Number(user_id),
            stage_id: Number(stage_id),
            meta_diaria: Number(meta_diaria),
            updated_at: new Date().toISOString()
        }, { onConflict: "user_id,stage_id" })
        .select()
        .single();
    if (checkError(error, res)) return;
    return res.json(data);
});

app.delete("/api/collaborator-goals/:id", async (req, res) => {
    const { error } = await supabase
        .from("collaborator_stage_goals")
        .delete()
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});
app.get("/api/executions/monitor", isAdmin, async (req, res) => {
    try {
        const { data: executions, error } = await supabaseAdmin
            .from("stage_executions")
            .select(`
                id,
                order_id,
                stage_id,
                user_id,
                start_time,
                status,
                pauses (
                    duration_seconds,
                    start_pause,
                    end_pause
                ),
                users ( name ),
                stages ( name, average_time_seconds, ideal_time, real_average_time, execution_count, calculation_type ),
                orders ( order_number, client_name, product_type, quantity )
            `)
            .eq("status", "Em andamento");

        if (error) throw error;

        const now = new Date().getTime();

        const monitorData = (executions || []).map((exec: any) => {
            const itemPauses = exec.pauses || [];
            const { totalAccumulatedSeconds, currentSessionSeconds, isPaused } = calculateExecutionTimes(exec, itemPauses, now);

            return {
                id: exec.id,
                order_id: exec.order_id,
                stage_id: exec.stage_id,
                user_id: exec.user_id,
                start_time: exec.start_time,
                status: exec.status,
                is_paused: isPaused,
                total_time_seconds: totalAccumulatedSeconds,
                current_session_seconds: currentSessionSeconds,
                user_name: exec.users?.name,
                stage_name: exec.stages?.name,
                average_time_seconds: exec.stages?.average_time_seconds,
                ideal_time: exec.stages?.ideal_time,
                real_average_time: exec.stages?.real_average_time,
                execution_count: exec.stages?.execution_count,
                calculation_type: exec.stages?.calculation_type,
                order_number: exec.orders?.order_number,
                client_name: exec.orders?.client_name,
                product_type: exec.orders?.product_type,
                quantity: exec.orders?.quantity
            };
        });

        monitorData.sort((a, b) => b.total_time_seconds - a.total_time_seconds);

        return res.json(monitorData);
    } catch (err: any) {
        console.error("[Monitor] Error:", err);
        return res.status(500).json({ error: "Erro ao carregar monitoramento em tempo real" });
    }
});

app.get("/api/executions/active/:userId", async (req, res) => {
    const { data: executions, error } = await supabase
        .from("stage_executions")
        .select(`
            *,
            stages ( name ),
            orders ( order_number )
        `)
        .eq("user_id", Number(req.params.userId))
        .eq("status", "Em andamento")
        .order("start_time", { ascending: false });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    if (!executions || executions.length === 0) return res.json([]);

    // Fetch all pauses for these executions to calculate accumulated time
    const executionIds = executions.map(e => e.id);
    const { data: pauses } = await supabase
        .from("pauses")
        .select("*")
        .in("execution_id", executionIds);

    const nowMs = new Date().getTime();
    const formatted = executions.map((e: any) => {
        const itemPauses = (pauses || []).filter(p => p.execution_id === e.id);
        const { totalAccumulatedSeconds, currentSessionSeconds, isPaused } = calculateExecutionTimes(e, itemPauses, nowMs);

        return {
            ...e,
            stage_name: e.stages?.name,
            order_number: e.orders?.order_number,
            accumulated_pause_seconds: itemPauses.reduce((sum, p) => sum + (p.duration_seconds || 0), 0),
            total_time_seconds: totalAccumulatedSeconds,
            current_session_seconds: currentSessionSeconds,
            is_paused: isPaused,
            stages: undefined,
            orders: undefined,
        };
    });
    return res.json(formatted);
});

// ── Executions ────────────────────────────────────────────────────────────
app.get("/api/orders/:id/executions", async (req, res) => {
    const { data, error } = await supabase
        .from("stage_executions")
        .select(`
          *,
          stages ( name ),
          users ( name )
        `)
        .eq("order_id", Number(req.params.id));
    if (checkError(error, res)) return;

    // Fetch all pauses for these executions to calculate accumulated time
    const executionIds = (data || []).map(e => e.id);
    const { data: pauses } = executionIds.length > 0
        ? await supabase.from("pauses").select("*").in("execution_id", executionIds)
        : { data: [] };

    const nowMs = new Date().getTime();
    const formatted = (data || []).map((e: any) => {
        const itemPauses = (pauses || []).filter(p => p.execution_id === e.id);
        const { totalAccumulatedSeconds, currentSessionSeconds, isPaused } = calculateExecutionTimes(e, itemPauses, nowMs);

        return {
            ...e,
            stage_name: e.stages?.name,
            user_name: e.users?.name,
            accumulated_pause_seconds: itemPauses.reduce((sum, p) => sum + (p.duration_seconds || 0), 0),
            total_time_seconds: totalAccumulatedSeconds,
            current_session_seconds: currentSessionSeconds,
            is_paused: isPaused,
            stages: undefined,
            users: undefined,
        };
    });
    return res.json(formatted);
});

app.get("/api/executions/monitor", isAdmin, async (req, res) => {
    const { data, error } = await supabase
        .from("stage_executions")
        .select(`
          *,
          stages ( name, average_time_seconds, ideal_time, real_average_time, execution_count, calculation_type ),
          users ( name ),
          orders ( order_number, client_name, product_type, quantity )
        `)
        .eq("status", "Em andamento");

    if (checkError(error, res, "Erro ao buscar monitor de tarefas")) return;

    const executionIds = (data || []).map(e => e.id);
    const { data: pauses } = executionIds.length > 0
        ? await supabase.from("pauses").select("*").in("execution_id", executionIds)
        : { data: [] };

    const nowMs = new Date().getTime();
    const formatted = (data || []).map((e: any) => {
        const itemPauses = (pauses || []).filter(p => p.execution_id === e.id);
        const { totalAccumulatedSeconds, currentSessionSeconds, isPaused } = calculateExecutionTimes(e, itemPauses, nowMs);

        return {
            ...e,
            stage_name: e.stages?.name,
            user_name: e.users?.name,
            order_number: e.orders?.order_number,
            client_name: e.orders?.client_name,
            product_type: e.orders?.product_type,
            average_time_seconds: e.stages?.average_time_seconds || 0,
            ideal_time: e.stages?.ideal_time || 0,
            real_average_time: e.stages?.real_average_time || 0,
            execution_count: e.stages?.execution_count || 0,
            calculation_type: e.stages?.calculation_type || 'por_peca',
            quantity: e.orders?.quantity || 1,
            accumulated_pause_seconds: itemPauses.reduce((sum, p) => sum + (p.duration_seconds || 0), 0),
            total_time_seconds: totalAccumulatedSeconds,
            current_session_seconds: currentSessionSeconds,
            is_paused: isPaused,
            stages: undefined,
            users: undefined,
            orders: undefined
        };
    });
    return res.json(formatted);
});

app.post("/api/executions/start", async (req, res) => {
    const { order_id, stage_id, user_id } = req.body;

    // Use supabaseAdmin to bypass RLS for internal logic
    const { data: existing, error: e1 } = await supabaseAdmin
        .from("stage_executions")
        .select("id")
        .eq("order_id", Number(order_id))
        .eq("stage_id", Number(stage_id))
        .eq("status", "Em andamento")
        .limit(1);

    if (e1) {
        return checkError(e1, res, "Erro ao verificar execuções existentes");
    }

    if (existing && existing.length > 0) {
        return res.status(400).json({ error: "Esta etapa já está sendo executada para este pedido." });
    }

    if (Number(user_id) === 0) {
        return res.status(400).json({ error: "Usuário não identificado. Por favor, saia e entre novamente." });
    }

    // No auto-pause anymore as per user requested multiple tasks support
    const { data, error } = await supabaseAdmin
        .from("stage_executions")
        .insert({
            order_id: Number(order_id),
            stage_id: Number(stage_id),
            user_id: Number(user_id),
            status: "Em andamento",
        })
        .select("id")
        .maybeSingle();

    if (error) {
        console.error("[API] Erro ao iniciar execução:", error);
        return res.status(500).json({ error: `Erro ao iniciar execução: ${error.message}` });
    }

    if (!data) {
        return res.status(500).json({ error: "Erro ao recuperar ID da nova execução." });
    }

    // --- AUTOMAÇÃO CORTE VS SEPARAÇÃO ESTOQUE ---
    try {
        // Obter nome da etapa sendo iniciada
        const { data: stageData } = await supabaseAdmin
            .from("stages")
            .select("name")
            .eq("id", Number(stage_id))
            .single();

        if (stageData && (stageData.name === "Corte" || stageData.name === "Separação estoque")) {
            // Se for "Corte", a etapa oponente a remover é "Separação estoque". E vice-versa.
            const oppositeStageName = stageData.name === "Corte" ? "Separação estoque" : "Corte";

            // Encontrar o ID da etapa oponente
            const { data: oppositeStageData } = await supabaseAdmin
                .from("stages")
                .select("id")
                .eq("name", oppositeStageName)
                .single();

            if (oppositeStageData) {
                const oppositeStageId = oppositeStageData.id;

                // Obter required_stages do pedido atual
                const { data: orderData } = await supabaseAdmin
                    .from("orders")
                    .select("required_stages")
                    .eq("id", Number(order_id))
                    .single();

                if (orderData && Array.isArray(orderData.required_stages)) {
                    // Remover a etapa oposta se ela existir no array (considerando strings e números)
                    const updatedStages = orderData.required_stages.filter(
                        (id) => String(id) !== String(oppositeStageId)
                    );

                    if (updatedStages.length !== orderData.required_stages.length) {
                        // Atualizar pedido apenas se houve remoção
                        await supabaseAdmin
                            .from("orders")
                            .update({ required_stages: updatedStages })
                            .eq("id", Number(order_id));
                        console.log(`[API] Automação: Estágio oponente '${oppositeStageName}' (${oppositeStageId}) removido do pedido ${order_id}.`);
                    }
                }
            }
        }
    } catch (autoErr) {
        console.error("[API] Erro na automação de exclusividade Corte/Separação:", autoErr);
        // Não retornar erro para o front, deixar a execução seguir normalmente se a automação falhar
    }

    return res.json({ id: data.id });
});

// ── Pause-All: pausa todas as execuções ativas (fim de expediente) ────────
app.post("/api/executions/pause-all", isAdmin, async (req, res) => {
    try {
        const now = new Date();

        const { data: activeExecs, error: fetchErr } = await supabaseAdmin
            .from("stage_executions")
            .select("id")
            .eq("status", "Em andamento");

        if (fetchErr) return checkError(fetchErr, res, "Erro ao buscar execuções ativas");
        if (!activeExecs || activeExecs.length === 0) {
            return res.json({ success: true, paused: 0 });
        }

        for (const exec of activeExecs) {
            await supabaseAdmin
                .from("stage_executions")
                .update({ status: "Pausado" })
                .eq("id", exec.id);
            await supabaseAdmin
                .from("pauses")
                .insert({ execution_id: exec.id, start_pause: now.toISOString() });
        }

        console.log(`[API] Pause-all: ${activeExecs.length} execução(ões) pausada(s) por comando direto.`);
        return res.json({ success: true, paused: activeExecs.length });
    } catch (err: any) {
        console.error("[API] Erro no pause-all:", err);
        return res.status(500).json({ error: "Erro ao pausar todas as execuções" });
    }
});

// ── Reset-Production: zera todos os relatórios e tempos mantendo os pedidos (Opção B) ──
app.post("/api/admin/reset-production", isAdmin, async (req, res) => {
    try {
        console.log(`[API] Reset solicitado por ${req.headers["x-user-name"] || "Admin"}`);

        // 1. Apagar todas as pausas
        const { error: errPauses } = await supabaseAdmin
            .from("pauses")
            .delete()
            .gt("id", 0);
        if (errPauses) {
            console.error("Erro ao deletar pausas:", errPauses);
            return res.status(500).json({ error: "Erro ao limpar histórico de pausas: " + errPauses.message });
        }

        // 2. Apagar todas as execuções de etapas
        const { error: errExecutions } = await supabaseAdmin
            .from("stage_executions")
            .delete()
            .gt("id", 0);
        if (errExecutions) {
            console.error("Erro ao deletar execuções:", errExecutions);
            return res.status(500).json({ error: "Erro ao limpar histórico de execuções: " + errExecutions.message });
        }

        // 3. Resetar o tempo acumulado dos pedidos para 0
        const { error: errOrders } = await supabaseAdmin
            .from("orders")
            .update({ total_time_seconds: 0 })
            .gt("id", 0);
        if (errOrders) {
            console.error("Erro ao resetar tempos dos pedidos:", errOrders);
            return res.status(500).json({ error: "Erro ao resetar tempos dos pedidos: " + errOrders.message });
        }

        // 4. Resetar as médias de tempo calculadas nos estágios
        const { error: errStages } = await supabaseAdmin
            .from("stages")
            .update({ real_average_time: 0, execution_count: 0 })
            .gt("id", 0);
        if (errStages) {
            console.error("Erro ao resetar médias dos estágios:", errStages);
            return res.status(500).json({ error: "Erro ao resetar médias dos estágios: " + errStages.message });
        }

        console.log("[API] Reset de produção concluído com sucesso!");
        return res.json({ success: true, message: "Histórico de relatórios e tempos resetados com sucesso! Os pedidos foram preservados." });
    } catch (err: any) {
        console.error("[API] Erro ao resetar produção:", err);
        return res.status(500).json({ error: "Erro interno ao processar reset de produção" });
    }
});

// ── Auto-Pause: pausa automática baseado no horário agendado ────────
app.post("/api/executions/auto-pause", async (req, res) => {
    try {
        const { data: config, error: configErr } = await supabaseAdmin.from("config_producao").select("*").eq("id", 1).single();
        if (configErr) throw configErr;

        const now = new Date();
        const spSpnowStr = now.toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).replace(" ", "T");
        const spSpnow = new Date(spSpnowStr + "Z");
        
        const dayOfWeek = spSpnow.getUTCDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return res.json({ success: true, message: "Fim de semana, pulando pausa automática." });

        const checkTime = (target: string) => {
            if (!target) return false;
            const [hh, mm] = target.split(':').map(Number);
            
            // Janela de ±3 minutos para garantir que o trigger funcione mesmo com pequenas variações de tempo/intervalo
            const targetMin = hh * 60 + mm;
            const currentMin = spSpnow.getUTCHours() * 60 + spSpnow.getUTCMinutes();
            return Math.abs(currentMin - targetMin) <= 3;
        };

        const isLunch = checkTime(config.auto_pause_time_lunch);
        const isEndOfDay = checkTime(dayOfWeek === 5 ? config.auto_pause_time_friday : config.auto_pause_time_weekday);

        if (!isLunch && !isEndOfDay) {
            return res.json({ success: true, message: "Fora do horário de pausa automática.", current_time: now.toLocaleTimeString('pt-BR') });
        }

        const { data: activeExecs, error: fetchErr } = await supabaseAdmin
            .from("stage_executions")
            .select("id")
            .eq("status", "Em andamento");

        if (fetchErr) throw fetchErr;
        if (!activeExecs || activeExecs.length === 0) {
            return res.json({ success: true, message: "Nenhuma tarefa ativa para pausar.", paused: 0 });
        }

        for (const exec of activeExecs) {
            await supabaseAdmin.from("stage_executions").update({ status: "Pausado" }).eq("id", exec.id);
            await supabaseAdmin.from("pauses").insert({ execution_id: exec.id, start_pause: now.toISOString() });
        }

        console.log(`[AutoPause] ${activeExecs.length} execução(ões) pausadas automaticamente por ${isLunch ? 'almoço' : 'fim de expediente'}.`);
        return res.json({ success: true, paused: activeExecs.length, reason: isLunch ? 'almoço' : 'fim de expediente' });
    } catch (err: any) {
        console.error("[AutoPause] Erro:", err);
        return res.status(500).json({ error: "Erro interno no auto-pause" });
    }
});

app.post("/api/executions/:id/pause", async (req, res) => {
    const execution_id = Number(req.params.id);
    const { observation } = req.body || {};

    const { data: exec } = await supabaseAdmin
        .from("stage_executions")
        .select("order_id, stage_id, user_id")
        .eq("id", execution_id)
        .single();

    const { error: e1 } = await supabaseAdmin
        .from("stage_executions")
        .update({ status: "Pausado" })
        .eq("id", execution_id);
    if (checkError(e1, res, "Erro ao pausar execução")) return;

    const { error: e2 } = await supabaseAdmin
        .from("pauses")
        .insert({ execution_id });
    if (checkError(e2, res, "Erro ao registrar pausa")) return;

    if (observation && exec) {
        try {
            await supabaseAdmin.from("stage_observations").insert({
                order_id: exec.order_id,
                stage_id: exec.stage_id,
                user_id: exec.user_id,
                observation
            });
        } catch (e) {
            console.error("Erro ao salvar observação da etapa na pausa:", e);
        }
    }

    return res.json({ success: true });
});

app.post("/api/executions/:id/resume", async (req, res) => {
    const execution_id = Number(req.params.id);
    const now = new Date();

    // 1. Get the active pause
    const { data: activePause, error: e0 } = await supabaseAdmin
        .from("pauses")
        .select("id, start_pause")
        .eq("execution_id", execution_id)
        .is("end_pause", null)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (e0) return checkError(e0, res, "Erro ao buscar pausa ativa");

    if (activePause) {
        const duration = Math.floor((now.getTime() - new Date(activePause.start_pause).getTime()) / 1000);
        const { error: e2 } = await supabaseAdmin
            .from("pauses")
            .update({
                end_pause: now.toISOString(),
                duration_seconds: Math.max(0, duration)
            })
            .eq("id", activePause.id);
        if (checkError(e2, res, "Erro ao finalizar pausa")) return;
    }

    const { error: e1 } = await supabaseAdmin
        .from("stage_executions")
        .update({ status: "Em andamento" })
        .eq("id", execution_id);
    if (checkError(e1, res, "Erro ao retomar execução")) return;

    return res.json({ success: true });
});

app.post("/api/executions/:id/finish", async (req, res) => {
    const execution_id = Number(req.params.id);
    const { force, observation } = req.body || {};
    const nowISO = new Date().toISOString();
    const nowMs = new Date().getTime();

    // 1. Get current execution
    const { data: execution, error: e1 } = await supabaseAdmin
        .from("stage_executions")
        .select("*, stages(name)")
        .eq("id", execution_id)
        .single();

    if (checkError(e1, res, "Execução não encontrada") || !execution) return;

    // 1.5 Validate if stage can be finished (for por_peca, quantidade_boa >= quantidade_pedido)
    if (!force) {
        const val = await validateStageFinish(supabase, execution.order_id, execution.stage_id);
        if (!val.canFinish) {
            return res.status(400).json({ error: val.message, remaining: val.remaining, canForce: true });
        }
    }

    // 2. Finalize any active pause
    const { data: lastPauseData } = await supabaseAdmin
        .from("pauses")
        .select("id, start_pause")
        .eq("execution_id", execution_id)
        .is("end_pause", null)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (lastPauseData) {
        const duration = Math.floor((nowMs - new Date(lastPauseData.start_pause).getTime()) / 1000);
        await supabaseAdmin
            .from("pauses")
            .update({ end_pause: nowISO, duration_seconds: duration })
            .eq("id", lastPauseData.id);
    }

    // 3. Calculate total pause time
    const { data: pausesData } = await supabaseAdmin
        .from("pauses")
        .select("duration_seconds")
        .eq("execution_id", execution_id);

    const totalPauseSeconds = (pausesData || []).reduce(
        (sum: number, p: any) => sum + (p.duration_seconds || 0), 0
    );

    // 4. Calculate total execution time
    const totalExecutionSeconds = Math.max(0, Math.floor(
        (nowMs - new Date(execution.start_time).getTime()) / 1000
    ) - totalPauseSeconds);

    // 5. Update execution status
    const { error: e2 } = await supabaseAdmin
        .from("stage_executions")
        .update({
            end_time: nowISO,
            total_time_seconds: totalExecutionSeconds,
            status: "Finalizado"
        })
        .eq("id", execution_id);

    if (checkError(e2, res, "Erro ao finalizar execução")) return;

    if (observation && execution) {
        try {
            await supabaseAdmin.from("stage_observations").insert({
                order_id: execution.order_id,
                stage_id: execution.stage_id,
                user_id: execution.user_id,
                observation
            });
        } catch (e) {
            console.error("Erro ao salvar observação da etapa na finalização:", e);
        }
    }

    // 6. Update order total time
    const { data: allExecs } = await supabaseAdmin
        .from("stage_executions")
        .select("total_time_seconds")
        .eq("order_id", execution.order_id);

    const totalOrderTime = (allExecs || []).reduce(
        (sum: number, e: any) => sum + (e.total_time_seconds || 0), 0
    );

    await supabaseAdmin
        .from("orders")
        .update({ total_time_seconds: totalOrderTime })
        .eq("id", execution.order_id);

    // 7. Update order status if specific stage finished
    if (execution.stages?.name === "Aguardando ficha de aprovação") {
        await supabaseAdmin
            .from("orders")
            .update({ status: "Em Produção" })
            .eq("id", execution.order_id)
            .eq("status", "Entrada");
    }

    if (execution.stages?.name === "Conferência" || execution.stages?.name === "Conferencia") {
        await supabaseAdmin
            .from("orders")
            .update({ 
                status: "Entregue",
                delivered_at: nowISO
            })
            .eq("id", execution.order_id);
        console.log(`[API] Pedido ${execution.order_id} marcado como Entregue automaticamente ao finalizar Conferência.`);
    }

    // 8. Update real average time for the stage
    try {
        const { data: stageInfo } = await supabaseAdmin
            .from("stages")
            .select("calculation_type")
            .eq("id", execution.stage_id)
            .single();

        const { data: recentExecs } = await supabaseAdmin
            .from("stage_executions")
            .select("total_time_seconds, orders(quantity)")
            .eq("stage_id", execution.stage_id)
            .eq("status", "Finalizado")
            .order("end_time", { ascending: false })
            .limit(20);

        if (recentExecs && recentExecs.length > 0) {
            const calcType = stageInfo?.calculation_type || 'por_peca';
            const sumNormalizedTime = recentExecs.reduce((sum: number, e: any) => {
                const qty = e.orders?.quantity || 1;
                const time = e.total_time_seconds || 0;
                
                if (calcType === 'por_peca') {
                    return sum + (time / qty);
                } else if (calcType === 'por_lote') {
                    return sum + (time / Math.ceil(qty / 10));
                }
                return sum + time; // por_pedido
            }, 0);
            const avg = Math.round(sumNormalizedTime / recentExecs.length);

            const { count } = await supabaseAdmin
                .from("stage_executions")
                .select("*", { count: "exact", head: true })
                .eq("stage_id", execution.stage_id)
                .eq("status", "Finalizado");

            await supabaseAdmin
                .from("stages")
                .update({
                    real_average_time: avg,
                    execution_count: count || recentExecs.length
                })
                .eq("id", execution.stage_id);
        }
    } catch (metricError) {
        console.error("[API] Erro ao recalcular métricas de tempo da etapa:", metricError);
        // Não falha a requisição se falhar ao atualizar a métrica
    }

    return res.json({ success: true, total_time: totalExecutionSeconds });
});

// ── Production Config ─────────────────────────────────────────────────────
app.get("/api/config/producao", async (_req, res) => {
    const { data, error } = await supabase
        .from("config_producao")
        .select("*")
        .limit(1)
        .single();
    if (checkError(error, res)) return;
    return res.json(data);
});

app.patch("/api/config/producao", isAdmin, async (req, res) => {
    const { jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes, meta_diaria_pedidos, meta_diaria_pecas } = req.body;
    const { error } = await supabase
        .from("config_producao")
        .update({ jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes, meta_diaria_pedidos, meta_diaria_pecas })
        .eq("id", 1);
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// ── Users ─────────────────────────────────────────────────────────────────
app.get("/api/users", async (req, res) => {
    const isAdminUser = req.headers["x-user-role"] === "Admin";
    const { search } = req.query;
    let query = supabaseAdmin
        .from("users")
        .select("id, name, email, role, hourly_cost, active");

    if (search) {
        query = query.or(
            `name.ilike.%${search}%,email.ilike.%${search}%`
        );
    }

    const { data, error } = await query;
    if (checkError(error, res)) return;
    const sanitized = (data || []).map((u: any) => ({
        ...u,
        hourly_cost: isAdminUser ? u.hourly_cost : 0
    }));
    return res.json(sanitized);
});

app.post("/api/users", isAdmin, async (req, res) => {
    const { name, email, password, role, hourly_cost } = req.body;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: "Variável SUPABASE_SERVICE_ROLE_KEY não configurada no backend." });
    }

    // 1. Criar o usuário no Supabase Auth primeiro
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password || "123456",
        email_confirm: true, // Ignorar verificação de email forçadamente
        user_metadata: { name }
    });

    if (authError) {
        console.error("Erro ao criar usuário no Supabase Auth:", authError);
        return res.status(400).json({ error: authError.message });
    }

    // 2. Inserir os dados na tabela pública 'users'
    const { data, error } = await supabaseAdmin
        .from("users")
        .insert({
            name,
            email,
            password: "-", // A senha verdadeira fica apenas no Auth por segurança
            role,
            hourly_cost: hourly_cost || 0,
            active: 1
        })
        .select("id")
        .single();

    if (error) {
        // Se falhou a inserção na tabela pública, desfazemos a criação no Auth
        if (authData?.user?.id) {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        }
        return checkError(error, res, "Erro ao criar perfil de usuário na tabela.") ? undefined : undefined;
    }

    return res.json({ id: data.id });
});

app.patch("/api/users/:id", isAdmin, async (req, res) => {
    const { name, email, role, hourly_cost, active } = req.body;
    const { error } = await supabase
        .from("users")
        .update({ name, email, role, hourly_cost, active: active ? 1 : 0 })
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// ── Clients ───────────────────────────────────────────────────────────────
app.get("/api/clients", async (req, res) => {
    const { search } = req.query;
    let query = supabase.from("clients").select("*").order("name");
    if (search) {
        query = query.or(`name.ilike.% ${search} %, email.ilike.% ${search} % `);
    }
    const { data, error } = await query;
    if (checkError(error, res)) return;
    return res.json(data);
});

app.post("/api/clients", async (req, res) => {
    const { name, phone, email } = req.body;
    const { data, error } = await supabase
        .from("clients")
        .insert({ name, phone, email })
        .select("id")
        .single();
    if (checkError(error, res)) return;
    return res.json({ id: data.id });
});

// ── Delivery & Delays Reports ─────────────────────────────────────────────
app.get("/api/reports/delays", async (req, res) => {
    const { startDate, endDate, print_type } = req.query;
    const today = new Date().toISOString().split("T")[0];

    let query = supabase
        .from("orders")
        .select("id, order_number, client_name, product_type, print_type, quantity, deadline")
        .neq("status", "Entregue")
        .neq("status", "Cancelado")
        .is("deleted_at", null);

    if (print_type) query = query.eq("print_type", print_type as string);

    if (startDate && endDate) {
        query = query.gte("deadline", startDate).lte("deadline", endDate);
    } else {
        query = query.lt("deadline", today);
    }

    const { data, error } = await query.order("deadline", { ascending: true });

    if (checkError(error, res, "Erro ao buscar atrasos")) return;

    const atrasados = (data || []).map(o => {
        const diffTime = Math.abs(new Date().getTime() - new Date(o.deadline).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
            ...o,
            dias_atraso: diffDays
        };
    });

    return res.json(atrasados);
});

app.get("/api/reports/delivery", async (req, res) => {
    const { period, startDate: queryStartDate, endDate: queryEndDate, print_type } = req.query;
    const now = new Date();
    let startDate = new Date();

    if (queryStartDate) {
        startDate = new Date(queryStartDate as string);
    } else if (period === 'day') {
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
    } else {
        startDate.setFullYear(2000);
    }

    let endDate = now;
    if (queryEndDate) {
        endDate = new Date(queryEndDate as string);
        // Ensure end date includes the full day (23:59:59)
        endDate.setHours(23, 59, 59, 999);
    } else {
        endDate.setHours(23, 59, 59, 999);
    }

    let ordersQuery = supabase
        .from("orders")
        .select("id, created_at, quantity, deadline, delivered_at")
        .eq("status", "Entregue")
        .is("deleted_at", null)
        .gte("delivered_at", startDate.toISOString())
        .lte("delivered_at", endDate.toISOString());

    if (print_type) ordersQuery = ordersQuery.eq("print_type", print_type as string);

    const { data: orders, error } = await ordersQuery;

    if (checkError(error, res, "Erro ao buscar entregas")) return;

    const data = orders || [];

    // Fallback if missing delivered_at somehow
    const safeData = data.filter(o => o.delivered_at);

    const entregues_hoje = safeData.filter(o => {
        return new Date(o.delivered_at).toLocaleDateString('pt-BR') === now.toLocaleDateString('pt-BR');
    }).length;

    const entregues_periodo = safeData.length;

    let parts_delivered = 0;
    let on_time_count = 0;
    let total_lead_seconds = 0;

    safeData.forEach(o => {
        parts_delivered += Number(o.quantity) || 0;
        const deliveredAt = new Date(o.delivered_at).getTime();
        const deadline = new Date(o.deadline).getTime();
        if (deliveredAt <= deadline + 24 * 60 * 60 * 1000) {
            on_time_count++;
        }
        const createdAt = new Date(o.created_at).getTime();
        total_lead_seconds += Math.max(0, (deliveredAt - createdAt) / 1000);
    });

    const taxa_no_prazo_percent = safeData.length > 0 ? (on_time_count / safeData.length) * 100 : 0;
    const lead_time_medio_dias = safeData.length > 0 ? (total_lead_seconds / safeData.length) / (24 * 3600) : 0;

    const chartMap: Record<string, { pedidos: number, pecas: number }> = {};
    safeData.forEach(o => {
        const localDate = new Date(o.delivered_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        if (!chartMap[localDate]) chartMap[localDate] = { pedidos: 0, pecas: 0 };
        chartMap[localDate].pedidos++;
        chartMap[localDate].pecas += Number(o.quantity) || 0;
    });

    const { data: config } = await supabase.from("config_producao").select("meta_diaria_pedidos, meta_diaria_pecas").eq("id", 1).single();
    const meta_pedidos = config?.meta_diaria_pedidos || 0;
    const meta_pecas = config?.meta_diaria_pecas || 0;

    const chartData = Object.keys(chartMap).map(dateStr => ({
        data: dateStr,
        pedidos: chartMap[dateStr].pedidos,
        pecas: chartMap[dateStr].pecas,
        meta_pedidos,
        meta_pecas
    }));

    chartData.sort((a, b) => {
        const [d1, m1, y1] = a.data.split('/');
        const [d2, m2, y2] = b.data.split('/');
        return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime();
    });

    let met_goal_days = 0;
    chartData.forEach(d => {
        if (d.pedidos >= meta_pedidos) met_goal_days++;
    });

    const cumprimento_meta_percent = chartData.length > 0 ? (met_goal_days / chartData.length) * 100 : 0;

    return res.json({
        entregues_hoje: safeData.filter(o => new Date(o.delivered_at).toLocaleDateString('pt-BR') === now.toLocaleDateString('pt-BR')).length,
        entregues_periodo,
        taxa_no_prazo_percent,
        lead_time_medio_dias,
        cumprimento_meta_percent,
        grafico: chartData,
        atrasados: []
    });
});

// ── Operational Report (Drill-Down) ───────────────────────────────────────
app.get("/api/reports/operational", async (req, res) => {
    const { startDate, endDate, print_type } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: "Parâmetros startDate e endDate são obrigatórios" });
    }

    const rpcParams: any = {
        p_start_date: startDate,
        p_end_date: endDate
    };
    if (print_type) rpcParams.p_print_type = print_type;

    const { data, error } = await supabase.rpc("get_operational_report", rpcParams);

    if (checkError(error, res, "Erro ao buscar relatório operacional")) return;
    return res.json(data);
});

// ── Production Profile Report ─────────────────────────────────────────────
app.get("/api/reports/profiles", async (req, res) => {
    const { startDate, endDate, print_type } = req.query;

    let query = supabase
        .from("orders")
        .select("product_type, print_type, num_colors, total_time_seconds, quantity")
        .eq("status", "Entregue")
        .is("deleted_at", null)
        .gt("total_time_seconds", 0);

    if (print_type) {
        query = query.eq("print_type", print_type as string);
    }

    if (startDate && endDate) {
        // Ensure endDate includes the full day
        const endDay = new Date(endDate as string);
        endDay.setHours(23, 59, 59, 999);
        query = query.gte("delivered_at", startDate).lte("delivered_at", endDay.toISOString());
    }

    const { data, error } = await query;

    if (checkError(error, res)) return;

    // Group by profile key
    const profileMap: Record<string, {
        product_type: string;
        print_type: string;
        num_colors: number;
        times: number[];
        quantities: number[];
    }> = {};

    for (const order of (data || [])) {
        const colors = order.num_colors || 1;
        const key = `${order.product_type}|${order.print_type}|${colors}`;
        if (!profileMap[key]) {
            profileMap[key] = {
                product_type: order.product_type,
                print_type: order.print_type,
                num_colors: colors,
                times: [],
                quantities: [],
            };
        }
        profileMap[key].times.push(order.total_time_seconds);
        profileMap[key].quantities.push(order.quantity || 0);
    }

    const profiles = Object.values(profileMap).map(p => ({
        product_type: p.product_type,
        print_type: p.print_type,
        num_colors: p.num_colors,
        count: p.times.length,
        avg_time_seconds: Math.round(p.times.reduce((a, b) => a + b, 0) / p.times.length),
        min_time_seconds: Math.min(...p.times),
        max_time_seconds: Math.max(...p.times),
        avg_quantity: Math.round(p.quantities.reduce((a, b) => a + b, 0) / p.quantities.length),
    })).sort((a, b) => b.count - a.count);

    return res.json(profiles);
});

// ── Goals & Productivity Report (Day, Week, Month) ────────────────────────
app.get("/api/reports/goals-productivity", async (req, res) => {
    // Current time in Brazil (UTC-3)
    const now = new Date();
    const brTimeMs = now.getTime() - (3 * 60 * 60 * 1000);
    const brDate = new Date(brTimeMs);
    
    const year = brDate.getUTCFullYear();
    const month = brDate.getUTCMonth(); // 0-indexed
    const day = brDate.getUTCDate();
    const dayOfWeek = brDate.getUTCDay(); // 0 = Sun, 1 = Mon...
    
    // Today Start in UTC (00:00:00 Brazil is 03:00:00 UTC)
    const todayStartUTC = new Date(Date.UTC(year, month, day, 3, 0, 0, 0));
    
    // Week Start (Monday) in UTC
    const dayDiff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayBr = new Date(brDate.getTime() - (dayDiff * 24 * 60 * 60 * 1000));
    const weekStartUTC = new Date(Date.UTC(mondayBr.getUTCFullYear(), mondayBr.getUTCMonth(), mondayBr.getUTCDate(), 3, 0, 0, 0));
    
    // Month Start (1st of current month) in UTC
    const monthStartUTC = new Date(Date.UTC(year, month, 1, 3, 0, 0, 0));
    
    // The query start date is the earliest of the three boundaries
    const queryStartDate = new Date(Math.min(todayStartUTC.getTime(), weekStartUTC.getTime(), monthStartUTC.getTime()));

    const todayMs = todayStartUTC.getTime();
    const weekMs = weekStartUTC.getTime();
    const monthMs = monthStartUTC.getTime();

    try {
        // Fetch completed stage executions since queryStartDate
        const { data: executions, error } = await supabaseAdmin
            .from("stage_executions")
            .select(`
                id,
                end_time,
                status,
                user_id,
                stage_id,
                users ( name ),
                stages ( name, calculation_type, meta_diaria ),
                orders ( quantity )
            `)
            .eq("status", "Finalizado")
            .gte("end_time", queryStartDate.toISOString());

        if (error) throw error;

        // Fetch all active users and active stages to populate complete lists
        const [usersRes, stagesRes] = await Promise.all([
            supabaseAdmin.from("users").select("id, name").eq("active", true),
            supabaseAdmin.from("stages").select("id, name, calculation_type, meta_diaria").eq("active", 1)
        ]);

        let overrides: any[] = [];
        try {
            const { data: overridesData } = await supabaseAdmin.from("collaborator_stage_goals").select("*");
            if (overridesData) overrides = overridesData;
        } catch (dbErr) {
            console.warn("Table collaborator_stage_goals does not exist yet, using empty array fallback.", dbErr);
        }

        const activeUsers = usersRes.data || [];
        const activeStages = stagesRes.data || [];

        // 1. Pre-calculate worked days (unique active dates) for each user in week and month periods
        const userWorkedDaysMap: Record<number, { week: number, month: number }> = {};
        activeUsers.forEach(u => {
            const userExecs = (executions || []).filter(e => e.user_id === u.id);
            
            // Week worked days
            const weekDates = new Set<string>();
            userExecs.forEach(e => {
                if (!e.end_time) return;
                const t = new Date(e.end_time).getTime();
                if (t >= weekMs) {
                    const d = new Date(e.end_time);
                    weekDates.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`);
                }
            });
            const weekDays = weekDates.size > 0 ? weekDates.size : 1;

            // Month worked days
            const monthDates = new Set<string>();
            userExecs.forEach(e => {
                if (!e.end_time) return;
                const t = new Date(e.end_time).getTime();
                if (t >= monthMs) {
                    const d = new Date(e.end_time);
                    monthDates.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`);
                }
            });
            const monthDays = monthDates.size > 0 ? monthDates.size : 1;

            userWorkedDaysMap[u.id] = { week: weekDays, month: monthDays };
        });

        // Helper to compute stats for a given slice of executions
        const computePeriodStats = (
            execs: any[],
            dailyGoal: number | null,
            workedDays: number
        ) => {
            const real = execs.reduce((sum, e) => sum + (Number(e.orders?.quantity) || 0), 0);
            if (dailyGoal === null || dailyGoal === undefined) {
                return { real, target: null, pct: null, status: 'sem_meta' };
            }
            const target = dailyGoal * workedDays;
            const pct = target > 0 ? Math.round((real / target) * 100) : 0;
            const status = getGoalStatus(target > 0 ? (real / target) : null);
            return { real, target, pct, status };
        };

        // 2. Build detailed collaborator/sector grid rows
        const colabRows: any[] = [];
        const sectorAggregateMap: Record<number, { 
            stage_id: number;
            stage_name: string;
            calculation_type: string;
            meta_diaria: number | null;
            today: { real: number, target: number | null },
            week: { real: number, target: number | null },
            month: { real: number, target: number | null }
        }> = {};

        activeStages.forEach(stage => {
            sectorAggregateMap[stage.id] = {
                stage_id: stage.id,
                stage_name: stage.name,
                calculation_type: stage.calculation_type,
                meta_diaria: stage.meta_diaria || null,
                today: { real: 0, target: null },
                week: { real: 0, target: null },
                month: { real: 0, target: null }
            };
        });

        activeUsers.forEach(user => {
            activeStages.forEach(stage => {
                const userStageExecs = (executions || []).filter(e => e.user_id === user.id && e.stage_id === stage.id);
                const hasOverride = overrides.some(o => o.user_id === user.id && o.stage_id === stage.id);
                
                // Only show this row if there is active production or an override is defined
                if (userStageExecs.length === 0 && !hasOverride) {
                    return;
                }

                const dailyGoal = resolveGoal(stage.meta_diaria, overrides, user.id, stage.id);
                const userWorkedDays = userWorkedDaysMap[user.id] || { week: 1, month: 1 };

                // Today
                const todayExecs = userStageExecs.filter(e => new Date(e.end_time).getTime() >= todayMs);
                const todayStats = computePeriodStats(todayExecs, dailyGoal, 1);

                // Week
                const weekExecs = userStageExecs.filter(e => new Date(e.end_time).getTime() >= weekMs);
                const weekStats = computePeriodStats(weekExecs, dailyGoal, userWorkedDays.week);

                // Month
                const monthExecs = userStageExecs.filter(e => new Date(e.end_time).getTime() >= monthMs);
                const monthStats = computePeriodStats(monthExecs, dailyGoal, userWorkedDays.month);

                colabRows.push({
                    user_id: user.id,
                    user_name: user.name,
                    stage_id: stage.id,
                    stage_name: stage.name,
                    calculation_type: stage.calculation_type,
                    meta_diaria: dailyGoal,
                    is_custom: hasOverride,
                    today: todayStats,
                    week: weekStats,
                    month: monthStats
                });

                // Aggregate into Sector
                const agg = sectorAggregateMap[stage.id];
                if (agg) {
                    agg.today.real += todayStats.real;
                    if (todayStats.target !== null) {
                        agg.today.target = (agg.today.target || 0) + todayStats.target;
                    }
                    agg.week.real += weekStats.real;
                    if (weekStats.target !== null) {
                        agg.week.target = (agg.week.target || 0) + weekStats.target;
                    }
                    agg.month.real += monthStats.real;
                    if (monthStats.target !== null) {
                        agg.month.target = (agg.month.target || 0) + monthStats.target;
                    }
                }
            });
        });

        // 3. Format sector aggregate results
        const sectorRows = Object.values(sectorAggregateMap).map((agg: any) => {
            const todayPct = agg.today.target !== null && agg.today.target > 0 ? Math.round((agg.today.real / agg.today.target) * 100) : null;
            const todayStatus = agg.today.target !== null && agg.today.target > 0 ? getGoalStatus(agg.today.real / agg.today.target) : 'sem_meta';

            const weekPct = agg.week.target !== null && agg.week.target > 0 ? Math.round((agg.week.real / agg.week.target) * 100) : null;
            const weekStatus = agg.week.target !== null && agg.week.target > 0 ? getGoalStatus(agg.week.real / agg.week.target) : 'sem_meta';

            const monthPct = agg.month.target !== null && agg.month.target > 0 ? Math.round((agg.month.real / agg.month.target) * 100) : null;
            const monthStatus = agg.month.target !== null && agg.month.target > 0 ? getGoalStatus(agg.month.real / agg.month.target) : 'sem_meta';

            return {
                stage_id: agg.stage_id,
                stage_name: agg.stage_name,
                calculation_type: agg.calculation_type,
                meta_diaria: agg.meta_diaria,
                today: { real: agg.today.real, target: agg.today.target, pct: todayPct, status: todayStatus },
                week: { real: agg.week.real, target: agg.week.target, pct: weekPct, status: weekStatus },
                month: { real: agg.month.real, target: agg.month.target, pct: monthPct, status: monthStatus }
            };
        });

        return res.json({
            collaborators: colabRows,
            sectors: sectorRows
        });

    } catch (err: any) {
        console.error("[GoalsProductivity] Error:", err);
        return res.status(500).json({ error: "Erro ao carregar metas de produtividade" });
    }
});

// ── 404 for API routes ────────────────────────────────────────────────────
app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

export default app;
