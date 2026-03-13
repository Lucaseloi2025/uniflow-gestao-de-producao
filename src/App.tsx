import React, { useState, useEffect } from 'react';
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
  ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
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
import { cn, formatSeconds } from './lib/utils';
import { Order, Stage, StageExecution, DashboardStats, User, StageStatus, OrderTemplate, OrderHistory, OrderForecast, DeliveryReportData, OperationalReportData, OperationalStep, OrderProgress, FinishedOrder, CollaboratorProductivity } from './types';

// Components
const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200",
      active
        ? "bg-zinc-900 text-white shadow-lg"
        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
    )}
  >
    <Icon size={20} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const Card = ({ children, className, ...props }: any) => (
  <div className={cn("bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden", className)} {...props}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'error', className?: string }) => {
  const variants = {
    default: "bg-zinc-100 text-zinc-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
    error: "bg-rose-100 text-rose-700",
    info: "bg-sky-100 text-sky-700",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", variants[variant], className)}>
      {children}
    </span>
  );
};

const RunningTaskBanner = ({ execution, onNavigate }: { execution: StageExecution, onNavigate: () => void }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!execution.start_time) return;

    // Use parseISO for more reliable parsing across browsers/timezones
    const start = parseISO(execution.start_time).getTime();
    const pauseMs = (execution.accumulated_pause_seconds || 0) * 1000;

    const updateTimer = () => {
      if (execution.is_paused) return; // Stop updating if paused
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - start - pauseMs) / 1000)));
    };

    updateTimer(); // Initial call

    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [execution.start_time, execution.accumulated_pause_seconds, execution.is_paused]);

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
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tempo Decorrido</span>
            <span className="text-xl font-mono font-bold tabular-nums">{formatSeconds(elapsed)}</span>
          </div>
          <ChevronRight size={20} className="text-zinc-600" />
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'kanban' | 'orders' | 'collaborators' | 'reports' | 'costs' | 'settings'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [templates, setTemplates] = useState<OrderTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [deliveryReportData, setDeliveryReportData] = useState<DeliveryReportData | null>(null);
  const [delaysReportData, setDelaysReportData] = useState<DeliveryReportData['atrasados'] | null>(null);
  const [reportPeriod, setReportPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [reportUser, setReportUser] = useState<string>('');
  const [reportStage, setReportStage] = useState<string>('');
  const [reportPrintType, setReportPrintType] = useState<string>('');
  const [profileReport, setProfileReport] = useState<any[]>([]);
  const [operationalReportData, setOperationalReportData] = useState<OperationalReportData | null>(null);
  const [reportStartDate, setReportStartDate] = useState<string>(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState<string>(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [metaCustoPeca, setMetaCustoPeca] = useState<number>(0);
  const [autoPauseTimeWeekday, setAutoPauseTimeWeekday] = useState<string>('18:00');
  const [autoPauseTimeFriday, setAutoPauseTimeFriday] = useState<string>('17:00');
  const [autoPauseTimeLunch, setAutoPauseTimeLunch] = useState<string>('12:00');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [executions, setExecutions] = useState<StageExecution[]>([]);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const [isUploadingArt, setIsUploadingArt] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [editingStageName, setEditingStageName] = useState('');
  const [simOperadores, setSimOperadores] = useState<number>(0);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('');
  const [selectedStageStatus, setSelectedStageStatus] = useState<'Pending' | 'Finished'>('Pending');
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
  const [activeExecution, setActiveExecution] = useState<StageExecution | null>(null);
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);

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
    setActiveExecution(data);
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

    const [ordersData, stagesData, statsData, templatesData] = await Promise.all([
      safeFetch(ordersUrl),
      safeFetch('/api/stages'),
      safeFetch(statsUrl),
      safeFetch('/api/order-templates')
    ]);

    if (ordersData) setOrders(ordersData);
    if (stagesData) setStages(stagesData);
    if (statsData) setStats(statsData);
    if (templatesData) setTemplates(templatesData);

    // Always refresh forecast when data changes
    const forecastResult = await safeFetch('/api/orders/delivery-forecast');
    if (forecastResult) setForecastData(forecastResult);
  };

  const fetchUsers = async () => {
    const data = await safeFetch(`/api/users?search=${encodeURIComponent(userSearchTerm)}`);
    if (data) setUsers(data);
  };

  const fetchExecutions = async (orderId: number) => {
    const data = await safeFetch(`/api/orders/${orderId}/executions`);
    if (data) setExecutions(data);
  };

  const fetchReports = async () => {
    let url = `/api/reports?period=${reportPeriod}&startDate=${reportStartDate}&endDate=${reportEndDate}`;
    if (reportUser) url += `&user_id=${reportUser}`;
    if (reportStage) url += `&stage_id=${reportStage}`;
    if (reportPrintType) url += `&print_type=${encodeURIComponent(reportPrintType)}`;

    const data = await safeFetch(url);
    if (data) setReportData(data);

    const deliveryData = await safeFetch(`/api/reports/delivery?period=${reportPeriod}&startDate=${reportStartDate}&endDate=${reportEndDate}${reportPrintType ? `&print_type=${encodeURIComponent(reportPrintType)}` : ''}`);
    if (deliveryData) setDeliveryReportData(deliveryData);

    const delaysData = await safeFetch(`/api/reports/delays?startDate=${reportStartDate}&endDate=${reportEndDate}${reportPrintType ? `&print_type=${encodeURIComponent(reportPrintType)}` : ''}`);
    if (delaysData) setDelaysReportData(delaysData);

    const profileData = await safeFetch(`/api/reports/profile?startDate=${reportStartDate}&endDate=${reportEndDate}${reportPrintType ? `&print_type=${encodeURIComponent(reportPrintType)}` : ''}`);
    if (profileData) setProfileReport(profileData || []);

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
    if (currentUser?.role !== 'Admin') return; // Só Admin dispara o pause-all
    const check = () => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Dom, 1=Seg, ..., 5=Sex, 6=Sab
      if (dayOfWeek === 0 || dayOfWeek === 6) return; // Ignora fins de semana

      const checkTime = (target: string) => {
        if (!target) return false;
        const [hh, mm] = target.split(':').map(Number);
        return now.getHours() === hh && now.getMinutes() === mm;
      };

      const isLunch = checkTime(autoPauseTimeLunch);
      const isEndOfDay = checkTime(dayOfWeek === 5 ? autoPauseTimeFriday : autoPauseTimeWeekday);

      if (isLunch || isEndOfDay) {
        safeFetch('/api/executions/pause-all', { method: 'POST' })
          .then((r) => {
            if (r?.paused > 0) {
              const reason = isLunch ? 'almoço' : 'fim de expediente';
              console.log(`[AutoPause] ${r.paused} tarefa(s) pausada(s) - ${reason}.`);
            }
          })
          .catch(console.error);
      }
    };
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
      required_stages: order.required_stages || [],
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
    if (files.length === 0) return;
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

      if (!res.ok) throw new Error('Falha no upload');

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

  const handlePauseStage = async (executionId: number) => {
    await fetch(`/api/executions/${executionId}/pause`, {
      method: 'POST',
      headers: { 'x-user-role': currentUser?.role || '' }
    });
    fetchExecutions(selectedOrder!.id);
    fetchActiveExecution();
  };

  const handleResumeStage = async (executionId: number) => {
    await fetch(`/api/executions/${executionId}/resume`, {
      method: 'POST',
      headers: { 'x-user-role': currentUser?.role || '' }
    });
    fetchExecutions(selectedOrder!.id);
    fetchActiveExecution();
  };

  const handleFinishStage = async (executionId: number) => {
    if (!window.confirm("Tem certeza que deseja finalizar esta etapa?")) return;
    await fetch(`/api/executions/${executionId}/finish`, {
      method: 'POST',
      headers: { 'x-user-role': currentUser?.role || '' }
    });
    fetchExecutions(selectedOrder!.id);
    fetchData();
    fetchActiveExecution();
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
  }, [searchTerm, dateRange, selectedStageFilter, selectedStageStatus, productTypeFilter, printTypeFilter, activeTab]);

  useEffect(() => {
    if (activeTab === 'collaborators') {
      fetchUsers();
    }
  }, [activeTab, userSearchTerm]);

  useEffect(() => {
    if (activeTab === 'reports' || activeTab === 'costs') {
      fetchReports();
      safeFetch(`/api/reports/profile?startDate=${reportStartDate}&endDate=${reportEndDate}${reportUser ? `&user_id=${reportUser}` : ''}`).then(data => {
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
      setNewOrderRequiredStages(template.required_stages);
    } else {
      setNewOrderRequiredStages(stages.filter(s => s.active).map(s => s.id));
    }
  };


  const COLORS = ['#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8'];

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
              <p className="text-sm font-semibold truncate">{currentUser.name}</p>
              <p className="text-xs text-zinc-500 truncate">{currentUser.role}</p>
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
        <AnimatePresence>
          {activeExecution && (
            <RunningTaskBanner
              execution={activeExecution}
              onNavigate={async () => {
                const orderData = await safeFetch(`/api/orders?search=${activeExecution.order_number}`);
                if (orderData && orderData.length > 0) {
                  const order = orderData.find((o: Order) => o.id === activeExecution.order_id);
                  if (order) {
                    setSelectedOrder(order);
                    fetchExecutions(order.id);
                    setActiveTab('kanban');
                  }
                }
              }}
            />
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
                    className="flex-1 px-2 py-1 bg-transparent text-[10px] font-medium focus:outline-none"
                  >
                    <option value="">Todos Produtos</option>
                    <option value="Dry Fit">Dry Fit</option>
                    <option value="Algodão">Algodão</option>
                    <option value="Poliamida">Poliamida</option>
                  </select>
                  <div className="w-px h-4 bg-zinc-200 mx-1" />
                  <select
                    value={printTypeFilter}
                    onChange={(e) => setPrintTypeFilter(e.target.value)}
                    className="flex-1 px-2 py-1 bg-transparent text-[10px] font-medium focus:outline-none"
                  >
                    <option value="">Todas Estampas</option>
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
              <button
                onClick={() => {
                  setShowNewOrderModal(true);
                  setNewOrderRequiredStages(stages.filter(s => s.active).map(s => s.id));
                }}
                className="w-full lg:w-auto bg-zinc-900 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors shadow-sm"
              >
                <Plus size={18} />
                Novo Pedido
              </button>
            )}
          </div>
        </header>

        {activeTab === 'dashboard' && stats && (
          <div className="space-y-8">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-zinc-100 rounded-xl text-zinc-600">
                    <Package size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Pedidos Ativos</p>
                    <h3 className="text-2xl font-bold">{stats.metrics?.activeOrders || 0}</h3>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                    <Layers size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Peças em Produção</p>
                    <h3 className="text-2xl font-bold">{stats.metrics?.activePieces || 0} <span className="text-sm font-normal text-zinc-400">un</span></h3>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className={cn("p-3 rounded-xl", (stats.metrics?.overdueOrders || 0) > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Pedidos Atrasados</p>
                    <h3 className={cn("text-2xl font-bold", (stats.metrics?.overdueOrders || 0) > 0 ? "text-rose-600" : "text-emerald-600")}>{stats.metrics?.overdueOrders || 0}</h3>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Produção Hoje</p>
                    <h3 className="text-2xl font-bold">{stats.metrics?.todayFinalizedPieces || 0} <span className="text-sm font-normal text-zinc-400">peças</span></h3>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Tempo Médio</p>
                    <h3 className="text-2xl font-bold">{((stats.metrics?.avgLeadTimeSeconds || 0) / 86400).toFixed(1)} <span className="text-sm font-normal text-zinc-400">dias</span></h3>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Central Orders Table */}
              <div className="lg:col-span-2 space-y-8">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold flex items-center gap-2">
                      <List size={18} className="text-zinc-400" />
                      Pedidos em Produção
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-100">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Pedido</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Cliente</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Produto</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Qtd</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Prazo</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {orders.filter(o => o.status !== 'Entregue' && o.status !== 'Cancelado').map(order => {
                          const risk = getOrderRisk(order.id);
                          const riskColors = {
                            danger: "text-rose-600",
                            warning: "text-amber-600",
                            safe: "text-emerald-600"
                          };

                          return (
                            <tr key={order.id} className="hover:bg-zinc-50 transition-colors">
                              <td className={cn("px-4 py-3 font-mono text-xs font-bold", riskColors[risk])}>{order.order_number}</td>
                              <td className="px-4 py-3 text-sm font-medium text-zinc-800">{order.client_name}</td>
                              <td className="px-4 py-3 text-sm text-zinc-600">{order.product_type}</td>
                              <td className="px-4 py-3 text-center text-sm font-bold text-zinc-700">{order.quantity}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn("text-xs font-bold", riskColors[risk])}>
                                  {format(parseISO(order.deadline), 'dd/MM/yyyy')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn(
                                  "inline-flex px-2 py-1 rounded-full text-[10px] font-bold",
                                  order.status === 'Em Produção' ? 'bg-sky-100 text-sky-700' :
                                    order.status === 'Finalização' ? 'bg-amber-100 text-amber-700' :
                                      'bg-zinc-100 text-zinc-700'
                                )}>
                                  {order.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {orders.filter(o => o.status !== 'Entregue' && o.status !== 'Cancelado').length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">Nenhum pedido em produção.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Productivity Table */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold flex items-center gap-2">
                      <Users size={18} className="text-zinc-400" />
                      Produtividade por Colaborador
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-100">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Colaborador</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Pedidos Finais</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Peças Feitas</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Tempo Médio/Peça</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {(stats.productivity || []).map(prod => (
                          <tr key={prod.collaborator} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-zinc-800">{prod.collaborator}</td>
                            <td className="px-4 py-3 text-center text-sm text-zinc-600">{prod.orders_count}</td>
                            <td className="px-4 py-3 text-center text-sm font-bold text-zinc-700">{prod.pieces_count}</td>
                            <td className="px-4 py-3 text-center font-mono text-xs text-zinc-600">{(prod.avg_time_per_piece / 60).toFixed(1)} min</td>
                          </tr>
                        ))}
                        {(!stats.productivity || stats.productivity.length === 0) && (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-500">Sem dados de produtividade no período.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* Sidebar panels */}
              <div className="space-y-8">
                {/* At Risk Orders */}
                <Card className="p-6 border-rose-100">
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-rose-700">
                    <AlertTriangle size={18} />
                    Pedidos em Risco ou Atrasados
                  </h3>
                  <div className="space-y-3">
                    {(stats.atRiskOrders || []).map(risk => (
                      <div key={risk.id} className="p-3 bg-rose-50 rounded-lg border border-rose-100 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-mono font-bold text-rose-700">{risk.order_number}</p>
                          <p className="text-sm font-medium text-zinc-800 truncate max-w-[120px]">{risk.client_name}</p>
                          <p className="text-[10px] text-zinc-500">{format(parseISO(risk.deadline), 'dd/MM/yyyy')}</p>
                        </div>
                        <Badge variant="error" className="py-1">{risk.urgency === 'Atrasado' ? 'ATR' : 'RSC'}</Badge>
                      </div>
                    ))}
                    {(!stats.atRiskOrders || stats.atRiskOrders.length === 0) && (
                      <div className="text-center py-4 text-emerald-600 bg-emerald-50 rounded-lg border border-emerald-100 text-sm">
                        Nenhum pedido em risco! 🎉
                      </div>
                    )}
                  </div>
                </Card>

                {/* Bottlenecks */}
                <Card className="p-6 border-amber-100">
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-amber-700">
                    <Filter size={18} />
                    Gargalos da Produção
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4">Setores com mais pedidos aguardando ou em andamento no momento.</p>
                  <div className="space-y-3">
                    {(stats.bottlenecks || []).map((bottleneck, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </div>
                          <p className="text-sm font-medium text-zinc-800">{bottleneck.stage_name}</p>
                        </div>
                        <p className="text-sm font-bold text-zinc-700">{bottleneck.count} <span className="text-[10px] font-normal text-zinc-400">pedidos</span></p>
                      </div>
                    ))}
                    {(!stats.bottlenecks || stats.bottlenecks.length === 0) && (
                      <div className="text-center py-4 text-zinc-500 text-sm">
                        Fluxo normalizado.
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'kanban' && (
          <div className="flex lg:grid lg:grid-cols-4 gap-6 h-[calc(100vh-250px)] overflow-x-auto pb-4 lg:overflow-x-visible">
            {['Entrada', 'Em Produção', 'Finalização', 'Entregue'].map((status) => (
              <div key={status} className="flex flex-col gap-4 min-w-[280px] lg:min-w-0">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500">{status}</h3>
                  <span className="bg-zinc-200 text-zinc-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {orders.filter(o => o.status === status).length}
                  </span>
                </div>
                <div className="flex-1 bg-zinc-100/50 rounded-xl p-3 flex flex-col gap-3 overflow-y-auto border border-zinc-200/50">
                  {orders.filter(o => o.status === status).map(order => {
                    const isOverdue = order.status !== 'Entregue' && isPast(endOfDay(parseISO(order.deadline)));
                    return (
                      <motion.div
                        layoutId={`order-${order.id}`}
                        key={order.id}
                        onClick={() => {
                          setSelectedOrder(order);
                          fetchExecutions(order.id);
                        }}
                        className={cn(
                          "bg-white rounded-lg border shadow-sm cursor-pointer transition-colors group overflow-hidden",
                          isOverdue ? "border-rose-500 bg-rose-50/30 hover:border-rose-600" : "border-zinc-200 hover:border-zinc-400"
                        )}
                      >
                        {order.art_url && (
                          <div className="w-full h-32 bg-zinc-100 relative overflow-hidden group/art">
                            {isImage(order.art_url) ? (
                              <img
                                src={order.art_url}
                                alt="Mockup"
                                className="w-full h-full object-cover transition-transform group-hover/art:scale-110"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-50 border-b border-zinc-100 text-zinc-400">
                                <FileText size={40} />
                                <span className="text-[10px] uppercase font-black tracking-tighter mt-1">{order.art_url.split('.').pop()}</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-[10px] font-mono text-zinc-400">{order.order_number}</span>
                            <Badge variant={isOverdue ? 'danger' : (differenceInDays(parseISO(order.deadline), new Date()) < 2 ? 'warning' : 'default')}>
                              {format(parseISO(order.deadline), 'dd/MM')}
                            </Badge>
                          </div>
                          <h4 className="font-bold text-sm mb-1 group-hover:text-zinc-900">{order.client_name}</h4>
                          <p className="text-xs text-zinc-500 mb-3">{order.quantity}x {order.product_type}</p>

                          {order.stages_status && order.stages_status.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {order.stages_status.map((stage, i) => (
                                <div
                                  key={i}
                                  title={stage.name}
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    stage.finished ? "bg-emerald-500" : "bg-zinc-200"
                                  )}
                                />
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <Badge variant="info">{order.print_type}</Badge>
                            <div className="flex items-center gap-1 text-zinc-400">
                              <Clock size={12} />
                              <span className="text-[10px] font-mono">{formatSeconds(order.total_time_seconds)}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'orders' && (
          <Card>
            <table className="w-full text-left">
              <thead>
                <tr className="border-bottom border-zinc-200 bg-zinc-50">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Pedido</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Cliente</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Produto</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Prazo</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-right">Tempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {orders.map(order => {
                  const isOverdue = order.status !== 'Entregue' && isPast(endOfDay(parseISO(order.deadline)));
                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isOverdue ? "bg-rose-50 hover:bg-rose-100" : "hover:bg-zinc-50"
                      )}
                      onClick={() => {
                        setSelectedOrder(order);
                        fetchExecutions(order.id);
                      }}
                    >
                      <td className="px-6 py-4 font-mono text-xs font-bold">{order.order_number}</td>
                      <td className="px-6 py-4 text-sm font-medium">{order.client_name}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          {order.stages_status.map((stage, i) => (
                            <div
                              key={i}
                              title={stage.name}
                              className={cn(
                                "w-2 h-2 rounded-full",
                                stage.finished ? "bg-emerald-500" : "bg-zinc-200"
                              )}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm">{order.product_type}</span>
                          <span className="text-[10px] text-zinc-500">{order.print_type} • {order.quantity} un</span>
                        </div>
                      </td>
                      <td className={cn("px-6 py-4 text-sm", isOverdue && "text-rose-600 font-bold")}>
                        {(currentUser?.role === 'Admin' || currentUser?.role === 'Comercial') ? (
                          <input
                            type="date"
                            defaultValue={order.deadline.split('T')[0]}
                            onChange={(e) => handleUpdateDeadline(order.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-transparent border-none focus:ring-0 text-sm p-0 cursor-pointer hover:underline"
                          />
                        ) : (
                          format(parseISO(order.deadline), 'dd/MM/yyyy')
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={order.status === 'Entregue' ? 'success' : (isOverdue ? 'danger' : 'info')}>{order.status}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs">{formatSeconds(order.total_time_seconds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {activeTab === 'collaborators' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <p className="text-sm text-zinc-500">{users.length} colaboradores</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {users.map(user => (
                <Card key={user.id} className="p-4 flex items-center justify-between hover:border-zinc-300 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900">{user.name}</h4>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><UserIcon size={12} /> {user.email}</span>
                        {currentUser?.role === 'Admin' && (
                          <>
                            <span>•</span>
                            <span>R$ {user.hourly_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/h</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={user.role === 'Admin' ? 'info' : 'default'}>{user.role}</Badge>
                    <button
                      onClick={() => {
                        setSelectedUserForEdit(user);
                        setShowUserModal(true);
                      }}
                      className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reports' && reportData && (
          <div className="space-y-8">

            {/* Delivery & Performance KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {/* Entregues Hoje */}
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Entregues Hoje</p>
                    <h3 className="text-2xl font-bold">{deliveryReportData?.entregues_hoje || 0}</h3>
                  </div>
                </div>
              </Card>

              {/* Entregues no Período */}
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                    <Archive size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">No Período</p>
                    <h3 className="text-2xl font-bold">{deliveryReportData?.entregues_periodo || 0}</h3>
                  </div>
                </div>
              </Card>

              {/* Pedidos no Prazo (%) */}
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">No Prazo (%)</p>
                    <h3 className="text-2xl font-bold">{deliveryReportData?.taxa_no_prazo_percent?.toFixed(1) || '0.0'}%</h3>
                  </div>
                </div>
              </Card>

              {/* Lead Time Médio */}
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Lead Time Médio</p>
                    <h3 className="text-2xl font-bold">
                      {deliveryReportData?.lead_time_medio_dias?.toFixed(1) || '0.0'}
                      <span className="text-sm font-normal text-zinc-400 ml-1">dias</span>
                    </h3>
                  </div>
                </div>
              </Card>

              {/* Cumprimento de Meta (%) */}
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                    <Target size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Cumprimento Meta</p>
                    <h3 className="text-2xl font-bold">{deliveryReportData?.cumprimento_meta_percent?.toFixed(1) || '0.0'}%</h3>
                  </div>
                </div>
              </Card>

              {/* Total de Pedidos */}
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-zinc-100 rounded-xl text-zinc-600">
                    <Package size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Total Pedidos</p>
                    <h3 className="text-2xl font-bold">{reportData.summary.total_orders}</h3>
                  </div>
                </div>
              </Card>

              {/* Etapas Finalizadas */}
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-zinc-100 rounded-xl text-zinc-600">
                    <CheckSquare size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Etapas Finalizadas</p>
                    <h3 className="text-2xl font-bold">{reportData.summary.total_stages}</h3>
                  </div>
                </div>
              </Card>

              {/* Tempo Médio por Etapa */}
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-zinc-100 rounded-xl text-zinc-600">
                    <Timer size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Tempo Médio/Etapa</p>
                    <h3 className="text-2xl font-bold">{formatSeconds(reportData.summary.avg_stage_time)}</h3>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Delivery Chart */}
              {deliveryReportData && deliveryReportData.grafico.length > 0 && (
                <Card className="p-8">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <BarChart3 size={20} />
                    Pedidos Entregues por Dia
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deliveryReportData.grafico}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                        <XAxis dataKey="data" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="pedidos" name="Pedidos Entregues" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        {deliveryReportData.grafico[0]?.meta_pedidos > 0 && (
                          <ReferenceLine y={deliveryReportData.grafico[0].meta_pedidos} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'top', value: 'Meta Pedidos', fill: '#f59e0b', fontSize: 10 }} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              {/* Delay Report */}
              {delaysReportData && delaysReportData.length > 0 && (
                <Card className="p-8 border-rose-200">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-rose-600">
                    <AlertCircle size={20} />
                    Relatório de Atrasos
                  </h3>
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50">
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Pedido</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Cliente</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Produto</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 text-center">Atraso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {delaysReportData.map(order => (
                          <tr key={order.id} className="hover:bg-rose-50 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs font-bold">{order.order_number}</td>
                            <td className="px-4 py-3 text-sm font-medium">{order.client_name}</td>
                            <td className="px-4 py-3 text-sm">
                              {order.product_type} <span className="text-[10px] text-zinc-500 ml-1">({order.print_type})</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant="danger">{order.dias_atraso} dias</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>

            <Card className="p-8">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <BarChart3 size={20} />
                Volume de Produção por {reportPeriod === 'day' ? 'Dia' : reportPeriod === 'week' ? 'Semana' : 'Mês'}
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.volume}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                    <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="orders" name="Pedidos" fill="#18181b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pieces" name="Peças" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Drill-Down Operacional */}
            {
              operationalReportData && (
                <div className="space-y-8 pb-12">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Produção Detalhada */}
                    <Card className="p-6">
                      <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                        <Clock size={18} className="text-zinc-400" />
                        Produção Detalhada (Etapas)
                      </h3>
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-100">
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500">Fim</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500">Colab</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500">Etapa</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500 text-right">Tempo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50">
                            {operationalReportData.producao_dia.map((step, i) => (
                              <tr key={i} className="hover:bg-zinc-50 transition-colors">
                                <td className="px-3 py-2 text-[10px] text-zinc-500">{step.hora}</td>
                                <td className="px-3 py-2 text-xs font-medium">{step.user_name}</td>
                                <td className="px-3 py-2 text-xs">{step.stage_name} <br /> <span className="text-[9px] text-zinc-400 font-mono">#{step.order_number}</span></td>
                                <td className="px-3 py-2 text-right font-mono text-[10px] font-bold">{formatSeconds(step.duration_seconds)}</td>
                              </tr>
                            ))}
                            {operationalReportData.producao_dia.length === 0 && (
                              <tr><td colSpan={4} className="px-3 py-8 text-center text-zinc-400 italic text-xs">Sem etapas registradas.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    {/* Progresso de Pedidos */}
                    <Card className="p-6">
                      <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-zinc-400" />
                        Progresso de Pedidos Ativos
                      </h3>
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-100">
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500">Pedido</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500">Progresso</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500">Próxima</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500 text-center">Prazo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50">
                            {operationalReportData.progresso_pedidos.map((order, i) => (
                              <tr key={i} className="hover:bg-zinc-50 transition-colors">
                                <td className="px-3 py-2">
                                  <p className="text-xs font-bold">{order.order_number}</p>
                                  <p className="text-[9px] text-zinc-500 truncate max-w-[100px]">{order.client_name}</p>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500 transition-all"
                                        style={{ width: `${(order.etapas_concluidas / order.total_etapas) * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-[9px] font-bold text-zinc-600">{order.etapas_concluidas}/{order.total_etapas}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-[10px] text-zinc-600 font-medium">
                                  {order.proxima_etapa || <span className="text-emerald-500 font-bold">Concluído</span>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={cn(
                                    "text-[10px] font-bold",
                                    isPast(endOfDay(parseISO(order.deadline))) ? "text-rose-600" : "text-zinc-500"
                                  )}>
                                    {format(parseISO(order.deadline), 'dd/MM')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Pedidos Concluídos */}
                    <Card className="p-6 border-emerald-100">
                      <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-emerald-700">
                        <CheckCircle size={18} />
                        Pedidos Concluídos no Período
                      </h3>
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-emerald-50 border-b border-emerald-100 text-emerald-700">
                              <th className="px-3 py-2 text-[10px] font-bold uppercase">Conclusão</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase">Pedido</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase">Lead Time</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-50">
                            {operationalReportData.pedidos_concluidos.map((order, i) => (
                              <tr key={i} className="hover:bg-emerald-50 transition-colors">
                                <td className="px-3 py-2 text-[10px] text-zinc-500">{format(parseISO(order.completed_at), 'dd/MM HH:mm')}</td>
                                <td className="px-3 py-2">
                                  <p className="text-xs font-bold text-zinc-800">{order.order_number}</p>
                                  <p className="text-[9px] text-zinc-500">{order.client_name}</p>
                                </td>
                                <td className="px-3 py-2 text-[10px] font-mono font-bold text-zinc-600">
                                  {order.lead_time_horas.toFixed(1)}h
                                </td>
                                <td className="px-3 py-2 text-center text-[9px] font-black italic uppercase">
                                  {order.no_prazo ? (
                                    <span className="text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">NO PRAZO</span>
                                  ) : (
                                    <span className="text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">ATRASADO</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    {/* Produtividade */}
                    <Card className="p-6">
                      <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                        <Users size={18} className="text-zinc-400" />
                        Produtividade por Colaborador
                      </h3>
                      <div className="space-y-4">
                        {operationalReportData.produtividade_colaboradores.map((user, i) => (
                          <div key={user.user_id} className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-end">
                              <div>
                                <p className="text-sm font-bold text-zinc-800">{user.user_name}</p>
                                <p className="text-[10px] text-zinc-500 font-medium">
                                  <Clock size={10} className="inline mr-1" />
                                  {formatSeconds(user.tempo_total_segundos)} ativo
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-mono font-black text-indigo-600">{user.pecas} peças</p>
                                <p className="text-[9px] text-zinc-400 font-bold uppercase">{user.etapas} etapas</p>
                              </div>
                            </div>
                            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${Math.min(100, (user.pecas / 50) * 100)}%` }} // Exemplo: meta de 50 peças
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </div>
              )
            }

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="p-8">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Clock size={20} />
                  Tempo Médio por Etapa (min)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.avgTimePerStage} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" fontSize={10} width={100} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(value: number) => [`${(value / 60).toFixed(1)} min`, 'Tempo Médio']}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="avg_time" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card className="p-8">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <PieChartIcon size={20} />
                Tempo Médio por Perfil de Pedido
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-zinc-100">
                      <th className="pb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Perfil</th>
                      <th className="pb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center">Cores</th>
                      <th className="pb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center">Qtd. Pedidos</th>
                      <th className="pb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center">Qtd. Média Peças</th>
                      <th className="pb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-right">Média Real</th>
                      <th className="pb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-right">Mín/Máx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {profileReport.length > 0 ? (
                      profileReport.map((p, i) => (
                        <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-zinc-900">{p.product_type}</span>
                              <span className="text-[10px] text-zinc-500 uppercase">{p.print_type}</span>
                            </div>
                          </td>
                          <td className="py-4 text-center">
                            {(p.print_type === 'Silk' || p.print_type === 'Sublimação') ? (
                              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                {p.num_colors} {p.num_colors === 1 ? 'Cor' : 'Cores'}
                              </span>
                            ) : (
                              <span className="text-zinc-300">-</span>
                            )}
                          </td>
                          <td className="py-4 text-center text-sm font-mono">{p.count}</td>
                          <td className="py-4 text-center text-sm font-mono">{p.avg_quantity}</td>
                          <td className="py-4 text-right">
                            <span className="text-sm font-black text-zinc-900">{formatSeconds(p.avg_time_seconds)}</span>
                          </td>
                          <td className="py-4 text-right">
                            <span className="text-[10px] font-mono text-zinc-400">
                              {formatSeconds(p.min_time_seconds)} / {formatSeconds(p.max_time_seconds)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-zinc-400 italic text-sm">
                          Aguardando mais pedidos finalizados para gerar médias por perfil...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div >
        )
        }

        {activeTab === 'costs' && currentUser?.role === 'Admin' && reportData && (
          <div className="space-y-8 pb-12">
            {/* Filters Bar */}
            <Card className="p-4 bg-zinc-900 border-none shadow-2xl">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
                    <Calendar size={18} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="bg-zinc-800 border-none text-white text-xs rounded-md px-2 py-1 focus:ring-1 focus:ring-zinc-700 appearance-none"
                    />
                    <span className="text-zinc-600">até</span>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="bg-zinc-800 border-none text-white text-xs rounded-md px-2 py-1 focus:ring-1 focus:ring-zinc-700 appearance-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
                    <Users size={18} />
                  </div>
                  <select
                    value={reportUser}
                    onChange={(e) => setReportUser(e.target.value)}
                    className="bg-zinc-800 border-none text-white text-xs rounded-md px-3 py-1.5 focus:ring-1 focus:ring-zinc-700 min-w-[150px]"
                  >
                    <option value="">Todos Colaboradores</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
                    <Layers size={18} />
                  </div>
                  <select
                    value={reportStage}
                    onChange={(e) => setReportStage(e.target.value)}
                    className="bg-zinc-800 border-none text-white text-xs rounded-md px-3 py-1.5 focus:ring-1 focus:ring-zinc-700 min-w-[150px]"
                  >
                    <option value="">Todas as Etapas</option>
                    {stages.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="ml-auto flex items-center gap-4 group">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Meta Custo/Peça</p>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 text-xs font-medium">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={metaCustoPeca}
                        onChange={(e) => setMetaCustoPeca(Number(e.target.value))}
                        onBlur={async () => {
                          try {
                            await fetch('/api/config', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', 'x-user-role': 'Admin' },
                              body: JSON.stringify({ meta_custo_por_peca: metaCustoPeca })
                            });
                          } catch (err) {
                            console.error("Erro ao salvar meta:", err);
                          }
                        }}
                        className="bg-zinc-800 border-none text-white text-sm font-black rounded-md px-2 py-1 w-20 focus:ring-2 focus:ring-emerald-500/50 text-center transition-all bg-opacity-50 hover:bg-opacity-100"
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30 group-hover:scale-110 transition-transform">
                    <Target size={20} />
                  </div>
                </div>
              </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="p-6 border-none shadow-sm bg-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <DollarSign size={80} />
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 shadow-inner">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Custo Total M.O.</p>
                    <h3 className="text-2xl font-black text-zinc-900">R$ {(reportData?.summary?.total_labor_cost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                  </div>
                </div>
              </Card>

              <Card className={cn(
                "p-6 shadow-sm border-none bg-white relative overflow-hidden",
                metaCustoPeca > 0 && ((reportData?.summary?.total_labor_cost || 0) / (reportData?.summary?.total_parts || 1)) > metaCustoPeca
                  ? "after:content-[''] after:absolute after:top-0 after:left-0 after:w-1 after:h-full after:bg-rose-500"
                  : metaCustoPeca > 0 ? "after:content-[''] after:absolute after:top-0 after:left-0 after:w-1 after:h-full after:bg-emerald-500" : ""
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-2xl shadow-inner",
                    (reportData.summary.total_labor_cost / (reportData.summary.total_parts || 1)) <= metaCustoPeca || metaCustoPeca === 0
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-rose-50 text-rose-600"
                  )}>
                    <Target size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Custo Médio / Peça</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-2xl font-black text-zinc-900">R$ {((reportData?.summary?.total_labor_cost || 0) / (reportData?.summary?.total_parts || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                      {metaCustoPeca > 0 && (
                        <div className={cn(
                          "flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm",
                          ((reportData?.summary?.total_labor_cost || 0) / (reportData?.summary?.total_parts || 1)) <= metaCustoPeca
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        )}>
                          {(((reportData?.summary?.total_labor_cost || 0) / (reportData?.summary?.total_parts || 1)) <= metaCustoPeca) ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                          {Math.abs((((reportData?.summary?.total_labor_cost || 0) / (reportData?.summary?.total_parts || 1)) / metaCustoPeca - 1) * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-none shadow-sm bg-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Package size={80} />
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="p-3 bg-sky-50 rounded-2xl text-sky-600 shadow-inner">
                    <Package size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Volume Produzido</p>
                    <h3 className="text-2xl font-black text-zinc-900">{(reportData?.summary?.total_parts || 0).toLocaleString('pt-BR')} <span className="text-xs font-medium text-zinc-400 uppercase">Peças</span></h3>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-none shadow-sm bg-zinc-900 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 text-white">
                  <Clock size={80} />
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="p-3 bg-zinc-800 rounded-2xl text-zinc-400 shadow-inner">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Tempo Total Gasto</p>
                    <h3 className="text-2xl font-black text-white">
                      {((reportData?.summary?.total_labor_cost || 0) / 15).toFixed(1)} <span className="text-xs font-medium text-zinc-500 uppercase">Horas</span>
                    </h3>
                  </div>
                </div>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Charts */}
              <div className="space-y-8">
                <Card className="p-8 border-none shadow-sm bg-white">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-lg font-black text-zinc-900 flex items-center gap-2">
                        <PieChartIcon size={20} className="text-emerald-500" />
                        Composição de Custos
                      </h3>
                      <p className="text-xs text-zinc-400 font-medium">Divisão do investimento em mão de obra por colaborador</p>
                    </div>
                  </div>
                  <div className="h-80">
                    {(reportData?.costsByCollaborator || []).length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={reportData?.costsByCollaborator || []}
                            dataKey="total_cost"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={8}
                            labelLine={false}
                          >
                            {(reportData?.costsByCollaborator || []).map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity cursor-pointer" />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', padding: '12px' }}
                            itemStyle={{ fontWeight: '800', fontSize: '12px' }}
                            formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Investimento']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-300 gap-4">
                        <Activity size={40} className="opacity-20" />
                        <p className="text-sm font-medium italic">Nenhuma produção registrada neste período</p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {(reportData?.costsByCollaborator || []).slice(0, 4).map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase truncate">{c.name}</span>
                        <span className="text-[10px] font-black text-zinc-900 ml-auto">{(((c.total_cost || 0) / (reportData?.summary?.total_labor_cost || 1)) * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-8 border-none shadow-sm bg-zinc-900 text-white overflow-hidden relative">
                  <div className="absolute -bottom-10 -right-10 opacity-10">
                    <TrendingUp size={200} />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-lg font-black mb-1 flex items-center gap-2">
                      <TrendingUp size={20} className="text-emerald-400" />
                      Ranking de Rentabilidade
                    </h3>
                    <p className="text-xs text-zinc-500 font-medium mb-8">Colaboradores com menor custo por peça produzida</p>

                    <div className="space-y-6">
                      {(reportData?.costsByCollaborator || [])
                        .sort((a: any, b: any) => ((a.total_cost || 0) / (a.pecas || 1)) - ((b.total_cost || 0) / (b.pecas || 1)))
                        .map((c: any, i: number) => {
                          const costPerPiece = (c.total_cost || 0) / (c.pecas || 1);
                          const isEfficient = metaCustoPeca > 0 ? costPerPiece <= metaCustoPeca : true;
                          return (
                            <div key={i} className="group">
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-lg shadow-black/20",
                                    i === 0 ? "bg-amber-400 text-amber-950" : "bg-zinc-800 text-zinc-500"
                                  )}>
                                    {i + 1}
                                  </div>
                                  <span className="text-sm font-bold text-zinc-100">{c.name}</span>
                                </div>
                                <div className="text-right">
                                  <p className={cn(
                                    "text-sm font-black font-mono",
                                    isEfficient ? "text-emerald-400" : "text-rose-400"
                                  )}>
                                    R$ {costPerPiece.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[10px] font-medium opacity-50">/pç</span>
                                  </p>
                                </div>
                              </div>
                              <div className="h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden shadow-inner">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, (costPerPiece / (metaCustoPeca || costPerPiece * 1.5)) * 100)}%` }}
                                  className={cn("h-full shadow-lg", isEfficient ? "bg-emerald-400" : "bg-rose-400")}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </Card>
              </div>

              {/* Right Column: Detailed Table */}
              <div className="space-y-8">
                <Card className="p-8 border-none shadow-sm bg-white h-full flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-lg font-black text-zinc-900 flex items-center gap-2">
                        <FileText size={20} className="text-sky-500" />
                        Custos por Ordem de Produção
                      </h3>
                      <p className="text-xs text-zinc-400 font-medium">Análise detalhada de cada pedido finalizado neste período</p>
                    </div>
                    <button className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
                      <Download size={18} />
                    </button>
                  </div>

                  <div className="flex-grow overflow-y-auto max-h-[700px] pr-2 custom-scrollbar">
                    <div className="grid grid-cols-1 gap-4">
                      {operationalReportData?.pedidos_concluidos?.length ? (
                        operationalReportData.pedidos_concluidos.map((p: any, i: number) => {
                          const costPerPiece = (p.lead_time_horas || 0) > 0 ? ((p.lead_time_horas || 0) * 15) / (p.pecas || 1) : 0;
                          const isEfficient = metaCustoPeca > 0 ? costPerPiece <= metaCustoPeca : true;
                          return (
                            <div key={i} className="group border border-zinc-100 rounded-2xl p-4 hover:border-emerald-200 hover:bg-emerald-50/10 transition-all cursor-pointer flex items-center gap-6">
                              <div className="bg-zinc-50 p-3 rounded-xl group-hover:bg-white transition-colors">
                                <span className="text-[10px] font-black text-zinc-400 uppercase block mb-0.5 tracking-widest">Pedido</span>
                                <span className="text-sm font-black text-zinc-900 font-mono">{p.order_number}</span>
                              </div>

                              <div className="flex-grow grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-0.5 tracking-widest">Peças</span>
                                  <span className="text-sm font-black text-zinc-900">{p.pecas}</span>
                                </div>
                                <div className="hidden md:block">
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-0.5 tracking-widest">Tempo Total</span>
                                  <span className="text-sm font-black text-zinc-900">{p.lead_time_horas.toFixed(1)}h</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-0.5 tracking-widest">Custo Peça</span>
                                  <span className={cn(
                                    "text-sm font-black font-mono",
                                    isEfficient ? "text-emerald-600" : "text-rose-600"
                                  )}>
                                    R$ {costPerPiece.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>

                              <div className={cn(
                                "hidden sm:flex items-center justify-center px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase",
                                isEfficient ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                              )}>
                                {isEfficient ? 'Ok' : 'Alto'}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-12 text-zinc-400 italic font-medium">
                          Nenhum pedido concluído para análise.
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
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

              <div className="flex gap-2 mb-8">
                <input
                  type="text"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="Nome da nova etapa (ex: Silk 2 Cores)"
                  className="flex-1 p-2 border border-zinc-200 rounded-lg text-sm"
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
                      body: JSON.stringify({ name: newStageName })
                    });
                    setNewStageName('');
                    fetchData();
                  }}
                  className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors"
                >
                  Adicionar
                </button>
              </div>

              <div className="space-y-3">
                {stages.map((stage, index) => (
                  <div key={stage.id} className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-100 rounded-xl group">
                    <div className="flex items-center gap-4 flex-1">
                      <span className="text-xs font-bold text-zinc-400 w-6">{stage.sort_order}</span>
                      {editingStageId === stage.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingStageName}
                          onChange={(e) => setEditingStageName(e.target.value)}
                          onBlur={async () => {
                            if (editingStageName && editingStageName !== stage.name) {
                              await fetch(`/api/stages/${stage.id}`, {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'x-user-role': currentUser?.role || ''
                                },
                                body: JSON.stringify({ name: editingStageName })
                              });
                              fetchData();
                            }
                            setEditingStageId(null);
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              if (editingStageName && editingStageName !== stage.name) {
                                await fetch(`/api/stages/${stage.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ name: editingStageName })
                                });
                                fetchData();
                              }
                              setEditingStageId(null);
                            }
                            if (e.key === 'Escape') setEditingStageId(null);
                          }}
                          className="flex-1 bg-white border border-zinc-300 rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        />
                      ) : (
                        <span className="text-sm font-medium">{stage.name}</span>
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
                ))}
              </div>
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
          </div>
        )
        }

        {/* Order Details Drawer */}
        <AnimatePresence>
          {
            selectedOrder && (
              <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm">
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  className="bg-white w-full h-full shadow-2xl overflow-y-auto"
                >
                  <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-6 border-b border-zinc-100 flex justify-between items-center px-8 lg:px-12">
                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => setSelectedOrder(null)}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-all font-bold text-sm active:scale-95"
                      >
                        <ArrowLeft size={18} />
                        Voltar ao Menu
                      </button>
                      <div className="h-8 w-[1px] bg-zinc-200 hidden lg:block" />
                      <div>
                        <h2 className="text-2xl font-black tracking-tight text-zinc-900">{selectedOrder.client_name}</h2>
                        <p className="text-xs text-zinc-500 font-mono">{selectedOrder.order_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(currentUser?.role === 'Admin' || currentUser?.role === 'Comercial') && selectedOrder.status !== 'Cancelado' && (
                        <>
                          <button
                            onClick={() => openEditOrderModal(selectedOrder)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl transition-all font-bold text-sm"
                            title="Editar pedido"
                          >
                            <Edit2 size={15} />
                            <span className="hidden sm:inline">Editar</span>
                          </button>
                          <button
                            onClick={() => handleCancelOrder(selectedOrder.id)}
                            disabled={isCancellingOrder}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl transition-all font-bold text-sm",
                              isCancellingOrder && "opacity-50 cursor-not-allowed"
                            )}
                            title="Cancelar pedido"
                          >
                            {isCancellingOrder ? <RefreshCw size={15} className="animate-spin" /> : <X size={15} />}
                            <span className="hidden sm:inline">Cancelar</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleViewHistory(selectedOrder.id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl transition-all font-bold text-sm"
                        title="Ver histórico de alterações"
                      >
                        <FileText size={15} />
                        <span className="hidden sm:inline">Histórico</span>
                      </button>
                      {(currentUser?.role === 'Admin' || currentUser?.role === 'Comercial') && (
                        <button
                          onClick={() => handleDeleteOrder(selectedOrder.id)}
                          disabled={isDeletingOrder}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all font-bold text-sm",
                            isDeletingOrder && "opacity-50 cursor-not-allowed"
                          )}
                          title="Excluir pedido (soft-delete)"
                        >
                          {isDeletingOrder ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          <span className="hidden sm:inline">Excluir</span>
                        </button>
                      )}
                      <Badge variant={
                        selectedOrder.status === 'Entregue' ? 'success' :
                          selectedOrder.status === 'Cancelado' ? 'error' : 'info'
                      }>
                        {selectedOrder.status}
                      </Badge>
                      {(selectedOrder.print_type === 'Silk' || selectedOrder.print_type === 'Sublimação') && selectedOrder.num_colors && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full flex items-center gap-1">
                          🎨 {selectedOrder.num_colors} {selectedOrder.num_colors === 1 ? 'Cor' : 'Cores'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-8 lg:p-12 max-w-7xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                      <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Tempo Total</p>
                        <p className="text-lg font-mono font-bold">{formatSeconds(selectedOrder.total_time_seconds)}</p>
                      </div>
                      <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Estimado</p>
                        <p className="text-lg font-mono font-bold text-zinc-500">{formatSeconds(selectedOrder.estimated_time_seconds)}</p>
                      </div>
                      <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 col-span-2 md:col-span-1">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Prazo Entrega</p>
                        {(currentUser.role === 'Admin' || currentUser.role === 'Comercial') ? (
                          <input
                            type="date"
                            defaultValue={selectedOrder.deadline.split('T')[0]}
                            onChange={(e) => handleUpdateDeadline(selectedOrder.id, e.target.value)}
                            className="text-lg font-bold bg-transparent border-none focus:ring-0 p-0 w-full cursor-pointer hover:text-zinc-600"
                          />
                        ) : (
                          <p className="text-lg font-bold">{format(parseISO(selectedOrder.deadline), 'dd/MM/yyyy')}</p>
                        )}
                      </div>
                    </div>

                    <div className="mb-8">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <CheckCircle size={20} />
                        Progresso das Etapas
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {selectedOrder.stages_status.map((stage) => (
                          <div
                            key={stage.id}
                            className={cn(
                              "flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-colors",
                              stage.finished
                                ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                : "bg-zinc-50 border-zinc-100 text-zinc-500"
                            )}
                          >
                            {stage.finished ? <CheckCircle size={14} /> : <Circle size={14} />}
                            {stage.name}
                          </div>
                        ))}
                      </div>
                    </div>

                    {(selectedOrder.art_url || (selectedOrder.art_urls && selectedOrder.art_urls.length > 0)) && (
                      <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold flex items-center gap-2">
                            <ImageIcon size={20} />
                            Fichas / Arquivos ({selectedOrder.art_urls?.length || 1})
                          </h3>
                          <label className={cn(
                            "flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 transition-all cursor-pointer",
                            isUploadingArt && "opacity-50 cursor-not-allowed"
                          )}>
                            {isUploadingArt ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <Plus size={14} />
                            )}
                            <span>{isUploadingArt ? 'Enviando...' : 'Adicionar Arquivo'}</span>
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              disabled={isUploadingArt}
                              onChange={(e) => {
                                if (e.target.files) handleAddImages(selectedOrder.id, e.target.files);
                              }}
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {selectedOrder.art_urls && selectedOrder.art_urls.length > 0 ? (
                            selectedOrder.art_urls.map((url, i) => (
                              <div
                                key={i}
                                onClick={() => {
                                  if (isImage(url)) {
                                    setSelectedFullImage(url);
                                  } else {
                                    window.open(url, '_blank');
                                  }
                                }}
                                className="group relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 aspect-video flex items-center justify-center cursor-pointer hover:border-zinc-400 transition-all"
                              >
                                {isImage(url) ? (
                                  <img
                                    src={url}
                                    alt={`Ficha ${i + 1}`}
                                    className="max-w-full max-h-full object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                                    <FileText size={40} />
                                    <span className="text-[10px] uppercase font-bold">Arquivo {url.split('.').pop()}</span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-2">
                                  {isImage(url) ? (
                                    <>
                                      <Search size={16} />
                                      Clique para Ampliar
                                    </>
                                  ) : (
                                    <>
                                      <Download size={16} />
                                      Abrir / Baixar
                                    </>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div
                              onClick={() => {
                                if (isImage(selectedOrder.art_url)) {
                                  setSelectedFullImage(selectedOrder.art_url || null);
                                } else if (selectedOrder.art_url) {
                                  window.open(selectedOrder.art_url, '_blank');
                                }
                              }}
                              className="group relative w-full rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 cursor-pointer hover:border-zinc-400 transition-all"
                            >
                              {isImage(selectedOrder.art_url) ? (
                                <img
                                  src={selectedOrder.art_url}
                                  alt="Mockup do Cliente"
                                  className="w-full h-auto max-h-[400px] object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="p-12 flex flex-col items-center gap-3 text-zinc-400">
                                  <FileText size={48} />
                                  <span className="text-sm font-bold">Documento / Ficha</span>
                                  <span className="text-xs uppercase font-bold text-zinc-300">{selectedOrder.art_url?.split('.').pop()}</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-2">
                                {isImage(selectedOrder.art_url) ? (
                                  <>
                                    <Search size={16} />
                                    Clique para Ampliar
                                  </>
                                ) : (
                                  <>
                                    <Download size={16} />
                                    Abrir / Baixar
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedOrder.total_time_seconds > selectedOrder.estimated_time_seconds * 1.2 && (
                      <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-700">
                        <AlertCircle size={20} />
                        <p className="text-sm font-medium">Atenção: Tempo real ultrapassou 20% da estimativa padrão.</p>
                      </div>
                    )}

                    <div className="mb-8">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <ClipboardList size={20} />
                        Etapas da Produção
                      </h3>
                      <div className="space-y-3">
                        {selectedOrder.stages_status.map(orderStage => {
                          const stage = stages.find(s => s.id === orderStage.id);
                          if (!stage) return null;
                          const execution = executions.find(e => e.stage_id === stage.id);
                          return (
                            <div key={stage.id} className="p-4 border border-zinc-200 rounded-xl flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                  execution?.status === 'Finalizado' ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                                )}>
                                  {execution?.status === 'Finalizado' ? <CheckCircle2 size={16} /> : stage.sort_order}
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{stage.name}</p>
                                  {execution && (
                                    <p className="text-[10px] text-zinc-500">
                                      {execution.user_name} • {formatSeconds(execution.total_time_seconds)}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-3">
                                <div className="flex items-center gap-3">
                                  {!execution && (
                                    <button
                                      onClick={() => handleStartStage(stage.id)}
                                      className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                                    >
                                      <Play size={18} fill="currentColor" />
                                      <span className="font-bold text-sm">Iniciar</span>
                                    </button>
                                  )}
                                  {execution?.status === 'Em andamento' && (
                                    <>
                                      <button
                                        onClick={() => handlePauseStage(execution.id)}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200 transition-all active:scale-95"
                                        title="Pausar"
                                      >
                                        <Pause size={18} fill="currentColor" />
                                        <span className="font-bold text-sm">Pausar</span>
                                      </button>
                                      <button
                                        onClick={() => handleFinishStage(execution.id)}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-md active:scale-95 border-b-4 border-emerald-800"
                                      >
                                        <CheckCircle size={18} />
                                        <span className="font-bold text-sm uppercase tracking-tight">Finalizar</span>
                                      </button>
                                    </>
                                  )}
                                  {execution?.status === 'Pausado' && (
                                    <button
                                      onClick={() => handleResumeStage(execution.id)}
                                      className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all shadow-md active:scale-95"
                                    >
                                      <Play size={18} fill="currentColor" />
                                      <span className="font-bold text-sm">Retomar</span>
                                    </button>
                                  )}
                                </div>

                                {execution?.status === 'Em andamento' && (
                                  <div className="flex items-center gap-2 py-1 px-3 bg-rose-50 border border-rose-100 rounded-full animate-pulse">
                                    <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                                    <span className="text-[11px] font-mono font-bold text-rose-600">
                                      {(() => {
                                        if (!execution.start_time) return "00:00:00";
                                        if (execution.status === 'Pausado') {
                                            // When paused, show the time spent up to the pause
                                            return formatSeconds(execution.total_time_seconds || 0);
                                        }
                                        const start = parseISO(execution.start_time).getTime();
                                        const pauseMs = (execution.accumulated_pause_seconds || 0) * 1000;
                                        const current = now.getTime();
                                        const diffSeconds = Math.max(0, Math.floor((current - start - pauseMs) / 1000));
                                        return formatSeconds(diffSeconds);
                                      })()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )
          }
        </AnimatePresence >

        {/* New Order Modal (Simplified for MVP) */}
        <AnimatePresence>
          {
            showNewOrderModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 lg:p-8 my-auto"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Novo Pedido</h3>
                    <button onClick={() => setShowNewOrderModal(false)}><X size={20} /></button>
                  </div>

                  {/* Templates Section */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Templates Rápidos</label>
                      {currentUser?.role === 'Admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplate(null);
                            setTemplateFormStages(stages.filter(s => s.active).map(s => s.id));
                            setIsTemplateEditorOpen(true);
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold text-zinc-900 hover:text-zinc-600 transition-colors uppercase tracking-wider"
                        >
                          <Settings size={10} />
                          Gerenciar
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {templates.map(template => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyTemplate(template)}
                          className="px-3 py-1.5 bg-zinc-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-zinc-700 rounded-lg text-xs font-bold transition-all border border-zinc-200"
                        >
                          {template.name}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setNewOrderRequiredStages(stages.filter(s => s.active).map(s => s.id));
                        }}
                        className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 transition-colors"
                      >
                        Marcar Todas
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewOrderRequiredStages([]);
                        }}
                        className="px-3 py-1.5 bg-white text-zinc-600 rounded-lg text-xs font-bold hover:bg-zinc-100 transition-colors border border-zinc-200"
                      >
                        Limpar Todas
                      </button>
                    </div>
                  </div>

                  <form className="space-y-4" onSubmit={async (e) => {
                    e.preventDefault();
                    if (isCreatingOrder) return;
                    setIsCreatingOrder(true);
                    const form = e.currentTarget;
                    const formData = new FormData(form);

                    // Validação: Não permitir pedido sem nenhuma etapa
                    if (newOrderRequiredStages.length === 0) {
                      alert("Por favor, selecione pelo menos uma etapa para o pedido.");
                      return;
                    }

                    formData.append('required_stages', JSON.stringify(newOrderRequiredStages));

                    // Explicitly append all files from the input
                    const fileInput = form.querySelector('input[name="art_files"]') as HTMLInputElement;
                    if (fileInput && fileInput.files) {
                      // Clear any existing art_files to be sure
                      formData.delete('art_files');
                      for (let i = 0; i < fileInput.files.length; i++) {
                        formData.append('art_files', fileInput.files[i]);
                      }
                    }

                    try {
                      const res = await fetch('/api/orders', {
                        method: 'POST',
                        headers: { 'x-user-role': currentUser?.role || '' },
                        body: formData
                      });

                      if (!res.ok) {
                        const errData = await res.json().catch(() => null);
                        alert(`Erro ao criar pedido: ${errData?.error || 'Falha no servidor'}`);
                        setIsCreatingOrder(false);
                        return;
                      }

                      setShowNewOrderModal(false);
                      setNewOrderForm({
                        client_name: '',
                        product_type: 'Dry Fit',
                        print_type: 'Silk',
                        quantity: '',
                        deadline: '',
                        observations: ''
                      });
                      setNewOrderRequiredStages([]);
                      fetchData();
                    } catch (error) {
                      alert("Erro ao conectar com o servidor.");
                    } finally {
                      setIsCreatingOrder(false);
                    }
                  }}>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome do Cliente / Card</label>
                      <input
                        name="client_name"
                        type="text"
                        value={newOrderForm.client_name}
                        onChange={(e) => setNewOrderForm({ ...newOrderForm, client_name: e.target.value })}
                        placeholder="Ex: Camisetas Evento X"
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Mockup / Ficha (Arquivos)</label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-300 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-3 text-zinc-400" />
                            <p className="mb-2 text-sm text-zinc-500"><span className="font-semibold">Clique para upload</span> ou arraste</p>
                            <p className="text-xs text-zinc-400">Imagens, PDFs, etc</p>
                          </div>
                          <input
                            name="art_files"
                            type="file"
                            className="hidden"
                            multiple
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                // Simple visual feedback for multiple files
                                const label = e.currentTarget.previousElementSibling?.querySelector('p');
                                if (label) label.textContent = `${files.length} arquivo(s) selecionado(s)`;
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Produto</label>
                        <select
                          name="product_type"
                          value={newOrderForm.product_type}
                          onChange={(e) => setNewOrderForm({ ...newOrderForm, product_type: e.target.value as any })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white"
                        >
                          <option>Dry Fit</option>
                          <option>Algodão</option>
                          <option>Poliamida</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Estampa</label>
                        <select
                          name="print_type"
                          value={newOrderForm.print_type}
                          onChange={(e) => setNewOrderForm({ ...newOrderForm, print_type: e.target.value as any })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white"
                        >
                          <option>Silk</option>
                          <option>DTF</option>
                          <option>Sublimação</option>
                        </select>
                      </div>
                    </div>

                    {/* Number of Colors - shown only for Silk and Sublimação */}
                    {(newOrderForm.print_type === 'Silk' || newOrderForm.print_type === 'Sublimação') && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1.5">
                          🎨 Número de Cores da Estampa
                          <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">afeta estimativa de tempo</span>
                        </label>
                        <select
                          name="num_colors"
                          defaultValue={1}
                          className="w-full p-2 border border-emerald-200 rounded-lg text-sm bg-white focus:border-emerald-400 outline-none"
                        >
                          <option value={1}>1 Cor</option>
                          <option value={2}>2 Cores</option>
                          <option value={3}>3 Cores</option>
                          <option value={4}>4 Cores</option>
                          <option value={5}>5+ Cores</option>
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Quantidade</label>
                        <input
                          name="quantity"
                          type="number"
                          value={newOrderForm.quantity}
                          onChange={(e) => setNewOrderForm({ ...newOrderForm, quantity: e.target.value })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Prazo</label>
                        <input
                          name="deadline"
                          type="date"
                          value={newOrderForm.deadline}
                          onChange={(e) => setNewOrderForm({ ...newOrderForm, deadline: e.target.value })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Observações</label>
                      <textarea
                        name="observations"
                        value={newOrderForm.observations}
                        onChange={(e) => setNewOrderForm({ ...newOrderForm, observations: e.target.value })}
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm h-24"
                      ></textarea>
                    </div>

                    {/* Step Selection */}
                    <div className="mb-6 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase leading-none">Etapas Deste Pedido ({newOrderRequiredStages.length} selecionadas)</label>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {stages.filter(s => s.active).map(stage => (
                          <label key={stage.id} className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer select-none",
                            newOrderRequiredStages.includes(stage.id)
                              ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                              : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                          )}>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={newOrderRequiredStages.includes(stage.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewOrderRequiredStages([...newOrderRequiredStages, stage.id]);
                                } else {
                                  setNewOrderRequiredStages(newOrderRequiredStages.filter(id => id !== stage.id));
                                }
                              }}
                            />
                            <div className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                              newOrderRequiredStages.includes(stage.id) ? "bg-white text-zinc-900 border-white" : "border-zinc-300"
                            )}>
                              {newOrderRequiredStages.includes(stage.id) && <CheckCircle size={10} strokeWidth={4} />}
                            </div>
                            <span className="text-[11px] font-bold truncate">{stage.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isCreatingOrder}
                      className={cn(
                        "w-full py-3 bg-zinc-900 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                        isCreatingOrder ? "opacity-70 cursor-not-allowed" : "hover:bg-zinc-800 active:scale-[0.98]"
                      )}
                    >
                      {isCreatingOrder ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Criando Pedido...
                        </>
                      ) : (
                        "Criar Pedido"
                      )}
                    </button>
                  </form>
                </motion.div>
              </div>
            )
          }
        </AnimatePresence >

        {/* User Modal (Collaborators) */}
        <AnimatePresence>
          {
            showUserModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 lg:p-8 my-auto"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">
                      {selectedUserForEdit ? 'Editar Colaborador' : 'Convidar Colaborador'}
                    </h3>
                    <button onClick={() => setShowUserModal(false)}><X size={20} /></button>
                  </div>
                  <form className="space-y-4" onSubmit={async (e) => {
                    e.preventDefault();
                    if (isSubmitting) return;
                    setIsSubmitting(true);
                    const form = e.currentTarget;
                    const formData = new FormData(form);
                    const data = Object.fromEntries(formData.entries());

                    const url = selectedUserForEdit ? `/api/users/${selectedUserForEdit.id}` : '/api/users';
                    const method = selectedUserForEdit ? 'PATCH' : 'POST';

                    try {
                      const res = await fetch(url, {
                        method,
                        headers: {
                          'Content-Type': 'application/json',
                          'x-user-role': currentUser?.role || ''
                        },
                        body: JSON.stringify({
                          ...data,
                          hourly_cost: Number(data.hourly_cost),
                          active: data.active === 'on' || !selectedUserForEdit
                        })
                      });

                      if (!res.ok) {
                        const errData = await res.json().catch(() => null);
                        alert(`Erro: ${errData?.error || 'Falha na operação'}`);
                        return;
                      }

                      setShowUserModal(false);
                      fetchUsers();
                    } catch (error) {
                      alert("Erro ao conectar com o servidor.");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome Completo</label>
                      <input
                        name="name"
                        type="text"
                        defaultValue={selectedUserForEdit?.name}
                        placeholder="Ex: João Silva"
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">E-mail</label>
                      <input
                        name="email"
                        type="email"
                        defaultValue={selectedUserForEdit?.email}
                        placeholder="joao@uniflow.com"
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                        required
                      />
                    </div>
                    {!selectedUserForEdit && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Senha Temporária</label>
                        <input
                          name="password"
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                          required
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Função / Acesso</label>
                        <select
                          name="role"
                          defaultValue={selectedUserForEdit?.role || 'Produção'}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Produção">Produção</option>
                          <option value="Comercial">Comercial</option>
                        </select>
                      </div>
                      {currentUser?.role === 'Admin' && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Custo/Hora (R$)</label>
                          <input
                            name="hourly_cost"
                            type="number"
                            step="0.01"
                            defaultValue={selectedUserForEdit?.hourly_cost || 0}
                            placeholder="0,00"
                            className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                            required
                          />
                        </div>
                      )}
                    </div>
                    {selectedUserForEdit && (
                      <div className="flex items-center gap-2">
                        <input
                          name="active"
                          type="checkbox"
                          defaultChecked={selectedUserForEdit.active}
                          id="user-active"
                        />
                        <label htmlFor="user-active" className="text-sm text-zinc-600">Colaborador Ativo</label>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={cn(
                        "w-full py-3 bg-zinc-900 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                        isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:bg-zinc-800 active:scale-[0.98]"
                      )}
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Processando...
                        </>
                      ) : (
                        selectedUserForEdit ? 'Salvar Alterações' : 'Convidar Colaborador'
                      )}
                    </button>
                  </form>
                </motion.div>
              </div>
            )
          }
        </AnimatePresence >

        {/* Template Editor Modal */}
        <AnimatePresence>
          {
            isTemplateEditorOpen && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white w-full max-w-xl rounded-2xl shadow-2xl p-6 lg:p-8 my-auto"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">{editingTemplate ? 'Editar Template' : 'Novo Template'}</h3>
                    <button onClick={() => setIsTemplateEditorOpen(false)}><X size={20} /></button>
                  </div>

                  <form className="space-y-6" onSubmit={async (e) => {
                    e.preventDefault();
                    if (isSubmitting) return;
                    setIsSubmitting(true);
                    const form = e.currentTarget;
                    const formData = new FormData(form);
                    const data = {
                      name: formData.get('name'),
                      product_type: formData.get('product_type'),
                      print_type: formData.get('print_type'),
                      quantity: formData.get('quantity'),
                      observations: formData.get('observations'),
                      required_stages: templateFormStages
                    };

                    const url = editingTemplate ? `/api/order-templates/${editingTemplate.id}` : '/api/order-templates';
                    const method = editingTemplate ? 'PATCH' : 'POST';

                    try {
                      const res = await fetch(url, {
                        method,
                        headers: {
                          'Content-Type': 'application/json',
                          'x-user-role': currentUser?.role || ''
                        },
                        body: JSON.stringify(data)
                      });

                      if (!res.ok) {
                        const errData = await res.json().catch(() => null);
                        alert(`Erro: ${errData?.error || 'Falha na operação'}`);
                        return;
                      }

                      setIsTemplateEditorOpen(false);
                      fetchData();
                    } catch (error) {
                      alert("Erro ao conectar com o servidor.");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome do Template</label>
                        <input
                          name="name"
                          type="text"
                          defaultValue={editingTemplate?.name}
                          placeholder="Ex: Silk 2 Cores Frente"
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Quantidade Padrão</label>
                        <input
                          name="quantity"
                          type="number"
                          defaultValue={editingTemplate?.quantity}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Produto Padrão</label>
                        <select
                          name="product_type"
                          defaultValue={editingTemplate?.product_type || 'Dry Fit'}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white"
                        >
                          <option>Dry Fit</option>
                          <option>Algodão</option>
                          <option>Poliamida</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Estampa Padrão</label>
                        <select
                          name="print_type"
                          defaultValue={editingTemplate?.print_type || 'Silk'}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white"
                        >
                          <option>Silk</option>
                          <option>DTF</option>
                          <option>Sublimação</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-3">Etapas do Fluxo de Produção</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                        {stages.filter(s => s.active).map(stage => (
                          <label key={stage.id} className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer select-none",
                            templateFormStages.includes(stage.id)
                              ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                              : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                          )}>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={templateFormStages.includes(stage.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTemplateFormStages([...templateFormStages, stage.id]);
                                } else {
                                  setTemplateFormStages(templateFormStages.filter(id => id !== stage.id));
                                }
                              }}
                            />
                            <div className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                              templateFormStages.includes(stage.id) ? "bg-white text-zinc-900 border-white" : "border-zinc-300"
                            )}>
                              {templateFormStages.includes(stage.id) && <CheckCircle size={10} strokeWidth={4} />}
                            </div>
                            <span className="text-[11px] font-bold truncate">{stage.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Observações Padrão</label>
                      <textarea
                        name="observations"
                        defaultValue={editingTemplate?.observations}
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm h-24"
                      ></textarea>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={cn(
                        "w-full py-3 bg-zinc-900 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                        isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:bg-zinc-800 active:scale-[0.98]"
                      )}
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        editingTemplate ? 'Salvar Alterações' : 'Criar Template'
                      )}
                    </button>
                  </form>
                </motion.div>
              </div>
            )
          }
        </AnimatePresence >

        {/* Photo Lightbox */}
        <AnimatePresence>
          {
            selectedFullImage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 md:p-12 cursor-zoom-out"
                onClick={() => setSelectedFullImage(null)}
              >
                <motion.button
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors z-[110]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFullImage(null);
                  }}
                >
                  <X size={24} />
                </motion.button>

                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="relative w-full h-full flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isImage(selectedFullImage) ? (
                    <img
                      src={selectedFullImage}
                      alt="Detalhe da Estampa"
                      className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="bg-white p-12 rounded-2xl flex flex-col items-center gap-4">
                      <FileText size={64} className="text-zinc-400" />
                      <div className="text-center">
                        <p className="font-bold text-lg mb-1">Arquivo: {selectedFullImage.split('/').pop()}</p>
                        <p className="text-zinc-500 text-sm">Este arquivo não pode ser visualizado diretamente.</p>
                      </div>
                      <a
                        href={selectedFullImage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all"
                      >
                        <Download size={20} />
                        Baixar Arquivo
                      </a>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )
          }
        </AnimatePresence >

        {/* ── Edit Order Modal ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {
            showEditOrderModal && selectedOrder && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setShowEditOrderModal(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="font-bold text-lg">Editar Pedido</h2>
                      <p className="text-xs text-zinc-500 font-mono">{selectedOrder.order_number}</p>
                    </div>
                    <button onClick={() => setShowEditOrderModal(false)} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  {editOrderHasExecutions && (
                    <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                      <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-amber-700 text-xs font-medium">
                        Este pedido já possui tempo registrado em execuções. Alterar quantidade ou tipo pode afetar indicadores históricos.
                      </p>
                    </div>
                  )}

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome do Cliente</label>
                        <input
                          type="text"
                          value={editOrderForm.client_name || ''}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, client_name: e.target.value })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Produto</label>
                        <select
                          value={editOrderForm.product_type || 'Dry Fit'}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, product_type: e.target.value as any })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        >
                          <option>Dry Fit</option>
                          <option>Algodão</option>
                          <option>Poliamida</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Estampa</label>
                        <select
                          value={editOrderForm.print_type || 'Silk'}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, print_type: e.target.value as any })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        >
                          <option>Silk</option>
                          <option>DTF</option>
                          <option>Sublimação</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Quantidade</label>
                        <input
                          type="number"
                          min="1"
                          value={editOrderForm.quantity || ''}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, quantity: Number(e.target.value) })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Nº de Cores</label>
                        <input
                          type="number"
                          min="1"
                          value={editOrderForm.num_colors || 1}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, num_colors: Number(e.target.value) })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Prazo de Entrega</label>
                        <input
                          type="date"
                          value={editOrderForm.deadline?.split('T')[0] || ''}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, deadline: e.target.value })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Etapas de Produção</label>
                      <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                        {stages.filter(s => s.active).map(stage => {
                          const checked = (editOrderForm.required_stages || []).includes(stage.id);
                          return (
                            <label key={stage.id} className={cn(
                              "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer select-none text-[11px] font-bold",
                              checked ? "bg-zinc-900 border-zinc-900 text-white" : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                            )}>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={checked}
                                onChange={(e) => {
                                  const prev = editOrderForm.required_stages || [];
                                  setEditOrderForm({
                                    ...editOrderForm,
                                    required_stages: e.target.checked
                                      ? [...prev, stage.id]
                                      : prev.filter(id => id !== stage.id)
                                  });
                                }}
                              />
                              <div className={cn("w-4 h-4 rounded border flex items-center justify-center", checked ? "bg-white border-white text-zinc-900" : "border-zinc-300")}>
                                {checked && <CheckCircle size={10} strokeWidth={4} />}
                              </div>
                              {stage.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Fichas / Arquivos</label>
                        <button
                          type="button"
                          onClick={() => document.getElementById('edit-modal-upload')?.click()}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded-md transition-colors"
                        >
                          <Plus size={12} /> Adicionar Arquivo
                        </button>
                        <input
                          id="edit-modal-upload"
                          type="file"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            if (e.target.files && selectedOrder) {
                              setIsUploadingArt(true);
                              const formData = new FormData();
                              for (let i = 0; i < e.target.files.length; i++) {
                                formData.append('art_files', e.target.files[i]);
                              }
                              try {
                                const res = await fetch(`/api/orders/${selectedOrder.id}/images`, {
                                  method: 'POST',
                                  body: formData
                                });
                                if (res.ok) {
                                  const data = await res.json();
                                  setEditOrderForm({
                                    ...editOrderForm,
                                    art_urls: data.art_urls,
                                    art_url: data.art_urls[0]
                                  });
                                  if (selectedOrder) {
                                    setSelectedOrder({
                                      ...selectedOrder,
                                      art_urls: data.art_urls,
                                      art_url: data.art_urls[0]
                                    });
                                  }
                                  fetchData();
                                }
                              } catch (err) {
                                alert('Erro no upload');
                              } finally {
                                setIsUploadingArt(false);
                              }
                            }
                          }}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-zinc-50 rounded-xl border border-zinc-100">
                        {(editOrderForm.art_urls || []).length > 0 ? (
                          (editOrderForm.art_urls || []).map((url, i) => (
                            <div key={url + i} className="relative group">
                              <div
                                className="w-12 h-12 rounded-lg border border-zinc-200 overflow-hidden bg-white flex items-center justify-center cursor-pointer hover:border-zinc-400 transition-all"
                                onClick={() => {
                                  if (isImage(url)) {
                                    setSelectedFullImage(url);
                                  } else {
                                    window.open(url, '_blank');
                                  }
                                }}
                              >
                                {isImage(url) ? (
                                  <img src={url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <FileText size={16} className="text-zinc-400" />
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedUrls = (editOrderForm.art_urls || []).filter(u => u !== url);
                                  setEditOrderForm({
                                    ...editOrderForm,
                                    art_urls: updatedUrls,
                                    art_url: updatedUrls.length > 0 ? updatedUrls[0] : undefined
                                  });
                                }}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-zinc-900 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="w-full h-12 flex items-center justify-center border-2 border-dashed border-zinc-200 rounded-lg">
                            <span className="text-[10px] text-zinc-400 font-medium">Nenhum arquivo anexado</span>
                          </div>
                        )}
                        {isUploadingArt && (
                          <div className="w-12 h-12 rounded-lg border border-zinc-200 bg-white flex items-center justify-center">
                            <RefreshCw size={16} className="text-zinc-400 animate-spin" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Observações</label>
                      <textarea
                        value={editOrderForm.observations || ''}
                        onChange={(e) => setEditOrderForm({ ...editOrderForm, observations: e.target.value })}
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowEditOrderModal(false)}
                        className="flex-1 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleEditOrderSubmit}
                        disabled={isEditingOrder}
                        className={cn(
                          "flex-1 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                          isEditingOrder ? "opacity-70 cursor-not-allowed" : "hover:bg-zinc-800 active:scale-[0.98]"
                        )}
                      >
                        {isEditingOrder ? <><RefreshCw size={16} className="animate-spin" /> Salvando...</> : <><CheckCircle size={16} /> Salvar Alterações</>}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )
          }
        </AnimatePresence >

        {/* ── Order History Modal ───────────────────────────────────────────── */}
        <AnimatePresence>
          {
            showHistoryModal && selectedOrder && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setShowHistoryModal(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="font-bold text-lg">Histórico de Alterações</h2>
                      <p className="text-xs text-zinc-500 font-mono">{selectedOrder.order_number}</p>
                    </div>
                    <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 p-6">
                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center py-12 text-zinc-400">
                        <RefreshCw size={24} className="animate-spin" />
                      </div>
                    ) : orderHistory.length === 0 ? (
                      <div className="text-center py-12 text-zinc-400">
                        <FileText size={32} className="mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Nenhum registro de alteração encontrado.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {orderHistory.map((entry) => {
                          const acaoColors: Record<string, string> = {
                            criou: 'bg-emerald-100 text-emerald-700',
                            editou: 'bg-sky-100 text-sky-700',
                            cancelou: 'bg-amber-100 text-amber-700',
                            excluiu: 'bg-rose-100 text-rose-700',
                            restaurou: 'bg-violet-100 text-violet-700',
                          };
                          const acaoLabels: Record<string, string> = {
                            criou: 'Criou', editou: 'Editou', cancelou: 'Cancelou',
                            excluiu: 'Excluiu', restaurou: 'Restaurou'
                          };
                          return (
                            <div key={entry.id} className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", acaoColors[entry.acao] || 'bg-zinc-100 text-zinc-600')}>
                                    {acaoLabels[entry.acao] || entry.acao}
                                  </span>
                                  <span className="text-xs font-semibold text-zinc-700">{entry.usuario}</span>
                                </div>
                                <span className="text-[10px] text-zinc-400">
                                  {format(new Date(entry.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                              {entry.acao === 'editou' && entry.antes && entry.depois && (() => {
                                const campos = ['client_name', 'product_type', 'print_type', 'quantity', 'deadline', 'observations', 'num_colors'];
                                const alterados = campos.filter(c => JSON.stringify(entry.antes[c]) !== JSON.stringify(entry.depois[c]));
                                return alterados.length > 0 ? (
                                  <div className="space-y-1 mt-2">
                                    {alterados.map(campo => (
                                      <div key={campo} className="text-xs flex items-center gap-2">
                                        <span className="font-bold text-zinc-500 uppercase text-[9px] w-20 shrink-0">{campo.replace('_', ' ')}</span>
                                        <span className="text-rose-500 line-through truncate">{String(entry.antes[campo] ?? '-')}</span>
                                        <ChevronRight size={10} className="text-zinc-300 shrink-0" />
                                        <span className="text-emerald-600 font-medium truncate">{String(entry.depois[campo] ?? '-')}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
        </AnimatePresence>
      </main >
    </div >
  );
}
