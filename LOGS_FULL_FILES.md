# קבצי מערכת הלוגים (Log Checking Files)

להלן כל הקבצים המלאים הקשורים למערכת הלוגים (מודל, קונטרולר, ראוטר, מידלוור וצד לקוח).

## 1. `server/models/Log.js`
```javascript
import mongoose from 'mongoose';

const logSchema = new mongoose.Schema(
  {
    // User info (if logged in)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Visitor info
    ipAddress: String,
    userAgent: String,

    // Browser/Device info (parsed from userAgent)
    browser: {
      name: String,
      version: String,
    },

    os: {
      name: String,
      version: String,
      architecture: String,
    },

    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
    },

    // Screen/Display info
    screen: {
      width: Number,
      height: Number,
      availWidth: Number,
      availHeight: Number,
      viewportWidth: Number,
      viewportHeight: Number,
      colorDepth: Number,
      pixelDepth: Number,
      pixelRatio: Number,
      refreshRate: Number,
      isRetina: Boolean,
      orientation: String,
    },

    // Processor info
    processor: {
      cores: Number,
      threads: Number,
      memory: Number,
      maxTouchPoints: Number,
    },

    // Cookies & Storage
    cookies: {
      enabled: Boolean,
      count: Number,
    },

    localStorage: {
      enabled: Boolean,
      size: Number,
    },

    // Page visited
    page: String,
    method: String,
    statusCode: Number,

    // Timing
    responseTime: Number,

    // Headers & Request Info
    referer: String,
    userLanguage: String,
    languages: [String],
    timezone: String,

    // Location (from IP geolocation)
    location: {
      country: String,
      city: String,
      region: String,
      latitude: Number,
      longitude: Number,
    },

    // Connection Info
    connection: {
      effectiveType: String,
      rtt: Number,
      downlink: Number,
      saveData: Boolean,
    },

    // More Device Details
    platform: String,
    hardwareConcurrency: Number,
    deviceMemory: Number,

    // ★ GPU Info
    gpu: {
      vendor: String,
      renderer: String,
    },

    // ★ Battery Info
    battery: {
      level: Number,     // 0-100
      charging: Boolean,
    },

    // ★ User Preferences
    prefersDarkMode: Boolean,
    prefersReducedMotion: Boolean,
    doNotTrack: Boolean,
    isTouchDevice: Boolean,

    // ★ Session Tracking
    session: {
      pageViews: Number,
      durationSeconds: Number,
      isNewSession: Boolean,
    },

    // ★ Media Devices
    mediaDevices: {
      cameras: Number,
      microphones: Number,
      speakers: Number,
    },

    // ★ Detection Flags
    adBlocker: Boolean,
    webdriver: Boolean,          // automation/bot flag
    isOnline: Boolean,
    pdfViewerEnabled: Boolean,
    pluginsCount: Number,

    // ★ Fingerprinting
    fingerprint: String,
    canvasFingerprint: String,
    webglFingerprint: String,

    // ★ Browser Capabilities
    webGLSupported: Boolean,
    serviceWorkerSupported: Boolean,
    notificationPermission: String,

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'logs',
  }
);

logSchema.index({ timestamp: -1 });
logSchema.index({ userId: 1, timestamp: -1 });
logSchema.index({ ipAddress: 1 });
logSchema.index({ 'browser.name': 1 });
logSchema.index({ device: 1 });
// TTL: מחיקה אוטומטית של לוגים אחרי 90 יום
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model('Log', logSchema);
```

## 2. `server/controllers/logsController.js`
```javascript
import Log from '../models/Log.js';
import SystemConfig from '../models/SystemConfig.js';
import catchAsync from '../utils/catchAsync.js';
import { refreshLoggingCache, deviceInfoCache, makeDeviceKey } from '../middlewares/loggingMiddleware.js';

// ★ Receive device info ping from client (called once on app load)
export const receiveDevicePing = (req, res) => {
  try {
    const rawIP = req.headers['cf-connecting-ip']
               || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
               || req.headers['x-real-ip']
               || req.ip
               || req.connection?.remoteAddress
               || 'unknown';
    let ip = rawIP;
    if (ip.startsWith('::ffff:')) ip = ip.slice(7);
    if (ip === '::1') ip = '127.0.0.1';

    const ua = req.get('user-agent') || '';
    const key = makeDeviceKey(ip, ua);

    deviceInfoCache.set(key, {
      data: req.body || {},
      timestamp: Date.now(),
    });

    // Cleanup old entries (older than 2 hours)
    const now = Date.now();
    for (const [k, v] of deviceInfoCache) {
      if (now - v.timestamp > 2 * 60 * 60 * 1000) deviceInfoCache.delete(k);
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(200).json({ ok: false });
  }
};

// ★ Toggle logging on/off
export const toggleLogging = catchAsync(async (req, res) => {
  const { enabled } = req.body;

  let config = await SystemConfig.findOne();
  if (!config) {
    config = await SystemConfig.create({ loggingEnabled: !!enabled });
  } else {
    config.loggingEnabled = !!enabled;
    await config.save();
  }

  // רענון מיידי של ה-cache ב-middleware — בלי לחכות 10 שניות
  refreshLoggingCache(config.loggingEnabled);

  console.log(`📊 Logging ${config.loggingEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);

  res.status(200).json({
    status: 'success',
    loggingEnabled: config.loggingEnabled,
  });
});

