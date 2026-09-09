import React, { useState, useMemo, useEffect } from 'react';
import {
  Scissors,
  Calendar,
  PackageCheck,
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Layers,
  History,
  Sparkles,
  ArrowRight,
  UserCheck,
  Info,
  ExternalLink,
  Ruler,
  Check,
  Printer,
  Trash2,
  Edit2
} from 'lucide-react';
import { Order, User, CorteDemandItem, CorteAllocationLog } from '../types';
import { aggregateCuttingDemand, sortSizes } from '../lib/cuttingUtils';
import { EnfestoPlannerModal } from './EnfestoPlannerModal';
import { PrintableEnfestoSheetModal } from './PrintableEnfestoSheetModal';
import {
  ApprovedEnfestoPlan,
  getApprovedEnfestoPlans,
  updateApprovedPlanStatus,
  deleteApprovedEnfestoPlan
} from '../lib/enfestoUtils';

interface ConsolidatedCuttingPanelProps {
  orders: Order[];
  users: User[];
  currentUser: User | null;
  onRefresh: () => void;
  onSelectOrder?: (order: Order) => void;
}

export const ConsolidatedCuttingPanel: React.FC<ConsolidatedCuttingPanelProps> = ({
  orders,
  users,
  currentUser,
  onRefresh,
  onSelectOrder
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'demand' | 'approved_plans' | 'history'>('demand');
  const [searchTerm, setSearchTerm] = useState('');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'urgency' | 'quantity' | 'orders_count'>('urgency');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // State for Planejamento de Enfesto Modal
  const [selectedGroupForPlanner, setSelectedGroupForPlanner] = useState<{
    model: string;
    fabric: string;
    color: string;
    items: CorteDemandItem[];
    totalPending: number;
    maxUrgency: string;
    ordersCount: number;
  } | null>(null);

  // Modal State for registering cut
  const [selectedItemForCut, setSelectedItemForCut] = useState<CorteDemandItem | null>(null);
  const [cutQuantityInput, setCutQuantityInput] = useState<string>('');
  const [selectedOperatorId, setSelectedOperatorId] = useState<number>(currentUser?.id || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [printingPlan, setPrintingPlan] = useState<ApprovedEnfestoPlan | null>(null);
  const [approvedPlans, setApprovedPlans] = useState<ApprovedEnfestoPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  // Allocation history state
  const [allocationLogs, setAllocationLogs] = useState<CorteAllocationLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Map of approved plans indexed by model+fabric+color to quickly identify existing plans
  const approvedPlansByGroupKey = useMemo(() => {
    const map = new Map<string, ApprovedEnfestoPlan>();
    approvedPlans.forEach(p => {
      const key = `${(p.model || '').trim().toLowerCase()}_${(p.fabric || '').trim().toLowerCase()}_${(p.color || '').trim().toLowerCase()}`;
      map.set(key, p);
    });
    return map;
  }, [approvedPlans]);

  // Fetch approved plans (combining local storage and remote API)
  const fetchApprovedPlans = async () => {
    setIsLoadingPlans(true);
    try {
      const local = getApprovedEnfestoPlans();
      let remote: ApprovedEnfestoPlan[] = [];
      try {
        const res = await fetch('/api/cutting/approved-plans');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) remote = data;
        }
      } catch (e) {}

      const map = new Map<string, ApprovedEnfestoPlan>();
      remote.forEach(p => map.set(p.id, p));
      local.forEach(p => map.set(p.id, p));

      setApprovedPlans(Array.from(map.values()));
    } finally {
      setIsLoadingPlans(false);
    }
  };

  // Delete approved plan
  const handleDeleteApprovedPlan = async (planId: string, model: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o plano de enfesto aprovado para "${model}"?`)) {
      deleteApprovedEnfestoPlan(planId);
      try {
        await fetch(`/api/cutting/approved-plans/${planId}`, { method: 'DELETE' });
      } catch (e) {}
      await fetchApprovedPlans();
      onRefresh();
    }
  };

  // Fetch allocation audit logs
  const fetchAllocationLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/cutting/allocations');
      if (res.ok) {
        const data = await res.json();
        setAllocationLogs(data || []);
      }
    } catch (e) {
      console.warn('Erro ao carregar histórico de alocações:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchApprovedPlans();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'history') {
      fetchAllocationLogs();
    } else if (activeSubTab === 'approved_plans') {
      fetchApprovedPlans();
    }
  }, [activeSubTab]);

  const handleOpenPlannerModal = (group: {
    model: string;
    fabric: string;
    color: string;
    items: CorteDemandItem[];
    totalPending: number;
    maxUrgency: string;
    ordersCount: number;
  }) => {
    setSelectedGroupForPlanner(group);
  };

  // Aggregate corte demand dynamically from active orders
  const allDemandItems = useMemo(() => {
    return aggregateCuttingDemand(orders);
  }, [orders]);

  // Filtered & sorted demand items
  const filteredDemandItems = useMemo(() => {
    let result = [...allDemandItems];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        item =>
          item.item_key.toLowerCase().includes(term) ||
          item.product_type.toLowerCase().includes(term) ||
          item.color.toLowerCase().includes(term) ||
          item.size.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term)
      );
    }

    if (modelFilter !== 'all') {
      result = result.filter(item => item.product_type.toLowerCase() === modelFilter.toLowerCase());
    }

    if (sortBy === 'urgency') {
      result.sort((a, b) => a.prazo_mais_proximo.localeCompare(b.prazo_mais_proximo));
    } else if (sortBy === 'quantity') {
      result.sort((a, b) => b.total_necessario - a.total_necessario);
    } else if (sortBy === 'orders_count') {
      result.sort((a, b) => b.pedidos_count - a.pedidos_count);
    }

    return result;
  }, [allDemandItems, searchTerm, modelFilter, sortBy]);

  // Metric summaries
  const totalPiecesNeeded = useMemo(() => {
    return allDemandItems.reduce((acc, item) => acc + item.total_necessario, 0);
  }, [allDemandItems]);

  const totalWaitingOrdersCount = useMemo(() => {
    const orderSet = new Set<number>();
    allDemandItems.forEach(item => {
      item.pedidos_waiting.forEach(w => orderSet.add(w.order_id));
    });
    return orderSet.size;
  }, [allDemandItems]);

  const earliestOverallDeadline = useMemo(() => {
    if (allDemandItems.length === 0) return null;
    return allDemandItems[0].prazo_mais_proximo;
  }, [allDemandItems]);

  // Available models for dropdown filter
  const availableModels = useMemo(() => {
    const modelsSet = new Set<string>();
    allDemandItems.forEach(item => modelsSet.add(item.product_type));
    return Array.from(modelsSet);
  }, [allDemandItems]);

  // Open cut modal
  const handleOpenCutModal = (item: CorteDemandItem) => {
    setSelectedItemForCut(item);
    setCutQuantityInput(item.total_necessario.toString());
    const matchedUser = users.find(u => u.id === currentUser?.id) || users[0];
    if (matchedUser) setSelectedOperatorId(matchedUser.id);
  };

  // Live preview calculation for registration modal
  const liveAllocationPreview = useMemo(() => {
    if (!selectedItemForCut) return [];
    const cutQty = parseInt(cutQuantityInput, 10) || 0;
    if (cutQty <= 0) return [];

    let remaining = cutQty;
    return selectedItemForCut.pedidos_waiting.map(ord => {
      const needed = ord.qty_corte_pending;
      const alloc = Math.min(remaining, needed);
      remaining -= alloc;
      const newAllocated = ord.qty_corte_allocated + alloc;
      const isComplete = newAllocated >= ord.qty_corte_needed;
      return {
        ...ord,
        preview_alloc: alloc,
        preview_new_allocated: newAllocated,
        is_complete: isComplete
      };
    });
  }, [selectedItemForCut, cutQuantityInput]);

  // Submit cut registration handler
  const handleConfirmCutRegistration = async () => {
    if (!selectedItemForCut) return;
    const cutQty = parseInt(cutQuantityInput, 10);
    if (isNaN(cutQty) || cutQty <= 0) {
      setNotification({ type: 'error', message: 'Digite uma quantidade válida maior que 0.' });
      return;
    }

    setIsSubmitting(true);
    setNotification(null);

    const selectedOperator = users.find(u => u.id === selectedOperatorId) || currentUser;

    try {
      const res = await fetch('/api/cutting/register-consolidated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_key: selectedItemForCut.item_key,
          quantidade_cortada: cutQty,
          user_id: selectedOperatorId,
          user_name: selectedOperator?.name || 'Operador'
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setNotification({ type: 'error', message: data.error || 'Erro ao registrar produção de corte.' });
        setIsSubmitting(false);
        return;
      }

      setNotification({
        type: 'success',
        message: `Sucesso! ${data.total_allocated} peças de ${selectedItemForCut.item_key} alocadas entre ${data.affected_order_ids.length} pedido(s).`
      });

      setTimeout(() => {
        setSelectedItemForCut(null);
        setNotification(null);
        onRefresh();
        fetchApprovedPlans();
      }, 1200);

    } catch (err: any) {
      setNotification({ type: 'error', message: 'Erro na comunicação com o servidor.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper date formatters
  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  const getUrgencyBadge = (isoStr?: string) => {
    if (!isoStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const deadline = new Date(isoStr);
    deadline.setHours(0, 0, 0, 0);

    const diffDays = Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-600 text-white animate-pulse">
          <AlertTriangle size={12} /> Atrasado ({Math.abs(diffDays)}d)
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-blue-600 text-white font-mono">
          <Clock size={12} /> Vence Hoje
        </span>
      );
    } else if (diffDays <= 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
          Vence em {diffDays} dias
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          Prazo: {formatDate(isoStr)}
        </span>
      );
    }
  };

  const [viewMode, setViewMode] = useState<'management' | 'operator'>('operator');

  // Group demand items by Modelo + Tecido + Cor (Operator View)
  const operatorGroupedCards = useMemo(() => {
    const groups: {
      [key: string]: {
        model: string;
        fabric: string;
        color: string;
        items: CorteDemandItem[];
        totalPending: number;
        maxUrgency: string;
        ordersCount: number;
      }
    } = {};

    allDemandItems.forEach(item => {
      const key = `${item.product_type}__${item.fabric}__${item.color}`;
      if (!groups[key]) {
        groups[key] = {
          model: item.product_type,
          fabric: item.fabric,
          color: item.color,
          items: [],
          totalPending: 0,
          maxUrgency: item.prazo_mais_proximo,
          ordersCount: 0
        };
      }
      groups[key].items.push(item);
      groups[key].totalPending += item.total_necessario;

      if (item.prazo_mais_proximo.localeCompare(groups[key].maxUrgency) < 0) {
        groups[key].maxUrgency = item.prazo_mais_proximo;
      }
    });

    Object.values(groups).forEach(grp => {
      const orderMap = new Map<number, { order_id: number; order_number?: string; customer_name?: string; quantity: number }>();
      grp.items.forEach(it => {
        it.pedidos_waiting.forEach(w => {
          const existing = orderMap.get(w.order_id);
          if (existing) {
            existing.quantity += w.quantity;
          } else {
            orderMap.set(w.order_id, {
              order_id: w.order_id,
              order_number: w.order_number || `#${w.order_id}`,
              customer_name: w.customer_name || 'Cliente',
              quantity: w.quantity
            });
          }
        });
      });
      grp.ordersCount = orderMap.size;
      (grp as any).pedidos_waiting = Array.from(orderMap.values());
      (grp as any).description = grp.items[0]?.description || `${grp.model} ${grp.fabric} ${grp.color}`;
    });

    return Object.values(groups).sort((a, b) => a.maxUrgency.localeCompare(b.maxUrgency));
  }, [allDemandItems]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header & Sub-Tabs Navigation (ComfortPRO Blue Identity) */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-blue-900/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-400 text-xs font-black tracking-widest uppercase mb-1">
              <Scissors size={18} className="text-blue-400" /> COMFORTPRO — SISTEMA DE CORTE INTELIGENTE
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Painel de Corte Consolidado</h2>
            <p className="text-blue-200/90 text-sm mt-1 max-w-2xl">
              Gerencie demandas, elabore planos de enfesto com excedente estratégico e consulte planos aprovados.
            </p>
          </div>

          {/* Subtabs Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-blue-800/50 backdrop-blur-md self-start md:self-auto font-sans">
            <button
              onClick={() => setActiveSubTab('demand')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'demand'
                  ? 'bg-blue-600 text-white shadow-md font-black'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Scissors size={14} /> Demanda de Corte
            </button>

            <button
              onClick={() => setActiveSubTab('approved_plans')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'approved_plans'
                  ? 'bg-blue-600 text-white shadow-md font-black'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <CheckCircle2 size={14} /> Planos Aprovados ({approvedPlans.length})
            </button>

            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'history'
                  ? 'bg-blue-600 text-white shadow-md font-black'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <History size={14} /> Histórico de Alocações
            </button>
          </div>
        </div>
      </div>

      {/* SUBTAB 1: DEMANDA DE CORTE */}
      {activeSubTab === 'demand' && (
        <div className="space-y-6">
          
          {/* Summary Metric Cards */}
          <div className="bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900 rounded-3xl p-6 text-white shadow-lg space-y-4 border border-blue-800/40">
            <div className="flex items-center justify-between border-b border-blue-800/60 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-300 block">
                  META E STATUS OPERACIONAL
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">Corte de Hoje</h3>
              </div>
              <span className="px-3 py-1 bg-blue-900/60 border border-blue-700/60 rounded-full text-xs font-mono font-bold text-blue-200">
                {new Date().toLocaleDateString('pt-BR')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900/70 p-4 rounded-2xl border border-blue-900/60">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-300/90">Total Pendente de Corte</p>
                <p className="text-3xl font-black font-mono mt-1 text-white">{totalPiecesNeeded} <span className="text-sm font-sans font-normal text-blue-200">peças</span></p>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-2xl border border-blue-900/60">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-300/90">Modelos/Cores Pendentes</p>
                <p className="text-3xl font-black font-mono mt-1 text-white">{operatorGroupedCards.length} <span className="text-sm font-sans font-normal text-blue-200">lotes</span></p>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-2xl border border-blue-900/60">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-300/90">Pedidos Impactados</p>
                <p className="text-3xl font-black font-mono mt-1 text-white">{totalWaitingOrdersCount} <span className="text-sm font-sans font-normal text-blue-200">pedidos</span></p>
              </div>
            </div>
          </div>

          {/* Cards de Lotes em Grade */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Scissors className="text-blue-600" size={20} /> PRÓXIMOS CORTES RECOMENDADOS (LOTES CONSOLIDADOS)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {operatorGroupedCards.map(group => {
                const existingApprovedPlan = approvedPlansByGroupKey.get(
                  `${(group.model || '').trim().toLowerCase()}_${(group.fabric || '').trim().toLowerCase()}_${(group.color || '').trim().toLowerCase()}`
                );

                return (
                  <div
                    key={`${group.model}-${group.fabric}-${group.color}`}
                    className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between space-y-4 ${
                      existingApprovedPlan
                        ? 'border-emerald-300 shadow-md ring-2 ring-emerald-500/10'
                        : 'border-slate-200 shadow-sm hover:border-blue-500'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-black text-lg text-slate-900 leading-tight">{group.model}</h4>
                          <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mt-0.5">
                            Tecido: {group.fabric} • Cor: {group.color}
                          </p>
                          {group.items[0]?.description && (
                            <p className="text-[11px] font-medium text-slate-700 bg-blue-50/70 px-2.5 py-1.5 rounded-lg border border-blue-200 mt-1">
                              📋 <strong>Detalhamento do Pedido:</strong> {group.items[0].description}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {getUrgencyBadge(group.maxUrgency)}
                          {existingApprovedPlan && (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-950 font-mono font-black text-[10px] rounded-lg border border-emerald-300 flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 size={12} className="text-emerald-600" /> PLANO CRIADO
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notificação visual de plano existente para evitar duplicação */}
                      {existingApprovedPlan && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 font-medium gap-2">
                          <span className="flex items-center gap-1.5 font-bold truncate">
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> Plano de enfesto já aprovado para este lote
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveSubTab('approved_plans')}
                            className="text-[11px] font-black text-emerald-800 underline hover:text-emerald-950 cursor-pointer shrink-0"
                          >
                            Ver Plano
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div className="px-3.5 py-1.5 bg-blue-600 text-white font-mono font-black text-sm rounded-xl border border-blue-700 shadow-2xs">
                          {group.totalPending} peças pendentes
                        </div>
                        <span className="text-xs font-bold text-slate-500 font-mono">
                          {group.ordersCount} {group.ordersCount === 1 ? 'pedido' : 'pedidos'}
                        </span>
                      </div>

                      {/* Grade compacta */}
                      <div className="pt-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">
                          Grade Necessária:
                        </span>
                        <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                          {[...group.items].sort((a, b) => {
                            const sorted = sortSizes([a.size, b.size]);
                            return sorted[0] === a.size ? -1 : 1;
                          }).map(it => (
                            <span key={it.size} className={`px-2 py-0.5 rounded-lg border font-bold ${it.size === 'Tamanho não informado' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                              {it.size} <strong className="text-blue-700">{it.total_necessario}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenPlannerModal(group)}
                        className={`flex-1 py-3 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                          existingApprovedPlan
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {existingApprovedPlan ? (
                          <>
                            <Edit2 size={15} /> REVISAR / RECALCULAR PLANO (JÁ APROVADO)
                          </>
                        ) : (
                          <>
                            <Scissors size={15} /> PLANEJAR ENFESTO
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* SUBTAB 2: PLANOS APROVADOS DE ENFESTO (NOVA ABA COMFORTPRO) */}
      {activeSubTab === 'approved_plans' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <CheckCircle2 className="text-blue-600" size={20} /> PLANOS DE ENFESTO APROVADOS ({approvedPlans.length})
            </h3>
            <button
              onClick={fetchApprovedPlans}
              className="px-3 py-1.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer"
            >
              🔄 Atualizar Planos
            </button>
          </div>

          {isLoadingPlans ? (
            <div className="p-8 text-center text-slate-500 font-mono text-sm">Carregando planos aprovados...</div>
          ) : approvedPlans.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-3 shadow-2xs">
              <CheckCircle2 size={36} className="mx-auto text-slate-300" />
              <h4 className="font-black text-slate-700 text-base">Nenhum plano de enfesto aprovado no momento</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Acesse a aba <strong>Demanda de Corte</strong>, selecione um lote e clique em <strong>PLANEJAR ENFESTO</strong> para aprovar um plano exato ou com excedente estratégico.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvedPlans.map(plan => (
                <div
                  key={plan.id}
                  className="bg-white border border-slate-200 rounded-3xl shadow-sm hover:border-blue-400 transition-all p-6 space-y-4"
                >
                  {/* Top bar of plan card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 font-mono text-xs font-black rounded-lg uppercase ${plan.planType === 'PLANO_OTIMIZADO' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'}`}>
                          {plan.planType === 'PLANO_OTIMIZADO' ? '⚡ PLANO OTIMIZADO' : '✅ PLANO EXATO'}
                        </span>
                        <h4 className="text-lg font-black text-slate-900">{plan.model}</h4>
                      </div>
                      <p className="text-xs font-bold text-blue-900 uppercase tracking-wide mt-1">
                        Tecido: {plan.fabric} • Cor: <span className="text-blue-950 font-black bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{plan.color}</span> • Tipo: {plan.tipoTecido}
                      </p>
                      {plan.descricao_item ? (
                        <p className="text-[11px] font-medium text-slate-700 bg-blue-50/70 px-2.5 py-1.5 rounded-lg border border-blue-200 mt-1">
                          📋 <strong>Detalhamento no Pedido:</strong> {plan.descricao_item}
                        </p>
                      ) : (
                        <p className="text-[11px] font-medium text-slate-700 bg-blue-50/70 px-2.5 py-1.5 rounded-lg border border-blue-200 mt-1">
                          📋 <strong>Detalhamento no Pedido:</strong> {plan.model} • {plan.fabric} • {plan.color}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs text-slate-500">
                      <span>Operador: <strong>{plan.user_name}</strong></span>
                      <span>•</span>
                      <span>Aprovado em: <strong>{formatDate(plan.created_at)}</strong></span>
                    </div>
                  </div>

                  {/* Operational Benefit banner if optimized */}
                  {plan.planType === 'PLANO_OTIMIZADO' && (
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-2 text-xs text-emerald-950">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-emerald-900 uppercase">Benefício Operacional Identificado:</span>
                        <span className="font-mono font-bold text-emerald-800">{plan.beneficio_operacional}</span>
                      </div>

                      {plan.excedente_proposto && (
                        <div className="pt-2 border-t border-emerald-200/80 font-mono text-xs">
                          <strong className="text-emerald-900 uppercase">Peças Excedentes Registradas em ESTOQUE: </strong>
                          {Object.entries(plan.excedente_proposto).map(([sz, qty]) => (
                            <span key={sz} className="inline-block bg-white text-emerald-900 font-black px-2 py-0.5 rounded ml-1 border border-emerald-300">
                              {sz} = +{qty}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Breakdown of enfestos */}
                  <div className="space-y-3">
                    <h5 className="text-xs font-black uppercase text-slate-600 flex items-center gap-1.5">
                      <Scissors size={14} className="text-blue-600" /> ENFESTOS DO PLANO APROVADO
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {plan.enfestos.map((enf, idx) => (
                        <div key={enf.id || idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                          <div className="flex items-center justify-between font-mono text-xs border-b border-slate-200 pb-2">
                            <span className="font-black text-blue-900">ENFESTO #{idx + 1}: {enf.titulo}</span>
                            <span className="font-bold text-slate-700 bg-blue-100/70 text-blue-950 px-2 py-0.5 rounded border border-blue-200">{enf.passadas} enfesto(s) ({enf.camadas_efetivas} camada(s))</span>
                          </div>

                          {/* Moldes no Risco (1 Camada do Encaixe) */}
                          <div className="space-y-1 font-mono text-xs">
                            <span className="text-[10px] font-black uppercase text-slate-500 block tracking-wider">
                              📐 Grade do Risco (Moldes no Optitex por Camada):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(enf.peças_por_passada).map(([sz, qty]) => (
                                <span key={sz} className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-950 rounded-md font-black">
                                  {qty}× {sz}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Total Produzido neste enfesto */}
                          <div className="space-y-1 font-mono text-xs border-t border-slate-200/80 pt-2">
                            <span className="text-[10px] font-black uppercase text-slate-500 block tracking-wider">
                              📦 Total Cortado ({enf.passadas} enfestos × moldes):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(enf.producao_por_tamanho).map(([sz, prod]) => (
                                <span key={sz} className="px-2.5 py-0.5 bg-white border border-slate-300 rounded-md font-bold text-slate-800">
                                  {sz}: {prod} un
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pedidos inclusos no corte (Com fallback para planos legados) */}
                  {(() => {
                    const pedidosList = (plan.pedidos_inclusos && plan.pedidos_inclusos.length > 0)
                      ? plan.pedidos_inclusos
                      : [{ order_id: 1, order_number: 'Lote Consolidado', customer_name: 'Demanda de Corte', quantity: plan.resumo?.total_planejado || 0 }];
                    return (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 font-mono text-xs">
                        <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                          <PackageCheck size={13} className="text-blue-600" /> Pedidos Atendidos neste Lote ({pedidosList.length} pedido(s)):
                        </span>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {pedidosList.map((ped, pIdx) => (
                            <span key={pIdx} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold">
                              {ped.order_number || `#${ped.order_id}`} ({ped.customer_name || 'Cliente'}) — <strong className="text-blue-700">{ped.quantity} un</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Summary Footer */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex flex-wrap gap-4 text-slate-700">
                      <span>Necessário: <strong>{plan.resumo.total_necessario} un</strong></span>
                      <span>Planejado: <strong className="text-blue-700">{plan.resumo.total_planejado} un</strong></span>
                      <span>Total Enfestos: <strong>{plan.resumo.total_passadas}</strong></span>
                      <span>Metros: <strong className="text-blue-900">{plan.resumo.total_metros_previstos} m</strong></span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPrintingPlan(plan)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Printer size={15} /> [ 🖨️ IMPRIMIR FICHA DE CORTE ]
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteApprovedPlan(plan.id, plan.model)}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        title="Excluir este plano de enfesto aprovado"
                      >
                        <Trash2 size={14} /> Excluir
                      </button>

                      <span className="px-3 py-1 bg-blue-100 text-blue-900 font-bold rounded-lg text-xs">
                        STATUS: {plan.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: HISTÓRICO DE ALOCAÇÕES */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <History className="text-blue-600" size={20} /> HISTÓRICO DE ALOCAÇÕES DE CORTE & RASTREABILIDADE
          </h3>

          {isLoadingLogs ? (
            <div className="p-8 text-center text-slate-500 font-mono text-sm">Carregando histórico...</div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-xs uppercase font-mono">
                      <th className="px-4 py-3">ID Log</th>
                      <th className="px-4 py-3">Pedido</th>
                      <th className="px-4 py-3">Item / Chave</th>
                      <th className="px-4 py-3">Tamanho</th>
                      <th className="px-4 py-3 text-right">Alocado</th>
                      <th className="px-4 py-3">Operador</th>
                      <th className="px-4 py-3 text-right">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-mono">
                    {allocationLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-all">
                        <td className="px-4 py-3 font-bold text-slate-500">#{log.id}</td>
                        <td className="px-4 py-3 font-black text-blue-900">Pedido #{log.order_id}</td>
                        <td className="px-4 py-3 text-slate-800">{log.item_key}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-100 rounded font-bold">{log.size}</span></td>
                        <td className="px-4 py-3 text-right font-black text-blue-700">{log.quantidade_alocada} un</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{log.user_name || 'Operador'}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{formatDate(log.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PLANEJADOR DE ENFESTO MODAL */}
      {selectedGroupForPlanner && (
        <EnfestoPlannerModal
          isOpen={!!selectedGroupForPlanner}
          onClose={() => {
            setSelectedGroupForPlanner(null);
            fetchApprovedPlans();
          }}
          groupData={selectedGroupForPlanner}
        />
      )}

      {/* REGISTRATION CUT MODAL */}
      {selectedItemForCut && (
        <div className="fixed inset-0 z-[140] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-6">
            <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-950 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black tracking-widest uppercase text-blue-300 block">REGISTRAR PRODUÇÃO DE CORTE</span>
                <h3 className="text-xl font-black mt-0.5">{selectedItemForCut.product_type}</h3>
                <p className="text-xs text-blue-100 font-mono mt-0.5">Tamanho: {selectedItemForCut.size} | Total Necessário: {selectedItemForCut.total_necessario} un</p>
              </div>

              <button
                onClick={() => setSelectedItemForCut(null)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-700 tracking-wider block">
                  Quantidade Cortada nesta Etapa:
                </label>
                <input
                  type="number"
                  min="1"
                  value={cutQuantityInput}
                  onChange={e => setCutQuantityInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-mono font-black focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-700 tracking-wider block">
                  Operador do Corte:
                </label>
                <select
                  value={selectedOperatorId}
                  onChange={e => setSelectedOperatorId(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedItemForCut(null)}
                  className="px-5 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCutRegistration}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Gravando...' : 'Confirmar Corte'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL */}
      <PrintableEnfestoSheetModal
        isOpen={!!printingPlan}
        onClose={() => setPrintingPlan(null)}
        plan={printingPlan}
      />
    </div>
  );
};
