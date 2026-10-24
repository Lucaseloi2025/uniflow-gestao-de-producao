import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "crypto";
// ── Inlined cutting utilities (avoid cross-dir import that crashes Vercel serverless) ──
function parseOrderItems(itemsRaw: any): any[] {
  if (!itemsRaw) return [];
  if (Array.isArray(itemsRaw)) return itemsRaw;
  if (typeof itemsRaw === 'string') {
    try {
      const parsed = JSON.parse(itemsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }
  return [];
}

const ADULT_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'EXG', 'XXL', 'G1', 'G2', 'G3', 'G4', 'G5'];
const CHILD_SIZES = ['1', '2', '4', '6', '8', '10', '12', '14', '16'];

const COLOR_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'Azul Marinho', pattern: /\b(azul\s*marinho|marinho|navy)\b/i },
  { name: 'Verde Menta', pattern: /\b(verde\s*menta|menta)\b/i },
  { name: 'Verde Militar', pattern: /\b(verde\s*militar)\b/i },
  { name: 'Verde Bandeira', pattern: /\b(verde\s*bandeira)\b/i },
  { name: 'Rosa Chiclete', pattern: /\b(rosa\s*chiclete)\b/i },
  { name: 'Rosa Bebê', pattern: /\b(rosa\s*beb[eê])\b/i },
  { name: 'Cinza Mescla', pattern: /\b(cinza\s*mescla|mescla)\b/i },
  { name: 'Cinza Chumbo', pattern: /\b(cinza\s*chumbo|chumbo)\b/i },
  { name: 'Off White', pattern: /\b(off\s*white|off-white)\b/i },
  { name: 'Azul Royal', pattern: /\b(azul\s*royal|royal)\b/i },
  { name: 'Preto', pattern: /\b(preto|preta|pret|blk|black)\b/i },
  { name: 'Branco', pattern: /\b(branco|branca|wht|white)\b/i },
  { name: 'Marrom', pattern: /\b(marrom|castanho|brown)\b/i },
  { name: 'Azul', pattern: /\b(azul|blue)\b/i },
  { name: 'Vermelho', pattern: /\b(vermelho|vermelha|red)\b/i },
  { name: 'Verde', pattern: /\b(verde|green)\b/i },
  { name: 'Cinza', pattern: /\b(cinza|grey|gray)\b/i },
  { name: 'Rosa', pattern: /\b(rosa|pink)\b/i },
  { name: 'Amarelo', pattern: /\b(amarelo|amarela|yellow)\b/i },
  { name: 'Roxo', pattern: /\b(roxo|roxa|purple)\b/i },
  { name: 'Laranja', pattern: /\b(laranja|orange)\b/i },
  { name: 'Vinho', pattern: /\b(vinho|bordo|burgundy)\b/i },
  { name: 'Bege', pattern: /\b(bege|beige)\b/i },
  { name: 'Lilás', pattern: /\b(lilas|lilás)\b/i },
  { name: 'Nude', pattern: /\b(nude)\b/i },
  { name: 'Grafite', pattern: /\b(grafite)\b/i },
  { name: 'Coral', pattern: /\b(coral)\b/i },
  { name: 'Turquesa', pattern: /\b(turquesa)\b/i },
  { name: 'Terracota', pattern: /\b(terracota)\b/i }
];

function getItemDisplaySize(item: any): string {
  if (!item) return 'Tamanho não informado';

  const desc = (item.description || item.descricao || '').toString().trim();
  const sku = (item.sku || item.codigo || '').toString().trim();
  const text = `${desc} ${sku}`;

  const adultMatch = text.match(/(?:^|[\s\-\–\/\|_,])(G5|G4|G3|G2|G1|XGG|EXG|XXL|GG|PP|P|M|G)(?:[\s\-\–\/\|_,]|$)/i);
  if (adultMatch) {
    return adultMatch[1].toUpperCase();
  }

  const skuMatch = sku.match(/-(G5|G4|G3|G2|G1|XGG|EXG|XXL|GG|PP|P|M|G|16|14|12|10|8|6|4|2|1)$/i);
  if (skuMatch) {
    return skuMatch[1].toUpperCase();
  }

  const childExplicitMatch = text.match(/\b(?:tam|tamanho|inf|infantil|tam\.)\s*[:\-–]?\s*(16|14|12|10|8|6|4|2|1)\b/i);
  if (childExplicitMatch) {
    return childExplicitMatch[1];
  }

  const childEndMatch = text.match(/(?:–|-|\/)\s*(16|14|12|10|8|6|4|2|1)\s*$/i);
  if (childEndMatch) {
    return childEndMatch[1];
  }

  if (/\b(?:infantil|inf|criança|kids)\b/i.test(text)) {
    const childNumberMatch = text.match(/\b(16|14|12|10|8|6|4|2|1)\b/);
    if (childNumberMatch) {
      return childNumberMatch[1];
    }
  }

  const rawSize = (item.size || item.tamanho || item.variacao?.tamanho || item.grade?.tamanho || '').toString().trim();
  const isMaterialOrTrash = /dry\s*fit|dry\s*comfort|poliamida|algod[aã]o|camiseta|vestu[aá]rio/i.test(rawSize);

  if (rawSize && !isMaterialOrTrash) {
    const normRaw = rawSize.toUpperCase();
    if (ADULT_SIZES.includes(normRaw) || CHILD_SIZES.includes(normRaw)) {
      return normRaw;
    }
    if (normRaw === 'ÚNICO' || normRaw === 'UNICO' || normRaw === 'TU' || normRaw === 'TAMANHO ÚNICO') {
      return 'Único';
    }
    if (normRaw !== 'TAMANHO NÃO INFORMADO') {
      return normRaw;
    }
  }

  if (/\b(tamanho\s*únic[oa]|tamanho\s*unico|tam\.\s*único|único|unica|tu)\b/i.test(text)) {
    return 'Único';
  }

  return 'Tamanho não informado';
}

function extractItemDetails(item: any, defaultProductType: string = 'Vestuário'): {
  product_type: string;
  fabric: string;
  color: string;
  size: string;
  description: string;
  sku: string;
  item_key: string;
  is_complete: boolean;
  tipo_tecido: 'TUBULAR' | 'RAMADO';
  largura_util: string;
  lote?: string;
  orientacao?: string;
  missing_fields: string[];
} {
  if (!item || typeof item !== 'object') {
    return {
      product_type: 'Modelo não informado',
      fabric: 'Tecido não informado',
      color: 'Cor não informada',
      size: 'Tamanho não informado',
      description: 'Item sem descrição',
      sku: '',
      item_key: 'Modelo não informado | Tecido não informado | Cor não informada | Tamanho não informado',
      is_complete: false,
      tipo_tecido: 'RAMADO',
      largura_util: '1,60 m',
      missing_fields: ['Tecido', 'Cor']
    };
  }
  const rawDesc = (item.description || item.descricao || '').toString().trim();
  const rawSku = (item.sku || item.codigo || '').toString().trim();

  // 1. Extração ESTRITA do TECIDO técnico (sem adivinhar pelo texto se ausente)
  const rawFabric = (item.fabric || item.tecido || item.variacao?.tecido || item.grade?.tecido || item.atributos?.tecido || '').toString().trim();
  let fabric = 'Tecido não informado';
  if (rawFabric && !/^(tecido\s+)?n[aã]o\s+informad[ao]$/i.test(rawFabric)) {
    if (/dry\s*comfort/i.test(rawFabric)) fabric = 'Dry Comfort';
    else if (/dry\s*fit/i.test(rawFabric)) fabric = 'Dry Fit';
    else if (/poliamida/i.test(rawFabric)) fabric = 'Poliamida';
    else if (/algod[aã]o/i.test(rawFabric)) fabric = 'Algodão';
    else if (/piquet|pique/i.test(rawFabric)) fabric = 'Piquet';
    else if (/pv\b/i.test(rawFabric)) fabric = 'PV';
    else fabric = rawFabric;
  }

  // 2. Extração ESTRITA da COR técnica (sem adivinhar pelo texto se ausente)
  const rawColor = (item.color || item.cor || item.variacao?.cor || item.grade?.cor || item.atributos?.cor || '').toString().trim();
  let color = 'Cor não informada';
  if (rawColor && !/^(cor\s+)?n[aã]o\s+informad[ao]$/i.test(rawColor)) {
    const matchCat = COLOR_PATTERNS.find(c => c.pattern.test(rawColor));
    color = matchCat ? matchCat.name : rawColor;
  }

  let size = getItemDisplaySize(item);
  if (!size) size = 'Tamanho não informado';

  let productType = item.product_type || item.modelo;
  if (!productType) {
    if (/recorte/i.test(rawDesc)) productType = 'Camiseta com Recorte';
    else if (/oversized/i.test(rawDesc)) productType = 'Camiseta Oversized';
    else if (/raglan/i.test(rawDesc)) productType = 'Camiseta Raglan';
    else if (/gola\s*v/i.test(rawDesc)) productType = 'Camiseta Gola V';
    else if (/longline/i.test(rawDesc)) productType = 'Camiseta Longline';
    else if (/babylook|baby-look/i.test(rawDesc)) productType = 'Babylook';
    else if (/regata\s+nadador/i.test(rawDesc)) productType = 'Regata Nadador';
    else if (/regata/i.test(rawDesc)) productType = 'Regata';
    else if (/polo/i.test(rawDesc)) productType = 'Polo';
    else if (/moletom/i.test(rawDesc)) productType = 'Moletom';
    else if (/top\s+nadador/i.test(rawDesc)) productType = 'Top Nadador';
    else if (/top/i.test(rawDesc)) productType = 'Top';
    else if (/legging/i.test(rawDesc)) productType = 'Legging';
    else if (/b[aá]sica/i.test(rawDesc)) productType = 'Camiseta Básica';
    else if (rawDesc) {
      let clean = rawDesc
        .replace(/(?:–|-|\/|\|)\s*(AZUL\s*MARINHO|VERDE\s*MENTA|CINZA\s*MESCLA|OFF\s*WHITE|PRETO|BRANCO|MARROM|AZUL|VERMELHO|VERDE|CINZA|ROSA|AMARELO|ROXO|LARANJA|VINHO|BEGE|GRAFITE)\b/gi, '')
        .replace(/(?:–|-|\/|\|)\s*(G5|G4|G3|G2|G1|EXG|XXL|XGG|GG|G|M|P|PP|16|14|12|10|8|6|4|2|1)\b/gi, '')
        .replace(/\b(?:tam|tamanho|infantil)\s*[:\-–]?\s*(16|14|12|10|8|6|4|2|1)\b/gi, '')
        .replace(/(?:–|-|\/|\|)?\s*(DRY\s*FIT|DRY\s*COMFORT|POLIAMIDA|ALGOD[AÃ]O|PIQUET|PV)\b/gi, '')
        .replace(/\b(PRETO|BRANCO|MARROM|AZUL\s*MARINHO|AZUL|VERMELHO|VERDE|CINZA|ROSA|AMARELO|ROXO|LARANJA|VINHO)\b/gi, '')
        .replace(/[\-\–\/,\|\s]+$/, '').trim();
      productType = clean || defaultProductType || 'Modelo não informado';
    } else { productType = 'Modelo não informado'; }
  }

  // 5. Características físicas de corte (Tipo físico e Largura útil)
  let tipo_tecido: 'TUBULAR' | 'RAMADO' = 'RAMADO';
  const rawTipo = (item.tipo_tecido || item.tipoTecido || item.tipo_corte || '').toString().trim().toUpperCase();
  if (rawTipo.includes('TUBULAR') || rawTipo.includes('TUBOLAR')) {
    tipo_tecido = 'TUBULAR';
  } else if (rawTipo.includes('RAMADO')) {
    tipo_tecido = 'RAMADO';
  }

  let largura_util = (item.largura_util || item.largura || '1,60 m').toString().trim();
  if (!largura_util.includes('m') && !largura_util.includes('cm')) {
    largura_util = `${largura_util} m`;
  }

  const lote = (item.lote || item.tonalidade || '').toString().trim() || undefined;
  const orientacao = (item.orientacao || item.sentido || '').toString().trim() || undefined;

  const missing_fields: string[] = [];
  if (fabric === 'Tecido não informado') missing_fields.push('Tecido');
  if (color === 'Cor não informada') missing_fields.push('Cor');

  const description = rawDesc || `${productType} ${fabric} ${color}`;
  const item_key = `${productType} | ${fabric} | ${color} | ${size}`;
  const is_complete = productType !== 'Modelo não informado' && fabric !== 'Tecido não informado' && color !== 'Cor não informada' && size !== 'Tamanho não informado';
  return { product_type: productType, fabric, color, size, description, sku: rawSku, item_key, is_complete, tipo_tecido, largura_util, lote, orientacao, missing_fields };
}

// ============================================================================
// NORMALIZAÇÃO UTF-8 E RESOLUÇÃO CANÔNICA DE ETAPAS (SLUG ESTÁVEL)
// ============================================================================
export function normalizeUtf8Text(input: any): string {
    if (input === null || input === undefined) return '';
    let str = String(input);
    if (!/[\u00C3\u00C2\u00E2\u251C]/.test(str)) return str;
    const replacements: [string, string][] = [
        ['\u00C3\u00A7\u00C3\u00A3o', 'ção'],
        ['\u00C3\u00A7\u00C3\u00B5es', 'ções'],
        ['\u00C3\u00A3o', 'ão'],
        ['\u00C3\u00B5es', 'ões'],
        ['\u00C3\u00A1', 'á'],
        ['\u00C3\u00A9', 'é'],
        ['\u00C3\u00AD', 'í'],
        ['\u00C3\u00B3', 'ó'],
        ['\u00C3\u00BA', 'ú'],
        ['\u00C3\u00AA', 'ê'],
        ['\u00C3\u00B4', 'ô'],
        ['\u00C3\u00A3', 'ã'],
        ['\u00C3\u00A7', 'ç'],
        ['\u00C3\u0161', 'Ú'],
        ['\u00C3\u0192', 'Ã'],
        ['\u00C3\u2021', 'Ç'],
        ['\u00C3\u2030', 'É'],
        ['\u00C3\u201C', 'Ó'],
        ['\u00E2\u20AC\u00A2', '•'],
        ['\u00E2\u20AC\u201C', '–'],
        ['\u00E2\u20AC\u201D', '—'],
    ];
    for (const [bad, good] of replacements) {
        str = str.split(bad).join(good);
    }
    return str;
}

export function getStageSlug(stage: any): string {
    if (!stage) return '';
    if (stage.code && typeof stage.code === 'string' && stage.code.trim()) {
        return stage.code.toUpperCase().trim();
    }
    if (stage.slug && typeof stage.slug === 'string' && stage.slug.trim()) {
        return stage.slug.toUpperCase().trim();
    }
    const nameStr = normalizeUtf8Text(stage.name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
    const fullStr = `${nameStr} ${normalizeUtf8Text(stage.sector_name || '')}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();

    if (nameStr.includes('FICHA') || nameStr.includes('APROVA')) return 'FICHA_APROVACAO';
    if (nameStr.includes('CORTE') || nameStr.includes('SEPARA')) return 'CORTE';
    if (nameStr.includes('SUBLIMA')) return 'SUBLIMACAO';
    if (nameStr.includes('ESTAMPA') || nameStr.includes('PRENSA')) return 'ESTAMPAGEM';
    if (nameStr.includes('SILK') || nameStr.includes('SERIGRAF')) return 'SILK';
    if (nameStr.includes('DTF')) return 'DTF';
    if (nameStr.includes('BORDADO')) return 'BORDADO';
    if (nameStr.includes('COSTURA')) return 'COSTURA';
    if (nameStr.includes('REVIS') || nameStr.includes('ACABAMENTO')) return 'REVISAO';
    if (nameStr.includes('EMBALA') || nameStr.includes('EXPEDI')) return 'EMBALAGEM';
    if (nameStr.includes('CONFER')) return 'CONFERENCIA';

    if (fullStr.includes('CORTE')) return 'CORTE';
    if (fullStr.includes('COSTURA')) return 'COSTURA';
    if (fullStr.includes('CONFER')) return 'CONFERENCIA';

    return (nameStr || fullStr).replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function isCorteStage(stage: any): boolean {
    return getStageSlug(stage) === 'CORTE';
}

export function isCosturaStage(stage: any): boolean {
    return getStageSlug(stage) === 'COSTURA';
}

export function isConferenciaStage(stage: any): boolean {
    return getStageSlug(stage) === 'CONFERENCIA';
}

export async function resolveDefaultProductionStageIds(client: any = supabaseAdmin): Promise<number[]> {
    try {
        const { data: dbStages } = await client
            .from('stages')
            .select('id, name, sector_name, active, sort_order')
            .eq('active', 1)
            .order('sort_order', { ascending: true });

        if (Array.isArray(dbStages) && dbStages.length > 0) {
            const prodStages = dbStages.filter((s: any) => !isConferenciaStage(s));
            const corte = prodStages.find((s: any) => isCorteStage(s));
            const costura = prodStages.find((s: any) => isCosturaStage(s));

            if (corte && costura) {
                return [Number(corte.id), Number(costura.id)];
            }
            if (prodStages.length > 0) {
                return prodStages.map((s: any) => Number(s.id));
            }
        }
    } catch (err) {
        console.warn('[Stages] Falha ao resolver etapas canônicas dinamicamente:', err);
    }
    return [];
}

function getOrderCuttingNeeded(order: any): number {
  if (!order || order.deleted_at || order.status === 'Cancelado' || order.status === 'Entregue') return 0;
  try {
    if (order.total_via_corte !== undefined && order.total_via_corte !== null && Number(order.total_via_corte) > 0) return Number(order.total_via_corte);
    const stagesList = Array.isArray(order.stages_status) ? order.stages_status : (typeof order.stages_status === 'string' ? JSON.parse(order.stages_status || '[]') : []);
    const corteStage = stagesList.find((s: any) => isCorteStage(s));
    if (corteStage && Number(corteStage.quantidade_pedido || 0) > 0) return Number(corteStage.quantidade_pedido);
    const itemsList = parseOrderItems(order.items);
    if (itemsList.length > 0) {
      const sumCorte = itemsList.reduce((acc: number, it: any) => {
        if (!it || typeof it !== 'object') return acc;
        const qPedida = Number(it.quantity ?? it.quantidade ?? 1);
        let cQty = it.qty_corte ?? it.total_via_corte;
        if (cQty === undefined || cQty === null) {
          if (it.stock_available !== undefined && it.stock_available !== null) cQty = Math.max(0, qPedida - Math.min(qPedida, Number(it.stock_available)));
          else if (it.qty_separacao !== undefined && it.qty_separacao !== null) cQty = Math.max(0, qPedida - Math.min(qPedida, Number(it.qty_separacao)));
          else cQty = 0;
        }
        return acc + Number(cQty);
      }, 0);
      if (sumCorte > 0) return sumCorte;
    }
    if (order.observations) {
      const match = order.observations.match(/⚠️\s*(\d+)\s*pçs?\s*sem\s*estoque/i);
      if (match) return parseInt(match[1], 10) || 0;
    }
  } catch (err) { console.warn('[API] Error in getOrderCuttingNeeded:', err); }
  return 0;
}

function aggregateCuttingDemand(orders: any[]): any[] {
  if (!Array.isArray(orders)) return [];
  const demandMap = new Map<string, any>();
  try {
    const activeOrders = orders.filter(o => o && typeof o === 'object' && !o.deleted_at && o.status !== 'Cancelado' && o.status !== 'Entregue');
    for (const order of activeOrders) {
      const orderNeededTotal = getOrderCuttingNeeded(order);
      if (orderNeededTotal <= 0) continue;
      const itemsList = parseOrderItems(order.items);
      if (itemsList.length > 0) {
        const itemNeeds: { item: any; qtyCorteNeeded: number }[] = [];
        let knownSum = 0;
        for (const item of itemsList) {
          if (!item || typeof item !== 'object') continue;
          const qPedida = Number(item.quantity ?? item.quantidade ?? 1);
          let cQty = item.qty_corte ?? item.total_via_corte;
          if (cQty === undefined || cQty === null) {
            if (item.stock_available !== undefined && item.stock_available !== null) cQty = Math.max(0, qPedida - Math.min(qPedida, Number(item.stock_available)));
            else if (item.qty_separacao !== undefined && item.qty_separacao !== null) cQty = Math.max(0, qPedida - Math.min(qPedida, Number(item.qty_separacao)));
            else cQty = 0;
          } else { cQty = Number(cQty); }
          itemNeeds.push({ item, qtyCorteNeeded: cQty });
          knownSum += cQty;
        }
        if (knownSum <= 0 && orderNeededTotal > 0) {
          if (itemsList.length === 1) { itemNeeds[0].qtyCorteNeeded = orderNeededTotal; }
          else {
            const totalOrderPieces = itemsList.reduce((acc: number, it: any) => acc + Number(it?.quantity ?? it?.quantidade ?? 1), 0) || 1;
            itemNeeds.forEach(it => { const itemQty = Number(it.item?.quantity ?? it.item?.quantidade ?? 1); it.qtyCorteNeeded = Math.round((itemQty / totalOrderPieces) * orderNeededTotal); });
          }
        }
        for (const { item, qtyCorteNeeded } of itemNeeds) {
          if (!item || qtyCorteNeeded <= 0) continue;
          const qtyAllocated = Number(item.qty_corte_allocated || 0);
          const qtyPending = Math.max(0, qtyCorteNeeded - qtyAllocated);
          if (qtyPending <= 0) continue;
          const { product_type, fabric, color, size, description, item_key, is_complete, tipo_tecido, largura_util, lote, orientacao, missing_fields } = extractItemDetails(item, order.product_type);
          if (item_key.toLowerCase().includes('dry fit única | único') || item_key.toLowerCase().includes('item | único')) continue;
          const orderDemand = { order_id: order.id, order_number: order.order_number || `PED-${order.id}`, client_name: order.client_name || 'Cliente', deadline: order.deadline || new Date().toISOString(), item_quantity: Number(item.quantity ?? item.quantidade ?? 1), qty_corte_needed: qtyCorteNeeded, qty_corte_allocated: qtyAllocated, qty_corte_pending: qtyPending };
          if (!demandMap.has(item_key)) { demandMap.set(item_key, { item_key, product_type, fabric, color, size, description, sku: item.sku || item.codigo, is_complete, tipo_tecido, largura_util, lote, orientacao, missing_fields, total_necessario: 0, pedidos_count: 0, prazo_mais_proximo: order.deadline || new Date().toISOString(), pedidos_waiting: [] }); }
          const existing = demandMap.get(item_key)!;
          existing.total_necessario += qtyPending;
          existing.pedidos_waiting.push(orderDemand);
          if (order.deadline && order.deadline < existing.prazo_mais_proximo) existing.prazo_mais_proximo = order.deadline;
        }
      } else {
        continue;
      }
    }

  } catch (err) { console.error('[API] Error in aggregateCuttingDemand:', err); }
  const result = Array.from(demandMap.values());
  for (const item of result) {
    item.pedidos_waiting.sort((a: any, b: any) => { if (a.deadline === b.deadline) return a.order_id - b.order_id; return (a.deadline || '').localeCompare(b.deadline || ''); });
    item.pedidos_count = item.pedidos_waiting.length;
    if (item.pedidos_waiting.length > 0) item.prazo_mais_proximo = item.pedidos_waiting[0].deadline;
  }
  result.sort((a: any, b: any) => (a.prazo_mais_proximo || '').localeCompare(b.prazo_mais_proximo || ''));
  return result;
}

function allocateCuttingPieces(orders: any[], targetItemKey: string, cutQty: number, operatorName: string = 'Operador', userId: number = 1, allocationLogsStore: any[] = []): any {
  if (cutQty <= 0) return { success: false, item_key: targetItemKey, total_cut: 0, total_allocated: 0, unallocated_remaining: 0, allocations: [], affected_order_ids: [] };
  const demandList = aggregateCuttingDemand(orders);
  const targetDemand = demandList.find((d: any) => d.item_key === targetItemKey);
  if (!targetDemand || targetDemand.pedidos_waiting.length === 0) return { success: false, item_key: targetItemKey, total_cut: cutQty, total_allocated: 0, unallocated_remaining: cutQty, allocations: [], affected_order_ids: [] };
  let remainingToAllocate = cutQty;
  const newLogs: any[] = [];
  const affectedOrderIdsSet = new Set<number>();
  for (const ordDemand of targetDemand.pedidos_waiting) {
    if (remainingToAllocate <= 0) break;
    const order = orders.find((o: any) => o.id === ordDemand.order_id);
    if (!order) continue;
    const allocQty = Math.min(remainingToAllocate, ordDemand.qty_corte_pending);
    if (allocQty <= 0) continue;
    const itemsList = parseOrderItems(order.items);
    if (itemsList.length > 0) {
      for (const item of itemsList) {
        const { item_key } = extractItemDetails(item, order.product_type);
        if (item_key === targetItemKey) { item.qty_corte_allocated = (item.qty_corte_allocated || 0) + allocQty; break; }
      }
      order.items = itemsList;
    }
    const stagesList = Array.isArray(order.stages_status) ? order.stages_status : (typeof order.stages_status === 'string' ? JSON.parse(order.stages_status || '[]') : []);
    const corteStage = stagesList.find((s: any) => isCorteStage(s));
    if (corteStage) {
      corteStage.quantidade_boa = (corteStage.quantidade_boa || 0) + allocQty;
      const totalReq = corteStage.quantidade_pedido || order.total_via_corte || order.quantity || 1;
      if (corteStage.quantidade_boa >= totalReq) corteStage.finished = true;
    }
    order.stages_status = stagesList;
    const logEntry = { id: Date.now() + Math.floor(Math.random() * 1000), order_id: order.id, order_number: order.order_number, item_key: targetItemKey, product_type: targetDemand.product_type, color: targetDemand.color, size: targetDemand.size, quantidade_alocada: allocQty, status: 'active', user_id: userId, user_name: operatorName, created_at: new Date().toISOString() };
    allocationLogsStore.push(logEntry);
    newLogs.push(logEntry);
    affectedOrderIdsSet.add(order.id);
    remainingToAllocate -= allocQty;
  }
  return { success: true, item_key: targetItemKey, total_cut: cutQty, total_allocated: cutQty - remainingToAllocate, unallocated_remaining: remainingToAllocate, allocations: newLogs, affected_order_ids: Array.from(affectedOrderIdsSet) };
}

function reallocateOnCancellation(cancelledOrderId: number, orders: any[], allocationLogsStore: any[]): any[] {
  const activeAllocations = allocationLogsStore.filter((l: any) => l.order_id === cancelledOrderId && l.status === 'active');
  if (activeAllocations.length === 0) return [];
  const reallocatedLogs: any[] = [];
  for (const log of activeAllocations) {
    log.status = 'released';
    const result = allocateCuttingPieces(orders, log.item_key, log.quantidade_alocada, `Sistema (Realocação de PED-${cancelledOrderId})`, 1, allocationLogsStore);
    if (result.success && result.allocations.length > 0) {
      for (const newLog of result.allocations) { newLog.status = 'reallocated'; reallocatedLogs.push(newLog); }
    }
  }
  return reallocatedLogs;
}


dotenv.config();

// ── Inline: lossStore ──────────────────────────────────────────────────────────
// (Inlined to avoid cross-file .ts import issues on Vercel @vercel/node runtime)

type OperationStatus =
  | 'AGUARDANDO'
  | 'LIBERADA'
  | 'EM_ANDAMENTO'
  | 'PAUSADA'
  | 'PARCIAL'
  | 'BLOQUEADA'
  | 'CONCLUIDA'
  | 'CANCELADA';

interface OrderStageProgress {
  id?: number;
  order_id: number;
  stage_id: number;
  quantidade_pedido: number;
  quantidade_recebida?: number;
  quantidade_boa: number;
  quantidade_perdida: number;
  quantidade_retrabalho?: number;
  quantidade_transferida?: number;
  pendencia_reposicao: number;
  saldo_pendente?: number;
  finished: boolean;
  status_operacao?: OperationStatus;
}
interface OrderLossLog {
  id?: number; order_id: number; stage_id: number; stage_name: string;
  user_id: number; user_name: string; quantidade_perdida: number; motivo: string;
  motivo_detalhe: string; etapa_reentrada_id: number; etapa_reentrada_name: string; created_at: string;
}
interface LossReasonSetting { motivo: string; etapa_reentrada_id: number; }
interface LossReportData {
  summary: { total_perdido: number; pct_perda: number; total_pedidos_com_perda: number; impacto_prazo_horas: number };
  perdas_por_setor: any[]; perdas_por_motivo: any[]; impacto_pedidos: any[];
}

function resolveOperationStatusInline(input: {
  isCancelled?: boolean;
  isBlocked?: boolean;
  finished?: boolean;
  activeExecutionStatus?: string | null;
  quantidadePedido: number;
  quantidadeRecebida?: number;
  quantidadeBoa: number;
  pendenciaReposicao?: number;
  isFirstStageInRoute: boolean;
  previousStageFinished: boolean;
  previousStageTransferredQty?: number;
  calculationType?: string;
}): OperationStatus {
  if (input.isCancelled) return 'CANCELADA';
  if (input.isBlocked) return 'BLOQUEADA';
  const targetQty = Math.max(0, Number(input.quantidadePedido) || 0);
  const goodQty = Math.max(0, Number(input.quantidadeBoa) || 0);
  const replQty = Math.max(0, Number(input.pendenciaReposicao) || 0);
  const calcType = input.calculationType || 'por_peca';

  if (input.activeExecutionStatus === 'Em andamento') return 'EM_ANDAMENTO';
  if (input.activeExecutionStatus === 'Pausado') return 'PAUSADA';

  if (calcType === 'por_pedido') {
    if (input.finished) return 'CONCLUIDA';
  } else {
    if (input.finished && replQty === 0 && (targetQty === 0 || goodQty >= targetQty)) return 'CONCLUIDA';
    if (targetQty > 0 && goodQty >= targetQty && replQty === 0) return 'CONCLUIDA';
  }

  if (goodQty > 0 && (goodQty < targetQty || replQty > 0)) return 'PARCIAL';

  const receivedFromPrev = Math.max(0, Number(input.previousStageTransferredQty) || 0);
  const explicitlyReceived = Math.max(0, Number(input.quantidadeRecebida) || 0);
  const canStart =
    input.isFirstStageInRoute ||
    input.previousStageFinished ||
    receivedFromPrev > 0 ||
    explicitlyReceived > 0;

  return canStart ? 'LIBERADA' : 'AGUARDANDO';
}

export interface OrderHistoryEntry {
  order_id: number;
  usuario?: string | null;
  acao: string;
  antes?: any;
  depois?: any;
  detalhes?: string | null;
}

export async function logOrderHistory(sb: any, entry: OrderHistoryEntry) {
  const payload = {
    order_id: entry.order_id,
    usuario: entry.usuario || 'Sistema',
    acao: entry.acao,
    antes: entry.antes ?? null,
    depois: entry.depois ?? null,
    detalhes: entry.detalhes ?? null,
    action: entry.acao,
    details: entry.detalhes || (typeof entry.depois === 'object' && entry.depois !== null ? JSON.stringify(entry.depois) : String(entry.depois ?? '')),
    created_at: new Date().toISOString(),
  };
  try {
    const { data, error } = await sb.from('order_history').insert(payload).select();
    if (error) {
      console.error('[OrderHistory] Falha ao registrar histórico do pedido:', error, payload);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error('[OrderHistory] Exceção ao gravar order_history:', err);
    return { success: false, error: err };
  }
}

export interface AuditLogParams {
  order_id?: number | null;
  stage_id?: number | null;
  user_id?: number | null;
  usuario: string;
  acao: string;
  motivo?: string | null;
  quantidade?: number | null;
  valor_anterior?: any;
  valor_novo?: any;
  observacao?: string | null;
  detalhes?: any;
  origem?: string;
  entidade?: string;
}

export async function writeAuditLogStore(
  sb: any,
  params: AuditLogParams
) {
  try {
    const valorNovoObj = {
      ...(typeof params.valor_novo === 'object' && params.valor_novo !== null ? params.valor_novo : { value: params.valor_novo }),
      stage_id: params.stage_id ?? null,
      user_id: params.user_id ?? null,
      quantidade: params.quantidade ?? null,
      motivo: params.motivo || params.observacao || null,
      observacao: params.observacao ?? null,
      origem: params.origem || 'WEB',
      timestamp_brt: new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '-03:00',
    };
    const payload: Record<string, any> = {
      entidade: params.entidade || 'orders',
      order_id: params.order_id ?? null,
      stage_id: params.stage_id ?? null,
      user_id: params.user_id ?? null,
      usuario: params.usuario || 'Sistema',
      acao: params.acao,
      quantidade: params.quantidade ?? null,
      motivo: params.motivo ?? null,
      observacao: params.observacao ?? null,
      valor_anterior: params.valor_anterior ?? null,
      valor_antigo: params.valor_anterior ?? null,
      valor_novo: valorNovoObj,
      detalhes: params.detalhes ?? null,
      origem: params.origem || 'WEB',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from('pcp_audit_log').insert(payload).select();
    if (error) {
      console.error('[AuditLog] Erro ao gravar pcp_audit_log:', error, payload);
      if (params.order_id) {
        const { error: histErr } = await logOrderHistory(sb, {
          order_id: params.order_id,
          usuario: params.usuario || 'Sistema',
          acao: params.acao,
          antes: params.valor_anterior ?? null,
          depois: valorNovoObj,
          detalhes: typeof params.detalhes === 'string' ? params.detalhes : (params.motivo || null),
        });
        if (histErr) {
          console.error('[AuditLog] Erro ao gravar order_history de fallback:', histErr);
        }
      }
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error('[AuditLog] Exceção ao gravar auditoria:', err);
    return { success: false, error: err };
  }
}

export const recordPcpAuditLog = writeAuditLogStore;

async function safeUpsertOrderStageProgress(sb: any, prog: OrderStageProgress) {
  const baseRow = {
    order_id: Number(prog.order_id),
    stage_id: Number(prog.stage_id),
    quantidade_pedido: Number(prog.quantidade_pedido) || 0,
    quantidade_boa: Number(prog.quantidade_boa) || 0,
    quantidade_perdida: Number(prog.quantidade_perdida) || 0,
    pendencia_reposicao: Number(prog.pendencia_reposicao) || 0,
    finished: Boolean(prog.finished),
  };
  const extendedRow: any = {
    ...baseRow,
    ...(prog.quantidade_recebida !== undefined ? { quantidade_recebida: Number(prog.quantidade_recebida) } : {}),
    ...(prog.quantidade_retrabalho !== undefined ? { quantidade_retrabalho: Number(prog.quantidade_retrabalho) } : {}),
    ...(prog.quantidade_transferida !== undefined ? { quantidade_transferida: Number(prog.quantidade_transferida) } : {}),
    ...(prog.status_operacao !== undefined ? { status_operacao: prog.status_operacao } : {}),
  };
  const { error } = await sb.from('order_stage_progress').upsert(extendedRow, { onConflict: 'order_id,stage_id' });
  if (error) {
    await sb.from('order_stage_progress').upsert(baseRow, { onConflict: 'order_id,stage_id' });
  }
}

function _getDefaultLossReasons(stages: { id: number; name: string; sort_order?: number }[]): LossReasonSetting[] {
  const find = (name: string, fb: number) => stages.find(s => s.name.toLowerCase().trim() === name.toLowerCase().trim())?.id ?? fb;
  const sorted = [...stages].sort((a, b) => (a.sort_order||0)-(b.sort_order||0));
  const first = sorted[0]?.id ?? 1;
  const dtf = find('DTF', first);
  const conf = find('Conferência', dtf);
  return [
    { motivo: 'Falta de matéria-prima/peça (estoque)', etapa_reentrada_id: first },
    { motivo: 'Defeito na peça base', etapa_reentrada_id: first },
    { motivo: 'Falha na estampa/DTF', etapa_reentrada_id: dtf },
    { motivo: 'Mancha ou avaria no processo', etapa_reentrada_id: dtf },
    { motivo: 'Extravio', etapa_reentrada_id: first },
    { motivo: 'Reprovado na conferência (qualidade)', etapa_reentrada_id: conf },
    { motivo: 'Outro', etapa_reentrada_id: first },
  ];
}

function _calculateLossReport(lossLogs: OrderLossLog[], orders: any[]=[], stages: any[]=[]): LossReportData {
  const stageMap = new Map<number, string>(); stages.forEach(s => stageMap.set(s.id, s.name));
  const totalLost = lossLogs.reduce((s, l) => s + (l.quantidade_perdida||0), 0);
  const sectorMap = new Map<number, any>(); const reasonMap = new Map<string, any>(); const orderLostMap = new Map<number, number>();
  lossLogs.forEach(log => {
    const sn = log.stage_name || stageMap.get(log.stage_id) || `Etapa #${log.stage_id}`;
    const sec = sectorMap.get(log.stage_id) || { stage_name: sn, lost: 0, orderIds: new Set() };
    sec.lost += log.quantidade_perdida; sec.orderIds.add(log.order_id); sectorMap.set(log.stage_id, sec);
    const rk = `${log.motivo}|${sn}`; const r = reasonMap.get(rk) || { motivo: log.motivo, stage_name: sn, lost: 0 };
    r.lost += log.quantidade_perdida; reasonMap.set(rk, r);
    orderLostMap.set(log.order_id, (orderLostMap.get(log.order_id)||0) + log.quantidade_perdida);
  });
  const perdas_por_setor = Array.from(sectorMap.entries()).map(([sid, v]) => ({ stage_id: sid, stage_name: v.stage_name, quantidade_perdida: v.lost, pct_total: totalLost>0?Math.round(v.lost/totalLost*1000)/10:0, pedidos_afetados: v.orderIds.size })).sort((a,b)=>b.quantidade_perdida-a.quantidade_perdida);
  const perdas_por_motivo = Array.from(reasonMap.values()).map(v => ({ motivo: v.motivo, stage_name: v.stage_name, quantidade_perdida: v.lost, pct_total: totalLost>0?Math.round(v.lost/totalLost*1000)/10:0 })).sort((a,b)=>b.quantidade_perdida-a.quantidade_perdida);
  const owl = orders.filter(o => orderLostMap.has(o.id)); const nwl = orders.filter(o => !orderLostMap.has(o.id) && o.total_time_seconds>0);
  const avg = nwl.length>0?nwl.reduce((s,o)=>s+o.total_time_seconds,0)/nwl.length:0;
  const impacto_pedidos = owl.map(o => { const a=Math.round(o.total_time_seconds/3600*10)/10,b=Math.round(avg/3600*10)/10; return { order_id:o.id, order_number:o.order_number, client_name:o.client_name, quantidade_perdida:orderLostMap.get(o.id)||0, lead_time_com_perda_horas:a, lead_time_medio_sem_perda_horas:b, atraso_adicional_horas:Math.max(0,Math.round((a-b)*10)/10) }; });
  const ttp = orders.reduce((s,o)=>s+(o.quantity||0),0);
  return { summary: { total_perdido:totalLost, pct_perda:ttp>0?Math.round(totalLost/ttp*1000)/10:0, total_pedidos_com_perda:orderLostMap.size, impacto_prazo_horas:impacto_pedidos.length>0?Math.round(impacto_pedidos.reduce((s,i)=>s+i.atraso_adicional_horas,0)/impacto_pedidos.length*10)/10:0 }, perdas_por_setor, perdas_por_motivo, impacto_pedidos };
}

