// Script para aplicar la migración de warehouse_equipment en Supabase
// node apply_warehouse_migration.mjs

import { createClient } from '@supabase/supabase-js';

const url = 'https://fhpdyvrplgqffwamgknm.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGR5dnJwbGdxZmZ3YW1na25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjIzNTIsImV4cCI6MjA4NzEzODM1Mn0.ol6oF7XT78difgj9xstV_WyWXXnfbT_vPFs9qQstgNM';
const supabase = createClient(url, key);

// Check if table exists
const { data, error } = await supabase.from('warehouse_equipment').select('id').limit(1);
if (!error) {
  console.log('✅ Table warehouse_equipment already exists!');
  const { data: rows } = await supabase.from('warehouse_equipment').select('name');
  console.log('Equipment count:', rows?.length || 0);
  rows?.forEach(r => console.log(' -', r.name));
} else {
  console.log('❌ Table missing:', error.message);
  console.log('👉 Please run the SQL migration in Supabase dashboard SQL Editor');
}
