import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase.from('app_users').select('id, full_name, is_active');
    console.log('Users:', data);
    
    if (data && data.length > 0) {
        // Try to update one
        const u = data[0];
        console.log(`Trying to update user ${u.full_name}...`);
        const { error: updErr } = await supabase.from('app_users').update({ is_active: !u.is_active }).eq('id', u.id);
        if (updErr) {
            console.error('Update Error:', updErr);
        } else {
            console.log('Update Success!');
        }
    }
}
test();
