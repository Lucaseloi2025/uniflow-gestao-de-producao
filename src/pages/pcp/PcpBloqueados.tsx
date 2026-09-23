import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { safeFetch } from '../../lib/utils';
import { Lock, Unlock } from 'lucide-react';

export const PcpBloqueados = ({ currentUser }: any) => {
  const [blocks, setBlocks] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await safeFetch('/api/pcp-phase1/bloqueados');
      if (data) setBlocks(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDesbloquear = async (orderId: number) => {
    try {
      await fetch(/api/pcp-phase1/ordens/ + orderId + /desbloqueio, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: currentUser?.name })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Pedidos Bloqueados</h2>
          <p className="text-zinc-500 mt-1">Pedidos com impeditivos para a produção</p>
        </div>
      </div>

      <div className="space-y-4">
        {blocks.map((b) => (
          <Card key={b.id} className="p-6 border border-rose-200 shadow-sm bg-rose-50/30 flex items-start gap-6">
            <div className="flex-shrink-0 w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
              <Lock size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-zinc-900">Pedido {b.orders?.order_number} <span className="text-zinc-500 font-medium text-sm ml-2">({b.orders?.client_name})</span></h3>
              <div className="mt-2 text-sm text-zinc-700">
                <span className="font-bold text-rose-700">Motivo:</span> {b.motivo}
              </div>
              <div className="mt-1 text-sm text-zinc-700">
                <span className="font-bold">Observação:</span> {b.observacao || '-'}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Bloqueado por {b.bloqueado_por} em {new Date(b.data_bloqueio).toLocaleString('pt-BR')}
              </div>
            </div>
            <button 
              onClick={() => handleDesbloquear(b.order_id)}
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-zinc-800 transition-colors">
              <Unlock size={16} />
              Desbloquear
            </button>
          </Card>
        ))}
        {blocks.length === 0 && (
          <div className="p-12 text-center text-zinc-500 border border-dashed border-zinc-300 rounded-2xl">
            Nenhum pedido bloqueado no momento!
          </div>
        )}
      </div>
    </div>
  );
};
