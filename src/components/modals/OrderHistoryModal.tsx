import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { X, RefreshCw, FileText, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const OrderHistoryModal = ({
  showHistoryModal,
  setShowHistoryModal,
  selectedOrder,
  orderHistory,
  isLoadingHistory,
  users
}: any) => {
  return (
                <AnimatePresence>
          {
            showHistoryModal && selectedOrder && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setShowHistoryModal(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="font-bold text-lg">Histórico de Alterações</h2>
                      <p className="text-xs text-zinc-500 font-mono">{selectedOrder.order_number}</p>
                    </div>
                    <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 p-6">
                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center py-12 text-zinc-400">
                        <RefreshCw size={24} className="animate-spin" />
                      </div>
                    ) : orderHistory.length === 0 ? (
                      <div className="text-center py-12 text-zinc-400">
                        <FileText size={32} className="mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Nenhum registro de alteração encontrado.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {orderHistory.map((entry) => {
                          const acaoColors: Record<string, string> = {
                            criou: 'bg-emerald-100 text-emerald-700',
                            editou: 'bg-sky-100 text-sky-700',
                            cancelou: 'bg-amber-100 text-amber-700',
                            excluiu: 'bg-rose-100 text-rose-700',
                            restaurou: 'bg-violet-100 text-violet-700',
                          };
                          const acaoLabels: Record<string, string> = {
                            criou: 'Criou', editou: 'Editou', cancelou: 'Cancelou',
                            excluiu: 'Excluiu', restaurou: 'Restaurou'
                          };
                          return (
                            <div key={entry.id} className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", acaoColors[entry.acao] || 'bg-zinc-100 text-zinc-600')}>
                                    {acaoLabels[entry.acao] || entry.acao}
                                  </span>
                                  <span className="text-xs font-semibold text-zinc-700">{entry.usuario}</span>
                                </div>
                                <span className="text-[10px] text-zinc-400">
                                  {format(new Date(entry.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                              {entry.acao === 'editou' && entry.antes && entry.depois && (() => {
                                const campos = ['client_name', 'product_type', 'print_type', 'quantity', 'deadline', 'observations', 'num_colors'];
                                const alterados = campos.filter(c => JSON.stringify(entry.antes[c]) !== JSON.stringify(entry.depois[c]));
                                return alterados.length > 0 ? (
                                  <div className="space-y-1 mt-2">
                                    {alterados.map(campo => (
                                      <div key={campo} className="text-xs flex items-center gap-2">
                                        <span className="font-bold text-zinc-500 uppercase text-[9px] w-20 shrink-0">{campo.replace('_', ' ')}</span>
                                        <span className="text-rose-500 line-through truncate">{String(entry.antes[campo] ?? '-')}</span>
                                        <ChevronRight size={10} className="text-zinc-300 shrink-0" />
                                        <span className="text-emerald-600 font-medium truncate">{String(entry.depois[campo] ?? '-')}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
        </AnimatePresence>
      </main >

      <InfoModal
        isOpen={!!infoModal}
        onClose={() => setInfoModal(null)}
        title={infoModal?.title || ''}
        description={infoModal?.description || ''}
      />

      <AnimatePresence>
        {isPrintModalOpen && (
          <PrintableReport
            isOpen={isPrintModalOpen}
            onClose={() => setIsPrintModalOpen(false)}
            reportStartDate={reportStartDate}
            reportEndDate={reportEndDate}
            reportPeriod={reportPeriod}
            reportUser={reportUser}
            reportStage={reportStage}
            reportPrintType={reportPrintType}
            users={users}
            stages={stages}
            reportData={reportData}
            operationalReportData={operationalReportData}
            goalsProductivityData={goalsProductivityData}
            isAdmin={currentUser?.role === 'Admin'}
          />
        )}
      </AnimatePresence>

  );
};
