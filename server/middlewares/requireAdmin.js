export default function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'לא מחובר' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'הרשאת מנהל נדרשת' });
  }

  next();
}
