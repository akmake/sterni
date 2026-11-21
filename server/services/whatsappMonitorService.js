import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import NodeCache from 'node-cache';

import WhatsAppMessage from '../models/WhatsAppMessage.js';
import WhatsAppChat from '../models/WhatsAppChat.js';

// ============================================================
// ===  CONFIG / PATHS  ===
// ============================================================
// חיבור נפרד לחלוטין מ-whatsappService.js (בוט המייל).
// תיקיית auth ותיקיית מדיה ייעודיות כדי לא לגעת בחיבור הקיים.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_FOLDER = path.join(__dirname, '../auth_info_monitor');
// מדיה נשמרת מחוץ ל-/uploads (שמוגש סטטית וללא auth) — רק דרך route מאובטח
const MEDIA_DIR = path.join(__dirname, '../storage/wa-monitor');

// ============================================================
// ===  STATE  ===
// ============================================================

let sock = null;
let connectionState = 'disconnected'; // 'connected' | 'connecting' | 'disconnected'
let currentQRDataURL = null;
let reconnectLock = false;
let reconnectAttempts = 0;
let ioRef = null;
const MAX_RECONNECT_ATTEMPTS = 15;
const BASE_RECONNECT_DELAY = 3000;

// מונע עיבוד כפול של אותה הודעה בזמן אמת
const msgCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// ============================================================
// ===  IO ATTACH  ===
// ============================================================

/** מחברים את מופע ה-Socket.IO (נקרא מ-app.js אחרי יצירת io) */
export const attachMonitorIo = (io) => { ioRef = io; };

const emitToAdmins = (event, payload) => {
    try { ioRef?.to('admins').emit(event, payload); } catch (_) { /* best-effort */ }
};

// ============================================================
// ===  PUBLIC STATUS HELPERS  ===
// ============================================================

export const getMonitorStatus = () => ({
    state: connectionState,
    user: sock?.user?.id || null,
    reconnectAttempts,
});

export const getMonitorQR = () => currentQRDataURL;

// ============================================================
// ===  MESSAGE CONTENT EXTRACTION  ===
// ============================================================

const TYPE_MAP = {
    imageMessage: 'image',
    videoMessage: 'video',
    audioMessage: 'audio',
    documentMessage: 'document',
    stickerMessage: 'sticker',
};

const getMessageType = (m) => {
    if (!m.message) return 'other';
    const keys = Object.keys(m.message).filter(
        k => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(k)
    );
    const key = keys[0];
    if (!key) return 'other';
    if (TYPE_MAP[key]) return TYPE_MAP[key];
    if (key === 'conversation' || key === 'extendedTextMessage') return 'text';
    return 'other';
};

const getMessageContent = (msg) => {
    if (!msg.message) return '';
    const m = msg.message;
    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.imageMessage?.caption) return m.imageMessage.caption;
    if (m.videoMessage?.caption) return m.videoMessage.caption;
    if (m.documentMessage?.caption) return m.documentMessage.caption;
    return '';
};

const getQuotedText = (msg) => {
    const m = msg.message || {};
    const context = m.extendedTextMessage?.contextInfo ||
                    m.imageMessage?.contextInfo ||
                    m.videoMessage?.contextInfo ||
                    m.audioMessage?.contextInfo ||
                    m.documentMessage?.contextInfo;
    if (!context?.quotedMessage) return null;
    const q = context.quotedMessage;
    if (q.conversation) return q.conversation;
    if (q.extendedTextMessage?.text) return q.extendedTextMessage.text;
    if (q.imageMessage) return q.imageMessage.caption || '[תמונה]';
    if (q.videoMessage) return q.videoMessage.caption || '[סרטון]';
    if (q.audioMessage) return '[הודעה קולית]';
    if (q.documentMessage) return '[קובץ]';
    return null;
};

const extensionFor = (type, mime, fileName) => {
    if (type === 'image') return mime?.includes('png') ? 'png' : 'jpg';
    if (type === 'video') return 'mp4';
    if (type === 'audio') return 'ogg';
    if (type === 'sticker') return 'webp';
    if (type === 'document') {
        const ext = fileName && path.extname(fileName).replace('.', '');
        return ext || 'bin';
    }
    return 'bin';
};

// ============================================================
// ===  STORE  ===
// ============================================================

const ensureMediaDir = () => {
    if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
};

/**
 * שומר הודעה בודדת (משני הכיוונים) + מעדכן את סיכום השיחה.
 * @param {object} m       אובייקט ההודעה של Baileys
 * @param {boolean} live   true = הודעה חיה (notify) → מורידים מדיה ודוחפים סוקט
 */
