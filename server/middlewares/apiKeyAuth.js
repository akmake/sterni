import crypto from 'crypto';
import User from '../models/userModel.js';

/**
 * apiKeyAuth — אימות במפתח API קבוע לגישה אוטומטית (סקריפט/סוכן) ל-/api/wa-view.
 *
 * למה: ה-cookie `jwt` חי 15 דקות ומתחדש רק דרך הדפדפן (api.js). צרכן אוטומטי שמושך את ה-API
 * מקבל 401 כל 15 דקות. מפתח API לא פג — אדמין יוצר/מבטל אותו (PATCH ... /api-key).
 *
 * המפתח נשלח באחת מהדרכים:
 *   Authorization: Bearer wav_xxx   |   X-Api-Key: wav_xxx   |   ?key=wav_xxx (לכלים שלא יכולים לשלוח headers)
 * נשמר רק hash (sha256) ב-User.apiKeyHash. בלי מפתח בבקשה → next() (ממשיכים לאימות cookie הרגיל).
 * מפתח לא תקין → 401. מוגבל ל-role 'wa-viewer' / 'admin' ונרשם רק על /api/wa-view (app.js).
 *
 * Coupled: server/app.js (לפני csrf), server/routes/waViewRoutes.js (req.apiKeyAuth),
 *          server/controllers/adminController.js (create/revoke), loggingMiddleware.js (redact ?key=)
 */

export const API_KEY_PREFIX = 'wav_';
export const hashApiKey = (key) => crypto.createHash('sha256').update(String(key)).digest('hex');
export const generateApiKey = () => API_KEY_PREFIX + crypto.randomBytes(32).toString('base64url');

const extractKey = (req) => {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
    if (req.headers['x-api-key']) return String(req.headers['x-api-key']).trim();
    if (typeof req.query?.key === 'string') return req.query.key.trim();
    return null;
};

export default async function apiKeyAuth(req, res, next) {
    const key = extractKey(req);
    if (!key) return next();
    // אבחון בלי ערך המפתח ובלי query (?key=)
    const fail = (message) => {
        console.warn(`[wa-view 401] API_KEY_INVALID ${req.method} ${(req.originalUrl || '').split('?')[0]} pid=${process.pid}`);
        return res.status(401).json({ message, code: 'API_KEY_INVALID' });
    };
    if (!key.startsWith(API_KEY_PREFIX)) return fail('מפתח API לא תקין');

    try {
        const user = await User.findOne({ apiKeyHash: hashApiKey(key) }).select('_id role').lean();
        if (!user || !['wa-viewer', 'admin'].includes(user.role)) {
            return fail('מפתח API לא תקין או בוטל');
        }
        req.user = { _id: user._id, id: String(user._id), role: user.role };
        req.apiKeyAuth = true;
        next();
    } catch (err) {
        res.status(500).json({ message: 'שגיאה באימות מפתח', error: err.message });
    }
}
