export function groupCuttingDemandByRawMaterial(demandItems: CorteDemandItem[]): {
  groups: CorteGroupDemand[];
  incompleteFamilies: IncompleteFamilyGroup[];
} {
  const groupsMap = new Map<string, CorteGroupDemand>();
  const incompleteFamiliesMap = new Map<string, IncompleteFamilyGroup>();

  for (const item of demandItems) {
    if (item.is_complete === false) {
      // Group incomplete items by base family
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
      
      // Upgrade suggestions if another item in family has it
      if (!fam.suggested_fabric && item.suggested_fabric) fam.suggested_fabric = item.suggested_fabric;
      if (!fam.suggested_color && item.suggested_color) fam.suggested_color = item.suggested_color;
      continue;
    }

    // Normalized group key: FABRIC + COLOR + TIPO_TECIDO + LARGURA_UTIL
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

export function extractItemDetails(item: any, defaultProductType: string = 'Vestu�rio'): CorteDemandItem {
  if (!item || typeof item !== 'object') {
    return {
      product_type: 'Modelo n�o informado',
      fabric: 'Tecido n�o informado',
      color: 'Cor n�o informada',
      size: 'Tamanho n�o informado',
      description: 'Item sem descri��o',
      sku: '',
      sku_base: 'SEM-REF',
      item_key: 'Modelo n�o informado | Tecido n�o informado | Cor n�o informada | Tamanho n�o informado',
      is_complete: false,
      tipo_tecido: 'RAMADO',
      largura_util: '1,60 m',
      missing_fields: ['Tecido', 'Cor'],
      total_necessario: 0,
      pedidos_count: 0,
      prazo_mais_proximo: '',
      pedidos_waiting: []
    };
  }

  const rawDesc = (item.description || item.descricao || '').toString().trim();
  const rawSku = (item.sku || item.codigo || '').toString().trim();

  // 1. TAMANHO
  let size = getItemDisplaySize(item);
  if (!size) size = 'Tamanho n�o informado';

  // 2. SKU BASE
  const sku_base = extractBaseSku(rawSku, size, rawDesc);

  // 3. MODELO (Product Type)
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
    else if (/b[a��]sica/i.test(rawDesc)) productType = 'Camiseta B�sica';
    else if (rawDesc) {
      let clean = rawDesc
        .replace(/(?: - |- |\/|\|)\s*(AZUL\s*MARINHO|VERDE\s*MENTA|CINZA\s*MESCLA|OFF\s*WHITE|PRETO|BRANCO|MARROM|AZUL|VERMELHO|VERDE|CINZA|ROSA|AMARELO|ROXO|LARANJA|VINHO|BEGE|GRAFITE)\b/gi, '')
        .replace(/(?: - |- |\/|\|)\s*(G5|G4|G3|G2|G1|EXG|XXL|XGG|GG|G|M|P|PP|16|14|12|10|8|6|4|2|1)\b/gi, '')
        .replace(/\b(?:tam|tamanho|infantil)\s*[:-]?\s*(16|14|12|10|8|6|4|2|1)\b/gi, '')
        .replace(/(?: - |- |\/|\|)?\s*(DRY\s*FIT|DRY\s*COMFORT|POLIAMIDA|ALGOD[A�]O|PIQUET|PV)\b/gi, '')
        .replace(/\b(PRETO|BRANCO|MARROM|AZUL\s*MARINHO|AZUL|VERMELHO|VERDE|CINZA|ROSA|AMARELO|ROXO|LARANJA|VINHO)\b/gi, '')
        .replace(/[\-\/,\|\s]+$/, '').trim();
      productType = clean || defaultProductType || 'Modelo n�o informado';
    } else {
      productType = 'Modelo n�o informado';
    }
  }

  // 4. TECIDO E COR (Ordem: T�cnicos -> Cache -> Sugest�o)
  let fabric = 'Tecido n�o informado';
  let color = 'Cor n�o informada';
  let suggested_fabric = undefined;
  let suggested_color = undefined;
  
  let tipo_tecido: 'TUBULAR' | 'RAMADO' = 'RAMADO';
  let largura_util = (item.largura_util || item.largura || '1,60 m').toString().trim();

  // Tentativa A: Campos t�cnicos originais
  const rawFabric = (item.fabric || item.tecido || item.variacao?.tecido || item.grade?.tecido || item.atributos?.tecido || '').toString().trim();
  const rawColor = (item.color || item.cor || item.variacao?.cor || item.grade?.cor || item.atributos?.cor || '').toString().trim();

  if (rawFabric && !/^(tecido\s+)?n[a�]o\s+informad[ao]$/i.test(rawFabric)) {
    if (/dry\s*comfort/i.test(rawFabric)) fabric = 'Dry Comfort';
    else if (/dry\s*fit/i.test(rawFabric)) fabric = 'Dry Fit';
    else if (/poliamida/i.test(rawFabric)) fabric = 'Poliamida';
    else if (/algod[a�]o/i.test(rawFabric)) fabric = 'Algod�o';
    else if (/piquet|pique/i.test(rawFabric)) fabric = 'Piquet';
    else if (/pv\b/i.test(rawFabric)) fabric = 'PV';
    else fabric = rawFabric;
  }
  
  if (rawColor && !/^(cor\s+)?n[a�]o\s+informad[ao]$/i.test(rawColor)) {
    const matchCat = COLOR_PATTERNS.find(c => c.pattern.test(rawColor));
    color = matchCat ? matchCat.name : rawColor;
  }

  // Tentativa B: Cache T�cnico Mestre (caso ainda n�o tenhamos tecido ou cor)
  const cached = getCachedRegistryItem(sku_base);
  if (cached) {
    if (fabric === 'Tecido n�o informado' && cached.fabric) fabric = cached.fabric;
    if (color === 'Cor n�o informada' && cached.color) color = cached.color;
    if (cached.tipo_tecido) tipo_tecido = cached.tipo_tecido as 'TUBULAR' | 'RAMADO';
    if (cached.largura_util) largura_util = cached.largura_util;
  }

  // Tentativa C: Sugest�o baseada em Texto (apenas preenche `suggested_*`)
  if (fabric === 'Tecido n�o informado') {
    if (/dry\s*comfort/i.test(rawDesc)) suggested_fabric = 'Dry Comfort';
    else if (/dry\s*fit/i.test(rawDesc)) suggested_fabric = 'Dry Fit';
    else if (/poliamida/i.test(rawDesc)) suggested_fabric = 'Poliamida';
    else if (/algod[a�]o/i.test(rawDesc)) suggested_fabric = 'Algod�o';
    else if (/piquet|pique/i.test(rawDesc)) suggested_fabric = 'Piquet';
    else if (/pv\b/i.test(rawDesc)) suggested_fabric = 'PV';
  }

  if (color === 'Cor n�o informada') {
    const matchCat = COLOR_PATTERNS.find(c => c.pattern.test(rawDesc));
    if (matchCat) suggested_color = matchCat.name;
  }

  // 5. Finalize fields
  const rawTipo = (item.tipo_tecido || item.tipoTecido || item.tipo_corte || '').toString().trim().toUpperCase();
  if (rawTipo.includes('TUBULAR') || rawTipo.includes('TUBOLAR')) tipo_tecido = 'TUBULAR';
  else if (rawTipo.includes('RAMADO')) tipo_tecido = 'RAMADO';

  if (!largura_util.includes('m') && !largura_util.includes('cm')) largura_util = largura_util + ' m';

  const lote = (item.lote || item.tonalidade || '').toString().trim() || undefined;
  const orientacao = (item.orientacao || item.sentido || '').toString().trim() || undefined;

  const missing_fields: string[] = [];
  if (fabric === 'Tecido n�o informado') missing_fields.push('Tecido');
  if (color === 'Cor n�o informada') missing_fields.push('Cor');

  const is_complete = missing_fields.length === 0 && size !== 'Tamanho n�o informado' && productType !== 'Modelo n�o informado';
  const description = rawDesc || productType + ' ' + fabric + ' ' + color;
  const item_key = productType + ' | ' + fabric + ' | ' + color + ' | ' + size;

  return {
    product_type: productType,
    fabric,
    color,
    size,
    description,
    sku: rawSku,
    sku_base,
    suggested_fabric,
    suggested_color,
    item_key,
    is_complete,
    tipo_tecido,
    largura_util,
    lote,
    orientacao,
    missing_fields,
    total_necessario: 0,
    pedidos_count: 0,
    prazo_mais_proximo: '',
    pedidos_waiting: []
  };
}

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



export interface IncompleteFamilyGroup {
  sku_base: string;
  product_type: string;
  items: CorteDemandItem[];
  suggested_fabric?: string;
  suggested_color?: string;
  total_pieces: number;
}
