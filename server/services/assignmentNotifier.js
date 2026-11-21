import webpush from 'web-push';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import User from '../models/userModel.js';
import UserPushSubscription from '../models/UserPushSubscription.js';

/**
 * assignmentNotifier — מטלות/פרויקטים שמישהו אחר יצר עבורך (Task.createdBy / Project.createdBy):
 *   1. זמן אמת: Socket.IO לחדר `user:<id>` (נכנסים אליו ב-socketService.js)
 *        'tasks:changed'       → TasksPage מרענן
 *        'projects:changed'    → ProjectsPage מרענן
 *        'assignments:changed' → ליוצר (WaViewerPage) — הסטטוס השתנה
 *   2. Web Push מיידי לכל המכשירים של היעד (UserPushSubscription)
 *   3. "חפירה": תזכורות חוזרות עד שהיעד ראה (seenAt) או סיים — ראה REMINDER_SCHEDULE_MIN
 *
 * VAPID: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT, ואם אין — המפתחות של Company OS
 * (COMPANY_VAPID_*). אותו origin ואותו service worker, אז אותם מפתחות עובדים לשניהם.
 *
 * Coupled: server/app.js (attachAssignmentIo + startAssignmentReminderWorker),
 *          server/controllers/taskController.js, projectController.js, server/routes/waViewRoutes.js,
 *          client/public/company-push.js (מטפל ב-payload.app === 'sterni')
 */

const GONE_STATUSES = [404, 410];
// דקות מהיצירה/התזכורת הקודמת עד התזכורת הבאה. אחרי האחרונה — מפסיקים.
const REMINDER_SCHEDULE_MIN = [5, 15, 30, 60, 120, 240];
const QUIET_START_HOUR = 23; // לא מציקים בלילה (שעון ישראל)
const QUIET_END_HOUR = 7;
const TZ = 'Asia/Jerusalem';

let ioRef = null;
export const attachAssignmentIo = (io) => { ioRef = io; };

// ── VAPID ──
const publicKey = () => process.env.VAPID_PUBLIC_KEY || process.env.COMPANY_VAPID_PUBLIC_KEY || '';
const privateKey = () => process.env.VAPID_PRIVATE_KEY || process.env.COMPANY_VAPID_PRIVATE_KEY || '';
const subject = () => process.env.VAPID_SUBJECT || process.env.COMPANY_VAPID_SUBJECT || 'mailto:admin@dahanswebsite.com';
export const isPushConfigured = () => Boolean(publicKey() && privateKey());
export const getPushPublicKey = () => publicKey() || null;

let configuredWith = null;
const ensureVapid = () => {
    if (configuredWith === publicKey()) return;
    webpush.setVapidDetails(subject(), publicKey(), privateKey());
    configuredWith = publicKey();
};

// ── Socket ──
export const emitToUser = (userId, event, payload = {}) => {
    if (!userId) return;
    try { ioRef?.to(`user:${userId}`).emit(event, payload); } catch (_) { /* best-effort */ }
};

// ── Push ──
/** שולח push לכל המכשירים של המשתמש. best-effort, לא זורק. מחזיר כמה נשלחו. */
export const pushToUser = async (userId, payload) => {
    if (!isPushConfigured() || !userId) return 0;
    try {
        ensureVapid();
        const subs = await UserPushSubscription.find({ userId }).lean();
        const body = JSON.stringify({ app: 'sterni', ...payload });
        let sent = 0;
        await Promise.all(subs.map((s) =>
            webpush
                .sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 60 * 60, urgency: 'high' })
                .then(() => { sent++; })
                .catch(async (err) => {
                    if (GONE_STATUSES.includes(err.statusCode)) {
                        await UserPushSubscription.deleteOne({ _id: s._id }).catch(() => {});
                    } else {
                        console.error('[push] שליחה נכשלה:', err.statusCode ?? err.message);
                    }
                })
        ));
        return sent;
    } catch (err) {
        console.error('[push]', err.message);
        return 0;
    }
};

const taskPayload = (task, creatorName, reminder = 0) => ({
    title: reminder ? `⏰ תזכורת: מטלה מ${creatorName}` : `📝 מטלה חדשה מ${creatorName}`,
    body: task.text,
    url: '/tasks',
    tag: `task-${task._id}`,
});

const projectPayload = (project, creatorName, reminder = 0) => ({
    title: reminder ? `⏰ תזכורת: פרויקט מ${creatorName}` : `📁 פרויקט חדש מ${creatorName}`,
    body: project.projectName + (project.description ? ` — ${project.description}` : ''),
    url: `/projects/${project._id}`,
    tag: `project-${project._id}`,
});

const nextReminderDate = (fromDate, count) => {
    const minutes = REMINDER_SCHEDULE_MIN[count];
    if (minutes == null) return null;
    return new Date(fromDate.getTime() + minutes * 60 * 1000);
};

/** נקרא מיד אחרי יצירת מטלה עבור משתמש אחר */
export const notifyTaskAssigned = async (task, creator) => {
    emitToUser(task.userId, 'tasks:changed', { taskId: String(task._id), action: 'created' });
    emitToUser(creator._id, 'assignments:changed', { kind: 'task' });
    await pushToUser(task.userId, taskPayload(task, creator.name || 'משתמש'));
};

/** נקרא מיד אחרי יצירת פרויקט עבור משתמש אחר */
export const notifyProjectAssigned = async (project, creator) => {
    emitToUser(project.owner, 'projects:changed', { projectId: String(project._id), action: 'created' });
    emitToUser(creator._id, 'assignments:changed', { kind: 'project' });
    await pushToUser(project.owner, projectPayload(project, creator.name || 'משתמש'));
};

/** שדות לשמירה ביצירה — מתזמן את התזכורת הראשונה */
export const initialReminderFields = () => ({
    reminderCount: 0,
    nextReminderAt: nextReminderDate(new Date(), 0),
});

// ── Quiet hours ──
const hourInTz = (d) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }).format(d));
const isQuietNow = (d = new Date()) => {
    const h = hourInTz(d);
    return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
};

// ── Reminder worker ──
let workerStarted = false;
let running = false;

const remindBatch = async (Model, buildPayload, ownerField, extraFilter) => {
    const now = new Date();
    const due = await Model.find({
        createdBy: { $ne: null },
        seenAt: null,
        nextReminderAt: { $ne: null, $lte: now },
        ...extraFilter,
    }).limit(50).lean();

    for (const doc of due) {
        const count = (doc.reminderCount || 0) + 1;
        // ננעל את המסמך לפני השליחה כדי לא לשלוח פעמיים אם יש כמה תהליכים
        const next = nextReminderDate(now, count);
        const locked = await Model.updateOne(
            { _id: doc._id, nextReminderAt: doc.nextReminderAt },
            { $set: { reminderCount: count, nextReminderAt: next } }
        );
        if (!locked.modifiedCount) continue;
        const creator = await User.findById(doc.createdBy).select('name').lean();
        await pushToUser(doc[ownerField], buildPayload(doc, creator?.name || 'משתמש', count));
    }
};

const tick = async () => {
    if (running || !isPushConfigured() || isQuietNow()) return;
    running = true;
    try {
        await remindBatch(Task, taskPayload, 'userId', { isCompleted: false });
        await remindBatch(Project, projectPayload, 'owner', {});
    } catch (err) {
        console.error('[assignment-reminders]', err.message);
    } finally {
        running = false;
    }
};

export const startAssignmentReminderWorker = () => {
    if (workerStarted) return;
    workerStarted = true;
    setInterval(tick, 60 * 1000).unref?.();
};
