import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import Community from '../models/Community.js';
import TetherDevice from '../models/TetherDevice.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import TetherAdmin from '../models/TetherAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = express.Router();

// ── Tether-specific auth middleware (reads Authorization: Bearer header) ──
const requireTetherAuth = async (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'לא מחובר' });
  }
  try {
    const decoded = jwt.verify(auth.slice(7), process.env.JWT_ACCESS_SECRET);
    req.admin = { _id: decoded.id, role: decoded.role };
    next();
  } catch {
    return res.status(401).json({ message: 'טוקן לא חוקי / פג תוקף' });
  }
};

// ── Tether Admin Auth ─────────────────────────────────────────────────────

// Login — returns token in body (for Android)
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'אימייל וסיסמה חובה' });

    const admin = await TetherAdmin.findOne({ email: email.toLowerCase(), active: true });
    if (!admin) return res.status(401).json({ message: 'אימייל או סיסמה שגויים' });

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ message: 'אימייל או סיסמה שגויים' });

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: { name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Bootstrap — create first superadmin (only if no admins exist)
router.post('/auth/bootstrap', async (req, res) => {
  try {
    const count = await TetherAdmin.countDocuments();
    if (count > 0) return res.status(403).json({ message: 'כבר קיים מנהל' });

    const { name, email, password, secret } = req.body;
    if (secret !== 'tether-init-2025') return res.status(403).json({ message: 'Forbidden' });

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await TetherAdmin.create({ name, email, passwordHash, role: 'superadmin' });
    res.status(201).json({ message: 'Superadmin created', email: admin.email });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Device routes (no auth — called from Android device) ──────────────────

// Verify community code before joining
router.get('/communities/:code/verify', async (req, res) => {
  try {
    const community = await Community.findOne({
      code: req.params.code.toUpperCase(),
      active: true
    }).select('name code');

    if (!community) return res.status(404).json({ message: 'קוד קהילה לא נמצא' });
    res.json({ name: community.name, code: community.code });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Join community
router.post('/devices/join', async (req, res) => {
  try {
    const { code, deviceId, deviceModel } = req.body;
    if (!code || !deviceId) return res.status(400).json({ message: 'code ו-deviceId חובה' });

    const community = await Community.findOne({ code: code.toUpperCase(), active: true });
    if (!community) return res.status(404).json({ message: 'קוד קהילה לא נמצא' });

    let device = await TetherDevice.findOne({ deviceId });
    if (device) {
      device.communityId = community._id;
      device.deviceModel = deviceModel || device.deviceModel;
      device.lastSeen = new Date();
      await device.save();
    } else {
      device = await TetherDevice.create({ deviceId, deviceModel, communityId: community._id });
    }

    res.json({
      success: true,
      device: {
        id: device._id,
        deviceId: device.deviceId,
        communityId: community._id,
        communityName: community.name,
        isDeviceOwner: device.isDeviceOwner,
        enrolledAt: device.createdAt
      },
      community: {
        id: community._id,
        name: community.name,
        code: community.code,
        policy: community.policy,
        adminId: community.adminId
      }
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get policy for device — also returns and clears any pending commands
router.get('/devices/:deviceId/policy', async (req, res) => {
  try {
    // Atomically read + clear pendingCommands so commands are delivered exactly once
    const device = await TetherDevice.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      { lastSeen: new Date(), $set: { pendingCommands: [] } }
      // default: new:false → returns pre-update document (with the commands)
    ).populate('communityId');

    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });

    res.json({
      policy: device.communityId.policy,
      allowUninstall: device.allowUninstall ?? false,
      pendingCommands: device.pendingCommands ?? []
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Request approval for blocked action
router.post('/devices/:deviceId/approval', async (req, res) => {
  try {
    const device = await TetherDevice.findOne({ deviceId: req.params.deviceId });
    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });

    const request = await ApprovalRequest.create({
      deviceId: req.params.deviceId,
      communityId: device.communityId,
      action: req.query.action || 'UNKNOWN',
      packageName: req.query.packageName || null
    });

    res.json(request);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Admin routes (require Tether auth) ────────────────────────────────────

const formatCommunity = (c, deviceCount = 0) => ({
  id: c._id.toString(),
  name: c.name,
  code: c.code,
  policy: c.policy,
  deviceCount,
  active: c.active,
  createdAt: c.createdAt
});

const formatDevice = (d) => ({
  id: d._id.toString(),
  deviceId: d.deviceId,
  deviceModel: d.deviceModel,
  communityId: d.communityId.toString(),
  isDeviceOwner: d.isDeviceOwner,
  allowUninstall: d.allowUninstall ?? false,
  lastSeen: d.lastSeen,
  active: d.active,
  createdAt: d.createdAt
});

// Create community
router.post('/admin/communities', requireTetherAuth, async (req, res) => {
  try {
    const { name, policy } = req.body;
    if (!name) return res.status(400).json({ message: 'שם קהילה חובה' });

    const community = await Community.create({
      name,
      adminId: req.admin._id,
      policy: policy || {}
    });

    res.status(201).json(formatCommunity(community));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get all communities for admin
router.get('/admin/communities', requireTetherAuth, async (req, res) => {
  try {
    const communities = await Community.find({ adminId: req.admin._id });
    const communityIds = communities.map(c => c._id);
    const deviceCounts = await TetherDevice.aggregate([
      { $match: { communityId: { $in: communityIds }, active: true } },
      { $group: { _id: '$communityId', count: { $sum: 1 } } }
    ]);
    const countMap = Object.fromEntries(deviceCounts.map(d => [d._id.toString(), d.count]));
    res.json(communities.map(c => formatCommunity(c, countMap[c._id.toString()] || 0)));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get community details + devices
router.get('/admin/communities/:id', requireTetherAuth, async (req, res) => {
  try {
    const community = await Community.findOne({ _id: req.params.id, adminId: req.admin._id });
    if (!community) return res.status(404).json({ message: 'קהילה לא נמצאה' });

    const devices = await TetherDevice.find({ communityId: community._id, active: true });
    res.json({ community: formatCommunity(community, devices.length), devices: devices.map(formatDevice) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Update community policy
router.put('/admin/communities/:id/policy', requireTetherAuth, async (req, res) => {
  try {
    const community = await Community.findOneAndUpdate(
      { _id: req.params.id, adminId: req.admin._id },
      { policy: req.body },
      { new: true }
    );
    if (!community) return res.status(404).json({ message: 'קהילה לא נמצאה' });

    res.json({ policy: community.policy });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get pending approval requests for admin
router.get('/admin/communities/:id/approvals', requireTetherAuth, async (req, res) => {
  try {
    const community = await Community.findOne({ _id: req.params.id, adminId: req.admin._id });
    if (!community) return res.status(404).json({ message: 'קהילה לא נמצאה' });

    const requests = await ApprovalRequest.find({
      communityId: community._id,
      status: 'pending'
    }).sort({ createdAt: -1 });

    res.json(requests);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Approve / reject request
router.put('/admin/approvals/:id', requireTetherAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'סטטוס לא תקין' });
    }

    const request = await ApprovalRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!request) return res.status(404).json({ message: 'בקשה לא נמצאה' });

    res.json(request);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Verify PIN from Android app locally to allow uninstall
router.post('/devices/:deviceId/verify-uninstall-pin', async (req, res) => {
  try {
    const { pin } = req.body;
    const device = await TetherDevice.findOne({ deviceId: req.params.deviceId }).populate('communityId');
    
    if (!device) return res.status(404).json({ message: 'Device not found' });
    if (!device.communityId) return res.status(404).json({ message: 'Community not found' });

    const communityPin = device.communityId.policy.uninstallPin || '0000';
    if (pin === communityPin) {
      device.allowUninstall = true;
      await device.save();
      return res.json({ success: true, allowUninstall: true });
    } else {
      return res.status(401).json({ message: 'קוד שגוי' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Toggle allow-uninstall for a device
router.put('/admin/devices/:deviceId/allow-uninstall', requireTetherAuth, async (req, res) => {
  try {
    const { allowUninstall } = req.body;
    const device = await TetherDevice.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      { allowUninstall: !!allowUninstall },
      { new: true }
    );
    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });
    res.json({ allowUninstall: device.allowUninstall });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Remove device from community
router.delete('/admin/devices/:deviceId', requireTetherAuth, async (req, res) => {
  try {
    await TetherDevice.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      { active: false }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Dashboard stats
router.get('/admin/dashboard', requireTetherAuth, async (req, res) => {
  try {
    const communities = await Community.find({ adminId: req.admin._id });
    const communityIds = communities.map(c => c._id);

    const [totalDevices, pendingApprovals, inactiveDevices] = await Promise.all([
      TetherDevice.countDocuments({ communityId: { $in: communityIds }, active: true }),
      ApprovalRequest.countDocuments({ communityId: { $in: communityIds }, status: 'pending' }),
      TetherDevice.countDocuments({
        communityId: { $in: communityIds },
        active: true,
        lastSeen: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
    ]);

    res.json({
      totalCommunities: communities.length,
      totalDevices,
      pendingApprovals,
      inactiveDevices
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Activity feed
router.get('/admin/activity', requireTetherAuth, async (req, res) => {
  try {
    const communities = await Community.find({ adminId: req.admin._id }).select('_id name');
    const communityIds = communities.map(c => c._id);
    const communityMap = Object.fromEntries(communities.map(c => [c._id.toString(), c.name]));

    const [recentDevices, recentApprovals] = await Promise.all([
      TetherDevice.find({ communityId: { $in: communityIds } })
        .sort({ createdAt: -1 }).limit(5).select('deviceModel communityId createdAt'),
      ApprovalRequest.find({ communityId: { $in: communityIds } })
        .sort({ createdAt: -1 }).limit(5).select('deviceId communityId action createdAt')
    ]);

    const activity = [
      ...recentDevices.map(d => ({
        type: 'device_joined',
        description: `מכשיר חדש הצטרף: ${d.deviceModel}`,
        communityName: communityMap[d.communityId.toString()] || '',
        timestamp: d.createdAt
      })),
      ...recentApprovals.map(a => ({
        type: 'approval_request',
        description: `בקשת אישור: ${a.action}`,
        communityName: communityMap[a.communityId.toString()] || '',
        timestamp: a.createdAt
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

    res.json(activity);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// All approvals across all communities
router.get('/admin/approvals/all', requireTetherAuth, async (req, res) => {
  try {
    const communities = await Community.find({ adminId: req.admin._id }).select('_id');
    const communityIds = communities.map(c => c._id);

    const approvals = await ApprovalRequest.find({
      communityId: { $in: communityIds },
      status: 'pending'
    }).sort({ createdAt: -1 });

    res.json(approvals);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Community logs
router.get('/admin/communities/:id/logs', requireTetherAuth, async (req, res) => {
  try {
    const community = await Community.findOne({ _id: req.params.id, adminId: req.admin._id });
    if (!community) return res.status(404).json({ message: 'קהילה לא נמצאה' });
    if (!community.policy.logsEnabled) return res.status(403).json({ message: 'לוגים לא מופעלים לקהילה זו' });

    const logs = await ApprovalRequest.find({ communityId: community._id })
      .sort({ createdAt: -1 }).limit(100);

    res.json(logs.map(l => ({
      id: l._id,
      deviceId: l.deviceId,
      deviceModel: null,
      action: l.action,
      result: l.status === 'approved' ? 'approved' : 'blocked',
      packageName: l.packageName,
      timestamp: l.createdAt
    })));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Delete community
router.delete('/admin/communities/:id', requireTetherAuth, async (req, res) => {
  try {
    await Community.findOneAndUpdate(
      { _id: req.params.id, adminId: req.admin._id },
      { active: false }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Manage admins (superadmin only) ──────────────────────────────────────

router.get('/admin/members', requireTetherAuth, async (req, res) => {
  try {
    if (req.admin.role !== 'superadmin') return res.status(403).json({ message: 'גישה אסורה' });
    const admins = await TetherAdmin.find({}, 'name email role active createdAt');
    res.json(admins);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/admin/members/invite', requireTetherAuth, async (req, res) => {
  try {
    if (req.admin.role !== 'superadmin') return res.status(403).json({ message: 'גישה אסורה' });
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'שם, אימייל וסיסמה חובה' });
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await TetherAdmin.create({ name, email, passwordHash, role: 'admin' });
    res.status(201).json({ name: admin.name, email: admin.email, role: admin.role });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.delete('/admin/members/:id', requireTetherAuth, async (req, res) => {
  try {
    if (req.admin.role !== 'superadmin') return res.status(403).json({ message: 'גישה אסורה' });
    await TetherAdmin.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Serve APK for provisioning (public — Android downloads it during device setup)
router.get('/app/download', (req, res) => {
  const apkPath = path.join(__dirname, '../../uploads/tether-latest.apk');
  res.download(apkPath, 'tether-latest.apk', (err) => {
    if (err) res.status(404).json({ message: 'APK לא נמצא — העלה את הקובץ לשרת' });
  });
});

// דיווח אפליקציות מהמכשיר
router.post('/devices/:deviceId/apps', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const apps = req.body.installedApps || req.body.apps;
    await TetherDevice.findOneAndUpdate(
      { deviceId },
      { installedApps: apps, lastSeen: new Date() }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// נעילת קהילה לפי זמן
router.post('/community/:id/lock', async (req, res) => {
  try {
    const { lockedUntilTs } = req.body;
    await Community.findByIdAndUpdate(req.params.id, {
      'policy.lockedUntilTs': lockedUntilTs
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Heartbeat — device reports its protection-layer status every 5 min ────────
router.post('/devices/:deviceId/heartbeat', async (req, res) => {
  try {
    const { accessibilityEnabled, isDeviceAdmin, isDeviceOwner, vpnActive } = req.body;
    await TetherDevice.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      {
        lastSeen: new Date(),
        'protectionStatus.accessibilityEnabled': !!accessibilityEnabled,
        'protectionStatus.isDeviceAdmin':        !!isDeviceAdmin,
        'protectionStatus.isDeviceOwner':        !!isDeviceOwner,
        'protectionStatus.vpnActive':            !!vpnActive,
        'protectionStatus.lastHeartbeat':        new Date()
      }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Security events — device reports each intercepted threat ──────────────────
router.post('/devices/:deviceId/events', async (req, res) => {
  try {
    const { type, packageName } = req.body;
    const validTypes = [
      'UNINSTALL_ATTEMPT', 'ADMIN_DEACTIVATE_ATTEMPT',
      'BLOCKED_APP_OPENED', 'TIME_LOCK_BLOCKED'
    ];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'סוג אירוע לא חוקי' });
    }

    const event = { type, packageName: packageName || null, timestamp: new Date() };

    // Keep only the last 50 events (push + trim)
    await TetherDevice.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      {
        $push: {
          securityEvents: {
            $each: [event],
            $slice: -50   // keep newest 50
          }
        },
        lastSeen: new Date()
      }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Admin: view security events for a device ──────────────────────────────────
router.get('/admin/devices/:deviceId/events', requireTetherAuth, async (req, res) => {
  try {
    const device = await TetherDevice.findOne({ deviceId: req.params.deviceId }).select('securityEvents protectionStatus');
    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });
    res.json({
      protectionStatus: device.protectionStatus,
      events: device.securityEvents.slice().reverse() // newest first
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Admin: push a command to a specific device ────────────────────────────────
// The command is delivered on the device's next policy poll (at most 15 min later).
router.post('/admin/devices/:deviceId/commands', requireTetherAuth, async (req, res) => {
  try {
    const { type, payload } = req.body;
    if (!type) return res.status(400).json({ message: 'type חובה' });

    const device = await TetherDevice.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      { $push: { pendingCommands: { type, payload: payload || '' } } },
      { new: true }
    );
    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });
    res.json({ success: true, pendingCount: device.pendingCommands.length });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Admin: protection health summary for all devices in a community ───────────
router.get('/admin/communities/:id/devices/status', requireTetherAuth, async (req, res) => {
  try {
    const community = await Community.findOne({ _id: req.params.id, adminId: req.admin._id });
    if (!community) return res.status(404).json({ message: 'קהילה לא נמצאה' });

    const devices = await TetherDevice.find(
      { communityId: community._id, active: true },
      'deviceId deviceModel protectionStatus lastSeen'
    );

    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 min
    const summary = devices.map(d => ({
      deviceId:    d.deviceId,
      deviceModel: d.deviceModel,
      lastSeen:    d.lastSeen,
      isOnline:    d.lastSeen > staleThreshold,
      protection:  d.protectionStatus
    }));

    res.json(summary);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
