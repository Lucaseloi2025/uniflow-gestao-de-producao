import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function test() {
  // Let's test querying order_stage_progress
  const { data, error } = await supabaseAdmin.from('order_stage_progress').select('*');
  console.log('order_stage_progress query result:', { data, error: error?.message });
}

test();
