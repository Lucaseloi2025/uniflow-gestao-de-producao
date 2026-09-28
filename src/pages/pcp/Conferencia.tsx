import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, User, Stage } from '../../types';
import { Card } from '../../components/ui/Card';
import { CheckCircle2, AlertTriangle, Package, ChevronRight, X, Minus, Plus, Search } from 'lucide-react';
import { safeFormat } from '../../lib/utils';

interface ConferenciaProps {
  orders: Order[];
  currentUser: User | null;
  stages: Stage[];
  fetchOrders: () => void;
}

export const Conferencia: React.FC<ConferenciaProps> = ({ orders, currentUser, stages, fetchOrders }) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Track checked quantities
  const [checkedItems, setCheckedItems] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Identify Conferencia stage
  const conferenciaStage = stages.find(s => s.name.toLowerCase().includes('confer') || s.name.toLowerCase().includes('separ'));

  // Filter orders that are in Conferencia
  const conferenciaOrders = useMemo(() => {
    if (!conferenciaStage) return [];
    
    return orders.filter(o => {
      const activeStageIds = o.active_stages?.map(st => st.id) || [];
      const hasConferStage = activeStageIds.includes(conferenciaStage.id);
      
      const searchMatch = (o.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (o.order_number || '').toLowerCase().includes(searchTerm.toLowerCase());
                          
      return hasConferStage && searchMatch;
    });
  }, [orders, conferenciaStage, searchTerm]);

  // Handle open modal
  const handleOpenOrder = (order: Order) => {
    setSelectedOrder(order);
    
    // Initialize checked states based on items
    const rawItems = order.items as any;
    const items = typeof rawItems === 'string' ? JSON.parse(rawItems) : (rawItems || []);
    
    const initialChecked: Record<string, number> = {};
    items.forEach((it: any) => {
      const sku = it.codigo || it.sku || it.produto || 'unknown';
      initialChecked[sku] = 0;
    });
    setCheckedItems(initialChecked);
  };

  const currentItems = useMemo(() => {
    if (!selectedOrder) return [];
    const rawItems = selectedOrder.items as any;
    return typeof rawItems === 'string' ? JSON.parse(rawItems) : (rawItems || []);
  }, [selectedOrder]);

  const handleAdjustCheck = (sku: string, delta: number, max: number) => {
    setCheckedItems(prev => {
      const current = prev[sku] || 0;
      const next = Math.max(0, Math.min(current + delta, max));
      return { ...prev, [sku]: next };
    });
  };

  const handleRegistrarFalta = async (sku: string, productName: string, expected: number, found: number) => {
    if (!selectedOrder || !conferenciaStage) return;
    const missing = expected - found;
    if (missing <= 0) return;

    if (!window.confirm(`Deseja registrar falta de ${missing}x ${productName}? Uma pendência será gerada no Corte.`)) return;

    try {
      // Registrar Perda
      const res = await fetch(`/api/orders/${selectedOrder.id}/stages/${conferenciaStage.id}/loss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantidade_perdida: missing,
          motivo: 'Peça não encontrada na separação',
          motivo_detalhe: `SKU: ${sku} / Produto: ${productName}`,
          etapa_reentrada_id: 2, // 2 é Corte
          user_id: currentUser?.id,
          user_name: currentUser?.name
        })
      });

      if (!res.ok) throw new Error('Erro ao registrar falta');
      alert(`Falta de ${missing} peças registrada. Pendência criada no Corte.`);
      
      // We can also close or refresh
      fetchOrders();
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar falta.');
    }
  };

  const handleFinalizarPedido = async () => {
    if (!selectedOrder || !conferenciaStage) return;
    
    // Verify if all items are accounted for
    let hasMissing = false;
    currentItems.forEach((it: any) => {
      const sku = it.codigo || it.sku || it.produto || 'unknown';
      const expected = Number(it.quantidade) || 0;
      const found = checkedItems[sku] || 0;
      if (found < expected) {
        hasMissing = true;
      }
    });

    if (hasMissing) {
      const confirmForce = window.confirm('Atenção: Há itens faltando que não foram registrados como "Falta". Deseja finalizar assim mesmo?');
      if (!confirmForce) return;
    }

    setIsSubmitting(true);
    try {
      // 1. Iniciar Execução (se não iniciada)
      const startRes = await fetch('/api/executions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          stage_id: conferenciaStage.id,
          user_id: currentUser?.id
        })
      });
      const startData = await startRes.json();
      
      // Total de peças encontradas
      const totalEncontrado = Object.values(checkedItems).reduce((sum, val) => sum + val, 0);

      // 2. Registrar progresso (peças boas)
      await fetch(`/api/orders/${selectedOrder.id}/stages/${conferenciaStage.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incremento: totalEncontrado,
          user_id: currentUser?.id,
          user_name: currentUser?.name
        })
      });

      // 3. Finalizar Etapa
      if (startData.execution?.id) {
        await fetch(`/api/executions/${startData.execution.id}/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true, observation: 'Conferência Finalizada (Via Separação por Pedido)' })
        });
      } else {
        // Se já estava iniciada por outra pessoa ou de outra forma, temos que buscar a execução ativa
        const activeRes = await fetch(`/api/executions/active?order_id=${selectedOrder.id}`);
        const activeData = await activeRes.json();
        const confExec = activeData.executions?.find((e: any) => e.stage_id === conferenciaStage.id);
        if (confExec) {
          await fetch(`/api/executions/${confExec.id}/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: true, observation: 'Conferência Finalizada' })
          });
        }
      }

      alert('Conferência finalizada com sucesso! O pedido avançou de etapa.');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      console.error(err);
      alert('Erro ao finalizar conferência.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!conferenciaStage) {
    return <div className="p-8 text-center">Etapa "Conferência" não encontrada no sistema.</div>;
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Conferência e Separação</h1>
          <p className="text-slate-500 text-sm">Organize as peças que vieram da costura nos pedidos originais.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Buscar OP ou Cliente..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none w-64"
          />
        </div>
      </div>

      {conferenciaOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center flex flex-col items-center">
          <Package className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">Nenhum pedido na Conferência.</h3>
          <p className="text-slate-500 text-sm">Todos os pedidos desta etapa já foram separados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {conferenciaOrders.map(order => (
            <Card 
              key={order.id} 
              className="p-4 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group relative"
              onClick={() => handleOpenOrder(order)}
            >
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-indigo-500 transition-colors">
                <ChevronRight size={20} />
              </div>
              <div className="text-xs font-bold text-slate-400 mb-1">{order.order_number || `OP #${order.id}`}</div>
              <div className="font-black text-slate-800 text-lg mb-2 truncate">{order.client_name}</div>
              <div className="flex justify-between items-center mt-4">
                <div className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded">
                  {order.quantity} peças
                </div>
                {order.deadline && (
                  <div className="text-[10px] font-medium text-slate-500">
                    Prazo: {safeFormat(order.deadline, 'dd/MM')}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Lista de Compras */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-start relative">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Separando Pedido
                  </div>
                  <h2 className="text-xl font-black text-slate-800">{selectedOrder.client_name}</h2>
                  <p className="text-sm text-slate-500 font-medium">{selectedOrder.order_number || `OP #${selectedOrder.id}`}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {currentItems.map((it: any, idx: number) => {
                  const sku = it.codigo || it.sku || it.produto || `item-${idx}`;
                  const productName = it.produto || 'Produto sem nome';
                  const expected = Number(it.quantidade) || 0;
                  const found = checkedItems[sku] || 0;
                  const isComplete = found >= expected;
                  
                  return (
                    <div key={sku} className={`p-4 rounded-2xl border transition-colors ${isComplete ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex-1 pr-4">
                          <div className={`font-bold ${isComplete ? 'text-emerald-800' : 'text-slate-800'}`}>
                            {productName}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">{sku}</div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-slate-100 rounded-lg p-1">
                            <button 
                              onClick={() => handleAdjustCheck(sku, -1, expected)}
                              disabled={found === 0}
                              className="p-1 hover:bg-white hover:shadow-sm rounded text-slate-600 disabled:opacity-30 transition-all"
                            >
                              <Minus size={16} />
                            </button>
                            <div className="w-10 text-center font-black text-slate-800">
                              {found}
                            </div>
                            <button 
                              onClick={() => handleAdjustCheck(sku, 1, expected)}
                              disabled={found >= expected}
                              className="p-1 hover:bg-white hover:shadow-sm rounded text-slate-600 disabled:opacity-30 transition-all"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                          <div className="text-sm font-bold text-slate-400 w-12 text-right">
                            / {expected}
                          </div>
                        </div>
                      </div>

                      {/* Botão de falta se não encontrou todas */}
                      {!isComplete && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                          <button 
                            onClick={() => handleRegistrarFalta(sku, productName, expected, found)}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <AlertTriangle size={14} />
                            Registrar Falta ({expected - found} pc)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="px-6 py-2.5 font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleFinalizarPedido}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-200"
                >
                  <CheckCircle2 size={18} />
                  {isSubmitting ? 'Finalizando...' : 'Finalizar Pedido'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};