import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

/* Limiter כללי */
export const publicLimiter = isDev
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    });

/* Limiter ל-/api/products */
export const productsLimiter = isDev
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    });

/* Limiter קשיח לנתיבי אימות (login) — נגד brute-force.
   נספרות רק בקשות שנכשלו, כך שמשתמש לגיטימי לא נחסם. */
export const authLimiter = isDev
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'יותר מדי ניסיונות התחברות. נסה שוב בעוד מספר דקות.' },
    });

/* ברירת-מחדל */
export default publicLimiter;
