import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { X, RefreshCw, CheckCircle } from 'lucide-react';
import type { Stage, OrderTemplate } from '../../types';

export const TemplateEditorModal = ({
  isTemplateEditorOpen,
  setIsTemplateEditorOpen,
  editingTemplate,
  isSubmitting,
  setIsSubmitting,
  templateFormStages,
  setTemplateFormStages,
  stages,
  fetchData,
  currentUser
}: any) => {
  return (
        {/* Template Editor Modal */}
        <AnimatePresence>
          {
            isTemplateEditorOpen && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white w-full max-w-xl rounded-2xl shadow-2xl p-6 lg:p-8 my-auto"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">{editingTemplate ? 'Editar Template' : 'Novo Template'}</h3>
                    <button onClick={() => setIsTemplateEditorOpen(false)}><X size={20} /></button>
                  </div>

                  <form className="space-y-6" onSubmit={async (e) => {
                    e.preventDefault();
                    if (isSubmitting) return;
                    setIsSubmitting(true);
                    const form = e.currentTarget;
                    const formData = new FormData(form);
                    const data = {
                      name: formData.get('name'),
                      product_type: formData.get('product_type'),
                      print_type: formData.get('print_type'),
                      quantity: formData.get('quantity'),
                      observations: formData.get('observations'),
                      required_stages: templateFormStages
                    };

                    const url = editingTemplate ? `/api/order-templates/${editingTemplate.id}` : '/api/order-templates';
                    const method = editingTemplate ? 'PATCH' : 'POST';

                    try {
                      const res = await fetch(url, {
                        method,
                        headers: {
                          'Content-Type': 'application/json',
                          'x-user-role': currentUser?.role || ''
                        },
                        body: JSON.stringify(data)
                      });

                      if (!res.ok) {
                        const errData = await res.json().catch(() => null);
                        alert(`Erro: ${errData?.error || 'Falha na operação'}`);
                        return;
                      }

                      setIsTemplateEditorOpen(false);
                      fetchData,
  currentUser();
                    } catch (error) {
                      alert("Erro ao conectar com o servidor.");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome do Template</label>
                        <input
                          name="name"
                          type="text"
                          defaultValue={editingTemplate?.name}
                          placeholder="Ex: Silk 2 Cores Frente"
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Quantidade Padrão</label>
                        <input
                          name="quantity"
                          type="number"
                          defaultValue={editingTemplate?.quantity}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Produto Padrão</label>
                        <select
                          name="product_type"
                          defaultValue={editingTemplate?.product_type || 'Dry Fit'}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white"
                        >
                          <option>Dry Fit</option>
                          <option>Algodão</option>
                          <option>Poliamida</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Estampa Padrão</label>
                        <select
                          name="print_type"
                          defaultValue={editingTemplate?.print_type || 'Silk'}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white"
                        >
                          <option>Silk</option>
                          <option>DTF</option>
                          <option>Sublimação</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-3">Etapas do Fluxo de Produção</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                        {stages.filter(s => s.active).map(stage => (
                          <label key={stage.id} className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer select-none",
                            templateFormStages.includes(stage.id)
                              ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                              : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                          )}>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={templateFormStages.includes(stage.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTemplateFormStages([...templateFormStages, stage.id]);
                                } else {
                                  setTemplateFormStages(templateFormStages.filter(id => id !== stage.id));
                                }
                              }}
                            />
                            <div className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                              templateFormStages.includes(stage.id) ? "bg-white text-zinc-900 border-white" : "border-zinc-300"
                            )}>
                              {templateFormStages.includes(stage.id) && <CheckCircle size={10} strokeWidth={4} />}
                            </div>
                            <span className="text-[11px] font-bold truncate">{stage.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Observações Padrão</label>
                      <textarea
                        name="observations"
                        defaultValue={editingTemplate?.observations}
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm h-24"
                      ></textarea>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={cn(
                        "w-full py-3 bg-zinc-900 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                        isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:bg-zinc-800 active:scale-[0.98]"
                      )}
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        editingTemplate ? 'Salvar Alterações' : 'Criar Template'
                      )}
                    </button>
                  </form>
                </motion.div>
              </div>
            )
          }
        </AnimatePresence >


  );
};

