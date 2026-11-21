import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

/**
 * נתיבי API (מאחורי requireAuth) שמשתמש בתפקיד 'wa-viewer' רשאי לגשת אליהם — כל השאר → 403.
 * login/logout/refresh לא עוברים דרך requireAuth ולכן פתוחים ממילא.
 */
export const isWaViewerAllowedPath = (req) => {
  const url = req.originalUrl || '';
  if (url.startsWith('/api/wa-view')) return true;
  if (req.method === 'GET' && url.startsWith('/api/auth/profile')) return true;
  if (url.startsWith('/api/auth/change-password')) return true;
  return false;
};

export const requireAuth = async (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({ message: 'לא מחובר' });
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
    return res.status(401).json({ message: 'טוקן לא חוקי / פג תוקף' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'הרשאת מנהל נדרשת' });
  }
  next();
};