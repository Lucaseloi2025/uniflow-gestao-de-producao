import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { X, Loader2, Pause, CheckCircle, AlertTriangle, TrendingUp, ClipboardList } from 'lucide-react';
import type { Order, Stage, LossReasonSetting } from '../../types';

export const ExecutionActionModal = ({
  executionActionModal,
  setExecutionActionModal,
  isActionLoading,
  handleConfirmExecutionAction,
  actionQuantityInput,
  setActionQuantityInput,
  actionObservationInput,
  setActionObservationInput,
  showActionLossSection,
  setShowActionLossSection,
  actionLossQuantityInput,
  setActionLossQuantityInput,
  actionLossReasonInput,
  setActionLossReasonInput,
  actionLossReasonDetailInput,
  setActionLossReasonDetailInput,
  actionLossReentryStageIdInput,
  setActionLossReentryStageIdInput,
  lossReasonsList,
  stages,
  selectedOrder
}: any) => {
  return (
            {executionActionModal && selectedOrder && (() => {
        const { type, executionId, stageId } = executionActionModal;
        const isPause = type === 'pause';
        const stage = stages.find(s => s.id === stageId);
        const orderStage = (selectedOrder.stages_status || []).find(s => s.id === stageId);
        const currentGood = orderStage?.quantidade_boa || 0;
        const currentLoss = orderStage?.quantidade_perdida || 0;
        const totalReq = selectedOrder.quantity || 0;
        const remaining = Math.max(0, totalReq - currentGood);

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className={cn("bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-zinc-200 animate-in fade-in zoom-in duration-200 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar relative", isActionLoading && "pointer-events-none")}>
              {isActionLoading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 rounded-2xl flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="animate-spin text-zinc-600" />
                    <span className="text-xs font-bold text-zinc-600">Processando...</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">
                      Apontamento de Produção
                    </h3>
                    <p className="text-xs text-zinc-500">{stage?.name} — Pedido #{selectedOrder.order_number}</p>
                  </div>
                </div>
                <button onClick={() => setExecutionActionModal(null)} className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600" disabled={isActionLoading}>
                  <X size={18} />
                </button>
              </div>

              <div className="py-1 space-y-4">
                {/* Barra de Progresso Visual */}
                {(() => {
                  const projected = currentGood + actionQuantityInput;
                  const pctCurrent = totalReq > 0 ? Math.min(100, Math.round((currentGood / totalReq) * 100)) : 0;
                  const pctProjected = totalReq > 0 ? Math.min(100, Math.round((projected / totalReq) * 100)) : 0;
                  const isComplete = projected >= totalReq;
                  return (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        <span>Progresso da Etapa</span>
                        <span className={cn("font-mono text-xs", isComplete ? "text-emerald-600" : "text-amber-600")}>
                          {projected} / {totalReq} ({pctProjected}%)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                        <div className="h-full rounded-full relative overflow-hidden" style={{ width: `${pctProjected}%`, transition: 'width 0.4s ease' }}>
                          <div className={cn("absolute inset-0", isComplete ? "bg-emerald-500" : "bg-amber-400")} style={{ width: `${totalReq > 0 ? Math.min(100, Math.round((currentGood / Math.max(projected, 1)) * 100)) : 0}%` }} />
                          <div className={cn("absolute inset-0", isComplete ? "bg-emerald-400" : "bg-amber-300 animate-pulse")} style={{ left: `${totalReq > 0 ? Math.min(100, Math.round((currentGood / Math.max(projected, 1)) * 100)) : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100 text-xs space-y-1.5">
                  <div className="flex justify-between font-medium text-zinc-600">
                    <span>Peças boas concluídas até agora:</span>
                    <span className="font-bold text-zinc-900 font-mono">{currentGood} / {totalReq}</span>
                  </div>
                  {currentLoss > 0 && (
                    <div className="flex justify-between font-medium text-rose-600">
                      <span>Perdas registradas no pedido:</span>
                      <span className="font-bold font-mono">{currentLoss} peças</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium text-amber-700">
                    <span>Peças restantes para finalizar:</span>
                    <span className="font-bold font-mono">{remaining} peças</span>
                  </div>
                </div>

                {/* Seção 1: Peças Boas Produzidas */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-emerald-600" />
                      Peças boas produzidas nesta sessão (+):
                    </label>
                    {remaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setActionQuantityInput(remaining)}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors"
                      >
                        + Preencher restantes ({remaining})
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={actionQuantityInput}
                    onChange={(e) => setActionQuantityInput(Math.max(0, Number(e.target.value)))}
                    className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Seção 2: Registrar Perda (Opcional / Expansível) */}
                <div className="pt-2 border-t border-zinc-100 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowActionLossSection(!showActionLossSection)}
                    className="w-full flex items-center justify-between p-2 rounded-xl bg-rose-50/50 hover:bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      {actionLossQuantityInput > 0
                        ? `⚠️ Perda registrada nesta sessão: ${actionLossQuantityInput} peça(s)`
                        : '⚠️ Houve alguma perda / refugo nesta sessão?'}
                    </span>
                    <span className="text-[10px] underline">
                      {showActionLossSection ? 'Ocultar' : (actionLossQuantityInput > 0 ? 'Editar Perda' : '+ Adicionar Perda')}
                    </span>
                  </button>

                  {(showActionLossSection || actionLossQuantityInput > 0) && (
                    <div className="p-3 bg-rose-50/30 rounded-xl border border-rose-100 space-y-3 animate-in fade-in duration-200 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                          Quantidade de peças perdidas nesta sessão:
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={actionLossQuantityInput}
                          onChange={(e) => setActionLossQuantityInput(Math.max(0, Number(e.target.value)))}
                          className="w-full p-2 border border-rose-200 rounded-lg text-sm font-bold bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                        />
                      </div>

                      {actionLossQuantityInput > 0 && (
                        <>
                          <div>
                            <label className="block text-[11px] font-bold text-zinc-700 mb-1">Motivo da perda:</label>
                            <select
                              value={actionLossReasonInput}
                              onChange={(e) => {
                                const newReason = e.target.value;
                                setActionLossReasonInput(newReason);
                                const defaultReentry = lossReasonsList.find(r => r.motivo === newReason)?.etapa_reentrada_id || stageId;
                                setActionLossReentryStageIdInput(defaultReentry);
                              }}
                              className="w-full p-2 border border-zinc-200 rounded-lg bg-white text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                            >
                              {lossReasonsList.map((r, i) => (
                                <option key={i} value={r.motivo}>{r.motivo}</option>
                              ))}
                              {!lossReasonsList.some(r => r.motivo === 'Outro') && (
                                <option value="Outro">Outro</option>
                              )}
                            </select>
                          </div>

                          {actionLossReasonInput === 'Outro' && (
                            <div>
                              <label className="block text-[11px] font-bold text-zinc-700 mb-1">Detalhamento do motivo (obrigatório):</label>
                              <input
                                type="text"
                                placeholder="Explique o motivo..."
                                value={actionLossReasonDetailInput}
                                onChange={(e) => setActionLossReasonDetailInput(e.target.value)}
                                className="w-full p-2 border border-zinc-200 rounded-lg bg-white text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                              />
                            </div>
                          )}

                          <div>
                            <label className="block text-[11px] font-bold text-zinc-700 mb-1">Etapa para reentrada de reposição:</label>
                            <select
                              value={actionLossReentryStageIdInput || stageId}
                              onChange={(e) => setActionLossReentryStageIdInput(Number(e.target.value))}
                              className="w-full p-2 border border-zinc-200 rounded-lg bg-white text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                            >
                              {stages.map((st) => (
                                <option key={st.id} value={st.id}>{st.name}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Seção 3: Observação do Apontamento (Opcional) */}
                <div className="pt-2 border-t border-zinc-100 space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                    <ClipboardList size={14} className="text-zinc-500" />
                    Observação da etapa (opcional):
                  </label>
                  <textarea
                    placeholder="Adicione alguma observação sobre esta sessão..."
                    value={actionObservationInput}
                    onChange={(e) => setActionObservationInput(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-zinc-500 focus:outline-none resize-none font-medium text-zinc-700 bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setExecutionActionModal(null)}
                  disabled={isActionLoading}
                  className="py-2.5 px-4 bg-zinc-100 text-zinc-700 font-bold rounded-xl text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmExecutionAction('pause')}
                  disabled={isActionLoading}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {isActionLoading && executionActionModal?.type === 'pause' ? (
                    <><Loader2 size={14} className="animate-spin" /> Pausando...</>
                  ) : (
                    <><Pause size={14} /> Pausar</>
                  )}
                </button>
                {(() => {
                  const canFinish = (currentGood + actionQuantityInput) >= totalReq;
                  return (
                    <button
                      type="button"
                      onClick={() => handleConfirmExecutionAction('finish')}
                      disabled={isActionLoading || !canFinish}
                      title={!canFinish ? `Faltam ${remaining - actionQuantityInput} peças para finalizar. Preencha a quantidade restante.` : 'Finalizar etapa'}
                      className={cn(
                        "flex-1 py-2.5 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5",
                        canFinish
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-zinc-300 cursor-not-allowed text-zinc-500",
                        "disabled:opacity-60 disabled:cursor-not-allowed"
                      )}
                    >
                      {isActionLoading && executionActionModal?.type === 'finish' ? (
                        <><Loader2 size={14} className="animate-spin" /> Finalizando...</>
                      ) : (
                        <><CheckCircle size={14} /> Finalizar</>
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}


  );
};
