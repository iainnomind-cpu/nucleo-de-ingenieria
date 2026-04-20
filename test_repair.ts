import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({path: '.env.local'});

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function test() {
    // 1. Get an equipment ID
    const { data: eqList, error: err1 } = await supabase.from('installed_equipment').select('*').limit(1);
    if (!eqList || eqList.length === 0) { console.log('No equipment found'); return; }
    
    const eq = eqList[0];
    console.log('Using equipment:', eq.id);

    // 2. Try to insert
    const { data: repair, error } = await supabase.from('equipment_repairs').insert({
        equipment_id: eq.id,
        client_id: eq.client_id || null,
        failure_description: 'Prueba de insercion de falla',
        failure_type: 'other',
        urgency: 'normal',
        reported_by: 'Test Bot',
        pickup_method: 'pickup',
        pickup_location: null,
        pickup_date: null,
        external_provider: null,
        shipping_carrier_to: null,
        assigned_to: null,
        status: 'reported',
    }).select().single();

    if (error) {
        console.error('INSERT ERROR:', error);
    } else {
        console.log('INSERT SUCCESS:', repair);
    }
}

test();
