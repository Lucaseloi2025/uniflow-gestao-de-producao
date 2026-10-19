import { describe, it, expect } from 'vitest';
import { resolveSupabaseConfig } from '../src/lib/supabase';

describe('Auditoria V7 — Item 5: Configuração do Frontend e Proibição de Fallback Local em Produção', () => {
  it('deve lançar erro fatal na inicialização de produção quando VITE_SUPABASE_URL estiver vazia ou ausente', () => {
    expect(() => {
      resolveSupabaseConfig({
        PROD: true,
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_ANON_KEY: 'valid-anon-key-123',
      });
    }).toThrowError(/\[FATAL PRODUCTION CONFIG ERROR\]/);

    expect(() => {
      resolveSupabaseConfig({
        MODE: 'production',
        VITE_SUPABASE_URL: undefined,
        VITE_SUPABASE_ANON_KEY: 'valid-anon-key-123',
      });
    }).toThrowError(/\[FATAL PRODUCTION CONFIG ERROR\]/);
  });

  it('deve lançar erro fatal na inicialização de produção quando VITE_SUPABASE_ANON_KEY estiver vazia ou ausente', () => {
    expect(() => {
      resolveSupabaseConfig({
        PROD: true,
        VITE_SUPABASE_URL: 'https://real-proj.supabase.co',
        VITE_SUPABASE_ANON_KEY: '',
      });
    }).toThrowError(/\[FATAL PRODUCTION CONFIG ERROR\]/);

    expect(() => {
      resolveSupabaseConfig({
        MODE: 'production',
        VITE_SUPABASE_URL: 'https://real-proj.supabase.co',
        VITE_SUPABASE_ANON_KEY: '   ',
      });
    }).toThrowError(/\[FATAL PRODUCTION CONFIG ERROR\]/);
  });

  it('deve inicializar com sucesso em produção quando ambas as variáveis forem fornecidas', () => {
    const config = resolveSupabaseConfig({
      PROD: true,
      VITE_SUPABASE_URL: 'https://valid-prod-supabase.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'ey-prod-jwt-anon-token-123',
    });

    expect(config.supabaseUrl).toBe('https://valid-prod-supabase.supabase.co');
    expect(config.supabaseAnonKey).toBe('ey-prod-jwt-anon-token-123');
  });

  it('deve preservar o fallback local para desenvolvimento e testes quando as variáveis não forem informadas', () => {
    const devConfig = resolveSupabaseConfig({
      PROD: false,
      MODE: 'development',
    });

    expect(devConfig.supabaseUrl).toBe('http://127.0.0.1:54321');
    expect(devConfig.supabaseAnonKey).toContain('mock-anon-key-local-only');
  });

  it('deve usar as variáveis fornecidas em desenvolvimento se elas estiverem configuradas', () => {
    const customDevConfig = resolveSupabaseConfig({
      PROD: false,
      MODE: 'development',
      VITE_SUPABASE_URL: 'http://localhost:8000',
      VITE_SUPABASE_ANON_KEY: 'custom-dev-key',
    });

    expect(customDevConfig.supabaseUrl).toBe('http://localhost:8000');
    expect(customDevConfig.supabaseAnonKey).toBe('custom-dev-key');
  });
});
