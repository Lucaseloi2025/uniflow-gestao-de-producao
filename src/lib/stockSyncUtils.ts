import { supabase } from './supabase';
import type { StockCache } from '../types';

let localStockCache: StockCache = {};
let cacheLoaded = false;

export async function fetchLocalStockCache(): Promise<{ cache: StockCache; error: string | null }> {
  if (cacheLoaded) return { cache: localStockCache, error: null };
  try {
    const { data, error } = await supabase.from('tiny_stock_cache').select('id_produto, stock_available');
    if (error) {
      console.error('Error fetching stock cache:', error);
      return { cache: {}, error: error.message };
    }
    localStockCache = {};
    (data || []).forEach((row: any) => {
      if (row.id_produto) {
        localStockCache[row.id_produto] = row.stock_available;
      }
    });
    cacheLoaded = true;
    return { cache: localStockCache, error: null };
  } catch (err: any) {
    console.error('Exception fetching stock cache:', err);
    return { cache: {}, error: err?.message || 'Erro ao carregar cache de estoque.' };
  }
}

export async function syncStockForProducts(
  token: string, 
  products: { id_produto: string; sku: string }[],
  onProgress: (current: number, total: number) => void
): Promise<{ success: boolean; error: string | null }> {
  const chunkSize = 10;
  
  const uniqueMap = new Map<string, { id_produto: string; sku: string }>();
  (products || []).forEach(p => {
    const key = p.sku || p.id_produto;
    if (key && !uniqueMap.has(key)) {
      uniqueMap.set(key, p);
    }
  });

  const uniqueProducts = Array.from(uniqueMap.values());
  
  if (uniqueProducts.length === 0) {
    return { success: false, error: 'Nenhum produto v�lido encontrado nos pedidos abertos para consultar estoque.' };
  }

  let hasErrors = false;

  try {
    for (let i = 0; i < uniqueProducts.length; i += chunkSize) {
      const chunk = uniqueProducts.slice(i, i + chunkSize);
      
      const promises = chunk.map(async (prod) => {
        try {
          const param = prod.sku ? `sku=${encodeURIComponent(prod.sku)}` : `id=${prod.id_produto}`;
          const url = `https://api.tiny.com.br/api2/produto.obter.estoque.php?token=${token}&${param}&formato=json`;
          
          const res = await fetch(url, { method: "POST" });
          const text = await res.text();
          
          let saldo: number | null = null;
          let isOk = false;

          try {
            const json = JSON.parse(text);
            if (json.retorno && json.retorno.status === 'OK' && json.retorno.produto && json.retorno.produto.saldo !== undefined) {
              saldo = parseFloat(json.retorno.produto.saldo);
              isOk = true;
            } else if (json.retorno && json.retorno.status === 'Erro') {
              console.warn('Tiny API Error for', prod.sku || prod.id_produto, json.retorno.erros);
            }
          } catch(e) {
             const m = text.match(/<saldo>(.*?)<\/saldo>/);
             if (m) {
               saldo = parseFloat(m[1]);
               isOk = true;
             }
          }

          if (!isOk || saldo === null || isNaN(saldo)) {
            return null;
          }

          return {
            id_produto: prod.id_produto || prod.sku,
            sku: prod.sku,
            stock_available: saldo
          };
        } catch (err) {
          console.error(`Failed to fetch stock for ${prod.sku || prod.id_produto}`, err);
          return null;
        }
      });

      const results = await Promise.all(promises);
      const validResults = results.filter(r => r !== null) as { id_produto: string; sku: string; stock_available: number }[];

      if (validResults.length < chunk.length) {
        hasErrors = true;
      }

      if (validResults.length > 0) {
        const { error } = await supabase
          .from('tiny_stock_cache')
          .upsert(
            validResults.map(r => ({
              id_produto: r.id_produto,
              sku: r.sku,
              stock_available: r.stock_available,
              updated_at: new Date().toISOString()
            })),
            { onConflict: 'id_produto' }
          );
        
        if (!error) {
          validResults.forEach(r => {
            localStockCache[r.id_produto] = r.stock_available;
            if (r.sku) {
              localStockCache[r.sku] = r.stock_available;
            }
          });
        } else {
          console.error('Error saving stock cache batch:', error);
          hasErrors = true;
        }
      }

      onProgress(Math.min(i + chunkSize, uniqueProducts.length), uniqueProducts.length);
      await new Promise(r => setTimeout(r, 300));
    }

    return {
      success: true,
      error: hasErrors ? 'Alguns produtos n�o puderam ser consultados no Tiny ou retornaram erro de API.' : null
    };
  } catch (err: any) {
    console.error('Exception syncing stock:', err);
    return { success: false, error: err?.message || 'Erro inesperado durante a sincroniza��o.' };
  }
}
