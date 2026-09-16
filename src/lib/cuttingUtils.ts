import type { OrderItem, Order, CorteDemandItem, OrderCorteDemand, CorteAllocationLog, CuttingAllocationResult, CorteGroupDemand, CorteModelBreakdown, TechnicalProductRegistry, StockCache } from '../types';
import { getCachedRegistryItem } from './technicalRegistryUtils';

/**
 * Safely parses order items array whether it comes as an Array or a JSON string.
 */
export function parseOrderItems(itemsRaw: any): any[] {
  if (!itemsRaw) return [];
  if (Array.isArray(itemsRaw)) return itemsRaw;
  if (typeof itemsRaw === 'string') {
    try {
      const parsed = JSON.parse(itemsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

export const ADULT_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'EXG', 'XXL', 'G1', 'G2', 'G3', 'G4', 'G5'];
export const CHILD_SIZES = ['1', '2', '4', '6', '8', '10', '12', '14', '16'];

export const COLOR_PATTERNS: { name: string; pattern: RegExp }[] = [
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

/**
 * Custom sort function for size strings according to production standards:
 * Adult: PP -> P -> M -> G -> GG -> XGG -> EXG -> XXL -> G1 -> G2 -> G3 -> G4 -> G5
 * Child: 1 -> 2 -> 4 -> 6 -> 8 -> 10 -> 12 -> 14 -> 16
 * Others/Unico at end.
 */
export function sortSizes(sizes: string[]): string[] {
  if (!Array.isArray(sizes)) return [];
  const adultOrderMap: Record<string, number> = {
    'PP': 10, 'P': 20, 'M': 30, 'G': 40, 'GG': 50,
    'XGG': 55, 'EXG': 58, 'XXL': 59,
    'G1': 60, 'G2': 70, 'G3': 80, 'G4': 90, 'G5': 100
  };

  const getRank = (size: string): { type: number; rank: number; raw: string } => {
    const clean = (size || '').toString().trim().toUpperCase();
    if (adultOrderMap[clean] !== undefined) {
      return { type: 1, rank: adultOrderMap[clean], raw: clean };
    }
    const num = parseInt(clean, 10);
    if (!isNaN(num) && String(num) === clean) {
      return { type: 2, rank: num, raw: clean };
    }
    if (clean === 'ÚNICO' || clean === 'UNICO' || clean === 'TU') {
      return { type: 3, rank: 999, raw: clean };
    }
    return { type: 4, rank: 1000, raw: clean };
  };

  return [...sizes].sort((a, b) => {
    const rankA = getRank(a);
    const rankB = getRank(b);
    if (rankA.type !== rankB.type) return rankA.type - rankB.type;
    if (rankA.rank !== rankB.rank) return rankA.rank - rankB.rank;
    return rankA.raw.localeCompare(rankB.raw);
  });
}

/**
 * Returns item grade category (ADULTO_UNISSEX, BABYLOOK, PLUS_SIZE, INFANTIL)
 */
export function getItemGradeCategory(size: string, productType: string = ''): 'ADULTO_UNISSEX' | 'BABYLOOK' | 'PLUS_SIZE' | 'INFANTIL' {
  const normSize = (size || '').toUpperCase().trim();
  const normType = (productType || '').toUpperCase().trim();

  if (/BABYLOOK|BABY-LOOK/i.test(normType)) {
    return 'BABYLOOK';
  }
  if (CHILD_SIZES.includes(normSize) || /INFANTIL/i.test(normType)) {
    return 'INFANTIL';
  }
  if (['G1', 'G2', 'G3', 'G4', 'G5'].includes(normSize)) {
    return 'PLUS_SIZE';
  }
  return 'ADULTO_UNISSEX';
}

/**
 * Normalizes item size for display and cutting requirements.
 */
export function getItemDisplaySize(item: any): string {
  if (!item) return 'Tamanho não informado';

  const desc = (item.description || item.descricao || '').toString().trim();
  const sku = (item.sku || item.codigo || '').toString().trim();
  const text = `${desc} ${sku}`;

  // 1. Adult size token match (G5 -> G4 -> G3 -> G2 -> G1 -> XGG -> EXG -> XXL -> GG -> PP -> P -> M -> G)
  const adultMatch = text.match(/(?:^|[\s\-\–\/\|_,])(G5|G4|G3|G2|G1|XGG|EXG|XXL|GG|PP|P|M|G)(?:[\s\-\–\/\|_,]|$)/i);
  if (adultMatch) {
    return adultMatch[1].toUpperCase();
  }

  // 2. SKU Suffix match
  const skuMatch = sku.match(/-(G5|G4|G3|G2|G1|XGG|EXG|XXL|GG|PP|P|M|G|16|14|12|10|8|6|4|2|1)$/i);
  if (skuMatch) {
    return skuMatch[1].toUpperCase();
  }

  // 3. Child numeric explicit pattern match (Tam 10, Tamanho 10, Infantil 10, Tam. 10)
  const childExplicitMatch = text.match(/\b(?:tam|tamanho|inf|infantil|tam\.)\s*[:\-–]?\s*(16|14|12|10|8|6|4|2|1)\b/i);
  if (childExplicitMatch) {
    return childExplicitMatch[1];
  }

  // 4. Child numeric end-of-string pattern match (e.g. "- 2", "– 2", "/ 2", "- 10")
  const childEndMatch = text.match(/(?:–|-|\/)\s*(16|14|12|10|8|6|4|2|1)\s*$/i);
  if (childEndMatch) {
    return childEndMatch[1];
  }

  // 5. Child numeric match anywhere if text contains "infantil", "inf", "criança", or "kids"
  if (/\b(?:infantil|inf|criança|kids)\b/i.test(text)) {
    const childNumberMatch = text.match(/\b(16|14|12|10|8|6|4|2|1)\b/);
    if (childNumberMatch) {
      return childNumberMatch[1];
    }
  }

  // 6. Structured raw size field from object (if valid specific size, e.g. P, M, G, GG, G1..G5, 1..16)
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

  // 7. Explicit "Único" check in description / SKU if no specific size token was matched
  if (/\b(tamanho\s*únic[oa]|tamanho\s*unico|tam\.\s*único|único|unica|tu)\b/i.test(text)) {
    return 'Único';
  }

  return 'Tamanho não informado';
}

/**
 * Extracts technical product_type, fabric, color, size, and cutting specifications.
 * CRITICAL RULE: DOES NOT GUESS fabric or color from description/SKU if technical field is missing or 'não informada'.
 */

export interface IncompleteFamilyGroup {
  sku_base: string;
  product_type: string;
  items: CorteDemandItem[];
  suggested_fabric?: string;
  suggested_color?: string;
  total_pieces: number;
}

export function extractBaseSku(sku: string, size: string, description: string): string {
  if (!sku && !description) return 'SEM-REF';
  const rawDesc = (description || '').toUpperCase().trim();
  const rawSku = (sku || '').toUpperCase().trim();
  const cleanSize = (size || '').toUpperCase().trim();

  if (rawSku) {
    if (cleanSize !== 'TAMANHO N�O INFORMADO' && cleanSize !== '' && rawSku.endsWith('-' + cleanSize)) {
      return rawSku.slice(0, -(cleanSize.length + 1));
    }
    const match = rawSku.match(/^(.*?)-(?:G5|G4|G3|G2|G1|XGG|EXG|XXL|GG|PP|P|M|G|16|14|12|10|8|6|4|2|1)$/i);
    if (match) return match[1];
    return rawSku;
  }
  
  let cleanDesc = rawDesc
    .replace(/(?: - |- |\/|\|)\s*(G5|G4|G3|G2|G1|EXG|XXL|XGG|GG|G|M|P|PP|16|14|12|10|8|6|4|2|1)\b/gi, '')
    .trim();
  return cleanDesc || 'SEM-REF';
}

export function extractItemDetails(item: any, defaultProductType: string = 'Vestuário'): {
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

  // 1. Extração ESTRITA do TECIDO técnico (sem adivinhar pelo nome quando ausente)
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

  // 2. Extração ESTRITA da COR técnica (sem adivinhar pelo nome quando ausente)
  const rawColor = (item.color || item.cor || item.variacao?.cor || item.grade?.cor || item.atributos?.cor || '').toString().trim();
  let color = 'Cor não informada';
  if (rawColor && !/^(cor\s+)?n[aã]o\s+informad[ao]$/i.test(rawColor)) {
    const matchCat = COLOR_PATTERNS.find(c => c.pattern.test(rawColor));
    color = matchCat ? matchCat.name : rawColor;
  }

  // 3. Extração do TAMANHO
  let size = getItemDisplaySize(item);
  if (!size) size = 'Tamanho não informado';

  // 4. Extração do MODELO
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
      // Clean up fabric/color/size suffixes to extract exact custom model name
      let clean = rawDesc
        .replace(/(?:–|-|\/|\|)\s*(AZUL\s*MARINHO|VERDE\s*MENTA|CINZA\s*MESCLA|OFF\s*WHITE|PRETO|BRANCO|MARROM|AZUL|VERMELHO|VERDE|CINZA|ROSA|AMARELO|ROXO|LARANJA|VINHO|BEGE|GRAFITE)\b/gi, '')
        .replace(/(?:–|-|\/|\|)\s*(G5|G4|G3|G2|G1|EXG|XXL|XGG|GG|G|M|P|PP|16|14|12|10|8|6|4|2|1)\b/gi, '')
        .replace(/\b(?:tam|tamanho|infantil)\s*[:\-–]?\s*(16|14|12|10|8|6|4|2|1)\b/gi, '')
        .replace(/(?:–|-|\/|\|)?\s*(DRY\s*FIT|DRY\s*COMFORT|POLIAMIDA|ALGOD[AÃ]O|PIQUET|PV)\b/gi, '')
        .replace(/\b(PRETO|BRANCO|MARROM|AZUL\s*MARINHO|AZUL|VERMELHO|VERDE|CINZA|ROSA|AMARELO|ROXO|LARANJA|VINHO)\b/gi, '')
        .replace(/[\-\–\/,\|\s]+$/, '').trim();
      productType = clean || defaultProductType || 'Modelo não informado';
    } else {
      productType = 'Modelo não informado';
    }
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

  const is_complete =
    productType !== 'Modelo não informado' &&
    fabric !== 'Tecido não informado' &&
    color !== 'Cor não informada' &&
    size !== 'Tamanho não informado';

  const description = rawDesc || `${productType} ${fabric} ${color}`;
  const item_key = `${productType} | ${fabric} | ${color} | ${size}`;

  return {
    product_type: productType,
    fabric,
    color,
    size,
    description,
    sku: rawSku,
    item_key,
    is_complete,
    tipo_tecido,
    largura_util,
    lote,
    orientacao,
    missing_fields
  };
}


/**
 * Calculates total corte pieces needed for an entire order across all fields
 */
export function getOrderCuttingNeeded(order: any, stockCache: StockCache = {}): number {
  if (!order || order.deleted_at || order.status === 'Cancelado' || order.status === 'Entregue') {
    return 0;
  }
  try {
    // Priority: Dynamic calculation via stockCache
    if (Object.keys(stockCache).length > 0) {
      const itemsList = parseOrderItems(order.items);
      if (itemsList.length > 0) {
        let sumCorte = itemsList.reduce((acc, it) => {
          if (!it || typeof it !== 'object') return acc;
          const qPedida = Number(it.quantity ?? it.quantidade ?? 1);
          let cQty = it.qty_corte ?? it.total_via_corte;
          if (cQty === undefined || cQty === null) {
            const currentStock = stockCache[it.id_produto] !== undefined ? stockCache[it.id_produto] : it.stock_available;
            if (currentStock !== undefined && currentStock !== null) {
              cQty = Math.max(0, qPedida - Math.min(qPedida, Number(currentStock)));
            } else if (it.qty_separacao !== undefined && it.qty_separacao !== null) {
              cQty = Math.max(0, qPedida - Math.min(qPedida, Number(it.qty_separacao)));
            } else {
              cQty = 0;
            }
          }
          return acc + Number(cQty);
        }, 0);
        return sumCorte;
      }
    }

    // 1. Direct order total_via_corte
    if (order.total_via_corte !== undefined && order.total_via_corte !== null && Number(order.total_via_corte) > 0) {
      return Number(order.total_via_corte);
    }
    // 2. Corte stage progress (stage_id = 2)
    const stagesList = Array.isArray(order.stages_status)
      ? order.stages_status
      : (typeof order.stages_status === 'string' ? JSON.parse(order.stages_status || '[]') : []);
    const corteStage = stagesList.find((s: any) => Number(s.id) === 2 || s.name?.toLowerCase() === 'corte');
    if (corteStage && Number(corteStage.quantidade_pedido || 0) > 0) {
      return Number(corteStage.quantidade_pedido);
    }
    // 3. Sum of items if items array exists
    const itemsList = parseOrderItems(order.items);
    if (itemsList.length > 0) {
      const sumCorte = itemsList.reduce((acc, it) => {
        if (!it || typeof it !== 'object') return acc;
        const qPedida = Number(it.quantity ?? it.quantidade ?? 1);
        let cQty = it.qty_corte ?? it.total_via_corte;
        if (cQty === undefined || cQty === null) {
          if (it.stock_available !== undefined && it.stock_available !== null) {
            cQty = Math.max(0, qPedida - Math.min(qPedida, Number(it.stock_available)));
          } else if (it.qty_separacao !== undefined && it.qty_separacao !== null) {
            cQty = Math.max(0, qPedida - Math.min(qPedida, Number(it.qty_separacao)));
          } else {
            cQty = 0;
          }
        }
        return acc + Number(cQty);
      }, 0);
      if (sumCorte > 0) return sumCorte;
    }
    // 4. Observation regex fallback
    if (order.observations) {
      const match = order.observations.match(/(\d+)\s*p.*sem\s*estoque/i);
      if (match) {
        return parseInt(match[1], 10) || 0;
      }
    }
  } catch (err) {
    console.warn('[cuttingUtils] Error in getOrderCuttingNeeded:', err);
  }
  return 0;
}

  /**
 * Aggregates all missing cutting pieces across all active open orders,
 * grouped by model + color + size (maintaining Olist ERP writing format),
 * sorted by closest deadline first.
 */
export function aggregateCuttingDemand(orders: any[], stockCache: StockCache = {}): CorteDemandItem[] {
  if (!Array.isArray(orders)) return [];
  const demandMap = new Map<string, CorteDemandItem>();

  try {
    const activeOrders = orders.filter(o => o && typeof o === 'object' && !o.deleted_at && o.status !== 'Cancelado' && o.status !== 'Entregue');

    for (const order of activeOrders) {
      const orderNeededTotal = getOrderCuttingNeeded(order, stockCache);
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
            if ((stockCache[item.id_produto] !== undefined ? stockCache[item.id_produto] : item.stock_available) !== undefined && (stockCache[item.id_produto] !== undefined ? stockCache[item.id_produto] : item.stock_available) !== null) {
              cQty = Math.max(0, qPedida - Math.min(qPedida, Number((stockCache[item.id_produto] !== undefined ? stockCache[item.id_produto] : item.stock_available))));
            } else if (item.qty_separacao !== undefined && item.qty_separacao !== null) {
              cQty = Math.max(0, qPedida - Math.min(qPedida, Number(item.qty_separacao)));
            } else {
              cQty = 0;
            }
          } else {
            cQty = Number(cQty);
          }

          itemNeeds.push({ item, qtyCorteNeeded: cQty });
          knownSum += cQty;
        }

        if (knownSum <= 0 && orderNeededTotal > 0) {
          if (itemsList.length === 1) {
            itemNeeds[0].qtyCorteNeeded = orderNeededTotal;
          } else {
            const totalOrderPieces = itemsList.reduce((acc: number, it: any) => acc + Number(it?.quantity ?? it?.quantidade ?? 1), 0) || 1;
            itemNeeds.forEach(it => {
              const itemQty = Number(it.item?.quantity ?? it.item?.quantidade ?? 1);
              it.qtyCorteNeeded = Math.round((itemQty / totalOrderPieces) * orderNeededTotal);
            });
          }
        }

        for (const { item, qtyCorteNeeded } of itemNeeds) {
          if (!item || qtyCorteNeeded <= 0) continue;

          const qtyAllocated = Number(item.qty_corte_allocated || 0);
          const qtyPending = Math.max(0, qtyCorteNeeded - qtyAllocated);

          if (qtyPending <= 0) continue;

          const { product_type, fabric, color, size, description, sku, item_key, is_complete, tipo_tecido, largura_util, lote, orientacao, missing_fields } = extractItemDetails(item, order.product_type);

          // Skip generic legacy mock items (e.g. "Dry Fit Única | Único") without detailed SKU/Olist breakdown
          if (item_key.toLowerCase().includes('dry fit única | único') || item_key.toLowerCase().includes('item | único')) {
            continue;
          }

          const orderDemand: OrderCorteDemand = {
            order_id: order.id,
            order_number: order.order_number || `PED-${order.id}`,
            client_name: order.client_name || 'Cliente',
            deadline: order.deadline || new Date().toISOString(),
            item_quantity: Number(item.quantity ?? item.quantidade ?? 1),
            qty_corte_needed: qtyCorteNeeded,
            qty_corte_allocated: qtyAllocated,
            qty_corte_pending: qtyPending
          };

          if (!demandMap.has(item_key)) {
            demandMap.set(item_key, {
              item_key,
              product_type,
              fabric,
              color,
              size,
              description,
              sku,
              is_complete,
              tipo_tecido,
              largura_util,
              lote,
              orientacao,
              missing_fields,
              total_necessario: 0,
              pedidos_count: 0,
              prazo_mais_proximo: order.deadline || new Date().toISOString(),
              pedidos_waiting: []
            });
          }


          const existing = demandMap.get(item_key)!;
          existing.total_necessario += qtyPending;
          existing.pedidos_waiting.push(orderDemand);

          if (order.deadline && order.deadline < existing.prazo_mais_proximo) {
            existing.prazo_mais_proximo = order.deadline;
          }
        }
      } else {
        // Skip fallback for orders without item list (legacy mock orders without Olist items)
        continue;
      }

    }
  } catch (err) {
    console.error('[cuttingUtils] Error in aggregateCuttingDemand:', err);
  }

  const result: CorteDemandItem[] = Array.from(demandMap.values());

  for (const item of result) {
    item.pedidos_waiting.sort((a, b) => {
      if (a.deadline === b.deadline) return a.order_id - b.order_id;
      return (a.deadline || '').localeCompare(b.deadline || '');
    });
    item.pedidos_count = item.pedidos_waiting.length;
    if (item.pedidos_waiting.length > 0) {
      item.prazo_mais_proximo = item.pedidos_waiting[0].deadline;
    }
  }

  result.sort((a, b) => (a.prazo_mais_proximo || '').localeCompare(b.prazo_mais_proximo || ''));

  return result;
}

