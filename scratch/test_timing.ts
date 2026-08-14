import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dkyvzxmocppbydtpsgyu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXZ6eG1vY3BwYnlkdHBzZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzU0NDksImV4cCI6MjA4NzU1MTQ0OX0.2s2RJevOZr2Na0bigWqR5rxt5bNtB6GIS6-N_TlpFgk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTiming() {
  console.time('RPC get_orders_with_stages');
  const { data, error } = await supabase.rpc('get_orders_with_stages', {
    p_search: null,
    p_stage_id: null,
    p_stage_status: null,
    p_product_type: null,
    p_print_type: null
  });
  console.timeEnd('RPC get_orders_with_stages');
  console.log('Orders returned:', data?.length, 'Error:', error);
}

testTiming();
