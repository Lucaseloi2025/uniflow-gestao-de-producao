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
import { Badge } from './components/Badge';
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
import { Card } from './components/ui/Card';
import { PrintContainer } from './components/PrintContainer';
import { Sidebar } from './components/Sidebar';
import { useAppLogic } from './hooks/useAppLogic';
import { Header } from './components/Header';
import { SidebarItem } from './components/ui/SidebarItem';
import { InfoModal } from './components/modals/InfoModal';
import { RunningTaskBanner } from './components/RunningTaskBanner';
import { Card } from './components/ui/Card';
import { PrintContainer } from './components/PrintContainer';
import { Sidebar } from './components/Sidebar';
import { useAppLogic } from './hooks/useAppLogic';
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
import { Suspense, lazy } from 'react';

const Orders = lazy(() => import('./pages/Orders').then(m => ({ default: m.Orders })));
const Kanban = lazy(() => import('./pages/Kanban').then(m => ({ default: m.Kanban })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Costs = lazy(() => import('./pages/Costs').then(m => ({ default: m.Costs })));
const Collaborators = lazy(() => import('./pages/Collaborators').then(m => ({ default: m.Collaborators })));
const ConsolidatedCuttingPanel = lazy(() => import('./components/ConsolidatedCuttingPanel').then(m => ({ default: m.ConsolidatedCuttingPanel })));
const DashboardTab = lazy(() => import('./pages/DashboardTab').then(m => ({ default: m.DashboardTab })));
const TaskMonitor = lazy(() => import('./pages/TaskMonitor').then(m => ({ default: m.TaskMonitor })));
const SettingsTab = lazy(() => import('./pages/SettingsTab').then(m => ({ default: m.SettingsTab })));

const FallbackLoading = () => (
  <div className="flex-1 flex flex-col p-4 lg:p-8 space-y-6 w-full animate-pulse">
    <div className="flex justify-between items-center w-full">
      <div className="h-8 bg-zinc-200 rounded-lg w-1/4"></div>
      <div className="h-10 bg-zinc-200 rounded-lg w-32"></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="h-32 bg-zinc-200 rounded-xl"></div>
      <div className="h-32 bg-zinc-200 rounded-xl"></div>
      <div className="h-32 bg-zinc-200 rounded-xl"></div>
      <div className="h-32 bg-zinc-200 rounded-xl"></div>
    </div>
    <div className="h-96 bg-zinc-200 rounded-xl w-full"></div>
  </div>
);




export default function App() {
  const appLogic = useAppLogic();
  const { safeFetch, actionLossQuantityInput, actionLossReasonDetailInput, actionLossReasonInput, actionLossReentryStageIdInput, actionObservationInput, actionQuantityInput, activeExecutions, activeOrderTotalTime, activeReportSubTab, activeTab, authEmail, authError, authPassword, autoPauseTimeFriday, autoPauseTimeLunch, autoPauseTimeWeekday, autoPauseTimeWeekend, collaboratorGoals, COLORS, confirmDraftForm, confirmingDtfOrderId, cortePendingBadgeCount, currentUser, dateRange, delaysReportData, deliveryReportData, draftOrders, editingDtfOrderId, editingDtfValue, editingStageCalculationType, editingStageId, editingStageMetaDiaria, editingStageName, editingStageTime, editingTemplate, editOrderForm, editOrderHasExecutions, executionActionModal, executions, expandedForecast, expandedGoalStageId, expandedReportStage, fetchActiveExecution, fetchCollaboratorGoals, fetchConfig, fetchData, fetchDraftOrders, fetchExecutions, fetchForecast, fetchOperationalReport, fetchReports, fetchUsers, forecastData, goalEditValues, goalsProductivityData, goalsViewType, handleAddImages, handleCancelOrder, handleCleanOldDrafts, handleConfirmDraftOrder, handleConfirmExecutionAction, handleDeleteDraftOrder, handleDeleteOrder, handleEditOrderSubmit, handleFinishStage, handleGenerateTrackingLink, handleGlobalKeyDown, handleLogin, handleLogout, handleOpenActionModal, handleOpenDraftReview, handleOpenLossModal, handleOpenProgressModal, handlePauseStage, handleRequestToggleDtf, handleResumeStage, handleSaveLoss, handleSaveLossReasonsMapping, handleSaveProgress, handleStartStage, handleSyncOlist, handleToggleDtf, handleUpdateDeadline, handleUpdateDtfLocation, handleViewHistory, hh, infoModal, isActionLoading, isAuthLoading, isCancellingOrder, isConfirmingDraft, isCreatingOrder, isDeletingOrder, isDraftsListModalOpen, isEditingOrder, isGeneratingLink, isLoadingForecast, isLoadingHistory, isLossModalOpen, isMobileMenuOpen, isPrintModalOpen, isProgressModalOpen, isSubmitting, isSyncingOlist, isTemplateEditorOpen, isTrackingPage, isUploadingArt, location, lossQtyInput, lossReasonDetailInput, lossReasonInput, lossReasonsList, lossReentryStageIdInput, lossReportData, lossStageId, memoizedCostsByCollaborator, memoizedOrdersCompleted, metaCustoPeca, moveStage, navigate, newOrderForm, newOrderRequiredStages, newStageCalculationType, newStageMetaDiaria, newStageName, newStageTime, now, operationalReportData, orderHistory, orders, orderStageObservations, printOpen, printTypeFilter, productTypeFilter, profileReport, progressIncrementInput, progressStageId, rawTab, reportData, reportEndDate, reportPeriod, reportPrintType, reportStage, reportStartDate, reportUser, searchTerm, selectedDraftOrder, selectedFullImage, selectedOrder, selectedStageFilter, selectedStageId, selectedStageStatus, selectedUserForEdit, session, setActionLossQuantityInput, setActionLossReasonDetailInput, setActionLossReasonInput, setActionLossReentryStageIdInput, setActionObservationInput, setActionQuantityInput, setActiveExecutions, setActiveReportSubTab, setActiveTab, setAuthEmail, setAuthError, setAuthPassword, setAutoPauseTimeFriday, setAutoPauseTimeLunch, setAutoPauseTimeWeekday, setAutoPauseTimeWeekend, setCollaboratorGoals, setConfirmDraftForm, setConfirmingDtfOrderId, setCurrentUser, setDateRange, setDelaysReportData, setDeliveryReportData, setDraftOrders, setEditingDtfOrderId, setEditingDtfValue, setEditingStageCalculationType, setEditingStageId, setEditingStageMetaDiaria, setEditingStageName, setEditingStageTime, setEditingTemplate, setEditOrderForm, setEditOrderHasExecutions, setExecutionActionModal, setExecutions, setExpandedForecast, setExpandedGoalStageId, setExpandedReportStage, setForecastData, setGoalEditValues, setGoalsProductivityData, setGoalsViewType, setInfoModal, setIsActionLoading, setIsAuthLoading, setIsCancellingOrder, setIsConfirmingDraft, setIsCreatingOrder, setIsDeletingOrder, setIsDraftsListModalOpen, setIsEditingOrder, setIsGeneratingLink, setIsLoadingForecast, setIsLoadingHistory, setIsLossModalOpen, setIsMobileMenuOpen, setIsPrintModalOpen, setIsProgressModalOpen, setIsSubmitting, setIsSyncingOlist, setIsTemplateEditorOpen, setIsUploadingArt, setLossQtyInput, setLossReasonDetailInput, setLossReasonInput, setLossReasonsList, setLossReentryStageIdInput, setLossReportData, setLossStageId, setMetaCustoPeca, setNewOrderForm, setNewOrderRequiredStages, setNewStageCalculationType, setNewStageMetaDiaria, setNewStageName, setNewStageTime, setNow, setOperationalReportData, setOrderHistory, setOrders, setOrderStageObservations, setPrintOpen, setPrintTypeFilter, setProductTypeFilter, setProfileReport, setProgressIncrementInput, setProgressStageId, setReportData, setReportEndDate, setReportPeriod, setReportPrintType, setReportStage, setReportStartDate, setReportUser, setSearchTerm, setSelectedDraftOrder, setSelectedFullImage, setSelectedOrder, setSelectedStageFilter, setSelectedStageId, setSelectedStageStatus, setSelectedUserForEdit, setSession, setShowActionLossSection, setShowCompletedOrders, setShowEditOrderModal, setShowHistoryModal, setShowNewOrderModal, setShowUserModal, setStages, setStats, setTemplateFormStages, setTemplates, setToastMessage, setUsers, setUserSearchTerm, showActionLossSection, showCompletedOrders, showEditOrderModal, showHistoryModal, showNewOrderModal, showUserModal, stages, stats, templateFormStages, templates, toastMessage, trackingToken, users, userSearchTerm } = appLogic;



  if (appLogic.isTrackingPage) {
    return <PublicTracking token={appLogic.trackingToken} />;
  }

  if (appLogic.isAuthLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FA]">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 bg-zinc-200 rounded-2xl animate-pulse flex items-center justify-center shadow-sm">
            <RefreshCw size={28} className="text-zinc-400 animate-spin" />
          </div>
          <div className="h-4 w-32 bg-zinc-200 rounded-full animate-pulse"></div>
        </div>
      </div>
    );
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
    return (
      <div className="flex h-screen bg-[#F8F9FA] font-sans overflow-hidden">
        <div className="w-64 bg-white border-r border-zinc-200 p-6 flex flex-col gap-6">
          <div className="h-10 bg-zinc-200 rounded-lg animate-pulse"></div>
          <div className="space-y-4 mt-8">
            <div className="h-12 bg-zinc-100 rounded-xl animate-pulse"></div>
            <div className="h-12 bg-zinc-100 rounded-xl animate-pulse"></div>
            <div className="h-12 bg-zinc-100 rounded-xl animate-pulse"></div>
          </div>
        </div>
        <div className="flex-1 p-8 flex flex-col gap-8">
          <div className="flex justify-between items-center">
            <div className="h-10 w-48 bg-zinc-200 rounded-lg animate-pulse"></div>
            <div className="flex gap-4">
              <div className="h-10 w-32 bg-zinc-200 rounded-lg animate-pulse"></div>
              <div className="h-10 w-10 bg-zinc-200 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-6">
            <div className="h-32 bg-zinc-200 rounded-2xl animate-pulse"></div>
            <div className="h-32 bg-zinc-200 rounded-2xl animate-pulse"></div>
            <div className="h-32 bg-zinc-200 rounded-2xl animate-pulse"></div>
            <div className="h-32 bg-zinc-200 rounded-2xl animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8F9FA] font-sans text-zinc-900 overflow-hidden">
      <PrintContainer activeTab={activeTab} orders={orders} stages={stages} selectedStageFilter={selectedStageFilter} printTypeFilter={printTypeFilter} productTypeFilter={productTypeFilter} searchTerm={searchTerm} selectedStageStatus={selectedStageStatus} />

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

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        currentUser={currentUser}
        cortePendingBadgeCount={cortePendingBadgeCount}
        handleLogout={handleLogout}
      />

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
        <Header
          activeTab={activeTab}
          currentUser={currentUser}
          dateRange={dateRange}
          draftOrders={draftOrders}
          fetchExecutions={fetchExecutions}
          handleSyncOlist={handleSyncOlist}
          isSyncingOlist={isSyncingOlist}
          orders={orders}
          printTypeFilter={printTypeFilter}
          productTypeFilter={productTypeFilter}
          reportEndDate={reportEndDate}
          reportPeriod={reportPeriod}
          reportPrintType={reportPrintType}
          reportStage={reportStage}
          reportStartDate={reportStartDate}
          reportUser={reportUser}
          searchTerm={searchTerm}
          selectedStageFilter={selectedStageFilter}
          selectedStageStatus={selectedStageStatus}
          setActiveTab={setActiveTab}
          setDateRange={setDateRange}
          setIsDraftsListModalOpen={setIsDraftsListModalOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          setIsPrintModalOpen={setIsPrintModalOpen}
          setNewOrderRequiredStages={setNewOrderRequiredStages}
          setPrintTypeFilter={setPrintTypeFilter}
          setProductTypeFilter={setProductTypeFilter}
          setReportEndDate={setReportEndDate}
          setReportPeriod={setReportPeriod}
          setReportPrintType={setReportPrintType}
          setReportStage={setReportStage}
          setReportStartDate={setReportStartDate}
          setReportUser={setReportUser}
          setSearchTerm={setSearchTerm}
          setSelectedOrder={setSelectedOrder}
          setSelectedStageFilter={setSelectedStageFilter}
          setSelectedStageStatus={setSelectedStageStatus}
          setSelectedUserForEdit={setSelectedUserForEdit}
          setShowNewOrderModal={setShowNewOrderModal}
          setShowUserModal={setShowUserModal}
          setUserSearchTerm={setUserSearchTerm}
          stages={stages}
          users={users}
          userSearchTerm={userSearchTerm}
        />

        <Suspense fallback={<FallbackLoading />}>
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
            printTypeFilter={printTypeFilter}
            productTypeFilter={productTypeFilter}
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
          <SettingsTab
            autoPauseTimeFriday={autoPauseTimeFriday}
            autoPauseTimeLunch={autoPauseTimeLunch}
            autoPauseTimeWeekday={autoPauseTimeWeekday}
            collaboratorGoals={collaboratorGoals}
            currentUser={currentUser}
            editingStageCalculationType={editingStageCalculationType}
            editingStageId={editingStageId}
            editingStageMetaDiaria={editingStageMetaDiaria}
            editingStageName={editingStageName}
            editingStageTime={editingStageTime}
            expandedGoalStageId={expandedGoalStageId}
            goalEditValues={goalEditValues}
            lossReasonsList={lossReasonsList}
            newStageCalculationType={newStageCalculationType}
            newStageMetaDiaria={newStageMetaDiaria}
            newStageName={newStageName}
            newStageTime={newStageTime}
            stages={stages}
            stats={stats}
            templates={templates}
            users={users}
            setAutoPauseTimeFriday={setAutoPauseTimeFriday}
            setAutoPauseTimeLunch={setAutoPauseTimeLunch}
            setAutoPauseTimeWeekday={setAutoPauseTimeWeekday}
            setEditingStageCalculationType={setEditingStageCalculationType}
            setEditingStageId={setEditingStageId}
            setEditingStageMetaDiaria={setEditingStageMetaDiaria}
            setEditingStageName={setEditingStageName}
            setEditingStageTime={setEditingStageTime}
            setEditingTemplate={setEditingTemplate}
            setExpandedGoalStageId={setExpandedGoalStageId}
            setGoalEditValues={setGoalEditValues}
            setIsTemplateEditorOpen={setIsTemplateEditorOpen}
            setLossReasonsList={setLossReasonsList}
            setNewStageCalculationType={setNewStageCalculationType}
            setNewStageMetaDiaria={setNewStageMetaDiaria}
            setNewStageName={setNewStageName}
            setNewStageTime={setNewStageTime}
            setTemplateFormStages={setTemplateFormStages}
            fetchCollaboratorGoals={fetchCollaboratorGoals}
              safeFetch={safeFetch}
            fetchData={fetchData}
            handleSaveLossReasonsMapping={handleSaveLossReasonsMapping}
            moveStage={moveStage}
          />
        )}
        </Suspense>
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
          activeOrderTotalTime={activeOrderTotalTime}
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
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-6 right-6 bg-zinc-900 border border-zinc-700 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold z-[100] flex items-center gap-3"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}




























