/**
 * Registers production of cut pieces for a specific aggregated item (item_key)
 * and distributes the pieces automatically to waiting orders prioritized by closest deadline first.
 */
export function allocateCuttingPieces(
  orders: any[],
  targetItemKey: string,
  cutQty: number,
  operatorName: string = 'Operador',
  userId: number = 1,
  allocationLogsStore: CorteAllocationLog[] = []
): CuttingAllocationResult {
  if (cutQty <= 0) {
    return {
      success: false,
      item_key: targetItemKey,
      total_cut: 0,
      total_allocated: 0,
      unallocated_remaining: 0,
      allocations: [],
      affected_order_ids: []
    };
  }

  const demandList = aggregateCuttingDemand(orders);
  const targetDemand = demandList.find(d => d.item_key === targetItemKey);

  if (!targetDemand || targetDemand.pedidos_waiting.length === 0) {
    return {
      success: false,
      item_key: targetItemKey,
      total_cut: cutQty,
      total_allocated: 0,
      unallocated_remaining: cutQty,
      allocations: [],
      affected_order_ids: []
    };
  }

  let remainingToAllocate = cutQty;
  const newLogs: CorteAllocationLog[] = [];
  const affectedOrderIdsSet = new Set<number>();

  for (const ordDemand of targetDemand.pedidos_waiting) {
    if (remainingToAllocate <= 0) break;

    const order = orders.find(o => o.id === ordDemand.order_id);
    if (!order) continue;

    const allocQty = Math.min(remainingToAllocate, ordDemand.qty_corte_pending);
    if (allocQty <= 0) continue;

    // 1. Update item-level allocation inside order.items
    const itemsList = parseOrderItems(order.items);
    if (itemsList.length > 0) {
      for (const item of itemsList) {
        const { item_key } = extractItemDetails(item, order.product_type);
        if (item_key === targetItemKey) {
          item.qty_corte_allocated = (item.qty_corte_allocated || 0) + allocQty;
          break;
        }
      }
      order.items = itemsList;
    }

    // 2. Update order stage 2 (Corte) progress
    const stagesList = Array.isArray(order.stages_status)
      ? order.stages_status
      : (typeof order.stages_status === 'string' ? JSON.parse(order.stages_status || '[]') : []);
    const corteStage = stagesList.find((s: any) => Number(s.id) === 2);
    if (corteStage) {
      corteStage.quantidade_boa = (corteStage.quantidade_boa || 0) + allocQty;
      const totalReq = corteStage.quantidade_pedido || order.total_via_corte || order.quantity || 1;
      if (corteStage.quantidade_boa >= totalReq) {
        corteStage.finished = true;
      }
    }
    order.stages_status = stagesList;

    // 3. Create allocation log
    const logEntry: CorteAllocationLog = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      order_id: order.id,
      order_number: order.order_number,
      item_key: targetItemKey,
      product_type: targetDemand.product_type,
      color: targetDemand.color,
      size: targetDemand.size,
      quantidade_alocada: allocQty,
      status: 'active',
      user_id: userId,
      user_name: operatorName,
      created_at: new Date().toISOString()
    };

    allocationLogsStore.push(logEntry);
    newLogs.push(logEntry);
    affectedOrderIdsSet.add(order.id);
    remainingToAllocate -= allocQty;
  }

  return {
    success: true,
    item_key: targetItemKey,
    total_cut: cutQty,
    total_allocated: cutQty - remainingToAllocate,
    unallocated_remaining: remainingToAllocate,
    allocations: newLogs,
    affected_order_ids: Array.from(affectedOrderIdsSet)
  };
}