async function getLossReasons(sb: any): Promise<LossReasonSetting[]> {
  try {
    const { data } = await sb.from('loss_reason_settings').select('*').order('id', { ascending: true });
    if (data && data.length > 0) return data;
  } catch (err) {
    console.warn('[LossReasons] Aviso ao buscar loss_reason_settings:', err);
  }
  let stagesData: any[] = [];
  try {
    const { data } = await sb.from('stages').select('id, name, sort_order').eq('active', 1);
    if (data) stagesData = data;
  } catch (err) {
    console.warn('[LossReasons] Aviso ao buscar stages:', err);
  }
  const defaults = _getDefaultLossReasons(
    stagesData.length > 0
      ? stagesData
      : [
          { id: 1, name: 'Ficha de aprovação', sort_order: 1 },
          { id: 5, name: 'DTF', sort_order: 7 },
          { id: 8, name: 'Conferência', sort_order: 13 },
        ]
  );
  try {
    await sb.from('loss_reason_settings').upsert(defaults);
  } catch (err) {
    console.warn('[LossReasons] Aviso ao upsert defaults:', err);
  }
  return defaults;
}

async function updateLossReasons(sb: any, settings: LossReasonSetting[]) {
  try {
    await sb.from('loss_reason_settings').delete().gt('id', 0);
    const { data } = await sb.from('loss_reason_settings').insert(settings).select('*');
    if (data && data.length > 0) return data;
  } catch (err) {
    console.warn('[LossReasons] Falha no delete/insert, tentando upsert:', err);
    try {
      await sb.from('loss_reason_settings').upsert(settings);
    } catch (upsertErr) {
      console.warn('[LossReasons] Aviso ao upsert settings:', upsertErr);
    }
  }
  return settings;
}

async function getStageProgressForOrder(sb: any, orderId: number, orderData?: any): Promise<OrderStageProgress[]> {
  const order = orderData || (await sb.from('orders').select('*').eq('id', orderId).single()).data;
  if (!order) return [];
  const rawRequiredStages: number[] = Array.isArray(order.required_stages) ? order.required_stages : [];
  const requiredStages = rawRequiredStages.map((id: any) => Number(id));
  const stagesStatus: any[] = Array.isArray(order.stages_status) ? order.stages_status : [];

  const [progRes, execRes] = await Promise.all([
    sb.from('order_stage_progress').select('*').eq('order_id', orderId),
    sb.from('stage_executions').select('stage_id, status').eq('order_id', orderId).in('status', ['Em andamento', 'Pausado']),
  ]);

  const dbProgMap = new Map<number, any>();
  (progRes.data || []).forEach((p: any) => {
    dbProgMap.set(Number(p.stage_id), p);
  });

  const activeExecMap = new Map<number, string>();
  (execRes.data || []).forEach((e: any) => {
    activeExecMap.set(Number(e.stage_id), e.status);
  });

  const isOrderCancelled = order.status === 'Cancelado' || Boolean(order.deleted_at);
  const isOrderBlocked = Boolean(order.pcp_is_blocked);

  const result: OrderStageProgress[] = [];
  for (let idx = 0; idx < requiredStages.length; idx++) {
    const stageId = Number(requiredStages[idx]);
    const st = stagesStatus.find((s: any) => Number(s.id) === stageId);
    const existing = dbProgMap.get(stageId);
    const defaultQty = Number(order.quantity) || 0;
    const isFinished = existing
      ? Boolean(
          existing.finished ||
            existing.status_operacao === 'CONCLUIDA' ||
            (defaultQty > 0 && Number(existing.quantidade_boa) >= defaultQty && !(Number(existing.pendencia_reposicao) > 0))
        )
      : Boolean(st?.finished || st?.status === 'Concluído' || st?.status === 'Finalizado');
    const goodQty = existing
      ? Number(existing.quantidade_boa) || (isFinished ? defaultQty : 0)
      : isFinished
      ? defaultQty
      : Number(st?.quantidade_boa) || 0;
    const lostQty = existing ? Number(existing.quantidade_perdida) || 0 : Number(st?.quantidade_perdida) || 0;
    const reworkQty = existing ? Number(existing.quantidade_retrabalho) || 0 : 0;
    const replQty = existing ? Number(existing.pendencia_reposicao) || 0 : Number(st?.pendencia_reposicao) || 0;

    const prevStageProg = idx > 0 ? result[idx - 1] : null;
    const isFirstStage = idx === 0;
    const prevFinished = isFirstStage ? true : Boolean(prevStageProg?.finished);
    const prevTransferred = isFirstStage
      ? defaultQty
      : Math.max(0, Number(prevStageProg?.quantidade_transferida ?? prevStageProg?.quantidade_boa) || 0);

    const receivedQty =
      existing?.quantidade_recebida !== undefined && Number(existing.quantidade_recebida) > 0
        ? Number(existing.quantidade_recebida)
        : isFirstStage || prevFinished
        ? defaultQty
        : prevTransferred;

    const transferredQty =
      existing?.quantidade_transferida !== undefined && Number(existing.quantidade_transferida) > 0
        ? Number(existing.quantidade_transferida)
        : Math.min(defaultQty, goodQty);

    const saldoPendente = Math.max(0, defaultQty - goodQty + replQty);
    const statusOperacao = resolveOperationStatusInline({
      isCancelled: isOrderCancelled,
      isBlocked: isOrderBlocked,
      finished: isFinished,
      activeExecutionStatus: activeExecMap.get(stageId) || null,
      quantidadePedido: defaultQty,
      quantidadeRecebida: receivedQty,
      quantidadeBoa: goodQty,
      pendenciaReposicao: replQty,
      isFirstStageInRoute: isFirstStage,
      previousStageFinished: prevFinished,
      previousStageTransferredQty: prevTransferred,
      calculationType: st?.calculation_type || 'por_peca',
    });

    const progObj: OrderStageProgress = {
      order_id: orderId,
      stage_id: stageId,
      quantidade_pedido: defaultQty,
      quantidade_recebida: receivedQty,
      quantidade_boa: goodQty,
      quantidade_perdida: lostQty,
      quantidade_retrabalho: reworkQty,
      quantidade_transferida: transferredQty,
      pendencia_reposicao: replQty,
      saldo_pendente: saldoPendente,
      finished: isFinished,
      status_operacao: statusOperacao,
    };
    result.push(progObj);
  }

  return result;
}

function enrichOrdersWithProgressSync(orders: any[], dbProgressRows: any[] = [], stagesCatalog: any[] = []): any[] {
  if (!orders?.length) return orders || [];
  const dbProgByKey = new Map<string, any>();
  for (const p of dbProgressRows || []) {
    if (p && p.order_id !== undefined && p.stage_id !== undefined) {
      dbProgByKey.set(`${p.order_id}_${p.stage_id}`, p);
    }
  }
  const stageById = new Map<number, any>();
  for (const s of stagesCatalog || []) {
    if (s && s.id !== undefined) {
      stageById.set(Number(s.id), s);
    }
  }

  for (const order of orders) {
    if (order.status) {
      order.status = normalizeUtf8Text(order.status);
      if (order.status === 'Concluído' || order.status === 'Concluido') {
        order.status = 'Pronto';
      }
    }
    if (order.client_name) order.client_name = normalizeUtf8Text(order.client_name);
    if (order.product_type) order.product_type = normalizeUtf8Text(order.product_type);
    if (order.print_type) order.print_type = normalizeUtf8Text(order.print_type);

    if (!Array.isArray(order.stages_status)) order.stages_status = [];
    if (Array.isArray(order.required_stages)) {
      order.required_stages = order.required_stages.map((id: any) => Number(id));
    }

    // Se stages_status estiver vazio mas required_stages tiver etapas, constrói stages_status canônico
    if (order.stages_status.length === 0 && Array.isArray(order.required_stages) && order.required_stages.length > 0) {
      order.stages_status = order.required_stages.map((sId: number) => {
        const sMeta = stageById.get(Number(sId));
        return {
          id: Number(sId),
          name: normalizeUtf8Text(sMeta?.name || `Etapa #${sId}`),
          slug: sMeta ? getStageSlug(sMeta) : undefined,
          calculation_type: sMeta?.calculation_type || 'por_peca',
          finished: false,
        };
      });
    }

    const qty = Number(order.quantity) || 0;
    const isCancelled = order.status === 'Cancelado' || Boolean(order.deleted_at);
    const isBlocked = Boolean(order.pcp_is_blocked);
    const filteredStages = order.stages_status;

    let prevFinished = true;
    let prevTransferredQty = qty;

    order.stages_status = filteredStages.map((st: any, idx: number) => {
      const stageId = Number(st.id);
      const sMeta = stageById.get(stageId);
      const key = `${order.id}_${stageId}`;
      const existingProg = dbProgByKey.get(key);
      const targetQty = Number(existingProg?.quantidade_pedido) || qty;
      const isFinished = existingProg
        ? Boolean(
            existingProg.finished ||
              existingProg.status_operacao === 'CONCLUIDA' ||
              (targetQty > 0 && Number(existingProg.quantidade_boa) >= targetQty && !(Number(existingProg.pendencia_reposicao) > 0))
          )
        : Boolean(st.finished || st.status === 'Concluído' || st.status === 'Finalizado');
      const prog: any = existingProg
        ? {
            ...existingProg,
            quantidade_pedido: targetQty,
            finished: isFinished,
            quantidade_boa:
              isFinished && !existingProg.quantidade_boa
                ? targetQty
                : Number(existingProg.quantidade_boa) || 0,
          }
        : {
            order_id: order.id,
            stage_id: stageId,
            quantidade_pedido: qty,
            quantidade_boa: isFinished ? qty : Number(st.quantidade_boa) || 0,
            quantidade_perdida: Number(st.quantidade_perdida) || 0,
            pendencia_reposicao: Number(st.pendencia_reposicao) || 0,
            finished: isFinished,
          };

      const goodQty = Number(prog.quantidade_boa) || 0;
      const lostQty = Number(prog.quantidade_perdida) || 0;
      const replQty = Number(prog.pendencia_reposicao) || 0;
      const receivedQty =
        prog.quantidade_recebida !== undefined && Number(prog.quantidade_recebida) > 0
          ? Number(prog.quantidade_recebida)
          : idx === 0 || prevFinished
          ? qty
          : prevTransferredQty;
      const transferredQty =
        prog.quantidade_transferida !== undefined && Number(prog.quantidade_transferida) > 0
          ? Number(prog.quantidade_transferida)
          : Math.min(qty, goodQty);
      const saldoPendente = Math.max(0, (prog.quantidade_pedido || qty) - goodQty + replQty);

      const statusOperacao = resolveOperationStatusInline({
        isCancelled,
        isBlocked,
        finished: isFinished,
        activeExecutionStatus: st.in_progress ? 'Em andamento' : null,
        quantidadePedido: prog.quantidade_pedido || qty,
        quantidadeRecebida: receivedQty,
        quantidadeBoa: goodQty,
        pendenciaReposicao: replQty,
        isFirstStageInRoute: idx === 0,
        previousStageFinished: prevFinished,
        previousStageTransferredQty: prevTransferredQty,
        calculationType: st.calculation_type || sMeta?.calculation_type || 'por_peca',
      });

      prevFinished = isFinished;
      prevTransferredQty = transferredQty;

      return {
        ...st,
        name: normalizeUtf8Text(st.name || sMeta?.name || `Etapa #${stageId}`),
        slug: st.slug || (sMeta ? getStageSlug(sMeta) : getStageSlug(st)),
        finished: isFinished,
        status_operacao: statusOperacao,
        quantidade_boa: goodQty,
        quantidade_concluida: goodQty,
        quantidade_perdida: lostQty,
        quantidade_recebida: receivedQty,
        quantidade_transferida: transferredQty,
        pendencia_reposicao: replQty,
        saldo_pendente: saldoPendente,
        saldo_restante: saldoPendente,
        quantidade_pedido: prog.quantidade_pedido || qty,
        quantidade_prevista: prog.quantidade_pedido || qty,
      };
    });
  }
  return orders;
}

async function validateStageFinish(sb: any, orderId: number, stageId: number) {
  const si = (await sb.from('stages').select('name, calculation_type').eq('id', stageId).single()).data;
  if (si?.calculation_type === 'por_pedido') return { canFinish: true };
  const prog = (await getStageProgressForOrder(sb, orderId)).find((p: any) => Number(p.stage_id) === Number(stageId));
  if (!prog || (prog.quantidade_boa >= prog.quantidade_pedido && (prog.pendencia_reposicao || 0) === 0)) {
    return { canFinish: true, progress: prog };
  }
  const remaining = Math.max(0, prog.quantidade_pedido - prog.quantidade_boa + (prog.pendencia_reposicao || 0));
  return {
    canFinish: false,
    remaining,
    progress: prog,
    message: `A etapa '${si?.name || stageId}' possui produção parcial (${prog.quantidade_boa}/${prog.quantidade_pedido} boas, saldo pendente: ${remaining}). Ela será mantida como PARCIAL até completar o saldo.`,
  };
}

async function getLossReportDataStore(sb: any, startDate?: string, endDate?: string) {
  let query = sb.from('order_loss_logs').select('*').order('created_at', { ascending: false });
  if (startDate) query = query.gte('created_at', new Date(startDate).toISOString());
  if (endDate) {
    const endObj = new Date(endDate);
    if (endDate.length <= 10) endObj.setUTCHours(23, 59, 59, 999);
    query = query.lte('created_at', endObj.toISOString());
  }
  const [logsRes, ordersRes, stagesRes] = await Promise.all([
    query,
    sb.from('orders').select('id, order_number, client_name, total_time_seconds, status, quantity'),
    sb.from('stages').select('id, name'),
  ]);
  return _calculateLossReport(logsRes.data || [], ordersRes.data || [], stagesRes.data || []);
}

async function getProgressLogs(sb: any) {
  const { data } = await sb.from('order_progress_logs').select('*').order('created_at', { ascending: false });
  return data || [];
}

// ── Inline: timerUtils ─────────────────────────────────────────────────────
interface PauseRecord { id?: number; execution_id?: number; start_pause: string; end_pause?: string | null; duration_seconds?: number | null; }
interface ExecutionRecord { id?: number; start_time: string; end_time?: string | null; status: 'Em andamento' | 'Pausado' | 'Finalizado'; total_time_seconds?: number; pauses?: PauseRecord[]; }
interface CalculatedTimes { totalAccumulatedSeconds: number; currentSessionSeconds: number; isPaused: boolean; }

function calculateExecutionTimes(execution: ExecutionRecord, pauses: PauseRecord[] = [], nowMs: number = Date.now()): CalculatedTimes {
    if (!execution || !execution.start_time) return { totalAccumulatedSeconds: 0, currentSessionSeconds: 0, isPaused: false };
    const startTimeMs = new Date(execution.start_time).getTime();
    const allPauses = pauses && pauses.length > 0 ? pauses : (execution.pauses || []);
    let completedPauseSeconds = 0; let openPause: PauseRecord | null = null; const completedEndPauseTimes: number[] = [];
    for (const p of allPauses) {
        if (p.duration_seconds !== null && p.duration_seconds !== undefined && p.end_pause) { completedPauseSeconds += Math.max(0, p.duration_seconds); completedEndPauseTimes.push(new Date(p.end_pause).getTime()); }
        else if (p.end_pause === null || p.end_pause === undefined) { openPause = p; }
        else if (p.start_pause && p.end_pause) { const dur = Math.max(0, Math.floor((new Date(p.end_pause).getTime() - new Date(p.start_pause).getTime()) / 1000)); completedPauseSeconds += dur; completedEndPauseTimes.push(new Date(p.end_pause).getTime()); }
    }
    const isPaused = execution.status === 'Pausado' || openPause !== null;
    if (execution.status === 'Finalizado') { let ft = execution.total_time_seconds; if (ft === undefined || ft === null) { const endMs = execution.end_time ? new Date(execution.end_time).getTime() : nowMs; ft = Math.max(0, Math.floor((endMs - startTimeMs) / 1000) - completedPauseSeconds); } return { totalAccumulatedSeconds: Math.max(0, Math.floor(ft)), currentSessionSeconds: 0, isPaused: false }; }
    if (isPaused) { const psMs = openPause && openPause.start_pause ? new Date(openPause.start_pause).getTime() : nowMs; const gross = Math.max(0, Math.floor((psMs - startTimeMs) / 1000)); return { totalAccumulatedSeconds: Math.max(0, gross - completedPauseSeconds), currentSessionSeconds: 0, isPaused: true }; }
    const grossElapsed = Math.max(0, Math.floor((nowMs - startTimeMs) / 1000));
    const totalAccumulatedSeconds = Math.max(0, grossElapsed - completedPauseSeconds);
    let currentSessionStartMs = startTimeMs;
    if (completedEndPauseTimes.length > 0) { const latestEndPauseMs = Math.max(...completedEndPauseTimes); if (latestEndPauseMs > startTimeMs) currentSessionStartMs = latestEndPauseMs; }
    return { totalAccumulatedSeconds, currentSessionSeconds: Math.max(0, Math.floor((nowMs - currentSessionStartMs) / 1000)), isPaused: false };
}

// ── Inline: goalsUtils ─────────────────────────────────────────────────────
interface ExecutionActivity { user_id: number; stage_id: number; end_time: string; quantity: number; }
interface GoalConfig { stage_id: number; user_id?: number | null; meta_diaria: number | null; }
const GOAL_THRESHOLDS = { GREEN: 1.0, YELLOW: 0.7 };

function getGoalStatus(percentage: number | null): 'verde' | 'amarelo' | 'vermelho' | 'sem_meta' {
    if (percentage === null || percentage === undefined || isNaN(percentage)) return 'sem_meta';
    if (percentage >= GOAL_THRESHOLDS.GREEN) return 'verde';
    if (percentage >= GOAL_THRESHOLDS.YELLOW) return 'amarelo';
    return 'vermelho';
}

function calculateWorkedDays(activities: ExecutionActivity[], userId: number, startDateStr: string, endDateStr: string): number {
    const start = new Date(startDateStr); const end = new Date(endDateStr);
    const userActivities = activities.filter(act => { if (act.user_id !== userId) return false; const d = new Date(act.end_time); return d >= start && d <= end; });
    if (userActivities.length === 0) return 1;
    const activeDates = new Set<string>();
    userActivities.forEach(act => { const d = new Date(act.end_time); activeDates.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); });
    return activeDates.size;
}

function resolveGoal(stageGoalDefault: number | null | undefined, collaboratorOverrides: GoalConfig[], userId: number, stageId: number): number | null {
    const override = collaboratorOverrides.find(g => g.user_id === userId && g.stage_id === stageId);
    if (override && override.meta_diaria !== null && override.meta_diaria !== undefined) return override.meta_diaria;
    return stageGoalDefault !== undefined ? stageGoalDefault : null;
}
// ──────────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// CORS restrito aos domínios configurados (CORS_ALLOWED_ORIGINS, separados por vírgula).
// Identidade NUNCA é transmitida por headers x-user-*: somente Authorization: Bearer <JWT>.
const DEFAULT_DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];
export function getAllowedOrigins(): string[] {
    const configured = (process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim().replace(/\/+$/, ''))
        .filter(Boolean);
    if (configured.length > 0) return configured;
    return process.env.NODE_ENV === 'production' ? [] : DEFAULT_DEV_ORIGINS;
}

app.use((req, res, next) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin.replace(/\/+$/, '') : '';
    const allowed = getAllowedOrigins();
    let sameHost = false;
    try { sameHost = !!origin && new URL(origin).host === req.headers.host; } catch { sameHost = false; }
    if (origin) {
        if (!allowed.includes(origin) && !sameHost) {
            // Origem estrangeira: sem Access-Control-Allow-Origin e preflight recusado.
            if (req.method === 'OPTIONS') return res.status(403).end();
            return next();
        }
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-idempotency-key');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    next();
});

// Normalize req.url so /api/... routes match whether Vercel preserves or strips /api
app.use((req, _res, next) => {
    if (!req.url.startsWith('/api/') && req.url !== '/api') {
        req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    next();
});

const DEFAULT_SUPABASE_URL = "https://dkyvzxmocppbydtpsgyu.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXZ6eG1vY3BwYnlkdHBzZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzU0NDksImV4cCI6MjA4NzU1MTQ0OX0.2s2RJevOZr2Na0bigWqR5rxt5bNtB6GIS6-N_TlpFgk";

const isTestOrDev = process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";

const rawSupabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || (isTestOrDev ? "http://127.0.0.1:54321" : DEFAULT_SUPABASE_URL)).trim();
const supabaseUrl = (rawSupabaseUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "")) || (isTestOrDev ? "http://127.0.0.1:54321" : DEFAULT_SUPABASE_URL);
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || (isTestOrDev ? "mock-anon-key-local-only" : DEFAULT_SUPABASE_ANON_KEY)).trim();
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NODE_ENV === "test" ? "mock-service-role-key-test" : "")).trim();

if (!isTestOrDev && !supabaseServiceRoleKey) {
    console.warn("[WARN] SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente. Utilizando chave anônima como fallback seguro.");
}

export let supabase = createClient(
    supabaseUrl || "http://127.0.0.1:54321",
    supabaseAnonKey || (isTestOrDev ? "mock-anon-key-local-only" : DEFAULT_SUPABASE_ANON_KEY)
);

export let supabaseAdmin = createClient(
    supabaseUrl || "http://127.0.0.1:54321",
    supabaseServiceRoleKey || supabaseAnonKey || (isTestOrDev ? "mock-service-role-key-test" : DEFAULT_SUPABASE_ANON_KEY)
);

export function configureSupabaseClients(url: string, serviceRoleKey: string, anonKey?: string) {
    supabase = createClient(url, anonKey || supabaseAnonKey || "mock-anon-key-local-only", {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    supabaseAdmin = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

// Utilizando memória ao invés de disco local
const storage = multer.memoryStorage();
const upload = multer({ storage });

function checkError(error: any, res: express.Response, msg = "Erro interno") {
    if (error) {
        console.error(`[INTERNAL ERROR] ${msg}:`, error);
        res.status(500).json({ error: msg });
        return true;
    }
    return false;
}

// ── 6 PERFIS OFICIAIS CANÔNICOS DA FASE 1 ─────────────────────────────────────
export const CANONICAL_ROLES = [
    'Administrador',
    'PCP',
    'Supervisor',
    'Operador',
    'Comercial',
    'Visualização',
] as const;

export type CanonicalRole = typeof CANONICAL_ROLES[number];

const VALID_ADMIN_ROLES = ['Administrador'];
const VALID_PCP_SUPERVISOR_ROLES = ['Administrador', 'PCP', 'Supervisor'];
const VALID_COMMERCIAL_OR_MANAGEMENT_ROLES = ['Administrador', 'PCP', 'Supervisor', 'Comercial'];
const VALID_PRODUCTION_OPERATION_ROLES = ['Administrador', 'PCP', 'Supervisor', 'Operador'];
const VALID_AUTHENTICATED_ROLES = ['Administrador', 'PCP', 'Supervisor', 'Operador', 'Comercial', 'Visualização'];

function normalizeCanonicalRoleForAuth(rawRole?: string | null): string {
    const r = String(rawRole || '').trim().toLowerCase();
    if (!r) return '';
    if (r === 'admin' || r === 'administrador') return 'Administrador';
    if (r === 'pcp') return 'PCP';
    if (r === 'supervisor') return 'Supervisor';
    if (r === 'comercial') return 'Comercial';
    if (r.startsWith('visualiza')) return 'Visualização';
    if (r === 'operador' || r.startsWith('produ')) return 'Operador';
    return String(rawRole || '').trim();
}

// ── VALIDAÇÃO DE ASSINATURA/SEGREDO DO WEBHOOK OLIST ──────────────────────────
export function verifyOlistWebhookSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
    const configuredSecret = (process.env.OLIST_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '').trim();
    if (!configuredSecret) {
        return res.status(500).json({
            error: "Segredo do webhook Olist não configurado no backend.",
            code: "WEBHOOK_NOT_CONFIGURED"
        });
    }

    const rawHeader = req.headers['x-olist-signature'] || req.headers['x-webhook-secret'];
    const clientSecret = typeof rawHeader === 'string' ? rawHeader.trim() : '';

    if (!clientSecret) {
        return res.status(401).json({
            error: "Acesso não autorizado: cabeçalho x-olist-signature ou x-webhook-secret é obrigatório.",
            code: "WEBHOOK_UNAUTHORIZED",
        });
    }

    let isValid = false;
    try {
        const payloadStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
        const expectedHmac = crypto.createHmac('sha256', configuredSecret).update(payloadStr).digest('hex');
        const sigBuf = Buffer.from(clientSecret.toLowerCase());
        const expectedHmacBuf = Buffer.from(expectedHmac.toLowerCase());

        if (sigBuf.length === expectedHmacBuf.length && crypto.timingSafeEqual(sigBuf, expectedHmacBuf)) {
            isValid = true;
        }
    } catch {
        isValid = false;
    }

    if (!isValid) {
        try {
            const clientBuf = Buffer.from(clientSecret);
            const secretBuf = Buffer.from(configuredSecret);
            if (clientBuf.length === secretBuf.length && crypto.timingSafeEqual(clientBuf, secretBuf)) {
                isValid = true;
            }
        } catch {
            isValid = false;
        }
    }

    if (!isValid) {
        return res.status(401).json({
            error: "Acesso não autorizado ao webhook: assinatura ou segredo ausente ou inválido.",
            code: "WEBHOOK_UNAUTHORIZED",
        });
    }

    next();
}

// ── MIDDLEWARE DE AUTENTICAÇÃO REAL E MATRIZ RBAC ESTRITA ─────────────────────
async function verifyAuthAndRole(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
    allowedRoles: string[],
    forbiddenMessage: string
) {
    try {
        const authHeader = String(req.headers['authorization'] || '').trim();
        const headerRoleRaw = String(req.headers['x-user-role'] || '').trim();
        const headerUserId = req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null;
        const headerEmail = String(req.headers['x-user-email'] || '').trim();
        const headerName = String(req.headers['x-user-name'] || '').trim();
        const bodyUserId = req.body && req.body.user_id ? Number(req.body.user_id) : null;

        // 1. OBRIGATÓRIO: Header Authorization com Bearer JWT válido do Supabase
        if (!authHeader) {
            return res.status(401).json({
                error: "Não autenticado. Header Authorization com Bearer token é obrigatório.",
                code: "UNAUTHENTICATED",
            });
        }

        if (!authHeader.toLowerCase().startsWith('bearer ')) {
            return res.status(401).json({
                error: "Formato de token inválido. Esperado 'Bearer <token>'.",
                code: "INVALID_TOKEN",
            });
        }

        const token = authHeader.slice(7).trim();
        if (!token) {
            return res.status(401).json({
                error: "Token de autenticação vazio.",
                code: "INVALID_TOKEN",
            });
        }

        // Rejeição estrita de tokens legados ou inseguros
        if (token.startsWith('procomfort_uid:') || token.startsWith('insecure_') || token.startsWith('fake_')) {
            return res.status(401).json({
                error: "Token inseguro ou formato legado revogado. Autentique-se via Supabase Auth.",
                code: "INVALID_TOKEN",
            });
        }

        // 2. Validação estrita do JWT exclusivamente através do Supabase Auth
        let authData: any = null;
        let authErr: any = null;
        try {
            const res = await supabaseAdmin.auth.getUser(token);
            authData = res?.data;
            authErr = res?.error;
        } catch (e: any) {
            authErr = e;
        }

        if (!authData?.user && (supabase as any)?.auth?.getUser) {
            try {
                const mockRes = await (supabase as any).auth.getUser(token);
                if (mockRes?.data?.user) {
                    authData = mockRes.data;
                    authErr = mockRes.error;
                }
            } catch (mockAuthErr) {
                authErr = mockAuthErr;
            }
        }

        if (authErr || !authData?.user) {
            return res.status(401).json({
                error: "Token JWT inválido, revogado ou expirado.",
                code: "INVALID_TOKEN",
            });
        }

        const authUser = authData.user;
        const authUserId = authUser.id; // UUID oficial do Supabase Auth
        const authEmail = authUser.email;

        // 3. Obtenção da identidade no banco public.users
        let dbUser: any = null;
        if (authUserId) {
            try {
                const { data, error: uErr } = await supabaseAdmin
                    .from('users')
                    .select('*')
                    .eq('auth_user_id', authUserId)
                    .maybeSingle();
                if (!uErr && data) {
                    dbUser = data;
                }
            } catch {
                // Coluna auth_user_id pode ainda não existir em banco pré-migração
            }
        }

        // Fallback resiliente por e-mail (compatibilidade operacional com banco sem a migration da Fase 1)
        if (!dbUser && authEmail) {
            try {
                const { data } = await supabaseAdmin
                    .from('users')
                    .select('*')
                    .ilike('email', authEmail)
                    .maybeSingle();
                if (data) {
                    dbUser = data;
                }
            } catch (fbErr) {
                console.warn('[verifyAuthAndRole] Fallback por e-mail falhou:', fbErr);
            }
        }

        if (!dbUser) {
            return res.status(401).json({
                error: "Usuário autenticado não possui vínculo com o cadastro oficial de colaboradores.",
                code: "USER_NOT_FOUND",
            });
        }

        if (Number(dbUser.active) === 0 || dbUser.active === false) {
            return res.status(403).json({
                error: "Acesso bloqueado: conta de usuário inativa.",
                code: "USER_INACTIVE",
            });
        }

        // 4. DETECÇÃO E BLOQUEIO DE TENTATIVAS DE FALSIFICAÇÃO (ANTI-SPOOFING)
        if (headerUserId !== null && Number(headerUserId) !== Number(dbUser.id)) {
            return res.status(403).json({
                error: "Tentativa de falsificação detectada: o cabeçalho x-user-id diverge do usuário autenticado pelo token.",
                code: "IDENTITY_SPOOFING_DETECTED",
            });
        }

        if (bodyUserId !== null && Number(bodyUserId) !== Number(dbUser.id)) {
            return res.status(403).json({
                error: "Tentativa de falsificação detectada: o campo user_id no corpo diverge do usuário autenticado pelo token.",
                code: "IDENTITY_SPOOFING_DETECTED",
            });
        }

        if (headerEmail && headerEmail.toLowerCase() !== String(dbUser.email || '').toLowerCase()) {
            return res.status(403).json({
                error: "Tentativa de falsificação detectada: o cabeçalho x-user-email diverge do usuário autenticado pelo token.",
                code: "IDENTITY_SPOOFING_DETECTED",
            });
        }

        if (headerName && headerName.toLowerCase() !== String(dbUser.name || '').trim().toLowerCase()) {
            return res.status(403).json({
                error: "Tentativa de falsificação detectada: o cabeçalho x-user-name diverge do usuário autenticado pelo token.",
                code: "IDENTITY_SPOOFING_DETECTED",
            });
        }

        const dbCanonicalRole = normalizeCanonicalRoleForAuth(dbUser.role);
        const headerCanonicalRole = normalizeCanonicalRoleForAuth(headerRoleRaw);

        if (headerCanonicalRole && dbCanonicalRole && headerCanonicalRole !== dbCanonicalRole) {
            return res.status(403).json({
                error: `Tentativa de falsificação de perfil detectada: o cabeçalho x-user-role (${headerRoleRaw}) diverge do perfil oficial (${dbUser.role}).`,
                code: "ROLE_SPOOFING_DETECTED",
            });
        }

        // 5. Autoridade exclusiva do banco: a identidade fica somente em req.user
        if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
            req.body.user_id = dbUser.id;
        }
        (req as any).user = dbUser;
        (req as any).authUser = dbUser;

        // 6. Validar papel na matriz RBAC
        const canonicalAllowed = allowedRoles.map(normalizeCanonicalRoleForAuth);
        if (!canonicalAllowed.includes(dbCanonicalRole)) {
            return res.status(403).json({
                error: forbiddenMessage,
                code: "INSUFFICIENT_ROLE",
            });
        }

        next();
    } catch (err: any) {
        console.error("[AUTH] Erro ao validar permissões:", err);
        return res.status(500).json({ error: "Erro interno na validação de segurança." });
    }
}

export const VALID_AUDIT_READER_ROLES = ['Administrador', 'PCP'];

export const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) =>
    verifyAuthAndRole(req, res, next, VALID_ADMIN_ROLES, "Acesso negado. Apenas administradores podem realizar esta ação.");

export const isAuditReader = (req: express.Request, res: express.Response, next: express.NextFunction) =>
    verifyAuthAndRole(req, res, next, VALID_AUDIT_READER_ROLES, "Acesso negado. Apenas Administrador e PCP podem consultar a auditoria.");

export const isPcpOrSupervisorOrAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) =>
    verifyAuthAndRole(req, res, next, VALID_PCP_SUPERVISOR_ROLES, "Acesso negado. Ação permitida apenas para PCP, Supervisor ou Administração.");

export const isAdminOrComercial = (req: express.Request, res: express.Response, next: express.NextFunction) =>
    verifyAuthAndRole(req, res, next, VALID_COMMERCIAL_OR_MANAGEMENT_ROLES, "Acesso negado. Ação permitida apenas para Administração, PCP, Supervisor ou Comercial.");

export const VALID_ORDER_ATTACHMENT_ROLES = ['Administrador', 'PCP', 'Supervisor', 'Operador', 'Comercial'];
export const canUploadOrderImages = (req: express.Request, res: express.Response, next: express.NextFunction) =>
    verifyAuthAndRole(req, res, next, VALID_ORDER_ATTACHMENT_ROLES, "Acesso negado. Perfil sem permissão para anexar imagens ao pedido.");

export const canOperateProduction = (req: express.Request, res: express.Response, next: express.NextFunction) =>
    verifyAuthAndRole(req, res, next, VALID_PRODUCTION_OPERATION_ROLES, "Acesso negado. Seu perfil não possui permissão para executar apontamentos de produção.");

export const isAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) =>
    verifyAuthAndRole(req, res, next, VALID_AUTHENTICATED_ROLES, "Acesso negado. Login necessário.");

// ──────────────── Supabase status (health check) ────────────────────────────────────────────────────────────
export function getActorId(req: express.Request): number | null {
    const id = Number((req as any).authUser?.id ?? (req as any).user?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
}

export function getActorName(req: express.Request, fallback = "Sistema"): string {
    return String((req as any).authUser?.name ?? (req as any).user?.name ?? fallback);
}

app.get("/api/supabase/status", async (_req, res) => {
    const { error } = await supabaseAdmin
        .from("stages")
        .select("id", { count: "exact", head: true });
    if (error)
        return res.status(500).json({ status: "error", message: "Banco indisponível." });
    return res.json({ status: "success", message: "Supabase SDK funcionando!" });
});

// ── Production Utils (Centralized Finished Pieces Calculation) ────────────
interface StageInfo { id: number; name: string; sort_order: number; calculation_type: string; }

function _isValidProgressLog(log: any): boolean {
    if (!log) return false;
    if (log.invalidated_at) return false;
    const obs = String(log.observation || log.observacao || '').toUpperCase();
    if (obs.includes('[INVALIDADO') || obs.includes('[ESTORNADO')) return false;
    return Number(log.quantidade_boa_incremento) > 0;
}

function _getLastPorPecaStageId(orderRequiredStages: number[], allStages: StageInfo[]): number | null {
    if (!orderRequiredStages || orderRequiredStages.length === 0) return null;
    const stageMap = new Map<number, StageInfo>();
    allStages.forEach(s => stageMap.set(Number(s.id), s));

    const reqStages = orderRequiredStages
        .map(id => stageMap.get(Number(id)))
        .filter((s): s is StageInfo => !!s && Number(s.id) !== 12 && !isConferenciaStage(s));

    const porPecaStages = reqStages.filter(s => s.calculation_type === 'por_peca');
    if (porPecaStages.length > 0) {
        porPecaStages.sort((a, b) => a.sort_order - b.sort_order);
        return porPecaStages[porPecaStages.length - 1].id;
    }

    reqStages.sort((a, b) => a.sort_order - b.sort_order);
    return reqStages.length > 0 ? reqStages[reqStages.length - 1].id : null;
}

function _calculateFinishedPieces(
    orders: any[],
    allStages: StageInfo[],
    executions: any[],
    progressLogs: any[],
    startDateIso?: string,
    endDateIso?: string
): { totalPieces: number; totalOrders: number; orderBreakdown: Map<number, number> } {
    const activeOrdersMap = new Map<number, any>();
    orders.forEach(o => {
        if (!o.deleted_at && o.status !== 'Cancelado') {
            activeOrdersMap.set(o.id, o);
        }
    });

    const orderFinishedPieces = new Map<number, number>();
    const ordersWithValidLogs = new Set<number>();

    const isBetween = (iso: string) => {
        if (startDateIso && iso < startDateIso) return false;
        if (endDateIso && iso > endDateIso) return false;
        return true;
    };

    // 1. Check piece increment logs on the LAST productive stage (fonte primária de peças boas)
    for (const log of progressLogs) {
        if (!_isValidProgressLog(log)) continue;
        if (!log.created_at || !isBetween(log.created_at)) continue;
        const ord = activeOrdersMap.get(log.order_id);
        if (!ord) continue;

        const lastStageId = _getLastPorPecaStageId(ord.required_stages || [], allStages);
        if (Number(log.stage_id) === Number(lastStageId)) {
            ordersWithValidLogs.add(ord.id);
            const current = orderFinishedPieces.get(ord.id) || 0;
            const inc = Number(log.quantidade_boa_incremento) || 0;
            orderFinishedPieces.set(ord.id, Math.min(ord.quantity || 0, current + inc));
        }
    }

    // 2. Fallback para execuções concluídas sem log de incremento por peça
    for (const ex of executions) {
        if (ex.status !== 'Finalizado' || !ex.end_time) continue;
        if (ex.invalidated_at) continue;
        if (!isBetween(ex.end_time)) continue;

        const ord = activeOrdersMap.get(ex.order_id);
        if (!ord || ordersWithValidLogs.has(ord.id)) continue;

        const lastStageId = _getLastPorPecaStageId(ord.required_stages || [], allStages);
        if (Number(ex.stage_id) === Number(lastStageId)) {
            orderFinishedPieces.set(ord.id, Math.max(orderFinishedPieces.get(ord.id) || 0, ord.quantity || 0));
        }
    }

    // 3. Fallback for delivered orders
    for (const ord of activeOrdersMap.values()) {
        if (ord.status === 'Entregue' && ord.delivered_at && isBetween(ord.delivered_at)) {
            if (!orderFinishedPieces.has(ord.id)) {
                orderFinishedPieces.set(ord.id, ord.quantity || 0);
            }
        }
    }

    let totalPieces = 0;
    for (const qty of orderFinishedPieces.values()) {
        totalPieces += qty;
    }

    return {
        totalPieces,
        totalOrders: orderFinishedPieces.size,
        orderBreakdown: orderFinishedPieces
    };
}

function _calculateFinishedPiecesByPeriod(
    orders: any[],
    allStages: StageInfo[],
    executions: any[],
    progressLogs: any[],
    period: 'day' | 'week' | 'month',
    startDateIso?: string,
    endDateIso?: string
): { label: string; orders: number; pieces: number }[] {
    const activeOrdersMap = new Map<number, any>();
    orders.forEach(o => {
        if (!o.deleted_at && o.status !== 'Cancelado') {
            activeOrdersMap.set(o.id, o);
        }
    });

    const isBetween = (iso: string) => {
        if (startDateIso && iso < startDateIso) return false;
        if (endDateIso && iso > endDateIso) return false;
        return true;
    };

    const bucketMap = new Map<string, { ordersSet: Set<number>; pieces: number }>();

    const addToBucket = (bucketKey: string, orderId: number, pieces: number) => {
        if (!bucketMap.has(bucketKey)) {
            bucketMap.set(bucketKey, { ordersSet: new Set(), pieces: 0 });
        }
        const b = bucketMap.get(bucketKey)!;
        if (!b.ordersSet.has(orderId)) {
            b.ordersSet.add(orderId);
            b.pieces += pieces;
        }
    };

    const getBucketKey = (isoStr: string) => {
        const d = new Date(isoStr);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');

        if (period === 'day') return `${year}-${month}-${day}`;
        if (period === 'month') return `${year}-${month}`;

        const dayOfWeek = d.getUTCDay();
        const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const mon = new Date(d.getTime() - diffToMon * 24 * 60 * 60 * 1000);
        const monMonth = String(mon.getUTCMonth() + 1).padStart(2, '0');
        const monDay = String(mon.getUTCDate()).padStart(2, '0');
        return `Semana ${monDay}/${monMonth}`;
    };

    // 1. Process executions of the LAST stage
    for (const ex of executions) {
        if (ex.status !== 'Finalizado' || !ex.end_time) continue;
        if (!isBetween(ex.end_time)) continue;

        const ord = activeOrdersMap.get(ex.order_id);
        if (!ord) continue;

        const lastStageId = _getLastPorPecaStageId(ord.required_stages || [], allStages);
        if (ex.stage_id === lastStageId) {
            const key = getBucketKey(ex.end_time);
            addToBucket(key, ord.id, ord.quantity || 0);
        }
    }

    // 2. Process logs of the LAST stage
    for (const log of progressLogs) {
        if (!log.created_at || !isBetween(log.created_at)) continue;
        const ord = activeOrdersMap.get(log.order_id);
        if (!ord) continue;

        const lastStageId = _getLastPorPecaStageId(ord.required_stages || [], allStages);
        if (log.stage_id === lastStageId) {
            const key = getBucketKey(log.created_at);
            addToBucket(key, ord.id, log.quantidade_boa_incremento || ord.quantity || 0);
        }
    }

    // 3. Fallback for delivered orders
    for (const ord of activeOrdersMap.values()) {
        if (ord.status === 'Entregue' && ord.delivered_at && isBetween(ord.delivered_at)) {
            const key = getBucketKey(ord.delivered_at);
            addToBucket(key, ord.id, ord.quantity || 0);
        }
    }

    const result: { label: string; orders: number; pieces: number }[] = [];
    const sortedKeys = Array.from(bucketMap.keys()).sort();
    for (const key of sortedKeys) {
        const b = bucketMap.get(key)!;
        result.push({
            label: key,
            orders: b.ordersSet.size,
            pieces: b.pieces
        });
    }

    return result;
}

// ── Dashboard Stats ───────────────────────────────────────────────────────
app.get("/api/dashboard/stats", async (req, res) => {
    const { startDate, endDate, product_type, print_type } = req.query;
    const { data, error } = await supabaseAdmin.rpc("get_dashboard_stats_v2", {
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_product_type: product_type || null,
        p_print_type: print_type || null,
    });
    if (checkError(error, res, "Erro no dashboard")) return;

    if (data && data.metrics) {
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const todayStartIso = `${todayStr}T00:00:00.000Z`;
            const todayEndIso = `${todayStr}T23:59:59.999Z`;

            const [ordersRes, stagesRes, execsRes, logsRes] = await Promise.all([
                supabaseAdmin.from("orders").select("id, quantity, required_stages, status, created_at, delivered_at, deleted_at"),
                supabaseAdmin.from("stages").select("id, name, sort_order, calculation_type"),
                supabaseAdmin.from("stage_executions").select("id, order_id, stage_id, end_time, status").eq("status", "Finalizado").gte("end_time", todayStartIso),
                supabaseAdmin.from("order_progress_logs").select("id, order_id, stage_id, quantidade_boa_incremento, created_at").gte("created_at", todayStartIso)
            ]);

            const orders = ordersRes.data || [];
            const stages = stagesRes.data || [];
            const execs = execsRes.data || [];
            const logs = logsRes.data || [];

            const todayCalc = _calculateFinishedPieces(orders, stages, execs, logs, todayStartIso, todayEndIso);
            data.metrics.todayFinalizedPieces = todayCalc.totalPieces;
        } catch (calcErr) {
            console.error("Erro ao recalcular Produção Hoje centralizada:", calcErr);
        }
    }

    return res.json(data);
});

