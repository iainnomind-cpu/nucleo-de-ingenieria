import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('wa_templates').select('id, name, created_at, usage_type').order('created_at', {ascending: false}).limit(5);
  console.log('DATA:', data);
  if (error) console.error('ERROR:', error);
}
check();
