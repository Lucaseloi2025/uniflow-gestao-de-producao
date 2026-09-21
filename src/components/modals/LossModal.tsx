import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { X, AlertCircle } from 'lucide-react';
import type { Order, Stage, LossReasonSetting } from '../../types';

export const LossModal = ({
  isLossModalOpen,
  setIsLossModalOpen,
  selectedOrder,
  lossStageId,
  stages,
  lossQtyInput,
  setLossQtyInput,
  lossReasonInput,
  setLossReasonInput,
  lossReasonDetailInput,
  setLossReasonDetailInput,
  lossReentryStageIdInput,
  setLossReentryStageIdInput,
  lossReasonsList,
  handleSaveLoss
}: any) => {
  return (
    <AnimatePresence>
            {isLossModalOpen && selectedOrder && lossStageId && (() => {
        const stage = stages.find(s => s.id === lossStageId);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-zinc-200 animate-in fade-in zoom-in duration-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">Registrar Perda de Peça</h3>
                    <p className="text-xs text-zinc-500">{stage?.name} — Pedido #{selectedOrder.order_number}</p>
                  </div>
                </div>
                <button onClick={() => setIsLossModalOpen(false)} className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600">
                  <X size={18} />
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  ℹ️ Regra de Reposição
                </p>
                <p>
                  A quantidade do pedido <strong>nunca diminui</strong>. O registro de perda gera automaticamente uma <strong>pendência de reposição</strong> na etapa de reentrada.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Quantidade de Peças Perdidas:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={lossQtyInput}
                    onChange={(e) => setLossQtyInput(Math.max(1, Number(e.target.value)))}
                    className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Motivo da Perda (Categorizado):
                  </label>
                  <select
                    value={lossReasonInput}
                    onChange={(e) => {
                      const selectedReason = e.target.value;
                      setLossReasonInput(selectedReason);
                      const defaultReentry = lossReasonsList.find(r => r.motivo === selectedReason)?.etapa_reentrada_id || lossStageId;
                      setLossReentryStageIdInput(defaultReentry);
                    }}
                    className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs bg-white font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    {lossReasonsList.map((r, i) => (
                      <option key={i} value={r.motivo}>{r.motivo}</option>
                    ))}
                    {lossReasonsList.length === 0 && (
                      <>
                        <option value="Falta de matéria-prima/peça (estoque)">Falta de matéria-prima/peça (estoque)</option>
                        <option value="Defeito de corte">Defeito de corte</option>
                        <option value="Falha na estampa/DTF">Falha na estampa/DTF</option>
                        <option value="Defeito de costura">Defeito de costura</option>
                        <option value="Extravio">Extravio</option>
                        <option value="Reprovado na conferência (qualidade)">Reprovado na conferência (qualidade)</option>
                        <option value="Outro">Outro</option>
                      </>
                    )}
                  </select>
                </div>

                {lossReasonInput === 'Outro' && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Detalhamento do Motivo (Obrigatório):
                    </label>
                    <input
                      type="text"
                      placeholder="Descreva a causa específica..."
                      value={lossReasonDetailInput}
                      onChange={(e) => setLossReasonDetailInput(e.target.value)}
                      className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Etapa de Reentrada da Reposição:
                  </label>
                  <select
                    value={lossReentryStageIdInput || lossStageId}
                    onChange={(e) => setLossReentryStageIdInput(Number(e.target.value))}
                    className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs bg-white font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    {stages.map(st => (
                      <option key={st.id} value={st.id}>
                        {st.name} {st.id === lossStageId ? '(Etapa Atual)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Sugerido automaticamente com base no motivo. Você pode ajustar manualmente para casos atípicos.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsLossModalOpen(false)}
                  className="flex-1 py-2.5 bg-zinc-100 text-zinc-700 font-bold rounded-xl text-xs hover:bg-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveLoss}
                  className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition-colors"
                >
                  Confirmar Perda e Gerar Reposição
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </AnimatePresence>
  );
};

