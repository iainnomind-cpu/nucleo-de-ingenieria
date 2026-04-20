import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    const repairId = 'd28a6c43-a7e8-46ff-9105-890bd6bc75fb';
    
    // Test update status to pickup_pending
    const { data, error } = await supabase.from('equipment_repairs')
        .update({ status: 'pickup_pending' })
        .eq('id', repairId)
        .select();

    if (error) {
        console.error('PATCH ERROR DETAILS:', JSON.stringify(error, null, 2));
    } else {
        console.log('PATCH SUCCESS:', data);
    }
}

test();
