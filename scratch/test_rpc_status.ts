import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dkyvzxmocppbydtpsgyu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXZ6eG1vY3BwYnlkdHBzZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzU0NDksImV4cCI6MjA4NzU1MTQ0OX0.2s2RJevOZr2Na0bigWqR5rxt5bNtB6GIS6-N_TlpFgk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRpc() {
  const tests = [
    { p_stage_id: null, p_stage_status: null },
    { p_stage_id: 1, p_stage_status: null },
    { p_stage_id: 1, p_stage_status: 'Pending' },
    { p_stage_id: 1, p_stage_status: 'Finished' },
    { p_stage_id: 1, p_stage_status: 'pendente' },
    { p_stage_id: 1, p_stage_status: 'finalizado' }
  ];

  for (const t of tests) {
    const { data, error } = await supabase.rpc('get_orders_with_stages', {
      p_search: null,
      p_stage_id: t.p_stage_id,
      p_stage_status: t.p_stage_status,
      p_product_type: null,
      p_print_type: null
    });
    console.log(`RPC stage_id=${t.p_stage_id}, stage_status=${t.p_stage_status} => count: ${data?.length}, error: ${error?.message || 'none'}`);
  }
}

testRpc();
