import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { X, RefreshCw, Clock, CheckCircle, Upload, Settings } from 'lucide-react';
import type { Stage, OrderTemplate } from '../../types';

export const NewOrderModal = ({
  showNewOrderModal,
  setShowNewOrderModal,
  isCreatingOrder,
  setIsCreatingOrder,
  newOrderForm,
  setNewOrderForm,
  fetchData,
  stages,
  newOrderRequiredStages,
  setNewOrderRequiredStages,
  currentUser,
  templates,
  setEditingTemplate,
  setTemplateFormStages,
  setIsTemplateEditorOpen,
  applyTemplate
}: any) => {
  return (
                <AnimatePresence>
          {
            showNewOrderModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 lg:p-8 my-auto"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Novo Pedido</h3>
                    <button onClick={() => setShowNewOrderModal(false)}><X size={20} /></button>
                  </div>


                  <form className="space-y-4" onSubmit={async (e) => {
                    e.preventDefault();
                    if (isCreatingOrder) return;
                    setIsCreatingOrder(true);
                    const form = e.currentTarget;
                    const formData = new FormData(form);

                    // Validação: Não permitir pedido sem nenhuma etapa
                    if (newOrderRequiredStages.length === 0) {
                      alert("Por favor, selecione pelo menos uma etapa para o pedido.");
                      return;
                    }

                    formData.append('required_stages', JSON.stringify(newOrderRequiredStages));

                    // Explicitly append all files from the input
                    const fileInput = form.querySelector('input[name="art_files"]') as HTMLInputElement;
                    if (fileInput && fileInput.files) {
                      const MAX_FILE_SIZE = 4 * 1024 * 1024;
                      for (let i = 0; i < fileInput.files.length; i++) {
                        if (fileInput.files[i].size > MAX_FILE_SIZE) {
                          alert(`O arquivo "${fileInput.files[i].name}" é muito grande. O limite máximo é de 4MB por arquivo.`);
                          setIsCreatingOrder(false);
                          return;
                        }
                      }
                      
                      // Clear any existing art_files to be sure
                      formData.delete('art_files');
                      for (let i = 0; i < fileInput.files.length; i++) {
                        formData.append('art_files', fileInput.files[i]);
                      }
                    }

                    try {
                      const res = await fetch('/api/orders', {
                        method: 'POST',
                        headers: { 'x-user-role': currentUser?.role || '' },
                        body: formData
                      });

                      if (!res.ok) {
                        const errData = await res.json().catch(() => null);
                        const details = errData?.details ? `\n\nDetalhes:\n${errData.details.join('\n')}` : '';
                        alert(`Erro ao criar pedido: ${errData?.error || 'Falha no servidor'}${details}`);
                        setIsCreatingOrder(false);
                        return;
                      }

                      setShowNewOrderModal(false);
                      setNewOrderForm({
                        client_name: '',
                        product_type: 'Dry Fit',
                        print_type: 'Silk',
                        quantity: '',
                        deadline: '',
                        observations: ''
                      });
                      setNewOrderRequiredStages([]);
                      fetchData();
                    } catch (error) {
                      alert("Erro ao conectar com o servidor.");
                    } finally {
                      setIsCreatingOrder(false);
                    }
                  }}>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome do Cliente / Card</label>
                      <input
                        name="client_name"
                        type="text"
                        value={newOrderForm.client_name}
                        onChange={(e) => setNewOrderForm({ ...newOrderForm, client_name: e.target.value })}
                        placeholder="Ex: Camisetas Evento X"
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Mockup / Ficha (Arquivos)</label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-300 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-3 text-zinc-400" />
                            <p className="mb-2 text-sm text-zinc-500 text-center px-4"><span className="font-semibold">Clique para upload</span> ou arraste</p>
                            <p className="text-[10px] text-zinc-400 font-medium">PDF, JPG, PNG, etc</p>
                          </div>
                          <input
                            name="art_files"
                            type="file"
                            className="hidden"
                            multiple
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                // Simple visual feedback for multiple files
                                const label = e.currentTarget.previousElementSibling?.querySelector('p');
                                if (label) label.textContent = `${files.length} arquivo(s) selecionado(s)`;
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Produto</label>
                        <select
                          name="product_type"
                          value={newOrderForm.product_type}
                          onChange={(e) => setNewOrderForm({ ...newOrderForm, product_type: e.target.value as any })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white"
                        >
                          <option>Dry Fit</option>
                          <option>Algodão</option>
                          <option>Poliamida</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Estampa</label>
                        <select
                          name="print_type"
                          value={newOrderForm.print_type}
                          onChange={(e) => setNewOrderForm({ ...newOrderForm, print_type: e.target.value as any })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white"
                        >
                          <option>Silk</option>
                          <option>DTF</option>
                          <option>Sublimação</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Quantidade</label>
                        <input
                          name="quantity"
                          type="number"
                          value={newOrderForm.quantity}
                          onChange={(e) => setNewOrderForm({ ...newOrderForm, quantity: e.target.value })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Prazo</label>
                        <input
                          name="deadline"
                          type="date"
                          value={newOrderForm.deadline}
                          onChange={(e) => setNewOrderForm({ ...newOrderForm, deadline: e.target.value })}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Observações</label>
                      <textarea
                        name="observations"
                        value={newOrderForm.observations}
                        onChange={(e) => setNewOrderForm({ ...newOrderForm, observations: e.target.value })}
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm h-24"
                      ></textarea>
                    </div>

                    {/* Templates Section Relocated */}
                    <div className="mt-4 mb-2">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Templates Rápidos</label>
                        {currentUser?.role === 'Admin' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTemplate(null);
                              setTemplateFormStages(stages.filter(s => s.active).map(s => s.id));
                              setIsTemplateEditorOpen(true);
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-zinc-900 hover:text-zinc-600 transition-colors uppercase tracking-wider"
                          >
                            <Settings size={10} />
                            Gerenciar
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {templates.map(template => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => applyTemplate(template)}
                            className="px-3 py-1.5 bg-zinc-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-zinc-700 rounded-lg text-xs font-bold transition-all border border-zinc-200"
                          >
                            {template.name}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setNewOrderRequiredStages(stages.filter(s => s.active).map(s => s.id));
                          }}
                          className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 transition-colors"
                        >
                          Marcar Todas
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNewOrderRequiredStages([]);
                          }}
                          className="px-3 py-1.5 bg-white text-zinc-600 rounded-lg text-xs font-bold hover:bg-zinc-100 transition-colors border border-zinc-200"
                        >
                          Limpar Todas
                        </button>
                      </div>
                    </div>

                    {/* Step Selection */}
                    <div className="mb-6 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase leading-none">Etapas Deste Pedido ({newOrderRequiredStages.length} selecionadas)</label>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {stages.filter(s => s.active).map(stage => (
                          <label key={stage.id} className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer select-none",
                            newOrderRequiredStages.includes(stage.id)
                              ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                              : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                          )}>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={newOrderRequiredStages.includes(stage.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewOrderRequiredStages([...newOrderRequiredStages, stage.id]);
                                } else {
                                  setNewOrderRequiredStages(newOrderRequiredStages.filter(id => id !== stage.id));
                                }
                              }}
                            />
                            <div className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                              newOrderRequiredStages.includes(stage.id) ? "bg-white text-zinc-900 border-white" : "border-zinc-300"
                            )}>
                              {newOrderRequiredStages.includes(stage.id) && <CheckCircle size={10} strokeWidth={4} />}
                            </div>
                            <span className="text-[11px] font-bold truncate">{stage.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Preview do Tempo de Produção */}
                    {(() => {
                      const qty = Number(newOrderForm.quantity) || 0;
                      let totalTimeSec = 0;
                      if (qty > 0 && newOrderRequiredStages.length > 0) {
                        newOrderRequiredStages.forEach(id => {
                          const s = stages.find(st => st.id === id);
                          if (s) {
                            const base = (s.ideal_time || s.average_time_seconds || 0);
                            if (s.calculation_type === 'por_peca') {
                              totalTimeSec += base * qty;
                            } else if (s.calculation_type === 'por_lote') {
                              totalTimeSec += base * Math.ceil(qty / 10);
                            } else {
                              // por_pedido ou default
                              totalTimeSec += base;
                            }
                          }
                        });
                      }
                      
                      const hours = Math.floor(totalTimeSec / 3600);
                      const minutes = Math.floor((totalTimeSec % 3600) / 60);

                      if (qty > 0 && newOrderRequiredStages.length > 0) {
                        return (
                          <div className={cn(
                            "mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-xl gap-4",
                            totalTimeSec > 0 ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"
                          )}>
                             <div className="flex items-center gap-3">
                               <div className={cn("p-2 rounded-lg", totalTimeSec > 0 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600")}>
                                 <Clock size={20} />
                               </div>
                               <div>
                                 <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5", totalTimeSec > 0 ? "text-emerald-600" : "text-amber-600")}>
                                   Previsão Tempo de Produção
                                 </p>
                                 <p className={cn("text-sm font-medium", totalTimeSec > 0 ? "text-emerald-800" : "text-amber-800")}>
                                   Custo de tempo com base em {qty} peça(s)
                                 </p>
                                 {totalTimeSec === 0 && (
                                   <p className="text-[10px] text-amber-700 mt-1 font-semibold leading-tight max-w-[250px]">
                                     ⚠️ Estas etapas ainda não possuem o "Tempo Ideal" configurado no painel da Engrenagem.
                                   </p>
                                 )}
                               </div>
                             </div>
                             <div className="text-right whitespace-nowrap">
                               <p className={cn("text-xl font-black", totalTimeSec > 0 ? "text-emerald-600" : "text-amber-600")}>
                                 {hours}h {minutes}m
                               </p>
                             </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <button
                      type="submit"
                      disabled={isCreatingOrder}
                      className={cn(
                        "w-full py-3 bg-zinc-900 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                        isCreatingOrder ? "opacity-70 cursor-not-allowed" : "hover:bg-zinc-800 active:scale-[0.98]"
                      )}
                    >
                      {isCreatingOrder ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Criando Pedido...
                        </>
                      ) : (
                        "Criar Pedido"
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





