import jwt from 'jsonwebtoken';

// ★ FIX: Access token should be SHORT-LIVED (15 minutes)
const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

// Refresh token can be longer (30 days)
const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });

export const createAndSendTokens = (user, res) => {
  const accessToken = signAccessToken({ id: user._id, role: user.role });
  const refreshToken = signRefreshToken({ id: user._id, v: user.tokenVersion });

  const secure = process.env.NODE_ENV === 'production';

  const fifteenMinMs = 15 * 60 * 1000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  res
    .cookie('jwt', accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: fifteenMinMs,
    })
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: thirtyDaysMs,
    });
};