import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import WhatsAppMessage from '../models/WhatsAppMessage.js';
import WhatsAppChat from '../models/WhatsAppChat.js';
import {
    getMonitorSettings,
    trackedChatFilter,
    fetchMediaForMessage,
    resolveMediaPath,
} from '../services/whatsappMonitorService.js';
import { sendMediaFile } from './whatsappMonitorRoutes.js';

/**
 * /api/wa-view — צפייה בלבד בשיחה עם איש הקשר שנבחר בהגדרות המעקב.
 * גישה: role 'wa-viewer' (משתמש צופה — חסום מכל API אחר ב-authMiddleware) או 'admin'.
 * אין כאן שום פעולת כתיבה מבחינת המשתמש.
 *
 * Coupled: server/services/whatsappMonitorService.js (settings + מדיה),
 *          client/src/pages/WaViewerPage.jsx
 */
const router = express.Router();

router.use(requireAuth, (req, res, next) => {
    if (!['admin', 'wa-viewer'].includes(req.user?.role)) {
        return res.status(403).json({ message: 'אין הרשאת צפייה' });
    }
    next();
});

const MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'sticker'];

/** jids של השיחות במעקב (שיחה אחת בדרך כלל; יותר אם LID וטלפון עוד לא מוזגו) */
const getTrackedChats = async () => {
    const settings = await getMonitorSettings();
    if (!settings.tracked.length) return { settings, chats: [] };
    const chats = await WhatsAppChat.find(trackedChatFilter(settings.tracked)).lean();
    return { settings, chats };
};

const toPublic = (m, contactName) => {
    const isMedia = MEDIA_TYPES.includes(m.type);
    const base = `/api/wa-view/media/${encodeURIComponent(m.messageId)}`;
    return {
        id: m.messageId,
        direction: m.fromMe ? 'out' : 'in',
        from: m.fromMe ? 'me' : (m.senderName || contactName || ''),
        timestamp: new Date(m.timestamp).toISOString(),
        type: m.type,
        text: m.text || '',
        quotedText: m.quotedText || null,
        media: isMedia ? {
            // available=false → הקובץ עוד לא בשרת; פנייה ל-url תנסה להוריד אותו מוואצפ
            available: !!m.mediaPath,
            url: base,
            downloadUrl: `${base}?download=1`,
            mime: m.mediaMime || '',
            fileName: m.fileName || '',
            fileSize: m.fileSize || 0,
            durationSeconds: m.durationSeconds || 0,
            isVoiceNote: !!m.isVoiceNote,
        } : null,
        location: m.type === 'location' ? m.location : undefined,
        contact: m.type === 'contact' ? m.contactCard : undefined,
        poll: m.type === 'poll' ? m.poll : undefined,
        deleted: !!m.deleted,
        edited: !!m.edited,
        originalText: m.edited ? (m.originalText ?? null) : undefined,
        reactions: (m.reactions || []).map((r) => ({ emoji: r.emoji, by: r.fromMe ? 'me' : 'them' })),
        updatedAt: m.updatedAt ? new Date(m.updatedAt).toISOString() : null,
    };
};

const parseDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
};

/**
 * GET /api/wa-view/messages
 *   ?since=ISO         רק הודעות שנשלחו אחרי הזמן הזה
 *   ?afterId=<id>      רק הודעות שאחרי ההודעה הזו (לפי זמן)
 *   ?changedSince=ISO  הודעות שנוספו/השתנו (עריכה/מחיקה/ריאקציה/קובץ ירד) אחרי הזמן הזה
 *   ?before=ISO        N ההודעות שלפני הזמן הזה (גלילה אחורה)
 *   ?limit=N           ברירת מחדל 500, מקסימום 2000
 * בלי פרמטרים — N ההודעות האחרונות. תמיד ממוין מהישן לחדש.
 */
router.get('/messages', async (req, res) => {
    try {
        // נלקח לפני השאילתה — כך שימוש ב-serverTime כ-changedSince בסבב הבא לא מפספס שינוי שקרה באמצע
        const serverTime = new Date().toISOString();
        const { settings, chats } = await getTrackedChats();
        if (!settings.tracked.length) {
            return res.json({ contact: null, count: 0, hasMore: false, serverTime, messages: [], notice: 'לא הוגדר איש קשר למעקב' });
        }

        const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
        const since = parseDate(req.query.since);
        const changedSince = parseDate(req.query.changedSince);
        const before = parseDate(req.query.before);
        if (since === undefined || changedSince === undefined || before === undefined) {
            return res.status(400).json({ message: 'פורמט תאריך לא תקין (נדרש ISO, למשל 2026-11-21T10:00:00Z)' });
        }

        const filter = { chatJid: { $in: chats.map((c) => c.jid) } };
        let fromStart = false;
        if (since) { filter.timestamp = { $gt: since }; fromStart = true; }
        if (req.query.afterId) {
            const ref = await WhatsAppMessage.findOne({ messageId: req.query.afterId, ...filter }).select('timestamp').lean();
            if (!ref) return res.status(404).json({ message: 'afterId לא נמצא' });
            filter.timestamp = { ...(filter.timestamp || {}), $gt: ref.timestamp };
            fromStart = true;
        }
        if (changedSince) { filter.updatedAt = { $gte: changedSince }; fromStart = true; }
        if (before) filter.timestamp = { ...(filter.timestamp || {}), $lt: before };

        // עם פילטר "מאז" — מהישן לחדש (כדי לא לדלג על כלום); בלי — העמוד האחרון
        let docs;
        if (fromStart) {
            docs = await WhatsAppMessage.find(filter).sort({ timestamp: 1 }).limit(limit + 1).lean();
        } else {
            docs = await WhatsAppMessage.find(filter).sort({ timestamp: -1 }).limit(limit + 1).lean();
        }
        const hasMore = docs.length > limit;
        docs = docs.slice(0, limit);
        if (!fromStart) docs.reverse();

        const main = chats[0] || {};
        const t0 = settings.tracked[0];
        const contactName = main.contactName || main.name || t0?.name || '';
        res.json({
            contact: {
                name: contactName,
                phone: main.phone || t0?.phone || '',
            },
            count: docs.length,
            hasMore,
            serverTime,
            messages: docs.map((m) => toPublic(m, contactName)),
        });
    } catch (err) {
        res.status(500).json({ message: 'שגיאה בשליפת הודעות', error: err.message });
    }
});

/**
 * GET /api/wa-view/media/:messageId  (?download=1 → הורדה כקובץ)
 * רק להודעות מהשיחה במעקב. אם הקובץ עוד לא בשרת — מנסה להוריד מוואצפ ואז מגיש.
 */
router.get('/media/:messageId', async (req, res) => {
    try {
        const { chats } = await getTrackedChats();
        let msg = await WhatsAppMessage.findOne({
            messageId: req.params.messageId,
            chatJid: { $in: chats.map((c) => c.jid) },
        }).select('messageId mediaPath mediaMime fileName type').lean();
        if (!msg || !MEDIA_TYPES.includes(msg.type)) return res.status(404).json({ message: 'מדיה לא נמצאה' });

        if (!msg.mediaPath || !resolveMediaPath(msg.mediaPath)) {
            try {
                msg = { ...msg, ...(await fetchMediaForMessage(msg.messageId)) };
            } catch (e) {
                return res.status(404).json({ message: `הקובץ לא זמין: ${e.message}` });
            }
        }
        sendMediaFile(res, msg, req.query.download === '1');
    } catch (err) {
        res.status(500).json({ message: 'שגיאה בהגשת מדיה', error: err.message });
    }
});

export default router;
