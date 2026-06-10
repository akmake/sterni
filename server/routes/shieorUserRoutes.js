import express from 'express';
import { registerUser, getUserData, syncUserData, loginUser } from '../controllers/shieorUserController.js';
import UserData from '../models/UserData.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Per-user sync-token auth. The app stores the token from register/login and sends
// it as `Authorization: Bearer <token>`. Rollout-safe: when SHIEOR_ENFORCE_AUTH !== 'true'
// a missing token is allowed (legacy apps) but a wrong token is always rejected.
const requireSyncAuth = async (req, res, next) => {
  try {
    const auth = req.headers['authorization'];
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    const enforce = process.env.SHIEOR_ENFORCE_AUTH === 'true';

    const user = await UserData.findOne({ userId: req.params.userId }).select('+syncTokenHash');
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });

    if (!token) {
      if (enforce) return res.status(401).json({ message: 'sync token required' });
      req.userData = user; // legacy client — allowed during rollout
      return next();
    }
    if (!user.syncTokenHash || UserData.hashToken(token) !== user.syncTokenHash) {
      return res.status(401).json({ message: 'invalid sync token' });
    }
    req.userData = user;
    next();
  } catch (err) {
    next(err);
  }
};

router.post('/register', authLimiter, registerUser);
router.post('/login',    authLimiter, loginUser);
router.get('/:userId',   requireSyncAuth, getUserData);
router.put('/:userId/sync', requireSyncAuth, syncUserData);

export default router;