/**
 * Handles automatic reallocation of cut pieces when an order is cancelled.
 * Frees pieces previously allocated to the cancelled order and distributes them to remaining orders in queue.
 */
export function reallocateOnCancellation(
  cancelledOrderId: number,
  orders: any[],
  allocationLogsStore: CorteAllocationLog[]
): CorteAllocationLog[] {
  const activeAllocations = allocationLogsStore.filter(
    l => l.order_id === cancelledOrderId && l.status === 'active'
  );

  if (activeAllocations.length === 0) return [];

  const reallocatedLogs: CorteAllocationLog[] = [];

  for (const log of activeAllocations) {
    log.status = 'released';
    const freedQty = log.quantidade_alocada;
    const itemKey = log.item_key;

    const result = allocateCuttingPieces(
      orders,
      itemKey,
      freedQty,
      `Sistema (Realocação de PED-${cancelledOrderId})`,
      1,
      allocationLogsStore
    );

    if (result.success && result.allocations.length > 0) {
      for (const newLog of result.allocations) {
        newLog.status = 'reallocated';
        reallocatedLogs.push(newLog);
      }
    }
  }

  return reallocatedLogs;
}

/**
 * Groups cutting demand strictly by Raw Material and physical cutting conditions:
 * TECIDO + COR + TIPO DE TECIDO/CORTE + LARGURA ÚTIL (+ lote/orientação quando existirem).
 *
 * Model (product_type) is NOT used to separate groups! Models sharing the same material
 * and cutting compatibility form a single cutting group.
 *
 * Items with missing technical fabric or color (or 'não informada') are segregated
 * into incompleteItems to prevent automatic grouping and prompt user correction.
 */
