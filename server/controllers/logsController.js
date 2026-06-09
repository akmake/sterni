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

  const topCountries = await Log.aggregate([
    { $match: { 'location.country': { $nin: [null, 'Unknown', 'Local'] } } },
    { $group: { _id: '$location.country', count: { $sum: 1 }, code: { $first: '$location.countryCode' } } },
    { $sort: { count: -1 } },
    { $limit: 12 },
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
      topCountries,
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

// ════════════════════════════════════════════════════════════
//  PHASE 2 — VISITOR JOURNEY
// ════════════════════════════════════════════════════════════

// Classify traffic source from the referer of a visitor's first hit
const classifySource = (referer) => {
  if (!referer) return 'direct';
  let h = '';
  try { h = new URL(referer).hostname.replace(/^www\./, ''); } catch { return 'direct'; }
  if (/dahanswebsite\.com|localhost/.test(h)) return 'internal';
  if (/google\./.test(h)) return 'google';
  if (/bing\.|duckduckgo|yahoo|yandex/.test(h)) return 'search';
  if (/whatsapp|wa\.me|t\.me|telegram/.test(h)) return 'whatsapp';
  if (/facebook|fb\.|instagram|twitter|x\.com|linkedin|tiktok|youtube|t\.co/.test(h)) return 'social';
  return 'referral';
};

// The key that identifies a unique visitor across requests (fingerprint, else IP)
const VISITOR_KEY = { $ifNull: ['$fingerprint', '$ipAddress'] };

// ★ Get visitors — raw request logs grouped into real people
export const getVisitors = catchAsync(async (req, res) => {
  const { limit = 100, days = 30, suspicious } = req.query;
  const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

  const match = { timestamp: { $gte: since } };

  const grouped = await Log.aggregate([
    { $match: match },
    { $sort: { timestamp: 1 } },
    {
      $group: {
        _id: VISITOR_KEY,
        visits: { $sum: 1 },
        firstSeen: { $first: '$timestamp' },
        lastSeen: { $last: '$timestamp' },
        entryPage: { $first: '$page' },
        lastPage: { $last: '$page' },
        firstReferer: { $first: '$referer' },
        pages: { $addToSet: '$page' },
        days: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } } },
        ips: { $addToSet: '$ipAddress' },
        fingerprint: { $last: '$fingerprint' },
        device: { $last: '$device' },
        browser: { $last: '$browser.name' },
        os: { $last: '$os.name' },
        country: { $last: '$location.country' },
        countryCode: { $last: '$location.countryCode' },
        city: { $last: '$location.city' },
        isp: { $last: '$location.isp' },
        lat: { $last: '$location.latitude' },
        lon: { $last: '$location.longitude' },
        proxy: { $max: { $cond: ['$location.proxy', 1, 0] } },
        hosting: { $max: { $cond: ['$location.hosting', 1, 0] } },
        bot: { $max: { $cond: ['$webdriver', 1, 0] } },
        userId: { $last: '$userId' },
      },
    },
    ...(suspicious === 'true' ? [{ $match: { $or: [{ proxy: 1 }, { hosting: 1 }, { bot: 1 }] } }] : []),
    { $sort: { lastSeen: -1 } },
    { $limit: parseInt(limit) },
  ]);

  // Populate registered-user names
  const User = (await import('mongoose')).default.model('User');
  const userIds = grouped.map(g => g.userId).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } }).select('name email role').lean();
  const userMap = {};
  users.forEach(u => { userMap[u._id.toString()] = u; });

  const visitors = grouped.map(g => {
    const user = g.userId ? userMap[g.userId.toString()] : null;
    return {
      key: g._id,
      fingerprint: g.fingerprint || null,
      visits: g.visits,
      firstSeen: g.firstSeen,
      lastSeen: g.lastSeen,
      daysActive: g.days.length,
      uniquePages: g.pages.length,
      entryPage: g.entryPage,
      lastPage: g.lastPage,
      source: classifySource(g.firstReferer),
      ips: g.ips.filter(Boolean),
      device: g.device,
      browser: g.browser,
      os: g.os,
      country: g.country,
      countryCode: g.countryCode,
      city: g.city,
      isp: g.isp,
      lat: g.lat,
      lon: g.lon,
      proxy: !!g.proxy,
      hosting: !!g.hosting,
      bot: !!g.bot,
      isReturning: g.days.length > 1,
      userId: g.userId || null,
      name: user?.name || null,
      role: user?.role || null,
    };
  });

  // Source breakdown for the whole window
  const sourceBreakdown = {};
  visitors.forEach(v => { sourceBreakdown[v.source] = (sourceBreakdown[v.source] || 0) + 1; });

  res.status(200).json({
    status: 'success',
    count: visitors.length,
    summary: {
      total: visitors.length,
      returning: visitors.filter(v => v.isReturning).length,
      newVisitors: visitors.filter(v => !v.isReturning).length,
      suspicious: visitors.filter(v => v.proxy || v.hosting || v.bot).length,
    },
    sourceBreakdown,
    data: visitors,
  });
});

