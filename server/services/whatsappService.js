import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import NodeCache from 'node-cache';

import SystemConfig from '../models/SystemConfig.js';
import { sendOpsEmail } from './emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_FOLDER = path.join(__dirname, '../auth_info_baileys');

// ============================================================
// ===  STATE  ===
// ============================================================

export let sock = null;

let connectionState = 'disconnected'; // 'connected' | 'connecting' | 'disconnected'
let currentQRDataURL = null; // QR code כ-data URL לתצוגה בממשק
let reconnectLock = false;
let heartbeatInterval = null;
let lastEventTimestamp = Date.now();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 15;
const BASE_RECONNECT_DELAY = 3000;

// מונע עיבוד כפול של הודעות (Baileys שולח לפעמים פעמיים)
const msgCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// ============================================================
// ===  HUMAN-LIKE HELPERS  ===
// ============================================================

/**
 * דילייאנדומי — נותן תחושה שבן אדם מקליד
 * @param {number} min מילישניות מינימום
 * @param {number} max מילישניות מקסימום
 */
const humanDelay = (min = 800, max = 3000) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * סימולציית הקלדה — שולח "composing" ואז מחכה זמן שתלוי באורך ההודעה
 * @param {string} jid מזהה השיחה
 * @param {string} text הטקסט שעומד להישלח (לחישוב זמן הקלדה)
 */
const simulateTyping = async (jid, text = '') => {
    try {
        // סימון "online" + "מקליד..."
        await sock.presenceSubscribe(jid);
        await humanDelay(300, 800);
        await sock.sendPresenceUpdate('composing', jid);

        // זמן הקלדה לפי אורך — בן אדם מקליד בערך 40 תווים בשנייה
        const typingMs = Math.min(Math.max(text.length * 25, 1500), 8000);
        // מוסיפים jitter של ±30%
        const jitter = typingMs * (0.7 + Math.random() * 0.6);
        await new Promise(resolve => setTimeout(resolve, jitter));

        // מפסיקים את ה-"מקליד..."
        await sock.sendPresenceUpdate('paused', jid);
    } catch (e) {
        // לא קריטי — ממשיכים לשלוח גם אם ה-presence נכשל
    }
};

/**
 * שליחת הודעה "אנושית" — עם דילייואינדיקציית הקלדה
 * @param {string} jid מזהה השיחה
 * @param {object} content התוכן (אובייקט של Baileys)
 * @param {string} textForDelay הטקסט לחישוב זמן הקלדה
 */
export const sendMessageHuman = async (jid, content, textForDelay = '') => {
    // דילייראשוני קצר — כאילו בן אדם קורא את ההודעה לפני שמגיב
    await humanDelay(1000, 3000);

    // אם זה טקסט — מראים "מקליד..."
    if (content.text || content.caption) {
        await simulateTyping(jid, textForDelay || content.text || content.caption || '');
    } else {
        // אם זה קובץ/תמונה — דילייקצר בלבד (כאילו מחפשים את הקובץ)
        await humanDelay(1500, 4000);
    }

    // שולחים
    return await sock.sendMessage(jid, content);
};

// ============================================================
// ===  PUBLIC STATUS HELPERS  ===
// ============================================================

/** בדיקה אם החיבור חי — להשתמש לפני כל שליחה */
export const isConnected = () => {
    return connectionState === 'connected' && sock?.user;
};

/** סטטוס מפורט — לצורך endpoint מעקב */
export const getConnectionStatus = () => ({
    state: connectionState,
    user: sock?.user?.id || null,
    reconnectAttempts,
    lastActivity: new Date(lastEventTimestamp).toISOString()
});

/** מחזיר את ה-QR הנוכחי כ-data URL (null אם מחובר או לא זמין) */
export const getQRDataURL = () => currentQRDataURL;

// ============================================================
// ===  MESSAGE CONTENT EXTRACTION  ===
// ============================================================