// ★ Get logging status
export const getLoggingStatus = catchAsync(async (req, res) => {
  const config = await SystemConfig.findOne().lean();
  res.status(200).json({
    status: 'success',
    loggingEnabled: config?.loggingEnabled === true,
  });
});

// Get all logs (admin only)
export const getAllLogs = catchAsync(async (req, res) => {
  const { limit = 100, skip = 0, startDate, endDate, userId, ipAddress, device } = req.query;

  const filter = {};

  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate);
    if (endDate) filter.timestamp.$lte = new Date(endDate);
  }

  if (userId) filter.userId = userId;

  // חיפוש חלקי של IP
  if (ipAddress) {
    filter.ipAddress = { $regex: ipAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  if (device && device !== 'all') filter.device = device;

  const logs = await Log.find(filter)
    .populate('userId', 'name email')
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  const total = await Log.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    total,
    count: logs.length,
    data: logs,
  });
});

// Get logs summary/analytics
export const getLogsSummary = catchAsync(async (req, res) => {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [dailyVisitors, weeklyVisitors, monthlyVisitors] = await Promise.all([
    Log.countDocuments({ timestamp: { $gte: last24Hours } }),
    Log.countDocuments({ timestamp: { $gte: last7Days } }),
    Log.countDocuments({ timestamp: { $gte: last30Days } }),
  ]);

  const [uniqueIPs, uniqueUsers] = await Promise.all([
    Log.distinct('ipAddress'),
    Log.distinct('userId'),
  ]);

  const topBrowsers = await Log.aggregate([
    { $group: { _id: '$browser.name', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const topDevices = await Log.aggregate([
    { $group: { _id: '$device', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const topOS = await Log.aggregate([
    { $group: { _id: '$os.name', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const topPages = await Log.aggregate([
    { $group: { _id: '$page', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const uniqueIPsToday = await Log.distinct('ipAddress', { timestamp: { $gte: last24Hours } });

  const avgResponseAgg = await Log.aggregate([
    { $match: { timestamp: { $gte: last24Hours } } },
    { $group: { _id: null, avg: { $avg: '$responseTime' } } },
  ]);
  const avgResponseTime = avgResponseAgg[0]?.avg || 0;

  const topIPs = await Log.aggregate([
    { $match: { timestamp: { $gte: last7Days } } },
    { $group: { _id: '$ipAddress', count: { $sum: 1 }, lastSeen: { $max: '$timestamp' } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  res.status(200).json({
    status: 'success',
    summary: {
      last24Hours: dailyVisitors,
      last7Days: weeklyVisitors,
      last30Days: monthlyVisitors,
      uniqueIPs: uniqueIPs.length,
      uniqueIPsToday: uniqueIPsToday.length,
      uniqueUsers: uniqueUsers.filter(Boolean).length,
      avgResponseTime: Math.round(avgResponseTime),
    },
    analytics: {
      topBrowsers,
      topDevices,
      topOS,
      topPages,
      topIPs,
    },
  });
});

// Get user's own logs
export const getMyLogs = catchAsync(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ status: 'fail', message: 'You are not logged in' });
  }

  const { limit = 50, skip = 0 } = req.query;

  const logs = await Log.find({ userId: req.user._id })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  const total = await Log.countDocuments({ userId: req.user._id });

  res.status(200).json({ status: 'success', total, count: logs.length, data: logs });
});

// Delete old logs
export const deleteOldLogs = catchAsync(async (req, res) => {
  const days = req.body.days || 90;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const result = await Log.deleteMany({ timestamp: { $lt: cutoffDate } });

  res.status(200).json({
    status: 'success',
    message: `נמחקו ${result.deletedCount} לוגים ישנים מ-${days} ימים`,
    deletedCount: result.deletedCount,
  });
});

// Delete ALL logs
export const deleteAllLogs = catchAsync(async (req, res) => {
  const result = await Log.deleteMany({});

  res.status(200).json({
    status: 'success',
    message: `נמחקו ${result.deletedCount} לוגים`,
    deletedCount: result.deletedCount,
  });
});

// ★ User Activity Summary — aggregated login/activity data per user
export const getUserActivitySummary = catchAsync(async (req, res) => {
  const { days = 30 } = req.query;
  const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

  // Aggregate by userId — only logged-in users
  const userActivity = await Log.aggregate([
    { $match: { userId: { $ne: null }, timestamp: { $gte: since } } },
    {
      $group: {
        _id: '$userId',
        totalVisits: { $sum: 1 },
        firstSeen: { $min: '$timestamp' },
        lastSeen: { $max: '$timestamp' },
        uniqueIPs: { $addToSet: '$ipAddress' },
        devices: { $addToSet: '$device' },
        browsers: { $addToSet: '$browser.name' },
        operatingSystems: { $addToSet: '$os.name' },
        uniqueFingerprints: { $addToSet: '$fingerprint' },
        avgResponseTime: { $avg: '$responseTime' },
        pages: { $push: '$page' },
        locations: { $addToSet: { country: '$location.country', city: '$location.city' } },
      },
    },
    { $sort: { lastSeen: -1 } },
  ]);

  // Populate user info
  const User = (await import('mongoose')).default.model('User');
  const userIds = userActivity.map(u => u._id);
  const users = await User.find({ _id: { $in: userIds } }).select('name email role').lean();
  const userMap = {};
  users.forEach(u => { userMap[u._id.toString()] = u; });

  const data = userActivity.map(entry => {
    const user = userMap[entry._id.toString()] || {};
    // Count unique pages (remove duplicates)
    const uniquePages = [...new Set(entry.pages)].length;
    // Clean up locations (remove null entries)
    const locations = entry.locations.filter(l => l.country && l.country !== 'Unknown');

    return {
      userId: entry._id,
      name: user.name || 'משתמש לא ידוע',
      email: user.email || '',
      role: user.role || '',
      totalVisits: entry.totalVisits,
      firstSeen: entry.firstSeen,
      lastSeen: entry.lastSeen,
      uniqueIPs: entry.uniqueIPs.filter(Boolean),
      devices: entry.devices.filter(Boolean),
      browsers: entry.browsers.filter(Boolean),
      operatingSystems: entry.operatingSystems.filter(Boolean),
      uniqueFingerprints: entry.uniqueFingerprints.filter(Boolean).length,
      avgResponseTime: Math.round(entry.avgResponseTime || 0),
      uniquePages,
      locations,
    };
  });

  // Summary stats
  const totalUsers = data.length;
  const totalVisits = data.reduce((s, d) => s + d.totalVisits, 0);
  const avgVisitsPerUser = totalUsers > 0 ? Math.round(totalVisits / totalUsers) : 0;

  // Most active users (top 5)
  const mostActive = [...data].sort((a, b) => b.totalVisits - a.totalVisits).slice(0, 5);

  // Device breakdown across all users
  const deviceBreakdown = {};
  data.forEach(d => d.devices.forEach(dev => { deviceBreakdown[dev] = (deviceBreakdown[dev] || 0) + 1; }));

  res.status(200).json({
    status: 'success',
    period: { days: parseInt(days), since },
    summary: { totalUsers, totalVisits, avgVisitsPerUser },
    mostActive,
    deviceBreakdown,
    data,
  });
});

export default { receiveDevicePing, toggleLogging, getLoggingStatus, getAllLogs, getLogsSummary, getMyLogs, deleteOldLogs, deleteAllLogs, getUserActivitySummary };
```

## 3. `server/routes/logsRoutes.js`
```javascript
import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import {
  getAllLogs,
  getLogsSummary,
  getMyLogs,
  deleteOldLogs,
  deleteAllLogs,
  toggleLogging,
  getLoggingStatus,
  receiveDevicePing,
  getUserActivitySummary,
} from '../controllers/logsController.js';

const router = express.Router();

// ★ Device ping — client sends device info once, stored in server cache
router.post('/device-ping', receiveDevicePing);

// ★ Toggle + Status — שליטה על הלוגים
router.post('/admin/toggle', requireAuth, requireAdmin, toggleLogging);
router.get('/admin/status', requireAuth, requireAdmin, getLoggingStatus);

// Admin routes
router.get('/admin/all', requireAuth, requireAdmin, getAllLogs);
router.get('/admin/summary', requireAuth, requireAdmin, getLogsSummary);
router.get('/admin/user-activity', requireAuth, requireAdmin, getUserActivitySummary);

// User routes
router.get('/my-logs', requireAuth, getMyLogs);

// Cleanup
router.delete('/admin/cleanup', requireAuth, requireAdmin, deleteOldLogs);
router.delete('/admin/delete-all', requireAuth, requireAdmin, deleteAllLogs);

export default router;
```

## 4. `server/middlewares/loggingMiddleware.js`
```javascript
import Log from '../models/Log.js';
import SystemConfig from '../models/SystemConfig.js';
import { UAParser } from 'ua-parser-js';
import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// ★ Device info cache — filled by POST /api/logs/device-ping
// Key = hash(ip + userAgent), Value = { data, timestamp }
export const deviceInfoCache = new Map();
const DEVICE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Helper to create consistent cache key
export const makeDeviceKey = (ip, ua) => {
  return crypto.createHash('md5').update(`${ip}||${ua}`).digest('hex');
};

// Cache for geolocation data to avoid excessive API calls
const geoCache = new Map();
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// נתיבים שלא נרשום לעולם
const SKIP_PREFIXES = ['/api/logs', '/api/csrf-token', '/uploads', '/favicon', '/opo.png'];

// ★ Cache של הגדרת loggingEnabled — כדי לא לפנות ל-DB בכל request
let loggingEnabledCache = false;
let cacheTimestamp = 0;
const CACHE_TTL = 10_000; // רענון כל 10 שניות

const isLoggingEnabled = async () => {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL) return loggingEnabledCache;

  try {
    const config = await SystemConfig.findOne().lean();
    loggingEnabledCache = config?.loggingEnabled === true;
    cacheTimestamp = now;
  } catch (err) {
    // אם DB נפל — משתמשים ב-cache האחרון
  }
  return loggingEnabledCache;
};

// ★ פונקציה חיצונית שמאפשרת לרענן את ה-cache מיד (נקראת כשמשנים הגדרה)
export const refreshLoggingCache = (value) => {
  loggingEnabledCache = value;
  cacheTimestamp = Date.now();
};

// ניקוי IP
const cleanIP = (raw) => {
  if (!raw) return 'unknown';
  let ip = raw;
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
};

// Get geolocation from IP with caching
const getGeolocation = async (ipAddress) => {
  // Skip for localhost
  if (ipAddress === '127.0.0.1' || ipAddress === 'unknown') {
    return { country: 'Local', city: 'Localhost' };
  }

  // Check cache first
  if (geoCache.has(ipAddress)) {
    const cached = geoCache.get(ipAddress);
    if (Date.now() - cached.timestamp < GEO_CACHE_TTL) {
      return cached.data;
    }
    geoCache.delete(ipAddress);
  }

  try {
    // Using ip-api.com free API (45 requests per minute limit)
    const response = await axios.get(`http://ip-api.com/json/${ipAddress}?fields=country,city,region,lat,lon`, {
      timeout: 2000, // 2 seconds timeout
    });

    if (response.data.status === 'success') {
      const location = {
        country: response.data.country || 'Unknown',
        city: response.data.city || 'Unknown',
        region: response.data.region || 'Unknown',
        latitude: response.data.lat || null,
        longitude: response.data.lon || null,
      };

      // Cache the result
      geoCache.set(ipAddress, { data: location, timestamp: Date.now() });
      return location;
    }
  } catch (err) {
    // Silently fail and return default
    console.warn(`Geolocation lookup failed for IP ${ipAddress}: ${err.message}`);
  }

  return { country: 'Unknown', city: 'Unknown' };
};

export const loggingMiddleware = async (req, res, next) => {
  const skip =
    req.method === 'OPTIONS' ||
    SKIP_PREFIXES.some((p) => req.originalUrl.startsWith(p));
  if (skip) return next();

  // ★ בדיקה: אם הלוגים כבויים — ממשיכים בלי לשמור כלום
  const enabled = await isLoggingEnabled();
  if (!enabled) return next();

  try {
    const startTime = Date.now();

    // IP אמיתי מאחורי proxy
    const rawIP = req.headers['cf-connecting-ip']
               || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
               || req.headers['x-real-ip']
               || req.ip
               || req.connection?.remoteAddress
               || 'unknown';
    const ipAddress = cleanIP(rawIP);

    let finalIP = ipAddress;

    const userAgent = req.get('user-agent') || '';
    const referer = req.get('referer') || '';
    const cookieHeader = req.get('cookie') || '';

    // Parse user agent
    let parsed = { browser: {}, os: {}, device: {}, cpu: {} };
    try {
      const parser = new UAParser(userAgent);
      parsed = parser.getResult();
    } catch (err) {
      console.warn('Error parsing user agent:', err.message);
    }

    const userId = req.user?._id || null;

    // ★ If req.user is not set yet (logging runs before auth middleware),
    //   try to extract userId directly from the JWT cookie
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      try {
        const token = req.cookies?.jwt;
        if (token && process.env.JWT_ACCESS_SECRET) {
          const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
          if (decoded?.id) {
            resolvedUserId = new mongoose.Types.ObjectId(decoded.id);
          }
        }
      } catch (e) { /* expired/invalid token — ignore */ }
    }

    // ★ Read client device info from 3 sources (priority order):
    // 1. X-Device-Info header (sent on every request)
    // 2. Server-side device cache (filled by POST /api/logs/device-ping)
    // 3. req.body.logData (legacy fallback)
    let clientData = {};

    // Source 1: Header
    try {
      const headerVal = req.headers['x-device-info'];
      if (headerVal) {
        clientData = JSON.parse(decodeURIComponent(escape(Buffer.from(headerVal, 'base64').toString('binary'))));
      }
    } catch (e) { /* parsing error, try next source */ }

    // Source 2: Device cache (from device-ping endpoint)
    if (!clientData || !Object.keys(clientData).length) {
      try {
        const devKey = makeDeviceKey(ipAddress, userAgent);
        const cached = deviceInfoCache.get(devKey);
        if (cached && (Date.now() - cached.timestamp < DEVICE_CACHE_TTL)) {
          clientData = cached.data;
        }
      } catch (e) { /* ignore */ }
    }

    // Source 3: Body fallback
    if (!clientData || !Object.keys(clientData).length) {
      clientData = req.body?.logData || {};
    }

    // ★ Use client-reported public IP when server-detected IP is localhost
    if (clientData.publicIP && (finalIP === '127.0.0.1' || finalIP === 'unknown' || finalIP === '::1')) {
      finalIP = cleanIP(clientData.publicIP);
    }

    const originalEnd = res.end;
    let isEnded = false;

    res.end = function (...args) {
      if (!isEnded) {
        isEnded = true;
        const responseTime = Date.now() - startTime;

        setImmediate(async () => {
          try {
            // זיהוי device type
            let deviceType = 'unknown';
            if (parsed.device?.type === 'mobile') deviceType = 'mobile';
            else if (parsed.device?.type === 'tablet') deviceType = 'tablet';
            else if (parsed.device?.type) deviceType = parsed.device.type;
            else {
              const ua = userAgent.toLowerCase();
              if (ua.includes('mobile') || (ua.includes('android') && !ua.includes('tablet'))) deviceType = 'mobile';
              else if (ua.includes('tablet') || ua.includes('ipad')) deviceType = 'tablet';
              else deviceType = 'desktop';
            }

            // Get geolocation from IP
            const location = await getGeolocation(finalIP);

            const logEntry = new Log({
              userId: resolvedUserId,
              ipAddress: finalIP,
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
              screen: {
                ...(clientData.screen || {}),
                orientation: clientData.screen?.orientation || null,
              },
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
              languages: clientData.languages || [],
              timezone: clientData.timezone || null,
              connection: clientData.connection || {},
              platform: clientData.platform || parsed.os?.name || null,
              hardwareConcurrency: clientData.hardwareConcurrency || clientData.processor?.cores || null,
              deviceMemory: clientData.deviceMemory || null,
              location,
              // ★ New fields
              gpu: clientData.gpu || null,
              battery: clientData.battery || null,
              prefersDarkMode: clientData.prefersDarkMode ?? null,
              prefersReducedMotion: clientData.prefersReducedMotion ?? null,
              doNotTrack: clientData.doNotTrack ?? null,
              isTouchDevice: clientData.isTouchDevice ?? null,
              session: clientData.session || null,
              mediaDevices: clientData.mediaDevices || null,
              adBlocker: clientData.adBlocker ?? null,
              webdriver: clientData.webdriver ?? null,
              isOnline: clientData.isOnline ?? null,
              pdfViewerEnabled: clientData.pdfViewerEnabled ?? null,
              pluginsCount: clientData.pluginsCount ?? null,
              // ★ Fingerprinting
              fingerprint: clientData.fingerprint || null,
              canvasFingerprint: clientData.canvasFingerprint || null,
              webglFingerprint: clientData.webglFingerprint || null,
              // ★ Browser Capabilities
              webGLSupported: clientData.webGLSupported ?? null,
              serviceWorkerSupported: clientData.serviceWorkerSupported ?? null,
              notificationPermission: clientData.notificationPermission || null,
            });

            await logEntry.save();
          } catch (err) {
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
    next();
  }
};

export default loggingMiddleware;
```

## 5. `client/src/pages/AdminLogsPage.jsx`
```jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';
import { toast } from 'react-hot-toast';
import {
  Eye, EyeOff, Download, Trash2, RefreshCw, Activity,
  Monitor, Smartphone, Tablet, HelpCircle, Globe, Clock,
  Wifi, Cpu, ChevronDown, ChevronUp, Users, Zap, Search, X, Power, Cookie, MapPin,
  BatteryCharging, Shield, Fingerprint, MousePointer, Sun, Moon, Bot, Video, Mic,
  FileText, Layers, Bell, BellOff, Gauge, HardDrive,
  BarChart3, TrendingUp, Hash, Plug, ScreenShare
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════

const DeviceIcon = ({ type, size = 16 }) => {
  const map = { desktop: <Monitor size={size} />, mobile: <Smartphone size={size} />, tablet: <Tablet size={size} /> };
  return map[type] || <HelpCircle size={size} />;
};

const OSIcon = ({ name }) => {
  const n = (name || '').toLowerCase();
  if (n.includes('windows')) return '🪟';
  if (n.includes('mac') || n.includes('ios')) return '🍎';
  if (n.includes('android')) return '🤖';
  if (n.includes('linux') || n.includes('ubuntu')) return '🐧';
  return '💻';
};

const StatusDot = ({ code }) => {
  if (code >= 200 && code < 300) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />;
  if (code >= 400 && code < 500) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]" />;
  if (code >= 500) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.7)]" />;
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />;
};

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `לפני ${diff} שניות`;
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דקות`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שעות`;
  return new Date(date).toLocaleDateString('he-IL') + ' ' + new Date(date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0 שנ׳';
  if (seconds < 60) return `${seconds} שנ׳`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} דק׳`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} שע׳ ${m} דק׳`;
};

const yn = (v) => v === true ? 'כן' : v === false ? 'לא' : '—';
const ynCSV = (v) => v === true ? 'Yes' : v === false ? 'No' : '';

// ════════════════════════════════════════════════════════════
//  SUB COMPONENTS
// ════════════════════════════════════════════════════════════

const StatCard = ({ icon, label, value, color = 'blue', subtitle }) => {
  const c = {
    blue:   'from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-400',
    green:  'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20 text-purple-400',
    amber:  'from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-400',
    cyan:   'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 text-cyan-400',
    rose:   'from-rose-500/10 to-rose-600/5 border-rose-500/20 text-rose-400',
    indigo: 'from-indigo-500/10 to-indigo-600/5 border-indigo-500/20 text-indigo-400',
    teal:   'from-teal-500/10 to-teal-600/5 border-teal-500/20 text-teal-400',
  }[color] || 'from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-400';

  return (
    <div className={`bg-gradient-to-br ${c} border rounded-2xl p-5 transition-all hover:scale-[1.02] hover:shadow-lg`}>
      <div className="opacity-70 mb-3">{icon}</div>
      <div className="text-3xl font-black text-slate-100 tracking-tight">{value}</div>
      <div className="text-sm text-slate-400 mt-1 font-medium">{label}</div>
      {subtitle && <div className="text-[10px] text-slate-500 mt-0.5">{subtitle}</div>}
    </div>
  );
};

const MiniBar = ({ items = [], color = 'blue' }) => {
  const max = items[0]?.count || 1;
  const barColor = {
    blue: 'bg-blue-500', green: 'bg-emerald-500', purple: 'bg-purple-500',
    amber: 'bg-amber-500', cyan: 'bg-cyan-500', rose: 'bg-rose-500',
  }[color] || 'bg-blue-500';

  return (
    <div className="space-y-2.5">
      {items.slice(0, 6).map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <span className="text-sm text-slate-300 w-28 truncate text-left font-medium">{item._id || 'Unknown'}</span>
          <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }} />
          </div>
          <span className="text-xs text-slate-400 font-mono w-8 text-left">{item.count}</span>
        </div>
      ))}
    </div>
  );
};

const SectionHeader = ({ icon, title, color = 'text-blue-400' }) => (
  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-700/40">
    <span className={color}>{icon}</span>
    <span className="text-xs font-bold text-slate-300 tracking-wide uppercase">{title}</span>
  </div>
);

const Detail = ({ icon, label, value, mono, small, className = '' }) => (
  <div className={className}>
    <div className="flex items-center gap-1 text-slate-500 text-[11px] mb-0.5">{icon}<span>{label}</span></div>
    <div className={`text-slate-200 ${mono ? 'font-mono' : ''} ${small ? 'text-[11px] break-all' : 'text-sm'}`}>
      {value ?? '—'}
    </div>
  </div>
);

const Badge = ({ icon, text, color }) => (
  <span className={`inline-flex items-center gap-1 ${color} px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap`}>
    {icon} {text}
  </span>
);

// ════════════════════════════════════════════════════════════
//  LOG ROW — Collapsed + expanded detail view
// ════════════════════════════════════════════════════════════

const LogRow = ({ log, isExpanded, onToggle }) => {
  const hasFP = log.fingerprint || log.canvasFingerprint || log.webglFingerprint;

  return (
    <div className={`border-b border-slate-700/50 transition-all cursor-pointer ${isExpanded ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'}`} onClick={onToggle}>
      {/* ── Collapsed row ── */}
      <div className="px-5 py-3.5 flex items-center gap-4">
        <div className="text-slate-400 shrink-0"><DeviceIcon type={log.device} size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-slate-200">{log.ipAddress}</span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-sm text-slate-400">{log.browser?.name || '?'} {log.browser?.version?.split('.')[0] || ''}</span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-sm text-slate-400"><OSIcon name={log.os?.name} /> {log.os?.name || '?'}</span>
            {log.location?.city && log.location.city !== 'Unknown' && (
              <>
                <span className="text-slate-500 text-xs">•</span>
                <span className="text-sm text-slate-500 flex items-center gap-0.5"><MapPin size={11} /> {log.location.city}</span>
              </>
            )}
            {hasFP && <Fingerprint size={12} className="text-indigo-400 opacity-60" />}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            <span className={`font-bold mr-1 ${log.method === 'GET' ? 'text-emerald-500/70' : log.method === 'POST' ? 'text-amber-500/70' : log.method === 'DELETE' ? 'text-red-500/70' : 'text-blue-500/70'}`}>
              {log.method}
            </span>
            {log.page}
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {/* Quick mini badges */}
          <div className="hidden lg:flex items-center gap-1.5">
            {log.webdriver && <span title="בוט / אוטומציה" className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center"><Bot size={10} className="text-orange-300" /></span>}
            {log.adBlocker && <span title="Ad Blocker" className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center"><Shield size={10} className="text-red-300" /></span>}
            {log.isTouchDevice && <span title="Touch" className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center"><MousePointer size={10} className="text-purple-300" /></span>}
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot code={log.statusCode} />
            <span className="text-xs font-mono text-slate-400">{log.statusCode}</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">{log.responseTime}ms</span>
          <span className="text-xs text-slate-500 hidden sm:block">{timeAgo(log.timestamp)}</span>
          {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-700/30" onClick={(e) => e.stopPropagation()}>

          {/* ★ BADGES */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {log.userId && <Badge icon={<Users size={10} />} text={log.userId?.name || 'משתמש רשום'} color="bg-blue-500/15 text-blue-300 border border-blue-500/25" />}
            {log.session?.isNewSession && <Badge icon="✨" text="סשן חדש" color="bg-emerald-500/15 text-emerald-300 border border-emerald-500/25" />}
            {log.isTouchDevice && <Badge icon={<MousePointer size={10} />} text="מסך מגע" color="bg-purple-500/15 text-purple-300 border border-purple-500/25" />}
            {log.prefersDarkMode === true && <Badge icon={<Moon size={10} />} text="מצב כהה" color="bg-slate-500/20 text-slate-300 border border-slate-500/25" />}
            {log.prefersDarkMode === false && <Badge icon={<Sun size={10} />} text="מצב בהיר" color="bg-amber-500/15 text-amber-300 border border-amber-500/25" />}
            {log.doNotTrack && <Badge icon={<Shield size={10} />} text="DNT" color="bg-rose-500/15 text-rose-300 border border-rose-500/25" />}
            {log.adBlocker && <Badge icon={<Shield size={10} />} text="Ad Blocker" color="bg-red-500/15 text-red-300 border border-red-500/25" />}
            {log.webdriver && <Badge icon={<Bot size={10} />} text="בוט/אוטומציה" color="bg-orange-500/15 text-orange-300 border border-orange-500/25" />}
            {log.battery?.charging && <Badge icon={<BatteryCharging size={10} />} text="בטעינה" color="bg-green-500/15 text-green-300 border border-green-500/25" />}
            {log.isOnline === false && <Badge icon={<Wifi size={10} />} text="אופליין" color="bg-red-500/15 text-red-300 border border-red-500/25" />}
            {log.prefersReducedMotion && <Badge icon={<Gauge size={10} />} text="אנימציות מופחתות" color="bg-teal-500/15 text-teal-300 border border-teal-500/25" />}
            {log.connection?.saveData && <Badge icon={<Wifi size={10} />} text="חיסכון בנתונים" color="bg-yellow-500/15 text-yellow-300 border border-yellow-500/25" />}
            {log.webGLSupported === false && <Badge icon={<Layers size={10} />} text="ללא WebGL" color="bg-gray-500/15 text-gray-300 border border-gray-500/25" />}
            {log.pdfViewerEnabled && <Badge icon={<FileText size={10} />} text="PDF Viewer" color="bg-indigo-500/15 text-indigo-300 border border-indigo-500/25" />}
            {log.serviceWorkerSupported && <Badge icon={<Zap size={10} />} text="SW" color="bg-cyan-500/15 text-cyan-300 border border-cyan-500/25" />}
            {log.notificationPermission === 'granted' && <Badge icon={<Bell size={10} />} text="התראות מאושרות" color="bg-emerald-500/15 text-emerald-300 border border-emerald-500/25" />}
            {log.notificationPermission === 'denied' && <Badge icon={<BellOff size={10} />} text="התראות חסומות" color="bg-red-500/15 text-red-300 border border-red-500/25" />}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-4">

              {/* 🌐 Network & Location */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<Globe size={14} />} title="רשת ומיקום" color="text-blue-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <Detail icon={<Globe size={12} />} label="IP" value={log.ipAddress} mono />
                  {log.location?.country && (
                    <Detail icon={<MapPin size={12} />} label="מיקום" value={`${log.location.city || ''} ${log.location.region ? `· ${log.location.region}` : ''} ${log.location.country ? `(${log.location.country})` : ''}`.trim()} />
                  )}
                  {log.location?.latitude != null && log.location?.longitude != null && (
                    <Detail icon={<MapPin size={12} />} label="קואורדינטות" value={`${log.location.latitude?.toFixed(4)}, ${log.location.longitude?.toFixed(4)}`} mono small />
                  )}
                  {log.connection?.effectiveType && <Detail icon={<Wifi size={12} />} label="חיבור" value={log.connection.effectiveType.toUpperCase()} />}
                  {log.connection?.rtt != null && <Detail icon={<Zap size={12} />} label="RTT" value={`${log.connection.rtt}ms`} mono />}
                  {log.connection?.downlink != null && <Detail icon={<Zap size={12} />} label="Downlink" value={`${log.connection.downlink} Mbps`} mono />}
                  <Detail icon={<Wifi size={12} />} label="אונליין" value={yn(log.isOnline)} />
                </div>
              </div>

              {/* 🖥️ System */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<Monitor size={14} />} title="מערכת" color="text-emerald-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <Detail icon={<Monitor size={12} />} label="מערכת הפעלה" value={`${log.os?.name || '?'} ${log.os?.version || ''}`} />
                  <Detail icon={<Globe size={12} />} label="דפדפן" value={`${log.browser?.name || '?'} ${log.browser?.version || ''}`} />
                  <Detail icon={<DeviceIcon type={log.device} size={12} />} label="סוג התקן" value={log.device} />
                  {log.platform && <Detail label="פלטפורמה" value={log.platform} />}
                  {log.os?.architecture && <Detail label="ארכיטקטורה" value={log.os.architecture} />}
                </div>
              </div>

              {/* 📺 Screen */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<ScreenShare size={14} />} title="תצוגה / מסך" color="text-purple-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <Detail icon={<Monitor size={12} />} label="רזולוציה" value={log.screen?.width ? `${log.screen.width} × ${log.screen.height}` : '—'} />
                  {log.screen?.availWidth && <Detail label="שטח זמין" value={`${log.screen.availWidth} × ${log.screen.availHeight}`} />}
                  {log.screen?.colorDepth && <Detail label="Color Depth" value={`${log.screen.colorDepth} bit`} mono />}
                  {log.screen?.pixelDepth && <Detail label="Pixel Depth" value={`${log.screen.pixelDepth} bit`} mono />}
                  {log.screen?.pixelRatio && <Detail label="Pixel Ratio" value={`${log.screen.pixelRatio}x`} mono />}
                  {log.screen?.isRetina != null && <Detail label="רטינה" value={yn(log.screen.isRetina)} />}
                  {log.screen?.refreshRate && <Detail label="קצב רענון" value={`${log.screen.refreshRate} Hz`} mono />}
                  {log.screen?.orientation && (
                    <Detail label="כיוון מסך" value={log.screen.orientation.includes('landscape') ? 'לרוחב' : log.screen.orientation.includes('portrait') ? 'לאורך' : log.screen.orientation} />
                  )}
                  {log.screen?.viewportWidth && <Detail label="Viewport" value={`${log.screen.viewportWidth} × ${log.screen.viewportHeight}`} mono />}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-4">

              {/* ⚙️ Hardware */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<Cpu size={14} />} title="חומרה" color="text-amber-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {(log.processor?.cores || log.hardwareConcurrency) && (
                    <Detail icon={<Cpu size={12} />} label="ליבות CPU" value={log.processor?.cores || log.hardwareConcurrency} />
                  )}
                  {log.deviceMemory && <Detail icon={<HardDrive size={12} />} label="זיכרון RAM" value={`${log.deviceMemory} GB`} />}
                  {log.gpu?.vendor && <Detail icon={<Layers size={12} />} label="GPU יצרן" value={log.gpu.vendor} />}
                  {log.gpu?.renderer && <Detail icon={<Layers size={12} />} label="GPU" value={log.gpu.renderer} small />}
                  {log.battery?.level != null && (
                    <Detail icon={<BatteryCharging size={12} />} label="סוללה" value={`${log.battery.level}%${log.battery.charging ? ' ⚡' : ''}`} />
                  )}
                  {log.processor?.maxTouchPoints != null && (
                    <Detail label="Touch Points" value={log.processor.maxTouchPoints} mono />
                  )}
                </div>
              </div>

              {/* 🔐 Storage & Cookies */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<Cookie size={14} />} title="אחסון ועוגיות" color="text-cyan-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <Detail icon={<Cookie size={12} />} label="עוגיות" value={log.cookies?.enabled != null ? `${log.cookies.enabled ? 'מופעל' : 'חסום'} · ${log.cookies.count ?? 0}` : '—'} />
                  <Detail icon={<HardDrive size={12} />} label="LocalStorage" value={yn(log.localStorage?.enabled)} />
                  {log.pluginsCount != null && <Detail icon={<Plug size={12} />} label="תוספים" value={log.pluginsCount} />}
                </div>
              </div>

              {/* 🎯 Session */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<Activity size={14} />} title="סשן" color="text-rose-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {log.session?.pageViews != null && <Detail icon={<FileText size={12} />} label="דפים" value={log.session.pageViews} />}
                  {log.session?.durationSeconds != null && <Detail icon={<Clock size={12} />} label="משך" value={formatDuration(log.session.durationSeconds)} />}
                  {log.session?.isNewSession != null && <Detail label="סשן חדש" value={yn(log.session.isNewSession)} />}
                </div>
              </div>

              {/* 🎤 Media Devices */}
              {log.mediaDevices && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                  <SectionHeader icon={<Video size={14} />} title="מכשירי מדיה" color="text-indigo-400" />
                  <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
                    <Detail icon={<Video size={12} />} label="מצלמות" value={log.mediaDevices.cameras ?? 0} />
                    <Detail icon={<Mic size={12} />} label="מיקרופונים" value={log.mediaDevices.microphones ?? 0} />
                    <Detail label="רמקולים" value={log.mediaDevices.speakers ?? 0} />
                  </div>
                </div>
              )}

              {/* 🌍 Language / Timezone */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<Globe size={14} />} title="שפה ואזור זמן" color="text-teal-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {log.userLanguage && <Detail label="שפה ראשית" value={log.userLanguage} />}
                  {log.languages?.length > 1 && <Detail label="שפות" value={log.languages.join(', ')} small />}
                  {log.timezone && <Detail icon={<Clock size={12} />} label="אזור זמן" value={log.timezone} />}
                </div>
              </div>
            </div>
          </div>

          {/* ★ FINGERPRINTS — Full width */}
          {hasFP && (
            <div className="mt-4 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 rounded-xl p-4 border border-indigo-500/20">
              <SectionHeader icon={<Fingerprint size={14} />} title="טביעות אצבע דיגיטליות" color="text-indigo-400" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {log.fingerprint && (
                  <div className="bg-slate-800/60 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-slate-500 mb-0.5">Visitor Fingerprint</div>
                    <div className="font-mono text-sm text-indigo-300 font-bold">{log.fingerprint}</div>
                  </div>
                )}
                {log.canvasFingerprint && (
                  <div className="bg-slate-800/60 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-slate-500 mb-0.5">Canvas Fingerprint</div>
                    <div className="font-mono text-sm text-purple-300 font-bold">{log.canvasFingerprint}</div>
                  </div>
                )}
                {log.webglFingerprint && (
                  <div className="bg-slate-800/60 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-slate-500 mb-0.5">WebGL Fingerprint</div>
                    <div className="font-mono text-sm text-violet-300 font-bold">{log.webglFingerprint}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ★ Browser Capabilities */}
          <div className="mt-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
            <SectionHeader icon={<Zap size={14} />} title="יכולות דפדפן" color="text-yellow-400" />
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {[
                { label: 'WebGL', val: log.webGLSupported },
                { label: 'Service Worker', val: log.serviceWorkerSupported },
                { label: 'PDF Viewer', val: log.pdfViewerEnabled },
                { label: 'עוגיות', val: log.cookies?.enabled },
                { label: 'LocalStorage', val: log.localStorage?.enabled },
              ].map(({ label, val }) => (
                <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${val === true ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : val === false ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-slate-700/30 text-slate-500 border border-slate-600/20'}`}>
                  {val === true ? <Eye size={12} /> : val === false ? <EyeOff size={12} /> : <HelpCircle size={12} />}
                  {label}
                </div>
              ))}
            </div>
            {log.notificationPermission && (
              <div className="mt-2 text-xs text-slate-400">
                התראות: <span className={`font-bold ${log.notificationPermission === 'granted' ? 'text-emerald-300' : log.notificationPermission === 'denied' ? 'text-red-300' : 'text-slate-300'}`}>{log.notificationPermission}</span>
              </div>
            )}
          </div>

          {/* ★ Request Info */}
          <div className="mt-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
            <SectionHeader icon={<FileText size={14} />} title="פרטי בקשה" color="text-slate-400" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5">
              <Detail icon={<Clock size={12} />} label="זמן מדויק" value={new Date(log.timestamp).toLocaleString('he-IL')} />
              <Detail icon={<Zap size={12} />} label="זמן תגובה" value={`${log.responseTime}ms`} mono />
              <Detail label="סטטוס" value={log.statusCode} mono />
              <Detail label="Method" value={log.method} mono />
              {log.referer && <Detail label="הגיע מ-" value={log.referer} className="col-span-2" small />}
            </div>
            <div className="mt-2">
              <Detail label="User Agent" value={log.userAgent} className="col-span-full" mono small />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogsPage;
```
