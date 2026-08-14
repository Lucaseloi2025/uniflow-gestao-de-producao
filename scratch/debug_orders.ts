import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dkyvzxmocppbydtpsgyu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXZ6eG1vY3BwYnlkdHBzZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzU0NDksImV4cCI6MjA4NzU1MTQ0OX0.2s2RJevOZr2Na0bigWqR5rxt5bNtB6GIS6-N_TlpFgk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debug() {
  console.log('--- 1. Querying raw orders table ---');
  const { data: rawOrders, error: rawErr } = await supabase.from('orders').select('*');
  console.log('Raw orders count:', rawOrders?.length, 'Error:', rawErr);

  if (rawOrders && rawOrders.length > 0) {
    console.log('Sample raw orders status:', rawOrders.map(o => ({
      id: o.id,
      number: o.order_number,
      client: o.client_name,
      status: o.status
    })));
  }

  console.log('\n--- 2. Querying get_orders_with_stages RPC ---');
  const { data: rpcOrders, error: rpcErr } = await supabase.rpc('get_orders_with_stages', {
    p_search: null,
    p_stage_id: null,
    p_stage_status: null,
    p_product_type: null,
    p_print_type: null
  });
  console.log('RPC orders count:', rpcOrders?.length, 'Error:', rpcErr);

  if (rpcOrders && rpcOrders.length > 0) {
    console.log('Sample RPC order statuses:', rpcOrders.map((o: any) => ({
      id: o.id,
      number: o.order_number,
      client: o.client_name,
      status: o.status
    })));
  }
}

debug();
