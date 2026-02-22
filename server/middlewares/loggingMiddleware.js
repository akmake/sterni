import Log from '../models/Log.js';
import { UAParser } from 'ua-parser-js';

// נתיבים שלא נרשום
const SKIP_PREFIXES = ['/api/logs', '/api/csrf-token', '/uploads', '/favicon', '/opo.png'];

// ★ ניקוי IP — מסיר את ה-prefix של IPv6 Mapped IPv4
const cleanIP = (raw) => {
  if (!raw) return 'unknown';
  let ip = raw;
  // ::ffff:192.168.1.1 → 192.168.1.1
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  // ::1 → localhost
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
};

export const loggingMiddleware = async (req, res, next) => {
  const skip =
    req.method === 'OPTIONS' ||
    SKIP_PREFIXES.some((p) => req.originalUrl.startsWith(p));
  if (skip) return next();

  try {
    const startTime = Date.now();

    // ★ תיקון: IP אמיתי מאחורי proxy (nginx/cloudflare)
    const rawIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
               || req.headers['x-real-ip']
               || req.ip
               || req.connection?.remoteAddress
               || 'unknown';
    const ipAddress = cleanIP(rawIP);

    const userAgent = req.get('user-agent') || '';
    const referer = req.get('referer') || '';
    const cookieHeader = req.get('cookie') || '';

    // Parse user agent
    let parsed = { browser: {}, os: {}, device: {} };
    try {
      const parser = new UAParser(userAgent);
      parsed = parser.getResult();
    } catch (err) {
      console.warn('Error parsing user agent:', err.message);
    }

    const userId = req.user?._id || null;

    // ★ תיקון: נקרא logData גם מ-body וגם מ-query (ל-GET requests)
    // deviceInfo נשלח מהקליינט רק ב-POST/PATCH/DELETE (דרך body).
    // ב-GET זה ריק, אז אנחנו מסתמכים על ua-parser בלבד.
    const clientData = req.body?.logData || {};

    // Store original end method
    const originalEnd = res.end;
    let isEnded = false;

    res.end = function (...args) {
      if (!isEnded) {
        isEnded = true;

        const responseTime = Date.now() - startTime;

        // שמירה אסינכרונית
        setImmediate(async () => {
          try {
            // ★ זיהוי device type — קודם ua-parser, fallback לנתוני הקליינט
            let deviceType = 'unknown';
            if (parsed.device?.type === 'mobile') deviceType = 'mobile';
            else if (parsed.device?.type === 'tablet') deviceType = 'tablet';
            else if (parsed.device?.type) deviceType = parsed.device.type;
            else {
              // ua-parser לפעמים לא מזהה desktop — אם אין device type, זה desktop
              const ua = userAgent.toLowerCase();
              if (ua.includes('mobile') || ua.includes('android') && !ua.includes('tablet')) deviceType = 'mobile';
              else if (ua.includes('tablet') || ua.includes('ipad')) deviceType = 'tablet';
              else deviceType = 'desktop';
            }

            const logEntry = new Log({
              userId,
              ipAddress,
              userAgent,
              browser: {
                name: parsed.browser?.name || 'Unknown',
                version: parsed.browser?.version || 'Unknown',
              },
              os: {
                name: parsed.os?.name || 'Unknown',
                version: parsed.os?.version || 'Unknown',
                architecture: parsed.cpu?.architecture || clientData.platform || 'Unknown',
              },
              device: deviceType,
              screen: clientData.screen || {},
              processor: {
                cores: clientData.processor?.cores || clientData.hardwareConcurrency || null,
                threads: clientData.processor?.threads || null,
                memory: clientData.processor?.memory || null,
                maxTouchPoints: clientData.processor?.maxTouchPoints || null,
              },
              cookies: {
                enabled: clientData.cookies?.enabled ?? null,
                count: cookieHeader ? cookieHeader.split(';').filter(Boolean).length : 0,
              },
              localStorage: clientData.localStorage || {},
              page: req.originalUrl,
              method: req.method,
              statusCode: res.statusCode,
              responseTime,
              referer,
              userLanguage: clientData.userLanguage || req.get('accept-language')?.split(',')[0] || null,
              timezone: clientData.timezone || null,
              connection: clientData.connection || {},
              platform: clientData.platform || parsed.os?.name || null,
              hardwareConcurrency: clientData.hardwareConcurrency || clientData.processor?.cores || null,
              deviceMemory: clientData.deviceMemory || null,
            });

            await logEntry.save();
          } catch (err) {
            // שגיאת שמירה לא צריכה לקרוס את האפליקציה
            if (!err.message?.includes('buffering timed out')) {
              console.error('Error saving log:', err.message);
            }
          }
        });
      }

      return originalEnd.apply(res, args);
    };

    next();
  } catch (err) {
    console.error('Logging middleware error:', err.message);
    next(); // תמיד ממשיכים — לוגים לא מפילים את האפליקציה
  }
};

export default loggingMiddleware;