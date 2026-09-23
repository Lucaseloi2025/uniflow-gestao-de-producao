import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Search } from 'lucide-react';
import { Badge } from '../../components/Badge';

export const PcpNecessidades = () => {
  const [items, setItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = (await fetch('/api/pcp-phase1/necessidades')).json();
      if (data) setItems(data);
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = items.filter(i => 
    i.orders?.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.orders?.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Necessidade Líquida</h2>
          <p className="text-zinc-500 mt-1">Cálculo: MAX(0, Vendida - Disp - EmProd)</p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por OP, Cliente ou SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
      </div>

      <Card className="bg-white border-none shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Pedido</th>
                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">SKU / Produto</th>
                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tam</th>
                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Vendida</th>
                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Físico</th>
                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Reserv.</th>
                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Em Prod</th>
                <th className="p-4 text-[10px] font-black text-zinc-900 uppercase tracking-widest text-center bg-indigo-50">Necessidade</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-zinc-900">{item.orders?.order_number}</div>
                    <div className="text-xs text-zinc-500">{item.orders?.client_name}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-zinc-900">{item.sku}</div>
                    <div className="text-xs text-zinc-500">{item.product_type} {item.fabric} {item.color}</div>
                  </td>
                  <td className="p-4 font-bold">{item.size}</td>
                  <td className="p-4 text-center text-zinc-600">{item.qty_vendida}</td>
                  <td className="p-4 text-center text-zinc-600">{item.qty_estoque_fisico}</td>
                  <td className="p-4 text-center text-zinc-600">{item.qty_estoque_reservado}</td>
                  <td className="p-4 text-center text-zinc-600">{item.qty_em_producao}</td>
                  <td className="p-4 text-center font-black text-indigo-600 bg-indigo-50/30">{item.qty_necessaria}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500">Nenhuma necessidade encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

