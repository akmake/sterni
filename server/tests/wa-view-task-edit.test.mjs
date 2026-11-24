// PATCH /api/wa-view/tasks/:id — הרשאות + CSRF. ריצה:
//   node --test --experimental-test-module-mocks tests/wa-view-task-edit.test.mjs   (מתוך server/)
// המודלים והשירותים מוחלפים בזיכרון; express, cookie-parser, csurf, jsonwebtoken, requireAuth ו-apiKeyAuth אמיתיים,
// באותו סדר כמו ב-app.js (apiKeyAuth → csrf אם אין מפתח → router).
import assert from 'node:assert/strict';
import { test, mock, before, after } from 'node:test';
import crypto from 'node:crypto';

process.env.JWT_ACCESS_SECRET = 'test-secret';

const rel = (p) => new URL(p, import.meta.url).href;
const oid = () => crypto.randomBytes(12).toString('hex');

const VIEWER = oid();
const OTHER_VIEWER = oid();
const TARGET = oid();
const OTHER_TARGET = oid();
const API_KEY = 'wav_' + crypto.randomBytes(16).toString('hex');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

const users = [
    { _id: VIEWER, name: 'Viewer', role: 'wa-viewer', taskTargetUser: TARGET, apiKeyHash: sha(API_KEY) },
    { _id: OTHER_VIEWER, name: 'Other', role: 'wa-viewer', taskTargetUser: OTHER_TARGET },
    { _id: TARGET, name: 'Target', role: 'user' },
    { _id: OTHER_TARGET, name: 'Target2', role: 'user' },
];
const tasks = [];
const addTask = (createdBy, userId, extra = {}) => {
    const t = { _id: oid(), text: 'מקורי', userId, createdBy, isCompleted: false, seenAt: null, createdAt: new Date(), ...extra };
    tasks.push(t);
    return t;
};
const emitted = [];

const q = (value) => ({
    select() { return this; }, sort() { return this; }, limit() { return this; }, lean() { return this; },
    then(res, rej) { return Promise.resolve(value).then(res, rej); },
});
const eq = (a, b) => String(a) === String(b);

mock.module(rel('../models/userModel.js'), {
    defaultExport: {
        findById: (id) => q(users.find((u) => eq(u._id, id)) || null),
        findOne: (f) => q(users.find((u) => u.apiKeyHash && u.apiKeyHash === f.apiKeyHash) || null),
    },
});
mock.module(rel('../models/Task.js'), {
    defaultExport: {
        findOneAndUpdate: (filter, update) => {
            const t = tasks.find((x) => Object.entries(filter).every(([k, v]) => eq(x[k], v)));
            if (t) Object.assign(t, update.$set);
            return q(t ? { ...t } : null);
        },
        find: () => q([]),
        create: async (d) => d,
    },
});
for (const m of ['../models/WhatsAppMessage.js', '../models/WhatsAppChat.js', '../models/Project.js']) {
    mock.module(rel(m), { defaultExport: { find: () => q([]), findOne: () => q(null), create: async (d) => d } });
}
mock.module(rel('../services/assignmentNotifier.js'), {
    namedExports: {
        notifyTaskAssigned: async () => {}, notifyProjectAssigned: async () => {},
        initialReminderFields: () => ({}),
        emitToUser: (userId, event, payload) => emitted.push({ userId: String(userId), event, payload }),
    },
});
mock.module(rel('../services/whatsappMonitorService.js'), {
    namedExports: {
        getMonitorSettings: async () => ({ tracked: [] }), trackedChatFilter: () => ({}),
        fetchMediaForMessage: async () => ({}), resolveMediaPath: () => null,
    },
});
mock.module(rel('../routes/whatsappMonitorRoutes.js'), { namedExports: { sendMediaFile: () => {} } });

const { default: express } = await import('express');
const { default: cookieParser } = await import('cookie-parser');
const { default: csurf } = await import('csurf');
const { default: jwt } = await import('jsonwebtoken');
const { default: apiKeyAuth } = await import('../middlewares/apiKeyAuth.js');
const { default: waViewRoutes } = await import('../routes/waViewRoutes.js');

const app = express();
app.use(express.json());
app.use(cookieParser());
const csrfProtection = csurf({ cookie: { httpOnly: true, sameSite: 'strict' } });
app.get('/api/csrf-token', csrfProtection, (req, res) => res.json({ csrfToken: req.csrfToken() }));
app.use('/api/wa-view', apiKeyAuth);
app.use((req, res, next) => (req.apiKeyAuth ? next() : csrfProtection(req, res, next)));
app.use('/api/wa-view', waViewRoutes);
app.use((err, req, res, next) => res.status(err.code === 'EBADCSRFTOKEN' ? 403 : 500).json({ message: err.code || err.message }));

