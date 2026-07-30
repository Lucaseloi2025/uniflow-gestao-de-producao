import { createClient } from '@supabase/supabase-js';

// Vite expõe variáveis de ambiente com prefixo VITE_ via import.meta.env.
// Fallback para as variáveis hardcoded do projeto para garantir funcionamento em produção.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string)
    || 'https://dkyvzxmocppbydtpsgyu.supabase.co';

const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string)
    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXZ6eG1vY3BwYnlkdHBzZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzU0NDksImV4cCI6MjA4NzU1MTQ0OX0.2s2RJevOZr2Na0bigWqR5rxt5bNtB6GIS6-N_TlpFgk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
