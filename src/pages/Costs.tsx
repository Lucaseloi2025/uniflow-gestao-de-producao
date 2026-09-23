import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/Badge';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { TrendingDown, TrendingUp, Calculator, FileText, CheckCircle2, Activity, Calendar, DollarSign, Download, Layers, Package, Target, Users, Clock, PieChart as PieChartIcon } from 'lucide-react';
import { formatSeconds, cn } from '../lib/utils';
import { motion } from 'motion/react';

export const Costs = ({
  currentUser, fetchReports, memoizedCostsByCollaborator, memoizedOrdersCompleted, metaCustoPeca, operationalReportData, reportData, reportEndDate, reportStage, reportStartDate, reportUser, setInfoModal, setMetaCustoPeca, setReportEndDate, setReportStage, setReportStartDate, setReportUser, stages, users, COLORS
}: any) => {
  return (
          <ErrorBoundary>
            <div className="space-y-8 pb-12">
              {/* Filters Bar */}
              <Card className="p-4 bg-zinc-900 border-none shadow-2xl">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
                      <Calendar size={18} />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="bg-zinc-800 border-none text-white text-xs rounded-md px-2 py-1 focus:ring-1 focus:ring-zinc-700 appearance-none"
                      />
                      <span className="text-zinc-600">até</span>
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="bg-zinc-800 border-none text-white text-xs rounded-md px-2 py-1 focus:ring-1 focus:ring-zinc-700 appearance-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
                      <Users size={18} />
                    </div>
                    <select
                      value={reportUser}
                      onChange={(e) => setReportUser(e.target.value)}
                      className="bg-zinc-800 border-none text-white text-xs rounded-md px-3 py-1.5 focus:ring-1 focus:ring-zinc-700 min-w-[150px]"
                    >
                      <option value="">Todos Colaboradores</option>
                      {(users || []).map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
                      <Layers size={18} />
                    </div>
                    <select
                      value={reportStage}
                      onChange={(e) => setReportStage(e.target.value)}
                      className="bg-zinc-800 border-none text-white text-xs rounded-md px-3 py-1.5 focus:ring-1 focus:ring-zinc-700 min-w-[150px]"
                    >
                      <option value="">Todas as Etapas</option>
                      {(stages || []).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="ml-auto flex items-center gap-4 group">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Meta Custo/Peça</p>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-400 text-xs font-medium">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={metaCustoPeca || 0}
                          onChange={(e) => setMetaCustoPeca(Number(e.target.value) || 0)}
                          onBlur={async () => {
                            try {
                              await fetch('/api/config', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', 'x-user-role': 'Admin' },
                                body: JSON.stringify({ meta_custo_por_peca: metaCustoPeca || 0 })
                              });
                            } catch (err) {
                              console.error("Erro ao salvar meta:", err);
                            }
                          }}
                          className="bg-zinc-800 border-none text-white text-sm font-black rounded-md px-2 py-1 w-20 focus:ring-2 focus:ring-emerald-500/50 text-center transition-all bg-opacity-50 hover:bg-opacity-100"
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30 group-hover:scale-110 transition-transform">
                      <Target size={20} />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="p-6 border-none shadow-sm bg-white overflow-hidden relative cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Custo Total M.O.', description: 'Soma do custo de mão de obra de todos os colaboradores para as etapas finalizadas no período selecionado.' })}>
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <DollarSign size={80} />
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 shadow-inner">
                      <DollarSign size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Custo Total M.O.</p>
                      <h3 className="text-2xl font-black text-zinc-900">R$ {(Number(reportData?.summary?.total_labor_cost) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    </div>
                  </div>
                </Card>

                <Card 
                  className={cn(
                    "p-6 shadow-sm border-none bg-white relative overflow-hidden cursor-help hover:border-zinc-300 transition-colors",
                    (Number(metaCustoPeca) || 0) > 0 && ((Number(reportData?.summary?.total_labor_cost) || 0) / (Number(reportData?.summary?.total_parts) || 1)) > (Number(metaCustoPeca) || Infinity)
                      ? "after:content-[''] after:absolute after:top-0 after:left-0 after:w-1 after:h-full after:bg-rose-500"
                      : (Number(metaCustoPeca) || 0) > 0 ? "after:content-[''] after:absolute after:top-0 after:left-0 after:w-1 after:h-full after:bg-emerald-500" : ""
                  )}
                  onClick={() => setInfoModal({ title: 'Custo Médio / Peça', description: 'Valor médio investido em mão de obra para cada peça produzida. Calculado dividindo o Custo Total M.O. pelo Volume Produzido.' })}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-2xl shadow-inner",
                      ((Number(reportData?.summary?.total_labor_cost) || 0) / (Number(reportData?.summary?.total_parts) || 1)) <= (Number(metaCustoPeca) || 0) || (Number(metaCustoPeca) || 0) === 0
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-rose-50 text-rose-600"
                    )}>
                      <Target size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Custo Médio / Peça</p>
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-2xl font-black text-zinc-900">R$ {((Number(reportData?.summary?.total_labor_cost) || 0) / (Number(reportData?.summary?.total_parts) || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                        {(Number(metaCustoPeca) || 0) > 0 && (
                          <div className={cn(
                            "flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm",
                            ((Number(reportData?.summary?.total_labor_cost) || 0) / (Number(reportData?.summary?.total_parts) || 1)) <= (Number(metaCustoPeca) || 0)
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          )}>
                            {(((Number(reportData?.summary?.total_labor_cost) || 0) / (Number(reportData?.summary?.total_parts) || 1)) <= (Number(metaCustoPeca) || 0)) ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                            {Math.abs((((Number(reportData?.summary?.total_labor_cost) || 0) / (Number(reportData?.summary?.total_parts) || 1)) / (Number(metaCustoPeca) || 1) - 1) * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 border-none shadow-sm bg-white overflow-hidden relative cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Volume Produzido', description: 'Quantidade total de peças físicas que foram finalizadas em todas as suas etapas obrigatórias no período.' })}>
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Package size={80} />
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 bg-sky-50 rounded-2xl text-sky-600 shadow-inner">
                      <Package size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Volume Produzido</p>
                      <h3 className="text-2xl font-black text-zinc-900">{(Number(reportData?.summary?.total_parts) || 0).toLocaleString('pt-BR')} <span className="text-xs font-medium text-zinc-400 uppercase">Peças</span></h3>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 border-none shadow-sm bg-zinc-900 overflow-hidden relative cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Tempo Total Gasto', description: 'Soma de todas as horas trabalhadas pelos colaboradores nas etapas de produção finalizadas no período.' })}>
                  <div className="absolute top-0 right-0 p-8 opacity-10 text-white">
                    <Clock size={80} />
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 bg-zinc-800 rounded-2xl text-zinc-400 shadow-inner">
                      <Clock size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Tempo Total Gasto</p>
                      <h3 className="text-2xl font-black text-white">
                        {((Number(reportData?.summary?.total_labor_cost) || 0) / 15).toFixed(1)} <span className="text-xs font-medium text-zinc-500 uppercase">Horas</span>
                      </h3>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Charts */}
                <div className="space-y-8">
                  <Card className="p-8 border-none shadow-sm bg-white">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-lg font-black text-zinc-900 flex items-center gap-2">
                          <PieChartIcon size={20} className="text-emerald-500" />
                          Composição de Custos
                        </h3>
                        <p className="text-xs text-zinc-400 font-medium">Divisão do investimento em mão de obra por colaborador</p>
                      </div>
                    </div>
                    <div className="h-80">
                      {memoizedCostsByCollaborator.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={memoizedCostsByCollaborator}
                              dataKey="total_cost"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={70}
                              outerRadius={100}
                              paddingAngle={8}
                              labelLine={false}
                            >
                              {memoizedCostsByCollaborator.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity cursor-pointer" />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', padding: '12px' }}
                              itemStyle={{ fontWeight: '800', fontSize: '12px' }}
                              formatter={(value: any) => [`R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Investimento']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-300 gap-4">
                          <Activity size={40} className="opacity-20" />
                          <p className="text-sm font-medium italic">Nenhuma produção registrada neste período</p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      {memoizedCostsByCollaborator.slice(0, 4).map((c: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-[10px] font-bold text-zinc-500 uppercase truncate">{c?.name || '---'}</span>
                          <span className="text-[10px] font-black text-zinc-900 ml-auto">{(((Number(c?.total_cost) || 0) / (Number(reportData?.summary?.total_labor_cost) || 1)) * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-8 border-none shadow-sm bg-zinc-900 text-white overflow-hidden relative">
                    <div className="absolute -bottom-10 -right-10 opacity-10">
                      <TrendingUp size={200} />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-lg font-black mb-1 flex items-center gap-2">
                        <TrendingUp size={20} className="text-emerald-400" />
                        Ranking de Rentabilidade
                      </h3>
                      <p className="text-xs text-zinc-500 font-medium mb-8">Colaboradores com menor custo por peça produzida</p>

                      <div className="space-y-6">
                        {memoizedCostsByCollaborator.map((c: any, i: number) => {
                            const costPerPiece = (Number(c?.total_cost) || 0) / (Number(c?.pecas) || 1);
                            const isEfficient = (Number(metaCustoPeca) || 0) > 0 ? costPerPiece <= (Number(metaCustoPeca) || 0) : true;
                            const denominator = (Number(metaCustoPeca) || costPerPiece * 1.5) || 1;
                            return (
                              <div key={i} className="group">
                                <div className="flex justify-between items-center mb-2">
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-lg shadow-black/20",
                                      i === 0 ? "bg-amber-400 text-amber-950" : "bg-zinc-800 text-zinc-500"
                                    )}>
                                      {i + 1}
                                    </div>
                                    <span className="text-sm font-bold text-zinc-100">{c?.name || '---'}</span>
                                  </div>
                                  <div className="text-right">
                                    <p className={cn(
                                      "text-sm font-black font-mono",
                                      isEfficient ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                      R$ {costPerPiece.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[10px] font-medium opacity-50">/pç</span>
                                    </p>
                                  </div>
                                </div>
                                <div className="h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden shadow-inner">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, (costPerPiece / denominator) * 100)}%` }}
                                    className={cn("h-full shadow-lg", isEfficient ? "bg-emerald-400" : "bg-rose-400")}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Column: Detailed Table */}
                <div className="space-y-8">
                  <Card className="p-8 border-none shadow-sm bg-white h-full flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-lg font-black text-zinc-900 flex items-center gap-2">
                          <FileText size={20} className="text-sky-500" />
                          Custos por Ordem de Produção
                        </h3>
                        <p className="text-xs text-zinc-400 font-medium">Análise detalhada de cada pedido finalizado neste período</p>
                      </div>
                      <button className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
                        <Download size={18} />
                      </button>
                    </div>

                    <div className="flex-grow overflow-y-auto max-h-[700px] pr-2 custom-scrollbar">
                      <div className="grid grid-cols-1 gap-4">
                        {memoizedOrdersCompleted.length ? (
                          memoizedOrdersCompleted.map((p: any, i: number) => {
                            const costPerPiece = (Number(p?.lead_time_horas) || 0) > 0 ? ((Number(p?.lead_time_horas) || 0) * 15) / (Number(p?.pecas) || 1) : 0;
                            const isEfficient = (Number(metaCustoPeca) || 0) > 0 ? costPerPiece <= (Number(metaCustoPeca) || 0) : true;
                            return (
                              <div key={i} className="group border border-zinc-100 rounded-2xl p-4 hover:border-emerald-200 hover:bg-emerald-50/10 transition-all cursor-pointer flex items-center gap-6">
                                <div className="bg-zinc-50 p-3 rounded-xl group-hover:bg-white transition-colors">
                                  <span className="text-[10px] font-black text-zinc-400 uppercase block mb-0.5 tracking-widest">Pedido</span>
                                  <span className="text-sm font-black text-zinc-900 font-mono">{p?.order_number || '---'}</span>
                                </div>

                                <div className="flex-grow grid grid-cols-2 md:grid-cols-3 gap-4">
                                  <div>
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-0.5 tracking-widest">Peças</span>
                                    <span className="text-sm font-black text-zinc-900">{Number(p?.pecas) || 0}</span>
                                  </div>
                                  <div className="hidden md:block">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-0.5 tracking-widest">Tempo Total</span>
                                    <span className="text-sm font-black text-zinc-900">{(Number(p?.lead_time_horas) || 0).toFixed(1)}h</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-0.5 tracking-widest">Custo Peça</span>
                                    <span className={cn(
                                      "text-sm font-black font-mono",
                                      isEfficient ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                      R$ {costPerPiece.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>

                                <div className={cn(
                                  "hidden sm:flex items-center justify-center px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase",
                                  isEfficient ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                )}>
                                  {isEfficient ? 'Ok' : 'Alto'}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-12 text-zinc-400 italic font-medium">
                            Nenhum pedido concluído para análise.
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </ErrorBoundary>
  );
};







