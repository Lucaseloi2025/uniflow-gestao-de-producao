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
import { Card } from './components/ui/Card';
import { PrintContainer } from './components/PrintContainer';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SidebarItem } from './components/ui/SidebarItem';
import { InfoModal } from './components/modals/InfoModal';
import { RunningTaskBanner } from './components/RunningTaskBanner';
import { DashboardTab } from './pages/DashboardTab';
import { TaskMonitor } from './pages/TaskMonitor';
import { SettingsTab } from './pages/SettingsTab';
import { Card } from './components/ui/Card';
import { PrintContainer } from './components/PrintContainer';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SidebarItem } from './components/ui/SidebarItem';
import { InfoModal } from './components/modals/InfoModal';
import { RunningTaskBanner } from './components/RunningTaskBanner';
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


// Components




export function useAppLogic() {

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
      showToast(msg);
    } catch (err: any) {
      showToast(`Erro na sincronização Olist: ${err.message}`);
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
      showToast(`Pedido #${selectedDraftOrder.order_number} liberado para produção com sucesso!`);
    } catch (err: any) {
      showToast(`Erro ao liberar pedido: ${err.message}`);
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
      showToast(`Erro ao excluir rascunho: ${err.message}`);
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
      showToast('Rascunhos antigos limpos com sucesso!');
    } catch (err: any) {
      showToast(`Erro ao limpar rascunhos: ${err.message}`);
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
      showToast('Erro ao atualizar status do DTF.');
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
        showToast(err.error || 'Erro ao excluir pedido');
      }
    } catch (err) {
      showToast('Erro na conexão com o servidor');
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
      showToast(err.message || 'Erro ao gerar e copiar link de acompanhamento.');
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
        showToast(err.error || 'Erro ao cancelar pedido');
      }
    } catch (err) {
      showToast('Erro na conexão com o servidor');
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
      showToast('Quantidade deve ser maior que zero.');
      return;
    }
    if (!editOrderForm.num_colors || Number(editOrderForm.num_colors) < 1) {
      showToast('Número de cores deve ser pelo menos 1.');
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
        showToast(err.error || err.message || 'Erro ao editar pedido');
      }
    } catch (err) {
      showToast('Erro na conexão com o servidor');
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
        showToast(`O arquivo "${files[i].name}" é muito grande. O limite máximo é de 4MB por arquivo.`);
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
      showToast('Erro ao adicionar imagens. Tente novamente.');
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
      showToast(err.error);
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
      showToast("Erro ao reordenar etapas.");
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
        showToast("Por favor, selecione o motivo da perda.");
        return;
      }
      if (actionLossReasonInput === 'Outro' && !actionLossReasonDetailInput.trim()) {
        showToast("Por favor, informe o detalhamento do motivo 'Outro'.");
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
          showToast(err.error || "Erro ao registrar progresso.");
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
          showToast(err.error || "Erro ao registrar perda.");
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
            showToast(err.error || "Erro ao finalizar etapa");
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
      showToast(err.error || "Erro ao registrar progresso");
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
      showToast("Por favor, informe o detalhamento do motivo 'Outro'.");
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
      showToast("Perda registrada com sucesso! A pendência de reposição foi enviada para a etapa de reentrada.");
      fetchData();
      fetchExecutions(selectedOrder.id);
      fetchActiveExecution();
    } else {
      const err = await res.json();
      showToast(err.error || "Erro ao registrar perda");
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
      showToast("Mapeamento de perdas atualizado!");
      setLossReasonsList(updatedReasons);
    } else {
      showToast("Erro ao salvar mapeamento de perdas.");
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





  return {
    safeFetch,
    actionLossQuantityInput,
    actionLossReasonDetailInput,
    actionLossReasonInput,
    actionLossReentryStageIdInput,
    actionObservationInput,
    actionQuantityInput,
    activeExecutions,
    activeOrderTotalTime,
    activeReportSubTab,
    activeTab,
    authEmail,
    authError,
    authPassword,
    autoPauseTimeFriday,
    autoPauseTimeLunch,
    autoPauseTimeWeekday,
    autoPauseTimeWeekend,
    collaboratorGoals,
    COLORS,
    confirmDraftForm,
    confirmingDtfOrderId,
    cortePendingBadgeCount,
    currentUser,
    dateRange,
    delaysReportData,
    deliveryReportData,
    draftOrders,
    editingDtfOrderId,
    editingDtfValue,
    editingStageCalculationType,
    editingStageId,
    editingStageMetaDiaria,
    editingStageName,
    editingStageTime,
    editingTemplate,
    editOrderForm,
    editOrderHasExecutions,
    executionActionModal,
    executions,
    expandedForecast,
    expandedGoalStageId,
    expandedReportStage,
    fetchActiveExecution,
    fetchCollaboratorGoals,
    fetchConfig,
    fetchData,
    fetchDraftOrders,
    fetchExecutions,
    fetchForecast,
    fetchOperationalReport,
    fetchReports,
    fetchUsers,
    forecastData,
    goalEditValues,
    goalsProductivityData,
    goalsViewType,
    handleAddImages,
    handleCancelOrder,
    handleCleanOldDrafts,
    handleConfirmDraftOrder,
    handleConfirmExecutionAction,
    handleDeleteDraftOrder,
    handleDeleteOrder,
    handleEditOrderSubmit,
    handleFinishStage,
    handleGenerateTrackingLink,
    handleGlobalKeyDown,
    handleLogin,
    handleLogout,
    handleOpenActionModal,
    handleOpenDraftReview,
    handleOpenLossModal,
    handleOpenProgressModal,
    handlePauseStage,
    handleRequestToggleDtf,
    handleResumeStage,
    handleSaveLoss,
    handleSaveLossReasonsMapping,
    handleSaveProgress,
    handleStartStage,
    handleSyncOlist,
    handleToggleDtf,
    handleUpdateDeadline,
    handleUpdateDtfLocation,
    handleViewHistory,
    hh,
    infoModal,
    isActionLoading,
    isAuthLoading,
    isCancellingOrder,
    isConfirmingDraft,
    isCreatingOrder,
    isDeletingOrder,
    isDraftsListModalOpen,
    isEditingOrder,
    isGeneratingLink,
    isLoadingForecast,
    isLoadingHistory,
    isLossModalOpen,
    isMobileMenuOpen,
    isPrintModalOpen,
    isProgressModalOpen,
    isSubmitting,
    isSyncingOlist,
    isTemplateEditorOpen,
    isTrackingPage,
    isUploadingArt,
    location,
    lossQtyInput,
    lossReasonDetailInput,
    lossReasonInput,
    lossReasonsList,
    lossReentryStageIdInput,
    lossReportData,
    lossStageId,
    memoizedCostsByCollaborator,
    memoizedOrdersCompleted,
    metaCustoPeca,
    moveStage,
    navigate,
    newOrderForm,
    newOrderRequiredStages,
    newStageCalculationType,
    newStageMetaDiaria,
    newStageName,
    newStageTime,
    now,
    operationalReportData,
    orderHistory,
    orders,
    orderStageObservations,
    printOpen,
    printTypeFilter,
    productTypeFilter,
    profileReport,
    progressIncrementInput,
    progressStageId,
    rawTab,
    reportData,
    reportEndDate,
    reportPeriod,
    reportPrintType,
    reportStage,
    reportStartDate,
    reportUser,
    searchTerm,
    selectedDraftOrder,
    selectedFullImage,
    selectedOrder,
    selectedStageFilter,
    selectedStageId,
    selectedStageStatus,
    selectedUserForEdit,
    session,
    setActionLossQuantityInput,
    setActionLossReasonDetailInput,
    setActionLossReasonInput,
    setActionLossReentryStageIdInput,
    setActionObservationInput,
    setActionQuantityInput,
    setActiveExecutions,
    setActiveReportSubTab,
    setActiveTab,
    setAuthEmail,
    setAuthError,
    setAuthPassword,
    setAutoPauseTimeFriday,
    setAutoPauseTimeLunch,
    setAutoPauseTimeWeekday,
    setAutoPauseTimeWeekend,
    setCollaboratorGoals,
    setConfirmDraftForm,
    setConfirmingDtfOrderId,
    setCurrentUser,
    setDateRange,
    setDelaysReportData,
    setDeliveryReportData,
    setDraftOrders,
    setEditingDtfOrderId,
    setEditingDtfValue,
    setEditingStageCalculationType,
    setEditingStageId,
    setEditingStageMetaDiaria,
    setEditingStageName,
    setEditingStageTime,
    setEditingTemplate,
    setEditOrderForm,
    setEditOrderHasExecutions,
    setExecutionActionModal,
    setExecutions,
    setExpandedForecast,
    setExpandedGoalStageId,
    setExpandedReportStage,
    setForecastData,
    setGoalEditValues,
    setGoalsProductivityData,
    setGoalsViewType,
    setInfoModal,
    setIsActionLoading,
    setIsAuthLoading,
    setIsCancellingOrder,
    setIsConfirmingDraft,
    setIsCreatingOrder,
    setIsDeletingOrder,
    setIsDraftsListModalOpen,
    setIsEditingOrder,
    setIsGeneratingLink,
    setIsLoadingForecast,
    setIsLoadingHistory,
    setIsLossModalOpen,
    setIsMobileMenuOpen,
    setIsPrintModalOpen,
    setIsProgressModalOpen,
    setIsSubmitting,
    setIsSyncingOlist,
    setIsTemplateEditorOpen,
    setIsUploadingArt,
    setLossQtyInput,
    setLossReasonDetailInput,
    setLossReasonInput,
    setLossReasonsList,
    setLossReentryStageIdInput,
    setLossReportData,
    setLossStageId,
    setMetaCustoPeca,
    setNewOrderForm,
    setNewOrderRequiredStages,
    setNewStageCalculationType,
    setNewStageMetaDiaria,
    setNewStageName,
    setNewStageTime,
    setNow,
    setOperationalReportData,
    setOrderHistory,
    setOrders,
    setOrderStageObservations,
    setPrintOpen,
    setPrintTypeFilter,
    setProductTypeFilter,
    setProfileReport,
    setProgressIncrementInput,
    setProgressStageId,
    setReportData,
    setReportEndDate,
    setReportPeriod,
    setReportPrintType,
    setReportStage,
    setReportStartDate,
    setReportUser,
    setSearchTerm,
    setSelectedDraftOrder,
    setSelectedFullImage,
    setSelectedOrder,
    setSelectedStageFilter,
    setSelectedStageId,
    setSelectedStageStatus,
    setSelectedUserForEdit,
    setSession,
    setShowActionLossSection,
    setShowCompletedOrders,
    setShowEditOrderModal,
    setShowHistoryModal,
    setShowNewOrderModal,
    setShowUserModal,
    setStages,
    setStats,
    setTemplateFormStages,
    setTemplates,
    setToastMessage,
    setUsers,
    setUserSearchTerm,
    showActionLossSection,
    showCompletedOrders,
    showEditOrderModal,
    showHistoryModal,
    showNewOrderModal,
    showUserModal,
    stages,
    stats,
    templateFormStages,
    templates,
    toastMessage,
    trackingToken,
    users,
    userSearchTerm
  };
}





