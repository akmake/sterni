import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import UserPushSubscription from '../models/UserPushSubscription.js';
import { isPushConfigured, getPushPublicKey, pushToUser, ensurePushKeys } from '../services/assignmentNotifier.js';

/**
 * /api/push — הרשמה להתראות Web Push באפליקציה הראשית (טלפון/מחשב).
 * Coupled: server/services/assignmentNotifier.js, client/src/utils/push.js, client/src/components/PushOptIn.jsx
 */
const router = express.Router();
router.use(requireAuth);

// ── מפתח ציבורי + האם ההתראות מוגדרות בשרת ──
router.get('/config', async (req, res) => {
    await ensurePushKeys();
    res.json({ enabled: isPushConfigured(), publicKey: getPushPublicKey() });
});

// ── האם למכשיר הזה יש מנוי פעיל ──
router.post('/status', async (req, res) => {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.json({ subscribed: false });
    const exists = await UserPushSubscription.exists({ endpoint, userId: req.user._id });
    res.json({ subscribed: !!exists });
});

router.post('/subscribe', async (req, res) => {
    try {
        const { endpoint, keys } = req.body || {};
        if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth) {
            return res.status(400).json({ message: 'מנוי לא תקין' });
        }
        await UserPushSubscription.findOneAndUpdate(
            { endpoint },
            {
                $set: {
                    userId: req.user._id,
                    keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) },
                    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
                },
            },
            { upsert: true }
        );
        res.status(201).json({ subscribed: true });
    } catch (err) {
        res.status(500).json({ message: 'שגיאה בהרשמה להתראות', error: err.message });
    }
});

router.post('/unsubscribe', async (req, res) => {
    await UserPushSubscription.deleteOne({ endpoint: req.body?.endpoint, userId: req.user._id });
    res.json({ subscribed: false });
});

// ── התראת בדיקה לכל המכשירים שלי ──
router.post('/test', async (req, res) => {
    const sent = await pushToUser(req.user._id, {
        title: '🔔 בדיקת התראות',
        body: 'מעולה! ההתראות עובדות במכשיר הזה.',
        url: '/tasks',
        tag: 'push-test',
    });
    res.json({ sent });
});

export default router;
