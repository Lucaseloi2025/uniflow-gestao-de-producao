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

function extractItemDetails(item: any, defaultProductType: string = 'Vestuário'): { product_type: string; fabric: string; color: string; size: string; description: string; sku: string; item_key: string; is_complete: boolean } {
  if (!item || typeof item !== 'object') {
    return { product_type: 'Modelo não informado', fabric: 'Tecido não informado', color: 'Cor não informada', size: 'Tamanho não informado', description: 'Item sem descrição', sku: '', item_key: 'Modelo não informado | Tecido não informado | Cor não informada | Tamanho não informado', is_complete: false };
  }
  const rawDesc = (item.description || item.descricao || '').toString().trim();
  const rawSku = (item.sku || item.codigo || '').toString().trim();

  let fabric = item.fabric || item.tecido;
  if (!fabric) {
    if (/dry\s*comfort/i.test(rawDesc) || /dry-comfort/i.test(rawDesc)) fabric = 'Dry Comfort';
    else if (/dry\s*fit/i.test(rawDesc) || /dry-fit/i.test(rawDesc)) fabric = 'Dry Fit';
    else if (/poliamida/i.test(rawDesc)) fabric = 'Poliamida';
    else if (/algod[aã]o/i.test(rawDesc)) fabric = 'Algodão';
    else if (/piquet|pique/i.test(rawDesc)) fabric = 'Piquet';
    else if (/pv\b/i.test(rawDesc)) fabric = 'PV';
    else fabric = 'Tecido não informado';
  }

  let color = (item.color || item.cor || item.variacao?.cor || item.grade?.cor || '').toString().trim();
  if (color && color.toLowerCase() !== 'cor não informada') {
    const matchCat = COLOR_PATTERNS.find(c => c.pattern.test(color));
    if (matchCat) color = matchCat.name;
  } else {
    const targetText = `${rawDesc} ${rawSku}`;
    const recorteColorMatch = targetText.match(
      /(preto|branco|marrom|azul\s*marinho|azul|vermelho|verde|cinza|rosa|amarelo|roxo|laranja|vinho)\s*(?:com|\+|\/|c\/|e)\s*(?:recorte\s*)?(preto|branco|marrom|azul\s*marinho|azul|vermelho|verde|cinza|rosa|amarelo|roxo|laranja|vinho)/i
    );
    const explicitRecorteMatch = targetText.match(
      /recorte\s*[:\-–]?\s*(preto|branco|marrom|azul\s*marinho|azul|vermelho|verde|cinza|rosa|amarelo|roxo|laranja|vinho)/i
    );

    if (recorteColorMatch) {
      const mainC = recorteColorMatch[1].trim().toUpperCase();
      const recC = recorteColorMatch[2].trim().toUpperCase();
      color = `${mainC} (Corpo) / ${recC} (Recorte)`;
    } else if (explicitRecorteMatch) {
      const recC = explicitRecorteMatch[1].trim().toUpperCase();
      color = `Corpo / ${recC} (Recorte)`;
    } else {
      for (const { name, pattern } of COLOR_PATTERNS) {
        if (pattern.test(targetText)) {
          color = name;
          break;
        }
      }
    }
    if (!color) color = 'Cor não informada';
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

  const description = rawDesc || `${productType} ${fabric} ${color}`;
  const item_key = `${productType} | ${fabric} | ${color} | ${size}`;
  const is_complete = productType !== 'Modelo não informado' && fabric !== 'Tecido não informado' && color !== 'Cor não informada' && size !== 'Tamanho não informado';
  return { product_type: productType, fabric, color, size, description, sku: rawSku, item_key, is_complete };
}


function getOrderCuttingNeeded(order: any): number {
  if (!order || order.deleted_at || order.status === 'Cancelado' || order.status === 'Entregue') return 0;
  try {
    if (order.total_via_corte !== undefined && order.total_via_corte !== null && Number(order.total_via_corte) > 0) return Number(order.total_via_corte);
    const stagesList = Array.isArray(order.stages_status) ? order.stages_status : (typeof order.stages_status === 'string' ? JSON.parse(order.stages_status || '[]') : []);
    const corteStage = stagesList.find((s: any) => Number(s.id) === 2 || s.name?.toLowerCase() === 'corte');
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
          const { product_type, color, size, description, item_key } = extractItemDetails(item, order.product_type);
          if (item_key.toLowerCase().includes('dry fit única | único') || item_key.toLowerCase().includes('item | único')) continue;
          const orderDemand = { order_id: order.id, order_number: order.order_number || `PED-${order.id}`, client_name: order.client_name || 'Cliente', deadline: order.deadline || new Date().toISOString(), item_quantity: Number(item.quantity ?? item.quantidade ?? 1), qty_corte_needed: qtyCorteNeeded, qty_corte_allocated: qtyAllocated, qty_corte_pending: qtyPending };
          if (!demandMap.has(item_key)) { demandMap.set(item_key, { item_key, product_type, color, size, description, sku: item.sku || item.codigo, total_necessario: 0, pedidos_count: 0, prazo_mais_proximo: order.deadline || new Date().toISOString(), pedidos_waiting: [] }); }
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
    const corteStage = stagesList.find((s: any) => Number(s.id) === 2);
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

interface OrderStageProgress {
  id?: number; order_id: number; stage_id: number;
  quantidade_pedido: number; quantidade_boa: number;
  quantidade_perdida: number; pendencia_reposicao: number; finished: boolean;
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

function _getDefaultLossReasons(stages: { id: number; name: string; sort_order?: number }[]): LossReasonSetting[] {
  const find = (name: string, fb: number) => stages.find(s => s.name.toLowerCase().trim() === name.toLowerCase().trim())?.id ?? fb;
  const sorted = [...stages].sort((a, b) => (a.sort_order||0)-(b.sort_order||0));
  const first = sorted[0]?.id ?? 1;
  const corte = find('Corte', first); const estoque = find('Separação estoque', corte);
  const dtf = find('DTF', corte); const costura = find('Costura', corte);
  return [
    { motivo: 'Falta de matéria-prima/peça (estoque)', etapa_reentrada_id: estoque },
    { motivo: 'Defeito de corte', etapa_reentrada_id: corte },
    { motivo: 'Falha na estampa/DTF', etapa_reentrada_id: dtf },
    { motivo: 'Defeito de costura', etapa_reentrada_id: costura },
    { motivo: 'Extravio', etapa_reentrada_id: first },
    { motivo: 'Reprovado na conferência (qualidade)', etapa_reentrada_id: corte },
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

const _lossStageProgressStore = new Map<string, OrderStageProgress>();
let _lossLogsStore: OrderLossLog[] = [];
let _progressLogsStore: any[] = [];
let _corteAllocationsStore: any[] = [];
let _lossReasonSettingsStore: LossReasonSetting[] = [];
let _lossStoreInitialized = false;

async function _initLossStore(sb: any) {
  if (_lossStoreInitialized) return;
  _lossStoreInitialized = true;
  try { const { data } = await sb.from('loss_reason_settings').select('*'); if (data?.length) _lossReasonSettingsStore = data; } catch(e) {}
  if (_lossReasonSettingsStore.length === 0) {
    try { const { data } = await sb.from('stages').select('id, name, sort_order'); if (data) _lossReasonSettingsStore = _getDefaultLossReasons(data); }
    catch(e) { _lossReasonSettingsStore = _getDefaultLossReasons([{id:1,name:'Ficha de aprovação',sort_order:1},{id:2,name:'Corte',sort_order:2},{id:12,name:'Separação estoque',sort_order:4},{id:5,name:'DTF',sort_order:7},{id:7,name:'Costura',sort_order:12},{id:8,name:'Conferência',sort_order:13}]); }
  }
  try { const { data } = await sb.from('order_loss_logs').select('*'); if (data) _lossLogsStore = data; } catch(e) {}
  try { const { data } = await sb.from('order_progress_logs').select('*'); if (data) _progressLogsStore = data; } catch(e) {}
  try { const { data } = await sb.from('corte_allocations').select('*'); if (data) _corteAllocationsStore = data; } catch(e) {}
  try { const { data } = await sb.from('order_stage_progress').select('*'); if (data) data.forEach((p: any) => _lossStageProgressStore.set(`${p.order_id}_${p.stage_id}`, p)); } catch(e) {}
}
async function getLossReasons(sb: any) { await _initLossStore(sb); return _lossReasonSettingsStore; }
async function updateLossReasons(sb: any, settings: LossReasonSetting[]) { await _initLossStore(sb); _lossReasonSettingsStore = settings; try { await sb.from('loss_reason_settings').upsert(settings); } catch(e) {} return _lossReasonSettingsStore; }
async function getStageProgressForOrder(sb: any, orderId: number, orderData?: any) {
  await _initLossStore(sb);
  let order = orderData || (await sb.from('orders').select('*').eq('id', orderId).single()).data;
  if (!order) return [];
  const requiredStages: number[] = Array.isArray(order.required_stages) ? order.required_stages : [];
  const stagesStatus: any[] = Array.isArray(order.stages_status) ? order.stages_status : [];

  // Buscar progresso atualizado direto do banco para evitar cache local dessincronizado
  try {
    const { data: dbProg } = await sb.from('order_stage_progress').select('*').eq('order_id', orderId);
    if (dbProg) {
      dbProg.forEach((p: any) => {
        _lossStageProgressStore.set(`${p.order_id}_${p.stage_id}`, p);
      });
    }
  } catch (err) {
    console.warn('[API] Falha ao buscar progresso atualizado no getStageProgressForOrder:', err);
  }

  return requiredStages.map(stageId => {
    const key = `${orderId}_${stageId}`;
    let prog = _lossStageProgressStore.get(key);
    const isSplitStage = (Number(stageId) === 2 && order.total_via_corte !== undefined) || (Number(stageId) === 12 && order.total_via_separacao !== undefined);
    if (!prog) {
      const st = stagesStatus.find((s: any) => Number(s.id) === Number(stageId));
      let defaultQty = order.quantity || 0;
      if (Number(stageId) === 2 && order.total_via_corte !== undefined) defaultQty = order.total_via_corte;
      if (Number(stageId) === 12 && order.total_via_separacao !== undefined) defaultQty = order.total_via_separacao;
      prog = { order_id: orderId, stage_id: stageId, quantidade_pedido: defaultQty, quantidade_boa: st?.finished ? defaultQty : 0, quantidade_perdida: 0, pendencia_reposicao: 0, finished: !!st?.finished };
      _lossStageProgressStore.set(key, prog);
    } else if (!isSplitStage && order.quantity && prog.quantidade_pedido !== order.quantity) {
      prog.quantidade_pedido = order.quantity;
    }
    return prog;
  });
}
function enrichOrdersWithProgressSync(orders: any[]) {
  if (!orders?.length) return;
  for (const order of orders) {
    if (!Array.isArray(order.stages_status)) order.stages_status = [];
    const qty = order.quantity || 0;
    order.stages_status = order.stages_status.map((st: any) => {
      const key = `${order.id}_${Number(st.id)}`;
      let prog = _lossStageProgressStore.get(key);
      const isSplitStage = (Number(st.id) === 2 && order.total_via_corte !== undefined) || (Number(st.id) === 12 && order.total_via_separacao !== undefined);
      if (!prog) {
        let defaultQty = qty;
        if (Number(st.id) === 2 && order.total_via_corte !== undefined) defaultQty = order.total_via_corte;
        if (Number(st.id) === 12 && order.total_via_separacao !== undefined) defaultQty = order.total_via_separacao;
        prog = { order_id: order.id, stage_id: Number(st.id), quantidade_pedido: defaultQty, quantidade_boa: st.finished ? defaultQty : 0, quantidade_perdida: 0, pendencia_reposicao: 0, finished: !!st.finished };
        _lossStageProgressStore.set(key, prog);
      } else if (!isSplitStage && qty && prog.quantidade_pedido !== qty) {
        prog.quantidade_pedido = qty;
      }
      return { ...st, finished: prog.finished, quantidade_boa: prog.quantidade_boa, quantidade_perdida: prog.quantidade_perdida, pendencia_reposicao: prog.pendencia_reposicao, quantidade_pedido: prog.quantidade_pedido || qty };
    });
  }
}
async function logProgress(sb: any, orderId: number, stageId: number, userId: number, userName: string, incremento: number) {
  await _initLossStore(sb);
  
  // Buscar progresso atualizado direto do banco para evitar cache local dessincronizado
  try {
    const { data: dbProg } = await sb.from('order_stage_progress').select('*').eq('order_id', orderId).eq('stage_id', stageId).maybeSingle();
    if (dbProg) {
      _lossStageProgressStore.set(`${orderId}_${stageId}`, dbProg);
    }
  } catch (err) {
    console.warn('[API] Falha ao sincronizar progresso no logProgress:', err);
  }

  const key = `${orderId}_${stageId}`;
  let prog = _lossStageProgressStore.get(key) || { order_id: orderId, stage_id: stageId, quantidade_pedido: (await sb.from('orders').select('quantity').eq('id', orderId).single()).data?.quantity || 0, quantidade_boa: 0, quantidade_perdida: 0, pendencia_reposicao: 0, finished: false };
  prog.quantidade_boa = Math.max(0, prog.quantidade_boa + incremento);
  if (prog.pendencia_reposicao > 0) prog.pendencia_reposicao = Math.max(0, prog.pendencia_reposicao - incremento);
  const calcType = (await sb.from('stages').select('calculation_type').eq('id', stageId).single()).data?.calculation_type || 'por_peca';
  if (calcType === 'por_peca') prog.finished = prog.quantidade_boa >= prog.quantidade_pedido;
  _lossStageProgressStore.set(key, prog);
  try { await sb.from('order_stage_progress').upsert(prog); } catch(e) {}
  const logEntry = { order_id: orderId, stage_id: stageId, user_id: userId, user_name: userName, quantidade_boa_incremento: incremento, created_at: new Date().toISOString() };
  _progressLogsStore.push(logEntry);
  try { await sb.from('order_progress_logs').insert(logEntry); } catch(e) {}
  return { success: true, progress: prog, log: logEntry };
}
async function logLoss(sb: any, orderId: number, stageId: number, userId: number, userName: string, qtd: number, motivo: string, det?: string, retId?: number) {
  await _initLossStore(sb);
  
  // Buscar progresso atualizado direto do banco para evitar cache local dessincronizado
  try {
    const { data: dbProg } = await sb.from('order_stage_progress').select('*').eq('order_id', orderId).eq('stage_id', stageId).maybeSingle();
    if (dbProg) {
      _lossStageProgressStore.set(`${orderId}_${stageId}`, dbProg);
    }
  } catch (err) {
    console.warn('[API] Falha ao sincronizar progresso no logLoss:', err);
  }

  const key = `${orderId}_${stageId}`;
  let prog = _lossStageProgressStore.get(key) || { order_id: orderId, stage_id: stageId, quantidade_pedido: (await sb.from('orders').select('quantity').eq('id', orderId).single()).data?.quantity || 0, quantidade_boa: 0, quantidade_perdida: 0, pendencia_reposicao: 0, finished: false };
  prog.quantidade_perdida += qtd; if (prog.quantidade_boa < prog.quantidade_pedido) prog.finished = false;
  _lossStageProgressStore.set(key, prog); try { await sb.from('order_stage_progress').upsert(prog); } catch(e) {}
  const rs = retId || _lossReasonSettingsStore.find(r => r.motivo.toLowerCase() === motivo.toLowerCase())?.etapa_reentrada_id || stageId;
  const sn = (await sb.from('stages').select('name').eq('id', stageId).single()).data?.name || `Etapa #${stageId}`;
  const rn = (await sb.from('stages').select('name').eq('id', rs).single()).data?.name || `Etapa #${rs}`;
  const lossLog: OrderLossLog = { id: _lossLogsStore.length+1, order_id: orderId, stage_id: stageId, stage_name: sn, user_id: userId, user_name: userName, quantidade_perdida: qtd, motivo, motivo_detalhe: det||'', etapa_reentrada_id: rs, etapa_reentrada_name: rn, created_at: new Date().toISOString() };
  _lossLogsStore.push(lossLog); try { await sb.from('order_loss_logs').insert(lossLog); } catch(e) {}
  
  // Buscar progresso da reentrada para evitar dessincronizar
  try {
    const { data: dbProgReentry } = await sb.from('order_stage_progress').select('*').eq('order_id', orderId).eq('stage_id', rs).maybeSingle();
    if (dbProgReentry) {
      _lossStageProgressStore.set(`${orderId}_${rs}`, dbProgReentry);
    }
  } catch (err) {
    console.warn('[API] Falha ao sincronizar progresso de reentrada no logLoss:', err);
  }

  const rk = `${orderId}_${rs}`; let rp = _lossStageProgressStore.get(rk) || { order_id: orderId, stage_id: rs, quantidade_pedido: prog.quantidade_pedido, quantidade_boa: 0, quantidade_perdida: 0, pendencia_reposicao: 0, finished: false };
  rp.pendencia_reposicao += qtd; rp.finished = false; _lossStageProgressStore.set(rk, rp); try { await sb.from('order_stage_progress').upsert(rp); } catch(e) {}
  return { success: true, progress: prog, lossLog, reentradaStageId: rs };
}
async function validateStageFinish(sb: any, orderId: number, stageId: number) {
  await _initLossStore(sb);
  const si = (await sb.from('stages').select('name, calculation_type').eq('id', stageId).single()).data;
  if (si?.calculation_type === 'por_pedido') return { canFinish: true };
  const prog = (await getStageProgressForOrder(sb, orderId)).find((p: any) => p.stage_id === stageId);
  if (!prog || prog.quantidade_boa >= prog.quantidade_pedido) return { canFinish: true };
  const remaining = prog.quantidade_pedido - prog.quantidade_boa;
  return { canFinish: false, remaining, message: `Não é possível finalizar a etapa '${si?.name||stageId}': faltam ${remaining} peças boas para atingir o total de ${prog.quantidade_pedido} peças do pedido.` };
}
async function getLossReportDataStore(sb: any, startDate?: string, endDate?: string) {
  await _initLossStore(sb);
  let logs = [..._lossLogsStore];
  if (startDate) { const ms = new Date(startDate).getTime(); logs = logs.filter(l => new Date(l.created_at).getTime() >= ms); }
  if (endDate) { const ms = new Date(endDate).getTime(); logs = logs.filter(l => new Date(l.created_at).getTime() <= ms); }
  let orders: any[] = []; try { const { data } = await sb.from('orders').select('id, order_number, client_name, total_time_seconds, status, quantity'); if (data) orders = data; } catch(e) {}
  let stages: any[] = []; try { const { data } = await sb.from('stages').select('id, name'); if (data) stages = data; } catch(e) {}
  return _calculateLossReport(logs, orders, stages);
}
async function getProgressLogs(sb: any) { await _initLossStore(sb); return _progressLogsStore; }

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

// Enable CORS for all requests
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-role, x-user-name');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
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

const rawSupabaseUrl = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const supabaseUrl = (rawSupabaseUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "")) || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey
);

const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceRoleKey || supabaseAnonKey
);

// Utilizando memória ao invés de disco local
const storage = multer.memoryStorage();
const upload = multer({ storage });

function checkError(error: any, res: express.Response, msg = "Erro interno") {
    if (error) {
        console.error(`[INTERNAL ERROR] ${msg}:`, error);
        // Avoid exposing raw database errors to the client
        res.status(500).json({ error: msg });
        return true;
    }
    return false;
}

const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = req.headers['x-user-role'];
    if (role !== 'Admin') {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores podem realizar esta ação." });
    }
    next();
};

const isAdminOrComercial = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = req.headers['x-user-role'];
    if (role !== 'Admin' && role !== 'Comercial') {
        return res.status(403).json({ error: "Acesso negado. Ação permitida apenas para Administração ou Comercial." });
    }
    next();
};

const isAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = req.headers['x-user-role'];
    if (role !== 'Admin' && role !== 'Comercial' && role !== 'Produção') {
        return res.status(403).json({ error: "Acesso negado. Login necessário." });
    }
    next();
};

