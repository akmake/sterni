import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    normalizeMessageContent,
    getContentType,
    jidNormalizedUser,
    isPnUser,
    isLidUser,
    isHostedPnUser,
    isHostedLidUser,
    isJidGroup,
    isJidBroadcast,
    isJidNewsletter,
    BufferJSON,
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
import WhatsAppMonitorSettings from '../models/WhatsAppMonitorSettings.js';

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
// קבצים גדולים מזה לא מורדים אוטומטית (אפשר בדיעבד דרך fetchMediaForMessage)
const AUTO_DOWNLOAD_MAX_BYTES = 100 * 1024 * 1024;

const silentLogger = pino({ level: 'silent' });

// ============================================================
// ===  STATE  ===
// ============================================================

let sock = null;
let connectionState = 'disconnected'; // 'connected' | 'connecting' | 'disconnected'
let currentQRDataURL = null;
let reconnectLock = false;
let reconnectAttempts = 0;
let ioRef = null;
// כל חיבור חדש מקבל מספר דור — אירועים מסוקט ישן מתעלמים מהם
let generation = 0;
const MAX_RECONNECT_ATTEMPTS = 15;
const BASE_RECONNECT_DELAY = 3000;

// מונע עיבוד כפול של אותה הודעה בזמן אמת
const msgCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
// LIDs שכבר מוזגו ל-jid טלפוני (חוסך שאילתות)
const mergedLids = new Set();
// שמות אנשי קשר מסנכרון אנשי הקשר (jid/lid → שם)
const contactNames = new Map();

// ============================================================
// ===  IO ATTACH  ===
// ============================================================

/** מחברים את מופע ה-Socket.IO (נקרא מ-app.js אחרי יצירת io) */
export const attachMonitorIo = (io) => { ioRef = io; };

