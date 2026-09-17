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

export function invalidateStockCache() {
  cacheLoaded = false;
  localStockCache = {};
}

export async function syncStockForProducts(
  token: string,
  products: { id_produto: string; sku: string }[],
  onProgress: (current: number, total: number) => void
): Promise<{ success: boolean; error: string | null }> {
  const chunkSize = 20;

  const uniqueMap = new Map<string, { id_produto: string; sku: string }>();
  (products || []).forEach(p => {
    if (p.id_produto && p.id_produto.trim() !== '') {
      if (!uniqueMap.has(p.id_produto)) uniqueMap.set(p.id_produto, p);
    }
  });

  const uniqueProducts = Array.from(uniqueMap.values());

  if (uniqueProducts.length === 0) {
    return { success: false, error: 'Nenhum produto com ID do Tiny encontrado nos pedidos. Reimporte os pedidos do Tiny e tente novamente.' };
  }

  let totalSuccess = 0;

  try {
    for (let i = 0; i < uniqueProducts.length; i += chunkSize) {
      const chunk = uniqueProducts.slice(i, i + chunkSize);

      // Call the backend proxy to avoid CORS issues with Tiny API
      const response = await fetch('/api/stock/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, products: chunk })
      });

      if (!response.ok) {
        console.error('[StockSync] Backend proxy error:', response.status);
        continue;
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        totalSuccess += data.results.length;
        // Update local cache
        data.results.forEach((r: any) => {
          localStockCache[r.id_produto] = r.stock_available;
          if (r.sku) localStockCache[r.sku] = r.stock_available;
        });
      }

      if (data.rateLimited) {
        return { success: totalSuccess > 0, error: 'Limite de requisi��es da API do Tiny atingido. Aguarde alguns minutos e tente novamente.' };
      }

      onProgress(Math.min(i + chunkSize, uniqueProducts.length), uniqueProducts.length);
    }

    if (totalSuccess === 0 && uniqueProducts.length > 0) {
      return { success: false, error: 'Token do Tiny inv�lido ou API bloqueada. Aguarde alguns minutos e verifique o token.' };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('[StockSync] Exception:', err);
    return { success: false, error: err?.message || 'Erro inesperado durante a sincroniza��o.' };
  }
}