const storeMessage = async (m, live) => {
    try {
        if (!m.message || !m.key?.id) return;

        const remoteJid = m.key.remoteJid || '';
        // רק שיחות אישיות (לא קבוצות, לא סטטוס/שידור)
        if (!remoteJid.endsWith('@s.whatsapp.net')) return;
        if (remoteJid === 'status@broadcast') return;

        const messageId = m.key.id;

        // מניעת כפל-עיבוד בזמן אמת (Baileys שולח לפעמים פעמיים)
        if (live) {
            if (msgCache.get(messageId)) return;
            msgCache.set(messageId, true);
        }

        const fromMe = !!m.key.fromMe;
        const phone = remoteJid.replace(/\D/g, '');
        const type = getMessageType(m);
        const text = getMessageContent(m);
        const quotedText = getQuotedText(m);
        const senderName = m.pushName || '';
        const tsSeconds = Number(m.messageTimestamp) || Math.floor(Date.now() / 1000);
        const timestamp = new Date(tsSeconds * 1000);

        const isMediaType = ['image', 'video', 'audio', 'document', 'sticker'].includes(type);

        const doc = {
            messageId,
            chatJid: remoteJid,
            phone,
            fromMe,
            senderName,
            type,
            text,
            quotedText,
            timestamp,
        };

        // ── מדיה ── מורידים רק בהודעות חיות (היסטוריה ישנה — מפתחות פגים, נשמר כמטא-דאטה)
        if (isMediaType) {
            const node = m.message.imageMessage || m.message.videoMessage ||
                         m.message.audioMessage || m.message.documentMessage ||
                         m.message.stickerMessage;
            doc.mediaMime = node?.mimetype || '';
            doc.fileName = node?.fileName || '';
            doc.durationSeconds = node?.seconds || 0;

            if (live) {
                try {
                    ensureMediaDir();
                    const buffer = await downloadMediaMessage(m, 'buffer', {}, {
                        logger: pino({ level: 'silent' }),
                        reuploadRequest: sock,
                    });
                    const ext = extensionFor(type, doc.mediaMime, doc.fileName);
                    const safeName = `${messageId.replace(/[^A-Za-z0-9_-]/g, '')}.${ext}`;
                    fs.writeFileSync(path.join(MEDIA_DIR, safeName), buffer);
                    doc.mediaPath = safeName;
                } catch (dlErr) {
                    doc.mediaUnavailable = true;
                    console.error(`⚠️ [WA-Monitor] הורדת מדיה נכשלה (${type}):`, dlErr.message);
                }
            } else {
                doc.mediaUnavailable = true;
            }
        }

        // upsert לפי messageId — מחזיר אם זו הודעה חדשה
        const res = await WhatsAppMessage.updateOne(
            { messageId },
            { $set: doc },
            { upsert: true }
        );
        const isNew = res.upsertedCount > 0;

        // ── עדכון סיכום השיחה ──
        const preview = text || (
            type === 'image' ? '📷 תמונה' :
            type === 'video' ? '🎥 סרטון' :
            type === 'audio' ? '🎤 הודעה קולית' :
            type === 'document' ? '📎 קובץ' :
            type === 'sticker' ? 'מדבקה' : ''
        );

        const chatSet = {
            jid: remoteJid,
            phone,
            lastMessageText: preview,
            lastMessageAt: timestamp,
            lastFromMe: fromMe,
        };
        // שם השיחה — רק מהודעה נכנסת עם pushName (לא לדרוס בשם שלנו)
        const chatUpdate = { $set: chatSet };
        if (!fromMe && senderName) chatSet.name = senderName;
        if (isNew) chatUpdate.$inc = { messageCount: 1 };

        // לא לדרוס lastMessage אם כבר יש הודעה חדשה יותר (חשוב בסנכרון היסטוריה)
        await WhatsAppChat.updateOne(
            { jid: remoteJid, $or: [{ lastMessageAt: null }, { lastMessageAt: { $lte: timestamp } }] },
            chatUpdate,
            { upsert: true }
        ).catch(async (e) => {
            // אם ה-upsert נכשל בגלל תנאי ה-$or (קיים עם זמן חדש יותר) — רק נדאג שהשיחה קיימת
            await WhatsAppChat.updateOne(
                { jid: remoteJid },
                { $setOnInsert: { jid: remoteJid, phone }, ...(isNew ? { $inc: { messageCount: 1 } } : {}) },
                { upsert: true }
            ).catch(() => {});
        });

        // ── דחיפה חיה לפאנל ──
        if (live && isNew) {
            emitToAdmins('wa-monitor:message', {
                messageId,
                chatJid: remoteJid,
                phone,
                fromMe,
                senderName,
                type,
                text,
                quotedText,
                mediaPath: doc.mediaPath || null,
                mediaMime: doc.mediaMime || '',
                fileName: doc.fileName || '',
                durationSeconds: doc.durationSeconds || 0,
                mediaUnavailable: !!doc.mediaUnavailable,
                timestamp: timestamp.toISOString(),
            });
        }
    } catch (err) {
        console.error('❌ [WA-Monitor] שגיאה בשמירת הודעה:', err.message);
    }
};

// ============================================================
// ===  RECONNECT  ===
// ============================================================

