import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/Badge';
import { Activity, AlertCircle, AlertTriangle, CheckCircle2, Pause, Play, Search, Filter } from 'lucide-react';
import { cn, formatSeconds } from '../lib/utils';
import type { StageExecution } from '../types';

export const TaskMonitor = ({ onShowInfo }: { onShowInfo?: (title: string, desc: string) => void }) => {
  const [monitorData, setMonitorData] = useState<StageExecution[]>([]);
  const [monitorSearch, setMonitorSearch] = useState('');
  const [monitorStageFilter, setMonitorStageFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchMonitorData = async () => {
    try {
      const res = await fetch('/api/executions/monitor', {
        headers: { 'x-user-role': 'Admin' }
      });
      if (res.ok) {
        const data = await res.json();
        setMonitorData(data);
      }
    } catch (err) {
      console.error('Error fetching monitor data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitorData();
    const interval = setInterval(fetchMonitorData, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, []);

  const filteredData = (monitorData || []).filter(e => {
    const searchMatch = (e.order_number?.toLowerCase().includes(monitorSearch.toLowerCase()) || 
                         e.client_name?.toLowerCase().includes(monitorSearch.toLowerCase()));
    const stageMatch = !monitorStageFilter || e.stage_id?.toString() === monitorStageFilter;
    return searchMatch && stageMatch;
  });

  const getBaseTimeInfo = (exec: StageExecution & { quantity?: number }) => {
    const ideal = exec.ideal_time || exec.average_time_seconds || 0;
    const count = exec.execution_count || 0;
    const real = exec.real_average_time || 0;
    const qty = exec.quantity || 1;
    const calcType = exec.calculation_type || 'por_peca';

    let baseTime = 0;
    if (count >= 10 && real > 0) {
      baseTime = real;
    } else {
      baseTime = ideal;
    }

    if (calcType === 'por_peca') {
      baseTime *= qty;
    } else if (calcType === 'por_lote') {
      // Opcional: implementar lógica de lote se necessário
      baseTime *= Math.ceil(qty / 10); // Exemplo: lote de 10
    }

    return { baseTime, type: count >= 10 && real > 0 ? 'Real' : 'Ideal', calcType };
  };

  const getStatusColor = (current: number, avg: number) => {
    if (!avg || avg === 0) return 'text-zinc-600 bg-zinc-100';
    const ratio = current / avg;
    if (ratio <= 0.8) return 'text-emerald-700 bg-emerald-100 border-emerald-200';
    if (ratio <= 1.0) return 'text-amber-700 bg-amber-100 border-amber-200';
    return 'text-rose-700 bg-rose-100 border-rose-200';
  };

  const getStatusLabel = (current: number, avg: number) => {
    if (!avg || avg === 0) return 'Normal';
    const ratio = current / avg;
    if (ratio <= 0.8) return 'Eficiente';
    if (ratio <= 1.0) return 'Atenção';
    return 'Atrasado';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => onShowInfo?.('Tarefas Ativas', 'Número de tarefas (etapas de uma OP) que estão com o \'Play\' acionado no exato momento.')}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-100 rounded-xl text-zinc-600">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium">Tarefas Ativas</p>
              <h3 className="text-2xl font-bold">{monitorData?.length || 0}</h3>
            </div>
          </div>
        </Card>
        <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => onShowInfo?.('Eficientes', 'Tarefas em andamento cujo tempo atual é inferior a 80% do tempo médio histórico esperado para a etapa.')}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium">Eficientes</p>
              <h3 className="text-2xl font-bold">{(monitorData || []).filter(e => { const { baseTime } = getBaseTimeInfo(e); return baseTime > 0 && (e.total_time_seconds / baseTime) <= 0.8; }).length}</h3>
            </div>
          </div>
        </Card>
        <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => onShowInfo?.('Atenção', 'Tarefas em andamento onde o tempo atual atingiu entre 80% e 100% do tempo base (ideal ou real) esperado para a etapa.')}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium">Atenção</p>
              <h3 className="text-2xl font-bold">{(monitorData || []).filter(e => { const { baseTime } = getBaseTimeInfo(e); return baseTime > 0 && (e.total_time_seconds / baseTime) > 0.8 && (e.total_time_seconds / baseTime) <= 1.0; }).length}</h3>
            </div>
          </div>
        </Card>
        <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => onShowInfo?.('Fora do Prazo', 'Tarefas cujo tempo atual de execução já excedeu o tempo base esperado.')}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-100 rounded-xl text-rose-600">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium">Fora do Prazo</p>
              <h3 className="text-2xl font-bold">{(monitorData || []).filter(e => { const { baseTime } = getBaseTimeInfo(e); return baseTime > 0 && (e.total_time_seconds / baseTime) > 1.0; }).length}</h3>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 bg-zinc-50 border-zinc-200">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por Pedido ou Cliente..."
              value={monitorSearch}
              onChange={(e) => setMonitorSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-400"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
             <Filter size={16} className="text-zinc-400" />
             <select
               value={monitorStageFilter}
               onChange={(e) => setMonitorStageFilter(e.target.value)}
               className="bg-white border border-zinc-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-zinc-400 min-w-[200px]"
             >
               <option value="">Todas as Etapas</option>
                {Array.from(new Map((monitorData || []).map(e => [e.stage_id, e.stage_name])).entries()).map(([id, name]) => (
                  <option key={id} value={id}>{name as string}</option>
                ))}
             </select>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Pedido</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Cliente / Produto</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Etapa</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Responsável</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Tempo Decorrido</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Tempo Base</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-400 animate-pulse">Carregando monitor...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-400">Nenhuma tarefa ativa no momento.</td></tr>
              ) : filteredData.map(exec => {
                const baseInfo = getBaseTimeInfo(exec);
                const baseTime = baseInfo.baseTime;
                let efficiency = '';
                let efficiencyColor = 'text-zinc-500';
                
                if (baseTime > 0) {
                  const pct = Math.round((exec.total_time_seconds / baseTime) * 100);
                  efficiency = `${pct}% do tempo ${baseInfo.type.toLowerCase()}`;
                  if (pct <= 80) efficiencyColor = 'text-emerald-600';
                  else if (pct <= 100) efficiencyColor = 'text-amber-600';
                  else efficiencyColor = 'text-rose-600 font-bold';
                }

                return (
                  <tr key={exec.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono font-bold text-zinc-900">{exec.order_number}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-zinc-800">{exec.client_name}</span>
                        <span className="text-[10px] text-zinc-500">{exec.product_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs font-bold">
                          {exec.is_paused ? <Pause size={10} className="text-amber-500" /> : <Play size={10} className="text-emerald-500" />}
                          {exec.stage_name}
                        </span>
                        <div className="flex items-center gap-1">
                          {exec.calculation_type === 'por_pedido' && (
                            <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-0.5" title="Cálculo por Pedido">
                              📄 por pedido
                            </span>
                          )}
                          {exec.calculation_type === 'por_peca' && (
                            <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-0.5" title="Cálculo por Peça">
                              👕 por peça
                            </span>
                          )}
                          {exec.calculation_type === 'por_lote' && (
                            <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-0.5" title="Cálculo por Lote">
                              📦 por lote
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600 font-medium">
                      {exec.user_name}
                    </td>
                    <td className="px-6 py-4">
                       <span className={cn(
                         "font-mono text-sm font-bold block",
                         baseInfo.baseTime && exec.total_time_seconds > baseInfo.baseTime ? "text-rose-600" : "text-zinc-900"
                       )}>
                         {formatSeconds(exec.total_time_seconds)}
                       </span>
                       {efficiency && (
                         <div className={`text-[10px] mt-0.5 ${efficiencyColor}`}>
                           {efficiency}
                         </div>
                       )}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400 font-mono">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-900 font-medium">{baseInfo.baseTime ? formatSeconds(baseInfo.baseTime) : "-"}</span>
                          <Badge variant={baseInfo.type === 'Real' ? 'info' : 'default'} className="md:px-2 md:py-0 md:text-[8px]">{baseInfo.type}</Badge>
                        </div>
                        <div className="text-[9px] text-zinc-500 flex flex-col">
                          {(exec.ideal_time || 0) > 0 && (
                            <span>Ideal: {formatSeconds(exec.calculation_type === 'por_peca' ? (exec.ideal_time || 0) * (exec.quantity || 1) : (exec.ideal_time || 0))}</span>
                          )} 
                          {(exec.real_average_time || 0) > 0 && (
                            <span>Real: {formatSeconds(exec.calculation_type === 'por_peca' ? (exec.real_average_time || 0) * (exec.quantity || 1) : (exec.real_average_time || 0))}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border",
                        getStatusColor(exec.total_time_seconds, baseInfo.baseTime || 0)
                      )}>
                        {getStatusLabel(exec.total_time_seconds, baseInfo.baseTime || 0)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
