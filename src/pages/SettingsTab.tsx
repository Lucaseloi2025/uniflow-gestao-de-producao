import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/Badge';
import { 
  AlertCircle, AlertTriangle, ArrowDown, ArrowUp, BarChart3, 
  ChevronRight, ClipboardList, Clock, Edit2, Plus, 
  Settings, Target, Trash2 
} from 'lucide-react';
import { cn, safeFormat, formatSeconds } from '../lib/utils';
import type { Stage, User, OrderTemplate } from '../types';

export const SettingsTab = ({
  autoPauseTimeFriday, autoPauseTimeLunch, autoPauseTimeWeekday, collaboratorGoals, currentUser,
  editingStageCalculationType, editingStageId, editingStageMetaDiaria, editingStageName, editingStageTime,
  expandedGoalStageId, goalEditValues, lossReasonsList, newStageCalculationType, newStageMetaDiaria,
  newStageName, newStageTime, stages, stats, templates, users,
  setAutoPauseTimeFriday, setAutoPauseTimeLunch, setAutoPauseTimeWeekday, setEditingStageCalculationType,
  setEditingStageId, setEditingStageMetaDiaria, setEditingStageName, setEditingStageTime, setEditingTemplate,
  setExpandedGoalStageId, setGoalEditValues, setIsTemplateEditorOpen, setLossReasonsList, setNewStageCalculationType,
  setNewStageMetaDiaria, setNewStageName, setNewStageTime, setTemplateFormStages,
  fetchCollaboratorGoals, fetchData, handleSaveLossReasonsMapping, moveStage, safeFetch
}: any) => {
  return (
    <div className="max-w-2xl space-y-8 pb-12">
            <Card className="p-8">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Settings size={20} />
                  Integração Supabase
                </h3>
                <button
                  onClick={async () => {
                    const data = await safeFetch('/api/supabase/status');
                    if (data?.status === 'success') {
                      alert('✅ Supabase conectado com sucesso!');
                    } else {
                      alert(`❌ Erro: ${data?.message || 'Falha na conexão'}`);
                    }
                  }}
                  className="text-[10px] font-bold uppercase tracking-wider text-sky-600 hover:text-sky-700"
                >
                  Testar Conexão
                </button>
              </div>
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Status do SDK:</span>
                  <Badge variant="info">Ativo</Badge>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  O SDK do Supabase foi inicializado. Para usar o Supabase como banco de dados principal (SQL),
                  certifique-se de configurar a <strong>DATABASE_URL</strong> com a Connection String do Supabase nos Secrets.
                </p>
              </div>
            </Card>

            <Card className="p-8">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <BarChart3 size={20} />
                Configuração de Capacidade Produtiva
              </h3>
              <form className="space-y-6" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  jornada_horas: Number(formData.get('jornada_horas')),
                  operadores_ativos: Number(formData.get('operadores_ativos')),
                  eficiencia_percentual: Number(formData.get('eficiencia_percentual')) / 100,
                  dias_uteis_mes: Number(formData.get('dias_uteis_mes')),
                  meta_custo_por_peca: Number(formData.get('meta_custo_por_peca'))
                };

                await fetch('/api/config', {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': currentUser?.role || ''
                  },
                  body: JSON.stringify(data)
                });
                fetchData();
              }}>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Jornada de Trabalho (Horas)</label>
                    <input
                      name="jornada_horas"
                      type="number"
                      step="0.5"
                      defaultValue={stats?.capacity?.config?.jornada_horas || 8}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Operadores Ativos</label>
                    <input
                      name="operadores_ativos"
                      type="number"
                      defaultValue={stats?.capacity?.config?.operadores_ativos || 2}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Eficiência Operacional (%)</label>
                    <input
                      name="eficiencia_percentual"
                      type="number"
                      defaultValue={(stats?.capacity?.config?.eficiencia_percentual || 0.85) * 100}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Dias Úteis no Mês</label>
                    <input
                      name="dias_uteis_mes"
                      type="number"
                      defaultValue={stats?.capacity?.config?.dias_uteis_mes || 22}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Meta Custo/Peça (R$)</label>
                    <input
                      name="meta_custo_por_peca"
                      type="number"
                      step="0.01"
                      defaultValue={metaCustoPeca || 0}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors">
                  Salvar Configurações
                </button>
              </form>
            </Card>

            <Card className="p-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <Clock size={20} />
                Horários de Pausa Automática
              </h3>
              <p className="text-xs text-zinc-400 mb-6">
                Ao atingir o horário configurado, todas as tarefas em andamento são pausadas automaticamente.
                O sistema requer que um Admin esteja com o sistema aberto no horário.
              </p>
              <form className="space-y-5" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const weekday = formData.get('auto_pause_time_weekday') as string;
                const friday = formData.get('auto_pause_time_friday') as string;
                const lunch = formData.get('auto_pause_time_lunch') as string;
                const res = await fetch('/api/config', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role || '' },
                  body: JSON.stringify({ auto_pause_time_weekday: weekday, auto_pause_time_friday: friday, auto_pause_time_lunch: lunch })
                });
                if (res.ok) {
                  setAutoPauseTimeWeekday(weekday);
                  setAutoPauseTimeFriday(friday);
                  setAutoPauseTimeLunch(lunch);
                  alert('✅ Horários salvos com sucesso!');
                }
              }}>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Almoço (Horário de Pausa)</label>
                    <input
                      name="auto_pause_time_lunch"
                      type="time"
                      defaultValue={autoPauseTimeLunch}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Seg – Qui (Fim de Expediente)</label>
                    <input
                      name="auto_pause_time_weekday"
                      type="time"
                      defaultValue={autoPauseTimeWeekday}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Sexta (Fim de Expediente)</label>
                    <input
                      name="auto_pause_time_friday"
                      type="time"
                      defaultValue={autoPauseTimeFriday}
                      className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors">
                  Salvar Horários
                </button>
              </form>
            </Card>
            <Card className="p-8">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Settings size={20} />
                Gerenciar Etapas de Produção
              </h3>

              <div className="flex flex-wrap gap-2 mb-8">
                <input
                  type="text"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="Nome da nova etapa (ex: Silk 2 Cores)"
                  className="flex-1 min-w-[200px] p-2 border border-zinc-200 rounded-lg text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  value={newStageTime || ''}
                  onChange={(e) => setNewStageTime(Number(e.target.value))}
                  placeholder="Tempo Ideal (min/peça)"
                  title="Tempo ideal da etapa em minutos por peça"
                  className="p-2 border border-zinc-200 rounded-lg text-sm w-36 focus:outline-none focus:border-zinc-400"
                />
                 <select
                  value={newStageCalculationType}
                  onChange={(e) => setNewStageCalculationType(e.target.value as any)}
                  className="p-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:border-zinc-400"
                >
                  <option value="por_pedido">📄 Por pedido</option>
                  <option value="por_peca">👕 Por peça</option>
                  <option value="por_lote">📦 Por lote</option>
                </select>
                <input
                  type="number"
                  value={newStageMetaDiaria}
                  onChange={(e) => setNewStageMetaDiaria(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Meta Diária"
                  title="Meta de produção diária base para esta etapa"
                  className="p-2 border border-zinc-200 rounded-lg text-sm w-28 focus:outline-none focus:border-zinc-400"
                />
                <button
                  onClick={async () => {
                    if (!newStageName) return;
                    await fetch('/api/stages', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-user-role': currentUser?.role || ''
                      },
                      body: JSON.stringify({ 
                        name: newStageName, 
                        ideal_time: newStageTime * 60,
                        calculation_type: newStageCalculationType,
                        meta_diaria: newStageMetaDiaria !== '' ? newStageMetaDiaria : null
                      })
                    });
                    setNewStageName('');
                    setNewStageTime(0);
                    setNewStageCalculationType('por_peca');
                    setNewStageMetaDiaria('');
                    fetchData();
                  }}
                  className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors"
                >
                  Adicionar
                </button>
              </div>

              <div className="space-y-3">
                {stages.map((stage, index) => {
                  const idealTimeDisplay = stage.ideal_time || stage.average_time_seconds || 0;
                  return (
                  <div key={stage.id} className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-100 rounded-xl group">
                    <div className="flex items-center gap-4 flex-1">
                      <span className="text-xs font-bold text-zinc-400 w-6">{stage.sort_order}</span>
                      {editingStageId === stage.id ? (
                        <div className="flex flex-wrap flex-1 gap-2">
                          <input
                            type="text"
                            autoFocus
                            value={editingStageName}
                            onChange={(e) => setEditingStageName(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === 'Escape') setEditingStageId(null);
                            }}
                            className="flex-1 min-w-[150px] bg-white border border-zinc-300 rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={editingStageTime === 0 ? '' : editingStageTime}
                            onChange={(e) => setEditingStageTime(Number(e.target.value))}
                            className="p-1 border border-zinc-300 rounded text-sm w-24 text-center"
                            title="Tempo ideal por peça em minutos"
                          />
                          <select
                            value={editingStageCalculationType}
                            onChange={(e) => setEditingStageCalculationType(e.target.value as any)}
                            className="p-1 border border-zinc-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                          >
                            <option value="por_pedido">📄 Por pedido</option>
                            <option value="por_peca">👕 Por peça</option>
                            <option value="por_lote">📦 Por lote</option>
                          </select>
                          <input
                            type="number"
                            value={editingStageMetaDiaria}
                            onChange={(e) => setEditingStageMetaDiaria(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Meta Diária"
                            title="Meta de produção diária base para esta etapa"
                            className="p-1 border border-zinc-300 rounded text-sm w-24 text-center"
                          />
                          <button
                            onClick={async () => {
                              if (editingStageName) {
                                await fetch(`/api/stages/${stage.id}`, {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'x-user-role': currentUser?.role || ''
                                  },
                                  body: JSON.stringify({ 
                                    name: editingStageName, 
                                    ideal_time: editingStageTime * 60,
                                    calculation_type: editingStageCalculationType,
                                    meta_diaria: editingStageMetaDiaria !== '' ? editingStageMetaDiaria : null
                                  })
                                });
                                fetchData();
                              }
                              setEditingStageId(null);
                            }}
                            className="px-3 py-1 bg-zinc-900 text-white rounded text-xs font-bold hover:bg-zinc-800 transition-colors"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingStageId(null)}
                            className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded text-xs font-bold hover:bg-zinc-200 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{stage.name}</span>
                            {stage.calculation_type === 'por_pedido' && <Badge variant="info" className="lowercase italic opacity-70">por pedido</Badge>}
                            {stage.calculation_type === 'por_peca' && <Badge variant="success" className="lowercase italic opacity-70">por peça</Badge>}
                            {stage.calculation_type === 'por_lote' && <Badge variant="warning" className="lowercase italic opacity-70">por lote</Badge>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {idealTimeDisplay > 0 ? <span className="text-[10px] text-zinc-500 font-mono bg-white px-1.5 py-0.5 rounded border border-zinc-200">
                              Ideal: {formatSeconds(idealTimeDisplay)} {stage.calculation_type === 'por_peca' ? '/pc' : ''}
                            </span> : null}
                            {stage.real_average_time && stage.real_average_time > 0 ? (
                               <span className="text-[10px] text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                 Real: {formatSeconds(stage.real_average_time)} ({stage.execution_count} rec)
                               </span>
                            ) : null}
                            {stage.meta_diaria && stage.meta_diaria > 0 ? (
                              <span className="text-[10px] text-violet-600 font-mono bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100">
                                Meta: {stage.meta_diaria}/{stage.calculation_type === 'por_pedido' ? 'ped' : 'pc'}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="success">Ativa</Badge>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => moveStage(index, -1)}
                          disabled={index === 0}
                          className="p-1.5 hover:bg-zinc-200 rounded text-zinc-500 disabled:opacity-30 transition-colors"
                          title="Mover para cima"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => moveStage(index, 1)}
                          disabled={index === stages.length - 1}
                          className="p-1.5 hover:bg-zinc-200 rounded text-zinc-500 disabled:opacity-30 transition-colors"
                          title="Mover para baixo"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <div className="w-px h-4 bg-zinc-200 mx-1"></div>
                        <button
                          onClick={() => {
                            setEditingStageId(stage.id);
                            setEditingStageName(stage.name);
                            setEditingStageTime(Math.round((stage.ideal_time || stage.average_time_seconds || 0) / 60));
                            setEditingStageCalculationType(stage.calculation_type || 'por_peca');
                            setEditingStageMetaDiaria(stage.meta_diaria ?? '');
                          }}
                          className="p-1.5 hover:bg-zinc-200 rounded text-zinc-500 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Tem certeza que deseja excluir a etapa "${stage.name}"?`)) {
                              await fetch(`/api/stages/${stage.id}`, {
                                method: 'DELETE',
                                headers: { 'x-user-role': currentUser?.role || '' }
                              });
                              fetchData();
                            }
                          }}
                          className="p-1.5 hover:bg-rose-100 rounded text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>

              {/* Metas Individuais por Colaborador */}
              <div className="mt-8 border-t border-zinc-100 pt-6">
                <h4 className="text-sm font-bold text-zinc-700 mb-4 flex items-center gap-2">
                  <Target size={16} className="text-zinc-500" />
                  Metas Individuais por Colaborador (Overrides)
                </h4>
                <p className="text-xs text-zinc-500 mb-4">Configure metas personalizadas por colaborador que sobrescrevem a meta padrão do setor.</p>
                <div className="space-y-2">
                  {stages.map(stage => (
                    <div key={stage.id} className="border border-zinc-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => {
                          setExpandedGoalStageId(expandedGoalStageId === stage.id ? null : stage.id);
                          if (expandedGoalStageId !== stage.id) fetchCollaboratorGoals();
                        }}
                        className="w-full flex items-center justify-between p-3 bg-zinc-50 hover:bg-zinc-100 transition-colors text-left"
                      >
                        <span className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                          {stage.name}
                          <span className="text-[10px] text-zinc-400 font-mono">
                            Meta padrão: {stage.meta_diaria ?? '—'} {stage.calculation_type === 'por_pedido' ? 'pedidos' : 'peças'}/dia
                          </span>
                        </span>
                        <ChevronRight size={14} className={cn('text-zinc-400 transition-transform', expandedGoalStageId === stage.id && 'rotate-90')} />
                      </button>
                      {expandedGoalStageId === stage.id && (
                        <div className="p-4 space-y-2">
                          {users.filter(u => u.active).map(user => {
                            const override = collaboratorGoals.find(g => g.user_id === user.id && g.stage_id === stage.id);
                            const key = `${stage.id}-${user.id}`;
                            const editVal = goalEditValues[key] ?? '';
                            return (
                              <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-50/50 border border-zinc-100">
                                <span className="text-sm font-medium text-zinc-700 w-40 truncate">{user.name}</span>
                                {override ? (
                                  <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">Meta personalizada: {override.meta_diaria}</span>
                                ) : (
                                  <span className="text-[10px] text-zinc-400">Usa padrão do setor ({stage.meta_diaria ?? '—'})</span>
                                )}
                                <div className="flex items-center gap-2 ml-auto">
                                  <input
                                    type="number"
                                    value={editVal}
                                    onChange={e => setGoalEditValues(v => ({ ...v, [key]: e.target.value }))}
                                    placeholder={String(override?.meta_diaria ?? stage.meta_diaria ?? '')}
                                    className="w-20 p-1 border border-zinc-200 rounded text-xs text-center"
                                  />
                                  <button
                                    onClick={async () => {
                                      if (!editVal) return;
                                      await fetch('/api/collaborator-goals', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role || '' },
                                        body: JSON.stringify({ user_id: user.id, stage_id: stage.id, meta_diaria: Number(editVal) })
                                      });
                                      setGoalEditValues(v => { const n = { ...v }; delete n[key]; return n; });
                                      fetchCollaboratorGoals();
                                    }}
                                    className="px-2 py-1 bg-zinc-900 text-white rounded text-[10px] font-bold hover:bg-zinc-700 transition-colors"
                                  >Salvar</button>
                                  {override && (
                                    <button
                                      onClick={async () => {
                                        if (!override.id) return;
                                        await fetch(`/api/collaborator-goals/${override.id}`, {
                                          method: 'DELETE',
                                          headers: { 'x-user-role': currentUser?.role || '' }
                                        });
                                        fetchCollaboratorGoals();
                                      }}
                                      className="px-2 py-1 bg-rose-50 text-rose-600 rounded text-[10px] font-bold hover:bg-rose-100 transition-colors"
                                    >Remover</button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Mapeamento de Motivos de Perda & Etapa de Reentrada */}
            <Card className="p-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <AlertCircle size={20} className="text-rose-600" />
                Mapeamento de Motivos de Perda & Etapa de Reentrada Padrão
              </h3>
              <p className="text-xs text-zinc-500 mb-6">
                Configure para qual etapa a peça de reposição reentra automaticamente no fluxo quando um operador registra uma perda.
              </p>
              <div className="space-y-3">
                {lossReasonsList.map((reason, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl gap-3">
                    <div className="flex-1">
                      <span className="font-bold text-xs text-zinc-900">{reason.motivo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 font-medium">Reentra em:</span>
                      <select
                        value={reason.etapa_reentrada_id}
                        onChange={(e) => {
                          const newId = Number(e.target.value);
                          const updated = lossReasonsList.map((r, i) => i === idx ? { ...r, etapa_reentrada_id: newId } : r);
                          setLossReasonsList(updated);
                        }}
                        className="p-2 border border-zinc-200 rounded-lg text-xs bg-white font-medium focus:outline-none focus:border-zinc-400"
                      >
                        {stages.map(st => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleSaveLossReasonsMapping(lossReasonsList)}
                className="mt-6 px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-colors"
              >
                Salvar Mapeamento de Perdas
              </button>
            </Card>

            <Card className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ClipboardList size={20} />
                  Gerenciar Templates de Pedido
                </h3>
                {currentUser?.role === 'Admin' && (
                  <button
                    onClick={() => {
                      setEditingTemplate(null);
                      setTemplateFormStages(stages.filter(s => s.active).map(s => s.id));
                      setIsTemplateEditorOpen(true);
                    }}
                    className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} /> Novo Template
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl hover:border-zinc-300 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-sm text-zinc-900">{template.name}</h4>
                      {currentUser?.role === 'Admin' && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingTemplate(template);
                              setTemplateFormStages(template.required_stages || []);
                              setIsTemplateEditorOpen(true);
                            }}
                            className="p-1.5 hover:bg-zinc-200 rounded text-zinc-500"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Excluir template "${template.name}"?`)) {
                                await fetch(`/api/order-templates/${template.id}`, {
                                  method: 'DELETE',
                                  headers: { 'x-user-role': currentUser?.role || '' }
                                });
                                fetchData();
                              }
                            }}
                            className="p-1.5 hover:bg-rose-100 rounded text-rose-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="default">{template.product_type}</Badge>
                      <Badge variant="info">{template.print_type}</Badge>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Etapas Inclusas:</div>
                    <div className="flex flex-wrap gap-1">
                      {stages.filter(s => template.required_stages?.includes(s.id)).map(s => (
                        <span key={s.id} className="px-2 py-0.5 bg-zinc-200 text-zinc-600 rounded text-[9px] font-bold">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-8 border border-rose-100 bg-rose-50/10">
              <h3 className="text-lg font-bold text-rose-900 mb-2 flex items-center gap-2">
                <AlertTriangle size={20} className="text-rose-600" />
                Zona de Perigo: Ações Críticas
              </h3>
              <p className="text-xs text-zinc-500 mb-6">
                Estas ações são irreversíveis e afetam permanentemente os dados do sistema. Certifique-se do que está fazendo.
              </p>
              
              <div className="p-5 bg-white border border-rose-200/50 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-sm transition-all duration-200">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-zinc-900">Zerar Relatórios & Histórico de Produção</h4>
                  <p className="text-xs text-zinc-500 max-w-xl leading-relaxed">
                    Apaga permanentemente todos os registros de tempos operacionais e pausas (<code className="bg-zinc-100 text-zinc-600 px-1 py-0.5 rounded text-[10px] font-mono">stage_executions</code> e <code className="bg-zinc-100 text-zinc-600 px-1 py-0.5 rounded text-[10px] font-mono">pauses</code>). 
                    Os pedidos, clientes e configurações <strong>não serão excluídos</strong>, mas todas as métricas de relatórios e produtividade voltarão a zero.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const promptVal = prompt("⚠️ AVISO CRÍTICO: Isto irá zerar todas as estatísticas de relatórios operacionais e produtividade dos colaboradores permanentemente.\n\nPara prosseguir, digite \"CONFIRMAR\" abaixo:");
                    if (promptVal !== "CONFIRMAR") {
                      if (promptVal !== null) {
                        alert("Operação cancelada. A confirmação não foi digitada corretamente.");
                      }
                      return;
                    }

                    try {
                      const res = await fetch('/api/admin/reset-production', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-user-role': currentUser?.role || '',
                          'x-user-name': currentUser?.name || 'Admin'
                        }
                      });

                      const data = await res.json();
                      if (res.ok && data.success) {
                        alert("✅ " + data.message);
                        fetchData(); // Recarrega todas as informações
                      } else {
                        alert("❌ Falha ao zerar relatórios: " + (data.error || "Erro desconhecido"));
                      }
                    } catch (err: any) {
                      console.error("Erro ao resetar:", err);
                      alert("❌ Erro de rede ou servidor ao realizar a limpeza.");
                    }
                  }}
                  className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all duration-200 shadow-sm shadow-rose-100 hover:shadow active:scale-98 whitespace-nowrap self-start md:self-center pointer-events-auto"
                >
                  Zerar Relatórios e Tempos
                </button>
              </div>
            </Card>
          </div>
        

  );
};




