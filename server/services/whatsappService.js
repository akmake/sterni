import makeWASocket, { 
    useMultiFileAuthState, 
    DisconnectReason, 
    downloadMediaMessage 
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import nodemailer from 'nodemailer';
import qrcode from 'qrcode-terminal';

// --- הגדרות מערכת ---
const TARGET_EMAIL = process.env.TARGET_EMAIL_FOR_WHATSAPP; 

// הגדרת שירות המיילים (Transporter)
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export let sock;

// ==========================================
// === 🧠 המוח: פונקציות הפענוח שלך ===
// ==========================================

// --- חילוץ תוכן הודעה (טקסט/כיתוב) ---
const getMessageContent = (msg) => {
    if (!msg.message) return '';
    const m = msg.message;

    // 1. טקסט רגיל
    if (m.conversation) return m.conversation;
    
    // 2. הודעות מורחבות (תשובות/לינקים)
    if (m.extendedTextMessage && m.extendedTextMessage.text) return m.extendedTextMessage.text;

    // 3. מדיה עם כיתוב (תמונה/וידאו/מסמך)
    if (m.imageMessage && m.imageMessage.caption) return m.imageMessage.caption;
    if (m.videoMessage && m.videoMessage.caption) return m.videoMessage.caption;
    if (m.documentMessage && m.documentMessage.caption) return m.documentMessage.caption;

    return ''; 
};

// --- חילוץ מספר טלפון אמיתי (השיטה המדויקת) ---
const extractTruePhoneNumber = (msg) => {
    const key = msg.key;
    
    // 1. בדיקת מזהה אלטרנטיבי (לפעמים המספר מסתתר שם)
    if (key.remoteJidAlt && key.remoteJidAlt.includes('@s.whatsapp.net')) {
        return key.remoteJidAlt.replace(/\D/g, '');
    }
    // 2. בדיקת מזהה רגיל (תוך התעלמות מזהה LID טכני)
    if (key.remoteJid && !key.remoteJid.includes('@lid')) {
        return key.remoteJid.replace(/\D/g, '');
    }
    // 3. בדיקת משתתף בתוך קבוצה
    if (key.participant && key.participant.includes('@s.whatsapp.net')) {
        return key.participant.replace(/\D/g, '');
    }
    
    return ''; 
};

// ==========================================
// === 🔌 חיבור והאזנה (Baileys Logic) ===
// ==========================================

export const connectToWhatsApp = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // QR מטופל ידנית למטה
        logger: pino({ level: 'silent' }),
        browser: ['Zipori Server', 'Chrome', '1.0.0']
    });

    // שמירת אישורים (Tokens)
    sock.ev.on('creds.update', saveCreds);

    // ניהול מצב החיבור
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('QR RECEIVED - סרוק להתחברות:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting:', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ WhatsApp connected successfully!');
        }
    });

    // --- טיפול בהודעות נכנסות ---
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        
        // סינון: התעלמות מהודעות שלי, הודעות ריקות, וסטטוסים
        if (!m.message || m.key.fromMe || m.key.remoteJid === 'status@broadcast') return;

        try {
            // 1. חילוץ מספר הטלפון האמיתי ("המוח")
            const finalPhone = extractTruePhoneNumber(m);
            if (!finalPhone) return; 

            // 2. חילוץ תוכן הטקסט
            const textContent = getMessageContent(m);
            const senderJid = finalPhone; // המספר הנקי לשימוש בנושא המייל

            // 3. טיפול במדיה (כולל הקלטות)
            const messageType = Object.keys(m.message)[0];
            let attachments = [];

            if (['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage'].includes(messageType)) {
                
                const buffer = await downloadMediaMessage(
                    m, 
                    'buffer', 
                    {}, 
                    { logger: pino({ level: 'silent' }) }
                );

                let filename = 'file';
                if (messageType === 'imageMessage') filename = 'image.jpg';
                else if (messageType === 'videoMessage') filename = 'video.mp4';
                else if (messageType === 'audioMessage') filename = 'voice_note.ogg'; // הקלטה
                else if (messageType === 'documentMessage') filename = m.message.documentMessage.fileName || 'document.pdf';

                attachments.push({ filename, content: buffer });
            }

            // 4. שליחת המייל ללקוח
            if (textContent || attachments.length > 0) {
                
                // הוספת תאריך לנושא המייל -> יוצר שרשור יומי בג'ימייל
                const today = new Date().toLocaleDateString('he-IL').replace(/\./g, '/');
                
                // התאמת טקסט להקלטות קוליות
                const finalBodyText = textContent || (messageType === 'audioMessage' ? '[הודעה קולית]' : '');

                console.log(`📩 הודעה מ-${senderJid} (${messageType}). מעביר למייל...`);

                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: TARGET_EMAIL,
                    subject: `WA_MSG: ${senderJid} [${today}]`, // שרשור לפי מספר + תאריך
                    text: `הודעה מאת: ${m.pushName || 'Unknown'} (${senderJid})\n\n${finalBodyText}`,
                    attachments: attachments
                });
            }

        } catch (err) {
            console.error('Error processing incoming WhatsApp:', err);
        }
    });
};