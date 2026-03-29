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

        // Header (si aplica, por ahora soportamos TEXT en este endpoint)
        if (template.header_type === 'text' && template.header_content) {
            components.push({
                type: 'HEADER',
                format: 'TEXT',
                text: template.header_content
            });
        }
        // TODO: Para imágenes/documentos hace falta otro flujo de subida de Media a Meta primero.
        // Se deja preparado para el futuro.

        // Body
        const bodyComponent: any = {
            type: 'BODY',
            text: template.body
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
                // Usar el nombre que dio el usuario en DB, o un dummy string si le faltaron
                const varName = (template.variables && template.variables[i-1] && template.variables[i-1].length > 0) 
                    ? template.variables[i-1] 
                    : `ejemplo_variable_${i}`;
                examples.push(varName);
            }
            bodyComponent.example = {
                body_text: [ examples ]
            };
        }
        components.push(bodyComponent);

        // Footer
        if (template.footer) {
            components.push({
                type: 'FOOTER',
                text: template.footer
            });
        }

        const metaPayload = {
            name: template.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'), // Asegurar formato snake_case exigido por Meta
            language: template.language || 'es_MX',
            category: template.category.toUpperCase(), // Ej: UTILITY, MARKETING
            components: components
        };

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

        const { error: updateError } = await supabase
            .from('wa_templates')
            .update({ 
                meta_status: 'pending',
                meta_template_id: metaTemplateId
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
