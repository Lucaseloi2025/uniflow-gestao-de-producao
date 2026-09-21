import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Settings,
  Plus,
  Search,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Play,
  Pause,
  Check,
  Square,
  BarChart3,
  Package,
  Calendar,
  User as UserIcon,
  X,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Upload,
  CheckCircle,
  Circle,
  FileText,
  TrendingUp,
  DollarSign,
  Menu,
  LogOut,
  RefreshCw,
  ArrowLeft,
  PieChart as PieChartIcon,
  Target,
  Archive,
  CheckSquare,
  Timer,
  Layers,
  List,
  Filter,
  AlertTriangle,
  TrendingDown,
  Activity,
  Download,
  DownloadCloud,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  Eye,
  EyeOff,
  Printer,
  Loader2,
  Link as LinkIcon,
  Scissors
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import PrintableReport from './PrintableReport';
import { Session } from '@supabase/supabase-js';
import PublicTracking from './PublicTracking';
import { Orders } from './pages/Orders';
import { Badge } from './components/Badge';
import { Kanban } from './pages/Kanban';
import { UserModal } from './components/modals/UserModal';
import { NewOrderModal } from './components/modals/NewOrderModal';
import { TemplateEditorModal } from './components/modals/TemplateEditorModal';
import { PhotoLightbox } from './components/modals/PhotoLightbox';
import { EditOrderModal } from './components/modals/EditOrderModal';
import { OrderHistoryModal } from './components/modals/OrderHistoryModal';
import { ExecutionActionModal } from './components/modals/ExecutionActionModal';
import { PartialProgressModal } from './components/modals/PartialProgressModal';
import { LossModal } from './components/modals/LossModal';
import { OlistDraftReviewModal } from './components/modals/OlistDraftReviewModal';
import { OlistDraftListModal } from './components/modals/OlistDraftListModal';
import { OrderDetailsDrawer } from './components/modals/OrderDetailsDrawer';
import { Reports } from './pages/Reports';
import { Costs } from './pages/Costs';
import { Collaborators } from './pages/Collaborators';
import { ConsolidatedCuttingPanel } from './components/ConsolidatedCuttingPanel';
import { ProductionNeedsPanel } from './components/ProductionNeedsPanel';
import { DashboardTab } from './pages/DashboardTab';
import { Card } from './components/ui/Card';
import { aggregateCuttingDemand, getItemDisplaySize, sortSizes, extractItemDetails } from './lib/cuttingUtils';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from 'recharts';
import { format, parseISO, differenceInDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isPast, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, formatSeconds, isImage, isPdf, getOrderCuttingQty, safeFormat } from './lib/utils';
import { calculateExecutionTimes } from './lib/timerUtils';
import { Order, Stage, StageExecution, DashboardStats, User, StageStatus, OrderTemplate, OrderHistory, OrderForecast, DeliveryReportData, OperationalReportData, OperationalStep, OrderProgress, FinishedOrder, CollaboratorProductivity, GoalsProductivityResponse, ProductivityPeriod, OrderStageProgress, OrderLossLog, LossReasonSetting, LossReportData, CollaboratorStageGoal } from './types';

// Helpers
const isImage = (url: string) => /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(url);
const isPdf = (url: string) => /\.pdf(\?.*)?$/i.test(url);



function getOrderCuttingQty(order: any): number {
  if (!order) return 0;
  if (order.total_via_corte !== undefined && order.total_via_corte !== null && order.total_via_corte > 0) {
    return order.total_via_corte;
  }
  if (order.items && order.items.length > 0) {
    const sumCorte = order.items.reduce((acc: number, it: any) => {
      const qPedida = it.quantity ?? it.quantidade ?? 1;
      const cQty = it.qty_corte ?? it.total_via_corte ?? (it.stock_available !== undefined && it.stock_available !== null ? Math.max(0, qPedida - Math.min(qPedida, it.stock_available)) : 0);
      return acc + cQty;
    }, 0);
    if (sumCorte > 0) return sumCorte;
  }
  if (order.observations) {
    const match = order.observations.match(/⚠️\s*(\d+)\s*pçs?\s*sem\s*estoque/i);
    if (match) {
      return parseInt(match[1], 10) || 0;
    }
  }
  return 0;
}

// Components
const SidebarItem = ({ icon: Icon, label, active, onClick, badge }: { icon: any, label: string, active: boolean, onClick: () => void, badge?: number | string }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer",
      active
        ? "bg-zinc-900 text-white shadow-lg font-bold"
        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 font-medium"
    )}
  >
    <div className="flex items-center gap-3">
      <Icon size={20} />
      <span className="text-sm">{label}</span>
    </div>
    {badge !== undefined && badge !== null && (
      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-amber-950 font-mono">
        {badge}
      </span>
    )}
  </button>
);

const Card = ({ children, className, ...props }: any) => (
  <div className={cn("bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden", className)} {...props}>
    {children}
  </div>
);

// Error Boundary Component (Shim for missing @types/react)
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends (React.Component as any)<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-12 text-center bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
          <AlertCircle className="mx-auto text-zinc-300 mb-4" size={48} />
          <h3 className="text-lg font-bold text-zinc-900 mb-2">Ops! Algo deu errado nesta seção.</h3>
          <p className="text-sm text-zinc-500 max-w-xs mx-auto mb-6">Ocorreu um erro inesperado ao processar os dados desta aba.</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="px-6 py-2 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-md active:scale-95"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