// ── Production Config & Goals ─────────────────────────────────────────────
app.get("/api/config", async (req, res) => {
    const { data, error } = await supabaseAdmin.from("config_producao").select("*").single();
    if (checkError(error, res)) return;
    if (data) {
        delete data.meta_custo_por_peca;
    }
    return res.json(data);
});

app.patch("/api/config", isAdmin, async (req, res) => {
    const { jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes, meta_diaria_pedidos, meta_diaria_pecas, auto_pause_time_weekday, auto_pause_time_friday, auto_pause_time_lunch } = req.body;
    const updates: any = {};
    if (jornada_horas !== undefined) updates.jornada_horas = jornada_horas;
    if (operadores_ativos !== undefined) updates.operadores_ativos = operadores_ativos;
    if (eficiencia_percentual !== undefined) updates.eficiencia_percentual = eficiencia_percentual;
    if (dias_uteis_mes !== undefined) updates.dias_uteis_mes = dias_uteis_mes;
    if (meta_diaria_pedidos !== undefined) updates.meta_diaria_pedidos = meta_diaria_pedidos;
    if (meta_diaria_pecas !== undefined) updates.meta_diaria_pecas = meta_diaria_pecas;
    if (auto_pause_time_weekday !== undefined) updates.auto_pause_time_weekday = auto_pause_time_weekday;
    if (auto_pause_time_friday !== undefined) updates.auto_pause_time_friday = auto_pause_time_friday;
    if (auto_pause_time_lunch !== undefined) updates.auto_pause_time_lunch = auto_pause_time_lunch;
    if (Object.keys(updates).length === 0) {
        const { data: currentConfig, error: readErr } = await supabaseAdmin
            .from("config_producao")
            .select("*")
            .limit(1)
            .maybeSingle();
        if (checkError(readErr, res)) return;
        return res.json(currentConfig || {});
    }
    const { data, error } = await supabaseAdmin
        .from("config_producao")
        .update(updates)
        .eq("id", 1)
        .select()
        .maybeSingle();
    if (checkError(error, res)) return;
    return res.json(data || {});
});

// ── Reports ───────────────────────────────────────────────────────────────
app.get("/api/reports", async (req, res) => {
    const userRole = (req as any).user?.role;
    const isAdminUser = userRole === "Administrador";
    const { period, user_id, stage_id, startDate, endDate, print_type } = req.query;
    const { data, error } = await supabaseAdmin.rpc("get_reports", {
        p_period: period || "day",
        p_user_id: user_id ? Number(user_id) : null,
        p_stage_id: stage_id ? Number(stage_id) : null,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_print_type: print_type || null
    });

    if (checkError(error, res, "Erro nos relatórios")) return;

    if (data) {
        // Calcular produção detalhada por etapa dentro do período selecionado (ajustado para timezone)
        const tzOffset = req.query.tzOffset ? Number(req.query.tzOffset) : 180; // padrão 180 (BRT -03:00)

        const getUtcRange = (dateStr: string, isEnd = false) => {
            const parts = dateStr.split('-');
            const y = Number(parts[0]);
            const m = Number(parts[1]) - 1;
            const d = Number(parts[2]);
            const utcDate = new Date(Date.UTC(y, m, d, isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0));
            utcDate.setUTCMinutes(utcDate.getUTCMinutes() + tzOffset);
            return utcDate.toISOString();
        };

        const todayStr = new Date().toISOString().split('T')[0];
        const startIso = getUtcRange((startDate as string) || todayStr, false);
        const endIso = getUtcRange((endDate as string) || todayStr, true);

        try {
            const { data: periodExecutions } = await supabaseAdmin
                .from("stage_executions")
                .select(`
                    id,
                    end_time,
                    stage_id,
                    user_id,
                    stages(name),
                    users(name),
                    orders(order_number, client_name, quantity)
                `)
                .eq("status", "Finalizado")
                .gte("end_time", startIso)
                .lte("end_time", endIso);

            const stageProductionMap = new Map();
            if (periodExecutions) {
                periodExecutions.forEach((ex: any) => {
                    const stageName = ex.stages?.name || `Etapa #${ex.stage_id}`;
                    const orderQty = ex.orders?.quantity || 0;
                    const orderNumber = ex.orders?.order_number || "-";
                    const clientName = ex.orders?.client_name || "-";
                    const operatorName = ex.users?.name || "Operador";

                    if (!stageProductionMap.has(stageName)) {
                        stageProductionMap.set(stageName, {
                            stage_name: stageName,
                            completed_count: 0,
                            total_pieces: 0,
                            details: []
                        });
                    }

                    const stageProd = stageProductionMap.get(stageName);
                    stageProd.completed_count += 1;
                    stageProd.total_pieces += orderQty;
                    stageProd.details.push({
                        order_number: orderNumber,
                        client_name: clientName,
                        quantity: orderQty,
                        operator: operatorName,
                        finished_at: ex.end_time
                    });
                });
            }
            data.production_by_stage = Array.from(stageProductionMap.values());

            // Enriquecer orders_list com as etapas concluídas para cada pedido no período
            if (Array.isArray(data.orders_list) && data.orders_list.length > 0) {
                data.orders_list.forEach((ord: any) => {
                    const orderExecutions = periodExecutions ? periodExecutions.filter((ex: any) => ex.order_id === ord.order_id) : [];
                    if (orderExecutions.length > 0) {
                        ord.stages_worked_in_period = orderExecutions.map((ex: any) => ({
                            stage_name: ex.stages?.name || `Etapa #${ex.stage_id}`,
                            finished_at: ex.end_time,
                            operator: ex.users?.name || "Operador"
                        }));
                    } else {
                        ord.stages_worked_in_period = [];
                    }
                });
            }

            // Recalcular volume centralizado e resumo sem duplicação de etapas intermediárias
            const [allOrdersRes, allStagesRes, allExecsRes, allLogsRes] = await Promise.all([
                supabaseAdmin.from("orders").select("id, quantity, required_stages, status, created_at, delivered_at, deleted_at"),
                supabaseAdmin.from("stages").select("id, name, sort_order, calculation_type"),
                supabaseAdmin.from("stage_executions").select("id, order_id, stage_id, end_time, status").eq("status", "Finalizado"),
                supabaseAdmin.from("order_progress_logs").select("id, order_id, stage_id, quantidade_boa_incremento, created_at")
            ]);

            const allOrders = allOrdersRes.data || [];
            const allStages = allStagesRes.data || [];
            const allExecs = allExecsRes.data || [];
            const allLogs = allLogsRes.data || [];

            const repPeriod = (period as 'day' | 'week' | 'month') || 'day';
            const volumeBuckets = _calculateFinishedPiecesByPeriod(allOrders, allStages, allExecs, allLogs, repPeriod, startIso, endIso);
            const totalCalc = _calculateFinishedPieces(allOrders, allStages, allExecs, allLogs, startIso, endIso);

            if (volumeBuckets.length > 0) {
                data.volume = volumeBuckets;
            }
            if (data.summary) {
                data.summary.total_parts = totalCalc.totalPieces;
                data.summary.total_orders = totalCalc.totalOrders;
            }
        } catch (err) {
            console.error("Erro ao calcular produção por etapa no relatório:", err);
            data.production_by_stage = [];
        }

        if (data) {
            if (data.summary) {
                delete data.summary.total_labor_cost;
            }
            delete data.costsByCollaborator;
            delete data.costsByOrder;
        }
    }
    return res.json(data);
});

// ── Olist ERP Integration Helpers ──────────────────────────────────────────
function _parseTinyXml(xmlString: string): { status: string; status_processamento: string; errors: string[]; pedidos: any[] } {
    const statusMatch = xmlString.match(/<status>(.*?)<\/status>/);
    const status = statusMatch ? statusMatch[1].trim() : '';

    const statusProcMatch = xmlString.match(/<status_processamento>(.*?)<\/status_processamento>/);
    const status_processamento = statusProcMatch ? statusProcMatch[1].trim() : '';

    const errors: string[] = [];
    const erroMatches = xmlString.matchAll(/<erro>(.*?)<\/erro>/g);
    for (const match of erroMatches) {
        errors.push(match[1].trim());
    }

    const pedidos: any[] = [];
    const pedidoBlockMatches = xmlString.matchAll(/<pedido>(.*?)<\/pedido>/gs);
    for (const match of pedidoBlockMatches) {
        const pBlock = match[1];
        const getTag = (tag: string) => {
            const m = pBlock.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
            return m ? m[1].trim() : '';
        };

        const id = getTag('id');
        const numero = getTag('numero');
        const nome = getTag('nome');
        const situacao = getTag('situacao');
        const data_pedido = getTag('data_pedido');
        const data_prevista = getTag('data_prevista');

        let cliente: any = null;
        const clienteBlock = pBlock.match(/<cliente>(.*?)<\/cliente>/s);
        if (clienteBlock) {
            const cStr = clienteBlock[1];
            const getCTag = (t: string) => {
                const m = cStr.match(new RegExp(`<${t}>(.*?)</${t}>`, 's'));
                return m ? m[1].trim() : '';
            };
            cliente = {
                nome: getCTag('nome'),
                email: getCTag('email'),
                fone: getCTag('fone'),
                cidade: getCTag('cidade'),
                uf: getCTag('uf'),
            };
        }

        const itens: any[] = [];
        const itemMatches = pBlock.matchAll(/<item>(.*?)<\/item>/gs);
        for (const itemMatch of itemMatches) {
            const iStr = itemMatch[1];
            const getITag = (t: string) => {
                const m = iStr.match(new RegExp(`<${t}>(.*?)</${t}>`, 's'));
                return m ? m[1].trim() : '';
            };
            itens.push({
                id_produto: getITag('id_produto'),
                codigo: getITag('codigo'),
                descricao: getITag('descricao'),
                quantidade: parseFloat(getITag('quantidade')) || 0,
                valor_unitario: parseFloat(getITag('valor_unitario')) || 0,
                tamanho: getITag('tamanho'),
                cor: getITag('cor'),
                variacao: getITag('variacao') || getITag('grade'),
                grade: getITag('grade'),
                atributos: getITag('atributos')
            });
        }

        pedidos.push({
            id,
            numero,
            nome,
            situacao,
            data_pedido,
            data_prevista,
            cliente,
            itens
        });
    }

    return { status, status_processamento, errors, pedidos };
}

function _extractItemSizeAndProduct(descricao: string, codigo: string, explicitSize?: string): { productType: string; size: string } {
    const details = extractItemDetails({ description: descricao, sku: codigo, tamanho: explicitSize });
    return { productType: details.product_type, size: details.size };
}

function _isApprovedOlistStatus(situacao: string): boolean {
    if (!situacao) return false;
    const s = situacao.toLowerCase().trim();
    const approvedStatuses = [
        'aprovado', 'faturado', 'preparando envio', 'pronto para envio',
        'enviado', 'entregue', 'atendido', 'parcialmente atendido',
        'em aberto', 'aberto', 'em andamento', 'em separação',
        'em producao', 'em produção', 'aguardando envio', 'completo',
        'pago', 'venda agenciada', 'em digitação'
    ];
    return approvedStatuses.some(approved => s.includes(approved));
}

function _formatDateDDMMYYYY(d: Date): string {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

async function _fetchTinyWithRetry(url: string, bodyParams: URLSearchParams, maxRetries: number = 3): Promise<Response> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: bodyParams.toString()
        });

        if (res.status === 429) {
            const delayMs = attempt * 1200;
            console.warn(`[TinyAPI RateLimit] Recebido HTTP 429 na tentativa ${attempt}/${maxRetries}. Aguardando ${delayMs}ms para tentar novamente...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
        }

        return res;
    }

    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: bodyParams.toString()
    });
}

async function _fetchOlistStockForItem(token: string, idProduto?: string | number, sku?: string): Promise<number | null> {
    if (!token || (!idProduto && (!sku || sku === '-'))) return null;

    try {
        const bodyParams = new URLSearchParams({
            token: token,
            formato: 'json'
        });
        if (idProduto) {
            bodyParams.append('id', String(idProduto));
        } else if (sku && sku !== '-') {
            bodyParams.append('codigo', String(sku));
        }

        const res = await _fetchTinyWithRetry("https://api.tiny.com.br/api2/produto.obter.estoque.php", bodyParams);
        if (!res.ok) return null;

        const text = await res.text();
        let json: any = null;
        try {
            json = JSON.parse(text);
        } catch (_) {
            return null;
        }

        const retorno = json.retorno || {};
        if (retorno.status === 'OK') {
            const prod = retorno.produto || retorno.estoque || {};
            const saldo = prod.saldoDisponivel ?? prod.saldo_disponivel ?? prod.saldo ?? prod.saldo_fisico;
            if (saldo !== undefined && saldo !== null) {
                return Math.max(0, parseFloat(saldo) || 0);
            }
        }
    } catch (err) {
        console.warn(`[OlistStock] Erro ao consultar estoque do item (id:${idProduto}, sku:${sku}):`, err);
    }
    return null;
}

async function _fetchOlistOrders(
    token: string,
    daysLimit: number = 30,
    specificOrderNumbers?: string[]
): Promise<any[]> {
    if (!token) return [];

    const allOrders: any[] = [];
    const seenIds = new Set<string>();

    // 1. Se números específicos foram solicitados (ex: '1121', '1122'), busca direta no Tiny ERP
    if (specificOrderNumbers && specificOrderNumbers.length > 0) {
        for (const rawNum of specificOrderNumbers) {
            const cleanNum = String(rawNum).replace(/^OLIST-/i, '').trim();
            if (!cleanNum) continue;

            try {
                const bodyParams = new URLSearchParams({
                    token: token,
                    formato: 'json',
                    numero: cleanNum
                });
                console.log(`[OlistSync] Buscando pedido específico no Tiny por número: ${cleanNum}...`);
                const res = await _fetchTinyWithRetry("https://api.tiny.com.br/api2/pedidos.pesquisa.php", bodyParams);
                if (res.ok) {
                    const text = await res.text();
                    let pedidos: any[] = [];
                    try {
                        const json = JSON.parse(text);
                        const retorno = json.retorno || {};
                        if (retorno.status === 'OK' && retorno.pedidos) {
                            pedidos = retorno.pedidos.map((item: any) => item.pedido || item);
                        }
                    } catch (_) {
                        const xmlParsed = _parseTinyXml(text);
                        pedidos = xmlParsed?.pedidos || [];
                    }

                    if (pedidos.length === 0) {
                        // Fallback de busca textual por pesquisa
                        const fbParams = new URLSearchParams({
                            token: token,
                            formato: 'json',
                            pesquisa: cleanNum
                        });
                        const fbRes = await _fetchTinyWithRetry("https://api.tiny.com.br/api2/pedidos.pesquisa.php", fbParams);
                        if (fbRes.ok) {
                            const fbText = await fbRes.text();
                            try {
                                const fbJson = JSON.parse(fbText);
                                const fbRet = fbJson.retorno || {};
                                if (fbRet.status === 'OK' && fbRet.pedidos) {
                                    pedidos = fbRet.pedidos.map((item: any) => item.pedido || item);
                                }
                            } catch (parseErr) {
                                console.debug('[OlistSync] Erro no parsing JSON do fallback de pesquisa:', parseErr);
                            }
                        }
                    }

                    for (const p of pedidos) {
                        const idStr = String(p.id || p.numero);
                        if (!seenIds.has(idStr)) {
                            seenIds.add(idStr);
                            allOrders.push(p);
                        }
                    }
                }
                await new Promise(r => setTimeout(r, 600));
            } catch (err) {
                console.warn(`[OlistSync] Erro ao buscar pedido específico ${cleanNum}:`, err);
            }
        }

        console.log(`[OlistSync] Pedidos específicos encontrados: ${allOrders.length}`);
        return allOrders;
    }

    // 2. Busca por janela de dias (padrão 30 dias)
    let dataInicial: string | undefined = undefined;
    if (daysLimit > 0) {
        const cutoffDate = new Date();
        cutoffDate.setHours(0, 0, 0, 0);
        if (daysLimit > 1) {
            cutoffDate.setDate(cutoffDate.getDate() - (daysLimit - 1));
        }
        dataInicial = _formatDateDDMMYYYY(cutoffDate);
    }

    // Consulta todas as situações elegíveis no Tiny ERP
    const statusQueries = ['em_aberto', 'aprovado', 'preparando_envio', 'faturado'];

    for (const stParam of statusQueries) {
        for (let page = 1; page <= 5; page++) {
            const bodyParams = new URLSearchParams({
                token: token,
                formato: 'json',
                pagina: String(page)
            });
            if (stParam) {
                bodyParams.append('situacao', stParam);
            }
            if (dataInicial) {
                bodyParams.append('dataInicial', dataInicial);
            }

            console.log(`[OlistSync] Fetching page ${page} (status: '${stParam}', dataInicial: '${dataInicial || 'all'}')...`);

            const res = await _fetchTinyWithRetry("https://api.tiny.com.br/api2/pedidos.pesquisa.php", bodyParams);

            if (!res.ok) break;
            const text = await res.text();
            
            let pedidos: any[] = [];
            try {
                const json = JSON.parse(text);
                const retorno = json.retorno || {};
                if (retorno.status === 'OK' && retorno.pedidos) {
                    pedidos = retorno.pedidos.map((item: any) => item.pedido || item);
                }
            } catch (e) {
                const xmlParsed = _parseTinyXml(text);
                pedidos = xmlParsed?.pedidos || [];
            }

            if (pedidos.length === 0) break;

            for (const p of pedidos) {
                const idStr = String(p.id || p.numero);
                if (!seenIds.has(idStr)) {
                    seenIds.add(idStr);
                    allOrders.push(p);
                }
            }

            // Tiny API returns max 100 per page; if less, it's the last page for this status
            if (pedidos.length < 100) break;

            // 600ms delay between pages to respect API rate limits
            await new Promise(resolve => setTimeout(resolve, 600));
        }
    }

    console.log(`[OlistSync] Total unique orders fetched across statuses: ${allOrders.length}`);
    return allOrders;
}

async function _fetchOlistOrderDetail(token: string, olistOrderId: string): Promise<any | null> {
    if (!token || !olistOrderId) return null;
    
    const bodyParams = new URLSearchParams({
        token: token,
        formato: 'json',
        id: String(olistOrderId)
    });

    const res = await _fetchTinyWithRetry("https://api.tiny.com.br/api2/pedido.obter.php", bodyParams);

    if (!res.ok) throw new Error(`Olist API Detail HTTP Error: ${res.status}`);
    const text = await res.text();
    
    let raw: any = null;
    try {
        const json = JSON.parse(text);
        if (json.retorno && json.retorno.status === 'OK' && json.retorno.pedido) {
            raw = json.retorno.pedido;
        }
    } catch (e) {
        const parsed = _parseTinyXml(text);
        if (parsed.pedidos && parsed.pedidos.length > 0) {
            raw = parsed.pedidos[0];
        }
    }

    if (!raw) return null;

    const items = (raw.itens || []).map((itWrapper: any) => {
        const it = itWrapper.item || itWrapper;
        const desc = it.descricao || it.description || 'Item sem descrição';
        const cod = it.codigo || it.sku || '-';
        const qty = parseFloat(it.quantidade || it.quantity) || 1;
        const explicitSize = it.tamanho || it.size || it.variacao?.tamanho || it.grade?.tamanho || it.variacoes?.tamanho;
        const explicitColor = it.cor || it.color || it.variacao?.cor || it.grade?.cor || it.variacoes?.cor;

        const extractedDetails = extractItemDetails({
            ...it,
            description: desc,
            sku: cod,
            tamanho: explicitSize,
            cor: explicitColor
        });

        return {
            id_produto: it.id_produto,
            codigo: cod,
            sku: cod,
            descricao: desc,
            description: desc,
            quantidade: qty,
            quantity: qty,
            valor_unitario: parseFloat(it.valor_unitario || it.preco) || 0,
            tamanho: extractedDetails.size,
            size: extractedDetails.size,
            cor: extractedDetails.color,
            color: extractedDetails.color,
            productType: extractedDetails.product_type,
            modelo: extractedDetails.product_type,
            fabric: extractedDetails.fabric,
            tecido: extractedDetails.fabric,
            item_key: extractedDetails.item_key,
            is_complete: extractedDetails.is_complete
        };
    });

    const total_quantidade = items.reduce((sum: number, item: any) => sum + (item.quantidade || 0), 0);

    return {
        id: raw.id,
        numero: raw.numero,
        nome: raw.cliente?.nome || raw.nome || 'Cliente Olist',
        situacao: raw.situacao,
        data_pedido: raw.data_pedido,
        data_prevista: raw.data_prevista,
        cliente: raw.cliente,
        itens: items,
        total_quantidade: total_quantidade > 0 ? total_quantidade : 1
    };
}

function _parseOrderDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const cleanStr = String(dateStr).trim();
    
    // Format: DD/MM/YYYY or DD-MM-YYYY
    if (cleanStr.includes('/')) {
        const parts = cleanStr.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                return new Date(year, month, day);
            }
        }
    }
    
    // Format: YYYY-MM-DD
    if (cleanStr.includes('-')) {
        const parts = cleanStr.split('-');
        if (parts.length >= 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2].substring(0, 2), 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                return new Date(year, month, day);
            }
        }
    }

    const d = new Date(cleanStr);
    return isNaN(d.getTime()) ? null : d;
}

function _resolveProductType(itemDesc: string = '', itemProductType: string = ''): 'Dry Fit' | 'Algodão' | 'Poliamida' {
    const text = `${itemDesc} ${itemProductType}`.toLowerCase();
    if (text.includes('algodao') || text.includes('algodão')) {
        return 'Algodão';
    }
    if (text.includes('poliamida')) {
        return 'Poliamida';
    }
    return 'Dry Fit';
}

async function _syncOlistOrders(
    daysLimit: number = 30,
    tokenOverride?: string,
    specificOrderNumbers?: string[],
    batchLimit: number = 50
) {
    const token = (tokenOverride || process.env.OLIST_API_TOKEN || "").trim();
    if (!token) {
        throw new Error("Token de acesso do Olist ERP não configurado ou expirado.");
    }

    const rawOrders = await _fetchOlistOrders(token, daysLimit, specificOrderNumbers);
    console.log(`[OlistSync] Encontrados ${rawOrders.length} pedidos na API do Olist/Tiny.`);

    const isSpecific = Boolean(specificOrderNumbers && specificOrderNumbers.length > 0);

    const approved = isSpecific
        ? rawOrders.filter(o => {
            const s = (o.situacao || '').toLowerCase();
            return !s.includes('cancelado') && !s.includes('estornado');
          })
        : rawOrders.filter(o => _isApprovedOlistStatus(o.situacao));

    console.log(`[OlistSync] Pedidos aprovados/pagos elegíveis (total histórico): ${approved.length}`);

    // If specific order numbers were provided, bypass the date cutoff so older requested orders are not discarded
    let eligibleOrders = approved;
    if (!isSpecific && daysLimit > 0) {
        const cutoffDate = new Date();
        cutoffDate.setHours(0, 0, 0, 0);
        cutoffDate.setDate(cutoffDate.getDate() - daysLimit);

        eligibleOrders = approved.filter(o => {
            const orderDate = _parseOrderDate(o.data_pedido);
            if (!orderDate) return false;
            orderDate.setHours(0, 0, 0, 0);
            return orderDate >= cutoffDate;
        });
        console.log(`[OlistSync] Pedidos aprovados dos últimos ${daysLimit} dias (de hoje em diante): ${eligibleOrders.length}`);
    } else {
        console.log(`[OlistSync] Pedidos elegíveis para importação: ${eligibleOrders.length}`);
    }

    const importedOrders: any[] = [];
    const skippedOrders: any[] = [];
    const errors: any[] = [];

    const { data: existingOrders } = await supabaseAdmin
        .from("orders")
        .select("id, order_number, olist_order_id, observations")
        .is("deleted_at", null);

    const existingOlistIds = new Set<string>();
    const existingOrderNumbers = new Set<string>();

    (existingOrders || []).forEach((o: any) => {
        if (o.olist_order_id) existingOlistIds.add(String(o.olist_order_id));
        if (o.order_number) existingOrderNumbers.add(String(o.order_number));
        if (o.observations) {
            const m = o.observations.match(/Olist ID:\s*(\d+)/i);
            if (m) existingOlistIds.add(m[1]);
        }
    });

    const unimportedEligible = eligibleOrders.filter(rawOrd => {
        const olistId = String(rawOrd.id);
        const olistNum = String(rawOrd.numero);
        const isExisting = existingOlistIds.has(olistId) || existingOrderNumbers.has(`OLIST-${olistNum}`);
        if (isExisting) skippedOrders.push(olistId);
        return !isExisting;
    });

    const maxOrdersToProcess = isSpecific
        ? Math.min(unimportedEligible.length, Math.max(batchLimit, specificOrderNumbers!.length))
        : Math.min(unimportedEligible.length, batchLimit);

    console.log(`[OlistSync] Pedidos novos a importar nesta rodada: ${unimportedEligible.length} (limitando a ${maxOrdersToProcess} por lote)`);
    const targetOrders = unimportedEligible.slice(0, maxOrdersToProcess);

    for (const rawOrd of targetOrders) {
        const olistId = String(rawOrd.id);
        const olistNum = String(rawOrd.numero);

        try {
            // 1000ms delay to respect Tiny API rate limits and avoid HTTP 429
            await new Promise(r => setTimeout(r, 1000));

            const detail = await _fetchOlistOrderDetail(token, olistId);
            if (!detail) {
                console.warn(`[OlistSync] Detalhes não retornados para o pedido #${olistId}`);
                continue;
            }

            const orderNumber = `OLIST-${detail.numero || olistNum}`;
            const clientName = detail.nome || 'Cliente Olist';
            const quantity = detail.total_quantidade || 1;

            let productType: 'Dry Fit' | 'Algodão' | 'Poliamida' = 'Dry Fit';
            if (detail.itens && detail.itens.length > 0) {
                productType = _resolveProductType(detail.itens[0].descricao, detail.itens[0].productType);
            }

            let defaultRequiredStages = await resolveDefaultProductionStageIds(supabaseAdmin);
            let obsText = `Importado do Olist ERP (ID: ${detail.id}, Nº: ${detail.numero}) - Aguardando revisão de estampa`;

            let deadlineIso = new Date().toISOString();
            if (detail.data_prevista) {
                const p = detail.data_prevista.split('/');
                if (p.length === 3) {
                    deadlineIso = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0])).toISOString();
                }
            } else {
                const d = new Date();
                d.setDate(d.getDate() + 14);
                deadlineIso = d.toISOString();
            }

            const insertPayload: any = {
                order_number: orderNumber,
                client_name: clientName,
                product_type: productType, // Must satisfy orders_product_type_check ('Dry Fit' | 'Algodão' | 'Poliamida')
                print_type: 'DTF', // Must satisfy orders_print_type_check ('DTF' | 'Silk' | 'Sublimação' | 'Bordado')
                quantity: quantity,
                deadline: deadlineIso,
                status: 'Rascunho',
                observations: obsText,
                required_stages: defaultRequiredStages,
                estimated_time_seconds: 3600,
                olist_order_id: detail.id,
                olist_order_number: detail.numero,
                items: detail.itens
            };

            // Remove any soft-deleted row with the same order_number to avoid unique constraint violations
            try {
                await supabaseAdmin
                    .from("orders")
                    .delete()
                    .or(`order_number.eq.${orderNumber},olist_order_id.eq.${detail.id}`)
                    .not("deleted_at", "is", null);
            } catch (delErr) {
                console.warn('[OlistSync] Aviso ao limpar pedidos deletados:', delErr);
            }

            let { data: createdOrder, error: insertErr } = await supabaseAdmin
                .from("orders")
                .insert(insertPayload)
                .select()
                .single();

            if (insertErr) {
                console.warn(`[OlistSync] Erro no insert inicial (${insertErr.message}), tentando com fallback...`);
                insertPayload.product_type = 'Dry Fit';
                insertPayload.print_type = 'DTF';

                const { data: fallbackOrder, error: fallbackErr } = await supabaseAdmin
                    .from("orders")
                    .insert(insertPayload)
                    .select()
                    .single();

                if (fallbackErr) {
                    console.error(`[OlistSync] Erro ao inserir pedido Olist #${olistId}:`, fallbackErr);
                    errors.push({ id: olistId, error: fallbackErr.message });
                    continue;
                }
                createdOrder = fallbackOrder;
            }

            if (createdOrder) {
                existingOlistIds.add(olistId);
                importedOrders.push(createdOrder);

                await logOrderHistory(supabaseAdmin, {
                    order_id: createdOrder.id,
                    usuario: "Olist Integrator (Auto)",
                    acao: "importou_olist",
                    antes: null,
                    depois: { olist_id: detail.id, status: "Rascunho", items: detail.itens },
                    detalhes: "Importação automática via Olist",
                });
            }
        } catch (itemErr: any) {
            console.error(`[OlistSync] Falha ao processar pedido Olist #${olistId}:`, itemErr);
            errors.push({ id: olistId, error: itemErr.message });
        }
    }

    return {
        total_found: rawOrders.length,
        total_approved: approved.length,
        eligible_count: eligibleOrders.length,
        days_limit: daysLimit,
        imported_count: importedOrders.length,
        skipped_count: skippedOrders.length,
        errors_count: errors.length,
        imported_orders: importedOrders,
        errors
    };
}

// ── Olist ERP Integration Endpoints (OAuth 2.0 & Token Sync) ────────────────

const OLIST_CLIENT_ID = process.env.OLIST_CLIENT_ID || "tiny-api-b69bd9b2e5c8fb27d88f3d7507bb6d82e9313f1f-1789606342";
const OLIST_CLIENT_SECRET = process.env.OLIST_CLIENT_SECRET || "HI899WOykeSXkU7Z6ek4s9MnWR8EcUib";
const OLIST_REDIRECT_URI = process.env.OLIST_REDIRECT_URI || "https://uniflow-gestao-de-producao.vercel.app/api/integrations/olist/callback";

let olistOAuthTokenCache: { access_token?: string; refresh_token?: string; expires_at?: number } = {};

async function _getEffectiveOlistToken(): Promise<string> {
    if (olistOAuthTokenCache.access_token && olistOAuthTokenCache.expires_at && Date.now() < olistOAuthTokenCache.expires_at) {
        return olistOAuthTokenCache.access_token;
    }
    return (process.env.OLIST_API_TOKEN || "").trim();
}

// Direct URL matching middleware for OAuth Auth redirect (bulletproof against Vercel rewrites)
app.use((req, res, next) => {
    const urlStr = req.originalUrl || req.url || '';
    if (urlStr.includes('/olist/auth') || urlStr.includes('/integrations/olist/auth')) {
        const authUrl = `https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth?client_id=${encodeURIComponent(OLIST_CLIENT_ID)}&redirect_uri=${encodeURIComponent(OLIST_REDIRECT_URI)}&response_type=code&scope=openid`;
        return res.redirect(authUrl);
    }
    next();
});

