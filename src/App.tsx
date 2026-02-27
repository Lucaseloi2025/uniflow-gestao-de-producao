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
  RefreshCw
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
  Cell
} from 'recharts';
import { format, parseISO, differenceInDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isPast, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, formatSeconds } from './lib/utils';
import { Order, Stage, StageExecution, DashboardStats, User, StageStatus, OrderTemplate } from './types';

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
    const start = new Date(execution.start_time).getTime();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [execution.start_time]);

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'kanban' | 'orders' | 'collaborators' | 'reports' | 'settings'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [templates, setTemplates] = useState<OrderTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [reportPeriod, setReportPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [reportUser, setReportUser] = useState<string>('');
  const [reportStage, setReportStage] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [executions, setExecutions] = useState<StageExecution[]>([]);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [newStageName, setNewStageName] = useState('');
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

  // Auth States
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [now, setNow] = useState(new Date());
  const [activeExecution, setActiveExecution] = useState<StageExecution | null>(null);

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
      safeFetch(`/api/users?search=${encodeURIComponent(session.user.email)}`).then(data => {
        const found = data?.find((u: User) => u.email === session.user.email);
        if (found) {
          setCurrentUser(found);
        } else {
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
      const res = await fetch(url, options);
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

  useEffect(() => {
    fetchData();
  }, [dateRange, searchTerm, selectedStageFilter, selectedStageStatus, productTypeFilter, printTypeFilter]);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    }
  }, [activeTab, reportPeriod, reportUser, reportStage]);

  const fetchReports = async () => {
    let url = `/api/reports?period=${reportPeriod}`;
    if (reportUser) url += `&user_id=${reportUser}`;
    if (reportStage) url += `&stage_id=${reportStage}`;

    const data = await safeFetch(url);
    if (data) setReportData(data);
  };

  useEffect(() => {
    if (stats?.capacity.config.operadores_ativos) {
      setSimOperadores(stats.capacity.config.operadores_ativos);
    }
  }, [stats]);

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
  };

  const fetchUsers = async () => {
    const data = await safeFetch(`/api/users?search=${encodeURIComponent(userSearchTerm)}`);
    if (data) setUsers(data);
  };

  const fetchExecutions = async (orderId: number) => {
    const data = await safeFetch(`/api/orders/${orderId}/executions`);
    if (data) setExecutions(data);
  };

  const handleUpdateDeadline = async (orderId: number, newDeadline: string) => {
    await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deadline: newDeadline })
    });
    fetchData();
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, deadline: newDeadline });
    }
  };

  const handleStartStage = async (stageId: number) => {
    if (!selectedOrder) return;
    const res = await fetch('/api/executions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: selectedOrder.id, stage_id: stageId, user_id: currentUser.id })
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

  const handlePauseStage = async (executionId: number) => {
    await fetch(`/api/executions/${executionId}/pause`, { method: 'POST' });
    fetchExecutions(selectedOrder!.id);
    fetchActiveExecution();
  };

  const handleResumeStage = async (executionId: number) => {
    await fetch(`/api/executions/${executionId}/resume`, { method: 'POST' });
    fetchExecutions(selectedOrder!.id);
    fetchActiveExecution();
  };

  const handleFinishStage = async (executionId: number) => {
    if (!window.confirm("Tem certeza que deseja finalizar esta etapa?")) return;
    await fetch(`/api/executions/${executionId}/finish`, { method: 'POST' });
    fetchExecutions(selectedOrder!.id);
    fetchData();
    fetchActiveExecution();
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchData();
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
            <h1 className="font-bold text-3xl tracking-tight text-zinc-900">UniFlow</h1>
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
            <h1 className="font-bold text-xl tracking-tight">UniFlow</h1>
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
            icon={Users}
            label="Colaboradores"
            active={activeTab === 'collaborators'}
            onClick={() => { setActiveTab('collaborators'); setIsMobileMenuOpen(false); }}
          />
          <SidebarItem
            icon={FileText}
            label="Relatórios"
            active={activeTab === 'reports'}
            onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
          />
          <SidebarItem
            icon={Settings}
            label="Configurações"
            active={activeTab === 'settings'}
            onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
          />
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
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white border border-zinc-200 p-1 rounded-lg shadow-sm overflow-x-auto">
                <div className="flex items-center gap-1 px-2 border-b sm:border-b-0 sm:border-r border-zinc-100 py-1 sm:py-0">
                  <span className="text-[8px] font-bold text-zinc-400 uppercase">Período:</span>
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value as any)}
                    className="py-1 bg-transparent text-[10px] font-medium focus:outline-none"
                  >
                    <option value="day">Diário</option>
                    <option value="week">Semanal</option>
                    <option value="month">Mensal</option>
                  </select>
                </div>
                <div className="flex items-center gap-1 px-2 border-b sm:border-b-0 sm:border-r border-zinc-100 py-1 sm:py-0">
                  <span className="text-[8px] font-bold text-zinc-400 uppercase">Colaborador:</span>
                  <select
                    value={reportUser}
                    onChange={(e) => setReportUser(e.target.value)}
                    className="py-1 bg-transparent text-[10px] font-medium focus:outline-none"
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
                    className="py-1 bg-transparent text-[10px] font-medium focus:outline-none"
                  >
                    <option value="">Todas</option>
                    {stages.map(stage => (
                      <option key={stage.id} value={stage.id}>{stage.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
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
          </div>
        </header>

        {activeTab === 'dashboard' && stats && (
          <div className="space-y-8">
            {/* Capacity Alerts */}
            {stats.capacity.percentualOcupacao > 0.85 && (
              <div className={cn(
                "p-4 rounded-xl border flex items-center gap-3",
                stats.capacity.percentualOcupacao > 0.95
                  ? "bg-rose-50 border-rose-100 text-rose-700"
                  : "bg-amber-50 border-amber-100 text-amber-700"
              )}>
                <AlertCircle size={20} />
                <div className="flex-1">
                  <p className="font-bold text-sm">
                    {stats.capacity.percentualOcupacao > 0.95
                      ? "Capacidade máxima atingida!"
                      : "Produção próxima do limite!"}
                  </p>
                  <p className="text-xs opacity-80">
                    Ocupação atual: {(stats.capacity.percentualOcupacao * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-zinc-100 rounded-xl text-zinc-600">
                    <Package size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Pedidos Ativos</p>
                    <h3 className="text-2xl font-bold">{stats.activeOrders}</h3>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Capacidade Diária</p>
                    <h3 className="text-2xl font-bold">{stats.capacity.capacidadeDiariaPecas} <span className="text-sm font-normal text-zinc-400">un</span></h3>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Capacidade Mensal</p>
                    <h3 className="text-2xl font-bold">{stats.capacity.capacidadeMensalPecas} <span className="text-sm font-normal text-zinc-400">un</span></h3>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className={cn(
                    "p-3 rounded-xl",
                    stats.capacity.percentualOcupacao > 0.95 ? "bg-rose-50 text-rose-600" :
                      stats.capacity.percentualOcupacao > 0.85 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                  )}>
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Ocupação Atual</p>
                    <h3 className="text-2xl font-bold">{(stats.capacity.percentualOcupacao * 100).toFixed(1)}%</h3>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {/* Capacity by Sector */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold flex items-center gap-2">
                      <BarChart3 size={18} className="text-zinc-400" />
                      Análise de Capacidade por Setor
                    </h3>
                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase text-zinc-400">
                      <span>Tempo Médio</span>
                      <span>Capacidade Diária</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {(stats.capacity as any).stageCapacities?.map((stage: any, i: number) => {
                      const isBottleneck = (stats.capacity as any).bottleneckStage?.name === stage.name;
                      return (
                        <div key={i} className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-colors",
                          isBottleneck ? "bg-rose-50 border-rose-100" : "bg-zinc-50 border-zinc-100"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                              isBottleneck ? "bg-rose-500 text-white" : "bg-zinc-200 text-zinc-600"
                            )}>
                              {i + 1}
                            </div>
                            <div>
                              <p className="text-sm font-bold flex items-center gap-2">
                                {stage.name}
                                {isBottleneck && <Badge variant="error" className="text-[8px] px-1 py-0">Gargalo</Badge>}
                              </p>
                              <p className="text-[10px] text-zinc-500">Eficiência: {(stats.capacity.config.eficiencia_percentual * 100).toFixed(0)}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="text-right">
                              <p className="text-sm font-mono font-bold">{(stage.avg_time_piece / 60).toFixed(1)} min</p>
                              <p className="text-[10px] text-zinc-400 uppercase">Por peça</p>
                            </div>
                            <div className="text-right min-w-[100px]">
                              <p className={cn("text-sm font-bold", isBottleneck ? "text-rose-600" : "text-emerald-600")}>
                                {stage.capacidadeDiaria} <span className="text-[10px] font-normal text-zinc-400">un/dia</span>
                              </p>
                              <p className="text-[10px] text-zinc-400 uppercase">Total setor</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {(!(stats.capacity as any).stageCapacities || (stats.capacity as any).stageCapacities.length === 0) && (
                      <div className="text-center py-8 text-zinc-400">
                        <p className="text-sm italic">Sem dados históricos suficientes para análise por setor.</p>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold mb-6 flex items-center gap-2">
                    <Clock size={18} className="text-zinc-400" />
                    Tempo Médio por Peça — Por Tipo de Estampa
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.avgTimeByPrint} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis dataKey="print_type" type="category" width={100} fontSize={12} />
                        <Tooltip
                          formatter={(value: number) => [`${(value / 60).toFixed(1)} min`, 'Tempo Médio']}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="avg_time" fill="#10b981" radius={[0, 4, 4, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="space-y-8">
                <Card className="p-6">
                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <Settings size={16} />
                    Simulador de Cenários
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Número de Operadores</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max="20"
                          value={simOperadores}
                          onChange={(e) => setSimOperadores(parseInt(e.target.value))}
                          className="flex-1 accent-emerald-500"
                        />
                        <span className="text-xl font-bold w-8">{simOperadores}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Capacidade Simulada</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                          <p className="text-[10px] text-zinc-500">Diária</p>
                          <p className="text-lg font-bold text-zinc-900">
                            {Math.floor((stats.capacity.config.jornada_horas * 60 * simOperadores * stats.capacity.config.eficiencia_percentual) / (stats.capacity.avgTimePerPieceSeconds / 60))} un
                          </p>
                        </div>
                        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                          <p className="text-[10px] text-zinc-500">Mensal</p>
                          <p className="text-lg font-bold text-zinc-900">
                            {Math.floor((stats.capacity.config.jornada_horas * 60 * simOperadores * stats.capacity.config.eficiencia_percentual) / (stats.capacity.avgTimePerPieceSeconds / 60)) * stats.capacity.config.dias_uteis_mes} un
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-zinc-900 text-white">
                  <h3 className="font-bold mb-6 flex items-center gap-2">
                    <AlertCircle size={18} className="text-zinc-400" />
                    Insights Estratégicos
                  </h3>
                  <div className="space-y-6">
                    <div className={cn(
                      "p-4 rounded-xl border",
                      stats.capacity.percentualOcupacao > 0.9 ? "bg-rose-500/10 border-rose-500/20 text-rose-200" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-200"
                    )}>
                      <p className="font-bold text-sm mb-1">
                        {stats.capacity.percentualOcupacao > 0.9 ? "Atenção: Sobrecarga!" : "Capacidade Disponível"}
                      </p>
                      <p className="text-xs opacity-80">
                        {stats.capacity.percentualOcupacao > 0.9
                          ? "Sua produção está operando no limite. Considere contratar ou aumentar a eficiência."
                          : "Há espaço para crescimento. Invista em vendas para ocupar a capacidade ociosa."}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-400">Tempo produtivo/dia:</span>
                        <span className="font-mono font-bold">{(stats.capacity.config.jornada_horas * 60 * stats.capacity.config.operadores_ativos * stats.capacity.config.eficiencia_percentual).toFixed(0)} min</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-400">Peças/hora:</span>
                        <span className="font-mono font-bold">{(stats.capacity.capacidadeDiariaPecas / stats.capacity.config.jornada_horas).toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-400">Capacidade restante:</span>
                        <span className="font-mono font-bold">{stats.capacity.capacidadeMensalPecas - stats.capacity.totalPecasVendidasMes} peças</span>
                      </div>
                    </div>
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
                          <div className="w-full h-32 bg-zinc-100 relative overflow-hidden">
                            <img
                              src={order.art_url}
                              alt="Mockup"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
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
                        {currentUser.role === 'Admin' ? (
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
                        <span>•</span>
                        <span>$ R$ {user.hourly_cost.toFixed(2)}/h</span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Etapas Finalizadas</p>
                    <h3 className="text-2xl font-bold">{reportData.summary.total_stages}</h3>
                  </div>
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Tempo Médio/Etapa</p>
                    <h3 className="text-2xl font-bold">{Math.round(reportData.summary.avg_stage_time / 60)} <span className="text-sm font-normal text-zinc-400">min</span></h3>
                  </div>
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Custo Total M.O.</p>
                    <h3 className="text-2xl font-bold">R$ {Math.round(reportData.summary.total_labor_cost || 0)}</h3>
                  </div>
                </div>
              </Card>
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

              <Card className="p-8">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <DollarSign size={20} />
                  Custo de M.O. por Colaborador
                </h3>
                <div className="h-64">
                  {reportData.costsByCollaborator.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reportData.costsByCollaborator}
                          dataKey="total_cost"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {reportData.costsByCollaborator.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Custo']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-400 italic">
                      Sem dados
                    </div>
                  )}
                </div>
              </Card>
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
                  dias_uteis_mes: Number(formData.get('dias_uteis_mes'))
                };

                await fetch('/api/config/producao', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
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
                      defaultValue={stats?.capacity.config.jornada_horas}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Operadores Ativos</label>
                    <input
                      name="operadores_ativos"
                      type="number"
                      defaultValue={stats?.capacity.config.operadores_ativos}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Eficiência Operacional (%)</label>
                    <input
                      name="eficiencia_percentual"
                      type="number"
                      defaultValue={(stats?.capacity.config.eficiencia_percentual || 0.85) * 100}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Dias Úteis no Mês</label>
                    <input
                      name="dias_uteis_mes"
                      type="number"
                      defaultValue={stats?.capacity.config.dias_uteis_mes}
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
                      headers: { 'Content-Type': 'application/json' },
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
                {stages.map((stage) => (
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
                                headers: { 'Content-Type': 'application/json' },
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
                              await fetch(`/api/stages/${stage.id}`, { method: 'DELETE' });
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl hover:border-zinc-300 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-sm text-zinc-900">{template.name}</h4>
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
                              await fetch(`/api/order-templates/${template.id}`, { method: 'DELETE' });
                              fetchData();
                            }
                          }}
                          className="p-1.5 hover:bg-rose-100 rounded text-rose-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
        )}
      </main>

      {/* Order Details Drawer */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="bg-white w-full max-w-2xl h-full shadow-2xl overflow-y-auto"
            >
              <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-6 border-b border-zinc-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold">{selectedOrder.client_name}</h2>
                    <p className="text-xs text-zinc-500 font-mono">{selectedOrder.order_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={selectedOrder.status === 'Entregue' ? 'success' : 'info'}>
                    {selectedOrder.status}
                  </Badge>
                </div>
              </div>

              <div className="p-6 lg:p-8">
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
                    {currentUser.role === 'Admin' ? (
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

                {selectedOrder.art_url && (
                  <div className="mb-8">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <ImageIcon size={20} />
                      Ficha / Mockup
                    </h3>
                    <div className="w-full rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50">
                      <img
                        src={selectedOrder.art_url}
                        alt="Mockup do Cliente"
                        className="w-full h-auto max-h-[400px] object-contain"
                        referrerPolicy="no-referrer"
                      />
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
                                    const start = new Date(execution.start_time).getTime();
                                    const current = now.getTime();
                                    const diffSeconds = Math.max(0, Math.floor((current - start) / 1000));
                                    // Note: This front-end only calculation doesn't subtract pauses yet, 
                                    // but it provides the "running" visual the user asked for.
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
        )}
      </AnimatePresence>

      {/* New Order Modal (Simplified for MVP) */}
      <AnimatePresence>
        {showNewOrderModal && (
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
                const form = e.currentTarget;
                const formData = new FormData(form);

                // Validação: Não permitir pedido sem nenhuma etapa
                if (newOrderRequiredStages.length === 0) {
                  alert("Por favor, selecione pelo menos uma etapa para o pedido.");
                  return;
                }

                formData.append('required_stages', JSON.stringify(newOrderRequiredStages));

                const res = await fetch('/api/orders', {
                  method: 'POST',
                  body: formData
                });

                if (!res.ok) {
                  const errData = await res.json().catch(() => null);
                  alert(`Erro ao criar pedido: ${errData?.error || 'Falha no servidor'}`);
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
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Mockup / Ficha (Imagem)</label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-300 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-3 text-zinc-400" />
                        <p className="mb-2 text-sm text-zinc-500"><span className="font-semibold">Clique para upload</span> ou arraste</p>
                        <p className="text-xs text-zinc-400">PNG, JPG ou GIF</p>
                      </div>
                      <input name="art_file" type="file" className="hidden" accept="image/*" />
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

                <button type="submit" className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors">
                  Criar Pedido
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Modal (Collaborators) */}
      <AnimatePresence>
        {showUserModal && (
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
                const form = e.currentTarget;
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());

                const url = selectedUserForEdit ? `/api/users/${selectedUserForEdit.id}` : '/api/users';
                const method = selectedUserForEdit ? 'PATCH' : 'POST';

                await fetch(url, {
                  method,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...data,
                    hourly_cost: Number(data.hourly_cost),
                    active: data.active === 'on' || !selectedUserForEdit
                  })
                });

                setShowUserModal(false);
                fetchUsers();
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
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Custo/Hora (R$)</label>
                    <input
                      name="hourly_cost"
                      type="number"
                      step="0.01"
                      defaultValue={selectedUserForEdit?.hourly_cost || 0}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
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
                <button type="submit" className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors">
                  {selectedUserForEdit ? 'Salvar Alterações' : 'Convidar Colaborador'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Template Editor Modal */}
      <AnimatePresence>
        {isTemplateEditorOpen && (
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

                await fetch(url, {
                  method,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data)
                });

                setIsTemplateEditorOpen(false);
                fetchData();
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

                <button type="submit" className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors">
                  {editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
