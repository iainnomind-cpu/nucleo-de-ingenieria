import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const GRAPH_API_VERSION = 'v21.0';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const wabaId = process.env.WHATSAPP_WABA_ID;

        if (!accessToken || !wabaId) {
            return res.status(500).json({
                success: false,
                message: 'Faltan credenciales WHATSAPP_ACCESS_TOKEN o WHATSAPP_WABA_ID en Vercel'
            });
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ success: false, message: 'Falta configurar Supabase en Vercel' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Obtener todas las plantillas locales que NO están en draft (ya fueron enviadas a Meta)
        const { data: localTemplates, error: fetchError } = await supabase
            .from('wa_templates')
            .select('id, name, meta_template_id, meta_status, meta_name')
            .not('meta_status', 'eq', 'draft');

        if (fetchError) {
            return res.status(500).json({ success: false, message: 'Error leyendo plantillas locales' });
        }

        if (!localTemplates || localTemplates.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No hay plantillas enviadas a Meta para sincronizar',
                updated: 0
            });
        }

        // 2. Consultar TODAS las plantillas de Meta en una sola llamada
        const metaResponse = await fetch(
            `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates?limit=250`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        const metaResult = await metaResponse.json();

        if (!metaResponse.ok) {
            const errorMsg = metaResult?.error?.message || 'Error al consultar plantillas en Meta';
            console.error('Error Meta API:', JSON.stringify(metaResult));
            return res.status(400).json({ success: false, message: errorMsg, meta_error: metaResult?.error });
        }

        const metaTemplates: Array<{ id: string; name: string; status: string; language: string }> = metaResult.data || [];

        // 3. Mapear por nombre (snake_case normalizado) y por meta_template_id
        const metaByName = new Map<string, { status: string; metaName: string }>();
        const metaById = new Map<string, { status: string; metaName: string }>();

        for (const mt of metaTemplates) {
            const normalizedStatus = mt.status.toLowerCase(); // APPROVED → approved, REJECTED → rejected, PENDING → pending
            const entry = { status: normalizedStatus, metaName: mt.name };
            metaByName.set(mt.name.toLowerCase(), entry);
            metaById.set(mt.id, entry);
        }

        // 4. Actualizar cada plantilla local cuyo estado difiera del de Meta
        let updated = 0;
        const details: Array<{ name: string; from: string; to: string }> = [];

        for (const local of localTemplates) {
            // Intentar buscar por meta_template_id primero, luego por nombre normalizado
            let metaEntry: { status: string; metaName: string } | undefined;

            if (local.meta_template_id) {
                metaEntry = metaById.get(local.meta_template_id);
            }
            if (!metaEntry) {
                const normalizedName = local.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                metaEntry = metaByName.get(normalizedName);
            }

            if (metaEntry && (metaEntry.status !== local.meta_status || metaEntry.metaName !== local.meta_name)) {
                const updatePayload: Record<string, string> = {};
                if (metaEntry.status !== local.meta_status) {
                    updatePayload.meta_status = metaEntry.status;
                }
                // Always sync the exact Meta name so sending uses the correct identifier
                if (metaEntry.metaName !== local.meta_name) {
                    updatePayload.meta_name = metaEntry.metaName;
                }

                const { error: updateError } = await supabase
                    .from('wa_templates')
                    .update(updatePayload)
                    .eq('id', local.id);

                if (!updateError) {
                    updated++;
                    details.push({
                        name: local.name,
                        from: local.meta_status,
                        to: metaEntry.status
                    });
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: updated > 0
                ? `Se actualizaron ${updated} plantilla(s)`
                : 'Todas las plantillas ya están sincronizadas',
            updated,
            details
        });

    } catch (error) {
        console.error('Error inesperado:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
}
