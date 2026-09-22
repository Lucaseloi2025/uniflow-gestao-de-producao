import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { safeFormat } from '../lib/utils';
import type { Order, Stage } from '../types';

export const PrintContainer = ({
  activeTab, orders, stages, selectedStageFilter, printTypeFilter, productTypeFilter, searchTerm, selectedStageStatus
}: any) => {
  return (
    <>
      {/* Print Container */}
      {(activeTab === 'kanban' || activeTab === 'orders') && (
        <div className="print-container hidden text-black bg-white w-full p-8 font-sans">
          <div className="mb-6 border-b border-zinc-300 pb-4 flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-tight">Sequência de Produção</h1>
              <p className="text-sm mt-1 text-zinc-500">
                Emitido em: {format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div className="text-right text-sm">
              {selectedStageFilter && (
                <p>Etapa: <strong>{stages.find(s => s.id.toString() === selectedStageFilter)?.name || selectedStageFilter}</strong></p>
              )}
              {printTypeFilter && <p>Estampa: <strong>{printTypeFilter}</strong></p>}
            </div>
          </div>
          <table className="w-full border-collapse text-sm text-left">
            <thead>
              <tr className="bg-zinc-100 border-b-2 border-zinc-300 uppercase text-[10px] tracking-wider text-zinc-600">
                <th className="p-2 border-r border-zinc-200">Cliente</th>
                <th className="p-2 border-r border-zinc-200 text-center">Qtde</th>
                <th className="p-2 border-r border-zinc-200">Estampa</th>
                <th className="p-2 border-r border-zinc-200">Etapa atual</th>
                <th className="p-2 border-r border-zinc-200 text-center">Prazo</th>
                <th className="p-2 text-left" style={{minWidth: '200px'}}>Observação</th>
              </tr>
            </thead>
            <tbody>
              {(orders || [])
                .filter(o => o.status !== 'Entregue' && o.status !== 'Cancelado')
                .filter(o => !printTypeFilter || o.print_type === printTypeFilter)
                .filter(o => !productTypeFilter || o.product_type === productTypeFilter)
                .filter(o => {
                    if (!searchTerm) return true;
                    const search = searchTerm.toLowerCase();
                    return (
                      o.order_number.toLowerCase().includes(search) ||
                      o.client_name.toLowerCase().includes(search) ||
                      o.product_type.toLowerCase().includes(search) ||
                      (o.print_type || '').toLowerCase().includes(search)
                    );
                })
                .filter(o => {
                    if (!selectedStageFilter) return true;
                    const st = o.stages_status.find(s => s.id.toString() === selectedStageFilter);
                    if (!st) return false;
                    if (selectedStageStatus === 'Finished') return st.finished;
                    return !st.finished;
                })
                .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
                .map((o, idx) => (
                  <tr key={o.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                    <td className="p-2 border-b border-zinc-200 border-r font-medium truncate max-w-[220px]">{o.client_name}</td>
                    <td className="p-2 border-b border-zinc-200 border-r text-center font-bold">{o.quantity}</td>
                    <td className="p-2 border-b border-zinc-200 border-r text-xs">{o.print_type || '-'}</td>
                    <td className="p-2 border-b border-zinc-200 border-r text-xs font-semibold text-zinc-700">{o.active_stage_name || '-'}</td>
                    <td className="p-2 border-b border-zinc-200 border-r text-center text-xs font-medium">{safeFormat(o.deadline, 'dd/MM')}</td>
                    <td className="p-2 border-b border-zinc-200 text-xs text-zinc-700" style={{minWidth: '200px'}}>
                      {o.active_stage_observation 
                        ? <span className="italic">📝 {o.active_stage_observation.length > 120 
                            ? `${o.active_stage_observation.slice(0, 120)}...` 
                            : o.active_stage_observation}</span>
                        : ''}
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      
    </>
  );
};
