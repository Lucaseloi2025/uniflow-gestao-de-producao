import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export const PhotoLightbox = ({
  selectedFullImage,
  setSelectedFullImage
}: any) => {
  return (
        {/* Photo Lightbox */}

        />
          currentUser={currentUser}
          fetchData={fetchData}
          stages={stages}
          setTemplateFormStages={setTemplateFormStages}
          templateFormStages={templateFormStages}
          setIsSubmitting={setIsSubmitting}
          isSubmitting={isSubmitting}
          editingTemplate={editingTemplate}
          setIsTemplateEditorOpen={setIsTemplateEditorOpen}
          isTemplateEditorOpen={isTemplateEditorOpen}
        <TemplateEditorModal
        {/* Template Editor Modal */}

        />
          currentUser={currentUser}
          setIsSubmitting={setIsSubmitting}
          isSubmitting={isSubmitting}
          fetchUsers={fetchUsers}
          selectedUserForEdit={selectedUserForEdit}
          setShowUserModal={setShowUserModal}
          showUserModal={showUserModal}
        <UserModal
        {/* User Modal (Collaborators) */}

        />
          applyTemplate={applyTemplate}
          setIsTemplateEditorOpen={setIsTemplateEditorOpen}
          setTemplateFormStages={setTemplateFormStages}
          setEditingTemplate={setEditingTemplate}
          templates={templates}
          currentUser={currentUser}
          setNewOrderRequiredStages={setNewOrderRequiredStages}
          newOrderRequiredStages={newOrderRequiredStages}
          stages={stages}
          fetchData={fetchData}
          setNewOrderForm={setNewOrderForm}
          newOrderForm={newOrderForm}
          setIsCreatingOrder={setIsCreatingOrder}
          isCreatingOrder={isCreatingOrder}
          setShowNewOrderModal={setShowNewOrderModal}
          showNewOrderModal={showNewOrderModal}
        <NewOrderModal
        {/* New Order Modal (Simplified for MVP) */}

        </AnimatePresence>
          )}
            </div>
              </motion.div>
                  </div>
                    </div>
                      </div>
                        </div>
                          )}
                            </div>
                              <p className="text-[10px] font-bold uppercase tracking-widest">Sem arquivos</p>
                              <ImageIcon size={32} className="opacity-20" />
                            <div className="flex flex-col items-center justify-center py-16 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200 text-zinc-400 gap-3">
                          ) : (
                            </div>
                              ))}
                                </div>
                                  </div>
                                    <Search size={14} /> AMPLIAR
                                  <div className="absolute inset-0 bg-zinc-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-[10px] gap-2">
                                  )}
                                    </div>
                                      <span className="text-[10px] uppercase font-bold text-zinc-500">Arquivo</span>
                                      <FileText size={24} />
                                    <div className="flex flex-col items-center gap-2 text-zinc-400">
                                  ) : (
                                    </div>
                                      <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Documento PDF</span>
                                      </div>
                                        <FileText size={24} />
                                      <div className="p-3 bg-rose-50 rounded-full border border-rose-100">
                                    <div className="flex flex-col items-center gap-2 text-rose-500">
                                  ) : isPdf(url) ? (
                                    />
                                      referrerPolicy="no-referrer"
                                      className="max-w-full max-h-full object-contain"
                                      alt={`Ficha ${i + 1}`}
                                      src={url}
                                    <img
                                  {isImage(url) ? (
                                >
                                  className="group relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 aspect-video flex items-center justify-center cursor-pointer hover:border-zinc-900 transition-all"
                                  }}
                                    }
                                      window.open(url, '_blank');
                                    } else {
                                      setSelectedFullImage(url);
                                    if (isImage(url)) {
                                  onClick={() => {
                                  key={i}
                                <div
                              {selectedOrder.art_urls.map((url, i) => (
                            <div className="grid grid-cols-1 gap-4">
                          {selectedOrder.art_urls && selectedOrder.art_urls.length > 0 ? (
                        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-4">

                        </div>
                          </label>
                            />
                              }}
                                if (e.target.files) handleAddImages(selectedOrder.id, e.target.files);
                              onChange={(e) => {
                              disabled={isUploadingArt}
                              className="hidden"
                              multiple
                              type="file"
                            <input
                            <span>{isUploadingArt ? '...' : 'Adicionar'}</span>
                            )}
                                <Plus size={12} />
                            ) : (
                              <RefreshCw size={12} className="animate-spin" />
                            {isUploadingArt ? (
                          )}>
                            isUploadingArt && "opacity-50 cursor-not-allowed"
                            "flex items-center gap-1.5 px-2 py-1 bg-zinc-900 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-zinc-800 transition-all cursor-pointer shadow-sm active:scale-95",
                          <label className={cn(
                          </h3>
                            <ImageIcon size={16} className="text-sky-500" /> FICHAS E ARQUIVOS
                          <h3 className="text-xs font-black text-zinc-900 flex items-center gap-2">
                        <div className="flex items-center justify-between">
                      <div className="lg:col-span-3 space-y-4 flex flex-col h-full">
                      {/* Right Column: Files & Attachments */}

                          </div>
                            </div>
                              })()}
                                });
                                  );
                                    </div>
                                      )}
                                        </div>
                                          </div>
                                            )}
                                              </button>
                                                RETOMAR <kbd className="ml-2 px-1.5 py-0.5 bg-zinc-900 text-white rounded text-[8px] font-mono shadow-sm">1</kbd>
                                                <Play size={12} fill="currentColor" />
                                              >
                                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition-all font-bold text-[10px]"
                                                onClick={() => handleResumeStage(execution.id)}
                                              <button
                                            {execution?.status === 'Pausado' && (

                                            )}
                                              </>
                                                </button>
                                                  FINALIZAR <kbd className="ml-1.5 px-1.5 py-0.5 bg-emerald-800 text-white rounded text-[8px] font-mono shadow-sm">3</kbd>
                                                  <CheckCircle size={12} />
                                                >
                                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-all font-bold text-[10px]"
                                                  onClick={() => handleFinishStage(execution.id, stage.id)}
                                                <button
                                                </button>
                                                  PAUSAR <kbd className="ml-1.5 px-1.5 py-0.5 bg-zinc-600 text-white rounded text-[8px] font-mono shadow-sm">2</kbd>
                                                  <Pause size={12} fill="currentColor" />
                                                >
                                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-white text-zinc-600 rounded-md hover:bg-zinc-50 transition-all font-bold text-[10px] border border-zinc-200"
                                                  onClick={() => handlePauseStage(execution.id, stage.id)}
                                                <button
                                              <>
                                            {execution?.status === 'Em andamento' && (

                                            )}
                                              </button>
                                                INICIAR {isSelected && <kbd className="ml-2 px-1.5 py-0.5 bg-zinc-900 text-white rounded text-[8px] font-mono shadow-sm">1</kbd>}
                                                <Play size={12} fill="currentColor" />
                                              >
                                                )}
                                                    : "bg-zinc-50 text-zinc-300 cursor-not-allowed border border-zinc-100"
                                                    ? "bg-zinc-900 text-white hover:bg-zinc-800" 
                                                  isNextToStart 
                                                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all font-bold text-[10px]",
                                                className={cn(
                                                onClick={() => handleStartStage(stage.id)}
                                              <button
                                            {!execution && (
                                          <div className="flex items-center gap-1.5">

                                        <div className="mt-2 space-y-1.5">
                                      {!orderStage.finished && (

                                      )}
                                        </div>
                                          </div>
                                            ) : null}
                                              </span>
                                                Reposição pendente: +{orderStage.pendencia_reposicao} pc
                                              <span className="bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-bold animate-pulse">
                                            {orderStage.pendencia_reposicao ? (
                                            ) : <span />}
                                              </span>
                                                Perdas: {orderStage.quantidade_perdida} pc
                                              <span className="bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded font-bold">
                                            {orderStage.quantidade_perdida ? (
                                          <div className="flex flex-wrap items-center justify-between gap-1 text-[9px] pt-1">
                                          </div>
                                            />
                                              style={{ width: `${Math.min(100, Math.round(((orderStage.quantidade_boa || 0) / (orderStage.quantidade_pedido || selectedOrder.quantity || 1)) * 100))}%` }}
                                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                            <div
                                          <div className="w-full bg-zinc-200 rounded-full h-1.5 overflow-hidden">
                                          </div>
                                            </span>
                                              {orderStage.quantidade_boa || 0} / {orderStage.quantidade_pedido || selectedOrder.quantity}
                                            <span className="font-mono text-emerald-700">
                                            <span>Progresso de peças:</span>
                                          <div className="flex items-center justify-between text-zinc-700 font-bold">
                                        <div className="mt-2 text-[10px] space-y-1 bg-zinc-50/80 p-2 rounded-md border border-zinc-100">
                                      {stage.calculation_type !== 'por_pedido' && (

                                      </div>
                                        )}
                                          </div>
                                            Pausado ({formatSeconds(stageTimes.totalAccumulatedSeconds)})
                                          <div className="shrink-0 py-0.5 px-1.5 border border-amber-200 bg-amber-50 rounded-md text-amber-700 font-mono text-[10px] font-bold">
                                        {execution?.status === 'Pausado' && stageTimes && (

                                        )}
                                          </div>
                                            <span>Sessão: {formatSeconds(stageTimes.currentSessionSeconds)}</span>
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                          <div className="shrink-0 py-0.5 px-2 border border-emerald-200 bg-emerald-50 rounded-md text-emerald-700 font-mono text-[10px] font-bold flex items-center gap-1 shadow-xs">
                                        {execution?.status === 'Em andamento' && stageTimes && (
                                        
                                        </div>
                                          </div>
                                             })()}
                                               );
                                                 </div>
                                                   ))}
                                                     </div>
                                                       <p className="italic">"{obs.observation}"</p>
                                                       </div>
                                                         <span>{safeFormat(obs.created_at, 'dd/MM HH:mm')}</span>
                                                         <span>{obs.user_name || 'Operador'}</span>
                                                       <div className="flex items-center justify-between text-[7px] text-zinc-400 font-bold mb-0.5">
                                                     <div key={oIdx} className="border-t border-zinc-200/50 first:border-t-0 pt-0.5 first:pt-0">
                                                   {stageObs.map((obs: any, oIdx: number) => (
                                                 <div className="mt-1 p-1.5 bg-zinc-50 border border-zinc-100 rounded text-[9px] text-zinc-600 leading-normal max-w-xs space-y-1">
                                               return (
                                               if (stageObs.length === 0) return null;
                                               const stageObs = orderStageObservations.filter((o: any) => o.stage_id === stage.id);
                                            {(() => {
                                            )}
                                              </p>
                                                <span className="font-mono text-zinc-500">Total: {formatSeconds(stageTimes.totalAccumulatedSeconds)}</span>
                                                <span className="opacity-30 mx-1">•</span>
                                                <span className="uppercase font-bold text-zinc-600">{execution.user_name}</span>
                                              <p className="text-[9px] text-zinc-400 truncate font-medium">
                                            {execution && stageTimes && (
                                            </p>
                                              {stage.name}
                                            )}>
                                              orderStage.finished ? "text-zinc-500" : "text-zinc-900"
                                              "font-bold text-xs truncate",
                                            <p className={cn(
                                          <div className="min-w-0">
                                          </div>
                                            {orderStage.finished ? <CheckCircle2 size={14} /> : stage.sort_order}
                                          )}>
                                            orderStage.finished ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"
                                            "w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-[10px] font-bold transition-colors",
                                          <div className={cn(
                                        <div className="flex items-center gap-2.5 overflow-hidden">
                                      <div className="flex items-center justify-between gap-2">
                                    >
                                      )}
                                        orderStage.finished ? "bg-zinc-50/50 border-zinc-100" : "bg-white border-zinc-100"
                                        execution?.status === 'Pausado' ? "bg-amber-50/30 border-amber-100" :
                                        execution?.status === 'Em andamento' ? "bg-white border-zinc-900 shadow-md ring-1 ring-zinc-900" :
                                        isSelected ? "ring-2 ring-sky-500 bg-sky-50/20 border-sky-200" :
                                        "p-3 rounded-lg border transition-all duration-200 cursor-pointer",
                                      className={cn(
                                      onClick={() => setSelectedStageId(stage.id)}
                                    <div key={stage.id} 
                                  return (

                                  const isNextToStart = !execution && stage.id === firstUnfinishedId;
                                  const isSelected = selectedStageId === stage.id;
                                  const stageTimes = execution ? calculateExecutionTimes(execution, execution.pauses || [], now.getTime()) : null;
                                  const execution = executions.find(e => e.stage_id === stage.id);
                                  if (!stage) return null;
                                  const stage = stages.find(s => s.id === orderStage.id);
                                return stagesStatusList.map(orderStage => {
                                const firstUnfinishedId = stagesStatusList.find(s => !s.finished)?.id;
                                const stagesStatusList = selectedOrder.stages_status || [];
                              {(() => {
                            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-3">

                            </h3>
                              })()}
                                );
                                  </Badge>
                                    {stagesStatusList.filter(s => s.finished).length}/{stagesStatusList.length}
                                  <Badge variant="info" className="text-[8px] py-0 px-1.5">
                                return (
                                const stagesStatusList = selectedOrder.stages_status || [];
                              {(() => {
                              </div>
                                <Layers size={16} className="text-sky-500" /> FLUXO DE PRODUÇÃO
                              <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black text-zinc-900 flex items-center justify-between">
                          <div className="lg:col-span-4 space-y-4 flex flex-col h-full border-x lg:border-zinc-100 px-4">
                          {/* Middle Column: Stage Management */}

                          </div>
                            )}
                              </div>
                                <p className="text-[9px] font-bold uppercase tracking-tight">ALERTA: Tempo real +20% acima do esperado.</p>
                                <AlertCircle size={16} />
                              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-700">
                            {activeOrderTotalTime > selectedOrder.estimated_time_seconds * 1.2 && (
                            
                            )}
                              </section>
                                </div>
                                  "{selectedOrder.observations}"
                                <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-xs font-medium text-amber-900 leading-relaxed italic">
                                </h3>
                                  <ClipboardList size={12} /> OBSERVAÇÕES
                                <h3 className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                              <section>
                            {selectedOrder.observations && (

                            <ProductionProgressPanel orderId={selectedOrder.id} />
                            {/* Andamento Produtivo (PCP ProComfort) */}

                            )}
                              </div>
                                })()}
                                  );
                                    </section>
                                      </div>
                                        <span>Estes itens não possuem saldo suficiente no estoque do Olist ERP e precisarão passar obrigatoriamente pela etapa de <strong>Corte</strong>.</span>
                                        <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                                      <div className="text-[10px] text-amber-900 font-medium bg-amber-100/60 p-2.5 rounded-xl flex items-center gap-2 border border-amber-200/60">

                                      </div>
                                        </table>
                                          </tbody>
                                            })}
                                              );
                                                </tr>
                                                  </td>
                                                    </span>
                                                      {corteQty} un
                                                    <span className="inline-block px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-sm font-black font-mono">
                                                  <td className="px-3 py-2.5 text-right">
                                                  <td className="px-3 py-2.5 text-center font-mono text-xs font-bold text-zinc-700">{stockAvail > 0 ? `${stockAvail} un` : '0 un (Sem Estoque)'}</td>
                                                  </td>
                                                    </span>
                                                      {displaySize}
                                                    <span className="inline-block px-3 py-1 bg-amber-500 text-amber-950 rounded-lg text-sm font-black uppercase font-mono shadow-xs border border-amber-600 tracking-wider">
                                                  <td className="px-3 py-2.5 text-center">
                                                  <td className="px-3 py-2.5 font-bold text-zinc-900">{item.description || item.descricao || 'Item sem descrição'}</td>
                                                <tr key={idx} className="hover:bg-amber-50/50 text-xs">
                                              return (
                                              const displaySize = getItemDisplaySize(item);
                                              const stockAvail = item.stock_available ?? 0;
                                              const corteQty = item.qty_corte ?? item.total_via_corte ?? 1;
                                            {cuttingItems.map((item, idx) => {
                                          <tbody className="divide-y divide-amber-100/60">
                                          </thead>
                                            </tr>
                                              <th className="px-3 py-2.5 text-right">Qtd a Cortar</th>
                                              <th className="px-3 py-2.5 text-center">Estoque Olist</th>
                                              <th className="px-3 py-2.5 text-center">Tamanho</th>
                                              <th className="px-3 py-2.5">Item a Cortar</th>
                                            <tr className="bg-amber-100/70 text-amber-950 font-bold uppercase text-[9px] border-b border-amber-200">
                                          <thead>
                                        <table className="w-full text-left text-xs">
                                      <div className="overflow-x-auto border border-amber-200/70 rounded-xl bg-white shadow-sm">

                                      </div>
                                        </span>
                                          {totalCuttingQty} {totalCuttingQty === 1 ? 'PEÇA A CORTAR' : 'PEÇAS A CORTAR'}
                                        <span className="px-2.5 py-1 bg-amber-200 text-amber-950 rounded-full text-xs font-black font-mono uppercase border border-amber-300">
                                        </h4>
                                          <Scissors size={13} className="text-amber-600 animate-pulse" /> RESUMO DE PEÇAS PARA CORTE (FALTA EM ESTOQUE OLIST)
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-950 flex items-center gap-1.5">
                                      <div className="flex items-center justify-between">
                                    <section className="p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl shadow-sm space-y-3">
                                  return (

                                  const totalCuttingQty = cuttingItems.reduce((sum, it) => sum + (it.qty_corte ?? it.total_via_corte ?? 1), 0);

                                  if (cuttingItems.length === 0) return null;

                                  });
                                    return corteQty > 0;
                                    const corteQty = it.qty_corte ?? it.total_via_corte ?? (it.stock_available !== undefined && it.stock_available !== null ? Math.max(0, qtyPedida - Math.min(qtyPedida, it.stock_available)) : 0);
                                    const qtyPedida = it.quantity ?? it.quantidade ?? 1;
                                  const cuttingItems = selectedOrder.items.filter(it => {
                                {(() => {
                                {/* Resumo de Peças para Corte (Abaixo da Lista do Pedido) */}

                                </section>
                                  </div>
                                    </table>
                                      </tbody>
                                        })}
                                          );
                                            </tr>
                                              </td>
                                                )}
                                                  </span>
                                                    <CheckCircle2 size={11} className="text-emerald-600" /> 0 un (Estoque)
                                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-900 rounded-lg text-xs font-bold font-mono">
                                                ) : (
                                                  </span>
                                                    <Scissors size={11} className="text-white" /> {corteQty} un (FALTA)
                                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-black font-mono shadow-xs">
                                                {corteQty > 0 ? (
                                              <td className="px-3 py-2.5 text-center">
                                              <td className="px-3 py-2.5 text-right font-mono text-sm font-black text-zinc-900">{qty} un</td>
                                              </td>
                                                </span>
                                                  {displaySize}
                                                <span className="inline-block px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm font-black uppercase font-mono shadow-xs border border-indigo-700 tracking-wider">
                                              <td className="px-3 py-2.5 text-center">
                                              <td className="px-3 py-2.5 font-bold text-zinc-900">{item.description || item.descricao || 'Item sem descrição'}</td>
                                            <tr key={idx} className="hover:bg-indigo-50/40 text-xs">
                                          return (
                                          const displaySize = getItemDisplaySize(item);
                                          const corteQty = item.qty_corte ?? item.total_via_corte ?? (item.stock_available !== undefined && item.stock_available !== null ? Math.max(0, qty - Math.min(qty, item.stock_available)) : 0);
                                          const qty = item.quantity ?? item.quantidade ?? 1;
                                        {selectedOrder.items.map((item, idx) => {
                                      <tbody className="divide-y divide-indigo-50">
                                      </thead>
                                        </tr>
                                          <th className="px-3 py-2.5 text-center">Falta (Corte)</th>
                                          <th className="px-3 py-2.5 text-right">Qtd Total</th>
                                          <th className="px-3 py-2.5 text-center">Tamanho</th>
                                          <th className="px-3 py-2.5">Item / Descrição</th>
                                        <tr className="bg-indigo-100/60 text-indigo-950 font-bold uppercase text-[9px] border-b border-indigo-100">
                                      <thead>
                                    <table className="w-full text-left text-xs">
                                  <div className="overflow-x-auto border border-indigo-100 rounded-xl bg-white shadow-sm">
                                  </div>
                                    <span className="text-[10px] font-bold text-indigo-600 font-mono">{selectedOrder.items.length} SKUs</span>
                                    </h4>
                                      <Package size={13} className="text-indigo-600" /> LISTA DE ITENS DO PEDIDO
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-900 flex items-center gap-1.5">
                                  <div className="flex items-center justify-between">
                                <section className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl shadow-sm space-y-2">
                              <div className="space-y-4">
                            {selectedOrder.items && selectedOrder.items.length > 0 && (

                            </section>
                              </div>
                                </div>
                                  </Badge>
                                    {selectedOrder.print_type}
                                  <Badge variant="info" className="text-[10px] px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-100">
                                  <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Estampa</span>
                                <div className="col-span-2 pt-2 border-t border-zinc-50">
                                </div>
                                  <span className="text-xs font-bold text-zinc-900">{selectedOrder.quantity} <span className="text-zinc-500 font-medium text-[10px]">pçs</span></span>
                                  <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-0.5">Quantidade</span>
                                <div>
                                </div>
                                  <span className="text-xs font-bold text-zinc-900">{selectedOrder.product_type}</span>
                                  <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-0.5">Produto</span>
                                <div>
                              <div className="grid grid-cols-2 gap-4">
                              <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3">DETALHES DE PRODUÇÃO</h4>
                            <section className="p-4 sm:p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm">
                            </section>
                              </div>
                                </div>
                                  )}
                                    <p className="text-base font-bold">{safeFormat(selectedOrder.deadline, 'dd/MM/yyyy')}</p>
                                  ) : (
                                    />
                                      className="text-base font-bold bg-transparent border-none focus:ring-0 p-0 w-full cursor-pointer hover:text-zinc-600"
                                      onChange={(e) => handleUpdateDeadline(selectedOrder.id, e.target.value)}
                                      defaultValue={selectedOrder.deadline.split('T')[0]}
                                      type="date"
                                    <input
                                  {(currentUser.role === 'Admin' || currentUser.role === 'Comercial') ? (
                                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Prazo Entrega</p>
                                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 shadow-sm col-span-2">
                                </div>
                                  <p className="text-base font-mono font-bold text-zinc-500">{formatSeconds(selectedOrder.estimated_time_seconds)}</p>
                                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Estimado</p>
                                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 shadow-sm">
                                </div>
                                  <p className="text-base font-mono font-bold">{formatSeconds(activeOrderTotalTime)}</p>
                                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Tempo Total</p>
                                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 shadow-sm">
                              <div className="grid grid-cols-2 gap-3">
                              </h3>
                                <Package size={14} /> INFORMAÇÕES GERAIS
                              <h3 className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                            <section>
                          <div className="lg:col-span-5 space-y-4 overflow-y-auto pr-1 custom-scrollbar">
                          {/* Left Column: Order Information & Production Items */}
                          
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 h-full">
                  <div className="p-4 sm:p-5 lg:p-6 max-w-full mx-auto h-[calc(100vh-64px)] overflow-hidden">
                  </div>
                    </div>
                      )}
                        </span>
                          🎨 {selectedOrder.num_colors} {selectedOrder.num_colors === 1 ? 'Cor' : 'Cores'}
                        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      {(selectedOrder.print_type === 'Silk' || selectedOrder.print_type === 'Sublimação') && selectedOrder.num_colors && (
                      </Badge>
                        {selectedOrder.status}
                      } className="text-[9px] py-0.5 px-2">
                          selectedOrder.status === 'Cancelado' ? 'error' : 'info'
                      selectedOrder.status === 'Entregue' ? 'success' :
                      <Badge variant={
                      )}
                        </button>
                          <span className="hidden xl:inline">Excluir</span>
                          {isDeletingOrder ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        >
                          )}
                            isDeletingOrder && "opacity-50 cursor-not-allowed"
                            "flex items-center gap-1 px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all font-bold text-xs",
                          className={cn(
                          disabled={isDeletingOrder}
                          onClick={() => handleDeleteOrder(selectedOrder.id)}
                        <button
                      {(currentUser?.role === 'Admin' || currentUser?.role === 'Comercial') && (
                      </button>
                        <span className="hidden xl:inline">Histórico</span>
                        <FileText size={13} />
                      >
                        className="flex items-center gap-1 px-2 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg transition-all font-bold text-xs"
                        onClick={() => handleViewHistory(selectedOrder.id)}
                      <button
                      )}
                        </button>
                          <span className="xl:hidden">Link</span>
                          <span className="hidden xl:inline">Link Cliente</span>
                          {isGeneratingLink ? <RefreshCw size={13} className="animate-spin" /> : <LinkIcon size={13} />}
                        >
                          title="Gerar e copiar link de acompanhamento do cliente"
                          className="flex items-center gap-1 px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-all font-bold text-xs active:scale-95"
                          disabled={isGeneratingLink}
                          onClick={() => handleGenerateTrackingLink(selectedOrder)}
                        <button
                      {selectedOrder.status !== 'Cancelado' && (
                      )}
                        </>
                          </button>
                            <span className="hidden xl:inline">Cancelar</span>
                            {isCancellingOrder ? <RefreshCw size={13} className="animate-spin" /> : <X size={13} />}
                          >
                            )}
                              isCancellingOrder && "opacity-50 cursor-not-allowed"
                              "flex items-center gap-1 px-2 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg transition-all font-bold text-xs",
                            className={cn(
                            disabled={isCancellingOrder}
                            onClick={() => handleCancelOrder(selectedOrder.id)}
                          <button
                          </button>
                            <span className="hidden xl:inline">Editar</span>
                            <Edit2 size={13} />
                          >
                            title="Editar"
                            className="flex items-center gap-1 px-2 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg transition-all font-bold text-xs"
                            onClick={() => openEditOrderModal(selectedOrder)}
                          <button
                        <>
                      {((currentUser?.role === 'Admin' || currentUser?.role === 'Comercial') && selectedOrder.status !== 'Cancelado') && (

                      </div>
                        />
                          className="pl-7 pr-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 bg-white hover:bg-zinc-50 text-zinc-800 placeholder:text-zinc-400 w-36 shadow-sm transition-all font-medium"
                          }}
                            }
                              (e.target as HTMLInputElement).blur();
                            if (e.key === 'Enter') {
                          onKeyDown={(e) => {
                          }}
                            }
                              handleUpdateDtfLocation(selectedOrder.id, val);
                            if (val !== (selectedOrder.dtf_location || '')) {
                            const val = e.target.value.trim();
                          onBlur={(e) => {
                          key={`modal-dtf-loc-header-${selectedOrder.id}-${selectedOrder.dtf_location || ''}`}
                          defaultValue={selectedOrder.dtf_location || ''}
                          placeholder="Gaveta / Obs..."
                          type="text"
                        <input
                        <Archive size={13} className="absolute left-2.5 text-zinc-400 pointer-events-none" />
                      <div className="relative flex items-center" title="Gaveteiro / Obs Interna">

                      )}
                        </div>
                          )}
                            </button>
                              )}
                                </>
                                  <span>DTF Pendente</span>
                                  <Timer size={13} className="text-amber-500" />
                                <>
                              ) : (
                                </>
                                  <span>DTF Pronto</span>
                                  <CheckCircle size={13} className="stroke-[3] text-emerald-600" />
                                <>
                              {selectedOrder.dtf_complete ? (
                            >
                              title="Checklist da Designer (DTF Feito)"
                              )}
                                  : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                selectedOrder.dtf_complete
                                "px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm",
                              className={cn(
                              onClick={(e) => handleRequestToggleDtf(selectedOrder.id, e)}
                            <button
                          ) : (
                            </div>
                              </button>
                                <X size={12} className="stroke-[2]" />
                              >
                                title="Cancelar"
                                className="p-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-600 rounded text-xs cursor-pointer shadow-sm flex items-center justify-center w-5 h-5 transition-all active:scale-95"
                                }}
                                  setConfirmingDtfOrderId(null);
                                  if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
                                onClick={() => {
                              <button
                              </button>
                                <Check size={12} className="stroke-[3]" />
                              >
                                title="Confirmar"
                                className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs cursor-pointer shadow-sm flex items-center justify-center w-5 h-5 transition-all active:scale-95"
                                }}
                                  handleToggleDtf(selectedOrder.id, selectedOrder.dtf_complete || false);
                                  setConfirmingDtfOrderId(null);
                                  if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
                                onClick={() => {
                              <button
                              <span className="text-[10px] font-bold text-zinc-500 px-1 animate-pulse">Confirmar?</span>
                            <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg p-1 shadow-sm">
                          {confirmingDtfOrderId === selectedOrder.id ? (
                        <div className="flex items-center gap-1">
                      {selectedOrder.print_type === 'DTF' && (
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    </div>
                      </div>
                        <p className="text-[10px] text-zinc-500 font-mono">{selectedOrder.order_number}</p>
                        <h2 className="text-xl font-black tracking-tight text-zinc-900 leading-tight">{selectedOrder.client_name}</h2>
                      <div>
                      <div className="h-6 w-[1px] bg-zinc-200 hidden sm:block" />
                      </button>
                        Voltar <kbd className="ml-1 px-1 py-0.5 text-[9px] font-mono bg-zinc-200 border border-zinc-300 rounded text-zinc-500 font-normal">Esc</kbd>
                        <ArrowLeft size={16} />
                      >
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-all font-bold text-xs active:scale-95"
                        onClick={() => setSelectedOrder(null)}
                      <button
                    <div className="flex items-center gap-4">
                  <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-3 sm:p-4 border-b border-zinc-100 flex justify-between items-center px-4 sm:px-6 lg:px-8">
                >
                  className="bg-white w-full h-full shadow-2xl overflow-y-auto"
                  exit={{ x: '100%' }}
                  animate={{ x: 0 }}
                  initial={{ x: '100%' }}
                <motion.div
              <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm">
            selectedOrder && (
          {
        <AnimatePresence>
        {/* Order Details Drawer */}

        }
        )
          </div>
            </Card>
              </div>
                </button>
                  Zerar Relatórios e Tempos
                >
                  className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all duration-200 shadow-sm shadow-rose-100 hover:shadow active:scale-98 whitespace-nowrap self-start md:self-center pointer-events-auto"
                  }}
                    }
                      alert("❌ Erro de rede ou servidor ao realizar a limpeza.");
                      console.error("Erro ao resetar:", err);
                    } catch (err: any) {
                      }
                        alert("❌ Falha ao zerar relatórios: " + (data.error || "Erro desconhecido"));
                      } else {
                        fetchData(); // Recarrega todas as informações
                        alert("✅ " + data.message);
                      if (res.ok && data.success) {
                      const data = await res.json();

                      });
                        }
                          'x-user-name': currentUser?.name || 'Admin'
                          'x-user-role': currentUser?.role || '',
                          'Content-Type': 'application/json',
                        headers: {
                        method: 'POST',
                      const res = await fetch('/api/admin/reset-production', {
                    try {

                    }
                      return;
                      }
                        alert("Operação cancelada. A confirmação não foi digitada corretamente.");
                      if (promptVal !== null) {
                    if (promptVal !== "CONFIRMAR") {
                    const promptVal = prompt("⚠️ AVISO CRÍTICO: Isto irá zerar todas as estatísticas de relatórios operacionais e produtividade dos colaboradores permanentemente.\n\nPara prosseguir, digite \"CONFIRMAR\" abaixo:");
                  onClick={async () => {
                  type="button"
                <button
                </div>
                  </p>
                    Os pedidos, clientes e configurações <strong>não serão excluídos</strong>, mas todas as métricas de relatórios e produtividade voltarão a zero.
                    Apaga permanentemente todos os registros de tempos operacionais e pausas (<code className="bg-zinc-100 text-zinc-600 px-1 py-0.5 rounded text-[10px] font-mono">stage_executions</code> e <code className="bg-zinc-100 text-zinc-600 px-1 py-0.5 rounded text-[10px] font-mono">pauses</code>). 
                  <p className="text-xs text-zinc-500 max-w-xl leading-relaxed">
                  <h4 className="font-bold text-sm text-zinc-900">Zerar Relatórios & Histórico de Produção</h4>
                <div className="space-y-1">
              <div className="p-5 bg-white border border-rose-200/50 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-sm transition-all duration-200">
              
              </p>
                Estas ações são irreversíveis e afetam permanentemente os dados do sistema. Certifique-se do que está fazendo.
              <p className="text-xs text-zinc-500 mb-6">
              </h3>
                Zona de Perigo: Ações Críticas
                <AlertTriangle size={20} className="text-rose-600" />
              <h3 className="text-lg font-bold text-rose-900 mb-2 flex items-center gap-2">
            <Card className="p-8 border border-rose-100 bg-rose-50/10">

            </Card>
              </div>
                ))}
                  </div>
                    </div>
                      ))}
                        </span>
                          {s.name}
                        <span key={s.id} className="px-2 py-0.5 bg-zinc-200 text-zinc-600 rounded text-[9px] font-bold">
                      {stages.filter(s => template.required_stages?.includes(s.id)).map(s => (
                    <div className="flex flex-wrap gap-1">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Etapas Inclusas:</div>
                    </div>
                      <Badge variant="info">{template.print_type}</Badge>
                      <Badge variant="default">{template.product_type}</Badge>
                    <div className="flex flex-wrap gap-2 mb-3">
                    </div>
                      )}
                        </div>
                          </button>
                            <Trash2 size={14} />
                          >
                            className="p-1.5 hover:bg-rose-100 rounded text-rose-500"
                            }}
                              }
                                fetchData();
                                });
                                  headers: { 'x-user-role': currentUser?.role || '' }
                                  method: 'DELETE',
                                await fetch(`/api/order-templates/${template.id}`, {
                              if (confirm(`Excluir template "${template.name}"?`)) {
                            onClick={async () => {
                          <button
                          </button>
                            <Edit2 size={14} />
                          >
                            className="p-1.5 hover:bg-zinc-200 rounded text-zinc-500"
                            }}
                              setIsTemplateEditorOpen(true);
                              setTemplateFormStages(template.required_stages || []);
                              setEditingTemplate(template);
                            onClick={() => {
                          <button
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {currentUser?.role === 'Admin' && (
                      <h4 className="font-bold text-sm text-zinc-900">{template.name}</h4>
                    <div className="flex justify-between items-start mb-2">
                  <div key={template.id} className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl hover:border-zinc-300 transition-all group">
                {templates.map((template) => (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              </div>
                )}
                  </button>
                    <Plus size={16} /> Novo Template
                  >
                    className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2"
                    }}
                      setIsTemplateEditorOpen(true);
                      setTemplateFormStages(stages.filter(s => s.active).map(s => s.id));
                      setEditingTemplate(null);
                    onClick={() => {
                  <button
                {currentUser?.role === 'Admin' && (
                </h3>
                  Gerenciar Templates de Pedido
                  <ClipboardList size={20} />
                <h3 className="text-lg font-bold flex items-center gap-2">
              <div className="flex justify-between items-center mb-6">
            <Card className="p-8">

            </Card>
              </button>
                Salvar Mapeamento de Perdas
              >
                className="mt-6 px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-colors"
                onClick={() => handleSaveLossReasonsMapping(lossReasonsList)}
                type="button"
              <button
              </div>
                ))}
                  </div>
                    </div>
                      </select>
                        ))}
                          <option key={st.id} value={st.id}>{st.name}</option>
                        {stages.map(st => (
                      >
                        className="p-2 border border-zinc-200 rounded-lg text-xs bg-white font-medium focus:outline-none focus:border-zinc-400"
                        }}
                          setLossReasonsList(updated);
                          const updated = lossReasonsList.map((r, i) => i === idx ? { ...r, etapa_reentrada_id: newId } : r);
                          const newId = Number(e.target.value);
                        onChange={(e) => {
                        value={reason.etapa_reentrada_id}
                      <select
                      <span className="text-xs text-zinc-500 font-medium">Reentra em:</span>
                    <div className="flex items-center gap-2">
                    </div>
                      <span className="font-bold text-xs text-zinc-900">{reason.motivo}</span>
                    <div className="flex-1">
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl gap-3">
                {lossReasonsList.map((reason, idx) => (
              <div className="space-y-3">
              </p>
                Configure para qual etapa a peça de reposição reentra automaticamente no fluxo quando um operador registra uma perda.
              <p className="text-xs text-zinc-500 mb-6">
              </h3>
                Mapeamento de Motivos de Perda & Etapa de Reentrada Padrão
                <AlertCircle size={20} className="text-rose-600" />
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
            <Card className="p-8">
            {/* Mapeamento de Motivos de Perda & Etapa de Reentrada */}

            </Card>
              </div>
                </div>
                  ))}
                    </div>
                      )}
                        </div>
                          })}
                            );
                              </div>
                                </div>
                                  )}
                                    >Remover</button>
                                      className="px-2 py-1 bg-rose-50 text-rose-600 rounded text-[10px] font-bold hover:bg-rose-100 transition-colors"
                                      }}
                                        fetchCollaboratorGoals();
                                        });
                                          headers: { 'x-user-role': currentUser?.role || '' }
                                          method: 'DELETE',
                                        await fetch(`/api/collaborator-goals/${override.id}`, {
                                        if (!override.id) return;
                                      onClick={async () => {
                                    <button
                                  {override && (
                                  >Salvar</button>
                                    className="px-2 py-1 bg-zinc-900 text-white rounded text-[10px] font-bold hover:bg-zinc-700 transition-colors"
                                    }}
                                      fetchCollaboratorGoals();
                                      setGoalEditValues(v => { const n = { ...v }; delete n[key]; return n; });
                                      });
                                        body: JSON.stringify({ user_id: user.id, stage_id: stage.id, meta_diaria: Number(editVal) })
                                        headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role || '' },
                                        method: 'POST',
                                      await fetch('/api/collaborator-goals', {
                                      if (!editVal) return;
                                    onClick={async () => {
                                  <button
                                  />
                                    className="w-20 p-1 border border-zinc-200 rounded text-xs text-center"
                                    placeholder={String(override?.meta_diaria ?? stage.meta_diaria ?? '')}
                                    onChange={e => setGoalEditValues(v => ({ ...v, [key]: e.target.value }))}
                                    value={editVal}
                                    type="number"
                                  <input
                                <div className="flex items-center gap-2 ml-auto">
                                )}
                                  <span className="text-[10px] text-zinc-400">Usa padrão do setor ({stage.meta_diaria ?? '—'})</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">Meta personalizada: {override.meta_diaria}</span>
                                {override ? (
                                <span className="text-sm font-medium text-zinc-700 w-40 truncate">{user.name}</span>
                              <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-50/50 border border-zinc-100">
                            return (
                            const editVal = goalEditValues[key] ?? '';
                            const key = `${stage.id}-${user.id}`;
                            const override = collaboratorGoals.find(g => g.user_id === user.id && g.stage_id === stage.id);
                          {users.filter(u => u.active).map(user => {
                        <div className="p-4 space-y-2">
                      {expandedGoalStageId === stage.id && (
                      </button>
                        <ChevronRight size={14} className={cn('text-zinc-400 transition-transform', expandedGoalStageId === stage.id && 'rotate-90')} />
                        </span>
                          </span>
                            Meta padrão: {stage.meta_diaria ?? '—'} {stage.calculation_type === 'por_pedido' ? 'pedidos' : 'peças'}/dia
                          <span className="text-[10px] text-zinc-400 font-mono">
                          {stage.name}
                        <span className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                      >
                        className="w-full flex items-center justify-between p-3 bg-zinc-50 hover:bg-zinc-100 transition-colors text-left"
                        }}
                          if (expandedGoalStageId !== stage.id) fetchCollaboratorGoals();
                          setExpandedGoalStageId(expandedGoalStageId === stage.id ? null : stage.id);
                        onClick={() => {
                      <button
                    <div key={stage.id} className="border border-zinc-100 rounded-xl overflow-hidden">
                  {stages.map(stage => (
                <div className="space-y-2">
                <p className="text-xs text-zinc-500 mb-4">Configure metas personalizadas por colaborador que sobrescrevem a meta padrão do setor.</p>
                </h4>
                  Metas Individuais por Colaborador (Overrides)
                  <Target size={16} className="text-zinc-500" />
                <h4 className="text-sm font-bold text-zinc-700 mb-4 flex items-center gap-2">
              <div className="mt-8 border-t border-zinc-100 pt-6">
              {/* Metas Individuais por Colaborador */}

              </div>
              })}
                );
                  </div>
                    </div>
                      </div>
                        </button>
                          <Trash2 size={14} />
                        >
                          className="p-1.5 hover:bg-rose-100 rounded text-rose-500 transition-colors"
                          }}
                            }
                              fetchData();
                              });
                                headers: { 'x-user-role': currentUser?.role || '' }
                                method: 'DELETE',
                              await fetch(`/api/stages/${stage.id}`, {
                            if (confirm(`Tem certeza que deseja excluir a etapa "${stage.name}"?`)) {
                          onClick={async () => {
                        <button
                        </button>
                          <Edit2 size={14} />
                        >
                          className="p-1.5 hover:bg-zinc-200 rounded text-zinc-500 transition-colors"
                          }}
                            setEditingStageMetaDiaria(stage.meta_diaria ?? '');
                            setEditingStageCalculationType(stage.calculation_type || 'por_peca');
                            setEditingStageTime(Math.round((stage.ideal_time || stage.average_time_seconds || 0) / 60));
                            setEditingStageName(stage.name);
                            setEditingStageId(stage.id);
                          onClick={() => {
                        <button
                        <div className="w-px h-4 bg-zinc-200 mx-1"></div>
                        </button>
                          <ArrowDown size={14} />
                        >
                          title="Mover para baixo"
                          className="p-1.5 hover:bg-zinc-200 rounded text-zinc-500 disabled:opacity-30 transition-colors"
                          disabled={index === stages.length - 1}
                          onClick={() => moveStage(index, 1)}
                        <button
                        </button>
                          <ArrowUp size={14} />
                        >
                          title="Mover para cima"
                          className="p-1.5 hover:bg-zinc-200 rounded text-zinc-500 disabled:opacity-30 transition-colors"
                          disabled={index === 0}
                          onClick={() => moveStage(index, -1)}
                        <button
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Badge variant="success">Ativa</Badge>
                    <div className="flex items-center gap-2">
                    </div>
                      )}
                        </div>
                          </div>
                            ) : null}
                              </span>
                                Meta: {stage.meta_diaria}/{stage.calculation_type === 'por_pedido' ? 'ped' : 'pc'}
                              <span className="text-[10px] text-violet-600 font-mono bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100">
                            {stage.meta_diaria && stage.meta_diaria > 0 ? (
                            ) : null}
                               </span>
                                 Real: {formatSeconds(stage.real_average_time)} ({stage.execution_count} rec)
                               <span className="text-[10px] text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            {stage.real_average_time && stage.real_average_time > 0 ? (
                            </span> : null}
                              Ideal: {formatSeconds(idealTimeDisplay)} {stage.calculation_type === 'por_peca' ? '/pc' : ''}
                            {idealTimeDisplay > 0 ? <span className="text-[10px] text-zinc-500 font-mono bg-white px-1.5 py-0.5 rounded border border-zinc-200">
                          <div className="flex items-center gap-3 mt-0.5">
                          </div>
                            {stage.calculation_type === 'por_lote' && <Badge variant="warning" className="lowercase italic opacity-70">por lote</Badge>}
                            {stage.calculation_type === 'por_peca' && <Badge variant="success" className="lowercase italic opacity-70">por peça</Badge>}
                            {stage.calculation_type === 'por_pedido' && <Badge variant="info" className="lowercase italic opacity-70">por pedido</Badge>}
                            <span className="text-sm font-medium">{stage.name}</span>
                          <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                      ) : (
                        </div>
                          </button>
                            Cancelar
                          >
                            className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded text-xs font-bold hover:bg-zinc-200 transition-colors"
                            onClick={() => setEditingStageId(null)}
                          <button
                          </button>
                            Salvar
                          >
                            className="px-3 py-1 bg-zinc-900 text-white rounded text-xs font-bold hover:bg-zinc-800 transition-colors"
                            }}
                              setEditingStageId(null);
                              }
                                fetchData();
                                });
                                  })
                                    meta_diaria: editingStageMetaDiaria !== '' ? editingStageMetaDiaria : null
                                    calculation_type: editingStageCalculationType,
                                    ideal_time: editingStageTime * 60,
                                    name: editingStageName, 
                                  body: JSON.stringify({ 
                                  },
                                    'x-user-role': currentUser?.role || ''
                                    'Content-Type': 'application/json',
                                  headers: {
                                  method: 'PATCH',
                                await fetch(`/api/stages/${stage.id}`, {
                              if (editingStageName) {
                            onClick={async () => {
                          <button
                          />
                            className="p-1 border border-zinc-300 rounded text-sm w-24 text-center"
                            title="Meta de produção diária base para esta etapa"
                            placeholder="Meta Diária"
                            onChange={(e) => setEditingStageMetaDiaria(e.target.value === '' ? '' : Number(e.target.value))}
                            value={editingStageMetaDiaria}
                            type="number"
                          <input
                          </select>
                            <option value="por_lote">📦 Por lote</option>
                            <option value="por_peca">👕 Por peça</option>
                            <option value="por_pedido">📄 Por pedido</option>
                          >
                            className="p-1 border border-zinc-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            onChange={(e) => setEditingStageCalculationType(e.target.value as any)}
                            value={editingStageCalculationType}
                          <select
                          />
                            title="Tempo ideal por peça em minutos"
                            className="p-1 border border-zinc-300 rounded text-sm w-24 text-center"
                            onChange={(e) => setEditingStageTime(Number(e.target.value))}
                            value={editingStageTime === 0 ? '' : editingStageTime}
                            step="0.01"
                            type="number"
                          <input
                          />
                            className="flex-1 min-w-[150px] bg-white border border-zinc-300 rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            }}
                              if (e.key === 'Escape') setEditingStageId(null);
                            onKeyDown={async (e) => {
                            onChange={(e) => setEditingStageName(e.target.value)}
                            value={editingStageName}
                            autoFocus
                            type="text"
                          <input
                        <div className="flex flex-wrap flex-1 gap-2">
                      {editingStageId === stage.id ? (
                      <span className="text-xs font-bold text-zinc-400 w-6">{stage.sort_order}</span>
                    <div className="flex items-center gap-4 flex-1">
                  <div key={stage.id} className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-100 rounded-xl group">
                  return (
                  const idealTimeDisplay = stage.ideal_time || stage.average_time_seconds || 0;
                {stages.map((stage, index) => {
              <div className="space-y-3">

              </div>
                </button>
                  Adicionar
                >
                  className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors"
                  }}
                    fetchData();
                    setNewStageMetaDiaria('');
                    setNewStageCalculationType('por_peca');
                    setNewStageTime(0);
                    setNewStageName('');
                    });
                      })
                        meta_diaria: newStageMetaDiaria !== '' ? newStageMetaDiaria : null
                        calculation_type: newStageCalculationType,
                        ideal_time: newStageTime * 60,
                        name: newStageName, 
                      body: JSON.stringify({ 
                      },
                        'x-user-role': currentUser?.role || ''
                        'Content-Type': 'application/json',
                      headers: {
                      method: 'POST',
                    await fetch('/api/stages', {
                    if (!newStageName) return;
                  onClick={async () => {
                <button
                />
                  className="p-2 border border-zinc-200 rounded-lg text-sm w-28 focus:outline-none focus:border-zinc-400"
                  title="Meta de produção diária base para esta etapa"
                  placeholder="Meta Diária"
                  onChange={(e) => setNewStageMetaDiaria(e.target.value === '' ? '' : Number(e.target.value))}
                  value={newStageMetaDiaria}
                  type="number"
                <input
                </select>
                  <option value="por_lote">📦 Por lote</option>
                  <option value="por_peca">👕 Por peça</option>
                  <option value="por_pedido">📄 Por pedido</option>
                >
                  className="p-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:border-zinc-400"
                  onChange={(e) => setNewStageCalculationType(e.target.value as any)}
                  value={newStageCalculationType}
                 <select
                />
                  className="p-2 border border-zinc-200 rounded-lg text-sm w-36 focus:outline-none focus:border-zinc-400"
                  title="Tempo ideal da etapa em minutos por peça"
                  placeholder="Tempo Ideal (min/peça)"
                  onChange={(e) => setNewStageTime(Number(e.target.value))}
                  value={newStageTime || ''}
                  step="0.01"
                  type="number"
                <input
                />
                  className="flex-1 min-w-[200px] p-2 border border-zinc-200 rounded-lg text-sm"
                  placeholder="Nome da nova etapa (ex: Silk 2 Cores)"
                  onChange={(e) => setNewStageName(e.target.value)}
                  value={newStageName}
                  type="text"
                <input
              <div className="flex flex-wrap gap-2 mb-8">

              </h3>
                Gerenciar Etapas de Produção
                <Settings size={20} />
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Card className="p-8">
            </Card>
              </form>
                </button>
                  Salvar Horários
                <button type="submit" className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors">
                </div>
                  </div>
                    />
                      required
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      defaultValue={autoPauseTimeFriday}
                      type="time"
                      name="auto_pause_time_friday"
                    <input
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Sexta (Fim de Expediente)</label>
                  <div className="space-y-1">
                  </div>
                    />
                      required
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      defaultValue={autoPauseTimeWeekday}
                      type="time"
                      name="auto_pause_time_weekday"
                    <input
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Seg – Qui (Fim de Expediente)</label>
                  <div className="space-y-1">
                  </div>
                    />
                      required
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      defaultValue={autoPauseTimeLunch}
                      type="time"
                      name="auto_pause_time_lunch"
                    <input
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Almoço (Horário de Pausa)</label>
                  <div className="space-y-1">
                <div className="grid grid-cols-2 gap-6">
              }}>
                }
                  alert('✅ Horários salvos com sucesso!');
                  setAutoPauseTimeLunch(lunch);
                  setAutoPauseTimeFriday(friday);
                  setAutoPauseTimeWeekday(weekday);
                if (res.ok) {
                });
                  body: JSON.stringify({ auto_pause_time_weekday: weekday, auto_pause_time_friday: friday, auto_pause_time_lunch: lunch })
                  headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role || '' },
                  method: 'PATCH',
                const res = await fetch('/api/config', {
                const lunch = formData.get('auto_pause_time_lunch') as string;
                const friday = formData.get('auto_pause_time_friday') as string;
                const weekday = formData.get('auto_pause_time_weekday') as string;
                const formData = new FormData(e.currentTarget);
                e.preventDefault();
              <form className="space-y-5" onSubmit={async (e) => {
              </p>
                O sistema requer que um Admin esteja com o sistema aberto no horário.
                Ao atingir o horário configurado, todas as tarefas em andamento são pausadas automaticamente.
              <p className="text-xs text-zinc-400 mb-6">
              </h3>
                Horários de Pausa Automática
                <Clock size={20} />
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
            <Card className="p-8">

            </Card>
              </form>
                </button>
                  Salvar Configurações
                <button type="submit" className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors">
                </div>
                  </div>
                    />
                      required
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      defaultValue={metaCustoPeca || 0}
                      step="0.01"
                      type="number"
                      name="meta_custo_por_peca"
                    <input
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Meta Custo/Peça (R$)</label>
                  <div className="space-y-1">
                  </div>
                    />
                      required
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      defaultValue={stats?.capacity?.config?.dias_uteis_mes || 22}
                      type="number"
                      name="dias_uteis_mes"
                    <input
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Dias Úteis no Mês</label>
                  <div className="space-y-1">
                  </div>
                    />
                      required
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      defaultValue={(stats?.capacity?.config?.eficiencia_percentual || 0.85) * 100}
                      type="number"
                      name="eficiencia_percentual"
                    <input
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Eficiência Operacional (%)</label>
                  <div className="space-y-1">
                  </div>
                    />
                      required
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      defaultValue={stats?.capacity?.config?.operadores_ativos || 2}
                      type="number"
                      name="operadores_ativos"
                    <input
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Operadores Ativos</label>
                  <div className="space-y-1">
                  </div>
                    />
                      required
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      defaultValue={stats?.capacity?.config?.jornada_horas || 8}
                      step="0.5"
                      type="number"
                      name="jornada_horas"
                    <input
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Jornada de Trabalho (Horas)</label>
                  <div className="space-y-1">
                <div className="grid grid-cols-2 gap-6">
              }}>
                fetchData();
                });
                  body: JSON.stringify(data)
                  },
                    'x-user-role': currentUser?.role || ''
                    'Content-Type': 'application/json',
                  headers: {
                  method: 'PATCH',
                await fetch('/api/config', {

                };
                  meta_custo_por_peca: Number(formData.get('meta_custo_por_peca'))
                  dias_uteis_mes: Number(formData.get('dias_uteis_mes')),
                  eficiencia_percentual: Number(formData.get('eficiencia_percentual')) / 100,
                  operadores_ativos: Number(formData.get('operadores_ativos')),
                  jornada_horas: Number(formData.get('jornada_horas')),
                const data = {
                const formData = new FormData(e.currentTarget);
                e.preventDefault();
              <form className="space-y-6" onSubmit={async (e) => {
              </h3>
                Configuração de Capacidade Produtiva
                <BarChart3 size={20} />
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Card className="p-8">

            </Card>
              </div>
                </p>
                  certifique-se de configurar a <strong>DATABASE_URL</strong> com a Connection String do Supabase nos Secrets.
                  O SDK do Supabase foi inicializado. Para usar o Supabase como banco de dados principal (SQL),
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                </div>
                  <Badge variant="info">Ativo</Badge>
                  <span className="text-zinc-500">Status do SDK:</span>
                <div className="flex items-center justify-between text-xs">
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
              </div>
                </button>
                  Testar Conexão
                >
                  className="text-[10px] font-bold uppercase tracking-wider text-sky-600 hover:text-sky-700"
                  }}
                    }
                      alert(`❌ Erro: ${data?.message || 'Falha na conexão'}`);
                    } else {
                      alert('✅ Supabase conectado com sucesso!');
                    if (data?.status === 'success') {
                    const data = await safeFetch('/api/supabase/status');
                  onClick={async () => {
                <button
                </h3>
                  Integração Supabase
                  <Settings size={20} />
                <h3 className="text-lg font-bold flex items-center gap-2">
              <div className="flex justify-between items-start mb-6">
            <Card className="p-8">
          <div className="max-w-2xl space-y-8 pb-12">
        {activeTab === 'settings' && (

        )}
          </div>
            <TaskMonitor onShowInfo={(t, d) => setInfoModal({ title: t, description: d })} />
            </div>
              <p className="text-zinc-500">Acompanhamento em tempo real da produção e tempos de execução</p>
              <h2 className="text-2xl font-bold tracking-tight">Monitor de Tarefas</h2>
            <div className="mb-6">
          <div className="max-w-7xl mx-auto pb-12">
        {activeTab === 'monitor' && currentUser?.role === 'Admin' && (

        )}
/>
  users={users}
  stages={stages}
  setReportUser={setReportUser}
  setReportStartDate={setReportStartDate}
  setReportStage={setReportStage}
  setReportEndDate={setReportEndDate}
  setMetaCustoPeca={setMetaCustoPeca}
  setInfoModal={setInfoModal}
  reportUser={reportUser}
  reportStartDate={reportStartDate}
  reportStage={reportStage}
  reportEndDate={reportEndDate}
  reportData={reportData}
  operationalReportData={operationalReportData}
  metaCustoPeca={metaCustoPeca}
  memoizedOrdersCompleted={memoizedOrdersCompleted}
  memoizedCostsByCollaborator={memoizedCostsByCollaborator}
  fetchReports={fetchReports}
  currentUser={currentUser}
          <Costs
        {activeTab === 'costs' && currentUser?.role === 'Admin' && (

        )}
/>
  users={users}
  stages={stages}
  setSelectedOrder={setSelectedOrder}
  setReportUser={setReportUser}
  setReportStartDate={setReportStartDate}
  setReportPeriod={setReportPeriod}
  setReportEndDate={setReportEndDate}
  setInfoModal={setInfoModal}
  setGoalsViewType={setGoalsViewType}
  setExpandedReportStage={setExpandedReportStage}
  setActiveReportSubTab={setActiveReportSubTab}
  reportUser={reportUser}
  reportStartDate={reportStartDate}
  reportPeriod={reportPeriod}
  reportEndDate={reportEndDate}
  reportData={reportData}
  profileReport={profileReport}
  operationalReportData={operationalReportData}
  lossReportData={lossReportData}
  goalsViewType={goalsViewType}
  goalsProductivityData={goalsProductivityData}
  fetchReports={fetchReports}
  fetchExecutions={fetchExecutions}
  expandedReportStage={expandedReportStage}
  deliveryReportData={deliveryReportData}
  delaysReportData={delaysReportData}
  collaboratorGoals={collaboratorGoals}
  activeReportSubTab={activeReportSubTab}
          <Reports
        {activeTab === 'reports' && (

        )}
          />
            setShowUserModal={setShowUserModal}
            setSelectedUserForEdit={setSelectedUserForEdit}
            currentUser={currentUser}
            users={users}
          <Collaborators
        {activeTab === 'collaborators' && (

        )}
          />
            }}
              setSelectedOrder(ord);
            onSelectOrder={(ord) => {
            onRefresh={fetchData}
            currentUser={currentUser}
            users={users}
            orders={orders}
          <ConsolidatedCuttingPanel
        {activeTab === 'cutting' && (

        )}
          />
            confirmTimeoutRef={confirmTimeoutRef}
            fetchExecutions={fetchExecutions}
            editingDtfValue={editingDtfValue}
            handleUpdateDeadline={handleUpdateDeadline}
            handleUpdateDtfLocation={handleUpdateDtfLocation}
            handleRequestToggleDtf={handleRequestToggleDtf}
            handleToggleDtf={handleToggleDtf}
            currentUser={currentUser}
            editingDtfOrderId={editingDtfOrderId}
            confirmingDtfOrderId={confirmingDtfOrderId}
            setEditingDtfValue={setEditingDtfValue}
            setConfirmingDtfOrderId={setConfirmingDtfOrderId}
            setEditingDtfOrderId={setEditingDtfOrderId}
            deliveryReportData={deliveryReportData}
            delaysReportData={delaysReportData}
            setExpandedReportStage={setExpandedReportStage}
            expandedReportStage={expandedReportStage}
            setInfoModal={setInfoModal}
            setSelectedOrder={setSelectedOrder}
            setPrintTypeFilter={setPrintTypeFilter}
            printTypeFilter={printTypeFilter}
            setProductTypeFilter={setProductTypeFilter}
            productTypeFilter={productTypeFilter}
            setSelectedStageStatus={setSelectedStageStatus}
            selectedStageStatus={selectedStageStatus}
            setSelectedStageFilter={setSelectedStageFilter}
            selectedStageFilter={selectedStageFilter}
            setSearchTerm={setSearchTerm}
            searchTerm={searchTerm}
            setShowCompletedOrders={setShowCompletedOrders}
            showCompletedOrders={showCompletedOrders}
            orders={orders}
          <Orders
        {activeTab === 'orders' && (

        )}
          />
            fetchExecutions={fetchExecutions}
            deliveryReportData={deliveryReportData}
            delaysReportData={delaysReportData}
            setExpandedReportStage={setExpandedReportStage}
            expandedReportStage={expandedReportStage}
            setInfoModal={setInfoModal}
            setSelectedOrder={setSelectedOrder}
            productTypeFilter={productTypeFilter}
            printTypeFilter={printTypeFilter}
            searchTerm={searchTerm}
            orders={orders}
          <Kanban
        {activeTab === 'kanban' && (

        )}
          </div>
            </div>
              </div>
                </Card>
                  </div>
                    )}
                      </div>
                        Fluxo normalizado.
                      <div className="text-center py-4 text-zinc-500 text-sm">
                    {(!stats.bottlenecks || stats.bottlenecks.length === 0) && (
                    ))}
                      </div>
                        <p className="text-sm font-bold text-zinc-700">{bottleneck.count} <span className="text-[10px] font-normal text-zinc-400">pedidos</span></p>
                        </div>
                          <p className="text-sm font-medium text-zinc-800">{bottleneck.stage_name}</p>
                          </div>
                            {idx + 1}
                          <div className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                        <div className="flex items-center gap-3">
                      <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                    {(stats.bottlenecks || []).map((bottleneck, idx) => (
                  <div className="space-y-3">
                  <p className="text-xs text-zinc-500 mb-4">Setores com mais pedidos aguardando ou em andamento no momento.</p>
                  </h3>
                    Gargalos da Produção
                    <Filter size={18} />
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-amber-700">
                <Card className="p-6 border-amber-100">
                {/* Bottlenecks */}

                </Card>
                  </div>
                    )}
                      </div>
                        Nenhum pedido em risco! 🎉
                      <div className="text-center py-4 text-emerald-600 bg-emerald-50 rounded-lg border border-emerald-100 text-sm">
                    {(!stats.atRiskOrders || stats.atRiskOrders.length === 0) && (
                    ))}
                      </div>
                        <Badge variant="error" className="py-1">{risk.urgency === 'Atrasado' ? 'ATR' : 'RSC'}</Badge>
                        </div>
                          <p className="text-[10px] text-zinc-500">{safeFormat(risk.deadline, 'dd/MM/yyyy')}</p>
                          <p className="text-sm font-medium text-zinc-800 truncate max-w-[120px]">{risk.client_name}</p>
                          <p className="text-xs font-mono font-bold text-rose-700">{risk.order_number}</p>
                        <div>
                      <div key={risk.id} className="p-3 bg-rose-50 rounded-lg border border-rose-100 flex items-center justify-between">
                    {(stats.atRiskOrders || []).map(risk => (
                  <div className="space-y-3">
                  </h3>
                    Pedidos em Risco ou Atrasados
                    <AlertTriangle size={18} />
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-rose-700">
                <Card className="p-6 border-rose-100">
                {/* At Risk Orders */}
              <div className="space-y-8">
              {/* Sidebar panels */}

              </div>
                </Card>
                  </div>
                    </table>
                      </tbody>
                        )}
                          </tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-500">Sem dados de produtividade no período.</td>
                          <tr>
                        {(!stats.productivity || stats.productivity.length === 0) && (
                        ))}
                          </tr>
                            <td className="px-4 py-3 text-center font-mono text-xs text-zinc-600">{(prod.avg_time_per_piece / 60).toFixed(1)} min</td>
                            <td className="px-4 py-3 text-center text-sm font-bold text-zinc-700">{prod.pieces_count}</td>
                            <td className="px-4 py-3 text-center text-sm text-zinc-600">{prod.orders_count}</td>
                            <td className="px-4 py-3 text-sm font-medium text-zinc-800">{prod.collaborator}</td>
                          <tr key={prod.collaborator} className="hover:bg-zinc-50 transition-colors">
                        {(stats.productivity || []).map(prod => (
                      <tbody className="divide-y divide-zinc-50">
                      </thead>
                        </tr>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Tempo Médio/Peça</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Peças Feitas</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Pedidos Finais</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Colaborador</th>
                        <tr className="bg-zinc-50 border-b border-zinc-100">
                      <thead>
                    <table className="w-full text-left">
                  <div className="overflow-x-auto">
                  </div>
                    </h3>
                      Produtividade por Colaborador
                      <Users size={18} className="text-zinc-400" />
                    <h3 className="font-bold flex items-center gap-2">
                  <div className="flex items-center justify-between mb-6">
                <Card className="p-6">
                {/* Productivity Table */}

                </Card>
                  </div>
                    </table>
                      </tbody>
                        )}
                          </tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">Nenhum pedido em produção.</td>
                          <tr>
                          .length === 0 && (
                          .filter(o => !productTypeFilter || o.product_type === productTypeFilter)
                          .filter(o => !printTypeFilter || o.print_type === printTypeFilter)
                          .filter(o => o.status !== 'Entregue' && o.status !== 'Cancelado')
                        {orders
                        })}
                          );
                            </tr>
                              </td>
                                </span>
                                  {order.status}
                                )}>
                                      'bg-zinc-100 text-zinc-700'
                                    order.status === 'Finalização' ? 'bg-amber-100 text-amber-700' :
                                  order.status === 'Em Produção' ? 'bg-sky-100 text-sky-700' :
                                  "inline-flex px-2 py-1 rounded-full text-[10px] font-bold",
                                <span className={cn(
                              <td className="px-4 py-3 text-center">
                              </td>
                                </span>
                                  {safeFormat(order.deadline, 'dd/MM/yyyy')}
                                <span className={cn("text-xs font-bold", riskColors[risk])}>
                              <td className="px-4 py-3 text-center">
                              <td className="px-4 py-3 text-center text-sm font-bold text-zinc-700">{order.quantity}</td>
                              <td className="px-4 py-3 text-sm text-zinc-600">{order.product_type}</td>
                              <td className="px-4 py-3 text-sm font-medium text-zinc-800">{order.client_name}</td>
                              </td>
                                })()}
                                  return null;
                                  }
                                    );
                                      </span>
                                        <Scissors size={9} className="text-amber-700" /> {cutQty} p/ Corte
                                      <span className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-black animate-pulse">
                                    return (
                                  if (cutQty > 0) {
                                  const cutQty = getOrderCuttingQty(order);
                                {(() => {
                                <div>{order.order_number}</div>
                              <td className={cn("px-4 py-3 font-mono text-xs font-bold", riskColors[risk])}>
                            <tr key={order.id} className="hover:bg-zinc-50 transition-colors">
                          return (

                          };
                            safe: "text-emerald-600"
                            warning: "text-amber-600",
                            danger: "text-rose-600",
                          const riskColors = {
                          const risk = getOrderRisk(order.id);
                          .map(order => {
                          .filter(o => !productTypeFilter || o.product_type === productTypeFilter)
                          .filter(o => !printTypeFilter || o.print_type === printTypeFilter)
                          .filter(o => o.status !== 'Entregue' && o.status !== 'Cancelado')
                        {orders
                      <tbody className="divide-y divide-zinc-50">
                      </thead>
                        </tr>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Status</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Prazo</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">Qtd</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Produto</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Cliente</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Pedido</th>
                        <tr className="bg-zinc-50 border-b border-zinc-100">
                      <thead>
                    <table className="w-full text-left">
                  <div className="overflow-x-auto">
                  </div>
                    </h3>
                      Pedidos em Produção
                      <List size={18} className="text-zinc-400" />
                    <h3 className="font-bold flex items-center gap-2">
                  <div className="flex items-center justify-between mb-6">
                <Card className="p-6">
              <div className="lg:col-span-2 space-y-8">
              {/* Central Orders Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            </div>
              </Card>
                </div>
                  </div>
                    <h3 className="text-2xl font-bold">{((stats.metrics?.avgLeadTimeSeconds || 0) / 86400).toFixed(1)} <span className="text-sm font-normal text-zinc-400">dias</span></h3>
                    <p className="text-xs text-zinc-500 font-medium">Tempo Médio</p>
                  <div>
                  </div>
                    <Clock size={24} />
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <div className="flex items-center gap-4 mb-4">
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Tempo Médio', description: 'Média de tempo (em dias) que um pedido leva para ser concluído, desde a criação até a última etapa.' })}>

              </Card>
                </div>
                  </div>
                    <h3 className="text-2xl font-bold">{stats.metrics?.todayFinalizedPieces || 0} <span className="text-sm font-normal text-zinc-400">peças</span></h3>
                    <p className="text-xs text-zinc-500 font-medium">Produção Hoje</p>
                  <div>
                  </div>
                    <CheckCircle2 size={24} />
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <div className="flex items-center gap-4 mb-4">
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Produção Hoje', description: 'Quantidade de peças que passaram por alguma etapa de finalização no dia atual.' })}>

              </Card>
                </div>
                  </div>
                    <h3 className={cn("text-2xl font-bold", (stats.metrics?.overdueOrders || 0) > 0 ? "text-rose-600" : "text-emerald-600")}>{stats.metrics?.overdueOrders || 0}</h3>
                    <p className="text-xs text-zinc-500 font-medium">Pedidos Atrasados</p>
                  <div>
                  </div>
                    <AlertCircle size={24} />
                  <div className={cn("p-3 rounded-xl", (stats.metrics?.overdueOrders || 0) > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>
                <div className="flex items-center gap-4 mb-4">
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Pedidos Atrasados', description: 'Contagem de pedidos ativos cuja data de entrega (prazo) é anterior à data de hoje.' })}>

              </Card>
                </div>
                  </div>
                    <h3 className="text-2xl font-bold">{stats.metrics?.activePieces || 0} <span className="text-sm font-normal text-zinc-400">un</span></h3>
                    <p className="text-xs text-zinc-500 font-medium">Peças em Produção</p>
                  <div>
                  </div>
                    <Layers size={24} />
                  <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                <div className="flex items-center gap-4 mb-4">
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Peças em Produção', description: 'Soma total de todas as quantidades de itens dos pedidos que estão com status ativo.' })}>

              </Card>
                </div>
                  </div>
                    <h3 className="text-2xl font-bold">{stats.metrics?.activeOrders || 0}</h3>
                    <p className="text-xs text-zinc-500 font-medium">Pedidos Ativos</p>
                  <div>
                  </div>
                    <Package size={24} />
                  <div className="p-3 bg-zinc-100 rounded-xl text-zinc-600">
                <div className="flex items-center gap-4 mb-4">
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Pedidos Ativos', description: 'Total de pedidos que estão atualmente no sistema e ainda não foram finalizados ou cancelados.' })}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* Top KPI Cards */}

            )}
              </Card>
                </div>
                  </table>
                    </tbody>
                      ))}
                        </tr>
                          </td>
                            </div>
                              </button>
                                <Trash2 size={14} />
                              >
                                title="Excluir este rascunho"
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors border border-rose-200"
                                onClick={() => handleDeleteDraftOrder(draft.id)}
                              <button
                              </button>
                                Revisar &amp; Liberar
                                <Edit2 size={13} />
                              >
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                                onClick={() => handleOpenDraftReview(draft)}
                              <button
                            <div className="flex items-center justify-end gap-2">
                          <td className="px-4 py-3 text-right">
                          </td>
                            {safeFormat(draft.deadline, 'dd/MM/yyyy')}
                          <td className="px-4 py-3 text-center font-medium text-zinc-600">
                          </td>
                            </div>
                              })()}
                                return null;
                                }
                                  );
                                    </span>
                                      <Scissors size={11} className="text-amber-700" /> FALTA ESTOQUE: {cutQty} PÇS (CORTE)
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] font-black animate-pulse shadow-sm">
                                  return (
                                if (cutQty > 0) {
                                const cutQty = getOrderCuttingQty(draft);
                              {(() => {
                              </span>
                                {draft.quantity} peças {draft.items && draft.items.length > 0 && `(${draft.items.length} SKUs)`}
                              <span className="inline-flex items-center gap-1 font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-[11px]">
                            <div className="flex flex-col items-center justify-center gap-1">
                          <td className="px-4 py-3 text-center">
                          <td className="px-4 py-3 font-semibold text-zinc-800">{draft.client_name}</td>
                          <td className="px-4 py-3 font-bold font-mono text-indigo-950">{draft.order_number}</td>
                        <tr key={draft.id} className="hover:bg-indigo-50/30 transition-colors">
                      {draftOrders.map((draft) => (
                    <tbody className="divide-y divide-indigo-50">
                    </thead>
                      </tr>
                        <th className="px-4 py-2.5 text-right">Ação</th>
                        <th className="px-4 py-2.5 text-center">Prazo</th>
                        <th className="px-4 py-2.5 text-center">Itens / Grade</th>
                        <th className="px-4 py-2.5">Cliente</th>
                        <th className="px-4 py-2.5">Pedido Olist</th>
                      <tr className="bg-indigo-100/50 border-b border-indigo-100 text-indigo-900 font-bold uppercase text-[10px]">
                    <thead>
                  <table className="w-full text-left text-xs">
                <div className="overflow-x-auto border border-indigo-100 rounded-xl bg-white shadow-sm">
                </div>
                  </button>
                    Limpar Antigos (&gt; 7 dias)
                    <Trash2 size={13} />
                  >
                    title="Excluir rascunhos com mais de 7 dias"
                    className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
                    onClick={handleCleanOldDrafts}
                  <button
                  </div>
                    </div>
                      </p>
                        Estes pedidos foram importados automaticamente do Olist com a grade de tamanhos. A vendedora precisa selecionar a estampa antes de liberar para produção.
                      <p className="text-xs text-indigo-700 mt-0.5">
                      </h3>
                        </span>
                          Pendente de Estampa / Revisão
                        <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider">
                        Pedidos Importados do Olist ERP ({draftOrders.length})
                      <h3 className="text-base font-bold text-indigo-950 flex items-center gap-2">
                    <div>
                    </div>
                      <Package size={22} />
                    <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-sm">
                  <div className="flex items-center gap-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <Card className="p-6 border-indigo-200 bg-indigo-50/50 shadow-md">
            {draftOrders.length > 0 && (
            {/* Olist Draft Orders Banner */}
          <div className="space-y-8">
        {activeTab === 'dashboard' && stats && (

        </header>
          </div>
            )}
              </div>
                </button>
                  Novo Pedido
                  <Plus size={18} />
                >
                  className="bg-zinc-900 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors shadow-sm whitespace-nowrap"
                  }}
                    setNewOrderRequiredStages(stages.filter(s => s.active).map(s => s.id));
                    setShowNewOrderModal(true);
                  onClick={() => {
                <button

                </button>
                  )}
                    </span>
                      {draftOrders.length}
                    <span className="bg-white text-amber-900 font-black px-1.5 py-0.5 rounded-full text-[10px] shadow-sm">
                  {draftOrders.length > 0 && (
                  <span>Rascunhos Olist</span>
                  <Package size={15} />
                >
                  title="Ver lista de rascunhos de pedidos importados do Olist ERP"
                  className="relative bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm whitespace-nowrap text-xs font-bold active:scale-95 cursor-pointer"
                  onClick={() => setIsDraftsListModalOpen(true)}
                <button

                </button>
                  <span>{isSyncingOlist ? "Sincronizando..." : "Sincronizar Olist"}</span>
                  <RefreshCw size={15} className={cn(isSyncingOlist && "animate-spin")} />
                >
                  title="Buscar novos pedidos aprovados dos últimos 7 dias do Olist ERP"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm whitespace-nowrap text-xs font-bold active:scale-95 disabled:opacity-50 cursor-pointer"
                  disabled={isSyncingOlist}
                  onClick={handleSyncOlist}
                <button

                </form>
                  />
                    autoComplete="off"
                    className="block w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm font-bold text-zinc-900 placeholder:text-zinc-400 placeholder:font-normal focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all outline-none"
                    placeholder="Escanear OP (Cliente)..."
                    ref={scanInputRef}
                    name="escanearOp"
                    type="text"
                  <input
                  </div>
                    <Search className="h-4 w-4" />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-zinc-900 text-zinc-400">
                >
                  className="relative group flex-1 lg:w-64"
                  }}
                    }
                      });
                        }
                          alert('OP (Cliente) não encontrada no sistema.');
                        } else {
                          }
                            handleOrderFound(data[0]);
                            // podemos abrir o primeiro se for um scan literal do campo circled
                            // Se encontrar algo por outros campos mas o usuário quer apenas cliente
                          } else {
                            handleOrderFound(clientMatch);
                          if (clientMatch) {
                          );
                            o.client_name && o.client_name.toLowerCase().includes(searchLower)
                          const clientMatch = data.find((o: Order) => 
                          // Prioriza match no client_name
                        if (data && data.length > 0) {
                      safeFetch(`/api/orders?search=${encodeURIComponent(scannedValue)}`).then(data => {
                      // Se não encontrar localmente, busca na API focando no nome do cliente
                    } else {
                      handleOrderFound(foundOrder);
                    if (foundOrder) {

                    };
                      (e.target as HTMLFormElement).reset();
                      fetchExecutions(order.id);
                      setSelectedOrder(order);
                    const handleOrderFound = (order: Order) => {

                    );
                      o.client_name && o.client_name.toLowerCase().includes(searchLower)
                    let foundOrder = orders.find(o => 
                    const searchLower = scannedValue.toLowerCase();
                    // Procura especificamente no campo client_name (como solicitado pelo usuário)

                    if (!scannedValue) return;
                    const scannedValue = (formData.get('escanearOp') as string).trim();
                    const formData = new FormData(e.currentTarget);
                    e.preventDefault();
                  onSubmit={(e) => {
                <form 
              <div className="flex items-center gap-3 w-full lg:w-auto">
            ) : (
              ) : null
                </button>
                  Definir Metas
                  <Target size={18} />
                >
                  className="w-full lg:w-auto bg-zinc-900 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors shadow-sm"
                  onClick={() => setActiveTab('settings')}
                <button
              currentUser?.role === 'Admin' ? (
            {activeTab === 'dashboard' ? (
            )}
              </div>
                </button>
                  <span>Imprimir Relatório</span>
                  <Printer size={12} />
                >
                  title="Imprimir Relatório"
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-900 text-white rounded-lg text-[10px] font-bold hover:bg-zinc-800 transition-all shadow-sm active:scale-95 ml-auto sm:ml-0"
                  onClick={() => setIsPrintModalOpen(true)}
                <button

                </div>
                  </div>
                    </select>
                      <option value="Sublimação">Sublimação</option>
                      <option value="DTF">DTF</option>
                      <option value="Silk">Silk</option>
                      <option value="">Todos</option>
                    >
                      className="py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[80px]"
                      onChange={(e) => setReportPrintType(e.target.value)}
                      value={reportPrintType}
                    <select
                    <span className="text-[8px] font-bold text-zinc-400 uppercase">Setor:</span>
                  <div className="flex items-center gap-1 px-2 border-l border-zinc-100 py-1 sm:py-0">
                  </div>
                    </select>
                      ))}
                        <option key={stage.id} value={stage.id}>{stage.name}</option>
                      {stages.map(stage => (
                      <option value="">Todas</option>
                    >
                      className="py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[80px]"
                      onChange={(e) => setReportStage(e.target.value)}
                      value={reportStage}
                    <select
                    <span className="text-[8px] font-bold text-zinc-400 uppercase">Etapa:</span>
                  <div className="flex items-center gap-1 px-2 py-1 sm:py-0">
                  </div>
                    </select>
                      ))}
                        <option key={user.id} value={user.id}>{user.name}</option>
                      {users.map(user => (
                      <option value="">Todos</option>
                    >
                      className="py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[80px]"
                      onChange={(e) => setReportUser(e.target.value)}
                      value={reportUser}
                    <select
                    <span className="text-[8px] font-bold text-zinc-400 uppercase">Colab:</span>
                  <div className="flex items-center gap-1 px-2 border-r border-zinc-100 py-1 sm:py-0">
                <div className="flex items-center gap-1 bg-white border border-zinc-200 p-1 rounded-lg shadow-sm">

                </div>
                  </div>
                    />
                      className="text-[10px] font-medium bg-transparent focus:outline-none"
                      onChange={(e) => setReportEndDate(e.target.value)}
                      value={reportEndDate}
                      type="date"
                    <input
                    <span className="text-zinc-300">|</span>
                    />
                      className="text-[10px] font-medium bg-transparent focus:outline-none"
                      onChange={(e) => setReportStartDate(e.target.value)}
                      value={reportStartDate}
                      type="date"
                    <input
                    <Calendar size={14} className="text-zinc-400" />
                  <div className="flex items-center gap-2 px-2">
                <div className="flex items-center gap-2 bg-white border border-zinc-200 p-1.5 rounded-lg shadow-sm">

                </div>
                  </button>
                    Mensal
                  >
                    className={cn("px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", reportPeriod === 'month' ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                    }}
                      setReportEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                      setReportStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                      setReportPeriod('month');
                    onClick={() => {
                  <button
                  </button>
                    Semanal
                  >
                    className={cn("px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", reportPeriod === 'week' ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                    }}
                      setReportEndDate(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
                      setReportStartDate(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
                      setReportPeriod('week');
                    onClick={() => {
                  <button
                  </button>
                    Diário
                  >
                    className={cn("px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", reportPeriod === 'day' ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                    }}
                      setReportEndDate(format(new Date(), 'yyyy-MM-dd'));
                      setReportStartDate(format(new Date(), 'yyyy-MM-dd'));
                      setReportPeriod('day');
                    onClick={() => {
                  <button
                  </button>
                    Diário
                  >
                    className={cn("px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", reportPeriod === 'day' ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                    }}
                      setReportEndDate(format(new Date(), 'yyyy-MM-dd'));
                      setReportStartDate(format(new Date(), 'yyyy-MM-dd'));
                      setReportPeriod('day');
                    onClick={() => {
                  <button
                <div className="flex items-center gap-1 bg-white border border-zinc-200 p-1 rounded-lg shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'reports' && (
            )}
              </div>
                </div>
                  </select>
                    <option value="Sublimação">Sublimação</option>
                    <option value="DTF">DTF</option>
                    <option value="Silk">Silk</option>
                    <option value="">Estampas</option>
                  >
                    className="flex-1 px-2 py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[100px]"
                    onChange={(e) => setPrintTypeFilter(e.target.value)}
                    value={printTypeFilter}
                  <select
                  <div className="w-px h-4 bg-zinc-200 mx-1" />
                  </select>
                    <option value="Poliamida">Poliamida</option>
                    <option value="Algodão">Algodão</option>
                    <option value="Dry Fit">Dry Fit</option>
                    <option value="">Produtos</option>
                  >
                    className="flex-1 px-2 py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[100px]"
                    onChange={(e) => setProductTypeFilter(e.target.value)}
                    value={productTypeFilter}
                  <select
                <div className="flex items-center gap-2 bg-white border border-zinc-200 p-1 rounded-lg shadow-sm">

                </div>
                  </button>
                    Mês
                  >
                    className={cn("whitespace-nowrap px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", dateRange?.start === startOfMonth(new Date()).toISOString() ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                    })}
                      end: endOfMonth(new Date()).toISOString()
                      start: startOfMonth(new Date()).toISOString(),
                    onClick={() => setDateRange({
                  <button
                  </button>
                    Semana
                  >
                    className={cn("whitespace-nowrap px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", dateRange?.start === startOfWeek(new Date()).toISOString() ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                    })}
                      end: endOfWeek(new Date()).toISOString()
                      start: startOfWeek(new Date()).toISOString(),
                    onClick={() => setDateRange({
                  <button
                  </button>
                    Tudo
                  >
                    className={cn("whitespace-nowrap px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors", !dateRange ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                    onClick={() => setDateRange(null)}
                  <button
                <div className="flex items-center gap-2 bg-white border border-zinc-200 p-1 rounded-lg shadow-sm overflow-x-auto">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {activeTab === 'dashboard' && (
            )}
              </button>
                Convidar Colaborador
                <Plus size={18} />
              >
                className="w-full lg:w-auto bg-zinc-900 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors shadow-sm"
                }}
                  setShowUserModal(true);
                  setSelectedUserForEdit(null);
                onClick={() => {
              <button
            {activeTab === 'collaborators' && (
            )}
              </div>
                </button>
                  <span className="hidden sm:inline">Imprimir</span>
                  <Printer size={16} />
                >
                  title="Imprimir Sequência"
                  className="px-3 py-1.5 ml-2 bg-zinc-900 border border-zinc-900 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                  onClick={() => window.print()}
                <button
                </div>
                  </select>
                    <option value="Sublimação">Sublimação</option>
                    <option value="DTF">DTF</option>
                    <option value="Silk">Silk</option>
                    <option value="">Estampas</option>
                  >
                    className="flex-1 px-2 py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[100px]"
                    onChange={(e) => setPrintTypeFilter(e.target.value)}
                    value={printTypeFilter}
                  <select
                  <div className="w-px h-4 bg-zinc-200 mx-1" />
                  </select>
                    <option value="Poliamida">Poliamida</option>
                    <option value="Algodão">Algodão</option>
                    <option value="Dry Fit">Dry Fit</option>
                    <option value="">Produtos</option>
                  >
                    className="flex-1 px-2 py-1 bg-transparent text-[10px] font-medium focus:outline-none min-w-[100px]"
                    onChange={(e) => setProductTypeFilter(e.target.value)}
                    value={productTypeFilter}
                  <select
                <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg p-1">
                </div>
                  )}
                    </select>
                      <option value="Finished">Concluído</option>
                      <option value="Pending">Pendente</option>
                    >
                      className="px-2 py-1 bg-zinc-100 rounded text-[10px] font-bold focus:outline-none"
                      onChange={(e) => setSelectedStageStatus(e.target.value as any)}
                      value={selectedStageStatus}
                    <select
                  {selectedStageFilter && (
                  </select>
                    ))}
                      <option key={stage.id} value={stage.id}>{stage.name}</option>
                    {stages.map(stage => (
                    <option value="">Todas as Etapas</option>
                  >
                    className="flex-1 px-2 py-1 bg-transparent text-sm focus:outline-none"
                    onChange={(e) => setSelectedStageFilter(e.target.value)}
                    value={selectedStageFilter}
                  <select
                <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg p-1">
                </div>
                  />
                    className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-400 sm:min-w-[200px]"
                    onChange={(e) => setSearchTerm(e.target.value)}
                    value={searchTerm}
                    placeholder="Pesquisar..."
                    type="text"
                  <input
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <div className="relative flex-1">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {(activeTab === 'kanban' || activeTab === 'orders') && (
            )}
              </div>
                />
                  className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-400 lg:min-w-[250px]"
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  value={userSearchTerm}
                  placeholder="Buscar por nome ou email..."
                  type="text"
                <input
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <div className="relative w-full lg:w-auto">
            {activeTab === 'collaborators' && (
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">

          </div>
            </button>
              <Menu size={20} />
            >
              className="lg:hidden p-2 bg-white border border-zinc-200 rounded-lg text-zinc-600"
              onClick={() => setIsMobileMenuOpen(true)}
            <button
            </div>
              </p>
                {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
              <p className="text-zinc-500 text-xs lg:text-sm">
              </h2>
                {activeTab === 'monitor' && 'Monitor de Tarefas (Tempo Real)'}
                {activeTab === 'settings' && 'Configurações do Sistema'}
                {activeTab === 'costs' && 'Análise de Custos'}
                {activeTab === 'reports' && 'Relatórios'}
                {activeTab === 'collaborators' && 'Colaboradores'}
                {activeTab === 'orders' && 'Todos os Pedidos'}
                {activeTab === 'kanban' && 'Fluxo de Produção'}
                {activeTab === 'dashboard' && 'Visão Geral'}
              <h2 className="text-xl lg:text-2xl font-bold tracking-tight">
            <div>
          <div className="flex items-center justify-between">
        <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
        </AnimatePresence>
          )}
            </div>
              ))}
                />
                  }}
                    }
                      }
                        setActiveTab('kanban');
                        fetchExecutions(order.id);
                        setSelectedOrder(order);
                      if (order) {
                      const order = orderData.find((o: Order) => o.id === exec.order_id);
                    if (orderData && orderData.length > 0) {
                    const orderData = await safeFetch(`/api/orders?search=${exec.order_number}`);
                  onNavigate={async () => {
                  execution={exec}
                  key={exec.id}
                <RunningTaskBanner
              {activeExecutions.map((exec) => (
              )}
                </div>
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Tarefas em Andamento ({activeExecutions.length})</span>
                  <Activity size={16} className="text-zinc-400" />
                <div className="flex items-center gap-2 px-1">
              {activeExecutions.length > 1 && (
            <div className="flex flex-col gap-3 mb-6">
          {activeExecutions.length > 0 && (
        <AnimatePresence>

        </div>
          </div>
            </div>
              <span className="text-xs font-medium text-emerald-700">Setor: {currentUser?.role || '---'}</span>
              <span className="hidden sm:inline text-emerald-300">•</span>
              <span className="text-sm font-bold text-emerald-900">Operador Ativo: {currentUser?.name || '---'}</span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <div className="flex items-center gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-6 flex items-center justify-between shadow-sm">
        {/* Banner Operador Ativo */}
        
      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
      {/* Main Content */}

      </aside>
        </div>
          </button>
            Sair da Conta
            <LogOut size={16} />
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
          </div>
            </div>
              <p className="text-xs text-zinc-500 truncate">{currentUser?.role || '---'}</p>
              <p className="text-sm font-semibold truncate">{currentUser?.name || '---'}</p>
            <div className="flex-1 min-w-0">
            </div>
              <UserIcon size={20} />
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">
          <div className="flex items-center gap-3 px-2 mb-4">
        <div className="mt-auto pt-6 border-t border-zinc-100">

        </nav>
          )}
            />
              onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
              active={activeTab === 'settings'}
              label="Configurações"
              icon={Settings}
            <SidebarItem
          {currentUser?.role === 'Admin' && (
          )}
            />
              onClick={() => { setActiveTab('costs'); setIsMobileMenuOpen(false); }}
              active={activeTab === 'costs'}
              label="Custos"
              icon={DollarSign}
            <SidebarItem
          {currentUser?.role === 'Admin' && (
          )}
            />
              onClick={() => { setActiveTab('monitor'); setIsMobileMenuOpen(false); }}
              active={activeTab === 'monitor'}
              label="Monitor"
              icon={Activity}
            <SidebarItem
          {currentUser?.role === 'Admin' && (
          />
            onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
            active={activeTab === 'reports'}
            label="Relatórios"
            icon={FileText}
          <SidebarItem
          )}
            />
              onClick={() => { setActiveTab('collaborators'); setIsMobileMenuOpen(false); }}
              active={activeTab === 'collaborators'}
              label="Colaboradores"
              icon={Users}
            <SidebarItem
          {currentUser?.role === 'Admin' && (
          />
            badge={cortePendingBadgeCount > 0 ? cortePendingBadgeCount : undefined}
            onClick={() => { setActiveTab('cutting'); setIsMobileMenuOpen(false); }}
            active={activeTab === 'cutting'}
            label="Central de Corte"
            icon={Scissors}
          <SidebarItem
          />
            onClick={() => { setActiveTab('orders'); setIsMobileMenuOpen(false); }}
            active={activeTab === 'orders'}
            label="Pedidos"
            icon={Package}
          <SidebarItem
          />
            onClick={() => { setActiveTab('kanban'); setIsMobileMenuOpen(false); }}
            active={activeTab === 'kanban'}
            label="Kanban"
            icon={ClipboardList}
          <SidebarItem
          />
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
            active={activeTab === 'dashboard'}
            label="Dashboard"
            icon={LayoutDashboard}
          <SidebarItem
        <nav className="flex flex-col gap-2 flex-1">

        </div>
          </button>
            <X size={20} />
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-1 text-zinc-400">
          </div>
            <h1 className="font-bold text-xl tracking-tight">ComfortPro</h1>
            </div>
              <Package size={18} />
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white">
          <div className="flex items-center gap-2">
        <div className="flex items-center justify-between px-2">
      )}>
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        "fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-200 bg-white p-6 flex flex-col gap-8 transition-transform duration-300 lg:relative lg:translate-x-0",
      <aside className={cn(
      {/* Sidebar */}

      </AnimatePresence>
        )}
          />
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            exit={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
          <motion.div
        {isMobileMenuOpen && (
      <AnimatePresence>
      {/* Mobile Overlay */}

      )}
        </div>
          </table>
            </tbody>
              ))}
                  </tr>
                    </td>
                        : ''}
                            : o.active_stage_observation}</span>
                            ? `${o.active_stage_observation.slice(0, 120)}...` 
                        ? <span className="italic">📝 {o.active_stage_observation.length > 120 
                      {o.active_stage_observation 
                    <td className="p-2 border-b border-zinc-200 text-xs text-zinc-700" style={{minWidth: '200px'}}>
                    <td className="p-2 border-b border-zinc-200 border-r text-center text-xs font-medium">{safeFormat(o.deadline, 'dd/MM')}</td>
                    <td className="p-2 border-b border-zinc-200 border-r text-xs font-semibold text-zinc-700">{o.active_stage_name || '-'}</td>
                    <td className="p-2 border-b border-zinc-200 border-r text-xs">{o.print_type || '-'}</td>
                    <td className="p-2 border-b border-zinc-200 border-r text-center font-bold">{o.quantity}</td>
                    <td className="p-2 border-b border-zinc-200 border-r font-medium truncate max-w-[220px]">{o.client_name}</td>
                  <tr key={o.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                .map((o, idx) => (
                .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
                })
                    return !st.finished;
                    if (selectedStageStatus === 'Finished') return st.finished;
                    if (!st) return false;
                    const st = o.stages_status.find(s => s.id.toString() === selectedStageFilter);
                    if (!selectedStageFilter) return true;
                .filter(o => {
                })
                    );
                      (o.print_type || '').toLowerCase().includes(search)
                      o.product_type.toLowerCase().includes(search) ||
                      o.client_name.toLowerCase().includes(search) ||
                      o.order_number.toLowerCase().includes(search) ||
                    return (
                    const search = searchTerm.toLowerCase();
                    if (!searchTerm) return true;
                .filter(o => {
                .filter(o => !productTypeFilter || o.product_type === productTypeFilter)
                .filter(o => !printTypeFilter || o.print_type === printTypeFilter)
                .filter(o => o.status !== 'Entregue' && o.status !== 'Cancelado')
              {(orders || [])
            <tbody>
            </thead>
              </tr>
                <th className="p-2 text-left" style={{minWidth: '200px'}}>Observação</th>
                <th className="p-2 border-r border-zinc-200 text-center">Prazo</th>
                <th className="p-2 border-r border-zinc-200">Etapa atual</th>
                <th className="p-2 border-r border-zinc-200">Estampa</th>
                <th className="p-2 border-r border-zinc-200 text-center">Qtde</th>
                <th className="p-2 border-r border-zinc-200">Cliente</th>
              <tr className="bg-zinc-100 border-b-2 border-zinc-300 uppercase text-[10px] tracking-wider text-zinc-600">
            <thead>
          <table className="w-full border-collapse text-sm text-left">
          </div>
            </div>
              {printTypeFilter && <p>Estampa: <strong>{printTypeFilter}</strong></p>}
              )}
                <p>Etapa: <strong>{stages.find(s => s.id.toString() === selectedStageFilter)?.name || selectedStageFilter}</strong></p>
              {selectedStageFilter && (
            <div className="text-right text-sm">
            </div>
              </p>
                Emitido em: {format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              <p className="text-sm mt-1 text-zinc-500">
              <h1 className="text-2xl font-bold uppercase tracking-tight">Sequência de Produção</h1>
            <div>
          <div className="mb-6 border-b border-zinc-300 pb-4 flex justify-between items-end">
        <div className="print-container hidden text-black bg-white w-full p-8 font-sans">
      {(activeTab === 'kanban' || activeTab === 'orders') && (
      {/* Print Container */}
    <div className="flex h-screen bg-[#F8F9FA] font-sans text-zinc-900 overflow-hidden">
  return (

  }
    return <div className="flex h-screen items-center justify-center bg-[#F8F9FA]"><p className="text-zinc-500 font-medium animate-pulse">Carregando permissões de perfil...</p></div>;
  if (!currentUser) {

  }
    );
      </div>
        </Card>
          </form>
            </button>
              Entrar no Sistema <ChevronRight size={18} />
            <button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3.5 rounded-lg mt-6 flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.98]">
            </div>
              />
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all shadow-sm"
                onChange={(e) => setAuthPassword(e.target.value)}
                value={authPassword}
                type="password"
              <input
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Senha</label>
            <div>
            </div>
              />
                required
                placeholder="seu@email.com"
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all shadow-sm"
                onChange={(e) => setAuthEmail(e.target.value)}
                value={authEmail}
                type="email"
              <input
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">E-mail Corporativo</label>
            <div>
            )}
              </div>
                Ocorreu um erro: {authError}
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium text-center border border-red-100">
            {authError && (
          <form onSubmit={handleLogin} className="space-y-5">

          <h2 className="text-xl font-bold mb-6 text-center text-zinc-800">Acesso Restrito</h2>

          </div>
            <h1 className="font-bold text-3xl tracking-tight text-zinc-900">ComfortPro</h1>
            </div>
              <Package size={26} />
            <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-md">
          <div className="flex items-center gap-2 mb-8 justify-center">
        <Card className="w-full max-w-md p-8 shadow-xl border-t-4 border-t-zinc-900 border-x-0 border-b-0 rounded-2xl">
      <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FA] p-4 font-sans">
    return (
  if (!session) {

  }
    return <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FA]"><div className="animate-spin text-zinc-400"><RefreshCw size={24} /></div></div>;
  if (isAuthLoading) {

  }
    return <PublicTracking token={trackingToken} />;
  if (isTrackingPage) {

  const trackingToken = isTrackingPage ? window.location.pathname.split('/').pop() || null : null;
  const isTrackingPage = window.location.pathname.startsWith('/acompanhar/');

  }, [operationalReportData?.pedidos_concluidos]);
    return [...operationalReportData.pedidos_concluidos];
    if (!operationalReportData?.pedidos_concluidos || !Array.isArray(operationalReportData.pedidos_concluidos)) return [];
  const memoizedOrdersCompleted = React.useMemo(() => {

  }, [reportData?.costsByCollaborator]);
    });
      return costA - costB;
      const costB = (Number(b?.total_cost) || 0) / (Number(b?.pecas) || 1);
      const costA = (Number(a?.total_cost) || 0) / (Number(a?.pecas) || 1);
    return [...reportData.costsByCollaborator].sort((a: any, b: any) => {
    if (!reportData?.costsByCollaborator || !Array.isArray(reportData.costsByCollaborator)) return [];
  const memoizedCostsByCollaborator = React.useMemo(() => {
  // Memoriazação robusta dos dados de custo para evitar crash durante renderização

  const COLORS = React.useMemo(() => ['#18181b', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'], []);


  };
    }
      setNewOrderRequiredStages(stages.filter(s => s.active).map(s => s.id));
    } else {
      }));
        return stage ? stage.active : false;
        const stage = stages.find(s => s.id === id);
      setNewOrderRequiredStages(template.required_stages.filter(id => {
    if (template.required_stages && template.required_stages.length > 0) {
    // Fallback: Se o template não tiver etapas, carrega todas as ativas

    }));
      observations: template.observations
      quantity: template.quantity.toString(),
      print_type: template.print_type,
      product_type: template.product_type,
      ...prev,
    setNewOrderForm(prev => ({
  const applyTemplate = (template: OrderTemplate) => {

  });
    observations: ''
    deadline: '',
    quantity: '',
    print_type: 'Silk',
    product_type: 'Dry Fit',
    client_name: '',
  const [newOrderForm, setNewOrderForm] = useState({
  // New Order Form State

  }, [selectedOrder, selectedStageId, executions, stages, handleStartStage, handleResumeStage, handlePauseStage, handleFinishStage]);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keydown', handleGlobalKeyDown);

    };
      }
          break;
          }
            handleFinishStage(execution.id, stage.id);
          if (execution?.status === 'Em andamento') {
          e.preventDefault();
        case '3':
          break;
          }
            handlePauseStage(execution.id, stage.id);
          if (execution?.status === 'Em andamento') {
          e.preventDefault();
        case '2':
          break;
          }
            handleResumeStage(execution.id);
          } else if (execution.status === 'Pausado') {
            handleStartStage(stage.id);
          if (!execution) {
          if (isFinished) return;
          e.preventDefault();
        case '1':
      switch (e.key) {

      const isFinished = (selectedOrder.stages_status || []).find(s => s.id === selectedStageId)?.finished;
      const execution = (executions || []).find(ex => ex.stage_id === stage.id);
      
      if (!stage) return;
      const stage = stages.find(s => s.id === selectedStageId);
      
      if (!selectedStageId) return;
      // Shortcut logic for the selected stage

      }
        return;
      if (e.target === scanInputRef.current && !isShortcutKey) {
      const isShortcutKey = ['1', '2', '3'].includes(e.key);
      // Also ignore if the scan field is focused but the key is not one of our shortcuts

      }
        return;
        }
          if (stageIds[prevIndex] !== undefined) setSelectedStageId(stageIds[prevIndex]);
          const prevIndex = (currentIndex - 1 + stageIds.length) % Math.max(1, stageIds.length);
        } else {
          if (stageIds[nextIndex] !== undefined) setSelectedStageId(stageIds[nextIndex]);
          const nextIndex = (currentIndex + 1) % Math.max(1, stageIds.length);
        if (e.key === 'ArrowDown') {
        
        const currentIndex = stageIds.indexOf(selectedStageId || -1);
        const stageIds = (selectedOrder.stages_status || []).map(s => s.id);
        e.preventDefault();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // Handle Arrow Navigation

      if (!selectedOrder) return;
      // If no order is selected, we don't handle the numbered shortcuts

      }
        return;
        setSelectedOrder(null);
      if (e.key === 'Escape' && selectedOrder) {
      // Handle Escape even if scan input is focused (to close order)

      }
        return;
      if ((e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) && e.target !== scanInputRef.current) {
      // Ignore input if user is typing in another form field
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
  useEffect(() => {
  // Shortcut Listener at top level to avoid Hook order violation

  }, [selectedOrder]);
    }
      setSelectedStageId(null);
    } else {
      }
          });
            }
              setSelectedOrder(prev => (prev && prev.id === selectedOrder.id ? { ...prev, items: data.items } : prev));
            if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
          .then(({ data }) => {
          .single()
          .eq('id', selectedOrder.id)
          .select('items')
          .from('orders')
        supabase
      if (!selectedOrder.items || selectedOrder.items.length === 0) {
      // Guarantee items are populated for selectedOrder even if orders list was cached or missing items

      }
        setSelectedStageId(orderStages[0].id);
      } else if (orderStages.length > 0) {
        setSelectedStageId(firstUnfinished.id);
      if (firstUnfinished) {
      const firstUnfinished = orderStages.find(s => !s.finished);
      const orderStages = selectedOrder.stages_status || [];
    if (selectedOrder) {
  useEffect(() => {
  // Initialize selectedStageId and ensure items are loaded when order is opened

  }, [currentUser]);
    }
      return () => clearInterval(interval);
      const interval = setInterval(fetchActiveExecution, 30000);
      fetchActiveExecution();
    if (currentUser && currentUser.id !== 0) {
  useEffect(() => {

  }, [activeTab, reportPeriod, reportUser, reportStage, reportStartDate, reportEndDate, reportPrintType]);
    }
      });
        if (data) setProfileReport(data);
      safeFetch(`/api/reports/profiles?startDate=${reportStartDate}&endDate=${reportEndDate}${reportUser ? `&user_id=${reportUser}` : ''}`).then(data => {
      fetchReports();
    if (activeTab === 'reports' || activeTab === 'costs') {
  useEffect(() => {

  }, [activeTab, userSearchTerm]);
    }
      fetchUsers();
    if (activeTab === 'collaborators') {
  useEffect(() => {

  }, [searchTerm, dateRange, selectedStageFilter, selectedStageStatus, productTypeFilter, printTypeFilter, activeTab, currentUser]);
    }
      fetchCollaboratorGoals();
      fetchUsers();
    if (activeTab === 'settings' && currentUser?.role === 'Admin') {
    }
      fetchConfig();
    if (currentUser?.role === 'Admin') {
    fetchData();
  useEffect(() => {

  };
    fetchData();
    });
      body: JSON.stringify({ status })
      },
        'x-user-role': currentUser?.role || ''
        'Content-Type': 'application/json',
      headers: {
      method: 'PATCH',
    await fetch(`/api/orders/${orderId}/status`, {
  const updateOrderStatus = async (orderId: number, status: string) => {

  };
    }
      alert("Erro ao salvar mapeamento de perdas.");
    } else {
      setLossReasonsList(updatedReasons);
      alert("Mapeamento de perdas atualizado!");
    if (res.ok) {
    });
      body: JSON.stringify({ reasons: updatedReasons })
      },
        'x-user-role': currentUser?.role || ''
        'Content-Type': 'application/json',
      headers: {
      method: 'PATCH',
    const res = await fetch('/api/loss-reasons', {
  const handleSaveLossReasonsMapping = async (updatedReasons: LossReasonSetting[]) => {

  };
    }
      alert(err.error || "Erro ao registrar perda");
      const err = await res.json();
    } else {
      fetchActiveExecution();
      fetchExecutions(selectedOrder.id);
      fetchData();
      alert("Perda registrada com sucesso! A pendência de reposição foi enviada para a etapa de reentrada.");
      setIsLossModalOpen(false);
    if (res.ok) {
    });
      })
        user_name: currentUser?.name || 'Operador'
        user_id: currentUser?.id || 1,
        etapa_reentrada_id: lossReentryStageIdInput,
        motivo_detalhe: lossReasonDetailInput,
        motivo: lossReasonInput,
        quantidade_perdida: lossQtyInput,
      body: JSON.stringify({
      },
        'x-user-role': currentUser?.role || ''
        'Content-Type': 'application/json',
      headers: {
      method: 'POST',
    const res = await fetch(`/api/orders/${selectedOrder.id}/stages/${lossStageId}/loss`, {
    }
      return;
      alert("Por favor, informe o detalhamento do motivo 'Outro'.");
    if (lossReasonInput === 'Outro' && !lossReasonDetailInput.trim()) {
    if (!selectedOrder || !lossStageId || lossQtyInput <= 0 || !lossReasonInput) return;
  const handleSaveLoss = async () => {

  };
    setIsLossModalOpen(true);
    setLossReentryStageIdInput(defaultReentry);
    const defaultReentry = lossReasonsList.find(r => r.motivo === initialReason)?.etapa_reentrada_id || stageId;
    setLossReasonDetailInput('');
    setLossReasonInput(initialReason);
    const initialReason = lossReasonsList.length > 0 ? lossReasonsList[0].motivo : 'Defeito de corte';
    setLossQtyInput(1);
    setLossStageId(stageId);
  const handleOpenLossModal = (stageId: number) => {

  };
    }
      alert(err.error || "Erro ao registrar progresso");
      const err = await res.json();
    } else {
      fetchActiveExecution();
      fetchExecutions(selectedOrder.id);
      fetchData();
      setIsProgressModalOpen(false);
    if (res.ok) {
    });
      })
        user_name: currentUser?.name || 'Operador'
        user_id: currentUser?.id || 1,
        incremento: progressIncrementInput,
      body: JSON.stringify({
      },
        'x-user-role': currentUser?.role || ''
        'Content-Type': 'application/json',
      headers: {
      method: 'POST',
    const res = await fetch(`/api/orders/${selectedOrder.id}/stages/${progressStageId}/progress`, {
    if (!selectedOrder || !progressStageId || progressIncrementInput <= 0) return;
  const handleSaveProgress = async () => {

  };
    setIsProgressModalOpen(true);
    setProgressIncrementInput(0);
    setProgressStageId(stageId);
  const handleOpenProgressModal = (stageId: number) => {

  };
    fetchActiveExecution();
    fetchExecutions(selectedOrder!.id);
    });
      headers: { 'x-user-role': currentUser?.role || '' }
      method: 'POST',
    await fetch(`/api/executions/${executionId}/resume`, {
  const handleResumeStage = async (executionId: number) => {

  };
    }
      setIsActionLoading(false);
    } finally {
      }
        }
          }
            alert(err.error || "Erro ao finalizar etapa");
          } else {
            }
              await handleConfirmExecutionAction('finish', true);
            if (confirmForce) {
            );
              `${err.error}\n\nDeseja forçar a finalização desta etapa com saldo parcial?`
            const confirmForce = window.confirm(
          if (err.canForce && !forceFinish) {
          const err = await finishRes.json();
        } else {
          fetchActiveExecution();
          fetchData();
          fetchExecutions(selectedOrder.id);
          setExecutionActionModal(null);
        if (finishRes.ok) {

        });
          body: JSON.stringify({ force: forceFinish, observation: actionObservationInput })
          },
            'x-user-role': currentUser?.role || ''
            'Content-Type': 'application/json',
          headers: {
          method: 'POST',
        const finishRes = await fetch(`/api/executions/${executionId}/finish`, {
      } else if (type === 'finish') {
        fetchActiveExecution();
        fetchData();
        fetchExecutions(selectedOrder.id);
        setExecutionActionModal(null);
        });
          body: JSON.stringify({ observation: actionObservationInput })
          },
            'x-user-role': currentUser?.role || ''
            'Content-Type': 'application/json',
          headers: {
          method: 'POST',
        await fetch(`/api/executions/${executionId}/pause`, {
      if (type === 'pause') {
      // 3. Executa a Pausa ou a Finalização

      }
        }
          return;
          alert(err.error || "Erro ao registrar perda.");
          const err = await lossRes.json();
        if (!lossRes.ok) {
        });
          })
            user_name: currentUser?.name || 'Operador'
            user_id: currentUser?.id || 1,
            etapa_reentrada_id: actionLossReentryStageIdInput || stageId,
            motivo_detalhe: actionLossReasonDetailInput,
            motivo: actionLossReasonInput,
            quantidade_perdida: actionLossQuantityInput,
          body: JSON.stringify({
          },
            'x-user-role': currentUser?.role || ''
            'Content-Type': 'application/json',
          headers: {
          method: 'POST',
        const lossRes = await fetch(`/api/orders/${selectedOrder.id}/stages/${stageId}/loss`, {
      if (actionLossQuantityInput > 0) {
      // 2. Se informou peças perdidas > 0, registra a perda

      }
        }
          return;
          alert(err.error || "Erro ao registrar progresso.");
          const err = await progRes.json();
        if (!progRes.ok) {
        });
          })
            user_name: currentUser?.name || 'Operador'
            user_id: currentUser?.id || 1,
            incremento: actionQuantityInput,
          body: JSON.stringify({
          },
            'x-user-role': currentUser?.role || ''
            'Content-Type': 'application/json',
          headers: {
          method: 'POST',
        const progRes = await fetch(`/api/orders/${selectedOrder.id}/stages/${stageId}/progress`, {
      if (actionQuantityInput > 0) {
      // 1. Se informou quantidade de peças boas > 0, registra o progresso primeiro
    try {
    setIsActionLoading(true);

    }
      }
        return;
        alert("Por favor, informe o detalhamento do motivo 'Outro'.");
      if (actionLossReasonInput === 'Outro' && !actionLossReasonDetailInput.trim()) {
      }
        return;
        alert("Por favor, selecione o motivo da perda.");
      if (!actionLossReasonInput) {
    if (actionLossQuantityInput > 0) {
    // Validação do motivo se informou perdas

    const type = actionType || executionActionModal.type;
    const { executionId, stageId } = executionActionModal;
    if (!executionActionModal || !selectedOrder) return;
  const handleConfirmExecutionAction = async (actionType?: 'pause' | 'finish', forceFinish = false) => {

  };
    handleOpenActionModal('finish', executionId, stageId);
  const handleFinishStage = (executionId: number, stageId: number) => {

  };
    handleOpenActionModal('pause', executionId, stageId);
  const handlePauseStage = (executionId: number, stageId: number) => {

  };
    setExecutionActionModal({ type, executionId, stageId });
    setActionObservationInput('');
    setShowActionLossSection(false);
    setActionLossReentryStageIdInput(defaultReentry);
    const defaultReentry = lossReasonsList.find(r => r.motivo === initialReason)?.etapa_reentrada_id || stageId;
    setActionLossReasonDetailInput('');
    setActionLossReasonInput(initialReason);
    const initialReason = lossReasonsList.length > 0 ? lossReasonsList[0].motivo : 'Defeito de corte';
    setActionLossQuantityInput(0);
    setActionQuantityInput(0);
  const handleOpenActionModal = (type: 'pause' | 'finish', executionId: number, stageId: number) => {

  };
    }
      fetchData(); // Rollback local state
      alert("Erro ao reordenar etapas.");
    } catch (err) {
      fetchData(); // Refresh to ensure backend sync
      ]);
        })
          body: JSON.stringify({ sort_order: stageB.sort_order })
          },
            'x-user-role': currentUser?.role || ''
            'Content-Type': 'application/json',
          headers: {
          method: 'PATCH',
        fetch(`/api/stages/${stageB.id}`, {
        }),
          body: JSON.stringify({ sort_order: stageA.sort_order })
          },
            'x-user-role': currentUser?.role || ''
            'Content-Type': 'application/json',
          headers: {
          method: 'PATCH',
        fetch(`/api/stages/${stageA.id}`, {
      await Promise.all([
    try {

    setStages(newStages);

    stageB.sort_order = tempSortOrder;
    stageA.sort_order = stageB.sort_order;
    const tempSortOrder = stageA.sort_order;
    // Swap sort_order values

    newStages[newIndex] = stageA;
    newStages[currentIndex] = stageB;
    // Swap in local state

    const stageB = newStages[newIndex];
    const stageA = newStages[currentIndex];
    const newStages = [...stages];

    if (newIndex < 0 || newIndex >= stages.length) return;
    const newIndex = currentIndex + direction;
  const moveStage = async (currentIndex: number, direction: 1 | -1) => {

  };
    }
      alert(err.error);
      const err = await res.json();
    } else {
      fetchActiveExecution();
      fetchData();
      fetchExecutions(selectedOrder.id);
    if (res.ok) {
    });
      body: JSON.stringify({ order_id: selectedOrder.id, stage_id: stageId, user_id: currentUser!.id })
      },
        'x-user-role': currentUser?.role || ''
        'Content-Type': 'application/json',
      headers: {
      method: 'POST',
    const res = await fetch('/api/executions/start', {
    
    if (!confirmStart) return;
    const confirmStart = window.confirm(`Operador atual: ${currentUser?.name}\nEtapa: ${stageName}\n\nDeseja iniciar esta tarefa?`);
    const stageName = stages.find(s => s.id === stageId)?.name || 'Etapa';
    // Confirmação ao iniciar tarefa
    
    if (!selectedOrder) return;
  const handleStartStage = async (stageId: number) => {

  };
    }
      setIsUploadingArt(false);
    } finally {
      alert('Erro ao adicionar imagens. Tente novamente.');
    } catch (err) {
      fetchData(); // Refresh all orders
      }
        });
          art_urls: data.art_urls
          ...selectedOrder,
        setSelectedOrder({
      if (selectedOrder && selectedOrder.id === orderId) {
      // Update local state for the selected order
      const data = await res.json();

      }
        throw new Error(`${errData?.error || 'Falha no upload'}${details}`);
        const details = errData?.details ? `\n\nDetalhes:\n${errData.details.join('\n')}` : '';
        const errData = await res.json().catch(() => null);
      if (!res.ok) {

      });
        body: formData
        method: 'POST',
      const res = await fetch(`/api/orders/${orderId}/images`, {
    try {

    }
      formData.append('art_files', files[i]);
    for (let i = 0; i < files.length; i++) {
    const formData = new FormData();

    setIsUploadingArt(true);

    }
      }
        return;
        alert(`O arquivo "${files[i].name}" é muito grande. O limite máximo é de 4MB por arquivo.`);
      if (files[i].size > MAX_FILE_SIZE) {
    for (let i = 0; i < files.length; i++) {
    const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
    // Check file sizes (max 4MB to avoid Vercel limit)
  const handleAddImages = async (orderId: number, files: FileList) => {

  };
    setIsLoadingHistory(false);
    setOrderHistory(data || []);
    const data = await safeFetch(`/api/orders/${orderId}/history`);
    setShowHistoryModal(true);
    setIsLoadingHistory(true);
  const handleViewHistory = async (orderId: number) => {

  };
    }
      setIsEditingOrder(false);
    } finally {
      alert('Erro na conexão com o servidor');
    } catch (err) {
      }
        alert(err.error || err.message || 'Erro ao editar pedido');
        const err = await res.json();
      } else {
        setSelectedOrder({ ...selectedOrder, ...editOrderForm } as Order);
        // Update local selectedOrder state
        fetchData();
        setShowEditOrderModal(false);
      if (res.ok) {

      });
        body: JSON.stringify(editOrderForm)
        },
          ...extraHeaders
          'x-user-name': currentUser?.name || 'Admin',
          'x-user-role': currentUser?.role || '',
          'Content-Type': 'application/json',
        headers: {
        method: 'PATCH',
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {

      }
        extraHeaders['x-confirm-finalized'] = 'true';
        if (!confirmed) { setIsEditingOrder(false); return; }
        const confirmed = window.confirm('⚠️ PEDIDO JÁ ENTREGUE\n\nEste pedido já foi marcado como entregue. Editar pode afetar indicadores históricos.\n\nDeseja continuar?');
      if (selectedOrder.status === 'Entregue') {
      const extraHeaders: any = {};
    try {
    setIsEditingOrder(true);

    }
      return;
      alert('Número de cores deve ser pelo menos 1.');
    if (!editOrderForm.num_colors || Number(editOrderForm.num_colors) < 1) {
    }
      return;
      alert('Quantidade deve ser maior que zero.');
    if (!editOrderForm.quantity || Number(editOrderForm.quantity) <= 0) {
    // Client-side validation

    if (!selectedOrder) return;
  const handleEditOrderSubmit = async () => {

  };
    });
      setEditOrderHasExecutions(execs && execs.length > 0);
    safeFetch(`/api/orders/${order.id}/executions`).then(execs => {
    // Check if order has executions in the background

    setShowEditOrderModal(true);
    // Open modal immediately to prevent "nothing happens" feeling

    });
      art_url: order.art_url,
      art_urls: order.art_urls || (order.art_url ? [order.art_url] : []),
      num_colors: order.num_colors || 1,
      }),
        return stage ? stage.active : false;
        const stage = stages.find(s => s.id === id);
      required_stages: (order.required_stages || []).filter(id => {
      observations: order.observations,
      deadline: order.deadline ? order.deadline.split('T')[0] : '',
      quantity: order.quantity,
      print_type: order.print_type,
      product_type: order.product_type,
      client_name: order.client_name,
    setEditOrderForm({
  const openEditOrderModal = (order: Order) => {

  };
    }
      setIsCancellingOrder(false);
    } finally {
      alert('Erro na conexão com o servidor');
    } catch (err) {
      }
        alert(err.error || 'Erro ao cancelar pedido');
        const err = await res.json();
      } else {
        }
          setSelectedOrder({ ...selectedOrder, status: 'Cancelado' });
        if (selectedOrder && selectedOrder.id === orderId) {
        fetchData();
      if (res.ok) {
      });
        }
          'x-user-name': currentUser?.name || 'Admin'
          'x-user-role': currentUser?.role || '',
        headers: {
        method: 'PATCH',
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
    try {
    setIsCancellingOrder(true);

    if (!window.confirm('⚠️ CANCELAR PEDIDO\n\nO pedido será marcado como cancelado e removido dos cálculos de capacidade. O histórico será mantido.\n\nDeseja continuar?')) return;
  const handleCancelOrder = async (orderId: number) => {

  };
    }
      setIsGeneratingLink(false);
    } finally {
      alert(err.message || 'Erro ao gerar e copiar link de acompanhamento.');
      console.error('[Tracking Link] Error:', err);
    } catch (err: any) {
      showToast('Link copiado!');
      await navigator.clipboard.writeText(trackingUrl);
      const trackingUrl = `${window.location.origin}/acompanhar/${token}`;
      const token = data.tracking_token;

      }
        throw new Error(data.error || 'Erro ao gerar link de acompanhamento');
      if (!res.ok) {
      const data = await res.json();
      });
        }
          'x-user-name': currentUser?.name || 'Operador',
          'x-user-role': currentUser?.role || 'Produção',
          'Content-Type': 'application/json',
        headers: {
        method: 'POST',
      const res = await fetch(`/api/orders/${order.id}/tracking-token`, {
    try {
    setIsGeneratingLink(true);
  const handleGenerateTrackingLink = async (order: Order) => {

  };
    }, 3000);
      setToastMessage(null);
    setTimeout(() => {
    setToastMessage(msg);
  const showToast = (msg: string) => {

  };
    }
      setIsDeletingOrder(false);
    } finally {
      alert('Erro na conexão com o servidor');
    } catch (err) {
      }
        alert(err.error || 'Erro ao excluir pedido');
        const err = await res.json();
      } else {
        fetchData();
        setSelectedOrder(null);
      if (res.ok) {

      });
        }
          'x-user-name': currentUser?.name || 'Admin'
          'x-user-role': currentUser?.role || '',
        headers: {
        method: 'DELETE',
      const res = await fetch(`/api/orders/${orderId}`, {
    try {
    setIsDeletingOrder(true);

    if (!window.confirm('⚠️ EXCLUIR PEDIDO\n\nO pedido será ocultado do sistema mas o histórico de execuções será mantido para auditoria.\n\nDeseja continuar?')) return;
  const handleDeleteOrder = async (orderId: number) => {

  };
    }
      }, 4000); // 4 seconds auto-reset
        setConfirmingDtfOrderId(null);
      confirmTimeoutRef.current = setTimeout(() => {
      setConfirmingDtfOrderId(orderId);
    } else {
      setConfirmingDtfOrderId(null);
    if (confirmingDtfOrderId === orderId) {
    
    }
      clearTimeout(confirmTimeoutRef.current);
    if (confirmTimeoutRef.current) {
    e.stopPropagation();
  const handleRequestToggleDtf = (orderId: number, e: React.MouseEvent) => {

  };
    }
      console.error(e);
    } catch (e) {
      }
        console.warn('Servidor respondeu com código de aviso/erro ao atualizar gaveteiro.');
      if (!res.ok) {
      });
        body: JSON.stringify({ dtf_location: location })
        },
          'x-user-name': currentUser?.name || 'Admin'
          'x-user-role': currentUser?.role || '',
          'Content-Type': 'application/json',
        headers: {
        method: 'PATCH',
      const res = await fetch(`/api/orders/${orderId}/dtf`, {
    try {

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, dtf_location: location } : o));
    }
      setSelectedOrder({ ...selectedOrder, dtf_location: location });
    if (selectedOrder && selectedOrder.id === orderId) {
  const handleUpdateDtfLocation = async (orderId: number, location: string) => {

  };
    fetchData();
    }
      alert('Erro ao atualizar status do DTF.');
      }
        setSelectedOrder({ ...selectedOrder, dtf_complete: currentStatus });
      if (selectedOrder && selectedOrder.id === orderId) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, dtf_complete: currentStatus } : o));
      // Revert status on failure
      console.error(e);
    } catch (e) {
      }
        throw new Error('Falha ao atualizar status do DTF');
      if (!res.ok) {
      });
        body: JSON.stringify({ dtf_complete: nextStatus })
        },
          'x-user-name': currentUser?.name || 'Admin'
          'x-user-role': currentUser?.role || '',
          'Content-Type': 'application/json',
        headers: {
        method: 'PATCH',
      const res = await fetch(`/api/orders/${orderId}/dtf`, {
    try {

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, dtf_complete: nextStatus } : o));
    }
      setSelectedOrder({ ...selectedOrder, dtf_complete: nextStatus });
    if (selectedOrder && selectedOrder.id === orderId) {
    // Optimistic UI updates
    
    const nextStatus = !currentStatus;
  const handleToggleDtf = async (orderId: number, currentStatus: boolean) => {

  };
    }
      setSelectedOrder({ ...selectedOrder, deadline: newDeadline });
    if (selectedOrder && selectedOrder.id === orderId) {
    fetchData();
    });
      body: JSON.stringify({ deadline: newDeadline })
      },
        'x-user-role': currentUser?.role || ''
        'Content-Type': 'application/json',
      headers: {
      method: 'PATCH',
    await fetch(`/api/orders/${orderId}`, {
  const handleUpdateDeadline = async (orderId: number, newDeadline: string) => {

  };
    setIsLoadingForecast(false);
    if (data) setForecastData(data);
    const data = await safeFetch('/api/orders/delivery-forecast');
    setIsLoadingForecast(true);
  const fetchForecast = async () => {

  }, [currentUser, autoPauseTimeWeekday, autoPauseTimeFriday, autoPauseTimeLunch]);
    return () => clearInterval(interval);
    const interval = setInterval(check, 60000);
    check();
    // Verifica imediatamente ao montar e depois a cada minuto
    
    };
      }
          .catch(console.error);
          })
            }
              fetchData(); // Atualiza a UI para refletir as pausas
              console.log(`[AutoPause] ${r.paused} tarefa(s) pausada(s) - ${reason}.`);
              const reason = r.reason === 'almoço' ? 'almoço' : 'fim de expediente';
            if (r?.paused > 0) {
          .then((r) => {
        safeFetch('/api/executions/auto-pause', { method: 'POST' })
        // Chamamos o novo endpoint robusto que valida o horário no server-side
      if (isLunch || isEndOfDay) {

      const isEndOfDay = checkTime(dayOfWeek === 5 ? autoPauseTimeFriday : autoPauseTimeWeekday);
      const isLunch = checkTime(autoPauseTimeLunch);

      };
        return now.getHours() === hh && now.getMinutes() === mm;
        // O backend possui uma janela de ±3 min como margem de segurança
        // No frontend, mantemos a verificação do exato minuto para disparar apenas uma vez
        const [hh, mm] = target.split(':').map(Number);
        if (!target) return false;
      const checkTime = (target: string) => {

      if (dayOfWeek === 0 || dayOfWeek === 6) return; // Ignora fins de semana
      const dayOfWeek = now.getDay(); // 0=Dom, 1=Seg, ..., 5=Sex, 6=Sab
      const now = new Date();
    const check = () => {
    
    if (!currentUser) return; // Qualquer usuário logado pode disparar a verificação
  useEffect(() => {
  // Agendador de pausa automática: verifica o horário a cada minuto

  };
    }
      if (data.auto_pause_time_lunch) setAutoPauseTimeLunch(data.auto_pause_time_lunch);
      if (data.auto_pause_time_friday) setAutoPauseTimeFriday(data.auto_pause_time_friday);
      if (data.auto_pause_time_weekday) setAutoPauseTimeWeekday(data.auto_pause_time_weekday);
      if (data.meta_custo_por_peca !== undefined) setMetaCustoPeca(data.meta_custo_por_peca);
    if (data) {
    const data = await safeFetch('/api/config');
  const fetchConfig = async () => {

  };
    if (data) setOperationalReportData(data);
    const data = await safeFetch(url);
    if (reportPrintType) url += `&print_type=${encodeURIComponent(reportPrintType)}`;
    let url = `/api/reports/operational?startDate=${reportStartDate}&endDate=${reportEndDate}`;
  const fetchOperationalReport = async () => {

  };
    fetchOperationalReport();

    if (reasonsData) setLossReasonsList(reasonsData);
    const reasonsData = await safeFetch('/api/loss-reasons');

    if (lossData) setLossReportData(lossData);
    const lossData = await safeFetch(`/api/reports/losses?startDate=${reportStartDate}&endDate=${reportEndDate}`);

    if (goalsData) setGoalsProductivityData(goalsData);
    const goalsData = await safeFetch('/api/reports/goals-productivity');

    if (profileData) setProfileReport(profileData || []);
    const profileData = await safeFetch(`/api/reports/profiles?startDate=${reportStartDate}&endDate=${reportEndDate}${reportPrintType ? `&print_type=${encodeURIComponent(reportPrintType)}` : ''}`);

    if (delaysData) setDelaysReportData(delaysData);
    const delaysData = await safeFetch(`/api/reports/delays?startDate=${reportStartDate}&endDate=${reportEndDate}${reportPrintType ? `&print_type=${encodeURIComponent(reportPrintType)}` : ''}`);

    if (deliveryData) setDeliveryReportData(deliveryData);
    const deliveryData = await safeFetch(`/api/reports/delivery?period=${reportPeriod}&startDate=${reportStartDate}&endDate=${reportEndDate}${reportPrintType ? `&print_type=${encodeURIComponent(reportPrintType)}` : ''}`);

    if (data) setReportData(data);
    const data = await safeFetch(url);

    if (reportPrintType) url += `&print_type=${encodeURIComponent(reportPrintType)}`;
    if (reportStage) url += `&stage_id=${reportStage}`;
    if (reportUser) url += `&user_id=${reportUser}`;
    let url = `/api/reports?period=${reportPeriod}&startDate=${reportStartDate}&endDate=${reportEndDate}&tzOffset=${tzOffset}`;
    const tzOffset = new Date().getTimezoneOffset();
  const fetchReports = async () => {

  };
    setOrderStageObservations(obsData || []);
    }
      }
        console.warn('[fetchExecutions] Fallback stage_observations falhou:', err);
      } catch (err) {
        }
          }));
            user_name: o.users?.name || 'Operador'
            ...o,
          obsData = sbObs.map((o: any) => ({
        if (sbObs) {
          .order('created_at', { ascending: false });
          .eq('order_id', orderId)
          .select('*, users(name)')
          .from('stage_observations' as any)
        const { data: sbObs } = await supabase
      try {
    if (!obsData) {
    let obsData = await safeFetch(`/api/orders/${orderId}/stage-observations`);
    if (data) setExecutions(data);
    const data = await safeFetch(`/api/orders/${orderId}/executions`);
  const fetchExecutions = async (orderId: number) => {

  };
    if (data) setUsers(data);
    const data = await safeFetch(`/api/users?search=${encodeURIComponent(userSearchTerm)}`);
  const fetchUsers = async () => {

  };
    if (data) setCollaboratorGoals(data);
    const data = await safeFetch('/api/collaborator-goals');
  const fetchCollaboratorGoals = async () => {

  };
    }
      alert(`Erro ao limpar rascunhos: ${err.message}`);
    } catch (err: any) {
      alert('Rascunhos antigos limpos com sucesso!');
      await fetchDraftOrders();
      if (!res.ok) throw new Error(data.error || 'Erro ao limpar rascunhos antigos');
      const data = await res.json();
      });
        body: JSON.stringify({ days: 7 })
        },
          'x-user-name': currentUser?.name || 'Vendedora'
          'Content-Type': 'application/json',
        headers: {
        method: 'POST',
      const res = await fetch('/api/orders/drafts/cleanup', {
    try {
    if (!confirm('Deseja excluir os rascunhos de pedidos antigos com mais de 7 dias?')) return;
  const handleCleanOldDrafts = async () => {

  };
    }
      alert(`Erro ao excluir rascunho: ${err.message}`);
    } catch (err: any) {
      await fetchDraftOrders();
      }
        setSelectedDraftOrder(null);
      if (selectedDraftOrder?.id === draftId) {

      if (!res.ok) throw new Error(data.error || 'Erro ao excluir rascunho');
      const data = await res.json();
      });
        headers: { 'x-user-name': currentUser?.name || 'Vendedora' }
        method: 'DELETE',
      const res = await fetch(`/api/orders/drafts/${draftId}`, {
    try {
    if (!confirm('Tem certeza que deseja excluir este rascunho de pedido?')) return;
  const handleDeleteDraftOrder = async (draftId: number) => {

  };
    }
      setIsConfirmingDraft(false);
    } finally {
      alert(`Erro ao liberar pedido: ${err.message}`);
    } catch (err: any) {
      alert(`Pedido #${selectedDraftOrder.order_number} liberado para produção com sucesso!`);
      await fetchDraftOrders();
      await fetchData();
      setSelectedDraftOrder(null);

      if (!res.ok) throw new Error(data.error || 'Erro ao liberar pedido para produção');
      const data = await res.json();
      });
        body: JSON.stringify(confirmDraftForm)
        },
          'x-user-name': currentUser?.name || 'Vendedora'
          'Content-Type': 'application/json',
        headers: {
        method: 'POST',
      const res = await fetch(`/api/orders/${selectedDraftOrder.id}/confirm-draft`, {
    try {
    setIsConfirmingDraft(true);
    if (!selectedDraftOrder) return;
  const handleConfirmDraftOrder = async () => {

  };
    });
      required_stages: order.required_stages && order.required_stages.length > 0 ? order.required_stages : stages.filter(s => s.active).map(s => s.id)
      observations: order.observations || '',
      num_colors: order.num_colors || 1,
      product_type: order.product_type || 'Dry Fit',
      print_type: (order.print_type && ['DTF', 'Silk', 'Sublimação', 'Bordado'].includes(order.print_type) ? order.print_type : 'DTF') as any,
    setConfirmDraftForm({
    setSelectedDraftOrder(order);
  const handleOpenDraftReview = (order: Order) => {

  };
    }
      setIsSyncingOlist(false);
    } finally {
      alert(`Erro na sincronização Olist: ${err.message}`);
    } catch (err: any) {
      alert(msg);
      }
        }
          msg += `\nPrimeiro erro: ${data.errors[0]?.error || JSON.stringify(data.errors[0])}`;
        if (data.errors && data.errors.length > 0) {
        msg += `\n⚠️ Erros: ${data.errors_count}`;
      if (data.errors_count > 0) {
      msg += `Pedidos ignorados (já importados): ${data.skipped_count || 0}`;
      msg += `Novos rascunhos importados: ${data.imported_count || 0}\n`;
      msg += `Pedidos elegíveis (De hoje em diante): ${data.eligible_count || 0}\n`;
      msg += `Pedidos encontrados no Tiny (Histórico): ${data.total_found || 0}\n`;
      let msg = `Sincronização concluída com sucesso!\n`;

      await fetchDraftOrders();
      await fetchData();

      if (!res.ok) throw new Error(data.error || 'Erro ao sincronizar com Olist ERP');

      }
        throw new Error(`O servidor retornou uma resposta inesperada (HTTP ${res.status}). Tente novamente em alguns instantes.`);
        const text = await res.text();
      } else {
        data = await res.json();
      if (contentType.includes('application/json')) {
      let data: any = {};
      
      const contentType = res.headers.get('content-type') || '';
      });
        body: JSON.stringify({ days: 1 })
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      const res = await fetch('/api/integrations/olist/sync', {
    try {
    setIsSyncingOlist(true);
  const handleSyncOlist = async () => {

  };
    }
      setDraftOrders(data);
    if (data && Array.isArray(data)) {
    const data = await safeFetch('/api/orders/drafts');
  const fetchDraftOrders = async () => {

  };
    if (forecastResult) setForecastData(forecastResult);
    const forecastResult = await safeFetch('/api/orders/delivery-forecast');
    // Always refresh forecast when data changes

    fetchDraftOrders();
    fetchCollaboratorGoals();
    if (templatesData) setTemplates(templatesData);
    if (statsData) setStats(statsData);
    if (Array.isArray(stagesData)) setStages(stagesData);
    }
      setOrders(sortedOrders);
      });
        return (isNaN(timeA) ? Infinity : timeA) - (isNaN(timeB) ? Infinity : timeB);
        const timeB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        const timeA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const sortedOrders = [...ordersData].sort((a: Order, b: Order) => {
      // Prioridade visual por prazo (crescente)
    if (Array.isArray(ordersData)) {

    }
      } catch (err) {}
        }
          stagesData = fallbackStages;
        if (Array.isArray(fallbackStages)) {
        const { data: fallbackStages } = await supabase.from('stages').select('*').order('sort_order', { ascending: true });
      try {
    if (!Array.isArray(stagesData)) {

    }
      }
        console.error('[FetchData] Erro no fallback do Supabase:', err);
      } catch (err) {
        }
          }
            });
              order.active_stage_observation = null;
              order.active_stage_name = activeStage?.name || null;
              const activeStage = order.stages_status.find((s: any) => !s.finished);
            ordersData.forEach((order: any) => {
            console.warn('[FetchData] Falha ao buscar observações no fallback:', err);
          } catch (err) {
            }
              });
                order.active_stage_observation = null;
                order.active_stage_name = activeStage?.name || null;
                const activeStage = order.stages_status.find((s: any) => !s.finished);
              ordersData.forEach((order: any) => {
            } else {
              });
                order.active_stage_observation = newestObs ? newestObs.text : null;
                }
                  }
                    }
                      };
                        time: obsTime
                        text: obsObj.observation,
                      newestObs = {
                    if (!newestObs || obsTime > newestObs.time) {
                    const obsTime = new Date(obsObj.created_at).getTime();
                  if (obsObj) {
                  const obsObj = obsMap.get(obsKey);
                  const obsKey = `${order.id}_${st.id}`;
                for (const st of unfinishedStages) {
                let newestObs = null;
                const unfinishedStages = (order.stages_status || []).filter((s: any) => !s.finished);
                
                order.active_stage_name = activeStage?.name || null;
                const activeStage = order.stages_status.find((s: any) => !s.finished);
              ordersData.forEach((order: any) => {

              });
                }
                  });
                    created_at: obs.created_at
                    observation: obs.observation,
                  obsMap.set(key, {
                if (!obsMap.has(key)) {
                const key = `${obs.order_id}_${obs.stage_id}`;
              obsData.forEach((obs: any) => {
              const obsMap = new Map();
            if (obsData) {

              .order('created_at', { ascending: false });
              .in('order_id', orderIds)
              .select('order_id, stage_id, observation, created_at')
              .from('stage_observations' as any)
            const { data: obsData } = await supabase
            const orderIds = ordersData.map((o: any) => o.id);
          try {

          }
            console.warn('[FetchData] Erro ao enriquecer items no fallback:', err);
          } catch (err) {
            }
              }
                });
                  order.items = itemsMap.get(order.id) || [];
                ordersData.forEach((order: any) => {
                });
                  if (row.items) itemsMap.set(row.id, row.items);
                dbItems.forEach((row: any) => {
                const itemsMap = new Map();
              if (dbItems) {
                .in('id', orderIds);
                .select('id, items')
                .from('orders')
              const { data: dbItems } = await supabase
            if (orderIds.length > 0) {
            const orderIds = ordersData.map((o: any) => o.id);
          try {
          // Enrich fallbackOrders with items column

          }));
            stages_status: Array.isArray(o.stages_status) ? o.stages_status : []
            ...o,
          ordersData = fallbackOrders.map((o: any) => ({
        if (Array.isArray(fallbackOrders)) {

        }
          }
            fallbackOrders = directOrders;
          if (Array.isArray(directOrders)) {
            .order('deadline', { ascending: true });
            .is('deleted_at', null)
            .select('*')
            .from('orders')
          const { data: directOrders } = await supabase
        if (!Array.isArray(fallbackOrders) || fallbackOrders.length === 0) {

        });
          p_print_type: printTypeFilter || null,
          p_product_type: productTypeFilter || null,
          p_stage_status: selectedStageStatus || null,
          p_stage_id: selectedStageFilter ? Number(selectedStageFilter) : null,
          p_search: searchTerm || null,
        let { data: fallbackOrders } = await supabase.rpc('get_orders_with_stages', {
      try {
      console.warn('[FetchData] /api/orders indisponível via API. Executando fallback direto ao Supabase...');
    if (!Array.isArray(ordersData)) {
    // Fallback para consulta direta ao Supabase caso a API REST do backend falhe ou retorne nulo

    ]);
      safeFetch('/api/order-templates')
      safeFetch(statsUrl),
      safeFetch('/api/stages'),
      safeFetch(ordersUrl),
    let [ordersData, stagesData, statsData, templatesData] = await Promise.all([

    }
      ordersUrl += `&print_type=${encodeURIComponent(printTypeFilter)}`;
    if (printTypeFilter) {
    }
      ordersUrl += `&product_type=${encodeURIComponent(productTypeFilter)}`;
    if (productTypeFilter) {
    }
      ordersUrl += `&stage_id=${selectedStageFilter}&stage_status=${selectedStageStatus}`;
    if (selectedStageFilter) {
    let ordersUrl = `/api/orders?search=${encodeURIComponent(searchTerm)}`;

    }
      statsUrl += `print_type=${printTypeFilter}&`;
    if (printTypeFilter) {
    }
      statsUrl += `product_type=${productTypeFilter}&`;
    if (productTypeFilter) {
    }
      statsUrl += `startDate=${dateRange.start}&endDate=${dateRange.end}&`;
    if (dateRange) {
    let statsUrl = '/api/dashboard/stats?';
  const fetchData = async () => {

  };
    setActiveExecutions(data || []);
    const data = await safeFetch(`/api/executions/active/${currentUser.id}`);
    if (!currentUser || currentUser.id === 0) return;
  const fetchActiveExecution = async () => {

  };
    }
      return null;
      console.error(`Fetch exception for ${url}:`, err);
    } catch (err) {
      return null;
      }
        return await res.json();
      if (contentType && contentType.includes("application/json")) {
      const contentType = res.headers.get("content-type");
      }
        return null;
        console.error(`Fetch error ${res.status}: ${errorText}`);
        const errorText = await res.text();
      if (!res.ok) {
      });
        }
          ...(options?.headers || {})
          ...roleHeaders,
        headers: {
        ...options,
      const res = await fetch(url, {

      }
        roleHeaders['x-user-name'] = currentUser.name;
        roleHeaders['x-user-role'] = currentUser.role;
      if (currentUser?.role) {
      const roleHeaders: any = {};
      // Automatically inject role and user-name headers if user is logged in
    try {
  const safeFetch = async (url: string, options?: RequestInit) => {

  };
    await supabase.auth.signOut();
  const handleLogout = async () => {

  };
    setIsAuthLoading(false);
    if (error) setAuthError(error.message);
    });
      password: authPassword,
      email: authEmail,
    const { error } = await supabase.auth.signInWithPassword({
    setIsAuthLoading(true);
    setAuthError('');
    e.preventDefault();
  const handleLogin = async (e: React.FormEvent) => {

  }, [session]);
    }
      setCurrentUser(null);
    } else {
      });
        }
          setCurrentUser({ id: 0, name: session.user.email, email: session.user.email, role: 'Produção', hourly_cost: 0, active: true });
          console.warn(`[Auth] Usuário não encontrado na tabela 'users': ${userEmail}`);
        } else {
          setCurrentUser(found);
        if (found) {
        const found = data?.find((u: User) => u.email?.toLowerCase() === userEmail);
      safeFetch(`/api/users?search=${encodeURIComponent(userEmail)}`).then(data => {
      const userEmail = session.user.email.toLowerCase();
    if (session?.user?.email) {
  useEffect(() => {

  }, []);
    return () => subscription.unsubscribe();

    });
      setSession(session);
    } = supabase.auth.onAuthStateChange((_event, session) => {
      data: { subscription },
    const {

    });
      setIsAuthLoading(false);
      setSession(session);
    supabase.auth.getSession().then(({ data: { session } }) => {
  useEffect(() => {

  }, []);
    return () => clearInterval(timer);
    }, 1000);
      setNow(new Date());
    const timer = setInterval(() => {
  useEffect(() => {

  };
    return ext === 'pdf';
    const ext = cleanUrl.split('.').pop()?.toLowerCase();
    const cleanUrl = url.split('?')[0].split('#')[0];
    if (!url) return false;
  const isPdf = (url: string | undefined): boolean => {

  };
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
    const ext = cleanUrl.split('.').pop()?.toLowerCase();
    const cleanUrl = url.split('?')[0].split('#')[0];
    if (url.startsWith('data:image/')) return true;
    // Check if it's a data URL or has a common image extension
    if (!url) return false;
  const isImage = (url: string | undefined): boolean => {

  };
    return forecast.riskLevel;
    if (!forecast) return 'safe';
    const forecast = forecastData.find(f => f.orderId === orderId);
  const getOrderRisk = (orderId: number) => {

  }, [activeTab, selectedOrder, showNewOrderModal, showEditOrderModal, showHistoryModal, executions]);
    }
      return () => clearTimeout(timer);
      }, 100);
        scanInputRef.current?.focus();
      const timer = setTimeout(() => {
      // Small delay to ensure any modals/drawers have finished animating if needed
    if (activeTab === 'kanban' || activeTab === 'orders') {
  useEffect(() => {
  // Focus the "Escanear OP" field

  const scanInputRef = useRef<HTMLInputElement>(null);
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);
  }, [selectedOrder, executions, now]);
    return Math.max(selectedOrder.total_time_seconds || 0, stageAcc);
    }, 0);
      return sum + t.totalAccumulatedSeconds;
      const t = calculateExecutionTimes(e, e.pauses || [], now.getTime());
    const stageAcc = executions.reduce((sum, e) => {
    if (!executions || executions.length === 0) return selectedOrder.total_time_seconds || 0;
    if (!selectedOrder) return 0;
  const activeOrderTotalTime = useMemo(() => {

  const [activeExecutions, setActiveExecutions] = useState<StageExecution[]>([]);
  const [now, setNow] = useState(new Date());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  // Auth States

  const [expandedForecast, setExpandedForecast] = useState<number | null>(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [forecastData, setForecastData] = useState<OrderForecast[]>([]);
  // Delivery Forecast State

  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  // Order History Modal State

  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  // Cancel Order State

  const [editOrderHasExecutions, setEditOrderHasExecutions] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editOrderForm, setEditOrderForm] = useState<Partial<Order>>({});
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  // Edit Order Modal State

  const [templateFormStages, setTemplateFormStages] = useState<number[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<OrderTemplate | null>(null);
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [newOrderRequiredStages, setNewOrderRequiredStages] = useState<number[]>([]);
  const [printTypeFilter, setPrintTypeFilter] = useState<string>('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [selectedStageStatus, setSelectedStageStatus] = useState<'Pending' | 'Finished'>('Pending');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

  const [lossReentryStageIdInput, setLossReentryStageIdInput] = useState<number | null>(null);
  const [lossReasonDetailInput, setLossReasonDetailInput] = useState<string>('');
  const [lossReasonInput, setLossReasonInput] = useState<string>('');
  const [lossQtyInput, setLossQtyInput] = useState<number>(1);
  const [lossStageId, setLossStageId] = useState<number | null>(null);
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  // Modal State: Registro de Perda

  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [actionObservationInput, setActionObservationInput] = useState<string>('');
  const [showActionLossSection, setShowActionLossSection] = useState<boolean>(false);
  const [actionLossReentryStageIdInput, setActionLossReentryStageIdInput] = useState<number | null>(null);
  const [actionLossReasonDetailInput, setActionLossReasonDetailInput] = useState<string>('');
  const [actionLossReasonInput, setActionLossReasonInput] = useState<string>('');
  const [actionLossQuantityInput, setActionLossQuantityInput] = useState<number>(0);
  const [actionQuantityInput, setActionQuantityInput] = useState<number>(0);
  } | null>(null);
    stageId: number;
    executionId: number;
    type: 'pause' | 'finish';
  const [executionActionModal, setExecutionActionModal] = useState<{
  // Modal State: Ação de Pausar / Finalizar Etapa com Quantidade e Perdas

  const [progressIncrementInput, setProgressIncrementInput] = useState<number>(0);
  const [progressStageId, setProgressStageId] = useState<number | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  // Modal State: Progresso Parcial

  });
    required_stages: [] as number[]
    observations: '',
    num_colors: 1,
    product_type: '',
    print_type: 'DTF' as 'DTF' | 'Silk' | 'Sublimação' | 'Bordado',
  const [confirmDraftForm, setConfirmDraftForm] = useState({
  const [isConfirmingDraft, setIsConfirmingDraft] = useState(false);
  const [isSyncingOlist, setIsSyncingOlist] = useState(false);
  const [isDraftsListModalOpen, setIsDraftsListModalOpen] = useState(false);
  const [selectedDraftOrder, setSelectedDraftOrder] = useState<Order | null>(null);
  const [draftOrders, setDraftOrders] = useState<Order[]>([]);
  // Olist ERP Integration State

  const [activeReportSubTab, setActiveReportSubTab] = useState<'geral' | 'metas' | 'operacional' | 'perdas'>('geral');
  const [lossReasonsList, setLossReasonsList] = useState<LossReasonSetting[]>([]);
  const [lossReportData, setLossReportData] = useState<LossReportData | null>(null);
  const [goalEditValues, setGoalEditValues] = useState<Record<string, string>>({}); // key: `${stageId}-${userId}`
  const [expandedGoalStageId, setExpandedGoalStageId] = useState<number | null>(null);
  const [editingStageCalculationType, setEditingStageCalculationType] = useState<'por_pedido' | 'por_peca' | 'por_lote'>('por_peca');
  const [editingStageTime, setEditingStageTime] = useState<number>(0);
  const [editingStageName, setEditingStageName] = useState('');
  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isUploadingArt, setIsUploadingArt] = useState(false);
  const [editingStageMetaDiaria, setEditingStageMetaDiaria] = useState<number | ''>('');
  const [newStageMetaDiaria, setNewStageMetaDiaria] = useState<number | ''>('');
  const [newStageCalculationType, setNewStageCalculationType] = useState<'por_pedido' | 'por_peca' | 'por_lote'>('por_peca');
  const [newStageTime, setNewStageTime] = useState<number>(0);
  const [newStageName, setNewStageName] = useState('');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [orderStageObservations, setOrderStageObservations] = useState<any[]>([]);
  const [executions, setExecutions] = useState<StageExecution[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const confirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [editingDtfValue, setEditingDtfValue] = useState<string>('');
  const [editingDtfOrderId, setEditingDtfOrderId] = useState<number | null>(null);
  const [confirmingDtfOrderId, setConfirmingDtfOrderId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [autoPauseTimeLunch, setAutoPauseTimeLunch] = useState<string>('12:00');
  const [autoPauseTimeFriday, setAutoPauseTimeFriday] = useState<string>('17:00');
  const [showCompletedOrders, setShowCompletedOrders] = useState(false);
  const [autoPauseTimeWeekend, setAutoPauseTimeWeekend] = useState<string>('13:00');
  const [autoPauseTimeWeekday, setAutoPauseTimeWeekday] = useState<string>('18:00');
  const [metaCustoPeca, setMetaCustoPeca] = useState<number>(0);
  const [reportEndDate, setReportEndDate] = useState<string>(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [reportStartDate, setReportStartDate] = useState<string>(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [goalsViewType, setGoalsViewType] = useState<'collaborator' | 'sector'>('collaborator');
  const [collaboratorGoals, setCollaboratorGoals] = useState<CollaboratorStageGoal[]>([]);
  const [goalsProductivityData, setGoalsProductivityData] = useState<GoalsProductivityResponse | null>(null);
  const [operationalReportData, setOperationalReportData] = useState<OperationalReportData | null>(null);
  const [profileReport, setProfileReport] = useState<any[]>([]);
  const [reportPrintType, setReportPrintType] = useState<string>('');
  const [reportStage, setReportStage] = useState<string>('');
  const [reportUser, setReportUser] = useState<string>('');
  const [reportPeriod, setReportPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [delaysReportData, setDelaysReportData] = useState<DeliveryReportData['atrasados'] | null>(null);
  const [deliveryReportData, setDeliveryReportData] = useState<DeliveryReportData | null>(null);
  const [expandedReportStage, setExpandedReportStage] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<OrderTemplate[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);

  }, [orders]);
    }
      return 0;
      console.warn('Erro ao calcular badge de corte:', e);
    } catch (e) {
      return (aggregated || []).reduce((acc, item) => acc + (item.total_necessario || 0), 0);
      const aggregated = aggregateCuttingDemand(orders || []);
    try {
  const cortePendingBadgeCount = useMemo(() => {

  const [orders, setOrders] = useState<Order[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  };
    navigate(tab === 'dashboard' ? '/' : '/' + tab);
  const setActiveTab = (tab: string) => {
  const activeTab = (rawTab || 'dashboard') as 'dashboard' | 'kanban' | 'orders' | 'cutting' | 'collaborators' | 'reports' | 'costs' | 'settings' | 'monitor';
  const rawTab = location.pathname.split('/')[1];
  const location = useLocation();
  const navigate = useNavigate();
  const [infoModal, setInfoModal] = useState<{ title: string, description: string } | null>(null);
export default function App() {

};
  );
    </div>
      </Card>
        </div>
          </table>
            </tbody>
              })}
                );
                  </tr>
                    </td>
                      </span>
                        {getStatusLabel(exec.total_time_seconds, baseInfo.baseTime || 0)}
                      )}>
                        getStatusColor(exec.total_time_seconds, baseInfo.baseTime || 0)
                        "inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border",
                      <span className={cn(
                    <td className="px-6 py-4 text-center">
                    </td>
                      </div>
                        </div>
                          )}
                            <span>Real: {formatSeconds(exec.calculation_type === 'por_peca' ? (exec.real_average_time || 0) * (exec.quantity || 1) : (exec.real_average_time || 0))}</span>
                          {(exec.real_average_time || 0) > 0 && (
                          )} 
                            <span>Ideal: {formatSeconds(exec.calculation_type === 'por_peca' ? (exec.ideal_time || 0) * (exec.quantity || 1) : (exec.ideal_time || 0))}</span>
                          {(exec.ideal_time || 0) > 0 && (
                        <div className="text-[9px] text-zinc-500 flex flex-col">
                        </div>
                          <Badge variant={baseInfo.type === 'Real' ? 'info' : 'default'} className="md:px-2 md:py-0 md:text-[8px]">{baseInfo.type}</Badge>
                          <span className="text-zinc-900 font-medium">{baseInfo.baseTime ? formatSeconds(baseInfo.baseTime) : "-"}</span>
                        <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-1">
                    <td className="px-6 py-4 text-sm text-zinc-400 font-mono">
                    </td>
                       )}
                         </div>
                           {efficiency}
                         <div className={`text-[10px] mt-0.5 ${efficiencyColor}`}>
                       {efficiency && (
                       </span>
                         {formatSeconds(exec.total_time_seconds)}
                       )}>
                         baseInfo.baseTime && exec.total_time_seconds > baseInfo.baseTime ? "text-rose-600" : "text-zinc-900"
                         "font-mono text-sm font-bold block",
                       <span className={cn(
                    <td className="px-6 py-4">
                    </td>
                      {exec.user_name}
                    <td className="px-6 py-4 text-sm text-zinc-600 font-medium">
                    </td>
                      </div>
                        </div>
                          )}
                            </span>
                              📦 por lote
                            <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-0.5" title="Cálculo por Lote">
                          {exec.calculation_type === 'por_lote' && (
                          )}
                            </span>
                              👕 por peça
                            <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-0.5" title="Cálculo por Peça">
                          {exec.calculation_type === 'por_peca' && (
                          )}
                            </span>
                              📄 por pedido
                            <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-0.5" title="Cálculo por Pedido">
                          {exec.calculation_type === 'por_pedido' && (
                        <div className="flex items-center gap-1">
                        </span>
                          {exec.stage_name}
                          {exec.is_paused ? <Pause size={10} className="text-amber-500" /> : <Play size={10} className="text-emerald-500" />}
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs font-bold">
                      <div className="flex flex-col gap-1 items-start">
                    <td className="px-6 py-4">
                    </td>
                      </div>
                        <span className="text-[10px] text-zinc-500">{exec.product_type}</span>
                        <span className="text-sm font-bold text-zinc-800">{exec.client_name}</span>
                      <div className="flex flex-col">
                    <td className="px-6 py-4">
                    <td className="px-6 py-4 text-sm font-mono font-bold text-zinc-900">{exec.order_number}</td>
                  <tr key={exec.id} className="hover:bg-zinc-50 transition-colors">
                return (

                }
                  else efficiencyColor = 'text-rose-600 font-bold';
                  else if (pct <= 100) efficiencyColor = 'text-amber-600';
                  if (pct <= 80) efficiencyColor = 'text-emerald-600';
                  efficiency = `${pct}% do tempo ${baseInfo.type.toLowerCase()}`;
                  const pct = Math.round((exec.total_time_seconds / baseTime) * 100);
                if (baseTime > 0) {
                
                let efficiencyColor = 'text-zinc-500';
                let efficiency = '';
                const baseTime = baseInfo.baseTime;
                const baseInfo = getBaseTimeInfo(exec);
              ) : filteredData.map(exec => {
                <tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-400">Nenhuma tarefa ativa no momento.</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-400 animate-pulse">Carregando monitor...</td></tr>
              {loading ? (
            <tbody className="divide-y divide-zinc-200">
            </thead>
              </tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Tempo Base</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Tempo Decorrido</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Responsável</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Etapa</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Cliente / Produto</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Pedido</th>
              <tr className="bg-zinc-50 border-b border-zinc-100">
            <thead>
          <table className="w-full text-left">
        <div className="overflow-x-auto">
      <Card>

      </Card>
        </div>
          </div>
             </select>
                ))}
                  <option key={id} value={id}>{name as string}</option>
                {Array.from(new Map((monitorData || []).map(e => [e.stage_id, e.stage_name])).entries()).map(([id, name]) => (
               <option value="">Todas as Etapas</option>
             >
               className="bg-white border border-zinc-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-zinc-400 min-w-[200px]"
               onChange={(e) => setMonitorStageFilter(e.target.value)}
               value={monitorStageFilter}
             <select
             <Filter size={16} className="text-zinc-400" />
          <div className="flex items-center gap-2 w-full md:w-auto">
          </div>
            />
              className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-400"
              onChange={(e) => setMonitorSearch(e.target.value)}
              value={monitorSearch}
              placeholder="Buscar por Pedido ou Cliente..."
              type="text"
            <input
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <div className="relative flex-1 w-full">
        <div className="flex flex-col md:flex-row items-center gap-4">
      <Card className="p-4 bg-zinc-50 border-zinc-200">

      </div>
        </Card>
          </div>
            </div>
              <h3 className="text-2xl font-bold">{(monitorData || []).filter(e => { const { baseTime } = getBaseTimeInfo(e); return baseTime > 0 && (e.total_time_seconds / baseTime) > 1.0; }).length}</h3>
              <p className="text-xs text-zinc-500 font-medium">Fora do Prazo</p>
            <div>
            </div>
              <AlertTriangle size={24} />
            <div className="p-3 bg-rose-100 rounded-xl text-rose-600">
          <div className="flex items-center gap-4">
        <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => onShowInfo?.('Fora do Prazo', 'Tarefas cujo tempo atual de execução já excedeu o tempo base esperado.')}>
        </Card>
          </div>
            </div>
              <h3 className="text-2xl font-bold">{(monitorData || []).filter(e => { const { baseTime } = getBaseTimeInfo(e); return baseTime > 0 && (e.total_time_seconds / baseTime) > 0.8 && (e.total_time_seconds / baseTime) <= 1.0; }).length}</h3>
              <p className="text-xs text-zinc-500 font-medium">Atenção</p>
            <div>
            </div>
              <AlertCircle size={24} />
            <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
          <div className="flex items-center gap-4">
        <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => onShowInfo?.('Atenção', 'Tarefas em andamento onde o tempo atual atingiu entre 80% e 100% do tempo base (ideal ou real) esperado para a etapa.')}>
        </Card>
          </div>
            </div>
              <h3 className="text-2xl font-bold">{(monitorData || []).filter(e => { const { baseTime } = getBaseTimeInfo(e); return baseTime > 0 && (e.total_time_seconds / baseTime) <= 0.8; }).length}</h3>
              <p className="text-xs text-zinc-500 font-medium">Eficientes</p>
            <div>
            </div>
              <CheckCircle2 size={24} />
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
          <div className="flex items-center gap-4">
        <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => onShowInfo?.('Eficientes', 'Tarefas em andamento cujo tempo atual é inferior a 80% do tempo médio histórico esperado para a etapa.')}>
        </Card>
          </div>
            </div>
              <h3 className="text-2xl font-bold">{monitorData?.length || 0}</h3>
              <p className="text-xs text-zinc-500 font-medium">Tarefas Ativas</p>
            <div>
            </div>
              <Activity size={24} />
            <div className="p-3 bg-zinc-100 rounded-xl text-zinc-600">
          <div className="flex items-center gap-4">
        <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => onShowInfo?.('Tarefas Ativas', 'Número de tarefas (etapas de uma OP) que estão com o \'Play\' acionado no exato momento.')}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <div className="space-y-6">
  return (

  };
    return 'Atrasado';
    if (ratio <= 1.0) return 'Atenção';
    if (ratio <= 0.8) return 'Eficiente';
    const ratio = current / avg;
    if (!avg || avg === 0) return 'Normal';
  const getStatusLabel = (current: number, avg: number) => {

  };
    return 'text-rose-700 bg-rose-100 border-rose-200';
    if (ratio <= 1.0) return 'text-amber-700 bg-amber-100 border-amber-200';
    if (ratio <= 0.8) return 'text-emerald-700 bg-emerald-100 border-emerald-200';
    const ratio = current / avg;
    if (!avg || avg === 0) return 'text-zinc-600 bg-zinc-100';
  const getStatusColor = (current: number, avg: number) => {

  };
    return { baseTime, type: count >= 10 && real > 0 ? 'Real' : 'Ideal', calcType };

    }
      baseTime *= Math.ceil(qty / 10); // Exemplo: lote de 10
      // Opcional: implementar lógica de lote se necessário
    } else if (calcType === 'por_lote') {
      baseTime *= qty;
    if (calcType === 'por_peca') {

    }
      baseTime = ideal;
    } else {
      baseTime = real;
    if (count >= 10 && real > 0) {
    let baseTime = 0;

    const calcType = exec.calculation_type || 'por_peca';
    const qty = exec.quantity || 1;
    const real = exec.real_average_time || 0;
    const count = exec.execution_count || 0;
    const ideal = exec.ideal_time || exec.average_time_seconds || 0;
  const getBaseTimeInfo = (exec: StageExecution & { quantity?: number }) => {

  });
    return searchMatch && stageMatch;
    const stageMatch = !monitorStageFilter || e.stage_id?.toString() === monitorStageFilter;
                         e.client_name?.toLowerCase().includes(monitorSearch.toLowerCase()));
    const searchMatch = (e.order_number?.toLowerCase().includes(monitorSearch.toLowerCase()) || 
  const filteredData = (monitorData || []).filter(e => {

  }, []);
    return () => clearInterval(interval);
    const interval = setInterval(fetchMonitorData, 10000); // 10s refresh
    fetchMonitorData();
  useEffect(() => {

  };
    }
      setLoading(false);
    } finally {
      console.error('Error fetching monitor data:', err);
    } catch (err) {
      }
        setMonitorData(data);
        const data = await res.json();
      if (res.ok) {
      });
        headers: { 'x-user-role': 'Admin' }
      const res = await fetch('/api/executions/monitor', {
    try {
  const fetchMonitorData = async () => {

  const [loading, setLoading] = useState(true);
  const [monitorStageFilter, setMonitorStageFilter] = useState('');
  const [monitorSearch, setMonitorSearch] = useState('');
  const [monitorData, setMonitorData] = useState<StageExecution[]>([]);
const TaskMonitor = ({ onShowInfo }: { onShowInfo?: (title: string, desc: string) => void }) => {

};
  );
    </motion.div>
      </div>
        </div>
          <ChevronRight size={20} className="text-zinc-600" />
          </div>
            <span className="text-xl font-mono font-bold tabular-nums">{formatSeconds(times.totalAccumulatedSeconds)}</span>
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Tempo Total</span>
          <div className="flex flex-col items-end">
          <div className="h-6 w-px bg-zinc-700 mx-1" />
          </div>
            <span className="text-sm font-mono font-bold text-emerald-300">{formatSeconds(times.currentSessionSeconds)}</span>
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Sessão Atual</span>
          <div className="flex flex-col items-end">
        <div className="flex items-center gap-4">
        </div>
          </div>
            </p>
              {execution.stage_name} <span className="text-zinc-500 mx-2">•</span> <span className="font-mono">{execution.order_number}</span>
            <p className="text-sm font-bold">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tarefa em Andamento</p>
          <div>
          </div>
            <Play size={16} />
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 animate-pulse">
        <div className="flex items-center gap-3">
      >
        onClick={onNavigate}
        className="px-6 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-colors"
      <div
    >
      className="bg-zinc-900 text-white overflow-hidden shadow-lg mb-2 rounded-xl"
      exit={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      initial={{ height: 0, opacity: 0 }}
    <motion.div
  return (

  }, [execution]);
    return () => clearInterval(timer);
    const timer = setInterval(updateTimer, 1000);
    updateTimer(); // Initial call

    };
      setTimes(calculateExecutionTimes(execution, execution.pauses || [], Date.now()));
    const updateTimer = () => {

    if (!execution.start_time) return;
  useEffect(() => {

  const [times, setTimes] = useState({ totalAccumulatedSeconds: 0, currentSessionSeconds: 0, isPaused: false });
const RunningTaskBanner = ({ execution, onNavigate }: RunningTaskBannerProps) => {

};
  key?: any;
  onNavigate: () => void | Promise<void>;
  execution: StageExecution;
type RunningTaskBannerProps = {

};
  }
    return '-';
  } catch {
    return format(d, formatStr);
  try {
  if (!d) return '-';
  const d = safeDate(dateStr);
const safeFormat = (dateStr: any, formatStr: string) => {

};
  }
    return null;
  } catch {
    return isNaN(d.getTime()) ? null : d;
    const d = parseISO(str);
    }
      str += 'Z';
    if (!/[Zz]|[+-]\d{2}:?\d{2}$/.test(str) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
    }
      str = str.replace(' ', 'T');
    if (str.includes(' ') && !str.includes('T')) {
    let str = String(dateStr).trim();
    if (!dateStr) return null;
  try {
const safeDate = (dateStr: any) => {

);
  </AnimatePresence>
    )}
      </div>
        </motion.div>
          </div>
            </button>
              Entendido
            >
              className="w-full mt-6 bg-zinc-900 text-white font-bold py-3 rounded-xl hover:bg-zinc-800 transition-all shadow-md active:scale-[0.98]"
              onClick={onClose}
            <button
            </div>
              </p>
                {description}
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
            </div>
              </button>
                <X size={20} />
              <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400">
              </div>
                <h3 className="font-bold text-lg tracking-tight">{title}</h3>
                <AlertCircle size={20} />
              <div className="flex items-center gap-2 text-zinc-900 border-b-2 border-zinc-900 pb-1">
            <div className="flex items-center justify-between mb-4">
          <div className="p-6">
        >
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-zinc-200"
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
        <motion.div
        />
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          exit={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          initial={{ opacity: 0 }}
        <motion.div
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
    {isOpen && (
  <AnimatePresence>
const InfoModal = ({ isOpen, onClose, title, description }: { isOpen: boolean, onClose: () => void, title: string, description: string }) => (


}
  }
    return this.props.children;
    }
      );
        </div>
          </button>
            Tentar Novamente
          >
            className="px-6 py-2 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-md active:scale-95"
            onClick={() => this.setState({ hasError: false })}
          <button 
          <p className="text-sm text-zinc-500 max-w-xs mx-auto mb-6">Ocorreu um erro inesperado ao processar os dados desta aba.</p>
          <h3 className="text-lg font-bold text-zinc-900 mb-2">Ops! Algo deu errado nesta seção.</h3>
          <AlertCircle className="mx-auto text-zinc-300 mb-4" size={48} />
        <div className="p-12 text-center bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
      return this.props.fallback || (
    if (this.state.hasError) {
  public render() {

  }
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  public componentDidCatch(error: Error, errorInfo: any) {

  }
    return { hasError: true };
  static getDerivedStateFromError(_: Error): ErrorBoundaryState {

  };
    hasError: false
  public state: ErrorBoundaryState = {
class ErrorBoundary extends (React.Component as any)<ErrorBoundaryProps, ErrorBoundaryState> {

}
  hasError: boolean;
interface ErrorBoundaryState {

}
  fallback?: React.ReactNode;
  children: React.ReactNode;
interface ErrorBoundaryProps {
// Error Boundary Component (Shim for missing @types/react)

);
  </div>
    {children}
  <div className={cn("bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden", className)} {...props}>
const Card = ({ children, className, ...props }: any) => (

);
  </button>
    )}
      </span>
        {badge}
      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-amber-950 font-mono">
    {badge !== undefined && badge !== null && (
    </div>
      <span className="text-sm">{label}</span>
      <Icon size={20} />
    <div className="flex items-center gap-3">
  >
    )}
        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 font-medium"
        ? "bg-zinc-900 text-white shadow-lg font-bold"
      active
      "flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer",
    className={cn(
    onClick={onClick}
  <button
const SidebarItem = ({ icon: Icon, label, active, onClick, badge }: { icon: any, label: string, active: boolean, onClick: () => void, badge?: number | string }) => (
// Components

}
  return 0;
  }
    }
      return parseInt(match[1], 10) || 0;
    if (match) {
    const match = order.observations.match(/⚠️\s*(\d+)\s*pçs?\s*sem\s*estoque/i);
  if (order.observations) {
  }
    if (sumCorte > 0) return sumCorte;
    }, 0);
      return acc + cQty;
      const cQty = it.qty_corte ?? it.total_via_corte ?? (it.stock_available !== undefined && it.stock_available !== null ? Math.max(0, qPedida - Math.min(qPedida, it.stock_available)) : 0);
      const qPedida = it.quantity ?? it.quantidade ?? 1;
    const sumCorte = order.items.reduce((acc: number, it: any) => {
  if (order.items && order.items.length > 0) {
  }
    return order.total_via_corte;
  if (order.total_via_corte !== undefined && order.total_via_corte !== null && order.total_via_corte > 0) {
  if (!order) return 0;
function getOrderCuttingQty(order: any): number {



const isPdf = (url: string) => /\.pdf(\?.*)?$/i.test(url);
const isImage = (url: string) => /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(url);
// Helpers

import { Order, Stage, StageExecution, DashboardStats, User, StageStatus, OrderTemplate, OrderHistory, OrderForecast, DeliveryReportData, OperationalReportData, OperationalStep, OrderProgress, FinishedOrder, CollaboratorProductivity, GoalsProductivityResponse, ProductivityPeriod, OrderStageProgress, OrderLossLog, LossReasonSetting, LossReportData, CollaboratorStageGoal } from './types';
import { calculateExecutionTimes } from './lib/timerUtils';
import { cn, formatSeconds, isImage, isPdf, getOrderCuttingQty, safeFormat } from './lib/utils';
import { ptBR } from 'date-fns/locale';
import { format, parseISO, differenceInDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isPast, endOfDay } from 'date-fns';
} from 'recharts';
  ReferenceLine
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  YAxis,
  XAxis,
  Bar,
  BarChart,
import {

import { aggregateCuttingDemand, getItemDisplaySize, sortSizes, extractItemDetails } from './lib/cuttingUtils';
import { ProductionProgressPanel } from './components/ProductionProgressPanel';
import { ProductionNeedsPanel } from './components/ProductionNeedsPanel';
import { ConsolidatedCuttingPanel } from './components/ConsolidatedCuttingPanel';
import { Collaborators } from './pages/Collaborators';
import { Costs } from './pages/Costs';
import { Reports } from './pages/Reports';
import { TemplateEditorModal } from './components/modals/TemplateEditorModal';
import { NewOrderModal } from './components/modals/NewOrderModal';
import { UserModal } from './components/modals/UserModal';
import { Kanban } from './pages/Kanban';
import { Badge } from './components/Badge';
import { Orders } from './pages/Orders';
import PublicTracking from './PublicTracking';
import { Session } from '@supabase/supabase-js';
import PrintableReport from './PrintableReport';
import { supabase } from './lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
} from 'lucide-react';
  Scissors
  Link as LinkIcon,
  Loader2,
  Printer,
  EyeOff,
  Eye,
  ChevronLeft,
  ArrowDown,
  ArrowUp,
  DownloadCloud,
  Download,
  Activity,
  TrendingDown,
  AlertTriangle,
  Filter,
  List,
  Layers,
  Timer,
  CheckSquare,
  Archive,
  Target,
  PieChart as PieChartIcon,
  ArrowLeft,
  RefreshCw,
  LogOut,
  Menu,
  DollarSign,
  TrendingUp,
  FileText,
  Circle,
  CheckCircle,
  Upload,
  Image as ImageIcon,
  Trash2,
  Edit2,
  X,
  User as UserIcon,
  Calendar,
  Package,
  BarChart3,
  Square,
  Check,
  Pause,
  Play,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Plus,
  Settings,
  Users,
  ClipboardList,
  LayoutDashboard,
import {
import { useNavigate, useLocation } from 'react-router-dom';
import React, { useState, useEffect, useRef, useMemo } from 'react';



  );
};
