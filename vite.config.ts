import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', '');

  // Validação estrita para build de produção:
  // Termina imediatamente com exit code 1 antes de gerar dist/ se faltar VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY
  const isProd = mode === 'production' || command === 'build';
  if (isProd) {
    const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnon = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      console.error('\n================================================================================');
      console.error('❌ ERRO FATAL DE BUILD DE PRODUÇÃO: VARIÁVEIS DE AMBIENTE SUPABASE AUSENTES');
      console.error('As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias para build de produção.');
      console.error('O build de produção foi abortado com código não-zero antes de gerar o diretório dist/.');
      console.error('================================================================================\n');
      process.exit(1);
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
