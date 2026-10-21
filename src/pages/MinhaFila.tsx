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
  AlertTriangle,
  Flame,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Tag,
  ArrowRight
} from 'lucide-react';
import { formatSeconds, cn, isImage } from '../lib/utils';
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

  // Filters
  const [selectedStageId, setSelectedStageId] = useState<number | null>(
    currentUser?.default_stage_id ? Number(currentUser.default_stage_id) : null
  );
  const [selectedUserId, setSelectedUserId] = useState<number | null>(
    currentUser?.id || null
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiData, setApiData] = useState<{
    fila: any[];
    bloqueados: any[];
    execucao_atual: any | null;
    metricas: {
      pecas_pendentes_fila: number;
      tarefas_em_andamento: number;
      pecas_produzidas_hoje: number;
      tempo_produtivo_hoje_segundos: number;
    };
  } | null>(null);

  // Load queue data from dedicated endpoint
  const loadMinhaFila = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedUserId) params.set('user_id', String(selectedUserId));
      if (selectedStageId) params.set('stage_id', String(selectedStageId));

      const res = await safeFetch(`/api/pcp-phase1/minha-fila?${params.toString()}`);
      if (res && res.fila) {
        setApiData(res);
      }
    } catch (err) {
      console.error('[MinhaFila] Erro ao carregar dados da fila:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedUserId, selectedStageId, safeFetch]);

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

  // Active stages list
  const activeStages = useMemo(() => {
    return stages.filter(s => s.active === 1 || (s.active as any) === true);
  }, [stages]);

  // Active execution: from apiData or from activeExecutions
  const heroExecution = useMemo(() => {
    if (apiData?.execucao_atual) return apiData.execucao_atual;
    if (activeExecutions && activeExecutions.length > 0) {
      const ex = activeExecutions[0];
      const matchOrder = orders.find(o => o.id === ex.order_id);
      return {
        ...ex,
        order_number: matchOrder?.order_number || ex.order_number,
        client_name: matchOrder?.client_name || ex.client_name,
        product_type: matchOrder?.product_type || ex.product_type,
        print_type: matchOrder?.print_type,
        order_quantity: matchOrder?.quantity || ex.order_quantity,
        order_deadline: matchOrder?.deadline,
        order_art_url: matchOrder?.art_url || (matchOrder?.art_urls && matchOrder.art_urls[0]),
      };
    }
    return null;
  }, [apiData?.execucao_atual, activeExecutions, orders]);

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

  // Associated order for Hero Execution
  const heroOrder = useMemo(() => {
    if (!heroExecution) return null;
    return orders.find(o => o.id === heroExecution.order_id) || null;
  }, [heroExecution, orders]);

  // Filtered queue
  const displayFila = useMemo(() => {
    let list = apiData?.fila || [];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((item: any) => 
        item.order_number?.toLowerCase().includes(term) ||
        item.client_name?.toLowerCase().includes(term) ||
        item.product_type?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [apiData?.fila, searchTerm]);

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

  // Start Stage from queue card
  const handleStartCard = async (item: any) => {
    const stageId = item.current_stage_id;
    if (!stageId) return;

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
                onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
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

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Peças Pendentes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-black tracking-wider uppercase text-slate-400">
              Peças na Fila
            </span>
            <div className="text-2xl font-black text-slate-900">
              {apiData?.metricas?.pecas_pendentes_fila ?? 0}
            </div>
            <div className="text-[11px] font-semibold text-slate-500">
              {displayFila.length} pedidos aguardando
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

        {/* Metric 3: Peças Produzidas Hoje */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-black tracking-wider uppercase text-slate-400">
              Produzidas Hoje
            </span>
            <div className="text-2xl font-black text-emerald-600">
              {apiData?.metricas?.pecas_produzidas_hoje ?? 0}
            </div>
            <div className="text-[11px] font-semibold text-slate-500">
              Peças boas apontadas
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
              Horas registradas hoje
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
                    {heroExecution.order_quantity || 0} peças
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
            onClick={() => setSelectedStageId(null)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
              selectedStageId === null
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
              onClick={() => setSelectedStageId(st.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5",
                selectedStageId === st.id
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

              return (
                <div
                  key={item.id}
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
                            {item.quantity} peças
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] text-slate-500 font-semibold truncate">
                            {item.product_type} {item.print_type ? `(${item.print_type})` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stage status indicator */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold">
                        Etapa Atual:
                      </span>
                      <span className={cn(
                        "font-black text-[11px] uppercase tracking-wide",
                        item.current_stage_status === 'EM_ANDAMENTO' ? "text-emerald-600" :
                        item.current_stage_status === 'PAUSADA' ? "text-amber-600" :
                        item.current_stage_status === 'LIBERADA' ? "text-indigo-600" :
                        "text-slate-600"
                      )}>
                        {item.current_stage_status || 'Aguardando'}
                      </span>
                    </div>

                    {/* Observations if any */}
                    {item.observations && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 bg-slate-50 p-2 rounded-lg italic">
                        "{item.observations}"
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
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
                      <span>INICIAR ETAPA</span>
                    </button>
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
