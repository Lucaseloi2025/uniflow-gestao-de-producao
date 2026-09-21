import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, isImage } from '../../lib/utils';
import { X, RefreshCw, AlertCircle, FileText, Plus } from 'lucide-react';

export const EditOrderModal = ({
  showEditOrderModal,
  setShowEditOrderModal,
  editOrderForm,
  setEditOrderForm,
  selectedOrder,
  setSelectedOrder,
  handleEditOrderSubmit,
  isEditingOrder,
  stages,
  editOrderHasExecutions,
  isUploadingArt,
  setIsUploadingArt,
  setSelectedFullImage,
  fetchData
}: any) => {
  return (
                <AnimatePresence>
          {
            showEditOrderModal && selectedOrder && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setShowEditOrderModal(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="font-bold text-lg">Editar Pedido</h2>
                      <p className="text-xs text-zinc-500 font-mono">{selectedOrder.order_number}</p>
                    </div>
                    <button onClick={() => setShowEditOrderModal(false)} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  {editOrderHasExecutions && (
                    <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                      <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-amber-700 text-xs font-medium">
                        Este pedido já possui tempo registrado em execuções. Alterar quantidade ou tipo pode afetar indicadores históricos.
                      </p>
                    </div>
                  )}

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome do Cliente</label>
                        <input
                          type="text"
                          value={editOrderForm.client_name || ''}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, client_name: e.target.value })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Produto</label>
                        <select
                          value={editOrderForm.product_type || 'Dry Fit'}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, product_type: e.target.value as any })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        >
                          <option>Dry Fit</option>
                          <option>Algodão</option>
                          <option>Poliamida</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Estampa</label>
                        <select
                          value={editOrderForm.print_type || 'Silk'}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, print_type: e.target.value as any })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        >
                          <option>Silk</option>
                          <option>DTF</option>
                          <option>Sublimação</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Quantidade</label>
                        <input
                          type="number"
                          min="1"
                          value={editOrderForm.quantity || ''}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, quantity: Number(e.target.value) })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Nº de Cores</label>
                        <input
                          type="number"
                          min="1"
                          value={editOrderForm.num_colors || 1}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, num_colors: Number(e.target.value) })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Prazo de Entrega</label>
                        <input
                          type="date"
                          value={editOrderForm.deadline?.split('T')[0] || ''}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, deadline: e.target.value })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Etapas de Produção</label>
                      <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                        {stages.filter(s => s.active).map(stage => {
                          const checked = (editOrderForm.required_stages || []).includes(stage.id);
                          return (
                            <label key={stage.id} className={cn(
                              "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer select-none text-[11px] font-bold",
                              checked ? "bg-zinc-900 border-zinc-900 text-white" : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                            )}>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={checked}
                                onChange={(e) => {
                                  const prev = editOrderForm.required_stages || [];
                                  setEditOrderForm({
                                    ...editOrderForm,
                                    required_stages: e.target.checked
                                      ? [...prev, stage.id]
                                      : prev.filter(id => id !== stage.id)
                                  });
                                }}
                              />
                              <div className={cn("w-4 h-4 rounded border flex items-center justify-center", checked ? "bg-white border-white text-zinc-900" : "border-zinc-300")}>
                                {checked && <CheckCircle size={10} strokeWidth={4} />}
                              </div>
                              {stage.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Fichas / Arquivos</label>
                        <button
                          type="button"
                          onClick={() => document.getElementById('edit-modal-upload')?.click()}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded-md transition-colors"
                        >
                          <Plus size={12} /> Adicionar Arquivo
                        </button>
                        <input
                          id="edit-modal-upload"
                          type="file"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            if (e.target.files && selectedOrder) {
                              setIsUploadingArt(true);
                              const formData = new FormData();
                              for (let i = 0; i < e.target.files.length; i++) {
                                formData.append('art_files', e.target.files[i]);
                              }
                              try {
                                const res = await fetch(`/api/orders/${selectedOrder.id}/images`, {
                                  method: 'POST',
                                  body: formData
                                });
                                if (res.ok) {
                                  const data = await res.json();
                                  setEditOrderForm({
                                    ...editOrderForm,
                                    art_urls: data.art_urls,
                                    art_url: data.art_urls[0]
                                  });
                                  if (selectedOrder) {
                                    setSelectedOrder({
                                      ...selectedOrder,
                                      art_urls: data.art_urls,
                                      art_url: data.art_urls[0]
                                    });
                                  }
                                  fetchData();
                                }
                              } catch (err) {
                                alert('Erro no upload');
                              } finally {
                                setIsUploadingArt(false);
                              }
                            }
                          }}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-zinc-50 rounded-xl border border-zinc-100">
                        {(editOrderForm.art_urls || []).length > 0 ? (
                          (editOrderForm.art_urls || []).map((url, i) => (
                            <div key={url + i} className="relative group">
                              <div
                                className="w-12 h-12 rounded-lg border border-zinc-200 overflow-hidden bg-white flex items-center justify-center cursor-pointer hover:border-zinc-400 transition-all"
                                onClick={() => {
                                  if (isImage(url)) {
                                    setSelectedFullImage(url);
                                  } else {
                                    window.open(url, '_blank');
                                  }
                                }}
                              >
                                {isImage(url) ? (
                                  <img src={url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <FileText size={16} className="text-zinc-400" />
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedUrls = (editOrderForm.art_urls || []).filter(u => u !== url);
                                  setEditOrderForm({
                                    ...editOrderForm,
                                    art_urls: updatedUrls,
                                    art_url: updatedUrls.length > 0 ? updatedUrls[0] : undefined
                                  });
                                }}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-zinc-900 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="w-full h-12 flex items-center justify-center border-2 border-dashed border-zinc-200 rounded-lg">
                            <span className="text-[10px] text-zinc-400 font-medium">Nenhum arquivo anexado</span>
                          </div>
                        )}
                        {isUploadingArt && (
                          <div className="w-12 h-12 rounded-lg border border-zinc-200 bg-white flex items-center justify-center">
                            <RefreshCw size={16} className="text-zinc-400 animate-spin" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Observações</label>
                      <textarea
                        value={editOrderForm.observations || ''}
                        onChange={(e) => setEditOrderForm({ ...editOrderForm, observations: e.target.value })}
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowEditOrderModal(false)}
                        className="flex-1 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleEditOrderSubmit}
                        disabled={isEditingOrder}
                        className={cn(
                          "flex-1 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                          isEditingOrder ? "opacity-70 cursor-not-allowed" : "hover:bg-zinc-800 active:scale-[0.98]"
                        )}
                      >
                        {isEditingOrder ? <><RefreshCw size={16} className="animate-spin" /> Salvando...</> : <><CheckCircle size={16} /> Salvar Alterações</>}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )
          }
        </AnimatePresence >


  );
};

