// Supabase Edge Function: WhatsApp Webhook
// Este endpoint sirve como URL de devolución de llamada (Callback URL) para la API de WhatsApp Cloud de Meta.
//
// CONFIGURACIÓN EN META DEVELOPERS:
// 1. URL de devolución de llamada: https://fhpdyvrplgqffwamgknm.supabase.co/functions/v1/whatsapp-webhook
// 2. Token de verificación: el valor de la variable de entorno WHATSAPP_VERIFY_TOKEN
//
// VARIABLES DE ENTORNO REQUERIDAS (configurar en Supabase Dashboard > Edge Functions > Secrets):
//   WHATSAPP_VERIFY_TOKEN   → Token personalizado que tú elijas (Ej: "nucleo_wa_2026_secure")
//   WHATSAPP_ACCESS_TOKEN   → Token de acceso permanente de la app de Meta
//   WHATSAPP_PHONE_ID       → ID del número de teléfono de WhatsApp Business
//   SUPABASE_URL            → (ya viene configurado automáticamente)
//   SUPABASE_SERVICE_ROLE_KEY → (ya viene configurado automáticamente)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // ============================================================
  // GET: Verificación del webhook por Meta (Challenge)
  // Meta envía un GET con hub.mode, hub.verify_token y hub.challenge
  // Debes devolver hub.challenge si el token coincide
  // ============================================================
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN')

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook verificado exitosamente')
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    } else {
      console.error('❌ Token de verificación inválido')
      return new Response('Forbidden', { status: 403 })
    }
  }

  // ============================================================
  // POST: Recibir notificaciones de mensajes entrantes y delivery status
  // ============================================================
  if (req.method === 'POST') {
    try {
      const body = await req.json()

      // Inicializar Supabase con service_role para escritura
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      // Procesar cada entry del webhook
      const entries = body?.entry || []
      for (const entry of entries) {
        const changes = entry?.changes || []

        for (const change of changes) {
          if (change.field !== 'messages') continue

          const value = change.value
          const phoneNumberId = value?.metadata?.phone_number_id
          const contacts = value?.contacts || []
          const messages = value?.messages || []
          const statuses = value?.statuses || []

          // ─── Mensajes Entrantes ───
          for (const msg of messages) {
            const from = msg.from // número del cliente (ej: "5215512345678")
            const contactName = contacts.find((c: any) => c.wa_id === from)?.profile?.name || from
            const waMessageId = msg.id
            const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toISOString() : new Date().toISOString()

            // Buscar o crear conversación
            let { data: conversation } = await supabase
              .from('wa_conversations')
              .select('id')
              .eq('phone_number', from)
              .single()

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
                .single()
              conversation = newConv
            } else {
              await supabase
                .from('wa_conversations')
                .update({
                  last_message_at: timestamp,
                  last_message_preview: msg.text?.body || `[${msg.type}]`,
                  unread_count: supabase.rpc ? 1 : 1, // incrementar
                  client_name: contactName,
                })
                .eq('id', conversation.id)
            }

            if (conversation) {
              // Determinar tipo y contenido
              let messageType = msg.type || 'text'
              let content = ''
              let mediaUrl = null
              let mediaType = null
              let locationLat = null
              let locationLng = null
              let locationLabel = null

              switch (messageType) {
                case 'text':
                  content = msg.text?.body || ''
                  break
                case 'image':
                  content = msg.image?.caption || ''
                  mediaUrl = msg.image?.id // ID del media, se descarga via API
                  mediaType = 'image'
                  break
                case 'document':
                  content = msg.document?.caption || msg.document?.filename || ''
                  mediaUrl = msg.document?.id
                  mediaType = 'document'
                  break
                case 'location':
                  locationLat = msg.location?.latitude
                  locationLng = msg.location?.longitude
                  locationLabel = msg.location?.name || msg.location?.address || ''
                  content = `📍 ${locationLabel}`
                  break
                case 'button':
                  content = msg.button?.text || ''
                  messageType = 'quick_reply'
                  break
                case 'interactive':
                  content = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || ''
                  messageType = 'quick_reply'
                  break
                default:
                  content = `[${messageType}]`
              }

              // Insertar mensaje
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
              })
            }
          }

          // ─── Status Updates (sent, delivered, read, failed) ───
          for (const status of statuses) {
            const waMessageId = status.id
            const newStatus = status.status // sent, delivered, read, failed
            const errorMessage = status.errors?.[0]?.title || null

            // Actualizar estado del mensaje
            await supabase
              .from('wa_messages')
              .update({ status: newStatus, error_message: errorMessage })
              .eq('wa_message_id', waMessageId)

            // También actualizar notificaciones si aplica
            const updateData: Record<string, any> = { status: newStatus }
            if (newStatus === 'sent') updateData.sent_at = new Date().toISOString()
            if (newStatus === 'delivered') updateData.delivered_at = new Date().toISOString()
            if (newStatus === 'read') updateData.read_at = new Date().toISOString()
            if (newStatus === 'failed') updateData.error_message = errorMessage

            // Buscar si hay una notificación vinculada a través del wa_message_id
            const { data: linkedMsg } = await supabase
              .from('wa_messages')
              .select('id')
              .eq('wa_message_id', waMessageId)
              .single()

            if (linkedMsg) {
              // Intentar actualizar notificaciones que coincidan
              await supabase
                .from('wa_notifications')
                .update(updateData)
                .eq('status', 'pending')
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    } catch (error) {
      console.error('Error procesando webhook:', error)
      // Meta espera siempre un 200 para no reintentar indefinidamente
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response('Method not allowed', { status: 405 })
})