// ── Supabase status (health check) ────────────────────────────────────────
app.get("/api/supabase/status", async (_req, res) => {
    const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .limit(1);
    if (error)
        return res.status(500).json({
            status: "error",
            message: error.message,
            hint: "Verifique se a tabela 'users' existe no Supabase.",
        });
    return res.json({ status: "success", message: "Supabase SDK funcionando!", sample_data: data });
});

// ── Production Utils (Centralized Finished Pieces Calculation) ────────────
interface StageInfo { id: number; name: string; sort_order: number; calculation_type: string; }

function _getLastPorPecaStageId(orderRequiredStages: number[], allStages: StageInfo[]): number | null {
    if (!orderRequiredStages || orderRequiredStages.length === 0) return null;
    const stageMap = new Map<number, StageInfo>();
    allStages.forEach(s => stageMap.set(s.id, s));

    const reqStages = orderRequiredStages
        .map(id => stageMap.get(id))
        .filter((s): s is StageInfo => !!s);

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

    const isBetween = (iso: string) => {
        if (startDateIso && iso < startDateIso) return false;
        if (endDateIso && iso > endDateIso) return false;
        return true;
    };

    // 1. Check completed stage_executions on the LAST stage
    for (const ex of executions) {
        if (ex.status !== 'Finalizado' || !ex.end_time) continue;
        if (!isBetween(ex.end_time)) continue;

        const ord = activeOrdersMap.get(ex.order_id);
        if (!ord) continue;

        const lastStageId = _getLastPorPecaStageId(ord.required_stages || [], allStages);
        if (ex.stage_id === lastStageId) {
            orderFinishedPieces.set(ord.id, Math.max(orderFinishedPieces.get(ord.id) || 0, ord.quantity || 0));
        }
    }

    // 2. Check piece increment logs on the LAST stage
    for (const log of progressLogs) {
        if (!log.created_at || !isBetween(log.created_at)) continue;
        const ord = activeOrdersMap.get(log.order_id);
        if (!ord) continue;

        const lastStageId = _getLastPorPecaStageId(ord.required_stages || [], allStages);
        if (log.stage_id === lastStageId) {
            const current = orderFinishedPieces.get(ord.id) || 0;
            const inc = log.quantidade_boa_incremento || 0;
            orderFinishedPieces.set(ord.id, Math.min(ord.quantity || 0, current + inc));
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
    const { data, error } = await supabase.rpc("get_dashboard_stats_v2", {
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
    const isAdminUser = req.headers["x-user-role"] === "Admin";
    const { data, error } = await supabase.from("config_producao").select("*").single();
    if (checkError(error, res)) return;
    if (!isAdminUser && data) {
        delete data.meta_custo_por_peca;
    }
    return res.json(data);
});

app.patch("/api/config", isAdmin, async (req, res) => {
    const { jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes, meta_diaria_pedidos, meta_diaria_pecas, meta_custo_por_peca, auto_pause_time_weekday, auto_pause_time_friday, auto_pause_time_lunch } = req.body;
    const updates: any = {};
    if (jornada_horas !== undefined) updates.jornada_horas = jornada_horas;
    if (operadores_ativos !== undefined) updates.operadores_ativos = operadores_ativos;
    if (eficiencia_percentual !== undefined) updates.eficiencia_percentual = eficiencia_percentual;
    if (dias_uteis_mes !== undefined) updates.dias_uteis_mes = dias_uteis_mes;
    if (meta_diaria_pedidos !== undefined) updates.meta_diaria_pedidos = meta_diaria_pedidos;
    if (meta_diaria_pecas !== undefined) updates.meta_diaria_pecas = meta_diaria_pecas;
    if (meta_custo_por_peca !== undefined) updates.meta_custo_por_peca = meta_custo_por_peca;
    if (auto_pause_time_weekday !== undefined) updates.auto_pause_time_weekday = auto_pause_time_weekday;
    if (auto_pause_time_friday !== undefined) updates.auto_pause_time_friday = auto_pause_time_friday;
    if (auto_pause_time_lunch !== undefined) updates.auto_pause_time_lunch = auto_pause_time_lunch;
    const { data, error } = await supabase
        .from("config_producao")
        .update(updates)
        .eq("id", 1)
        .select()
        .single();
    if (checkError(error, res)) return;
    return res.json(data);
});

// ── Reports ───────────────────────────────────────────────────────────────
app.get("/api/reports", async (req, res) => {
    const isAdminUser = req.headers["x-user-role"] === "Admin";
    const { period, user_id, stage_id, startDate, endDate, print_type } = req.query;
    const { data, error } = await supabase.rpc("get_reports", {
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

        if (!isAdminUser) {
            if (data.summary) {
                data.summary.total_labor_cost = 0;
            }
            if (Array.isArray(data.costsByCollaborator)) {
                data.costsByCollaborator = data.costsByCollaborator.map((item: any) => ({
                    ...item,
                    hourly_cost: 0,
                    total_cost: 0,
                    cost_per_piece: 0,
                    totalCost: 0,
                    costPerPiece: 0
                }));
            }
            if (data.costsByOrder) {
                data.costsByOrder = [];
            }
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

async function _fetchOlistOrders(token: string, daysLimit: number = 1): Promise<any[]> {
    if (!token) return [];

    const allOrders: any[] = [];
    const seenIds = new Set<string>();

    let dataInicial: string | undefined = undefined;
    if (daysLimit > 0) {
        const cutoffDate = new Date();
        cutoffDate.setHours(0, 0, 0, 0);
        if (daysLimit > 1) {
            cutoffDate.setDate(cutoffDate.getDate() - (daysLimit - 1));
        }
        dataInicial = _formatDateDDMMYYYY(cutoffDate);
    }

    // Query open and approved statuses
    const statusQueries = ['em_aberto', 'aprovado'];

    for (const stParam of statusQueries) {
        for (let page = 1; page <= 2; page++) {
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

async function _syncOlistOrders(daysLimit: number = 1, tokenOverride?: string) {
    const token = (tokenOverride || process.env.OLIST_API_TOKEN || "").trim();
    if (!token) {
        throw new Error("Token de acesso do Olist ERP não configurado ou expirado.");
    }

    const rawOrders = await _fetchOlistOrders(token, daysLimit);
    console.log(`[OlistSync] Encontrados ${rawOrders.length} pedidos na API do Olist/Tiny.`);

    const approved = rawOrders.filter(o => _isApprovedOlistStatus(o.situacao));
    console.log(`[OlistSync] Pedidos aprovados/pagos elegíveis (total histórico): ${approved.length}`);

    // Filter to only import orders from today onwards (daysLimit=1 includes today & yesterday for safety)
    const cutoffDate = new Date();
    cutoffDate.setHours(0, 0, 0, 0);
    if (daysLimit > 0) {
        cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
    }

    const eligibleOrders = approved.filter(o => {
        const orderDate = _parseOrderDate(o.data_pedido);
        if (!orderDate) return false; // Exclude orders with invalid/missing date when filtering
        orderDate.setHours(0, 0, 0, 0);
        return orderDate >= cutoffDate;
    });

    console.log(`[OlistSync] Pedidos aprovados dos últimos ${daysLimit} dias (de hoje em diante): ${eligibleOrders.length}`);

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

    console.log(`[OlistSync] Pedidos novos a importar nesta rodada: ${unimportedEligible.length} (limitando a 5 por lote)`);
    const targetOrders = unimportedEligible.slice(0, 5);

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

            let totalViaSeparacao = 0;
            let totalViaCorte = 0;
            let stockCheckFailed = false;
            const corteDetails: Array<{
                description: string;
                size: string;
                sku: string;
                qty_pedida: number;
                qty_separacao: number;
                qty_corte: number;
                stock_available: number | null;
            }> = [];

            if (detail.itens && detail.itens.length > 0) {
                for (const item of detail.itens) {
                    const itemQty = item.quantity || item.quantidade || 1;
                    const stockAvail = await _fetchOlistStockForItem(token, item.id_produto, item.sku || item.codigo);

                    let itemSeparacao = itemQty;
                    let itemCorte = 0;

                    if (stockAvail !== null) {
                        itemSeparacao = Math.min(itemQty, stockAvail);
                        itemCorte = Math.max(0, itemQty - itemSeparacao);
                    } else {
                        stockCheckFailed = true;
                    }

                    item.qty_separacao = itemSeparacao;
                    item.qty_corte = itemCorte;
                    item.stock_available = stockAvail;

                    totalViaSeparacao += itemSeparacao;
                    totalViaCorte += itemCorte;

                    if (itemCorte > 0) {
                        corteDetails.push({
                            description: item.description || item.descricao || 'Produto',
                            size: item.size || item.tamanho || 'Tamanho não informado',
                            sku: item.sku || item.codigo || '-',
                            qty_pedida: itemQty,
                            qty_separacao: itemSeparacao,
                            qty_corte: itemCorte,
                            stock_available: stockAvail
                        });
                    }
                }
            } else {
                totalViaSeparacao = quantity;
            }

            // Route stages:
            // Stage 1: Ficha, Stage 12: Separação estoque, Stage 2: Corte, Stage 7: Costura, Stage 8: Conferência
            let defaultRequiredStages = [1, 12, 7, 8];
            if (totalViaCorte > 0) {
                defaultRequiredStages = [1, 12, 2, 7, 8];
            }

            let obsText = `Importado do Olist ERP (ID: ${detail.id}, Nº: ${detail.numero}) - Aguardando revisão de estampa`;
            if (totalViaCorte > 0) {
                obsText += ` | ⚠️ ${totalViaCorte} pçs sem estoque (precisam de Corte)`;
            }
            if (stockCheckFailed) {
                obsText += ` | ⚠️ Consulta de estoque no Olist falhou (alocado 100% via Separação Estoque para revisão manual)`;
            }

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
            } catch (_) {}

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

                try {
                    const progEntries: any[] = [];
                    if (totalViaSeparacao > 0 || totalViaCorte > 0) {
                        progEntries.push({
                            order_id: createdOrder.id,
                            stage_id: 12, // Separação estoque
                            quantidade_pedido: totalViaSeparacao,
                            quantidade_boa: 0,
                            quantidade_perdida: 0,
                            pendencia_reposicao: 0,
                            finished: totalViaSeparacao === 0
                        });
                    }
                    if (totalViaCorte > 0) {
                        progEntries.push({
                            order_id: createdOrder.id,
                            stage_id: 2, // Corte
                            quantidade_pedido: totalViaCorte,
                            quantidade_boa: 0,
                            quantidade_perdida: 0,
                            pendencia_reposicao: 0,
                            finished: false
                        });
                    }

                    if (progEntries.length > 0) {
                        await supabaseAdmin.from("order_stage_progress").upsert(progEntries);
                    }
                } catch (spErr) {
                    console.warn(`[OlistSync] Aviso ao salvar order_stage_progress inicial:`, spErr);
                }

                try {
                    await supabaseAdmin.from("order_history").insert({
                        order_id: createdOrder.id,
                        usuario: "Olist Integrator (Auto)",
                        acao: "importou_olist",
                        antes: null,
                        depois: { olist_id: detail.id, status: "Rascunho", items: detail.itens }
                    });
                } catch (_) {}
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

const OLIST_CLIENT_ID = process.env.OLIST_CLIENT_ID || "tiny-api-b69bd9b2e5c8fb27d88f3d7507bb6d82e9313f1f-1788717202";
const OLIST_CLIENT_SECRET = process.env.OLIST_CLIENT_SECRET || "L0wKCJ97Rw01n9TfhF7MmURozIEveyS9";
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
app.get("/api/integrations/olist/debug", async (_req, res) => {
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

app.post("/api/integrations/olist/sync", async (req, res) => {
    try {
        const tokenOverride = await _getEffectiveOlistToken();
        const days = req.body?.days !== undefined ? Number(req.body.days) : 1; // Default to 1 (de hoje em diante)
        const result = await _syncOlistOrders(days, tokenOverride);
        return res.json({ success: true, ...result });
    } catch (err: any) {
        console.error("[OlistSync API Error]:", err);
        return res.json({ success: false, error: err.message || "Erro na sincronização com Olist ERP" });
    }
});

app.post("/api/integrations/olist/reprocess-normalization", async (_req, res) => {
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

                try {
                    await supabaseAdmin.from("order_history").insert({
                        order_id: order.id,
                        acao: "reprocessou_normalizacao",
                        detalhes: "Reprocessamento automático da normalização de modelos, tecidos, cores e tamanhos",
                        usuario: "Sistema (Reprocessamento Olist)",
                        antes: { items: itemsRaw },
                        depois: { items: updatedItems }
                    });
                } catch (hErr) {
                    console.warn(`[ReprocessHistory] Warning: ${hErr}`);
                }
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

app.post("/api/webhooks/olist", async (req, res) => {
    try {
        console.log("[Olist Webhook] Recebido webhook do Olist/Tiny ERP:", req.body);
        const result = await _syncOlistOrders();
        return res.json({ success: true, ...result });
    } catch (err: any) {
        console.error("[Olist Webhook Error]:", err);
        return res.status(500).json({ error: err.message });
    }
});

app.get("/api/orders/drafts", async (_req, res) => {
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

app.delete("/api/orders/drafts/:id", async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const usuario = (req.headers["x-user-name"] as string) || "Usuário";
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

app.post("/api/orders/drafts/cleanup", async (req, res) => {
    try {
        const usuario = (req.headers["x-user-name"] as string) || "Usuário";
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

app.post("/api/orders/:id/confirm-draft", async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const usuario = (req.headers["x-user-name"] as string) || "Vendedora";
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

        const stagesArray = required_stages || currentOrder.required_stages || [1, 2, 7, 8];

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

        try {
            await supabaseAdmin.from("order_history").insert({
                order_id: orderId,
                usuario,
                acao: "confirmou_rascunho",
                antes: currentOrder,
                depois: updatedOrder
            });
        } catch (_) {}

        return res.json({ success: true, order: updatedOrder });
    } catch (err: any) {
        console.error("[ConfirmDraft Error]:", err);
        return res.status(500).json({ error: err.message });
    }
});

// ── Order Templates ───────────────────────────────────────────────────────
app.get("/api/order-templates", async (_req, res) => {
    const { data, error } = await supabase
        .from("order_templates")
        .select("*");
    if (checkError(error, res)) return;
    return res.json(data);
});

app.post("/api/order-templates", isAdmin, async (req, res) => {
    const { name, product_type, print_type, quantity, observations, required_stages } = req.body;
    const { data, error } = await supabase
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
    const { error } = await supabase
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
    const { error } = await supabase
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
        const { data: rawOrders, error: ordersErr } = await supabase
            .from("orders")
            .select("id, order_number, client_name, quantity, deadline, status, required_stages, print_type, product_type, created_at")
            .is("deleted_at", null)
            .not("status", "in", '("Entregue","Cancelado")')
            .order("deadline", { ascending: true });

        if (ordersErr) throw ordersErr;
        if (!rawOrders || rawOrders.length === 0) return res.json([]);

        // 2. All stages sorted
        const { data: allStages, error: stagesErr } = await supabase
            .from("stages")
            .select("id, name, sort_order, ideal_time, real_average_time, execution_count, calculation_type")
            .eq("active", 1)
            .order("sort_order", { ascending: true });

        if (stagesErr) throw stagesErr;

        // 3. Capacity config
        const { data: configRows } = await supabase
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
    const { search, stage_id, stage_status, product_type, print_type } = req.query;
    let data: any[] | null = null;
    let error: any = null;

    try {
        const rpcRes = await supabase.rpc("get_orders_with_stages", {
            p_search: search || null,
            p_stage_id: stage_id ? Number(stage_id) : null,
            p_stage_status: stage_status || null,
            p_product_type: product_type || null,
            p_print_type: print_type || null,
        });
        data = rpcRes.data;
        error = rpcRes.error;
    } catch (e) {
        error = e;
    }

    // Direct table SELECT fallback if RPC returns null or empty array when no filters were applied
    if ((!data || data.length === 0) && !search && !stage_id && !product_type && !print_type) {
        try {
            const { data: fallbackData } = await supabaseAdmin
                .from("orders")
                .select("*")
                .is("deleted_at", null)
                .order("deadline", { ascending: true });
            if (fallbackData) {
                data = fallbackData;
                error = null;
            }
        } catch (_) {}
    }

    if (checkError(error, res, "Erro ao buscar pedidos")) return;

    if (data && data.length > 0) {
        const orderIds = data.map((o: any) => o.id);
        const { data: executions } = await supabaseAdmin
            .from("stage_executions")
            .select("order_id, status, stage_id, end_time, users(name)")
            .in("order_id", orderIds);

        const operatorMap = new Map();
        const activeStageExecutionMap = new Map();
        const latestFinishedStageMap = new Map();
        if (executions) {
            executions.forEach((ex: any) => {
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
                .in("id", orderIds);

            if (dbItems) {
                const itemsMap = new Map();
                dbItems.forEach((row: any) => {
                    if (row.items) itemsMap.set(row.id, row.items);
                });
                data.forEach((order: any) => {
                    order.items = itemsMap.get(order.id) || [];
                });
            }
        } catch (err) {
            console.warn("[API] Failed to fetch items for active orders list:", err);
        }

        const { data: dbProgress } = await supabaseAdmin
            .from("order_stage_progress")
            .select("*")
            .in("order_id", orderIds);

        if (dbProgress) {
            dbProgress.forEach((p: any) => {
                _lossStageProgressStore.set(`${p.order_id}_${p.stage_id}`, p);
            });
        }

        enrichOrdersWithProgressSync(data);

        // Fetch stage_observations for these orders to find the most recent observation of the active stage
        let observationsMap = new Map();
        try {
            const { data: obsData } = await supabaseAdmin
                .from("stage_observations")
                .select("order_id, stage_id, observation, created_at")
                .in("order_id", orderIds)
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
            order.current_operator = operatorMap.get(order.id) || null;
            order.active_stage_execution = activeStageExecutionMap.get(order.id) || null;
            
            // Enrich with active stage name and active stage observation
            const activeStage = (order.stages_status || []).find((s: any) => !s.finished);
            order.active_stage_name = activeStage?.name || null;
            order.active_stage_observation = null;
            
            const unfinishedStages = (order.stages_status || []).filter((s: any) => !s.finished);
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
    }

    return res.json(data);
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

app.post("/api/orders", upload.array("art_files", 10), async (req, res) => {
    const { client_name, product_type, print_type, quantity, deadline, observations, required_stages, num_colors } = req.body;
    const order_number = `PED-${Date.now().toString().slice(-6)}`;
    const art_urls: string[] = [];

    const files = (req as any).files;
    const uploadErrors: string[] = [];
    console.log(`[API] Criando pedido. Arquivos recebidos: ${files?.length || 0}`);
    if (files && Array.isArray(files)) {
        for (const file of files) {
            const fileExt = file.originalname.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `pedidos/${fileName}`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from('artes')
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true
                });

            if (uploadError) {
                console.error(`[API] Erro no upload da arte (${file.originalname}):`, uploadError);
                uploadErrors.push(`${file.originalname}: ${uploadError.message}`);
                continue;
            }

            const { data: publicUrlData } = supabaseAdmin.storage.from('artes').getPublicUrl(filePath);
            art_urls.push(publicUrlData.publicUrl);
        }
    }

    if (uploadErrors.length > 0) {
        return res.status(400).json({ 
            error: "Falha no upload de alguns arquivos", 
            details: uploadErrors 
        });
    }

    // 2. Estimate time
    const { data: estimateData } = await supabase
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
    const { data, error } = await supabase
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
    const usuario = (req.headers["x-user-name"] as string) || "Admin";

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
    await supabaseAdmin.from("order_history").insert({
        order_id: Number(id),
        usuario,
        acao: "excluiu",
        antes: order,
        depois: null,
    });

    console.log(`[API] Pedido ${id} marcado como excluído (soft delete) por ${usuario}`);
    return res.json({ success: true });
});

app.post("/api/orders/:id/images", upload.array("art_files", 10), async (req, res) => {
    const { id } = req.params;
    const files = (req as any).files;

    if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    // 1. Get current order images
    const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("art_urls, art_url")
        .eq("id", Number(id))
        .single();

    if (fetchError || !order) {
        return res.status(404).json({ error: "Pedido não encontrado" });
    }

    const current_urls = order.art_urls || [];
    const new_urls: string[] = [];

    // 2. Upload new files
    const uploadErrors: string[] = [];
    for (const file of files) {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `pedidos/${fileName}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('artes')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (uploadError) {
            console.error(`[API] Erro no upload da arte (${file.originalname}):`, uploadError);
            uploadErrors.push(`${file.originalname}: ${uploadError.message}`);
            continue;
        }

        const { data: publicUrlData } = supabaseAdmin.storage.from('artes').getPublicUrl(filePath);
        new_urls.push(publicUrlData.publicUrl);
    }

    if (uploadErrors.length > 0) {
        return res.status(400).json({ 
            error: "Falha no upload de alguns arquivos", 
            details: uploadErrors 
        });
    }

    const updated_urls = [...current_urls, ...new_urls];

    // 3. Update order
    const { error: updateError } = await supabase
        .from("orders")
        .update({
            art_urls: updated_urls,
            art_url: order.art_url || updated_urls[0] // Set primary if missing
        })
        .eq("id", Number(id));

    if (checkError(updateError, res, "Erro ao atualizar imagens do pedido")) return;

    return res.json({ success: true, art_urls: updated_urls });
});

app.patch("/api/orders/:id/status", async (req, res) => {
    const { status } = req.body;
    const updates: any = { status };
    if (status === 'Entregue') {
        updates.delivered_at = new Date().toISOString();
    } else {
        updates.delivered_at = null;
    }
    const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// Update DTF checklist status and drawer location (accessible to anyone)
app.patch("/api/orders/:id/dtf", async (req, res) => {
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

    let updateErr: any = null;
    try {
        const { error } = await supabaseAdmin
            .from("orders")
            .update(updates)
            .eq("id", orderId);
        updateErr = error;
    } catch (e: any) {
        updateErr = e;
    }

    if (updateErr) {
        // If dtf_location column is missing in Supabase, fallback gracefully to observations
        if (updates.dtf_location !== undefined) {
            console.warn(`[DTF UPDATE FALLBACK] Column dtf_location missing in Supabase for order ${orderId}. Saving in observations as fallback.`);
            
            if (updates.dtf_complete !== undefined) {
                await supabaseAdmin.from("orders").update({ dtf_complete: updates.dtf_complete }).eq("id", orderId);
            }

            const existingObs = currentOrder.observations || "";
            let newObs = existingObs;
            if (existingObs.includes("[Gaveteiro:")) {
                newObs = existingObs.replace(/\[Gaveteiro:[^\]]*\]/, updates.dtf_location ? `[Gaveteiro: ${updates.dtf_location}]` : "").trim();
            } else if (updates.dtf_location) {
                newObs = existingObs ? `${existingObs} [Gaveteiro: ${updates.dtf_location}]` : `[Gaveteiro: ${updates.dtf_location}]`;
            }
            await supabaseAdmin.from("orders").update({ observations: newObs }).eq("id", orderId);

            const usuario = (req.headers["x-user-name"] as string) || "Operador";
            await supabaseAdmin.from("order_history").insert({
                order_id: orderId,
                usuario,
                acao: "editou",
                antes: { dtf_complete: currentOrder.dtf_complete, observations: existingObs },
                depois: { ...updates, observations: newObs },
            });

            return res.json({ success: true, fallback: true });
        }

        if (checkError(updateErr, res, "Erro ao atualizar status ou gaveteiro do DTF")) return;
    }

    // 3. Log to order_history
    const usuario = (req.headers["x-user-name"] as string) || "Operador";
    await supabaseAdmin.from("order_history").insert({
        order_id: orderId,
        usuario,
        acao: "editou",
        antes: { dtf_complete: currentOrder.dtf_complete, dtf_location: currentOrder.dtf_location },
        depois: updates,
    });

    return res.json({ success: true });
});

// Full order edit with validation and audit log
app.patch("/api/orders/:id", isAdminOrComercial, async (req, res) => {
    const orderId = Number(req.params.id);
    const usuario = (req.headers["x-user-name"] as string) || "Admin";
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
    await supabaseAdmin.from("order_history").insert({
        order_id: orderId,
        usuario,
        acao: "editou",
        antes: currentOrder,
        depois: { ...currentOrder, ...updates },
    });

    return res.json({ success: true });
});

// Cancel order — keeps history, removes from capacity calculations
app.patch("/api/orders/:id/cancel", isAdminOrComercial, async (req, res) => {
    const orderId = Number(req.params.id);
    const usuario = (req.headers["x-user-name"] as string) || "Admin";

    const { data: currentOrder, error: fetchErr } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

    if (fetchErr || !currentOrder) return res.status(404).json({ error: "Pedido não encontrado" });
    if (currentOrder.deleted_at) return res.status(400).json({ error: "Pedido excluído não pode ser cancelado" });
    if (currentOrder.status === "Cancelado") return res.status(400).json({ error: "Pedido já está cancelado" });

    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
        .from("orders")
        .update({ status: "Cancelado", cancelled_at: now, cancelled_by: usuario })
        .eq("id", orderId);

    if (checkError(updateErr, res, "Erro ao cancelar pedido")) return;

    await supabaseAdmin.from("order_history").insert({
        order_id: orderId,
        usuario,
        acao: "cancelou",
        antes: currentOrder,
        depois: { ...currentOrder, status: "Cancelado", cancelled_at: now, cancelled_by: usuario },
    });

    // Realocação automática de peças cortadas liberadas pelo cancelamento
    try {
        await _initLossStore(supabaseAdmin);
        const { data: activeOrders } = await supabaseAdmin
            .from("orders")
            .select("*")
            .is("deleted_at", null)
            .not("status", "in", '("Entregue","Cancelado")')
            .neq("id", orderId);

        if (activeOrders && activeOrders.length > 0) {
            const reallocatedLogs = reallocateOnCancellation(orderId, activeOrders, _corteAllocationsStore);
            if (reallocatedLogs.length > 0) {
                for (const log of reallocatedLogs) {
                    const receivingOrder = activeOrders.find(o => o.id === log.order_id);
                    if (receivingOrder) {
                        await supabaseAdmin
                            .from("orders")
                            .update({
                                items: receivingOrder.items,
                                stages_status: receivingOrder.stages_status
                            })
                            .eq("id", receivingOrder.id);
                    }
                }
                try {
                    await supabaseAdmin.from("corte_allocations").insert(reallocatedLogs);
                } catch (_) {}
            }
        }
    } catch (reallocErr) {
        console.warn("[API] Erro na realocação de corte pós-cancelamento:", reallocErr);
    }

    return res.json({ success: true });
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
        await _initLossStore(supabaseAdmin);
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
app.post("/api/cutting/register-consolidated", async (req, res) => {
    try {
        await _initLossStore(supabaseAdmin);
        const { item_key, quantidade_cortada, user_id, user_name } = req.body;

        if (!item_key) {
            return res.status(400).json({ error: "Item a cortar é obrigatório." });
        }
        const cutQty = Number(quantidade_cortada);
        if (!cutQty || cutQty <= 0) {
            return res.status(400).json({ error: "Quantidade cortada deve ser maior que 0." });
        }

        const { data: activeOrders, error: fetchErr } = await supabaseAdmin
            .from("orders")
            .select("*")
            .is("deleted_at", null)
            .not("status", "in", '("Entregue","Cancelado")');

        if (fetchErr || !activeOrders) {
            return res.status(500).json({ error: "Erro ao carregar pedidos para alocação" });
        }

        const result = allocateCuttingPieces(
            activeOrders,
            item_key,
            cutQty,
            user_name || "Operador",
            Number(user_id) || 1,
            _corteAllocationsStore
        );

        if (!result.success) {
            return res.status(400).json({ error: "Não há demanda pendente para o item especificado." });
        }

        // Atualizar pedidos impactados (items JSONB & stages_status) no banco
        for (const orderId of result.affected_order_ids) {
            const updatedOrder = activeOrders.find(o => o.id === orderId);
            if (updatedOrder) {
                try {
                    await supabaseAdmin
                        .from("orders")
                        .update({
                            items: updatedOrder.items,
                            stages_status: updatedOrder.stages_status
                        })
                        .eq("id", orderId);
                } catch (e) {
                    console.warn(`[API] Aviso ao atualizar items/stages_status do pedido #${orderId}:`, e);
                }

                // Atualizar order_stage_progress da etapa Corte (stage_id = 2)
                const corteStage = (updatedOrder.stages_status || []).find((s: any) => s.id === 2);
                if (corteStage) {
                    const progPayload = {
                        order_id: orderId,
                        stage_id: 2,
                        quantidade_pedido: corteStage.quantidade_pedido || updatedOrder.total_via_corte || updatedOrder.quantity || 1,
                        quantidade_boa: corteStage.quantidade_boa || 0,
                        quantidade_perdida: corteStage.quantidade_perdida || 0,
                        pendencia_reposicao: 0,
                        finished: !!corteStage.finished
                    };
                    _lossStageProgressStore.set(`${orderId}_2`, progPayload);
                    try {
                        await supabaseAdmin.from("order_stage_progress").upsert(progPayload);
                    } catch (e) {}

                    // Registrar log de progresso
                    const logEntry = {
                        order_id: orderId,
                        stage_id: 2,
                        user_id: Number(user_id) || 1,
                        user_name: user_name || "Operador",
                        quantidade_boa_incremento: corteStage.quantidade_boa,
                        created_at: new Date().toISOString()
                    };
                    _progressLogsStore.push(logEntry);
                    try {
                        await supabaseAdmin.from("order_progress_logs").insert(logEntry);
                    } catch (e) {}
                }
            }
        }

        // Salvar novos registros de alocação em corte_allocations
        if (result.allocations.length > 0) {
            try {
                await supabaseAdmin.from("corte_allocations").insert(result.allocations);
            } catch (e) {
                console.warn("[API] Aviso ao salvar logs em corte_allocations:", e);
            }
        }

        return res.json(result);
    } catch (err: any) {
        console.error("[API] Erro ao registrar corte consolidado:", err);
        return res.status(500).json({ error: "Erro ao registrar produção consolidada de corte" });
    }
});

// GET /api/cutting/allocations
app.get("/api/cutting/allocations", async (_req, res) => {
    try {
        await _initLossStore(supabaseAdmin);
        const { data, error } = await supabaseAdmin
            .from("corte_allocations")
            .select("*")
            .order("created_at", { ascending: false });

        if (error || !data) {
            return res.json(_corteAllocationsStore);
        }
        return res.json(data);
    } catch (err: any) {
        return res.json(_corteAllocationsStore);
    }
});

// In-memory fallback stores for RAMADO decisions, surplus pieces, approved plans & Optitex risks
const _ramadoDecisionsStore: any[] = [];
const _producaoExcedentesStore: any[] = [];
const _approvedPlansStore: any[] = [];
const _optitexRiscosStore: any[] = [];

// POST /api/cutting/optitex-risco
app.post("/api/cutting/optitex-risco", async (req, res) => {
    try {
        const record = req.body;
        if (!record || !record.model || !record.composicao) {
            return res.status(400).json({ error: "Dados inválidos de risco Optitex." });
        }
        record.id = record.id || `opt-${Date.now()}`;
        record.created_at = record.created_at || new Date().toISOString();

        _optitexRiscosStore.unshift(record);

        try {
            await supabaseAdmin.from("optitex_riscos_validados").upsert([record]);
        } catch (e) {}

        return res.json({ success: true, record });
    } catch (err: any) {
        return res.status(500).json({ error: "Erro ao salvar validação do Optitex." });
    }
});

// GET /api/cutting/optitex-riscos
app.get("/api/cutting/optitex-riscos", async (_req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("optitex_riscos_validados")
            .select("*")
            .order("created_at", { ascending: false });

        if (error || !data) {
            return res.json(_optitexRiscosStore);
        }
        return res.json(data);
    } catch (err: any) {
        return res.json(_optitexRiscosStore);
    }
});


// POST /api/cutting/approved-plans
app.post("/api/cutting/approved-plans", async (req, res) => {
    try {
        const planRecord = req.body;
        if (!planRecord || !planRecord.id) {
            return res.status(400).json({ error: "Plano inválido." });
        }
        const existingIdx = _approvedPlansStore.findIndex(p => p.id === planRecord.id);
        if (existingIdx >= 0) {
            _approvedPlansStore[existingIdx] = planRecord;
        } else {
            _approvedPlansStore.unshift(planRecord);
        }

        try {
            await supabaseAdmin.from("approved_enfesto_plans").upsert([planRecord]);
        } catch (e) {}

        return res.json({ success: true, plan: planRecord });
    } catch (err: any) {
        return res.status(500).json({ error: "Erro ao salvar plano aprovado." });
    }
});

// GET /api/cutting/approved-plans
app.get("/api/cutting/approved-plans", async (_req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("approved_enfesto_plans")
            .select("*")
            .order("created_at", { ascending: false });

        if (error || !data) {
            return res.json(_approvedPlansStore);
        }
        return res.json(data);
    } catch (err: any) {
        return res.json(_approvedPlansStore);
    }
});


// POST /api/cutting/ramado-decision
app.post("/api/cutting/ramado-decision", async (req, res) => {
    try {
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
            user_id,
            user_name
        } = req.body;

        if (!model || !decision) {
            return res.status(400).json({ error: "Modelo e decisão são obrigatórios." });
        }

        const decisionRecord = {
            model,
            fabric: fabric || 'RAMADO',
            color: color || '',
            tipo_tecido: tipo_tecido || 'RAMADO',
            decision, // 'APROVADO_OTIMIZADO' | 'MANTIDO_EXATO'
            plano_exato: plano_exato || {},
            plano_otimizado: plano_otimizado || null,
            excedente_proposto: excedente_proposto || null,
            excedente_total: Number(excedente_total) || 0,
            riscos_antes: Number(riscos_antes) || 0,
            riscos_depois: Number(riscos_depois) || 0,
            ganho_operacional: ganho_operacional || null,
            user_id: Number(user_id) || 1,
            user_name: user_name || 'Operador',
            created_at: new Date().toISOString()
        };

        _ramadoDecisionsStore.unshift(decisionRecord);

        let insertedDecision: any = decisionRecord;
        try {
            const { data, error } = await supabaseAdmin
                .from("ramado_decisions")
                .insert([decisionRecord])
                .select("*")
                .single();
            if (!error && data) {
                insertedDecision = data;
            }
        } catch (e) {
            console.warn("[API] Aviso ao salvar ramado_decisions no Supabase (usando fallback em memória):", e);
        }

        // Se a decisão for APROVADO_OTIMIZADO e houver excedentes, salvar em producao_excedentes
        const surplusItems: any[] = [];
        if (decision === 'APROVADO_OTIMIZADO' && excedente_proposto && typeof excedente_proposto === 'object') {
            for (const [sz, qty] of Object.entries(excedente_proposto)) {
                const count = Number(qty);
                if (count > 0) {
                    const excItem = {
                        decision_id: insertedDecision.id || Date.now(),
                        model,
                        fabric: fabric || 'RAMADO',
                        color: color || '',
                        size: sz,
                        quantidade: count,
                        origem: 'EXCEDENTE_DE_PRODUCAO',
                        destino: 'ESTOQUE',
                        created_at: new Date().toISOString()
                    };
                    _producaoExcedentesStore.unshift(excItem);
                    surplusItems.push(excItem);
                }
            }

            if (surplusItems.length > 0) {
                try {
                    await supabaseAdmin.from("producao_excedentes").insert(surplusItems);
                } catch (e) {
                    console.warn("[API] Aviso ao salvar producao_excedentes no Supabase:", e);
                }
            }
        }

        return res.json({
            success: true,
            decision: insertedDecision,
            excedentes_gerados: surplusItems
        });
    } catch (err: any) {
        console.error("[API] Erro ao registrar decisão RAMADO:", err);
        return res.status(500).json({ error: "Erro ao registrar decisão de excedente RAMADO" });
    }
});

// GET /api/cutting/ramado-decisions
app.get("/api/cutting/ramado-decisions", async (_req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("ramado_decisions")
            .select("*")
            .order("created_at", { ascending: false });

        if (error || !data) {
            return res.json(_ramadoDecisionsStore);
        }
        return res.json(data);
    } catch (err: any) {
        return res.json(_ramadoDecisionsStore);
    }
});

// GET /api/cutting/producao-excedentes
app.get("/api/cutting/producao-excedentes", async (_req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("producao_excedentes")
            .select("*")
            .order("created_at", { ascending: false });

        if (error || !data) {
            return res.json(_producaoExcedentesStore);
        }
        return res.json(data);
    } catch (err: any) {
        return res.json(_producaoExcedentesStore);
    }
});


// ── Stages ────────────────────────────────────────────────────────────────
app.get("/api/stages", async (_req, res) => {
    const { data, error } = await supabase
        .from("stages")
        .select("*")
        .eq("active", 1)
        .order("sort_order");
    if (checkError(error, res)) return;
    return res.json(data);
});

app.post("/api/stages", async (req, res) => {
    const { name, average_time_seconds, ideal_time, calculation_type, meta_diaria } = req.body;
    const { data: maxData } = await supabase
        .from("stages")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();
    const sort_order = (maxData?.sort_order || 0) + 1;

    let result = await supabase
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

    if (result.error && result.error.message.includes("meta_diaria")) {
        result = await supabase
            .from("stages")
            .insert({ 
                name, 
                sort_order, 
                average_time_seconds: Number(average_time_seconds) || 0,
                ideal_time: Number(ideal_time) || Number(average_time_seconds) || 0,
                calculation_type: calculation_type || 'por_peca'
            })
            .select()
            .single();
    }

    if (checkError(result.error, res)) return;
    return res.json(result.data);
});

app.patch("/api/stages/:id", async (req, res) => {
    const { name, active, sort_order, average_time_seconds, ideal_time, calculation_type, meta_diaria } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (active !== undefined) updates.active = active;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (average_time_seconds !== undefined) updates.average_time_seconds = Number(average_time_seconds);
    if (ideal_time !== undefined) updates.ideal_time = Number(ideal_time);
    if (calculation_type !== undefined) updates.calculation_type = calculation_type;
    if (meta_diaria !== undefined) updates.meta_diaria = meta_diaria !== null ? Number(meta_diaria) : null;

    let result = await supabase
        .from("stages")
        .update(updates)
        .eq("id", Number(req.params.id));

    if (result.error && result.error.message.includes("meta_diaria")) {
        delete updates.meta_diaria;
        result = await supabase
            .from("stages")
            .update(updates)
            .eq("id", Number(req.params.id));
    }

    if (checkError(result.error, res)) return;
    return res.json({ success: true });
});

app.delete("/api/stages/:id", async (req, res) => {
    const { error } = await supabase
        .from("stages")
        .update({ active: 0 })
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// ── Loss Reasons & Re-entry Configuration ──────────────────────────────────
app.get("/api/loss-reasons", async (_req, res) => {
    try {
        const reasons = await getLossReasons(supabase);
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
        const updated = await updateLossReasons(supabase, reasons);
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

app.post("/api/orders/:id/stages/:stageId/progress", async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const stageId = Number(req.params.stageId);
        const { incremento, user_id, user_name } = req.body;

        if (!incremento || Number(incremento) <= 0) {
            return res.status(400).json({ error: "Quantidade incremental deve ser maior que 0." });
        }

        const result = await logProgress(
            supabaseAdmin,
            orderId,
            stageId,
            Number(user_id) || 1,
            user_name || "Operador",
            Number(incremento)
        );
        return res.json(result);
    } catch (err: any) {
        console.error("[API] Erro ao registrar progresso parcial:", err);
        return res.status(500).json({ error: "Erro ao registrar progresso parcial" });
    }
});

app.post("/api/orders/:id/stages/:stageId/loss", async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const stageId = Number(req.params.stageId);
        const { quantidade_perdida, motivo, motivo_detalhe, etapa_reentrada_id, user_id, user_name } = req.body;

        if (!quantidade_perdida || Number(quantidade_perdida) <= 0) {
            return res.status(400).json({ error: "Quantidade perdida deve ser maior que 0." });
        }
        if (!motivo) {
            return res.status(400).json({ error: "Motivo da perda é obrigatório." });
        }
        if (motivo === "Outro" && (!motivo_detalhe || !motivo_detalhe.trim())) {
            return res.status(400).json({ error: "Campo livre obrigatório para o motivo 'Outro'." });
        }

        const result = await logLoss(
            supabaseAdmin,
            orderId,
            stageId,
            Number(user_id) || 1,
            user_name || "Operador",
            Number(quantidade_perdida),
            motivo,
            motivo_detalhe,
            etapa_reentrada_id ? Number(etapa_reentrada_id) : undefined
        );

        return res.json(result);
    } catch (err: any) {
        console.error("[API] Erro ao registrar perda:", err);
        return res.status(500).json({ error: "Erro ao registrar perda" });
    }
});

// ── Loss & Rework Bottleneck Report ────────────────────────────────────────
app.get("/api/reports/losses", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await getLossReportDataStore(supabase, startDate as string, endDate as string);
        return res.json(data);
    } catch (err: any) {
        console.error("[API] Erro ao gerar relatório de perdas:", err);
        return res.status(500).json({ error: "Erro ao gerar relatório de perdas" });
    }
});

// ── Collaborator Stage Goals Overrides ─────────────────────────────────────
app.get("/api/collaborator-goals", async (_req, res) => {
    const { data, error } = await supabase
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

app.post("/api/collaborator-goals", async (req, res) => {
    const { user_id, stage_id, meta_diaria } = req.body;
    const { data, error } = await supabase
        .from("collaborator_stage_goals")
        .upsert({
            user_id: Number(user_id),
            stage_id: Number(stage_id),
            meta_diaria: Number(meta_diaria),
            updated_at: new Date().toISOString()
        }, { onConflict: "user_id,stage_id" })
        .select()
        .single();
    if (checkError(error, res)) return;
    return res.json(data);
});

app.delete("/api/collaborator-goals/:id", async (req, res) => {
    const { error } = await supabase
        .from("collaborator_stage_goals")
        .delete()
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});
app.get("/api/executions/monitor", isAdmin, async (req, res) => {
    try {
        const { data: executions, error } = await supabaseAdmin
            .from("stage_executions")
            .select(`
                id,
                order_id,
                stage_id,
                user_id,
                start_time,
                status,
                pauses (
                    duration_seconds,
                    start_pause,
                    end_pause
                ),
                users ( name ),
                stages ( name, average_time_seconds, ideal_time, real_average_time, execution_count, calculation_type ),
                orders ( order_number, client_name, product_type, quantity )
            `)
            .eq("status", "Em andamento");

        if (error) throw error;

        const now = new Date().getTime();

        const monitorData = (executions || []).map((exec: any) => {
            const itemPauses = exec.pauses || [];
            const { totalAccumulatedSeconds, currentSessionSeconds, isPaused } = calculateExecutionTimes(exec, itemPauses, now);

            return {
                id: exec.id,
                order_id: exec.order_id,
                stage_id: exec.stage_id,
                user_id: exec.user_id,
                start_time: exec.start_time,
                status: exec.status,
                is_paused: isPaused,
                total_time_seconds: totalAccumulatedSeconds,
                current_session_seconds: currentSessionSeconds,
                user_name: exec.users?.name,
                stage_name: exec.stages?.name,
                average_time_seconds: exec.stages?.average_time_seconds,
                ideal_time: exec.stages?.ideal_time,
                real_average_time: exec.stages?.real_average_time,
                execution_count: exec.stages?.execution_count,
                calculation_type: exec.stages?.calculation_type,
                order_number: exec.orders?.order_number,
                client_name: exec.orders?.client_name,
                product_type: exec.orders?.product_type,
                quantity: exec.orders?.quantity
            };
        });

        monitorData.sort((a, b) => b.total_time_seconds - a.total_time_seconds);

        return res.json(monitorData);
    } catch (err: any) {
        console.error("[Monitor] Error:", err);
        return res.status(500).json({ error: "Erro ao carregar monitoramento em tempo real" });
    }
});

app.get("/api/executions/active/:userId", async (req, res) => {
    const { data: executions, error } = await supabase
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
    const { data: pauses } = await supabase
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
    const { data, error } = await supabase
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
        ? await supabase.from("pauses").select("*").in("execution_id", executionIds)
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

app.get("/api/executions/monitor", isAdmin, async (req, res) => {
    const { data, error } = await supabase
        .from("stage_executions")
        .select(`
          *,
          stages ( name, average_time_seconds, ideal_time, real_average_time, execution_count, calculation_type ),
          users ( name ),
          orders ( order_number, client_name, product_type, quantity )
        `)
        .eq("status", "Em andamento");

    if (checkError(error, res, "Erro ao buscar monitor de tarefas")) return;

    const executionIds = (data || []).map(e => e.id);
    const { data: pauses } = executionIds.length > 0
        ? await supabase.from("pauses").select("*").in("execution_id", executionIds)
        : { data: [] };

    const nowMs = new Date().getTime();
    const formatted = (data || []).map((e: any) => {
        const itemPauses = (pauses || []).filter(p => p.execution_id === e.id);
        const { totalAccumulatedSeconds, currentSessionSeconds, isPaused } = calculateExecutionTimes(e, itemPauses, nowMs);

        return {
            ...e,
            stage_name: e.stages?.name,
            user_name: e.users?.name,
            order_number: e.orders?.order_number,
            client_name: e.orders?.client_name,
            product_type: e.orders?.product_type,
            average_time_seconds: e.stages?.average_time_seconds || 0,
            ideal_time: e.stages?.ideal_time || 0,
            real_average_time: e.stages?.real_average_time || 0,
            execution_count: e.stages?.execution_count || 0,
            calculation_type: e.stages?.calculation_type || 'por_peca',
            quantity: e.orders?.quantity || 1,
            accumulated_pause_seconds: itemPauses.reduce((sum, p) => sum + (p.duration_seconds || 0), 0),
            total_time_seconds: totalAccumulatedSeconds,
            current_session_seconds: currentSessionSeconds,
            is_paused: isPaused,
            stages: undefined,
            users: undefined,
            orders: undefined
        };
    });
    return res.json(formatted);
});

app.post("/api/executions/start", async (req, res) => {
    const { order_id, stage_id, user_id } = req.body;

    // Use supabaseAdmin to bypass RLS for internal logic
    const { data: existing, error: e1 } = await supabaseAdmin
        .from("stage_executions")
        .select("id")
        .eq("order_id", Number(order_id))
        .eq("stage_id", Number(stage_id))
        .eq("status", "Em andamento")
        .limit(1);

    if (e1) {
        return checkError(e1, res, "Erro ao verificar execuções existentes");
    }

    if (existing && existing.length > 0) {
        return res.status(400).json({ error: "Esta etapa já está sendo executada para este pedido." });
    }

    if (Number(user_id) === 0) {
        return res.status(400).json({ error: "Usuário não identificado. Por favor, saia e entre novamente." });
    }

    // No auto-pause anymore as per user requested multiple tasks support
    const { data, error } = await supabaseAdmin
        .from("stage_executions")
        .insert({
            order_id: Number(order_id),
            stage_id: Number(stage_id),
            user_id: Number(user_id),
            status: "Em andamento",
        })
        .select("id")
        .maybeSingle();

    if (error) {
        console.error("[API] Erro ao iniciar execução:", error);
        return res.status(500).json({ error: `Erro ao iniciar execução: ${error.message}` });
    }

    if (!data) {
        return res.status(500).json({ error: "Erro ao recuperar ID da nova execução." });
    }

    // --- AUTOMAÇÃO CORTE VS SEPARAÇÃO ESTOQUE ---
    try {
        // Obter nome da etapa sendo iniciada
        const { data: stageData } = await supabaseAdmin
            .from("stages")
            .select("name")
            .eq("id", Number(stage_id))
            .single();

        if (stageData && (stageData.name === "Corte" || stageData.name === "Separação estoque")) {
            // Se for "Corte", a etapa oponente a remover é "Separação estoque". E vice-versa.
            const oppositeStageName = stageData.name === "Corte" ? "Separação estoque" : "Corte";

            // Encontrar o ID da etapa oponente
            const { data: oppositeStageData } = await supabaseAdmin
                .from("stages")
                .select("id")
                .eq("name", oppositeStageName)
                .single();

            if (oppositeStageData) {
                const oppositeStageId = oppositeStageData.id;

                const { data: orderData } = await supabaseAdmin
                    .from("orders")
                    .select("required_stages, items, observations")
                    .eq("id", Number(order_id))
                    .single();

                const corteNeeded = getOrderCuttingNeeded(orderData);
                const isParallelActive = (corteNeeded > 0) ||
                    (Array.isArray(orderData?.required_stages) &&
                     orderData.required_stages.map(String).includes("2") &&
                     orderData.required_stages.map(String).includes("12"));

                if (isParallelActive) {
                    console.log(`[API] Ambas as etapas (Corte e Separação estoque) estão ativas em paralelo para o pedido ${order_id}. Mantendo ambas.`);
                } else if (orderData && Array.isArray(orderData.required_stages)) {
                    // Remover a etapa oposta apenas se não for execução paralela
                    const updatedStages = orderData.required_stages.filter(
                        (id) => String(id) !== String(oppositeStageId)
                    );

                    if (updatedStages.length !== orderData.required_stages.length) {
                        await supabaseAdmin
                            .from("orders")
                            .update({ required_stages: updatedStages })
                            .eq("id", Number(order_id));
                        console.log(`[API] Automação: Estágio oponente '${oppositeStageName}' (${oppositeStageId}) removido do pedido ${order_id}.`);
                    }
                }
            }
        }
    } catch (autoErr) {
        console.error("[API] Erro na automação de exclusividade Corte/Separação:", autoErr);
        // Não retornar erro para o front, deixar a execução seguir normalmente se a automação falhar
    }

    return res.json({ id: data.id });
});

// ── Pause-All: pausa todas as execuções ativas (fim de expediente) ────────
app.post("/api/executions/pause-all", isAdmin, async (req, res) => {
    try {
        const now = new Date();

        const { data: activeExecs, error: fetchErr } = await supabaseAdmin
            .from("stage_executions")
            .select("id")
            .eq("status", "Em andamento");

        if (fetchErr) return checkError(fetchErr, res, "Erro ao buscar execuções ativas");
        if (!activeExecs || activeExecs.length === 0) {
            return res.json({ success: true, paused: 0 });
        }

        for (const exec of activeExecs) {
            await supabaseAdmin
                .from("stage_executions")
                .update({ status: "Pausado" })
                .eq("id", exec.id);
            await supabaseAdmin
                .from("pauses")
                .insert({ execution_id: exec.id, start_pause: now.toISOString() });
        }

        console.log(`[API] Pause-all: ${activeExecs.length} execução(ões) pausada(s) por comando direto.`);
        return res.json({ success: true, paused: activeExecs.length });
    } catch (err: any) {
        console.error("[API] Erro no pause-all:", err);
        return res.status(500).json({ error: "Erro ao pausar todas as execuções" });
    }
});

// ── Reset-Production: zera todos os relatórios e tempos mantendo os pedidos (Opção B) ──
app.post("/api/admin/reset-production", isAdmin, async (req, res) => {
    try {
        console.log(`[API] Reset solicitado por ${req.headers["x-user-name"] || "Admin"}`);

        // 1. Apagar todas as pausas
        const { error: errPauses } = await supabaseAdmin
            .from("pauses")
            .delete()
            .gt("id", 0);
        if (errPauses) {
            console.error("Erro ao deletar pausas:", errPauses);
            return res.status(500).json({ error: "Erro ao limpar histórico de pausas: " + errPauses.message });
        }

        // 2. Apagar todas as execuções de etapas
        const { error: errExecutions } = await supabaseAdmin
            .from("stage_executions")
            .delete()
            .gt("id", 0);
        if (errExecutions) {
            console.error("Erro ao deletar execuções:", errExecutions);
            return res.status(500).json({ error: "Erro ao limpar histórico de execuções: " + errExecutions.message });
        }

        // 3. Resetar o tempo acumulado dos pedidos para 0
        const { error: errOrders } = await supabaseAdmin
            .from("orders")
            .update({ total_time_seconds: 0 })
            .gt("id", 0);
        if (errOrders) {
            console.error("Erro ao resetar tempos dos pedidos:", errOrders);
            return res.status(500).json({ error: "Erro ao resetar tempos dos pedidos: " + errOrders.message });
        }

        // 4. Resetar as médias de tempo calculadas nos estágios
        const { error: errStages } = await supabaseAdmin
            .from("stages")
            .update({ real_average_time: 0, execution_count: 0 })
            .gt("id", 0);
        if (errStages) {
            console.error("Erro ao resetar médias dos estágios:", errStages);
            return res.status(500).json({ error: "Erro ao resetar médias dos estágios: " + errStages.message });
        }

        console.log("[API] Reset de produção concluído com sucesso!");
        return res.json({ success: true, message: "Histórico de relatórios e tempos resetados com sucesso! Os pedidos foram preservados." });
    } catch (err: any) {
        console.error("[API] Erro ao resetar produção:", err);
        return res.status(500).json({ error: "Erro interno ao processar reset de produção" });
    }
});

// ── Auto-Pause: pausa automática baseado no horário agendado ────────
app.post("/api/executions/auto-pause", async (req, res) => {
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

        for (const exec of activeExecs) {
            await supabaseAdmin.from("stage_executions").update({ status: "Pausado" }).eq("id", exec.id);
            await supabaseAdmin.from("pauses").insert({ execution_id: exec.id, start_pause: now.toISOString() });
        }

        console.log(`[AutoPause] ${activeExecs.length} execução(ões) pausadas automaticamente por ${isLunch ? 'almoço' : 'fim de expediente'}.`);
        return res.json({ success: true, paused: activeExecs.length, reason: isLunch ? 'almoço' : 'fim de expediente' });
    } catch (err: any) {
        console.error("[AutoPause] Erro:", err);
        return res.status(500).json({ error: "Erro interno no auto-pause" });
    }
});

app.post("/api/executions/:id/pause", async (req, res) => {
    const execution_id = Number(req.params.id);
    const { observation } = req.body || {};

    const { data: exec } = await supabaseAdmin
        .from("stage_executions")
        .select("order_id, stage_id, user_id")
        .eq("id", execution_id)
        .single();

    const { error: e1 } = await supabaseAdmin
        .from("stage_executions")
        .update({ status: "Pausado" })
        .eq("id", execution_id);
    if (checkError(e1, res, "Erro ao pausar execução")) return;

    const { error: e2 } = await supabaseAdmin
        .from("pauses")
        .insert({ execution_id });
    if (checkError(e2, res, "Erro ao registrar pausa")) return;

    if (observation && exec) {
        try {
            await supabaseAdmin.from("stage_observations").insert({
                order_id: exec.order_id,
                stage_id: exec.stage_id,
                user_id: exec.user_id,
                observation
            });
        } catch (e) {
            console.error("Erro ao salvar observação da etapa na pausa:", e);
        }
    }

    return res.json({ success: true });
});

app.post("/api/executions/:id/resume", async (req, res) => {
    const execution_id = Number(req.params.id);
    const now = new Date();

    // 1. Get the active pause
    const { data: activePause, error: e0 } = await supabaseAdmin
        .from("pauses")
        .select("id, start_pause")
        .eq("execution_id", execution_id)
        .is("end_pause", null)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (e0) return checkError(e0, res, "Erro ao buscar pausa ativa");

    if (activePause) {
        const duration = Math.floor((now.getTime() - new Date(activePause.start_pause).getTime()) / 1000);
        const { error: e2 } = await supabaseAdmin
            .from("pauses")
            .update({
                end_pause: now.toISOString(),
                duration_seconds: Math.max(0, duration)
            })
            .eq("id", activePause.id);
        if (checkError(e2, res, "Erro ao finalizar pausa")) return;
    }

    const { error: e1 } = await supabaseAdmin
        .from("stage_executions")
        .update({ status: "Em andamento" })
        .eq("id", execution_id);
    if (checkError(e1, res, "Erro ao retomar execução")) return;

    return res.json({ success: true });
});

app.post("/api/executions/:id/finish", async (req, res) => {
    const execution_id = Number(req.params.id);
    const { force, observation } = req.body || {};
    const nowISO = new Date().toISOString();
    const nowMs = new Date().getTime();

    // 1. Get current execution
    const { data: execution, error: e1 } = await supabaseAdmin
        .from("stage_executions")
        .select("*, stages(name)")
        .eq("id", execution_id)
        .single();

    if (checkError(e1, res, "Execução não encontrada") || !execution) return;

    // 1.5 Validate if stage can be finished (for por_peca, quantidade_boa >= quantidade_pedido)
    if (!force) {
        const val = await validateStageFinish(supabase, execution.order_id, execution.stage_id);
        if (!val.canFinish) {
            return res.status(400).json({ error: val.message, remaining: val.remaining, canForce: true });
        }
    }

    // 2. Finalize any active pause
    const { data: lastPauseData } = await supabaseAdmin
        .from("pauses")
        .select("id, start_pause")
        .eq("execution_id", execution_id)
        .is("end_pause", null)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (lastPauseData) {
        const duration = Math.floor((nowMs - new Date(lastPauseData.start_pause).getTime()) / 1000);
        await supabaseAdmin
            .from("pauses")
            .update({ end_pause: nowISO, duration_seconds: duration })
            .eq("id", lastPauseData.id);
    }

    // 3. Calculate total pause time
    const { data: pausesData } = await supabaseAdmin
        .from("pauses")
        .select("duration_seconds")
        .eq("execution_id", execution_id);

    const totalPauseSeconds = (pausesData || []).reduce(
        (sum: number, p: any) => sum + (p.duration_seconds || 0), 0
    );

    // 4. Calculate total execution time
    const totalExecutionSeconds = Math.max(0, Math.floor(
        (nowMs - new Date(execution.start_time).getTime()) / 1000
    ) - totalPauseSeconds);

    // 5. Update execution status
    const { error: e2 } = await supabaseAdmin
        .from("stage_executions")
        .update({
            end_time: nowISO,
            total_time_seconds: totalExecutionSeconds,
            status: "Finalizado"
        })
        .eq("id", execution_id);

    if (checkError(e2, res, "Erro ao finalizar execução")) return;

    if (observation && execution) {
        try {
            await supabaseAdmin.from("stage_observations").insert({
                order_id: execution.order_id,
                stage_id: execution.stage_id,
                user_id: execution.user_id,
                observation
            });
        } catch (e) {
            console.error("Erro ao salvar observação da etapa na finalização:", e);
        }
    }

    // 6. Update order total time
    const { data: allExecs } = await supabaseAdmin
        .from("stage_executions")
        .select("total_time_seconds")
        .eq("order_id", execution.order_id);

    const totalOrderTime = (allExecs || []).reduce(
        (sum: number, e: any) => sum + (e.total_time_seconds || 0), 0
    );

    await supabaseAdmin
        .from("orders")
        .update({ total_time_seconds: totalOrderTime })
        .eq("id", execution.order_id);

    // 7. Update order status if specific stage finished
    if (execution.stages?.name === "Aguardando ficha de aprovação") {
        await supabaseAdmin
            .from("orders")
            .update({ status: "Em Produção" })
            .eq("id", execution.order_id)
            .eq("status", "Entrada");
    }

    if (execution.stages?.name === "Conferência" || execution.stages?.name === "Conferencia") {
        await supabaseAdmin
            .from("orders")
            .update({ 
                status: "Entregue",
                delivered_at: nowISO
            })
            .eq("id", execution.order_id);
        console.log(`[API] Pedido ${execution.order_id} marcado como Entregue automaticamente ao finalizar Conferência.`);
    }

    // 8. Update real average time for the stage
    try {
        const { data: stageInfo } = await supabaseAdmin
            .from("stages")
            .select("calculation_type")
            .eq("id", execution.stage_id)
            .single();

        const { data: recentExecs } = await supabaseAdmin
            .from("stage_executions")
            .select("total_time_seconds, orders(quantity)")
            .eq("stage_id", execution.stage_id)
            .eq("status", "Finalizado")
            .order("end_time", { ascending: false })
            .limit(20);

        if (recentExecs && recentExecs.length > 0) {
            const calcType = stageInfo?.calculation_type || 'por_peca';
            const sumNormalizedTime = recentExecs.reduce((sum: number, e: any) => {
                const qty = e.orders?.quantity || 1;
                const time = e.total_time_seconds || 0;
                
                if (calcType === 'por_peca') {
                    return sum + (time / qty);
                } else if (calcType === 'por_lote') {
                    return sum + (time / Math.ceil(qty / 10));
                }
                return sum + time; // por_pedido
            }, 0);
            const avg = Math.round(sumNormalizedTime / recentExecs.length);

            const { count } = await supabaseAdmin
                .from("stage_executions")
                .select("*", { count: "exact", head: true })
                .eq("stage_id", execution.stage_id)
                .eq("status", "Finalizado");

            await supabaseAdmin
                .from("stages")
                .update({
                    real_average_time: avg,
                    execution_count: count || recentExecs.length
                })
                .eq("id", execution.stage_id);
        }
    } catch (metricError) {
        console.error("[API] Erro ao recalcular métricas de tempo da etapa:", metricError);
        // Não falha a requisição se falhar ao atualizar a métrica
    }

    return res.json({ success: true, total_time: totalExecutionSeconds });
});

// ── Production Config ─────────────────────────────────────────────────────
app.get("/api/config/producao", async (_req, res) => {
    const { data, error } = await supabase
        .from("config_producao")
        .select("*")
        .limit(1)
        .single();
    if (checkError(error, res)) return;
    return res.json(data);
});

app.patch("/api/config/producao", isAdmin, async (req, res) => {
    const { jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes, meta_diaria_pedidos, meta_diaria_pecas } = req.body;
    const { error } = await supabase
        .from("config_producao")
        .update({ jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes, meta_diaria_pedidos, meta_diaria_pecas })
        .eq("id", 1);
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// ── Users ─────────────────────────────────────────────────────────────────
app.get("/api/users", async (req, res) => {
    const isAdminUser = req.headers["x-user-role"] === "Admin";
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
            password: "-", // A senha verdadeira fica apenas no Auth por segurança
            role,
            hourly_cost: hourly_cost || 0,
            active: 1
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
    const { error } = await supabase
        .from("users")
        .update({ name, email, role, hourly_cost, active: active ? 1 : 0 })
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// ── Clients ───────────────────────────────────────────────────────────────
app.get("/api/clients", async (req, res) => {
    const { search } = req.query;
    let query = supabase.from("clients").select("*").order("name");
    if (search) {
        query = query.or(`name.ilike.% ${search} %, email.ilike.% ${search} % `);
    }
    const { data, error } = await query;
    if (checkError(error, res)) return;
    return res.json(data);
});

app.post("/api/clients", async (req, res) => {
    const { name, phone, email } = req.body;
    const { data, error } = await supabase
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

    let query = supabase
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

    let ordersQuery = supabase
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

    const { data: config } = await supabase.from("config_producao").select("meta_diaria_pedidos, meta_diaria_pecas").eq("id", 1).single();
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

    const { data, error } = await supabase.rpc("get_operational_report", rpcParams);

    if (checkError(error, res, "Erro ao buscar relatório operacional")) return;
    return res.json(data);
});

// ── Production Profile Report ─────────────────────────────────────────────
app.get("/api/reports/profiles", async (req, res) => {
    const { startDate, endDate, print_type } = req.query;

    let query = supabase
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

// ── Geração de Token & Acompanhamento Público de Pedido ─────────────────────
app.post("/api/orders/:id/tracking-token", async (req, res) => {
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

        // Sincronizar progresso de perdas/quantidade boa com o store local temporário
        enrichOrdersWithProgressSync([rpcOrder]);

        // Buscar execuções reais e progresso gravados no banco para este pedido
        const [{ data: dbExecs }, { data: dbProg }] = await Promise.all([
            supabaseAdmin
                .from("stage_executions")
                .select("stage_id, status")
                .eq("order_id", order.id),
            supabaseAdmin
                .from("order_stage_progress")
                .select("stage_id, finished, quantidade_boa, quantidade_pedido")
                .eq("order_id", order.id)
        ]);

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

// ── 404 for API routes ────────────────────────────────────────────────────
app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

export default app;
