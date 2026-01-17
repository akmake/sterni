import makeWASocket, { 
    useMultiFileAuthState, 
    DisconnectReason, 
    downloadMediaMessage 
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import SystemConfig from '../models/SystemConfig.js'; 
import { sendOpsEmail } from './emailService.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_FOLDER = path.join(__dirname, '../auth_info_baileys');

export let sock;

// === פונקציות עזר לחילוץ תוכן ===

// 1. חילוץ הטקסט של ההודעה הנוכחית
const getMessageContent = (msg) => {
    if (!msg.message) return '';
    const m = msg.message;
    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage && m.extendedTextMessage.text) return m.extendedTextMessage.text;
    if (m.imageMessage && m.imageMessage.caption) return m.imageMessage.caption;
    if (m.videoMessage && m.videoMessage.caption) return m.videoMessage.caption;
    if (m.documentMessage && m.documentMessage.caption) return m.documentMessage.caption;
    return ''; 
};

// 2. חילוץ הטקסט של ההודעה *שצוטטה* (החדש!)
const getQuotedText = (msg) => {
    // בדיקה אם יש בכלל הקשר (Context)
    const context = msg.message?.extendedTextMessage?.contextInfo || 
                    msg.message?.imageMessage?.contextInfo || 
                    msg.message?.videoMessage?.contextInfo ||
                    msg.message?.audioMessage?.contextInfo;

    if (!context || !context.quotedMessage) return null;

    const q = context.quotedMessage;
    
    // מנסים לחלץ טקסט מתוך הציטוט (יכול להיות טקסט, או כיתוב על תמונה)
    if (q.conversation) return q.conversation;
    if (q.extendedTextMessage?.text) return q.extendedTextMessage.text;
    if (q.imageMessage?.caption) return q.imageMessage.caption;
    if (q.videoMessage?.caption) return q.videoMessage.caption;
    
    // אם צוטטה תמונה/הודעה קולית בלי טקסט
    if (q.imageMessage) return '[תמונה]';
    if (q.audioMessage) return '[הודעה קולית]';
    if (q.videoMessage) return '[סרטון]';
    if (q.documentMessage) return '[קובץ]';

    return null;
};

const extractTruePhoneNumber = (msg) => {
    const key = msg.key;
    if (key.remoteJidAlt && key.remoteJidAlt.includes('@s.whatsapp.net')) return key.remoteJidAlt.replace(/\D/g, '');
    if (key.remoteJid && !key.remoteJid.includes('@lid')) return key.remoteJid.replace(/\D/g, '');
    if (key.participant && key.participant.includes('@s.whatsapp.net')) return key.participant.replace(/\D/g, '');
    return ''; 
};

export const connectToWhatsApp = async () => {
    if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Zipori Server', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ WhatsApp connected successfully!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe || m.key.remoteJid === 'status@broadcast') return;

        try {
            // שולפים את המייל המעודכן ביותר
            const config = await SystemConfig.findOne().sort({ createdAt: -1 }); 
            const TARGET_EMAIL = config?.targetWhatsAppEmail;

            if (!TARGET_EMAIL) return;

            const finalPhone = extractTruePhoneNumber(m);
            if (!finalPhone) return; 

            const textContent = getMessageContent(m);
            const quotedContent = getQuotedText(m); // <--- שולפים את הציטוט כאן

            const senderJid = finalPhone; 
            const senderName = m.pushName || 'לא ידוע';

            const messageType = Object.keys(m.message)[0];
            let attachments = [];

            if (['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage'].includes(messageType)) {
                const buffer = await downloadMediaMessage(m, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                let filename = 'file';
                if (messageType === 'imageMessage') filename = 'image.jpg';
                else if (messageType === 'videoMessage') filename = 'video.mp4';
                else if (messageType === 'audioMessage') filename = 'voice_note.ogg';
                else if (messageType === 'documentMessage') filename = m.message.documentMessage.fileName || 'document.pdf';
                attachments.push({ filename, content: buffer });
            }

            // שולחים מייל אם יש טקסט, קובץ, או ציטוט
            if (textContent || attachments.length > 0) {
                const today = new Date().toLocaleDateString('he-IL').replace(/\./g, '/');
                
                let finalBodyText = textContent || (messageType === 'audioMessage' ? '[הודעה קולית]' : '');

                console.log(`📩 מעביר מייל מ-${senderName} (${finalPhone})`);

                // --- בניית ה-HTML המעוצב ---
                let htmlContent = `<div dir="rtl" style="font-family: Arial; text-align: right;">`;
                
                // הוספת בלוק ציטוט אם קיים
                if (quotedContent) {
                    htmlContent += `
                        <div style="
                            background-color: #f0f0f0; 
                            border-right: 5px solid #25D366; 
                            padding: 8px 12px; 
                            margin-bottom: 12px; 
                            color: #555; 
                            border-radius: 4px;
                            font-size: 0.9em;">
                            <strong>הודעה שצוטטה:</strong><br>
                            ${quotedContent.replace(/\n/g, '<br>')}
                        </div>
                    `;
                }

                // הוספת ההודעה החדשה
                htmlContent += `
                        <p style="font-size: 1.1em; color: #000;">
                            <strong>${senderName}:</strong><br>
                            ${finalBodyText.replace(/\n/g, '<br>')}
                        </p>
                    </div>
                `;

                await sendOpsEmail(
                    TARGET_EMAIL, 
                    `WA_MSG: ${senderJid} [${today}]`,
                    htmlContent, // שולחים את ה-HTML המעוצב
                    attachments 
                );
            }

        } catch (err) {
            console.error('Error processing incoming WhatsApp:', err);
        }
    });
};