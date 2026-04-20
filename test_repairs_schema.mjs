import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    const { data, error } = await supabase.from('equipment_repairs').select('*').limit(1);
    if (error) {
        console.error('Error fetching repairs:', error);
    } else {
        if (data.length > 0) {
            console.log('Columns:', Object.keys(data[0]));
        } else {
            console.log('No data, cannot deduce columns this way. Trying to insert an empty record to get column errors...');
            const { error: err2 } = await supabase.from('equipment_repairs').insert({}).select();
            console.log('Insert error details:', err2);
        }
    }
}

test();
