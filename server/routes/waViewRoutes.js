import express from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middlewares/authMiddleware.js';
import WhatsAppMessage from '../models/WhatsAppMessage.js';
import WhatsAppChat from '../models/WhatsAppChat.js';
import Task from '../models/Task.js';
import User from '../models/userModel.js';
import Project from '../models/Project.js';
import { notifyTaskAssigned, notifyProjectAssigned, initialReminderFields, emitToUser } from '../services/assignmentNotifier.js';
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
 * ההודעות לקריאה בלבד. כתיבה: יצירת מטלות/פרויקטים ליעד + עריכת טקסט של מטלה שהצופה יצר (בלי מחיקה).
 *
 * Coupled: server/services/whatsappMonitorService.js (settings + מדיה),
 *          client/src/pages/WaViewerPage.jsx
 */
const router = express.Router();

// אומת כבר במפתח API (apiKeyAuth ב-app.js)? אחרת — cookie רגיל
router.use((req, res, next) => (req.apiKeyAuth ? next() : requireAuth(req, res, next)), (req, res, next) => {
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

// ============================================================
// ===  מטלות ופרויקטים — יצירה עבור משתמש אחר (User.taskTargetUser)  ===
// ============================================================
// היעד מקבל מיד: socket ('tasks:changed' / 'projects:changed') + Web Push, ותזכורות עד שראה.

const getMeAndTarget = async (userId) => {
    const me = await User.findById(userId).select('name taskTargetUser').lean();
    if (!me?.taskTargetUser) return { me, target: null };
    const target = await User.findById(me.taskTargetUser).select('name').lean();
    return { me, target };
};

/** שם איש הקשר שבמעקב — מוצג אצל היעד כ"מאת …" במקום שם המשתמש של הצופה */
const getTrackedLabel = async () => {
    const { settings, chats } = await getTrackedChats();
    const c = chats[0] || {};
    const t = settings.tracked[0] || {};
    return c.contactName || c.name || t.name || (c.phone || t.phone ? `+${c.phone || t.phone}` : '');
};

/** GET /api/wa-view/assignments — { enabled, targetName, tasks, projects } — מה שאני יצרתי עבור היעד */
router.get('/assignments', async (req, res) => {
    try {
        const { target } = await getMeAndTarget(req.user._id);
        if (!target) return res.json({ enabled: false, targetName: null, tasks: [], projects: [] });
        const [tasks, projects] = await Promise.all([
            Task.find({ userId: target._id, createdBy: req.user._id })
                .select('text isCompleted completedAt seenAt createdAt')
                .sort({ createdAt: -1 }).limit(100).lean(),
            Project.find({ owner: target._id, createdBy: req.user._id })
                .select('projectName description dueDate tasks seenAt createdAt')
                .sort({ createdAt: -1 }).limit(50).lean(),
        ]);
        res.json({
            enabled: true,
            targetName: target.name,
            tasks,
            projects: projects.map((p) => {
                const total = p.tasks?.length || 0;
                const done = (p.tasks || []).filter((t) => t.done).length;
                return {
                    _id: p._id, projectName: p.projectName, description: p.description || '',
                    dueDate: p.dueDate || null, seenAt: p.seenAt, createdAt: p.createdAt,
                    taskCount: total, doneCount: done, progress: total ? Math.round((done / total) * 100) : 0,
                };
            }),
        });
    } catch (err) {
        res.status(500).json({ message: 'שגיאה בשליפת מטלות', error: err.message });
    }
});

/** POST /api/wa-view/tasks { text } — יוצר מטלה שתופיע ב-/tasks של משתמש היעד */
router.post('/tasks', async (req, res) => {
    try {
        const { me, target } = await getMeAndTarget(req.user._id);
        if (!target) return res.status(403).json({ message: 'אין לך הרשאה ליצור מטלות' });
        const text = String(req.body?.text || '').trim();
        if (!text) return res.status(400).json({ message: 'נדרש טקסט למטלה' });
        if (text.length > 2000) return res.status(400).json({ message: 'המטלה ארוכה מדי (עד 2000 תווים)' });

        const sourceLabel = await getTrackedLabel();
        const task = await Task.create({ text, userId: target._id, createdBy: req.user._id, sourceLabel, ...initialReminderFields() });
        notifyTaskAssigned(task, me).catch(() => {});
        res.status(201).json({ _id: task._id, text: task.text, isCompleted: false, seenAt: null, createdAt: task.createdAt });
    } catch (err) {
        res.status(500).json({ message: 'שגיאה ביצירת מטלה', error: err.message });
    }
});

/**
 * PATCH /api/wa-view/tasks/:id { text } — עריכת הטקסט של מטלה שאני יצרתי עבור היעד שלי. טקסט בלבד:
 * אין שינוי בעלות / יעד / סטטוס, ואין מחיקה. הסינון בשרת: _id + createdBy=אני + userId=היעד שהוגדר לי
 * (אם היעד הוחלף — מטלות ליעד הקודם כבר לא ניתנות לעריכה).
 * רק בהתחברות רגילה (cookie + CSRF דרך app.js). מפתח API חסום כאן בכוונה — לא מרחיבים את היקף המפתח.
 */
router.patch('/tasks/:id', async (req, res) => {
    try {
        if (req.apiKeyAuth) return res.status(403).json({ message: 'עריכת מטלות זמינה רק מהממשק (לא במפתח API)' });
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'מזהה מטלה לא תקין' });
        if (typeof req.body?.text !== 'string') return res.status(400).json({ message: 'נדרש טקסט למטלה' });
        const text = req.body.text.trim();
        if (!text) return res.status(400).json({ message: 'נדרש טקסט למטלה' });
        if (text.length > 2000) return res.status(400).json({ message: 'המטלה ארוכה מדי (עד 2000 תווים)' });

        const { target } = await getMeAndTarget(req.user._id);
        if (!target) return res.status(403).json({ message: 'אין לך הרשאה לערוך מטלות' });

        const task = await Task.findOneAndUpdate(
            { _id: req.params.id, createdBy: req.user._id, userId: target._id },
            { $set: { text } },
            { new: true, runValidators: true },
        ).select('text isCompleted completedAt seenAt createdAt userId').lean();
        if (!task) return res.status(404).json({ message: 'המטלה לא נמצאה' });

        emitToUser(task.userId, 'tasks:changed', { taskId: String(task._id), action: 'updated' });
        emitToUser(req.user._id, 'assignments:changed', { kind: 'task' });
        const { userId, ...pub } = task;
        res.json(pub);
    } catch (err) {
        res.status(500).json({ message: 'שגיאה בעדכון מטלה', error: err.message });
    }
});

