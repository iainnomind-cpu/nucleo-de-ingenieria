import type { VercelRequest, VercelResponse } from '@vercel/node';

const GRAPH_API_VERSION = 'v21.0';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { to, base64Pdf, filename, caption } = req.body;

        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneId = process.env.WHATSAPP_PHONE_ID;

        if (!accessToken || !phoneId) {
            return res.status(500).json({ success: false, message: 'Faltan credenciales WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_ID' });
        }

        if (!to || !base64Pdf) {
            return res.status(400).json({ success: false, message: '"to" y "base64Pdf" son obligatorios' });
        }

        // Normalizar teléfono mexicano
        let cleanPhone = to.replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = '52' + cleanPhone;
        if (cleanPhone.length === 13 && cleanPhone.startsWith('521')) cleanPhone = '52' + cleanPhone.slice(3);
        if (cleanPhone.startsWith('044') || cleanPhone.startsWith('045')) cleanPhone = '52' + cleanPhone.slice(3);
        
        // 1. Decodificar Base64 a Buffer
        const base64Data = base64Pdf.replace(/^data:application\/pdf;base64,/, '');
        const fileBuffer = Buffer.from(base64Data, 'base64');
        
        // 2. Subir Archivo a Meta usando FormData
        // Nota: En runtime de Node/Vercel nativo FormData está disponible
        const formData = new FormData();
        const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
        formData.append('file', fileBlob, filename || 'Cotizacion.pdf');
        formData.append('type', 'application/pdf');
        formData.append('messaging_product', 'whatsapp');

        const uploadResponse = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/media`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
            body: formData,
        });

        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok || !uploadResult.id) {
            console.error('Error Meta Upload Media:', JSON.stringify(uploadResult));
            const errorMsg = uploadResult?.error?.message || uploadResult?.error?.error_user_msg || 'Error al subir PDF a Meta';
            return res.status(400).json({ success: false, message: errorMsg, phase: 'upload' });
        }

        const mediaId = uploadResult.id;

        // 3. Enviar el Documento al Chat
        const metaPayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'document',
            document: {
                id: mediaId,
                caption: caption || 'Te adjuntamos tu cotización',
                filename: filename || 'Cotizacion.pdf'
            }
        };

        const sendResponse = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(metaPayload),
        });

        const sendResult = await sendResponse.json();

        if (!sendResponse.ok) {
            console.error('Error Meta Send Message:', JSON.stringify(sendResult));
            const errorMsg = sendResult?.error?.message || sendResult?.error?.error_user_title || 'Error al enviar documento WhatsApp';
            return res.status(400).json({ success: false, message: errorMsg, phase: 'send' });
        }

        return res.status(200).json({ success: true, messageId: sendResult?.messages?.[0]?.id });

    } catch (error: any) {
        console.error('Error WhatsApp Send Quote:', error);
        return res.status(500).json({ success: false, message: error.message || 'Error interno del servidor en envío WhatsApp' });
    }
}
