import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { safeFetch } from '../../lib/utils';
import { Badge } from '../../components/Badge';

export const PcpPrioridades = () => {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await safeFetch('/api/pcp-phase1/prioridades');
      if (data) setOrders(data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Fila de Prioridades</h2>
          <p className="text-zinc-500 mt-1">Ordem de execução da fábrica (baseado no Priority Score)</p>
        </div>
      </div>

      <div className="space-y-4">
        {orders.map((o, idx) => (
          <Card key={o.id} className="p-6 border-none shadow-sm bg-white hover:border-zinc-300 transition-colors flex items-center gap-6">
            <div className="flex-shrink-0 w-12 h-12 bg-zinc-900 text-white rounded-xl flex items-center justify-center font-black text-xl">
              #{idx + 1}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-black text-zinc-900">{o.order_number}</h3>
                  <p className="text-sm text-zinc-500">{o.client_name}</p>
                </div>
                <Badge variant={
                  o.pcp_priority === 'CRÍTICO' ? 'destructive' :
                  o.pcp_priority === 'URGENTE' ? 'warning' : 'default'
                }>
                  {o.pcp_priority} (Score: {o.pcp_priority_score})
                </Badge>
              </div>
              <div className="mt-4 flex gap-4 text-sm">
                <div className="text-zinc-600"><span className="font-bold text-zinc-900">Prazo:</span> {new Date(o.deadline).toLocaleDateString('pt-BR')}</div>
                <div className="text-zinc-600"><span className="font-bold text-zinc-900">Status:</span> {o.pcp_status}</div>
                {o.pcp_is_blocked && <div className="text-rose-600 font-bold flex items-center gap-1">BLOQUEADO</div>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
