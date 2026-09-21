import { parseISO, format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSeconds(seconds: number): string {
  const absSeconds = Math.abs(seconds);
  const h = Math.floor(absSeconds / 3600);
  const m = Math.floor((absSeconds % 3600) / 60);
  const s = absSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const isImage = (url: string) => /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(url);
export const isPdf = (url: string) => /\.pdf(\?.*)?$/i.test(url);

export function getOrderCuttingQty(order: any): number {
  if (!order) return 0;
  if (order.total_via_corte !== undefined && order.total_via_corte !== null && order.total_via_corte > 0) {
    return order.total_via_corte;
  }
  if (order.items && order.items.length > 0) {
    const sumCorte = order.items.reduce((acc: number, it: any) => {
      const qPedida = it.quantity ?? it.quantidade ?? 1;
      const cQty = it.qty_corte ?? it.total_via_corte ?? (it.stock_available !== undefined && it.stock_available !== null ? Math.max(0, qPedida - Math.min(qPedida, it.stock_available)) : 0);
      return acc + cQty;
    }, 0);
    if (sumCorte > 0) return sumCorte;
  }
  if (order.observations) {
    const match = order.observations.match(/(\d+)\s*p[cc]s?\s*sem\s*estoque/i);
    if (match) {
      return parseInt(match[1], 10) || 0;
    }
  }
  return 0;
}

export function safeFormat(dateStr: string | null | undefined, formatStr: string): string {
  if (!dateStr) return '-';
  try {
    
    return format(parseISO(dateStr), formatStr);
  } catch (e) {
    return '-';
  }
}



