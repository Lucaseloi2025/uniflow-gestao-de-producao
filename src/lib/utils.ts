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

export function isOrderCompleted(order: any): boolean {
  if (!order) return false;
  const status = typeof order.status === 'string' ? order.status.trim() : '';
  if (status === 'Pronto' || status === 'Entregue' || status === 'Cancelado' || status === 'Finalizado' || status === 'Concluído') {
    return true;
  }
  // Exclui etapa legada Conferência da obrigatoriedade para não reter pedidos
  const stagesList = (Array.isArray(order.stages_status) ? order.stages_status : [])
    .filter((s: any) => Number(s.id) !== 12 && !String(s.name || '').toLowerCase().includes('confer'));
  if (stagesList.length > 0 && stagesList.every((s: any) => s && (s.finished === true || s.status === 'Concluído' || s.status === 'Finalizado'))) {
    return true;
  }
  return false;
}

export function getStageSlugFromStage(stage: any): string {
  if (!stage) return '';
  if (stage.code && typeof stage.code === 'string' && stage.code.trim()) {
    return stage.code.toUpperCase().trim();
  }
  if (stage.slug && typeof stage.slug === 'string' && stage.slug.trim()) {
    return stage.slug.toUpperCase().trim();
  }
  const raw = String(stage.name || stage.sector_name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  if (raw.includes('FICHA') || raw.includes('APROVA') || raw.includes('ARTE')) return 'FICHA_APROVACAO';
  if (raw.includes('CORTE') || raw.includes('SEPARA')) return 'CORTE';
  if (raw.includes('SUBLIMA')) return 'SUBLIMACAO';
  if (raw.includes('ESTAMPA') || raw.includes('PRENSA')) return 'ESTAMPAGEM';
  if (raw.includes('SILK') || raw.includes('SERIGRAF')) return 'SILK';
  if (raw.includes('DTF')) return 'DTF';
  if (raw.includes('BORDADO')) return 'BORDADO';
  if (raw.includes('COSTURA')) return 'COSTURA';
  if (raw.includes('REVIS') || raw.includes('ACABAMENTO')) return 'REVISAO';
  if (raw.includes('EMBALA') || raw.includes('EXPEDI')) return 'EMBALAGEM';
  if (raw.includes('CONFER')) return 'CONFERENCIA';
  return raw.replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function getStageProductivityUnit(stage: any): {
  unit: 'ficha' | 'kit_dtf' | 'peca' | 'lote';
  singular: string;
  plural: string;
  actionSingular: string;
  actionPlural: string;
  queueLabel: string;
  todayDoneLabel: string;
  todayDoneSubLabel: string;
  isPerOrderUnit: boolean;
} {
  const slug = getStageSlugFromStage(stage);
  const calcType = String(stage?.calculation_type || '').toLowerCase();
  const explicitUnit = String(stage?.unidade_produtividade || stage?.productivity_unit || '').toLowerCase();

  if (explicitUnit === 'ficha' || calcType === 'por_pedido' || slug === 'FICHA_APROVACAO') {
    return {
      unit: 'ficha',
      singular: 'ficha',
      plural: 'fichas',
      actionSingular: 'ficha aprovada',
      actionPlural: 'fichas aprovadas',
      queueLabel: 'Fichas na Fila',
      todayDoneLabel: 'Fichas Concluídas Hoje',
      todayDoneSubLabel: 'Fichas aprovadas hoje',
      isPerOrderUnit: true,
    };
  }

  if (explicitUnit === 'kit_dtf' || calcType === 'por_kit_dtf' || slug === 'DTF') {
    return {
      unit: 'kit_dtf',
      singular: 'kit DTF',
      plural: 'kits DTF',
      actionSingular: 'kit impresso',
      actionPlural: 'kits impressos',
      queueLabel: 'Kits DTF na Fila',
      todayDoneLabel: 'Kits Impressos Hoje',
      todayDoneSubLabel: 'Kits de estampas impressos',
      isPerOrderUnit: false,
    };
  }

  if (explicitUnit === 'lote' || calcType === 'por_lote') {
    return {
      unit: 'lote',
      singular: 'lote',
      plural: 'lotes',
      actionSingular: 'lote concluído',
      actionPlural: 'lotes concluídos',
      queueLabel: 'Lotes na Fila',
      todayDoneLabel: 'Lotes Concluídos Hoje',
      todayDoneSubLabel: 'Lotes apontados hoje',
      isPerOrderUnit: false,
    };
  }

  if (slug === 'CORTE') {
    return {
      unit: 'peca',
      singular: 'peça',
      plural: 'peças',
      actionSingular: 'peça cortada',
      actionPlural: 'peças cortadas',
      queueLabel: 'Peças na Fila',
      todayDoneLabel: 'Peças Cortadas Hoje',
      todayDoneSubLabel: 'Peças efetivamente cortadas',
      isPerOrderUnit: false,
    };
  }

  if (slug === 'ESTAMPAGEM') {
    return {
      unit: 'peca',
      singular: 'peça',
      plural: 'peças',
      actionSingular: 'peça estampada',
      actionPlural: 'peças estampadas',
      queueLabel: 'Peças na Fila',
      todayDoneLabel: 'Peças Estampadas Hoje',
      todayDoneSubLabel: 'Peças efetivamente estampadas',
      isPerOrderUnit: false,
    };
  }

  if (slug === 'COSTURA') {
    return {
      unit: 'peca',
      singular: 'peça',
      plural: 'peças',
      actionSingular: 'peça costurada',
      actionPlural: 'peças costuradas',
      queueLabel: 'Peças na Fila',
      todayDoneLabel: 'Peças Costuradas Hoje',
      todayDoneSubLabel: 'Peças efetivamente costuradas',
      isPerOrderUnit: false,
    };
  }

  if (slug === 'SUBLIMACAO') {
    return {
      unit: 'peca',
      singular: 'peça',
      plural: 'peças',
      actionSingular: 'peça sublimada',
      actionPlural: 'peças sublimadas',
      queueLabel: 'Peças na Fila',
      todayDoneLabel: 'Peças Sublimadas Hoje',
      todayDoneSubLabel: 'Peças efetivamente sublimadas',
      isPerOrderUnit: false,
    };
  }

  return {
    unit: 'peca',
    singular: 'peça',
    plural: 'peças',
    actionSingular: 'peça produzida',
    actionPlural: 'peças produzidas',
    queueLabel: 'Peças na Fila',
    todayDoneLabel: 'Peças Produzidas Hoje',
    todayDoneSubLabel: 'Peças boas apontadas',
    isPerOrderUnit: false,
  };
}

