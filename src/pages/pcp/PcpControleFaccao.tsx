import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/Badge';
import { Search, Scissors, ArrowRight, CheckCircle, Package, AlertTriangle, Shirt } from 'lucide-react';

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

  const renderCard = (p: any, type: 'aguardando' | 'emCostura' | 'concluidos') => {
    const uniqueOps = Array.from(new Set((p.items || []).map((it: any) => it.order_number))).filter(Boolean);
    const uniqueModels = Array.from(new Set((p.items || []).map((it: any) => it.product_type))).filter(Boolean);
    
    return (
      <Card key={p.id} className={`p-5 bg-white border-l-4 shadow-sm hover:shadow-md transition-shadow ${type === 'aguardando' ? 'border-l-indigo-500' : type === 'emCostura' ? 'border-l-purple-500' : 'border-l-emerald-500'}`}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">{p.plan_number}</span>
            {p.is_manual && <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-bold">MANUAL</span>}
          </div>
          <span className="text-[10px] text-slate-400">{new Date(p.created_at).toLocaleDateString()}</span>
        </div>
        
        <h3 className="text-lg font-black text-slate-800 flex items-center gap-1.5 leading-tight">
          {p.fabric || 'Tecido Misto'} <span className="text-slate-400 font-normal">&bull;</span> <span className="text-indigo-600">{p.color || 'Cores Variadas'}</span>
        </h3>
        
        <div className="bg-slate-50 rounded-xl p-3 mt-4 border border-slate-100">
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2 mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quantidade</span>
            <span className="text-lg font-black text-indigo-700">{type === 'aguardando' ? p.qty_cut : type === 'emCostura' ? p.qty_sewing : p.qty_sewing_done} <span className="text-xs font-bold text-indigo-400">peças</span></span>
          </div>
          
          <div className="flex justify-between items-center text-xs text-slate-600">
            <span className="font-medium"><b>{uniqueModels.length}</b> modelos</span>
            <span className="font-medium text-slate-400">&bull;</span>
            <span className="font-bold text-slate-700"><b>{uniqueOps.length}</b> {uniqueOps.length === 1 ? 'pedido' : 'pedidos'}</span>
          </div>
        </div>

        {uniqueOps.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {uniqueOps.slice(0, 3).map((op: any) => (
              <span key={op} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold border border-slate-200">
                {op}
              </span>
            ))}
            {uniqueOps.length > 3 && (
              <span className="text-[9px] bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold">
                +{uniqueOps.length - 3}
              </span>
            )}
          </div>
        )}

        {type === 'emCostura' && p.qty_sewing_done > 0 && (
          <div className="mt-3 bg-emerald-50 text-emerald-700 text-xs font-bold p-2 rounded-lg text-center border border-emerald-100">
            Já retornou: {p.qty_sewing_done} peças
          </div>
        )}

        {type === 'aguardando' && (
          <button 
            onClick={() => handleSendSewing(p)}
            className="w-full mt-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors">
            <Shirt size={16} /> Enviar p/ Costura
          </button>
        )}

        {type === 'emCostura' && (
          <button 
            onClick={() => { 
              setSelectedPlan(p); 
              setQtyBoa(p.qty_sewing); 
              setReceiveModalOpen(true); 
            }}
            className="w-full mt-4 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-purple-200 transition-colors">
            <CheckCircle size={16} /> Receber Retorno
          </button>
        )}
      </Card>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-12 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Costura (Facção)</h2>
          <p className="text-zinc-500 mt-1">Gestão de lotes enviados para costureiras externas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
          <div className="flex justify-between items-center mb-2 px-1">
            <h3 className="font-black text-slate-700 uppercase tracking-wide text-sm flex items-center gap-2">
              <Scissors size={16} className="text-indigo-500"/> Prontos para Envio
            </h3>
            <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full">{aguardando.length}</span>
          </div>
          {aguardando.map(p => renderCard(p, 'aguardando'))}
          {aguardando.length === 0 && (
            <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-sm">
              Nenhum lote aguardando
            </div>
          )}
        </div>

        <div className="space-y-4 bg-purple-50/30 p-4 rounded-2xl border border-purple-100/50">
          <div className="flex justify-between items-center mb-2 px-1">
            <h3 className="font-black text-purple-900 uppercase tracking-wide text-sm flex items-center gap-2">
              <Shirt size={16} className="text-purple-500"/> Em Costura
            </h3>
            <span className="bg-purple-200 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full">{emCostura.length}</span>
          </div>
          {emCostura.map(p => renderCard(p, 'emCostura'))}
          {emCostura.length === 0 && (
            <div className="text-center p-8 border-2 border-dashed border-purple-200 rounded-2xl text-purple-400 font-bold text-sm">
              Nenhuma costura em andamento
            </div>
          )}
        </div>

        <div className="space-y-4 bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100/50">
          <div className="flex justify-between items-center mb-2 px-1">
            <h3 className="font-black text-emerald-900 uppercase tracking-wide text-sm flex items-center gap-2">
              <Package size={16} className="text-emerald-500"/> Retornados
            </h3>
            <span className="bg-emerald-200 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">{concluidos.length}</span>
          </div>
          {concluidos.slice(0, 15).map(p => renderCard(p, 'concluidos'))}
          {concluidos.length === 0 && (
            <div className="text-center p-8 border-2 border-dashed border-emerald-200 rounded-2xl text-emerald-400 font-bold text-sm">
              Nenhum lote finalizado
            </div>
          )}
        </div>
      </div>

      {receiveModalOpen && selectedPlan && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black mb-2 tracking-tight text-slate-800">Receber Lote - {selectedPlan.plan_number}</h3>
            <p className="text-slate-500 mb-6">Confirme a quantidade de peças que retornaram da costura para liberar o lote para estamparia.</p>
            
            <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200 max-h-60 overflow-y-auto">
              <h4 className="font-bold text-sm text-slate-700 mb-3 uppercase tracking-wider">OPs Contidas Neste Lote:</h4>
              <ul className="text-xs space-y-2">
                {(selectedPlan.items || []).filter((i:any) => i.status === 'IN_SEWING').map((it:any) => (
                  <li key={it.id} className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                    <span className="text-slate-600">
                      <strong className="text-slate-800 font-mono bg-white px-1 py-0.5 rounded border border-slate-200 mr-2">{it.order_number}</strong> 
                      {it.product_type} <span className="text-slate-400">&bull;</span> Tam: <b>{it.size}</b>
                    </span>
                    <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{it.quantity_sewing} un</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-wide">Quantidade Retornada (Boas)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={qtyBoa} 
                    onChange={e => setQtyBoa(parseInt(e.target.value))} 
                    className="w-full p-4 pl-12 border-2 border-emerald-500 bg-emerald-50/50 rounded-xl font-black text-2xl text-emerald-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all" 
                  />
                  <CheckCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={24} />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button onClick={() => setReceiveModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={handleReceive} disabled={actionLoading} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200 flex items-center justify-center gap-2">
                {actionLoading ? 'Processando...' : <><CheckCircle size={18}/> Confirmar Recebimento</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
