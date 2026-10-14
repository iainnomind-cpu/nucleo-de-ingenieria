// Aplicar migración: campos de contacto del cliente en reparaciones
// node apply_repairs_contact.mjs

const url = 'https://fhpdyvrplgqffwamgknm.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGR5dnJwbGdxZmZ3YW1na25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjIzNTIsImV4cCI6MjA4NzEzODM1Mn0.ol6oF7XT78difgj9xstV_WyWXXnfbT_vPFs9qQstgNM';

const statements = [
  `ALTER TABLE equipment_repairs ADD COLUMN IF NOT EXISTS client_phone TEXT`,
  `ALTER TABLE equipment_repairs ADD COLUMN IF NOT EXISTS client_email TEXT`,
  `ALTER TABLE equipment_repairs ADD COLUMN IF NOT EXISTS pickup_deadline_date DATE`,
];

async function run() {
  for (const sql of statements) {
    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ sql_text: sql })
    });
    const label = sql.trim().substring(0, 80);
    if (!res.ok) {
      const body = await res.text();
      if (body.includes('already exists') || body.includes('duplicate') || body.includes('column') && body.includes('exists')) {
        console.log(`⚠️  Ya existe (OK): ${label}`);
      } else {
        console.log(`❌ Error: ${label}\n   ${body.substring(0, 300)}`);
      }
    } else {
      console.log(`✅ OK: ${label}`);
    }
  }
  console.log('\n✨ Migración completada!');
}

run().catch(console.error);
