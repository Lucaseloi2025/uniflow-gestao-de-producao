import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Target, AlertTriangle, AlertCircle, Clock, Package, CheckCircle2 } from 'lucide-react';
import { safeFetch } from '../../lib/utils';

export const PcpDashboard = ({ currentUser }: any) => {
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const result = await safeFetch('/api/pcp-phase1/dashboard');
      if (result) setData(result);
    } catch (e) {
      console.error(e);
    }
  };

  if (!data) return <div className="p-8 text-center text-zinc-500">Carregando painel PCP...</div>;

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Painel PCP</h2>
          <p className="text-zinc-500 mt-1">Visão geral do planejamento e controle da produção</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6 border-none shadow-sm bg-white hover:border-zinc-300 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-500 uppercase">Em Produção</p>
              <h3 className="text-3xl font-black text-zinc-900">{data.emProducao}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-sm bg-white hover:border-zinc-300 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-500 uppercase">Para Iniciar</p>
              <h3 className="text-3xl font-black text-zinc-900">{data.paraIniciar}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-sm bg-white hover:border-zinc-300 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-500 uppercase">Em Risco / Atrasados</p>
              <h3 className="text-3xl font-black text-zinc-900">{data.atrasados}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-sm bg-white hover:border-zinc-300 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-500 uppercase">Bloqueados</p>
              <h3 className="text-3xl font-black text-zinc-900">{data.bloqueados}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-sm bg-white hover:border-zinc-300 transition-colors lg:col-span-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-500 uppercase">Total de Peças a Produzir (Necessidade Líquida)</p>
              <h3 className="text-3xl font-black text-zinc-900">{data.pecasAProduzir}</h3>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
