import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, safeFormat, isImage, isPdf, formatSeconds, getOrderCuttingQty } from '../../lib/utils';
import { getItemDisplaySize, aggregateCuttingDemand } from '../../lib/cuttingUtils';
import { calculateExecutionTimes } from '../../lib/timerUtils';
import { 
  ArrowLeft, Archive, Trash2, Edit2, LinkIcon, RefreshCw, Upload, FileText, Search, ImageIcon,
  CheckCircle, Plus, AlertTriangle, ChevronRight, Play, Pause, Check, Clock, Scissors, Package,
  Layers, CheckSquare, X, CheckCircle2, User as UserIcon, AlertCircle, ClipboardList, Timer, Download
} from 'lucide-react';
import { Badge } from '../Badge';
import type { Order, Stage } from '../../types';

export const OrderDetailsDrawer = ({
  selectedOrder,
  setSelectedOrder,
  stages,
  executions,
  currentUser,
  now,
  orderStageObservations,
  isGeneratingLink,
  isUploadingArt,
  isCancellingOrder,
  isDeletingOrder,
  confirmingDtfOrderId,
  setConfirmingDtfOrderId,
  openEditOrderModal,
  setSelectedFullImage,
  handleGenerateTrackingLink,
  handleAddImages,
  handleRemoveImage,
  handleCancelOrder,
  handleDeleteOrder,
  handleViewHistory,
  handleUpdateDeadline,
  handleToggleDtf,
  handleRequestToggleDtf,
  handleUpdateDtfLocation,
  handleStartStage,
  activeOrderTotalTime,
  handlePauseStage,
  handleResumeStage,
  handleFinishStage,
  handleReopenStage,
  isActionLoading,
  setSelectedStageId,
  selectedStageId
}: any) => {
  const confirmTimeoutRef = useRef<NodeJS.Timeout>();

  return (
    <AnimatePresence>
      {selectedOrder && (
        <div className="fixed inset-0 z-[200] flex justify-end bg-black/40 backdrop-blur-sm">
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  className="bg-white w-full h-full shadow-2xl overflow-y-auto"
                >
                  <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-3 sm:p-4 border-b border-zinc-100 flex justify-between items-center px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setSelectedOrder(null)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-all font-bold text-xs active:scale-95"
                      >
                        <ArrowLeft size={16} />
                        Voltar <kbd className="ml-1 px-1 py-0.5 text-[9px] font-mono bg-zinc-200 border border-zinc-300 rounded text-zinc-500 font-normal">Esc</kbd>
                      </button>
                      <div className="h-6 w-[1px] bg-zinc-200 hidden sm:block" />
                      <div>
                        <h2 className="text-xl font-black tracking-tight text-zinc-900 leading-tight">{selectedOrder.client_name}</h2>
                        <p className="text-[10px] text-zinc-500 font-mono">{selectedOrder.order_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {selectedOrder.print_type === 'DTF' && (
                        <div className="flex items-center gap-1">
                          {confirmingDtfOrderId === selectedOrder.id ? (
                            <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg p-1 shadow-sm">
                              <span className="text-[10px] font-bold text-zinc-500 px-1 animate-pulse">Confirmar?</span>
                              <button
                                onClick={() => {
                                  if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
                                  setConfirmingDtfOrderId(null);
                                  handleToggleDtf(selectedOrder.id, selectedOrder.dtf_complete || false);
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
                              onClick={(e) => handleRequestToggleDtf(selectedOrder.id, e)}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm",
                                selectedOrder.dtf_complete
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                              )}
                              title="Checklist da Designer (DTF Feito)"
                            >
                              {selectedOrder.dtf_complete ? (
                                <>
                                  <CheckCircle size={13} className="stroke-[3] text-emerald-600" />
                                  <span>DTF Pronto</span>
                                </>
                              ) : (
                                <>
                                  <Timer size={13} className="text-amber-500" />
                                  <span>DTF Pendente</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      <div className="relative flex items-center" title="Gaveteiro / Obs Interna">
                        <Archive size={13} className="absolute left-2.5 text-zinc-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Gaveta / Obs..."
                          defaultValue={selectedOrder.dtf_location || ''}
                          key={`modal-dtf-loc-header-${selectedOrder.id}-${selectedOrder.dtf_location || ''}`}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val !== (selectedOrder.dtf_location || '')) {
                              handleUpdateDtfLocation(selectedOrder.id, val);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="pl-7 pr-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 bg-white hover:bg-zinc-50 text-zinc-800 placeholder:text-zinc-400 w-36 shadow-sm transition-all font-medium"
                        />
                      </div>

                      {((currentUser?.role === 'Administrador' || currentUser?.role === 'Comercial') && selectedOrder.status !== 'Cancelado') && (
                        <>
                          <button
                            onClick={() => openEditOrderModal(selectedOrder)}
                            className="flex items-center gap-1 px-2 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg transition-all font-bold text-xs"
                            title="Editar"
                          >
                            <Edit2 size={13} />
                            <span className="hidden xl:inline">Editar</span>
                          </button>
                          <button
                            onClick={() => handleCancelOrder(selectedOrder.id)}
                            disabled={isCancellingOrder}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg transition-all font-bold text-xs",
                              isCancellingOrder && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {isCancellingOrder ? <RefreshCw size={13} className="animate-spin" /> : <X size={13} />}
                            <span className="hidden xl:inline">Cancelar</span>
                          </button>
                        </>
                      )}
                      {selectedOrder.status !== 'Cancelado' && (
                        <button
                          onClick={() => handleGenerateTrackingLink(selectedOrder)}
                          disabled={isGeneratingLink}
                          className="flex items-center gap-1 px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-all font-bold text-xs active:scale-95"
                          title="Gerar e copiar link de acompanhamento do cliente"
                        >
                          {isGeneratingLink ? <RefreshCw size={13} className="animate-spin" /> : <LinkIcon size={13} />}
                          <span className="hidden xl:inline">Link Cliente</span>
                          <span className="xl:hidden">Link</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleViewHistory(selectedOrder.id)}
                        className="flex items-center gap-1 px-2 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg transition-all font-bold text-xs"
                      >
                        <FileText size={13} />
                        <span className="hidden xl:inline">Histórico</span>
                      </button>
                      {(currentUser?.role === 'Administrador' || currentUser?.role === 'Comercial') && (
                        <button
                          onClick={() => handleDeleteOrder(selectedOrder.id)}
                          disabled={isDeletingOrder}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all font-bold text-xs",
                            isDeletingOrder && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {isDeletingOrder ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          <span className="hidden xl:inline">Excluir</span>
                        </button>
                      )}
                      <Badge variant={
                      selectedOrder.status === 'Entregue' ? 'success' :
                          selectedOrder.status === 'Cancelado' ? 'error' : 'info'
                      } className="text-[9px] py-0.5 px-2">
                        {selectedOrder.status}
                      </Badge>
                      {(selectedOrder.print_type === 'Silk' || selectedOrder.print_type === 'Sublimação') && selectedOrder.num_colors && (
                        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          🎨 {selectedOrder.num_colors} {selectedOrder.num_colors === 1 ? 'Cor' : 'Cores'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-4 sm:p-5 lg:p-6 max-w-full mx-auto h-[calc(100vh-64px)] overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 h-full">
                          
                          {/* Left Column: Order Information & Production Items */}
                          <div className="lg:col-span-5 space-y-4 overflow-y-auto pr-1 custom-scrollbar">
                            <section>
                              <h3 className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                <Package size={14} /> INFORMAÇÕES GERAIS
                              </h3>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 shadow-sm">
                                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Tempo Total</p>
                                  <p className="text-base font-mono font-bold">{formatSeconds(activeOrderTotalTime)}</p>
                                </div>
                                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 shadow-sm">
                                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Estimado</p>
                                  <p className="text-base font-mono font-bold text-zinc-500">{formatSeconds(selectedOrder.estimated_time_seconds)}</p>
                                </div>
                                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 shadow-sm col-span-2">
                                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Prazo Entrega</p>
                                  {(currentUser.role === 'Administrador' || currentUser.role === 'Comercial') ? (
                                    <input
                                      type="date"
                                      defaultValue={selectedOrder.deadline.split('T')[0]}
                                      onChange={(e) => handleUpdateDeadline(selectedOrder.id, e.target.value)}
                                      className="text-base font-bold bg-transparent border-none focus:ring-0 p-0 w-full cursor-pointer hover:text-zinc-600"
                                    />
                                  ) : (
                                    <p className="text-base font-bold">{safeFormat(selectedOrder.deadline, 'dd/MM/yyyy')}</p>
                                  )}
                                </div>
                              </div>
                            </section>
                            <section className="p-4 sm:p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm">
                              <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3">DETALHES DE PRODUÇÃO</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-0.5">Produto</span>
                                  <span className="text-xs font-bold text-zinc-900">{selectedOrder.product_type}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-0.5">Quantidade</span>
                                  <span className="text-xs font-bold text-zinc-900">{selectedOrder.quantity} <span className="text-zinc-500 font-medium text-[10px]">pçs</span></span>
                                </div>
                                <div className="col-span-2 pt-2 border-t border-zinc-50">
                                  <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Estampa</span>
                                  <Badge variant="info" className="text-[10px] px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-100">
                                    {selectedOrder.print_type}
                                  </Badge>
                                </div>
                              </div>
                            </section>

                            {selectedOrder.items && selectedOrder.items.length > 0 && (
                              <div className="space-y-4">
                                <section className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl shadow-sm space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-900 flex items-center gap-1.5">
                                      <Package size={13} className="text-indigo-600" /> LISTA DE ITENS DO PEDIDO
                                    </h4>
                                    <span className="text-[10px] font-bold text-indigo-600 font-mono">{selectedOrder.items.length} SKUs</span>
                                  </div>
                                  <div className="overflow-x-auto border border-indigo-100 rounded-xl bg-white shadow-sm">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="bg-indigo-100/60 text-indigo-950 font-bold uppercase text-[9px] border-b border-indigo-100">
                                          <th className="px-3 py-2.5">Item / Descrição</th>
                                          <th className="px-3 py-2.5 text-center">Tamanho</th>
                                          <th className="px-3 py-2.5 text-right">Qtd Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-indigo-50">
                                        {selectedOrder.items.map((item, idx) => {
                                          const qty = item.quantity ?? item.quantidade ?? 1;
                                          const displaySize = getItemDisplaySize(item);
                                          return (
                                            <tr key={idx} className="hover:bg-indigo-50/40 text-xs">
                                              <td className="px-3 py-2.5 font-bold text-zinc-900">{item.description || item.descricao || 'Item sem descrição'}</td>
                                              <td className="px-3 py-2.5 text-center">
                                                <span className="inline-block px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm font-black uppercase font-mono shadow-xs border border-indigo-700 tracking-wider">
                                                  {displaySize}
                                                </span>
                                              </td>
                                              <td className="px-3 py-2.5 text-right font-mono text-sm font-black text-zinc-900">{qty} un</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </section>
                              </div>
                            )}

                            {selectedOrder.observations && (
                              <section>
                                <h3 className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                  <ClipboardList size={12} /> OBSERVAÇÕES
                                </h3>
                                <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-xs font-medium text-amber-900 leading-relaxed italic">
                                  "{selectedOrder.observations}"
                                </div>
                              </section>
                            )}
                            
                            {activeOrderTotalTime > selectedOrder.estimated_time_seconds * 1.2 && (
                              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-700">
                                <AlertCircle size={16} />
                                <p className="text-[9px] font-bold uppercase tracking-tight">ALERTA: Tempo real +20% acima do esperado.</p>
                              </div>
                            )}
                          </div>

                          {/* Middle Column: Stage Management */}
                          <div className="lg:col-span-4 space-y-4 flex flex-col h-full border-x lg:border-zinc-100 px-4">
                            <h3 className="text-xs font-black text-zinc-900 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Layers size={16} className="text-sky-500" /> FLUXO DE PRODUÇÃO
                              </div>
                              {(() => {
                                const stagesStatusList = (selectedOrder.stages_status || []).filter((s: any) => Number(s.id) !== 12);
                                const finishedCount = stagesStatusList.filter((s: any) => {
                                  const execs = (executions || []).filter((e: any) => Number(e.stage_id) === Number(s.id));
                                  return Boolean(s.finished || execs.some((e: any) => e.status === 'Finalizado'));
                                }).length;
                                return (
                                  <Badge variant="info" className="text-[8px] py-0 px-1.5">
                                    {finishedCount}/{stagesStatusList.length}
                                  </Badge>
                                );
                              })()}
                            </h3>

                            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-3">
                              {(() => {
                                const stagesStatusList = (selectedOrder.stages_status || []).filter((s: any) => Number(s.id) !== 12);
                                const getStageExecution = (stageId: number) => {
                                  const stageExecs = (executions || []).filter((e: any) => Number(e.stage_id) === Number(stageId));
                                  return (
                                    stageExecs.find((e: any) => e.status === 'Em andamento') ||
                                    stageExecs.find((e: any) => e.status === 'Pausado') ||
                                    stageExecs.find((e: any) => e.status === 'Finalizado') ||
                                    stageExecs[0]
                                  );
                                };
                                const isStageDone = (orderStage: any) => {
                                  const exec = getStageExecution(orderStage.id);
                                  return Boolean(orderStage.finished || exec?.status === 'Finalizado');
                                };
                                const firstUnfinishedId = stagesStatusList.find((s: any) => !isStageDone(s))?.id;

                                return stagesStatusList.map((orderStage: any) => {
                                  const stage = stages.find((s: any) => Number(s.id) === Number(orderStage.id));
                                  if (!stage) return null;
                                  const execution = getStageExecution(stage.id);
                                  const isFinished = isStageDone(orderStage);
                                  const stageTimes = execution ? calculateExecutionTimes(execution, execution.pauses || [], now.getTime()) : null;
                                  const isSelected = selectedStageId === stage.id;
                                  const isNextToStart = !isFinished && (!execution || (execution.status !== 'Em andamento' && execution.status !== 'Pausado')) && stage.id === firstUnfinishedId;

                                  return (
                                    <div key={stage.id} 
                                      onClick={() => setSelectedStageId(stage.id)}
                                      className={cn(
                                        "p-3 rounded-lg border transition-all duration-200 cursor-pointer",
                                        isSelected ? "ring-2 ring-sky-500 bg-sky-50/20 border-sky-200" :
                                        execution?.status === 'Em andamento' ? "bg-white border-zinc-900 shadow-md ring-1 ring-zinc-900" :
                                        execution?.status === 'Pausado' ? "bg-amber-50/30 border-amber-100" :
                                        isFinished ? "bg-zinc-50/50 border-zinc-100" : "bg-white border-zinc-100"
                                      )}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5 overflow-hidden">
                                          <div className={cn(
                                            "w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-[10px] font-bold transition-colors",
                                            isFinished ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-500"
                                          )}>
                                            {isFinished ? <CheckCircle2 size={14} /> : stage.sort_order}
                                          </div>
                                          <div className="min-w-0">
                                            <p className={cn(
                                              "font-bold text-xs truncate",
                                              isFinished ? "text-zinc-500 line-through" : "text-zinc-900"
                                            )}>
                                              {stage.name}
                                            </p>
                                            {execution && stageTimes && (
                                              <p className="text-[9px] text-zinc-400 truncate font-medium">
                                                <span className="uppercase font-bold text-zinc-600">{execution.user_name}</span>
                                                <span className="opacity-30 mx-1">•</span>
                                                <span className="font-mono text-zinc-500">Total: {formatSeconds(stageTimes.totalAccumulatedSeconds)}</span>
                                              </p>
                                            )}
                                            {(() => {
                                               const stageObs = orderStageObservations.filter((o: any) => o.stage_id === stage.id);
                                               if (stageObs.length === 0) return null;
                                               return (
                                                 <div className="mt-1 p-1.5 bg-zinc-50 border border-zinc-100 rounded text-[9px] text-zinc-600 leading-normal max-w-xs space-y-1">
                                                   {stageObs.map((obs: any, oIdx: number) => (
                                                     <div key={oIdx} className="border-t border-zinc-200/50 first:border-t-0 pt-0.5 first:pt-0">
                                                       <div className="flex items-center justify-between text-[7px] text-zinc-400 font-bold mb-0.5">
                                                         <span>{obs.user_name || 'Operador'}</span>
                                                         <span>{safeFormat(obs.created_at, 'dd/MM HH:mm')}</span>
                                                       </div>
                                                       <p className="italic">"{obs.observation}"</p>
                                                     </div>
                                                   ))}
                                                 </div>
                                               );
                                             })()}
                                          </div>
                                        </div>
                                        
                                        {execution?.status === 'Em andamento' && stageTimes && (
                                          <div className="shrink-0 py-0.5 px-2 border border-emerald-200 bg-emerald-50 rounded-md text-emerald-700 font-mono text-[10px] font-bold flex items-center gap-1 shadow-xs">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <span>Sessão: {formatSeconds(stageTimes.currentSessionSeconds)}</span>
                                          </div>
                                        )}

                                        {execution?.status === 'Pausado' && stageTimes && (
                                          <div className="shrink-0 py-0.5 px-1.5 border border-amber-200 bg-amber-50 rounded-md text-amber-700 font-mono text-[10px] font-bold">
                                            Pausado ({formatSeconds(stageTimes.totalAccumulatedSeconds)})
                                          </div>
                                        )}

                                        {isFinished && handleReopenStage && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleReopenStage(stage.id);
                                            }}
                                            disabled={isActionLoading}
                                            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-600 text-[9px] font-bold transition-all active:scale-95"
                                            title="Voltar para trás / Reabrir esta etapa"
                                          >
                                            <ArrowLeft size={10} /> Voltar
                                          </button>
                                        )}
                                      </div>

                                      {!isFinished && (
                                        <div className="mt-2 space-y-1.5">
                                          <div className="flex items-center gap-1.5">
                                            {(!execution || (execution.status !== 'Em andamento' && execution.status !== 'Pausado')) && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleStartStage(stage.id);
                                                }}
                                                className={cn(
                                                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all font-bold text-[10px]",
                                                  isNextToStart 
                                                    ? "bg-zinc-900 text-white hover:bg-zinc-800 shadow-xs" 
                                                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200"
                                                )}
                                              >
                                                <Play size={12} fill="currentColor" />
                                                INICIAR {isSelected && <kbd className="ml-2 px-1.5 py-0.5 bg-zinc-900 text-white rounded text-[8px] font-mono shadow-sm">1</kbd>}
                                              </button>
                                            )}

                                            {execution?.status === 'Em andamento' && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePauseStage(execution.id, stage.id);
                                                  }}
                                                  disabled={isActionLoading}
                                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-white text-zinc-600 rounded-md hover:bg-zinc-50 transition-all font-bold text-[10px] border border-zinc-200"
                                                >
                                                  <Pause size={12} fill="currentColor" />
                                                  PAUSAR <kbd className="ml-1.5 px-1.5 py-0.5 bg-zinc-600 text-white rounded text-[8px] font-mono shadow-sm">2</kbd>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleFinishStage(execution.id, stage.id);
                                                  }}
                                                  disabled={isActionLoading}
                                                  className="flex-1 flex disabled:opacity-50 items-center justify-center gap-1 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-all font-bold text-[10px]"
                                                >
                                                  {isActionLoading ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> FINALIZANDO...</> : <><CheckCircle size={12} /> FINALIZAR <kbd className="ml-1.5 px-1.5 py-0.5 bg-emerald-800 text-white rounded text-[8px] font-mono shadow-sm">3</kbd></>}
                                                </button>
                                              </>
                                            )}

                                            {execution?.status === 'Pausado' && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleResumeStage(execution.id);
                                                  }}
                                                  disabled={isActionLoading}
                                                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition-all font-bold text-[10px]"
                                                >
                                                  <Play size={12} fill="currentColor" />
                                                  RETOMAR <kbd className="ml-2 px-1.5 py-0.5 bg-zinc-900 text-white rounded text-[8px] font-mono shadow-sm">1</kbd>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleFinishStage(execution.id, stage.id);
                                                  }}
                                                  disabled={isActionLoading}
                                                  className="flex-1 flex disabled:opacity-50 items-center justify-center gap-1 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-all font-bold text-[10px]"
                                                >
                                                  {isActionLoading ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> FINALIZANDO...</> : <><CheckCircle size={12} /> FINALIZAR <kbd className="ml-1.5 px-1.5 py-0.5 bg-emerald-800 text-white rounded text-[8px] font-mono shadow-sm">3</kbd></>}
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>

                      {/* Right Column: Files & Attachments */}
                      <div className="lg:col-span-3 space-y-4 flex flex-col h-full">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-black text-zinc-900 flex items-center gap-2">
                            <ImageIcon size={16} className="text-sky-500" /> FICHAS E ARQUIVOS
                          </h3>
                          <label
                            htmlFor="drawer-art-files-upload"
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1 bg-zinc-900 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-zinc-800 transition-all cursor-pointer shadow-sm active:scale-95",
                              isUploadingArt && "opacity-50 cursor-not-allowed pointer-events-none"
                            )}
                          >
                            {isUploadingArt ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                                <Plus size={12} />
                            )}
                            <span>{isUploadingArt ? 'Enviando...' : 'Adicionar'}</span>
                          </label>
                          <input
                            id="drawer-art-files-upload"
                            type="file"
                            accept="image/*,application/pdf"
                            multiple
                            className="hidden"
                            disabled={isUploadingArt}
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleAddImages(selectedOrder.id, e.target.files);
                              }
                              e.target.value = '';
                            }}
                          />
                        </div>

                        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-4">
                          {(() => {
                            const fileUrls: string[] = Array.from(
                              new Set(
                                [
                                  ...(Array.isArray(selectedOrder.art_urls) ? selectedOrder.art_urls : []),
                                  ...(selectedOrder.art_url ? [selectedOrder.art_url] : [])
                                ].filter(Boolean)
                              )
                            );
                            if (fileUrls.length === 0) {
                              return (
                                <div className="flex flex-col items-center justify-center py-16 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200 text-zinc-400 gap-3">
                                  <ImageIcon size={32} className="opacity-20" />
                                  <p className="text-[10px] font-bold uppercase tracking-widest">Sem arquivos</p>
                                </div>
                              );
                            }
                            return (
                              <div className="grid grid-cols-1 gap-4">
                                {fileUrls.map((url, i) => (
                                  <div
                                    key={i}
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedFullImage(url);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedFullImage(url);
                                      }
                                    }}
                                    className="group relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 aspect-video flex items-center justify-center cursor-pointer hover:border-zinc-900 transition-all"
                                  >
                                    {isImage(url) ? (
                                      <img
                                        src={url}
                                        alt={`Ficha ${i + 1}`}
                                        className="max-w-full max-h-full object-contain pointer-events-none select-none"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : isPdf(url) ? (
                                      <div className="pointer-events-none flex flex-col items-center gap-2 text-rose-500">
                                        <div className="p-3 bg-rose-50 rounded-full border border-rose-100">
                                          <FileText size={24} />
                                        </div>
                                        <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Documento PDF (Clique para abrir)</span>
                                      </div>
                                    ) : (
                                      <div className="pointer-events-none flex flex-col items-center gap-2 text-zinc-400">
                                        <FileText size={24} />
                                        <span className="text-[10px] uppercase font-bold text-zinc-500">Arquivo (Clique para abrir)</span>
                                      </div>
                                    )}
                                    <div className="pointer-events-none absolute inset-0 bg-zinc-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-[10px] gap-2">
                                      <Search size={14} /> AMPLIAR / VISUALIZAR
                                    </div>
                                    <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1.5 bg-zinc-900/80 hover:bg-zinc-900 text-white rounded-lg shadow-sm backdrop-blur-sm transition-all flex items-center justify-center"
                                        title="Baixar arquivo"
                                      >
                                        <Download size={14} />
                                      </a>
                                      {(currentUser?.role === 'Administrador' || currentUser?.role === 'Comercial' || currentUser?.role === 'PCP' || currentUser?.role === 'Supervisor') && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm('Tem certeza de que deseja remover este anexo do pedido?')) {
                                              handleRemoveImage?.(selectedOrder.id, url);
                                            }
                                          }}
                                          className="p-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg shadow-sm backdrop-blur-sm transition-all flex items-center justify-center cursor-pointer"
                                          title="Remover anexo"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
              </motion.div>
            </div>
          )}
    </AnimatePresence>
  );
};



