import React from 'react';
import { motion } from 'motion/react';
import { cn, safeFormat } from '../../lib/utils';
import { getItemDisplaySize } from '../../lib/cuttingUtils';
import { X, RefreshCw, Trash2, Package, Scissors, AlertTriangle, CheckCircle2, Check } from 'lucide-react';
import type { Stage } from '../../types';

export const OlistDraftReviewModal = ({
  selectedDraftOrder,
  setSelectedDraftOrder,
  confirmDraftForm,
  setConfirmDraftForm,
  isConfirmingDraft,
  handleConfirmDraftOrder,
  handleDeleteDraftOrder,
  stages
}: any) => {
  return (
    <AnimatePresence>
            {selectedDraftOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-zinc-100 my-8">
            <div className="bg-indigo-900 text-white p-6 relative">
              <button
                onClick={() => setSelectedDraftOrder(null)}
                className="absolute top-5 right-5 p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-mono font-bold uppercase tracking-wider mb-1">
                <Package size={16} /> Importado do Olist ERP
              </div>
              <h2 className="text-xl font-black">{selectedDraftOrder.client_name}</h2>
              <p className="text-xs text-indigo-200 font-mono mt-0.5">Pedido: {selectedDraftOrder.order_number}</p>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Qtd Total</span>
                  <span className="text-base font-black text-indigo-950 font-mono">{selectedDraftOrder.quantity} pcs</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Prazo Entrega</span>
                  <span className="text-sm font-bold text-zinc-800">{safeFormat(selectedDraftOrder.deadline, 'dd/MM/yyyy')}</span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Status Importação</span>
                  <span className="inline-flex px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold uppercase">Rascunho</span>
                </div>
              </div>

              {/* Grade de Tamanhos Table & Resumo de Corte */}
              {selectedDraftOrder.items && selectedDraftOrder.items.length > 0 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Package size={14} className="text-indigo-600" /> Lista de Itens do Pedido ({selectedDraftOrder.items.length} SKUs)
                      </h3>
                      <span className="text-[10px] font-bold text-zinc-400 font-mono">Total: {selectedDraftOrder.quantity} pcs</span>
                    </div>
                    <div className="overflow-x-auto border border-zinc-200 rounded-xl bg-white shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-zinc-50 text-zinc-600 font-bold uppercase text-[9px] border-b border-zinc-200">
                            <th className="px-3 py-2">Item / Descrição</th>
                            <th className="px-2 py-2 text-center">Tamanho</th>
                            <th className="px-2 py-2 text-right">Qtd Total</th>
                            <th className="px-2 py-2 text-center">Falta (Corte)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {selectedDraftOrder.items.map((item, idx) => {
                            const qty = item.quantity ?? item.quantidade ?? 1;
                            const corteQty = item.qty_corte ?? item.total_via_corte ?? (item.stock_available !== undefined && item.stock_available !== null ? Math.max(0, qty - Math.min(qty, item.stock_available)) : 0);
                            const displaySize = getItemDisplaySize(item);
                            return (
                              <tr key={idx} className="hover:bg-zinc-50/50 text-xs">
                                <td className="px-3 py-2.5 font-bold text-zinc-900">{item.description || item.descricao || 'Item sem descrição'}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="inline-block px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm font-black uppercase font-mono shadow-xs border border-indigo-700 tracking-wider">
                                    {displaySize}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-sm font-black text-zinc-900">{qty} un</td>
                                <td className="px-3 py-2.5 text-center">
                                  {corteQty > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-black font-mono shadow-xs">
                                      <Scissors size={11} className="text-white" /> {corteQty} un (FALTA)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-900 rounded-lg text-xs font-bold font-mono">
                                      <CheckCircle2 size={11} className="text-emerald-600" /> 0 un (Estoque)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Resumo de Peças para Corte (Abaixo do Lista do Pedido) */}
                  {(() => {
                    const cuttingItems = selectedDraftOrder.items.filter(it => {
                      const qtyPedida = it.quantity ?? it.quantidade ?? 1;
                      const corteQty = it.qty_corte ?? it.total_via_corte ?? (it.stock_available !== undefined && it.stock_available !== null ? Math.max(0, qtyPedida - Math.min(qtyPedida, it.stock_available)) : 0);
                      return corteQty > 0;
                    });

                    if (cuttingItems.length === 0) return null;

                    const totalCuttingQty = cuttingItems.reduce((sum, it) => sum + (it.qty_corte ?? it.total_via_corte ?? 1), 0);

                    return (
                      <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-2">
                            <Scissors size={15} className="text-amber-600 animate-pulse" />
                            Resumo de Peças para Corte (Falta em Estoque Olist)
                          </h4>
                          <span className="px-2.5 py-1 bg-amber-200 text-amber-950 rounded-full text-xs font-black font-mono uppercase border border-amber-300">
                            {totalCuttingQty} {totalCuttingQty === 1 ? 'peça a cortar' : 'peças a cortar'}
                          </span>
                        </div>

                        <div className="overflow-x-auto border border-amber-200/70 rounded-xl bg-white shadow-sm">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-amber-100/70 text-amber-950 font-bold uppercase text-[9px] border-b border-amber-200">
                                <th className="px-3 py-2.5">Item a Cortar</th>
                                <th className="px-3 py-2.5 text-center">Tamanho</th>
                                <th className="px-3 py-2.5 text-center">Estoque Olist</th>
                                <th className="px-3 py-2.5 text-right">Qtd a Cortar</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100/60">
                              {cuttingItems.map((item, idx) => {
                                const corteQty = item.qty_corte ?? item.total_via_corte ?? 1;
                                const stockAvail = item.stock_available ?? 0;
                                const displaySize = getItemDisplaySize(item);
                                return (
                                  <tr key={idx} className="hover:bg-amber-50/50 text-xs">
                                    <td className="px-3 py-2.5 font-bold text-zinc-900">{item.description || item.descricao || 'Item sem descrição'}</td>
                                    <td className="px-3 py-2.5 text-center">
                                      <span className="inline-block px-3 py-1 bg-amber-500 text-amber-950 rounded-lg text-sm font-black uppercase font-mono shadow-xs border border-amber-600 tracking-wider">
                                        {displaySize}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center font-mono text-xs font-bold text-zinc-700">{stockAvail > 0 ? `${stockAvail} un` : '0 un (Sem Estoque)'}</td>
                                    <td className="px-3 py-2.5 text-right">
                                      <span className="inline-block px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-sm font-black font-mono">
                                        {corteQty} un
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="text-[10px] text-amber-900 font-medium bg-amber-100/60 p-2 rounded-lg flex items-center gap-1.5 border border-amber-200/60">
                          <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                          <span>Estes itens não possuem saldo suficiente no estoque do Olist ERP e precisarão passar obrigatoriamente pela etapa de <strong>Corte</strong>.</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Form Controls */}
              <div className="space-y-4 pt-2 border-t border-zinc-100">
                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Definições para Produção</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tipo de Estampa */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Tipo de Estampa <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={confirmDraftForm.print_type}
                      onChange={(e) => setConfirmDraftForm(prev => ({ ...prev, print_type: e.target.value as any }))}
                      className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="DTF">DTF (Direct to Film)</option>
                      <option value="Silk">Silk-screen (Serigrafia)</option>
                      <option value="Sublimação">Sublimação Total</option>
                      <option value="Bordado">Bordado Computadorizado</option>
                    </select>
                  </div>

                  {/* Produto / Tecido */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Tecido / Linha de Produto
                    </label>
                    <input
                      type="text"
                      value={confirmDraftForm.product_type}
                      onChange={(e) => setConfirmDraftForm(prev => ({ ...prev, product_type: e.target.value }))}
                      placeholder="Ex: Dry Fit, Algodão 30.1, Poliéster..."
                      className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Num Cores (if Silk/Sublimacao) */}
                  {(confirmDraftForm.print_type === 'Silk' || confirmDraftForm.print_type === 'Sublimação') && (
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">
                        Número de Cores da Estampa
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={confirmDraftForm.num_colors}
                        onChange={(e) => setConfirmDraftForm(prev => ({ ...prev, num_colors: parseInt(e.target.value) || 1 }))}
                        className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Observações de Produção
                  </label>
                  <textarea
                    rows={2}
                    value={confirmDraftForm.observations}
                    onChange={(e) => setConfirmDraftForm(prev => ({ ...prev, observations: e.target.value }))}
                    placeholder="Instruções para o corte, estampa ou costura..."
                    className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Required Stages Checkboxes */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-2">
                    Etapas do Fluxo de Produção
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {stages.filter(st => st.active).map(st => {
                      const isChecked = confirmDraftForm.required_stages.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-xl border text-xs font-medium cursor-pointer transition-all",
                            isChecked ? "bg-indigo-50 border-indigo-200 text-indigo-950 font-bold" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setConfirmDraftForm(prev => ({ ...prev, required_stages: [...prev.required_stages, st.id] }));
                              } else {
                                setConfirmDraftForm(prev => ({ ...prev, required_stages: prev.required_stages.filter(id => id !== st.id) }));
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{st.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-50 p-4 border-t border-zinc-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDeleteDraftOrder(selectedDraftOrder.id)}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Excluir Rascunho</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDraftOrder(null)}
                  className="px-4 py-2.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDraftOrder}
                  disabled={isConfirmingDraft}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isConfirmingDraft ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Liberar para Produção</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

