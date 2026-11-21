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
    connectMonitor();
    res.json({ ok: true, ...getMonitorStatus() });
});

// ── ניתוק ומחיקת session ──
router.post('/logout', async (req, res) => {
    const result = await logoutMonitor();
    res.json(result);
});

// ── רשימת צ'אטים (ממוינת לפי הודעה אחרונה) ──
router.get('/chats', async (req, res) => {
    try {
        const chats = await WhatsAppChat.find({})
            .sort({ lastMessageAt: -1 })
            .limit(300)
            .lean();
        res.json(chats);
    } catch (err) {
        res.status(500).json({ message: 'שגיאה בשליפת צ\'אטים', error: err.message });
    }
});

// ── הודעות של שיחה (pagination לפי זמן; ?before=ISO&limit=50) ──
router.get('/chats/:jid/messages', async (req, res) => {
    try {
        const { jid } = req.params;
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const filter = { chatJid: jid };
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

// ── הגשת מדיה מאובטחת (לא דרך /uploads הפומבי) ──
router.get('/media/:messageId', async (req, res) => {
    try {
        const msg = await WhatsAppMessage.findOne({ messageId: req.params.messageId })
            .select('mediaPath mediaMime fileName type')
            .lean();
        if (!msg || !msg.mediaPath) return res.status(404).json({ message: 'מדיה לא נמצאה' });

        const fullPath = resolveMediaPath(msg.mediaPath);
        if (!fullPath) return res.status(404).json({ message: 'הקובץ לא זמין בדיסק' });

        if (msg.mediaMime) res.setHeader('Content-Type', msg.mediaMime);
        if (msg.type === 'document' && msg.fileName) {
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(msg.fileName)}"`);
        }
        res.sendFile(fullPath);
    } catch (err) {
        res.status(500).json({ message: 'שגיאה בהגשת מדיה', error: err.message });
    }
});

export default router;
