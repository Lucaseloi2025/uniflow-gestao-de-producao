import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  Package, 
  Lock, 
  ShieldAlert, 
  Search, 
  RotateCw, 
  Layers, 
  Flame,
  Sparkles,
  ExternalLink,
  UserCheck,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Target
} from 'lucide-react';
import { formatSeconds, cn, isImage, getStageProductivityUnit } from '../lib/utils';
import type { Order, Stage, User, StageExecution } from '../types';

interface MinhaFilaProps {
  orders: Order[];
  stages: Stage[];
  users: User[];
  currentUser: User | null;
  activeExecutions: StageExecution[];
  setSelectedOrder: (order: Order) => void;
  handleStartStage: (stageId: number, customOrder?: Order) => Promise<void>;
  handlePauseStage: (executionId: number, stageId: number, customOrder?: Order) => Promise<void>;
  handleResumeStage: (executionId: number, customOrder?: Order) => Promise<void>;
  handleFinishStage: (executionId: number, stageId: number, customOrder?: Order) => Promise<void>;
  handleOpenProgressModal: (stageId: number, customOrder?: Order) => void;
  handleOpenActionModal: (type: 'pause' | 'finish', executionId: number, stageId: number, customOrder?: Order) => void;
  fetchData: () => Promise<void>;
  fetchExecutions: (orderId: number) => Promise<void>;
  fetchActiveExecution: () => Promise<void>;
  setSelectedFullImage: (url: string | null) => void;
  safeFetch: (url: string, options?: RequestInit) => Promise<any>;
}

