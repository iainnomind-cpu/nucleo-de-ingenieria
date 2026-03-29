import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' }); // Mismo env que Vite

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Tratamos de usar la service role, si no está, usamos la anon
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan credenciales VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearData() {
  console.log('⏳ Eliminando datos de encuestas...');
  await supabase.from('wa_surveys').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log('⏳ Eliminando notificaciones operativas...');
  await supabase.from('wa_notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('⏳ Eliminando mensajes...');
  await supabase.from('wa_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('⏳ Eliminando conversaciones...');
  await supabase.from('wa_conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('⏳ Eliminando pasos de campañas...');
  await supabase.from('wa_campaign_steps').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('⏳ Eliminando campañas...');
  await supabase.from('wa_campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('✅ ¡Limpieza completada! Se ha borrado todo el historial de prueba del módulo.');
  console.log('✅ Las plantillas se han conservado intactas.');
}

clearData().catch(console.error);
