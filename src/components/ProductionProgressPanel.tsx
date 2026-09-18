import React, { useEffect, useState } from 'react';
import { Scissors, Shirt, CheckCircle2, Clock, AlertTriangle, Package } from 'lucide-react';

interface PlanRef {
  plan_id: number;
  plan_number: string;
  status: string;
  quantity_planned: number;
  quantity_cut: number;
}

interface ProductionItemStatus {
  item_key: string;
  product_type: string;
  fabric?: string;
  color?: string;
  size: string;
  sku?: string;
  plans: PlanRef[];
  total_planned: number;
  total_cut: number;
  total_sewing: number;
  total_sewing_done: number;
  dominant_status: string;
}

interface ProductionProgressPanelProps {
  orderId: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING_CUT:       { label: 'Pendente de Corte',   color: 'text-amber-800',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  CUT_RELEASED:      { label: 'Liberado p/ Corte',   color: 'text-blue-800',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  CUT_COMPLETED:     { label: 'Cortado',              color: 'text-indigo-800',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  IN_SEWING:         { label: 'Em Costura',           color: 'text-purple-800',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  SEWING_COMPLETED:  { label: 'Costura Concluída',    color: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  IN_CUSTOMIZATION:  { label: 'Em Personalização',    color: 'text-orange-800',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  COMPLETED:         { label: 'Concluído',            color: 'text-emerald-900', bg: 'bg-emerald-100', border: 'border-emerald-300' },
  CANCELLED:         { label: 'Cancelado',            color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
};

function ProgressBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export const ProductionProgressPanel: React.FC<ProductionProgressPanelProps> = ({ orderId }) => {
  const [items, setItems] = useState<ProductionItemStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/production-status`);
      if (!res.ok) throw new Error('Erro ao carregar andamento produtivo');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) fetchStatus();
  }, [orderId]);

  if (loading) {
    return (
      <section className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl shadow-sm space-y-2">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-900 flex items-center gap-1.5">
          <Scissors size={13} className="text-indigo-600 animate-spin" /> ANDAMENTO PRODUTIVO
        </h4>
        <p className="text-xs text-indigo-600 font-mono animate-pulse">Carregando andamento...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="p-4 bg-rose-50 border border-rose-100 rounded-2xl shadow-sm">
        <p className="text-xs text-rose-700 font-mono flex items-center gap-1.5">
          <AlertTriangle size={13} /> {error}
        </p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl shadow-sm">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700 flex items-center gap-1.5 mb-2">
          <Scissors size={13} className="text-zinc-400" /> ANDAMENTO PRODUTIVO
        </h4>
        <p className="text-xs text-zinc-400 font-mono">Nenhum plano de corte registrado para este pedido.</p>
      </section>
    );
  }

  const totalPlanned = items.reduce((s, i) => s + i.total_planned, 0);
  const totalCut = items.reduce((s, i) => s + i.total_cut, 0);
  const totalSewing = items.reduce((s, i) => s + i.total_sewing, 0);
  const totalSewingDone = items.reduce((s, i) => s + i.total_sewing_done, 0);

  return (
    <section className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-900 flex items-center gap-1.5">
          <Scissors size={13} className="text-indigo-600" /> ANDAMENTO PRODUTIVO (PCP)
        </h4>
        <button
          onClick={fetchStatus}
          className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors"
        >
          ↻ Atualizar
        </button>
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2 bg-white border border-indigo-100 rounded-xl text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase">Planejado</p>
          <p className="text-base font-black text-indigo-900 font-mono">{totalPlanned}</p>
        </div>
        <div className="p-2 bg-white border border-indigo-100 rounded-xl text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase flex items-center justify-center gap-1"><Scissors size={9} /> Cortado</p>
          <p className="text-base font-black text-blue-800 font-mono">{totalCut}</p>
        </div>
        <div className="p-2 bg-white border border-purple-100 rounded-xl text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase flex items-center justify-center gap-1"><Shirt size={9} /> Em Costura</p>
          <p className="text-base font-black text-purple-800 font-mono">{totalSewing}</p>
        </div>
        <div className="p-2 bg-white border border-emerald-100 rounded-xl text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase flex items-center justify-center gap-1"><CheckCircle2 size={9} /> Costura OK</p>
          <p className="text-base font-black text-emerald-800 font-mono">{totalSewingDone}</p>
        </div>
      </div>

      {/* Detalhe por item */}
      <div className="space-y-2">
        {items.map((item) => {
          const statusInfo = STATUS_LABELS[item.dominant_status] || STATUS_LABELS['PENDING_CUT'];
          return (
            <div
              key={item.item_key}
              className="p-3 bg-white border border-slate-100 rounded-xl space-y-2 shadow-xs"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Package size={12} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-black text-slate-900">
                    {item.product_type}
                    {item.fabric ? ` — ${item.fabric}` : ''}
                    {item.color ? ` ${item.color}` : ''}
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-600 text-white text-[11px] font-black rounded font-mono">
                    {item.size}
                  </span>
                </div>
                <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded border ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}>
                  {statusInfo.label}
                </span>
              </div>

              {/* Barra de progresso do corte */}
              {item.total_planned > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-mono text-slate-600">
                    <span className="flex items-center gap-1"><Scissors size={9} /> Corte</span>
                    <span className="font-bold">{item.total_cut}/{item.total_planned}</span>
                  </div>
                  <ProgressBar value={item.total_cut} max={item.total_planned} colorClass="bg-blue-500" />
                </div>
              )}

              {/* Barra de progresso da costura */}
              {item.total_sewing > 0 || item.total_sewing_done > 0 ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-mono text-slate-600">
                    <span className="flex items-center gap-1"><Shirt size={9} /> Costura</span>
                    <span className="font-bold">
                      {item.total_sewing_done}/{item.total_cut}
                      {item.total_sewing > 0 && <span className="text-purple-600"> ({item.total_sewing} em andamento)</span>}
                    </span>
                  </div>
                  <ProgressBar value={item.total_sewing_done} max={item.total_cut || item.total_planned} colorClass="bg-purple-500" />
                </div>
              ) : null}

              {/* Planos associados */}
              {item.plans && item.plans.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                  {item.plans.map((p) => (
                    <span
                      key={p.plan_id}
                      className="text-[9px] font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200"
                      title={`Status: ${p.status}`}
                    >
                      {p.plan_number || `#${p.plan_id}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ProductionProgressPanel;
