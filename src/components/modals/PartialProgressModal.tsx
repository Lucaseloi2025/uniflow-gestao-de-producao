import React from 'react';
import { AnimatePresence } from 'motion/react';
import { getStageProductivityUnit } from '../../lib/utils';
import { X, TrendingUp } from 'lucide-react';

export const PartialProgressModal = ({
  isProgressModalOpen,
  setIsProgressModalOpen,
  selectedOrder,
  progressStageId,
  stages,
  progressIncrementInput,
  setProgressIncrementInput,
  handleSaveProgress
}: any) => {
  return (
    <AnimatePresence>
      {isProgressModalOpen && selectedOrder && progressStageId && (() => {
        const stage = stages.find((s: any) => Number(s.id) === Number(progressStageId));
        const orderStage = (selectedOrder.stages_status || []).find((s: any) => Number(s.id) === Number(progressStageId));
        const unitInfo = getStageProductivityUnit(stage || orderStage);
        const orderPiecesQty = Number(selectedOrder.quantity) || 0;
        const rawStageTarget = Number(orderStage?.quantidade_prevista ?? orderStage?.quantidade_pedido ?? orderPiecesQty) || 0;
        const totalReq = unitInfo.isPerOrderUnit ? 1 : (rawStageTarget > 0 ? rawStageTarget : orderPiecesQty);
        const rawGood = Number(orderStage?.quantidade_boa) || 0;
        const currentGood = unitInfo.isPerOrderUnit ? (orderStage?.finished || rawGood >= 1 ? 1 : 0) : rawGood;
        const remaining = Math.max(0, totalReq - currentGood);

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-zinc-200 animate-in fade-in zoom-in duration-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">Registrar Progresso Parcial</h3>
                    <p className="text-xs text-zinc-500">
                      {stage?.name || orderStage?.name} — Pedido #{selectedOrder.order_number}
                      {unitInfo.isPerOrderUnit && orderPiecesQty > 0 ? ` (${orderPiecesQty} peças no pedido)` : ''}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsProgressModalOpen(false)} className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600">
                  <X size={18} />
                </button>
              </div>

              <div className="py-2 space-y-4">
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100 text-xs space-y-1">
                  <div className="flex justify-between font-medium text-zinc-600">
                    <span>Unidade da etapa:</span>
                    <span className="font-bold text-indigo-700 uppercase">{unitInfo.singular} ({unitInfo.plural})</span>
                  </div>
                  <div className="flex justify-between font-medium text-zinc-600">
                    <span>Concluído até agora:</span>
                    <span className="font-bold text-zinc-900 font-mono">{currentGood} / {totalReq} {totalReq === 1 ? unitInfo.singular : unitInfo.plural}</span>
                  </div>
                  <div className="flex justify-between font-medium text-amber-700">
                    <span>Restante para finalizar:</span>
                    <span className="font-bold font-mono">{remaining} {remaining === 1 ? unitInfo.singular : unitInfo.plural}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-zinc-700">
                      Quantidade concluída agora ({unitInfo.plural}) (+):
                    </label>
                    {remaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setProgressIncrementInput(remaining)}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors cursor-pointer"
                      >
                        + Preencher restantes ({remaining} {remaining === 1 ? unitInfo.singular : unitInfo.plural})
                      </button>
                    )}
                  </div>

                  <input
                    type="number"
                    min="0"
                    max={unitInfo.isPerOrderUnit ? 1 : undefined}
                    value={progressIncrementInput}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      setProgressIncrementInput(unitInfo.isPerOrderUnit ? Math.min(1, val) : val);
                    }}
                    className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Isso somará à produção diária ({unitInfo.plural}) no horário atual e atualizará o acumulado do pedido.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsProgressModalOpen(false)}
                  className="flex-1 py-2.5 bg-zinc-100 text-zinc-700 font-bold rounded-xl text-xs hover:bg-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveProgress}
                  className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition-colors"
                >
                  Confirmar (+{progressIncrementInput} {progressIncrementInput === 1 ? unitInfo.singular : unitInfo.plural})
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </AnimatePresence>
  );
};
