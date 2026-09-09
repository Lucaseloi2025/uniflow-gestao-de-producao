import React from 'react';
import { ApprovedEnfestoPlan } from '../lib/enfestoUtils';
import { Printer, X, Scissors, PackageCheck, AlertTriangle } from 'lucide-react';

interface PrintableEnfestoSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: ApprovedEnfestoPlan | null;
}

export const PrintableEnfestoSheetModal: React.FC<PrintableEnfestoSheetModalProps> = ({
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
      return isoStr;
    }
  };

  const isRecorte = plan.model.toLowerCase().includes('recorte') || (plan.color && plan.color.toLowerCase().includes('recorte'));

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-150">
        
        {/* Modal Controls Header (Screen only) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-400">
            <Scissors size={16} /> FICHA DE IMPRESSÃO DE ENFESTO
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Printer size={16} /> IMPRIMIR FICHA (CORTADOR)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PRINTABLE SHEET CONTAINER */}
        <div className="p-8 sm:p-10 space-y-6 font-sans text-slate-900 bg-white text-left print:p-0 print:m-0 print:shadow-none">
          
          {/* Header Ficha */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start gap-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-blue-900 block">
                COMFORTPRO — GESTÃO INTEGRADA DE CORTE
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 uppercase tracking-tight">
                ORDEM DE CORTE & FICHA DE ENFESTO
              </h1>
              <p className="text-xs font-bold text-slate-600 mt-0.5">
                Identificador: <span className="font-mono text-slate-900 font-black">{plan.id}</span>
              </p>
            </div>

            <div className="text-right font-mono text-xs border border-slate-900 p-2.5 rounded-xl bg-slate-50">
              <p className="font-black text-slate-900 text-sm">STATUS: {plan.status}</p>
              <p className="text-[10px] text-slate-600 mt-1">Aprovado em: {formatDate(plan.created_at)}</p>
              <p className="text-[10px] text-slate-600">Aprovado por: {plan.user_name}</p>
            </div>
          </div>

          {/* Dados Gerais do Produto */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-300 font-mono text-xs">
            <div>
              <span className="text-[10px] uppercase font-black text-slate-500 block">Modelo / Produto:</span>
              <strong className="text-sm font-black text-slate-900 uppercase block">{plan.model}</strong>
            </div>

            <div>
              <span className="text-[10px] uppercase font-black text-slate-500 block">Tecido / Tipo:</span>
              <strong className="text-sm font-black text-slate-900 uppercase block">{plan.fabric} ({plan.tipoTecido})</strong>
            </div>

            <div className="col-span-2">
              <span className="text-[10px] uppercase font-black text-slate-500 block">Corpo & Recorte (Cores):</span>
              <strong className="text-sm font-black text-blue-950 bg-blue-100 px-2 py-0.5 rounded border border-blue-300 uppercase block mt-0.5">
                {plan.color}
              </strong>
            </div>
          </div>

          {/* Alerta de Recorte (se aplicável) */}
          {isRecorte && (
            <div className="p-3.5 bg-amber-50 border-2 border-amber-400 text-amber-950 rounded-xl text-xs font-bold flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="uppercase font-black text-amber-900 block mb-0.5">⚠️ ATENÇÃO AO CORTE (MODELO COM RECORTE / PAINEL):</strong>
                Verifique atentamente a cor do tecido do <strong>CORPO</strong> e a cor do tecido do <strong>RECORTE</strong> especificadas acima antes de enfestar!
              </div>
            </div>
          )}

          {/* Resumo de Pedidos Atendidos */}
          {plan.pedidos_inclusos && plan.pedidos_inclusos.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-1">
                <PackageCheck size={14} className="text-blue-600" /> PEDIDOS ATENDIDOS NESTE LOTE DE CORTE ({plan.pedidos_inclusos.length} PEDIDO(S))
              </h3>

              <table className="w-full text-xs font-mono border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 font-black uppercase text-slate-700 text-[10px]">
                    <th className="border border-slate-300 p-2 text-left">Pedido</th>
                    <th className="border border-slate-300 p-2 text-left">Cliente</th>
                    <th className="border border-slate-300 p-2 text-right">Qtd Peças</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.pedidos_inclusos.map((ped, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="border border-slate-300 p-2 font-bold">{ped.order_number || `#${ped.order_id}`}</td>
                      <td className="border border-slate-300 p-2">{ped.customer_name || 'Cliente'}</td>
                      <td className="border border-slate-300 p-2 text-right font-black">{ped.quantity} un</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detalhamento dos Enfestos e Tabela de Lançamento Optitex */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-1">
              <Scissors size={14} className="text-blue-600" /> DETALHAMENTO DE RISCOS PARA CORTE & OPTITEX
            </h3>

            <div className="space-y-3">
              {plan.enfestos.map((enf, idx) => (
                <div key={enf.id || idx} className="p-4 border-2 border-slate-300 rounded-xl space-y-3 bg-white">
                  <div className="flex justify-between items-start font-mono text-xs border-b border-slate-200 pb-2">
                    <div>
                      <span className="font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase text-[10px]">
                        RISCO #{idx + 1}
                      </span>
                      <span className="font-black text-slate-900 text-sm ml-2">{enf.titulo}</span>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-slate-900">{enf.passadas} Enfestos</span> •{' '}
                      <span className="font-bold">{enf.consumo_metros}m est.</span>
                    </div>
                  </div>

                  {/* Grade do Risco & Total Produzido */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-500 block">📐 Moldes no Risco (por Camada):</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {Object.entries(enf.peças_por_passada).map(([sz, qty]) => (
                          <span key={sz} className="px-2 py-0.5 bg-blue-50 rounded border border-blue-200 font-black text-blue-950">
                            {qty}× {sz}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-500 block">📦 Total Cortado ({enf.passadas} enfesto(s)):</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {Object.entries(enf.producao_por_tamanho).map(([sz, prod]) => (
                          <span key={sz} className="px-2 py-0.5 bg-slate-100 rounded border border-slate-300 font-bold text-slate-900">
                            {sz}: {prod} un
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Campo de Preenchimento Manual para Optitex */}
                  <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border border-dashed border-slate-400 font-mono text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-700 block mb-1">
                        Comprimento Real no Optitex (Metros):
                      </span>
                      <div className="h-8 border-b-2 border-slate-900 text-sm font-black flex items-center px-2">
                        {enf.comprimento_real_metros ? `${enf.comprimento_real_metros} m` : '[ _____ m ]'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-700 block mb-1">
                        Eficiência Real no Optitex (%):
                      </span>
                      <div className="h-8 border-b-2 border-slate-900 text-sm font-black flex items-center px-2">
                        {enf.eficiencia_optitex_pct ? `${enf.eficiencia_optitex_pct.toFixed(2)} %` : '[ _____ % ]'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo Geral do Plano */}
          <div className="p-4 bg-slate-900 text-white rounded-xl flex justify-between items-center font-mono text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total de Peças a Cortar</span>
              <strong className="text-xl font-black text-white">{plan.resumo.total_planejado} un</strong>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total de Enfestos</span>
              <strong className="text-xl font-black text-white">{plan.resumo.total_passadas} enfestos</strong>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Consumo Linear Total</span>
              <strong className="text-xl font-black text-blue-300">{plan.resumo.total_metros_previstos} m</strong>
            </div>
          </div>

          {/* Assinatura / Campo de Campo */}
          <div className="pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs font-mono">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-6">Assinatura do Cortador/Enfestador:</p>
              <div className="border-b border-slate-900"></div>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-6">Data e Hora do Corte Finalizado:</p>
              <div className="border-b border-slate-900"></div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
