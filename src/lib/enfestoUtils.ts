export type TecidoTipo = 'TUBULAR' | 'RAMADO';

export const MAX_PECAS_POR_RISCO_MESA = 8;

export interface RiscoConfig {
  id?: string;
  model: string;
  fabric: string;
  largura_util: string; // e.g. "1.60m"
  tipo_tecido: TecidoTipo;
  sizes: string[]; // e.g. ['G'] or ['G', 'GG']
  composicao: { [size: string]: number }; // pieces per layer in marker e.g. { G: 1 }
  comprimento_metros: number; // e.g. 1.20
  created_at?: string;
  is_optitex_validado?: boolean;
}

export interface EnfestoPlanItem {
  id: string;
  titulo: string; // e.g. "ENFESTO 01 — G" or "ENFESTO 01 — G + GG"
  tamanhos: string[];
  risco_name: string;
  comprimento_metra: number;
  peças_por_passada: { [size: string]: number };
  passadas: number;
  camadas_efetivas: number;
  producao_por_tamanho: { [size: string]: number };
  producao_total: number;
  excedente_por_tamanho: { [size: string]: number };
  excedente_total: number;
  consumo_metros: number;
  eficiencia_optitex_pct?: number | null;
  status_optitex?: 'AGUARDANDO_VALIDACAO' | 'VALIDADO';
  comprimento_real_metros?: number | null;
}

export interface OptimizationStrategyResult {
  id: string;
  name: string; // e.g. "SEPARAR G E GG" or "AGRUPAR G + GG + COMPLEMENTO G"
  recomendada: boolean;
  motivo: string;
  enfestos: EnfestoPlanItem[];
  resumo: {
    total_necessario: number;
    total_planejado: number;
    total_faltante: number;
    total_excedente: number;
    total_enfestos: number;
    total_passadas: number;
    total_camadas_efetivas: number;
    total_metros_previstos: number;
    pode_aprovar: boolean;
    consumo_linear_total_previsto_m?: number;
    eficiencia_media_ponderada_pct?: number | null;
    todos_riscos_validados?: boolean;
  };
  score: number; // Penalty score (lower is better)
  quantidade_riscos_distintos?: number;
  max_passadas_por_risco?: number;
  novos_riscos_count?: number;
  riscos_baixo_aproveitamento_count?: number;
}

export interface SavedRiscoStore {
  [key: string]: RiscoConfig; // Key: `${model}_${fabric}_${largura}_${tipo}_${sortedSizes}`
}

// ── RAMADO STRATEGIC SURPLUS & OPTITEX TYPES ───────────────────────────────

export type DecisionType = 'APROVADO_OTIMIZADO' | 'MANTIDO_EXATO';

export interface OptitexRiscoValidado {
  id?: string | number;
  model: string;
  fabric: string;
  largura_util: string;
  tipo_tecido: TecidoTipo;
  sizes: string[];
  composicao: { [size: string]: number };
  comprimento_real_metros: number;
  eficiencia_optitex_pct: number;
  status: 'AGUARDANDO_VALIDACAO' | 'VALIDADO';
  user_name?: string;
  observacao?: string;
  created_at?: string;
}

export interface RamadoCandidatePlan {
  id: string;
  candidateNumber: number; // 1, 2, 3
  name: string; // e.g. "CANDIDATA 1 — COMPOSIÇÃO MULTI-PEÇAS"
  recomendada: boolean;
  motivo: string;
  enfestos: EnfestoPlanItem[];
  resumo: OptimizationStrategyResult['resumo'];
  score: number;
  quantidade_riscos_distintos: number;
  max_passadas_por_risco: number;
  novos_riscos_count: number;
  excedente_proposto: { [size: string]: number } | null;
  excedente_total: number;
  beneficio_operacional?: string | null;
  riscos_baixo_aproveitamento_count: number;
}

export interface RamadoEngineWeights {
  weightFaltante: number;        // Default: 100000 (missing pieces strictly forbidden)
  weightRiscoDistinto: number;   // Default: 5000 (reducing a distinct marker is top priority!)
  weightNovoRisco: number;       // Default: 2000 (preference for pre-validated Optitex risks)
  weightTrocaRisco: number;      // Default: 500 (reducing marker/lay changes)
  weightExcedente: number;       // Default: 100 (penalty per surplus piece)
  weightMetros: number;          // Default: 1 per meter
}

export const DEFAULT_RAMADO_WEIGHTS: RamadoEngineWeights = {
  weightFaltante: 100000,
  weightRiscoDistinto: 5000,
  weightNovoRisco: 2000,
  weightTrocaRisco: 500,
  weightExcedente: 100,
  weightMetros: 1
};

export interface RamadoOperationalGains {
  reduziu_riscos: boolean;
  riscos_antes: number;
  riscos_depois: number;
  substituiu_novo_por_validado: boolean;
  aumentou_repeticao: boolean;
  max_passadas_antes: number;
  max_passadas_depois: number;
  reduziu_trocas: boolean;
  enfestos_antes: number;
  enfestos_depois: number;
}

export interface RamadoOptimizationResult {
  tipo_tecido: TecidoTipo;
  plano_exato: OptimizationStrategyResult;
  plano_otimizado: OptimizationStrategyResult | null;
  candidatas: RamadoCandidatePlan[];
  excedente_proposto: { [size: string]: number } | null;
  excedente_total: number;
  beneficio_operacional: string | null;
  requer_aprovacao: boolean;
  justificativa: string | null;
  recomendacao: 'PLANO_EXATO' | 'PLANO_OTIMIZADO';
  ganhos: RamadoOperationalGains | null;
  eficiencia_minima_desejada: number;
}

export interface RamadoDecisionLog {
  id?: string | number;
  model: string;
  fabric: string;
  color?: string;
  tipo_tecido: TecidoTipo;
  decision: DecisionType;
  plano_exato: OptimizationStrategyResult;
  plano_otimizado?: OptimizationStrategyResult | null;
  excedente_proposto?: { [size: string]: number } | null;
  excedente_total: number;
  riscos_antes: number;
  riscos_depois: number;
  ganho_operacional?: string | null;
  user_id?: number;
  user_name?: string;
  created_at?: string;
}

export interface ProducaoExcedenteItem {
  id?: string | number;
  decision_id?: string | number;
  model: string;
  fabric: string;
  color?: string;
  size: string;
  quantidade: number;
  origem: 'EXCEDENTE_DE_PRODUCAO';
  destino: 'ESTOQUE' | 'REPOSICAO' | 'SOBRA_DE_CORTE';
  created_at?: string;
}

export interface ApprovedEnfestoPlan {
  id: string;
  model: string;
  fabric: string;
  color: string;
  tipoTecido: TecidoTipo;
  planType: 'PLANO_EXATO' | 'PLANO_OTIMIZADO';
  planName: string;
  enfestos: EnfestoPlanItem[];
  resumo: OptimizationStrategyResult['resumo'];
  excedente_proposto?: { [size: string]: number } | null;
  excedente_total: number;
  beneficio_operacional?: string | null;
  user_name: string;
  created_at: string;
  status: 'PENDENTE_DE_CORTE' | 'EM_CORTE' | 'CONCLUIDO';
  pedidos_inclusos?: { order_id: number; order_number?: string; customer_name?: string; quantity: number }[];
  descricao_item?: string;
}

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
const _nodeMemoryStore: { [key: string]: string } = {};

function safeGetStorage(key: string): string | null {
  if (isBrowser) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  return _nodeMemoryStore[key] || null;
}

