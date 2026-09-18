import React from 'react';
import ReactDOM from 'react-dom';
import { CutPlan } from '../types';
import { Printer, X, Scissors, PackageCheck, AlertTriangle } from 'lucide-react';

interface PrintableCutPlanSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: CutPlan | null;
}

export const PrintableCutPlanSheetModal: React.FC<PrintableCutPlanSheetModalProps> = ({
  isOpen,
  onClose,
  plan
}) => {
  if (!isOpen || !plan) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  // Group items by Order -> Model -> Size
  const itemsByOrder = React.useMemo(() => {
    if (!plan.items) return {};
    const grouped: Record<string, any[]> = {};
    plan.items.forEach(it => {
      const orderName = it.order_number || `#${it.order_id}`;
      if (!grouped[orderName]) grouped[orderName] = [];
      grouped[orderName].push(it);
    });
    return grouped;
  }, [plan.items]);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6 bg-slate-900/60 backdrop-blur-sm print:absolute print:inset-0 print:z-0 print:bg-white print:p-0 print:block print:overflow-visible">
            <style dangerouslySetInnerHTML={{__html: `
        @media print {
          #root { display: none !important; }
          #print-header-hide { display: none !important; }
          body { background-color: white !important; margin: 0; padding: 0; font-size: 10px !important; }
          @page { margin: 1cm; size: A4 portrait; }
          .print-compact-title { font-size: 16px !important; margin: 0 !important; }
          .print-compact-p { font-size: 10px !important; margin: 0 !important; }
          .print-compact-section { padding: 4px !important; margin-bottom: 8px !important; }
          .print-compact-grid { gap: 4px !important; }
          .print-compact-table th, .print-compact-table td { padding: 2px 4px !important; font-size: 9px !important; }
        }
      `}} />
      <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full max-w-5xl h-full md:h-[90vh] overflow-y-auto flex flex-col print:shadow-none print:rounded-none print:w-full print:max-w-none print:h-auto print:overflow-visible print:bg-white">
        
        {/* Modal Actions (Hide in print) */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-4 flex items-center justify-between shrink-0 print:hidden rounded-t-3xl" style={{ display: window.matchMedia("print").matches ? "none" : undefined }} id="print-header-hide">
          <div className="flex items-center gap-3">
            <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Ficha de Ordem de Produção (PCP)</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer size={16} /> Imprimir Ficha
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PRINTABLE SHEET CONTAINER */}
        <div className="p-8 sm:p-10 space-y-6 print:space-y-2 font-sans text-slate-900 bg-white text-left print:p-0 print:m-0 print:shadow-none">
          
          {/* Header Ficha */}
          <div className="border-b-2 border-slate-900 pb-4 print:pb-1 flex justify-between items-start gap-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-blue-900 block">
                COMFORTPRO - PCP CORTE E COSTURA
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 uppercase tracking-tight print-compact-title">
                ORDEM DE PRODUÇÃO: {plan.plan_number}
              </h1>
              <p className="text-xs font-bold text-slate-600 mt-0.5 print-compact-p">
                Plano: <span className="font-mono text-slate-900 font-black">{plan.plan_number}</span>
              </p>
            </div>

            <div className="text-right font-mono text-xs border border-slate-900 p-2.5 rounded-xl bg-slate-50">
              <p className="font-black text-slate-900 text-sm">STATUS: {plan.status}</p>
              <p className="text-[10px] text-slate-600 mt-1">Gerado em: {formatDate(plan.created_at)}</p>
              <p className="text-[10px] text-slate-600">Criado por: {plan.created_by || 'Sistema'}</p>
            </div>
          </div>

          {/* Dados do Tecido */}
          <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 print-compact-section">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Scissors size={14} /> ESPECIFICAÇÕES DO MATERIAL
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-medium print-compact-grid">
              <div>
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 font-bold">Tecido Principal</span>
                <span className="font-black text-slate-900 text-base">{plan.fabric || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 font-bold">Cor</span>
                <span className="font-black text-slate-900 text-base px-2 py-0.5 bg-slate-200/50 border border-slate-300 rounded inline-block">{plan.color || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 font-bold">Tipo</span>
                <span className="font-black text-slate-900 text-base">{plan.tipo_tecido || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 font-bold">Qtd Total Prevista</span>
                <span className="font-black text-blue-800 text-lg font-mono">{plan.qty_planned} un</span>
              </div>
            </div>
          </section>

          {/* Pedidos Atendidos (OPs) */}
          <section className="space-y-4 pt-2">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-200 pb-2">
              <PackageCheck size={18} /> ITENS DO PLANO POR PEDIDO DE VENDA (OPs)
            </h2>
            
            <div className="space-y-6 print:space-y-2">
              {Object.keys(itemsByOrder).map(orderNum => {
                const orderItems = itemsByOrder[orderNum];
                const totalOrder = orderItems.reduce((acc, it) => acc + (it.quantity_planned || 0), 0);

                return (
                  <div key={orderNum} className="border border-slate-300 rounded-xl overflow-hidden break-inside-avoid">
                    <div className="bg-slate-100 px-4 py-2 print:py-1 print:px-2 flex items-center justify-between border-b border-slate-300">
                      <h3 className="font-black text-slate-900 text-sm font-mono">OP / PEDIDO: <span className="text-blue-800 text-base">{orderNum}</span></h3>
                      <span className="font-bold text-slate-600 text-xs font-mono">Total no pedido: {totalOrder} pecas</span>
                    </div>
                    
                    <table className="w-full text-left text-xs print-compact-table">
                      <thead className="bg-white border-b border-slate-200 font-mono text-[10px] uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-2 font-black">Modelo (Produto)</th>
                          <th className="px-4 py-2 font-black">Cor</th>
                          <th className="px-4 py-2 font-black text-center">Tamanho</th>
                          <th className="px-4 py-2 font-black text-right">Qtd Plan</th>
                          <th className="px-4 py-2 font-black text-center border-l border-slate-200">Qtd CORTADA (Confirmação)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium font-mono text-slate-800">
                        {orderItems.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-2">{it.product_type}</td>
                            <td className="px-4 py-2">{it.color || plan.color}</td>
                            <td className="px-4 py-2 text-center font-black bg-slate-50">{it.size}</td>
                            <td className="px-4 py-2 text-right font-black text-blue-900 text-sm">{it.quantity_planned}</td>
                            <td className="px-4 py-2 border-l border-slate-200 text-center">
                              <div className="w-24 h-5 mx-auto border-b border-slate-400"></div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Assinaturas / Check-list */}
          <div className="mt-12 pt-8 border-t-2 border-slate-900 grid grid-cols-2 gap-8 break-inside-avoid">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 mb-8">Responsável pelo Corte:</p>
              <div className="border-b border-slate-900 w-full mb-1"></div>
              <p className="text-xs text-slate-600 font-medium">Nome / Assinatura / Data</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 mb-8">Responsável pelo Recebimento (Costura):</p>
              <div className="border-b border-slate-900 w-full mb-1"></div>
              <p className="text-xs text-slate-600 font-medium">Nome / Assinatura / Data</p>
            </div>
          </div>
          
        </div>
      </div>
      

    </div>
  , document.body); };

