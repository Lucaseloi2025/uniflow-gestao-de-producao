import { supabase } from './supabase';
import { TechnicalProductRegistry } from '../types';

let localRegistryCache: TechnicalProductRegistry[] = [];
let cacheLoaded = false;

export async function fetchTechnicalRegistry(): Promise<TechnicalProductRegistry[]> {
  if (cacheLoaded) return localRegistryCache;

  try {
    const { data, error } = await supabase
      .from('technical_product_registry')
      .select('*');

    if (error) {
      console.error('Error fetching technical registry:', error);
      return [];
    }

    localRegistryCache = data || [];
    cacheLoaded = true;
    return localRegistryCache;
  } catch (err) {
    console.error('Exception fetching technical registry:', err);
    return [];
  }
}

export function getCachedRegistryItem(skuBase: string): TechnicalProductRegistry | undefined {
  return localRegistryCache.find(r => r.sku_base === skuBase);
}

export async function saveTechnicalRegistry(entry: TechnicalProductRegistry): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('technical_product_registry')
      .upsert({
        sku_base: entry.sku_base,
        product_type: entry.product_type,
        fabric: entry.fabric,
        color: entry.color,
        tipo_tecido: entry.tipo_tecido || 'RAMADO',
        largura_util: entry.largura_util || '1,60 m',
        updated_at: new Date().toISOString()
      }, { onConflict: 'sku_base' });

    if (error) {
      console.error('Error saving technical registry:', error);
      return false;
    }

    // Update local cache
    const existingIndex = localRegistryCache.findIndex(r => r.sku_base === entry.sku_base);
    if (existingIndex >= 0) {
      localRegistryCache[existingIndex] = { ...localRegistryCache[existingIndex], ...entry };
    } else {
      localRegistryCache.push(entry);
    }
    return true;
  } catch (err) {
    console.error('Exception saving technical registry:', err);
    return false;
  }
}
