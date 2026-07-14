import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Printer, X, Calendar, Users, Layers, Clock, TrendingUp, DollarSign, Package, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, Stage, OperationalReportData, GoalsProductivityResponse } from './types';

// Helper to format seconds to HH:MM:SS or MM:SS
const formatSeconds = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

interface PrintableReportProps {
  isOpen: boolean;
  onClose: () => void;
  reportStartDate: string;
  reportEndDate: string;
  reportPeriod: string;
  reportUser: string;
  reportStage: string;
  reportPrintType: string;
  users: User[];
  stages: Stage[];
  reportData: any;
  operationalReportData: OperationalReportData | null;
  goalsProductivityData: GoalsProductivityResponse | null;
}

interface ConsolidatedCollaborator {
  name: string;
  ordersCount: number;
  piecesCount: number;
  totalTimeSeconds: number;
  totalCost: number;
  costPerPiece: number;
}

interface ConsolidatedSector {
  name: string;
  ordersCount: number;
  piecesCount: number;
  todayCount: number;
  weekCount: number;
  monthCount: number;
}

export const PrintableReport: React.FC<PrintableReportProps> = ({
  isOpen,
  onClose,
  reportStartDate,
  reportEndDate,
  reportPeriod,
  reportUser,
  reportStage,
  reportPrintType,
  users,
  stages,
  reportData,
  operationalReportData,
  goalsProductivityData,
}) => {
  const [activeTab, setActiveTab] = useState<'both' | 'collaborators' | 'sectors'>('both');

  // Trigger print automatically on mount with a minor delay to ensure DOM is ready
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Format dates for display
  const formatDateStr = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  const periodLabel = reportStartDate === reportEndDate 
    ? `Dia: ${formatDateStr(reportStartDate)}` 
    : `Período: ${formatDateStr(reportStartDate)} até ${formatDateStr(reportEndDate)}`;

  // Find names of active filters
  const selectedCollaboratorName = reportUser 
    ? users.find(u => u.id.toString() === reportUser)?.name 
    : null;

  const selectedStageName = reportStage 
    ? stages.find(s => s.id.toString() === reportStage)?.name 
    : null;

  // Consolidate Collaborators Data
  const collaboratorsMap = new Map<string, ConsolidatedCollaborator>();

  if (operationalReportData?.produtividade_colaboradores) {
    operationalReportData.produtividade_colaboradores.forEach(prod => {
      const name = prod.user_name;
      collaboratorsMap.set(name, {
        name,
        ordersCount: prod.etapas || 0,
        piecesCount: prod.pecas || 0,
        totalTimeSeconds: prod.tempo_total_segundos || 0,
        totalCost: 0,
        costPerPiece: 0
      });
    });
  }

  if (reportData?.costsByCollaborator) {
    reportData.costsByCollaborator.forEach((cost: any) => {
      const name = cost.name || cost.user_name;
      if (!name) return;
      const existing = collaboratorsMap.get(name);
      const totalCost = Number(cost.total_cost) || 0;
      const piecesCount = Number(cost.pecas) || existing?.piecesCount || 0;
      const totalTimeSeconds = cost.total_time ? cost.total_time * 3600 : (existing?.totalTimeSeconds || 0);

      if (existing) {
        existing.totalCost = totalCost;
        if (cost.pecas) existing.piecesCount = piecesCount;
        if (cost.total_time) existing.totalTimeSeconds = totalTimeSeconds;
        existing.costPerPiece = piecesCount > 0 ? totalCost / piecesCount : 0;
      } else {
        collaboratorsMap.set(name, {
          name,
          ordersCount: Number(cost.etapas) || 0,
          piecesCount,
          totalTimeSeconds,
          totalCost,
          costPerPiece: piecesCount > 0 ? totalCost / piecesCount : 0
        });
      }
    });
  }

  let consolidatedCollaborators = Array.from(collaboratorsMap.values());

  // Filter collaborator list if a filter is selected
  if (selectedCollaboratorName) {
    consolidatedCollaborators = consolidatedCollaborators.filter(
      c => c.name.toLowerCase() === selectedCollaboratorName.toLowerCase()
    );
  }

  // Consolidate Sectors Data
  const sectorsMap = new Map<string, ConsolidatedSector>();

  if (goalsProductivityData?.sectors) {
    goalsProductivityData.sectors.forEach(s => {
      sectorsMap.set(s.name, {
        name: s.name,
        ordersCount: 0,
        piecesCount: 0,
        todayCount: s.today || 0,
        weekCount: s.week || 0,
        monthCount: s.month || 0
      });
    });
  }

  if (reportData?.orders_list) {
    reportData.orders_list.forEach((order: any) => {
      const sectorName = order.print_type || 'Não Especificado';
      const existing = sectorsMap.get(sectorName);
      const qty = Number(order.quantity) || 0;

      if (existing) {
        existing.ordersCount += 1;
        existing.piecesCount += qty;
      } else {
        sectorsMap.set(sectorName, {
          name: sectorName,
          ordersCount: 1,
          piecesCount: qty,
          todayCount: 0,
          weekCount: 0,
          monthCount: 0
        });
      }
    });
  }

  let consolidatedSectors = Array.from(sectorsMap.values());

  // Filter sectors list if a print type/sector filter is selected
  if (reportPrintType) {
    consolidatedSectors = consolidatedSectors.filter(
      s => s.name.toLowerCase() === reportPrintType.toLowerCase()
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-0 md:p-6 print:absolute print:inset-0 print:z-0 print:bg-white print:p-0 print:block print:overflow-visible">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-md print:hidden"
        onClick={onClose}
      />

      {/* Report Modal Box */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-zinc-50 rounded-none md:rounded-2xl shadow-2xl w-full max-w-6xl h-full md:h-[90vh] overflow-hidden flex flex-col print:shadow-none print:rounded-none print:w-full print:max-w-none print:h-auto print:overflow-visible print:bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Hidden on print) */}
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 z-10 print:hidden">
          <div>
            <h2 className="font-black text-xl text-zinc-900 flex items-center gap-2">
              <Printer className="text-zinc-600" size={20} />
              Visualização do Relatório
            </h2>
            <p className="text-xs text-zinc-500 font-medium">Configure e visualize antes de gerar o PDF</p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* View selectors */}
            <div className="flex items-center bg-zinc-100 p-1 rounded-xl text-xs font-bold border border-zinc-200 mr-2">
              <button 
                onClick={() => setActiveTab('both')}
                className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'both' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                Completo
              </button>
              <button 
                onClick={() => setActiveTab('collaborators')}
                className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'collaborators' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                Colaboradores
              </button>
              <button 
                onClick={() => setActiveTab('sectors')}
                className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'sectors' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                Setores
              </button>
            </div>

            <button 
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-98"
            >
              <Printer size={14} />
              Imprimir / PDF
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-600 transition-colors border border-zinc-200 bg-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Outer scroll area for screen, simple container on print */}
        <div className="overflow-y-auto flex-1 p-6 md:p-8 bg-zinc-50 print:bg-white print:p-0 print:overflow-visible">
          
          {/* Paper Sheet Wrapper (Simulates PDF page boundaries on screen) */}
          <div className="bg-white border-0 md:border border-zinc-200 rounded-none md:rounded-xl p-0 md:p-10 max-w-4xl mx-auto shadow-none md:shadow-sm print:border-0 print:p-0 print:shadow-none">
            
            {/* Report Document Header */}
            <div className="border-b-2 border-zinc-800 pb-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center text-white text-xs font-bold">U</div>
                  <span className="font-extrabold text-sm uppercase tracking-wider text-zinc-900">Uniflow Gestão</span>
                </div>
                <h1 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">Relatório de Produção e Custos</h1>
                <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500 font-semibold">
                  <Calendar size={14} />
                  <span>{periodLabel}</span>
                </div>
              </div>
              <div className="text-left md:text-right text-xs space-y-1 font-semibold text-zinc-600 border-l-2 md:border-l-0 md:border-r-2 border-zinc-300 pl-3 md:pl-0 pr-0 md:pr-3">
                <p>Emitido em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                {selectedCollaboratorName && <p>Filtro Colaborador: <span className="text-zinc-900 font-bold">{selectedCollaboratorName}</span></p>}
                {selectedStageName && <p>Filtro Etapa: <span className="text-zinc-900 font-bold">{selectedStageName}</span></p>}
                {reportPrintType && <p>Filtro Setor: <span className="text-zinc-900 font-bold">{reportPrintType}</span></p>}
              </div>
            </div>

            {/* General Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 print:border-zinc-300 print:bg-zinc-50/50">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                  <Package size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Volume Produzido</span>
                </div>
                <h3 className="text-lg font-black text-zinc-900">
                  {(Number(reportData?.summary?.total_parts) || 0).toLocaleString('pt-BR')}
                  <span className="text-xs font-normal text-zinc-500 ml-1">peças</span>
                </h3>
              </div>

              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 print:border-zinc-300 print:bg-zinc-50/50">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                  <CheckCircle size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Pedidos Concluídos</span>
                </div>
                <h3 className="text-lg font-black text-zinc-900">
                  {reportData?.summary?.total_orders || 0}
                  <span className="text-xs font-normal text-zinc-500 ml-1">pedidos</span>
                </h3>
              </div>

              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 print:border-zinc-300 print:bg-zinc-50/50">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                  <Clock size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Tempo Médio / Etapa</span>
                </div>
                <h3 className="text-lg font-black text-zinc-900">
                  {formatSeconds(reportData?.summary?.avg_stage_time || 0)}
                </h3>
              </div>

              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 print:border-zinc-300 print:bg-zinc-50/50">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                  <DollarSign size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Custo Total M.O.</span>
                </div>
                <h3 className="text-lg font-black text-zinc-900">
                  R$ {(Number(reportData?.summary?.total_labor_cost) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
              </div>
            </div>

            {/* COLLABORATORS SECTION */}
            {(activeTab === 'both' || activeTab === 'collaborators') && (
              <div className="mb-10 print:break-after-page">
                <div className="flex items-center gap-2 mb-4 border-b border-zinc-200 pb-2">
                  <Users size={18} className="text-zinc-800" />
                  <h2 className="text-base font-black text-zinc-900 uppercase tracking-tight">Produtividade e Custos dos Colaboradores</h2>
                </div>

                {consolidatedCollaborators.length === 0 ? (
                  <p className="text-sm italic text-zinc-400 py-4 text-center">Nenhum dado de colaborador no período filtrado.</p>
                ) : (
                  <div className="space-y-6">
                    {/* Collaborators Table */}
                    <div className="overflow-x-auto border border-zinc-200 rounded-xl bg-white print:border-zinc-300">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-200 font-bold text-zinc-600 uppercase text-[9px] tracking-wider">
                            <th className="px-4 py-3">Colaborador</th>
                            <th className="px-4 py-3 text-center">Pedidos / Etapas</th>
                            <th className="px-4 py-3 text-center">Peças Produzidas</th>
                            <th className="px-4 py-3 text-center">Tempo Total</th>
                            <th className="px-4 py-3 text-right">Custo Total</th>
                            <th className="px-4 py-3 text-right">Custo / Peça</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {consolidatedCollaborators.map((colab, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50/50">
                              <td className="px-4 py-3 font-bold text-zinc-900">{colab.name}</td>
                              <td className="px-4 py-3 text-center font-semibold text-zinc-700">{colab.ordersCount}</td>
                              <td className="px-4 py-3 text-center font-semibold text-zinc-700">{colab.piecesCount}</td>
                              <td className="px-4 py-3 text-center font-semibold text-zinc-700">{formatSeconds(colab.totalTimeSeconds)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                                R$ {colab.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                                R$ {colab.costPerPiece.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Collaborators Cards View (Grid) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {consolidatedCollaborators.map((colab, idx) => (
                        <div 
                          key={idx} 
                          className="p-4 border border-zinc-200 rounded-xl bg-zinc-50/30 flex flex-col justify-between print:border-zinc-300 print:bg-white page-break-inside-avoid"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-extrabold text-sm text-zinc-950">{colab.name}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-zinc-600 print:bg-zinc-50 print:border-zinc-300">
                              R$ {colab.costPerPiece.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / peça
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-zinc-600">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle size={12} className="text-zinc-400" />
                              <span>Etapas: <strong>{colab.ordersCount}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Package size={12} className="text-zinc-400" />
                              <span>Peças: <strong>{colab.piecesCount}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} className="text-zinc-400" />
                              <span>Tempo: <strong>{formatSeconds(colab.totalTimeSeconds)}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <DollarSign size={12} className="text-zinc-400" />
                              <span>Total M.O.: <strong className="text-zinc-900">R$ {colab.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTORS SECTION */}
            {(activeTab === 'both' || activeTab === 'sectors') && (
              <div>
                <div className="flex items-center gap-2 mb-4 border-b border-zinc-200 pb-2">
                  <Layers size={18} className="text-zinc-800" />
                  <h2 className="text-base font-black text-zinc-900 uppercase tracking-tight">Produtividade por Setor (Etapa)</h2>
                </div>

                {consolidatedSectors.length === 0 ? (
                  <p className="text-sm italic text-zinc-400 py-4 text-center">Nenhum dado de setor no período filtrado.</p>
                ) : (
                  <div className="space-y-6">
                    {/* Sectors Table */}
                    <div className="overflow-x-auto border border-zinc-200 rounded-xl bg-white print:border-zinc-300">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-200 font-bold text-zinc-600 uppercase text-[9px] tracking-wider">
                            <th className="px-4 py-3">Setor / Tipo Estampa</th>
                            <th className="px-4 py-3 text-center">Pedidos no Período</th>
                            <th className="px-4 py-3 text-center">Peças no Período</th>
                            <th className="px-4 py-3 text-center">Hoje</th>
                            <th className="px-4 py-3 text-center">Semana</th>
                            <th className="px-4 py-3 text-center">Mês</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {consolidatedSectors.map((sector, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50/50">
                              <td className="px-4 py-3 font-bold text-zinc-900">{sector.name}</td>
                              <td className="px-4 py-3 text-center font-semibold text-zinc-700">{sector.ordersCount}</td>
                              <td className="px-4 py-3 text-center font-semibold text-zinc-700">{sector.piecesCount}</td>
                              <td className="px-4 py-3 text-center font-semibold text-zinc-700">{sector.todayCount}</td>
                              <td className="px-4 py-3 text-center font-semibold text-zinc-700">{sector.weekCount}</td>
                              <td className="px-4 py-3 text-center font-semibold text-zinc-700">{sector.monthCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Sectors Cards View (Grid) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {consolidatedSectors.map((sector, idx) => (
                        <div 
                          key={idx} 
                          className="p-4 border border-zinc-200 rounded-xl bg-zinc-50/30 flex flex-col justify-between print:border-zinc-300 print:bg-white page-break-inside-avoid"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-extrabold text-sm text-zinc-950">{sector.name}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-zinc-600 print:bg-zinc-50 print:border-zinc-300">
                              {sector.piecesCount} peças
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-zinc-600">
                            <div className="bg-white border border-zinc-200 rounded-lg p-2 print:border-zinc-300">
                              <span className="block text-[8px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">Hoje</span>
                              <strong className="text-zinc-900 text-sm">{sector.todayCount}</strong>
                            </div>
                            <div className="bg-white border border-zinc-200 rounded-lg p-2 print:border-zinc-300">
                              <span className="block text-[8px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">Semana</span>
                              <strong className="text-zinc-900 text-sm">{sector.weekCount}</strong>
                            </div>
                            <div className="bg-white border border-zinc-200 rounded-lg p-2 print:border-zinc-300">
                              <span className="block text-[8px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">Mês</span>
                              <strong className="text-zinc-900 text-sm">{sector.monthCount}</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Document Signature area (Print only) */}
            <div className="hidden print:block mt-16 border-t border-zinc-300 pt-8">
              <div className="flex justify-between text-xs font-semibold text-zinc-500">
                <div className="w-48 text-center">
                  <div className="h-10 border-b border-zinc-400 mb-2"></div>
                  <p>Assinatura Responsável</p>
                </div>
                <div className="w-48 text-center">
                  <div className="h-10 border-b border-zinc-400 mb-2"></div>
                  <p>Assinatura Produção</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PrintableReport;