// Direct URL matching middleware for OAuth Callback
app.use(async (req, res, next) => {
    const urlStr = req.originalUrl || req.url || '';
    if (urlStr.includes('/olist/callback') || urlStr.includes('/integrations/olist/callback')) {
        try {
            const code = req.query.code;
            const error = req.query.error;

            if (error) {
                return res.status(400).send(`<h3>Erro na autorização do Olist ERP:</h3><pre>${error}</pre>`);
            }
            if (!code) {
                return res.status(400).send(`<h3>Código de autorização não fornecido pelo Olist ERP.</h3>`);
            }

            const tokenUrl = "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token";
            const bodyParams = new URLSearchParams({
                grant_type: "authorization_code",
                client_id: OLIST_CLIENT_ID,
                client_secret: OLIST_CLIENT_SECRET,
                redirect_uri: OLIST_REDIRECT_URI,
                code: String(code)
            });

            const tokenRes = await fetch(tokenUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: bodyParams.toString()
            });

            const tokenData = await tokenRes.json();
            if (!tokenRes.ok || tokenData.error) {
                return res.status(400).send(`<h3>Erro ao obter Token do Olist ERP:</h3><pre>${JSON.stringify(tokenData, null, 2)}</pre>`);
            }

            olistOAuthTokenCache = {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: Date.now() + ((tokenData.expires_in || 3600) * 1000)
            };

            if (tokenData.access_token) {
                process.env.OLIST_API_TOKEN = tokenData.access_token;
            }

            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Olist ERP Conectado!</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f4f4f5; }
                        .card { background: white; padding: 2.5rem; border-radius: 1.5rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); max-width: 480px; text-align: center; }
                        h1 { color: #18181b; font-size: 1.5rem; margin-bottom: 0.5rem; }
                        p { color: #71717a; font-size: 0.875rem; line-height: 1.5; }
                        .badge { background: #dcfce7; color: #166534; padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: bold; font-size: 0.75rem; display: inline-block; margin-bottom: 1rem; }
                        button { background: #4f46e5; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: bold; cursor: pointer; margin-top: 1.5rem; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="badge">✓ AUTORIZADO COM SUCESSO</div>
                        <h1>Conexão com Olist / Tiny ERP Ativa!</h1>
                        <p>O aplicativo ComfortPro foi autorizado no Olist ERP com sucesso. Agora a sincronização automática de pedidos está conectada e pronta.</p>
                        <button onclick="if(window.opener){window.opener.location.reload();} window.close();">Fechar e Voltar ao Sistema</button>
                    </div>
                </body>
                </html>
            `);
        } catch (err: any) {
            return res.status(500).send(`<h3>Erro interno no callback do Olist ERP:</h3><pre>${err.message}</pre>`);
        }
    }
    next();
});

// Temporary debug endpoint to see what orders the Tiny API returns
app.get("/api/integrations/olist/debug", isAdmin, async (_req, res) => {
    try {
        const token = await _getEffectiveOlistToken();
        if (!token) {
            return res.json({ error: "Token do Olist ERP não configurado ou expirado", oauth_configured: !!OLIST_CLIENT_ID });
        }

        const rawOrders = await _fetchOlistOrders(token);
        const summary = rawOrders.map((o: any) => ({
            id: o.id,
            numero: o.numero,
            nome: o.nome,
            situacao: o.situacao,
            data_pedido: o.data_pedido,
            is_approved: _isApprovedOlistStatus(o.situacao)
        }));

        return res.json({
            token_configured: true,
            token_preview: token.substring(0, 8) + "...",
            total_orders_found: rawOrders.length,
            orders: summary,
            approved_count: summary.filter((o: any) => o.is_approved).length
        });
    } catch (err: any) {
        return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 5) });
    }
});

app.post("/api/integrations/olist/sync", isAdminOrComercial, async (req, res) => {
    try {
        const tokenOverride = await _getEffectiveOlistToken();
        const days = req.body?.days !== undefined ? Number(req.body.days) : 30; // Default to 30 days
        let orderNumbers: string[] | undefined = undefined;
        if (req.body?.order_numbers) {
            if (Array.isArray(req.body.order_numbers)) {
                orderNumbers = req.body.order_numbers.map(String).map(s => s.trim()).filter(Boolean);
            } else if (typeof req.body.order_numbers === 'string') {
                orderNumbers = req.body.order_numbers.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
            }
        }
        const batchLimit = req.body?.batch_limit ? Number(req.body.batch_limit) : 50;
        const result = await _syncOlistOrders(days, tokenOverride, orderNumbers, batchLimit);
        return res.json({ success: true, ...result });
    } catch (err: any) {
        console.error("[OlistSync API Error]:", err);
        return res.json({ success: false, error: err.message || "Erro na sincronização com Olist ERP" });
    }
});

app.post("/api/integrations/olist/reprocess-normalization", isAdmin, async (_req, res) => {
    try {
        const { data: orders, error } = await supabaseAdmin
            .from("orders")
            .select("*")
            .not("items", "is", null);

        if (error) throw error;
        if (!orders || orders.length === 0) {
            return res.json({ success: true, reprocessed_count: 0, message: "Nenhum pedido encontrado para reprocessar." });
        }

        let reprocessedCount = 0;
        const detailsList: any[] = [];

        for (const order of orders) {
            const itemsRaw = parseOrderItems(order.items);
            if (itemsRaw.length === 0) continue;

            let hasChanges = false;
            const updatedItems = itemsRaw.map((it: any) => {
                const oldDetails = {
                    product_type: it.product_type || it.modelo,
                    fabric: it.fabric || it.tecido,
                    color: it.color || it.cor,
                    size: it.size || it.tamanho,
                    item_key: it.item_key
                };

                const newDetails = extractItemDetails(it, order.product_type);

                if (
                    oldDetails.product_type !== newDetails.product_type ||
                    oldDetails.fabric !== newDetails.fabric ||
                    oldDetails.color !== newDetails.color ||
                    oldDetails.size !== newDetails.size ||
                    oldDetails.item_key !== newDetails.item_key
                ) {
                    hasChanges = true;
                }

                return {
                    ...it,
                    product_type: newDetails.product_type,
                    modelo: newDetails.product_type,
                    fabric: newDetails.fabric,
                    tecido: newDetails.fabric,
                    color: newDetails.color,
                    cor: newDetails.color,
                    size: newDetails.size,
                    tamanho: newDetails.size,
                    item_key: newDetails.item_key,
                    is_complete: newDetails.is_complete
                };
            });

            if (hasChanges) {
                reprocessedCount++;
                detailsList.push({
                    order_id: order.id,
                    order_number: order.order_number,
                    items_count: updatedItems.length
                });

                await supabaseAdmin
                    .from("orders")
                    .update({ items: updatedItems })
                    .eq("id", order.id);

                await logOrderHistory(supabaseAdmin, {
                    order_id: order.id,
                    acao: "reprocessou_normalizacao",
                    detalhes: "Reprocessamento automático da normalização de modelos, tecidos, cores e tamanhos",
                    usuario: "Sistema (Reprocessamento Olist)",
                    antes: { items: itemsRaw },
                    depois: { items: updatedItems }
                });
            }
        }

        return res.json({
            success: true,
            total_orders_analyzed: orders.length,
            reprocessed_count: reprocessedCount,
            updated_orders: detailsList,
            message: `Reprocessamento concluído com sucesso. ${reprocessedCount} pedido(s) atualizado(s).`
        });
    } catch (err: any) {
        console.error("[ReprocessNormalization API Error]:", err);
        return res.status(500).json({ success: false, error: err.message || "Erro no reprocessamento da normalização" });
    }
});

app.post("/api/webhooks/olist", verifyOlistWebhookSecret, async (req, res) => {
    try {
        console.log("[Olist Webhook] Recebido webhook do Olist/Tiny ERP:", req.body);
        const result = await _syncOlistOrders();
        return res.json({ success: true, ...result });
    } catch (err: any) {
        console.error("[Olist Webhook Error]:", err);
        return res.status(500).json({ error: err.message });
    }
});

app.get("/api/orders/drafts", isAdminOrComercial, async (_req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("orders")
            .select("*")
            .eq("status", "Rascunho")
            .is("deleted_at", null)
            .order("created_at", { ascending: false });

        if (checkError(error, res, "Erro ao buscar rascunhos de pedidos")) return;
        return res.json(data || []);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete("/api/orders/drafts/:id", isAdminOrComercial, async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const usuario = getActorName(req, "Usuário");
        const now = new Date().toISOString();

        const { error } = await supabaseAdmin
            .from("orders")
            .delete()
            .eq("id", orderId)
            .eq("status", "Rascunho");

        if (checkError(error, res, "Erro ao excluir rascunho")) return;
        return res.json({ success: true, message: "Rascunho excluído com sucesso" });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

app.post("/api/orders/drafts/cleanup", isAdminOrComercial, async (req, res) => {
    try {
        const usuario = getActorName(req, "Usuário");
        const now = new Date().toISOString();
        const forceAll = req.body?.all === true;

        let query = supabaseAdmin
            .from("orders")
            .delete()
            .eq("status", "Rascunho");

        if (!forceAll) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 7);
            query = query.lt("created_at", cutoff.toISOString());
        }

        const { error } = await query;
        if (checkError(error, res, "Erro ao limpar rascunhos")) return;

        return res.json({ success: true, message: "Rascunhos limpos com sucesso" });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

app.post("/api/orders/:id/confirm-draft", isAdminOrComercial, async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const usuario = getActorName(req, "Vendedora");
        const { print_type, product_type, deadline, observations, required_stages, num_colors } = req.body;

        if (!print_type) {
            return res.status(400).json({ error: "É necessário selecionar o tipo de estampa (DTF, Silk, Sublimação, Bordado)" });
        }

        const { data: currentOrder, error: fetchErr } = await supabaseAdmin
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .single();

        if (fetchErr || !currentOrder) {
            return res.status(404).json({ error: "Pedido rascunho não encontrado" });
        }

        const fallbackStages = await resolveDefaultProductionStageIds(supabaseAdmin);
        const rawStages = required_stages || currentOrder.required_stages || fallbackStages;
        const stagesArray = Array.isArray(rawStages) && rawStages.length > 0 
            ? rawStages.map((id: any) => Number(id)).filter((id: number) => !isNaN(id)) 
            : fallbackStages;

        const updates: any = {
            status: "Entrada",
            print_type: print_type,
            product_type: product_type || currentOrder.product_type,
            required_stages: stagesArray,
            num_colors: Number(num_colors) || currentOrder.num_colors || 1,
        };

        if (deadline) updates.deadline = deadline;
        if (observations !== undefined) updates.observations = observations;

        const { data: updatedOrder, error: updateErr } = await supabaseAdmin
            .from("orders")
            .update(updates)
            .eq("id", orderId)
            .select()
            .single();

        if (checkError(updateErr, res, "Erro ao liberar pedido para produção")) return;

        await logOrderHistory(supabaseAdmin, {
            order_id: orderId,
            usuario,
            acao: "confirmou_rascunho",
            antes: currentOrder,
            depois: updatedOrder,
            detalhes: "Confirmação de rascunho de pedido",
        });

        return res.json({ success: true, order: updatedOrder });
    } catch (err: any) {
        console.error("[ConfirmDraft Error]:", err);
        return res.status(500).json({ error: err.message });
    }
});

// ── Order Templates ───────────────────────────────────────────────────────
app.get("/api/order-templates", async (_req, res) => {
    const { data, error } = await supabaseAdmin
        .from("order_templates")
        .select("*");
    if (checkError(error, res)) return;
    return res.json(data);
});

app.post("/api/order-templates", isAdmin, async (req, res) => {
    const { name, product_type, print_type, quantity, observations, required_stages } = req.body;
    const { data, error } = await supabaseAdmin
        .from("order_templates")
        .insert({
            name,
            product_type,
            print_type,
            quantity: Number(quantity) || 0,
            observations,
            required_stages: required_stages || []
        })
        .select()
        .single();
    if (checkError(error, res)) return;
    return res.json(data);
});

app.patch("/api/order-templates/:id", isAdmin, async (req, res) => {
    const { name, product_type, print_type, quantity, observations, required_stages } = req.body;
    const { error } = await supabaseAdmin
        .from("order_templates")
        .update({
            name,
            product_type,
            print_type,
            quantity: quantity !== undefined ? Number(quantity) : undefined,
            observations,
            required_stages
        })
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

app.delete("/api/order-templates/:id", isAdmin, async (req, res) => {
    const { error } = await supabaseAdmin
        .from("order_templates")
        .delete()
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// ── Delivery Forecast ─────────────────────────────────────────────────────
app.get("/api/orders/delivery-forecast", async (_req, res) => {
    try {
        // 1. Active orders (not delivered, not cancelled, not deleted)
        const { data: rawOrders, error: ordersErr } = await supabaseAdmin
            .from("orders")
            .select("id, order_number, client_name, quantity, deadline, status, required_stages, print_type, product_type, created_at")
            .is("deleted_at", null)
            .not("status", "in", '("Entregue","Cancelado")')
            .order("deadline", { ascending: true });

        if (ordersErr) throw ordersErr;
        if (!rawOrders || rawOrders.length === 0) return res.json([]);

        // 2. All stages sorted
        const { data: allStages, error: stagesErr } = await supabaseAdmin
            .from("stages")
            .select("id, name, sort_order, ideal_time, real_average_time, execution_count, calculation_type")
            .eq("active", 1)
            .order("sort_order", { ascending: true });

        if (stagesErr) throw stagesErr;

        // 3. Capacity config
        const { data: configRows } = await supabaseAdmin
            .from("config_producao")
            .select("jornada_horas, operadores_ativos, eficiencia_percentual")
            .limit(1);

        const config = configRows?.[0] || { jornada_horas: 8, operadores_ativos: 2, eficiencia_percentual: 0.85 };
        // Minutes available per day per sector (shared pool)
        const dailyCapacityMinutes = config.jornada_horas * 60 * config.operadores_ativos * config.eficiencia_percentual;

        // 4. Build lookup: stageId → baseTimeSeconds (Ideal vs Real)
        const timeByStage: Record<number, number> = {};

        const stageDefaults: Record<string, number> = {
            "Ficha de aprovação": 1.5 * 60,
            "Separação / Corte": 2 * 60,
            "Revelação de Tela": 2 * 60,
            "Silk": 5 * 60,
            "DTF": 4 * 60,
            "Sublimação": 3 * 60,
            "Costura": 2.5 * 60,
            "Conferência": 1 * 60,
            "Embalagem": 0.5 * 60,
        };

        for (const stage of (allStages || [])) {
            let baseSecs = 0;
            const executionCount = stage.execution_count || 0;
            
            // Regra: se < 10 registros, usa tempo ideal. Se >= 10, usa tempo medio real.
            if (executionCount >= 10 && stage.real_average_time > 0) {
                baseSecs = stage.real_average_time;
            } else if (stage.ideal_time > 0) {
                baseSecs = stage.ideal_time;
            } else {
                baseSecs = stageDefaults[stage.name] ?? 2 * 60;
            }
            // Multiplicador default? Não, agora tempo_base equivale ao tempo total da etapa
            timeByStage[stage.id] = baseSecs;
            (timeByStage as any)[`${stage.id}_type`] = stage.calculation_type || 'por_peca';
        }

        // 5. Simulate queue — orders already sorted by deadline (most urgent first)
        // sectorAvailableAt: when can a sector next accept work (in ms)
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const sectorAvailableAt: Record<number, number> = {};
        for (const stage of (allStages || [])) {
            sectorAvailableAt[stage.id] = now.getTime();
        }

        const helper = {
            addWorkingDays: (startMs: number, days: number): number => {
                // Simple approximation: 5/7 of days are working days
                // Use calendar days = workingDays / (5/7) = workingDays * 1.4
                const calendarMs = days * 1.4 * 24 * 60 * 60 * 1000;
                return startMs + calendarMs;
            }
        };

        const forecasts: any[] = [];

        for (const order of (rawOrders || [])) {
            // Determine which stages this order needs
            let orderStageIds: number[] = [];
            if (order.required_stages && order.required_stages.length > 0) {
                orderStageIds = order.required_stages;
            } else {
                orderStageIds = (allStages || []).map((s: any) => s.id);
            }

            // Sort by sort_order
            const orderStages = (allStages || [])
                .filter((s: any) => orderStageIds.includes(s.id))
                .sort((a: any, b: any) => a.sort_order - b.sort_order);

            let prevStageEndMs = now.getTime();
            const stageForecastDetails: any[] = [];
            let bottleneckStage: string | null = null;
            let maxQueueDays = -1;

            for (const stage of orderStages) {
                const calcType = (timeByStage as any)[`${stage.id}_type`];
                let baseSecs = (timeByStage[stage.id] ?? 2 * 60);
                
                if (calcType === 'por_peca') {
                    baseSecs *= (order.quantity || 1);
                } else if (calcType === 'por_lote') {
                    baseSecs *= Math.ceil((order.quantity || 1) / 10);
                }
                
                const totalMinutes = baseSecs / 60;
                const execDays = totalMinutes / dailyCapacityMinutes; // working days

                const sectorAvail = sectorAvailableAt[stage.id] ?? now.getTime();
                const startMs = Math.max(prevStageEndMs, sectorAvail);

                const queueDays = Math.max(0, (sectorAvail - now.getTime()) / (24 * 60 * 60 * 1000) / 1.4);
                const endMs = helper.addWorkingDays(startMs, execDays);

                // Update sector availability
                sectorAvailableAt[stage.id] = endMs;
                prevStageEndMs = endMs;

                stageForecastDetails.push({
                    stageId: stage.id,
                    stageName: stage.name,
                    startDate: new Date(startMs).toISOString().split("T")[0],
                    endDate: new Date(endMs).toISOString().split("T")[0],
                    queueDays: Math.round(queueDays * 10) / 10,
                    execDays: Math.round(execDays * 10) / 10,
                });

                const totalDelay = queueDays + execDays;
                if (totalDelay > maxQueueDays) {
                    maxQueueDays = totalDelay;
                    bottleneckStage = stage.name;
                }
            }

            const predictedDate = new Date(prevStageEndMs);
            const deadline = new Date(order.deadline);
            deadline.setHours(23, 59, 59, 0);

            const deadlineDaysFromNow = Math.max(1, (deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            const predictedDaysFromNow = Math.max(0, (predictedDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

            const riskIndex = predictedDaysFromNow / deadlineDaysFromNow;
            const riskLevel = riskIndex <= 0.8 ? "safe" : riskIndex <= 1.0 ? "warning" : "danger";

            forecasts.push({
                orderId: order.id,
                orderNumber: order.order_number,
                clientName: order.client_name,
                quantity: order.quantity,
                printType: order.print_type,
                productType: order.product_type,
                deadline: order.deadline,
                predictedDate: predictedDate.toISOString().split("T")[0],
                riskIndex: Math.round(riskIndex * 100) / 100,
                riskLevel,
                bottleneckStage,
                stageForecasts: stageForecastDetails,
            });
        }

        // Sort by risk descending (highest risk first)
        forecasts.sort((a, b) => b.riskIndex - a.riskIndex);
        return res.json(forecasts);

    } catch (err: any) {
        console.error("[Forecast] Error:", err);
        return res.status(500).json({ error: "Erro no cálculo de previsão" });
    }
});


// ── Orders ────────────────────────────────────────────────────────────────
app.get("/api/orders", async (req, res) => {
    const { search, stage_id, stage_status, product_type, print_type, include_delivered, status_tab } = req.query;
    let data: any[] | null = null;
    let error: any = null;

    try {
        const client = supabaseAdmin || supabase;
        const rpcRes = await client.rpc("get_orders_with_stages", {
            p_search: search ? String(search) : null,
            p_stage_id: stage_id ? Number(stage_id) : null,
            p_stage_status: stage_status ? String(stage_status) : null,
            p_product_type: product_type ? String(product_type) : null,
            p_print_type: print_type ? String(print_type) : null,
        });
        data = rpcRes.data;
        error = rpcRes.error;
    } catch (e) {
        error = e;
    }

    // Direct table SELECT fallback if RPC returns error or null/empty array
    if (error || !data || data.length === 0) {
        try {
            const client = supabaseAdmin || supabase;
            let query = client
                .from("orders")
                .select("*")
                .is("deleted_at", null)
                .order("deadline", { ascending: true });

            if (search) {
                const s = String(search).trim();
                query = query.or(`order_number.ilike.%${s}%,client_name.ilike.%${s}%,olist_order_number.ilike.%${s}%,observations.ilike.%${s}%`);
            }
            if (product_type) {
                query = query.eq("product_type", String(product_type));
            }
            if (print_type) {
                query = query.eq("print_type", String(print_type));
            }

            const { data: fallbackData, error: fbErr } = await query;
            if (!fbErr && fallbackData) {
                data = fallbackData;
                error = null;
            } else if (fbErr) {
                console.warn('[API] Aviso na busca fallback de pedidos:', fbErr);
            }
        } catch (fbErr) {
            console.warn('[API] Falha crítica na busca fallback de pedidos:', fbErr);
        }
    }

    if (checkError(error, res, "Erro ao buscar pedidos")) return;

    if (data && data.length > 0) {
        const orderIds = data.map((o: any) => o.id);
        const activeOrderIds = data
            .filter((o: any) => o.status !== "Entregue" && o.status !== "Cancelado")
            .map((o: any) => o.id);
        const targetOrderIds = activeOrderIds.length > 0 && orderIds.length > 200 ? activeOrderIds : orderIds;

        const { data: executions } = await supabaseAdmin
            .from("stage_executions")
            .select("order_id, status, stage_id, end_time, users(name)")
            .in("order_id", targetOrderIds);

        const operatorMap = new Map();
        const activeStageExecutionMap = new Map();
        const latestFinishedStageMap = new Map();
        const execStateByOrderStage = new Map<string, string>();

        if (executions) {
            executions.forEach((ex: any) => {
                const osKey = `${ex.order_id}_${Number(ex.stage_id)}`;
                const prevState = execStateByOrderStage.get(osKey);
                if (ex.status === "Finalizado") {
                    execStateByOrderStage.set(osKey, "Finalizado");
                } else if (ex.status === "Em andamento" && prevState !== "Finalizado") {
                    execStateByOrderStage.set(osKey, "Em andamento");
                } else if (ex.status === "Pausado" && !prevState) {
                    execStateByOrderStage.set(osKey, "Pausado");
                }

                if (ex.status === "Em andamento") {
                    operatorMap.set(ex.order_id, ex.users?.name || null);
                }
                if (ex.status === "Em andamento" || ex.status === "Pausado") {
                    const existing = activeStageExecutionMap.get(ex.order_id);
                    if (!existing || existing.status === "Pausado") {
                        activeStageExecutionMap.set(ex.order_id, {
                            status: ex.status,
                            stage_id: ex.stage_id,
                            operator: ex.users?.name || null
                        });
                    }
                } else if (ex.status === "Finalizado" && ex.end_time) {
                    const existing = latestFinishedStageMap.get(ex.order_id);
                    if (!existing || new Date(ex.end_time) > new Date(existing.end_time)) {
                        latestFinishedStageMap.set(ex.order_id, {
                            stage_id: ex.stage_id,
                            end_time: ex.end_time,
                            operator: ex.users?.name || null
                        });
                    }
                }
            });
        }

        // Enrich orders with items from orders table since RPC get_orders_with_stages does not include items column
        try {
            const { data: dbItems } = await supabaseAdmin
                .from("orders")
                .select("id, items")
                .in("id", targetOrderIds);

            if (dbItems) {
                const itemsMap = new Map();
                dbItems.forEach((row: any) => {
                    if (row.items) itemsMap.set(row.id, row.items);
                });
                data.forEach((order: any) => {
                    order.items = itemsMap.get(order.id) || order.items || [];
                });
            }
        } catch (err) {
            console.warn("[API] Failed to fetch items for active orders list:", err);
        }

        const { data: dbProgress } = await supabaseAdmin
            .from("order_stage_progress")
            .select("*")
            .in("order_id", targetOrderIds);

        const dbProgSet = new Set<string>();
        for (const p of dbProgress || []) {
            if (p && p.order_id !== undefined && p.stage_id !== undefined) {
                dbProgSet.add(`${p.order_id}_${Number(p.stage_id)}`);
            }
        }

        enrichOrdersWithProgressSync(data, dbProgress || []);

        // Fetch stage_observations for these orders to find the most recent observation of the active stage
        let observationsMap = new Map();
        try {
            const { data: obsData } = await supabaseAdmin
                .from("stage_observations")
                .select("order_id, stage_id, observation, created_at")
                .in("order_id", targetOrderIds)
                .order("created_at", { ascending: false });

            if (obsData) {
                obsData.forEach((obs: any) => {
                    const key = `${obs.order_id}_${obs.stage_id}`;
                    if (!observationsMap.has(key)) {
                        observationsMap.set(key, {
                            observation: obs.observation,
                            created_at: obs.created_at
                        });
                    }
                });
            }
        } catch (err) {
            console.warn("[API] Failed to fetch stage_observations for orders list:", err);
        }

        for (const order of data) {
            if (Array.isArray(order.stages_status)) {
                order.stages_status = order.stages_status
                    .map((st: any) => {
                        const osKey = `${order.id}_${Number(st.id)}`;
                        const execState = execStateByOrderStage.get(osKey);
                        const hasAuthoritativeProgress = dbProgSet.has(osKey);
                        if (execState === "Em andamento" || execState === "Pausado") {
                            return {
                                ...st,
                                in_progress: true,
                                status_operacao: execState === "Pausado" ? "PAUSADA" : "EM_ANDAMENTO",
                            };
                        }
                        if (execState === "Finalizado" && !hasAuthoritativeProgress) {
                            return { ...st, finished: true, in_progress: false };
                        }
                        return st;
                    });
            }

            order.current_operator = operatorMap.get(order.id) || null;
            order.active_stage_execution = activeStageExecutionMap.get(order.id) || null;
            
            // Etapas produtivas desconsideram a etapa legada Conferência
            const prodStages = (Array.isArray(order.stages_status) ? order.stages_status : [])
                .filter((s: any) => Number(s.id) !== 12 && !String(s.name || '').toLowerCase().includes('confer'));
            const isAllProdStagesFinished = prodStages.length > 0 && prodStages.every((s: any) => s.finished === true || s.status === 'Concluído' || s.status === 'Finalizado');

            // Auto-heal: transiciona pedido com todas as etapas produtivas concluídas para 'Pronto'
            if (isAllProdStagesFinished && order.status !== 'Pronto' && order.status !== 'Entregue' && order.status !== 'Cancelado') {
                order.status = 'Pronto';
                order.pcp_status = 'PRONTO';
                supabaseAdmin.from('orders').update({
                    status: 'Pronto',
                    pcp_status: 'PRONTO',
                    production_finished_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }).eq('id', order.id).then(() => {}, (err: any) => console.warn('[AutoSync] Error updating order to Pronto:', err));
            }

            const activeStage = prodStages.find((s: any) => !s.finished);
            order.active_stage_name = activeStage?.name || (isAllProdStagesFinished ? 'Concluído' : null);
            order.active_stage_observation = null;
            
            const unfinishedStages = prodStages.filter((s: any) => !s.finished);
            let newestObs = null;
            for (const st of unfinishedStages) {
                const obsKey = `${order.id}_${st.id}`;
                const obsObj = observationsMap.get(obsKey);
                if (obsObj) {
                    const obsTime = new Date(obsObj.created_at).getTime();
                    if (!newestObs || obsTime > newestObs.time) {
                        newestObs = {
                            text: obsObj.observation,
                            time: obsTime
                        };
                    }
                }
            }
            order.active_stage_observation = newestObs ? newestObs.text : null;

            // Enrich with latest finished stage
            const latestFinished = latestFinishedStageMap.get(order.id);
            order.latest_finished_stage = null;
            if (latestFinished) {
                const stageObj = (order.stages_status || []).find((s: any) => s.id === latestFinished.stage_id);
                order.latest_finished_stage = {
                    stage_id: latestFinished.stage_id,
                    stage_name: stageObj?.name || `Etapa #${latestFinished.stage_id}`,
                    end_time: latestFinished.end_time,
                    operator: latestFinished.operator
                };
            }

            // Fallback for dtf_location if stored in observations
            if (!order.dtf_location && order.observations) {
                const match = order.observations.match(/\[Gaveteiro:\s*([^\]]+)\]/);
                if (match) {
                    order.dtf_location = match[1];
                }
            }
        }

        // ── CONTAGEM OFICIAL NO BACKEND PARA ABAS / STATUS ──────────────────────
        const orderCounts = {
            ativos: 0,
            prontos: 0,
            entregues: 0,
            encerrados: 0,
            cancelados: 0,
            todos: data.length
        };
        for (const o of data) {
            const prodStages = (Array.isArray(o.stages_status) ? o.stages_status : [])
                .filter((s: any) => Number(s.id) !== 12 && !String(s.name || '').toLowerCase().includes('confer'));
            const isAllFinished = prodStages.length > 0 && prodStages.every((s: any) => s.finished === true || s.status === 'Concluído' || s.status === 'Finalizado');
            const isPronto = o.status === 'Pronto' || o.status === 'Concluído' || (o.status !== 'Entregue' && o.status !== 'Cancelado' && isAllFinished);
            if (o.status === 'Entregue') {
                orderCounts.entregues++;
                orderCounts.encerrados++;
            } else if (o.status === 'Cancelado') {
                orderCounts.cancelados++;
            } else if (isPronto) {
                orderCounts.prontos++;
            } else {
                orderCounts.ativos++;
            }
        }
        res.setHeader('X-Order-Counts', JSON.stringify(orderCounts));

        // ── FILTRAGEM OFICIAL NO BACKEND POR ABAS / STATUS ──────────────────────
        const selectedTab = String(status_tab || (include_delivered === 'true' ? 'todos' : 'ativos')).toLowerCase();
        if (selectedTab === 'ativos') {
            data = data.filter((o: any) => {
                const prodStages = (Array.isArray(o.stages_status) ? o.stages_status : [])
                    .filter((s: any) => Number(s.id) !== 12 && !String(s.name || '').toLowerCase().includes('confer'));
                const isAllFinished = prodStages.length > 0 && prodStages.every((s: any) => s.finished === true || s.status === 'Concluído' || s.status === 'Finalizado');
                return o.status !== 'Pronto' && o.status !== 'Entregue' && o.status !== 'Cancelado' && o.status !== 'Concluído' && !isAllFinished;
            });
        } else if (selectedTab === 'prontos') {
            data = data.filter((o: any) => {
                const prodStages = (Array.isArray(o.stages_status) ? o.stages_status : [])
                    .filter((s: any) => Number(s.id) !== 12 && !String(s.name || '').toLowerCase().includes('confer'));
                const isAllFinished = prodStages.length > 0 && prodStages.every((s: any) => s.finished === true || s.status === 'Concluído' || s.status === 'Finalizado');
                return o.status === 'Pronto' || o.status === 'Concluído' || (o.status !== 'Entregue' && o.status !== 'Cancelado' && isAllFinished);
            });
        } else if (selectedTab === 'entregues' || selectedTab === 'encerrados') {
            data = data.filter((o: any) => o.status === 'Entregue');
        } else if (selectedTab === 'cancelados') {
            data = data.filter((o: any) => o.status === 'Cancelado');
        } else if (selectedTab === 'todos' || selectedTab === 'historico') {
            // Retorna todos os pedidos
        }
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json(data);
});

// Endpoint leve para contadores de pedidos por aba
app.get("/api/orders/counts", async (_req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        const { data: orders, error } = await client
            .from("orders")
            .select("id, status, stages_status")
            .is("deleted_at", null);
        if (error || !orders) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.json({ ativos: 0, prontos: 0, entregues: 0, encerrados: 0, cancelados: 0, todos: 0 });
        }
        const counts = { ativos: 0, prontos: 0, entregues: 0, encerrados: 0, cancelados: 0, todos: orders.length };
        for (const o of orders) {
            const normStatus = normalizeUtf8Text(o.status);
            const prodStages = (Array.isArray(o.stages_status) ? o.stages_status : [])
                .filter((s: any) => Number(s.id) !== 12 && !String(s.name || '').toLowerCase().includes('confer'));
            const isAllFinished = prodStages.length > 0 && prodStages.every((s: any) => s.finished === true || s.status === 'Concluído' || s.status === 'Finalizado');
            const isPronto = normStatus === 'Pronto' || normStatus === 'Concluído' || (normStatus !== 'Entregue' && normStatus !== 'Cancelado' && isAllFinished);
            if (normStatus === 'Entregue') {
                counts.entregues++;
                counts.encerrados++;
            } else if (normStatus === 'Cancelado') {
                counts.cancelados++;
            } else if (isPronto) {
                counts.prontos++;
            } else {
                counts.ativos++;
            }
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.json(counts);
    } catch (_e) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.json({ ativos: 0, prontos: 0, entregues: 0, encerrados: 0, cancelados: 0, todos: 0 });
    }
});

app.get("/api/orders/:id/stage-observations", async (req, res) => {
    const orderId = Number(req.params.id);
    const { data, error } = await supabaseAdmin
        .from("stage_observations")
        .select("*, users(name)")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
    
    if (error) {
        console.warn(`[API] stage_observations query failed:`, error.message);
        return res.json([]);
    }
    
    const enriched = (data || []).map((o: any) => ({
        ...o,
        user_name: o.users?.name || 'Operador'
    }));
    
    return res.json(enriched);
});

const ALLOWED_UPLOAD_MIME_MAP: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/pjpeg': 'jpg',
    'image/png': 'png',
    'image/x-png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
};
const ALLOWED_UPLOAD_EXT_TO_MIME: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'pdf': 'application/pdf',
};

function resolveUploadMimeAndExt(file: any): { valid: boolean; ext: string; contentType: string } {
    const rawName = String(file?.originalname || '').trim();
    const hasDot = rawName.includes('.');
    const rawExt = hasDot ? (rawName.split('.').pop()?.toLowerCase() || '') : '';
    const rawMime = String(file?.mimetype || '').toLowerCase().trim();

    const extFromMime = ALLOWED_UPLOAD_MIME_MAP[rawMime] || '';
    const mimeFromExt = ALLOWED_UPLOAD_EXT_TO_MIME[rawExt] || '';

    if (extFromMime && (!rawExt || ALLOWED_UPLOAD_EXT_TO_MIME[rawExt])) {
        const finalExt = ALLOWED_UPLOAD_EXT_TO_MIME[rawExt] ? rawExt : extFromMime;
        const finalMime = ALLOWED_UPLOAD_EXT_TO_MIME[finalExt] || rawMime;
        return { valid: true, ext: finalExt, contentType: finalMime };
    }
    if (mimeFromExt && (!rawMime || rawMime === 'application/octet-stream')) {
        return { valid: true, ext: rawExt, contentType: mimeFromExt };
    }
    return { valid: false, ext: rawExt, contentType: rawMime };
}

async function uploadFileToArtesStorage(
    req: express.Request,
    filePath: string,
    buffer: Buffer,
    contentType: string
): Promise<{ publicUrl?: string; error?: any }> {
    let { error: uploadError } = await supabaseAdmin.storage
        .from('artes')
        .upload(filePath, buffer, {
            contentType,
            upsert: true,
        });

    if (uploadError && /bucket.*not found/i.test(String(uploadError.message || ''))) {
        try {
            await (supabaseAdmin.storage as any).createBucket?.('artes', { public: true, fileSizeLimit: 10485760 });
            const retryRes = await supabaseAdmin.storage
                .from('artes')
                .upload(filePath, buffer, {
                    contentType,
                    upsert: true,
                });
            uploadError = retryRes.error;
        } catch (bucketErr) {
            console.warn('[Upload] Aviso ao criar bucket artes:', bucketErr);
        }
    }

    if (uploadError && req.headers['authorization']) {
        try {
            const userScopedClient = createClient(
                supabaseUrl || DEFAULT_SUPABASE_URL,
                supabaseServiceRoleKey || supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY,
                {
                    auth: { autoRefreshToken: false, persistSession: false },
                    global: { headers: { Authorization: String(req.headers['authorization']) } },
                }
            );
            const retryAuth = await userScopedClient.storage
                .from('artes')
                .upload(filePath, buffer, {
                    contentType,
                    upsert: true,
                });
            if (!retryAuth.error) {
                uploadError = null;
            }
        } catch (scopedErr) {
            console.warn('[Upload] Fallback com token do usuário falhou:', scopedErr);
        }
    }

    if (uploadError) {
        return { error: uploadError };
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from('artes').getPublicUrl(filePath);
    return { publicUrl: publicUrlData.publicUrl };
}

const handleArtFilesUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = String(req.headers['authorization'] || '').trim();
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return res.status(401).json({
            error: "Não autenticado. Header Authorization com Bearer token é obrigatório.",
            code: "UNAUTHENTICATED",
        });
    }
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (!contentType.includes('multipart/form-data')) {
        return next();
    }
    upload.array("art_files", 10)(req, res, (err: any) => {
        if (err) {
            console.error("[Upload] Erro no multer ao processar art_files:", err);
            return res.status(400).json({ error: `Erro no upload do arquivo: ${err.message || 'Arquivo inválido ou excede o limite permitido'}` });
        }
        next();
    });
};

