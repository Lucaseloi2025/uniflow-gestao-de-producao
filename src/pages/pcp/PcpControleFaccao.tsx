import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Search, Scissors, ArrowRight, CheckCircle, Package } from 'lucide-react';

export const PcpControleFaccao = ({ currentUser }: any) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [qtyBoa, setQtyBoa] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cut-plans');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlans(data.filter(p => ['CUT_COMPLETED', 'IN_SEWING', 'SEWING_COMPLETED'].includes(p.status)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendSewing = async (plan: any) => {
    const costureira = window.prompt(`Enviar Plano ${plan.plan_number} para qual costureira/facção?`);
    if (!costureira) return;
    
    try {
      await fetch(`/api/cut-plans/${plan.id}/send-sewing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          qty_sewing: plan.qty_cut, 
          user_name: currentUser?.name || 'Operador', 
          notes: 'Enviado para: ' + costureira 
        })
      });
      fetchData();
    } catch (e) {}
  };

  const handleReceive = async () => {
    if (!selectedPlan) return;
    setActionLoading(true);
    try {
      await fetch(`/api/cut-plans/${selectedPlan.id}/return-sewing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qty_returned: qtyBoa,
          user_name: currentUser?.name || 'Operador',
          notes: 'Conferência de costura'
        })
      });
      setReceiveModalOpen(false);
      setSelectedPlan(null);
      fetchData();
    } catch (e) {
      alert('Erro: ' + (e as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const aguardando = plans.filter(p => p.status === 'CUT_COMPLETED');
  const emCostura = plans.filter(p => p.status === 'IN_SEWING');
  const concluidos = plans.filter(p => p.status === 'SEWING_COMPLETED');

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Costura (Facção)</h2>
          <p className="text-zinc-500 mt-1">Controle de envio para costureiras e registro de retorno</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h3 className="font-bold text-zinc-700 flex items-center gap-2">
            <Scissors size={18} /> Prontos para Envio ({aguardando.length})
          </h3>
          {aguardando.map(p => (
            <Card key={p.id} className="p-4 bg-white border-l-4 border-l-indigo-500">
              <span className="text-xs font-bold text-zinc-500">{p.plan_number}</span>
              <p className="font-black text-zinc-900 mt-1">Corte concluído. Prontos: {p.qty_cut}</p>
              <button 
                onClick={() => handleSendSewing(p)}
                className="w-full mt-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700">
                Enviar p/ Costura <ArrowRight size={16} />
              </button>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-zinc-700 flex items-center gap-2">
            <ArrowRight size={18} /> Em Costura ({emCostura.length})
          </h3>
          {emCostura.map(p => (
            <Card key={p.id} className="p-4 bg-white border-l-4 border-l-purple-500">
              <span className="text-xs font-bold text-zinc-500">{p.plan_number}</span>
              <p className="font-black text-zinc-900 mt-1">Em costura: {p.qty_sewing}</p>
              {p.qty_sewing_done > 0 && <p className="text-xs text-emerald-600 font-bold mt-1">Já retornou: {p.qty_sewing_done}</p>}
              <button 
                onClick={() => { 
                  setSelectedPlan(p); 
                  setQtyBoa(p.qty_sewing); 
                  setReceiveModalOpen(true); 
                }}
                className="w-full mt-3 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-purple-200">
                Receber / Conferir <CheckCircle size={16} />
              </button>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-zinc-700 flex items-center gap-2">
            <Package size={18} /> Retornados ({concluidos.length})
          </h3>
          {concluidos.slice(0, 10).map(p => (
            <Card key={p.id} className="p-4 bg-zinc-50 border border-zinc-200 opacity-75">
              <span className="text-xs font-bold text-zinc-500">{p.plan_number}</span>
              <p className="font-bold text-emerald-700 mt-1">Costura Concluída: {p.qty_sewing_done}</p>
            </Card>
          ))}
        </div>
      </div>

      {receiveModalOpen && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full">
            <h3 className="text-xl font-black mb-4">Conferência e Baixa - {selectedPlan.plan_number}</h3>
            
            <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-60 overflow-y-auto">
              <h4 className="font-bold text-sm text-slate-700 mb-2">Itens OPs originais (Serão atualizados):</h4>
              <ul className="text-xs space-y-1">
                {(selectedPlan.items || []).filter((i:any) => i.status === 'IN_SEWING').map((it:any) => (
                  <li key={it.id} className="flex justify-between border-b border-slate-200 pb-1">
                    <span><strong>Pedido: {it.order_number}</strong> | {it.product_type} {it.size}</span>
                    <span className="font-bold">{it.quantity_sewing} peças aguardadas</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-emerald-700 mb-1">Quantidade Boa (Retornou da Costura)</label>
                <input type="number" value={qtyBoa} onChange={e => setQtyBoa(parseInt(e.target.value))} className="w-full p-3 border-2 border-emerald-500 bg-emerald-50 rounded-lg font-bold text-lg" />
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button onClick={() => setReceiveModalOpen(false)} className="flex-1 p-2 bg-zinc-100 text-zinc-700 rounded-lg font-bold">Cancelar</button>
              <button onClick={handleReceive} disabled={actionLoading} className="flex-1 p-2 bg-emerald-600 text-white rounded-lg font-bold">
                {actionLoading ? 'Processando...' : 'Confirmar Baixa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
