import React, { useState, useMemo, useEffect } from 'react';
import {
  History,
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
import { Order, User, CorteDemandItem, CorteAllocationLog, CorteGroupDemand, CorteModelBreakdown } from '../types';
import { IncompleteFamilyGroup } from '../lib/cuttingUtils';
import { fetchTechnicalRegistry, saveTechnicalRegistry } from '../lib/technicalRegistryUtils';
import { fetchLocalStockCache, syncStockForProducts } from '../lib/stockSyncUtils';
import { StockCache } from '../types';
import { aggregateCuttingDemand, groupCuttingDemandByRawMaterial, sortSizes } from '../lib/cuttingUtils';
import { CuttingPlanModal } from './CuttingPlanModal';
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

  const [isRegistryLoaded, setIsRegistryLoaded] = useState(false);
  const [registryRefreshCount, setRegistryRefreshCount] = useState(0);
  const [stockCache, setStockCache] = useState<StockCache>({});
  const [isSyncingStock, setIsSyncingStock] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    fetchTechnicalRegistry().then(() => {
      setIsRegistryLoaded(true);
    });
    fetchLocalStockCache().then(cache => {
      setStockCache(cache);
    });
  }, [registryRefreshCount]);

  const handleSyncStock = async () => {
    setIsSyncingStock(true);
    setSyncProgress({ current: 0, total: 0 });
    
    const pendingProducts: { id_produto: string; sku: string }[] = [];
    orders.forEach(order => {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      (items || []).forEach((it: any) => {
        if (it.id_produto || it.idProduto) {
          pendingProducts.push({ id_produto: it.id_produto || it.idProduto, sku: it.codigo || '' });
        }
      });
    });

    // @ts-ignore
    const token = currentUser?.tiny_token || localStorage.getItem('tiny_token') || 'b9a674e2d31b3e9447eec03d527a20c35fa9eecf';
    if (!token) {
      alert('Token do Tiny n�o configurado.');
      setIsSyncingStock(false);
      return;
    }

    const success = await syncStockForProducts(token, pendingProducts, (curr, tot) => {
      setSyncProgress({ current: curr, total: tot });
    });

    if (success) {
      const updatedCache = await fetchLocalStockCache();
      setStockCache(updatedCache);
    } else {
      alert('Houve um erro ao sincronizar o estoque de alguns itens.');
    }
    
    setIsSyncingStock(false);
  };
  const handleConfirmFamily = async (fam: IncompleteFamilyGroup) => {
    if (!fam.suggested_fabric || !fam.suggested_color) {
      alert('A fam�lia n�o possui tecido e cor sugeridos completos para confirma��o autom�tica.');
      return;
    }
    const success = await saveTechnicalRegistry({
      sku_base: fam.sku_base,
      product_type: fam.product_type,
      fabric: fam.suggested_fabric,
      color: fam.suggested_color
    });
    if (success) {
      setRegistryRefreshCount(c => c + 1);
    } else {
      alert('Erro ao salvar o mapeamento.');
    }
  };

  // State for Central de Corte - Visualização do Plano (Optitex CutPlan)
  const [selectedGroupForPlanModal, setSelectedGroupForPlanModal] = useState<CorteGroupDemand | null>(null);

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

  // Map of approved plans indexed by model+fabric+color AND by raw material (fabric__color)
  const approvedPlansByGroupKey = useMemo(() => {
    const map = new Map<string, ApprovedEnfestoPlan>();
    approvedPlans.forEach(p => {
      const legacyKey = `${(p.model || '').trim().toLowerCase()}_${(p.fabric || '').trim().toLowerCase()}_${(p.color || '').trim().toLowerCase()}`;
      map.set(legacyKey, p);
      const rawMatKey = `${(p.fabric || '').trim().toLowerCase()}__${(p.color || '').trim().toLowerCase()}`;
      map.set(rawMatKey, p);
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

  const handleOpenPlannerModalForGroup = (grp: CorteGroupDemand) => {
    const combinedModelName = grp.models_breakdown.length === 1
      ? grp.models_breakdown[0].model
      : grp.models_breakdown.map(m => m.model).join(' + ');

    setSelectedGroupForPlanner({
      model: combinedModelName,
      fabric: grp.fabric,
      color: grp.color,
      items: grp.all_items,
      totalPending: grp.total_necessario,
      maxUrgency: grp.prazo_mais_proximo,
      ordersCount: grp.pedidos_count,
      pedidos_waiting: grp.pedidos_waiting.map(p => ({
        order_id: p.order_id,
        order_number: p.order_number,
        customer_name: p.client_name,
        quantity: p.quantity
      })),
      description: `${combinedModelName} • ${grp.fabric} • ${grp.color}`,
      tipo_tecido: grp.tipo_tecido,
      largura_util: grp.largura_util,
      models_breakdown: grp.models_breakdown
    });
  };

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
    if (!isRegistryLoaded) return [];
    return aggregateCuttingDemand(orders, stockCache);
  }, [orders, isRegistryLoaded, registryRefreshCount, stockCache]);

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

  // Group demand items strictly by TECIDO + COR + TIPO + LARGURA (Raw Material First)
  const { groups: rawMaterialGroups, incompleteFamilies } = useMemo(() => {
    const result = groupCuttingDemandByRawMaterial(filteredDemandItems);

    // Apply user selected sorting
    if (sortBy === 'quantity') {
      result.groups.sort((a, b) => b.total_necessario - a.total_necessario);
    } else if (sortBy === 'orders_count') {
      result.groups.sort((a, b) => b.pedidos_count - a.pedidos_count);
    } else {
      result.groups.sort((a, b) => a.prazo_mais_proximo.localeCompare(b.prazo_mais_proximo));
    }

    return result;
  }, [filteredDemandItems, sortBy]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header & Sub-Tabs Navigation (ComfortPRO Blue Identity) */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-blue-900/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-400 text-xs font-black tracking-widest uppercase mb-1">
              <Scissors size={18} className="text-blue-400" /> COMFORTPRO — CENTRAL DE CORTE
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Central de Corte</h2>
            <p className="text-blue-200/90 text-sm mt-1 max-w-2xl">
              Consolidação de demanda por matéria-prima para direcionamento ao Optitex CutPlan.
            </p>
          </div>

                      {/* Subtabs Switcher */}
            <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
              <button
                onClick={handleSyncStock}
                disabled={isSyncingStock}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-70"
              >
                <History size={16} className={isSyncingStock ? "animate-spin" : ""} />
                {isSyncingStock ? `Sincronizando... ${syncProgress.current}/${syncProgress.total}` : 'Sincronizar Estoque'}
              </button>
            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-blue-800/50 backdrop-blur-md self-start md:self-auto font-sans">
            <button
              onClick={() => setActiveSubTab('demand')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'demand'
                  ? 'bg-blue-600 text-white shadow-md font-black'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Scissors size={14} /> Grupos de Matéria-Prima
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
                <p className="text-xs font-bold uppercase tracking-wider text-blue-300/90">Grupos de Matéria-Prima</p>
                <p className="text-3xl font-black font-mono mt-1 text-white">{rawMaterialGroups.length} <span className="text-sm font-sans font-normal text-blue-200">grupos</span></p>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-2xl border border-blue-900/60">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-300/90">Pedidos Impactados</p>
                <p className="text-3xl font-black font-mono mt-1 text-white">{totalWaitingOrdersCount} <span className="text-sm font-sans font-normal text-blue-200">pedidos</span></p>
              </div>
            </div>
          </div>

          {/* Search, Filter & Sort Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar tecido, cor, modelo, SKU..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                <Filter size={14} className="text-slate-400" /> Ordenar por:
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="urgency">Prazo Mais Urgente</option>
                <option value="quantity">Maior Quantidade</option>
                <option value="orders_count">Mais Pedidos</option>
              </select>
            </div>
          </div>

          {/* ALERTA DE DADOS INCOMPLETOS / NÃO CONFIÁVEIS */}
          {incompleteFamilies && incompleteFamilies.length > 0 && (
            <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-5 space-y-3 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-black text-amber-950 text-xs sm:text-sm uppercase tracking-wide">
                      Dados insuficientes: Fam�lias de Produtos Pendentes
                    </h4>
                    <p className="text-[11px] sm:text-xs text-amber-800 mt-0.5 font-medium">
                      Confirme os materiais sugeridos para agrupar automaticamente os tamanhos na mesa de corte.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-amber-200 text-amber-950 font-mono font-black text-xs rounded-xl self-start sm:self-center shrink-0">
                  {incompleteFamilies.length} fam�lias pendentes
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {incompleteFamilies.map((fam, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <strong className="text-slate-900 font-bold uppercase text-xs">{fam.product_type}</strong>
                        <span className="text-rose-600 font-mono font-black text-xs shrink-0">{fam.total_pieces} un</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-1 mb-3">SKU Base: {fam.sku_base}</p>
                      
                      <div className="space-y-2 mb-4 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 w-12">Tecido:</span>
                          {fam.suggested_fabric ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-bold border border-blue-200">
                              {fam.suggested_fabric} <span className="text-[9px] text-blue-500 font-normal ml-1">sugerido</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded font-bold border border-rose-200 uppercase text-[10px]">Falta Tecido</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 w-12">Cor:</span>
                          {fam.suggested_color ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-bold border border-blue-200">
                              {fam.suggested_color} <span className="text-[9px] text-blue-500 font-normal ml-1">sugerida</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded font-bold border border-rose-200 uppercase text-[10px]">Falta Cor</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleConfirmFamily(fam)}
                      disabled={!fam.suggested_fabric || !fam.suggested_color}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-[11px] uppercase tracking-wider rounded-lg transition-all"
                    >
                      {(!fam.suggested_fabric || !fam.suggested_color) ? 'Dados Insuficientes' : 'Confirmar Lote'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rawMaterialGroups.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-3 shadow-2xs">
                <CheckCircle2 size={36} className="mx-auto text-slate-300" />
                <h4 className="font-black text-slate-700 text-base">Nenhum grupo de corte pendente</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Não há demandas de corte pendentes para os filtros selecionados.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rawMaterialGroups.map(group => (
                  <div
                    key={group.group_key}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3.5">
                      {/* Header do Card */}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 bg-blue-900 text-white font-mono font-black text-[10px] rounded uppercase tracking-wider">
                              MATÉRIA-PRIMA
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              group.tipo_tecido === 'TUBULAR'
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            }`}>
                              {group.tipo_tecido}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {group.largura_util}
                            </span>
                          </div>

                          <h4 className="font-black text-xl text-slate-900 leading-tight mt-2">
                            {group.fabric} · <span className="text-blue-700">{group.color}</span>
                          </h4>
                          {(group.lote || group.orientacao) && (
                            <p className="text-[11px] font-bold text-slate-400 font-mono mt-0.5">
                              {[group.lote ? `Lote: ${group.lote}` : '', group.orientacao ? `Fio: ${group.orientacao}` : ''].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0">
                          {getUrgencyBadge(group.prazo_mais_proximo)}
                        </div>
                      </div>

                      {/* Métricas Limpas do Card (Requisito 4: Central de Corte) */}
                      <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
                        <div className="flex items-baseline justify-between">
                          <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Demanda Total:</span>
                          <span className="text-lg font-black font-mono text-blue-700">
                            {group.total_necessario} peças pendentes
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 font-medium pt-1.5 border-t border-slate-200/60">
                          <span className="font-bold text-slate-800">{group.models_breakdown.length} {group.models_breakdown.length === 1 ? 'modelo' : 'modelos'}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-bold text-slate-800">{group.pedidos_count} {group.pedidos_count === 1 ? 'pedido' : 'pedidos'}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1.5 border-t border-slate-200/60">
                          <span>Entrega mais urgente:</span>
                          <span className="font-bold font-mono text-rose-600">
                            {formatDate(group.prazo_mais_proximo)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botão de Ação: [ VER PLANO ] */}
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedGroupForPlanModal(group)}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Layers size={15} /> VER PLANO
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

      {/* CENTRAL DE CORTE - MODAL DO PLANO (OPTITEX CUTPLAN) */}
      {selectedGroupForPlanModal && (
        <CuttingPlanModal
          isOpen={!!selectedGroupForPlanModal}
          onClose={() => setSelectedGroupForPlanModal(null)}
          group={selectedGroupForPlanModal}
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