app.post("/api/orders", handleArtFilesUpload, isAdminOrComercial, async (req, res) => {
    const { client_name, product_type, print_type, quantity, deadline, observations, required_stages, num_colors } = req.body;
    let order_number = (req.body.order_number || '').trim();
    if (!order_number) {
        order_number = `PED-${Date.now().toString().slice(-6)}`;
    } else {
        if (!order_number.toUpperCase().startsWith('PED-') && !order_number.toUpperCase().startsWith('OLIST-')) {
            order_number = `PED-${order_number}`;
        }
    }
    const art_urls: string[] = [];

    const files = (req as any).files;
    const uploadErrors: string[] = [];
    console.log(`[API] Criando pedido. Arquivos recebidos: ${files?.length || 0}`);
    if (files && Array.isArray(files)) {
        for (const file of files) {
            const { valid, ext, contentType } = resolveUploadMimeAndExt(file);
            const cleanExt = valid ? ext : (file.originalname?.split('.').pop()?.toLowerCase() || 'png');
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${cleanExt}`;
            const filePath = `pedidos/${fileName}`;

            const { publicUrl, error: uploadError } = await uploadFileToArtesStorage(
                req,
                filePath,
                file.buffer,
                contentType || file.mimetype || 'image/png'
            );

            if (uploadError || !publicUrl) {
                console.error(`[API] Erro no upload da arte (${file.originalname}):`, uploadError);
                uploadErrors.push(`${file.originalname}: ${uploadError?.message || 'Erro no armazenamento'}`);
                continue;
            }

            art_urls.push(publicUrl);
        }
    }

    if (uploadErrors.length > 0) {
        return res.status(400).json({ 
            error: "Falha no upload de alguns arquivos", 
            details: uploadErrors 
        });
    }

    // 2. Estimate time
    const { data: estimateData } = await supabaseAdmin
        .from("orders")
        .select("total_time_seconds")
        .eq("product_type", product_type)
        .eq("print_type", print_type)
        .eq("num_colors", Number(num_colors) || 1)
        .eq("status", "Entregue");

    const totalSeconds = estimateData?.reduce(
        (sum: number, r: any) => sum + (r.total_time_seconds || 0), 0
    ) ?? 0;
    const estimated_time = estimateData && estimateData.length > 0
        ? Math.round(totalSeconds / estimateData.length)
        : 3600;

    // 3. Create order
    const { data, error } = await supabaseAdmin
        .from("orders")
        .insert({
            order_number,
            client_name: client_name || "Cliente Avulso",
            product_type,
            print_type,
            num_colors: Number(num_colors) || 1,
            quantity: Number(quantity),
            deadline,
            observations,
            estimated_time_seconds: estimated_time,
            art_url: art_urls[0] || null, // Primary image
            art_urls: art_urls, // All images
            required_stages: required_stages ? (typeof required_stages === 'string' ? JSON.parse(required_stages) : required_stages) : [],
        })
        .select("id")
        .single();

    if (checkError(error, res, "Erro ao criar pedido")) return;
    console.log(`[API] Pedido criado: ${order_number}. Imagens: ${art_urls.length}`);
    return res.json({ id: data.id, order_number, art_url: art_urls[0] || null, art_urls });
});

// Soft delete — mantém histórico de execuções intacto
app.delete("/api/orders/:id", isAdmin, async (req, res) => {
    const { id } = req.params;
    const usuario = getActorName(req, "Administrador");

    // 1. Fetch current order before soft-deleting
    const { data: order, error: fetchErr } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", Number(id))
        .single();

    if (fetchErr || !order) return res.status(404).json({ error: "Pedido não encontrado" });
    if (order.deleted_at) return res.status(400).json({ error: "Pedido já foi excluído" });

    // 2. Soft delete — only update deleted_at and deleted_by
    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
        .from("orders")
        .update({ deleted_at: now, deleted_by: usuario })
        .eq("id", Number(id));

    if (checkError(updateErr, res, "Erro ao excluir pedido")) return;

    // 3. Log to order_history
    await logOrderHistory(supabaseAdmin, {
        order_id: Number(id),
        usuario,
        acao: "excluiu",
        antes: order,
        depois: null,
        detalhes: "Exclusão lógica do pedido",
    });

    console.log(`[API] Pedido ${id} marcado como excluído (soft delete) por ${usuario}`);
    return res.json({ success: true });
});

app.post("/api/orders/:id/images", handleArtFilesUpload, canUploadOrderImages, async (req, res) => {
    const { id } = req.params;
    const files = (req as any).files;

    if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

    // Validação estrita de cada arquivo
    for (const file of files) {
        const { valid } = resolveUploadMimeAndExt(file);
        if (!valid) {
            return res.status(400).json({ error: `Tipo de arquivo não permitido (${file.originalname}). São permitidos apenas PNG, JPG/JPEG, WEBP, GIF e PDF.` });
        }
        if (file.size > MAX_FILE_SIZE) {
            return res.status(400).json({ error: `O arquivo ${file.originalname} excede o limite máximo permitido de 4MB.` });
        }
    }

    // 1. Get current order images
    const { data: order, error: fetchError } = await supabaseAdmin
        .from("orders")
        .select("art_urls, art_url")
        .eq("id", Number(id))
        .single();

    if (fetchError || !order) {
        return res.status(404).json({ error: "Pedido não encontrado" });
    }

    const current_urls = Array.isArray(order.art_urls) ? order.art_urls : (order.art_urls ? [order.art_urls] : []);
    const new_urls: string[] = [];

    // 2. Upload new files com caminho isolado por pedido e UUID anti-colisão
    const uploadErrors: string[] = [];
    for (const file of files) {
        const { ext: cleanExt, contentType } = resolveUploadMimeAndExt(file);
        const safeBaseName = (file.originalname || 'imagem')
            .replace(/\.[^/.]+$/, "")
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .substring(0, 30) || 'imagem';
        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const filePath = `pedidos/${Number(id)}/${uniqueSuffix}-${safeBaseName}.${cleanExt}`;

        const { publicUrl, error: uploadError } = await uploadFileToArtesStorage(
            req,
            filePath,
            file.buffer,
            contentType
        );

        if (uploadError || !publicUrl) {
            console.error(`[API] Erro no upload da arte (${file.originalname}):`, uploadError);
            uploadErrors.push(`${file.originalname}: ${uploadError?.message || 'Erro no armazenamento'}`);
            continue;
        }

        new_urls.push(publicUrl);
    }

    if (uploadErrors.length > 0) {
        return res.status(400).json({ 
            error: "Falha no upload de alguns arquivos", 
            details: uploadErrors 
        });
    }

    const updated_urls = Array.from(new Set([...current_urls, ...new_urls]));
    const primaryUrl = order.art_url || updated_urls[0] || null;

    // 3. Update order somente após upload bem-sucedido
    const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
            art_urls: updated_urls,
            art_url: primaryUrl
        })
        .eq("id", Number(id));

    if (checkError(updateError, res, "Erro ao atualizar imagens do pedido")) return;

    // 4. Registro formal de auditoria
    const usuario = getActorName(req, "Operador");
    await logOrderHistory(supabaseAdmin, {
        order_id: Number(id),
        usuario,
        acao: "anexou_imagem",
        antes: { art_urls: current_urls },
        depois: { art_urls: updated_urls, art_url: primaryUrl },
        detalhes: `Upload de ${new_urls.length} arquivo(s): ${files.map((f: any) => f.originalname).join(', ')}`
    });
    await writeAuditLogStore(supabaseAdmin, {
        entidade: "orders",
        order_id: Number(id),
        user_id: getActorId(req),
        usuario,
        acao: "UPLOAD_IMAGEM_PEDIDO",
        observacao: `Upload de ${new_urls.length} arquivo(s): ${files.map((f: any) => f.originalname).join(', ')}`,
        valor_anterior: { art_urls: current_urls },
        valor_novo: { art_urls: updated_urls, art_url: primaryUrl },
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json({ success: true, art_urls: updated_urls, art_url: primaryUrl });
});

app.delete("/api/orders/:id/images", isAdminOrComercial, async (req, res) => {
    const { id } = req.params;
    const { image_url } = req.body;

    if (!image_url) {
        return res.status(400).json({ error: "URL da imagem não informada." });
    }

    const { data: order, error: fetchError } = await supabaseAdmin
        .from("orders")
        .select("art_urls, art_url")
        .eq("id", Number(id))
        .single();

    if (fetchError || !order) {
        return res.status(404).json({ error: "Pedido não encontrado." });
    }

    const current_urls: string[] = Array.isArray(order.art_urls) ? order.art_urls : (order.art_urls ? [order.art_urls] : []);
    const updated_urls = current_urls.filter((u: string) => u !== image_url);
    const primaryUrl = (order.art_url === image_url ? (updated_urls[0] || null) : order.art_url);

    try {
        const marker = '/storage/v1/object/public/artes/';
        const idx = image_url.indexOf(marker);
        if (idx !== -1) {
            const storagePath = decodeURIComponent(image_url.substring(idx + marker.length));
            await supabaseAdmin.storage.from('artes').remove([storagePath]);
        }
    } catch (stErr) {
        console.warn("[Storage] Falha não impeditiva ao remover do storage:", stErr);
    }

    const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
            art_urls: updated_urls,
            art_url: primaryUrl
        })
        .eq("id", Number(id));

    if (checkError(updateError, res, "Erro ao remover imagem do pedido")) return;

    await logOrderHistory(supabaseAdmin, {
        order_id: Number(id),
        usuario: getActorName(req, "Administrador"),
        acao: "removeu_imagem",
        antes: { total_imagens: current_urls.length, imagem_removida: image_url },
        depois: { total_imagens: updated_urls.length },
        detalhes: `Remoção de anexo de imagem do pedido #${id}`
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json({ success: true, art_urls: updated_urls, art_url: primaryUrl });
});

app.patch("/api/orders/:id/status", isPcpOrSupervisorOrAdmin, async (req, res) => {
    const { status } = req.body;
    const updates: any = { status };
    if (status === 'Entregue') {
        updates.delivered_at = new Date().toISOString();
    } else {
        updates.delivered_at = null;
    }
    const { error } = await supabaseAdmin
        .from("orders")
        .update(updates)
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// Update DTF checklist status and drawer location
app.patch("/api/orders/:id/dtf", canOperateProduction, async (req, res) => {
    const orderId = Number(req.params.id);
    const { dtf_complete, dtf_location } = req.body;

    if (dtf_complete === undefined && dtf_location === undefined) {
        return res.status(400).json({ error: "Falta o campo dtf_complete ou dtf_location" });
    }

    // 1. Fetch current order for audit log
    const { data: currentOrder, error: fetchErr } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

    if (fetchErr || !currentOrder) return res.status(404).json({ error: "Pedido não encontrado" });

    // 2. Perform update
    const updates: any = {};
    if (dtf_complete !== undefined) updates.dtf_complete = dtf_complete;
    if (dtf_location !== undefined) updates.dtf_location = dtf_location;

    const { error: updateErr } = await supabaseAdmin
        .from("orders")
        .update(updates)
        .eq("id", orderId);

    if (checkError(updateErr, res, "Erro ao atualizar status ou gaveteiro do DTF")) return;

    // 3. Log to order_history
    const usuario = getActorName(req, "Operador");
    await logOrderHistory(supabaseAdmin, {
        order_id: orderId,
        usuario,
        acao: "editou",
        antes: { dtf_complete: currentOrder.dtf_complete, dtf_location: currentOrder.dtf_location },
        depois: updates,
        detalhes: "Edição de status/localização DTF",
    });

    return res.json({ success: true });
});

// Full order edit with validation and audit log
app.patch("/api/orders/:id", isAdminOrComercial, async (req, res) => {
    const orderId = Number(req.params.id);
    const usuario = getActorName(req, "Administrador");
    const confirmFinalized = req.headers["x-confirm-finalized"] === "true";

    const { client_name, product_type, print_type, quantity, deadline, observations, required_stages, num_colors, art_urls, art_url, dtf_complete, dtf_location } = req.body;

    // ── Validations ──────────────────────────────────────────────────────────
    if (quantity !== undefined && Number(quantity) <= 0) {
        return res.status(400).json({ error: "Quantidade deve ser maior que zero" });
    }
    if (num_colors !== undefined && Number(num_colors) < 1) {
        return res.status(400).json({ error: "Número de cores deve ser pelo menos 1" });
    }

    // 1. Fetch current order for audit log + finalized check
    const { data: currentOrder, error: fetchErr } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

    if (fetchErr || !currentOrder) return res.status(404).json({ error: "Pedido não encontrado" });
    if (currentOrder.deleted_at) return res.status(400).json({ error: "Não é possível editar um pedido excluído" });
    if (currentOrder.status === "Entregue" && !confirmFinalized) {
        return res.status(409).json({ error: "CONFIRM_FINALIZED", message: "Este pedido já foi entregue. Deseja mesmo editá-lo?" });
    }

    // 2. Build update payload with only provided fields
    const updates: any = {};
    if (client_name !== undefined) updates.client_name = client_name;
    if (product_type !== undefined) updates.product_type = product_type;
    if (print_type !== undefined) updates.print_type = print_type;
    if (quantity !== undefined) updates.quantity = Number(quantity);
    if (deadline !== undefined) updates.deadline = deadline || null;
    if (observations !== undefined) updates.observations = observations;
    if (required_stages !== undefined) updates.required_stages = required_stages;
    if (num_colors !== undefined) updates.num_colors = Number(num_colors);
    if (art_urls !== undefined) updates.art_urls = art_urls;
    if (art_url !== undefined) updates.art_url = art_url;
    if (dtf_complete !== undefined) updates.dtf_complete = dtf_complete;
    if (dtf_location !== undefined) updates.dtf_location = dtf_location;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    // 3. Perform update
    const { error: updateErr } = await supabaseAdmin
        .from("orders")
        .update(updates)
        .eq("id", orderId);

    if (checkError(updateErr, res, "Erro ao atualizar pedido")) return;

    // 4. Log to order_history
    await logOrderHistory(supabaseAdmin, {
        order_id: orderId,
        usuario,
        acao: "editou",
        antes: currentOrder,
        depois: { ...currentOrder, ...updates },
        detalhes: "Atualização cadastral do pedido",
    });

    return res.json({ success: true });
});

// Cancel order — atomic transactional RPC with history, allocations, and audit
app.patch("/api/orders/:id/cancel", isAdminOrComercial, async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const actorId = getActorId(req);
        if (!actorId) {
            return res.status(401).json({ error: "Sessão inválida ou sem identificação de usuário." });
        }
        const { reason, idempotency_key } = req.body || {};
        const { data, error } = await supabaseAdmin.rpc("pcp_tx_cancel_order", {
            p_order_id: orderId,
            p_user_id: actorId,
            p_reason: reason || null,
            p_idempotency_key: idempotency_key || null
        });
        if (error) {
            console.error("[API] Erro ao cancelar pedido via RPC:", error);
            const isNotFound = error.message?.includes('ORDER_NOT_FOUND');
            const isBadRequest = error.message?.includes('ORDER_DELETED') || error.message?.includes('USER_ID_REQUIRED');
            const status = isNotFound ? 404 : (isBadRequest ? 400 : 500);
            return res.status(status).json({ error: error.message });
        }
        return res.json(data || { success: true });
    } catch (err: any) {
        console.error("[API] Erro interno ao cancelar pedido:", err);
        return res.status(500).json({ error: err.message || "Erro interno ao processar cancelamento" });
    }
});

// Order history / audit log
app.get("/api/orders/:id/history", isAdminOrComercial, async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("order_history")
        .select("*")
        .eq("order_id", Number(req.params.id))
        .order("created_at", { ascending: false });
    if (checkError(error, res, "Erro ao buscar histórico")) return;
    return res.json(data || []);
});

// ── Consolidated Cutting Panel APIs ──────────────────────────────────────────

// GET /api/cutting/consolidated-demand
app.get("/api/cutting/consolidated-demand", async (_req, res) => {
    try {
        const { data: activeOrders, error } = await supabaseAdmin
            .from("orders")
            .select("*")
            .is("deleted_at", null)
            .not("status", "in", '("Entregue","Cancelado")');

        if (error) {
            console.error("[API] Erro ao buscar pedidos ativos para corte consolidado:", error);
            return res.status(500).json({ error: "Erro ao buscar demanda de corte" });
        }

        const demandList = aggregateCuttingDemand(activeOrders || []);
        return res.json(demandList);
    } catch (err: any) {
        console.error("[API] Erro no endpoint de corte consolidado:", err);
        return res.status(500).json({ error: "Erro ao processar demanda consolidada de corte" });
    }
});

// POST /api/cutting/register-consolidated
app.post("/api/cutting/register-consolidated", canOperateProduction, async (req, res) => {
    try {
        const actorId = getActorId(req);
        if (!actorId) {
            return res.status(401).json({ error: "Identificação do operador obrigatória na sessão.", code: "USER_ID_REQUIRED" });
        }

        const { item_key, quantidade_cortada, idempotency_key, allocations } = req.body || {};

        if (!item_key) {
            return res.status(400).json({ error: "Item a cortar é obrigatório." });
        }
        const cutQty = Number(quantidade_cortada);
        if (!cutQty || cutQty <= 0) {
            return res.status(400).json({ error: "Quantidade cortada deve ser maior que 0." });
        }

        const effectiveKey = idempotency_key || (req.headers["x-idempotency-key"] as string) || null;

        const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("pcp_tx_register_consolidated_cutting", {
            p_item_key: item_key,
            p_quantidade_cortada: cutQty,
            p_idempotency_key: effectiveKey,
            p_user_id: actorId,
            p_allocations: allocations || null
        });

        if (rpcErr) {
            console.error("[API] Erro na RPC pcp_tx_register_consolidated_cutting:", rpcErr);
            return res.status(400).json({ error: rpcErr.message || "Erro ao registrar corte consolidado via RPC." });
        }

        return res.json(rpcResult);
    } catch (err: any) {
        console.error("[API] Erro ao registrar corte consolidado:", err);
        return res.status(500).json({ error: "Erro ao registrar produção consolidada de corte." });
    }
});

// GET /api/cutting/allocations
app.get("/api/cutting/allocations", async (_req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("corte_allocations")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[API] Erro ao buscar alocações de corte:", error);
            return res.status(500).json({ error: "Erro ao buscar alocações de corte." });
        }
        return res.json(data || []);
    } catch (err: any) {
        return res.status(500).json({ error: "Erro interno ao buscar alocações de corte." });
    }
});

// POST /api/cutting/optitex-risco
app.post("/api/cutting/optitex-risco", isPcpOrSupervisorOrAdmin, async (req, res) => {
    try {
        const actorId = getActorId(req);
        if (!actorId) {
            return res.status(401).json({ error: "Identificação do operador obrigatória na sessão.", code: "USER_ID_REQUIRED" });
        }

        const record = req.body;
        if (!record || !record.model || !record.composicao) {
            return res.status(400).json({ error: "Dados inválidos de risco Optitex." });
        }
        record.id = record.id || `opt-${Date.now()}`;
        record.created_at = record.created_at || new Date().toISOString();
        record.user_id = actorId;

        const { data, error } = await supabaseAdmin.from("optitex_riscos_validados").upsert([record]).select("*").single();
        if (error) {
            console.error("[API] Erro ao salvar optitex_riscos_validados:", error);
            return res.status(500).json({ error: error.message || "Erro ao salvar validação do Optitex." });
        }

        return res.json({ success: true, record: data || record });
    } catch (err: any) {
        return res.status(500).json({ error: "Erro ao processar validação do Optitex." });
    }
});

// GET /api/cutting/optitex-riscos
app.get("/api/cutting/optitex-riscos", async (_req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("optitex_riscos_validados")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[API] Erro ao buscar riscos Optitex:", error);
            return res.status(500).json({ error: "Erro ao buscar riscos Optitex." });
        }
        return res.json(data || []);
    } catch (err: any) {
        return res.status(500).json({ error: "Erro interno ao buscar riscos Optitex." });
    }
});

// POST /api/cutting/approved-plans
app.post("/api/cutting/approved-plans", isPcpOrSupervisorOrAdmin, async (req, res) => {
    try {
        const actorId = getActorId(req);
        if (!actorId) {
            return res.status(401).json({ error: "Identificação do operador obrigatória na sessão.", code: "USER_ID_REQUIRED" });
        }

        const planRecord = req.body;
        if (!planRecord || !planRecord.id) {
            return res.status(400).json({ error: "Plano inválido." });
        }
        planRecord.user_id = actorId;
        planRecord.approved_at = planRecord.approved_at || new Date().toISOString();

        const { data, error } = await supabaseAdmin.from("approved_enfesto_plans").upsert([planRecord]).select("*").single();
        if (error) {
            console.error("[API] Erro ao salvar approved_enfesto_plans:", error);
            return res.status(500).json({ error: error.message || "Erro ao salvar plano aprovado." });
        }

        return res.json({ success: true, plan: data || planRecord });
    } catch (err: any) {
        return res.status(500).json({ error: "Erro ao processar plano aprovado." });
    }
});

// GET /api/cutting/approved-plans
app.get("/api/cutting/approved-plans", async (_req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("approved_enfesto_plans")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[API] Erro ao buscar planos aprovados:", error);
            return res.status(500).json({ error: "Erro ao buscar planos aprovados." });
        }
        return res.json(data || []);
    } catch (err: any) {
        return res.status(500).json({ error: "Erro interno ao buscar planos aprovados." });
    }
});

// POST /api/cutting/ramado-decision
app.post("/api/cutting/ramado-decision", isPcpOrSupervisorOrAdmin, async (req, res) => {
    try {
        const actorId = getActorId(req);
        if (!actorId) {
            return res.status(401).json({ error: "Identificação do operador obrigatória na sessão.", code: "USER_ID_REQUIRED" });
        }

        const {
            model,
            fabric,
            color,
            tipo_tecido,
            decision,
            plano_exato,
            plano_otimizado,
            excedente_proposto,
            excedente_total,
            riscos_antes,
            riscos_depois,
            ganho_operacional,
            idempotency_key
        } = req.body || {};

        if (!model || !decision) {
            return res.status(400).json({ error: "Modelo e decisão são obrigatórios." });
        }

        const effectiveKey = idempotency_key || (req.headers["x-idempotency-key"] as string) || null;

        const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("pcp_tx_record_ramado_decision", {
            p_model: model,
            p_fabric: fabric || 'RAMADO',
            p_color: color || '',
            p_tipo_tecido: tipo_tecido || 'RAMADO',
            p_decision: decision,
            p_plano_exato: plano_exato || {},
            p_plano_otimizado: plano_otimizado || null,
            p_excedente_proposto: excedente_proposto || null,
            p_excedente_total: Number(excedente_total) || 0,
            p_riscos_antes: Number(riscos_antes) || 0,
            p_riscos_depois: Number(riscos_depois) || 0,
            p_ganho_operacional: ganho_operacional || null,
            p_user_id: actorId,
            p_idempotency_key: effectiveKey
        });

        if (rpcErr) {
            console.error("[API] Erro na RPC pcp_tx_record_ramado_decision:", rpcErr);
            return res.status(400).json({ error: rpcErr.message || "Erro ao registrar decisão RAMADO via RPC." });
        }

        return res.json(rpcResult);
    } catch (err: any) {
        console.error("[API] Erro ao registrar decisão RAMADO:", err);
        return res.status(500).json({ error: "Erro ao registrar decisão de excedente RAMADO." });
    }
});

// GET /api/cutting/ramado-decisions
app.get("/api/cutting/ramado-decisions", async (_req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("ramado_decisions")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[API] Erro ao buscar decisões RAMADO:", error);
            return res.status(500).json({ error: "Erro ao buscar decisões RAMADO." });
        }
        return res.json(data || []);
    } catch (err: any) {
        return res.status(500).json({ error: "Erro interno ao buscar decisões RAMADO." });
    }
});

// GET /api/cutting/producao-excedentes
app.get("/api/cutting/producao-excedentes", async (_req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("producao_excedentes")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[API] Erro ao buscar excedentes de produção:", error);
            return res.status(500).json({ error: "Erro ao buscar excedentes de produção." });
        }
        return res.json(data || []);
    } catch (err: any) {
        return res.status(500).json({ error: "Erro interno ao buscar excedentes de produção." });
    }
});


// ── Stages ────────────────────────────────────────────────────────────────
app.get("/api/stages", async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("stages")
        .select("*")
        .eq("active", 1)
        .order("sort_order");
    if (checkError(error, res)) return;
    const enriched = (data || []).map((s: any) => ({
        ...s,
        name: normalizeUtf8Text(s.name),
        sector_name: s.sector_name ? normalizeUtf8Text(s.sector_name) : s.sector_name,
        slug: getStageSlug(s),
        code: getStageSlug(s),
    }));
    return res.json(enriched);
});

app.post("/api/stages", isPcpOrSupervisorOrAdmin, async (req, res) => {
    const { name, average_time_seconds, ideal_time, calculation_type, meta_diaria } = req.body;
    const { data: maxData } = await supabaseAdmin
        .from("stages")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();
    const sort_order = (maxData?.sort_order || 0) + 1;

    const result = await supabaseAdmin
        .from("stages")
        .insert({ 
            name, 
            sort_order, 
            average_time_seconds: Number(average_time_seconds) || 0,
            ideal_time: Number(ideal_time) || Number(average_time_seconds) || 0,
            calculation_type: calculation_type || 'por_peca',
            meta_diaria: meta_diaria !== undefined && meta_diaria !== null ? Number(meta_diaria) : null
        })
        .select()
        .single();

    if (checkError(result.error, res)) return;
    return res.json(result.data);
});

app.patch("/api/stages/:id", isPcpOrSupervisorOrAdmin, async (req, res) => {
    const { name, active, sort_order, average_time_seconds, ideal_time, calculation_type, meta_diaria } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (active !== undefined) updates.active = active;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (average_time_seconds !== undefined) updates.average_time_seconds = Number(average_time_seconds);
    if (ideal_time !== undefined) updates.ideal_time = Number(ideal_time);
    if (calculation_type !== undefined) updates.calculation_type = calculation_type;
    if (meta_diaria !== undefined) updates.meta_diaria = meta_diaria !== null ? Number(meta_diaria) : null;

    const result = await supabaseAdmin
        .from("stages")
        .update(updates)
        .eq("id", Number(req.params.id));

    if (checkError(result.error, res)) return;
    return res.json({ success: true });
});

app.delete("/api/stages/:id", isAdmin, async (req, res) => {
    const { error } = await supabaseAdmin
        .from("stages")
        .update({ active: 0 })
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// ── Loss Reasons & Re-entry Configuration ──────────────────────────────────
app.get("/api/loss-reasons", async (_req, res) => {
    try {
        const reasons = await getLossReasons(supabaseAdmin);
        return res.json(reasons);
    } catch (err: any) {
        console.error("[API] Erro ao buscar motivos de perda:", err);
        return res.status(500).json({ error: "Erro ao buscar motivos de perda" });
    }
});

app.patch("/api/loss-reasons", isAdmin, async (req, res) => {
    try {
        const { reasons } = req.body;
        if (!Array.isArray(reasons)) {
            return res.status(400).json({ error: "Parâmetro 'reasons' deve ser um array." });
        }
        const updated = await updateLossReasons(supabaseAdmin, reasons);
        return res.json({ success: true, reasons: updated });
    } catch (err: any) {
        console.error("[API] Erro ao atualizar motivos de perda:", err);
        return res.status(500).json({ error: "Erro ao atualizar motivos de perda" });
    }
});

// ── Partial Progress & Loss Logging ────────────────────────────────────────
app.get("/api/orders/:id/stage-progress", async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const progressList = await getStageProgressForOrder(supabaseAdmin, orderId);
        return res.json(progressList);
    } catch (err: any) {
        console.error("[API] Erro ao buscar progresso do pedido:", err);
        return res.status(500).json({ error: "Erro ao buscar progresso do pedido" });
    }
});

app.post("/api/orders/:id/stages/:stageId/progress", canOperateProduction, async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const stageId = Number(req.params.stageId);
        const {
            incremento,
            quantidade_perdida,
            quantidade_retrabalho,
            quantidade_transferida,
            next_stage_id,
            observacao,
            transfer_to_next,
            idempotency_key,
            is_reposition,
            order_item_id,
            supervisor_override,
            override_reason,
        } = req.body;

        if ((!incremento || Number(incremento) <= 0) && (!quantidade_perdida || Number(quantidade_perdida) <= 0) && (!quantidade_retrabalho || Number(quantidade_retrabalho) <= 0)) {
            return res.status(400).json({ error: "Quantidade incremental deve ser maior que 0." });
        }

        const actorId = getActorId(req);
        if (!actorId) {
            return res.status(401).json({ error: "Identificação de usuário obrigatória.", code: "USER_ID_REQUIRED" });
        }

        const actorRole = String((req as any).authUser?.role ?? (req as any).user?.role ?? '');
        const isPrivileged = actorRole === 'Administrador' || actorRole === 'Supervisor' || actorRole === 'PCP';
        const effectiveOverride = Boolean(supervisor_override) && isPrivileged;
        const effectiveReason = override_reason || observacao || (effectiveOverride ? `Apontamento autorizado por ${actorRole || 'Administrador'}` : null);
        const effectiveKey = idempotency_key || (req.headers["x-idempotency-key"] as string) || `prog_${orderId}_${stageId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const transferInc = quantidade_transferida !== undefined ? Number(quantidade_transferida) : (transfer_to_next ? Number(incremento) || 0 : 0);

        const { data: rpcRecordData, error: rpcRecordErr } = await supabaseAdmin.rpc("rpc_record_production", {
            p_order_id: orderId,
            p_stage_id: stageId,
            p_user_id: actorId,
            p_idempotency_key: String(effectiveKey).trim(),
            p_good_inc: Number(incremento) || 0,
            p_lost_inc: Number(quantidade_perdida) || 0,
            p_rework_inc: Number(quantidade_retrabalho) || 0,
            p_transfer_inc: transferInc,
            p_next_stage_id: next_stage_id ? Number(next_stage_id) : null,
            p_observation: observacao || null,
            p_is_reposition: Boolean(is_reposition),
            p_order_item_id: order_item_id ? Number(order_item_id) : null,
            p_supervisor_override: effectiveOverride,
            p_override_reason: effectiveReason,
        });

        if (rpcRecordErr) {
            console.error("[API] Erro crítico: RPC rpc_record_production falhou ou não existe no Supabase:", rpcRecordErr);
            return res.status(500).json({
                error: `Erro na execução da RPC rpc_record_production: ${rpcRecordErr.message}`,
                details: rpcRecordErr,
                code: "RPC_EXECUTION_ERROR"
            });
        }

        if (observacao) {
            try {
                await supabaseAdmin.from("stage_observations").insert({
                    order_id: orderId,
                    stage_id: stageId,
                    user_id: actorId,
                    observation: observacao,
                });
            } catch (obsErr) {
                console.warn("[API] Aviso ao registrar observação da etapa:", obsErr);
            }
        }

        const httpStatus = Number(rpcRecordData?.http_status) || 200;

        // Sincronização atômica de stages_status no pedido para garantir fonte única da verdade
        if (httpStatus >= 200 && httpStatus < 300) {
            try {
                const { data: ordRow } = await supabaseAdmin
                    .from("orders")
                    .select("stages_status, quantity")
                    .eq("id", orderId)
                    .maybeSingle();

                if (ordRow && Array.isArray(ordRow.stages_status)) {
                    const updatedStagesStatus = ordRow.stages_status.map((st: any) => {
                        if (Number(st.id) === stageId) {
                            const newGood = rpcRecordData?.quantidade_boa !== undefined ? Number(rpcRecordData.quantidade_boa) : ((st.quantidade_boa || 0) + (Number(incremento) || 0));
                            const newPending = rpcRecordData?.saldo_pendente !== undefined ? Number(rpcRecordData.saldo_pendente) : Math.max(0, (ordRow.quantity || 0) - newGood);
                            const newStatusOp = rpcRecordData?.status_operacao || (newPending === 0 ? 'CONCLUIDA' : 'PARCIAL');
                            const isFin = Boolean(rpcRecordData?.finished || (newPending === 0 && newGood > 0));
                            return {
                                ...st,
                                quantidade_boa: newGood,
                                saldo_pendente: newPending,
                                status_operacao: newStatusOp,
                                finished: isFin,
                                status: isFin ? 'Concluído' : st.status,
                            };
                        }
                        return st;
                    });

                    await supabaseAdmin
                        .from("orders")
                        .update({
                            stages_status: updatedStagesStatus,
                            updated_at: new Date().toISOString()
                        })
                        .eq("id", orderId);
                }
            } catch (syncErr) {
                console.warn("[API] Aviso ao sincronizar stages_status após progresso:", syncErr);
            }
        }

        return res.status(httpStatus).json({
            ...rpcRecordData,
            progress: rpcRecordData,
        });
    } catch (err: any) {
        console.error("[API] Erro ao registrar progresso parcial:", err);
        return res.status(500).json({ error: "Erro ao registrar progresso parcial" });
    }
});

app.post("/api/orders/:id/stages/:stageId/loss", canOperateProduction, async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const stageId = Number(req.params.stageId);
        const {
            quantidade_perdida,
            motivo,
            motivo_detalhe,
            etapa_reentrada_id,
            order_item_id,
            idempotency_key,
            supervisor_override,
            override_reason
        } = req.body;

        if (!quantidade_perdida || Number(quantidade_perdida) <= 0) {
            return res.status(400).json({ error: "Quantidade perdida deve ser maior que 0.", code: "INVALID_QUANTITY" });
        }
        if (!motivo || !String(motivo).trim()) {
            return res.status(400).json({ error: "Motivo da perda é obrigatório.", code: "REASON_REQUIRED" });
        }
        if (motivo === "Outro" && (!motivo_detalhe || !motivo_detalhe.trim())) {
            return res.status(400).json({ error: "Detalhamento obrigatório para o motivo 'Outro'.", code: "REASON_DETAIL_REQUIRED" });
        }

        const rawIdempotency = (req.headers["x-idempotency-key"] as string) || (idempotency_key as string) || "";
        const sanitizedIdempotencyKey = String(rawIdempotency).trim();
        if (!sanitizedIdempotencyKey) {
            return res.status(400).json({
                error: "Chave de idempotência (x-idempotency-key no cabeçalho ou idempotency_key no corpo) é estritamente obrigatória para apontamento de perdas.",
                code: "IDEMPOTENCY_KEY_REQUIRED"
            });
        }

        const actorId = getActorId(req);
        if (!actorId) {
            return res.status(401).json({ error: "Identificação de usuário obrigatória.", code: "USER_ID_REQUIRED" });
        }

        const actorRole = String((req as any).authUser?.role ?? (req as any).user?.role ?? '');
        const isPrivileged = actorRole === 'Administrador' || actorRole === 'Supervisor' || actorRole === 'PCP';
        const effectiveOverride = Boolean(supervisor_override) && isPrivileged;
        const effectiveReason = override_reason || (effectiveOverride ? `Registro de perda por ${actorRole || 'Administrador'}` : null);

        const { data: rpcLossData, error: rpcLossErr } = await supabaseAdmin.rpc("rpc_record_loss", {
            p_order_id: orderId,
            p_stage_id: stageId,
            p_user_id: actorId,
            p_lost_qty: Number(quantidade_perdida),
            p_reason: motivo,
            p_reason_detail: motivo_detalhe || null,
            p_reentry_stage_id: etapa_reentrada_id ? Number(etapa_reentrada_id) : null,
            p_order_item_id: order_item_id ? Number(order_item_id) : null,
            p_idempotency_key: sanitizedIdempotencyKey,
            p_supervisor_override: effectiveOverride,
            p_override_reason: effectiveReason,
        });

        if (rpcLossErr) {
            console.error("[API] Erro ao executar rpc_record_loss:", rpcLossErr);
            return res.status(500).json({
                error: `Erro ao registrar perda: ${rpcLossErr.message}`,
                details: rpcLossErr,
                code: "RPC_EXECUTION_ERROR",
            });
        }

        const httpStatus = Number(rpcLossData?.http_status) || 200;
        return res.status(httpStatus).json(rpcLossData);
    } catch (err: any) {
        console.error("[API] Erro ao registrar perda:", err);
        return res.status(500).json({ error: "Erro ao registrar perda" });
    }
});

// ── Loss & Rework Bottleneck Report ────────────────────────────────────────
app.get("/api/reports/losses", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await getLossReportDataStore(supabaseAdmin, startDate as string, endDate as string);
        return res.json(data);
    } catch (err: any) {
        console.error("[API] Erro ao gerar relatório de perdas:", err);
        return res.status(500).json({ error: "Erro ao gerar relatório de perdas" });
    }
});

// ── Collaborator Stage Goals Overrides ─────────────────────────────────────
app.get("/api/collaborator-goals", async (_req, res) => {
    const { data, error } = await supabaseAdmin
        .from("collaborator_stage_goals")
        .select("*, users(name), stages(name)");
    if (checkError(error, res)) return;
    const formatted = (data || []).map((item: any) => ({
        ...item,
        user_name: item.users?.name,
        stage_name: item.stages?.name
    }));
    return res.json(formatted);
});

app.post("/api/collaborator-goals", isPcpOrSupervisorOrAdmin, async (req, res) => {
    const targetUserId = Number(req.body?.user_id);
    const targetStageId = Number(req.body?.stage_id);
    const metaDiaria = Number(req.body?.meta_diaria);

    if (!targetUserId || targetUserId <= 0) {
        return res.status(400).json({ error: "Colaborador inválido para atribuição de meta." });
    }
    if (!targetStageId || targetStageId <= 0) {
        return res.status(400).json({ error: "Etapa inválida para atribuição de meta." });
    }

    const { data, error } = await supabaseAdmin
        .from("collaborator_stage_goals")
        .upsert({
            user_id: targetUserId,
            stage_id: targetStageId,
            meta_diaria: metaDiaria || 0,
            updated_at: new Date().toISOString()
        }, { onConflict: "user_id,stage_id" })
        .select()
        .single();
    if (checkError(error, res)) return;
    return res.json(data);
});

app.delete("/api/collaborator-goals/:id", isAdmin, async (req, res) => {
    const { error } = await supabaseAdmin
        .from("collaborator_stage_goals")
        .delete()
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

app.get("/api/executions/active/:userId", async (req, res) => {
    const { data: executions, error } = await supabaseAdmin
        .from("stage_executions")
        .select(`
            *,
            stages ( name ),
            orders ( order_number )
        `)
        .eq("user_id", Number(req.params.userId))
        .eq("status", "Em andamento")
        .order("start_time", { ascending: false });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    if (!executions || executions.length === 0) return res.json([]);

    // Fetch all pauses for these executions to calculate accumulated time
    const executionIds = executions.map(e => e.id);
    const { data: pauses } = await supabaseAdmin
        .from("pauses")
        .select("*")
        .in("execution_id", executionIds);

    const nowMs = new Date().getTime();
    const formatted = executions.map((e: any) => {
        const itemPauses = (pauses || []).filter(p => p.execution_id === e.id);
        const { totalAccumulatedSeconds, currentSessionSeconds, isPaused } = calculateExecutionTimes(e, itemPauses, nowMs);

        return {
            ...e,
            stage_name: e.stages?.name,
            order_number: e.orders?.order_number,
            accumulated_pause_seconds: itemPauses.reduce((sum, p) => sum + (p.duration_seconds || 0), 0),
            total_time_seconds: totalAccumulatedSeconds,
            current_session_seconds: currentSessionSeconds,
            is_paused: isPaused,
            stages: undefined,
            orders: undefined,
        };
    });
    return res.json(formatted);
});

// ── Executions ────────────────────────────────────────────────────────────
app.get("/api/orders/:id/executions", async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("stage_executions")
        .select(`
          *,
          stages ( name ),
          users ( name )
        `)
        .eq("order_id", Number(req.params.id));
    if (checkError(error, res)) return;

    // Fetch all pauses for these executions to calculate accumulated time
    const executionIds = (data || []).map(e => e.id);
    const { data: pauses } = executionIds.length > 0
        ? await supabaseAdmin.from("pauses").select("*").in("execution_id", executionIds)
        : { data: [] };

    const nowMs = new Date().getTime();
    const formatted = (data || []).map((e: any) => {
        const itemPauses = (pauses || []).filter(p => p.execution_id === e.id);
        const { totalAccumulatedSeconds, currentSessionSeconds, isPaused } = calculateExecutionTimes(e, itemPauses, nowMs);

        return {
            ...e,
            stage_name: e.stages?.name,
            user_name: e.users?.name,
            accumulated_pause_seconds: itemPauses.reduce((sum, p) => sum + (p.duration_seconds || 0), 0),
            total_time_seconds: totalAccumulatedSeconds,
            current_session_seconds: currentSessionSeconds,
            is_paused: isPaused,
            stages: undefined,
            users: undefined,
        };
    });
    return res.json(formatted);
});

app.post("/api/executions/start", canOperateProduction, async (req, res) => {
    const { order_id, stage_id, supervisor_override, motivo, order_item_id } = req.body || {};
    const orderIdNum = Number(order_id);
    const stageIdNum = Number(stage_id);
    const userIdNum = getActorId(req);
    const actorName = getActorName(req, "Operador");
    const actorRole = String((req as any).authUser?.role ?? (req as any).user?.role ?? '');
    const isPrivileged = actorRole === 'Administrador' || actorRole === 'Supervisor' || actorRole === 'PCP';
    const effectiveOverride = Boolean(supervisor_override) && isPrivileged;
    const effectiveMotivo = motivo ? String(motivo).trim() : null;

    if (!userIdNum || userIdNum <= 0) {
        return res.status(401).json({ error: "Usuário não identificado. Por favor, saia e entre novamente.", code: "USER_ID_REQUIRED" });
    }

    try {
        // --- AUTO-HEALING & COMPATIBILIDADE PARA PEDIDOS JÁ EM PRODUÇÃO ---
        const { data: ordRow } = await supabaseAdmin
            .from('orders')
            .select('id, order_number, quantity, required_stages, stages_status, status')
            .eq('id', orderIdNum)
            .maybeSingle();

        if (!ordRow) {
            return res.status(404).json({ error: "Pedido não encontrado.", code: "ORDER_NOT_FOUND" });
        }

        if (ordRow.status === 'Pronto' || ordRow.status === 'Entregue' || ordRow.status === 'Cancelado') {
            return res.status(409).json({
                error: `Não é possível iniciar etapa: o pedido já está com status "${ordRow.status}".`,
                code: "ORDER_ALREADY_FINISHED"
            });
        }

        // 0. Verificar em order_stage_progress se a etapa já está concluída ou com saldo zero
        const { data: existingProg } = await supabaseAdmin
            .from('order_stage_progress')
            .select('*')
            .eq('order_id', orderIdNum)
            .eq('stage_id', stageIdNum)
            .maybeSingle();

        const targetQty = Math.max(0, Number(existingProg?.quantidade_pedido || ordRow.quantity) || 0);
        const currentGood = Math.max(0, Number(existingProg?.quantidade_boa) || 0);
        const currentReposicao = Math.max(0, Number(existingProg?.pendencia_reposicao) || 0);
        const remainingBalance = Math.max(0, targetQty - currentGood + currentReposicao);

        if (existingProg && (existingProg.finished === true || existingProg.status_operacao === 'CONCLUIDA')) {
            return res.status(409).json({
                error: "Esta etapa já foi concluída e não pode ser iniciada novamente. Utilize a opção Reabrir Etapa caso necessário.",
                code: "STAGE_ALREADY_COMPLETED"
            });
        }

        if (existingProg && targetQty > 0 && remainingBalance <= 0) {
            return res.status(409).json({
                error: "Esta etapa já possui 100% das peças concluídas (saldo restante zero) e não pode ser iniciada.",
                code: "ZERO_BALANCE_REMAINING"
            });
        }

        // 0.1. Verificar se já existe execução ativa/pausada para este pedido + etapa
        const { data: activeStageExecs } = await supabaseAdmin
            .from('stage_executions')
            .select('*, users(name)')
            .eq('order_id', orderIdNum)
            .eq('stage_id', stageIdNum)
            .in('status', ['Em andamento', 'Pausado'])
            .order('start_time', { ascending: false });

        const currentStageExec = activeStageExecs && activeStageExecs.length > 0 ? activeStageExecs[0] : null;

        if (currentStageExec) {
            if (Number(currentStageExec.user_id) === Number(userIdNum)) {
                // Idempotência para o próprio operador (duplo clique ou múltiplas abas): retorna a execução existente sem duplicar
                if (currentStageExec.status === 'Pausado') {
                    await supabaseAdmin.rpc("rpc_resume_operation", {
                        p_execution_id: currentStageExec.id,
                        p_user_id: userIdNum,
                        p_supervisor_override: false,
                        p_motivo: "Retomada idempotente ao clicar em Iniciar",
                    });
                }
                return res.status(200).json({
                    id: currentStageExec.id,
                    execution_id: currentStageExec.id,
                    order_id: orderIdNum,
                    stage_id: stageIdNum,
                    user_id: userIdNum,
                    status: "Em andamento",
                    status_operacao: "EM_ANDAMENTO",
                    idempotent_replay: true,
                    http_status: 200
                });
            }

            const activeOperatorName = (currentStageExec as any).users?.name || `Operador #${currentStageExec.user_id}`;
            if (!effectiveOverride) {
                return res.status(409).json({
                    error: `Esta etapa já está em execução por ${activeOperatorName}. Não é permitido iniciar em paralelo.`,
                    code: "CONCURRENT_STAGE_EXECUTION",
                    active_execution_id: currentStageExec.id,
                    active_operator_id: currentStageExec.user_id,
                    active_operator_name: activeOperatorName,
                });
            }

            if (!effectiveMotivo) {
                return res.status(400).json({
                    error: `A etapa está com ${activeOperatorName}. Informe a justificativa obrigatória para transferir/intervir na execução.`,
                    code: "OVERRIDE_REASON_REQUIRED",
                    active_execution_id: currentStageExec.id,
                    active_operator_id: currentStageExec.user_id,
                    active_operator_name: activeOperatorName,
                });
            }

            // Intervenção formal por Supervisor/PCP/Admin com justificativa auditável
            const nowIso = new Date().toISOString();
            await supabaseAdmin
                .from('stage_executions')
                .update({
                    status: 'Finalizado',
                    end_time: nowIso,
                    observation: `[TRANSFERENCIA_SUPERVISOR] Encerrada por ${actorName} (${actorRole}): ${effectiveMotivo}`,
                    updated_at: nowIso
                })
                .eq('id', currentStageExec.id);

            await writeAuditLogStore(supabaseAdmin, {
                entidade: "stage_executions",
                order_id: orderIdNum,
                stage_id: stageIdNum,
                user_id: userIdNum,
                usuario: actorName,
                acao: "TRANSFERENCIA_OPERADOR",
                motivo: effectiveMotivo,
                observacao: `Execução #${currentStageExec.id} de ${activeOperatorName} transferida para ${actorName}. Motivo: ${effectiveMotivo}`,
                valor_anterior: { execution_id: currentStageExec.id, previous_user_id: currentStageExec.user_id, previous_operator: activeOperatorName },
                valor_novo: { new_user_id: userIdNum, motivo: effectiveMotivo },
            });
        }

        let reqStages: number[] = Array.isArray(ordRow.required_stages) && ordRow.required_stages.length > 0
            ? ordRow.required_stages.map(Number).filter((id: number) => id && id !== 12)
            : [];

        const stageIdsFromStatus = Array.isArray(ordRow.stages_status)
            ? ordRow.stages_status.map((s: any) => Number(s.id)).filter((id: number) => id && id !== 12)
            : [];

        // 1. Se required_stages estiver vazio ou não contiver a etapa atual, atualizar com a rota de stages_status
        if (reqStages.length === 0 || (!reqStages.includes(stageIdNum) && stageIdsFromStatus.includes(stageIdNum))) {
            reqStages = stageIdsFromStatus.length > 0 ? stageIdsFromStatus : (reqStages.includes(stageIdNum) ? reqStages : [...reqStages, stageIdNum]);
            await supabaseAdmin
                .from('orders')
                .update({ required_stages: reqStages })
                .eq('id', orderIdNum);
        }

        // 2. Sincronizar order_stage_progress apenas para etapas anteriores que não possuem linha ainda em order_stage_progress
        if (Array.isArray(ordRow.stages_status) && ordRow.stages_status.length > 0) {
            const { data: existingAllProg } = await supabaseAdmin
                .from('order_stage_progress')
                .select('stage_id, finished, status_operacao')
                .eq('order_id', orderIdNum);
            const existingMap = new Map<number, any>((existingAllProg || []).map((p: any) => [Number(p.stage_id), p]));

            const orderQty = ordRow.quantity || 1;
            const finishedStages = ordRow.stages_status.filter((s: any) =>
                (s.finished === true || s.status === 'Concluído' || s.status === 'Finalizado') &&
                Number(s.id) !== 12 &&
                Number(s.id) !== stageIdNum
            );

            for (const fs of finishedStages) {
                const fsId = Number(fs.id);
                if (!existingMap.has(fsId)) {
                    await supabaseAdmin.from('order_stage_progress').upsert({
                        order_id: orderIdNum,
                        stage_id: fsId,
                        quantidade_pedido: orderQty,
                        quantidade_boa: orderQty,
                        saldo_pendente: 0,
                        pendencia_reposicao: 0,
                        finished: true,
                        status: 'CONCLUIDA',
                        status_operacao: 'CONCLUIDA',
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'order_id,stage_id' });
                }
            }
        }

        const { data: rpcStartData, error: rpcStartErr } = await supabaseAdmin.rpc("rpc_start_operation", {
            p_order_id: orderIdNum,
            p_stage_id: stageIdNum,
            p_user_id: userIdNum,
            p_order_item_id: order_item_id ? Number(order_item_id) : null,
            p_supervisor_override: effectiveOverride,
            p_motivo: effectiveMotivo,
        });

        if (rpcStartErr) {
            console.error("[API] Erro crítico: RPC rpc_start_operation falhou:", rpcStartErr);
            if (rpcStartErr.code === '23505') {
                return res.status(409).json({
                    error: "Conflito de concorrência: o operador já possui uma execução ativa ou a etapa já está sendo executada.",
                    code: "CONCURRENT_EXECUTION_CONFLICT",
                });
            }
            return res.status(500).json({
                error: `Erro na execução da RPC rpc_start_operation: ${rpcStartErr.message}`,
                details: rpcStartErr,
                code: "RPC_EXECUTION_ERROR"
            });
        }

        const httpStatus = Number(rpcStartData?.http_status) || 200;
        return res.status(httpStatus).json(rpcStartData);
    } catch (err: any) {
        if (err?.code === '23505') {
            return res.status(409).json({
                error: "Conflito de concorrência: o operador já possui uma execução ativa ou a etapa já está sendo executada.",
                code: "CONCURRENT_EXECUTION_CONFLICT",
            });
        }
        return res.status(500).json({ error: err.message || "Erro ao iniciar execução" });
    }
});

