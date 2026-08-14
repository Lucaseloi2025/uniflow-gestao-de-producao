import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dkyvzxmocppbydtpsgyu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXZ6eG1vY3BwYnlkdHBzZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzU0NDksImV4cCI6MjA4NzU1MTQ0OX0.2s2RJevOZr2Na0bigWqR5rxt5bNtB6GIS6-N_TlpFgk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFilters() {
  console.log('Testing RPC with various stage_id / stage_status...');
  
  // Test 1: stage_id 1, stage_status null
  const { data: d1 } = await supabase.rpc('get_orders_with_stages', {
    p_search: null,
    p_stage_id: 1,
    p_stage_status: null,
    p_product_type: null,
    p_print_type: null
  });
  console.log('Filter stage_id=1, status=null count:', d1?.length);

  // Test 2: stage_id 1, stage_status 'em_andamento'
  const { data: d2 } = await supabase.rpc('get_orders_with_stages', {
    p_search: null,
    p_stage_id: 1,
    p_stage_status: 'em_andamento',
    p_product_type: null,
    p_print_type: null
  });
  console.log('Filter stage_id=1, status=em_andamento count:', d2?.length);

  // Test 3: stage_id 1, stage_status 'pendente'
  const { data: d3 } = await supabase.rpc('get_orders_with_stages', {
    p_search: null,
    p_stage_id: 1,
    p_stage_status: 'pendente',
    p_product_type: null,
    p_print_type: null
  });
  console.log('Filter stage_id=1, status=pendente count:', d3?.length);
}

testFilters();