export const MinhaFila: React.FC<MinhaFilaProps> = ({
  orders,
  stages,
  users,
  currentUser,
  activeExecutions,
  setSelectedOrder,
  handleStartStage,
  handlePauseStage,
  handleResumeStage,
  handleFinishStage,
  handleOpenProgressModal,
  handleOpenActionModal,
  fetchData,
  fetchExecutions,
  fetchActiveExecution,
  setSelectedFullImage,
  safeFetch
}) => {
  const isManager = currentUser?.role === 'Administrador' || currentUser?.role === 'Supervisor' || currentUser?.role === 'PCP';

  const getStageSlugClient = useCallback((stage: { id?: number; name?: string; sector_name?: string; slug?: string } | null | undefined): string => {
    if (!stage) return '';
    if ((stage as any).slug) return String((stage as any).slug).toUpperCase();
    const raw = String(stage.name || stage.sector_name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
    if (raw.includes('FICHA') || raw.includes('APROVACAO') || raw.includes('ARTE')) return 'FICHA_APROVACAO';
    if (raw.includes('CORTE')) return 'CORTE';
    if (raw.includes('SUBLIMACAO')) return 'SUBLIMACAO';
    if (raw.includes('ESTAMPAGEM') || raw.includes('ESTAMPARIA')) return 'ESTAMPAGEM';
    if (raw.includes('SILK') || raw.includes('SERIGRAFIA')) return 'SILK';
    if (raw.includes('DTF')) return 'DTF';
    if (raw.includes('BORDADO')) return 'BORDADO';
    if (raw.includes('COSTURA')) return 'COSTURA';
    if (raw.includes('REVISAO') || raw.includes('ACABAMENTO')) return 'REVISAO';
    if (raw.includes('EMBALAGEM') || raw.includes('EXPEDICAO')) return 'EMBALAGEM';
    if (raw.includes('CONFERENCIA')) return 'CONFERENCIA';
    return raw.replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || `STAGE_${stage.id || 0}`;
  }, []);

  // Active stages list (excluding legacy Conferência)
  const activeStages = useMemo(() => {
    return stages
      .filter(s => (s.active === 1 || (s.active as any) === true) && getStageSlugClient(s) !== 'CONFERENCIA' && Number(s.id) !== 12)
      .map(s => ({
        ...s,
        slug: getStageSlugClient(s),
      }));
  }, [stages, getStageSlugClient]);

  // Filters
  const [selectedStageSlug, setSelectedStageSlug] = useState<string>(() => {
    if (currentUser?.default_stage_id) {
      const st = stages.find(s => Number(s.id) === Number(currentUser.default_stage_id));
      if (st) return getStageSlugClient(st);
    }
    return 'ALL';
  });
  const [selectedUserId, setSelectedUserId] = useState<number | null>(
    currentUser?.id || null
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTimelineKeys, setExpandedTimelineKeys] = useState<Record<string, boolean>>({});
  const [selectedPerfStageId, setSelectedPerfStageId] = useState<number | null>(null);

  const [apiData, setApiData] = useState<{
    fila: any[];
    bloqueados: any[];
    execucao_atual: any | null;
    desempenho_hoje?: any;
    linha_do_tempo_horaria?: any[];
    metricas: {
      pecas_pendentes_fila: number;
      tarefas_em_andamento: number;
      pecas_produzidas_hoje: number;
      tempo_produtivo_hoje_segundos: number;
      tempo_pausas_hoje_segundos?: number;
      unidade_codigo?: string;
      unidade_singular?: string;
      unidade_plural?: string;
      unidade_fila_label?: string;
      unidade_hoje_label?: string;
      fila_por_unidade?: Record<string, number>;
    };
  } | null>(null);

  // Load queue data from dedicated endpoint
  const loadMinhaFila = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedUserId) params.set('user_id', String(selectedUserId));
      params.set('stage_slug', selectedStageSlug || 'ALL');
      if (selectedStageSlug && selectedStageSlug !== 'ALL') {
        const matchedSt = activeStages.find(s => s.slug === selectedStageSlug);
        if (matchedSt) params.set('stage_id', String(matchedSt.id));
      } else {
        params.set('all', '1');
      }

      const res = await safeFetch(`/api/pcp-phase1/minha-fila?${params.toString()}`);
      if (res && Array.isArray(res.fila)) {
        setApiData(res);
      }
    } catch (err) {
      console.error('[MinhaFila] Erro ao carregar dados da fila:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedUserId, selectedStageSlug, activeStages, safeFetch]);

  useEffect(() => {
    loadMinhaFila();
  }, [loadMinhaFila]);

  // Immediate reload on global execution actions
  useEffect(() => {
    const handleReload = () => {
      loadMinhaFila();
    };
    window.addEventListener('reload-minha-fila', handleReload);
    return () => window.removeEventListener('reload-minha-fila', handleReload);
  }, [loadMinhaFila]);

  // Periodic polling every 20 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      loadMinhaFila();
    }, 20000);
    return () => clearInterval(timer);
  }, [loadMinhaFila]);

  // Active execution: from apiData or from activeExecutions
  const heroExecution = useMemo(() => {
    if (apiData?.execucao_atual) return apiData.execucao_atual;
    if (activeExecutions && activeExecutions.length > 0) {
      const ex = activeExecutions[0];
      const matchOrder = orders.find(o => o.id === ex.order_id) || (apiData?.fila || []).find((f: any) => f.id === ex.order_id);
      const matchStage = matchOrder?.stages_status?.find((s: any) => Number(s.id) === Number(ex.stage_id)) ||
                         stages.find(s => Number(s.id) === Number(ex.stage_id));
      const unitInfo = getStageProductivityUnit(matchStage || { id: ex.stage_id, name: ex.stage_name });
      const qPrevista = unitInfo.isPerOrderUnit
        ? 1
        : (Number((matchStage as any)?.quantidade_prevista || (matchStage as any)?.quantidade_pedido || matchOrder?.quantity || ex.order_quantity) || 0);
      const qConcluida = unitInfo.isPerOrderUnit
        ? ((matchStage as any)?.finished ? 1 : Math.min(1, Number((matchStage as any)?.quantidade_boa) || 0))
        : (Number((matchStage as any)?.quantidade_boa) || 0);
      const sRestante = Math.max(0, qPrevista - qConcluida);
      return {
        ...ex,
        unidade_produtividade: unitInfo.unit,
        unidade_singular: unitInfo.singular,
        unidade_plural: unitInfo.plural,
        order_pieces_quantity: Number(matchOrder?.quantity || ex.order_quantity) || 0,
        order_number: matchOrder?.order_number || ex.order_number,
        client_name: matchOrder?.client_name || ex.client_name,
        product_type: matchOrder?.product_type || ex.product_type,
        print_type: matchOrder?.print_type,
        order_quantity: qPrevista,
        quantidade_prevista: qPrevista,
        quantidade_concluida: qConcluida,
        saldo_restante: sRestante,
        order_deadline: matchOrder?.deadline,
        order_art_url: matchOrder?.art_url || (matchOrder?.art_urls && matchOrder.art_urls[0]),
        stages_status: matchOrder?.stages_status || [],
      };
    }
    return null;
  }, [apiData?.execucao_atual, apiData?.fila, activeExecutions, orders, stages]);

  // Live timer for hero execution
  const [timerSeconds, setTimerSeconds] = useState(0);

  useEffect(() => {
    if (!heroExecution) {
      setTimerSeconds(0);
      return;
    }
    setTimerSeconds(heroExecution.total_time_seconds || 0);

    if (heroExecution.is_paused || heroExecution.status === 'Pausado') {
      return;
    }

    const interval = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [heroExecution]);

  // Associated order for Hero Execution (always builds a valid Order object so modals NEVER fail to open)
  const heroOrder = useMemo<Order | null>(() => {
    if (!heroExecution) return null;
    const existing = orders.find(o => Number(o.id) === Number(heroExecution.order_id)) ||
                     (apiData?.fila || []).find((f: any) => Number(f.id) === Number(heroExecution.order_id));

    const qPrevista = Number(heroExecution.quantidade_prevista ?? heroExecution.order_quantity ?? existing?.quantity) || 0;
    const qConcluida = Number(heroExecution.quantidade_concluida) || 0;
    const sRestante = Number(heroExecution.saldo_restante ?? Math.max(0, qPrevista - qConcluida));
    const orderPiecesQty = Number(heroExecution.order_pieces_quantity || existing?.quantity || qPrevista) || 0;

    const baseStages = Array.isArray(heroExecution.stages_status) && heroExecution.stages_status.length > 0
      ? heroExecution.stages_status
      : (Array.isArray(existing?.stages_status) ? existing.stages_status : []);

    const hasTargetStage = baseStages.some((s: any) => Number(s.id) === Number(heroExecution.stage_id));
    const syncedStages = hasTargetStage
      ? baseStages.map((s: any) => Number(s.id) === Number(heroExecution.stage_id)
          ? {
              ...s,
              quantidade_pedido: qPrevista,
              quantidade_prevista: qPrevista,
              quantidade_boa: qConcluida,
              saldo_pendente: sRestante,
              finished: false,
              status_operacao: heroExecution.is_paused ? 'PAUSADA' : 'EM_ANDAMENTO',
            }
          : s)
      : [
          ...baseStages,
          {
            id: Number(heroExecution.stage_id),
            name: heroExecution.stage_name || 'Etapa',
            finished: false,
            status: 'Em andamento',
            status_operacao: heroExecution.is_paused ? 'PAUSADA' : 'EM_ANDAMENTO',
            quantidade_pedido: qPrevista,
            quantidade_prevista: qPrevista,
            quantidade_boa: qConcluida,
            saldo_pendente: sRestante,
          },
        ];

    if (existing) {
      return {
        ...existing,
        quantity: orderPiecesQty,
        stages_status: syncedStages,
      } as Order;
    }

    return {
      id: Number(heroExecution.order_id),
      order_number: heroExecution.order_number || String(heroExecution.order_id),
      client_name: heroExecution.client_name || 'Cliente',
      product_type: heroExecution.product_type || 'Produto',
      print_type: heroExecution.print_type || '',
      quantity: orderPiecesQty,
      deadline: heroExecution.order_deadline || '',
      status: 'Em produção',
      art_url: heroExecution.order_art_url || '',
      observations: '',
      total_time_seconds: Number(heroExecution.total_time_seconds) || 0,
      estimated_time_seconds: 0,
      items: heroExecution.order_items || [],
      stages_status: syncedStages,
    } as unknown as Order;
  }, [heroExecution, orders, apiData?.fila]);

  // Filtered queue (only orders with active, executable current stage matching selectedStageSlug)
  const displayFila = useMemo(() => {
    let list = (apiData?.fila || []).filter((item: any) => {
      if (!item.current_stage_id || item.status === 'Pronto' || item.status === 'Entregue' || item.status === 'Cancelado') {
        return false;
      }
      if (Number(item.quantidade_prevista || item.quantity) > 0 && Number(item.saldo_restante ?? item.quantity) <= 0) {
        return false;
      }
      if (selectedStageSlug && selectedStageSlug !== 'ALL') {
        const itemSlug = item.current_stage_slug || getStageSlugClient({ id: item.current_stage_id, name: item.current_stage_name });
        if (itemSlug !== selectedStageSlug) return false;
      }
      return true;
    });
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((item: any) => 
        item.order_number?.toLowerCase().includes(term) ||
        item.client_name?.toLowerCase().includes(term) ||
        item.product_type?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [apiData?.fila, selectedStageSlug, searchTerm, getStageSlugClient]);

  // Filtered blocked
  const displayBloqueados = useMemo(() => {
    let list = apiData?.bloqueados || [];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((item: any) => 
        item.order_number?.toLowerCase().includes(term) ||
        item.client_name?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [apiData?.bloqueados, searchTerm]);

  // Operator list for managers
  const operatorUsers = useMemo(() => {
    return users.filter(u => u.active);
  }, [users]);

  // Performance & Unit Context Resolution
  const activeStageMeta = useMemo(() => {
    if (selectedStageSlug && selectedStageSlug !== 'ALL') {
      return activeStages.find(s => s.slug === selectedStageSlug) || null;
    }
    return null;
  }, [selectedStageSlug, activeStages]);

  const activeUnitInfo = useMemo(() => {
    if (activeStageMeta) {
      return getStageProductivityUnit(activeStageMeta);
    }
    if (apiData?.desempenho_hoje) {
      const dh = apiData.desempenho_hoje;
      return getStageProductivityUnit({
        id: dh.stage_id,
        name: dh.stage_name,
        slug: dh.stage_slug,
        unidade_produtividade: dh.unidade_codigo as any,
      });
    }
    return getStageProductivityUnit(null);
  }, [activeStageMeta, apiData?.desempenho_hoje]);

  const porEtapaHojeList: any[] = useMemo(() => {
    return Array.isArray(apiData?.desempenho_hoje?.por_etapa_hoje)
      ? apiData!.desempenho_hoje.por_etapa_hoje
      : [];
  }, [apiData?.desempenho_hoje]);

  const currentPerfView = useMemo(() => {
    const dh = apiData?.desempenho_hoje;
    if (!dh) return null;
    if (selectedPerfStageId && Array.isArray(dh.por_etapa_hoje)) {
      const match = dh.por_etapa_hoje.find((e: any) => Number(e.stage_id) === Number(selectedPerfStageId));
      if (match) {
        return {
          ...dh,
          ...match,
        };
      }
    }
    return dh;
  }, [apiData?.desempenho_hoje, selectedPerfStageId]);

  const timelineBuckets = useMemo(() => {
    const raw = Array.isArray(apiData?.linha_do_tempo_horaria) ? apiData!.linha_do_tempo_horaria : [];
    if (selectedPerfStageId && selectedStageSlug === 'ALL') {
      return raw.filter((b: any) => Number(b.stage_id) === Number(selectedPerfStageId));
    }
    return raw;
  }, [apiData?.linha_do_tempo_horaria, selectedPerfStageId, selectedStageSlug]);

  // Start Stage from queue card
  const handleStartCard = async (item: any) => {
    const stageId = item.current_stage_id;
    if (!stageId) return;

    if (item.can_start === false || item.current_stage_status === 'EM_ANDAMENTO' || item.current_stage_status === 'PAUSADA') {
      return;
    }

    if (heroExecution && (heroExecution.status === 'Em andamento' || !heroExecution.is_paused)) {
      const confirmSwitch = window.confirm(
        `Você já possui uma tarefa em andamento (#${heroExecution.order_number} - ${heroExecution.stage_name}).\n\nDeseja iniciar #${item.order_number} mesmo assim?`
      );
      if (!confirmSwitch) return;
    }

    const fullOrder = orders.find(o => o.id === item.id) || item;
    await handleStartStage(stageId, fullOrder);
    await loadMinhaFila();
  };

  // Formal Supervisor / PCP Transfer or Intervention
  const handleTransferCard = async (item: any) => {
    const stageId = item.current_stage_id;
    if (!stageId || !isManager) return;

    const motivo = window.prompt(
      `A etapa ${item.current_stage_name} do pedido #${item.order_number} está vinculada a ${item.active_operator_name || 'outro operador'}.\n\nInforme a justificativa obrigatória para transferir/intervir na execução:`
    );
    if (!motivo || !motivo.trim()) return;

    try {
      const res = await safeFetch('/api/executions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: item.id,
          stage_id: stageId,
          user_id: currentUser?.id,
          supervisor_override: true,
          motivo: motivo.trim(),
        }),
      });
      if (res && !res.error) {
        await fetchActiveExecution();
        await fetchData();
        await loadMinhaFila();
      } else {
        alert(res?.error || 'Não foi possível transferir a etapa.');
      }
    } catch (err: any) {
      alert(err?.message || 'Erro ao transferir execução.');
    }
  };

  const toggleTimelineExpand = (key: string) => {
    setExpandedTimelineKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedOperatorObj = useMemo(() => {
    if (!selectedUserId) return currentUser;
    return users.find(u => Number(u.id) === Number(selectedUserId)) || currentUser;
  }, [selectedUserId, users, currentUser]);

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-slate-50/60 p-4 md:p-8 space-y-6">
      {/* Top Header & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <Layers size={22} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Minha Fila de Produção
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Execução operacional orientada a prioridade crítica e prazo de entrega
              </p>
            </div>
          </div>
        </div>

        {/* Manager Operator Selector & Refresh */}
        <div className="flex items-center gap-3">
          {isManager && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <UserCheck size={16} className="text-indigo-600" />
              <label htmlFor="select-operador" className="text-xs font-bold text-slate-600 hidden sm:inline">Operador:</label>
              <select
                id="select-operador"
                value={selectedUserId || ''}
                onChange={(e) => {
                  setSelectedUserId(e.target.value ? Number(e.target.value) : null);
                  setSelectedPerfStageId(null);
                }}
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="">Todos os Operadores</option>
                {operatorUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => {
              loadMinhaFila();
              fetchData();
              fetchActiveExecution();
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
            title="Atualizar fila"
          >
            <RotateCw size={14} className={cn(isLoading && "animate-spin text-indigo-600")} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {/* Painel Compacto: Meu Desempenho — Hoje & Linha do Tempo da Produção (Itens 3 e 4) */}
      {currentPerfView && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Target size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-black text-slate-900">
                    Meu desempenho — Hoje
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black">
                    {currentPerfView.stage_name} ({currentPerfView.unidade_plural})
                  </span>
                  {selectedOperatorObj && (
                    <span className="text-xs font-bold text-slate-500">
                      • {selectedOperatorObj.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Se o operador atuou em múltiplas etapas/unidades hoje, permite alternar sem somar unidades diferentes */}
            {porEtapaHojeList.length > 1 && selectedStageSlug === 'ALL' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Etapa/Unidade:</span>
                {porEtapaHojeList.map((et: any) => {
                  const isSel = Number(currentPerfView.stage_id) === Number(et.stage_id);
                  return (
                    <button
                      key={et.stage_id}
                      type="button"
                      onClick={() => setSelectedPerfStageId(Number(et.stage_id))}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                        isSel
                          ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {et.stage_name}: {et.realizado_hoje} {et.unidade_plural}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Coluna Esquerda: Meta, Realizado, Barra de Progresso e Projeção */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                    {currentPerfView.realizado_hoje}{' '}
                    <span className="text-lg font-bold text-slate-500">
                      de {currentPerfView.meta_diaria} {currentPerfView.unidade_plural}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Meta por hora: <strong className="text-slate-800">{currentPerfView.meta_por_hora} {currentPerfView.hour_suffix || `${currentPerfView.unidade_plural}/h`}</strong>
                    {currentPerfView.ritmo_atual_por_hora > 0 && (
                      <> • Ritmo atual: <strong className="text-indigo-700">{currentPerfView.ritmo_atual_por_hora} {currentPerfView.hour_suffix || `${currentPerfView.unidade_plural}/h`}</strong></>
                    )}
                  </p>
                </div>

                <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100">
                  {currentPerfView.percentual_meta}% da meta concluída
                </span>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    currentPerfView.percentual_meta >= 100
                      ? "bg-emerald-500"
                      : currentPerfView.ritmo_status === 'ABAIXO'
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, Number(currentPerfView.percentual_meta) || 0))}%` }}
                />
              </div>

              {/* Projeção do Dia & Status do Ritmo */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700">
                    {currentPerfView.projecao_texto}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black",
                      currentPerfView.ritmo_status === 'ACIMA'
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : currentPerfView.ritmo_status === 'DENTRO'
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : currentPerfView.ritmo_status === 'ABAIXO'
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-slate-200/70 text-slate-600"
                    )}
                  >
                    <TrendingUp size={13} />
                    {currentPerfView.ritmo_label}
                  </span>
                </div>
                {Number(apiData?.desempenho_hoje?.tempo_pausas_segundos) > 0 && (
                  <p className="text-[11px] font-semibold text-slate-500">
                    Intervalos/pausas descontados no cálculo: {formatSeconds(Number(apiData?.desempenho_hoje?.tempo_pausas_segundos) || 0)}
                  </p>
                )}
              </div>
            </div>

            {/* Coluna Direita: Linha do Tempo da Produção por Hora */}
            <div className="lg:col-span-6 space-y-2.5 lg:border-l lg:border-slate-100 lg:pl-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock size={14} className="text-indigo-600" />
                  Linha do tempo da produção
                </h3>
                <span className="text-[11px] font-semibold text-slate-400">
                  Intervalos de 1 hora
                </span>
              </div>

              {timelineBuckets.length === 0 ? (
                <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4 text-xs font-semibold text-slate-400 text-center">
                  Nenhum apontamento concluído hoje nesta etapa até o momento.
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {timelineBuckets.map((bucket: any) => {
                    const bKey = `${bucket.hora_inicio}_${bucket.stage_id}`;
                    const isExpanded = Boolean(expandedTimelineKeys[bKey]);
                    return (
                      <div
                        key={bKey}
                        className="bg-slate-50/90 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 px-3.5 py-2.5 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs md:text-sm">
                            <span className="font-mono font-black text-indigo-950 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                              {bucket.intervalo}
                            </span>
                            <span className="text-slate-400">—</span>
                            <span className="font-bold text-slate-800">
                              {bucket.resumo_texto}
                            </span>
                          </div>

                          {bucket.multiplos_pedidos && (
                            <button
                              type="button"
                              onClick={() => toggleTimelineExpand(bKey)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer shrink-0"
                            >
                              <span>{isExpanded ? 'Ocultar' : 'Expandir'}</span>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          )}
                        </div>

                        {isExpanded && Array.isArray(bucket.pedidos) && bucket.pedidos.length > 1 && (
                          <div className="mt-2 pt-2 border-t border-slate-200/70 space-y-1.5 pl-2">
                            {bucket.pedidos.map((p: any, pIdx: number) => (
                              <div key={`${p.order_id}_${pIdx}`} className="flex items-center justify-between text-xs text-slate-700">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11px] text-slate-400">{p.horario}</span>
                                  <span className="font-black text-slate-900">#{p.order_number}</span>
                                  <span className="text-slate-500 truncate max-w-[160px]">{p.client_name}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                    {p.stage_name}
                                  </span>
                                </div>
                                <span className="font-mono font-black text-emerald-700">
                                  {p.quantidade} {p.unidade_label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Unidades Pendentes na Fila */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-black tracking-wider uppercase text-slate-400">
              {apiData?.metricas?.unidade_fila_label || activeUnitInfo.queueLabel || 'Peças na Fila'}
            </span>
            <div className="text-2xl font-black text-slate-900">
              {apiData?.metricas?.pecas_pendentes_fila ?? 0}
            </div>
            <div className="text-[11px] font-semibold text-slate-500">
              {displayFila.length} pedidos aguardando ({apiData?.metricas?.unidade_plural || activeUnitInfo.plural})
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Package size={24} />
          </div>
        </div>

        {/* Metric 2: Tarefa em Andamento */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-black tracking-wider uppercase text-slate-400">
              Tarefa Atual
            </span>
            <div className="flex items-center gap-2">
              {heroExecution ? (
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wide",
                  heroExecution.is_paused || heroExecution.status === 'Pausado'
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                )}>
                  {heroExecution.is_paused || heroExecution.status === 'Pausado' ? "Pausada" : "Em Execução"}
                </span>
              ) : (
                <span className="text-sm font-bold text-slate-400">
                  Livre
                </span>
              )}
            </div>
            <div className="text-[11px] font-semibold text-slate-600 truncate max-w-[130px]">
              {heroExecution ? `#${heroExecution.order_number} - ${heroExecution.stage_name}` : "Pronto para iniciar"}
            </div>
          </div>
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            heroExecution
              ? (heroExecution.is_paused || heroExecution.status === 'Pausado' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")
              : "bg-slate-100 text-slate-400"
          )}>
            <Play size={24} className={cn(heroExecution && !heroExecution.is_paused && "animate-pulse")} />
          </div>
        </div>

        {/* Metric 3: Produzidas Hoje (Unidade da Etapa) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-black tracking-wider uppercase text-slate-400">
              {apiData?.metricas?.unidade_hoje_label || activeUnitInfo.todayLabel || 'Produzidas Hoje'}
            </span>
            <div className="text-2xl font-black text-emerald-600">
              {apiData?.metricas?.pecas_produzidas_hoje ?? 0}
            </div>
            <div className="text-[11px] font-semibold text-slate-500">
              {apiData?.metricas?.unidade_plural || activeUnitInfo.plural} apontados hoje
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Metric 4: Tempo Produtivo Hoje */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-black tracking-wider uppercase text-slate-400">
              Tempo Produtivo
            </span>
            <div className="text-2xl font-black text-indigo-950 font-mono">
              {formatSeconds(apiData?.metricas?.tempo_produtivo_hoje_segundos ?? 0)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500">
              Horas líquidas hoje
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Clock size={24} />
          </div>
        </div>
      </div>

      {/* Hero Card: Execução em Foco (If Active Task Exists) */}
      {heroExecution && (
        <div className={cn(
          "bg-white rounded-2xl border-2 p-6 shadow-lg transition-all",
          heroExecution.is_paused || heroExecution.status === 'Pausado'
            ? "border-amber-400/80 bg-amber-50/20"
            : "border-emerald-500/80 bg-emerald-50/15"
        )}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Execution Info */}
            <div className="flex items-start gap-4">
              {/* Art thumbnail */}
              {heroExecution.order_art_url && isImage(heroExecution.order_art_url) ? (
                <button
                  type="button"
                  onClick={() => setSelectedFullImage(heroExecution.order_art_url)}
                  className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white shadow-sm shrink-0 hover:scale-105 transition-transform"
                >
                  <img
                    src={heroExecution.order_art_url}
                    alt="Arte do Pedido"
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                  <Package size={26} />
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm",
                    heroExecution.is_paused || heroExecution.status === 'Pausado'
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-600 text-white"
                  )}>
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    {heroExecution.is_paused || heroExecution.status === 'Pausado' ? "Etapa Pausada" : "Etapa em Andamento"}
                  </span>

                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-black">
                    {heroExecution.stage_name}
                  </span>

                  <span className="text-xs text-slate-500 font-bold">
                    Operador: {currentUser?.name || 'Você'}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    #{heroExecution.order_number}
                  </h2>
                  <span className="text-slate-400">•</span>
                  <span className="text-base font-bold text-slate-700">
                    {heroExecution.client_name}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                  <span className="font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                    {heroExecution.product_type || 'Produto'}
                  </span>
                  {heroExecution.print_type && (
                    <span className="font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                      {heroExecution.print_type}
                    </span>
                  )}
                  <span className="font-bold text-slate-900">
                    {heroExecution.quantidade_prevista || heroExecution.order_quantity || 0}{' '}
                    {(heroExecution.quantidade_prevista || heroExecution.order_quantity) === 1
                      ? (heroExecution.unidade_singular || 'unidade')
                      : (heroExecution.unidade_plural || 'peças')}
                    {heroExecution.unidade_produtividade === 'ficha' && heroExecution.order_pieces_quantity > 0 && (
                      <span className="text-slate-500 font-medium ml-1">
                        (Pedido: {heroExecution.order_pieces_quantity} pçs)
                      </span>
                    )}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black">
                    Concluídas: {heroExecution.quantidade_concluida ?? 0}/{heroExecution.quantidade_prevista ?? heroExecution.order_quantity ?? 0}{' '}
                    {heroExecution.unidade_plural || 'peças'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-black">
                    Restantes: {heroExecution.saldo_restante ?? Math.max(0, (heroExecution.quantidade_prevista || heroExecution.order_quantity || 0) - (heroExecution.quantidade_concluida || 0))}{' '}
                    {heroExecution.unidade_plural || 'peças'}
                  </span>
                  {heroOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(heroOrder);
                        fetchExecutions(heroOrder.id);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 underline underline-offset-2 ml-1"
                    >
                      <ExternalLink size={12} />
                      Ver Ficha Técnica
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Center: Live Timer */}
            <div className="flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm px-6 py-3.5 rounded-2xl border border-slate-200/90 shadow-inner">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                Tempo Acumulado
              </span>
              <div className="text-3xl lg:text-4xl font-black text-slate-900 font-mono tracking-tight">
                {formatSeconds(timerSeconds)}
              </div>
              <span className="text-[11px] font-bold text-slate-500 mt-0.5">
                {heroExecution.is_paused || heroExecution.status === 'Pausado' ? "Pausa registrada" : "Contador ativo"}
              </span>
            </div>

            {/* Right: Touch-Friendly Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Pausar ou Retomar */}
              {heroExecution.is_paused || heroExecution.status === 'Pausado' ? (
                <button
                  type="button"
                  onClick={async () => {
                    await handleResumeStage(heroExecution.id, heroOrder || undefined);
                    await loadMinhaFila();
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer"
                >
                  <Play size={18} fill="currentColor" />
                  <span>RETOMAR</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (heroOrder) {
                      handleOpenActionModal('pause', heroExecution.id, heroExecution.stage_id, heroOrder);
                    } else {
                      await handlePauseStage(heroExecution.id, heroExecution.stage_id, heroOrder || undefined);
                      await loadMinhaFila();
                    }
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-sm shadow-md shadow-amber-200 transition-all cursor-pointer"
                >
                  <Pause size={18} />
                  <span>PAUSAR</span>
                </button>
              )}

              {/* Apontar Parcial */}
              <button
                type="button"
                onClick={() => {
                  handleOpenProgressModal(heroExecution.stage_id, heroOrder || undefined);
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-sm shadow-md shadow-indigo-200 transition-all cursor-pointer"
              >
                <Layers size={18} />
                <span>APONTAR</span>
              </button>

              {/* Finalizar */}
              <button
                type="button"
                onClick={async () => {
                  if (heroExecution.is_paused || heroExecution.status === 'Pausado') {
                    alert("A etapa está pausada. Clique em RETOMAR antes de finalizar.");
                    return;
                  }
                  if (heroOrder) {
                    handleOpenActionModal('finish', heroExecution.id, heroExecution.stage_id, heroOrder);
                  } else {
                    await handleFinishStage(heroExecution.id, heroExecution.stage_id, heroOrder || undefined);
                    await loadMinhaFila();
                  }
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-black text-sm shadow-md shadow-slate-300 transition-all cursor-pointer"
              >
                <CheckCircle2 size={18} />
                <span>FINALIZAR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar: Stage Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Stage Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
          <button
            type="button"
            onClick={() => {
              setSelectedStageSlug('ALL');
              setSelectedPerfStageId(null);
            }}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
              selectedStageSlug === 'ALL'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Todas as Etapas
          </button>
          {activeStages.map(st => (
            <button
              key={st.id}
              type="button"
              onClick={() => {
                setSelectedStageSlug(st.slug);
                setSelectedPerfStageId(Number(st.id));
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5",
                selectedStageSlug === st.slug
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <span>{st.name}</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nº do pedido ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Prioritized Queue List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Fila Priorizada de Atendimento
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black">
              {displayFila.length}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            Ordenado automaticamente por prazo crítico e prioridade do PCP
          </span>
        </div>

        {displayFila.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Sparkles size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Nenhum pedido pendente nesta etapa
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Todos os pedidos elegíveis estão em execução ou foram concluídos. Excelente ritmo de produção!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayFila.map((item: any, idx: number) => {
              const fullOrder = orders.find(o => o.id === item.id) || item;
              const isFirstInQueue = idx === 0;
              const isOverdue = item.urgencia === 'critica';
              const isToday = item.urgencia === 'alta';
              const itemUnitPlural = item.unidade_plural || 'peças';
              const itemUnitSingular = item.unidade_singular || 'peça';
              const itemOrderPieces = Number(item.order_pieces_quantity ?? item.quantity) || 0;

              return (
                <div
                  key={`${item.id}_${item.current_stage_id}`}
                  className={cn(
                    "bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md",
                    isFirstInQueue ? "border-indigo-400/90 ring-2 ring-indigo-500/10" : "border-slate-200/90"
                  )}
                >
                  <div className="space-y-3">
                    {/* Priority Header Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5",
                        isOverdue
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : isToday
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                      )}>
                        {isOverdue && <Flame size={12} className="text-rose-600" />}
                        {item.justificativa || `${idx + 1}º na Fila`}
                      </span>

                      {/* Current Stage Pill */}
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-black">
                        {item.current_stage_name}
                      </span>
                    </div>

                    {/* Order Identifier & Client */}
                    <div className="flex items-start gap-3">
                      {item.art_url && isImage(item.art_url) ? (
                        <button
                          type="button"
                          onClick={() => setSelectedFullImage(item.art_url)}
                          className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shrink-0 hover:scale-105 transition-transform"
                        >
                          <img
                            src={item.art_url}
                            alt="Arte"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <Package size={22} />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrder(fullOrder);
                            fetchExecutions(fullOrder.id);
                          }}
                          className="text-left font-black text-slate-900 text-base hover:text-indigo-600 transition-colors truncate block w-full"
                        >
                          #{item.order_number}
                        </button>
                        <p className="text-xs font-semibold text-slate-600 truncate">
                          {item.client_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] font-black text-slate-900">
                            {itemOrderPieces} peças
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] text-slate-500 font-semibold truncate">
                            {item.product_type} {item.print_type ? `(${item.print_type})` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stage status indicator + Progresso e Saldo */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="text-slate-400">Etapa:</span>
                          <span className="text-slate-800">{item.current_stage_name || 'Etapa'}</span>
                        </div>
                        <span className={cn(
                          "font-black text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-md border",
                          item.current_stage_status === 'EM_ANDAMENTO' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          item.current_stage_status === 'PAUSADA' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          item.current_stage_status === 'PARCIAL' ? "bg-blue-50 text-blue-700 border-blue-200" :
                          item.current_stage_status === 'LIBERADA' ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                          "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                          {item.current_stage_status || 'Aguardando'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                        <span className="font-bold text-slate-600">
                          Concluídas:{' '}
                          <strong className="text-emerald-700">
                            {item.quantidade_concluida ?? 0}/{item.quantidade_prevista ?? item.quantity}{' '}
                            {(item.quantidade_prevista ?? item.quantity) === 1 ? itemUnitSingular : itemUnitPlural}
                          </strong>
                        </span>
                        <span className="font-bold text-slate-600">
                          Restantes:{' '}
                          <strong className="text-indigo-700">
                            {item.saldo_restante ?? item.quantity}{' '}
                            {(item.saldo_restante ?? item.quantity) === 1 ? itemUnitSingular : itemUnitPlural}
                          </strong>
                        </span>
                      </div>

                      {(item.current_stage_status === 'EM_ANDAMENTO' || item.current_stage_status === 'PAUSADA') && item.active_operator_name && (
                        <div className="text-[11px] font-bold text-slate-600 flex items-center gap-1 pt-0.5">
                          <UserCheck size={12} className="text-indigo-600 shrink-0" />
                          <span>Em execução por: <strong className="text-slate-900">{item.active_operator_name}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Observations if any */}
                    {item.observations && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 bg-slate-50 p-2 rounded-lg italic">
                        "{item.observations}"
                      </p>
                    )}
                  </div>

                  {/* Actions (Mutually Exclusive by Execution State & Ownership) */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(fullOrder);
                        fetchExecutions(fullOrder.id);
                      }}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all"
                    >
                      Detalhes
                    </button>

                    {(item.current_stage_status === 'EM_ANDAMENTO' || item.current_stage_status === 'PAUSADA') ? (
                      (item.is_owned_by_current_user || Number(item.active_operator_id) === Number(currentUser?.id)) ? (
                        <>
                          {item.current_stage_status === 'PAUSADA' ? (
                            <button
                              type="button"
                              onClick={async () => {
                                if (item.active_execution_id) {
                                  await handleResumeStage(item.active_execution_id, fullOrder);
                                  await loadMinhaFila();
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-black text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all cursor-pointer"
                            >
                              <Play size={13} fill="currentColor" />
                              <span>RETOMAR</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (item.active_execution_id) {
                                  handleOpenActionModal('pause', item.active_execution_id, item.current_stage_id, fullOrder);
                                }
                              }}
                              className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl font-black text-xs text-white bg-amber-500 hover:bg-amber-600 shadow-sm transition-all cursor-pointer"
                            >
                              <Pause size={13} />
                              <span>PAUSAR</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenProgressModal(item.current_stage_id, fullOrder)}
                            className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl font-black text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
                          >
                            <Layers size={13} />
                            <span>APONTAR</span>
                          </button>

                          {item.current_stage_status !== 'PAUSADA' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (item.active_execution_id) {
                                  handleOpenActionModal('finish', item.active_execution_id, item.current_stage_id, fullOrder);
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl font-black text-xs text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-all cursor-pointer"
                            >
                              <CheckCircle2 size={13} />
                              <span>FINALIZAR</span>
                            </button>
                          )}
                        </>
                      ) : isManager ? (
                        <button
                          type="button"
                          onClick={() => handleTransferCard(item)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-black text-xs text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-all cursor-pointer"
                        >
                          <UserCheck size={14} />
                          <span>Transferir / Intervir</span>
                        </button>
                      ) : (
                        <span className="flex-1 text-center px-3 py-2 rounded-xl bg-slate-100 text-slate-500 font-bold text-[11px]">
                          Em execução por {item.active_operator_name || 'outro operador'}
                        </span>
                      )
                    ) : item.can_start !== false ? (
                      <button
                        type="button"
                        onClick={() => handleStartCard(item)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-xs text-white shadow-sm transition-all cursor-pointer",
                          isFirstInQueue
                            ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                            : "bg-slate-900 hover:bg-slate-800"
                        )}
                      >
                        <Play size={14} fill="currentColor" />
                        <span>{item.current_stage_status === 'PARCIAL' ? 'CONTINUAR ETAPA' : 'INICIAR ETAPA'}</span>
                      </button>
                    ) : (
                      <span className="flex-1 text-center px-3 py-2 rounded-xl bg-slate-100 text-slate-400 font-bold text-[11px]">
                        Aguardando liberação
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dedicated Blocked Orders Section */}
      <div className="rounded-2xl border-2 border-rose-300 bg-rose-50/30 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-200 shrink-0">
            <ShieldAlert size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-rose-950 tracking-tight">
                Etapas Bloqueadas pelo PCP
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-900 text-xs font-black">
                {displayBloqueados.length} retidos
              </span>
            </div>
            <p className="text-xs text-rose-700 font-medium">
              Pedidos com restrições de insumos, aprovações pendentes ou bloqueio operacional. Ações temporariamente suspensas.
            </p>
          </div>
        </div>

        {displayBloqueados.length === 0 ? (
          <div className="bg-white/80 rounded-xl p-4 text-center text-xs font-semibold text-slate-500 border border-rose-200/50">
            Nenhum pedido bloqueado no momento. Fluxo totalmente liberado!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayBloqueados.map((item: any) => {
              const fullOrder = orders.find(o => o.id === item.id) || item;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-rose-200 p-4 space-y-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-black text-slate-900">
                        #{item.order_number}
                      </span>
                      <p className="text-xs font-bold text-slate-600 truncate">
                        {item.client_name}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-black uppercase">
                      Bloqueado
                    </span>
                  </div>

                  {/* Motivo do Bloqueio */}
                  <div className="bg-rose-50 border border-rose-200/80 rounded-lg p-2.5 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-rose-900 font-bold">
                      <Lock size={12} className="text-rose-600" />
                      <span>Motivo: {item.motivo_bloqueio || 'Bloqueio PCP'}</span>
                    </div>
                    {item.block_info?.observacao && (
                      <p className="text-[11px] text-rose-700 italic">
                        "{item.block_info.observacao}"
                      </p>
                    )}
                    {item.bloqueado_por && (
                      <div className="text-[10px] text-rose-500 font-medium">
                        Por: {item.bloqueado_por}
                      </div>
                    )}
                  </div>

                  {/* Disabled Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(fullOrder);
                        fetchExecutions(fullOrder.id);
                      }}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Ver Pedido
                    </button>
                    <button
                      type="button"
                      disabled
                      title={`Ação bloqueada pelo PCP: ${item.motivo_bloqueio}`}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed opacity-75"
                    >
                      <Lock size={12} />
                      <span>INÍCIO BLOQUEADO</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