// ── Pause-All: pausa todas as execuções ativas (fim de expediente) ────────
app.post("/api/executions/pause-all", isPcpOrSupervisorOrAdmin, async (req, res) => {
    try {
        const actorId = getActorId(req);
        const { data: activeExecs, error: fetchErr } = await supabaseAdmin
            .from("stage_executions")
            .select("id")
            .eq("status", "Em andamento");

        if (fetchErr) return checkError(fetchErr, res, "Erro ao buscar execuções ativas");
        if (!activeExecs || activeExecs.length === 0) {
            return res.json({ success: true, paused: 0 });
        }

        let pausedCount = 0;
        for (const exec of activeExecs) {
            const { error: rpcErr } = await supabaseAdmin.rpc("rpc_pause_operation", {
                p_execution_id: exec.id,
                p_user_id: actorId,
                p_motivo: "Pausa coletiva (Fim de expediente)",
                p_supervisor_override: true,
            });
            if (!rpcErr) pausedCount++;
        }

        console.log(`[API] Pause-all: ${pausedCount} execução(ões) pausada(s) via RPC.`);
        return res.json({ success: true, paused: pausedCount });
    } catch (err: any) {
        console.error("[API] Erro no pause-all:", err);
        return res.status(500).json({ error: "Erro ao pausar todas as execuções" });
    }
});

// ── Reset-Production: zera todos os relatórios e tempos mantendo os pedidos (Opção B) ──

app.get("/api/admin/debug-orders", isAdmin, async (req, res) => {
    const { data: orders } = await supabaseAdmin.from("orders").select("id, client_name, stages_status").order("id", { ascending: false }).limit(5);
    return res.json(orders);
});

app.post("/api/admin/reset-production", isAdmin, async (req, res) => {
    try {
        const actorId = getActorId(req);
        if (!actorId) {
            return res.status(401).json({ error: "Sessão inválida ou sem identificação de usuário." });
        }
        const { confirmation_text } = req.body || {};
        const { data, error } = await supabaseAdmin.rpc("pcp_tx_reset_production", {
            p_confirmation_text: confirmation_text || "RESETAR_PRODUCAO_CONFIRMADO",
            p_user_id: actorId
        });
        if (error) {
            console.error("[API] Erro ao resetar produção via RPC:", error);
            const isForbidden = error.message?.includes('INSUFFICIENT_ROLE');
            const isInvalidText = error.message?.includes('CONFIRMATION_TEXT_INVALID');
            const status = isForbidden ? 403 : (isInvalidText ? 400 : 500);
            return res.status(status).json({ error: error.message });
        }
        return res.json(data);
    } catch (err: any) {
        console.error("[API] Erro ao resetar produção:", err);
        return res.status(500).json({ error: err.message || "Erro interno ao processar reset de produção" });
    }
});

// ── Auto-Pause: pausa automática baseado no horário agendado ────────────
app.post("/api/executions/auto-pause", isPcpOrSupervisorOrAdmin, async (req, res) => {
    try {
        const { data: config, error: configErr } = await supabaseAdmin.from("config_producao").select("*").eq("id", 1).single();
        if (configErr) throw configErr;

        const now = new Date();
        const spSpnowStr = now.toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).replace(" ", "T");
        const spSpnow = new Date(spSpnowStr + "Z");
        
        const dayOfWeek = spSpnow.getUTCDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return res.json({ success: true, message: "Fim de semana, pulando pausa automática." });

        const checkTime = (target: string) => {
            if (!target) return false;
            const [hh, mm] = target.split(':').map(Number);
            
            // Janela de ±3 minutos para garantir que o trigger funcione mesmo com pequenas variações de tempo/intervalo
            const targetMin = hh * 60 + mm;
            const currentMin = spSpnow.getUTCHours() * 60 + spSpnow.getUTCMinutes();
            return Math.abs(currentMin - targetMin) <= 3;
        };

        const isLunch = checkTime(config.auto_pause_time_lunch);
        const isEndOfDay = checkTime(dayOfWeek === 5 ? config.auto_pause_time_friday : config.auto_pause_time_weekday);

        if (!isLunch && !isEndOfDay) {
            return res.json({ success: true, message: "Fora do horário de pausa automática.", current_time: now.toLocaleTimeString('pt-BR') });
        }

        const { data: activeExecs, error: fetchErr } = await supabaseAdmin
            .from("stage_executions")
            .select("id")
            .eq("status", "Em andamento");

        if (fetchErr) throw fetchErr;
        if (!activeExecs || activeExecs.length === 0) {
            return res.json({ success: true, message: "Nenhuma tarefa ativa para pausar.", paused: 0 });
        }

        const pauseReason = isLunch ? "Pausa automática (Almoço)" : "Pausa automática (Fim de expediente)";
        let pausedCount = 0;
        for (const exec of activeExecs) {
            const { error: rpcErr } = await supabaseAdmin.rpc("rpc_pause_operation", {
                p_execution_id: exec.id,
                p_user_id: null,
                p_motivo: pauseReason,
                p_supervisor_override: true,
            });
            if (!rpcErr) pausedCount++;
        }

        console.log(`[AutoPause] ${pausedCount} execução(ões) pausadas automaticamente por ${pauseReason}.`);
        return res.json({ success: true, paused: pausedCount, reason: pauseReason });
    } catch (err: any) {
        console.error("[AutoPause] Erro:", err);
        return res.status(500).json({ error: "Erro interno no auto-pause" });
    }
});

app.post("/api/executions/:id/pause", canOperateProduction, async (req, res) => {
    const execution_id = Number(req.params.id);
    const { observation, motivo, reason, supervisor_override } = req.body || {};
    const actorId = getActorId(req);
    const actorRole = String((req as any).authUser?.role ?? (req as any).user?.role ?? '');
    const isPrivileged = actorRole === 'Administrador' || actorRole === 'Supervisor' || actorRole === 'PCP';
    const effectiveOverride = Boolean(supervisor_override) && isPrivileged;
    const pauseReason = (motivo || reason || observation || (effectiveOverride ? `Pausa autorizada pelo ${actorRole || 'Administrador'}` : "Pausa operacional")).toString().trim();

    if (!actorId) {
        return res.status(401).json({ error: "Identificação de usuário obrigatória.", code: "USER_ID_REQUIRED" });
    }

    const { data: rpcPauseData, error: rpcPauseErr } = await supabaseAdmin.rpc("rpc_pause_operation", {
        p_execution_id: execution_id,
        p_user_id: actorId,
        p_motivo: pauseReason,
        p_supervisor_override: effectiveOverride,
    });

    if (rpcPauseErr) {
        console.error("[API] Erro crítico: RPC rpc_pause_operation falhou ou não existe no Supabase:", rpcPauseErr);
        return res.status(500).json({
            error: `Erro na execução da RPC rpc_pause_operation: ${rpcPauseErr.message}`,
            details: rpcPauseErr,
            code: "RPC_EXECUTION_ERROR",
        });
    }

    const httpStatus = Number(rpcPauseData?.http_status) || 200;
    return res.status(httpStatus).json({
        ...rpcPauseData,
        status: rpcPauseData?.status || "Pausado",
    });
});

app.post("/api/executions/:id/resume", canOperateProduction, async (req, res) => {
    const execution_id = Number(req.params.id);
    const { supervisor_override, motivo } = req.body || {};
    const actorId = getActorId(req);
    const actorRole = String((req as any).authUser?.role ?? (req as any).user?.role ?? '');
    const isPrivileged = actorRole === 'Administrador' || actorRole === 'Supervisor' || actorRole === 'PCP';
    const effectiveOverride = Boolean(supervisor_override) && isPrivileged;
    const effectiveMotivo = motivo || (effectiveOverride ? `Retomada autorizada pelo ${actorRole || 'Administrador'}` : null);

    if (!actorId) {
        return res.status(401).json({ error: "Identificação de usuário obrigatória.", code: "USER_ID_REQUIRED" });
    }

    const { data: rpcResumeData, error: rpcResumeErr } = await supabaseAdmin.rpc("rpc_resume_operation", {
        p_execution_id: execution_id,
        p_user_id: actorId,
        p_supervisor_override: effectiveOverride,
        p_motivo: effectiveMotivo,
    });

    if (rpcResumeErr) {
        console.error("[API] Erro crítico: RPC rpc_resume_operation falhou ou não existe no Supabase:", rpcResumeErr);
        return res.status(500).json({
            error: `Erro na execução da RPC rpc_resume_operation: ${rpcResumeErr.message}`,
            details: rpcResumeErr,
            code: "RPC_EXECUTION_ERROR",
        });
    }

    const httpStatus = Number(rpcResumeData?.http_status) || 200;
    return res.status(httpStatus).json({
        ...rpcResumeData,
        status: rpcResumeData?.status || "Em andamento",
    });
});

