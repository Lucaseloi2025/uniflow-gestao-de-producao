import { createClient } from '@supabase/supabase-js';

export function resolveSupabaseConfig(env: {
    PROD?: boolean;
    MODE?: string;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
}) {
    const isProd = Boolean(env.PROD || env.MODE === 'production');
    const url = env.VITE_SUPABASE_URL?.trim();
    const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

    if (isProd) {
        if (!url || !anonKey) {
            throw new Error(
                '[FATAL PRODUCTION CONFIG ERROR] VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem ser configuradas obrigatoriamente no ambiente de produção. Fallback para localhost é estritamente proibido em produção.'
            );
        }
        return { supabaseUrl: url, supabaseAnonKey: anonKey };
    }

    // Desenvolvimento / Testes locais
    return {
        supabaseUrl: url || 'http://127.0.0.1:54321',
        supabaseAnonKey: anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-anon-key-local-only',
    };
}

const config = resolveSupabaseConfig({
    PROD: (import.meta as any).env?.PROD,
    MODE: (import.meta as any).env?.MODE,
    VITE_SUPABASE_URL: ((import.meta as any).env?.VITE_SUPABASE_URL as string)?.trim(),
    VITE_SUPABASE_ANON_KEY: ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string)?.trim(),
});

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);


