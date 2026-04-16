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
        const { template_id } = req.body;
        
        if (!template_id) {
            return res.status(400).json({ success: false, message: 'Falta el template_id' });
        }

        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const wabaId = process.env.WHATSAPP_WABA_ID;

        if (!accessToken || !wabaId) {
            return res.status(500).json({ 
                success: false, 
                message: 'Faltan credenciales WHATSAPP_ACCESS_TOKEN o WHATSAPP_WABA_ID en Vercel' 
            });
        }

        // Inicializar Supabase (usamos Service Role para asegurar permisos de escritura seguros desde el backend)
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        
        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ success: false, message: 'Falta configurar Supabase en Vercel' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Obtener la plantilla de la base de datos
        const { data: template, error: fetchError } = await supabase
            .from('wa_templates')
            .select('*')
            .eq('id', template_id)
            .single();

        if (fetchError || !template) {
            return res.status(404).json({ success: false, message: 'Plantilla no encontrada en la base de datos' });
        }

        if (template.meta_status !== 'draft' && template.meta_status !== 'rejected') {
            return res.status(400).json({ success: false, message: 'Solo puedes enviar plantillas en borrador o rechazadas' });
        }

        // 2. Construir el payload para Meta Graph API
        const components: any[] = [];

        // Helper: strip emojis (Meta rejects emojis in HEADER text)
        const stripEmojis = (str: string) => str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim();

        // Header (si aplica, por ahora soportamos TEXT en este endpoint)
        if (template.header_type === 'text' && template.header_content) {
            const cleanHeader = stripEmojis(template.header_content);
            if (cleanHeader) {
                components.push({
                    type: 'HEADER',
                    format: 'TEXT',
                    text: cleanHeader
                });
            }
        }
        // TODO: Para imágenes/documentos hace falta otro flujo de subida de Media a Meta primero.

        // Body — Meta rechaza bodies que terminan con una variable {{N}}
        let bodyText = template.body;
        // Si el body termina con {{N}} (opcionalmente seguido de puntuación), agregar texto después
        if (/\{\{\d+\}\}[.,;:!?\s]*$/.test(bodyText.trim())) {
            bodyText = bodyText.trimEnd().replace(/([.,;:!?\s]*)$/, '') + '.';
        }
        const bodyComponent: any = {
            type: 'BODY',
            text: bodyText
        };

        // Contar el número real de variables únicas {{1}}, {{2}} presentes en el cuerpo
        const bodyMatches = template.body.match(/\{\{(\d+)\}\}/g);
        let highestVarCount = 0;
        if (bodyMatches) {
            bodyMatches.forEach((m: string) => {
                const num = parseInt(m.replace(/[^0-9]/g, ''), 10);
                if (num > highestVarCount) highestVarCount = num;
            });
        }

        // Meta exige un array de ejemplos con exactamente la misma cantidad de variables encontradas en el body
        if (highestVarCount > 0) {
            const examples = [];
            for (let i = 1; i <= highestVarCount; i++) {
                let exampleVal = `Ejemplo_${i}`; // default fallback (no spaces, no accents)
                // Usar example_values si está configurado en BD
                if (template.example_values && template.example_values.length >= i) {
                    exampleVal = template.example_values[i-1];
                } else if (template.variables && template.variables.length >= i) {
                    exampleVal = template.variables[i-1];
                }
                examples.push(exampleVal);
            }
            bodyComponent.example = {
                body_text: [ examples ]
            };
        }
        components.push(bodyComponent);

        // Footer — Meta rejects some special characters in footer
        if (template.footer) {
            const cleanFooter = stripEmojis(template.footer).trim();
            if (cleanFooter) {
                components.push({
                    type: 'FOOTER',
                    text: cleanFooter
                });
            }
        }

        // Normalize name: Meta requires lowercase a-z, 0-9, underscore only.
        // No leading/trailing underscores. No consecutive underscores.
        const metaTemplateName = template.name
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')       // collapse consecutive underscores
            .replace(/^_|_$/g, '');     // remove leading/trailing underscores

        const metaPayload = {
            name: metaTemplateName,
            language: template.language || 'es_MX',
            category: template.category.toUpperCase(), // Ej: UTILITY, MARKETING
            components: components
        };

        console.log('[Template Submit] Payload to Meta:', JSON.stringify(metaPayload, null, 2));

        // 3. Enviar a Meta Cloud API
        const metaResponse = await fetch(
            `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(metaPayload),
            }
        );

        const metaResult = await metaResponse.json();

        if (!metaResponse.ok) {
            const errorMsg = metaResult?.error?.message || 'Error al enviar plantilla a Meta';
            console.error('Error Meta API:', JSON.stringify(metaResult));
            return res.status(400).json({ success: false, message: errorMsg, meta_error: metaResult?.error });
        }

        // 4. Si fue exitoso, actualizar el registro en Supabase a "pending"
        const metaTemplateId = metaResult.id;

        const metaName = metaPayload.name; // The exact snake_case name sent to Meta
        const { error: updateError } = await supabase
            .from('wa_templates')
            .update({ 
                meta_status: 'pending',
                meta_template_id: metaTemplateId,
                meta_name: metaName,
            })
            .eq('id', template_id);

        if (updateError) {
            console.error('Error actualizando Supabase:', updateError);
            return res.status(500).json({ success: false, message: 'Se envió a Meta, pero falló la actualización local' });
        }

        return res.status(200).json({
            success: true,
            message: 'Plantilla enviada exitosamente a revisión',
            meta_template_id: metaTemplateId
        });

    } catch (error) {
        console.error('Error inesperado:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
}