app.post("/api/executions/:id/finish", canOperateProduction, async (req, res) => {
    const execution_id = Number(req.params.id);
    const { observation, quantidade_boa_incremento, partial, idempotency_key, supervisor_override } = req.body || {};
    const actorId = getActorId(req);
    const actorRole = String((req as any).authUser?.role ?? (req as any).user?.role ?? '');
    const isPrivileged = actorRole === 'Administrador' || actorRole === 'Supervisor' || actorRole === 'PCP';
    const effectiveOverride = Boolean(supervisor_override) && isPrivileged;
    const effectiveObs = (observation && String(observation).trim()) || (effectiveOverride ? `Finalizado por ${actorRole || 'Administrador'}` : 'Finalizado no apontamento');

    if (!actorId) {
        return res.status(401).json({ error: "Identificação de usuário obrigatória.", code: "USER_ID_REQUIRED" });
    }

    const effectiveKey = idempotency_key || (req.headers["x-idempotency-key"] as string) || `fin_${execution_id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const { data: rpcFinishData, error: rpcFinishErr } = await supabaseAdmin.rpc("rpc_finish_operation", {
        p_execution_id: execution_id,
        p_user_id: actorId,
        p_good_inc: Number(quantidade_boa_incremento) || 0,
        p_partial: Boolean(partial),
        p_observation: effectiveObs,
        p_idempotency_key: effectiveKey,
        p_supervisor_override: effectiveOverride,
    });

    if (rpcFinishErr) {
        console.error("[API] Erro crítico: RPC rpc_finish_operation falhou ou não existe no Supabase:", rpcFinishErr);
        return res.status(500).json({
            error: `Erro na execução da RPC rpc_finish_operation: ${rpcFinishErr.message}`,
            details: rpcFinishErr,
            code: "RPC_EXECUTION_ERROR",
        });
    }

    const httpStatus = Number(rpcFinishData?.http_status) || 200;

    // Resguardo resiliente: sincroniza order_stage_progress e orders.stages_status respeitando se foi parcial ou concluída
    if (httpStatus >= 200 && httpStatus < 300 && !rpcFinishData?.error) {
        try {
            const { data: execRow } = await supabaseAdmin
                .from("stage_executions")
                .select("order_id, stage_id")
                .eq("id", execution_id)
                .maybeSingle();

            if (execRow && execRow.order_id) {
                const nowIso = new Date().toISOString();

                const { data: curProg } = await supabaseAdmin
                    .from("order_stage_progress")
                    .select("*")
                    .eq("order_id", execRow.order_id)
                    .eq("stage_id", execRow.stage_id)
                    .maybeSingle();

                const isStageTrulyFinished = Boolean(
                    !partial && (
                        rpcFinishData?.finished === true ||
                        rpcFinishData?.status_operacao === "CONCLUIDA" ||
                        curProg?.finished === true ||
                        curProg?.status_operacao === "CONCLUIDA" ||
                        (curProg && Number(curProg.quantidade_pedido) > 0 && Number(curProg.quantidade_boa) >= Number(curProg.quantidade_pedido) && !(Number(curProg.pendencia_reposicao) > 0))
                    )
                );

                // 1. Marca explicitamente a etapa atual como concluída somente se realmente concluída
                if (isStageTrulyFinished) {
                    await supabaseAdmin
                        .from("order_stage_progress")
                        .update({
                            finished: true,
                            status_operacao: "CONCLUIDA",
                            saldo_pendente: 0,
                            completed_at: nowIso,
                            updated_at: nowIso,
                        })
                        .eq("order_id", execRow.order_id)
                        .eq("stage_id", execRow.stage_id);

                    const { data: itemRows } = await supabaseAdmin
                        .from("order_items")
                        .select("id")
                        .eq("order_id", execRow.order_id);

                    if (itemRows && itemRows.length > 0) {
                        await supabaseAdmin
                            .from("order_item_stage_progress")
                            .update({
                                finished: true,
                                status_operacao: "CONCLUIDA",
                                saldo_pendente: 0,
                                completed_at: nowIso,
                                updated_at: nowIso,
                            })
                            .eq("stage_id", execRow.stage_id)
                            .in("order_item_id", itemRows.map((i: any) => i.id));
                    }
                }

                // 2. Consulta o pedido com suas rotas e etapas
                const { data: ord } = await supabaseAdmin
                    .from("orders")
                    .select("id, quantity, status, required_stages, stages_status")
                    .eq("id", execRow.order_id)
                    .maybeSingle();

                if (ord && ord.status !== "Pronto" && ord.status !== "Entregue" && ord.status !== "Cancelado") {
                    const { data: dbStages } = await supabaseAdmin.from("stages").select("id, name, sector_name");
                    const confStageIds = new Set(
                        (dbStages || []).filter((s: any) => isConferenciaStage(s)).map((s: any) => Number(s.id))
                    );

                    let rawReq = Array.isArray(ord.required_stages) ? ord.required_stages.map(Number) : [];
                    if (rawReq.length === 0 && Array.isArray(ord.stages_status) && ord.stages_status.length > 0) {
                        rawReq = ord.stages_status.map((s: any) => Number(s.id)).filter((id: number) => id && id !== 12);
                    }

                    const nonConfReq = rawReq.filter((id: number) => !confStageIds.has(id));

                    const { data: progressRows } = await supabaseAdmin
                        .from("order_stage_progress")
                        .select("*")
                        .eq("order_id", ord.id);

                    const progByStage = new Map<number, any>((progressRows || []).map((p: any) => [Number(p.stage_id), p]));
                    const curStageProg = progByStage.get(Number(execRow.stage_id));

                    // Atualiza stages_status na tabela orders com os valores reais de order_stage_progress
                    const updatedStagesStatus = Array.isArray(ord.stages_status)
                        ? ord.stages_status.map((s: any) => {
                            if (Number(s.id) === Number(execRow.stage_id)) {
                                const qBoa = curStageProg ? Number(curStageProg.quantidade_boa) || 0 : (Number(rpcFinishData?.quantidade_boa) || Number(s.quantidade_boa) || 0);
                                const qPrev = curStageProg ? Number(curStageProg.quantidade_pedido) || Number(ord.quantity) || 0 : (Number(ord.quantity) || 0);
                                const sPend = isStageTrulyFinished ? 0 : Math.max(0, qPrev - qBoa);
                                return {
                                    ...s,
                                    quantidade_boa: qBoa,
                                    saldo_pendente: sPend,
                                    status_operacao: isStageTrulyFinished ? 'CONCLUIDA' : (qBoa > 0 ? 'PARCIAL' : 'LIBERADA'),
                                    finished: isStageTrulyFinished,
                                    status: isStageTrulyFinished ? 'Concluído' : (qBoa > 0 ? 'Parcial' : 'Pendente'),
                                };
                            }
                            return s;
                        })
                        : ord.stages_status;

                    if (nonConfReq.length > 0) {
                        const finishedMap = new Map<number, boolean>();
                        for (const p of progressRows || []) {
                            finishedMap.set(Number(p.stage_id), Boolean(p.finished === true || p.status_operacao === 'CONCLUIDA'));
                        }
                        if (isStageTrulyFinished) {
                            finishedMap.set(Number(execRow.stage_id), true);
                        }
                        if (Array.isArray(updatedStagesStatus)) {
                            for (const s of updatedStagesStatus) {
                                const sid = Number(s?.id);
                                if (s && !progByStage.has(sid) && (s.finished === true || s.status === 'Concluído' || s.status === 'Finalizado')) {
                                    finishedMap.set(sid, true);
                                }
                            }
                        }
                        const allNonConfFinished = nonConfReq.every((id: number) => finishedMap.get(id) === true);

                        if (allNonConfFinished) {
                            await supabaseAdmin
                                .from("orders")
                                .update({
                                    status: "Pronto",
                                    pcp_status: "PRONTO",
                                    production_finished_at: nowIso,
                                    stages_status: updatedStagesStatus,
                                    updated_at: nowIso
                                })
                                .eq("id", ord.id);

                            if (rpcFinishData) {
                                rpcFinishData.order_status = "Pronto";
                                rpcFinishData.pcp_status = "PRONTO";
                            }
                        } else {
                            await supabaseAdmin
                                .from("orders")
                                .update({
                                    stages_status: updatedStagesStatus,
                                    updated_at: nowIso
                                })
                                .eq("id", ord.id);
                        }
                    }
                }
            }
        } catch (autoWaiverErr) {
            console.warn("[FinishOperation] Aviso ao verificar conclusão resiliente do pedido:", autoWaiverErr);
        }
    }

    return res.status(httpStatus).json({
        ...rpcFinishData,
        status: rpcFinishData?.status || "Finalizado",
    });
});

app.post("/api/orders/:id/stages/:stageId/reopen", isPcpOrSupervisorOrAdmin, async (req, res) => {
    const orderId = Number(req.params.id);
    const stageId = Number(req.params.stageId);
    const { motivo } = req.body || {};
    const usuario = getActorName(req, "Supervisor/Admin");

    try {
        const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('pcp_tx_reabrir_etapa', {
            p_order_id: orderId,
            p_stage_id: stageId,
            p_motivo: motivo || "Reabertura manual da etapa",
            p_usuario: usuario,
        });

        if (rpcErr) {
            console.error("[API] Erro ao executar pcp_tx_reabrir_etapa:", rpcErr);
            return res.status(500).json({ error: `Erro ao reabrir etapa: ${rpcErr.message}`, code: "RPC_EXECUTION_ERROR" });
        }

        const httpStatus = Number(rpcRes?.http_status) || 200;
        if (rpcRes?.error) {
            return res.status(httpStatus).json(rpcRes);
        }

        return res.status(httpStatus).json({
            success: true,
            order_status: rpcRes?.order_status,
            status_operacao: rpcRes?.status_operacao || "LIBERADA",
        });
    } catch (err: any) {
        console.error("[API] Erro ao reabrir etapa:", err);
        return res.status(500).json({ error: "Erro ao reabrir etapa" });
    }
});

// ── Production Config ─────────────────────────────────────────────────────
app.get("/api/config/producao", async (_req, res) => {
    const { data, error } = await supabaseAdmin
        .from("config_producao")
        .select("*")
        .limit(1)
        .single();
    if (checkError(error, res)) return;
    return res.json(data);
});

app.patch("/api/config/producao", isAdmin, async (req, res) => {
    const { jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes, meta_diaria_pedidos, meta_diaria_pecas } = req.body;
    const { error } = await supabaseAdmin
        .from("config_producao")
        .update({ jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes, meta_diaria_pedidos, meta_diaria_pecas })
        .eq("id", 1);
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// ── Users ─────────────────────────────────────────────────────────────────
app.get("/api/users", async (req, res) => {
    const isAdminUser = (req as any).user?.role === "Administrador";
    const { search } = req.query;
    let query = supabaseAdmin
        .from("users")
        .select("id, name, email, role, hourly_cost, active");

    if (search) {
        query = query.or(
            `name.ilike.%${search}%,email.ilike.%${search}%`
        );
    }

    const { data, error } = await query;
    if (checkError(error, res)) return;
    const sanitized = (data || []).map((u: any) => ({
        ...u,
        hourly_cost: isAdminUser ? u.hourly_cost : 0
    }));
    return res.json(sanitized);
});

app.post("/api/users", isAdmin, async (req, res) => {
    const { name, email, password, role, hourly_cost } = req.body;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: "Variável SUPABASE_SERVICE_ROLE_KEY não configurada no backend." });
    }

    // 1. Criar o usuário no Supabase Auth primeiro
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password || "123456",
        email_confirm: true, // Ignorar verificação de email forçadamente
        user_metadata: { name }
    });

    if (authError) {
        console.error("Erro ao criar usuário no Supabase Auth:", authError);
        return res.status(400).json({ error: authError.message });
    }

    // 2. Inserir os dados na tabela pública 'users'
    const { data, error } = await supabaseAdmin
        .from("users")
        .insert({
            name,
            email,
            password: "-",
            role,
            hourly_cost: hourly_cost || 0,
            active: 1,
            auth_user_id: authData?.user?.id || null
        })
        .select("id")
        .single();

    if (error) {
        // Se falhou a inserção na tabela pública, desfazemos a criação no Auth
        if (authData?.user?.id) {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        }
        return checkError(error, res, "Erro ao criar perfil de usuário na tabela.") ? undefined : undefined;
    }

    return res.json({ id: data.id });
});

app.patch("/api/users/:id", isAdmin, async (req, res) => {
    const { name, email, role, hourly_cost, active } = req.body;
    const { error } = await supabaseAdmin
        .from("users")
        .update({ name, email, role, hourly_cost, active: active ? 1 : 0 })
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// ── Clients ───────────────────────────────────────────────────────────────
app.get("/api/clients", async (req, res) => {
    const { search } = req.query;
    let query = supabaseAdmin.from("clients").select("*").order("name");
    if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (checkError(error, res)) return;
    return res.json(data);
});

app.post("/api/clients", isAdminOrComercial, async (req, res) => {
    const { name, phone, email } = req.body;
    const { data, error } = await supabaseAdmin
        .from("clients")
        .insert({ name, phone, email })
        .select("id")
        .single();
    if (checkError(error, res)) return;
    return res.json({ id: data.id });
});

// ── Delivery & Delays Reports ─────────────────────────────────────────────
app.get("/api/reports/delays", async (req, res) => {
    const { startDate, endDate, print_type } = req.query;
    const today = new Date().toISOString().split("T")[0];

    let query = supabaseAdmin
        .from("orders")
        .select("id, order_number, client_name, product_type, print_type, quantity, deadline")
        .neq("status", "Entregue")
        .neq("status", "Cancelado")
        .is("deleted_at", null);

    if (print_type) query = query.eq("print_type", print_type as string);

    if (startDate && endDate) {
        query = query.gte("deadline", startDate).lte("deadline", endDate);
    } else {
        query = query.lt("deadline", today);
    }

    const { data, error } = await query.order("deadline", { ascending: true });

    if (checkError(error, res, "Erro ao buscar atrasos")) return;

    const atrasados = (data || []).map(o => {
        const diffTime = Math.abs(new Date().getTime() - new Date(o.deadline).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
            ...o,
            dias_atraso: diffDays
        };
    });

    return res.json(atrasados);
});

app.get("/api/reports/delivery", async (req, res) => {
    const { period, startDate: queryStartDate, endDate: queryEndDate, print_type } = req.query;
    const now = new Date();
    let startDate = new Date();

    if (queryStartDate) {
        startDate = new Date(queryStartDate as string);
    } else if (period === 'day') {
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
    } else {
        startDate.setFullYear(2000);
    }

    let endDate = now;
    if (queryEndDate) {
        endDate = new Date(queryEndDate as string);
        // Ensure end date includes the full day (23:59:59)
        endDate.setHours(23, 59, 59, 999);
    } else {
        endDate.setHours(23, 59, 59, 999);
    }

    let ordersQuery = supabaseAdmin
        .from("orders")
        .select("id, created_at, quantity, deadline, delivered_at")
        .eq("status", "Entregue")
        .is("deleted_at", null)
        .gte("delivered_at", startDate.toISOString())
        .lte("delivered_at", endDate.toISOString());

    if (print_type) ordersQuery = ordersQuery.eq("print_type", print_type as string);

    const { data: orders, error } = await ordersQuery;

    if (checkError(error, res, "Erro ao buscar entregas")) return;

    const data = orders || [];

    // Fallback if missing delivered_at somehow
    const safeData = data.filter(o => o.delivered_at);

    const entregues_hoje = safeData.filter(o => {
        return new Date(o.delivered_at).toLocaleDateString('pt-BR') === now.toLocaleDateString('pt-BR');
    }).length;

    const entregues_periodo = safeData.length;

    let parts_delivered = 0;
    let on_time_count = 0;
    let total_lead_seconds = 0;

    safeData.forEach(o => {
        parts_delivered += Number(o.quantity) || 0;
        const deliveredAt = new Date(o.delivered_at).getTime();
        const deadline = new Date(o.deadline).getTime();
        if (deliveredAt <= deadline + 24 * 60 * 60 * 1000) {
            on_time_count++;
        }
        const createdAt = new Date(o.created_at).getTime();
        total_lead_seconds += Math.max(0, (deliveredAt - createdAt) / 1000);
    });

    const taxa_no_prazo_percent = safeData.length > 0 ? (on_time_count / safeData.length) * 100 : 0;
    const lead_time_medio_dias = safeData.length > 0 ? (total_lead_seconds / safeData.length) / (24 * 3600) : 0;

    const chartMap: Record<string, { pedidos: number, pecas: number }> = {};
    safeData.forEach(o => {
        const localDate = new Date(o.delivered_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        if (!chartMap[localDate]) chartMap[localDate] = { pedidos: 0, pecas: 0 };
        chartMap[localDate].pedidos++;
        chartMap[localDate].pecas += Number(o.quantity) || 0;
    });

    const { data: config } = await supabaseAdmin.from("config_producao").select("meta_diaria_pedidos, meta_diaria_pecas").eq("id", 1).single();
    const meta_pedidos = config?.meta_diaria_pedidos || 0;
    const meta_pecas = config?.meta_diaria_pecas || 0;

    const chartData = Object.keys(chartMap).map(dateStr => ({
        data: dateStr,
        pedidos: chartMap[dateStr].pedidos,
        pecas: chartMap[dateStr].pecas,
        meta_pedidos,
        meta_pecas
    }));

    chartData.sort((a, b) => {
        const [d1, m1, y1] = a.data.split('/');
        const [d2, m2, y2] = b.data.split('/');
        return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime();
    });

    let met_goal_days = 0;
    chartData.forEach(d => {
        if (d.pedidos >= meta_pedidos) met_goal_days++;
    });

    const cumprimento_meta_percent = chartData.length > 0 ? (met_goal_days / chartData.length) * 100 : 0;

    return res.json({
        entregues_hoje: safeData.filter(o => new Date(o.delivered_at).toLocaleDateString('pt-BR') === now.toLocaleDateString('pt-BR')).length,
        entregues_periodo,
        taxa_no_prazo_percent,
        lead_time_medio_dias,
        cumprimento_meta_percent,
        grafico: chartData,
        atrasados: []
    });
});

// ── Operational Report (Drill-Down) ───────────────────────────────────────
app.get("/api/reports/operational", async (req, res) => {
    const { startDate, endDate, print_type } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: "Parâmetros startDate e endDate são obrigatórios" });
    }

    const rpcParams: any = {
        p_start_date: startDate,
        p_end_date: endDate
    };
    if (print_type) rpcParams.p_print_type = print_type;

    const { data, error } = await supabaseAdmin.rpc("get_operational_report", rpcParams);

    if (checkError(error, res, "Erro ao buscar relatório operacional")) return;
    return res.json(data);
});

// ── Production Profile Report ─────────────────────────────────────────────
app.get("/api/reports/profiles", async (req, res) => {
    const { startDate, endDate, print_type } = req.query;

    let query = supabaseAdmin
        .from("orders")
        .select("product_type, print_type, num_colors, total_time_seconds, quantity")
        .eq("status", "Entregue")
        .is("deleted_at", null)
        .gt("total_time_seconds", 0);

    if (print_type) {
        query = query.eq("print_type", print_type as string);
    }

    if (startDate && endDate) {
        // Ensure endDate includes the full day
        const endDay = new Date(endDate as string);
        endDay.setHours(23, 59, 59, 999);
        query = query.gte("delivered_at", startDate).lte("delivered_at", endDay.toISOString());
    }

    const { data, error } = await query;

    if (checkError(error, res)) return;

    // Group by profile key
    const profileMap: Record<string, {
        product_type: string;
        print_type: string;
        num_colors: number;
        times: number[];
        quantities: number[];
    }> = {};

    for (const order of (data || [])) {
        const colors = order.num_colors || 1;
        const key = `${order.product_type}|${order.print_type}|${colors}`;
        if (!profileMap[key]) {
            profileMap[key] = {
                product_type: order.product_type,
                print_type: order.print_type,
                num_colors: colors,
                times: [],
                quantities: [],
            };
        }
        profileMap[key].times.push(order.total_time_seconds);
        profileMap[key].quantities.push(order.quantity || 0);
    }

    const profiles = Object.values(profileMap).map(p => ({
        product_type: p.product_type,
        print_type: p.print_type,
        num_colors: p.num_colors,
        count: p.times.length,
        avg_time_seconds: Math.round(p.times.reduce((a, b) => a + b, 0) / p.times.length),
        min_time_seconds: Math.min(...p.times),
        max_time_seconds: Math.max(...p.times),
        avg_quantity: Math.round(p.quantities.reduce((a, b) => a + b, 0) / p.quantities.length),
    })).sort((a, b) => b.count - a.count);

    return res.json(profiles);
});

// ── Goals & Productivity Report (Day, Week, Month) ────────────────────────
app.get("/api/reports/goals-productivity", async (req, res) => {
    // Current time in Brazil (UTC-3)
    const now = new Date();
    const brTimeMs = now.getTime() - (3 * 60 * 60 * 1000);
    const brDate = new Date(brTimeMs);
    
    const year = brDate.getUTCFullYear();
    const month = brDate.getUTCMonth(); // 0-indexed
    const day = brDate.getUTCDate();
    const dayOfWeek = brDate.getUTCDay(); // 0 = Sun, 1 = Mon...
    
    // Today Start in UTC (00:00:00 Brazil is 03:00:00 UTC)
    const todayStartUTC = new Date(Date.UTC(year, month, day, 3, 0, 0, 0));
    
    // Week Start (Monday) in UTC
    const dayDiff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayBr = new Date(brDate.getTime() - (dayDiff * 24 * 60 * 60 * 1000));
    const weekStartUTC = new Date(Date.UTC(mondayBr.getUTCFullYear(), mondayBr.getUTCMonth(), mondayBr.getUTCDate(), 3, 0, 0, 0));
    
    // Month Start (1st of current month) in UTC
    const monthStartUTC = new Date(Date.UTC(year, month, 1, 3, 0, 0, 0));
    
    // The query start date is the earliest of the three boundaries
    const queryStartDate = new Date(Math.min(todayStartUTC.getTime(), weekStartUTC.getTime(), monthStartUTC.getTime()));

    const todayMs = todayStartUTC.getTime();
    const weekMs = weekStartUTC.getTime();
    const monthMs = monthStartUTC.getTime();

    try {
        // Fetch completed stage executions since queryStartDate
        let resultExecutions: any = await supabaseAdmin
            .from("stage_executions")
            .select(`
                id,
                end_time,
                status,
                user_id,
                stage_id,
                users ( name ),
                stages ( name, calculation_type, meta_diaria ),
                orders ( quantity )
            `)
            .eq("status", "Finalizado")
            .gte("end_time", queryStartDate.toISOString());

        if (resultExecutions.error && resultExecutions.error.message.includes("meta_diaria")) {
            resultExecutions = await supabaseAdmin
                .from("stage_executions")
                .select(`
                    id,
                    end_time,
                    status,
                    user_id,
                    stage_id,
                    users ( name ),
                    stages ( name, calculation_type ),
                    orders ( quantity )
                `)
                .eq("status", "Finalizado")
                .gte("end_time", queryStartDate.toISOString());
        }

        if (resultExecutions.error) throw resultExecutions.error;
        const executions = resultExecutions.data;

        // Fetch all active users and active stages to populate complete lists
        const [usersRes, stagesResResult] = await Promise.all([
            supabaseAdmin.from("users").select("id, name").eq("active", true),
            (async () => {
                let res: any = await supabaseAdmin.from("stages").select("id, name, calculation_type, meta_diaria").eq("active", 1);
                if (res.error && res.error.message.includes("meta_diaria")) {
                    res = await supabaseAdmin.from("stages").select("id, name, calculation_type").eq("active", 1);
                }
                return res;
            })()
        ]);
        const stagesRes = stagesResResult;

        let overrides: any[] = [];
        try {
            const { data: overridesData } = await supabaseAdmin.from("collaborator_stage_goals").select("*");
            if (overridesData) overrides = overridesData;
        } catch (dbErr) {
            console.warn("Table collaborator_stage_goals does not exist yet, using empty array fallback.", dbErr);
        }

        const activeUsers = usersRes.data || [];
        const activeStages = stagesRes.data || [];

        // 1. Pre-calculate worked days (unique active dates) for each user in week and month periods
        const userWorkedDaysMap: Record<number, { week: number, month: number }> = {};
        activeUsers.forEach(u => {
            const userExecs = (executions || []).filter(e => e.user_id === u.id);
            
            // Week worked days
            const weekDates = new Set<string>();
            userExecs.forEach(e => {
                if (!e.end_time) return;
                const t = new Date(e.end_time).getTime();
                if (t >= weekMs) {
                    const d = new Date(e.end_time);
                    weekDates.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`);
                }
            });
            const weekDays = weekDates.size > 0 ? weekDates.size : 1;

            // Month worked days
            const monthDates = new Set<string>();
            userExecs.forEach(e => {
                if (!e.end_time) return;
                const t = new Date(e.end_time).getTime();
                if (t >= monthMs) {
                    const d = new Date(e.end_time);
                    monthDates.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`);
                }
            });
            const monthDays = monthDates.size > 0 ? monthDates.size : 1;

            userWorkedDaysMap[u.id] = { week: weekDays, month: monthDays };
        });

        // Helper to compute stats for a given slice of executions
        const computePeriodStats = (
            execs: any[],
            dailyGoal: number | null,
            workedDays: number
        ) => {
            const real = execs.reduce((sum, e) => sum + (Number(e.orders?.quantity) || 0), 0);
            if (dailyGoal === null || dailyGoal === undefined) {
                return { real, target: null, pct: null, status: 'sem_meta' };
            }
            const target = dailyGoal * workedDays;
            const pct = target > 0 ? Math.round((real / target) * 100) : 0;
            const status = getGoalStatus(target > 0 ? (real / target) : null);
            return { real, target, pct, status };
        };

        // 2. Build detailed collaborator/sector grid rows
        const colabRows: any[] = [];
        const sectorAggregateMap: Record<number, { 
            stage_id: number;
            stage_name: string;
            calculation_type: string;
            meta_diaria: number | null;
            today: { real: number, target: number | null },
            week: { real: number, target: number | null },
            month: { real: number, target: number | null }
        }> = {};

        activeStages.forEach(stage => {
            sectorAggregateMap[stage.id] = {
                stage_id: stage.id,
                stage_name: stage.name,
                calculation_type: stage.calculation_type,
                meta_diaria: stage.meta_diaria || null,
                today: { real: 0, target: null },
                week: { real: 0, target: null },
                month: { real: 0, target: null }
            };
        });

        activeUsers.forEach(user => {
            activeStages.forEach(stage => {
                const userStageExecs = (executions || []).filter(e => e.user_id === user.id && e.stage_id === stage.id);
                const hasOverride = overrides.some(o => o.user_id === user.id && o.stage_id === stage.id);
                
                // Only show this row if there is active production or an override is defined
                if (userStageExecs.length === 0 && !hasOverride) {
                    return;
                }

                const dailyGoal = resolveGoal(stage.meta_diaria, overrides, user.id, stage.id);
                const userWorkedDays = userWorkedDaysMap[user.id] || { week: 1, month: 1 };

                // Today
                const todayExecs = userStageExecs.filter(e => new Date(e.end_time).getTime() >= todayMs);
                const todayStats = computePeriodStats(todayExecs, dailyGoal, 1);

                // Week
                const weekExecs = userStageExecs.filter(e => new Date(e.end_time).getTime() >= weekMs);
                const weekStats = computePeriodStats(weekExecs, dailyGoal, userWorkedDays.week);

                // Month
                const monthExecs = userStageExecs.filter(e => new Date(e.end_time).getTime() >= monthMs);
                const monthStats = computePeriodStats(monthExecs, dailyGoal, userWorkedDays.month);

                colabRows.push({
                    user_id: user.id,
                    user_name: user.name,
                    stage_id: stage.id,
                    stage_name: stage.name,
                    calculation_type: stage.calculation_type,
                    meta_diaria: dailyGoal,
                    is_custom: hasOverride,
                    today: todayStats,
                    week: weekStats,
                    month: monthStats
                });

                // Aggregate into Sector
                const agg = sectorAggregateMap[stage.id];
                if (agg) {
                    agg.today.real += todayStats.real;
                    if (todayStats.target !== null) {
                        agg.today.target = (agg.today.target || 0) + todayStats.target;
                    }
                    agg.week.real += weekStats.real;
                    if (weekStats.target !== null) {
                        agg.week.target = (agg.week.target || 0) + weekStats.target;
                    }
                    agg.month.real += monthStats.real;
                    if (monthStats.target !== null) {
                        agg.month.target = (agg.month.target || 0) + monthStats.target;
                    }
                }
            });
        });

        // 3. Format sector aggregate results
        const sectorRows = Object.values(sectorAggregateMap).map((agg: any) => {
            const todayPct = agg.today.target !== null && agg.today.target > 0 ? Math.round((agg.today.real / agg.today.target) * 100) : null;
            const todayStatus = agg.today.target !== null && agg.today.target > 0 ? getGoalStatus(agg.today.real / agg.today.target) : 'sem_meta';

            const weekPct = agg.week.target !== null && agg.week.target > 0 ? Math.round((agg.week.real / agg.week.target) * 100) : null;
            const weekStatus = agg.week.target !== null && agg.week.target > 0 ? getGoalStatus(agg.week.real / agg.week.target) : 'sem_meta';

            const monthPct = agg.month.target !== null && agg.month.target > 0 ? Math.round((agg.month.real / agg.month.target) * 100) : null;
            const monthStatus = agg.month.target !== null && agg.month.target > 0 ? getGoalStatus(agg.month.real / agg.month.target) : 'sem_meta';

            return {
                stage_id: agg.stage_id,
                stage_name: agg.stage_name,
                calculation_type: agg.calculation_type,
                meta_diaria: agg.meta_diaria,
                today: { real: agg.today.real, target: agg.today.target, pct: todayPct, status: todayStatus },
                week: { real: agg.week.real, target: agg.week.target, pct: weekPct, status: weekStatus },
                month: { real: agg.month.real, target: agg.month.target, pct: monthPct, status: monthStatus }
            };
        });

        return res.json({
            collaborators: colabRows,
            sectors: sectorRows
        });

    } catch (err: any) {
        console.error("[GoalsProductivity] Error:", err);
        return res.status(500).json({ error: "Erro ao carregar metas de produtividade" });
    }
});

// ── Geração de Token & Acompanhamento Público de Pedido ─────────────────
app.post("/api/orders/:id/tracking-token", isAdminOrComercial, async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        
        // 1. Buscar pedido
        const { data: order, error: fetchErr } = await supabaseAdmin
            .from("orders")
            .select("id, tracking_token")
            .eq("id", orderId)
            .is("deleted_at", null)
            .single();

        if (fetchErr || !order) {
            return res.status(404).json({ error: "Pedido não encontrado" });
        }

        // 2. Se já tiver token, retorna
        if (order.tracking_token) {
            return res.json({ tracking_token: order.tracking_token });
        }

        // 3. Gerar novo token único (UUID)
        const newToken = crypto.randomUUID();

        // 4. Salvar token no banco
        const { error: updateErr } = await supabaseAdmin
            .from("orders")
            .update({ tracking_token: newToken })
            .eq("id", orderId);

        if (checkError(updateErr, res, "Erro ao salvar token de acompanhamento")) return;

        return res.json({ tracking_token: newToken });
    } catch (err: any) {
        console.error("[API] Erro ao obter/gerar token de acompanhamento:", err);
        return res.status(500).json({ error: "Erro ao processar token de acompanhamento" });
    }
});

app.get("/api/public/orders/:token", async (req, res) => {
    try {
        const { token } = req.params;
        if (!token || typeof token !== "string" || token.length < 12) {
            return res.status(404).json({ error: "Pedido não encontrado" });
        }

        // 1. Buscar pedido por token
        const { data: order, error: fetchErr } = await supabaseAdmin
            .from("orders")
            .select("id, order_number, created_at, status")
            .eq("tracking_token", token)
            .is("deleted_at", null)
            .maybeSingle();

        if (fetchErr || !order) {
            return res.status(404).json({ error: "Pedido não encontrado" });
        }

        // 2. Chamar a RPC get_orders_with_stages com o order_number do pedido
        const { data: rpcOrders, error: rpcError } = await supabaseAdmin.rpc("get_orders_with_stages", {
            p_search: order.order_number,
            p_stage_id: null,
            p_stage_status: null,
            p_product_type: null,
            p_print_type: null
        });

        if (rpcError || !rpcOrders || rpcOrders.length === 0) {
            return res.status(404).json({ error: "Pedido não encontrado" });
        }

        const rpcOrder = rpcOrders.find((o: any) => o.id === order.id);
        if (!rpcOrder) {
            return res.status(404).json({ error: "Pedido não encontrado" });
        }

        // Buscar execuções reais e progresso gravados no banco para este pedido
        const [{ data: dbExecs }, { data: dbProg }] = await Promise.all([
            supabaseAdmin
                .from("stage_executions")
                .select("stage_id, status")
                .eq("order_id", order.id),
            supabaseAdmin
                .from("order_stage_progress")
                .select("*")
                .eq("order_id", order.id)
        ]);

        enrichOrdersWithProgressSync([rpcOrder], dbProg || []);

        const finishedStageIds = new Set<number>();
        const inProgressStageIds = new Set<number>();

        if (dbExecs) {
            dbExecs.forEach((e: any) => {
                if (e.status === 'Finalizado') finishedStageIds.add(Number(e.stage_id));
                if (e.status === 'Em andamento') inProgressStageIds.add(Number(e.stage_id));
            });
        }

        if (dbProg) {
            dbProg.forEach((p: any) => {
                if (p.finished || (p.quantidade_pedido > 0 && p.quantidade_boa >= p.quantidade_pedido)) {
                    finishedStageIds.add(Number(p.stage_id));
                }
            });
        }

        const stagesList = rpcOrder.stages_status || [];
        const isEntregue = String(order.status || '').trim().toLowerCase() === 'entregue';

        // Identificar etapa ativa
        const activeStageId = stagesList.find((s: any) => s.in_progress || inProgressStageIds.has(Number(s.id)))?.id;

        // Mapear status real de cada etapa
        const stages = stagesList.map((st: any) => {
            const stageIdNum = Number(st.id);
            const isFinished = isEntregue || st.finished || finishedStageIds.has(stageIdNum);
            const isInProgress = !isFinished && (st.in_progress || inProgressStageIds.has(stageIdNum) || stageIdNum === activeStageId);

            let status: 'concluida' | 'em_andamento' | 'pendente' = 'pendente';
            if (isFinished) {
                status = 'concluida';
            } else if (isInProgress) {
                status = 'em_andamento';
            }
            return {
                id: st.id,
                name: st.name,
                status
            };
        });

        // 3. Buscar a última execução para obter a data de atualização
        const { data: lastExec } = await supabaseAdmin
            .from("stage_executions")
            .select("start_time, end_time, status, stages(name)")
            .eq("order_id", order.id)
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();

        let lastUpdatedAt = order.created_at || null;
        let lastUpdateMessage = "Pedido recebido e na fila de produção.";

        if (isEntregue) {
            lastUpdateMessage = "Pedido concluído e entregue ao cliente.";
        } else if (lastExec) {
            const time = lastExec.end_time || lastExec.start_time;
            if (time) lastUpdatedAt = time;

            const stagesRel: any = lastExec.stages;
            const stageName = Array.isArray(stagesRel)
                ? (stagesRel[0]?.name || 'produção')
                : (stagesRel?.name || 'produção');

            if (lastExec.status === 'Em andamento') {
                lastUpdateMessage = `Produção ativa na etapa de: ${stageName}.`;
            } else if (lastExec.status === 'Pausado') {
                lastUpdateMessage = `Trabalho pausado temporariamente na etapa de: ${stageName}.`;
            } else if (lastExec.status === 'Finalizado') {
                lastUpdateMessage = `Etapa concluída: ${stageName}.`;
            }
        }

        if (lastUpdatedAt && typeof lastUpdatedAt === 'string') {
            let str = lastUpdatedAt.trim();
            if (str.includes(' ') && !str.includes('T')) {
                str = str.replace(' ', 'T');
            }
            if (!/[Zz]|[+-]\d{2}:?\d{2}$/.test(str) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
                str += 'Z';
            }
            lastUpdatedAt = str;
        }

        const publicData = {
            order_number: rpcOrder.order_number,
            client_name: rpcOrder.client_name,
            product_type: rpcOrder.product_type,
            print_type: rpcOrder.print_type,
            quantity: rpcOrder.quantity,
            deadline: rpcOrder.deadline,
            stages,
            last_updated_at: lastUpdatedAt,
            last_update_message: lastUpdateMessage
        };

        return res.json(publicData);
    } catch (err: any) {
        console.error("[API Public] Erro ao buscar pedido público por token:", err);
        return res.status(404).json({ error: "Pedido não encontrado" });
    }
});


// ── PCP — Planejamento e Controle da Produção ─────────────────────────────────
// FASE 1: Necessidades de Produção + Planos de Corte + Ordens de Produção

/**
 * Calculates production necessity for a single order item.
 * Formula: qty_necessaria = max(0, qty_pedida - qty_estoque_disp - qty_op_livre)
 */
function _calcNecessidade(
    qtyPedida: number,
    qtyEstoqueDisp: number,
    qtyOpLivre: number
): { qty_necessaria: number; status: string } {
    const qty = Math.max(0, qtyPedida - qtyEstoqueDisp - qtyOpLivre);
    let status: string;
    if (qty <= 0) {
        if (qtyEstoqueDisp >= qtyPedida) {
            status = 'COBERTO_PELO_ESTOQUE';
        } else {
            status = 'AGUARDANDO_PRODUCAO_EXISTENTE';
        }
    } else {
        status = 'NECESSITA_NOVO_CORTE';
    }
    return { qty_necessaria: qty, status };
}

/**
 * GET /api/pcp/necessidades
 * Returns all current production necessities, calculated from active orders.
 * Uses stored data from producao_necessidades table + live order data.
 */
app.get('/api/pcp/necessidades', async (req: any, res: any) => {
    try {
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
        );

        // Load active orders with items
        const { data: orders, error: ordersErr } = await supabaseAdmin
            .from('orders')
            .select('id, order_number, client_name, deadline, status, quantity, total_via_corte, items, olist_order_id, product_type')
            .is('deleted_at', null)
            .not('status', 'in', '("Cancelado","Entregue")')
            .gt('total_via_corte', 0);

        if (ordersErr) throw ordersErr;

        // Load existing necessidades from DB (for status tracking)
        const { data: savedNecessidades } = await supabaseAdmin
            .from('producao_necessidades')
            .select('*')
            .not('status', 'in', '("CONCLUIDO","COBERTO_PELO_ESTOQUE")');

        const savedMap = new Map<string, any>();
        (savedNecessidades || []).forEach((n: any) => {
            savedMap.set(`${n.order_id}_${n.sku || n.product_type}_${n.size}`, n);
        });

        // Load OPs abertas from DB (local tracking)
        const { data: opsAbertas } = await supabaseAdmin
            .from('ordens_de_producao')
            .select('*')
            .in('status', ['ABERTA', 'EM_ANDAMENTO']);

        // Build OP map: product_type+color+size -> { qty_total, qty_comprometida }
        const opMap = new Map<string, { qty_total: number; qty_comprometida: number }>();
        (opsAbertas || []).forEach((op: any) => {
            const key = `${op.product_type}|${op.color || ''}|${op.size || ''}`;
            const existing = opMap.get(key) || { qty_total: 0, qty_comprometida: 0 };
            existing.qty_total += op.qty_pendente || 0;
            existing.qty_comprometida += op.qty_comprometida || 0;
            opMap.set(key, existing);
        });

        const necessidades: any[] = [];
        const activeOrders = (orders || []).filter((o: any) =>
            o && !o.deleted_at && o.status !== 'Cancelado' && o.status !== 'Entregue'
        );

        for (const order of activeOrders) {
            const itemsList = parseOrderItems(order.items);
            if (itemsList.length === 0) continue;

            for (const item of itemsList) {
                if (!item || typeof item !== 'object') continue;

                const details = extractItemDetails(item, order.product_type || 'Vestuário');
                const qtyPedida = Number(item.quantity ?? item.quantidade ?? 1);
                const qtyCorteNeeded = (() => {
                    let cQty = item.qty_corte ?? item.total_via_corte;
                    if (cQty === undefined || cQty === null) {
                        if (item.stock_available !== undefined && item.stock_available !== null)
                            cQty = Math.max(0, qtyPedida - Math.min(qtyPedida, Number(item.stock_available)));
                        else cQty = 0;
                    }
                    return Number(cQty);
                })();

                if (qtyCorteNeeded <= 0) continue;

                const qtyAllocated = Number(item.qty_corte_allocated || 0);
                const qtyPending = Math.max(0, qtyCorteNeeded - qtyAllocated);
                if (qtyPending <= 0) continue;

                const opKey = `${details.product_type}|${details.color}|${details.size}`;
                const opData = opMap.get(opKey) || { qty_total: 0, qty_comprometida: 0 };
                const qtyOpLivre = Math.max(0, opData.qty_total - opData.qty_comprometida);

                // Estoque disponível: usamos stock_available do item se presente, senão 0
                const qtyEstoqueDisp = Math.max(0, Number(item.stock_available ?? 0));

                const { qty_necessaria, status } = _calcNecessidade(qtyPending, qtyEstoqueDisp, qtyOpLivre);

                // Check if already in an approved plan
                const savedKey = `${order.id}_${details.sku || details.product_type}_${details.size}`;
                const savedRecord = savedMap.get(savedKey);
                const finalStatus = savedRecord?.status && ['INCLUIDO_EM_PLANO', 'PLANO_APROVADO', 'OP_GERADA', 'EM_CORTE', 'EM_COSTURA'].includes(savedRecord.status)
                    ? savedRecord.status
                    : status;

                necessidades.push({
                    id: savedRecord?.id,
                    order_id: order.id,
                    order_number: order.order_number,
                    client_name: order.client_name,
                    deadline: order.deadline,
                    sku: details.sku || item.sku || item.codigo || null,
                    product_type: details.product_type,
                    fabric: details.fabric !== 'Tecido não informado' ? details.fabric : null,
                    color: details.color !== 'Cor não informada' ? details.color : null,
                    size: details.size,
                    qty_pedida: qtyPending,
                    qty_reservada: qtyAllocated,
                    qty_estoque_fisico: qtyEstoqueDisp,
                    qty_estoque_disp: qtyEstoqueDisp,
                    qty_em_op: opData.qty_total,
                    qty_op_comprometida: opData.qty_comprometida,
                    qty_op_livre: qtyOpLivre,
                    qty_necessaria,
                    status: finalStatus,
                    plano_corte_id: savedRecord?.plano_corte_id ?? null,
                    op_id: savedRecord?.op_id ?? null,
                    estoque_consultado_em: savedRecord?.estoque_consultado_em ?? null,
                    estoque_fonte: 'LOCAL',
                });
            }
        }

        // Sort: NECESSITA_NOVO_CORTE first, then by deadline
        necessidades.sort((a, b) => {
            const statusPriority: Record<string, number> = {
                'NECESSITA_NOVO_CORTE': 0,
                'AGUARDANDO_PRODUCAO_EXISTENTE': 1,
                'COBERTO_PELO_ESTOQUE': 2,
                'INCLUIDO_EM_PLANO': 3,
                'PLANO_APROVADO': 4,
                'OP_GERADA': 5,
            };
            const pa = statusPriority[a.status] ?? 9;
            const pb = statusPriority[b.status] ?? 9;
            if (pa !== pb) return pa - pb;
            return (a.deadline || '').localeCompare(b.deadline || '');
        });

        const summary = {
            total_necessidades: necessidades.length,
            total_pecas_necessarias: necessidades.reduce((s: number, n: any) => s + n.qty_necessaria, 0),
            coberto_estoque: necessidades.filter((n: any) => n.status === 'COBERTO_PELO_ESTOQUE').length,
            aguardando_producao: necessidades.filter((n: any) => n.status === 'AGUARDANDO_PRODUCAO_EXISTENTE').length,
            necessita_corte: necessidades.filter((n: any) => n.status === 'NECESSITA_NOVO_CORTE').length,
            em_plano: necessidades.filter((n: any) => ['INCLUIDO_EM_PLANO', 'PLANO_APROVADO'].includes(n.status)).length,
            op_gerada: necessidades.filter((n: any) => n.status === 'OP_GERADA').length,
        };

        return res.json({ necessidades, summary });
    } catch (err: any) {
        console.error('[PCP] Erro ao buscar necessidades:', err);
        return res.status(500).json({ error: 'Erro ao calcular necessidades de produção', details: err.message });
    }
});

/**
 * POST /api/pcp/necessidades/recalcular
 * Re-queries Tiny stock for all SKUs and recalculates all necessidades.
 * Saves results to producao_necessidades table.
 */
app.post('/api/pcp/necessidades/recalcular', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
    try {
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
        );

        const token = await _getEffectiveOlistToken();
        const tokenAvailable = !!token;

        const { data: orders, error: ordersErr } = await supabaseAdmin
            .from('orders')
            .select('id, order_number, client_name, deadline, status, quantity, total_via_corte, items, olist_order_id, product_type')
            .is('deleted_at', null)
            .not('status', 'in', '("Cancelado","Entregue")')
            .gt('total_via_corte', 0);

        if (ordersErr) throw ordersErr;

        const { data: opsAbertas } = await supabaseAdmin
            .from('ordens_de_producao')
            .select('*')
            .in('status', ['ABERTA', 'EM_ANDAMENTO']);

        const opMap = new Map<string, { qty_total: number; qty_comprometida: number }>();
        (opsAbertas || []).forEach((op: any) => {
            const key = `${op.product_type}|${op.color || ''}|${op.size || ''}`;
            const existing = opMap.get(key) || { qty_total: 0, qty_comprometida: 0 };
            existing.qty_total += op.qty_pendente || 0;
            existing.qty_comprometida += op.qty_comprometida || 0;
            opMap.set(key, existing);
        });

        // Cache de consultas Tiny por SKU para evitar rate-limit
        const tinyStockCache = new Map<string, number>();
        const consultadoEm = new Date().toISOString();

        const necessidadesToUpsert: any[] = [];
        const activeOrders = (orders || []).filter((o: any) =>
            o && !o.deleted_at && o.status !== 'Cancelado' && o.status !== 'Entregue'
        );

        for (const order of activeOrders) {
            const itemsList = parseOrderItems(order.items);
            if (itemsList.length === 0) continue;

            for (const item of itemsList) {
                if (!item || typeof item !== 'object') continue;

                const details = extractItemDetails(item, order.product_type || 'Vestuário');
                const qtyPedida = Number(item.quantity ?? item.quantidade ?? 1);
                let qtyCorteNeeded = Number(item.qty_corte ?? item.total_via_corte ?? 0);
                if (qtyCorteNeeded <= 0 && item.stock_available !== undefined) {
                    qtyCorteNeeded = Math.max(0, qtyPedida - Math.min(qtyPedida, Number(item.stock_available)));
                }
                if (qtyCorteNeeded <= 0) continue;

                const qtyAllocated = Number(item.qty_corte_allocated || 0);
                const qtyPending = Math.max(0, qtyCorteNeeded - qtyAllocated);
                if (qtyPending <= 0) continue;

                // Query Tiny stock (with cache and rate-limit delay)
                const sku = details.sku || item.sku || item.codigo || null;
                const idProduto = item.id_produto || null;
                let qtyEstoque = Math.max(0, Number(item.stock_available ?? 0));
                let estoqueFonte = 'LOCAL';

                if (tokenAvailable && (sku || idProduto)) {
                    const cacheKey = sku || String(idProduto);
                    if (tinyStockCache.has(cacheKey)) {
                        qtyEstoque = tinyStockCache.get(cacheKey)!;
                        estoqueFonte = 'TINY_CACHE';
                    } else {
                        await new Promise(r => setTimeout(r, 600)); // Rate-limit
                        const tinyStock = await _fetchOlistStockForItem(token, idProduto, sku);
                        if (tinyStock !== null) {
                            qtyEstoque = tinyStock;
                            estoqueFonte = 'TINY';
                            tinyStockCache.set(cacheKey, tinyStock);
                        }
                    }
                }

                const opKey = `${details.product_type}|${details.color}|${details.size}`;
                const opData = opMap.get(opKey) || { qty_total: 0, qty_comprometida: 0 };
                const qtyOpLivre = Math.max(0, opData.qty_total - opData.qty_comprometida);

                const { qty_necessaria, status } = _calcNecessidade(qtyPending, qtyEstoque, qtyOpLivre);

                necessidadesToUpsert.push({
                    order_id: order.id,
                    order_number: order.order_number,
                    sku,
                    product_type: details.product_type,
                    fabric: details.fabric !== 'Tecido não informado' ? details.fabric : null,
                    color: details.color !== 'Cor não informada' ? details.color : null,
                    size: details.size,
                    qty_pedida: qtyPending,
                    qty_reservada: qtyAllocated,
                    qty_estoque_fisico: qtyEstoque,
                    qty_estoque_disp: qtyEstoque,
                    qty_em_op: opData.qty_total,
                    qty_op_comprometida: opData.qty_comprometida,
                    qty_op_livre: qtyOpLivre,
                    qty_necessaria,
                    status,
                    estoque_consultado_em: estoqueFonte !== 'LOCAL' ? consultadoEm : null,
                    updated_at: consultadoEm,
                });
            }
        }

        // Atomic transactional RPC: deletes outdated records, inserts new ones, and records audit atomically
        const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('pcp_tx_recalcular_necessidades', {
            p_necessidades: necessidadesToUpsert,
            p_usuario: (req as any).user?.name || (req as any).user?.email || 'Sistema',
            p_detalhes: {
                total_pedidos: activeOrders.length,
                estoque_via_tiny: tinyStockCache.size,
                token_disponivel: tokenAvailable,
                consultado_em: consultadoEm,
            },
        });

        if (rpcErr) {
            console.error('[PCP] Erro transacional ao recalcular necessidades:', rpcErr);
            throw new Error(`Erro na transação de recálculo: ${rpcErr.message}`);
        }

        return res.json({
            success: true,
            total_recalculadas: rpcRes?.total_recalculadas ?? necessidadesToUpsert.length,
            estoque_consultado_tiny: tinyStockCache.size,
            token_disponivel: tokenAvailable,
            consultado_em: consultadoEm,
        });
    } catch (err: any) {
        console.error('[PCP] Erro ao recalcular necessidades:', err);
        return res.status(500).json({ error: 'Erro ao recalcular necessidades', details: err.message });
    }
});

/**
 * GET /api/pcp/planos
 * Lists all cutting plans ordered by creation date.
 */
app.get('/api/pcp/planos', async (req: any, res: any) => {
    try {
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
        );
        const { data, error } = await supabaseAdmin
            .from('planos_de_corte')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);
        if (error) throw error;
        return res.json(data || []);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/pcp/planos
 * Creates a new cutting plan draft from selected necessidades.
 * Body: { necessidades_ids, fabric, color, tipo_tecido, largura_util, qty_planejada, enfesto_data, pedidos_ids, created_by }
 */
app.post('/api/pcp/planos', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
    try {
        const actorName = getActorName(req, 'Sistema');
        const { necessidades_ids = [], fabric, color, tipo_tecido, largura_util, qty_planejada, enfesto_data, pedidos_ids = [] } = req.body;

        // Generate unique plan number
        const { data: seqData } = await supabaseAdmin.rpc('generate_plano_numero');
        const plano_numero = seqData || `PC-${new Date().getFullYear()}-${Date.now()}`;
        const idempotency_key = `${plano_numero}_${Date.now()}`;

        // Atomic transactional RPC: creates cutting plan, updates linked necessidades, and records audit atomically
        const { data: planoRow, error: rpcErr } = await supabaseAdmin.rpc('pcp_tx_criar_plano_corte', {
            p_plano: {
                plano_numero,
                status: 'RASCUNHO',
                fabric,
                color,
                tipo_tecido,
                largura_util,
                qty_planejada: qty_planejada || 0,
                enfesto_data,
                pedidos_ids,
                idempotency_key,
            },
            p_necessidades_ids: necessidades_ids || [],
            p_usuario: actorName,
            p_detalhes: {
                plano_numero,
                fabric,
                color,
            },
        });

        if (rpcErr) {
            console.error('[PCP] Erro transacional ao criar plano:', rpcErr);
            throw new Error(`Erro na transação de criação do plano: ${rpcErr.message}`);
        }

        return res.status(201).json(planoRow);
    } catch (err: any) {
        console.error('[PCP] Erro ao criar plano:', err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/pcp/planos/:id/aprovar
 * Revalidates necessidades and approves a cutting plan.
 * Requires idempotency_key to prevent double-approval.
 * Body: { qty_aprovada, idempotency_key }
 */
app.post('/api/pcp/planos/:id/aprovar', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
    try {
        const planoId = parseInt(req.params.id);
        const actorName = getActorName(req, 'Sistema');
        const { qty_aprovada, idempotency_key } = req.body;

        if (!idempotency_key) {
            return res.status(400).json({ error: 'idempotency_key é obrigatório para aprovação' });
        }

        // Atomic transactional RPC: validates status, updates plano & necessidades, and writes audit atomically
        const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('pcp_tx_aprovar_plano_corte', {
            p_plano_id: planoId,
            p_qty_aprovada: qty_aprovada,
            p_usuario: actorName,
            p_idempotency_key: idempotency_key,
        });

        if (rpcErr) {
            if (rpcErr.message?.includes('PLANO_NOT_FOUND')) {
                return res.status(404).json({ error: 'Plano não encontrado' });
            }
            if (rpcErr.message?.includes('INVALID_STATUS')) {
                return res.status(409).json({ error: rpcErr.message });
            }
            console.error('[PCP] Erro transacional ao aprovar plano:', rpcErr);
            throw new Error(`Erro na transação de aprovação: ${rpcErr.message}`);
        }

        if (rpcRes?.already_approved) {
            return res.status(409).json({ error: 'Plano já foi aprovado anteriormente', plano: rpcRes.plano });
        }

        return res.json({ success: true, plano: rpcRes?.plano });
    } catch (err: any) {
        console.error('[PCP] Erro ao aprovar plano:', err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/pcp/ops
 * Lists all production orders registered in ProComfort.
 */
app.get('/api/pcp/ops', async (req: any, res: any) => {
    try {
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
        );
        const { data, error } = await supabaseAdmin
            .from('ordens_de_producao')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);
        if (error) throw error;
        return res.json(data || []);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/pcp/ops
 * Creates a production order in ProComfort (and optionally tries Tiny API).
 * Body: { plano_corte_id, product_type, fabric, color, size, sku, qty_total, observacao, created_by }
 */
app.post('/api/pcp/ops', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
    try {
        const actorName = getActorName(req, 'Sistema');
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
        );
        const { plano_corte_id, product_type, fabric, color, size, sku, qty_total, observacao } = req.body;

        if (!product_type || !qty_total) {
            return res.status(400).json({ error: 'product_type e qty_total são obrigatórios' });
        }

        // Try Tiny API to create OP (Fase 5 — may not be available)
        let tinyResult: { tiny_op_id?: string; tiny_op_numero?: string } = {};
        let tinyAttempted = false;
        try {
            const token = await _getEffectiveOlistToken();
            if (token) {
                tinyAttempted = true;
                // Note: ordemproducao.incluir.php may not exist in Tiny API v2
                // This is a best-effort attempt
                const bodyParams = new URLSearchParams({
                    token,
                    formato: 'json',
                });
                const tinyRes = await fetch('https://api.tiny.com.br/api2/ordemproducao.incluir.php', {
                    method: 'POST',
                    body: bodyParams,
                    signal: AbortSignal.timeout(5000),
                });
                if (tinyRes.ok) {
                    const tinyJson = await tinyRes.json();
                    if (tinyJson?.retorno?.status === 'OK' && tinyJson?.retorno?.registros) {
                        const reg = tinyJson.retorno.registros[0]?.registro;
                        if (reg?.id) {
                            tinyResult = { tiny_op_id: String(reg.id), tiny_op_numero: String(reg.numero || reg.id) };
                        }
                    }
                }
            }
        } catch (_) {
            // Tiny OP creation not available — use manual fallback
        }

        const opStatus = tinyResult.tiny_op_id ? 'ABERTA' : 'PENDENTE_CADASTRO_TINY';
        const acaoAudit = tinyResult.tiny_op_id ? 'OP_GERADA_TINY' : 'OP_REGISTRADA_MANUAL';

        // Atomic transactional RPC: creates OP, updates plan status if needed, and writes audit atomically
        const { data: opData, error: rpcErr } = await supabaseAdmin.rpc('pcp_tx_registrar_op', {
            p_op_data: {
                plano_corte_id: plano_corte_id || null,
                tiny_op_id: tinyResult.tiny_op_id || null,
                tiny_op_numero: tinyResult.tiny_op_numero || null,
                sku: sku || null,
                product_type,
                fabric: fabric || null,
                color: color || null,
                size: size || null,
                qty_total,
                status: opStatus,
                tipo: plano_corte_id ? 'VINCULADA_PLANO' : 'REPOSICAO',
                observacao,
            },
            p_acao: acaoAudit,
            p_usuario: actorName,
            p_detalhes: {
                plano_id: plano_corte_id || null,
                produto: product_type,
                sku,
                tiny_attempted: tinyAttempted,
                tiny_op_id: tinyResult.tiny_op_id || null,
                status: opStatus,
            },
        });

        if (rpcErr) {
            console.error('[PCP] Erro transacional ao criar OP:', rpcErr);
            throw new Error(`Erro na transação de registro da OP: ${rpcErr.message}`);
        }

        return res.status(201).json({
            ...opData,
            tiny_criada: !!tinyResult.tiny_op_id,
            tiny_attempted: tinyAttempted,
        });
    } catch (err: any) {
        console.error('[PCP] Erro ao criar OP:', err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/pcp/ops/:id/registrar-tiny
 * Manually associates a Tiny OP number with a ProComfort OP (when auto-creation wasn't available).
 * Body: { tiny_op_numero, tiny_op_id? }
 */
app.post('/api/pcp/ops/:id/registrar-tiny', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
    try {
        const opId = parseInt(req.params.id);
        const actorName = getActorName(req, 'Sistema');
        const { tiny_op_numero, tiny_op_id } = req.body;

        if (!tiny_op_numero) {
            return res.status(400).json({ error: 'tiny_op_numero é obrigatório' });
        }

        // Atomic transactional RPC: updates OP with Tiny ID and writes audit atomically
        const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('pcp_tx_registrar_numero_tiny_op', {
            p_op_id: opId,
            p_tiny_op_numero: tiny_op_numero,
            p_tiny_op_id: tiny_op_id || tiny_op_numero,
            p_usuario: actorName,
        });

        if (rpcErr) {
            if (rpcErr.message?.includes('OP_NOT_FOUND')) {
                return res.status(404).json({ error: 'Ordem de produção não encontrada' });
            }
            console.error('[PCP] Erro transacional ao registrar Tiny na OP:', rpcErr);
            throw new Error(`Erro na transação de registro do Tiny: ${rpcErr.message}`);
        }

        return res.json({ success: true, op: rpcRes?.op });
    } catch (err: any) {
        console.error('[PCP] Erro ao registrar Tiny na OP:', err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/pcp/summary
 * Returns summary metrics for the PCP dashboard header.
 */
app.get('/api/pcp/summary', async (req: any, res: any) => {
    try {
        const [{ data: nec }, { data: planos }, { data: ops }] = await Promise.all([
            supabaseAdmin.from('producao_necessidades').select('status, qty_necessaria'),
            supabaseAdmin.from('planos_de_corte').select('status').not('status', 'in', '("CONCLUIDO","CANCELADO")'),
            supabaseAdmin.from('ordens_de_producao').select('status, qty_pendente').not('status', 'in', '("CONCLUIDA","CANCELADA")'),
        ]);

        const necessidades = nec || [];
        return res.json({
            total_necessidades: necessidades.length,
            total_pecas_necessarias: necessidades.reduce((s: number, n: any) => s + (n.qty_necessaria || 0), 0),
            coberto_estoque: necessidades.filter((n: any) => n.status === 'COBERTO_PELO_ESTOQUE').length,
            aguardando_producao: necessidades.filter((n: any) => n.status === 'AGUARDANDO_PRODUCAO_EXISTENTE').length,
            necessita_corte: necessidades.filter((n: any) => n.status === 'NECESSITA_NOVO_CORTE').length,
            em_plano: necessidades.filter((n: any) => ['INCLUIDO_EM_PLANO', 'PLANO_APROVADO'].includes(n.status)).length,
            op_gerada: necessidades.filter((n: any) => n.status === 'OP_GERADA').length,
            planos_ativos: (planos || []).length,
            ops_abertas: (ops || []).filter((o: any) => o.status !== 'PENDENTE_CADASTRO_TINY').length,
            ops_pendentes_tiny: (ops || []).filter((o: any) => o.status === 'PENDENTE_CADASTRO_TINY').length,
        });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// ── 404 for API routes ────────────────────────────────────────────────────

/**
 * POST /api/stock/sync
 * Proxies Tiny ERP stock queries server-side to avoid CORS issues.
 * Body: { token: string, products: { id_produto: string, sku: string }[] }
 */
app.post('/api/stock/sync', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
  try {
    const { token: requestToken, products } = req.body || {};
    
    // Use provided token or fall back to OAuth token
    let token = requestToken;
    if (!token || token.trim() === '') {
      token = await _getEffectiveOlistToken();
    }
    
    if (!token) return res.status(400).json({ success: false, error: 'Token n├»┬┐┬¢o configurado. Fa├»┬┐┬¢a autentica├»┬┐┬¢├»┬┐┬¢o OAuth com o Tiny.' });
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum produto informado.' });
    }

    const supabaseClient = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
    );

    const results: { id_produto: string; sku: string; stock_available: number }[] = [];

    for (const prod of products) {
      if (!prod.id_produto) continue;
      try {
        const params = new URLSearchParams({ token, id: prod.id_produto, formato: 'json' });
        const tinyRes = await fetch('https://api.tiny.com.br/api2/produto.obter.estoque.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });
        const text = await tinyRes.text();
        let json: any;
        try { json = JSON.parse(text); } catch (_) { continue; }

        const retorno = json?.retorno || {};
        if (retorno.status !== 'OK') {
          if (retorno.codigo_erro == 6) {
            // Rate limited - stop processing
            return res.json({ success: true, results, rateLimited: true });
          }
          continue;
        }

        const prod_data = retorno.produto || {};
        const saldo = prod_data.saldoDisponivel ?? prod_data.saldo_disponivel ?? prod_data.saldo ?? prod_data.saldo_fisico;
        if (saldo !== undefined && saldo !== null) {
          results.push({ id_produto: prod.id_produto, sku: prod.sku, stock_available: Math.max(0, parseFloat(saldo) || 0) });
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (_) { continue; }
    }

    // Save results to Supabase
    if (results.length > 0) {
      await supabaseClient.from('tiny_stock_cache').upsert(
        results.map(r => ({ id_produto: r.id_produto, sku: r.sku, stock_available: r.stock_available, updated_at: new Date().toISOString() })),
        { onConflict: 'id_produto' }
      );
    }

    console.log(`[StockSync] Synced ${results.length}/${products.length} products successfully`);
    return res.json({ success: true, results, synced: results.length, total: products.length, rateLimited: false });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Erro interno.' });
  }
});


// ============================================================================
// CUT PLANS — Controle Real do Chao de Fabrica
// ============================================================================

// GET /api/cut-plans — lista todos os planos com itens e movimentacoes
app.get('/api/cut-plans', async (req: any, res: any) => {
  try {
    const { data: plans, error } = await supabaseAdmin
      .from('cut_plans')
      .select('*, items:cut_plan_items(*)')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(plans || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/cut-plans/committed-quantities — quantidades comprometidas para a Central de Corte
app.get('/api/cut-plans/committed-quantities', async (_req: any, res: any) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('cut_plan_items')
      .select('order_id, item_key, quantity_planned')
      .in('status', ['PENDING_CUT', 'CUT_RELEASED', 'CUT_COMPLETED', 'IN_SEWING', 'SEWING_COMPLETED', 'IN_CUSTOMIZATION', 'COMPLETED']);
    if (error) return res.status(500).json({ error: error.message });

    const result: Record<string, number> = {};
    for (const row of (data || [])) {
      const key = `${row.order_id}::${row.item_key}`;
      result[key] = (result[key] || 0) + (row.quantity_planned || 0);
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/cut-plans/:id — plano especifico com itens e movimentacoes
app.get('/api/cut-plans/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { data: plan, error } = await supabaseAdmin
      .from('cut_plans')
      .select('*, items:cut_plan_items(*), movements:production_movements(*)')
      .eq('id', id)
      .single();
    if (error) return res.status(404).json({ error: 'Plano nao encontrado' });
    return res.json(plan);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/cut-plans — atomic transactional RPC
app.post('/api/cut-plans', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
  try {
    const actorId = getActorId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Sessão inválida ou sem identificação de usuário.' });
    }
    const { fabric, color, tipo_tecido, largura_util, items, notes, idempotency_key } = req.body || {};
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items do plano sao obrigatorios' });
    }
    const { data, error } = await supabaseAdmin.rpc('pcp_tx_create_cut_plan', {
      p_fabric: fabric || null,
      p_color: color || null,
      p_tipo_tecido: tipo_tecido || null,
      p_largura_util: largura_util || null,
      p_items: items,
      p_notes: notes || null,
      p_user_id: actorId,
      p_idempotency_key: idempotency_key || null
    });
    if (error) {
      console.error('[API] Erro ao criar cut plan via RPC:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/cut-plans/:id/release — atomic transactional RPC
app.post('/api/cut-plans/:id/release', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const actorId = getActorId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Sessão inválida ou sem identificação de usuário.' });
    }
    const { idempotency_key } = req.body || {};
    const { data, error } = await supabaseAdmin.rpc('pcp_tx_release_cut_plan', {
      p_plan_id: Number(id),
      p_user_id: actorId,
      p_idempotency_key: idempotency_key || null
    });
    if (error) {
      console.error('[API] Erro ao liberar cut plan via RPC:', error);
      const isNotFound = error.message?.includes('PLAN_NOT_FOUND');
      const isBadStatus = error.message?.includes('INVALID_STATUS');
      const status = isNotFound ? 404 : (isBadStatus ? 400 : 500);
      return res.status(status).json({ error: error.message });
    }
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/cut-plans/:id/complete-cut — atomic transactional RPC
app.post('/api/cut-plans/:id/complete-cut', canOperateProduction, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const actorId = getActorId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Sessão inválida ou sem identificação de usuário.' });
    }
    const { qty_cut_actual, notes, item_quantities, idempotency_key } = req.body || {};
    if (qty_cut_actual === undefined || Number(qty_cut_actual) < 0) {
      return res.status(400).json({ error: 'qty_cut_actual e obrigatorio e deve ser >= 0' });
    }
    const { data, error } = await supabaseAdmin.rpc('pcp_tx_complete_cut_plan', {
      p_plan_id: Number(id),
      p_qty_cut_actual: Number(qty_cut_actual),
      p_user_id: actorId,
      p_notes: notes || null,
      p_item_quantities: item_quantities || null,
      p_idempotency_key: idempotency_key || null
    });
    if (error) {
      console.error('[API] Erro ao concluir cut plan via RPC:', error);
      const isNotFound = error.message?.includes('PLAN_NOT_FOUND');
      const isBadStatus = error.message?.includes('INVALID_STATUS');
      const status = isNotFound ? 404 : (isBadStatus ? 400 : 500);
      return res.status(status).json({ error: error.message });
    }
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/cut-plans/:id/send-sewing — atomic transactional RPC
app.post('/api/cut-plans/:id/send-sewing', canOperateProduction, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const actorId = getActorId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Sessão inválida ou sem identificação de usuário.' });
    }
    const { qty_sewing, notes, faccao_id, idempotency_key } = req.body || {};
    const { data, error } = await supabaseAdmin.rpc('pcp_tx_send_cut_plan_sewing', {
      p_plan_id: Number(id),
      p_qty_sewing: Number(qty_sewing) || 0,
      p_user_id: actorId,
      p_faccao_id: faccao_id ? Number(faccao_id) : null,
      p_notes: notes || null,
      p_idempotency_key: idempotency_key || null
    });
    if (error) {
      console.error('[API] Erro ao enviar cut plan para costura via RPC:', error);
      const isNotFound = error.message?.includes('PLAN_NOT_FOUND');
      const isBadStatus = error.message?.includes('INVALID_STATUS');
      const status = isNotFound ? 404 : (isBadStatus ? 400 : 500);
      return res.status(status).json({ error: error.message });
    }
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/cut-plans/:id/return-sewing — atomic transactional RPC
app.post('/api/cut-plans/:id/return-sewing', canOperateProduction, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const actorId = getActorId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Sessão inválida ou sem identificação de usuário.' });
    }
    const { qty_returned, item_quantities, notes, idempotency_key } = req.body || {};
    const { data, error } = await supabaseAdmin.rpc('pcp_tx_return_cut_plan_sewing', {
      p_plan_id: Number(id),
      p_qty_returned: Number(qty_returned) || 0,
      p_user_id: actorId,
      p_item_quantities: item_quantities || null,
      p_notes: notes || null,
      p_idempotency_key: idempotency_key || null
    });
    if (error) {
      console.error('[API] Erro ao retornar cut plan da costura via RPC:', error);
      const isNotFound = error.message?.includes('PLAN_NOT_FOUND');
      const isBadStatus = error.message?.includes('INVALID_STATUS');
      const status = isNotFound ? 404 : (isBadStatus ? 400 : 500);
      return res.status(status).json({ error: error.message });
    }
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/cut-plans/:id/cancel — atomic transactional RPC
app.post('/api/cut-plans/:id/cancel', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const actorId = getActorId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Sessão inválida ou sem identificação de usuário.' });
    }
    const { reason, idempotency_key } = req.body || {};
    const { data, error } = await supabaseAdmin.rpc('pcp_tx_cancel_cut_plan', {
      p_plan_id: Number(id),
      p_user_id: actorId,
      p_reason: reason || null,
      p_idempotency_key: idempotency_key || null
    });
    if (error) {
      console.error('[API] Erro ao cancelar cut plan via RPC:', error);
      const isNotFound = error.message?.includes('PLAN_NOT_FOUND');
      const isBadStatus = error.message?.includes('INVALID_STATUS');
      const status = isNotFound ? 404 : (isBadStatus ? 400 : 500);
      return res.status(status).json({ error: error.message });
    }
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/cut-plans/:id/movements — historico de movimentacoes
app.get('/api/cut-plans/:id/movements', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('production_movements')
      .select('*')
      .eq('plan_id', id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── ROTAS DE CONTROLE DE FACÇÕES E TABELA DE PREÇOS (PCP) ─────────────────────
app.get('/api/pcp/faccoes', async (req: any, res: any) => {
  try {
    const { data, error } = await supabaseAdmin.from('faccoes').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/pcp/faccoes', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
  try {
    const { name, phone, active = true } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nome da facção é obrigatório' });
    const { data, error } = await supabaseAdmin.from('faccoes').insert({ name: name.trim(), phone, active }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch('/api/pcp/faccoes/:id', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { name, phone, active } = req.body;
    const updatePayload: any = {};
    if (name !== undefined) updatePayload.name = name.trim();
    if (phone !== undefined) updatePayload.phone = phone;
    if (active !== undefined) updatePayload.active = active;
    const { data, error } = await supabaseAdmin.from('faccoes').update(updatePayload).eq('id', Number(id)).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/pcp/faccao-prices', async (req: any, res: any) => {
  try {
    const { faccao_id } = req.query;
    let query = supabaseAdmin.from('faccao_prices').select('*').order('product_type');
    if (faccao_id) {
      query = query.eq('faccao_id', Number(faccao_id));
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/pcp/faccao-prices', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
  try {
    const { faccao_id, product_type, price } = req.body;
    if (!faccao_id || !product_type || price === undefined) {
      return res.status(400).json({ error: 'faccao_id, product_type e price são obrigatórios' });
    }
    const { data, error } = await supabaseAdmin.from('faccao_prices').insert({
      faccao_id: Number(faccao_id),
      product_type: String(product_type).trim(),
      price: Number(price)
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/pcp/faccao-prices/:id', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('faccao_prices').delete().eq('id', Number(id));
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch('/api/cut-plans/:id/pay-sewing', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('cut_plans').update({
      sewing_paid: true,
      sewing_paid_at: now
    }).eq('id', Number(id)).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, plan: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/:id/production-status — andamento produtivo por item do pedido
app.get('/api/orders/:id/production-status', async (req: any, res: any) => {
  try {
    const orderId = Number(req.params.id);
    const { data: items, error } = await supabaseAdmin
      .from('cut_plan_items')
      .select('*, plan:cut_plans(plan_number, created_at, released_at, status)')
      .eq('order_id', orderId)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // Agrupar por item_key
    const byItemKey: Record<string, any[]> = {};
    for (const it of (items || [])) {
      if (!byItemKey[it.item_key]) byItemKey[it.item_key] = [];
      byItemKey[it.item_key].push(it);
    }

    const summary = Object.entries(byItemKey).map(([item_key, its]) => {
      const totalPlanned = its.reduce((s, i) => s + (i.quantity_planned || 0), 0);
      const totalCut = its.reduce((s, i) => s + (i.quantity_cut || 0), 0);
      const totalSewing = its.reduce((s, i) => s + (i.quantity_sewing || 0), 0);
      const totalSewingDone = its.reduce((s, i) => s + (i.quantity_sewing_done || 0), 0);
      const firstItem = its[0];
      return {
        item_key,
        product_type: firstItem.product_type,
        fabric: firstItem.fabric,
        color: firstItem.color,
        size: firstItem.size,
        sku: firstItem.sku,
        plans: its.map(i => ({ plan_id: i.plan_id, plan_number: i.plan?.plan_number, status: i.status, quantity_planned: i.quantity_planned, quantity_cut: i.quantity_cut })),
        total_planned: totalPlanned,
        total_cut: totalCut,
        total_sewing: totalSewing,
        total_sewing_done: totalSewingDone,
        dominant_status: its[0]?.status || 'PENDING_CUT'
      };
    });

    return res.json(summary);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// ============================================================================
// MÓDULO PCP - FASE 1 & AUDITORIA
// ============================================================================

app.get('/api/pcp-phase1/dashboard', async (_req: any, res: any) => {
    try {
        const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

        const [
            { count: emProducao },
            { count: paraIniciar },
            { count: bloqueados },
            { data: necessidades },
            { count: atrasados },
        ] = await Promise.all([
            supabaseAdmin
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .is('deleted_at', null)
                .not('status', 'in', '("Cancelado","Entregue","Entrada","Rascunho")'),
            supabaseAdmin
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .is('deleted_at', null)
                .eq('status', 'Entrada')
                .eq('pcp_is_blocked', false),
            supabaseAdmin
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .is('deleted_at', null)
                .eq('pcp_is_blocked', true),
            supabaseAdmin
                .from('pcp_producao_necessidades')
                .select('qty_necessaria')
                .gt('qty_necessaria', 0),
            supabaseAdmin
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .is('deleted_at', null)
                .not('status', 'in', '("Cancelado","Entregue")')
                .lt('deadline', todayStr),
        ]);

        const pecasAProduzir = (necessidades || []).reduce(
            (acc: number, item: any) => acc + (Number(item.qty_necessaria) || 0),
            0
        );

        res.json({
            emProducao: emProducao || 0,
            paraIniciar: paraIniciar || 0,
            bloqueados: bloqueados || 0,
            pecasAProduzir: pecasAProduzir || 0,
            atrasados: atrasados || 0,
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/pcp-phase1/necessidades', async (_req: any, res: any) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('pcp_producao_necessidades')
            .select('*, orders(order_number, client_name, deadline, status, pcp_priority, pcp_is_blocked)')
            .order('qty_necessaria', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/pcp-phase1/prioridades', async (_req: any, res: any) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('*')
            .is('deleted_at', null)
            .not('status', 'in', '("Cancelado","Entregue")')
            .order('pcp_priority_score', { ascending: false })
            .order('deadline', { ascending: true })
            .limit(100);
        if (error) throw error;
        res.json(data || []);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/pcp-phase1/bloqueados', async (_req: any, res: any) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('pcp_blocks')
            .select('*, orders(*)')
            .eq('is_active', true)
            .order('data_bloqueio', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

function formatBrDateShort(dStr: string | null | undefined): string {
    if (!dStr) return 'Sem prazo';
    try {
        const parts = dStr.split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}`;
        }
        return dStr;
    } catch {
        return dStr || '';
    }
}

