import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/Badge';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Layers, Activity, Users, FileText, CheckCircle2, Clock, PieChart as PieChartIcon } from 'lucide-react';
import { formatSeconds, safeFormat } from '../lib/utils';

export const Reports = ({
  reportPeriod,
  setReportPeriod,
  reportStartDate,
  setReportStartDate,
  reportEndDate,
  setReportEndDate,
  reportUser,
  setReportUser,
  fetchReports,
  operationalReportData,
  users,
  profileReport,
  lossReportData,
  goalsProductivityData,
  goalsViewType,
  setGoalsViewType,
  collaboratorGoals,
  stages
}: any) => {
  return (
          <div className="space-y-8">

            {/* Sub-navigation inside Reports */}
            <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
              <button
                type="button"
                onClick={() => setActiveReportSubTab('geral')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  activeReportSubTab === 'geral'
                    ? "bg-zinc-900 text-white shadow"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                )}
              >
                <BarChart3 size={16} /> Visão Geral & Entregas
              </button>
              <button
                type="button"
                onClick={() => setActiveReportSubTab('metas')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  activeReportSubTab === 'metas'
                    ? "bg-zinc-900 text-white shadow"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                )}
              >
                <Target size={16} /> Metas & Produtividade
              </button>
              <button
                type="button"
                onClick={() => setActiveReportSubTab('perdas')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  activeReportSubTab === 'perdas'
                    ? "bg-rose-600 text-white shadow"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                )}
              >
                <AlertCircle size={16} /> Relatório de Perdas & Retrabalho
              </button>
            </div>

            {activeReportSubTab === 'perdas' && (
              <div className="space-y-8">
                {/* Executive Summary Cards for Losses */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="p-6 border-rose-100 bg-rose-50/20">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-rose-100 rounded-xl text-rose-600">
                        <AlertCircle size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 font-medium">Total Peças Perdidas</p>
                        <h3 className="text-2xl font-bold text-rose-700">{lossReportData?.summary?.total_perdido || 0} <span className="text-xs font-normal text-zinc-500">peças</span></h3>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                        <TrendingUp size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 font-medium">Taxa de Perda (%)</p>
                        <h3 className="text-2xl font-bold text-amber-700">{lossReportData?.summary?.pct_perda?.toFixed(1) || '0.0'}%</h3>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                        <Package size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 font-medium">Pedidos com Retrabalho</p>
                        <h3 className="text-2xl font-bold text-zinc-900">{lossReportData?.summary?.total_pedidos_com_perda || 0}</h3>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                        <Clock size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 font-medium">Impacto Médio no Prazo</p>
                        <h3 className="text-2xl font-bold text-purple-700">{lossReportData?.summary?.impacto_prazo_horas?.toFixed(1) || '0.0'} <span className="text-xs font-normal text-zinc-500">horas/ped</span></h3>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Section 1: Perdas por Setor (Etapa) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Layers size={16} className="text-rose-600" /> Perdas por Setor / Etapa (Gráfico)
                    </h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={lossReportData?.perdas_por_setor || []}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                          <XAxis dataKey="stage_name" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="quantidade_perdida" name="Peças Perdidas" fill="#e11d48" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <FileText size={16} className="text-rose-600" /> Detalhamento por Setor
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-zinc-100 bg-zinc-50">
                            <th className="py-2.5 px-3 font-bold text-zinc-500">Setor / Etapa</th>
                            <th className="py-2.5 px-3 font-bold text-zinc-500 text-center">Perdas</th>
                            <th className="py-2.5 px-3 font-bold text-zinc-500 text-center">% do Total</th>
                            <th className="py-2.5 px-3 font-bold text-zinc-500 text-center">Pedidos Afetados</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {(lossReportData?.perdas_por_setor || []).map((item, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50">
                              <td className="py-2.5 px-3 font-bold text-zinc-900">{item.stage_name}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-600">{item.quantidade_perdida} pc</td>
                              <td className="py-2.5 px-3 text-center font-mono">{item.pct_total}%</td>
                              <td className="py-2.5 px-3 text-center font-mono">{item.pedidos_afetados}</td>
                            </tr>
                          ))}
                          {(lossReportData?.perdas_por_setor || []).length === 0 && (
                            <tr>
                              <td colSpan={4} className="text-center py-6 text-zinc-400">Nenhuma perda registrada no período.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>

                {/* Section 2: Perdas por Motivo Categorizado */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <BarChart3 size={16} className="text-rose-600" /> Distribuição por Motivo (Gráfico)
                    </h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={lossReportData?.perdas_por_motivo || []} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f1f1" />
                          <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis dataKey="motivo" type="category" fontSize={9} axisLine={false} tickLine={false} width={130} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="quantidade_perdida" name="Peças Perdidas" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-600" /> Motivos de Defeito / Retrabalho
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-zinc-100 bg-zinc-50">
                            <th className="py-2.5 px-3 font-bold text-zinc-500">Motivo Categorizado</th>
                            <th className="py-2.5 px-3 font-bold text-zinc-500">Setor Origem</th>
                            <th className="py-2.5 px-3 font-bold text-zinc-500 text-center">Peças</th>
                            <th className="py-2.5 px-3 font-bold text-zinc-500 text-center">% Perdas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {(lossReportData?.perdas_por_motivo || []).map((item, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50">
                              <td className="py-2.5 px-3 font-bold text-zinc-900">{item.motivo}</td>
                              <td className="py-2.5 px-3 text-zinc-600">{item.stage_name}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-700">{item.quantidade_perdida} pc</td>
                              <td className="py-2.5 px-3 text-center font-mono">{item.pct_total}%</td>
                            </tr>
                          ))}
                          {(lossReportData?.perdas_por_motivo || []).length === 0 && (
                            <tr>
                              <td colSpan={4} className="text-center py-6 text-zinc-400">Nenhum motivo registrado no período.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>

                {/* Section 3: Impacto em Prazo de Entrega (Custo do Retrabalho) */}
                <Card className="p-6">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Clock size={16} className="text-purple-600" /> Impacto no Prazo por Pedidos com Reposição (Custo do Retrabalho)
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4">
                    Compara o tempo total de produção dos pedidos que tiveram perdas contra a média dos pedidos sem perdas.
                  </p>
                  <div className="overflow-x-auto border border-zinc-100 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-100">
                          <th className="py-3 px-4 font-bold text-zinc-500">Pedido</th>
                          <th className="py-3 px-4 font-bold text-zinc-500">Cliente</th>
                          <th className="py-3 px-4 font-bold text-zinc-500 text-center">Peças Perdidas</th>
                          <th className="py-3 px-4 font-bold text-zinc-500 text-center">Lead Time (com perda)</th>
                          <th className="py-3 px-4 font-bold text-zinc-500 text-center">Média Sem Perda</th>
                          <th className="py-3 px-4 font-bold text-zinc-500 text-center">Atraso Adicional (Retrabalho)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {(lossReportData?.impacto_pedidos || []).map((imp, idx) => (
                          <tr key={idx} className="hover:bg-zinc-50">
                            <td className="py-3 px-4 font-mono font-bold text-zinc-900">{imp.order_number}</td>
                            <td className="py-3 px-4 font-medium text-zinc-700">{imp.client_name}</td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-rose-600">{imp.quantidade_perdida} pc</td>
                            <td className="py-3 px-4 text-center font-mono">{imp.lead_time_com_perda_horas}h</td>
                            <td className="py-3 px-4 text-center font-mono text-zinc-500">{imp.lead_time_medio_sem_perda_horas}h</td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-purple-700">
                              +{imp.atraso_adicional_horas}h
                            </td>
                          </tr>
                        ))}
                        {(lossReportData?.impacto_pedidos || []).length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center py-6 text-zinc-400">Nenhum pedido com reposição/retrabalho registrado.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {activeReportSubTab !== 'perdas' && (
              <>

            {/* Delivery & Performance KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {/* Entregues Hoje */}
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Entregues Hoje', description: 'Total de pedidos marcados como concluídos na data de hoje.' })}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Entregues Hoje</p>
                    <h3 className="text-2xl font-bold">{deliveryReportData?.entregues_hoje || 0}</h3>
                  </div>
                </div>
              </Card>

              {/* Entregues no Período */}
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'No Período', description: 'Total de pedidos concluídos dentro do intervalo de datas selecionado no filtro.' })}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                    <Archive size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">No Período</p>
                    <h3 className="text-2xl font-bold">{deliveryReportData?.entregues_periodo || 0}</h3>
                  </div>
                </div>
              </Card>

              {/* Pedidos no Prazo (%) */}
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'No Prazo (%)', description: 'Percentual de pedidos entregues cuja data de finalização foi igual ou anterior ao prazo prometido.' })}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">No Prazo (%)</p>
                    <h3 className="text-2xl font-bold">{deliveryReportData?.taxa_no_prazo_percent?.toFixed(1) || '0.0'}%</h3>
                  </div>
                </div>
              </Card>

              {/* Lead Time Médio */}
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Lead Time Médio', description: 'Média de dias decorridos entre a data de criação do pedido e a sua data de finalização.' })}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Lead Time Médio</p>
                    <h3 className="text-2xl font-bold">
                      {deliveryReportData?.lead_time_medio_dias?.toFixed(1) || '0.0'}
                      <span className="text-sm font-normal text-zinc-400 ml-1">dias</span>
                    </h3>
                  </div>
                </div>
              </Card>

              {/* Cumprimento de Meta (%) */}
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Cumprimento Meta', description: 'Percentual de atingimento da meta de produção diária (peças produzidas vs meta configurada).' })}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                    <Target size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Cumprimento Meta</p>
                    <h3 className="text-2xl font-bold">{deliveryReportData?.cumprimento_meta_percent?.toFixed(1) || '0.0'}%</h3>
                  </div>
                </div>
              </Card>

              {/* Total de Pedidos */}
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Total Pedidos', description: 'Volume total de pedidos processados ou registrados no sistema durante o período.' })}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-zinc-100 rounded-xl text-zinc-600">
                    <Package size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Total Pedidos</p>
                    <h3 className="text-2xl font-bold">{reportData?.summary?.total_orders || 0}</h3>
                  </div>
                </div>
              </Card>

              {/* Etapas Finalizadas */}
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Etapas Finalizadas', description: 'Contagem total de etapas individuais concluídas no período.' })}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-zinc-100 rounded-xl text-zinc-600">
                    <CheckSquare size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Etapas Finalizadas</p>
                    <h3 className="text-2xl font-bold">{reportData?.summary?.total_stages || 0}</h3>
                  </div>
                </div>
              </Card>

              {/* Tempo Médio por Etapa */}
              <Card className="p-6 cursor-help hover:border-zinc-300 transition-colors" onClick={() => setInfoModal({ title: 'Tempo Médio/Etapa', description: 'Média de tempo real gasto em cada etapa produtiva, comparada ao tempo esperado.' })}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-zinc-100 rounded-xl text-zinc-600">
                    <Timer size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Tempo Médio/Etapa</p>
                    <h3 className="text-2xl font-bold">{formatSeconds(reportData?.summary?.avg_stage_time || 0)}</h3>
                  </div>
                </div>
              </Card>
            </div>
            
            {/* Produção por Etapa no Período (Visual) */}
            {reportData?.production_by_stage && reportData.production_by_stage.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <Card className="p-6 border-zinc-200 shadow-sm bg-white">
                  <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <BarChart3 size={16} className="text-emerald-600" />
                    Peças Produzidas por Etapa (Gráfico)
                  </h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.production_by_stage}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                        <XAxis dataKey="stage_name" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="total_pieces" name="Peças Produzidas" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6 border-zinc-200 shadow-sm bg-white">
                  <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Layers size={16} className="text-emerald-600" />
                    Detalhamento de Volume por Etapa (Clique para expandir)
                  </h3>
                  <div className="overflow-x-auto max-h-[380px] overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-100 bg-zinc-50">
                          <th className="py-2.5 px-3 font-bold text-zinc-500">Etapa</th>
                          <th className="py-2.5 px-3 font-bold text-zinc-500 text-center">Ordens Finalizadas</th>
                          <th className="py-2.5 px-3 font-bold text-zinc-500 text-center">Peças Produzidas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {reportData.production_by_stage.map((item: any, idx: number) => {
                          const isExpanded = expandedReportStage === item.stage_name;
                          return (
                            <React.Fragment key={idx}>
                              <tr 
                                onClick={() => setExpandedReportStage(isExpanded ? null : item.stage_name)}
                                className="hover:bg-zinc-50 transition-colors cursor-pointer select-none"
                              >
                                <td className="py-3 px-3 font-bold text-zinc-900 flex items-center gap-2">
                                  <span className={cn(
                                    "text-[9px] text-zinc-400 inline-block transition-transform duration-200",
                                    isExpanded && "rotate-90 text-zinc-800"
                                  )}>
                                    ▶
                                  </span>
                                  {item.stage_name}
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-semibold text-zinc-600">{item.completed_count} ordens</td>
                                <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600">{item.total_pieces} un</td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-zinc-50/50">
                                  <td colSpan={3} className="py-3 px-4 border-t border-b border-zinc-100/80">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                          Pedidos Processados em "{item.stage_name}"
                                        </h4>
                                        <span className="text-[9px] text-zinc-400 font-medium">Filtro aplicado: {item.completed_count} itens</span>
                                      </div>
                                      <div className="overflow-x-auto border border-zinc-200 rounded-lg bg-white shadow-inner max-h-48 overflow-y-auto scrollbar-thin">
                                        <table className="w-full text-left text-[11px]">
                                          <thead>
                                            <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[9px] font-bold text-zinc-500 uppercase">
                                              <th className="py-2 px-3">Pedido</th>
                                              <th className="py-2 px-3">Cliente</th>
                                              <th className="py-2 px-3 text-center">Pecas</th>
                                              <th className="py-2 px-3">Operador</th>
                                              <th className="py-2 px-3 text-right">Horário</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-zinc-100">
                                            {item.details.map((detail: any, detIdx: number) => (
                                              <tr key={detIdx} className="hover:bg-zinc-50/60 transition-colors">
                                                <td className="py-2 px-3 font-mono font-bold text-zinc-700">#{detail.order_number}</td>
                                                <td className="py-2 px-3 text-zinc-600 font-medium">{detail.client_name}</td>
                                                <td className="py-2 px-3 text-center font-bold text-zinc-800">{detail.quantity}</td>
                                                <td className="py-2 px-3 text-zinc-600">{detail.operator}</td>
                                                <td className="py-2 px-3 text-right text-zinc-500 font-mono">
                                                  {safeFormat(detail.finished_at, 'HH:mm')}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* Detalhamento dos Pedidos do Período */}
            {reportData?.orders_list && reportData.orders_list.length > 0 && (
              <Card className="p-6 border-zinc-200 shadow-sm mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-zinc-700 uppercase tracking-wider">
                    <ClipboardList size={16} className="text-zinc-400" />
                    Detalhamento dos {reportData.summary?.total_orders || reportData.orders_list.length} Pedidos Vincunlados
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 font-medium">Clique no card para abrir detalhes do pedido</span>
                    <Badge variant="default" className="text-[10px] font-mono">
                      {reportData.orders_list.length} registros
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200">
                  {reportData.orders_list.map((order: any, idx: number) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      onClick={() => {
                        const found = orders.find(o => o.id === order.order_id);
                        if (found) {
                          setSelectedOrder(found);
                          fetchExecutions(found.id);
                        }
                      }}
                      className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-100 rounded-xl hover:bg-white hover:border-zinc-300 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="min-w-0 pr-2 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[10px] font-black font-mono text-zinc-400 group-hover:text-zinc-900 transition-colors">#{order.order_number}</p>
                          <span className={cn(
                            "text-[8px] font-black px-1 py-0.5 rounded uppercase",
                            order.status === 'Entregue' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                          )}>
                            {order.status === 'Entrada' ? 'Em Fila' : order.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-zinc-700 truncate line-clamp-1">{order.client_name}</p>
                        
                        {/* Etapas finalizadas neste período */}
                        {order.stages_worked_in_period && order.stages_worked_in_period.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1 max-w-[190px]">
                            {order.stages_worked_in_period.map((st: any, sidx: number) => (
                              <span key={sidx} title={`Concluído por ${st.operator}`} className="text-[8px] leading-tight bg-emerald-50 text-emerald-700 border border-emerald-100 px-1 py-0.5 rounded font-bold">
                                ✓ {st.stage_name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[8px] text-zinc-400 font-medium italic mt-1 block">Sem etapas finalizadas</span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-zinc-900">{order.quantity}</p>
                        <p className="text-[8px] text-zinc-400 font-bold uppercase">Peças</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Delivery Chart */}
              {deliveryReportData && deliveryReportData.grafico.length > 0 && (
                <Card className="p-8">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <BarChart3 size={20} />
                    Pedidos Entregues por Dia
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deliveryReportData?.grafico || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                        <XAxis dataKey="data" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="pedidos" name="Pedidos Entregues" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        {(deliveryReportData?.grafico?.[0]?.meta_pedidos || 0) > 0 && (
                          <ReferenceLine y={deliveryReportData.grafico[0].meta_pedidos} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'top', value: 'Meta Pedidos', fill: '#f59e0b', fontSize: 10 }} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              {/* Delay Report */}
              {delaysReportData && delaysReportData.length > 0 && (
                <Card className="p-8 border-rose-200">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-rose-600">
                    <AlertCircle size={20} />
                    Relatório de Atrasos
                  </h3>
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50">
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Pedido</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Cliente</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Produto</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 text-center">Atraso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {(delaysReportData || []).map(order => (
                          <tr key={order.id} className="hover:bg-rose-50 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs font-bold">{order.order_number}</td>
                            <td className="px-4 py-3 text-sm font-medium">{order.client_name}</td>
                            <td className="px-4 py-3 text-sm">
                              {order.product_type} <span className="text-[10px] text-zinc-500 ml-1">({order.print_type})</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant="danger">{order.dias_atraso} dias</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>

            {reportData?.volume && (
              <Card className="p-8">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <BarChart3 size={20} />
                  Volume de Produção por {reportPeriod === 'day' ? 'Dia' : reportPeriod === 'week' ? 'Semana' : 'Mês'}
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData?.volume || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                      <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="orders" name="Pedidos" fill="#18181b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pieces" name="Peças" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Painel de Metas & Produtividade */}
            {goalsProductivityData && (() => {
              const statusBadge = (s: 'verde' | 'amarelo' | 'vermelho' | 'sem_meta', pct: number | null) => {
                if (s === 'sem_meta') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-500">— Sem meta</span>;
                const label = pct !== null ? `${Math.round(pct * 100)}%` : '—';
                if (s === 'verde') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">✓ {label}</span>;
                if (s === 'amarelo') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">⚠ {label}</span>;
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">✗ {label}</span>;
              };
              const periodCell = (p: { real: number; target: number | null; pct: number | null; status: 'verde' | 'amarelo' | 'vermelho' | 'sem_meta' }) => (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-black font-mono text-zinc-800">{p.real}</span>
                  {p.target !== null && <span className="text-[9px] text-zinc-400 font-mono">/ {p.target}</span>}
                </div>
              );
              const unitLabel = (t: string) => t === 'por_pedido' ? 'pedidos' : 'peças';
              return (
                <Card className="p-8 border-zinc-200 shadow-lg bg-white relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-800 uppercase tracking-wider">
                        <Target size={20} className="text-zinc-600" />
                        Painel de Metas e Produtividade
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1">Desempenho por colaborador e setor — ordenado do pior para o melhor % atingido.</p>
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg self-start">
                      <button onClick={() => setGoalsViewType('collaborator')} className={cn('px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5', goalsViewType === 'collaborator' ? 'bg-white shadow text-zinc-900' : 'text-zinc-500 hover:text-zinc-700')}>
                        <Users size={13} /> Por Colaborador
                      </button>
                      <button onClick={() => setGoalsViewType('sector')} className={cn('px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5', goalsViewType === 'sector' ? 'bg-white shadow text-zinc-900' : 'text-zinc-500 hover:text-zinc-700')}>
                        <Layers size={13} /> Por Setor
                      </button>
                    </div>
                  </div>
                  {goalsViewType === 'collaborator' ? (
                    <div className="overflow-x-auto border border-zinc-100 rounded-xl">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-100">
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 whitespace-nowrap">Colaborador</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 whitespace-nowrap">Setor</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 whitespace-nowrap">Unidade</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 text-center whitespace-nowrap">Meta/dia</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 text-center whitespace-nowrap">Hoje</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 text-center whitespace-nowrap">Semana</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 text-center whitespace-nowrap">Mês</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 text-center whitespace-nowrap">Status Mês</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {[...(goalsProductivityData.collaborators || [])].sort((a, b) => {
                            const pa = a.month.pct ?? (a.month.status === 'sem_meta' ? 2 : -1);
                            const pb = b.month.pct ?? (b.month.status === 'sem_meta' ? 2 : -1);
                            return pa - pb;
                          }).map((row, i) => (
                            <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                              <td className="px-4 py-3 font-bold text-zinc-800 whitespace-nowrap">
                                {row.month.status === 'verde' && (row.month.pct ?? 0) >= 1 && <span title="Meta atingida">🏆 </span>}
                                {row.user_name}
                                {row.is_custom && <span className="ml-1 text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full border border-violet-200">personalizada</span>}
                              </td>
                              <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{row.stage_name}</td>
                              <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-[11px]">{unitLabel(row.calculation_type)}</td>
                              <td className="px-4 py-3 text-center font-mono text-zinc-700 font-bold">{row.meta_diaria ?? <span className="text-zinc-400 text-xs">—</span>}</td>
                              <td className="px-4 py-3 text-center">{periodCell(row.today)}</td>
                              <td className="px-4 py-3 text-center">{periodCell(row.week)}</td>
                              <td className="px-4 py-3 text-center">{periodCell(row.month)}</td>
                              <td className="px-4 py-3 text-center">{statusBadge(row.month.status, row.month.pct)}</td>
                            </tr>
                          ))}
                          {(goalsProductivityData.collaborators || []).length === 0 && (
                            <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400 italic text-xs">Nenhum dado de colaborador no período.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-zinc-100 rounded-xl">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-100">
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 whitespace-nowrap">Setor / Etapa</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 whitespace-nowrap">Unidade</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 text-center whitespace-nowrap">Meta/dia</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 text-center whitespace-nowrap">Hoje</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 text-center whitespace-nowrap">Semana</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 text-center whitespace-nowrap">Mês</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 text-center whitespace-nowrap">Status Mês</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {[...(goalsProductivityData.sectors || [])].sort((a, b) => {
                            const pa = a.month.pct ?? (a.month.status === 'sem_meta' ? 2 : -1);
                            const pb = b.month.pct ?? (b.month.status === 'sem_meta' ? 2 : -1);
                            return pa - pb;
                          }).map((row, i) => (
                            <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                              <td className="px-4 py-3 font-bold text-zinc-800 whitespace-nowrap">{row.stage_name}</td>
                              <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-[11px]">{unitLabel(row.calculation_type)}</td>
                              <td className="px-4 py-3 text-center font-mono text-zinc-700 font-bold">{row.meta_diaria ?? <span className="text-zinc-400 text-xs">—</span>}</td>
                              <td className="px-4 py-3 text-center">{periodCell(row.today)}</td>
                              <td className="px-4 py-3 text-center">{periodCell(row.week)}</td>
                              <td className="px-4 py-3 text-center">{periodCell(row.month)}</td>
                              <td className="px-4 py-3 text-center">{statusBadge(row.month.status, row.month.pct)}</td>
                            </tr>
                          ))}
                          {(goalsProductivityData.sectors || []).length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400 italic text-xs">Nenhum dado de setores no período.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              );
            })()}

            {/* Drill-Down Operacional */}
            {
              operationalReportData && (
                <div className="space-y-8 pb-12">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Produção Detalhada */}
                    <Card className="p-6">
                      <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                        <Clock size={18} className="text-zinc-400" />
                        Produção Detalhada (Etapas)
                      </h3>
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-100">
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500">Fim</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500">Colab</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500">Etapa</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500 text-right">Tempo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50">
                            {(operationalReportData?.producao_dia || []).map((step, i) => (
                              <tr key={i} className="hover:bg-zinc-50 transition-colors">
                                <td className="px-3 py-2 text-[10px] text-zinc-500">{step.hora}</td>
                                <td className="px-3 py-2 text-xs font-medium">{step.user_name}</td>
                                <td className="px-3 py-2 text-xs">{step.stage_name} <br /> <span className="text-[9px] text-zinc-400 font-mono">#{step.order_number}</span></td>
                                <td className="px-3 py-2 text-right font-mono text-[10px] font-bold">{formatSeconds(step.duration_seconds)}</td>
                              </tr>
                            ))}
                            {(operationalReportData?.producao_dia || []).length === 0 && (
                              <tr><td colSpan={4} className="px-3 py-8 text-center text-zinc-400 italic text-xs">Sem etapas registradas.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    {/* Progresso de Pedidos */}
                    <Card className="p-6">
                      <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-zinc-400" />
                        Progresso de Pedidos Ativos
                      </h3>
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-100">
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500">Pedido</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500">Progresso</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500">Próxima</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-zinc-500 text-center">Prazo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50">
                            {(operationalReportData?.progresso_pedidos || []).map((order, i) => (
                              <tr key={i} className="hover:bg-zinc-50 transition-colors">
                                <td className="px-3 py-2">
                                  <p className="text-xs font-bold">{order.order_number}</p>
                                  <p className="text-[9px] text-zinc-500 truncate max-w-[100px]">{order.client_name}</p>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500 transition-all"
                                        style={{ width: `${(order.etapas_concluidas / (order.total_etapas || 1)) * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-[9px] font-bold text-zinc-600">{order.etapas_concluidas}/{order.total_etapas}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-[10px] text-zinc-600 font-medium">
                                  {order.proxima_etapa || <span className="text-emerald-500 font-bold">Concluído</span>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={cn(
                                    "text-[10px] font-bold",
                                    isPast(endOfDay(parseISO(order.deadline))) ? "text-rose-600" : "text-zinc-500"
                                  )}>
                                    {safeFormat(order.deadline, 'dd/MM')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {(operationalReportData?.progresso_pedidos || []).length === 0 && (
                              <tr><td colSpan={4} className="px-3 py-8 text-center text-zinc-400 italic text-xs">Sem pedidos em andamento.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Pedidos Concluídos */}
                    <Card className="p-6 border-emerald-100">
                      <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-emerald-700">
                        <CheckCircle size={18} />
                        Pedidos Concluídos no Período
                      </h3>
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-emerald-50 border-b border-emerald-100 text-emerald-700">
                              <th className="px-3 py-2 text-[10px] font-bold uppercase">Conclusão</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase">Pedido</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase">Lead Time</th>
                              <th className="px-3 py-2 text-[10px] font-bold uppercase text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-50">
                            {(operationalReportData?.pedidos_concluidos || []).map((order, i) => (
                              <tr key={i} className="hover:bg-emerald-50 transition-colors">
                                <td className="px-3 py-2 text-[10px] text-zinc-500">{safeFormat(order.completed_at, 'dd/MM HH:mm')}</td>
                                <td className="px-3 py-2">
                                  <p className="text-xs font-bold text-zinc-800">{order.order_number}</p>
                                  <p className="text-[9px] text-zinc-500">{order.client_name}</p>
                                </td>
                                <td className="px-3 py-2 text-[10px] font-mono font-bold text-zinc-600">
                                  {(order.lead_time_horas || 0).toFixed(1)}h
                                </td>
                                <td className="px-3 py-2 text-center text-[9px] font-black italic uppercase">
                                  {order.no_prazo ? (
                                    <span className="text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">NO PRAZO</span>
                                  ) : (
                                    <span className="text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">ATRASADO</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    {/* Produtividade */}
                    <Card className="p-6">
                      <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                        <Users size={18} className="text-zinc-400" />
                        Produtividade por Colaborador
                      </h3>
                      <div className="space-y-4">
                        {(operationalReportData?.produtividade_colaboradores || []).map((user, i) => (
                          <div key={user.user_id} className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-end">
                              <div>
                                <p className="text-sm font-bold text-zinc-800">{user.user_name}</p>
                                <p className="text-[10px] text-zinc-500 font-medium">
                                  <Clock size={10} className="inline mr-1" />
                                  {formatSeconds(user.tempo_total_segundos)} ativo
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-mono font-black text-indigo-600">{user.pecas} peças</p>
                                <p className="text-[9px] text-zinc-400 font-bold uppercase">{user.etapas} etapas</p>
                              </div>
                            </div>
                            <div className="h-1 bg-zinc-50 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 transition-all"
                                style={{ width: `${Math.min(100, (user.pecas / 150) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </div>
              )
            }

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="p-8">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Clock size={20} />
                  Tempo Médio por Etapa (min)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData?.avgTimePerStage || []} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" fontSize={10} width={100} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(value: any) => [`${(Number(value || 0) / 60).toFixed(1)} min`, 'Tempo Médio']}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="avg_time" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card className="p-8">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <PieChartIcon size={20} />
                Tempo Médio por Perfil de Pedido
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-zinc-100">
                      <th className="pb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Perfil</th>
                      <th className="pb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center">Cores</th>
                      <th className="pb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center">Qtd. Pedidos</th>
                      <th className="pb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center">Qtd. Média Peças</th>
                      <th className="pb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-right">Média Real</th>
                      <th className="pb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-right">Mín/Máx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {profileReport.length > 0 ? (
                      (profileReport || []).map((p, i) => (
                        <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-zinc-900">{p.product_type}</span>
                              <span className="text-[10px] text-zinc-500 uppercase">{p.print_type}</span>
                            </div>
                          </td>
                          <td className="py-4 text-center">
                            {(p.print_type === 'Silk' || p.print_type === 'Sublimação') ? (
                              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                {p.num_colors} {p.num_colors === 1 ? 'Cor' : 'Cores'}
                              </span>
                            ) : (
                              <span className="text-zinc-300">-</span>
                            )}
                          </td>
                          <td className="py-4 text-center text-sm font-mono">{p.count}</td>
                          <td className="py-4 text-center text-sm font-mono">{p.avg_quantity}</td>
                          <td className="py-4 text-right">
                            <span className="text-sm font-black text-zinc-900">{formatSeconds(p.avg_time_seconds)}</span>
                          </td>
                          <td className="py-4 text-right">
                            <span className="text-[10px] font-mono text-zinc-400">
                              {formatSeconds(p.min_time_seconds)} / {formatSeconds(p.max_time_seconds)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-zinc-400 italic text-sm">
                          Aguardando mais pedidos finalizados para gerar médias por perfil...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
            </>
            )}
          </div>
  );
};