const getMessageContent = (msg) => {
    if (!msg.message) return '';
    const m = msg.message;
    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.imageMessage?.caption) return m.imageMessage.caption;
    if (m.videoMessage?.caption) return m.videoMessage.caption;
    if (m.documentMessage?.caption) return m.documentMessage.caption;
    if (m.buttonsResponseMessage?.selectedDisplayText) return m.buttonsResponseMessage.selectedDisplayText;
    if (m.listResponseMessage?.title) return m.listResponseMessage.title;
    if (m.templateButtonReplyMessage?.selectedDisplayText) return m.templateButtonReplyMessage.selectedDisplayText;
    return '';
};

const getQuotedText = (msg) => {
    const context = msg.message?.extendedTextMessage?.contextInfo ||
                    msg.message?.imageMessage?.contextInfo ||
                    msg.message?.videoMessage?.contextInfo ||
                    msg.message?.audioMessage?.contextInfo ||
                    msg.message?.documentMessage?.contextInfo;

    if (!context?.quotedMessage) return null;
    const q = context.quotedMessage;

    if (q.conversation) return q.conversation;
    if (q.extendedTextMessage?.text) return q.extendedTextMessage.text;
    if (q.imageMessage?.caption) return q.imageMessage.caption;
    if (q.videoMessage?.caption) return q.videoMessage.caption;
    if (q.imageMessage) return '[תמונה]';
    if (q.audioMessage) return '[הודעה קולית]';
    if (q.videoMessage) return '[סרטון]';
    if (q.documentMessage) return '[קובץ]';
    return null;
};

export const extractTruePhoneNumber = (msg) => {
    const key = msg.key;
    if (key.remoteJidAlt?.includes('@s.whatsapp.net')) return key.remoteJidAlt.replace(/\D/g, '');
    if (key.remoteJid && !key.remoteJid.includes('@lid')) return key.remoteJid.replace(/\D/g, '');
    if (key.participant?.includes('@s.whatsapp.net')) return key.participant.replace(/\D/g, '');
    return '';
};

// ============================================================
// ===  RECONNECT LOGIC (Exponential Backoff)  ===
// ============================================================

const getReconnectDelay = () => {
    const exponential = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
    const maxDelay = 5 * 60 * 1000; // 5 דקות
    const delay = Math.min(exponential, maxDelay);
    const jitter = delay * Math.random() * 0.5;
    return delay + jitter;
};

const scheduleReconnect = (reason = 'unknown') => {
    if (reconnectLock) return;

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`🚫 ${MAX_RECONNECT_ATTEMPTS} ניסיונות reconnect נכשלו. עוצר.`);
        connectionState = 'disconnected';
        return;
    }

    const delay = getReconnectDelay();
    console.log(`🔄 Reconnect #${reconnectAttempts + 1} בעוד ${Math.round(delay / 1000)} שניות (סיבה: ${reason})`);

    setTimeout(() => connectToWhatsApp(), delay);
};

// ============================================================
// ===  HEARTBEAT — זיהוי "מוות שקט"  ===
// ============================================================

const touch = () => { lastEventTimestamp = Date.now(); };

const startHeartbeat = () => {
    stopHeartbeat();

    heartbeatInterval = setInterval(async () => {
        const silentMinutes = (Date.now() - lastEventTimestamp) / 1000 / 60;

        if (silentMinutes > 10) {
            console.warn(`💀 HEARTBEAT: שתיקה של ${Math.round(silentMinutes)} דקות`);

            try {
                if (sock?.user) {
                    await sock.sendPresenceUpdate('available');
                    await new Promise(resolve => setTimeout(resolve, 15000));

                    if ((Date.now() - lastEventTimestamp) / 1000 / 60 > 10) {
                        console.warn('💀 Ping לא עזר — force reconnect');
                        await forceReconnect('silent_death');
                    } else {
                        console.log('✅ Ping הצליח — חזרנו לחיים');
                    }
                } else {
                    await forceReconnect('no_user_in_heartbeat');
                }
            } catch (err) {
                console.error('💀 Heartbeat ping נכשל:', err.message);
                await forceReconnect('heartbeat_error');
            }
        }
    }, 2 * 60 * 1000); // כל 2 דקות

    console.log('💓 Heartbeat monitor הופעל');
};

