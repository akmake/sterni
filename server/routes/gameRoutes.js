import express from 'express';
import bcrypt from 'bcrypt';
import GameInvite from '../models/GameInvite.js';
import GameMatch from '../models/GameMatch.js';
import GameUser from '../models/GameUser.js';
import {
  createGameToken,
  requireGameAuth,
} from '../middlewares/gameAuth.js';
import {
  gameState,
  isGameUserOnline,
  publicGameUser,
} from '../services/gameSocketService.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

const safe = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.post(
  '/auth/register',
  authLimiter,
  safe(async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const displayName = String(req.body.displayName || '').trim();
    const password = String(req.body.password || '');
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({
        error: {
          code: 'BAD_USERNAME',
          message: 'שם המשתמש חייב להכיל 3–20 אותיות באנגלית, מספרים או קו תחתון',
        },
      });
    }
    if (displayName.length < 2 || displayName.length > 30 || password.length < 8) {
      return res.status(400).json({
        error: {
          code: 'BAD_DETAILS',
          message: 'יש להזין שם תצוגה וסיסמה בת 8 תווים לפחות',
        },
      });
    }
    if (await GameUser.exists({ username })) {
      return res.status(409).json({
        error: { code: 'USERNAME_TAKEN', message: 'שם המשתמש כבר תפוס' },
      });
    }
    const user = await GameUser.create({
      username,
      displayName,
      passwordHash: await bcrypt.hash(password, 12),
    });
    return res.status(201).json({
      token: createGameToken(user),
      user: publicGameUser(user),
    });
  }),
);

router.post(
  '/auth/login',
  authLimiter,
  safe(async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const user = await GameUser.findOne({ username });
    if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) {
      return res.status(401).json({
        error: { code: 'BAD_LOGIN', message: 'שם המשתמש או הסיסמה שגויים' },
      });
    }
    user.lastSeenAt = new Date();
    await user.save();
    return res.json({
      token: createGameToken(user),
      user: publicGameUser(user),
    });
  }),
);

router.use(requireGameAuth);

router.get(
  '/me',
  safe(async (req, res) => {
    const match = await GameMatch.findOne({
      'players.user': req.gameUser._id,
      phase: { $in: ['countdown', 'revealing'] },
    }).sort({ updatedAt: -1 });
    return res.json({
      user: publicGameUser(req.gameUser, Boolean(match)),
      game: match ? await gameState(match) : null,
    });
  }),
);

router.get(
  '/users',
  safe(async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (query.length < 2) return res.json({ users: [] });
    const regex = new RegExp(escapeRegex(query), 'i');
    const users = await GameUser.find({
      _id: { $ne: req.gameUser._id },
      $or: [{ username: regex }, { displayName: regex }],
    })
      .limit(20)
      .lean();
    const activeIds = await GameMatch.distinct('players.user', {
      'players.user': { $in: users.map((user) => user._id) },
      phase: { $in: ['countdown', 'revealing'] },
    });
    const activeSet = new Set(activeIds.map(String));
    return res.json({
      users: users.map((user) =>
        publicGameUser(user, activeSet.has(user._id.toString())),
      ),
    });
  }),
);

router.get(
  '/invites',
  safe(async (req, res) => {
    await GameInvite.updateMany(
      { status: 'pending', expiresAt: { $lte: new Date() } },
      { $set: { status: 'expired' } },
    );
    const invites = await GameInvite.find({
      status: 'pending',
      $or: [{ from: req.gameUser._id }, { to: req.gameUser._id }],
    })
      .sort({ createdAt: -1 })
      .populate('from to', 'username displayName stats');
    return res.json({
      invites: invites.map((invite) => ({
        id: invite._id.toString(),
        from: publicGameUser(invite.from),
        to: publicGameUser(invite.to),
        status: invite.status,
        createdAt: invite.createdAt.getTime(),
        expiresAt: invite.expiresAt.getTime(),
      })),
    });
  }),
);

router.put(
  '/push-token',
  safe(async (req, res) => {
    const token = String(req.body.token || '');
    if (token.length < 20) {
      return res.status(400).json({
        error: { code: 'BAD_TOKEN', message: 'אסימון התראה לא תקין' },
      });
    }
    await GameUser.updateOne(
      { _id: req.gameUser._id },
      { $pull: { pushTokens: { token } } },
    );
    await GameUser.updateOne(
      { _id: req.gameUser._id },
      {
        $push: {
          pushTokens: {
            token,
            platform: 'android',
            updatedAt: new Date(),
          },
        },
      },
    );
    return res.sendStatus(204);
  }),
);

router.post(
  '/auth/logout-all',
  safe(async (req, res) => {
    req.gameUser.tokenVersion += 1;
    await req.gameUser.save();
    return res.sendStatus(204);
  }),
);

export default router;