export function groupCuttingDemandByRawMaterial(demandItems: CorteDemandItem[]): {
  groups: CorteGroupDemand[];
  incompleteFamilies: IncompleteFamilyGroup[];
} {
  const groupsMap = new Map<string, CorteGroupDemand>();
  const incompleteFamiliesMap = new Map<string, IncompleteFamilyGroup>();

  for (const item of demandItems) {
    if (item.is_complete === false) {
      const familyKey = item.sku_base + '___' + item.product_type;
      if (!incompleteFamiliesMap.has(familyKey)) {
        incompleteFamiliesMap.set(familyKey, {
          sku_base: item.sku_base || 'SEM-REF',
          product_type: item.product_type,
          items: [],
          suggested_fabric: item.suggested_fabric,
          suggested_color: item.suggested_color,
          total_pieces: 0
        });
      }
      const fam = incompleteFamiliesMap.get(familyKey)!;
      fam.items.push(item);
      fam.total_pieces += item.total_necessario;
      
      if (!fam.suggested_fabric && item.suggested_fabric) fam.suggested_fabric = item.suggested_fabric;
      if (!fam.suggested_color && item.suggested_color) fam.suggested_color = item.suggested_color;
      continue;
    }

    const normFabric = (item.fabric || '').trim().toUpperCase();
    const normColor = (item.color || '').trim().toUpperCase();
    const normTipo = (item.tipo_tecido || 'RAMADO').trim().toUpperCase();
    const normLargura = (item.largura_util || '1,60 m').trim().toUpperCase();
    const normLote = item.lote ? '__' + item.lote.trim().toUpperCase() : '';
    const normOrientacao = item.orientacao ? '__' + item.orientacao.trim().toUpperCase() : '';

    const groupKey = normFabric + '__' + normColor + '__' + normTipo + '__' + normLargura + normLote + normOrientacao;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        group_key: groupKey,
        fabric: item.fabric,
        color: item.color,
        tipo_tecido: (normTipo === 'TUBULAR' ? 'TUBULAR' : 'RAMADO'),
        largura_util: item.largura_util || '1,60 m',
        lote: item.lote,
        orientacao: item.orientacao,
        is_valid_group: true,
        total_necessario: 0,
        pedidos_count: 0,
        prazo_mais_proximo: item.prazo_mais_proximo,
        models_breakdown: [],
        all_items: [],
        pedidos_waiting: []
      });
    }

    const grp = groupsMap.get(groupKey)!;
    grp.all_items.push(item);
    grp.total_necessario += item.total_necessario;
    if (item.prazo_mais_proximo && item.prazo_mais_proximo.localeCompare(grp.prazo_mais_proximo) < 0) {
      grp.prazo_mais_proximo = item.prazo_mais_proximo;
    }
  }

  const groupsList: CorteGroupDemand[] = Array.from(groupsMap.values());

  for (const grp of groupsList) {
    const modelMap = new Map<string, { total: number; sizes: { [size: string]: number }; items: CorteDemandItem[] }>();

    for (const item of grp.all_items) {
      const modelName = item.product_type || 'Modelo n�o informado';
      if (!modelMap.has(modelName)) {
        modelMap.set(modelName, { total: 0, sizes: {}, items: [] });
      }
      const mb = modelMap.get(modelName)!;
      mb.items.push(item);
      mb.total += item.total_necessario;
      mb.sizes[item.size] = (mb.sizes[item.size] || 0) + item.total_necessario;
    }

    grp.models_breakdown = Array.from(modelMap.entries()).map(([model, data]) => ({
      model,
      total: data.total,
      sizes: data.sizes,
      items: data.items
    }));
  }

  return { 
    groups: groupsList, 
    incompleteFamilies: Array.from(incompleteFamiliesMap.values()) 
  };
}

