import React from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Menu, Search, Target, RefreshCw, Printer, Plus, Package, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Stage, User, Order } from '../types';

export const Header = ({
  activeTab, currentUser, dateRange, draftOrders, fetchExecutions, handleSyncOlist, isSyncingOlist, orders, printTypeFilter, productTypeFilter, reportEndDate, reportPeriod, reportPrintType, reportStage, reportStartDate, reportUser, searchTerm, selectedStageFilter, selectedStageStatus, setActiveTab, setDateRange, setIsDraftsListModalOpen, setIsMobileMenuOpen, setIsPrintModalOpen, setNewOrderRequiredStages, setPrintTypeFilter, setProductTypeFilter, setReportEndDate, setReportPeriod, setReportPrintType, setReportStage, setReportStartDate, setReportUser, setSearchTerm, setSelectedOrder, setSelectedStageFilter, setSelectedStageStatus, setSelectedUserForEdit, setShowNewOrderModal, setShowUserModal, setUserSearchTerm, stages, users, userSearchTerm
}: any) => {
  return (
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
  );
};

