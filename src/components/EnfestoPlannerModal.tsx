import React, { useState, useMemo, useEffect } from 'react';
import {
  Scissors,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  Ruler,
  Calendar,
  X,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Settings,
  BookOpen,
  Check,
  Edit2,
  RotateCcw,
  Printer
} from 'lucide-react';
import { CorteDemandItem } from '../types';
import { PrintableEnfestoSheetModal } from './PrintableEnfestoSheetModal';
import {
  TecidoTipo,
  RiscoConfig,
  OptimizationStrategyResult,
  ProducaoExcedenteItem,
  getFatorCamadasPorPassada,
  optimizeEnfestoPlan,
  saveRiscoConfig,
  getSavedRiscos,
  saveRamadoDecision,
  saveProducaoExcedente,
  saveApprovedEnfestoPlan,
  saveOptitexValidatedRisco,
  getOptitexValidatedRiscos,
  ApprovedEnfestoPlan,
  RamadoCandidatePlan
} from '../lib/enfestoUtils';

interface EnfestoPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupData: {
    model: string;
    fabric: string;
    color: string;
    items: CorteDemandItem[];
    totalPending: number;
    maxUrgency: string;
    ordersCount: number;
    pedidos_waiting?: { order_id: number; order_number?: string; customer_name?: string; quantity: number }[];
    description?: string;
  } | null;
}

// Standalone sub-component for Optitex Inputs to isolate local input state
interface OptitexInputFormProps {
  enfId: string;
  initialComp?: string;
  initialEff?: string;
  onSave: (comprimento: string, eficiencia: string) => void;
}

const OptitexInputForm: React.FC<OptitexInputFormProps> = ({
  initialComp = '',
  initialEff = '',
  onSave
}) => {
  const [comprimento, setComprimento] = useState(initialComp);
  const [eficiencia, setEficiencia] = useState(initialEff);

  useEffect(() => {
    if (initialComp) setComprimento(initialComp);
    if (initialEff) setEficiencia(initialEff);
  }, [initialComp, initialEff]);

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
      <p className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
        <Sparkles size={14} className="text-blue-600" /> Informar Resultado do Encaixe no Optitex:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
            Comprimento Real (m):
          </label>
          <input
            type="text"
            placeholder="ex: 2.70"
            value={comprimento}
            onChange={e => setComprimento(e.target.value)}
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
            Eficiência Optitex (%):
          </label>
          <input
            type="text"
            placeholder="ex: 82.50"
            value={eficiencia}
            onChange={e => setEficiencia(e.target.value)}
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
          />
        </div>

        <button
          type="button"
          onClick={() => onSave(comprimento, eficiencia)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 h-[38px]"
        >
          <Check size={14} /> [ SALVAR RESULTADO ]
        </button>
      </div>
    </div>
  );
};