const getReconnectDelay = () => {
    const exp = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
    const delay = Math.min(exp, 5 * 60 * 1000);
    return delay + delay * Math.random() * 0.5;
};

const scheduleReconnect = (reason) => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`🚫 [WA-Monitor] עצירה אחרי ${reconnectAttempts} ניסיונות reconnect`);
        connectionState = 'disconnected';
        return;
    }
    const delay = getReconnectDelay();
    console.log(`🔄 [WA-Monitor] reconnect #${reconnectAttempts + 1} בעוד ${Math.round(delay / 1000)}ש (${reason})`);
    setTimeout(() => connectMonitor(), delay);
};

// ============================================================
// ===  MAIN CONNECTION  ===
// ============================================================

export const connectMonitor = async () => {
    if (reconnectLock) return;
    reconnectLock = true;
    connectionState = 'connecting';

    try {
        if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        const { version } = await fetchLatestBaileysVersion();
        console.log(`📱 [WA-Monitor] מתחבר (פרוטוקול v${version.join('.')})`);

        sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            version,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Sterni Monitor', 'Chrome', '1.0.0'],
            defaultQueryTimeoutMs: 60_000,
            keepAliveIntervalMs: 30_000,
            connectTimeoutMs: 60_000,
            // קריטי: רוצים לראות גם את מה שאתה שולח (צד שני של השיחה)
            emitOwnEvents: true,
            // מושכים היסטוריית שיחות קיימת
            syncFullHistory: true,
            markOnlineOnConnect: false,
            getMessage: async () => ({ conversation: '' }),
        });

        sock.ev.on('creds.update', saveCreds);

        // ─── CONNECTION STATE ───
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                QRCode.toDataURL(qr, { width: 300, margin: 2 })
                    .then(dataURL => { currentQRDataURL = dataURL; connectionState = 'connecting'; })
                    .catch(() => {});
                emitToAdmins('wa-monitor:status', { state: 'connecting', hasQr: true });
            }

            if (connection === 'open') {
                console.log('✅ [WA-Monitor] מחובר!');
                connectionState = 'connected';
                currentQRDataURL = null;
                reconnectAttempts = 0;
                emitToAdmins('wa-monitor:status', { state: 'connected', user: sock?.user?.id || null });
            }

            if (connection === 'close') {
                connectionState = 'disconnected';
                const error = lastDisconnect?.error;
                const statusCode = (error instanceof Boom) ? error.output?.statusCode : error?.output?.statusCode;
                const isLoggedOut = statusCode === DisconnectReason.loggedOut;
                console.log(`🔌 [WA-Monitor] נסגר | status=${statusCode} loggedOut=${isLoggedOut}`);
                emitToAdmins('wa-monitor:status', { state: 'disconnected' });

                if (isLoggedOut) {
                    try { fs.rmSync(AUTH_FOLDER, { recursive: true, force: true }); } catch (_) { /* ok */ }
                    reconnectAttempts = 0;
                    reconnectLock = false;
                    scheduleReconnect('logged_out');
                } else {
                    reconnectAttempts++;
                    reconnectLock = false;
                    scheduleReconnect(`close_${statusCode}`);
                }
                return;
            }
        });

        // ─── LIVE MESSAGES (שני הכיוונים) ───
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            const live = type === 'notify';
            for (const m of messages) {
                await storeMessage(m, live);
            }
        });

        // ─── HISTORY SYNC — היסטוריית שיחות קיימת (מטא-דאטה בלבד) ───
        sock.ev.on('messaging-history.set', async ({ messages }) => {
            if (!messages?.length) return;
            console.log(`📚 [WA-Monitor] סנכרון היסטוריה: ${messages.length} הודעות`);
            for (const m of messages) {
                await storeMessage(m, false);
            }
        });

        reconnectLock = false;
    } catch (err) {
        console.error('❌ [WA-Monitor] שגיאת חיבור:', err.message);
        connectionState = 'disconnected';
        reconnectLock = false;
        reconnectAttempts++;
        scheduleReconnect('connection_error');
    }
};

/** ניתוק + מחיקת session (יגרור QR חדש בחיבור הבא) */
export const logoutMonitor = async () => {
    try { await sock?.logout(); } catch (_) { /* ok */ }
    try { sock?.end?.(); } catch (_) { /* ok */ }
    sock = null;
    connectionState = 'disconnected';
    currentQRDataURL = null;
    try { fs.rmSync(AUTH_FOLDER, { recursive: true, force: true }); } catch (_) { /* ok */ }
    return { ok: true };
};

/** נתיב מוחלט לקובץ מדיה (לשימוש route ההגשה) — null אם לא קיים */
export const resolveMediaPath = (mediaPath) => {
    if (!mediaPath) return null;
    // מניעת path traversal — רק שם קובץ בתוך MEDIA_DIR
    const safe = path.basename(mediaPath);
    const full = path.join(MEDIA_DIR, safe);
    return fs.existsSync(full) ? full : null;
};