const stopHeartbeat = () => {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
};

const forceReconnect = async (reason) => {
    if (reconnectLock) return;
    reconnectLock = true;

    stopHeartbeat();
    connectionState = 'disconnected';

    try { sock?.end(); } catch (e) { /* ok */ }
    sock = null;

    reconnectLock = false;
    reconnectAttempts++;
    scheduleReconnect(reason);
};

// ============================================================
// ===  INCOMING MESSAGE HANDLER  ===
// ============================================================

const handleIncomingMessage = async (m) => {
    if (!m.message || m.key.fromMe || m.key.remoteJid === 'status@broadcast') return;

    // מניעת כפילויות
    const msgId = m.key.id;
    if (msgCache.get(msgId)) return;
    msgCache.set(msgId, true);

    try {
        const config = await SystemConfig.findOne().sort({ createdAt: -1 });
        const TARGET_EMAIL = config?.targetWhatsAppEmail;
        if (!TARGET_EMAIL) return;

        const finalPhone = extractTruePhoneNumber(m);
        if (!finalPhone) return;

        const textContent = getMessageContent(m);
        const quotedContent = getQuotedText(m);
        const senderJid = finalPhone;
        const senderName = m.pushName || 'לא ידוע';

        // מסנן סוגי מפתחות פנימיים של Baileys שאינם סוגי הודעה אמיתיים
        const messageType = Object.keys(m.message).find(k =>
            !['messageContextInfo', 'senderKeyDistributionMessage'].includes(k)
        ) || Object.keys(m.message)[0];

        let attachments = [];

        if (['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage'].includes(messageType)) {
            try {
                const buffer = await downloadMediaMessage(m, 'buffer', {}, {
                    logger: pino({ level: 'silent' }),
                    reuploadRequest: sock
                });

                let filename = 'file';
                if (messageType === 'imageMessage') filename = `image_${Date.now()}.jpg`;
                else if (messageType === 'videoMessage') filename = `video_${Date.now()}.mp4`;
                else if (messageType === 'audioMessage') filename = `voice_${Date.now()}.ogg`;
                else if (messageType === 'documentMessage') {
                    filename = m.message.documentMessage.fileName || `document_${Date.now()}.pdf`;
                }
                attachments.push({ filename, content: buffer });
            } catch (dlErr) {
                console.error(`⚠️ שגיאה בהורדת מדיה (${messageType}):`, dlErr.message);
            }
        }

        if (textContent || attachments.length > 0) {
            const today = new Date().toLocaleDateString('he-IL').replace(/\./g, '/');
            let finalBodyText = textContent || (messageType === 'audioMessage' ? '[הודעה קולית]' : '');

            console.log(`📩 מעביר מייל מ-${senderName} (${finalPhone})`);

            let htmlContent = `<div dir="rtl" style="font-family: Arial; text-align: right;">`;

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

            htmlContent += `
                    <p style="font-size: 1.1em; color: #000;">
                        <strong>${senderName}:</strong><br>
                        ${finalBodyText.replace(/\n/g, '<br>')}
                    </p>
                </div>
            `;

            // שליחה עם retry (3 ניסיונות)
            let sent = false;
            for (let attempt = 0; attempt < 3 && !sent; attempt++) {
                try {
                    await sendOpsEmail(TARGET_EMAIL, `WA_MSG: ${senderJid} [${today}]`, htmlContent, attachments);
                    sent = true;
                } catch (emailErr) {
                    console.error(`❌ שליחת מייל נכשלה (${attempt + 1}/3):`, emailErr.message);
                    if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
                }
            }
        }
    } catch (err) {
        console.error('❌ Error processing incoming WhatsApp:', err);
    }
};

