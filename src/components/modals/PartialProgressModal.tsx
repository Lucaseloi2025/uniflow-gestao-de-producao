import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { X, TrendingUp } from 'lucide-react';
import type { Order, Stage } from '../../types';

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
            {isProgressModalOpen && selectedOrder && progressStageId && (() => {
        const stage = stages.find(s => s.id === progressStageId);
        const orderStage = (selectedOrder.stages_status || []).find(s => s.id === progressStageId);
        const currentGood = orderStage?.quantidade_boa || 0;
        const totalReq = selectedOrder.quantity || 0;
        const remaining = Math.max(0, totalReq - currentGood);

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-zinc-200 animate-in fade-in zoom-in duration-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">Registrar Progresso Parcial</h3>
                    <p className="text-xs text-zinc-500">{stage?.name} — Pedido #{selectedOrder.order_number}</p>
                  </div>
                </div>
                <button onClick={() => setIsProgressModalOpen(false)} className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600">
                  <X size={18} />
                </button>
              </div>

              <div className="py-2 space-y-4">
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100 text-xs space-y-1">
                  <div className="flex justify-between font-medium text-zinc-600">
                    <span>Peças concluídas até agora:</span>
                    <span className="font-bold text-zinc-900 font-mono">{currentGood} / {totalReq}</span>
                  </div>
                  <div className="flex justify-between font-medium text-amber-700">
                    <span>Peças restantes para finalizar:</span>
                    <span className="font-bold font-mono">{remaining} peças</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Quantidade de peças concluídas agora (+):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={progressIncrementInput}
                    onChange={(e) => setProgressIncrementInput(Math.max(0, Number(e.target.value)))}
                    className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Isso somará à produção diária do dia e atualizará o total acumulado do pedido.
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
                  Confirmar (+{progressIncrementInput} peças)
                </button>
              </div>
            </div>
          </div>
        );
      })()}


  );
};