/**
 * Formats a cutting group's models breakdown into the clean Optitex CutPlan export format.
 * Produces both formatted plain text block and tab-separated values (TSV).
 */
export function formatDemandForCutPlan(modelsBreakdown: CorteModelBreakdown[]): {
  text: string;
  tsv: string;
} {
  if (!modelsBreakdown || modelsBreakdown.length === 0) {
    return { text: '', tsv: '' };
  }

  const textBlocks: string[] = [];
  const tsvLines: string[] = ['Modelo\tTamanho\tQuantidade'];

  for (const mb of modelsBreakdown) {
    const sizeEntries = Object.entries(mb.sizes || {})
      .filter(([, qty]) => qty > 0)
      .sort(([a], [b]) => {
        const sorted = sortSizes([a, b]);
        return sorted[0] === a ? -1 : 1;
      });

    if (sizeEntries.length === 0) continue;

    // Plain text block with aligned sizes and quantities
    const lines = [mb.model];
    for (const [size, qty] of sizeEntries) {
      lines.push(`${size.padEnd(5, ' ')}${qty}`);
      tsvLines.push(`${mb.model}\t${size}\t${qty}`);
    }
    textBlocks.push(lines.join('\n'));
  }

  return {
    text: textBlocks.join('\n\n'),
    tsv: tsvLines.join('\n')
  };
}

