import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, safeFormat } from '../../lib/utils';
import { X, Trash2, Edit2, Package } from 'lucide-react';
import type { Order } from '../../types';

export const OlistDraftListModal = ({
  isDraftsListModalOpen,
  setIsDraftsListModalOpen,
  draftOrders,
  handleCleanOldDrafts,
  handleDeleteDraftOrder,
  handleOpenDraftReview
}: any) => {
  return (
    <AnimatePresence>
            {isDraftsListModalOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-zinc-100 my-8">
            <div className="bg-indigo-900 text-white p-6 relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-mono font-bold uppercase tracking-wider mb-1">
                  <Package size={16} /> Integração Olist ERP
                </div>
                <h2 className="text-xl font-black">Rascunhos de Pedidos Importados ({draftOrders.length})</h2>
                <p className="text-xs text-indigo-200 mt-0.5">
                  Estes pedidos aguardam revisão da vendedora para definição de estampa e liberação para produção.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {draftOrders.length > 0 && (
                  <button
                    onClick={handleCleanOldDrafts}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5"
                    title="Excluir rascunhos com mais de 7 dias"
                  >
                    <Trash2 size={13} />
                    Limpar Antigos (&gt; 7 dias)
                  </button>
                )}
                <button
                  onClick={() => setIsDraftsListModalOpen(false)}
                  className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {draftOrders.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  <Package size={48} className="mx-auto text-zinc-300 mb-3" />
                  <p className="font-bold text-sm">Nenhum rascunho de pedido pendente.</p>
                  <p className="text-xs text-zinc-400 mt-1">Clique em "Sincronizar Olist" no menu superior para buscar novos pedidos do ERP.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-zinc-200 rounded-2xl bg-white shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px]">
                        <th className="px-4 py-3">Nº Pedido Olist</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3 text-center">Itens / Quantidade</th>
                        <th className="px-4 py-3 text-center">Prazo Estimado</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {draftOrders.map((draft) => (
                        <tr key={draft.id} className="hover:bg-zinc-50/60 transition-colors">
                          <td className="px-4 py-3 font-bold font-mono text-indigo-950">{draft.order_number}</td>
                          <td className="px-4 py-3 font-semibold text-zinc-800">{draft.client_name}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs">
                              {draft.quantity} pçs {draft.items && draft.items.length > 0 && `(${draft.items.length} SKUs)`}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-zinc-600">
                            {safeFormat(draft.deadline, 'dd/MM/yyyy')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setIsDraftsListModalOpen(false);
                                  handleOpenDraftReview(draft);
                                }}
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
              )}
            </div>

            <div className="bg-zinc-50 p-4 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-medium">Total: {draftOrders.length} rascunhos pendentes</span>
              <button
                onClick={() => setIsDraftsListModalOpen(false)}
                className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold rounded-xl text-xs transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

