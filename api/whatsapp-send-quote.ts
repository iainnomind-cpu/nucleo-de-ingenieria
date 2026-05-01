// ═══════════════════════════════════════════════════════════════════
// Vercel Serverless: Enviar Cotización por WhatsApp (Plantilla Meta)
// ═══════════════════════════════════════════════════════════════════
// Usa la plantilla "cotizacion_descarga_pdf" que incluye la URL de
// descarga directa del PDF. El PDF se sube a Supabase Storage y
// la URL pública se pasa como variable {{6}} de la plantilla.
// ═══════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const GRAPH_API_VERSION = 'v21.0';
const TEMPLATE_NAME = 'cotizacion_descarga_pdf';
const PDF_BUCKET = 'quote-pdfs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const {
            to,
            base64Pdf,
            filename,
            // Variables de la plantilla Meta
            client_name,
            quote_number,
            total,
            description,
            estimated_days,
        } = req.body;

        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneId = process.env.WHATSAPP_PHONE_ID;
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

        if (!accessToken || !phoneId) {
            return res.status(500).json({ success: false, message: 'Faltan credenciales WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_ID' });
        }
        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ success: false, message: 'Faltan credenciales de Supabase (URL o SERVICE_ROLE_KEY)' });
        }
        if (!to || !quote_number) {
            return res.status(400).json({ success: false, message: '"to" y "quote_number" son obligatorios' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // ── Normalizar teléfono mexicano ──
        let cleanPhone = to.replace(/\D/g, '');
        if (cleanPhone.startsWith('044') || cleanPhone.startsWith('045')) cleanPhone = cleanPhone.slice(3);
        if (cleanPhone.length === 10) cleanPhone = '52' + cleanPhone;
        if (cleanPhone.length === 13 && cleanPhone.startsWith('521')) cleanPhone = '52' + cleanPhone.slice(3);

        // ══════════════════════════════════════════════════
        // PASO 1: Subir PDF a Supabase Storage
        // ══════════════════════════════════════════════════
        let pdfPublicUrl = '';
        const pdfFilename = filename || `${quote_number}.pdf`;

        if (base64Pdf) {
            // Extraer el base64 de manera segura, sin importar si incluye 'filename=...' en el data URI
            const base64Data = base64Pdf.includes(',') ? base64Pdf.split(',')[1] : base64Pdf;
            const fileBuffer = Buffer.from(base64Data, 'base64');
            const storagePath = `${quote_number}/${pdfFilename}`;

            const { error: uploadError } = await supabase.storage
                .from(PDF_BUCKET)
                .upload(storagePath, fileBuffer, {
                    contentType: 'application/pdf',
                    upsert: true,
                });

            if (uploadError) {
                console.error('Error subiendo PDF a Storage:', uploadError);
                return res.status(500).json({ 
                    success: false, 
                    message: `Error al subir el PDF a Storage: ${uploadError.message}`,
                    phase: 'upload' 
                });
            }

            const { data: urlData } = supabase.storage.from(PDF_BUCKET).getPublicUrl(storagePath);
            pdfPublicUrl = urlData.publicUrl;
            console.log('✅ PDF subido a Storage:', pdfPublicUrl);
        } else {
            return res.status(400).json({ 
                success: false, 
                message: 'El PDF (base64Pdf) es obligatorio para generar la URL de descarga' 
            });
        }

        // ══════════════════════════════════════════════════
        // PASO 2: Enviar plantilla con URL de descarga
        // ══════════════════════════════════════════════════
        // Plantilla: cotizacion_descarga_pdf (es_MX)
        // Variables:  {{1}}=client_name  {{2}}=quote_number
        //             {{3}}=total  {{4}}=description  
        //             {{5}}=estimated_days  {{6}}=pdf_url
        const metaPayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'template',
            template: {
                name: TEMPLATE_NAME,
                language: { code: 'es_MX' },
                components: [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: client_name || 'Cliente' },
                            { type: 'text', text: quote_number },
                            { type: 'text', text: total || '$0.00' },
                            { type: 'text', text: description || 'Servicio de ingeniería' },
                            { type: 'text', text: String(estimated_days || '10') },
                            { type: 'text', text: pdfPublicUrl },
                        ],
                    },
                ],
            },
        };

        const sendResponse = await fetch(
            `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(metaPayload),
            }
        );

        const sendResult = await sendResponse.json();

        if (!sendResponse.ok) {
            console.error('Error Meta Send Template:', JSON.stringify(sendResult));
            const errorMsg = sendResult?.error?.message || sendResult?.error?.error_user_title || 'Error al enviar plantilla WhatsApp';
            return res.status(400).json({ success: false, message: errorMsg, phase: 'send_template' });
        }

        const waMessageId = sendResult?.messages?.[0]?.id;

        // ══════════════════════════════════════════════════
        // PASO 3: Registrar conversación y mensaje
        // ══════════════════════════════════════════════════
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
                    client_name: client_name || '',
                    status: 'active',
                    last_message_at: new Date().toISOString(),
                    last_message_preview: `[Cotización ${quote_number}]`,
                })
                .select('id')
                .single();
            conv = newConv;
        } else {
            await supabase.from('wa_conversations').update({
                last_message_at: new Date().toISOString(),
                last_message_preview: `[Cotización ${quote_number}]`,
            }).eq('id', conv.id);
        }

        // Guardar registro del mensaje
        if (conv) {
            await supabase.from('wa_messages').insert({
                conversation_id: conv.id,
                direction: 'outbound',
                message_type: 'template',
                content: `[Plantilla: ${TEMPLATE_NAME}] Cotización ${quote_number} — ${total} — PDF: ${pdfPublicUrl}`,
                wa_message_id: waMessageId,
                status: 'sent',
                media_url: pdfPublicUrl,
                media_type: 'document',
                template_variables: [client_name, quote_number, total, description, String(estimated_days), pdfPublicUrl],
            });
        }

        return res.status(200).json({
            success: true,
            messageId: waMessageId,
            pdfUrl: pdfPublicUrl,
            conversation_id: conv?.id,
        });

    } catch (error: any) {
        console.error('Error WhatsApp Send Quote:', error);
        return res.status(500).json({ success: false, message: error.message || 'Error interno del servidor' });
    }
}
