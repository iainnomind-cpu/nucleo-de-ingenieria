// Vercel Serverless Function: Enviar mensajes WhatsApp
// POST https://TU-DOMINIO.vercel.app/api/whatsapp-send
// Body:
//   { "to": "5215512345678", "type": "text", "text": "Hola..." }
//   { "to": "5215512345678", "type": "template", "template_name": "hello_world", "language": "es_MX", "variables": ["val1"] }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const GRAPH_API_VERSION = 'v21.0';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { to, type, text, template_name, language, variables, conversation_id, campaign_id } = req.body;

        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneNumberId = process.env.WHATSAPP_PHONE_ID;

        if (!accessToken || !phoneNumberId) {
            return res.status(500).json({
                success: false,
                message: 'Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_ID en las variables de entorno de Vercel.',
            });
        }

        if (!to) {
            return res.status(400).json({ success: false, message: 'El campo "to" es obligatorio' });
        }

        // Construir payload para Meta — normalizar teléfono mexicano
        let cleanPhone = to.replace(/\D/g, ''); // Quitar todo excepto dígitos
        // Si tiene 10 dígitos, es un número mexicano sin código de país → agregar 52
        if (cleanPhone.length === 10) {
            cleanPhone = '52' + cleanPhone;
        }
        // Si tiene 13 dígitos y empieza con 521, quitar el 1 intermedio (formato viejo móvil MX)
        if (cleanPhone.length === 13 && cleanPhone.startsWith('521')) {
            cleanPhone = '52' + cleanPhone.slice(3);
        }
        // Si empieza con 044 o 045 (prefijos viejos de celular MX), quitarlos y agregar 52
        if (cleanPhone.startsWith('044') || cleanPhone.startsWith('045')) {
            cleanPhone = '52' + cleanPhone.slice(3);
        }
        let metaPayload: any = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
        };

        if (type === 'template') {
            metaPayload.type = 'template';
            metaPayload.template = {
                name: template_name,
                language: { code: language || 'es_MX' },
            };
            if (variables && variables.length > 0) {
                metaPayload.template.components = [
                    {
                        type: 'body',
                        parameters: variables.map((v: string) => ({ type: 'text', text: v })),
                    },
                ];
            }
        } else {
            metaPayload.type = 'text';
            metaPayload.text = { preview_url: false, body: text || '' };
        }

        // Enviar a Meta
        const metaResponse = await fetch(
            `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
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
            const errorMsg = metaResult?.error?.message || 'Error al enviar mensaje';
            return res.status(400).json({ success: false, message: errorMsg, meta_error: metaResult?.error });
        }

        // Guardar en Supabase
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        );

        const waMessageId = metaResult?.messages?.[0]?.id || null;

        // Buscar o crear conversación
        let convId = conversation_id;
        if (!convId) {
            let { data: conv } = await supabase
                .from('wa_conversations')
                .select('id')
                .eq('phone_number', cleanPhone)
                .single();

            if (!conv) {
                const { data: newConv } = await supabase
                    .from('wa_conversations')
                    .insert({
                        phone_number: cleanPhone,
                        status: 'active',
                        last_message_at: new Date().toISOString(),
                        last_message_preview: text || `[Plantilla: ${template_name}]`,
                    })
                    .select('id')
                    .single();
                conv = newConv;
            } else {
                await supabase
                    .from('wa_conversations')
                    .update({
                        last_message_at: new Date().toISOString(),
                        last_message_preview: text || `[Plantilla: ${template_name}]`,
                    })
                    .eq('id', conv.id);
            }
            convId = conv?.id;
        }

        if (convId) {
            await supabase.from('wa_messages').insert({
                conversation_id: convId,
                direction: 'outbound',
                message_type: type === 'template' ? 'template' : 'text',
                content: text || `[Plantilla: ${template_name}]`,
                wa_message_id: waMessageId,
                status: 'sent',
                campaign_id: campaign_id || null,
                template_variables: variables || [],
            });
        }

        return res.status(200).json({
            success: true,
            wa_message_id: waMessageId,
            conversation_id: convId,
        });

    } catch (error) {
        console.error('Error inesperado:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
}
