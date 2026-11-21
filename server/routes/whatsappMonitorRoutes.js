import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import requireAdmin from '../middlewares/requireAdmin.js';
import WhatsAppMessage from '../models/WhatsAppMessage.js';
import WhatsAppChat from '../models/WhatsAppChat.js';
import {
    connectMonitor,
    logoutMonitor,
    getMonitorStatus,
    getMonitorQR,
    resolveMediaPath,
    fetchMediaForMessage,
    getMonitorSettings,
    setMonitorSettings,
    trackedChatFilter,
} from '../services/whatsappMonitorService.js';

const router = express.Router();

// כל הראוטים — admin בלבד
router.use(requireAuth, requireAdmin);

// ── סטטוס חיבור ──
router.get('/status', (req, res) => {
    res.json(getMonitorStatus());
});

// ── QR לחיבור הוואצפ שלך ──
router.get('/qr', (req, res) => {
    res.json({ state: getMonitorStatus().state, qr: getMonitorQR() });
});

// ── הפעלת חיבור (אם לא רץ) ──
router.post('/connect', async (req, res) => {
    connectMonitor({ manual: true });
    res.json({ ok: true, ...getMonitorStatus() });
});

// ── ניתוק ומחיקת session ──
router.post('/logout', async (req, res) => {
    const result = await logoutMonitor();
    res.json(result);
});

// ── הגדרות מעקב ──
router.get('/settings', async (req, res) => {
    try {
        res.json(await getMonitorSettings());
    } catch (err) {
        res.status(500).json({ message: 'שגיאה בשליפת הגדרות', error: err.message });
    }
});

router.put('/settings', async (req, res) => {
    try {
        const { mode, tracked } = req.body || {};
        res.json(await setMonitorSettings({ mode, tracked }));
    } catch (err) {
        res.status(500).json({ message: 'שגיאה בשמירת הגדרות', error: err.message });
    }
});

// ── רשימת צ'אטים (ממוינת לפי הודעה אחרונה). במצב 'selected' — רק אנשי הקשר במעקב (?all=1 → הכל, לחלון ההגדרות) ──
router.get('/chats', async (req, res) => {
    try {
        const settings = await getMonitorSettings();
        const filter = settings.mode === 'selected' && req.query.all !== '1' ? trackedChatFilter(settings.tracked) : {};
        const chats = await WhatsAppChat.find(filter)
            .sort({ lastMessageAt: -1 })
            .limit(300)
            .lean();
        res.json(chats);
    } catch (err) {
        res.status(500).json({ message: 'שגיאה בשליפת צ\'אטים', error: err.message });
    }
});

// ── סימון שיחה כנקראה ──
router.post('/chats/:jid/read', async (req, res) => {
    try {
        await WhatsAppChat.updateOne({ jid: req.params.jid }, { $set: { unreadCount: 0 } });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: 'שגיאה', error: err.message });
    }
});

// ── הודעות של שיחה ──
//   ?before=ISO&limit=50  → העמוד הקודם (גלילה אחורה)
//   ?after=ISO            → רק הודעות חדשות מהזמן הזה (fallback אם הסוקט לא עובד)
router.get('/chats/:jid/messages', async (req, res) => {
    try {
        const { jid } = req.params;
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const filter = { chatJid: jid };

        if (req.query.after) {
            const after = new Date(req.query.after);
            if (isNaN(after.getTime())) return res.status(400).json({ message: 'after לא תקין' });
            filter.timestamp = { $gt: after };
            const docs = await WhatsAppMessage.find(filter).sort({ timestamp: 1 }).limit(200).lean();
            return res.json({ messages: docs, hasMore: false });
        }

        if (req.query.before) {
            const before = new Date(req.query.before);
            if (!isNaN(before.getTime())) filter.timestamp = { $lt: before };
        }

        // שולפים את העמוד האחרון (חדש→ישן) ומחזירים ישן→חדש לתצוגה
        const docs = await WhatsAppMessage.find(filter)
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        res.json({
            messages: docs.reverse(),
            hasMore: docs.length === limit,
        });
    } catch (err) {
        res.status(500).json({ message: 'שגיאה בשליפת הודעות', error: err.message });
    }
});

// ── הורדת מדיה בדיעבד (היסטוריה / הורדה שנכשלה) ──
router.post('/media/:messageId/fetch', async (req, res) => {
    try {
        const msg = await fetchMediaForMessage(req.params.messageId);
        res.json({ ok: true, mediaPath: msg.mediaPath, mediaUnavailable: false });
    } catch (err) {
        res.status(409).json({ message: `לא ניתן להוריד את הקובץ: ${err.message}` });
    }
});

// ── הגשת מדיה מאובטחת (לא דרך /uploads הפומבי). ?download=1 → הורדה כקובץ ──
router.get('/media/:messageId', async (req, res) => {
    try {
        const msg = await WhatsAppMessage.findOne({ messageId: req.params.messageId })
            .select('messageId mediaPath mediaMime fileName type')
            .lean();
        if (!msg || !msg.mediaPath) return res.status(404).json({ message: 'מדיה לא נמצאה' });
        sendMediaFile(res, msg, req.query.download === '1');
    } catch (err) {
        res.status(500).json({ message: 'שגיאה בהגשת מדיה', error: err.message });
    }
});

/** שולח קובץ מדיה מהדיסק — משותף לפאנל האדמין ולעמוד הצופה */
export const sendMediaFile = (res, msg, asDownload) => {
    const fullPath = resolveMediaPath(msg.mediaPath);
    if (!fullPath) return res.status(404).json({ message: 'הקובץ לא זמין בדיסק' });

    if (msg.mediaMime) res.setHeader('Content-Type', msg.mediaMime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    if (asDownload) {
        const ext = msg.mediaPath.includes('.') ? msg.mediaPath.split('.').pop() : 'bin';
        res.attachment(msg.fileName || `whatsapp-${msg.messageId}.${ext}`);
    }
    return res.sendFile(fullPath);
};

export default router;
