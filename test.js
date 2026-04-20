const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vykrtvrmvydkrcxomjmw.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('wa_templates').select('id, name, created_at, usage_type').order('created_at', {ascending: false}).limit(5);
  console.log(data);
}
check();
