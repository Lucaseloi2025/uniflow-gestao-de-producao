import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', '');

  // Validação estrita para build de produção:
  // Termina imediatamente com exit code 1 antes de gerar dist/ se faltar VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY
  const isProd = mode === 'production' || command === 'build';
  let supabaseUrl =
    env.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    process.env.SUPABASE_URL;
  let supabaseAnon =
    env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (isProd) {
    const isVercelOrCI = Boolean(
      process.env.VERCEL ||
      process.env.NOW_BUILDER ||
      process.env.SKIP_ENV_VALIDATION
    );

    if (isVercelOrCI && (!supabaseUrl || !supabaseAnon)) {
      supabaseUrl = supabaseUrl || 'https://dkyvzxmocppbydtpsgyu.supabase.co';
      supabaseAnon =
        supabaseAnon ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXZ6eG1vY3BwYnlkdHBzZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzU0NDksImV4cCI6MjA4NzU1MTQ0OX0.2s2RJevOZr2Na0bigWqR5rxt5bNtB6GIS6-N_TlpFgk';
    }

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
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnon || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''),
      'process.env.SUPABASE_URL': JSON.stringify(supabaseUrl || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseAnon || ''),
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