const emitToAdmins = (event, payload) => {
    try {
        ioRef?.to('admins').emit(event, payload);
        // עמוד הצופה (/wa-view) — רק "משהו השתנה", הוא מושך בעצמו (changedSince) ורואה רק את השיחה במעקב
        if (event !== 'wa-monitor:status') {
            ioRef?.to('wa-viewers').to('admins').emit('wa-view:changed', { at: Date.now() });
        }
    } catch (_) { /* best-effort */ }
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
// ===  SETTINGS (מעקב אחרי אנשי קשר מסוימים)  ===
// ============================================================

let settingsCache = null;

/** נרמול מספר טלפון לספרות בפורמט בינלאומי (050-1234567 → 972501234567) */
export const normalizePhone = (input) => {
    let d = String(input || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('0')) d = '972' + d.slice(1);
    return d;
};

export const getMonitorSettings = async () => {
    if (!settingsCache) {
        const s = await WhatsAppMonitorSettings.findOne({ key: 'singleton' }).lean();
        settingsCache = { mode: s?.mode || 'all', tracked: s?.tracked || [] };
    }
    return settingsCache;
};

export const setMonitorSettings = async ({ mode, tracked }) => {
    const cleanTracked = (Array.isArray(tracked) ? tracked : [])
        .map((t) => ({
            jid: String(t?.jid || '').trim(),
            phone: normalizePhone(t?.phone),
            name: String(t?.name || '').trim().slice(0, 100),
        }))
        .filter((t) => t.jid || t.phone)
        .slice(0, 50);
    const cleanMode = mode === 'selected' ? 'selected' : 'all';

    const s = await WhatsAppMonitorSettings.findOneAndUpdate(
        { key: 'singleton' },
        { $set: { mode: cleanMode, tracked: cleanTracked } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    settingsCache = { mode: s.mode, tracked: s.tracked };
    primeTrackedLids().catch(() => {});
    return settingsCache;
};

/** האם השיחה (לפי jid/lid/phone) תואמת לאחד מאנשי הקשר ב-tracked */
export const chatMatchesTracked = (tracked, { jid, lid, phone }) =>
    (tracked || []).some((t) =>
        (t.jid && (t.jid === jid || t.jid === lid)) ||
        (t.phone && phone && t.phone === phone)
    );

/** פילטר Mongo לשיחות/הודעות של אנשי הקשר ב-tracked */
export const trackedChatFilter = (tracked) => {
    const jids = (tracked || []).map((t) => t.jid).filter(Boolean);
    const phones = (tracked || []).map((t) => t.phone).filter(Boolean);
    const or = [];
    if (jids.length) or.push({ jid: { $in: jids } }, { lid: { $in: jids } });
    if (phones.length) or.push({ phone: { $in: phones } });
    return or.length ? { $or: or } : { _id: null }; // אין אנשי קשר → כלום
};

// phone → LID של אנשי הקשר במעקב (נשלף מוואצפ ב-USync). רק תוצאות שנמצאו נשמרות.
const trackedLidByPhone = new Map();

const lidForPhone = async (phone) => {
    if (!phone) return null;
    if (trackedLidByPhone.has(phone)) return trackedLidByPhone.get(phone);
    try {
        const lid = await sock?.signalRepository?.lidMapping?.getLIDForPN(`${phone}@s.whatsapp.net`);
        if (lid) {
            const norm = jidNormalizedUser(lid);
            trackedLidByPhone.set(phone, norm);
            return norm;
        }
    } catch (_) { /* לא מחובר / לא נמצא */ }
    return null;
};

/** מושך מראש את ה-LID של אנשי הקשר במעקב, כדי שהודעות שמגיעות כ-@lid יזוהו */
const primeTrackedLids = async () => {
    const s = await getMonitorSettings();
    for (const t of s.tracked) await lidForPhone(t.phone);
};

/**
 * האם לשמור הודעה מהשיחה הזו (לפי הגדרות המעקב).
 * במצב 'selected', אם השיחה ידועה רק כ-LID — בודקים אם ה-LID שייך למספר במעקב,
 * ואם כן משייכים את השיחה למספר הטלפון (ident משתנה במקום).
 */
const shouldStore = async (ident) => {
    const s = await getMonitorSettings();
    if (s.mode !== 'selected') return true;
    if (chatMatchesTracked(s.tracked, { jid: ident.chatJid, lid: ident.lid, phone: ident.phone })) return true;
    if (!ident.lid || ident.phone) return false;

    for (const t of s.tracked) {
        if (t.phone && (await lidForPhone(t.phone)) === ident.lid) {
            const pnJid = `${t.phone}@s.whatsapp.net`;
            await mergeLidChat(ident.lid, pnJid);
            ident.chatJid = pnJid;
            ident.phone = t.phone;
            return true;
        }
    }
    return false;
};

// ============================================================
// ===  CHAT IDENTITY (LID ↔ טלפון)  ===
// ============================================================
// מאז 2025 וואצפ מזהה הרבה שיחות אישיות לפי LID ('...@lid') במקום מספר טלפון.
// הקוד הישן סינן רק '@s.whatsapp.net' — ולכן רוב ההודעות פשוט נזרקו.

const userPart = (jid) => String(jid || '').split('@')[0].split(':')[0];
const isPersonPn = (jid) => !!(isPnUser(jid) || isHostedPnUser(jid));
const isPersonLid = (jid) => !!(isLidUser(jid) || isHostedLidUser(jid));

/** ממזג שיחה שנשמרה תחת LID לשיחה הטלפונית שלה (הודעות + סיכום) */
const mergeLidChat = async (lidJid, pnJid) => {
    if (!lidJid || !pnJid || lidJid === pnJid || mergedLids.has(lidJid)) return;
    mergedLids.add(lidJid);
    const phone = userPart(pnJid);
    try {
        await WhatsAppMessage.updateMany({ chatJid: lidJid }, { $set: { chatJid: pnJid, phone } });
        const lidChat = await WhatsAppChat.findOne({ jid: lidJid }).lean();
        const pnChat = await WhatsAppChat.findOne({ jid: pnJid }).lean();

        if (!lidChat) {
            if (pnChat) await WhatsAppChat.updateOne({ _id: pnChat._id }, { $set: { lid: lidJid } });
            return;
        }
        if (!pnChat) {
            await WhatsAppChat.updateOne({ _id: lidChat._id }, { $set: { jid: pnJid, phone, lid: lidJid } });
            return;
        }
        const lidNewer = (lidChat.lastMessageAt || 0) > (pnChat.lastMessageAt || 0);
        await WhatsAppChat.updateOne({ _id: pnChat._id }, {
            $set: {
                lid: lidJid,
                name: pnChat.name || lidChat.name || '',
                contactName: pnChat.contactName || lidChat.contactName || '',
                ...(lidNewer ? {
                    lastMessageText: lidChat.lastMessageText,
                    lastMessageAt: lidChat.lastMessageAt,
                    lastFromMe: lidChat.lastFromMe,
                } : {}),
            },
            $inc: { messageCount: lidChat.messageCount || 0, unreadCount: lidChat.unreadCount || 0 },
        });
        await WhatsAppChat.deleteOne({ _id: lidChat._id });
        console.log(`🔗 [WA-Monitor] מוזגה שיחת LID ${lidJid} → ${pnJid}`);
    } catch (err) {
        mergedLids.delete(lidJid);
        console.error('⚠️ [WA-Monitor] מיזוג LID נכשל:', err.message);
    }
};

/**
 * מחזיר זהות קנונית לשיחה אישית, או null לקבוצות/סטטוס/ערוצים.
 * @returns {{chatJid: string, phone: string, lid: string|null} | null}
 */
const resolveChat = async (key) => {
    const raw = key?.remoteJid;
    if (!raw) return null;
    if (isJidGroup(raw) || isJidBroadcast(raw) || isJidNewsletter(raw)) return null;

    const norm = jidNormalizedUser(raw);
    const alt = key.remoteJidAlt ? jidNormalizedUser(key.remoteJidAlt) : null;

    if (isPersonPn(raw)) {
        const lid = alt && isPersonLid(alt) ? alt : null;
        return { chatJid: norm, phone: userPart(norm), lid };
    }
    if (!isPersonLid(raw)) return null;

    // LID — מנסים למצוא את מספר הטלפון
    let pn = alt && isPersonPn(alt) ? alt : null;
    if (!pn) {
        try {
            const found = await sock?.signalRepository?.lidMapping?.getPNForLID(norm);
            if (found) pn = jidNormalizedUser(found);
        } catch (_) { /* mapping לא זמין */ }
    }
    if (pn) {
        await mergeLidChat(norm, pn);
        return { chatJid: pn, phone: userPart(pn), lid: norm };
    }
    return { chatJid: norm, phone: '', lid: norm };
};

// ============================================================
// ===  MESSAGE CONTENT EXTRACTION  ===
// ============================================================

const MEDIA_KEYS = {
    imageMessage: 'image',
    videoMessage: 'video',
    ptvMessage: 'video',        // וידאו-עיגול
    audioMessage: 'audio',
    documentMessage: 'document',
    stickerMessage: 'sticker',
};

// סוגי תוכן טכניים שלא מציגים כהודעה
const IGNORED_TYPES = new Set([
    'senderKeyDistributionMessage',
    'messageContextInfo',
    'pollUpdateMessage',
    'encReactionMessage',
    'keepInChatMessage',
    'pinInChatMessage',
    'deviceSentMessage',
    'callLogMesssage',
    'botInvokeMessage',
]);

const textOf = (c) => {
    if (!c) return '';
    return c.conversation ||
        c.extendedTextMessage?.text ||
        c.imageMessage?.caption ||
        c.videoMessage?.caption ||
        c.ptvMessage?.caption ||
        c.documentMessage?.caption ||
        c.buttonsResponseMessage?.selectedDisplayText ||
        c.templateButtonReplyMessage?.selectedDisplayText ||
        c.listResponseMessage?.title ||
        c.buttonsMessage?.contentText ||
        c.templateMessage?.hydratedTemplate?.hydratedContentText ||
        c.interactiveMessage?.body?.text ||
        '';
};

const contextInfoOf = (c) => {
    if (!c) return null;
    for (const k of Object.keys(c)) {
        if (c[k]?.contextInfo) return c[k].contextInfo;
    }
    return null;
};

const quotedTextOf = (c) => {
    const q = normalizeMessageContent(contextInfoOf(c)?.quotedMessage);
    if (!q) return null;
    const t = textOf(q);
    if (t) return t;
    if (q.imageMessage) return '[תמונה]';
    if (q.videoMessage || q.ptvMessage) return '[סרטון]';
    if (q.audioMessage) return q.audioMessage.ptt ? '[הקלטה]' : '[קובץ שמע]';
    if (q.documentMessage) return `[קובץ${q.documentMessage.fileName ? ': ' + q.documentMessage.fileName : ''}]`;
    if (q.stickerMessage) return '[מדבקה]';
    if (q.locationMessage) return '[מיקום]';
    return null;
};

const phoneFromVcard = (vcard) => {
    const m = /waid=(\d+)/.exec(vcard || '') || /TEL[^:]*:([+\d\s-]+)/.exec(vcard || '');
    return m ? m[1].replace(/\D/g, '') : '';
};

const extensionFor = (type, mime, fileName) => {
    const fromName = fileName && path.extname(fileName).replace('.', '');
    if (fromName) return fromName.slice(0, 10);
    const m = String(mime || '').split(';')[0].trim();
    const known = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
        'video/mp4': 'mp4', 'video/3gpp': '3gp', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3',
        'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr', 'application/pdf': 'pdf',
    };
    if (known[m]) return known[m];
    return { image: 'jpg', video: 'mp4', audio: 'ogg', sticker: 'webp' }[type] || 'bin';
};

/** מפרק תוכן הודעה (אחרי normalize) לשדות שנשמרים ב-DB */
const parseContent = (content) => {
    const ctype = getContentType(content);
    if (!ctype) return null;
    const out = { ctype, type: 'other', text: textOf(content), quotedText: quotedTextOf(content) };

    if (ctype === 'conversation' || ctype === 'extendedTextMessage') {
        out.type = 'text';
    } else if (MEDIA_KEYS[ctype]) {
        const node = content[ctype] || {};
        out.type = MEDIA_KEYS[ctype];
        out.media = {
            mediaMime: node.mimetype || '',
            fileName: node.fileName || '',
            fileSize: Number(node.fileLength || 0) || 0,
            durationSeconds: Number(node.seconds || 0) || 0,
            isVoiceNote: ctype === 'audioMessage' && !!node.ptt,
        };
    } else if (ctype === 'locationMessage' || ctype === 'liveLocationMessage') {
        const n = content[ctype];
        out.type = 'location';
        out.location = { lat: n.degreesLatitude, lng: n.degreesLongitude, name: n.name || '', address: n.address || '' };
        out.text = out.text || n.caption || '';
    } else if (ctype === 'contactMessage') {
        const n = content.contactMessage;
        out.type = 'contact';
        out.contactCard = { name: n.displayName || '', phone: phoneFromVcard(n.vcard) };
    } else if (ctype === 'contactsArrayMessage') {
        const first = content.contactsArrayMessage.contacts?.[0] || {};
        out.type = 'contact';
        out.contactCard = { name: content.contactsArrayMessage.displayName || first.displayName || '', phone: phoneFromVcard(first.vcard) };
    } else if (ctype.startsWith('pollCreationMessage')) {
        const n = content[ctype];
        out.type = 'poll';
        out.poll = { name: n.name || '', options: (n.options || []).map((o) => o.optionName || '') };
    } else if (!out.text) {
        out.text = `[סוג הודעה שלא נתמך בתצוגה: ${ctype}]`;
    }
    return out;
};

const previewOf = (p) => p.text || ({
    image: '📷 תמונה',
    video: '🎥 סרטון',
    audio: p.media?.isVoiceNote ? '🎤 הקלטה' : '🎵 קובץ שמע',
    document: `📎 ${p.media?.fileName || 'קובץ'}`,
    sticker: 'מדבקה',
    location: '📍 מיקום',
    contact: `👤 ${p.contactCard?.name || 'איש קשר'}`,
    poll: `📊 ${p.poll?.name || 'סקר'}`,
}[p.type] || '');

// ============================================================
// ===  MEDIA DOWNLOAD  ===
// ============================================================

const ensureMediaDir = () => {
    if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
};

/** מוריד מדיה של הודעה ושומר לדיסק. מחזיר את שם הקובץ. */
const downloadAndSave = async (m, { messageId, type, mediaMime, fileName }) => {
    ensureMediaDir();
    const buffer = await downloadMediaMessage(m, 'buffer', {}, {
        logger: silentLogger,
        // מבקש מהטלפון להעלות שוב מדיה שפג תוקפה בשרתי וואצפ (הקוד הישן העביר כאן את sock עצמו — קרס)
        reuploadRequest: (msg) => sock.updateMediaMessage(msg),
    });
    const ext = extensionFor(type, mediaMime, fileName);
    const safeName = `${messageId.replace(/[^A-Za-z0-9_-]/g, '')}.${ext}`;
    fs.writeFileSync(path.join(MEDIA_DIR, safeName), buffer);
    return { mediaPath: safeName, fileSize: buffer.length };
};

/**
 * הורדת מדיה בדיעבד (היסטוריה / הורדה שנכשלה) לפי ההודעה הגולמית השמורה.
 * מחזיר את ההודעה המעודכנת, או זורק שגיאה.
 */
export const fetchMediaForMessage = async (messageId) => {
    if (!sock || connectionState !== 'connected') throw new Error('חיבור הוואצפ לא פעיל');
    const doc = await WhatsAppMessage.findOne({ messageId }).select('+raw').lean();
    if (!doc) throw new Error('הודעה לא נמצאה');
    if (doc.mediaPath && resolveMediaPath(doc.mediaPath)) return doc;
    if (!doc.raw) throw new Error('אין נתוני מדיה להודעה זו');

    const m = JSON.parse(doc.raw, BufferJSON.reviver);
    const saved = await downloadAndSave(m, doc);
    const updated = await WhatsAppMessage.findOneAndUpdate(
        { messageId },
        { $set: { mediaPath: saved.mediaPath, mediaUnavailable: false, fileSize: doc.fileSize || saved.fileSize } },
        { new: true }
    ).lean();
    emitToAdmins('wa-monitor:update', { messageId, chatJid: doc.chatJid, patch: { mediaPath: saved.mediaPath, mediaUnavailable: false } });
    return updated;
};

// ============================================================
// ===  EDIT / DELETE / REACTION  ===
// ============================================================

const PROTOCOL_REVOKE = 0;
const PROTOCOL_EDIT = 14;

const emitPatch = (messageId, chatJid, patch) => emitToAdmins('wa-monitor:update', { messageId, chatJid, patch });

const handleProtocol = async (pm, ident) => {
    const targetId = pm?.key?.id;
    if (!targetId) return;

    if (pm.type === PROTOCOL_REVOKE) {
        // "נמחקה לכולם" — שומרים את התוכן המקורי ומסמנים
        const patch = { deleted: true, deletedAt: new Date() };
        const r = await WhatsAppMessage.updateOne({ messageId: targetId }, { $set: patch });
        if (r.matchedCount) emitPatch(targetId, ident.chatJid, patch);
        return;
    }

    if (pm.type === PROTOCOL_EDIT) {
        const newText = textOf(normalizeMessageContent(pm.editedMessage));
        const target = await WhatsAppMessage.findOne({ messageId: targetId }).select('text originalText').lean();
        if (!target) return;
        const patch = { text: newText, edited: true, editedAt: new Date() };
        if (target.originalText == null) patch.originalText = target.text || '';
        await WhatsAppMessage.updateOne({ messageId: targetId }, { $set: patch });
        emitPatch(targetId, ident.chatJid, patch);
    }
    // שאר סוגי protocolMessage (סנכרון היסטוריה, מפתחות וכו') — טכניים, מתעלמים
};

const handleReaction = async (rm, fromMe) => {
    const targetId = rm?.key?.id;
    if (!targetId) return;
    const target = await WhatsAppMessage.findOne({ messageId: targetId }).select('chatJid reactions').lean();
    if (!target) return;
    // ריאקציה אחת לכל צד; טקסט ריק = הסרה
    const reactions = (target.reactions || []).filter((r) => r.fromMe !== fromMe);
    if (rm.text) reactions.push({ emoji: rm.text, fromMe, at: new Date() });
    await WhatsAppMessage.updateOne({ messageId: targetId }, { $set: { reactions } });
    emitPatch(targetId, target.chatJid, { reactions });
};

// ============================================================
// ===  STORE  ===
// ============================================================

/**
 * שומר הודעה בודדת (משני הכיוונים) + מעדכן את סיכום השיחה.
 * @param {object} m                  אובייקט ההודעה של Baileys
 * @param {object} opts
 * @param {boolean} opts.live         true = הגיעה עכשיו (messages.upsert) → מורידים מדיה ודוחפים סוקט
 * @param {boolean} [opts.notify]     true = הודעה חדשה "אמיתית" (type notify) → מעלה מונה לא-נקראו
 */
const storeMessage = async (m, { live, notify = false }) => {
    try {
        if (!m?.message || !m.key?.id) return;

        const ident = await resolveChat(m.key);
        if (!ident) return;
        if (!(await shouldStore(ident))) return;

        const content = normalizeMessageContent(m.message);
        const ctype = getContentType(content);
        if (!ctype || IGNORED_TYPES.has(ctype)) return;

        const fromMe = !!m.key.fromMe;

        if (ctype === 'protocolMessage') return handleProtocol(content.protocolMessage, ident);
        if (ctype === 'reactionMessage') return handleReaction(content.reactionMessage, fromMe);

        const messageId = m.key.id;

        // מניעת כפל-עיבוד בזמן אמת (Baileys שולח לפעמים פעמיים)
        if (live) {
            if (msgCache.get(messageId)) return;
            msgCache.set(messageId, true);
        }

        const parsed = parseContent(content);
        if (!parsed) return;

        const senderName = fromMe ? '' : (m.pushName || m.verifiedBizName || '');
        const tsSeconds = Number(m.messageTimestamp) || Math.floor(Date.now() / 1000);
        const timestamp = new Date(tsSeconds * 1000);

        const doc = {
            messageId,
            chatJid: ident.chatJid,
            phone: ident.phone,
            fromMe,
            senderName,
            type: parsed.type,
            text: parsed.text,
            quotedText: parsed.quotedText,
            timestamp,
        };
        if (parsed.location) doc.location = parsed.location;
        if (parsed.contactCard) doc.contactCard = parsed.contactCard;
        if (parsed.poll) doc.poll = parsed.poll;
        if (parsed.media) {
            Object.assign(doc, parsed.media);
            doc.mediaUnavailable = true; // עד שהקובץ יורד בפועל
            // ההודעה הגולמית נשמרת כדי לאפשר הורדה בדיעבד (גם להיסטוריה)
            doc.raw = JSON.stringify({ key: m.key, message: m.message }, BufferJSON.replacer);
        }

        // insert-only: אירוע כפול / סנכרון היסטוריה חוזר לא דורס הודעה קיימת (כולל mediaPath שכבר ירד)
        const res = await WhatsAppMessage.updateOne(
            { messageId },
            { $setOnInsert: doc },
            { upsert: true }
        );
        const isNew = res.upsertedCount > 0;
        if (!isNew) return;

        // ── עדכון סיכום השיחה ──
        const chatSet = {};
        if (ident.phone) chatSet.phone = ident.phone;
        if (ident.lid) chatSet.lid = ident.lid;
        if (senderName) chatSet.name = senderName;
        const knownName = contactNames.get(ident.chatJid) || (ident.lid && contactNames.get(ident.lid));
        if (knownName) chatSet.contactName = knownName;

        await WhatsAppChat.updateOne(
            { jid: ident.chatJid },
            {
                ...(Object.keys(chatSet).length ? { $set: chatSet } : {}),
                $inc: { messageCount: 1, unreadCount: (notify && !fromMe) ? 1 : 0 },
            },
            { upsert: true }
        );
        // lastMessage מתעדכן רק אם ההודעה הזו חדשה יותר (חשוב בסנכרון היסטוריה)
        await WhatsAppChat.updateOne(
            { jid: ident.chatJid, $or: [{ lastMessageAt: null }, { lastMessageAt: { $lte: timestamp } }] },
            { $set: { lastMessageText: previewOf(parsed), lastMessageAt: timestamp, lastFromMe: fromMe } }
        );

        // ── דחיפה חיה לפאנל ── (לפני הורדת מדיה, כדי שהודעה תופיע מיד)
        const { raw: _raw, ...publicDoc } = doc;
        if (live) emitToAdmins('wa-monitor:message', { ...publicDoc, timestamp: timestamp.toISOString() });

        // ── מדיה ── מורידים אוטומטית רק בהודעות חיות; היסטוריה — לפי דרישה
        if (parsed.media && live && (!doc.fileSize || doc.fileSize <= AUTO_DOWNLOAD_MAX_BYTES)) {
            try {
                const saved = await downloadAndSave(m, doc);
                const patch = { mediaPath: saved.mediaPath, mediaUnavailable: false };
                if (!doc.fileSize) patch.fileSize = saved.fileSize;
                await WhatsAppMessage.updateOne({ messageId }, { $set: patch });
                emitPatch(messageId, ident.chatJid, patch);
            } catch (dlErr) {
                console.error(`⚠️ [WA-Monitor] הורדת מדיה נכשלה (${parsed.type}):`, dlErr.message);
            }
        }
    } catch (err) {
        console.error('❌ [WA-Monitor] שגיאה בשמירת הודעה:', err.message);
    }
};

/** שמות אנשי קשר מהטלפון (contacts.upsert / היסטוריה) */
const handleContacts = async (contacts) => {
    for (const c of contacts || []) {
        const name = c?.name || c?.verifiedName;
        if (!name) continue;
        const ids = [c.id, c.lid, c.phoneNumber, c.jid]
            .filter(Boolean)
            .map((j) => jidNormalizedUser(j))
            .filter(Boolean);
        if (!ids.length) continue;
        ids.forEach((id) => contactNames.set(id, name));
        try {
            await WhatsAppChat.updateMany(
                { $or: [{ jid: { $in: ids } }, { lid: { $in: ids } }] },
                { $set: { contactName: name } }
            );
        } catch (_) { /* best-effort */ }
        // אם יש גם LID וגם טלפון — הזדמנות למזג
        const lid = ids.find(isPersonLid);
        const pn = ids.find(isPersonPn);
        if (lid && pn) await mergeLidChat(lid, pn);
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

/**
 * @param {object} [opts]
 * @param {boolean} [opts.manual]  לחיצה על "התחבר" בפאנל — מאפס ספירת ניסיונות
 */
export const connectMonitor = async ({ manual = false } = {}) => {
    if (reconnectLock) return;
    if (sock && connectionState === 'connected') return; // כבר מחובר — לא פותחים סוקט שני
    reconnectLock = true;
    connectionState = 'connecting';
    if (manual) reconnectAttempts = 0;

    // סוגרים סוקט קודם (אם יש) — האירועים שלו יתעלמו בזכות מספר הדור
    const myGen = ++generation;
    try { sock?.end?.(undefined); } catch (_) { /* ok */ }

    try {
        if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        const { version } = await fetchLatestBaileysVersion();
        console.log(`📱 [WA-Monitor] מתחבר (פרוטוקול v${version.join('.')})`);

        const s = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
            },
            version,
            printQRInTerminal: false,
            logger: silentLogger,
            browser: ['Sterni Monitor', 'Chrome', '1.0.0'],
            defaultQueryTimeoutMs: 60_000,
            keepAliveIntervalMs: 30_000,
            connectTimeoutMs: 60_000,
            // קריטי: רוצים לראות גם את מה שאתה שולח (צד שני של השיחה)
            emitOwnEvents: true,
            // מושכים היסטוריית שיחות קיימת
            syncFullHistory: true,
            markOnlineOnConnect: false,
            getMessage: async () => undefined,
        });
        sock = s;
        const stale = () => myGen !== generation;

        s.ev.on('creds.update', saveCreds);

        // ─── CONNECTION STATE ───
        s.ev.on('connection.update', (update) => {
            if (stale()) return;
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
                emitToAdmins('wa-monitor:status', { state: 'connected', user: s.user?.id || null });
                primeTrackedLids().catch(() => {});
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
            }
        });

        // ─── LIVE MESSAGES (שני הכיוונים) ───
        // notify = הודעה חדשה; append = הודעות שנשלחו ממכשיר אחר / הגיעו בזמן ניתוק — גם הן חיות
        s.ev.on('messages.upsert', async ({ messages, type }) => {
            if (stale()) return;
            for (const m of messages) {
                await storeMessage(m, { live: true, notify: type === 'notify' });
            }
        });

        // ─── HISTORY SYNC — היסטוריית שיחות קיימת (מדיה לפי דרישה) ───
        s.ev.on('messaging-history.set', async ({ messages, contacts }) => {
            if (stale()) return;
            if (contacts?.length) await handleContacts(contacts);
            if (!messages?.length) return;
            console.log(`📚 [WA-Monitor] סנכרון היסטוריה: ${messages.length} הודעות`);
            for (const m of messages) {
                await storeMessage(m, { live: false });
            }
        });

        // ─── CONTACTS — שמות כפי ששמורים בטלפון ───
        s.ev.on('contacts.upsert', (contacts) => { if (!stale()) handleContacts(contacts); });
        s.ev.on('contacts.update', (contacts) => { if (!stale()) handleContacts(contacts); });

        // ─── LID ↔ טלפון ───
        s.ev.on('lid-mapping.update', (payload) => {
            if (stale()) return;
            for (const p of [].concat(payload || [])) {
                if (p?.lid && p?.pn) mergeLidChat(jidNormalizedUser(p.lid), jidNormalizedUser(p.pn));
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

/** ניתוק + מחיקת session (יידרש QR חדש בחיבור הבא; לא מתחבר מחדש אוטומטית) */
export const logoutMonitor = async () => {
    generation++; // מנתק את מאזיני הסוקט הנוכחי — בלי reconnect אוטומטי
    try { await sock?.logout(); } catch (_) { /* ok */ }
    try { sock?.end?.(undefined); } catch (_) { /* ok */ }
    sock = null;
    connectionState = 'disconnected';
    currentQRDataURL = null;
    reconnectLock = false;
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

// חשיפה לבדיקות יחידה בלבד (לא בשימוש בקוד האפליקציה)
export const _internals = { parseContent, previewOf, resolveChat, normalizeMessageContent };