const InfoModal = ({ isOpen, onClose, title, description }: { isOpen: boolean, onClose: () => void, title: string, description: string }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-zinc-200"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-zinc-900 border-b-2 border-zinc-900 pb-1">
                <AlertCircle size={20} />
                <h3 className="font-bold text-lg tracking-tight">{title}</h3>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400">
                <X size={20} />
              </button>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                {description}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full mt-6 bg-zinc-900 text-white font-bold py-3 rounded-xl hover:bg-zinc-800 transition-all shadow-md active:scale-[0.98]"
            >
              Entendido
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const safeDate = (dateStr: any) => {
  try {
    if (!dateStr) return null;
    let str = String(dateStr).trim();
    if (str.includes(' ') && !str.includes('T')) {
      str = str.replace(' ', 'T');
    }
    if (!/[Zz]|[+-]\d{2}:?\d{2}$/.test(str) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
      str += 'Z';
    }
    const d = parseISO(str);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const safeFormat = (dateStr: any, formatStr: string) => {
  const d = safeDate(dateStr);
  if (!d) return '-';
  try {
    return format(d, formatStr);
  } catch {
    return '-';
  }
};

type RunningTaskBannerProps = {
  execution: StageExecution;
  onNavigate: () => void | Promise<void>;
  key?: any;
};

const RunningTaskBanner = ({ execution, onNavigate }: RunningTaskBannerProps) => {
  const [times, setTimes] = useState({ totalAccumulatedSeconds: 0, currentSessionSeconds: 0, isPaused: false });

  useEffect(() => {
    if (!execution.start_time) return;

    const updateTimer = () => {
      setTimes(calculateExecutionTimes(execution, execution.pauses || [], Date.now()));
    };

    updateTimer(); // Initial call
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [execution]);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="bg-zinc-900 text-white overflow-hidden shadow-lg mb-2 rounded-xl"
    >
      <div
        className="px-6 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-colors"
        onClick={onNavigate}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 animate-pulse">
            <Play size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tarefa em Andamento</p>
            <p className="text-sm font-bold">
              {execution.stage_name} <span className="text-zinc-500 mx-2">•</span> <span className="font-mono">{execution.order_number}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Sessão Atual</span>
            <span className="text-sm font-mono font-bold text-emerald-300">{formatSeconds(times.currentSessionSeconds)}</span>
          </div>
          <div className="h-6 w-px bg-zinc-700 mx-1" />
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Tempo Total</span>
            <span className="text-xl font-mono font-bold tabular-nums">{formatSeconds(times.totalAccumulatedSeconds)}</span>
          </div>
          <ChevronRight size={20} className="text-zinc-600" />
        </div>
      </div>
    </motion.div>
  );
};

const TaskMonitor = ({ onShowInfo }: { onShowInfo?: (title: string, desc: string) => void }) => {
  const [monitorData, setMonitorData] = useState<StageExecution[]>([]);
  const [monitorSearch, setMonitorSearch] = useState('');
  const [monitorStageFilter, setMonitorStageFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchMonitorData = async () => {
    try {
      const res = await fetch('/api/executions/monitor', {
        headers: { 'x-user-role': 'Admin' }
      });
      if (res.ok) {
        const data = await res.json();
        setMonitorData(data);
      }
    } catch (err) {
      console.error('Error fetching monitor data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitorData();
    const interval = setInterval(fetchMonitorData, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, []);

  const filteredData = (monitorData || []).filter(e => {
    const searchMatch = (e.order_number?.toLowerCase().includes(monitorSearch.toLowerCase()) || 
                         e.client_name?.toLowerCase().includes(monitorSearch.toLowerCase()));
    const stageMatch = !monitorStageFilter || e.stage_id?.toString() === monitorStageFilter;
    return searchMatch && stageMatch;
  });

  const getBaseTimeInfo = (exec: StageExecution & { quantity?: number }) => {
    const ideal = exec.ideal_time || exec.average_time_seconds || 0;
    const count = exec.execution_count || 0;
    const real = exec.real_average_time || 0;
    const qty = exec.quantity || 1;
    const calcType = exec.calculation_type || 'por_peca';

    let baseTime = 0;
    if (count >= 10 && real > 0) {
      baseTime = real;
    } else {
      baseTime = ideal;
    }

    if (calcType === 'por_peca') {
      baseTime *= qty;
    } else if (calcType === 'por_lote') {
      // Opcional: implementar lógica de lote se necessário
      baseTime *= Math.ceil(qty / 10); // Exemplo: lote de 10
    }

    return { baseTime, type: count >= 10 && real > 0 ? 'Real' : 'Ideal', calcType };
  };

  const getStatusColor = (current: number, avg: number) => {
    if (!avg || avg === 0) return 'text-zinc-600 bg-zinc-100';
    const ratio = current / avg;
    if (ratio <= 0.8) return 'text-emerald-700 bg-emerald-100 border-emerald-200';
    if (ratio <= 1.0) return 'text-amber-700 bg-amber-100 border-amber-200';
    return 'text-rose-700 bg-rose-100 border-rose-200';
  };

  const getStatusLabel = (current: number, avg: number) => {
    if (!avg || avg === 0) return 'Normal';
    const ratio = current / avg;
    if (ratio <= 0.8) return 'Eficiente';
    if (ratio <= 1.0) return 'Atenção';
    return 'Atrasado';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => onShowInfo?.('Tarefas Ativas', 'Número de tarefas (etapas de uma OP) que estão com o \'Play\' acionado no exato momento.')}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-100 rounded-xl text-zinc-600">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium">Tarefas Ativas</p>
              <h3 className="text-2xl font-bold">{monitorData?.length || 0}</h3>
            </div>
          </div>
        </Card>
        <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => onShowInfo?.('Eficientes', 'Tarefas em andamento cujo tempo atual é inferior a 80% do tempo médio histórico esperado para a etapa.')}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium">Eficientes</p>
              <h3 className="text-2xl font-bold">{(monitorData || []).filter(e => { const { baseTime } = getBaseTimeInfo(e); return baseTime > 0 && (e.total_time_seconds / baseTime) <= 0.8; }).length}</h3>
            </div>
          </div>
        </Card>
        <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => onShowInfo?.('Atenção', 'Tarefas em andamento onde o tempo atual atingiu entre 80% e 100% do tempo base (ideal ou real) esperado para a etapa.')}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium">Atenção</p>
              <h3 className="text-2xl font-bold">{(monitorData || []).filter(e => { const { baseTime } = getBaseTimeInfo(e); return baseTime > 0 && (e.total_time_seconds / baseTime) > 0.8 && (e.total_time_seconds / baseTime) <= 1.0; }).length}</h3>
            </div>
          </div>
        </Card>
        <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => onShowInfo?.('Fora do Prazo', 'Tarefas cujo tempo atual de execução já excedeu o tempo base esperado.')}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-100 rounded-xl text-rose-600">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium">Fora do Prazo</p>
              <h3 className="text-2xl font-bold">{(monitorData || []).filter(e => { const { baseTime } = getBaseTimeInfo(e); return baseTime > 0 && (e.total_time_seconds / baseTime) > 1.0; }).length}</h3>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 bg-zinc-50 border-zinc-200">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por Pedido ou Cliente..."
              value={monitorSearch}
              onChange={(e) => setMonitorSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-400"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
             <Filter size={16} className="text-zinc-400" />
             <select
               value={monitorStageFilter}
               onChange={(e) => setMonitorStageFilter(e.target.value)}
               className="bg-white border border-zinc-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-zinc-400 min-w-[200px]"
             >
               <option value="">Todas as Etapas</option>
                {Array.from(new Map((monitorData || []).map(e => [e.stage_id, e.stage_name])).entries()).map(([id, name]) => (
                  <option key={id} value={id}>{name as string}</option>
                ))}
             </select>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Pedido</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Cliente / Produto</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Etapa</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Responsável</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Tempo Decorrido</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Tempo Base</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-400 animate-pulse">Carregando monitor...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-400">Nenhuma tarefa ativa no momento.</td></tr>
              ) : filteredData.map(exec => {
                const baseInfo = getBaseTimeInfo(exec);
                const baseTime = baseInfo.baseTime;
                let efficiency = '';
                let efficiencyColor = 'text-zinc-500';
                
                if (baseTime > 0) {
                  const pct = Math.round((exec.total_time_seconds / baseTime) * 100);
                  efficiency = `${pct}% do tempo ${baseInfo.type.toLowerCase()}`;
                  if (pct <= 80) efficiencyColor = 'text-emerald-600';
                  else if (pct <= 100) efficiencyColor = 'text-amber-600';
                  else efficiencyColor = 'text-rose-600 font-bold';
                }

                return (
                  <tr key={exec.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono font-bold text-zinc-900">{exec.order_number}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-zinc-800">{exec.client_name}</span>
                        <span className="text-[10px] text-zinc-500">{exec.product_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs font-bold">
                          {exec.is_paused ? <Pause size={10} className="text-amber-500" /> : <Play size={10} className="text-emerald-500" />}
                          {exec.stage_name}
                        </span>
                        <div className="flex items-center gap-1">
                          {exec.calculation_type === 'por_pedido' && (
                            <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-0.5" title="Cálculo por Pedido">
                              📄 por pedido
                            </span>
                          )}
                          {exec.calculation_type === 'por_peca' && (
                            <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-0.5" title="Cálculo por Peça">
                              👕 por peça
                            </span>
                          )}
                          {exec.calculation_type === 'por_lote' && (
                            <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-0.5" title="Cálculo por Lote">
                              📦 por lote
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600 font-medium">
                      {exec.user_name}
                    </td>
                    <td className="px-6 py-4">
                       <span className={cn(
                         "font-mono text-sm font-bold block",
                         baseInfo.baseTime && exec.total_time_seconds > baseInfo.baseTime ? "text-rose-600" : "text-zinc-900"
                       )}>
                         {formatSeconds(exec.total_time_seconds)}
                       </span>
                       {efficiency && (
                         <div className={`text-[10px] mt-0.5 ${efficiencyColor}`}>
                           {efficiency}
                         </div>
                       )}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400 font-mono">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-900 font-medium">{baseInfo.baseTime ? formatSeconds(baseInfo.baseTime) : "-"}</span>
                          <Badge variant={baseInfo.type === 'Real' ? 'info' : 'default'} className="md:px-2 md:py-0 md:text-[8px]">{baseInfo.type}</Badge>
                        </div>
                        <div className="text-[9px] text-zinc-500 flex flex-col">
                          {(exec.ideal_time || 0) > 0 && (
                            <span>Ideal: {formatSeconds(exec.calculation_type === 'por_peca' ? (exec.ideal_time || 0) * (exec.quantity || 1) : (exec.ideal_time || 0))}</span>
                          )} 
                          {(exec.real_average_time || 0) > 0 && (
                            <span>Real: {formatSeconds(exec.calculation_type === 'por_peca' ? (exec.real_average_time || 0) * (exec.quantity || 1) : (exec.real_average_time || 0))}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border",
                        getStatusColor(exec.total_time_seconds, baseInfo.baseTime || 0)
                      )}>
                        {getStatusLabel(exec.total_time_seconds, baseInfo.baseTime || 0)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default function App() {
  const [infoModal, setInfoModal] = useState<{ title: string, description: string } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const rawTab = location.pathname.split('/')[1];
  const activeTab = (rawTab || 'dashboard') as 'dashboard' | 'kanban' | 'orders' | 'cutting' | 'collaborators' | 'reports' | 'costs' | 'settings' | 'monitor';
  const setActiveTab = (tab: string) => {
    navigate(tab === 'dashboard' ? '/' : '/' + tab);
  };
  const [printOpen, setPrintOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  const cortePendingBadgeCount = useMemo(() => {
    try {
      const aggregated = aggregateCuttingDemand(orders || []);
      return (aggregated || []).reduce((acc, item) => acc + (item.total_necessario || 0), 0);
    } catch (e) {
      console.warn('Erro ao calcular badge de corte:', e);
      return 0;
    }
  }, [orders]);

  const [stages, setStages] = useState<Stage[]>([]);
  const [templates, setTemplates] = useState<OrderTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [expandedReportStage, setExpandedReportStage] = useState<string | null>(null);
  const [deliveryReportData, setDeliveryReportData] = useState<DeliveryReportData | null>(null);
  const [delaysReportData, setDelaysReportData] = useState<DeliveryReportData['atrasados'] | null>(null);
  const [reportPeriod, setReportPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [reportUser, setReportUser] = useState<string>('');
  const [reportStage, setReportStage] = useState<string>('');
  const [reportPrintType, setReportPrintType] = useState<string>('');
  const [profileReport, setProfileReport] = useState<any[]>([]);
  const [operationalReportData, setOperationalReportData] = useState<OperationalReportData | null>(null);
  const [goalsProductivityData, setGoalsProductivityData] = useState<GoalsProductivityResponse | null>(null);
  const [collaboratorGoals, setCollaboratorGoals] = useState<CollaboratorStageGoal[]>([]);
  const [goalsViewType, setGoalsViewType] = useState<'collaborator' | 'sector'>('collaborator');
  const [reportStartDate, setReportStartDate] = useState<string>(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState<string>(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [metaCustoPeca, setMetaCustoPeca] = useState<number>(0);
  const [autoPauseTimeWeekday, setAutoPauseTimeWeekday] = useState<string>('18:00');
  const [autoPauseTimeWeekend, setAutoPauseTimeWeekend] = useState<string>('13:00');
  const [showCompletedOrders, setShowCompletedOrders] = useState(false);
  const [autoPauseTimeFriday, setAutoPauseTimeFriday] = useState<string>('17:00');
  const [autoPauseTimeLunch, setAutoPauseTimeLunch] = useState<string>('12:00');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirmingDtfOrderId, setConfirmingDtfOrderId] = useState<number | null>(null);
  const [editingDtfOrderId, setEditingDtfOrderId] = useState<number | null>(null);
  const [editingDtfValue, setEditingDtfValue] = useState<string>('');
  const confirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const [executions, setExecutions] = useState<StageExecution[]>([]);
  const [orderStageObservations, setOrderStageObservations] = useState<any[]>([]);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const [newStageTime, setNewStageTime] = useState<number>(0);
  const [newStageCalculationType, setNewStageCalculationType] = useState<'por_pedido' | 'por_peca' | 'por_lote'>('por_peca');
  const [newStageMetaDiaria, setNewStageMetaDiaria] = useState<number | ''>('');
  const [editingStageMetaDiaria, setEditingStageMetaDiaria] = useState<number | ''>('');
  const [isUploadingArt, setIsUploadingArt] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [editingStageName, setEditingStageName] = useState('');
  const [editingStageTime, setEditingStageTime] = useState<number>(0);
  const [editingStageCalculationType, setEditingStageCalculationType] = useState<'por_pedido' | 'por_peca' | 'por_lote'>('por_peca');
  const [expandedGoalStageId, setExpandedGoalStageId] = useState<number | null>(null);
  const [goalEditValues, setGoalEditValues] = useState<Record<string, string>>({}); // key: `${stageId}-${userId}`
  const [lossReportData, setLossReportData] = useState<LossReportData | null>(null);
  const [lossReasonsList, setLossReasonsList] = useState<LossReasonSetting[]>([]);
  const [activeReportSubTab, setActiveReportSubTab] = useState<'geral' | 'metas' | 'operacional' | 'perdas'>('geral');

  // Olist ERP Integration State
  const [draftOrders, setDraftOrders] = useState<Order[]>([]);
  const [selectedDraftOrder, setSelectedDraftOrder] = useState<Order | null>(null);
  const [isDraftsListModalOpen, setIsDraftsListModalOpen] = useState(false);
  const [isSyncingOlist, setIsSyncingOlist] = useState(false);
  const [isConfirmingDraft, setIsConfirmingDraft] = useState(false);
  const [confirmDraftForm, setConfirmDraftForm] = useState({
    print_type: 'DTF' as 'DTF' | 'Silk' | 'Sublimação' | 'Bordado',
    product_type: '',
    num_colors: 1,
    observations: '',
    required_stages: [] as number[]
  });

  // Modal State: Progresso Parcial
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [progressStageId, setProgressStageId] = useState<number | null>(null);
  const [progressIncrementInput, setProgressIncrementInput] = useState<number>(0);

  // Modal State: Ação de Pausar / Finalizar Etapa com Quantidade e Perdas
  const [executionActionModal, setExecutionActionModal] = useState<{
    type: 'pause' | 'finish';
    executionId: number;
    stageId: number;
  } | null>(null);
  const [actionQuantityInput, setActionQuantityInput] = useState<number>(0);
  const [actionLossQuantityInput, setActionLossQuantityInput] = useState<number>(0);
  const [actionLossReasonInput, setActionLossReasonInput] = useState<string>('');
  const [actionLossReasonDetailInput, setActionLossReasonDetailInput] = useState<string>('');
  const [actionLossReentryStageIdInput, setActionLossReentryStageIdInput] = useState<number | null>(null);
  const [showActionLossSection, setShowActionLossSection] = useState<boolean>(false);
  const [actionObservationInput, setActionObservationInput] = useState<string>('');
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Modal State: Registro de Perda
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [lossStageId, setLossStageId] = useState<number | null>(null);
  const [lossQtyInput, setLossQtyInput] = useState<number>(1);
  const [lossReasonInput, setLossReasonInput] = useState<string>('');
  const [lossReasonDetailInput, setLossReasonDetailInput] = useState<string>('');
  const [lossReentryStageIdInput, setLossReentryStageIdInput] = useState<number | null>(null);

  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('');
  const [selectedStageStatus, setSelectedStageStatus] = useState<'Pending' | 'Finished'>('Pending');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [productTypeFilter, setProductTypeFilter] = useState<string>('');
  const [printTypeFilter, setPrintTypeFilter] = useState<string>('');
  const [newOrderRequiredStages, setNewOrderRequiredStages] = useState<number[]>([]);
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OrderTemplate | null>(null);
  const [templateFormStages, setTemplateFormStages] = useState<number[]>([]);

  // Edit Order Modal State
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [editOrderForm, setEditOrderForm] = useState<Partial<Order>>({});
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editOrderHasExecutions, setEditOrderHasExecutions] = useState(false);

  // Cancel Order State
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);

  // Order History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Delivery Forecast State
  const [forecastData, setForecastData] = useState<OrderForecast[]>([]);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [expandedForecast, setExpandedForecast] = useState<number | null>(null);

  // Auth States
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [now, setNow] = useState(new Date());
  const [activeExecutions, setActiveExecutions] = useState<StageExecution[]>([]);

  const activeOrderTotalTime = useMemo(() => {
    if (!selectedOrder) return 0;
    if (!executions || executions.length === 0) return selectedOrder.total_time_seconds || 0;
    const stageAcc = executions.reduce((sum, e) => {
      const t = calculateExecutionTimes(e, e.pauses || [], now.getTime());
      return sum + t.totalAccumulatedSeconds;
    }, 0);
    return Math.max(selectedOrder.total_time_seconds || 0, stageAcc);
  }, [selectedOrder, executions, now]);
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Focus the "Escanear OP" field
  useEffect(() => {
    if (activeTab === 'kanban' || activeTab === 'orders') {
      // Small delay to ensure any modals/drawers have finished animating if needed
      const timer = setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab, selectedOrder, showNewOrderModal, showEditOrderModal, showHistoryModal, executions]);

  const getOrderRisk = (orderId: number) => {
    const forecast = forecastData.find(f => f.orderId === orderId);
    if (!forecast) return 'safe';
    return forecast.riskLevel;
  };

  const isImage = (url: string | undefined): boolean => {
    if (!url) return false;
    // Check if it's a data URL or has a common image extension
    if (url.startsWith('data:image/')) return true;
    const cleanUrl = url.split('?')[0].split('#')[0];
    const ext = cleanUrl.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
  };

  const isPdf = (url: string | undefined): boolean => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].split('#')[0];
    const ext = cleanUrl.split('.').pop()?.toLowerCase();
    return ext === 'pdf';
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      const userEmail = session.user.email.toLowerCase();
      safeFetch(`/api/users?search=${encodeURIComponent(userEmail)}`).then(data => {
        const found = data?.find((u: User) => u.email?.toLowerCase() === userEmail);
        if (found) {
          setCurrentUser(found);
        } else {
          console.warn(`[Auth] Usuário não encontrado na tabela 'users': ${userEmail}`);
          setCurrentUser({ id: 0, name: session.user.email, email: session.user.email, role: 'Produção', hourly_cost: 0, active: true });
        }
      });
    } else {
      setCurrentUser(null);
    }
  }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) setAuthError(error.message);
    setIsAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const safeFetch = async (url: string, options?: RequestInit) => {
    try {
      // Automatically inject role and user-name headers if user is logged in
      const roleHeaders: any = {};
      if (currentUser?.role) {
        roleHeaders['x-user-role'] = currentUser.role;
        roleHeaders['x-user-name'] = currentUser.name;
      }

      const res = await fetch(url, {
        ...options,
        headers: {
          ...roleHeaders,
          ...(options?.headers || {})
        }
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Fetch error ${res.status}: ${errorText}`);
        return null;
      }
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await res.json();
      }
      return null;
    } catch (err) {
      console.error(`Fetch exception for ${url}:`, err);
      return null;
    }
  };

  const fetchActiveExecution = async () => {
    if (!currentUser || currentUser.id === 0) return;
    const data = await safeFetch(`/api/executions/active/${currentUser.id}`);
    setActiveExecutions(data || []);
  };

  const fetchData = async () => {
    let statsUrl = '/api/dashboard/stats?';
    if (dateRange) {
      statsUrl += `startDate=${dateRange.start}&endDate=${dateRange.end}&`;
    }
    if (productTypeFilter) {
      statsUrl += `product_type=${productTypeFilter}&`;
    }
    if (printTypeFilter) {
      statsUrl += `print_type=${printTypeFilter}&`;
    }

    let ordersUrl = `/api/orders?search=${encodeURIComponent(searchTerm)}`;
    if (selectedStageFilter) {
      ordersUrl += `&stage_id=${selectedStageFilter}&stage_status=${selectedStageStatus}`;
    }
    if (productTypeFilter) {
      ordersUrl += `&product_type=${encodeURIComponent(productTypeFilter)}`;
    }
    if (printTypeFilter) {
      ordersUrl += `&print_type=${encodeURIComponent(printTypeFilter)}`;
    }

    let [ordersData, stagesData, statsData, templatesData] = await Promise.all([
      safeFetch(ordersUrl),
      safeFetch('/api/stages'),
      safeFetch(statsUrl),
      safeFetch('/api/order-templates')
    ]);

    // Fallback para consulta direta ao Supabase caso a API REST do backend falhe ou retorne nulo
    if (!Array.isArray(ordersData)) {
      console.warn('[FetchData] /api/orders indisponível via API. Executando fallback direto ao Supabase...');
      try {
        let { data: fallbackOrders } = await supabase.rpc('get_orders_with_stages', {
          p_search: searchTerm || null,
          p_stage_id: selectedStageFilter ? Number(selectedStageFilter) : null,
          p_stage_status: selectedStageStatus || null,
          p_product_type: productTypeFilter || null,
          p_print_type: printTypeFilter || null,
        });

        if (!Array.isArray(fallbackOrders) || fallbackOrders.length === 0) {
          const { data: directOrders } = await supabase
            .from('orders')
            .select('*')
            .is('deleted_at', null)
            .order('deadline', { ascending: true });
          if (Array.isArray(directOrders)) {
            fallbackOrders = directOrders;
          }
        }

        if (Array.isArray(fallbackOrders)) {
          ordersData = fallbackOrders.map((o: any) => ({
            ...o,
            stages_status: Array.isArray(o.stages_status) ? o.stages_status : []
          }));

          // Enrich fallbackOrders with items column
          try {
            const orderIds = ordersData.map((o: any) => o.id);
            if (orderIds.length > 0) {
              const { data: dbItems } = await supabase
                .from('orders')
                .select('id, items')
                .in('id', orderIds);
              if (dbItems) {
                const itemsMap = new Map();
                dbItems.forEach((row: any) => {
                  if (row.items) itemsMap.set(row.id, row.items);
                });
                ordersData.forEach((order: any) => {
                  order.items = itemsMap.get(order.id) || [];
                });
              }
            }
          } catch (err) {
            console.warn('[FetchData] Erro ao enriquecer items no fallback:', err);
          }

          try {
            const orderIds = ordersData.map((o: any) => o.id);
            const { data: obsData } = await supabase
              .from('stage_observations' as any)
              .select('order_id, stage_id, observation, created_at')
              .in('order_id', orderIds)
              .order('created_at', { ascending: false });

            if (obsData) {
              const obsMap = new Map();
              obsData.forEach((obs: any) => {
                const key = `${obs.order_id}_${obs.stage_id}`;
                if (!obsMap.has(key)) {
                  obsMap.set(key, {
                    observation: obs.observation,
                    created_at: obs.created_at
                  });
                }
              });

              ordersData.forEach((order: any) => {
                const activeStage = order.stages_status.find((s: any) => !s.finished);
                order.active_stage_name = activeStage?.name || null;
                
                const unfinishedStages = (order.stages_status || []).filter((s: any) => !s.finished);
                let newestObs = null;
                for (const st of unfinishedStages) {
                  const obsKey = `${order.id}_${st.id}`;
                  const obsObj = obsMap.get(obsKey);
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
              });
            } else {
              ordersData.forEach((order: any) => {
                const activeStage = order.stages_status.find((s: any) => !s.finished);
                order.active_stage_name = activeStage?.name || null;
                order.active_stage_observation = null;
              });
            }
          } catch (err) {
            console.warn('[FetchData] Falha ao buscar observações no fallback:', err);
            ordersData.forEach((order: any) => {
              const activeStage = order.stages_status.find((s: any) => !s.finished);
              order.active_stage_name = activeStage?.name || null;
              order.active_stage_observation = null;
            });
          }
        }
      } catch (err) {
        console.error('[FetchData] Erro no fallback do Supabase:', err);
      }
    }

    if (!Array.isArray(stagesData)) {
      try {
        const { data: fallbackStages } = await supabase.from('stages').select('*').order('sort_order', { ascending: true });
        if (Array.isArray(fallbackStages)) {
          stagesData = fallbackStages;
        }
      } catch (err) {}
    }

    if (Array.isArray(ordersData)) {
      // Prioridade visual por prazo (crescente)
      const sortedOrders = [...ordersData].sort((a: Order, b: Order) => {
        const timeA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const timeB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return (isNaN(timeA) ? Infinity : timeA) - (isNaN(timeB) ? Infinity : timeB);
      });
      setOrders(sortedOrders);
    }
    if (Array.isArray(stagesData)) setStages(stagesData);
    if (statsData) setStats(statsData);
    if (templatesData) setTemplates(templatesData);
    fetchCollaboratorGoals();
    fetchDraftOrders();

    // Always refresh forecast when data changes
    const forecastResult = await safeFetch('/api/orders/delivery-forecast');
    if (forecastResult) setForecastData(forecastResult);
  };

  const fetchDraftOrders = async () => {
    const data = await safeFetch('/api/orders/drafts');
    if (data && Array.isArray(data)) {
      setDraftOrders(data);
    }
  };

  const handleSyncOlist = async () => {
    setIsSyncingOlist(true);
    try {
      const res = await fetch('/api/integrations/olist/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 1 })
      });
      const contentType = res.headers.get('content-type') || '';
      
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`O servidor retornou uma resposta inesperada (HTTP ${res.status}). Tente novamente em alguns instantes.`);
      }

      if (!res.ok) throw new Error(data.error || 'Erro ao sincronizar com Olist ERP');

      await fetchData();
      await fetchDraftOrders();

      let msg = `Sincronização concluída com sucesso!\n`;
      msg += `Pedidos encontrados no Tiny (Histórico): ${data.total_found || 0}\n`;
      msg += `Pedidos elegíveis (De hoje em diante): ${data.eligible_count || 0}\n`;
      msg += `Novos rascunhos importados: ${data.imported_count || 0}\n`;
      msg += `Pedidos ignorados (já importados): ${data.skipped_count || 0}`;
      if (data.errors_count > 0) {
        msg += `\n⚠️ Erros: ${data.errors_count}`;
        if (data.errors && data.errors.length > 0) {
          msg += `\nPrimeiro erro: ${data.errors[0]?.error || JSON.stringify(data.errors[0])}`;
        }
      }
      alert(msg);
    } catch (err: any) {
      alert(`Erro na sincronização Olist: ${err.message}`);
    } finally {
      setIsSyncingOlist(false);
    }
  };

  const handleOpenDraftReview = (order: Order) => {
    setSelectedDraftOrder(order);
    setConfirmDraftForm({
      print_type: (order.print_type && ['DTF', 'Silk', 'Sublimação', 'Bordado'].includes(order.print_type) ? order.print_type : 'DTF') as any,
      product_type: order.product_type || 'Dry Fit',
      num_colors: order.num_colors || 1,
      observations: order.observations || '',
      required_stages: order.required_stages && order.required_stages.length > 0 ? order.required_stages : stages.filter(s => s.active).map(s => s.id)
    });
  };

  const handleConfirmDraftOrder = async () => {
    if (!selectedDraftOrder) return;
    setIsConfirmingDraft(true);
    try {
      const res = await fetch(`/api/orders/${selectedDraftOrder.id}/confirm-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-name': currentUser?.name || 'Vendedora'
        },
        body: JSON.stringify(confirmDraftForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao liberar pedido para produção');

      setSelectedDraftOrder(null);
      await fetchData();
      await fetchDraftOrders();
      alert(`Pedido #${selectedDraftOrder.order_number} liberado para produção com sucesso!`);
    } catch (err: any) {
      alert(`Erro ao liberar pedido: ${err.message}`);
    } finally {
      setIsConfirmingDraft(false);
    }
  };

  const handleDeleteDraftOrder = async (draftId: number) => {
    if (!confirm('Tem certeza que deseja excluir este rascunho de pedido?')) return;
    try {
      const res = await fetch(`/api/orders/drafts/${draftId}`, {
        method: 'DELETE',
        headers: { 'x-user-name': currentUser?.name || 'Vendedora' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir rascunho');

      if (selectedDraftOrder?.id === draftId) {
        setSelectedDraftOrder(null);
      }
      await fetchDraftOrders();
    } catch (err: any) {
      alert(`Erro ao excluir rascunho: ${err.message}`);
    }
  };

  const handleCleanOldDrafts = async () => {
    if (!confirm('Deseja excluir os rascunhos de pedidos antigos com mais de 7 dias?')) return;
    try {
      const res = await fetch('/api/orders/drafts/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-name': currentUser?.name || 'Vendedora'
        },
        body: JSON.stringify({ days: 7 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao limpar rascunhos antigos');
      await fetchDraftOrders();
      alert('Rascunhos antigos limpos com sucesso!');
    } catch (err: any) {
      alert(`Erro ao limpar rascunhos: ${err.message}`);
    }
  };

  const fetchCollaboratorGoals = async () => {
    const data = await safeFetch('/api/collaborator-goals');
    if (data) setCollaboratorGoals(data);
  };

  const fetchUsers = async () => {
    const data = await safeFetch(`/api/users?search=${encodeURIComponent(userSearchTerm)}`);
    if (data) setUsers(data);
  };

  const fetchExecutions = async (orderId: number) => {
    const data = await safeFetch(`/api/orders/${orderId}/executions`);
    if (data) setExecutions(data);
    let obsData = await safeFetch(`/api/orders/${orderId}/stage-observations`);
    if (!obsData) {
      try {
        const { data: sbObs } = await supabase
          .from('stage_observations' as any)
          .select('*, users(name)')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false });
        if (sbObs) {
          obsData = sbObs.map((o: any) => ({
            ...o,
            user_name: o.users?.name || 'Operador'
          }));
        }
      } catch (err) {
        console.warn('[fetchExecutions] Fallback stage_observations falhou:', err);
      }
    }
    setOrderStageObservations(obsData || []);
  };

  const fetchReports = async () => {
    const tzOffset = new Date().getTimezoneOffset();
    let url = `/api/reports?period=${reportPeriod}&startDate=${reportStartDate}&endDate=${reportEndDate}&tzOffset=${tzOffset}`;
    if (reportUser) url += `&user_id=${reportUser}`;
    if (reportStage) url += `&stage_id=${reportStage}`;
    if (reportPrintType) url += `&print_type=${encodeURIComponent(reportPrintType)}`;

    const data = await safeFetch(url);
    if (data) setReportData(data);

    const deliveryData = await safeFetch(`/api/reports/delivery?period=${reportPeriod}&startDate=${reportStartDate}&endDate=${reportEndDate}${reportPrintType ? `&print_type=${encodeURIComponent(reportPrintType)}` : ''}`);
    if (deliveryData) setDeliveryReportData(deliveryData);

    const delaysData = await safeFetch(`/api/reports/delays?startDate=${reportStartDate}&endDate=${reportEndDate}${reportPrintType ? `&print_type=${encodeURIComponent(reportPrintType)}` : ''}`);
    if (delaysData) setDelaysReportData(delaysData);

    const profileData = await safeFetch(`/api/reports/profiles?startDate=${reportStartDate}&endDate=${reportEndDate}${reportPrintType ? `&print_type=${encodeURIComponent(reportPrintType)}` : ''}`);
    if (profileData) setProfileReport(profileData || []);

    const goalsData = await safeFetch('/api/reports/goals-productivity');
    if (goalsData) setGoalsProductivityData(goalsData);

    const lossData = await safeFetch(`/api/reports/losses?startDate=${reportStartDate}&endDate=${reportEndDate}`);
    if (lossData) setLossReportData(lossData);

    const reasonsData = await safeFetch('/api/loss-reasons');
    if (reasonsData) setLossReasonsList(reasonsData);

    fetchOperationalReport();
  };

  const fetchOperationalReport = async () => {
    let url = `/api/reports/operational?startDate=${reportStartDate}&endDate=${reportEndDate}`;
    if (reportPrintType) url += `&print_type=${encodeURIComponent(reportPrintType)}`;
    const data = await safeFetch(url);
    if (data) setOperationalReportData(data);
  };

  const fetchConfig = async () => {
    const data = await safeFetch('/api/config');
    if (data) {
      if (data.meta_custo_por_peca !== undefined) setMetaCustoPeca(data.meta_custo_por_peca);
      if (data.auto_pause_time_weekday) setAutoPauseTimeWeekday(data.auto_pause_time_weekday);
      if (data.auto_pause_time_friday) setAutoPauseTimeFriday(data.auto_pause_time_friday);
      if (data.auto_pause_time_lunch) setAutoPauseTimeLunch(data.auto_pause_time_lunch);
    }
  };

  // Agendador de pausa automática: verifica o horário a cada minuto
  useEffect(() => {
    if (!currentUser) return; // Qualquer usuário logado pode disparar a verificação
    
    const check = () => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Dom, 1=Seg, ..., 5=Sex, 6=Sab
      if (dayOfWeek === 0 || dayOfWeek === 6) return; // Ignora fins de semana

      const checkTime = (target: string) => {
        if (!target) return false;
        const [hh, mm] = target.split(':').map(Number);
        // No frontend, mantemos a verificação do exato minuto para disparar apenas uma vez
        // O backend possui uma janela de ±3 min como margem de segurança
        return now.getHours() === hh && now.getMinutes() === mm;
      };

      const isLunch = checkTime(autoPauseTimeLunch);
      const isEndOfDay = checkTime(dayOfWeek === 5 ? autoPauseTimeFriday : autoPauseTimeWeekday);

      if (isLunch || isEndOfDay) {
        // Chamamos o novo endpoint robusto que valida o horário no server-side
        safeFetch('/api/executions/auto-pause', { method: 'POST' })
          .then((r) => {
            if (r?.paused > 0) {
              const reason = r.reason === 'almoço' ? 'almoço' : 'fim de expediente';
              console.log(`[AutoPause] ${r.paused} tarefa(s) pausada(s) - ${reason}.`);
              fetchData(); // Atualiza a UI para refletir as pausas
            }
          })
          .catch(console.error);
      }
    };
    
    // Verifica imediatamente ao montar e depois a cada minuto
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [currentUser, autoPauseTimeWeekday, autoPauseTimeFriday, autoPauseTimeLunch]);

  const fetchForecast = async () => {
    setIsLoadingForecast(true);
    const data = await safeFetch('/api/orders/delivery-forecast');
    if (data) setForecastData(data);
    setIsLoadingForecast(false);
  };

  const handleUpdateDeadline = async (orderId: number, newDeadline: string) => {
    await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': currentUser?.role || ''
      },
      body: JSON.stringify({ deadline: newDeadline })
    });
    fetchData();
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, deadline: newDeadline });
    }
  };

  const handleToggleDtf = async (orderId: number, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    
    // Optimistic UI updates
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, dtf_complete: nextStatus });
    }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, dtf_complete: nextStatus } : o));

    try {
      const res = await fetch(`/api/orders/${orderId}/dtf`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role || '',
          'x-user-name': currentUser?.name || 'Admin'
        },
        body: JSON.stringify({ dtf_complete: nextStatus })
      });
      if (!res.ok) {
        throw new Error('Falha ao atualizar status do DTF');
      }
    } catch (e) {
      console.error(e);
      // Revert status on failure
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, dtf_complete: currentStatus } : o));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, dtf_complete: currentStatus });
      }
      alert('Erro ao atualizar status do DTF.');
    }
    fetchData();
  };

  const handleUpdateDtfLocation = async (orderId: number, location: string) => {
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, dtf_location: location });
    }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, dtf_location: location } : o));

    try {
      const res = await fetch(`/api/orders/${orderId}/dtf`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role || '',
          'x-user-name': currentUser?.name || 'Admin'
        },
        body: JSON.stringify({ dtf_location: location })
      });
      if (!res.ok) {
        console.warn('Servidor respondeu com código de aviso/erro ao atualizar gaveteiro.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRequestToggleDtf = (orderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }
    
    if (confirmingDtfOrderId === orderId) {
      setConfirmingDtfOrderId(null);
    } else {
      setConfirmingDtfOrderId(orderId);
      confirmTimeoutRef.current = setTimeout(() => {
        setConfirmingDtfOrderId(null);
      }, 4000); // 4 seconds auto-reset
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (!window.confirm('⚠️ EXCLUIR PEDIDO\n\nO pedido será ocultado do sistema mas o histórico de execuções será mantido para auditoria.\n\nDeseja continuar?')) return;

    setIsDeletingOrder(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': currentUser?.role || '',
          'x-user-name': currentUser?.name || 'Admin'
        }
      });

      if (res.ok) {
        setSelectedOrder(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao excluir pedido');
      }
    } catch (err) {
      alert('Erro na conexão com o servidor');
    } finally {
      setIsDeletingOrder(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleGenerateTrackingLink = async (order: Order) => {
    setIsGeneratingLink(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/tracking-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role || 'Produção',
          'x-user-name': currentUser?.name || 'Operador',
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar link de acompanhamento');
      }

      const token = data.tracking_token;
      const trackingUrl = `${window.location.origin}/acompanhar/${token}`;
      await navigator.clipboard.writeText(trackingUrl);
      showToast('Link copiado!');
    } catch (err: any) {
      console.error('[Tracking Link] Error:', err);
      alert(err.message || 'Erro ao gerar e copiar link de acompanhamento.');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!window.confirm('⚠️ CANCELAR PEDIDO\n\nO pedido será marcado como cancelado e removido dos cálculos de capacidade. O histórico será mantido.\n\nDeseja continuar?')) return;

    setIsCancellingOrder(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: {
          'x-user-role': currentUser?.role || '',
          'x-user-name': currentUser?.name || 'Admin'
        }
      });
      if (res.ok) {
        fetchData();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: 'Cancelado' });
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao cancelar pedido');
      }
    } catch (err) {
      alert('Erro na conexão com o servidor');
    } finally {
      setIsCancellingOrder(false);
    }
  };

  const openEditOrderModal = (order: Order) => {
    setEditOrderForm({
      client_name: order.client_name,
      product_type: order.product_type,
      print_type: order.print_type,
      quantity: order.quantity,
      deadline: order.deadline ? order.deadline.split('T')[0] : '',
      observations: order.observations,
      required_stages: (order.required_stages || []).filter(id => {
        const stage = stages.find(s => s.id === id);
        return stage ? stage.active : false;
      }),
      num_colors: order.num_colors || 1,
      art_urls: order.art_urls || (order.art_url ? [order.art_url] : []),
      art_url: order.art_url,
    });

    // Open modal immediately to prevent "nothing happens" feeling
    setShowEditOrderModal(true);

    // Check if order has executions in the background
    safeFetch(`/api/orders/${order.id}/executions`).then(execs => {
      setEditOrderHasExecutions(execs && execs.length > 0);
    });
  };

  const handleEditOrderSubmit = async () => {
    if (!selectedOrder) return;

    // Client-side validation
    if (!editOrderForm.quantity || Number(editOrderForm.quantity) <= 0) {
      alert('Quantidade deve ser maior que zero.');
      return;
    }
    if (!editOrderForm.num_colors || Number(editOrderForm.num_colors) < 1) {
      alert('Número de cores deve ser pelo menos 1.');
      return;
    }

    setIsEditingOrder(true);
    try {
      const extraHeaders: any = {};
      if (selectedOrder.status === 'Entregue') {
        const confirmed = window.confirm('⚠️ PEDIDO JÁ ENTREGUE\n\nEste pedido já foi marcado como entregue. Editar pode afetar indicadores históricos.\n\nDeseja continuar?');
        if (!confirmed) { setIsEditingOrder(false); return; }
        extraHeaders['x-confirm-finalized'] = 'true';
      }

      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role || '',
          'x-user-name': currentUser?.name || 'Admin',
          ...extraHeaders
        },
        body: JSON.stringify(editOrderForm)
      });

      if (res.ok) {
        setShowEditOrderModal(false);
        fetchData();
        // Update local selectedOrder state
        setSelectedOrder({ ...selectedOrder, ...editOrderForm } as Order);
      } else {
        const err = await res.json();
        alert(err.error || err.message || 'Erro ao editar pedido');
      }
    } catch (err) {
      alert('Erro na conexão com o servidor');
    } finally {
      setIsEditingOrder(false);
    }
  };

  const handleViewHistory = async (orderId: number) => {
    setIsLoadingHistory(true);
    setShowHistoryModal(true);
    const data = await safeFetch(`/api/orders/${orderId}/history`);
    setOrderHistory(data || []);
    setIsLoadingHistory(false);
  };

  const handleAddImages = async (orderId: number, files: FileList) => {
    // Check file sizes (max 4MB to avoid Vercel limit)
    const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > MAX_FILE_SIZE) {
        alert(`O arquivo "${files[i].name}" é muito grande. O limite máximo é de 4MB por arquivo.`);
        return;
      }
    }

    setIsUploadingArt(true);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('art_files', files[i]);
    }

    try {
      const res = await fetch(`/api/orders/${orderId}/images`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const details = errData?.details ? `\n\nDetalhes:\n${errData.details.join('\n')}` : '';
        throw new Error(`${errData?.error || 'Falha no upload'}${details}`);
      }

      const data = await res.json();
      // Update local state for the selected order
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          art_urls: data.art_urls
        });
      }
      fetchData(); // Refresh all orders
    } catch (err) {
      alert('Erro ao adicionar imagens. Tente novamente.');
    } finally {
      setIsUploadingArt(false);
    }
  };

  const handleStartStage = async (stageId: number) => {
    if (!selectedOrder) return;
    
    // Confirmação ao iniciar tarefa
    const stageName = stages.find(s => s.id === stageId)?.name || 'Etapa';
    const confirmStart = window.confirm(`Operador atual: ${currentUser?.name}\nEtapa: ${stageName}\n\nDeseja iniciar esta tarefa?`);
    if (!confirmStart) return;
    
    const res = await fetch('/api/executions/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': currentUser?.role || ''
      },
      body: JSON.stringify({ order_id: selectedOrder.id, stage_id: stageId, user_id: currentUser!.id })
    });
    if (res.ok) {
      fetchExecutions(selectedOrder.id);
      fetchData();
      fetchActiveExecution();
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const moveStage = async (currentIndex: number, direction: 1 | -1) => {
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= stages.length) return;

    const newStages = [...stages];
    const stageA = newStages[currentIndex];
    const stageB = newStages[newIndex];

    // Swap in local state
    newStages[currentIndex] = stageB;
    newStages[newIndex] = stageA;

    // Swap sort_order values
    const tempSortOrder = stageA.sort_order;
    stageA.sort_order = stageB.sort_order;
    stageB.sort_order = tempSortOrder;

    setStages(newStages);

    try {
      await Promise.all([
        fetch(`/api/stages/${stageA.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': currentUser?.role || ''
          },
          body: JSON.stringify({ sort_order: stageA.sort_order })
        }),
        fetch(`/api/stages/${stageB.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': currentUser?.role || ''
          },
          body: JSON.stringify({ sort_order: stageB.sort_order })
        })
      ]);
      fetchData(); // Refresh to ensure backend sync
    } catch (err) {
      alert("Erro ao reordenar etapas.");
      fetchData(); // Rollback local state
    }
  };

  const handleOpenActionModal = (type: 'pause' | 'finish', executionId: number, stageId: number) => {
    setActionQuantityInput(0);
    setActionLossQuantityInput(0);
    const initialReason = lossReasonsList.length > 0 ? lossReasonsList[0].motivo : 'Defeito de corte';
    setActionLossReasonInput(initialReason);
    setActionLossReasonDetailInput('');
    const defaultReentry = lossReasonsList.find(r => r.motivo === initialReason)?.etapa_reentrada_id || stageId;
    setActionLossReentryStageIdInput(defaultReentry);
    setShowActionLossSection(false);
    setActionObservationInput('');
    setExecutionActionModal({ type, executionId, stageId });
  };

  const handlePauseStage = (executionId: number, stageId: number) => {
    handleOpenActionModal('pause', executionId, stageId);
  };

  const handleFinishStage = (executionId: number, stageId: number) => {
    handleOpenActionModal('finish', executionId, stageId);
  };

  const handleConfirmExecutionAction = async (actionType?: 'pause' | 'finish', forceFinish = false) => {
    if (!executionActionModal || !selectedOrder) return;
    const { executionId, stageId } = executionActionModal;
    const type = actionType || executionActionModal.type;

    // Validação do motivo se informou perdas
    if (actionLossQuantityInput > 0) {
      if (!actionLossReasonInput) {
        alert("Por favor, selecione o motivo da perda.");
        return;
      }
      if (actionLossReasonInput === 'Outro' && !actionLossReasonDetailInput.trim()) {
        alert("Por favor, informe o detalhamento do motivo 'Outro'.");
        return;
      }
    }

    setIsActionLoading(true);
    try {
      // 1. Se informou quantidade de peças boas > 0, registra o progresso primeiro
      if (actionQuantityInput > 0) {
        const progRes = await fetch(`/api/orders/${selectedOrder.id}/stages/${stageId}/progress`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': currentUser?.role || ''
          },
          body: JSON.stringify({
            incremento: actionQuantityInput,
            user_id: currentUser?.id || 1,
            user_name: currentUser?.name || 'Operador'
          })
        });
        if (!progRes.ok) {
          const err = await progRes.json();
          alert(err.error || "Erro ao registrar progresso.");
          return;
        }
      }

      // 2. Se informou peças perdidas > 0, registra a perda
      if (actionLossQuantityInput > 0) {
        const lossRes = await fetch(`/api/orders/${selectedOrder.id}/stages/${stageId}/loss`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': currentUser?.role || ''
          },
          body: JSON.stringify({
            quantidade_perdida: actionLossQuantityInput,
            motivo: actionLossReasonInput,
            motivo_detalhe: actionLossReasonDetailInput,
            etapa_reentrada_id: actionLossReentryStageIdInput || stageId,
            user_id: currentUser?.id || 1,
            user_name: currentUser?.name || 'Operador'
          })
        });
        if (!lossRes.ok) {
          const err = await lossRes.json();
          alert(err.error || "Erro ao registrar perda.");
          return;
        }
      }

      // 3. Executa a Pausa ou a Finalização
      if (type === 'pause') {
        await fetch(`/api/executions/${executionId}/pause`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': currentUser?.role || ''
          },
          body: JSON.stringify({ observation: actionObservationInput })
        });
        setExecutionActionModal(null);
        fetchExecutions(selectedOrder.id);
        fetchData();
        fetchActiveExecution();
      } else if (type === 'finish') {
        const finishRes = await fetch(`/api/executions/${executionId}/finish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': currentUser?.role || ''
          },
          body: JSON.stringify({ force: forceFinish, observation: actionObservationInput })
        });

        if (finishRes.ok) {
          setExecutionActionModal(null);
          fetchExecutions(selectedOrder.id);
          fetchData();
          fetchActiveExecution();
        } else {
          const err = await finishRes.json();
          if (err.canForce && !forceFinish) {
            const confirmForce = window.confirm(
              `${err.error}\n\nDeseja forçar a finalização desta etapa com saldo parcial?`
            );
            if (confirmForce) {
              await handleConfirmExecutionAction('finish', true);
            }
          } else {
            alert(err.error || "Erro ao finalizar etapa");
          }
        }
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResumeStage = async (executionId: number) => {
    await fetch(`/api/executions/${executionId}/resume`, {
      method: 'POST',
      headers: { 'x-user-role': currentUser?.role || '' }
    });
    fetchExecutions(selectedOrder!.id);
    fetchActiveExecution();
  };

  const handleOpenProgressModal = (stageId: number) => {
    setProgressStageId(stageId);
    setProgressIncrementInput(0);
    setIsProgressModalOpen(true);
  };

  const handleSaveProgress = async () => {
    if (!selectedOrder || !progressStageId || progressIncrementInput <= 0) return;
    const res = await fetch(`/api/orders/${selectedOrder.id}/stages/${progressStageId}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': currentUser?.role || ''
      },
      body: JSON.stringify({
        incremento: progressIncrementInput,
        user_id: currentUser?.id || 1,
        user_name: currentUser?.name || 'Operador'
      })
    });
    if (res.ok) {
      setIsProgressModalOpen(false);
      fetchData();
      fetchExecutions(selectedOrder.id);
      fetchActiveExecution();
    } else {
      const err = await res.json();
      alert(err.error || "Erro ao registrar progresso");
    }
  };

  const handleOpenLossModal = (stageId: number) => {
    setLossStageId(stageId);
    setLossQtyInput(1);
    const initialReason = lossReasonsList.length > 0 ? lossReasonsList[0].motivo : 'Defeito de corte';
    setLossReasonInput(initialReason);
    setLossReasonDetailInput('');
    const defaultReentry = lossReasonsList.find(r => r.motivo === initialReason)?.etapa_reentrada_id || stageId;
    setLossReentryStageIdInput(defaultReentry);
    setIsLossModalOpen(true);
  };

  const handleSaveLoss = async () => {
    if (!selectedOrder || !lossStageId || lossQtyInput <= 0 || !lossReasonInput) return;
    if (lossReasonInput === 'Outro' && !lossReasonDetailInput.trim()) {
      alert("Por favor, informe o detalhamento do motivo 'Outro'.");
      return;
    }
    const res = await fetch(`/api/orders/${selectedOrder.id}/stages/${lossStageId}/loss`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': currentUser?.role || ''
      },
      body: JSON.stringify({
        quantidade_perdida: lossQtyInput,
        motivo: lossReasonInput,
        motivo_detalhe: lossReasonDetailInput,
        etapa_reentrada_id: lossReentryStageIdInput,
        user_id: currentUser?.id || 1,
        user_name: currentUser?.name || 'Operador'
      })
    });
    if (res.ok) {
      setIsLossModalOpen(false);
      alert("Perda registrada com sucesso! A pendência de reposição foi enviada para a etapa de reentrada.");
      fetchData();
      fetchExecutions(selectedOrder.id);
      fetchActiveExecution();
    } else {
      const err = await res.json();
      alert(err.error || "Erro ao registrar perda");
    }
  };

  const handleSaveLossReasonsMapping = async (updatedReasons: LossReasonSetting[]) => {
    const res = await fetch('/api/loss-reasons', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': currentUser?.role || ''
      },
      body: JSON.stringify({ reasons: updatedReasons })
    });
    if (res.ok) {
      alert("Mapeamento de perdas atualizado!");
      setLossReasonsList(updatedReasons);
    } else {
      alert("Erro ao salvar mapeamento de perdas.");
    }
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': currentUser?.role || ''
      },
      body: JSON.stringify({ status })
    });
    fetchData();
  };

  useEffect(() => {
    fetchData();
    if (currentUser?.role === 'Admin') {
      fetchConfig();
    }
    if (activeTab === 'settings' && currentUser?.role === 'Admin') {
      fetchUsers();
      fetchCollaboratorGoals();
    }
  }, [searchTerm, dateRange, selectedStageFilter, selectedStageStatus, productTypeFilter, printTypeFilter, activeTab, currentUser]);

  useEffect(() => {
    if (activeTab === 'collaborators') {
      fetchUsers();
    }
  }, [activeTab, userSearchTerm]);

  useEffect(() => {
    if (activeTab === 'reports' || activeTab === 'costs') {
      fetchReports();
      safeFetch(`/api/reports/profiles?startDate=${reportStartDate}&endDate=${reportEndDate}${reportUser ? `&user_id=${reportUser}` : ''}`).then(data => {
        if (data) setProfileReport(data);
      });
    }
  }, [activeTab, reportPeriod, reportUser, reportStage, reportStartDate, reportEndDate, reportPrintType]);

  useEffect(() => {
    if (currentUser && currentUser.id !== 0) {
      fetchActiveExecution();
      const interval = setInterval(fetchActiveExecution, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Initialize selectedStageId and ensure items are loaded when order is opened
  useEffect(() => {
    if (selectedOrder) {
      const orderStages = selectedOrder.stages_status || [];
      const firstUnfinished = orderStages.find(s => !s.finished);
      if (firstUnfinished) {
        setSelectedStageId(firstUnfinished.id);
      } else if (orderStages.length > 0) {
        setSelectedStageId(orderStages[0].id);
      }

      // Guarantee items are populated for selectedOrder even if orders list was cached or missing items
      if (!selectedOrder.items || selectedOrder.items.length === 0) {
        supabase
          .from('orders')
          .select('items')
          .eq('id', selectedOrder.id)
          .single()
          .then(({ data }) => {
            if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
              setSelectedOrder(prev => (prev && prev.id === selectedOrder.id ? { ...prev, items: data.items } : prev));
            }
          });
      }
    } else {
      setSelectedStageId(null);
    }
  }, [selectedOrder]);

  // Shortcut Listener at top level to avoid Hook order violation
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore input if user is typing in another form field
      if ((e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) && e.target !== scanInputRef.current) {
        return;
      }

      // Handle Escape even if scan input is focused (to close order)
      if (e.key === 'Escape' && selectedOrder) {
        setSelectedOrder(null);
        return;
      }

      // If no order is selected, we don't handle the numbered shortcuts
      if (!selectedOrder) return;

      // Handle Arrow Navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const stageIds = (selectedOrder.stages_status || []).map(s => s.id);
        const currentIndex = stageIds.indexOf(selectedStageId || -1);
        
        if (e.key === 'ArrowDown') {
          const nextIndex = (currentIndex + 1) % Math.max(1, stageIds.length);
          if (stageIds[nextIndex] !== undefined) setSelectedStageId(stageIds[nextIndex]);
        } else {
          const prevIndex = (currentIndex - 1 + stageIds.length) % Math.max(1, stageIds.length);
          if (stageIds[prevIndex] !== undefined) setSelectedStageId(stageIds[prevIndex]);
        }
        return;
      }

      // Also ignore if the scan field is focused but the key is not one of our shortcuts
      const isShortcutKey = ['1', '2', '3'].includes(e.key);
      if (e.target === scanInputRef.current && !isShortcutKey) {
        return;
      }

      // Shortcut logic for the selected stage
      if (!selectedStageId) return;
      
      const stage = stages.find(s => s.id === selectedStageId);
      if (!stage) return;
      
      const execution = (executions || []).find(ex => ex.stage_id === stage.id);
      const isFinished = (selectedOrder.stages_status || []).find(s => s.id === selectedStageId)?.finished;

      switch (e.key) {
        case '1':
          e.preventDefault();
          if (isFinished) return;
          if (!execution) {
            handleStartStage(stage.id);
          } else if (execution.status === 'Pausado') {
            handleResumeStage(execution.id);
          }
          break;
        case '2':
          e.preventDefault();
          if (execution?.status === 'Em andamento') {
            handlePauseStage(execution.id, stage.id);
          }
          break;
        case '3':
          e.preventDefault();
          if (execution?.status === 'Em andamento') {
            handleFinishStage(execution.id, stage.id);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedOrder, selectedStageId, executions, stages, handleStartStage, handleResumeStage, handlePauseStage, handleFinishStage]);

  // New Order Form State
  const [newOrderForm, setNewOrderForm] = useState({
    client_name: '',
    product_type: 'Dry Fit',
    print_type: 'Silk',
    quantity: '',
    deadline: '',
    observations: ''
  });

  const applyTemplate = (template: OrderTemplate) => {
    setNewOrderForm(prev => ({
      ...prev,
      product_type: template.product_type,
      print_type: template.print_type,
      quantity: template.quantity.toString(),
      observations: template.observations
    }));

    // Fallback: Se o template não tiver etapas, carrega todas as ativas
    if (template.required_stages && template.required_stages.length > 0) {
      setNewOrderRequiredStages(template.required_stages.filter(id => {
        const stage = stages.find(s => s.id === id);
        return stage ? stage.active : false;
      }));
    } else {
      setNewOrderRequiredStages(stages.filter(s => s.active).map(s => s.id));
    }
  };


  const COLORS = React.useMemo(() => ['#18181b', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'], []);

  // Memoriazação robusta dos dados de custo para evitar crash durante renderização
  const memoizedCostsByCollaborator = React.useMemo(() => {
    if (!reportData?.costsByCollaborator || !Array.isArray(reportData.costsByCollaborator)) return [];
    return [...reportData.costsByCollaborator].sort((a: any, b: any) => {
      const costA = (Number(a?.total_cost) || 0) / (Number(a?.pecas) || 1);
      const costB = (Number(b?.total_cost) || 0) / (Number(b?.pecas) || 1);
      return costA - costB;
    });
  }, [reportData?.costsByCollaborator]);

  const memoizedOrdersCompleted = React.useMemo(() => {
    if (!operationalReportData?.pedidos_concluidos || !Array.isArray(operationalReportData.pedidos_concluidos)) return [];
    return [...operationalReportData.pedidos_concluidos];
  }, [operationalReportData?.pedidos_concluidos]);

  const isTrackingPage = window.location.pathname.startsWith('/acompanhar/');
  const trackingToken = isTrackingPage ? window.location.pathname.split('/').pop() || null : null;

  if (isTrackingPage) {
    return <PublicTracking token={trackingToken} />;
  }

  if (isAuthLoading) {
    return <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FA]"><div className="animate-spin text-zinc-400"><RefreshCw size={24} /></div></div>;
  }

  if (!session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FA] p-4 font-sans">
        <Card className="w-full max-w-md p-8 shadow-xl border-t-4 border-t-zinc-900 border-x-0 border-b-0 rounded-2xl">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-md">
              <Package size={26} />
            </div>
            <h1 className="font-bold text-3xl tracking-tight text-zinc-900">ComfortPro</h1>
          </div>

          <h2 className="text-xl font-bold mb-6 text-center text-zinc-800">Acesso Restrito</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            {authError && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium text-center border border-red-100">
                Ocorreu um erro: {authError}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">E-mail Corporativo</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all shadow-sm"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Senha</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all shadow-sm"
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3.5 rounded-lg mt-6 flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.98]">
              Entrar no Sistema <ChevronRight size={18} />
            </button>
          </form>
        </Card>
      </div>
    );
  }

  if (!currentUser) {
    return <div className="flex h-screen items-center justify-center bg-[#F8F9FA]"><p className="text-zinc-500 font-medium animate-pulse">Carregando permissões de perfil...</p></div>;
  }

  return (
    <div className="flex h-screen bg-[#F8F9FA] font-sans text-zinc-900 overflow-hidden">
      {/* Print Container */}
      {(activeTab === 'kanban' || activeTab === 'orders') && (
        <div className="print-container hidden text-black bg-white w-full p-8 font-sans">
          <div className="mb-6 border-b border-zinc-300 pb-4 flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-tight">Sequência de Produção</h1>
              <p className="text-sm mt-1 text-zinc-500">
                Emitido em: {format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div className="text-right text-sm">
              {selectedStageFilter && (
                <p>Etapa: <strong>{stages.find(s => s.id.toString() === selectedStageFilter)?.name || selectedStageFilter}</strong></p>
              )}
              {printTypeFilter && <p>Estampa: <strong>{printTypeFilter}</strong></p>}
            </div>
          </div>
          <table className="w-full border-collapse text-sm text-left">
            <thead>
              <tr className="bg-zinc-100 border-b-2 border-zinc-300 uppercase text-[10px] tracking-wider text-zinc-600">
                <th className="p-2 border-r border-zinc-200">Cliente</th>
                <th className="p-2 border-r border-zinc-200 text-center">Qtde</th>
                <th className="p-2 border-r border-zinc-200">Estampa</th>
                <th className="p-2 border-r border-zinc-200">Etapa atual</th>
                <th className="p-2 border-r border-zinc-200 text-center">Prazo</th>
                <th className="p-2 text-left" style={{minWidth: '200px'}}>Observação</th>
              </tr>
            </thead>
            <tbody>
              {(orders || [])
                .filter(o => o.status !== 'Entregue' && o.status !== 'Cancelado')
                .filter(o => !printTypeFilter || o.print_type === printTypeFilter)
                .filter(o => !productTypeFilter || o.product_type === productTypeFilter)
                .filter(o => {
                    if (!searchTerm) return true;
                    const search = searchTerm.toLowerCase();
                    return (
                      o.order_number.toLowerCase().includes(search) ||
                      o.client_name.toLowerCase().includes(search) ||
                      o.product_type.toLowerCase().includes(search) ||
                      (o.print_type || '').toLowerCase().includes(search)
                    );
                })
                .filter(o => {
                    if (!selectedStageFilter) return true;
                    const st = o.stages_status.find(s => s.id.toString() === selectedStageFilter);
                    if (!st) return false;
                    if (selectedStageStatus === 'Finished') return st.finished;
                    return !st.finished;
                })
                .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
                .map((o, idx) => (
                  <tr key={o.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                    <td className="p-2 border-b border-zinc-200 border-r font-medium truncate max-w-[220px]">{o.client_name}</td>
                    <td className="p-2 border-b border-zinc-200 border-r text-center font-bold">{o.quantity}</td>
                    <td className="p-2 border-b border-zinc-200 border-r text-xs">{o.print_type || '-'}</td>
                    <td className="p-2 border-b border-zinc-200 border-r text-xs font-semibold text-zinc-700">{o.active_stage_name || '-'}</td>
                    <td className="p-2 border-b border-zinc-200 border-r text-center text-xs font-medium">{safeFormat(o.deadline, 'dd/MM')}</td>
                    <td className="p-2 border-b border-zinc-200 text-xs text-zinc-700" style={{minWidth: '200px'}}>
                      {o.active_stage_observation 
                        ? <span className="italic">📝 {o.active_stage_observation.length > 120 
                            ? `${o.active_stage_observation.slice(0, 120)}...` 
                            : o.active_stage_observation}</span>
                        : ''}
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-200 bg-white p-6 flex flex-col gap-8 transition-transform duration-300 lg:relative lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white">
              <Package size={18} />
            </div>
            <h1 className="font-bold text-xl tracking-tight">ComfortPro</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-1 text-zinc-400">
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <SidebarItem
            icon={LayoutDashboard}
            label="Dashboard"
            active={activeTab === 'dashboard'}
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
          />
          <SidebarItem
            icon={ClipboardList}
            label="Kanban"
            active={activeTab === 'kanban'}
            onClick={() => { setActiveTab('kanban'); setIsMobileMenuOpen(false); }}
          />
          <SidebarItem
            icon={Package}
            label="Pedidos"
            active={activeTab === 'orders'}
            onClick={() => { setActiveTab('orders'); setIsMobileMenuOpen(false); }}
          />
          <SidebarItem
            icon={Scissors}
            label="Central de Corte"
            active={activeTab === 'cutting'}
            onClick={() => { setActiveTab('cutting'); setIsMobileMenuOpen(false); }}
            badge={cortePendingBadgeCount > 0 ? cortePendingBadgeCount : undefined}
          />
          {currentUser?.role === 'Admin' && (
            <SidebarItem
              icon={Users}
              label="Colaboradores"
              active={activeTab === 'collaborators'}
              onClick={() => { setActiveTab('collaborators'); setIsMobileMenuOpen(false); }}
            />
          )}
          <SidebarItem
            icon={FileText}
            label="Relatórios"
            active={activeTab === 'reports'}
            onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
          />
          {currentUser?.role === 'Admin' && (
            <SidebarItem
              icon={Activity}
              label="Monitor"
              active={activeTab === 'monitor'}
              onClick={() => { setActiveTab('monitor'); setIsMobileMenuOpen(false); }}
            />
          )}
          {currentUser?.role === 'Admin' && (
            <SidebarItem
              icon={DollarSign}
              label="Custos"
              active={activeTab === 'costs'}
              onClick={() => { setActiveTab('costs'); setIsMobileMenuOpen(false); }}
            />
          )}
          {currentUser?.role === 'Admin' && (
            <SidebarItem
              icon={Settings}
              label="Configurações"
              active={activeTab === 'settings'}
              onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
            />
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-100">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">
              <UserIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{currentUser?.name || '---'}</p>
              <p className="text-xs text-zinc-500 truncate">{currentUser?.role || '---'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={16} />
            Sair da Conta
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        
        {/* Banner Operador Ativo */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="text-sm font-bold text-emerald-900">Operador Ativo: {currentUser?.name || '---'}</span>
              <span className="hidden sm:inline text-emerald-300">•</span>
              <span className="text-xs font-medium text-emerald-700">Setor: {currentUser?.role || '---'}</span>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {activeExecutions.length > 0 && (
            <div className="flex flex-col gap-3 mb-6">
              {activeExecutions.length > 1 && (
                <div className="flex items-center gap-2 px-1">
                  <Activity size={16} className="text-zinc-400" />
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Tarefas em Andamento ({activeExecutions.length})</span>
                </div>
              )}
              {activeExecutions.map((exec) => (
                <RunningTaskBanner
                  key={exec.id}
                  execution={exec}
                  onNavigate={async () => {
                    const orderData = await safeFetch(`/api/orders?search=${exec.order_number}`);
                    if (orderData && orderData.length > 0) {
                      const order = orderData.find((o: Order) => o.id === exec.order_id);
                      if (order) {
                        setSelectedOrder(order);
                        fetchExecutions(order.id);
                        setActiveTab('kanban');
                      }
                    }
                  }}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
        <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold tracking-tight">
                {activeTab === 'dashboard' && 'Visão Geral'}
                {activeTab === 'kanban' && 'Fluxo de Produção'}
                {activeTab === 'orders' && 'Todos os Pedidos'}
                {activeTab === 'collaborators' && 'Colaboradores'}
                {activeTab === 'reports' && 'Relatórios'}
                {activeTab === 'costs' && 'Análise de Custos'}
                {activeTab === 'settings' && 'Configurações do Sistema'}
                {activeTab === 'monitor' && 'Monitor de Tarefas (Tempo Real)'}
              </h2>
              <p className="text-zinc-500 text-xs lg:text-sm">
                {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 bg-white border border-zinc-200 rounded-lg text-zinc-600"
            >
              <Menu size={20} />
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {activeTab === 'collaborators' && (
              <div className="relative w-full lg:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por nome ou email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-400 lg:min-w-[250px]"
                />
              </div>
            )}
            {(activeTab === 'kanban' || activeTab === 'orders') && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-400 sm:min-w-[200px]"
                  />
                </div>
                <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg p-1">
                  <select
                    value={selectedStageFilter}
                    onChange={(e) => setSelectedStageFilter(e.target.value)}
                    className="flex-1 px-2 py-1 bg-transparent text-sm focus:outline-none"
                  >
                    <option value="">Todas as Etapas</option>
                    {stages.map(stage => (
                      <option key={stage.id} value={stage.id}>{stage.name}</option>
                    ))}
                  </select>
                  {selectedStageFilter && (
                    <select
                      value={selectedStageStatus}
                      onChange={(e) => setSelectedStageStatus(e.target.value as any)}
                      className="px-2 py-1 bg-zinc-100 rounded text-[10px] font-bold focus:outline-none"
                    >
                      <option value="Pending">Pendente</option>
                      <option value="Finished">Concluído</option>
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg p-1">
                  <select
                    value={productTypeFilter}
                    onChange={(e) => setProductTypeFilter(e.target.value)}
                    className="flex-1 px-2 py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[100px]"
                  >
                    <option value="">Produtos</option>
                    <option value="Dry Fit">Dry Fit</option>
                    <option value="Algodão">Algodão</option>
                    <option value="Poliamida">Poliamida</option>
                  </select>
                  <div className="w-px h-4 bg-zinc-200 mx-1" />
                  <select
                    value={printTypeFilter}
                    onChange={(e) => setPrintTypeFilter(e.target.value)}
                    className="flex-1 px-2 py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[100px]"
                  >
                    <option value="">Estampas</option>
                    <option value="Silk">Silk</option>
                    <option value="DTF">DTF</option>
                    <option value="Sublimação">Sublimação</option>
                  </select>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 ml-2 bg-zinc-900 border border-zinc-900 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                  title="Imprimir Sequência"
                >
                  <Printer size={16} />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
              </div>
            )}
            {activeTab === 'collaborators' && (
              <button
                onClick={() => {
                  setSelectedUserForEdit(null);
                  setShowUserModal(true);
                }}
                className="w-full lg:w-auto bg-zinc-900 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors shadow-sm"
              >
                <Plus size={18} />
                Convidar Colaborador
              </button>
            )}
            {activeTab === 'dashboard' && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center gap-2 bg-white border border-zinc-200 p-1 rounded-lg shadow-sm overflow-x-auto">
                  <button
                    onClick={() => setDateRange(null)}
                    className={cn("whitespace-nowrap px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", !dateRange ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                  >
                    Tudo
                  </button>
                  <button
                    onClick={() => setDateRange({
                      start: startOfWeek(new Date()).toISOString(),
                      end: endOfWeek(new Date()).toISOString()
                    })}
                    className={cn("whitespace-nowrap px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", dateRange?.start === startOfWeek(new Date()).toISOString() ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                  >
                    Semana
                  </button>
                  <button
                    onClick={() => setDateRange({
                      start: startOfMonth(new Date()).toISOString(),
                      end: endOfMonth(new Date()).toISOString()
                    })}
                    className={cn("whitespace-nowrap px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", dateRange?.start === startOfMonth(new Date()).toISOString() ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                  >
                    Mês
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-white border border-zinc-200 p-1 rounded-lg shadow-sm">
                  <select
                    value={productTypeFilter}
                    onChange={(e) => setProductTypeFilter(e.target.value)}
                    className="flex-1 px-2 py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[100px]"
                  >
                    <option value="">Produtos</option>
                    <option value="Dry Fit">Dry Fit</option>
                    <option value="Algodão">Algodão</option>
                    <option value="Poliamida">Poliamida</option>
                  </select>
                  <div className="w-px h-4 bg-zinc-200 mx-1" />
                  <select
                    value={printTypeFilter}
                    onChange={(e) => setPrintTypeFilter(e.target.value)}
                    className="flex-1 px-2 py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[100px]"
                  >
                    <option value="">Estampas</option>
                    <option value="Silk">Silk</option>
                    <option value="DTF">DTF</option>
                    <option value="Sublimação">Sublimação</option>
                  </select>
                </div>
              </div>
            )}
            {activeTab === 'reports' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-white border border-zinc-200 p-1 rounded-lg shadow-sm">
                  <button
                    onClick={() => {
                      setReportPeriod('day');
                      setReportStartDate(format(new Date(), 'yyyy-MM-dd'));
                      setReportEndDate(format(new Date(), 'yyyy-MM-dd'));
                    }}
                    className={cn("px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", reportPeriod === 'day' ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                  >
                    Diário
                  </button>
                  <button
                    onClick={() => {
                      setReportPeriod('day');
                      setReportStartDate(format(new Date(), 'yyyy-MM-dd'));
                      setReportEndDate(format(new Date(), 'yyyy-MM-dd'));
                    }}
                    className={cn("px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", reportPeriod === 'day' ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                  >
                    Diário
                  </button>
                  <button
                    onClick={() => {
                      setReportPeriod('week');
                      setReportStartDate(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
                      setReportEndDate(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
                    }}
                    className={cn("px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", reportPeriod === 'week' ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                  >
                    Semanal
                  </button>
                  <button
                    onClick={() => {
                      setReportPeriod('month');
                      setReportStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                      setReportEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                    }}
                    className={cn("px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", reportPeriod === 'month' ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                  >
                    Mensal
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-white border border-zinc-200 p-1.5 rounded-lg shadow-sm">
                  <div className="flex items-center gap-2 px-2">
                    <Calendar size={14} className="text-zinc-400" />
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="text-[10px] font-medium bg-transparent focus:outline-none"
                    />
                    <span className="text-zinc-300">|</span>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="text-[10px] font-medium bg-transparent focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-white border border-zinc-200 p-1 rounded-lg shadow-sm">
                  <div className="flex items-center gap-1 px-2 border-r border-zinc-100 py-1 sm:py-0">
                    <span className="text-[8px] font-bold text-zinc-400 uppercase">Colab:</span>
                    <select
                      value={reportUser}
                      onChange={(e) => setReportUser(e.target.value)}
                      className="py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[80px]"
                    >
                      <option value="">Todos</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 sm:py-0">
                    <span className="text-[8px] font-bold text-zinc-400 uppercase">Etapa:</span>
                    <select
                      value={reportStage}
                      onChange={(e) => setReportStage(e.target.value)}
                      className="py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[80px]"
                    >
                      <option value="">Todas</option>
                      {stages.map(stage => (
                        <option key={stage.id} value={stage.id}>{stage.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1 px-2 border-l border-zinc-100 py-1 sm:py-0">
                    <span className="text-[8px] font-bold text-zinc-400 uppercase">Setor:</span>
                    <select
                      value={reportPrintType}
                      onChange={(e) => setReportPrintType(e.target.value)}
                      className="py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[80px]"
                    >
                      <option value="">Todos</option>
                      <option value="Silk">Silk</option>
                      <option value="DTF">DTF</option>
                      <option value="Sublimação">Sublimação</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => setIsPrintModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-900 text-white rounded-lg text-[10px] font-bold hover:bg-zinc-800 transition-all shadow-sm active:scale-95 ml-auto sm:ml-0"
                  title="Imprimir Relatório"
                >
                  <Printer size={12} />
                  <span>Imprimir Relatório</span>
                </button>
              </div>
            )}
            {activeTab === 'dashboard' ? (
              currentUser?.role === 'Admin' ? (
                <button
                  onClick={() => setActiveTab('settings')}
                  className="w-full lg:w-auto bg-zinc-900 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors shadow-sm"
                >
                  <Target size={18} />
                  Definir Metas
                </button>
              ) : null
            ) : (
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const scannedValue = (formData.get('escanearOp') as string).trim();
                    if (!scannedValue) return;

                    // Procura especificamente no campo client_name (como solicitado pelo usuário)
                    const searchLower = scannedValue.toLowerCase();
                    let foundOrder = orders.find(o => 
                      o.client_name && o.client_name.toLowerCase().includes(searchLower)
                    );

                    const handleOrderFound = (order: Order) => {
                      setSelectedOrder(order);
                      fetchExecutions(order.id);
                      (e.target as HTMLFormElement).reset();
                    };

                    if (foundOrder) {
                      handleOrderFound(foundOrder);
                    } else {
                      // Se não encontrar localmente, busca na API focando no nome do cliente
                      safeFetch(`/api/orders?search=${encodeURIComponent(scannedValue)}`).then(data => {
                        if (data && data.length > 0) {
                          // Prioriza match no client_name
                          const clientMatch = data.find((o: Order) => 
                            o.client_name && o.client_name.toLowerCase().includes(searchLower)
                          );
                          if (clientMatch) {
                            handleOrderFound(clientMatch);
                          } else {
                            // Se encontrar algo por outros campos mas o usuário quer apenas cliente
                            // podemos abrir o primeiro se for um scan literal do campo circled
                            handleOrderFound(data[0]);
                          }
                        } else {
                          alert('OP (Cliente) não encontrada no sistema.');
                        }
                      });
                    }
                  }}
                  className="relative group flex-1 lg:w-64"
                >
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-zinc-900 text-zinc-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    name="escanearOp"
                    ref={scanInputRef}
                    placeholder="Escanear OP (Cliente)..."
                    className="block w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm font-bold text-zinc-900 placeholder:text-zinc-400 placeholder:font-normal focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all outline-none"
                    autoComplete="off"
                  />
                </form>

                <button
                  onClick={handleSyncOlist}
                  disabled={isSyncingOlist}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm whitespace-nowrap text-xs font-bold active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Buscar novos pedidos aprovados dos últimos 7 dias do Olist ERP"
                >
                  <RefreshCw size={15} className={cn(isSyncingOlist && "animate-spin")} />
                  <span>{isSyncingOlist ? "Sincronizando..." : "Sincronizar Olist"}</span>
                </button>

                <button
                  onClick={() => setIsDraftsListModalOpen(true)}
                  className="relative bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm whitespace-nowrap text-xs font-bold active:scale-95 cursor-pointer"
                  title="Ver lista de rascunhos de pedidos importados do Olist ERP"
                >
                  <Package size={15} />
                  <span>Rascunhos Olist</span>
                  {draftOrders.length > 0 && (
                    <span className="bg-white text-amber-900 font-black px-1.5 py-0.5 rounded-full text-[10px] shadow-sm">
                      {draftOrders.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setShowNewOrderModal(true);
                    setNewOrderRequiredStages(stages.filter(s => s.active).map(s => s.id));
                  }}
                  className="bg-zinc-900 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors shadow-sm whitespace-nowrap"
                >
                  <Plus size={18} />
                  Novo Pedido
                </button>
              </div>
            )}
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <DashboardTab
            stats={stats}
            draftOrders={draftOrders}
            activeExecutions={activeExecutions}
            goalsProductivityData={goalsProductivityData}
            dateRange={dateRange}
            collaboratorGoals={collaboratorGoals}
            users={users}
            setDateRange={setDateRange}
            currentUser={currentUser}
            setActiveTab={setActiveTab}
            handleCleanOldDrafts={handleCleanOldDrafts}
            handleOpenDraftReview={handleOpenDraftReview}
            setInfoModal={setInfoModal}
            getOrderRisk={getOrderRisk}
            orders={orders}
          />
        )}

        {activeTab === 'kanban' && (
          <Kanban
            orders={orders}
            searchTerm={searchTerm}
            printTypeFilter={printTypeFilter}
            productTypeFilter={productTypeFilter}
            setSelectedOrder={setSelectedOrder}
            setInfoModal={setInfoModal}
            expandedReportStage={expandedReportStage}
            setExpandedReportStage={setExpandedReportStage}
            delaysReportData={delaysReportData}
            deliveryReportData={deliveryReportData}
            fetchExecutions={fetchExecutions}
          />
        )}

        {activeTab === 'orders' && (
          <Orders
            orders={orders}
            showCompletedOrders={showCompletedOrders}
            setShowCompletedOrders={setShowCompletedOrders}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedStageFilter={selectedStageFilter}
            setSelectedStageFilter={setSelectedStageFilter}
            selectedStageStatus={selectedStageStatus}
            setSelectedStageStatus={setSelectedStageStatus}
            productTypeFilter={productTypeFilter}
            setProductTypeFilter={setProductTypeFilter}
            printTypeFilter={printTypeFilter}
            setPrintTypeFilter={setPrintTypeFilter}
            setSelectedOrder={setSelectedOrder}
            setInfoModal={setInfoModal}
            expandedReportStage={expandedReportStage}
            setExpandedReportStage={setExpandedReportStage}
            delaysReportData={delaysReportData}
            deliveryReportData={deliveryReportData}
            setEditingDtfOrderId={setEditingDtfOrderId}
            setConfirmingDtfOrderId={setConfirmingDtfOrderId}
            setEditingDtfValue={setEditingDtfValue}
            confirmingDtfOrderId={confirmingDtfOrderId}
            editingDtfOrderId={editingDtfOrderId}
            currentUser={currentUser}
            handleToggleDtf={handleToggleDtf}
            handleRequestToggleDtf={handleRequestToggleDtf}
            handleUpdateDtfLocation={handleUpdateDtfLocation}
            handleUpdateDeadline={handleUpdateDeadline}
            editingDtfValue={editingDtfValue}
            fetchExecutions={fetchExecutions}
            confirmTimeoutRef={confirmTimeoutRef}
          />
        )}

        {activeTab === 'cutting' && (
          <ConsolidatedCuttingPanel
            orders={orders}
            users={users}
            currentUser={currentUser}
            onRefresh={fetchData}
            onSelectOrder={(ord) => {
              setSelectedOrder(ord);
            }}
          />
        )}

        {activeTab === 'collaborators' && (
          <Collaborators
            users={users}
            currentUser={currentUser}
            setSelectedUserForEdit={setSelectedUserForEdit}
            setShowUserModal={setShowUserModal}
          />
        )}

        {activeTab === 'reports' && (
          <Reports
  activeReportSubTab={activeReportSubTab}
  collaboratorGoals={collaboratorGoals}
  delaysReportData={delaysReportData}
  deliveryReportData={deliveryReportData}
  expandedReportStage={expandedReportStage}
  fetchExecutions={fetchExecutions}
  fetchReports={fetchReports}
  goalsProductivityData={goalsProductivityData}
  goalsViewType={goalsViewType}
  lossReportData={lossReportData}
  operationalReportData={operationalReportData}
  profileReport={profileReport}
  reportData={reportData}
  reportEndDate={reportEndDate}
  reportPeriod={reportPeriod}
  reportStartDate={reportStartDate}
  reportUser={reportUser}
  setActiveReportSubTab={setActiveReportSubTab}
  setExpandedReportStage={setExpandedReportStage}
  setGoalsViewType={setGoalsViewType}
  setInfoModal={setInfoModal}
  setReportEndDate={setReportEndDate}
  setReportPeriod={setReportPeriod}
  setReportStartDate={setReportStartDate}
  setReportUser={setReportUser}
  setSelectedOrder={setSelectedOrder}
  stages={stages}
  users={users}
/>
        )}

        {activeTab === 'costs' && currentUser?.role === 'Admin' && (
          <Costs
  currentUser={currentUser}
  fetchReports={fetchReports}
  memoizedCostsByCollaborator={memoizedCostsByCollaborator}
  memoizedOrdersCompleted={memoizedOrdersCompleted}
  metaCustoPeca={metaCustoPeca}
  operationalReportData={operationalReportData}
  reportData={reportData}
  reportEndDate={reportEndDate}
  reportStage={reportStage}
  reportStartDate={reportStartDate}
  reportUser={reportUser}
  setInfoModal={setInfoModal}
  setMetaCustoPeca={setMetaCustoPeca}
  setReportEndDate={setReportEndDate}
  setReportStage={setReportStage}
  setReportStartDate={setReportStartDate}
  setReportUser={setReportUser}
  stages={stages}
  users={users}
/>
        )}

        {activeTab === 'monitor' && currentUser?.role === 'Admin' && (
          <div className="max-w-7xl mx-auto pb-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight">Monitor de Tarefas</h2>
              <p className="text-zinc-500">Acompanhamento em tempo real da produção e tempos de execução</p>
            </div>
            <TaskMonitor onShowInfo={(t, d) => setInfoModal({ title: t, description: d })} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-8 pb-12">
            <Card className="p-8">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Settings size={20} />
                  Integração Supabase
                </h3>
                <button
                  onClick={async () => {
                    const data = await safeFetch('/api/supabase/status');
                    if (data?.status === 'success') {
                      alert('✅ Supabase conectado com sucesso!');
                    } else {
                      alert(`❌ Erro: ${data?.message || 'Falha na conexão'}`);
                    }
                  }}
                  className="text-[10px] font-bold uppercase tracking-wider text-sky-600 hover:text-sky-700"
                >
                  Testar Conexão
                </button>
              </div>
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Status do SDK:</span>
                  <Badge variant="info">Ativo</Badge>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  O SDK do Supabase foi inicializado. Para usar o Supabase como banco de dados principal (SQL),
                  certifique-se de configurar a <strong>DATABASE_URL</strong> com a Connection String do Supabase nos Secrets.
                </p>
              </div>
            </Card>

            <Card className="p-8">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <BarChart3 size={20} />
                Configuração de Capacidade Produtiva
              </h3>
              <form className="space-y-6" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  jornada_horas: Number(formData.get('jornada_horas')),
                  operadores_ativos: Number(formData.get('operadores_ativos')),
                  eficiencia_percentual: Number(formData.get('eficiencia_percentual')) / 100,
                  dias_uteis_mes: Number(formData.get('dias_uteis_mes')),
                  meta_custo_por_peca: Number(formData.get('meta_custo_por_peca'))
                };

                await fetch('/api/config', {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': currentUser?.role || ''
                  },
                  body: JSON.stringify(data)
                });
                fetchData();
              }}>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Jornada de Trabalho (Horas)</label>
                    <input
                      name="jornada_horas"
                      type="number"
                      step="0.5"
                      defaultValue={stats?.capacity?.config?.jornada_horas || 8}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Operadores Ativos</label>
                    <input
                      name="operadores_ativos"
                      type="number"
                      defaultValue={stats?.capacity?.config?.operadores_ativos || 2}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Eficiência Operacional (%)</label>
                    <input
                      name="eficiencia_percentual"
                      type="number"
                      defaultValue={(stats?.capacity?.config?.eficiencia_percentual || 0.85) * 100}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Dias Úteis no Mês</label>
                    <input
                      name="dias_uteis_mes"
                      type="number"
                      defaultValue={stats?.capacity?.config?.dias_uteis_mes || 22}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Meta Custo/Peça (R$)</label>
                    <input
                      name="meta_custo_por_peca"
                      type="number"
                      step="0.01"
                      defaultValue={metaCustoPeca || 0}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors">
                  Salvar Configurações
                </button>
              </form>
            </Card>

            <Card className="p-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <Clock size={20} />
                Horários de Pausa Automática
              </h3>
              <p className="text-xs text-zinc-400 mb-6">
                Ao atingir o horário configurado, todas as tarefas em andamento são pausadas automaticamente.
                O sistema requer que um Admin esteja com o sistema aberto no horário.
              </p>
              <form className="space-y-5" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const weekday = formData.get('auto_pause_time_weekday') as string;
                const friday = formData.get('auto_pause_time_friday') as string;
                const lunch = formData.get('auto_pause_time_lunch') as string;
                const res = await fetch('/api/config', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role || '' },
                  body: JSON.stringify({ auto_pause_time_weekday: weekday, auto_pause_time_friday: friday, auto_pause_time_lunch: lunch })
                });
                if (res.ok) {
                  setAutoPauseTimeWeekday(weekday);
                  setAutoPauseTimeFriday(friday);
                  setAutoPauseTimeLunch(lunch);
                  alert('✅ Horários salvos com sucesso!');
                }
              }}>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Almoço (Horário de Pausa)</label>
                    <input
                      name="auto_pause_time_lunch"
                      type="time"
                      defaultValue={autoPauseTimeLunch}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Seg – Qui (Fim de Expediente)</label>
                    <input
                      name="auto_pause_time_weekday"
                      type="time"
                      defaultValue={autoPauseTimeWeekday}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Sexta (Fim de Expediente)</label>
                    <input
                      name="auto_pause_time_friday"
                      type="time"
                      defaultValue={autoPauseTimeFriday}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors">
                  Salvar Horários
                </button>
              </form>
            </Card>
            <Card className="p-8">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Settings size={20} />
                Gerenciar Etapas de Produção
              </h3>

              <div className="flex flex-wrap gap-2 mb-8">
                <input
                  type="text"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="Nome da nova etapa (ex: Silk 2 Cores)"
                  className="flex-1 min-w-[200px] p-2 border border-zinc-200 rounded-lg text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  value={newStageTime || ''}
                  onChange={(e) => setNewStageTime(Number(e.target.value))}
                  placeholder="Tempo Ideal (min/peça)"
                  title="Tempo ideal da etapa em minutos por peça"
                  className="p-2 border border-zinc-200 rounded-lg text-sm w-36 focus:outline-none focus:border-zinc-400"
                />
                 <select
                  value={newStageCalculationType}
                  onChange={(e) => setNewStageCalculationType(e.target.value as any)}
                  className="p-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:border-zinc-400"
                >
                  <option value="por_pedido">📄 Por pedido</option>
                  <option value="por_peca">👕 Por peça</option>
                  <option value="por_lote">📦 Por lote</option>
                </select>
                <input
                  type="number"
                  value={newStageMetaDiaria}
                  onChange={(e) => setNewStageMetaDiaria(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Meta Diária"
                  title="Meta de produção diária base para esta etapa"
                  className="p-2 border border-zinc-200 rounded-lg text-sm w-28 focus:outline-none focus:border-zinc-400"
                />
                <button
                  onClick={async () => {
                    if (!newStageName) return;
                    await fetch('/api/stages', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-user-role': currentUser?.role || ''
                      },
                      body: JSON.stringify({ 
                        name: newStageName, 
                        ideal_time: newStageTime * 60,
                        calculation_type: newStageCalculationType,
                        meta_diaria: newStageMetaDiaria !== '' ? newStageMetaDiaria : null
                      })
                    });
                    setNewStageName('');
                    setNewStageTime(0);
                    setNewStageCalculationType('por_peca');
                    setNewStageMetaDiaria('');
                    fetchData();
                  }}
                  className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors"
                >
                  Adicionar
                </button>
              </div>

              <div className="space-y-3">
                {stages.map((stage, index) => {
                  const idealTimeDisplay = stage.ideal_time || stage.average_time_seconds || 0;
                  return (
                  <div key={stage.id} className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-100 rounded-xl group">
                    <div className="flex items-center gap-4 flex-1">
                      <span className="text-xs font-bold text-zinc-400 w-6">{stage.sort_order}</span>
                      {editingStageId === stage.id ? (
                        <div className="flex flex-wrap flex-1 gap-2">
                          <input
                            type="text"
                            autoFocus
                            value={editingStageName}
                            onChange={(e) => setEditingStageName(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === 'Escape') setEditingStageId(null);
                            }}
                            className="flex-1 min-w-[150px] bg-white border border-zinc-300 rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={editingStageTime === 0 ? '' : editingStageTime}
                            onChange={(e) => setEditingStageTime(Number(e.target.value))}
                            className="p-1 border border-zinc-300 rounded text-sm w-24 text-center"
                            title="Tempo ideal por peça em minutos"
                          />
                          <select
                            value={editingStageCalculationType}
                            onChange={(e) => setEditingStageCalculationType(e.target.value as any)}
                            className="p-1 border border-zinc-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                          >
                            <option value="por_pedido">📄 Por pedido</option>
                            <option value="por_peca">👕 Por peça</option>
                            <option value="por_lote">📦 Por lote</option>
                          </select>
                          <input
                            type="number"
                            value={editingStageMetaDiaria}
                            onChange={(e) => setEditingStageMetaDiaria(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Meta Diária"
                            title="Meta de produção diária base para esta etapa"
                            className="p-1 border border-zinc-300 rounded text-sm w-24 text-center"
                          />
                          <button
                            onClick={async () => {
                              if (editingStageName) {
                                await fetch(`/api/stages/${stage.id}`, {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'x-user-role': currentUser?.role || ''
                                  },
                                  body: JSON.stringify({ 
                                    name: editingStageName, 
                                    ideal_time: editingStageTime * 60,
                                    calculation_type: editingStageCalculationType,
                                    meta_diaria: editingStageMetaDiaria !== '' ? editingStageMetaDiaria : null
                                  })
                                });
                                fetchData();
                              }
                              setEditingStageId(null);
                            }}
                            className="px-3 py-1 bg-zinc-900 text-white rounded text-xs font-bold hover:bg-zinc-800 transition-colors"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingStageId(null)}
                            className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded text-xs font-bold hover:bg-zinc-200 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{stage.name}</span>
                            {stage.calculation_type === 'por_pedido' && <Badge variant="info" className="lowercase italic opacity-70">por pedido</Badge>}
                            {stage.calculation_type === 'por_peca' && <Badge variant="success" className="lowercase italic opacity-70">por peça</Badge>}
                            {stage.calculation_type === 'por_lote' && <Badge variant="warning" className="lowercase italic opacity-70">por lote</Badge>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {idealTimeDisplay > 0 ? <span className="text-[10px] text-zinc-500 font-mono bg-white px-1.5 py-0.5 rounded border border-zinc-200">
                              Ideal: {formatSeconds(idealTimeDisplay)} {stage.calculation_type === 'por_peca' ? '/pc' : ''}
                            </span> : null}
                            {stage.real_average_time && stage.real_average_time > 0 ? (
                               <span className="text-[10px] text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                 Real: {formatSeconds(stage.real_average_time)} ({stage.execution_count} rec)
                               </span>
                            ) : null}
                            {stage.meta_diaria && stage.meta_diaria > 0 ? (
                              <span className="text-[10px] text-violet-600 font-mono bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100">
                                Meta: {stage.meta_diaria}/{stage.calculation_type === 'por_pedido' ? 'ped' : 'pc'}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="success">Ativa</Badge>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => moveStage(index, -1)}
                          disabled={index === 0}
                          className="p-1.5 hover:bg-zinc-200 rounded text-zinc-500 disabled:opacity-30 transition-colors"
                          title="Mover para cima"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => moveStage(index, 1)}
                          disabled={index === stages.length - 1}
                          className="p-1.5 hover:bg-zinc-200 rounded text-zinc-500 disabled:opacity-30 transition-colors"
                          title="Mover para baixo"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <div className="w-px h-4 bg-zinc-200 mx-1"></div>
                        <button
                          onClick={() => {
                            setEditingStageId(stage.id);
                            setEditingStageName(stage.name);
                            setEditingStageTime(Math.round((stage.ideal_time || stage.average_time_seconds || 0) / 60));
                            setEditingStageCalculationType(stage.calculation_type || 'por_peca');
                            setEditingStageMetaDiaria(stage.meta_diaria ?? '');
                          }}
                          className="p-1.5 hover:bg-zinc-200 rounded text-zinc-500 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Tem certeza que deseja excluir a etapa "${stage.name}"?`)) {
                              await fetch(`/api/stages/${stage.id}`, {
                                method: 'DELETE',
                                headers: { 'x-user-role': currentUser?.role || '' }
                              });
                              fetchData();
                            }
                          }}
                          className="p-1.5 hover:bg-rose-100 rounded text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>

              {/* Metas Individuais por Colaborador */}
              <div className="mt-8 border-t border-zinc-100 pt-6">
                <h4 className="text-sm font-bold text-zinc-700 mb-4 flex items-center gap-2">
                  <Target size={16} className="text-zinc-500" />
                  Metas Individuais por Colaborador (Overrides)
                </h4>
                <p className="text-xs text-zinc-500 mb-4">Configure metas personalizadas por colaborador que sobrescrevem a meta padrão do setor.</p>
                <div className="space-y-2">
                  {stages.map(stage => (
                    <div key={stage.id} className="border border-zinc-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => {
                          setExpandedGoalStageId(expandedGoalStageId === stage.id ? null : stage.id);
                          if (expandedGoalStageId !== stage.id) fetchCollaboratorGoals();
                        }}
                        className="w-full flex items-center justify-between p-3 bg-zinc-50 hover:bg-zinc-100 transition-colors text-left"
                      >
                        <span className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                          {stage.name}
                          <span className="text-[10px] text-zinc-400 font-mono">
                            Meta padrão: {stage.meta_diaria ?? '—'} {stage.calculation_type === 'por_pedido' ? 'pedidos' : 'peças'}/dia
                          </span>
                        </span>
                        <ChevronRight size={14} className={cn('text-zinc-400 transition-transform', expandedGoalStageId === stage.id && 'rotate-90')} />
                      </button>
                      {expandedGoalStageId === stage.id && (
                        <div className="p-4 space-y-2">
                          {users.filter(u => u.active).map(user => {
                            const override = collaboratorGoals.find(g => g.user_id === user.id && g.stage_id === stage.id);
                            const key = `${stage.id}-${user.id}`;
                            const editVal = goalEditValues[key] ?? '';
                            return (
                              <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-50/50 border border-zinc-100">
                                <span className="text-sm font-medium text-zinc-700 w-40 truncate">{user.name}</span>
                                {override ? (
                                  <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">Meta personalizada: {override.meta_diaria}</span>
                                ) : (
                                  <span className="text-[10px] text-zinc-400">Usa padrão do setor ({stage.meta_diaria ?? '—'})</span>
                                )}
                                <div className="flex items-center gap-2 ml-auto">
                                  <input
                                    type="number"
                                    value={editVal}
                                    onChange={e => setGoalEditValues(v => ({ ...v, [key]: e.target.value }))}
                                    placeholder={String(override?.meta_diaria ?? stage.meta_diaria ?? '')}
                                    className="w-20 p-1 border border-zinc-200 rounded text-xs text-center"
                                  />
                                  <button
                                    onClick={async () => {
                                      if (!editVal) return;
                                      await fetch('/api/collaborator-goals', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role || '' },
                                        body: JSON.stringify({ user_id: user.id, stage_id: stage.id, meta_diaria: Number(editVal) })
                                      });
                                      setGoalEditValues(v => { const n = { ...v }; delete n[key]; return n; });
                                      fetchCollaboratorGoals();
                                    }}
                                    className="px-2 py-1 bg-zinc-900 text-white rounded text-[10px] font-bold hover:bg-zinc-700 transition-colors"
                                  >Salvar</button>
                                  {override && (
                                    <button
                                      onClick={async () => {
                                        if (!override.id) return;
                                        await fetch(`/api/collaborator-goals/${override.id}`, {
                                          method: 'DELETE',
                                          headers: { 'x-user-role': currentUser?.role || '' }
                                        });
                                        fetchCollaboratorGoals();
                                      }}
                                      className="px-2 py-1 bg-rose-50 text-rose-600 rounded text-[10px] font-bold hover:bg-rose-100 transition-colors"
                                    >Remover</button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Mapeamento de Motivos de Perda & Etapa de Reentrada */}
            <Card className="p-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <AlertCircle size={20} className="text-rose-600" />
                Mapeamento de Motivos de Perda & Etapa de Reentrada Padrão
              </h3>
              <p className="text-xs text-zinc-500 mb-6">
                Configure para qual etapa a peça de reposição reentra automaticamente no fluxo quando um operador registra uma perda.
              </p>
              <div className="space-y-3">
                {lossReasonsList.map((reason, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl gap-3">
                    <div className="flex-1">
                      <span className="font-bold text-xs text-zinc-900">{reason.motivo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 font-medium">Reentra em:</span>
                      <select
                        value={reason.etapa_reentrada_id}
                        onChange={(e) => {
                          const newId = Number(e.target.value);
                          const updated = lossReasonsList.map((r, i) => i === idx ? { ...r, etapa_reentrada_id: newId } : r);
                          setLossReasonsList(updated);
                        }}
                        className="p-2 border border-zinc-200 rounded-lg text-xs bg-white font-medium focus:outline-none focus:border-zinc-400"
                      >
                        {stages.map(st => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleSaveLossReasonsMapping(lossReasonsList)}
                className="mt-6 px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-colors"
              >
                Salvar Mapeamento de Perdas
              </button>
            </Card>

            <Card className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ClipboardList size={20} />
                  Gerenciar Templates de Pedido
                </h3>
                {currentUser?.role === 'Admin' && (
                  <button
                    onClick={() => {
                      setEditingTemplate(null);
                      setTemplateFormStages(stages.filter(s => s.active).map(s => s.id));
                      setIsTemplateEditorOpen(true);
                    }}
                    className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} /> Novo Template
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl hover:border-zinc-300 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-sm text-zinc-900">{template.name}</h4>
                      {currentUser?.role === 'Admin' && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingTemplate(template);
                              setTemplateFormStages(template.required_stages || []);
                              setIsTemplateEditorOpen(true);
                            }}
                            className="p-1.5 hover:bg-zinc-200 rounded text-zinc-500"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Excluir template "${template.name}"?`)) {
                                await fetch(`/api/order-templates/${template.id}`, {
                                  method: 'DELETE',
                                  headers: { 'x-user-role': currentUser?.role || '' }
                                });
                                fetchData();
                              }
                            }}
                            className="p-1.5 hover:bg-rose-100 rounded text-rose-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="default">{template.product_type}</Badge>
                      <Badge variant="info">{template.print_type}</Badge>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Etapas Inclusas:</div>
                    <div className="flex flex-wrap gap-1">
                      {stages.filter(s => template.required_stages?.includes(s.id)).map(s => (
                        <span key={s.id} className="px-2 py-0.5 bg-zinc-200 text-zinc-600 rounded text-[9px] font-bold">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-8 border border-rose-100 bg-rose-50/10">
              <h3 className="text-lg font-bold text-rose-900 mb-2 flex items-center gap-2">
                <AlertTriangle size={20} className="text-rose-600" />
                Zona de Perigo: Ações Críticas
              </h3>
              <p className="text-xs text-zinc-500 mb-6">
                Estas ações são irreversíveis e afetam permanentemente os dados do sistema. Certifique-se do que está fazendo.
              </p>
              
              <div className="p-5 bg-white border border-rose-200/50 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-sm transition-all duration-200">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-zinc-900">Zerar Relatórios & Histórico de Produção</h4>
                  <p className="text-xs text-zinc-500 max-w-xl leading-relaxed">
                    Apaga permanentemente todos os registros de tempos operacionais e pausas (<code className="bg-zinc-100 text-zinc-600 px-1 py-0.5 rounded text-[10px] font-mono">stage_executions</code> e <code className="bg-zinc-100 text-zinc-600 px-1 py-0.5 rounded text-[10px] font-mono">pauses</code>). 
                    Os pedidos, clientes e configurações <strong>não serão excluídos</strong>, mas todas as métricas de relatórios e produtividade voltarão a zero.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const promptVal = prompt("⚠️ AVISO CRÍTICO: Isto irá zerar todas as estatísticas de relatórios operacionais e produtividade dos colaboradores permanentemente.\n\nPara prosseguir, digite \"CONFIRMAR\" abaixo:");
                    if (promptVal !== "CONFIRMAR") {
                      if (promptVal !== null) {
                        alert("Operação cancelada. A confirmação não foi digitada corretamente.");
                      }
                      return;
                    }

                    try {
                      const res = await fetch('/api/admin/reset-production', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-user-role': currentUser?.role || '',
                          'x-user-name': currentUser?.name || 'Admin'
                        }
                      });

                      const data = await res.json();
                      if (res.ok && data.success) {
                        alert("✅ " + data.message);
                        fetchData(); // Recarrega todas as informações
                      } else {
                        alert("❌ Falha ao zerar relatórios: " + (data.error || "Erro desconhecido"));
                      }
                    } catch (err: any) {
                      console.error("Erro ao resetar:", err);
                      alert("❌ Erro de rede ou servidor ao realizar a limpeza.");
                    }
                  }}
                  className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all duration-200 shadow-sm shadow-rose-100 hover:shadow active:scale-98 whitespace-nowrap self-start md:self-center pointer-events-auto"
                >
                  Zerar Relatórios e Tempos
                </button>
              </div>
            </Card>
          </div>
        )
        }
      </main>

      <InfoModal
        isOpen={!!infoModal}
        onClose={() => setInfoModal(null)}
        title={infoModal?.title || ''}
        description={infoModal?.description || ''}
      />

      <AnimatePresence>
        {isPrintModalOpen && (
          <PrintableReport
            isOpen={isPrintModalOpen}
            onClose={() => setIsPrintModalOpen(false)}
            reportStartDate={reportStartDate}
            reportEndDate={reportEndDate}
            reportPeriod={reportPeriod}
            reportUser={reportUser}
            reportStage={reportStage}
            reportPrintType={reportPrintType}
            users={users}
            stages={stages}
            reportData={reportData}
            operationalReportData={operationalReportData}
            goalsProductivityData={goalsProductivityData}
            isAdmin={currentUser?.role === 'Admin'}
          />
        )}
      </AnimatePresence>

        {/* Order Details Drawer */}
        <OrderDetailsDrawer
          selectedOrder={selectedOrder}
          setSelectedOrder={setSelectedOrder}
          stages={stages}
          executions={executions}
          currentUser={currentUser}
          now={now}
          orderStageObservations={orderStageObservations}
          isGeneratingLink={isGeneratingLink}
          isUploadingArt={isUploadingArt}
          isCancellingOrder={isCancellingOrder}
          isDeletingOrder={isDeletingOrder}
          confirmingDtfOrderId={confirmingDtfOrderId}
          setConfirmingDtfOrderId={setConfirmingDtfOrderId}
          openEditOrderModal={openEditOrderModal}
          setSelectedFullImage={setSelectedFullImage}
          handleGenerateTrackingLink={handleGenerateTrackingLink}
          handleAddImages={handleAddImages}
          handleCancelOrder={handleCancelOrder}
          handleDeleteOrder={handleDeleteOrder}
          handleViewHistory={handleViewHistory}
          handleUpdateDeadline={handleUpdateDeadline}
          handleToggleDtf={handleToggleDtf}
          handleRequestToggleDtf={handleRequestToggleDtf}
          handleUpdateDtfLocation={handleUpdateDtfLocation}
          handleStartStage={handleStartStage}
          handlePauseStage={handlePauseStage}
          handleResumeStage={handleResumeStage}
          handleFinishStage={handleFinishStage}
          setSelectedStageId={setSelectedStageId}
          selectedStageId={selectedStageId}
        />

        {/* New Order Modal (Simplified for MVP) */}
        <NewOrderModal
          showNewOrderModal={showNewOrderModal}
          setShowNewOrderModal={setShowNewOrderModal}
          isCreatingOrder={isCreatingOrder}
          setIsCreatingOrder={setIsCreatingOrder}
          newOrderForm={newOrderForm}
          setNewOrderForm={setNewOrderForm}
          fetchData={fetchData}
          stages={stages}
          newOrderRequiredStages={newOrderRequiredStages}
          setNewOrderRequiredStages={setNewOrderRequiredStages}
          currentUser={currentUser}
          templates={templates}
          setEditingTemplate={setEditingTemplate}
          setTemplateFormStages={setTemplateFormStages}
          setIsTemplateEditorOpen={setIsTemplateEditorOpen}
          applyTemplate={applyTemplate}
        />

        {/* User Modal (Collaborators) */}
        <UserModal
          showUserModal={showUserModal}
          setShowUserModal={setShowUserModal}
          selectedUserForEdit={selectedUserForEdit}
          fetchUsers={fetchUsers}
          isSubmitting={isSubmitting}
          setIsSubmitting={setIsSubmitting}
          currentUser={currentUser}
        />

        {/* Template Editor Modal */}
        <TemplateEditorModal
          isTemplateEditorOpen={isTemplateEditorOpen}
          setIsTemplateEditorOpen={setIsTemplateEditorOpen}
          editingTemplate={editingTemplate}
          isSubmitting={isSubmitting}
          setIsSubmitting={setIsSubmitting}
          templateFormStages={templateFormStages}
          setTemplateFormStages={setTemplateFormStages}
          stages={stages}
          fetchData={fetchData}
          currentUser={currentUser}
        />

        {/* Photo Lightbox */}
        <PhotoLightbox
          selectedFullImage={selectedFullImage}
          setSelectedFullImage={setSelectedFullImage}
        />

        {/* 📦 Edit Order Modal 📦 */}
        <EditOrderModal
          showEditOrderModal={showEditOrderModal}
          setShowEditOrderModal={setShowEditOrderModal}
          editOrderForm={editOrderForm}
          setEditOrderForm={setEditOrderForm}
          selectedOrder={selectedOrder}
          setSelectedOrder={setSelectedOrder}
          handleEditOrderSubmit={handleEditOrderSubmit}
          isEditingOrder={isEditingOrder}
          stages={stages}
          editOrderHasExecutions={editOrderHasExecutions}
          isUploadingArt={isUploadingArt}
          setIsUploadingArt={setIsUploadingArt}
          setSelectedFullImage={setSelectedFullImage}
          fetchData={fetchData}
        />

        {/* 🕒 Order History Modal 🕒 */}
        <OrderHistoryModal
          showHistoryModal={showHistoryModal}
          setShowHistoryModal={setShowHistoryModal}
          selectedOrder={selectedOrder}
          orderHistory={orderHistory}
          isLoadingHistory={isLoadingHistory}
          users={users}
        />

        {/* MODAL UNIFICADO: Pausar / Finalizar Etapa com Registro de Produção e Perdas */}
        <ExecutionActionModal
          executionActionModal={executionActionModal}
          setExecutionActionModal={setExecutionActionModal}
          isActionLoading={isActionLoading}
          handleConfirmExecutionAction={handleConfirmExecutionAction}
          actionQuantityInput={actionQuantityInput}
          setActionQuantityInput={setActionQuantityInput}
          actionObservationInput={actionObservationInput}
          setActionObservationInput={setActionObservationInput}
          showActionLossSection={showActionLossSection}
          setShowActionLossSection={setShowActionLossSection}
          actionLossQuantityInput={actionLossQuantityInput}
          setActionLossQuantityInput={setActionLossQuantityInput}
          actionLossReasonInput={actionLossReasonInput}
          setActionLossReasonInput={setActionLossReasonInput}
          actionLossReasonDetailInput={actionLossReasonDetailInput}
          setActionLossReasonDetailInput={setActionLossReasonDetailInput}
          actionLossReentryStageIdInput={actionLossReentryStageIdInput}
          setActionLossReentryStageIdInput={setActionLossReentryStageIdInput}
          lossReasonsList={lossReasonsList}
          stages={stages}
          selectedOrder={selectedOrder}
        />

        {/* MODAL: Registrar Progresso Parcial */}
        <PartialProgressModal
          isProgressModalOpen={isProgressModalOpen}
          setIsProgressModalOpen={setIsProgressModalOpen}
          selectedOrder={selectedOrder}
          progressStageId={progressStageId}
          stages={stages}
          progressIncrementInput={progressIncrementInput}
          setProgressIncrementInput={setProgressIncrementInput}
          handleSaveProgress={handleSaveProgress}
        />

        {/* MODAL: Registrar Perda */}
        <LossModal
          isLossModalOpen={isLossModalOpen}
          setIsLossModalOpen={setIsLossModalOpen}
          selectedOrder={selectedOrder}
          lossStageId={lossStageId}
          stages={stages}
          lossQtyInput={lossQtyInput}
          setLossQtyInput={setLossQtyInput}
          lossReasonInput={lossReasonInput}
          setLossReasonInput={setLossReasonInput}
          lossReasonDetailInput={lossReasonDetailInput}
          setLossReasonDetailInput={setLossReasonDetailInput}
          lossReentryStageIdInput={lossReentryStageIdInput}
          setLossReentryStageIdInput={setLossReentryStageIdInput}
          lossReasonsList={lossReasonsList}
          handleSaveLoss={handleSaveLoss}
        />

        {/* Olist Draft Order Review Modal */}
        <OlistDraftReviewModal
          selectedDraftOrder={selectedDraftOrder}
          setSelectedDraftOrder={setSelectedDraftOrder}
          confirmDraftForm={confirmDraftForm}
          setConfirmDraftForm={setConfirmDraftForm}
          isConfirmingDraft={isConfirmingDraft}
          handleConfirmDraftOrder={handleConfirmDraftOrder}
          handleDeleteDraftOrder={handleDeleteDraftOrder}
          stages={stages}
        />

        {/* Olist Draft Orders Full List Modal */}
        <OlistDraftListModal
          isDraftsListModalOpen={isDraftsListModalOpen}
          setIsDraftsListModalOpen={setIsDraftsListModalOpen}
          draftOrders={draftOrders}
          handleCleanOldDrafts={handleCleanOldDrafts}
          handleDeleteDraftOrder={handleDeleteDraftOrder}
          handleOpenDraftReview={handleOpenDraftReview}
        />

      {/* Global Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-zinc-900 border border-zinc-800 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold z-[100] flex items-center gap-2 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
































