import React from 'react';
import { Card } from '../components/ui/Card';
import { Package, Trash2, CheckCircle2, Clock, AlertTriangle, Activity, Shirt, Scissors, Edit2, Target } from 'lucide-react';
import { ProductionProgressPanel } from '../components/ProductionProgressPanel';
import { cn, safeFormat, getOrderCuttingQty } from '../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts';
import type { Order } from '../types';

export const DashboardTab = ({
  stats,
  draftOrders,
  activeExecutions,
  goalsProductivityData,
  dateRange,
  collaboratorGoals,
  users,
  setDateRange,
  currentUser,
  setActiveTab,
  handleCleanOldDrafts,
  handleOpenDraftReview,
  setInfoModal,
  getOrderRisk,
  orders
}: any) => {
  if (!stats) return null;
  return (
<div className="space-y-8">
            {/* Olist Draft Orders Banner */}
            {draftOrders.length > 0 && (
              <Card className="p-6 border-indigo-200 bg-indigo-50/50 shadow-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-sm">
                      <Package size={22} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-indigo-950 flex items-center gap-2">
                        Pedidos Importados do Olist ERP ({draftOrders.length})
                        <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider">
                          Pendente de Estampa / RevisÃ£o
                        </span>
                      </h3>
                      <p className="text-xs text-indigo-700 mt-0.5">
                        Estes pedidos foram importados automaticamente do Olist com a grade de tamanhos. A vendedora precisa selecionar a estampa antes de liberar para produÃ§Ã£o.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCleanOldDrafts}
                    className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
                    title="Excluir rascunhos com mais de 7 dias"
                  >
                    <Trash2 size={13} />
                    Limpar Antigos (&gt; 7 dias)
                  </button>
                </div>
                <div className="overflow-x-auto border border-indigo-100 rounded-xl bg-white shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-indigo-100/50 border-b border-indigo-100 text-indigo-900 font-bold uppercase text-[10px]">
                        <th className="px-4 py-2.5">Pedido Olist</th>
                        <th className="px-4 py-2.5">Cliente</th>
                        <th className="px-4 py-2.5 text-center">Itens / Grade</th>
                        <th className="px-4 py-2.5 text-center">Prazo</th>
                        <th className="px-4 py-2.5 text-right">AÃ§Ã£o</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-50">
                      {draftOrders.map((draft) => (
                        <tr key={draft.id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="px-4 py-3 font-bold font-mono text-indigo-950">{draft.order_number}</td>
                          <td className="px-4 py-3 font-semibold text-zinc-800">{draft.client_name}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className="inline-flex items-center gap-1 font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-[11px]">
                                {draft.quantity} peÃ§as {draft.items && draft.items.length > 0 && `(${draft.items.length} SKUs)`}
                              </span>
                              {(() => {
                                const cutQty = getOrderCuttingQty(draft);
                                if (cutQty > 0) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] font-black animate-pulse shadow-sm">
                                      <Scissors size={11} className="text-amber-700" /> FALTA ESTOQUE: {cutQty} PÃ‡S (CORTE)
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-zinc-600">
                            {safeFormat(draft.deadline, 'dd/MM/yyyy')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenDraftReview(draft)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                              >
                                <Edit2 size={13} />
                                Revisar &amp; Liberar
                              </button>
                              <button
                                onClick={() => handleDeleteDraftOrder(draft.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors border border-rose-200"
                                title="Excluir este rascunho"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Pedidos Ativos', description: 'Total de pedidos que estÃ£o atualmente no sistema e ainda nÃ£o foram finalizados ou cancelados.' })}>
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

              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'PeÃ§as em ProduÃ§Ã£o', description: 'Soma total de todas as quantidades de itens dos pedidos que estÃ£o com status ativo.' })}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                    <Layers size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">PeÃ§as em ProduÃ§Ã£o</p>
                    <h3 className="text-2xl font-bold">{stats.metrics?.activePieces || 0} <span className="text-sm font-normal text-zinc-400">un</span></h3>
                  </div>
                </div>
              </Card>

              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Pedidos Atrasados', description: 'Contagem de pedidos ativos cuja data de entrega (prazo) Ã© anterior Ã  data de hoje.' })}>
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

              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'ProduÃ§Ã£o Hoje', description: 'Quantidade de peÃ§as que passaram por alguma etapa de finalizaÃ§Ã£o no dia atual.' })}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">ProduÃ§Ã£o Hoje</p>
                    <h3 className="text-2xl font-bold">{stats.metrics?.todayFinalizedPieces || 0} <span className="text-sm font-normal text-zinc-400">peÃ§as</span></h3>
                  </div>
                </div>
              </Card>

              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Tempo MÃ©dio', description: 'MÃ©dia de tempo (em dias) que um pedido leva para ser concluÃ­do, desde a criaÃ§Ã£o atÃ© a Ãºltima etapa.' })}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Tempo MÃ©dio</p>
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
                      Pedidos em ProduÃ§Ã£o
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
                        {orders
                          .filter(o => o.status !== 'Entregue' && o.status !== 'Cancelado')
                          .filter(o => !printTypeFilter || o.print_type === printTypeFilter)
                          .filter(o => !productTypeFilter || o.product_type === productTypeFilter)
                          .map(order => {
                          const risk = getOrderRisk(order.id);
                          const riskColors = {
                            danger: "text-rose-600",
                            warning: "text-amber-600",
                            safe: "text-emerald-600"
                          };

                          return (
                            <tr key={order.id} className="hover:bg-zinc-50 transition-colors">
                              <td className={cn("px-4 py-3 font-mono text-xs font-bold", riskColors[risk])}>
                                <div>{order.order_number}</div>
                                {(() => {
                                  const cutQty = getOrderCuttingQty(order);
                                  if (cutQty > 0) {
                                    return (
                                      <span className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-black animate-pulse">
                                        <Scissors size={9} className="text-amber-700" /> {cutQty} p/ Corte
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-zinc-800">{order.client_name}</td>
                              <td className="px-4 py-3 text-sm text-zinc-600">{order.product_type}</td>
                              <td className="px-4 py-3 text-center text-sm font-bold text-zinc-700">{order.quantity}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn("text-xs font-bold", riskColors[risk])}>
                                  {safeFormat(order.deadline, 'dd/MM/yyyy')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn(
                                  "inline-flex px-2 py-1 rounded-full text-[10px] font-bold",
                                  order.status === 'Em ProduÃ§Ã£o' ? 'bg-sky-100 text-sky-700' :
                                    order.status === 'FinalizaÃ§Ã£o' ? 'bg-amber-100 text-amber-700' :
                                      'bg-zinc-100 text-zinc-700'
                                )}>
                                  {order.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {orders
                          .filter(o => o.status !== 'Entregue' && o.status !== 'Cancelado')
                          .filter(o => !printTypeFilter || o.print_type === printTypeFilter)
                          .filter(o => !productTypeFilter || o.product_type === productTypeFilter)
                          .length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">Nenhum pedido em produÃ§Ã£o.</td>
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
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">PeÃ§as Feitas</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Tempo MÃ©dio/PeÃ§a</th>
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
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-500">Sem dados de produtividade no perÃ­odo.</td>
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
                          <p className="text-[10px] text-zinc-500">{safeFormat(risk.deadline, 'dd/MM/yyyy')}</p>
                        </div>
                        <Badge variant="error" className="py-1">{risk.urgency === 'Atrasado' ? 'ATR' : 'RSC'}</Badge>
                      </div>
                    ))}
                    {(!stats.atRiskOrders || stats.atRiskOrders.length === 0) && (
                      <div className="text-center py-4 text-emerald-600 bg-emerald-50 rounded-lg border border-emerald-100 text-sm">
                        Nenhum pedido em risco! ðŸŽ‰
                      </div>
                    )}
                  </div>
                </Card>

                {/* Bottlenecks */}
                <Card className="p-6 border-amber-100">
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-amber-700">
                    <Filter size={18} />
                    Gargalos da ProduÃ§Ã£o
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
        
  );
};

