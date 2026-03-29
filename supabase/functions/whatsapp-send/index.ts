// Supabase Edge Function: Enviar mensajes de WhatsApp
// Maneja el envío de mensajes de texto libre y mensajes con plantillas aprobadas por Meta.
//
// POST /functions/v1/whatsapp-send
// Body:
//   { "to": "5215512345678", "type": "text", "text": "Hola, ..." }
//   { "to": "5215512345678", "type": "template", "template_name": "hello_world", "language": "es_MX", "variables": ["valor1", "valor2"] }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GRAPH_API_VERSION = 'v21.0'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()
    const { to, type, text, template_name, language, variables, conversation_id, campaign_id } = body

    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_ID')

    if (!accessToken || !phoneNumberId) {
      return new Response(JSON.stringify({ success: false, message: 'WhatsApp no configurado. Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_ID.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!to) {
      return new Response(JSON.stringify({ success: false, message: 'El campo "to" es obligatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Construir payload para la API de Meta
    let metaPayload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''), // Limpiar número
    }

    if (type === 'template') {
      // Mensaje con plantilla aprobada
      metaPayload.type = 'template'
      metaPayload.template = {
        name: template_name,
        language: { code: language || 'es_MX' },
      }
      // Agregar variables si existen
      if (variables && variables.length > 0) {
        metaPayload.template.components = [
          {
            type: 'body',
            parameters: variables.map((v: string) => ({
              type: 'text',
              text: v,
            })),
          },
        ]
      }
    } else {
      // Mensaje de texto libre (solo dentro de ventana de 24h)
      metaPayload.type = 'text'
      metaPayload.text = { preview_url: false, body: text || '' }
    }

    // Enviar a la API de Meta
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
    )

    const metaResult = await metaResponse.json()

    if (!metaResponse.ok) {
      const errorMsg = metaResult?.error?.message || 'Error al enviar mensaje'
      console.error('Error Meta API:', JSON.stringify(metaResult))
      return new Response(JSON.stringify({ success: false, message: errorMsg, meta_error: metaResult?.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Guardar mensaje en la base de datos
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const waMessageId = metaResult?.messages?.[0]?.id || null

    // Buscar o crear conversación
    let convId = conversation_id
    if (!convId) {
      const cleanPhone = to.replace(/\D/g, '')
      let { data: conv } = await supabase
        .from('wa_conversations')
        .select('id')
        .eq('phone_number', cleanPhone)
        .single()

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
          .single()
        conv = newConv
      } else {
        await supabase
          .from('wa_conversations')
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: text || `[Plantilla: ${template_name}]`,
          })
          .eq('id', conv.id)
      }
      convId = conv?.id
    }

    // Insertar mensaje outbound
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
      })
    }

    return new Response(JSON.stringify({
      success: true,
      wa_message_id: waMessageId,
      conversation_id: convId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error inesperado:', error)
    return new Response(JSON.stringify({ success: false, message: 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
