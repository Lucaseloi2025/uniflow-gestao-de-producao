import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, safeFormat, getStageSlugFromStage } from '../../lib/utils';
import { getItemDisplaySize } from '../../lib/cuttingUtils';
import { X, RefreshCw, Trash2, Package, Check, Settings2, CopyCheck, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [expandedItemIdx, setExpandedItemIdx] = useState<number | null>(null);

  const activeAllowedStages = (stages || []).filter(
    (st: Stage) => st.active && ![2, 7, 12].includes(Number(st.id))
  );

  const computeOrderedUnionStages = (itemsList: any[], fallbackStages: number[]) => {
    const stageIdsSet = new Set<number>();
    (itemsList || []).forEach((it: any) => {
      if (Array.isArray(it.required_stages)) {
        it.required_stages.forEach((sid: any) => {
          const n = Number(sid);
          if (Number.isFinite(n) && n > 0) stageIdsSet.add(n);
        });
      }
    });
    if (stageIdsSet.size === 0) return fallbackStages;
    return activeAllowedStages
      .map((s: Stage) => Number(s.id))
      .filter((sid: number) => stageIdsSet.has(sid));
  };

  const getRecommendedStagesForTechnique = (printType: string): number[] => {
    const norm = (printType || '').toLowerCase();
    return activeAllowedStages
      .filter((s: Stage) => {
        const slug = getStageSlugFromStage(s);
        if (norm.includes('sublima')) {
          if (slug === 'IMPRESSAO_DTF') return false;
          return ['FICHA_APROVACAO', 'SUBLIMACAO', 'CORTE', 'COSTURA', 'ESTAMPARIA'].includes(slug);
        }
        if (norm.includes('lisa') || norm.includes('sem estampa')) {
          if (slug === 'IMPRESSAO_DTF' || slug === 'SUBLIMACAO' || slug === 'ESTAMPARIA') return false;
          return ['CORTE', 'COSTURA'].includes(slug);
        }
        if (norm.includes('silk') || norm.includes('bordado')) {
          if (slug === 'IMPRESSAO_DTF' || slug === 'SUBLIMACAO') return false;
          return ['FICHA_APROVACAO', 'ESTAMPARIA', 'CORTE', 'COSTURA'].includes(slug);
        }
        // Default DTF
        if (slug === 'SUBLIMACAO') return false;
        return ['FICHA_APROVACAO', 'IMPRESSAO_DTF', 'ESTAMPARIA', 'CORTE', 'COSTURA'].includes(slug);
      })
      .map((s: Stage) => Number(s.id));
  };

  const itemsList: any[] =
    Array.isArray(confirmDraftForm.items) && confirmDraftForm.items.length > 0
      ? confirmDraftForm.items
      : Array.isArray(selectedDraftOrder?.items)
        ? selectedDraftOrder.items
        : [];

  const handleUpdateItemTechnique = (idx: number, newTechnique: string) => {
    const recommended = getRecommendedStagesForTechnique(newTechnique);
    setConfirmDraftForm((prev: any) => {
      const baseItems =
        Array.isArray(prev.items) && prev.items.length > 0
          ? [...prev.items]
          : [...(selectedDraftOrder?.items || [])];
      const current = baseItems[idx] || {};
      baseItems[idx] = {
        ...current,
        print_type: newTechnique,
        required_stages: recommended.length > 0 ? recommended : current.required_stages || prev.required_stages
      };
      const unionStages = computeOrderedUnionStages(baseItems, prev.required_stages);
      return {
        ...prev,
        items: baseItems,
        required_stages: unionStages
      };
    });
  };

  const handleToggleItemStage = (idx: number, stageId: number, checked: boolean) => {
    setConfirmDraftForm((prev: any) => {
      const baseItems =
        Array.isArray(prev.items) && prev.items.length > 0
          ? [...prev.items]
          : [...(selectedDraftOrder?.items || [])];
      const current = baseItems[idx] || {};
      const currentStages: number[] = Array.isArray(current.required_stages)
        ? current.required_stages.map(Number)
        : [...(prev.required_stages || [])];
      const nextItemStages = checked
        ? Array.from(new Set([...currentStages, Number(stageId)]))
        : currentStages.filter((id) => Number(id) !== Number(stageId));
      // Sort by activeAllowedStages order
      const orderedItemStages = activeAllowedStages
        .map((s: Stage) => Number(s.id))
        .filter((sid: number) => nextItemStages.includes(sid));
      baseItems[idx] = {
        ...current,
        required_stages: orderedItemStages
      };
      const unionStages = computeOrderedUnionStages(baseItems, prev.required_stages);
      return {
        ...prev,
        items: baseItems,
        required_stages: unionStages
      };
    });
  };

  const handleApplyGlobalStagesToAllItems = () => {
    setConfirmDraftForm((prev: any) => {
      const globalStages = Array.isArray(prev.required_stages) ? [...prev.required_stages] : [];
      const baseItems =
        Array.isArray(prev.items) && prev.items.length > 0
          ? [...prev.items]
          : [...(selectedDraftOrder?.items || [])];
      const updatedItems = baseItems.map((it: any) => ({
        ...it,
        print_type: prev.print_type || it.print_type || 'DTF',
        required_stages: [...globalStages]
      }));
      return {
        ...prev,
        items: updatedItems
      };
    });
  };

  return (
    <AnimatePresence>
      {selectedDraftOrder && (
        <div className="fixed inset-0 z-[270] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-zinc-100 my-8">
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

              {/* Grade de Tamanhos & Etapas Individuais por Item */}
              {itemsList.length > 0 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Package size={14} className="text-indigo-600" /> Lista de Itens do Pedido ({itemsList.length} SKUs)
                        </h3>
                        <p className="text-[11px] text-zinc-500">
                          Configure a técnica e o fluxo de etapas individualmente por item ou aplique um padrão a todos.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleApplyGlobalStagesToAllItems}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
                          title="Aplica as etapas selecionadas abaixo para todos os itens desta lista"
                        >
                          <CopyCheck size={13} />
                          Aplicar etapas a todos
                        </button>
                        <span className="text-[10px] font-bold text-zinc-400 font-mono">Total: {selectedDraftOrder.quantity} pcs</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-zinc-200 rounded-xl bg-white shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-zinc-50 text-zinc-600 font-bold uppercase text-[9px] border-b border-zinc-200">
                            <th className="px-3 py-2">Produto / Variação (SKU)</th>
                            <th className="px-2 py-2 text-center">Tamanho</th>
                            <th className="px-2 py-2 text-right">Qtd</th>
                            <th className="px-2 py-2">Técnica</th>
                            <th className="px-2 py-2">Etapas Aplicáveis</th>
                            <th className="px-3 py-2 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {itemsList.map((item: any, idx: number) => {
                            const qty = item.quantity ?? item.quantidade ?? 1;
                            const displaySize = getItemDisplaySize(item);
                            const skuCode = item.sku || item.codigo || `ITEM-${idx + 1}`;
                            const itemTechnique = item.print_type || confirmDraftForm.print_type || 'DTF';
                            const itemStageIds: number[] = Array.isArray(item.required_stages)
                              ? item.required_stages.map(Number)
                              : (confirmDraftForm.required_stages || []).map(Number);
                            const itemStageNames = activeAllowedStages
                              .filter((st: Stage) => itemStageIds.includes(Number(st.id)))
                              .map((st: Stage) => st.name);
                            const isExpanded = expandedItemIdx === idx;

                            return (
                              <React.Fragment key={item.id || item.order_item_id || idx}>
                                <tr className={cn("hover:bg-zinc-50/50 text-xs transition-colors", isExpanded && "bg-indigo-50/30")}>
                                  <td className="px-3 py-2.5">
                                    <div className="font-bold text-zinc-900">{item.description || item.descricao || 'Item sem descrição'}</div>
                                    <div className="text-[10px] font-mono text-zinc-400">SKU: {skuCode}</div>
                                  </td>
                                  <td className="px-2 py-2.5 text-center">
                                    <span className="inline-block px-2.5 py-0.5 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase font-mono shadow-xs border border-indigo-700 tracking-wider">
                                      {displaySize}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-right font-mono text-xs font-black text-zinc-900 whitespace-nowrap">
                                    {qty} un
                                  </td>
                                  <td className="px-2 py-2.5">
                                    <select
                                      value={itemTechnique}
                                      onChange={(e) => handleUpdateItemTechnique(idx, e.target.value)}
                                      className="p-1.5 border border-zinc-200 rounded-lg text-[11px] font-bold bg-white text-zinc-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    >
                                      <option value="DTF">DTF</option>
                                      <option value="Sublimação">Sublimação Total</option>
                                      <option value="Silk">Silk-screen</option>
                                      <option value="Bordado">Bordado</option>
                                      <option value="Lisa">Peça Lisa (Sem estampa)</option>
                                    </select>
                                  </td>
                                  <td className="px-2 py-2.5">
                                    <div className="flex flex-wrap gap-1 max-w-[260px]">
                                      {itemStageNames.length > 0 ? (
                                        itemStageNames.map((name: string, sIdx: number) => (
                                          <span
                                            key={sIdx}
                                            className="inline-flex px-1.5 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded text-[10px] font-bold"
                                          >
                                            {name}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-[10px] text-rose-500 font-bold">Nenhuma etapa</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedItemIdx(isExpanded ? null : idx)}
                                      className={cn(
                                        "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                                        isExpanded
                                          ? "bg-indigo-600 text-white border-indigo-700"
                                          : "bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-200"
                                      )}
                                    >
                                      <Settings2 size={12} />
                                      <span>Configurar etapas</span>
                                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr className="bg-indigo-50/40 border-b border-indigo-100">
                                    <td colSpan={6} className="px-4 py-3">
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[11px] font-black text-indigo-950 uppercase tracking-wider">
                                            Etapas exclusivas deste item ({item.description || item.descricao} — {qty} un)
                                          </span>
                                          <span className="text-[10px] font-bold text-indigo-600">
                                            Técnica: {itemTechnique}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                                          {activeAllowedStages.map((st: Stage) => {
                                            const checked = itemStageIds.includes(Number(st.id));
                                            return (
                                              <label
                                                key={st.id}
                                                className={cn(
                                                  "flex items-center gap-2 p-2 rounded-xl border text-[11px] font-medium cursor-pointer transition-all",
                                                  checked
                                                    ? "bg-indigo-600 border-indigo-700 text-white font-bold shadow-xs"
                                                    : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                                                )}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  onChange={(e) => handleToggleItemStage(idx, Number(st.id), e.target.checked)}
                                                  className="rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="truncate">{st.name}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Controls */}
              <div className="space-y-4 pt-2 border-t border-zinc-100">
                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Definições Gerais do Pedido</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tipo de Estampa */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Técnica Principal / Padrão <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={confirmDraftForm.print_type}
                      onChange={(e) => setConfirmDraftForm((prev: any) => ({ ...prev, print_type: e.target.value as any }))}
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
                      onChange={(e) => setConfirmDraftForm((prev: any) => ({ ...prev, product_type: e.target.value }))}
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
                        onChange={(e) => setConfirmDraftForm((prev: any) => ({ ...prev, num_colors: parseInt(e.target.value) || 1 }))}
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
                    onChange={(e) => setConfirmDraftForm((prev: any) => ({ ...prev, observations: e.target.value }))}
                    placeholder="Instruções de produção ou estampa..."
                    className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Required Stages Checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-zinc-700">
                      Etapas Consolidadas do Pedido (União dos Itens / Padrão)
                    </label>
                    {itemsList.length > 0 && (
                      <button
                        type="button"
                        onClick={handleApplyGlobalStagesToAllItems}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <CopyCheck size={12} /> Aplicar esta seleção a todos os itens
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {activeAllowedStages.map((st: Stage) => {
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
                                setConfirmDraftForm((prev: any) => ({ ...prev, required_stages: [...prev.required_stages, st.id] }));
                              } else {
                                setConfirmDraftForm((prev: any) => ({ ...prev, required_stages: prev.required_stages.filter((id: number) => id !== st.id) }));
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
