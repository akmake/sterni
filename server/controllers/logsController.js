import Log from '../models/Log.js';
import catchAsync from '../utils/catchAsync.js';

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

  // ★ תיקון: חיפוש חלקי של IP (regex)
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

  // Top browsers
  const topBrowsers = await Log.aggregate([
    { $group: { _id: '$browser.name', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  // Top devices
  const topDevices = await Log.aggregate([
    { $group: { _id: '$device', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // Top OS
  const topOS = await Log.aggregate([
    { $group: { _id: '$os.name', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  // Top pages
  const topPages = await Log.aggregate([
    { $group: { _id: '$page', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  // ★ חדש: מבקרים ייחודיים ב-24 שעות (לפי IP)
  const uniqueIPsToday = await Log.distinct('ipAddress', { timestamp: { $gte: last24Hours } });

  // ★ חדש: ממוצע תגובה
  const avgResponseAgg = await Log.aggregate([
    { $match: { timestamp: { $gte: last24Hours } } },
    { $group: { _id: null, avg: { $avg: '$responseTime' } } },
  ]);
  const avgResponseTime = avgResponseAgg[0]?.avg || 0;

  // ★ חדש: Top IPs (מי הכי פעיל)
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

export default { getAllLogs, getLogsSummary, getMyLogs, deleteOldLogs };