// ★ Get one visitor's full chronological journey (page-by-page timeline)
export const getVisitorJourney = catchAsync(async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ status: 'fail', message: 'key required' });

  const events = await Log.find({ $or: [{ fingerprint: key }, { ipAddress: key }] })
    .select('page method statusCode responseTime referer timestamp behavior location.city device')
    .sort({ timestamp: 1 })
    .limit(500)
    .lean();

  res.status(200).json({ status: 'success', count: events.length, data: events });
});

// ════════════════════════════════════════════════════════════
//  PHASE 3 — LIVE VISITORS
// ════════════════════════════════════════════════════════════

// ★ Who is online right now (activity in the last N minutes)
export const getLiveVisitors = catchAsync(async (req, res) => {
  const minutes = parseInt(req.query.minutes) || 5;
  const since = new Date(Date.now() - minutes * 60 * 1000);

  const grouped = await Log.aggregate([
    { $match: { timestamp: { $gte: since } } },
    { $sort: { timestamp: 1 } },
    {
      $group: {
        _id: VISITOR_KEY,
        lastSeen: { $last: '$timestamp' },
        currentPage: { $last: '$page' },
        hits: { $sum: 1 },
        device: { $last: '$device' },
        browser: { $last: '$browser.name' },
        country: { $last: '$location.country' },
        city: { $last: '$location.city' },
        lat: { $last: '$location.latitude' },
        lon: { $last: '$location.longitude' },
        ip: { $last: '$ipAddress' },
        proxy: { $max: { $cond: ['$location.proxy', 1, 0] } },
        hosting: { $max: { $cond: ['$location.hosting', 1, 0] } },
        userId: { $last: '$userId' },
      },
    },
    { $sort: { lastSeen: -1 } },
  ]);

  const User = (await import('mongoose')).default.model('User');
  const userIds = grouped.map(g => g.userId).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } }).select('name').lean();
  const userMap = {};
  users.forEach(u => { userMap[u._id.toString()] = u; });

  const visitors = grouped.map(g => ({
    key: g._id,
    lastSeen: g.lastSeen,
    currentPage: g.currentPage,
    hits: g.hits,
    device: g.device,
    browser: g.browser,
    country: g.country,
    city: g.city,
    lat: g.lat,
    lon: g.lon,
    ip: g.ip,
    proxy: !!g.proxy,
    hosting: !!g.hosting,
    name: g.userId ? (userMap[g.userId.toString()]?.name || null) : null,
  }));

  res.status(200).json({ status: 'success', activeCount: visitors.length, windowMinutes: minutes, data: visitors });
});

// ════════════════════════════════════════════════════════════
//  PHASE 4 — ON-PAGE BEHAVIOR
// ════════════════════════════════════════════════════════════

// ★ Receive behavior beacon (sent via navigator.sendBeacon on page leave) — public, no auth
export const receiveBehavior = async (req, res) => {
  try {
    const { fingerprint, page, scrollDepth, clicks, rageClicks, activeSeconds } = req.body || {};
    if (!fingerprint || !page) return res.status(204).end();

    // Attach behavior to the most recent matching page-view log
    await Log.findOneAndUpdate(
      { fingerprint, page },
      {
        $set: {
          behavior: {
            maxScrollDepth: Math.min(100, Math.max(0, Math.round(scrollDepth || 0))),
            clicks: Math.max(0, parseInt(clicks) || 0),
            rageClicks: Math.max(0, parseInt(rageClicks) || 0),
            activeSeconds: Math.max(0, parseInt(activeSeconds) || 0),
          },
        },
      },
      { sort: { timestamp: -1 } }
    );
    res.status(204).end();
  } catch (e) {
    res.status(204).end();
  }
};

export default {
  receiveDevicePing, toggleLogging, getLoggingStatus, getAllLogs, getLogsSummary,
  getMyLogs, deleteOldLogs, deleteAllLogs, getUserActivitySummary,
  getVisitors, getVisitorJourney, getLiveVisitors, receiveBehavior,
};