let server; let base;
before(async () => {
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());

const jwtCookie = (id, role = 'wa-viewer') => `jwt=${jwt.sign({ id, role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' })}`;

/** session: cookie של jwt + טוקן CSRF תקף (כמו api.js בדפדפן) */
const session = async (id) => {
    const r = await fetch(`${base}/api/csrf-token`);
    const csrfCookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    const { csrfToken } = await r.json();
    return { cookie: `${jwtCookie(id)}; ${csrfCookie}`, csrfToken };
};

const patch = (id, body, headers = {}) => fetch(`${base}/api/wa-view/tasks/${id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('עריכת מטלה עצמית — מצליחה, משנה רק text ומודיעה ליעד', async () => {
    const t = addTask(VIEWER, TARGET, { isCompleted: true, seenAt: new Date() });
    const s = await session(VIEWER);
    emitted.length = 0;
    const r = await patch(t._id, { text: '  טקסט חדש  ', userId: OTHER_TARGET, createdBy: OTHER_VIEWER, isCompleted: false },
        { cookie: s.cookie, 'x-csrf-token': s.csrfToken });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.text, 'טקסט חדש');
    assert.equal(body.userId, undefined, 'userId לא נחשף בתשובה');
    assert.equal(t.text, 'טקסט חדש');
    assert.equal(t.userId, TARGET, 'יעד לא השתנה');
    assert.equal(t.createdBy, VIEWER, 'בעלות לא השתנתה');
    assert.equal(t.isCompleted, true, 'סטטוס לא השתנה');
    assert.deepEqual(emitted.map((e) => [e.userId, e.event]), [[TARGET, 'tasks:changed'], [VIEWER, 'assignments:changed']]);
});

test('מטלה שצופה אחר יצר — 404, בלי שינוי', async () => {
    const t = addTask(OTHER_VIEWER, OTHER_TARGET);
    const s = await session(VIEWER);
    const r = await patch(t._id, { text: 'פריצה' }, { cookie: s.cookie, 'x-csrf-token': s.csrfToken });
    assert.equal(r.status, 404);
    assert.equal(t.text, 'מקורי');
});

test('מטלה שלי ליעד שכבר לא שלי — 404', async () => {
    const t = addTask(VIEWER, OTHER_TARGET);
    const s = await session(VIEWER);
    const r = await patch(t._id, { text: 'x' }, { cookie: s.cookie, 'x-csrf-token': s.csrfToken });
    assert.equal(r.status, 404);
    assert.equal(t.text, 'מקורי');
});

test('בלי טוקן CSRF (cookie בלבד) — 403', async () => {
    const t = addTask(VIEWER, TARGET);
    const s = await session(VIEWER);
    const r = await patch(t._id, { text: 'x' }, { cookie: s.cookie });
    assert.equal(r.status, 403);
    assert.equal(t.text, 'מקורי');
});

test('טוקן CSRF בלי התחברות — 401', async () => {
    const t = addTask(VIEWER, TARGET);
    const s = await session(VIEWER);
    const csrfOnly = s.cookie.split('; ').filter((c) => !c.startsWith('jwt=')).join('; ');
    const r = await patch(t._id, { text: 'x' }, { cookie: csrfOnly, 'x-csrf-token': s.csrfToken });
    assert.equal(r.status, 401);
    assert.equal(t.text, 'מקורי');
});

test('מפתח API — חסום לעריכה (לא מרחיבים את היקף המפתח)', async () => {
    const t = addTask(VIEWER, TARGET);
    const r = await patch(t._id, { text: 'x' }, { authorization: `Bearer ${API_KEY}` });
    assert.equal(r.status, 403);
    assert.equal(t.text, 'מקורי');
});

test('ולידציה: ריק / ארוך מ-2000 / לא מחרוזת / מזהה לא תקין', async () => {
    const t = addTask(VIEWER, TARGET);
    const s = await session(VIEWER);
    const h = { cookie: s.cookie, 'x-csrf-token': s.csrfToken };
    assert.equal((await patch(t._id, { text: '   ' }, h)).status, 400);
    assert.equal((await patch(t._id, { text: 'א'.repeat(2001) }, h)).status, 400);
    assert.equal((await patch(t._id, { text: ['x'] }, h)).status, 400);
    assert.equal((await patch('not-an-id', { text: 'x' }, h)).status, 400);
    assert.equal((await patch(t._id, { text: 'א'.repeat(2000) }, h)).status, 200);
});

test('אין DELETE על מטלות', async () => {
    const t = addTask(VIEWER, TARGET);
    const s = await session(VIEWER);
    const r = await fetch(`${base}/api/wa-view/tasks/${t._id}`, { method: 'DELETE', headers: { cookie: s.cookie, 'x-csrf-token': s.csrfToken } });
    assert.equal(r.status, 404);
    assert.ok(tasks.includes(t));
});
