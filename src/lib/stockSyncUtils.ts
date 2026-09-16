import { supabase } from './supabase';
import type { StockCache } from '../types';

let localStockCache: StockCache = {};
let cacheLoaded = false;

export async function fetchLocalStockCache(): Promise<StockCache> {
  if (cacheLoaded) return localStockCache;
  try {
    const { data, error } = await supabase.from('tiny_stock_cache').select('id_produto, stock_available');
    if (error) {
      console.error('Error fetching stock cache:', error);
      return {};
    }
    localStockCache = {};
    (data || []).forEach(row => {
      localStockCache[row.id_produto] = row.stock_available;
    });
    cacheLoaded = true;
    return localStockCache;
  } catch (err) {
    console.error('Exception fetching stock cache:', err);
    return {};
  }
}

export async function syncStockForProducts(
  token: string, 
  products: { id_produto: string; sku: string }[],
  onProgress: (current: number, total: number) => void
): Promise<boolean> {
  const chunkSize = 10;
  const uniqueProducts = Array.from(new Map(products.map(p => [p.id_produto, p])).values()).filter(p => p.id_produto);
  
  if (uniqueProducts.length === 0) return true;

  try {
    for (let i = 0; i < uniqueProducts.length; i += chunkSize) {
      const chunk = uniqueProducts.slice(i, i + chunkSize);
      
      const promises = chunk.map(async (prod) => {
        try {
          const url = `https://api.tiny.com.br/api2/produto.obter.estoque.php?token=${token}&id=${prod.id_produto}&formato=json`;
          const res = await fetch(url, { method: "POST" });
          const text = await res.text();
          
          let saldo = 0;
          try {
            const json = JSON.parse(text);
            if (json.retorno && json.retorno.produto && json.retorno.produto.saldo !== undefined) {
              saldo = parseFloat(json.retorno.produto.saldo);
            } else if (text.includes('<saldo>')) {
              const m = text.match(/<saldo>(.*?)<\/saldo>/);
              if (m) saldo = parseFloat(m[1]);
            }
          } catch(e) {
             const m = text.match(/<saldo>(.*?)<\/saldo>/);
             if (m) saldo = parseFloat(m[1]);
          }

          return {
            id_produto: prod.id_produto,
            sku: prod.sku,
            stock_available: isNaN(saldo) ? 0 : saldo
          };
        } catch (err) {
          console.error(`Failed to fetch stock for ${prod.id_produto}`, err);
          return null;
        }
      });

      const results = await Promise.all(promises);
      const validResults = results.filter(r => r !== null) as any[];

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
          });
        } else {
          console.error('Error saving stock cache batch:', error);
        }
      }

      onProgress(Math.min(i + chunkSize, uniqueProducts.length), uniqueProducts.length);
      // Small delay to avoid API rate limit
      await new Promise(r => setTimeout(r, 500));
    }
    return true;
  } catch (err) {
    console.error('Exception syncing stock:', err);
    return false;
  }
}
