import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { safeFormat } from '../lib/utils';
import type { Order, Stage } from '../types';

interface PrintContainerProps {
  activeTab: string;
  orders: Order[];
  stages: Stage[];
  selectedStageFilter: string;
  printTypeFilter: string;
  productTypeFilter: string;
  searchTerm: string;
  selectedStageStatus: 'Pending' | 'Finished';
  isPrintModalOpen?: boolean;
}

export const PrintContainer: React.FC<PrintContainerProps> = ({
  activeTab,
  orders,
  stages,
  selectedStageFilter,
  printTypeFilter,
  productTypeFilter,
  searchTerm,
  selectedStageStatus,
  isPrintModalOpen,
}) => {
  // Se o modal de relatório gerencial estiver aberto, não renderiza a sequência para evitar colisão
  if (isPrintModalOpen) return null;

  // Somente renderiza nas abas de Pedidos ou Kanban
  if (activeTab !== 'kanban' && activeTab !== 'orders') return null;

  const filteredOrders = (orders || [])
    .filter((o) => o.status !== 'Entregue' && o.status !== 'Cancelado')
    .filter((o) => !printTypeFilter || o.print_type === printTypeFilter)
    .filter((o) => !productTypeFilter || o.product_type === productTypeFilter)
    .filter((o) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        (o.order_number || '').toLowerCase().includes(search) ||
        (o.client_name || '').toLowerCase().includes(search) ||
        (o.product_type || '').toLowerCase().includes(search) ||
        (o.print_type || '').toLowerCase().includes(search)
      );
    })
    .filter((o) => {
      if (!selectedStageFilter) return true;
      const st = (o.stages_status || []).find((s) => s.id?.toString() === selectedStageFilter);
      if (!st) return false;
      if (selectedStageStatus === 'Finished') return st.finished;
      return !st.finished;
    })
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));

  const activeStageName = selectedStageFilter
    ? (stages || []).find((s) => s.id?.toString() === selectedStageFilter)?.name || selectedStageFilter
    : null;

  return (
    <div className="print-container hidden text-black bg-white w-full p-8 font-sans">
      <div className="mb-6 border-b-2 border-zinc-900 pb-4 flex justify-between items-end">
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest text-zinc-600">
            ComfortPro | Gestão de Produção
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-zinc-950">Sequência de Produção</h1>
          <p className="text-xs font-semibold mt-1 text-zinc-500">
            Emitido em: {format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })} • Total de Pedidos: {filteredOrders.length}
          </p>
        </div>
        <div className="text-right text-xs">
          {activeStageName && (
            <p className="text-zinc-700">
              Etapa: <strong className="text-zinc-950 font-bold">{activeStageName}</strong>{' '}
              ({selectedStageStatus === 'Finished' ? 'Concluídos' : 'Pendentes'})
            </p>
          )}
          {productTypeFilter && (
            <p className="text-zinc-700">
              Produto: <strong className="text-zinc-950 font-bold">{productTypeFilter}</strong>
            </p>
          )}
          {printTypeFilter && (
            <p className="text-zinc-700">
              Estampa: <strong className="text-zinc-950 font-bold">{printTypeFilter}</strong>
            </p>
          )}
        </div>
      </div>

      <table className="w-full border-collapse text-xs text-left">
        <thead>
          <tr className="bg-zinc-100 border-b-2 border-zinc-900 uppercase text-[10px] tracking-wider text-zinc-800">
            <th className="p-2 border-b border-zinc-300 font-bold">Pedido / Cliente</th>
            <th className="p-2 border-b border-zinc-300 text-center font-bold">Qtde</th>
            <th className="p-2 border-b border-zinc-300 font-bold">Estampa</th>
            <th className="p-2 border-b border-zinc-300 font-bold">Etapa Atual</th>
            <th className="p-2 border-b border-zinc-300 text-center font-bold">Prazo</th>
            <th className="p-2 border-b border-zinc-300 font-bold" style={{ minWidth: '180px' }}>
              Observação
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredOrders.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-zinc-500 italic">
                Nenhum pedido em produção encontrado para os filtros selecionados.
              </td>
            </tr>
          ) : (
            filteredOrders.map((o, idx) => (
              <tr key={o.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/80'}>
                <td className="p-2 border-b border-zinc-200 font-medium">
                  <div className="font-bold text-zinc-950 text-sm">{o.client_name}</div>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    #{o.order_number} {o.product_type ? `• ${o.product_type}` : ''}
                  </div>
                </td>
                <td className="p-2 border-b border-zinc-200 text-center font-black text-sm text-zinc-950">
                  {o.quantity}
                </td>
                <td className="p-2 border-b border-zinc-200 text-xs text-zinc-700 font-medium">
                  {o.print_type || '-'}
                </td>
                <td className="p-2 border-b border-zinc-200 text-xs font-bold text-zinc-800">
                  {o.active_stage_name || '-'}
                </td>
                <td className="p-2 border-b border-zinc-200 text-center text-xs font-bold text-zinc-900">
                  {safeFormat(o.deadline, 'dd/MM')}
                </td>
                <td className="p-2 border-b border-zinc-200 text-xs text-zinc-700" style={{ minWidth: '180px' }}>
                  {o.active_stage_observation ? (
                    <span className="italic">
                      📝{' '}
                      {o.active_stage_observation.length > 120
                        ? `${o.active_stage_observation.slice(0, 120)}...`
                        : o.active_stage_observation}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
