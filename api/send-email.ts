import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { to, subject, html, attachments } = req.body;

        const gmailUser = process.env.GMAIL_USER || 'ia.innomind@gmail.com'; // Fallback a tu correo o env si tú lo defines
        const gmailPass = process.env.GMAIL_APP_PASSWORD;

        if (!gmailPass) {
            return res.status(500).json({ success: false, message: 'Falta la credencial GMAIL_APP_PASSWORD en Vercel' });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: gmailUser,
                pass: gmailPass,
            },
        });

        // Procesar adjuntos (React envía 'data:application/pdf;base64,...')
        const processedAttachments = attachments ? attachments.map((att: any) => {
            if (typeof att.content === 'string' && att.content.startsWith('data:')) {
                const base64Data = att.content.split(',')[1];
                return {
                    filename: att.filename,
                    content: Buffer.from(base64Data, 'base64')
                };
            }
            return att;
        }) : [];

        const info = await transporter.sendMail({
            from: `"Núcleo ERP" <${gmailUser}>`,
            to,
            subject,
            html,
            attachments: processedAttachments
        });

        return res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error: any) {
        console.error('Error enviando correo SMTP:', error);
        return res.status(500).json({ success: false, message: error.message || 'Error interno al conectar a Gmail' });
    }
}