function computeMinhaFilaScore(ord: any, todayStr: string, pcpScore: number): number {
    let score = pcpScore * 10;
    const dl = ord.deadline ? ord.deadline.split('T')[0] : null;
    if (!dl) {
        return score;
    }
    const todayDate = new Date(`${todayStr}T00:00:00`);
    const dlDate = new Date(`${dl}T00:00:00`);
    const diffDays = Math.round((dlDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        score += 2000000 + Math.abs(diffDays) * 50000;
    } else if (diffDays === 0) {
        score += 1000000;
    } else if (diffDays <= 2) {
        score += 500000 - diffDays * 50000;
    } else {
        score += Math.max(0, 100000 - diffDays * 1000);
    }
    return score;
}

app.get('/api/pcp-phase1/minha-fila', isAuthenticated, async (req: any, res: any) => {
    try {
        const authUser = (req as any).authUser;
        let userId = req.query.user_id ? Number(req.query.user_id) : null;
        let stageId = req.query.stage_id ? Number(req.query.stage_id) : null;
        const rawStageSlug = req.query.stage_slug ? String(req.query.stage_slug).trim().toUpperCase() : null;
        const explicitAllStages = rawStageSlug === 'ALL' || req.query.all === '1' || req.query.all === 'true';
        const searchTerm = req.query.search ? String(req.query.search).trim().toLowerCase() : '';

        // Strict RBAC: Operador can ONLY see their own queue! Cannot change user_id via query
        if (authUser?.role === 'Operador') {
            userId = authUser.id;
        }

        const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
        const todayStartIso = `${todayStr}T00:00:00.000Z`;

        // 1. Fetch active stages
        const { data: rawStagesData, error: stagesErr } = await supabaseAdmin
            .from('stages')
            .select('id, name, sector_name, sort_order, active')
            .eq('active', 1)
            .order('sort_order', { ascending: true });

        if (stagesErr) throw stagesErr;

        const stagesData = (rawStagesData || [])
            .filter((s: any) => !isConferenciaStage(s))
            .map((s: any) => ({
                ...s,
                name: normalizeUtf8Text(s.name),
                sector_name: s.sector_name ? normalizeUtf8Text(s.sector_name) : s.sector_name,
                slug: getStageSlug(s),
            }));

        const stageById = new Map<number, any>(stagesData.map((s: any) => [Number(s.id), s]));

        let stageSlugFilter: string | null = rawStageSlug && rawStageSlug !== 'ALL' ? rawStageSlug : null;

        if (stageSlugFilter && !stageId) {
            const matchedBySlug = stagesData.find((s: any) => s.slug === stageSlugFilter);
            if (matchedBySlug) {
                stageId = Number(matchedBySlug.id);
            }
        } else if (stageId && !stageSlugFilter) {
            const matchedById = stageById.get(Number(stageId));
            if (matchedById) {
                stageSlugFilter = matchedById.slug;
            }
        }

        // If no explicit stageId / stageSlugFilter and NOT explicitly requesting 'ALL', see if user has a sector_name matching a stage
        if (!stageId && !stageSlugFilter && !explicitAllStages && userId) {
            const { data: uData } = await supabaseAdmin
                .from('users')
                .select('id, sector_name')
                .eq('id', userId)
                .maybeSingle();
            if (uData?.sector_name) {
                const sSlug = getStageSlug({ name: uData.sector_name, sector_name: uData.sector_name });
                const matchedStage = stagesData.find((s: any) => s.slug === sSlug);
                if (matchedStage) {
                    stageId = Number(matchedStage.id);
                    stageSlugFilter = matchedStage.slug;
                }
            }
        }

        // 2. Fetch orders in pipeline (not Cancelado, not Entregue, not Pronto, not Concluído, not Rascunho)
        const { data: rawOrdersDb, error: ordersErr } = await supabaseAdmin
            .from('orders')
            .select('*')
            .is('deleted_at', null)
            .not('status', 'in', '("Cancelado","Entregue","Pronto","Concluído","Concluido","Finalizado","Rascunho")');

        if (ordersErr) throw ordersErr;

        // 3. Fetch progress, blocks, and active executions
        const orderIds = (rawOrdersDb || []).map((o: any) => o.id);
        let progressRows: any[] = [];
        let blocksRows: any[] = [];
        let activeExecsRows: any[] = [];

        if (orderIds.length > 0) {
            const [pRes, bRes, eRes] = await Promise.all([
                supabaseAdmin
                    .from('order_stage_progress')
                    .select('*')
                    .in('order_id', orderIds),
                supabaseAdmin
                    .from('pcp_blocks')
                    .select('*')
                    .in('order_id', orderIds)
                    .eq('is_active', true),
                supabaseAdmin
                    .from('stage_executions')
                    .select('*, users(name), stages(name)')
                    .in('order_id', orderIds)
                    .in('status', ['Em andamento', 'Pausado']),
            ]);
            progressRows = pRes.data || [];
            blocksRows = bRes.data || [];
            activeExecsRows = eRes.data || [];
        }

        // Enrich orders with unified Single Source of Truth progress
        const enrichedOrders = enrichOrdersWithProgressSync(rawOrdersDb || [], progressRows, stagesData);
        const enrichedOrderById = new Map<number, any>(enrichedOrders.map((o: any) => [Number(o.id), o]));

        // Group by order
        const progressByOrder = new Map<number, any[]>();
        for (const p of progressRows) {
            if (!progressByOrder.has(p.order_id)) progressByOrder.set(p.order_id, []);
            progressByOrder.get(p.order_id)!.push(p);
        }

        const blockByOrder = new Map<number, any>();
        for (const b of blocksRows) {
            blockByOrder.set(b.order_id, b);
        }

        const activeExecByOrder = new Map<number, any[]>();
        for (const e of activeExecsRows) {
            if (!activeExecByOrder.has(e.order_id)) activeExecByOrder.set(e.order_id, []);
            activeExecByOrder.get(e.order_id)!.push(e);
        }

        // 4. User's active execution (if userId given)
        let execucaoAtual: any = null;
        if (userId) {
            const { data: userExecs } = await supabaseAdmin
                .from('stage_executions')
                .select('*, stages(name, sector_name), orders(id, order_number, client_name, product_type, print_type, quantity, deadline, items, art_url, art_urls, stages_status, required_stages, status)')
                .eq('user_id', userId)
                .in('status', ['Em andamento', 'Pausado'])
                .order('start_time', { ascending: false })
                .limit(1);

            if (userExecs && userExecs.length > 0) {
                const ex = userExecs[0];
                const { data: pauses } = await supabaseAdmin
                    .from('pauses')
                    .select('*')
                    .eq('execution_id', ex.id);
                const { totalAccumulatedSeconds, currentSessionSeconds, isPaused } = calculateExecutionTimes(ex, pauses || [], Date.now());

                const enrichedOrd = enrichedOrderById.get(Number(ex.order_id));
                let exProg = (progressByOrder.get(Number(ex.order_id)) || []).find((p: any) => Number(p.stage_id) === Number(ex.stage_id));
                if (!exProg && ex.order_id && ex.stage_id) {
                    const { data: singleProg } = await supabaseAdmin
                        .from('order_stage_progress')
                        .select('*')
                        .eq('order_id', ex.order_id)
                        .eq('stage_id', ex.stage_id)
                        .maybeSingle();
                    exProg = singleProg || null;
                }

                const qPrevista = Math.max(0, Number(exProg?.quantidade_pedido || ex.orders?.quantity || enrichedOrd?.quantity) || 0);
                const qConcluida = Math.max(0, Number(exProg?.quantidade_boa) || 0);
                const qReposicao = Math.max(0, Number(exProg?.pendencia_reposicao) || 0);
                const sRestante = Math.max(0, qPrevista - qConcluida + qReposicao);
                const exStageObj = stageById.get(Number(ex.stage_id)) || ex.stages;

                execucaoAtual = {
                    ...ex,
                    stage_name: normalizeUtf8Text(exStageObj?.name || ex.stages?.name || 'Etapa'),
                    stage_slug: getStageSlug(exStageObj || { id: ex.stage_id, name: ex.stages?.name }),
                    order_number: normalizeUtf8Text(ex.orders?.order_number || enrichedOrd?.order_number),
                    client_name: normalizeUtf8Text(ex.orders?.client_name || enrichedOrd?.client_name),
                    product_type: normalizeUtf8Text(ex.orders?.product_type || enrichedOrd?.product_type),
                    print_type: normalizeUtf8Text(ex.orders?.print_type || enrichedOrd?.print_type),
                    order_quantity: qPrevista,
                    quantidade_prevista: qPrevista,
                    quantidade_concluida: qConcluida,
                    saldo_restante: sRestante,
                    order_deadline: ex.orders?.deadline || enrichedOrd?.deadline,
                    order_items: ex.orders?.items || enrichedOrd?.items,
                    order_art_url: ex.orders?.art_url || (ex.orders?.art_urls && ex.orders?.art_urls[0]) || enrichedOrd?.art_url,
                    stages_status: enrichedOrd?.stages_status || ex.orders?.stages_status || [],
                    accumulated_pause_seconds: (pauses || []).reduce((sum: number, p: any) => sum + (p.duration_seconds || 0), 0),
                    total_time_seconds: totalAccumulatedSeconds,
                    current_session_seconds: currentSessionSeconds,
                    is_paused: isPaused,
                };
            }
        }

        // 5. Daily metrics (ignoring invalidated/reversed logs)
        let progressTodayQuery = supabaseAdmin
            .from('order_progress_logs')
            .select('quantidade_boa_incremento, user_id, observacao')
            .gte('created_at', todayStartIso);

        if (userId) {
            progressTodayQuery = progressTodayQuery.eq('user_id', userId);
        }
        const { data: logsToday } = await progressTodayQuery;
        const pecasProduzidasHoje = (logsToday || [])
            .filter((l: any) => _isValidProgressLog(l))
            .reduce((acc: number, l: any) => acc + (Number(l.quantidade_boa_incremento) || 0), 0);

        let execsTodayQuery = supabaseAdmin
            .from('stage_executions')
            .select('total_time_seconds, user_id, observation')
            .gte('start_time', todayStartIso);

        if (userId) {
            execsTodayQuery = execsTodayQuery.eq('user_id', userId);
        }
        const { data: execsToday } = await execsTodayQuery;
        const tempoProdutivoHojeSegundos = (execsToday || [])
            .filter((e: any) => !String(e.observation || '').toUpperCase().includes('[INVALIDADO'))
            .reduce((acc: number, e: any) => acc + (Number(e.total_time_seconds) || 0), 0);

        const fila: any[] = [];
        const bloqueados: any[] = [];

        for (const ord of enrichedOrders) {
            if (searchTerm) {
                const matchOrder = String(ord.order_number || '').toLowerCase().includes(searchTerm);
                const matchClient = String(ord.client_name || '').toLowerCase().includes(searchTerm);
                const matchErp = String(ord.erp_id || '').toLowerCase().includes(searchTerm);
                if (!matchOrder && !matchClient && !matchErp) {
                    continue;
                }
            }

            const isBlocked = ord.pcp_is_blocked === true;
            const blockInfo = blockByOrder.get(ord.id) || null;
            const ordProgress = progressByOrder.get(ord.id) || [];
            const ordExecs = activeExecByOrder.get(ord.id) || [];

            let reqStageIds: number[] = Array.isArray(ord.required_stages) && ord.required_stages.length > 0
                ? ord.required_stages.map(Number).filter((id: number) => id && id !== 12 && stageById.has(id))
                : [];

            // Auto-derivação a partir de stages_status para pedidos legados já em produção
            if (reqStageIds.length === 0 && Array.isArray(ord.stages_status) && ord.stages_status.length > 0) {
                reqStageIds = ord.stages_status
                    .map((s: any) => Number(s.id))
                    .filter((id: number) => id && id !== 12 && stageById.has(id));
            }

            const progMap = new Map<number, any>(ordProgress.map((p: any) => [Number(p.stage_id), p]));

            let currentStageId: number | null = null;
            let currentStageStatus: string = 'AGUARDANDO';
            let isCurrentStageReady = false;
            let activeExForCurrentStage: any = null;

            for (let i = 0; i < reqStageIds.length; i++) {
                const sId = reqStageIds[i];
                const p = progMap.get(sId);
                const sStatusJson = Array.isArray(ord.stages_status)
                    ? ord.stages_status.find((s: any) => Number(s.id) === Number(sId))
                    : null;

                // FONTE ÚNICA DE VERDADE: Se order_stage_progress existe, ele determina se a etapa está concluída
                const isFinished = p
                    ? (p.finished === true || p.status_operacao === 'CONCLUIDA' || (Number(p.quantidade_pedido || ord.quantity) > 0 && Number(p.quantidade_boa) >= Number(p.quantidade_pedido || ord.quantity) && !(Number(p.pendencia_reposicao) > 0)))
                    : Boolean(sStatusJson?.finished === true || sStatusJson?.status_operacao === 'CONCLUIDA' || sStatusJson?.status === 'Concluído' || sStatusJson?.status === 'Finalizado');

                if (!isFinished) {
                    currentStageId = sId;
                    activeExForCurrentStage = ordExecs.find((e: any) => Number(e.stage_id) === Number(sId)) || null;
                    if (activeExForCurrentStage) {
                        currentStageStatus = activeExForCurrentStage.status === 'Pausado' ? 'PAUSADA' : 'EM_ANDAMENTO';
                    } else if (p && Number(p.quantidade_boa) > 0) {
                        currentStageStatus = 'PARCIAL';
                    } else if (p?.status_operacao && p.status_operacao !== 'CONCLUIDA' && p.status_operacao !== 'EM_ANDAMENTO' && p.status_operacao !== 'PAUSADA') {
                        currentStageStatus = p.status_operacao;
                    } else {
                        let prevStageFinished = i === 0;
                        if (i > 0) {
                            const prevSId = reqStageIds[i - 1];
                            const prevP = progMap.get(prevSId);
                            const prevSJson = Array.isArray(ord.stages_status)
                                ? ord.stages_status.find((s: any) => Number(s.id) === Number(prevSId))
                                : null;
                            prevStageFinished = prevP
                                ? (prevP.finished === true || prevP.status_operacao === 'CONCLUIDA' || (Number(prevP.quantidade_pedido || ord.quantity) > 0 && Number(prevP.quantidade_boa) >= Number(prevP.quantidade_pedido || ord.quantity) && !(Number(prevP.pendencia_reposicao) > 0)))
                                : Boolean(prevSJson?.finished === true || prevSJson?.status_operacao === 'CONCLUIDA' || prevSJson?.status === 'Concluído' || prevSJson?.status === 'Finalizado');
                        }
                        currentStageStatus = prevStageFinished ? 'LIBERADA' : 'AGUARDANDO';
                    }
                    isCurrentStageReady = currentStageStatus === 'LIBERADA' || currentStageStatus === 'PARCIAL' || currentStageStatus === 'EM_ANDAMENTO' || currentStageStatus === 'PAUSADA';
                    break;
                }
            }

            if (!currentStageId) {
                // Todas as etapas de produção foram finalizadas! O pedido está PRONTO!
                if (ord.status !== 'Pronto' && ord.status !== 'Entregue' && ord.status !== 'Cancelado') {
                    const nowIso = new Date().toISOString();
                    await supabaseAdmin
                        .from('orders')
                        .update({
                            status: 'Pronto',
                            pcp_status: 'PRONTO',
                            production_finished_at: nowIso,
                            updated_at: nowIso,
                        })
                        .eq('id', ord.id);
                }
                // Concluído nunca entra na Minha Fila
                continue;
            }

            const stageObj = stageById.get(Number(currentStageId));
            const currentStageSlug = stageObj?.slug || getStageSlug(stageObj || { id: currentStageId });

            // Filtro estrito por etapa ativa (corrige Problema 10: Sublimação não mistura outras etapas)
            if (stageSlugFilter) {
                if (currentStageSlug !== stageSlugFilter) {
                    continue;
                }
            } else if (stageId) {
                if (Number(currentStageId) !== Number(stageId)) {
                    continue;
                }
            }

            if (isBlocked) {
                bloqueados.push({
                    ...ord,
                    current_stage_id: currentStageId,
                    current_stage_name: stageObj?.name || 'Etapa',
                    current_stage_slug: currentStageSlug,
                    block_info: blockInfo,
                    motivo_bloqueio: normalizeUtf8Text(blockInfo?.motivo || ord.observations || 'Bloqueado pelo PCP'),
                    data_bloqueio: blockInfo?.data_bloqueio || ord.updated_at,
                    bloqueado_por: normalizeUtf8Text(blockInfo?.bloqueado_por || 'PCP'),
                });
                continue;
            }

            const curProg = progMap.get(Number(currentStageId));
            const quantidadePrevista = Math.max(0, Number(curProg?.quantidade_pedido || ord.quantity) || 0);
            const quantidadeConcluida = Math.max(0, Number(curProg?.quantidade_boa) || 0);
            const pendenciaReposicao = Math.max(0, Number(curProg?.pendencia_reposicao) || 0);
            const saldoRestante = Math.max(0, quantidadePrevista - quantidadeConcluida + pendenciaReposicao);

            // Se saldo restante for 0, não permanece na fila
            if (quantidadePrevista > 0 && saldoRestante <= 0) {
                continue;
            }

            const hasActiveExecution = Boolean(activeExForCurrentStage);
            const activeOperatorId = activeExForCurrentStage ? Number(activeExForCurrentStage.user_id) : null;
            const activeOperatorName = activeExForCurrentStage ? normalizeUtf8Text(activeExForCurrentStage.users?.name || `Operador #${activeExForCurrentStage.user_id}`) : null;
            const isOwnedByCurrentUser = Boolean(hasActiveExecution && userId && Number(activeOperatorId) === Number(userId));

            // Regra estrita Etapa C: nunca enviar EM_ANDAMENTO/PAUSADA com canStart=true
            const canStart = Boolean(
                !hasActiveExecution &&
                (currentStageStatus === 'LIBERADA' || currentStageStatus === 'PARCIAL') &&
                saldoRestante > 0 &&
                !isBlocked
            );

            const dl = ord.deadline ? ord.deadline.split('T')[0] : null;
            let urgencia = 'normal';
            let justificativa = '';

            const pcpScore = Number(ord.pcp_priority_score) || (ord.pcp_priority === 'ALTA' ? 100 : ord.pcp_priority === 'NORMAL' ? 50 : 10);
            const pcpPriorityLabel = ord.pcp_priority || (pcpScore >= 80 ? 'ALTA' : 'NORMAL');

            if (!dl) {
                urgencia = 'normal';
                justificativa = `📅 Sem prazo definido • Prioridade ${pcpPriorityLabel}`;
            } else if (dl < todayStr) {
                urgencia = 'critica';
                justificativa = `🚨 Atrasado (${formatBrDateShort(dl)}) • Prioridade ${pcpPriorityLabel}`;
            } else if (dl === todayStr) {
                urgencia = 'alta';
                justificativa = `⚡ Vence hoje • Prioridade ${pcpPriorityLabel}`;
            } else {
                justificativa = `📅 Entrega: ${formatBrDateShort(dl)} • Prioridade ${pcpPriorityLabel}`;
            }

            fila.push({
                ...ord,
                current_stage_id: currentStageId,
                current_stage_name: stageObj?.name || 'Etapa',
                current_stage_slug: currentStageSlug,
                current_stage_status: currentStageStatus,
                is_stage_ready: isCurrentStageReady,
                can_start: canStart,
                canStart: canStart,
                quantidade_prevista: quantidadePrevista,
                quantidade_concluida: quantidadeConcluida,
                saldo_restante: saldoRestante,
                active_execution_id: activeExForCurrentStage?.id || null,
                active_operator_id: activeOperatorId,
                active_operator_name: activeOperatorName,
                is_owned_by_current_user: isOwnedByCurrentUser,
                active_executions: ordExecs,
                urgencia,
                justificativa_base: justificativa,
                score_ordenacao: computeMinhaFilaScore(ord, todayStr, pcpScore),
            });
        }

        fila.sort((a, b) => b.score_ordenacao - a.score_ordenacao);

        fila.forEach((item, idx) => {
            item.posicao_fila = idx + 1;
            item.justificativa = `${item.posicao_fila}º na Fila • ${item.justificativa_base}`;
        });

        // Soma das peças restantes reais na fila filtrada
        const pecasPendentesFila = fila.reduce((acc, o) => acc + (Number(o.saldo_restante ?? o.quantity) || 0), 0);
        const tarefasEmAndamento = activeExecsRows.filter((e: any) => e.status === 'Em andamento').length;

        res.json({
            fila,
            bloqueados,
            execucao_atual: execucaoAtual,
            metricas: {
                pecas_pendentes_fila: pecasPendentesFila,
                tarefas_em_andamento: tarefasEmAndamento,
                pecas_produzidas_hoje: pecasProduzidasHoje,
                tempo_produtivo_hoje_segundos: tempoProdutivoHojeSegundos,
            },
            filtro: {
                user_id: userId,
                stage_id: stageId,
                stage_slug: stageSlugFilter || 'ALL',
            }
        });
    } catch (e: any) {
        console.error('[API] Erro ao carregar minha-fila:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/pcp-phase1/ordens/:id/bloqueio', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
    try {
        const orderId = Number(req.params.id);
        const { motivo, observacao, stage_id } = req.body || {};
        const actor = getActorName(req, 'PCP/Supervisor');

        if (!motivo || !String(motivo).trim()) {
            return res.status(400).json({ error: 'O motivo do bloqueio é obrigatório.' });
        }

        const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('pcp_tx_bloquear_ordem', {
            p_order_id: orderId,
            p_motivo: String(motivo).trim(),
            p_observacao: observacao || null,
            p_usuario: actor,
            p_stage_id: stage_id ? Number(stage_id) : null,
        });

        if (rpcErr) {
            console.error('[API] Erro ao executar pcp_tx_bloquear_ordem:', rpcErr);
            return res.status(500).json({ error: `Erro ao bloquear pedido: ${rpcErr.message}`, code: 'RPC_EXECUTION_ERROR' });
        }

        const httpStatus = Number(rpcRes?.http_status) || 200;
        if (rpcRes?.error) {
            return res.status(httpStatus).json(rpcRes);
        }

        res.status(httpStatus).json({ success: true, status_operacao: 'BLOQUEADA' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/pcp-phase1/ordens/:id/desbloqueio', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
    try {
        const orderId = Number(req.params.id);
        const { motivo } = req.body || {};
        const actor = getActorName(req, 'PCP/Supervisor');

        const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('pcp_tx_desbloquear_ordem', {
            p_order_id: orderId,
            p_motivo: motivo || 'Impedimento resolvido',
            p_usuario: actor,
        });

        if (rpcErr) {
            console.error('[API] Erro ao executar pcp_tx_desbloquear_ordem:', rpcErr);
            return res.status(500).json({ error: `Erro ao desbloquear pedido: ${rpcErr.message}`, code: 'RPC_EXECUTION_ERROR' });
        }

        const httpStatus = Number(rpcRes?.http_status) || 200;
        if (rpcRes?.error) {
            return res.status(httpStatus).json(rpcRes);
        }

        res.status(httpStatus).json({ success: true, next_pcp_status: rpcRes?.next_pcp_status });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/pcp-phase1/ordens/:id/prioridade_manual', isPcpOrSupervisorOrAdmin, async (req: any, res: any) => {
    try {
        const orderId = Number(req.params.id);
        const { priority, score, motivo } = req.body || {};
        const actor = getActorName(req, 'PCP');

        const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('pcp_tx_alterar_prioridade', {
            p_order_id: orderId,
            p_priority: priority || 'CRÍTICA',
            p_score: score !== undefined ? Number(score) : null,
            p_motivo: motivo || null,
            p_usuario: actor,
        });

        if (rpcErr) {
            console.error('[API] Erro ao executar pcp_tx_alterar_prioridade:', rpcErr);
            return res.status(500).json({ error: `Erro ao alterar prioridade: ${rpcErr.message}`, code: 'RPC_EXECUTION_ERROR' });
        }

        const httpStatus = Number(rpcRes?.http_status) || 200;
        if (rpcRes?.error) {
            return res.status(httpStatus).json(rpcRes);
        }

        res.status(httpStatus).json({ success: true, pcp_priority: rpcRes?.pcp_priority, pcp_priority_score: rpcRes?.pcp_priority_score });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/pcp-phase1/config', async (_req: any, res: any) => {
    try {
        const { data, error } = await supabaseAdmin.from('pcp_settings').select('*').eq('id', 1).maybeSingle();
        if (error) throw error;
        if (data) return res.json(data);

        const defaultSettings = {
            id: 1,
            peso_prazo: 50,
            peso_volume: 20,
            peso_complexidade: 15,
            peso_atraso: 100,
            dias_alerta_risco: 2,
            updated_at: new Date().toISOString(),
        };
        try {
            await supabaseAdmin.from('pcp_settings').upsert(defaultSettings, { onConflict: 'id' });
        } catch (upsertErr) {
            console.warn('[PCP Settings] Aviso ao gravar configurações padrão:', upsertErr);
        }
        return res.json(defaultSettings);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/pcp-phase1/audit-log', isAuditReader, async (req: any, res: any) => {
    try {
        const { order_id, limit } = req.query;
        const maxRows = Math.min(200, Number(limit) || 50);
        let query = supabaseAdmin
            .from('pcp_audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(maxRows);

        if (order_id) {
            query = query.eq('order_id', Number(order_id));
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
            return res.json(data);
        }

        // Fallback to order_history so audit trail is always available even before RLS migration is applied
        let histQuery = supabaseAdmin
            .from('order_history')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(maxRows);
        if (order_id) {
            histQuery = histQuery.eq('order_id', Number(order_id));
        }
        const { data: histData } = await histQuery;
        if (histData && histData.length > 0) {
            return res.json(histData);
        }

        let obsQuery = supabaseAdmin
            .from('stage_observations')
            .select('*')
            .ilike('observation', '[AUDIT]%')
            .order('created_at', { ascending: false })
            .limit(maxRows);
        if (order_id) {
            obsQuery = obsQuery.eq('order_id', Number(order_id));
        }
        const { data: obsData } = await obsQuery;
        const parsedObs = (obsData || []).map((row: any) => {
            try {
                const payload = JSON.parse(String(row.observation || '').replace(/^\[AUDIT\]\s*/, ''));
                return {
                    id: row.id,
                    order_id: row.order_id,
                    stage_id: row.stage_id,
                    user_id: row.user_id,
                    ...payload,
                    created_at: row.created_at,
                };
            } catch (_) {
                return row;
            }
        });
        return res.json(parsedObs);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// Formal Expedition / Client Delivery endpoint (distinguishing Pronto na Fábrica vs Entregue ao Cliente)
app.post('/api/orders/:id/expedir', isAdminOrComercial, async (req: any, res: any) => {
    try {
        const orderId = Number(req.params.id);
        const usuario = getActorName(req, 'Expedição');
        const { observacao } = req.body || {};

        const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('pcp_tx_expedir_ordem', {
            p_order_id: orderId,
            p_observacao: observacao || null,
            p_usuario: usuario,
        });

        if (rpcErr) {
            console.error('[API] Erro ao executar pcp_tx_expedir_ordem:', rpcErr);
            return res.status(500).json({ error: `Erro ao expedir pedido: ${rpcErr.message}`, code: 'RPC_EXECUTION_ERROR' });
        }

        const httpStatus = Number(rpcRes?.http_status) || 200;
        if (rpcRes?.error) {
            return res.status(httpStatus).json(rpcRes);
        }

        return res.status(httpStatus).json({
            success: true,
            status: rpcRes?.status || 'Entregue',
            pcp_status: rpcRes?.pcp_status || 'EXPEDIDO_ENTREGUE',
            delivered_at: rpcRes?.delivered_at,
        });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

app.all("/api/*", (req: any, res: any) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

export default app;