export const EnfestoPlannerModal: React.FC<EnfestoPlannerModalProps> = ({
  isOpen,
  onClose,
  groupData
}) => {
  if (!isOpen || !groupData) return null;

  // Wizard Step state (1: Tipo Tecido, 2: Largura Útil, 3: Agrupar Tamanhos?, 4: Resultado)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // User input responses
  const [tipoTecido, setTipoTecido] = useState<TecidoTipo>('RAMADO');
  const [larguraUtil, setLarguraUtil] = useState<string>('1,60 m');
  const [agruparTamanhos, setAgruparTamanhos] = useState<boolean>(true);
  const [eficienciaMinimaInput, setEficienciaMinimaInput] = useState<string>('80,0');

  // Candidate selection index in Step 4
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState<number>(0);
  const [showWhyReason, setShowWhyReason] = useState<boolean>(false);
  const [userRejectedSurplus, setUserRejectedSurplus] = useState<boolean>(false);

  // Optitex Input Form state per enfesto ID
  const [optitexInputs, setOptitexInputs] = useState<{
    [enfId: string]: { comprimento: string; eficiencia: string }
  }>({});
  const [optitexSavedCount, setOptitexSavedCount] = useState<number>(0);

  // Printing state
  const [printingPlan, setPrintingPlan] = useState<ApprovedEnfestoPlan | null>(null);

  // Notification state
  const [notification, setNotification] = useState<string | null>(null);

  // Demand map by size
  const demandMap = useMemo(() => {
    const map: { [size: string]: number } = {};
    groupData.items.forEach(item => {
      if (item.total_necessario > 0) {
        map[item.size] = (map[item.size] || 0) + item.total_necessario;
      }
    });
    return map;
  }, [groupData]);

  const efMinimaNum = parseFloat(eficienciaMinimaInput.replace(',', '.')) || 80.0;

  // Run Optimization Engine
  const optimizationResults = useMemo(() => {
    const knownRiscos = getSavedRiscos();
    return optimizeEnfestoPlan({
      model: groupData.model,
      fabric: groupData.fabric,
      tipoTecido,
      larguraUtil,
      agruparTamanhos,
      demandMap,
      knownRiscos
    });
  }, [groupData, tipoTecido, larguraUtil, agruparTamanhos, demandMap, optitexSavedCount]);

  // Candidates list for RAMADO
  const ramadoCandidatas: RamadoCandidatePlan[] = useMemo(() => {
    if (optimizationResults.ramadoResult && optimizationResults.ramadoResult.candidatas.length > 0) {
      return optimizationResults.ramadoResult.candidatas;
    }
    return [];
  }, [optimizationResults]);

  // Active strategy shown in Step 4
  const activePlanCandidate: RamadoCandidatePlan | null = useMemo(() => {
    if (ramadoCandidatas.length > 0) {
      return ramadoCandidatas[selectedCandidateIdx] || ramadoCandidatas[0];
    }
    return null;
  }, [ramadoCandidatas, selectedCandidateIdx]);

  const fallbackActivePlan: OptimizationStrategyResult = useMemo(() => {
    if (activePlanCandidate) return activePlanCandidate;
    return optimizationResults.recomendada;
  }, [activePlanCandidate, optimizationResults]);

  // Reset wizard on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setShowWhyReason(false);
      setUserRejectedSurplus(false);
      setSelectedCandidateIdx(0);
      setOptitexInputs({});
    }
  }, [isOpen]);

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleDateString('pt-BR');
    } catch {
      return isoStr;
    }
  };

  // Helper to render piece representation visual text
  const renderVisualPiecesRepresentation = (peças: { [size: string]: number }) => {
    const tokens: string[] = [];
    Object.entries(peças).forEach(([sz, qty]) => {
      for (let i = 0; i < qty; i++) {
        tokens.push(sz);
      }
    });
    return tokens.join(' + ');
  };

  // Handle saving Optitex length and efficiency input
  const handleSaveOptitexResultDirect = (
    enfId: string,
    sizes: string[],
    composicao: { [size: string]: number },
    compStr: string,
    effStr: string
  ) => {
    if (!compStr || !effStr) {
      alert('Informe o Comprimento Real (m) e a Eficiência Optitex (%) antes de salvar.');
      return;
    }

    const comp = parseFloat(compStr.replace(',', '.'));
    const eff = parseFloat(effStr.replace(',', '.'));

    if (isNaN(comp) || comp <= 0) {
      alert('Comprimento real inválido. Informe um valor em metros (ex: 2.70).');
      return;
    }
    if (isNaN(eff) || eff <= 0 || eff > 100) {
      alert('Eficiência Optitex inválida. Informe um valor entre 1% e 100% (ex: 82.50).');
      return;
    }

    const optRecord = {
      model: groupData.model,
      fabric: groupData.fabric,
      largura_util: larguraUtil,
      tipo_tecido: tipoTecido,
      sizes,
      composicao,
      comprimento_real_metros: comp,
      eficiencia_optitex_pct: eff,
      status: 'VALIDADO' as const,
      user_name: 'Operador'
    };

    saveOptitexValidatedRisco(optRecord);
    setOptitexSavedCount(prev => prev + 1);

    try {
      fetch('/api/cutting/optitex-risco', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optRecord)
      });
    } catch (e) {}

    setNotification(`💡 Validação Optitex registrada: ${eff.toFixed(2)}% de eficiência (${comp.toFixed(2)}m) para Risco ${sizes.join('+')}`);
    setTimeout(() => setNotification(null), 3000);
  };

  const persistApprovedPlanRecord = async (
    planType: 'PLANO_EXATO' | 'PLANO_OTIMIZADO',
    planObj: OptimizationStrategyResult,
    excedenteMap?: { [size: string]: number } | null,
    excedenteTotal: number = 0,
    beneficioOperacional?: string | null
  ) => {
    const approvedRecord: ApprovedEnfestoPlan = {
      id: `plan-${groupData.model}-${groupData.fabric}-${groupData.color}-${Date.now()}`,
      model: groupData.model,
      fabric: groupData.fabric,
      color: groupData.color,
      tipoTecido,
      planType,
      planName: planObj.name,
      enfestos: planObj.enfestos,
      resumo: planObj.resumo,
      excedente_proposto: excedenteMap,
      excedente_total: excedenteTotal,
      beneficio_operacional: beneficioOperacional,
      user_name: 'Operador',
      created_at: new Date().toISOString(),
      status: 'PENDENTE_DE_CORTE',
      pedidos_inclusos: groupData.pedidos_waiting || [],
      descricao_item: groupData.description || `${groupData.model} ${groupData.fabric} ${groupData.color}`
    };

    saveApprovedEnfestoPlan(approvedRecord);

    try {
      await fetch('/api/cutting/approved-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvedRecord)
      });
    } catch (e) {}

    if (excedenteMap && excedenteTotal > 0) {
      Object.entries(excedenteMap).forEach(([sz, qty]) => {
        if (qty > 0) {
          const excItem: ProducaoExcedenteItem = {
            model: groupData.model,
            fabric: groupData.fabric,
            color: groupData.color,
            size: sz,
            quantidade: qty,
            origem: 'EXCEDENTE_DE_PRODUCAO',
            destino: 'ESTOQUE'
          };
          saveProducaoExcedente(excItem);
        }
      });
    }

    saveRamadoDecision({
      model: groupData.model,
      fabric: groupData.fabric,
      tipo_tecido: tipoTecido,
      decision: planType === 'PLANO_OTIMIZADO' ? 'APROVADO_OTIMIZADO' : 'MANTIDO_EXATO',
      plano_exato: optimizationResults.ramadoResult?.plano_exato || null,
      plano_otimizado: activePlanCandidate || null,
      excedente_proposto: excedenteMap,
      excedente_total: excedenteTotal,
      riscos_antes: optimizationResults.ramadoResult?.plano_exato.quantidade_riscos_distintos || 1,
      riscos_depois: activePlanCandidate?.quantidade_riscos_distintos || 1,
      ganho_operacional: beneficioOperacional || 'Plano aprovado pelo operador',
      user_id: 1,
      user_name: 'Operador'
    });
  };

  const handleApprovePlan = async () => {
    await persistApprovedPlanRecord(
      activePlanCandidate && activePlanCandidate.excedente_total > 0 ? 'PLANO_OTIMIZADO' : 'PLANO_EXATO',
      fallbackActivePlan,
      activePlanCandidate?.excedente_proposto,
      activePlanCandidate?.excedente_total || 0,
      activePlanCandidate?.beneficio_operacional
    );
    setNotification(`✅ Plano de Enfesto (${fallbackActivePlan.name}) APROVADO! Enviado para "Planos Aprovados de Enfesto".`);
    setTimeout(() => {
      setNotification(null);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-[130] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-slate-50 rounded-3xl max-w-7xl w-full h-[94vh] shadow-2xl overflow-hidden border border-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* ComfortPRO Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-blue-900/50">
          <div>
            <div className="flex items-center gap-2 text-blue-400 text-xs font-black tracking-widest uppercase">
              <Sparkles size={14} className="text-blue-400" /> COMFORTPRO — SIMULADOR & OTIMIZADOR DE ENFESTO
            </div>
            <h3 className="text-2xl sm:text-3xl font-black mt-0.5 tracking-tight text-white">{groupData.model}</h3>
            <p className="text-xs sm:text-sm text-blue-200 font-bold uppercase tracking-wide mt-1">
              Tecido: <span className="text-white">{groupData.fabric}</span> • Cor / Detalhamento: <span className="text-white bg-blue-900/60 px-2.5 py-1 rounded-lg border border-blue-700/60">{groupData.color}</span>
            </p>
            {(groupData.model.toLowerCase().includes('recorte') || groupData.color.toLowerCase().includes('recorte')) && (
              <div className="mt-2 text-xs bg-amber-500/20 border border-amber-400/40 text-amber-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <span>ATENÇÃO AO CORTE (CORPO & RECORTE): Verifique as cores do Tecido do Corpo e do Recorte/Painel ({groupData.color}) antes de montar os enfestos!</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block font-mono text-xs text-blue-200 bg-blue-900/40 p-3 rounded-2xl border border-blue-700/50">
              <p className="font-black text-white text-sm">{groupData.ordersCount} {groupData.ordersCount === 1 ? 'pedido' : 'pedidos'}</p>
              <p className="opacity-80 mt-0.5">Prazo limite: {formatDate(groupData.maxUrgency)}</p>
            </div>
            <button
              onClick={onClose}
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer shadow-sm"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Visual Progress Steps Bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between gap-2 overflow-x-auto font-sans text-xs font-bold">
          {[
            { num: 1, label: '1. Tipo Tecido' },
            { num: 2, label: '2. Largura Útil' },
            { num: 3, label: '3. Agrupamento' },
            { num: 4, label: '4. Candidatas & Eficiência Optitex' }
          ].map(s => {
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <div
                key={s.num}
                onClick={() => setStep(s.num as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-600/30'
                    : isDone
                    ? 'bg-blue-50 text-blue-900 font-bold border border-blue-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono ${isActive ? 'bg-white text-blue-950 font-black' : isDone ? 'bg-blue-200 text-blue-900' : 'bg-slate-200 text-slate-600'}`}>
                  {isDone ? '✓' : s.num}
                </span>
                <span className="whitespace-nowrap uppercase tracking-wider">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Demand Banner */}
        <div className="bg-blue-50/90 border-b border-blue-200/80 p-4 px-6 flex flex-wrap items-center justify-between gap-3 text-blue-950 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-blue-700" />
            <span className="text-sm">
              <strong>Demanda Total dos Pedidos:</strong> <strong className="text-blue-900 font-mono text-base">{groupData.totalPending} peças</strong>
            </span>
          </div>

          <div className="flex flex-wrap gap-2 font-mono">
            {Object.entries(demandMap).map(([sz, qty]) => (
              <span key={sz} className="px-3 py-1 bg-white rounded-xl border border-blue-300 font-black shadow-2xs text-xs">
                {sz}: <strong className="text-blue-700 text-sm">{qty} un</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Notification Alert */}
        {notification && (
          <div className="p-3.5 px-6 bg-emerald-50 text-emerald-950 text-xs font-bold border-b border-emerald-300 flex items-center gap-2.5 shadow-2xs">
            <CheckCircle2 size={18} className="text-emerald-700" /> {notification}
          </div>
        )}

        {/* Scrollable Wizard Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50">
          
          {/* STEP 1: TIPO DE TECIDO */}
          {step === 1 && (
            <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-xs font-black uppercase text-blue-600 tracking-widest block">
                  Etapa 1 de 4
                </span>
                <h4 className="text-xl font-black text-slate-900">Como este tecido será enfestado?</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div
                  onClick={() => setTipoTecido('TUBULAR')}
                  className={`p-6 rounded-2xl border-2 transition-all cursor-pointer space-y-4 ${
                    tipoTecido === 'TUBULAR'
                      ? 'border-blue-600 bg-white shadow-xl ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1.5 bg-blue-600 text-white font-black text-xs rounded-xl uppercase tracking-wider">
                      TUBULAR
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-900 bg-blue-100 px-3 py-1 rounded-lg">
                      Fator 2× por enfesto
                    </span>
                  </div>
                  <h5 className="font-black text-base text-slate-900">2 Camadas Efetivas Por Enfesto</h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    O tecido tubular possui duas camadas sobrepostas salvas automaticamente a cada passada do carro de enfesto.
                  </p>
                </div>

                <div
                  onClick={() => setTipoTecido('RAMADO')}
                  className={`p-6 rounded-2xl border-2 transition-all cursor-pointer space-y-4 ${
                    tipoTecido === 'RAMADO'
                      ? 'border-blue-600 bg-white shadow-xl ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1.5 bg-slate-900 text-white font-black text-xs rounded-xl uppercase tracking-wider">
                      RAMADO / ABERTO
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-900 bg-emerald-100 px-3 py-1 rounded-lg">
                      Otimização Geométria Optitex
                    </span>
                  </div>
                  <h5 className="font-black text-base text-slate-900">1 Camada Efetiva Por Enfesto</h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    O motor RAMADO busca composições ricas multi-peças e aceita a validação de comprimento real e eficiência do Optitex.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  Próxima Etapa <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: LARGURA ÚTIL */}
          {step === 2 && (
            <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-xs font-black uppercase text-blue-600 tracking-widest block">
                  Etapa 2 de 4
                </span>
                <h4 className="text-xl font-black text-slate-900">Qual a largura útil do tecido?</h4>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  Selecione a largura útil do tecido em metros.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {['1,20 m', '1,40 m', '1,60 m', '1,80 m'].map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLarguraUtil(l)}
                      className={`p-4 rounded-2xl border text-sm font-mono font-bold transition-all ${
                        larguraUtil === l
                          ? 'border-blue-600 bg-blue-600 text-white shadow-md font-black ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft size={18} /> Voltar
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  Próxima Etapa <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: AGRUPAR TAMANHOS & META DE EFICIÊNCIA */}
          {step === 3 && (
            <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-xs font-black uppercase text-blue-600 tracking-widest block">
                  Etapa 3 de 4
                </span>
                <h4 className="text-xl font-black text-slate-900">Configuração de Encaixe & Eficiência Optitex</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div
                  onClick={() => setAgruparTamanhos(true)}
                  className={`p-6 rounded-2xl border-2 transition-all cursor-pointer space-y-4 ${
                    agruparTamanhos
                      ? 'border-blue-600 bg-white shadow-xl ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="px-3 py-1.5 bg-emerald-600 text-white font-black text-xs rounded-xl uppercase tracking-wider">
                    SIM — Gerar Composições Ricas
                  </span>
                  <h5 className="font-black text-base text-slate-900">Composições Multi-Peças na Grade</h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    O sistema buscará combinações contendo múltiplas peças por camada (ex: 2P + 4M + 2G) para máxima oportunidade de encaixe no Optitex.
                  </p>
                </div>

                <div
                  onClick={() => setAgruparTamanhos(false)}
                  className={`p-6 rounded-2xl border-2 transition-all cursor-pointer space-y-4 ${
                    !agruparTamanhos
                      ? 'border-blue-600 bg-white shadow-xl ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="px-3 py-1.5 bg-slate-900 text-white font-black text-xs rounded-xl uppercase tracking-wider">
                    NÃO — Riscos Individuais
                  </span>
                  <h5 className="font-black text-base text-slate-900">Forçar Enfestos Separados por Tamanho</h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Cada tamanho será enfestado isoladamente em seu próprio risco.
                  </p>
                </div>
              </div>

              {/* Meta de Eficiência Desejada */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2">
                <label className="text-xs font-black uppercase text-slate-800 tracking-wider block">
                  Meta de Eficiência Mínima Desejada no Optitex (%):
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={eficienciaMinimaInput}
                    onChange={e => setEficienciaMinimaInput(e.target.value)}
                    className="w-32 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-black text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <span className="text-xs text-slate-500 font-medium">
                    Se o teste no Optitex ficar abaixo desta meta, o sistema exibirá um alerta e sugerirá a próxima composição candidata.
                  </span>
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft size={18} /> Voltar
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles size={18} /> Calcular Candidatas & Eficiência
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SELEÇÃO DE CANDIDATAS & VALIDAÇÃO OPTITEX */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* CANDIDATE COMPOSITIONS TABS (CANDIDATA 1, CANDIDATA 2, CANDIDATA 3) */}
              {tipoTecido === 'RAMADO' && ramadoCandidatas.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <span className="text-xs font-black uppercase text-blue-600 tracking-widest block">
                        COMPOSIÇÕES MATEMÁTICAS GERADAS
                      </span>
                      <h4 className="text-xl font-black text-slate-900">Selecione uma Candidata para Testar ou Aprovar</h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {ramadoCandidatas.map((cand, idx) => (
                        <button
                          key={cand.id || idx}
                          type="button"
                          onClick={() => setSelectedCandidateIdx(idx)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                            selectedCandidateIdx === idx
                              ? 'bg-blue-600 text-white shadow-md font-black ring-2 ring-blue-400'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 font-bold'
                          }`}
                        >
                          <span>CANDIDATA {idx + 1}</span>
                          {cand.recomendada && <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] rounded font-black">TOP</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ACTIVE CANDIDATE SUMMARY BANNER */}
                  {activePlanCandidate && (
                    <div className="p-6 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl shadow-xl space-y-4 border border-blue-800/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-800/60 pb-3">
                        <div>
                          <div className="flex items-center gap-2 font-black text-lg text-white">
                            <Sparkles size={20} className="text-blue-400" />
                            {activePlanCandidate.name}
                          </div>
                          <p className="text-xs text-blue-200 font-medium mt-1">{activePlanCandidate.motivo}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                          <span className="px-3 py-1 bg-emerald-950/80 text-emerald-300 rounded-lg border border-emerald-700/60 font-bold flex items-center gap-1">
                            Mesa: Máx 8 pcs/risco ✓
                          </span>
                          <span className="px-3 py-1 bg-blue-900/80 text-blue-200 rounded-lg border border-blue-700/60 font-bold">
                            {activePlanCandidate.quantidade_riscos_distintos} riscos diferentes
                          </span>
                          <span className="px-3 py-1 bg-blue-900/80 text-blue-200 rounded-lg border border-blue-700/60 font-bold">
                            {activePlanCandidate.resumo.total_passadas} enfestos totais
                          </span>
                          {activePlanCandidate.excedente_total > 0 && (
                            <span className="px-3 py-1 bg-emerald-600 text-white font-black rounded-lg">
                              +{activePlanCandidate.excedente_total} exc.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* LOW EFFICIENCY WARNING BANNER (Rule 10 & 11) */}
                      {activePlanCandidate.riscos_baixo_aproveitamento_count > 0 && (
                        <div className="p-4 bg-amber-500/20 border border-amber-400/50 text-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 font-bold">
                            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                            <span>
                              <strong>APROVEITAMENTO ABAIXO DA META:</strong> Um ou mais riscos validados ficaram com eficiência inferior a <strong>{efMinimaNum.toFixed(2)}%</strong>.
                            </span>
                          </div>

                          {ramadoCandidatas.length > selectedCandidateIdx + 1 && (
                            <button
                              type="button"
                              onClick={() => setSelectedCandidateIdx(selectedCandidateIdx + 1)}
                              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm shrink-0 cursor-pointer flex items-center gap-1.5"
                            >
                              <RotateCcw size={14} /> [ TESTAR PRÓXIMA OPÇÃO ]
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* DETALHAMENTO DE RISCOS & PAINEL DE VALIDAÇÃO OPTITEX (Rule 5 & 13) */}
              <div className="space-y-4">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Scissors size={16} className="text-blue-600" /> RISCOS DA COMPOSIÇÃO SELECIONADA
                </h5>

                <div className="space-y-4">
                  {(fallbackActivePlan?.enfestos || []).map((enf, idx) => {
                    const isLow = !!(enf.eficiencia_optitex_pct && enf.eficiencia_optitex_pct < efMinimaNum);

                    return (
                      <div
                        key={enf.id || idx}
                        className={`p-5 rounded-3xl border transition-all space-y-4 ${
                          isLow
                            ? 'bg-amber-50/70 border-amber-300 shadow-sm'
                            : enf.status_optitex === 'VALIDADO'
                            ? 'bg-white border-emerald-400 shadow-md ring-2 ring-emerald-500/10'
                            : 'bg-white border-slate-200 shadow-sm'
                        }`}
                      >
                        {/* Header of risk */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                              <span className="px-3 py-1 bg-blue-600 text-white font-mono text-xs font-black rounded-lg uppercase">
                                RISCO #{idx + 1}
                              </span>
                              <h5 className="font-mono text-base font-black text-slate-900">{enf.titulo}</h5>
                            </div>

                            {/* Representation of visual pieces (Rule 3 & 13) */}
                            <div className="flex flex-wrap gap-2 text-xs font-mono">
                              <span className="px-3 py-1 bg-blue-50 text-blue-950 font-black rounded-lg border border-blue-200">
                                📐 Moldes no Risco: {renderVisualPiecesRepresentation(enf.peças_por_passada)} ({Object.values(enf.peças_por_passada).reduce((a, b) => a + b, 0)} molde{Object.values(enf.peças_por_passada).reduce((a, b) => a + b, 0) > 1 ? 's' : ''}/camada)
                              </span>
                              <span className="px-3 py-1 bg-slate-100 text-slate-800 font-bold rounded-lg border border-slate-200">
                                📦 Total Cortado: {Object.entries(enf.producao_por_tamanho).map(([s, q]) => `${s}: ${q} un`).join(' | ')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 font-mono text-xs">
                            <span className="font-bold text-slate-900 bg-blue-100/70 text-blue-950 px-2.5 py-1 rounded-lg border border-blue-200">
                              {enf.passadas} passada(s) × {tipoTecido === 'TUBULAR' ? '2 camadas' : '1 camada'} = {enf.camadas_efetivas} camada(s) efetiva(s)
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="font-bold text-slate-900">{enf.consumo_metros}m consumo linear</span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center justify-between">
                          {enf.status_optitex === 'VALIDADO' ? (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black font-mono ${isLow ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>
                              <CheckCircle2 size={14} /> {isLow ? '⚠️ APROVEITAMENTO ABAIXO DA META' : 'RISCO VALIDADO NO OPTITEX'} ({enf.eficiencia_optitex_pct?.toFixed(2)}% • {enf.comprimento_real_metros || enf.comprimento_metra}m)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black font-mono bg-blue-100 text-blue-900 border border-blue-300">
                              <Info size={14} /> AGUARDANDO VALIDAÇÃO OPTITEX
                            </span>
                          )}
                        </div>

                        {/* Optitex Validation Form Component */}
                        <OptitexInputForm
                          enfId={enf.id}
                          initialComp={enf.comprimento_real_metros ? enf.comprimento_real_metros.toString() : ''}
                          initialEff={enf.eficiencia_optitex_pct ? enf.eficiencia_optitex_pct.toString() : ''}
                          onSave={(compStr, effStr) =>
                            handleSaveOptitexResultDirect(enf.id, enf.tamanhos, enf.peças_por_passada, compStr, effStr)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PLANO COMPLETO SUMMARY CARD (Rule 7, 8 & 14) */}
              {fallbackActivePlan?.resumo && (
                <div className="p-6 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl space-y-4 shadow-lg border border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h5 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-2">
                      <Ruler size={16} /> PLANO COMPLETO — RESUMO DE CONSUMO LINEAR & EFICIÊNCIA
                    </h5>

                    <span className="text-xs font-mono font-bold text-blue-300">
                      {fallbackActivePlan.resumo.todos_riscos_validados
                        ? '✅ Todos os riscos validados'
                        : '📐 Aguardando validação de riscos no Optitex'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-center font-mono">
                    <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Total Necessário</p>
                      <p className="text-xl font-black text-white mt-0.5">{fallbackActivePlan.resumo.total_necessario}</p>
                    </div>

                    <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Total Planejado</p>
                      <p className="text-xl font-black text-blue-400 mt-0.5">{fallbackActivePlan.resumo.total_planejado}</p>
                    </div>

                    <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Total Enfestos</p>
                      <p className="text-xl font-black text-white mt-0.5">{fallbackActivePlan.resumo.total_passadas}</p>
                    </div>

                    <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Consumo Linear Total</p>
                      <p className="text-xl font-black text-blue-300 mt-0.5">{fallbackActivePlan.resumo.total_metros_previstos} m</p>
                    </div>

                    <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 col-span-2">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Eficiência Média Ponderada</p>
                      <p className="text-xl font-black text-emerald-400 mt-0.5">
                        {fallbackActivePlan.resumo.eficiencia_media_ponderada_pct
                          ? `${fallbackActivePlan.resumo.eficiencia_media_ponderada_pct.toFixed(2)}%`
                          : 'Aguardando Optitex'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions step 4 */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft size={18} /> Refazer Perguntas
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!fallbackActivePlan) return;
                      const tempPlan: ApprovedEnfestoPlan = {
                        id: `temp-plan-${Date.now()}`,
                        model: groupData.model,
                        fabric: groupData.fabric,
                        color: groupData.color,
                        tipoTecido,
                        planType: activePlanCandidate && activePlanCandidate.excedente_total > 0 ? 'PLANO_OTIMIZADO' : 'PLANO_EXATO',
                        planName: fallbackActivePlan.name,
                        enfestos: fallbackActivePlan.enfestos,
                        resumo: fallbackActivePlan.resumo,
                        excedente_proposto: activePlanCandidate?.excedente_proposto || null,
                        excedente_total: activePlanCandidate?.excedente_total || 0,
                        beneficio_operacional: activePlanCandidate?.beneficio_operacional || null,
                        user_name: 'Operador',
                        created_at: new Date().toISOString(),
                        status: 'PENDENTE_DE_CORTE',
                        pedidos_inclusos: groupData.pedidos_waiting || [],
                        descricao_item: groupData.description || `${groupData.model} ${groupData.fabric} ${groupData.color}`
                      };
                      setPrintingPlan(tempPlan);
                    }}
                    className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Printer size={18} /> 🖨️ IMPRIMIR FICHA
                  </button>

                  <button
                    type="button"
                    onClick={handleApprovePlan}
                    disabled={!fallbackActivePlan?.resumo?.pode_aprovar}
                    className={`px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                      fallbackActivePlan?.resumo?.pode_aprovar
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 size={18} /> APROVAR PLANO SELECIONADO
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal de Impressão da Ficha de Corte */}
      <PrintableEnfestoSheetModal
        plan={printingPlan}
        isOpen={!!printingPlan}
        onClose={() => setPrintingPlan(null)}
      />
    </div>
  );
};
