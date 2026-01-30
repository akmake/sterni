import jwt from 'jsonwebtoken';

// 1. שינינו כאן ל-90 יום (במקום 15 דקות)
const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '90d' });

// גם את ה-Refresh נגדיר ל-90 יום
const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '90d' });

export const createAndSendTokens = (user, res) => {
  const accessToken = signAccessToken({ id: user._id, role: user.role });
  const refreshToken = signRefreshToken({ id: user._id, v: user.tokenVersion });

  const secure = process.env.NODE_ENV === 'production';

  // חישוב של 90 יום באלפיות השנייה
  const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;

  res
    .cookie('jwt', accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: ninetyDaysInMs, // 2. העוגייה תישמר בדפדפן ל-90 יום
    })
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: ninetyDaysInMs, // כנ"ל
    });
};