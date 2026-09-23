import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Save } from 'lucide-react';

export const PcpSettings = () => {
  const [config, setConfig] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = (await fetch('/api/pcp-phase1/config')).json();
      if (data) setConfig(data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Configurações do PCP</h2>
          <p className="text-zinc-500 mt-1">Parâmetros para cálculo automático de prioridade</p>
        </div>
      </div>

      <Card className="p-6 border-none shadow-sm bg-white">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Dias p/ Atenção</label>
              <input type="number" defaultValue={config.dias_atencao || 4} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Dias p/ Urgente</label>
              <input type="number" defaultValue={config.dias_urgente || 2} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Dias p/ Crítico</label>
              <input type="number" defaultValue={config.dias_critico || 0} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl" />
            </div>
          </div>
          
          <button className="px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-colors">
            <Save size={18} />
            Salvar Configurações
          </button>
        </div>
      </Card>
    </div>
  );
};

