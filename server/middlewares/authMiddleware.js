import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

/**
 * נתיבי API (מאחורי requireAuth) שמשתמש בתפקיד 'wa-viewer' רשאי לגשת אליהם — כל השאר → 403.
 * login/logout/refresh לא עוברים דרך requireAuth ולכן פתוחים ממילא.
 */
export const isWaViewerAllowedPath = (req) => {
  const url = req.originalUrl || '';
  if (url.startsWith('/api/wa-view')) return true;
  if (url.startsWith('/api/push')) return true; // הרשמה להתראות לטלפון
  if (req.method === 'GET' && url.startsWith('/api/auth/profile')) return true;
  if (url.startsWith('/api/auth/change-password')) return true;
  return false;
};

/**
 * 401 עם קוד סיבה (בלי ערכי טוקן/עוגיות). ב-/api/wa-view גם שורת אבחון ל-pm2 logs:
 * שמות העוגיות שהגיעו (לא ערכים), כמה זמן מאז שהטוקן פג, pid (מזהה הפעלה מחדש / תהליכים מקבילים).
 * NO_TOKEN = הבקשה הגיעה בלי עוגיית jwt · TOKEN_EXPIRED = פג · TOKEN_BAD_SIGNATURE = נחתם בסוד אחר
 * (תהליך/שרת אחר עם JWT_ACCESS_SECRET שונה) · TOKEN_INVALID = פגום.
 */
const authFail = (req, res, code, message, extra = '') => {
  const url = req.originalUrl || '';
  if (url.startsWith('/api/wa-view')) {
    const cookieNames = Object.keys(req.cookies || {}).join(',') || '-';
    const ua = (req.get('user-agent') || '').slice(0, 80);
    console.warn(`[wa-view 401] ${code} ${req.method} ${url.split('?')[0]} cookies=${cookieNames}${extra} pid=${process.pid} ua="${ua}"`);
  }
  return res.status(401).json({ message, code });
};

const tokenErrorCode = (err) => {
  if (err?.name === 'TokenExpiredError') return 'TOKEN_EXPIRED';
  if (err?.message === 'invalid signature') return 'TOKEN_BAD_SIGNATURE';
  return 'TOKEN_INVALID';
};

export const requireAuth = async (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    return authFail(req, res, 'NO_TOKEN', 'לא מחובר');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    // ★ CRITICAL FIX: Convert string ID back to MongoDB ObjectId
    const userId = new mongoose.Types.ObjectId(decoded.id);
    req.user = { 
        _id: userId,
        id: decoded.id,  // string alias for compatibility
        role: decoded.role 
    };

    // משתמש צופה וואצפ — רשאי רק לעמוד הצפייה ולנתיבי ההתחברות
    if (decoded.role === 'wa-viewer' && !isWaViewerAllowedPath(req)) {
      return res.status(403).json({ message: 'למשתמש צופה יש גישה רק לעמוד הצפייה' });
    }
    
    next();
  } catch (err) {
    const extra = err?.expiredAt ? ` expiredAgo=${Math.round((Date.now() - new Date(err.expiredAt).getTime()) / 1000)}s` : '';
    return authFail(req, res, tokenErrorCode(err), 'טוקן לא חוקי / פג תוקף', extra);
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'הרשאת מנהל נדרשת' });
  }
  next();
};