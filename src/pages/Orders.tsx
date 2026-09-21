import React from 'react';
import { motion } from 'motion/react';
import { differenceInDays, endOfDay, isPast, parseISO } from 'date-fns';
import { Eye, EyeOff, Search, Clock, FileText, CheckCircle, Circle, Check, Archive, Plus, Scissors, Timer, X, Edit2 } from 'lucide-react';
import { cn, formatSeconds, safeFormat, isImage, isPdf } from '../lib/utils';
import { Badge } from '../components/Badge';

const Card = ({ children, className, ...props }: any) => (
  <div className={cn("bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden", className)} {...props}>
    {children}
  </div>
);

export const Orders = ({
  orders,
  showCompletedOrders,
  setShowCompletedOrders,
  searchTerm,
  setSearchTerm,
  selectedStageFilter,
  setSelectedStageFilter,
  selectedStageStatus,
  setSelectedStageStatus,
  productTypeFilter,
  setProductTypeFilter,
  printTypeFilter,
  setPrintTypeFilter,
  setSelectedOrder,
  setEditingDtfOrderId,
  setConfirmingDtfOrderId,
  setEditingDtfValue,
  confirmingDtfOrderId,
  editingDtfOrderId,
  currentUser,
  handleToggleDtf,
  handleRequestToggleDtf,
  handleUpdateDtfLocation,
  handleUpdateDeadline,
  editingDtfValue,
  fetchExecutions,
}: any) => {
  return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <Card className="flex-grow p-4 bg-zinc-50 border-zinc-200">
                <div className="flex items-center gap-3 text-zinc-500 text-xs italic">
                  <Search size={14} />
                  Use a barra de busca no topo para localizar OPs por nÃºmero ou nome do cliente.
                </div>
              </Card>

              <button
                onClick={() => setShowCompletedOrders(!showCompletedOrders)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs transition-all border shadow-sm whitespace-nowrap",
                  showCompletedOrders 
                    ? "bg-zinc-900 border-zinc-900 text-white hover:bg-zinc-800" 
                    : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                )}
              >
                {showCompletedOrders ? <Eye size={16} /> : <EyeOff size={16} />}
                {showCompletedOrders ? 'Ocultar Entregues' : 'Mostrar Entregues'}
              </button>
            </div>

            <Card>
            <table className="w-full text-left">
              <thead>
                <tr className="border-bottom border-zinc-200 bg-zinc-50">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Cliente</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Produto</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">DTF</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Gaveteiro</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Prazo</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Etapa Atual</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">ObservaÃ§Ã£o da Etapa</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-right">Tempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {(() => {
                  const filteredOrders = (orders || [])
                    .filter(order => {
                      if (showCompletedOrders) return true;
                      return order.status !== 'Entregue' && order.status !== 'Cancelado';
                    })
                    .filter(o => {
                      if (selectedStageFilter) {
                        const hasStage = Array.isArray(o.required_stages) && o.required_stages.map(String).includes(String(selectedStageFilter));
                        if (!hasStage) return false;
                        if (selectedStageStatus) {
                          const st = (o.stages_status || []).find((s: any) => String(s.id) === String(selectedStageFilter));
                          if (selectedStageStatus === 'Pending' && st?.finished) return false;
                          if (selectedStageStatus === 'Finished' && !st?.finished) return false;
                        }
                      }
                      return true;
                    })
                    .filter(o => {
                      if (!searchTerm) return true;
                      const search = searchTerm.toLowerCase();
                      return (
                        (o.order_number || '').toLowerCase().includes(search) ||
                        (o.client_name || '').toLowerCase().includes(search) ||
                        (o.product_type || '').toLowerCase().includes(search) ||
                        (o.print_type || '').toLowerCase().includes(search)
                      );
                    })
                    .filter(o => !printTypeFilter || o.print_type === printTypeFilter)
                    .filter(o => !productTypeFilter || o.product_type === productTypeFilter);

                  if (filteredOrders.length === 0) {
                    const hasActiveFilters = Boolean(searchTerm || selectedStageFilter || productTypeFilter || printTypeFilter);
                    return (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 text-sm italic">
                          <div className="flex flex-col items-center gap-2">
                            <p>
                              Nenhum pedido encontrado. {(orders || []).length > 0 
                                ? `(${orders.length} pedidos no sistema, mas nenhum atende aos filtros aplicados)` 
                                : 'Nenhum pedido cadastrado no sistema.'}
                            </p>
                            {hasActiveFilters && (
                              <button
                                onClick={() => {
                                  setSearchTerm('');
                                  setSelectedStageFilter('');
                                  setSelectedStageStatus('Pending');
                                  setProductTypeFilter('');
                                  setPrintTypeFilter('');
                                }}
                                className="mt-2 text-xs font-bold text-zinc-900 bg-zinc-200 hover:bg-zinc-300 px-3 py-1.5 rounded-lg transition-colors not-italic"
                              >
                                Limpar Todos os Filtros
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return filteredOrders.map(order => {
                    const stagesList = Array.isArray(order.stages_status) ? order.stages_status : [];
                    let isOverdue = false;
                    if (order.status !== 'Entregue' && order.deadline) {
                      try {
                        const d = parseISO(order.deadline);
                        if (d && !isNaN(d.getTime())) {
                          isOverdue = isPast(endOfDay(d));
                        }
                      } catch (e) {}
                    }
                    const hasPendingReplacements = stagesList.some(s => s.pendencia_reposicao > 0);
                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        "cursor-pointer transition-colors border-l-4",
                        hasPendingReplacements 
                          ? "bg-rose-50 hover:bg-rose-100/80 border-l-rose-500 font-semibold"
                          : getOrderCuttingQty(order) > 0
                            ? "bg-amber-50/70 hover:bg-amber-100/80 border-l-amber-500 font-semibold"
                            : isOverdue 
                              ? "bg-amber-50/50 hover:bg-amber-100/60 border-l-amber-500"
                              : "border-l-transparent hover:bg-zinc-50"
                      )}
                      onClick={() => {
                        setSelectedOrder(order);
                        fetchExecutions(order.id);
                      }}
                    >
                      <td className="px-6 py-4 text-sm font-medium">
                        <div className="font-bold text-zinc-900">{order.client_name}</div>
                        {(() => {
                          const cutQty = getOrderCuttingQty(order);
                          if (cutQty > 0) {
                            return (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-950 border border-amber-300 rounded-md text-[10px] font-black animate-pulse shadow-sm">
                                  <Scissors size={11} className="text-amber-700 shrink-0" />
                                  FALTA ESTOQUE: {cutQty} PÃ‡S (CORTE)
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm flex items-center gap-1.5 font-bold text-zinc-800">
                            {order.product_type}
                            {((order.art_url && isPdf(order.art_url)) || (order.art_urls && order.art_urls.some(url => isPdf(url)))) && (
                              <FileText size={14} className="text-rose-500" title="Possui PDF" />
                            )}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-medium">{order.print_type} â€¢ {order.quantity} un</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        {order.print_type === 'DTF' ? (
                          confirmingDtfOrderId === order.id ? (
                            <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg p-1 w-max shadow-sm">
                              <span className="text-[10px] font-bold text-zinc-500 px-1 animate-pulse">Confirmar?</span>
                              <button
                                onClick={() => {
                                  if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
                                  setConfirmingDtfOrderId(null);
                                  handleToggleDtf(order.id, order.dtf_complete || false);
                                }}
                                className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs cursor-pointer shadow-sm flex items-center justify-center w-5 h-5 transition-all active:scale-95"
                                title="Confirmar"
                              >
                                <Check size={12} className="stroke-[3]" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
                                  setConfirmingDtfOrderId(null);
                                }}
                                className="p-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-600 rounded text-xs cursor-pointer shadow-sm flex items-center justify-center w-5 h-5 transition-all active:scale-95"
                                title="Cancelar"
                              >
                                <X size={12} className="stroke-[2]" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => handleRequestToggleDtf(order.id, e)}
                              className={cn(
                                "px-2.5 py-1 rounded text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-sm",
                                order.dtf_complete
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100"
                              )}
                            >
                              {order.dtf_complete ? (
                                <>
                                  <CheckCircle size={12} className="stroke-[3]" />
                                  <span>Pronto</span>
                                </>
                              ) : (
                                <>
                                  <Timer size={12} />
                                  <span>Pendente</span>
                                </>
                              )}
                            </button>
                          )
                        ) : (
                          <span className="text-zinc-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        {editingDtfOrderId === order.id ? (
                          <div className="flex items-center gap-1 bg-white border border-amber-400 rounded-lg p-1 shadow-md w-max">
                            <Archive size={13} className="text-amber-600 ml-1 shrink-0" />
                            <input
                              type="text"
                              placeholder="Gaveta / Obs..."
                              value={editingDtfValue}
                              onChange={(e) => setEditingDtfValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateDtfLocation(order.id, editingDtfValue.trim());
                                  setEditingDtfOrderId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingDtfOrderId(null);
                                }
                              }}
                              autoFocus
                              className="w-28 px-1.5 py-0.5 text-xs focus:outline-none text-zinc-800 placeholder:text-zinc-300"
                            />
                            <button
                              onClick={() => {
                                handleUpdateDtfLocation(order.id, editingDtfValue.trim());
                                setEditingDtfOrderId(null);
                              }}
                              className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded cursor-pointer transition-all active:scale-95 flex items-center justify-center w-5 h-5"
                              title="Salvar"
                            >
                              <Check size={12} className="stroke-[3]" />
                            </button>
                            <button
                              onClick={() => setEditingDtfOrderId(null)}
                              className="p-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-600 rounded cursor-pointer transition-all active:scale-95 flex items-center justify-center w-5 h-5"
                              title="Cancelar"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : order.dtf_location ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDtfOrderId(order.id);
                              setEditingDtfValue(order.dtf_location || '');
                            }}
                            className="group flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 rounded-lg text-xs font-bold text-amber-900 shadow-sm transition-all cursor-pointer"
                            title="Clique para alterar a localizaÃ§Ã£o do gaveteiro"
                          >
                            <Archive size={12} className="text-amber-600 shrink-0" />
                            <span>{order.dtf_location}</span>
                            <Edit2 size={10} className="text-amber-400 group-hover:text-amber-700 transition-colors ml-0.5 shrink-0" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDtfOrderId(order.id);
                              setEditingDtfValue('');
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-zinc-50 hover:bg-zinc-100 border border-dashed border-zinc-300 hover:border-zinc-400 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-700 transition-all cursor-pointer"
                            title="Clique para definir a gaveta / observaÃ§Ã£o"
                          >
                            <Plus size={11} className="text-zinc-400" />
                            <span>Gaveteiro</span>
                          </button>
                        )}
                      </td>
                      <td className={cn("px-6 py-4 text-sm", isOverdue && "text-rose-600 font-bold")}>
                        {(currentUser?.role === 'Admin' || currentUser?.role === 'Comercial') ? (
                          <input
                            type="date"
                            defaultValue={order.deadline ? order.deadline.split('T')[0] : ''}
                            onChange={(e) => handleUpdateDeadline(order.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-transparent border-none focus:ring-0 text-sm p-0 cursor-pointer hover:underline"
                          />
                        ) : (
                          safeFormat(order.deadline, 'dd/MM/yyyy')
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-zinc-600">
                        {(() => {
                          const active = stagesList.find(s => !s.finished);
                          if (!active) return <span className="text-zinc-400 font-medium">ConcluÃ­do</span>;
                          const qty = active.quantidade_pedido || order.quantity || 0;
                          const current = active.quantidade_boa || 0;
                          const exec = order.active_stage_execution;
                          
                          const isCurrentStageActive = exec && Number(exec.stage_id) === Number(active.id);
                          const execStatus = isCurrentStageActive ? exec.status : null;

                          const latestFinished = order.latest_finished_stage;
                          const isFinishedToday = latestFinished && (() => {
                            const d = new Date(latestFinished.end_time);
                            const today = new Date();
                            return d.getDate() === today.getDate() &&
                                   d.getMonth() === today.getMonth() &&
                                   d.getFullYear() === today.getFullYear();
                          })();

                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-zinc-800 font-bold">{active.name}</span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                {qty > 0 && (
                                  <span className="text-[10px] text-zinc-600 font-mono font-bold bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200/50">
                                    {current} / {qty} un
                                  </span>
                                )}
                                {execStatus === 'Pausado' && (
                                  <span className="text-[8px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200/60 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Pausado
                                  </span>
                                )}
                                {execStatus === 'Em andamento' && (
                                  <span className="text-[8px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                    Produzindo
                                  </span>
                                )}
                              </div>
                              {active.pendencia_reposicao > 0 && (
                                <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 mt-1 flex items-center gap-1 w-max animate-pulse">
                                  âš ï¸ ReposiÃ§Ã£o: +{active.pendencia_reposicao} pc
                                </span>
                              )}
                              {isFinishedToday && (
                                <span className="text-[9px] text-emerald-700 font-bold flex items-center gap-0.5 mt-1 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                  âœ“ {latestFinished.stage_name} hoje
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600">
                        {order.active_stage_observation ? (
                          <span className="italic text-zinc-700">
                            ðŸ“ "{order.active_stage_observation}"
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic font-light">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs">{formatSeconds(order.total_time_seconds)}</td>
                    </tr>
                  );
                });
              })()}
              </tbody>
            </table>
            </Card>
          </div>


  );
};
