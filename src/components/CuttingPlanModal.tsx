import React, { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  FileSpreadsheet,
  Layers,
  Calendar,
  Package,
  Scissors,
  Users,
  Info,
  ChevronRight,
  ListFilter
} from 'lucide-react';
import { CorteGroupDemand } from '../types';
import { sortSizes, formatDemandForCutPlan } from '../lib/cuttingUtils';

interface CuttingPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: CorteGroupDemand | null;
}

export const CuttingPlanModal: React.FC<CuttingPlanModalProps> = ({
  isOpen,
  onClose,
  group
}) => {
  const [copiedFormat, setCopiedFormat] = useState<'text' | 'tsv' | null>(null);
  const [activeView, setActiveView] = useState<'plan' | 'details'>('plan');

  // Format date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  // Extract all distinct sizes across all models in this group
  const distinctSizes = useMemo(() => {
    if (!group) return [];
    const set = new Set<string>();
    group.models_breakdown.forEach(mb => {
      Object.keys(mb.sizes).forEach(size => {
        if (mb.sizes[size] > 0) set.add(size);
      });
    });
    return sortSizes(Array.from(set));
  }, [group]);

  // Compute column totals for the footer
  const columnTotals = useMemo(() => {
    if (!group) return {};
    const totals: { [size: string]: number } = {};
    distinctSizes.forEach(size => {
      totals[size] = group.models_breakdown.reduce((sum, mb) => sum + (mb.sizes[size] || 0), 0);
    });
    return totals;
  }, [group, distinctSizes]);

  // Formats for CutPlan
  const cutPlanFormats = useMemo(() => {
    if (!group) return { text: '', tsv: '' };
    return formatDemandForCutPlan(group.models_breakdown);
  }, [group]);

  const handleCopy = (format: 'text' | 'tsv') => {
    const textToCopy = format === 'text' ? cutPlanFormats.text : cutPlanFormats.tsv;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2500);
    });
  };

  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-start justify-between gap-4 border-b border-blue-900/60 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 bg-blue-600 text-white font-mono font-black text-[10px] rounded uppercase tracking-wider">
                CENTRAL DE CORTE
              </span>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                group.tipo_tecido === 'TUBULAR'
                  ? 'bg-indigo-100 text-indigo-950 border border-indigo-200'
                  : 'bg-emerald-100 text-emerald-950 border border-emerald-200'
              }`}>
                {group.tipo_tecido}
              </span>
              <span className="text-xs text-blue-200 font-mono">
                Largura: {group.largura_util}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black tracking-tight">
              {group.fabric} · <span className="text-blue-400">{group.color}</span>
            </h3>
            <p className="text-xs text-blue-200/90 mt-1">
              Plano de corte consolidado por matéria-prima para encaixe no Optitex CutPlan.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer shrink-0"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Grid (Especificações do Plano) */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-5 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total de Peças</span>
              <span className="text-lg font-black font-mono text-blue-700">{group.total_necessario} un</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Modelos Distintos</span>
              <span className="text-lg font-black font-mono text-slate-800">{group.models_breakdown.length}</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Pedidos Envolvidos</span>
              <span className="text-lg font-black font-mono text-slate-800">{group.pedidos_count}</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Entrega Mais Urgente</span>
              <span className="text-sm font-black font-mono text-rose-600 mt-1 block">
                {formatDate(group.prazo_mais_proximo)}
              </span>
            </div>
          </div>

          {/* Sub-view Switcher & Copy Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveView('plan')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeView === 'plan'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Scissors size={14} className="text-blue-600" /> Grade de Corte
              </button>

              <button
                type="button"
                onClick={() => setActiveView('details')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeView === 'details'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListFilter size={14} className="text-slate-500" /> Detalhes dos Pedidos ({group.pedidos_count})
              </button>
            </div>

            {/* Ações de Cópia para Optitex CutPlan */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy('text')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-xs active:scale-95 ${
                  copiedFormat === 'text'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title="Copiar no formato limpo de Modelo e Tamanho"
              >
                {copiedFormat === 'text' ? <Check size={15} /> : <Copy size={15} />}
                {copiedFormat === 'text' ? 'Copiado para o CutPlan!' : 'Copiar para CutPlan'}
              </button>

              <button
                type="button"
                onClick={() => handleCopy('tsv')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border active:scale-95 ${
                  copiedFormat === 'tsv'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="Copiar em formato tabulado TSV (compatível com Excel / Colagem Direta)"
              >
                {copiedFormat === 'tsv' ? <Check size={14} className="text-emerald-600" /> : <FileSpreadsheet size={14} className="text-slate-500" />}
                {copiedFormat === 'tsv' ? 'Tabela Copiada!' : 'Copiar Tabela (TSV)'}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body: Content area */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeView === 'plan' ? (
            <div className="space-y-6">
              
              {/* Tabela Dinâmica de Grade por Modelo */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-700">
                        <th className="px-4 py-3.5 min-w-[200px]">Modelo</th>
                        {distinctSizes.map(size => (
                          <th key={size} className="px-3 py-3.5 text-center min-w-[50px] font-mono">
                            {size}
                          </th>
                        ))}
                        <th className="px-4 py-3.5 text-right font-mono text-blue-900 bg-blue-50/60 min-w-[80px]">
                          TOTAL
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {group.models_breakdown.map(mb => (
                        <tr key={mb.model} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                            <Scissors size={14} className="text-blue-600 shrink-0" />
                            <span>{mb.model}</span>
                          </td>
                          {distinctSizes.map(size => {
                            const qty = mb.sizes[size] || 0;
                            return (
                              <td key={size} className="px-3 py-3.5 text-center font-mono font-bold">
                                {qty > 0 ? (
                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-md border border-blue-200">
                                    {qty}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-normal">0</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3.5 text-right font-mono font-black text-blue-700 bg-blue-50/40">
                            {mb.total} un
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-900">
                        <td className="px-4 py-3.5 uppercase tracking-wider">
                          TOTAL DO PLANO
                        </td>
                        {distinctSizes.map(size => (
                          <td key={size} className="px-3 py-3.5 text-center font-mono text-blue-200">
                            {columnTotals[size] || 0}
                          </td>
                        ))}
                        <td className="px-4 py-3.5 text-right font-mono text-sm text-white bg-blue-600">
                          {group.total_necessario} un
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Pré-visualização do texto formatado para o Optitex CutPlan */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Info size={14} className="text-blue-600" /> Prévia de Exportação para o Optitex CutPlan
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Formato limpo: Modelo e quantidade por tamanho
                  </span>
                </div>
                <pre className="bg-slate-900 text-emerald-300 font-mono text-xs p-4 rounded-xl overflow-x-auto border border-slate-800 max-h-48 whitespace-pre leading-relaxed">
                  {cutPlanFormats.text}
                </pre>
              </div>

            </div>
          ) : (
            /* VISÃO DE DETALHES / RASTREABILIDADE */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Rastreabilidade dos Pedidos de Origem
                </h4>
                <span className="text-xs font-bold text-slate-500 font-mono">
                  {group.all_items.length} linha(s) de demanda
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600 font-mono">
                      <th className="px-4 py-3">Pedido</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Modelo</th>
                      <th className="px-4 py-3">Tam</th>
                      <th className="px-4 py-3 text-right">Qtd</th>
                      <th className="px-4 py-3">Prazo</th>
                      <th className="px-4 py-3">SKU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium">
                    {group.all_items.flatMap(it => 
                      it.pedidos_waiting.map(w => (
                        <tr key={`${it.item_key}_${w.order_id}`} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold font-mono text-blue-900">
                            {w.order_number || `#${w.order_id}`}
                          </td>
                          <td className="px-4 py-2.5 text-slate-800 truncate max-w-[150px]">
                            {w.client_name || 'Cliente'}
                          </td>
                          <td className="px-4 py-2.5 text-slate-900 font-bold">
                            {it.product_type}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 bg-slate-100 rounded font-mono font-bold text-slate-700">
                              {it.size}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-black font-mono text-blue-700">
                            {w.qty_corte_pending || w.qty_corte_needed || w.item_quantity} un
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-600">
                            {formatDate(w.deadline)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-400 text-[11px]">
                            {it.sku || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            {group.models_breakdown.length} modelo(s) · {group.total_necessario} peças no total
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
