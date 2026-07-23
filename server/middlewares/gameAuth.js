import jwt from 'jsonwebtoken';
import GameUser from '../models/GameUser.js';

const gameSecret = () =>
  process.env.GAME_JWT_SECRET || process.env.JWT_ACCESS_SECRET;

export function createGameToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      v: user.tokenVersion,
      type: 'game',
    },
    gameSecret(),
    {
      expiresIn: '30d',
      audience: 'rps-game',
      issuer: 'dahanswebsite.com',
    },
  );
}

export async function gameUserForToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, gameSecret(), {
      audience: 'rps-game',
      issuer: 'dahanswebsite.com',
    });
    if (payload.type !== 'game') return null;
    const user = await GameUser.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.v) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireGameAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = await gameUserForToken(token);
  if (!user) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'נדרשת התחברות למשחק' },
    });
  }
  req.gameUser = user;
  next();
}