function safeSetStorage(key: string, val: string): void {
  if (isBrowser) {
    try { localStorage.setItem(key, val); } catch {}
  } else {
    _nodeMemoryStore[key] = val;
  }
}

// ── OPTITEX VALIDATED RISCOS HELPERS ──────────────────────────────────────

export function getOptitexValidatedRiscos(): OptitexRiscoValidado[] {
  try {
    const raw = safeGetStorage('comfortpro_optitex_validated_riscos');
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

export function saveOptitexValidatedRisco(record: OptitexRiscoValidado): void {
  try {
    const existing = getOptitexValidatedRiscos();
    const sortedSizes = [...record.sizes].sort();
    const key = `${record.model}_${record.fabric}_${record.largura_util}_${sortedSizes.join('-')}_${JSON.stringify(record.composicao)}`;
    const filtered = existing.filter(r => {
      const rKey = `${r.model}_${r.fabric}_${r.largura_util}_${[...r.sizes].sort().join('-')}_${JSON.stringify(r.composicao)}`;
      return rKey !== key;
    });
    filtered.unshift({ ...record, id: record.id || `opt-${Date.now()}`, created_at: record.created_at || new Date().toISOString() });
    safeSetStorage('comfortpro_optitex_validated_riscos', JSON.stringify(filtered));
  } catch (e) {
    console.warn('Erro ao salvar risco Optitex:', e);
  }
}

// ── APPROVED ENFESTO PLANS HELPERS ─────────────────────────────────────────

export function getApprovedEnfestoPlans(): ApprovedEnfestoPlan[] {
  try {
    const raw = safeGetStorage('comfortpro_approved_enfesto_plans');
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

export function saveApprovedEnfestoPlan(plan: ApprovedEnfestoPlan): void {
  try {
    const existing = getApprovedEnfestoPlans();
    const updated = [plan, ...existing.filter(p => p.id !== plan.id)];
    safeSetStorage('comfortpro_approved_enfesto_plans', JSON.stringify(updated));
  } catch (e) {
    console.warn('Erro ao salvar plano de enfesto aprovado:', e);
  }
}

export function updateApprovedPlanStatus(planId: string, status: 'PENDENTE_DE_CORTE' | 'EM_CORTE' | 'CONCLUIDO'): void {
  try {
    const existing = getApprovedEnfestoPlans();
    const target = existing.find(p => p.id === planId);
    if (target) {
      target.status = status;
      safeSetStorage('comfortpro_approved_enfesto_plans', JSON.stringify(existing));
    }
  } catch (e) {}
}

export function deleteApprovedEnfestoPlan(planId: string): void {
  try {
    const existing = getApprovedEnfestoPlans();
    const filtered = existing.filter(p => p.id !== planId);
    safeSetStorage('comfortpro_approved_enfesto_plans', JSON.stringify(filtered));
  } catch (e) {
    console.warn('Erro ao excluir plano de enfesto aprovado:', e);
  }
}

// ── CORE UTILS ─────────────────────────────────────────────────────────────

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

export function gcdArray(numbers: number[]): number {
  if (!Array.isArray(numbers) || numbers.length === 0) return 1;
  const validNums = numbers.map(n => Math.abs(Math.round(n))).filter(n => n > 0);
  if (validNums.length === 0) return 1;
  let result = validNums[0];
  for (let i = 1; i < validNums.length; i++) {
    result = gcd(result, validNums[i]);
    if (result === 1) break;
  }
  return result;
}

function getSubsetsOfSize<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length === 0) return [];
  const head = arr[0];
  const tail = arr.slice(1);
  const withHead = getSubsetsOfSize(tail, size - 1).map(s => [head, ...s]);
  const withoutHead = getSubsetsOfSize(tail, size);
  return [...withHead, ...withoutHead];
}

function generateGcdMarkerCandidates(
  targetProd: { [sz: string]: number },
  labelPrefix: string,
  factor: number = 1
): { enfestos: EnfestoPlanItem[]; name: string; motivo: string }[] {
  const activeSizes = Object.keys(targetProd).filter(sz => targetProd[sz] > 0);
  if (activeSizes.length === 0) return [];

  const results: { enfestos: EnfestoPlanItem[]; name: string; motivo: string }[] = [];

  // 1. FULL DEMAND SINGLE MARKER (MDC TOTAL DA DEMANDA)
  const quantities = activeSizes.map(sz => targetProd[sz]);
  const overallGcd = gcdArray(quantities);

  if (overallGcd >= 1) {
    const comp: { [sz: string]: number } = {};
    let totalPcsLayer = 0;
    activeSizes.forEach(sz => {
      const pcs = targetProd[sz] / overallGcd;
      comp[sz] = pcs;
      totalPcsLayer += pcs;
    });

    if (totalPcsLayer <= MAX_PECAS_POR_RISCO_MESA && Number.isInteger(totalPcsLayer)) {
      const passadas = Math.ceil(overallGcd / factor);
      if (passadas > 0) {
        const singleEnf = buildRamadoEnfesto(
          activeSizes,
          comp,
          passadas,
          totalPcsLayer * 0.35 + 0.90
        );
        activeSizes.forEach(sz => {
          singleEnf.producao_por_tamanho[sz] = targetProd[sz];
        });
        singleEnf.producao_total = activeSizes.reduce((sum, sz) => sum + targetProd[sz], 0);

        const compStr = activeSizes.map(sz => `${comp[sz]}× ${sz}`).join(' + ');
        results.push({
          enfestos: [singleEnf],
          name: `RISCO ÚNICO PROPORCIONAL MDC (${compStr})`,
          motivo: `MDC=${overallGcd}: Otimização prioritária em 1 único risco (${compStr}) cortado em ${passadas} passada(s) (${passadas * factor} camadas) com 0 desperdício.`
        });
      }
    }
  }

  // 2. SUBSET GCD / GREEDY SUBGROUP GROUPING (Plano B: Agrupar Maior Subconjunto Compatível)
  const remMap = { ...targetProd };
  let remSizes = Object.keys(remMap).filter(sz => remMap[sz] > 0);
  const subgroupEnfestos: EnfestoPlanItem[] = [];

  while (remSizes.length > 0) {
    let bestSubgroup: string[] = [];
    let bestGcd = 1;
    let bestComp: { [sz: string]: number } = {};
    let bestPcsLayer = 0;

    for (let subLen = remSizes.length; subLen >= 2; subLen--) {
      const combinations = getSubsetsOfSize(remSizes, subLen);
      let foundCombo = false;

      for (const combo of combinations) {
        const subQuantities = combo.map(sz => remMap[sz]);
        const subGcd = gcdArray(subQuantities);

        if (subGcd > 1) {
          const comp: { [sz: string]: number } = {};
          let pcsLayer = 0;
          combo.forEach(sz => {
            const pcs = remMap[sz] / subGcd;
            comp[sz] = pcs;
            pcsLayer += pcs;
          });

          if (pcsLayer <= MAX_PECAS_POR_RISCO_MESA && Number.isInteger(pcsLayer)) {
            bestSubgroup = combo;
            bestGcd = subGcd;
            bestComp = comp;
            bestPcsLayer = pcsLayer;
            foundCombo = true;
            break;
          }
        }
      }

      if (foundCombo) break;
    }

    if (bestSubgroup.length >= 2 && bestGcd > 1) {
      const passadas = Math.ceil(bestGcd / factor);
      const subEnf = buildRamadoEnfesto(
        bestSubgroup,
        bestComp,
        passadas,
        bestPcsLayer * 0.35 + 0.90
      );
      bestSubgroup.forEach(sz => {
        subEnf.producao_por_tamanho[sz] = remMap[sz];
        remMap[sz] = 0;
      });
      subEnf.producao_total = Object.values(subEnf.producao_por_tamanho).reduce((a, b) => a + b, 0);
      subgroupEnfestos.push(subEnf);
    } else {
      remSizes.forEach(sz => {
        const qty = remMap[sz];
        if (qty > 0) {
          const passadas = Math.ceil(qty / factor);
          const singleEnf = buildRamadoEnfesto([sz], { [sz]: 1 }, passadas, 1.20);
          singleEnf.producao_por_tamanho[sz] = qty;
          singleEnf.producao_total = qty;
          remMap[sz] = 0;
          subgroupEnfestos.push(singleEnf);
        }
      });
    }

    remSizes = Object.keys(remMap).filter(sz => remMap[sz] > 0);
  }

  if (subgroupEnfestos.length > 0 && subgroupEnfestos.length < activeSizes.length) {
    const compSummary = subgroupEnfestos.map(e => e.tamanhos.join('+')).join(' | ');
    results.push({
      enfestos: subgroupEnfestos,
      name: `COMPOSIÇÃO AGRUPADA MDC (${compSummary})`,
      motivo: `Agrupamento por subconjuntos proporcionais via MDC (${compSummary}) para minimizar trocas de risco.`
    });
  }

  return results;
}

export function getFatorCamadasPorPassada(tipo: TecidoTipo): number {
  return tipo === 'TUBULAR' ? 2 : 1;
}

export function getSavedRiscos(): RiscoConfig[] {
  try {
    const raw = safeGetStorage('comfortpro_riscos_saved');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRiscoConfig(config: RiscoConfig): void {
  try {
    const existing = getSavedRiscos();
    const key = `${config.model}_${config.fabric}_${config.largura_util}_${config.tipo_tecido}_${[...config.sizes].sort().join('-')}`;
    const filtered = existing.filter(r => {
      const rKey = `${r.model}_${r.fabric}_${r.largura_util}_${r.tipo_tecido}_${[...r.sizes].sort().join('-')}`;
      return rKey !== key;
    });
    filtered.push({ ...config, id: key, created_at: new Date().toISOString() });
    safeSetStorage('comfortpro_riscos_saved', JSON.stringify(filtered));
  } catch (e) {
    console.warn('Erro ao salvar risco:', e);
  }
}

// ── PERSISTENCE HELPERS FOR DECISIONS & SURPLUS PIECES ─────────────────────

export function getRamadoDecisions(): RamadoDecisionLog[] {
  try {
    const raw = safeGetStorage('comfortpro_ramado_decisions');
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

export function saveRamadoDecision(log: RamadoDecisionLog): void {
  try {
    const existing = getRamadoDecisions();
    existing.unshift({ ...log, id: `dec-${Date.now()}`, created_at: log.created_at || new Date().toISOString() });
    safeSetStorage('comfortpro_ramado_decisions', JSON.stringify(existing));
  } catch (e) {
    console.warn('Erro ao salvar decisão RAMADO:', e);
  }
}

export function getProducaoExcedentes(): ProducaoExcedenteItem[] {
  try {
    const raw = safeGetStorage('comfortpro_producao_excedentes');
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

export function saveProducaoExcedente(item: ProducaoExcedenteItem): void {
  try {
    const existing = getProducaoExcedentes();
    existing.unshift({ ...item, id: `exc-${Date.now()}`, created_at: item.created_at || new Date().toISOString() });
    safeSetStorage('comfortpro_producao_excedentes', JSON.stringify(existing));
  } catch (e) {
    console.warn('Erro ao salvar excedente de produção:', e);
  }
}

// ── RAMADO ENGINE OPTIMIZATION & OPTITEX EVALUATION ────────────────────────

/**
 * Calculates metrics, Optitex efficiency weighting and penalty score for a candidate plan in RAMADO
 */
export function evaluateRamadoPlanMetrics(
  enfestos: EnfestoPlanItem[],
  demandMap: { [size: string]: number },
  totalNecOverall: number,
  knownRiscos: RiscoConfig[] = [],
  weights: RamadoEngineWeights = DEFAULT_RAMADO_WEIGHTS,
  eficienciaMinima: number = 80.0
): {
  resumo: OptimizationStrategyResult['resumo'];
  score: number;
  distinctMarkersCount: number;
  maxPasses: number;
  novosRiscosCount: number;
  riscosBaixoAproveitamentoCount: number;
} {
  let totalPlan = 0;
  let totalExc = 0;
  let totalFaltante = 0;
  let totalPassadas = 0;
  let totalCamadas = 0;
  let totalMetros = 0;
  let maxPasses = 0;
  let riscosBaixoAproveitamentoCount = 0;

  let totalWeightedEfficiencySum = 0;
  let totalWeightedMetrosSum = 0;
  let allValidated = true;

  const distinctMarkersSet = new Set<string>();
  const currentProdMap: { [sz: string]: number } = {};
  const optitexHistory = getOptitexValidatedRiscos();

  enfestos.forEach(enf => {
    const markerKey = [...enf.tamanhos].sort().join('+');
    distinctMarkersSet.add(markerKey);
    if (enf.passadas > maxPasses) maxPasses = enf.passadas;

    // Match with optitexHistory
    const matchedOptitex = optitexHistory.find(r =>
      [...r.sizes].sort().join('+') === markerKey &&
      JSON.stringify(r.composicao) === JSON.stringify(enf.peças_por_passada)
    );

    if (matchedOptitex) {
      enf.status_optitex = 'VALIDADO';
      enf.eficiencia_optitex_pct = matchedOptitex.eficiencia_optitex_pct;
      enf.comprimento_real_metros = matchedOptitex.comprimento_real_metros;
      enf.comprimento_metra = matchedOptitex.comprimento_real_metros;
      enf.consumo_metros = parseFloat((matchedOptitex.comprimento_real_metros * enf.passadas).toFixed(2));

      totalWeightedEfficiencySum += matchedOptitex.eficiencia_optitex_pct * enf.consumo_metros;
      totalWeightedMetrosSum += enf.consumo_metros;

      if (matchedOptitex.eficiencia_optitex_pct < eficienciaMinima) {
        riscosBaixoAproveitamentoCount++;
      }
    } else {
      enf.status_optitex = 'AGUARDANDO_VALIDACAO';
      allValidated = false;
    }

    for (const [sz, prd] of Object.entries(enf.producao_por_tamanho)) {
      currentProdMap[sz] = (currentProdMap[sz] || 0) + prd;
    }
    totalPassadas += enf.passadas;
    totalCamadas += enf.camadas_efetivas;
    totalMetros += enf.consumo_metros;
  });

  Object.keys(demandMap).forEach(sz => {
    const prd = currentProdMap[sz] || 0;
    const nec = demandMap[sz] || 0;
    totalPlan += prd;
    if (prd < nec) totalFaltante += (nec - prd);
    if (prd > nec) totalExc += (prd - nec);
  });

  let novosRiscosCount = 0;
  distinctMarkersSet.forEach(mk => {
    const isKnown = knownRiscos.some(kr => kr.sizes.sort().join('+') === mk);
    if (!isKnown) novosRiscosCount++;
  });

  const distinctMarkersCount = distinctMarkersSet.size;
  const trocasCount = enfestos.length;

  const weightedEffPct = totalWeightedMetrosSum > 0
    ? parseFloat((totalWeightedEfficiencySum / totalWeightedMetrosSum).toFixed(2))
    : null;

  // Efficiency penalty: low efficiency adds score penalty
  const lowEfficiencyPenalty = (riscosBaixoAproveitamentoCount * 3000);

  const score =
    totalFaltante * weights.weightFaltante +
    distinctMarkersCount * weights.weightRiscoDistinto +
    novosRiscosCount * weights.weightNovoRisco +
    trocasCount * weights.weightTrocaRisco +
    totalExc * weights.weightExcedente +
    totalMetros * weights.weightMetros +
    lowEfficiencyPenalty;

  return {
    resumo: {
      total_necessario: totalNecOverall,
      total_planejado: totalPlan,
      total_faltante: totalFaltante,
      total_excedente: totalExc,
      total_enfestos: enfestos.length,
      total_passadas: totalPassadas,
      total_camadas_efetivas: totalCamadas,
      total_metros_previstos: parseFloat(totalMetros.toFixed(2)),
      pode_aprovar: totalFaltante === 0,
      consumo_linear_total_previsto_m: parseFloat(totalMetros.toFixed(2)),
      eficiencia_media_ponderada_pct: weightedEffPct,
      todos_riscos_validados: allValidated
    },
    score,
    distinctMarkersCount,
    maxPasses,
    novosRiscosCount,
    riscosBaixoAproveitamentoCount
  };
}

/**
 * Builds a single enfesto item helper
 */
function buildRamadoEnfesto(
  sizes: string[],
  pcsPerSizeLayer: { [size: string]: number },
  passadas: number,
  comprimentoMetros: number
): EnfestoPlanItem {
  const producao_por_tamanho: { [sz: string]: number } = {};
  let totalPcsPerPass = 0;

  sizes.forEach(sz => {
    const pcsLayer = pcsPerSizeLayer[sz] || 1;
    producao_por_tamanho[sz] = pcsLayer * passadas;
    totalPcsPerPass += pcsLayer;
  });

  const totalProd = passadas * totalPcsPerPass;
  const compEstimated = comprimentoMetros > 0 ? comprimentoMetros : (totalPcsPerPass * 0.40 + 0.80);

  const pcsKey = Object.entries(pcsPerSizeLayer).map(([s, q]) => `${s}${q}`).join('');
  const deterministicId = `enf-ram-${sizes.join('-')}-${pcsKey}`;

  return {
    id: deterministicId,
    titulo: sizes.length === 1 ? `ENFESTO ${sizes[0]}` : `ENFESTO MISTO MULTI-PEÇAS (${sizes.join(' + ')})`,
    tamanhos: sizes,
    risco_name: `Risco ${sizes.map(s => `${s}=${pcsPerSizeLayer[s] || 1}`).join(', ')}`,
    comprimento_metra: parseFloat(compEstimated.toFixed(2)),
    peças_por_passada: { ...pcsPerSizeLayer },
    passadas,
    camadas_efetivas: passadas, // RAMADO = 1 layer per pass
    producao_por_tamanho,
    producao_total: totalProd,
    excedente_por_tamanho: {},
    excedente_total: 0,
    consumo_metros: parseFloat((compEstimated * passadas).toFixed(2)),
    status_optitex: 'AGUARDANDO_VALIDACAO'
  };
}

/**
 * Searches candidate plans for RAMADO fabric layout with rich multi-piece composition generator
 */
export function optimizeRamadoPlan(params: {
  model: string;
  fabric: string;
  larguraUtil: string;
  agruparTamanhos: boolean;
  demandMap: { [size: string]: number };
  knownRiscos?: RiscoConfig[];
  weights?: RamadoEngineWeights;
  eficienciaMinimaDesejada?: number;
}): RamadoOptimizationResult {
  const {
    model,
    fabric,
    larguraUtil,
    agruparTamanhos,
    demandMap,
    knownRiscos = [],
    weights = DEFAULT_RAMADO_WEIGHTS,
    eficienciaMinimaDesejada = 80.0
  } = params;

  const sizes = Object.keys(demandMap).filter(s => demandMap[s] > 0);
  const totalNecOverall = Object.values(demandMap).reduce((a, b) => a + b, 0);

  if (sizes.length === 0 || totalNecOverall === 0) {
    const emptyResult: OptimizationStrategyResult = {
      id: 'empty',
      name: 'Sem demanda pendente',
      recomendada: true,
      motivo: 'Não há peças pendentes na grade.',
      enfestos: [],
      resumo: {
        total_necessario: 0,
        total_planejado: 0,
        total_faltante: 0,
        total_excedente: 0,
        total_enfestos: 0,
        total_passadas: 0,
        total_camadas_efetivas: 0,
        total_metros_previstos: 0,
        pode_aprovar: true
      },
      score: 0
    };
    return {
      tipo_tecido: 'RAMADO',
      plano_exato: emptyResult,
      plano_otimizado: null,
      candidatas: [],
      excedente_proposto: null,
      excedente_total: 0,
      beneficio_operacional: null,
      requer_aprovacao: false,
      justificativa: 'Não há demanda pendente.',
      recomendacao: 'PLANO_EXATO',
      ganhos: null,
      eficiencia_minima_desejada: eficienciaMinimaDesejada
    };
  }

  // Helper generator to produce rich multi-piece candidate compositions
  const generateCandidatesForProductionMap = (
    targetProd: { [sz: string]: number },
    labelPrefix: string
  ): OptimizationStrategyResult[] => {
    const candidates: OptimizationStrategyResult[] = [];
    const activeSizes = Object.keys(targetProd).filter(sz => targetProd[sz] > 0);

    // 0. PRIORITY STRATEGY: GCD SINGLE MARKER & SUBSET MDC GROUPINGS
    const gcdOptions = generateGcdMarkerCandidates(targetProd, labelPrefix, 1);
    gcdOptions.forEach((opt, idx) => {
      const evalRes = evaluateRamadoPlanMetrics(opt.enfestos, demandMap, totalNecOverall, knownRiscos, weights, eficienciaMinimaDesejada);
      candidates.push({
        id: `ram-gcd-${idx}-${labelPrefix}`,
        name: opt.name,
        recomendada: idx === 0,
        motivo: opt.motivo,
        enfestos: opt.enfestos,
        resumo: evalRes.resumo,
        score: evalRes.score,
        quantidade_riscos_distintos: evalRes.distinctMarkersCount,
        max_passadas_por_risco: evalRes.maxPasses,
        novos_riscos_count: evalRes.novosRiscosCount,
        riscos_baixo_aproveitamento_count: evalRes.riscosBaixoAproveitamentoCount
      });
    });

    // 1. WATERFALL MULTI-PIECE MARKER STRATEGY (1 mold per size in marker x passadas)
    const waterfallEnfestos: EnfestoPlanItem[] = [];
    const remMap = { ...targetProd };
    let currentActiveSizes = Object.keys(remMap).filter(sz => remMap[sz] > 0);

    while (currentActiveSizes.length > 0) {
      const minQty = Math.min(...currentActiveSizes.map(sz => remMap[sz]));
      const comp: { [sz: string]: number } = {};
      currentActiveSizes.forEach(sz => {
        comp[sz] = 1;
        remMap[sz] -= minQty;
      });

      const pcsLayer = currentActiveSizes.length;
      if (pcsLayer <= MAX_PECAS_POR_RISCO_MESA) {
        waterfallEnfestos.push(
          buildRamadoEnfesto(currentActiveSizes, comp, minQty, pcsLayer * 0.35 + 0.90)
        );
      } else {
        const group1 = currentActiveSizes.slice(0, 4);
        const group2 = currentActiveSizes.slice(4);
        const comp1: { [sz: string]: number } = {};
        const comp2: { [sz: string]: number } = {};
        group1.forEach(sz => comp1[sz] = 1);
        group2.forEach(sz => comp2[sz] = 1);
        waterfallEnfestos.push(buildRamadoEnfesto(group1, comp1, minQty, group1.length * 0.35 + 0.90));
        waterfallEnfestos.push(buildRamadoEnfesto(group2, comp2, minQty, group2.length * 0.35 + 0.90));
      }

      currentActiveSizes = Object.keys(remMap).filter(sz => remMap[sz] > 0);
    }

    if (waterfallEnfestos.length > 0) {
      const wfEval = evaluateRamadoPlanMetrics(waterfallEnfestos, demandMap, totalNecOverall, knownRiscos, weights, eficienciaMinimaDesejada);
      const totalPcsMulti = waterfallEnfestos.map(e => Object.values(e.peças_por_passada).reduce((a, b) => a + b, 0)).join(' + ');

      candidates.push({
        id: `ram-wf-${labelPrefix}`,
        name: `COMPOSIÇÃO OTIMIZADA MULTI-PEÇAS (1 Molde/Tamanho × Enfestos)`,
        recomendada: true,
        motivo: `Composição geométrica com 1 molde por tamanho na grade do Risco (${totalPcsMulti} pcs/camada) multiplicada pelo número de enfestos (passadas).`,
        enfestos: waterfallEnfestos,
        resumo: wfEval.resumo,
        score: wfEval.score,
        quantidade_riscos_distintos: wfEval.distinctMarkersCount,
        max_passadas_por_risco: wfEval.maxPasses,
        novos_riscos_count: wfEval.novosRiscosCount,
        riscos_baixo_aproveitamento_count: wfEval.riscosBaixoAproveitamentoCount
      });
    }

    // 2. RICH MULTI-PIECE MARKER COMPOSITIONS (General Integer Partition Ratio Algorithm)
    // Test pairs of enfesto multipliers (k1, k2) in {1...6}
    const ratioCandidates: EnfestoPlanItem[][] = [];

    for (let k1 = 1; k1 <= 6; k1++) {
      for (let k2 = 1; k2 <= 6; k2++) {
        // Try solving k1 * A_s + k2 * B_s = targetProd[s]
        const compA: { [sz: string]: number } = {};
        const compB: { [sz: string]: number } = {};
        let possible = true;

        for (const sz of activeSizes) {
          const qty = targetProd[sz];
          let foundPair = false;

          // Prefer smaller 'a' (1 mold per layer if possible)
          for (let a = 1; a <= qty; a++) {
            const rem = qty - k1 * a;
            if (rem >= 0 && rem % k2 === 0) {
              const b = rem / k2;
              compA[sz] = a;
              compB[sz] = b;
              foundPair = true;
              break;
            }
          }

          if (!foundPair) {
            possible = false;
            break;
          }
        }

        if (possible) {
          const sizesA = activeSizes.filter(s => (compA[s] || 0) > 0);
          const sizesB = activeSizes.filter(s => (compB[s] || 0) > 0);

          if (sizesA.length > 0 && sizesB.length > 0) {
            const pcsLayerA = sizesA.reduce((sum, s) => sum + compA[s], 0);
            const pcsLayerB = sizesB.reduce((sum, s) => sum + compB[s], 0);

            // HARD LIMIT: Mesa de corte suporta no máximo 8 peças por risco/camada
            if (pcsLayerA <= 8 && pcsLayerB <= 8) {
              if (pcsLayerA >= 2 || pcsLayerB >= 2) {
                const enfA = buildRamadoEnfesto(sizesA, compA, k1, pcsLayerA * 0.35 + 0.90);
                const enfB = buildRamadoEnfesto(sizesB, compB, k2, pcsLayerB * 0.35 + 0.90);
                ratioCandidates.push([enfA, enfB]);
              }
            }
          }
        }
      }
    }

    // Evaluate and add unique rich ratio candidates
    ratioCandidates.slice(0, 5).forEach((enfestos, idx) => {
      const evalRes = evaluateRamadoPlanMetrics(enfestos, demandMap, totalNecOverall, knownRiscos, weights, eficienciaMinimaDesejada);
      const totalPcsMulti = enfestos.map(e => Object.values(e.peças_por_passada).reduce((a, b) => a + b, 0)).join(' + ');

      candidates.push({
        id: `ram-rich-${idx}-${labelPrefix}`,
        name: `COMPOSIÇÃO MULTI-PEÇAS (${enfestos.length} riscos, ${totalPcsMulti} pcs/camada)`,
        recomendada: false,
        motivo: `Combinação geométrica com múltiplas peças da grade (${totalPcsMulti} pcs/camada) ideal para encaixe no Optitex.`,
        enfestos,
        resumo: evalRes.resumo,
        score: evalRes.score,
        quantidade_riscos_distintos: evalRes.distinctMarkersCount,
        max_passadas_por_risco: evalRes.maxPasses,
        novos_riscos_count: evalRes.novosRiscosCount,
        riscos_baixo_aproveitamento_count: evalRes.riscosBaixoAproveitamentoCount
      });
    });

    // 2. Individual markers strategy (fallback)
    const indEnfestos: EnfestoPlanItem[] = activeSizes.map(sz =>
      buildRamadoEnfesto([sz], { [sz]: 1 }, targetProd[sz], 1.20)
    );
    const indEval = evaluateRamadoPlanMetrics(indEnfestos, demandMap, totalNecOverall, knownRiscos, weights, eficienciaMinimaDesejada);

    candidates.push({
      id: `ram-ind-${labelPrefix}`,
      name: `RISCOS INDIVIDUAIS POR TAMANHO (${labelPrefix})`,
      recomendada: false,
      motivo: 'Enfestos individuais separados por tamanho.',
      enfestos: indEnfestos,
      resumo: indEval.resumo,
      score: indEval.score,
      quantidade_riscos_distintos: indEval.distinctMarkersCount,
      max_passadas_por_risco: indEval.maxPasses,
      novos_riscos_count: indEval.novosRiscosCount,
      riscos_baixo_aproveitamento_count: indEval.riscosBaixoAproveitamentoCount
    });

    // 3. Pairwise mixed markers strategy
    if (activeSizes.length >= 2) {
      for (let i = 0; i < activeSizes.length; i++) {
        for (let j = i + 1; j < activeSizes.length; j++) {
          const s1 = activeSizes[i];
          const s2 = activeSizes[j];
          const q1 = targetProd[s1];
          const q2 = targetProd[s2];
          const comboPasses = Math.min(q1, q2);

          if (comboPasses > 0) {
            const enfestosCombo: EnfestoPlanItem[] = [];
            enfestosCombo.push(buildRamadoEnfesto([s1, s2], { [s1]: 1, [s2]: 1 }, comboPasses, 1.80));

            const rem1 = q1 - comboPasses;
            if (rem1 > 0) enfestosCombo.push(buildRamadoEnfesto([s1], { [s1]: 1 }, rem1, 1.20));

            const rem2 = q2 - comboPasses;
            if (rem2 > 0) enfestosCombo.push(buildRamadoEnfesto([s2], { [s2]: 1 }, rem2, 1.20));

            activeSizes.forEach(otherSz => {
              if (otherSz !== s1 && otherSz !== s2) {
                enfestosCombo.push(buildRamadoEnfesto([otherSz], { [otherSz]: 1 }, targetProd[otherSz], 1.20));
              }
            });

            const comboEval = evaluateRamadoPlanMetrics(enfestosCombo, demandMap, totalNecOverall, knownRiscos, weights, eficienciaMinimaDesejada);
            candidates.push({
              id: `ram-combo-${s1}-${s2}-${labelPrefix}`,
              name: `AGRUPAR ${s1} + ${s2} (${labelPrefix})`,
              recomendada: false,
              motivo: `Combinação de risco misto (${s1}+${s2}) para otimizar enfestos.`,
              enfestos: enfestosCombo,
              resumo: comboEval.resumo,
              score: comboEval.score,
              quantidade_riscos_distintos: comboEval.distinctMarkersCount,
              max_passadas_por_risco: comboEval.maxPasses,
              novos_riscos_count: comboEval.novosRiscosCount,
              riscos_baixo_aproveitamento_count: comboEval.riscosBaixoAproveitamentoCount
            });
          }
        }
      }
    }

    return candidates.filter(cand =>
      cand.resumo.total_faltante === 0 &&
      cand.enfestos.every(enf => {
        const totalPcsInRisk = Object.values(enf.peças_por_passada).reduce((a, b) => a + b, 0);
        return totalPcsInRisk <= MAX_PECAS_POR_RISCO_MESA;
      })
    );
  };

  // ── LEVEL 1: PLANO EXATO (0 EXCEDENTE) ────────────────────────────────────
  const exactProdMap: { [sz: string]: number } = { ...demandMap };
  const exactCandidates = generateCandidatesForProductionMap(exactProdMap, 'Exato');
  exactCandidates.sort((a, b) => a.score - b.score);
  const planoExato = exactCandidates[0];
  planoExato.name = 'PLANO EXATO (0 EXCEDENTES)';
  planoExato.motivo = 'Atende 100% da demanda sem peças excedentes.';

  // ── LEVEL 2 & 3: PLANO OTIMIZADO COM EXCEDENTE (max 2 peças global) ────────
  const surplusCandidates: {
    plan: OptimizationStrategyResult;
    surplusMap: { [sz: string]: number };
    totalSurplus: number;
  }[] = [];

  // Generate target production maps with total surplus = 1 or 2
  sizes.forEach(sz1 => {
    const prodMap1 = { ...demandMap, [sz1]: demandMap[sz1] + 1 };
    const candidates1 = generateCandidatesForProductionMap(prodMap1, `+1 ${sz1}`);
    candidates1.forEach(plan => {
      surplusCandidates.push({ plan, surplusMap: { [sz1]: 1 }, totalSurplus: 1 });
    });

    const prodMap2Same = { ...demandMap, [sz1]: demandMap[sz1] + 2 };
    const candidates2Same = generateCandidatesForProductionMap(prodMap2Same, `+2 ${sz1}`);
    candidates2Same.forEach(plan => {
      surplusCandidates.push({ plan, surplusMap: { [sz1]: 2 }, totalSurplus: 2 });
    });

    sizes.forEach(sz2 => {
      if (sz1 < sz2) {
        const prodMap2Diff = { ...demandMap, [sz1]: demandMap[sz1] + 1, [sz2]: demandMap[sz2] + 1 };
        const candidates2Diff = generateCandidatesForProductionMap(prodMap2Diff, `+1 ${sz1}, +1 ${sz2}`);
        candidates2Diff.forEach(plan => {
          surplusCandidates.push({ plan, surplusMap: { [sz1]: 1, [sz2]: 1 }, totalSurplus: 2 });
        });
      }
    });
  });

  const exatoRiscosDistintos = planoExato.quantidade_riscos_distintos || 1;
  const exatoMaxPasses = planoExato.max_passadas_por_risco || 1;
  const exatoNovosRiscos = planoExato.novos_riscos_count || 0;
  const exatoTotalEnfestos = planoExato.resumo.total_enfestos;

  const validSurplusOptions: {
    plan: OptimizationStrategyResult;
    surplusMap: { [sz: string]: number };
    totalSurplus: number;
    ganhos: RamadoOperationalGains;
    beneficioStr: string;
  }[] = [];

  surplusCandidates.forEach(cand => {
    const { plan, surplusMap, totalSurplus } = cand;
    const candRiscosDistintos = plan.quantidade_riscos_distintos || 1;
    const candMaxPasses = plan.max_passadas_por_risco || 1;
    const candNovosRiscos = plan.novos_riscos_count || 0;
    const candTotalEnfestos = plan.resumo.total_enfestos;

    const reduziu_riscos = candRiscosDistintos < exatoRiscosDistintos;
    const substituiu_novo_por_validado = candNovosRiscos < exatoNovosRiscos;
    const aumentou_repeticao = candRiscosDistintos <= exatoRiscosDistintos && candMaxPasses >= exatoMaxPasses + 2;
    const reduziu_trocas = candTotalEnfestos < exatoTotalEnfestos;

    const temGanhoOperacional = (reduziu_riscos || substituiu_novo_por_validado || aumentou_repeticao || reduziu_trocas) && (candRiscosDistintos <= exatoRiscosDistintos);

    if (temGanhoOperacional && totalSurplus <= 2) {
      const beneficiosList: string[] = [];
      if (reduziu_riscos) {
        beneficiosList.push(`Elimina ${exatoRiscosDistintos - candRiscosDistintos} risco(s) no Optitex (${exatoRiscosDistintos} → ${candRiscosDistintos})`);
      }
      if (substituiu_novo_por_validado) {
        beneficiosList.push(`Substitui ${exatoNovosRiscos - candNovosRiscos} risco novo por risco já validado`);
      }
      if (aumentou_repeticao) {
        beneficiosList.push(`Aumenta repetição de enfesto (${exatoMaxPasses} → ${candMaxPasses} enfestos)`);
      }
      if (reduziu_trocas) {
        beneficiosList.push(`Reduz trocas de risco (${exatoTotalEnfestos} → ${candTotalEnfestos} enfestos)`);
      }

      validSurplusOptions.push({
        plan,
        surplusMap,
        totalSurplus,
        ganhos: {
          reduziu_riscos,
          riscos_antes: exatoRiscosDistintos,
          riscos_depois: candRiscosDistintos,
          substituiu_novo_por_validado,
          aumentou_repeticao,
          max_passadas_antes: exatoMaxPasses,
          max_passadas_depois: candMaxPasses,
          reduziu_trocas,
          enfestos_antes: exatoTotalEnfestos,
          enfestos_depois: candTotalEnfestos
        },
        beneficioStr: beneficiosList.join(' • ')
      });
    }
  });

  validSurplusOptions.sort((a, b) => a.plan.score - b.plan.score);

  // ── BUILD MULTI-CANDIDATE LIST (CANDIDATA 1, CANDIDATA 2, CANDIDATA 3) ─────
  const candidatasList: RamadoCandidatePlan[] = [];
  const allPool = [...exactCandidates, ...validSurplusOptions.map(v => v.plan)];
  allPool.sort((a, b) => a.score - b.score);

  // Remove duplicate plans by enfestos breakdown
  const uniquePool: OptimizationStrategyResult[] = [];
  const seenKeys = new Set<string>();

  allPool.forEach(p => {
    const key = p.enfestos.map(e => `${e.tamanhos.join('+')}:${e.passadas}`).sort().join('|');
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniquePool.push(p);
    }
  });

  uniquePool.slice(0, 3).forEach((plan, idx) => {
    const matchedSurplusOpt = validSurplusOptions.find(v => v.plan.id === plan.id);
    candidatasList.push({
      id: plan.id,
      candidateNumber: idx + 1,
      name: `CANDIDATA ${idx + 1} — ${plan.name}`,
      recomendada: idx === 0,
      motivo: plan.motivo,
      enfestos: plan.enfestos,
      resumo: plan.resumo,
      score: plan.score,
      quantidade_riscos_distintos: plan.quantidade_riscos_distintos || plan.enfestos.length,
      max_passadas_por_risco: plan.max_passadas_por_risco || 1,
      novos_riscos_count: plan.novos_riscos_count || 0,
      excedente_proposto: matchedSurplusOpt ? matchedSurplusOpt.surplusMap : null,
      excedente_total: matchedSurplusOpt ? matchedSurplusOpt.totalSurplus : 0,
      beneficio_operacional: matchedSurplusOpt ? matchedSurplusOpt.beneficioStr : 'Plano exato (0 excedentes)',
      riscos_baixo_aproveitamento_count: plan.riscos_baixo_aproveitamento_count || 0
    });
  });

  if (validSurplusOptions.length > 0) {
    const bestSurplus = validSurplusOptions[0];
    const planoOtimizado = bestSurplus.plan;
    planoOtimizado.name = 'PLANO OTIMIZADO (EXCEDENTE ESTRATÉGICO)';
    planoOtimizado.motivo = `Ganho operacional: ${bestSurplus.beneficioStr}`;

    const surplusText = Object.entries(bestSurplus.surplusMap)
      .map(([sz, qty]) => `+${qty} ${sz}`)
      .join(', ');

    return {
      tipo_tecido: 'RAMADO',
      plano_exato: planoExato,
      plano_otimizado: planoOtimizado,
      candidatas: candidatasList,
      excedente_proposto: bestSurplus.surplusMap,
      excedente_total: bestSurplus.totalSurplus,
      beneficio_operacional: bestSurplus.beneficioStr,
      requer_aprovacao: true,
      justificativa: `Produzindo ${surplusText} podemos otimizar o planejamento de corte: ${bestSurplus.beneficioStr}.`,
      recomendacao: 'PLANO_OTIMIZADO',
      ganhos: bestSurplus.ganhos,
      eficiencia_minima_desejada: eficienciaMinimaDesejada
    };
  }

  return {
    tipo_tecido: 'RAMADO',
    plano_exato: planoExato,
    plano_otimizado: null,
    candidatas: candidatasList,
    excedente_proposto: null,
    excedente_total: 0,
    beneficio_operacional: null,
    requer_aprovacao: false,
    justificativa: 'Nenhum excedente trouxe ganho operacional significativo. Mantido o Plano Exato.',
    recomendacao: 'PLANO_EXATO',
    ganhos: null,
    eficiencia_minima_desejada: eficienciaMinimaDesejada
  };
}

/**
 * Main engine entrypoint evaluating strategies for Tubular or Ramado.
 * TUBULAR logic is preserved strictly unchanged.
 */
export function optimizeEnfestoPlan(params: {
  model: string;
  fabric: string;
  tipoTecido: TecidoTipo;
  larguraUtil: string;
  agruparTamanhos: boolean;
  demandMap: { [size: string]: number };
  knownRiscos?: RiscoConfig[];
}): {
  recomendada: OptimizationStrategyResult;
  alternativas: OptimizationStrategyResult[];
  ramadoResult?: RamadoOptimizationResult;
} {
  const { model, fabric, tipoTecido, larguraUtil, agruparTamanhos, demandMap, knownRiscos = [] } = params;

  if (tipoTecido === 'RAMADO') {
    const ramadoRes = optimizeRamadoPlan({
      model,
      fabric,
      larguraUtil,
      agruparTamanhos,
      demandMap,
      knownRiscos
    });

    if (ramadoRes.recomendacao === 'PLANO_OTIMIZADO' && ramadoRes.plano_otimizado) {
      return {
        recomendada: ramadoRes.plano_otimizado,
        alternativas: [ramadoRes.plano_exato],
        ramadoResult: ramadoRes
      };
    } else {
      return {
        recomendada: ramadoRes.plano_exato,
        alternativas: [],
        ramadoResult: ramadoRes
      };
    }
  }

  // ── ORIGINAL TUBULAR ENGINE LOGIC (UNCHANGED) ────────────────────────────
  const fator = getFatorCamadasPorPassada(tipoTecido); // = 2
  const sizes = Object.keys(demandMap).filter(s => demandMap[s] > 0);
  const totalNecOverall = Object.values(demandMap).reduce((a, b) => a + b, 0);

  if (sizes.length === 0 || totalNecOverall === 0) {
    const emptyResult: OptimizationStrategyResult = {
      id: 'empty',
      name: 'Sem demanda pendente',
      recomendada: true,
      motivo: 'Não há peças pendentes na grade.',
      enfestos: [],
      resumo: {
        total_necessario: 0,
        total_planejado: 0,
        total_faltante: 0,
        total_excedente: 0,
        total_enfestos: 0,
        total_passadas: 0,
        total_camadas_efetivas: 0,
        total_metros_previstos: 0,
        pode_aprovar: true
      },
      score: 0
    };
    return { recomendada: emptyResult, alternativas: [] };
  }

  const createIndividualEnfesto = (size: string, qtyNeeded: number, customCompMetros?: number): EnfestoPlanItem => {
    const pcsPerLayer = 1;
    const pcsPerPass = pcsPerLayer * fator;
    const passadas = Math.ceil(qtyNeeded / pcsPerPass);
    const prod = passadas * pcsPerPass;
    const exc = Math.max(0, prod - qtyNeeded);
    const compMetros = customCompMetros || 1.20;
    const consumoMetros = parseFloat((compMetros * passadas).toFixed(2));

    return {
      id: `enf-${size}-${Date.now()}`,
      titulo: `ENFESTO ${size}`,
      tamanhos: [size],
      risco_name: `Risco Individual (${size} = 1/camada)`,
      comprimento_metra: compMetros,
      peças_por_passada: { [size]: pcsPerPass },
      passadas,
      camadas_efetivas: passadas * fator,
      producao_por_tamanho: { [size]: prod },
      producao_total: prod,
      excedente_por_tamanho: { [size]: exc },
      excedente_total: exc,
      consumo_metros: consumoMetros
    };
  };

  const strategies: OptimizationStrategyResult[] = [];

  const separateEnfestos: EnfestoPlanItem[] = sizes.map(sz => createIndividualEnfesto(sz, demandMap[sz]));
  
  let sepTotalPlan = 0;
  let sepTotalExc = 0;
  let sepTotalPassadas = 0;
  let sepTotalCamadas = 0;
  let sepTotalMetros = 0;

  separateEnfestos.forEach(enf => {
    sepTotalPlan += enf.producao_total;
    sepTotalExc += enf.excedente_total;
    sepTotalPassadas += enf.passadas;
    sepTotalCamadas += enf.camadas_efetivas;
    sepTotalMetros += enf.consumo_metros;
  });

  const sepFaltante = Math.max(0, totalNecOverall - sepTotalPlan);
  const sepScore = sepFaltante * 1000 + sepTotalExc * 50 + sepTotalMetros * 10 + separateEnfestos.length * 5;

  let sepMotivo = 'Estratégia de enfestos individuais por tamanho para controle estrito de excedentes.';
  if (sizes.length === 2) {
    const q1 = demandMap[sizes[0]];
    const q2 = demandMap[sizes[1]];
    const diff = Math.abs(q1 - q2);
    if (diff >= 4) {
      sepMotivo = `${sizes[0]} (${q1}) e ${sizes[1]} (${q2}) foram separados porque as quantidades são muito diferentes e agrupá-los produziria excesso desnecessário de ${q1 < q2 ? sizes[0] : sizes[1]}.`;
    }
  }

  strategies.push({
    id: 'separado',
    name: 'SEPARAR TAMANHOS (RISCOS INDIVIDUAIS)',
    recomendada: false,
    motivo: sepMotivo,
    enfestos: separateEnfestos,
    resumo: {
      total_necessario: totalNecOverall,
      total_planejado: sepTotalPlan,
      total_faltante: sepFaltante,
      total_excedente: sepTotalExc,
      total_enfestos: separateEnfestos.length,
      total_passadas: sepTotalPassadas,
      total_camadas_efetivas: sepTotalCamadas,
      total_metros_previstos: parseFloat(sepTotalMetros.toFixed(2)),
      pode_aprovar: sepFaltante === 0
    },
    score: sepScore
  });

  if (agruparTamanhos && sizes.length > 1) {
    const gcdTubularOptions = generateGcdMarkerCandidates(demandMap, 'Tubular', fator);
    gcdTubularOptions.forEach((gcdOpt, gIdx) => {
      let combTotalPlan = 0;
      let combTotalExc = 0;
      let combTotalPassadas = 0;
      let combTotalCamadas = 0;
      let combTotalMetros = 0;
      const currentProdMap: { [sz: string]: number } = {};

      gcdOpt.enfestos.forEach(enf => {
        for (const [sz, prd] of Object.entries(enf.producao_por_tamanho)) {
          currentProdMap[sz] = (currentProdMap[sz] || 0) + prd;
        }
        combTotalPassadas += enf.passadas;
        combTotalCamadas += enf.camadas_efetivas;
        combTotalMetros += enf.consumo_metros;
      });

      sizes.forEach(sz => {
        const prd = currentProdMap[sz] || 0;
        const nec = demandMap[sz] || 0;
        combTotalPlan += prd;
        if (prd > nec) combTotalExc += (prd - nec);
      });

      const combFaltante = Math.max(0, totalNecOverall - combTotalPlan);
      const distinctMarkersCount = new Set(gcdOpt.enfestos.map(e => e.tamanhos.sort().join('+'))).size;
      const combScore = combFaltante * 100000 + distinctMarkersCount * 5000 + combTotalExc * 100 + combTotalMetros * 10 + gcdOpt.enfestos.length * 500;

      strategies.push({
        id: `agrupado-gcd-${gIdx}`,
        name: gcdOpt.name,
        recomendada: false,
        motivo: gcdOpt.motivo,
        enfestos: gcdOpt.enfestos,
        resumo: {
          total_necessario: totalNecOverall,
          total_planejado: combTotalPlan,
          total_faltante: combFaltante,
          total_excedente: combTotalExc,
          total_enfestos: gcdOpt.enfestos.length,
          total_passadas: combTotalPassadas,
          total_camadas_efetivas: combTotalCamadas,
          total_metros_previstos: parseFloat(combTotalMetros.toFixed(2)),
          pode_aprovar: combFaltante === 0
        },
        score: combScore
      });
    });

    const combinedEnfestos: EnfestoPlanItem[] = [];

    if (sizes.length === 2) {
      const s1 = sizes[0];
      const s2 = sizes[1];
      const q1 = demandMap[s1];
      const q2 = demandMap[s2];
      const minQty = Math.min(q1, q2);
      const maxQty = Math.max(q1, q2);
      const diff = maxQty - minQty;

      const pcsPerPassCombo = 1 * fator;
      const passadasCombo = Math.floor(minQty / pcsPerPassCombo);

      if (passadasCombo > 0) {
        const prodS1Combo = passadasCombo * pcsPerPassCombo;
        const prodS2Combo = passadasCombo * pcsPerPassCombo;
        const totalProdCombo = prodS1Combo + prodS2Combo;
        const compMetrosCombo = 1.80;

        combinedEnfestos.push({
          id: `enf-combo-${Date.now()}`,
          titulo: `ENFESTO MISTO (${s1} + ${s2})`,
          tamanhos: [s1, s2],
          risco_name: `Risco Misto (${s1}=1, ${s2}=1 /camada)`,
          comprimento_metra: compMetrosCombo,
          peças_por_passada: { [s1]: pcsPerPassCombo, [s2]: pcsPerPassCombo },
          passadas: passadasCombo,
          camadas_efetivas: passadasCombo * fator,
          producao_por_tamanho: { [s1]: prodS1Combo, [s2]: prodS2Combo },
          producao_total: totalProdCombo,
          excedente_por_tamanho: { [s1]: 0, [s2]: 0 },
          excedente_total: 0,
          consumo_metros: parseFloat((compMetrosCombo * passadasCombo).toFixed(2))
        });

        const remS1 = q1 - prodS1Combo;
        if (remS1 > 0) {
          combinedEnfestos.push(createIndividualEnfesto(s1, remS1));
        }
        const remS2 = q2 - prodS2Combo;
        if (remS2 > 0) {
          combinedEnfestos.push(createIndividualEnfesto(s2, remS2));
        }
      } else {
        combinedEnfestos.push(...sizes.map(sz => createIndividualEnfesto(sz, demandMap[sz])));
      }

      let combTotalPlan = 0;
      let combTotalExc = 0;
      let combTotalPassadas = 0;
      let combTotalCamadas = 0;
      let combTotalMetros = 0;

      const currentProdMap: { [sz: string]: number } = {};
      combinedEnfestos.forEach(enf => {
        for (const [sz, prd] of Object.entries(enf.producao_por_tamanho)) {
          currentProdMap[sz] = (currentProdMap[sz] || 0) + prd;
        }
        combTotalPassadas += enf.passadas;
        combTotalCamadas += enf.camadas_efetivas;
        combTotalMetros += enf.consumo_metros;
      });

      sizes.forEach(sz => {
        const prd = currentProdMap[sz] || 0;
        const nec = demandMap[sz] || 0;
        combTotalPlan += prd;
        if (prd > nec) combTotalExc += (prd - nec);
      });

      const combFaltante = Math.max(0, totalNecOverall - combTotalPlan);
      const combScore = combFaltante * 1000 + combTotalExc * 50 + combTotalMetros * 10 + combinedEnfestos.length * 5;

      let combMotivo = `${s1} e ${s2} foram agrupados porque possuem demandas próximas (${q1} e ${q2} un) e o risco combinado reduz operações e otimiza o encaixe.`;
      if (diff >= 4) {
        combMotivo = `Tentativa de risco misto (${s1}+${s2}), mas com alta diferença de demanda (${q1} vs ${q2}).`;
      }

      strategies.push({
        id: 'agrupado',
        name: 'AGRUPAR TAMANHOS PRÓXIMOS (RISCO MISTO + COMPLEMENTO)',
        recomendada: false,
        motivo: combMotivo,
        enfestos: combinedEnfestos,
        resumo: {
          total_necessario: totalNecOverall,
          total_planejado: combTotalPlan,
          total_faltante: combFaltante,
          total_excedente: combTotalExc,
          total_enfestos: combinedEnfestos.length,
          total_passadas: combTotalPassadas,
          total_camadas_efetivas: combTotalCamadas,
          total_metros_previstos: parseFloat(combTotalMetros.toFixed(2)),
          pode_aprovar: combFaltante === 0
        },
        score: combScore
      });
    }
  }

  strategies.sort((a, b) => a.score - b.score);
  if (strategies.length > 0) {
    strategies[0].recomendada = true;
  }

  return { recomendada: strategies[0], alternativas: strategies.slice(1) };
}