/**
 * POST /api/wa-view/projects { projectName, description?, dueDate?, tasks?: string[] }
 * יוצר פרויקט שהבעלים שלו הוא משתמש היעד (מופיע ב-/projects שלו)
 */
router.post('/projects', async (req, res) => {
    try {
        const { me, target } = await getMeAndTarget(req.user._id);
        if (!target) return res.status(403).json({ message: 'אין לך הרשאה ליצור פרויקטים' });

        const projectName = String(req.body?.projectName || '').trim();
        if (!projectName) return res.status(400).json({ message: 'נדרש שם לפרויקט' });
        if (projectName.length > 200) return res.status(400).json({ message: 'שם הפרויקט ארוך מדי' });
        const description = String(req.body?.description || '').trim().slice(0, 5000);
        let dueDate;
        if (req.body?.dueDate) {
            dueDate = new Date(req.body.dueDate);
            if (isNaN(dueDate.getTime())) return res.status(400).json({ message: 'תאריך יעד לא תקין' });
        }
        const tasks = (Array.isArray(req.body?.tasks) ? req.body.tasks : [])
            .map((t) => String(t || '').trim())
            .filter(Boolean)
            .slice(0, 100)
            .map((name) => ({ name: name.slice(0, 500), done: false }));

        const sourceLabel = await getTrackedLabel();
        const project = await Project.create({
            sourceLabel,
            owner: target._id,
            projectName,
            description,
            dueDate,
            tasks,
            createdBy: req.user._id,
            ...initialReminderFields(),
        });
        notifyProjectAssigned(project, me).catch(() => {});
        res.status(201).json({ _id: project._id, projectName: project.projectName, createdAt: project.createdAt });
    } catch (err) {
        res.status(500).json({ message: 'שגיאה ביצירת פרויקט', error: err.message });
    }
});

export default router;
