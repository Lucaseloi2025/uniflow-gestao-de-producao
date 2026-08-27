import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Clock, Loader2, AlertCircle } from 'lucide-react';

interface PublicStage {
  id: number;
  name: string;
  status: 'concluida' | 'em_andamento' | 'pendente';
}

interface PublicOrder {
  order_number: string;
  client_name: string;
  product_type: string;
  print_type: string;
  quantity: number;
  deadline: string;
  stages: PublicStage[];
}

export default function PublicTracking({ token }: { token: string | null }) {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/public/orders/${token}`);
        if (!res.ok) {
          setError(true);
        } else {
          const data = await res.json();
          setOrder(data);
        }
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-emerald-500 w-10 h-10 mb-4" />
        <p className="text-zinc-400 text-sm font-medium">Carregando informações do pedido...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-md w-full shadow-xl">
          <AlertCircle className="text-rose-500 w-16 h-16 mx-auto mb-4" />
          <h1 className="text-white text-xl font-bold mb-2">Link não encontrado</h1>
          <p className="text-zinc-400 text-sm mb-6">
            O link de acompanhamento que você tentou acessar é inválido, expirou ou o pedido foi arquivado.
          </p>
          <p className="text-zinc-500 text-xs font-mono">
            Por favor, entre em contato com o atendimento para solicitar um novo link.
          </p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalStages = order.stages.length;
  const completedStages = order.stages.filter((s) => s.status === 'concluida').length;
  const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  // Format date
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased">
      {/* Header Sleek Dark */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-emerald-400 font-black text-lg tracking-wider">COMFORTPRO</span>
            <span className="bg-zinc-800 text-[10px] text-zinc-400 px-2 py-0.5 rounded font-medium">ACOMPANHAMENTO</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Order Meta Information Card */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Pedido</span>
            <h1 className="text-xl font-black text-white leading-tight mt-0.5">
              {order.order_number}
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Cliente</span>
              <p className="text-sm font-semibold text-zinc-200 mt-0.5">{order.client_name}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Prazo de Entrega</span>
              <p className="text-sm font-semibold text-zinc-200 mt-0.5 flex items-center gap-1.5">
                <Clock size={14} className="text-emerald-400" />
                {formatDate(order.deadline)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Produto</span>
              <p className="text-sm font-semibold text-zinc-200 mt-0.5">
                {order.product_type} <span className="text-zinc-500 text-xs font-normal">({order.print_type})</span>
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Quantidade</span>
              <p className="text-sm font-semibold text-zinc-200 mt-0.5">{order.quantity} pçs</p>
            </div>
          </div>
        </section>

        {/* Progress Tracker Card */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-5">
          {/* Header Progress */}
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-sm font-bold text-zinc-400">Progresso de Produção</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {completedStages} de {totalStages} etapas concluídas
              </p>
            </div>
            <span className="text-lg font-black text-emerald-400">{progressPercent}%</span>
          </div>

          {/* Bar Chart Visual progress */}
          <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Steps list */}
          <div className="relative pl-1 pt-4 space-y-6">
            {/* Vertical timeline line */}
            <div className="absolute left-[13px] top-6 bottom-6 w-[2px] bg-zinc-800" />

            {order.stages.map((stage) => {
              const isConcluida = stage.status === 'concluida';
              const isEmAndamento = stage.status === 'em_andamento';

              return (
                <div key={stage.id} className="relative flex items-start gap-4">
                  {/* Visual bullet/status icon */}
                  <div className="z-10 flex items-center justify-center bg-zinc-900 w-7 h-7 rounded-full">
                    {isConcluida ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-950/40" />
                    ) : isEmAndamento ? (
                      <div className="w-6 h-6 rounded-full border-2 border-emerald-400 flex items-center justify-center animate-pulse">
                        <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
                      </div>
                    ) : (
                      <Circle className="w-5 h-5 text-zinc-700" />
                    )}
                  </div>

                  {/* Stage text */}
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center justify-between">
                      <h3
                        className={`text-sm font-bold transition-colors ${
                          isConcluida
                            ? 'text-zinc-400 line-through decoration-zinc-850'
                            : isEmAndamento
                            ? 'text-white font-extrabold'
                            : 'text-zinc-650'
                        }`}
                      >
                        {stage.name}
                      </h3>
                      <span
                        className={`text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded ${
                          isConcluida
                            ? 'bg-zinc-800/40 text-zinc-500'
                            : isEmAndamento
                            ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50'
                            : 'bg-zinc-900/20 text-zinc-700'
                        }`}
                      >
                        {isConcluida ? 'Concluída' : isEmAndamento ? 'Em Andamento' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 text-center border-t border-zinc-900 bg-zinc-950/50">
        <p className="text-[10px] text-zinc-600 font-mono">
          ComfortPro Uniformes © 2026. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
