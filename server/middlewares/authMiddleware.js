import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

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