import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Search, Scissors, CheckCircle, Package, Shirt, Users, Building, Plus, X, Edit, Trash2, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';


export const PcpControleFaccao = ({ currentUser }: any) => {
  const [activeTab, setActiveTab] = useState<'lotes' | 'faccoes'>('lotes');
  
  const [plans, setPlans] = useState<any[]>([]);
  const [faccoes, setFaccoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [selectedFaccaoId, setSelectedFaccaoId] = useState<string>('');
  const [itemReturns, setItemReturns] = useState<Record<string, number>>({});
  const [actionLoading, setActionLoading] = useState(false);

  // Faccoes Management State
  const [faccaoModalOpen, setFaccaoModalOpen] = useState(false);
  const [editingFaccao, setEditingFaccao] = useState<any>(null);
  const [faccaoName, setFaccaoName] = useState('');
  const [faccaoPhone, setFaccaoPhone] = useState('');

  // Faccao Prices State
  const [pricesModalOpen, setPricesModalOpen] = useState(false);
  const [selectedFaccaoForPrices, setSelectedFaccaoForPrices] = useState<any>(null);
  const [faccaoPrices, setFaccaoPrices] = useState<any[]>([]);
  const [allPrices, setAllPrices] = useState<any[]>([]);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [newPriceModel, setNewPriceModel] = useState('');
  const [newPriceValue, setNewPriceValue] = useState('');

  useEffect(() => {
    fetchData();
    fetchAllPrices();
    fetchFaccoes();
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

  const fetchAllPrices = async () => { try { const {data} = await supabase.from('faccao_prices').select('*'); setAllPrices(data||[]); } catch(e){} };

  const fetchFaccoes = async () => {
    try {
      const { data } = await supabase.from('faccoes').select('*').order('name');
      setFaccoes(data || []);
    } catch (e) { console.error(e); }
  };

  const loadPrices = async (faccaoId: number) => {
    try {
      const { data } = await supabase.from('faccao_prices').select('*').eq('faccao_id', faccaoId).order('product_type');
      setFaccaoPrices(data || []);
    } catch (e) { console.error(e); }
  };

  const handleSaveFaccao = async () => {
    if (!faccaoName.trim()) return alert('Nome da facção é obrigatório');
    setActionLoading(true);
    try {
      if (editingFaccao) {
        await supabase.from('faccoes').update({ name: faccaoName, phone: faccaoPhone }).eq('id', editingFaccao.id);
      } else {
        await supabase.from('faccoes').insert({ name: faccaoName, phone: faccaoPhone, active: true });
      }
      setFaccaoModalOpen(false);
      fetchFaccoes();
    } catch (e) {
      alert('Erro ao salvar facção');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddPrice = async () => {
    if (!newPriceModel.trim() || !newPriceValue) return;
    try {
      await supabase.from('faccao_prices').insert({
        faccao_id: selectedFaccaoForPrices.id,
        product_type: newPriceModel.trim(),
        price: parseFloat(newPriceValue.replace(',', '.'))
      });
      setNewPriceModel('');
      setNewPriceValue('');
      loadPrices(selectedFaccaoForPrices.id);
    } catch (e) {
      alert('Erro ao adicionar preço. Talvez o modelo já exista?');
    }
  };

  const handleDeletePrice = async (id: number) => {
    try {
      await supabase.from('faccao_prices').delete().eq('id', id);
      loadPrices(selectedFaccaoForPrices.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenSendModal = (plan: any) => {
    setSelectedPlan(plan);
    setSelectedFaccaoId('');
    setSendModalOpen(true);
  };

  const handleConfirmSendSewing = async () => {
    if (!selectedFaccaoId) return alert('Selecione uma facção!');
    setActionLoading(true);
    try {
      await fetch(`/api/cut-plans/${selectedPlan.id}/send-sewing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          qty_sewing: selectedPlan.qty_cut, 
          faccao_id: parseInt(selectedFaccaoId),
          user_name: currentUser?.name || 'Operador', 
          notes: 'Enviado via PCP' 
        })
      });
      setSendModalOpen(false);
      fetchData();
    } catch (e) {
      alert('Erro ao enviar.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReceiveModal = (plan: any) => {
    setSelectedPlan(plan);
    const initialReturns: Record<string, number> = {};
    (plan.items || []).filter((i:any) => i.status === 'IN_SEWING').forEach((it:any) => {
      initialReturns[it.id] = it.quantity_sewing; // Pre-fill with the amount that went
    });
    setItemReturns(initialReturns);
    setReceiveModalOpen(true);
  };

  const handleConfirmReceive = async () => {
    setActionLoading(true);
    try {
      const totalReturned = Object.values(itemReturns).reduce((sum, val) => sum + (val || 0), 0);
      
      await fetch(`/api/cut-plans/${selectedPlan.id}/return-sewing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qty_returned: totalReturned,
          item_quantities: itemReturns,
          user_name: currentUser?.name || 'Operador',
          notes: 'Conferência detalhada por modelo'
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

  const getFaccaoName = (id: number) => {
    const f = faccoes.find(fac => fac.id === id);
    return f ? f.name : 'Facção Desconhecida';
  };

  const aguardando = plans.filter(p => p.status === 'CUT_COMPLETED');
  const emCostura = plans.filter(p => p.status === 'IN_SEWING');
  const concluidos = plans.filter(p => p.status === 'SEWING_COMPLETED');

  const renderCard = (p: any, type: 'aguardando' | 'emCostura' | 'concluidos') => {
    const isExpanded = !!expandedCards[p.id];
    const toggleExpand = () => setExpandedCards(prev => ({...prev, [p.id]: !prev[p.id]}));

    // Calculate total value for this plan if concluded
    let planValue = 0;
    if (type === 'concluidos' && p.faccao_id) {
      const fPrices = allPrices.filter(pr => pr.faccao_id === p.faccao_id);
      (p.items || []).forEach((it: any) => {
        if (it.quantity_sewing_done > 0) {
          const priceObj = fPrices.find(pr => pr.product_type === it.product_type);
          if (priceObj) planValue += (it.quantity_sewing_done * Number(priceObj.price));
        }
      });
    }
    const uniqueOps = Array.from(new Set((p.items || []).map((it: any) => it.order_number))).filter(Boolean);
    const uniqueModels = Array.from(new Set((p.items || []).map((it: any) => it.product_type))).filter(Boolean);
    
    return (
      <Card key={p.id} className={`p-5 bg-white border-l-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${type === 'aguardando' ? 'border-l-indigo-500' : type === 'emCostura' ? 'border-l-purple-500' : 'border-l-emerald-500'}`}>
        {p.faccao_id && (
          <div className="absolute -right-6 top-3 bg-purple-100 text-purple-900 text-[10px] font-black uppercase px-8 py-1 rotate-45 shadow-sm border border-purple-200">
            {getFaccaoName(p.faccao_id)}
          </div>
        )}
        
        <div className="flex justify-between items-start mb-2 pr-12">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">{p.plan_number}</span>
          </div>
          <span className="text-[10px] text-slate-400">{new Date(p.created_at).toLocaleDateString()}</span>
        </div>
        
        <h3 className="text-lg font-black text-slate-800 flex items-center gap-1.5 leading-tight pr-12">
          {p.fabric || 'Tecido Misto'} <span className="text-slate-400 font-normal">&bull;</span> <span className="text-indigo-600">{p.color || 'Cores Variadas'}</span>
        </h3>
        
        <div className="bg-slate-50 rounded-xl p-3 mt-4 border border-slate-100">
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2 mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quantidade</span>
            <span className="text-lg font-black text-indigo-700">{type === 'aguardando' ? p.qty_cut : type === 'emCostura' ? p.qty_sewing : p.qty_sewing_done} <span className="text-xs font-bold text-indigo-400">peças</span></span>
          </div>
          
          <div className="flex justify-between items-center text-xs text-slate-600">
            <span className="font-bold text-slate-700"><b>{uniqueOps.length}</b> {uniqueOps.length === 1 ? 'pedido' : 'pedidos'}</span>
          </div>
        </div>

                {type === 'concluidos' && planValue > 0 && (
           <div className="mt-3 bg-emerald-50 text-emerald-800 p-2 rounded-lg flex justify-between items-center border border-emerald-100">
             <span className="text-xs font-bold uppercase">Valor a Pagar:</span>
             <span className="text-sm font-black">R$ {planValue.toFixed(2).replace('.', ',')}</span>
           </div>
        )}

        <button onClick={toggleExpand} className="w-full mt-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-50 rounded-lg border border-slate-200">
          {isExpanded ? 'Ocultar Detalhes' : 'Ver Detalhes'}
        </button>

        {isExpanded && (<div className="mt-3 space-y-1">
          {Array.from(
            (p.items || []).reduce((acc: Map<string, number>, it: any) => {
                const name = `${it.product_type} - ${it.size}`;
              const qty = type === 'aguardando' ? it.quantity_cut : type === 'emCostura' ? it.quantity_sewing : it.quantity_sewing_done;
              acc.set(name, (acc.get(name) || 0) + Number(qty || 0));
              return acc;
            }, new Map<string, number>())
          ).filter(([_, q]) => q > 0).map(([name, qty]) => (
            <div key={name} className="flex justify-between items-center text-[11px] bg-slate-100/50 px-2 py-1 rounded">
              <span className="font-bold text-slate-600">{name}</span>
              <span className="font-black text-slate-800">{qty} un</span>
            </div>
          ))}
        </div>

        )}
        {uniqueOps.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
            {uniqueOps.slice(0, 4).map((op: any) => (
              <span key={op as string} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold border border-slate-200">
                {op as string}
              </span>
            ))}
            {uniqueOps.length > 4 && (
              <span className="text-[9px] bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold">
                +{uniqueOps.length - 4}
              </span>
            )}
          </div>
        )}

        {type === 'aguardando' && (
          <button 
            onClick={() => handleOpenSendModal(p)}
            className="w-full mt-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors">
            <Building size={16} /> Escolher Facção
          </button>
        )}

        {type === 'emCostura' && (
          <button 
            onClick={() => handleOpenReceiveModal(p)}
            className="w-full mt-4 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-purple-200 transition-colors border border-purple-300 border-b-2">
            <CheckCircle size={16} /> Receber (Por Modelo)
          </button>
        )}
      </Card>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-12 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Costura (Facção)</h2>
          <p className="text-zinc-500 mt-1">Gestão de lotes, envios e tabela de preços por modelo</p>
        </div>
        
        <div className="flex p-1 bg-slate-100 rounded-xl">
          <button 
            onClick={() => setActiveTab('lotes')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'lotes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Shirt size={16} /> Lotes
          </button>
          <button 
            onClick={() => setActiveTab('faccoes')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'faccoes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Users size={16} /> Gestão de Facções
          </button>
        </div>
      </div>

      {activeTab === 'lotes' && (
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
      )}

      {activeTab === 'faccoes' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-600 text-sm font-medium">Gerencie as costureiras parceiras e defina o valor pago por modelo para cada uma delas.</p>
            <button 
              onClick={() => { setEditingFaccao(null); setFaccaoName(''); setFaccaoPhone(''); setFaccaoModalOpen(true); }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700"
            >
              <Plus size={16} /> Nova Facção
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {faccoes.map(fac => (
              <Card key={fac.id} className="p-5 bg-white border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-800">{fac.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{fac.phone || 'Sem telefone cadastrado'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingFaccao(fac); setFaccaoName(fac.name); setFaccaoPhone(fac.phone || ''); setFaccaoModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit size={16} />
                    </button>
                  </div>
                </div>
                
                <button 
                  onClick={() => { setSelectedFaccaoForPrices(fac); loadPrices(fac.id); setPricesModalOpen(true); }}
                  className="w-full py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                >
                  <DollarSign size={16} className="text-emerald-600" /> Tabela de Preços
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: SEND SEWING */}
      {sendModalOpen && selectedPlan && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black mb-2 tracking-tight text-slate-800">Enviar para Costura</h3>
            <p className="text-slate-500 mb-6 text-sm">Selecione a facção que irá costurar o Lote <strong className="text-slate-800">{selectedPlan.plan_number}</strong>.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-wide">Selecione a Facção</label>
                <select 
                  value={selectedFaccaoId}
                  onChange={e => setSelectedFaccaoId(e.target.value)}
                  className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Escolher --</option>
                  {faccoes.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button onClick={() => setSendModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Cancelar</button>
              <button onClick={handleConfirmSendSewing} disabled={actionLoading || !selectedFaccaoId} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50">
                {actionLoading ? 'Enviando...' : <><Shirt size={18}/> Enviar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECEIVE SEWING (EXACT ITEMS) */}
      {receiveModalOpen && selectedPlan && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black mb-2 tracking-tight text-slate-800">Conferência de Retorno</h3>
            <p className="text-slate-500 mb-4 text-sm">Lote: <strong className="text-slate-800">{selectedPlan.plan_number}</strong> | Facção: <strong className="text-purple-700">{getFaccaoName(selectedPlan.faccao_id)}</strong></p>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-h-[50vh] overflow-y-auto mb-6">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 px-2">
                <div className="col-span-3">Pedido</div>
                <div className="col-span-5">Modelo / Tam</div>
                <div className="col-span-4 text-right">Qtd Boa</div>
              </div>
              
              <div className="space-y-2">
                {(selectedPlan.items || []).filter((i:any) => i.status === 'IN_SEWING').map((it:any) => (
                  <div key={it.id} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                    <div className="col-span-3">
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{it.order_number}</span>
                    </div>
                    <div className="col-span-5 text-xs text-slate-700 leading-tight">
                      <span className="font-bold">{it.product_type}</span><br/>
                      Tam: <span className="font-black text-indigo-600">{it.size}</span>
                    </div>
                    <div className="col-span-4">
                      <input 
                        type="number" 
                        min="0"
                        value={itemReturns[it.id] ?? ''}
                        onChange={e => setItemReturns({...itemReturns, [it.id]: parseInt(e.target.value) || 0})}
                        className="w-full p-2 bg-emerald-50 border-2 border-emerald-200 text-emerald-900 font-black text-right rounded-lg focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-3 mt-4">
              <button onClick={() => setReceiveModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Cancelar</button>
              <button onClick={handleConfirmReceive} disabled={actionLoading} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-md shadow-emerald-200 flex items-center justify-center gap-2">
                {actionLoading ? 'Processando...' : <><CheckCircle size={18}/> Salvar Conferência</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD/EDIT FACCAO */}
      {faccaoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800">{editingFaccao ? 'Editar Facção' : 'Nova Facção'}</h3>
              <button onClick={() => setFaccaoModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Costureira / Facção</label>
                <input type="text" value={faccaoName} onChange={e => setFaccaoName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-indigo-500" placeholder="Ex: Facção Maria" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone (Opcional)</label>
                <input type="text" value={faccaoPhone} onChange={e => setFaccaoPhone(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-indigo-500" placeholder="(00) 00000-0000" />
              </div>
              <button onClick={handleSaveFaccao} disabled={actionLoading} className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">Salvar Cadastro</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TABELA DE PRECOS */}
      {pricesModalOpen && selectedFaccaoForPrices && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800">Tabela de Preços</h3>
                <p className="text-slate-500 text-sm">{selectedFaccaoForPrices.name}</p>
              </div>
              <button onClick={() => setPricesModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20}/></button>
            </div>
            
            <div className="flex gap-2 mb-6">
              <input type="text" value={newPriceModel} onChange={e => setNewPriceModel(e.target.value)} placeholder="Modelo (Ex: Gola Redonda)" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 outline-none" />
              <input type="text" value={newPriceValue} onChange={e => setNewPriceValue(e.target.value)} placeholder="R$ 3,00" className="w-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 outline-none text-right" />
              <button onClick={handleAddPrice} className="px-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"><Plus size={18}/></button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="p-3 font-black">Modelo</th>
                    <th className="p-3 font-black text-right">Valor Pago</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {faccaoPrices.map(price => (
                    <tr key={price.id} className="border-b border-slate-100 last:border-0">
                      <td className="p-3 font-bold text-slate-700">{price.product_type}</td>
                      <td className="p-3 font-black text-emerald-700 text-right">R$ {Number(price.price).toFixed(2).replace('.', ',')}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleDeletePrice(price.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                  {faccaoPrices.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-400 text-sm">Nenhum preço cadastrado. Crie um modelo acima.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


