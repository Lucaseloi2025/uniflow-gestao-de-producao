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

// Reset cache so next call to fetchLocalStockCache re-reads from DB
export function invalidateStockCache() {
  cacheLoaded = false;
  localStockCache = {};
}

export async function syncStockForProducts(
  token: string,
  products: { id_produto: string; sku: string }[],
  onProgress: (current: number, total: number) => void
): Promise<{ success: boolean; error: string | null }> {
  const chunkSize = 10;

  // Only include products that have a Tiny internal ID
  const uniqueMap = new Map<string, { id_produto: string; sku: string }>();
  (products || []).forEach(p => {
    if (p.id_produto && p.id_produto.trim() !== '') {
      if (!uniqueMap.has(p.id_produto)) {
        uniqueMap.set(p.id_produto, p);
      }
    }
  });

  const uniqueProducts = Array.from(uniqueMap.values());

  if (uniqueProducts.length === 0) {
    return { success: false, error: 'Nenhum produto com ID do Tiny encontrado nos pedidos. Os pedidos precisam ser importados do Tiny para que o estoque possa ser consultado.' };
  }

  let totalSuccess = 0;

  try {
    for (let i = 0; i < uniqueProducts.length; i += chunkSize) {
      const chunk = uniqueProducts.slice(i, i + chunkSize);

      const promises = chunk.map(async (prod) => {
        try {
          const params = new URLSearchParams({
            token: token,
            id: prod.id_produto,
            formato: 'json'
          });

          const res = await fetch('https://api.tiny.com.br/api2/produto.obter.estoque.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
          });

          const text = await res.text();
          let json: any;
          try { json = JSON.parse(text); } catch (_) { return null; }

          const retorno = json?.retorno || {};
          if (retorno.status !== 'OK') {
            console.warn('[StockSync] Tiny error for id', prod.id_produto, retorno.erros);
            return null;
          }

          const prod_data = retorno.produto || {};
          const saldo = prod_data.saldoDisponivel ?? prod_data.saldo_disponivel ?? prod_data.saldo ?? prod_data.saldo_fisico;
          if (saldo === undefined || saldo === null) return null;

          return {
            id_produto: prod.id_produto,
            sku: prod.sku,
            stock_available: Math.max(0, parseFloat(saldo) || 0)
          };
        } catch (err) {
          console.error('[StockSync] Error for', prod.id_produto, err);
          return null;
        }
      });

      const results = await Promise.all(promises);
      const validResults = results.filter(r => r !== null) as { id_produto: string; sku: string; stock_available: number }[];

      if (validResults.length > 0) {
        totalSuccess += validResults.length;

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
            if (r.sku) localStockCache[r.sku] = r.stock_available;
          });
        } else {
          console.error('[StockSync] Error saving to Supabase:', error);
        }
      }

      onProgress(Math.min(i + chunkSize, uniqueProducts.length), uniqueProducts.length);
      await new Promise(r => setTimeout(r, 300));
    }

    if (totalSuccess === 0 && uniqueProducts.length > 0) {
      return { success: false, error: 'Token do Tiny inv�lido, bloqueado ou limite de requisi��es excedido. Verifique o token.' };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('[StockSync] Exception:', err);
    return { success: false, error: err?.message || 'Erro inesperado durante a sincroniza��o.' };
  }
}
