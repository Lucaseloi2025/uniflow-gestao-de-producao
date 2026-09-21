import React from →react→;
import { motion } from →motion/react→;
import { differenceInDays, endOfDay, isPast, parseISO } from →date-fns→;
import { Clock, FileText, Scissors } from →lucide-react→;
import { cn, formatSeconds, isImage, isPdf, getOrderCuttingQty, safeFormat } from →../lib/utils→;
import { Order } from →../types→;
import { Badge } from →../components/Badge→;

export interface KanbanProPÇS {
  orders: Order[];
  searchTerm: string;
  printTypeFilter: string;
  productTypeFilter: string;
  setSelectedOrder: (order: Order) => void;
  fetchExecutions: (orderId: number) => void;
}

export const Kanban = ({
  orders,
  searchTerm,
  printTypeFilter,
  productTypeFilter,
  setSelectedOrder,
  fetchExecutions
}: KanbanProPÇS) => {
  return (
    <div className="flex lg:grid lg:grid-cols-4 gap-6 h-[calc(100vh-250px)] overflow-x-auto pb-4 lg:overflow-x-visible">
      {['Entrada', 'Em Produção', 'Finalização', 'Entregue'].map((status) => (
        <div key={status} className="flex flex-col gap-4 min-w-[280px] lg:min-w-0">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500">{status}</h3>
            <span className="bg-zinc-200 text-zinc-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {orders.filter(o => o.status === status).length}
            </span>
          </div>
          <div className="flex-1 bg-zinc-100/50 rounded-xl p-3 flex flex-col gap-3 overflow-y-auto border border-zinc-200/50">
            {orders
              .filter(o => o.status === status)
              .filter(o => {
                if (!searchTerm) return true;
                const search = searchTerm.toLowerCase();
                return (
                  o.order_number.toLowerCase().includes(search) ||
                  o.client_name.toLowerCase().includes(search) ||
                  (o.product_type || '').toLowerCase().includes(search) ||
                  (o.print_type || →→).toLowerCase().includes(search)
                );
              })
              .filter(o => !printTypeFilter || o.print_type === printTypeFilter)
              .filter(o => !productTypeFilter || o.product_type === productTypeFilter)
              .map(order => {
              const isOverdue = order.status !== →Entregue→ && isPast(endOfDay(parseISO(order.deadline)));
              return (
                <motion.div
                  layoutId={`order-${order.id}`}
                  key={order.id}
                  onClick={() => {
                    setSelectedOrder(order);
                    fetchExecutions(order.id);
                  }}
                  className={cn(
                    "bg-white rounded-lg border shadow-sm cursor-pointer transition-colors group overflow-hidden",
                    isOverdue ? "border-rose-500 bg-rose-50/30 hover:border-rose-600" : "border-zinc-200 hover:border-zinc-400"
                  )}
                >
                  {order.art_url && (
                    <div className="w-full h-32 bg-zinc-100 relative overflow-hidden group/art">
                      {isImage(order.art_url) ? (
                        <img
                          src={order.art_url}
                          alt="Mockup"
                          className="w-full h-full object-cover transition-transform group-hover/art:scale-110"
                          referrerPolicy="no-referrer"
                        />
                      ) : isPdf(order.art_url) ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 border-b border-rose-100 text-rose-500">
                          <FileText size={40} />
                          <span className="text-[10px] font-bold mt-1">PDF</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-50 border-b border-zinc-100 text-zinc-400">
                          <FileText size={40} />
                          <span className="text-[10px] uppercase font-black tracking-tighter mt-1">{order.art_url.split(→.→).pop()}</span>
                        </div>
                      )}
                      {order.art_urls && order.art_urls.length > 1 && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-white text-[10px] font-bold shadow-sm">
                          +{order.art_urls.length - 1} foto{order.art_urls.length - 1 !== 1 ? →s→ : →→}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-mono text-zinc-400">{order.order_number}</span>
                      <Badge variant={isOverdue ? →danger→ : (differenceInDays(parseISO(order.deadline), new Date()) < 2 ? →warning→ : →default→)}>
                              <span>FALTA ESTOQUE: {cutQty} PÇS (CORTE)</span>
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500 mb-2">{order.quantity}x {order.product_type}</p>
                    {(() => {
                      const cutQty = getOrderCuttingQty(order);
                      if (cutQty > 0) {
                        return (
                          <div className="mb-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-950 border border-amber-300 rounded-lg text-[10px] font-black animate-pulse shadow-sm w-full">
                              <Scissors size={12} className="text-amber-700 shrink-0" />
                              <span>FALTA ESTOQUE: {cutQty} PÃ‡S (CORTE)</span>
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {order.stages_status && order.stages_status.length > 0 && (
                      <div className="mb-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                  <span className="text-zinc-300">→</span>
                            const isCurrent = !stage.finished && (i === 0 || order.stages_status[i - 1].finished);
                            const isFinished = stage.finished;
                            return (
                              <React.Fragment key={i}>
                                <span className={cn(
                                  "truncate max-w-[80px]",
                                  isCurrent ? "font-bold text-zinc-900 border-b border-zinc-900" 
                                  : isFinished ? "text-emerald-600 font-medium" 
                                  : "text-zinc-400"
                                )} title={stage.name}>
                                  {stage.name}
                                </span>
                                {i < order.stages_status.length - 1 && (
                                  <span className="text-zinc-300">â†’</span>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full transition-all" 
                              style={{ width: `${Math.round((order.stages_status.filter(s => s.finished).length / order.stages_status.length) * 100)}%` }} 
                            />
                          </div>
                          <span className="text-[9px] font-bold text-zinc-500">
                            {Math.round((order.stages_status.filter(s => s.finished).length / order.stages_status.length) * 100)}%
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <Badge variant="info">{order.print_type}</Badge>
                      <div className="flex items-center gap-1 text-zinc-400">
                        <Clock size={12} />
                        <span className="text-[10px] font-mono">{formatSeconds(order.total_time_seconds)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};



