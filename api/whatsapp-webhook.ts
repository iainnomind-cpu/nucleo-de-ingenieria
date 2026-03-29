// Vercel Serverless Function: WhatsApp Webhook
// URL de devolución de llamada: https://TU-DOMINIO-VERCEL.vercel.app/api/whatsapp-webhook
//
// VARIABLES DE ENTORNO (configurar en Vercel Dashboard > Settings > Environment Variables):
//   WHATSAPP_VERIFY_TOKEN   → Token personalizado que tú elijas
//   WHATSAPP_ACCESS_TOKEN   → Token de acceso permanente de la app de Meta
//   WHATSAPP_PHONE_ID       → ID del número de teléfono de WhatsApp Business
//   VITE_SUPABASE_URL       → URL de tu proyecto Supabase (ya la tienes)
//   SUPABASE_SERVICE_ROLE_KEY → Service Role Key de Supabase (Dashboard > Settings > API)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // ============================================================
    // GET: Verificación del webhook por Meta (Challenge)
    // ============================================================
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'] as string;
        const token = req.query['hub.verify_token'] as string;
        const challenge = req.query['hub.challenge'] as string;

        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

        if (mode === 'subscribe' && token === verifyToken) {
            console.log('✅ Webhook verificado exitosamente');
            return res.status(200).send(challenge);
        } else {
            console.error('❌ Token de verificación inválido');
            return res.status(403).send('Forbidden');
        }
    }

    // ============================================================
    // POST: Recibir mensajes entrantes y status updates
    // ============================================================
    if (req.method === 'POST') {
        try {
            const body = req.body;

            const supabase = createClient(
                process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
                process.env.SUPABASE_SERVICE_ROLE_KEY || '',
            );

            const entries = body?.entry || [];
            for (const entry of entries) {
                const changes = entry?.changes || [];

                for (const change of changes) {
                    if (change.field !== 'messages') continue;

                    const value = change.value;
                    const contacts = value?.contacts || [];
                    const messages = value?.messages || [];
                    const statuses = value?.statuses || [];

                    // ─── Mensajes Entrantes ───
                    for (const msg of messages) {
                        const from = msg.from;
                        const contactName = contacts.find((c: any) => c.wa_id === from)?.profile?.name || from;
                        const waMessageId = msg.id;
                        const timestamp = msg.timestamp
                            ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
                            : new Date().toISOString();

                        // Buscar o crear conversación
                        let { data: conversation } = await supabase
                            .from('wa_conversations')
                            .select('id')
                            .eq('phone_number', from)
                            .single();

                        if (!conversation) {
                            const { data: newConv } = await supabase
                                .from('wa_conversations')
                                .insert({
                                    phone_number: from,
                                    client_name: contactName,
                                    status: 'active',
                                    last_message_at: timestamp,
                                    last_message_preview: msg.text?.body || `[${msg.type}]`,
                                    unread_count: 1,
                                })
                                .select('id')
                                .single();
                            conversation = newConv;
                        } else {
                            await supabase
                                .from('wa_conversations')
                                .update({
                                    last_message_at: timestamp,
                                    last_message_preview: msg.text?.body || `[${msg.type}]`,
                                    unread_count: 1,
                                    client_name: contactName,
                                })
                                .eq('id', conversation.id);
                        }

                        if (conversation) {
                            let messageType = msg.type || 'text';
                            let content = '';
                            let mediaUrl = null;
                            let mediaType = null;
                            let locationLat = null;
                            let locationLng = null;
                            let locationLabel = null;

                            switch (messageType) {
                                case 'text':
                                    content = msg.text?.body || '';
                                    break;
                                case 'image':
                                    content = msg.image?.caption || '';
                                    mediaUrl = msg.image?.id;
                                    mediaType = 'image';
                                    break;
                                case 'document':
                                    content = msg.document?.caption || msg.document?.filename || '';
                                    mediaUrl = msg.document?.id;
                                    mediaType = 'document';
                                    break;
                                case 'location':
                                    locationLat = msg.location?.latitude;
                                    locationLng = msg.location?.longitude;
                                    locationLabel = msg.location?.name || msg.location?.address || '';
                                    content = `📍 ${locationLabel}`;
                                    break;
                                case 'button':
                                    content = msg.button?.text || '';
                                    messageType = 'quick_reply';
                                    break;
                                case 'interactive':
                                    content = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
                                    messageType = 'quick_reply';
                                    break;
                                default:
                                    content = `[${messageType}]`;
                            }

                            await supabase.from('wa_messages').insert({
                                conversation_id: conversation.id,
                                direction: 'inbound',
                                message_type: messageType,
                                content,
                                media_url: mediaUrl,
                                media_type: mediaType,
                                wa_message_id: waMessageId,
                                status: 'delivered',
                                location_lat: locationLat,
                                location_lng: locationLng,
                                location_label: locationLabel,
                            });
                        }
                    }

                    // ─── Status Updates ───
                    for (const status of statuses) {
                        const waMessageId = status.id;
                        const newStatus = status.status;
                        const errorMessage = status.errors?.[0]?.title || null;

                        await supabase
                            .from('wa_messages')
                            .update({ status: newStatus, error_message: errorMessage })
                            .eq('wa_message_id', waMessageId);

                        const updateData: Record<string, any> = { status: newStatus };
                        if (newStatus === 'sent') updateData.sent_at = new Date().toISOString();
                        if (newStatus === 'delivered') updateData.delivered_at = new Date().toISOString();
                        if (newStatus === 'read') updateData.read_at = new Date().toISOString();
                        if (newStatus === 'failed') updateData.error_message = errorMessage;
                    }
                }
            }

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error procesando webhook:', error);
            return res.status(200).json({ error: 'Internal error' });
        }
    }

    return res.status(405).send('Method not allowed');
}
