export interface OlistOrderItem {
  id_produto?: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  valor_unitario?: number;
  productType: string;
  size: string;
}

export interface OlistOrder {
  id: string;
  numero: string;
  nome: string;
  situacao: string;
  data_pedido: string;
  data_prevista?: string;
  cliente?: {
    nome: string;
    email?: string;
    fone?: string;
    cidade?: string;
    uf?: string;
  };
  itens: OlistOrderItem[];
  total_quantidade: number;
}

/**
 * Lightweight, robust XML parser for Tiny ERP / Olist API responses.
 */
export function parseTinyXml(xmlString: string): {
  status: string;
  status_processamento: string;
  errors: string[];
  pedidos: any[];
} {
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

  return {
    status,
    status_processamento,
    errors,
    pedidos
  };
}

/**
 * Extracts size and product title from an item's description and SKU code.
 * Order of size matching: G5 -> G4 -> G3 -> G2 -> G1 -> XGG -> EXG -> XXL -> GG -> PP -> P -> M -> G -> child sizes.
 */
export function extractItemSizeAndProduct(descricao: string, codigo: string, explicitSize?: string): { productType: string; size: string } {
  let size = (explicitSize || '').toString().trim().toUpperCase();
  let productType = descricao || '';

  if (size && size !== 'ÚNICO' && size !== 'UNICO') {
    return { productType: productType.replace(/–|-$/g, '').trim(), size };
  }

  const text = `${descricao || ''} ${codigo || ''}`;

  // 1. Adult sizes (Specific order: G5 -> G4 -> G3 -> G2 -> G1 -> XGG -> EXG -> XXL -> GG -> PP -> P -> M -> G)
  const adultMatch = text.match(/(?:^|[\s\-\–\/\|_,])(G5|G4|G3|G2|G1|XGG|EXG|XXL|GG|PP|P|M|G)(?:[\s\-\–\/\|_,]|$)/i);
  if (adultMatch) {
    size = adultMatch[1].toUpperCase();
  } else {
    // 2. SKU suffix match
    const skuSizeMatch = (codigo || '').match(/-(G5|G4|G3|G2|G1|XGG|EXG|XXL|GG|PP|P|M|G|16|14|12|10|8|6|4|2|1)$/i);
    if (skuSizeMatch) {
      size = skuSizeMatch[1].toUpperCase();
    } else {
      // 3. Child numeric explicit pattern match (Tam 10, Tamanho 10, Infantil 10, Tam. 10)
      const childMatch = text.match(/\b(?:tam|tamanho|inf|infantil|tam\.)\s*[:\-–]?\s*(16|14|12|10|8|6|4|2|1)\b/i);
      if (childMatch) {
        size = childMatch[1];
      } else {
        const childEndMatch = text.match(/(?:–|-|\/)\s*(16|14|12|10|8|6|4|2|1)\s*$/i);
        if (childEndMatch) {
          size = childEndMatch[1];
        }
      }
    }
  }

  if (/\b(tamanho\s*únic[oa]|tamanho\s*unico|tam\.\s*único|único|unica|tu)\b/i.test(text)) {
    size = 'Único';
  }

  // Clean size tag from end of productType if found
  if (size && size !== 'Único' && size !== 'Tamanho não informado') {
    const escSize = size.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    productType = productType.replace(new RegExp(`(?:–|-|\\/|\\|)\\s*${escSize}\\s*$`, 'i'), '').trim();
  }

  productType = productType.replace(/–|-$/g, '').trim();
  return { productType: productType || 'Vestuário', size: size || 'Tamanho não informado' };
}

/**
 * Checks if a Tiny/Olist order status represents an approved/paid order eligible for import.
 */
export function isApprovedOlistStatus(situacao: string): boolean {
  if (!situacao) return false;
  const s = situacao.toLowerCase().trim();
  const approvedStatuses = ['aprovado', 'faturado', 'preparando envio', 'pronto para envio', 'enviado', 'entregue'];
  return approvedStatuses.some(approved => s.includes(approved));
}

/**
 * Fetches order list from Tiny ERP / Olist API.
 */
export async function fetchOlistOrders(token: string): Promise<any[]> {
  if (!token) return [];
  const url = `https://api.tiny.com.br/api2/pedidos.pesquisa.php?token=${token}&format=json`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Olist API HTTP Error: ${res.status}`);
  }
  const text = await res.text();
  const parsed = parseTinyXml(text);

  if (parsed.status !== 'OK' && parsed.status_processamento !== '3') {
    if (parsed.errors && parsed.errors.length > 0) {
      throw new Error(`Olist API Error: ${parsed.errors.join(', ')}`);
    }
  }

  return parsed.pedidos || [];
}

/**
 * Fetches detailed information for a specific Olist order, including its items and grade de tamanhos.
 */
export async function fetchOlistOrderDetail(token: string, olistOrderId: string): Promise<OlistOrder | null> {
  if (!token || !olistOrderId) return null;
  const url = `https://api.tiny.com.br/api2/pedido.obter.php?token=${token}&id=${olistOrderId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Olist API Detail HTTP Error: ${res.status}`);
  }
  const text = await res.text();
  const parsed = parseTinyXml(text);

  if (!parsed.pedidos || parsed.pedidos.length === 0) return null;

  const raw = parsed.pedidos[0];
  const items: OlistOrderItem[] = (raw.itens || []).map((it: any) => {
    const extracted = extractItemSizeAndProduct(it.descricao || '', it.codigo || '');
    return {
      id_produto: it.id_produto,
      codigo: it.codigo,
      descricao: it.descricao,
      quantidade: it.quantidade || 0,
      valor_unitario: it.valor_unitario || 0,
      productType: extracted.productType,
      size: extracted.size
    };
  });

  const total_quantidade = items.reduce((sum, item) => sum + (item.quantidade || 0), 0);

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