// ============================================================
// ===  MAIN CONNECTION  ===
// ============================================================

export const connectToWhatsApp = async () => {
    if (reconnectLock) {
        console.log('🔒 כבר בתהליך חיבור...');
        return;
    }
    reconnectLock = true;
    connectionState = 'connecting';

    try {
        if (!fs.existsSync(AUTH_FOLDER)) {
            fs.mkdirSync(AUTH_FOLDER, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        const { version } = await fetchLatestBaileysVersion();
        console.log(`📱 מתחבר ל-WhatsApp (פרוטוקול v${version.join('.')})`);

        sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            version,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            browser: ['Zipori Server', 'Chrome', '1.0.0'],
            defaultQueryTimeoutMs: 60_000,
            keepAliveIntervalMs: 30_000,
            retryRequestDelayMs: 2_000,
            connectTimeoutMs: 60_000,
            emitOwnEvents: false,
            markOnlineOnConnect: true,
            getMessage: async () => ({ conversation: '' })
        });

        // ─── CREDENTIALS ───
        sock.ev.on('creds.update', saveCreds);

        // ─── CONNECTION STATE ───
        sock.ev.on('connection.update', (update) => {
            touch();
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                qrcode.generate(qr, { small: true });
                console.log('📸 סרוק את ה-QR Code');
                QRCode.toDataURL(qr, { width: 300, margin: 2 })
                    .then(dataURL => { currentQRDataURL = dataURL; })
                    .catch(() => {});
            }

            if (connection === 'open') {
                console.log('✅ WhatsApp connected successfully!');
                connectionState = 'connected';
                currentQRDataURL = null;
                reconnectAttempts = 0;
                startHeartbeat();
            }

            if (connection === 'close') {
                stopHeartbeat();
                connectionState = 'disconnected';

                // ★ תיקון הבאג הקריטי — הקוד המקורי היה שבור כאן
                const error = lastDisconnect?.error;
                const statusCode = (error instanceof Boom)
                    ? error.output?.statusCode
                    : error?.output?.statusCode;

                const isLoggedOut = statusCode === DisconnectReason.loggedOut;
                const isRequiredRestart = statusCode === DisconnectReason.restartRequired;

                console.log(`🔌 חיבור נסגר | status: ${statusCode} | loggedOut: ${isLoggedOut}`);

                if (isLoggedOut) {
                    console.warn('⛔ Logged Out — מוחק session...');
                    try { fs.rmSync(AUTH_FOLDER, { recursive: true, force: true }); } catch (e) { /* ok */ }
                    reconnectAttempts = 0;
                    reconnectLock = false;
                    scheduleReconnect('logged_out');
                } else if (isRequiredRestart) {
                    console.log('🔁 WhatsApp ביקש restart');
                    reconnectAttempts = 0;
                    reconnectLock = false;
                    scheduleReconnect('restart_required');
                } else {
                    reconnectAttempts++;
                    reconnectLock = false;
                    scheduleReconnect(`close_${statusCode}`);
                }
                return;
            }
        });

        // ─── INCOMING MESSAGES ───
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            touch();
            if (type !== 'notify') return;
            for (const m of messages) {
                await handleIncomingMessage(m);
            }
        });

        // ─── HEARTBEAT TOUCH — כל אירוע מעדכן שהחיבור חי ───
        sock.ev.on('messages.update', () => touch());
        sock.ev.on('message-receipt.update', () => touch());
        sock.ev.on('presence.update', () => touch());
        sock.ev.on('chats.update', () => touch());
        sock.ev.on('contacts.update', () => touch());

        reconnectLock = false;

    } catch (err) {
        console.error('❌ שגיאה בחיבור ל-WhatsApp:', err.message);
        connectionState = 'disconnected';
        reconnectLock = false;
        reconnectAttempts++;
        scheduleReconnect('connection_error');
    }
};