import express from 'express';
import Community from '../models/Community.js';
import TetherDevice from '../models/TetherDevice.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

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

// Get policy for device
router.get('/devices/:deviceId/policy', async (req, res) => {
  try {
    const device = await TetherDevice.findOne({ deviceId: req.params.deviceId }).populate('communityId');
    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });

    res.json({ policy: device.communityId.policy });
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

// ── Admin routes (require auth) ────────────────────────────────────────────

// Create community
router.post('/admin/communities', requireAuth, async (req, res) => {
  try {
    const { name, policy } = req.body;
    if (!name) return res.status(400).json({ message: 'שם קהילה חובה' });

    const community = await Community.create({
      name,
      adminId: req.user._id,
      policy: policy || {}
    });

    res.status(201).json(community);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get all communities for admin
router.get('/admin/communities', requireAuth, async (req, res) => {
  try {
    const communities = await Community.find({ adminId: req.user._id });
    res.json(communities);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get community details + devices
router.get('/admin/communities/:id', requireAuth, async (req, res) => {
  try {
    const community = await Community.findOne({ _id: req.params.id, adminId: req.user._id });
    if (!community) return res.status(404).json({ message: 'קהילה לא נמצאה' });

    const devices = await TetherDevice.find({ communityId: community._id, active: true });
    res.json({ community, devices });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Update community policy
router.put('/admin/communities/:id/policy', requireAuth, async (req, res) => {
  try {
    const community = await Community.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id },
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
router.get('/admin/communities/:id/approvals', requireAuth, async (req, res) => {
  try {
    const community = await Community.findOne({ _id: req.params.id, adminId: req.user._id });
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
router.put('/admin/approvals/:id', requireAuth, async (req, res) => {
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

// Remove device from community
router.delete('/admin/devices/:deviceId', requireAuth, async (req, res) => {
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
router.get('/admin/dashboard', requireAuth, async (req, res) => {
  try {
    const communities = await Community.find({ adminId: req.user._id });
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
router.get('/admin/activity', requireAuth, async (req, res) => {
  try {
    const communities = await Community.find({ adminId: req.user._id }).select('_id name');
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
router.get('/admin/approvals/all', requireAuth, async (req, res) => {
  try {
    const communities = await Community.find({ adminId: req.user._id }).select('_id');
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
router.get('/admin/communities/:id/logs', requireAuth, async (req, res) => {
  try {
    const community = await Community.findOne({ _id: req.params.id, adminId: req.user._id });
    if (!community) return res.status(404).json({ message: 'קהילה לא נמצאה' });
    if (!community.policy.logsEnabled) return res.status(403).json({ message: 'לוגים לא מופעלים לקהילה זו' });

    // Return approval requests as log entries (expandable in future)
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
router.delete('/admin/communities/:id', requireAuth, async (req, res) => {
  try {
    await Community.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id },
      { active: false }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Manage admins (super admin only) ──────────────────────────────────────

router.get('/admin/members', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'גישה אסורה' });
    // Returns users with tether access — extendable
    res.json([]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/admin/members/invite', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'גישה אסורה' });
    // Invite logic — send email, create user record, etc.
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.delete('/admin/members/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'גישה אסורה' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
