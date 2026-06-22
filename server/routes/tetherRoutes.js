import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Community from '../models/Community.js';
import TetherDevice from '../models/TetherDevice.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import TetherAdmin from '../models/TetherAdmin.js';
import TetherApprovedApp from '../models/TetherApprovedApp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = express.Router();

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

// --- Per-device authentication (device secret token) ---
// Each device receives an opaque secret at /devices/join; only its SHA-256 hash
// is stored. The device sends it back in the `X-Device-Token` header on every
// /devices/:deviceId/* call.
export const hashDeviceToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

export const generateDeviceToken = () => crypto.randomBytes(32).toString('hex');

// Rollout-safe: when TETHER_ENFORCE_DEVICE_AUTH !== 'true', a *missing* token is
// allowed (legacy apps in the field) but a *wrong* token is always rejected.
// Flip the env flag to 'true' once all devices have updated to enforce fully.
const requireDeviceAuth = async (req, res, next) => {
  const token = req.headers['x-device-token'];
  const enforce = process.env.TETHER_ENFORCE_DEVICE_AUTH === 'true';

  const device = await TetherDevice.findOne({ deviceId: req.params.deviceId }).select('+deviceSecretHash');
  if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });

  if (!token) {
    if (enforce) return res.status(401).json({ message: 'device token required' });
    req.device = device; // legacy device — allowed during rollout
    return next();
  }

  if (!device.deviceSecretHash || hashDeviceToken(token) !== device.deviceSecretHash) {
    return res.status(401).json({ message: 'invalid device token' });
  }
  req.device = device;
  next();
};


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

router.post('/auth/bootstrap', async (req, res) => {
  try {
    const count = await TetherAdmin.countDocuments();
    if (count > 0) return res.status(403).json({ message: 'כבר קיים מנהל' });

    const { name, email, password, secret } = req.body;
    const bootstrapSecret = process.env.TETHER_BOOTSTRAP_SECRET;
    if (!bootstrapSecret || secret !== bootstrapSecret) return res.status(403).json({ message: 'Forbidden' });

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await TetherAdmin.create({ name, email, passwordHash, role: 'superadmin' });
    res.status(201).json({ message: 'Superadmin created', email: admin.email });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


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
    const { code, deviceId, deviceModel, hardwareId } = req.body;
    if (!code || !deviceId) return res.status(400).json({ message: 'code ׳•-deviceId ׳—׳•׳‘׳”' });

    const community = await Community.findOne({ code: code.toUpperCase(), active: true });
    if (!community) return res.status(404).json({ message: 'קוד קהילה לא נמצא' });

    // Delete ALL previous records for this physical device (by hardwareId if provided,
    // otherwise fall back to deviceId). This guarantees every join is truly fresh.
    if (hardwareId) {
      await TetherDevice.deleteMany({ hardwareId });
    }
    await TetherDevice.findOneAndDelete({ deviceId });

    // Issue a per-device secret token; store only its hash, return the plaintext once.
    const deviceToken = generateDeviceToken();
    const device = await TetherDevice.create({
      deviceId, deviceModel, hardwareId: hardwareId || null,
      communityId: community._id,
      deviceSecretHash: hashDeviceToken(deviceToken)
    });

    res.json({
      success: true,
      deviceToken, // ⚠️ returned only here — the app must persist it securely
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

// Merge community policy with per-device overrides
function mergePolicy(communityPolicy, devicePolicy = {}) {
  const merged = { ...(communityPolicy?.toObject?.() ?? communityPolicy ?? {}) };

  // Boolean overrides - only apply if explicitly set (not null)
  const booleanOverrideKeys = [
    'blockInstallApps',
    'hideGooglePlay',
    'blockAllStores',
    'blockApkInstall',
    'blockSafeBoot',
    'blockFactoryReset',
    'blockUsbTransfer',
    'logsEnabled',
    'blockWhatsAppChannels'
  ];
  booleanOverrideKeys.forEach((key) => {
    if (devicePolicy[key] != null) merged[key] = devicePolicy[key];
  });

  if (devicePolicy.maxInstalledApps != null) merged.maxInstalledApps = devicePolicy.maxInstalledApps;
  if (devicePolicy.blockedActionBehavior != null) merged.blockedActionBehavior = devicePolicy.blockedActionBehavior;
  if (devicePolicy.webFilterMode != null) merged.webFilterMode = devicePolicy.webFilterMode;
  if (devicePolicy.supportWhatsApp != null) merged.supportWhatsApp = devicePolicy.supportWhatsApp;
  if (devicePolicy.supportEmail != null) merged.supportEmail = devicePolicy.supportEmail;
  if (devicePolicy.supportName != null) merged.supportName = devicePolicy.supportName;
  if (devicePolicy.adminEmergencyCode != null) merged.adminEmergencyCode = devicePolicy.adminEmergencyCode;
  if (devicePolicy.lockedUntilTs != null) merged.lockedUntilTs = devicePolicy.lockedUntilTs;
  if (Array.isArray(devicePolicy.allowedDomains)) merged.allowedDomains = devicePolicy.allowedDomains;
  if (Array.isArray(devicePolicy.blockedDomains)) merged.blockedDomains = devicePolicy.blockedDomains;

  // Merge blocked/allowed app lists (union)
  const baseBlocked = merged.blockedApps ?? [];
  const baseAllowed = merged.allowedApps ?? [];
  const devBlocked = devicePolicy.blockedApps ?? [];
  const devAllowed = devicePolicy.allowedApps ?? [];
  merged.blockedApps = [...new Set([...baseBlocked, ...devBlocked])];
  merged.allowedApps = [...new Set([...baseAllowed, ...devAllowed])];
  if (Array.isArray(devicePolicy.appTimeLocks)) merged.appTimeLocks = devicePolicy.appTimeLocks;

  return merged;
}

// allowUninstall is delivered once then reset to false (app handles the 1-hour window locally).
router.get('/devices/:deviceId/policy', requireDeviceAuth, async (req, res) => {
  try {
    // Command delivery reliability:
    //  - Apps that send `X-Cmd-Ack: 1` get at-least-once delivery — we do NOT clear
    //    pendingCommands on read; the device acks executed ids via POST /commands/ack and we
    //    $pull them then. This survives a dropped HTTP response (the command is redelivered).
    //  - Legacy apps (no header) keep the original at-most-once clear-on-read, so they don't
    //    replay the same command on every poll.
    const supportsAck = req.headers['x-cmd-ack'] === '1';
    const readUpdate = { lastSeen: new Date(), $set: { allowUninstall: false } };
    if (!supportsAck) readUpdate.$set.pendingCommands = [];

    const device = await TetherDevice.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      readUpdate
    ).populate('communityId');

    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });

    // ── Iron link: device enforcement strictly follows server state ──
    // A device that was removed from its community (soft-delete → active=false), or whose
    // community was deleted/deactivated, must STOP enforcing. We answer its policy poll with
    // 404 — the exact signal the app already self-releases on (confirmed across a few polls,
    // see onDeviceNotFound). This is declarative and idempotent: every poll re-asserts "you are
    // no longer managed", so it self-heals across restarts and needs no app update to work.
    if (!device.active || !device.communityId || device.communityId.active === false) {
      return res.status(404).json({ message: 'מכשיר אינו מנוהל עוד — שחרור', released: true });
    }

    const merged = mergePolicy(device.communityId.policy, device.devicePolicy);

    res.json({
      policy: merged,
      allowUninstall: device.allowUninstall ?? false,
      pendingCommands: device.pendingCommands ?? []
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Device acknowledges the commands it executed → remove them so they are not redelivered.
// Idempotent: unknown / already-removed ids are simply ignored. Pairs with the at-least-once
// delivery above (X-Cmd-Ack apps).
router.post('/devices/:deviceId/commands/ack', requireDeviceAuth, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    if (ids.length === 0) return res.json({ success: true, removed: 0 });
    await TetherDevice.updateOne(
      { deviceId: req.params.deviceId },
      { $pull: { pendingCommands: { _id: { $in: ids } } } }
    );
    res.json({ success: true, removed: ids.length });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Request approval for blocked action
router.post('/devices/:deviceId/approval', requireDeviceAuth, async (req, res) => {
  try {
    const rlKey = `approval:${req.ip}:${req.params.deviceId}`;
    if (hitRateLimit({ key: rlKey, limit: 30, windowMs: 60 * 1000 })) {
      return res.status(429).json({ message: 'Too many approval requests. Try again in a minute.' });
    }

    const device = await TetherDevice.findOne({ deviceId: req.params.deviceId });
    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });

    const action = sanitizeApprovalAction(req.query.action);
    const packageName = String(req.query.packageName || '').trim() || null;
    if (action === 'APP_ACCESS' && !packageName) {
      return res.status(400).json({ message: 'packageName is required for APP_ACCESS.' });
    }

    const existingPending = await ApprovalRequest.findOne({
      deviceId: req.params.deviceId,
      action,
      packageName,
      status: 'pending'
    }).sort({ createdAt: -1 });
    if (existingPending) {
      return res.json(formatApproval(existingPending));
    }

    const request = await ApprovalRequest.create({
      deviceId: req.params.deviceId,
      communityId: device.communityId,
      action,
      packageName
    });

    res.json(formatApproval(request));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


const formatAdmin = (a) => ({
  id: a._id.toString(),
  name: a.name,
  email: a.email,
  role: a.role,
  active: a.active ?? true,
  createdAt: a.createdAt
});

const formatApproval = (r) => ({
  id: r._id.toString(),
  deviceId: r.deviceId,
  communityId: r.communityId?.toString(),
  action: r.action,
  packageName: r.packageName ?? null,
  status: r.status,
  resolvedByAdminId: r.resolvedByAdminId?.toString() ?? null,
  resolvedAt: r.resolvedAt ?? null,
  grantExpiresAt: r.grantExpiresAt ?? null,
  createdAt: r.createdAt,
  requestedAt: r.createdAt  // alias for Android compatibility
});

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
  deviceNickname: d.deviceNickname ?? null,
  communityId: d.communityId.toString(),
  isDeviceOwner: d.isDeviceOwner,
  allowUninstall: d.allowUninstall ?? false,
  lastSeen: d.lastSeen,
  active: d.active,
  protectionStatus: d.protectionStatus ?? {},
  createdAt: d.createdAt
});

const isSuperAdmin = (admin) => admin?.role === 'superadmin';

const getOwnedCommunityIds = async (admin) => {
  if (isSuperAdmin(admin)) return null;
  const communities = await Community.find({ adminId: admin._id }).select('_id');
  return communities.map((community) => community._id);
};

const findOwnedDevice = async (admin, deviceId, { populateCommunity = false, activeOnly = false } = {}) => {
  const ownedCommunityIds = await getOwnedCommunityIds(admin);
  const query = { deviceId };
  if (activeOnly) query.active = true;
  if (ownedCommunityIds) query.communityId = { $in: ownedCommunityIds };

  let dbQuery = TetherDevice.findOne(query);
  if (populateCommunity) dbQuery = dbQuery.populate('communityId');
  return dbQuery;
};

const sanitizeStringList = (value) => {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
};

const sanitizeAppTimeLocks = (value) => {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => ({
      packageName: String(item?.packageName || '').trim(),
      lockedUntilTs: item?.lockedUntilTs == null ? null : Number(item.lockedUntilTs)
    }))
    .filter((item) => item.packageName.length > 0 && (item.lockedUntilTs == null || Number.isFinite(item.lockedUntilTs)));
};

const sanitizeDevicePolicyPayload = (payload = {}) => {
  const out = {};
  const nullableBooleanKeys = [
    'blockInstallApps',
    'hideGooglePlay',
    'blockAllStores',
    'blockApkInstall',
    'blockSafeBoot',
    'blockFactoryReset',
    'blockUsbTransfer',
    'logsEnabled',
    'blockWhatsAppChannels'
  ];

  nullableBooleanKeys.forEach((key) => {
    if (payload[key] == null) return;
    out[key] = !!payload[key];
  });

  if (payload.maxInstalledApps != null) {
    const parsed = Number(payload.maxInstalledApps);
    if (Number.isFinite(parsed) && parsed >= 0) out.maxInstalledApps = Math.floor(parsed);
  }

  if (payload.blockedActionBehavior != null) {
    const allowed = ['SILENT', 'SHOW_MESSAGE', 'REQUEST_APPROVAL'];
    if (allowed.includes(payload.blockedActionBehavior)) out.blockedActionBehavior = payload.blockedActionBehavior;
  }
  if (payload.webFilterMode != null) {
    const allowed = ['NONE', 'BLACKLIST', 'WHITELIST'];
    if (allowed.includes(payload.webFilterMode)) out.webFilterMode = payload.webFilterMode;
  }

  const blockedApps = sanitizeStringList(payload.blockedApps);
  if (blockedApps) out.blockedApps = blockedApps;
  const allowedApps = sanitizeStringList(payload.allowedApps);
  if (allowedApps) out.allowedApps = allowedApps;
  const blockedDomains = sanitizeStringList(payload.blockedDomains);
  if (blockedDomains) out.blockedDomains = blockedDomains;
  const allowedDomains = sanitizeStringList(payload.allowedDomains);
  if (allowedDomains) out.allowedDomains = allowedDomains;
  const appTimeLocks = sanitizeAppTimeLocks(payload.appTimeLocks);
  if (appTimeLocks) out.appTimeLocks = appTimeLocks;

  if (payload.lockedUntilTs != null) {
    const parsed = Number(payload.lockedUntilTs);
    if (Number.isFinite(parsed)) out.lockedUntilTs = parsed;
  }
  if (payload.supportWhatsApp != null) out.supportWhatsApp = sanitizeOptionalString(payload.supportWhatsApp);
  if (payload.supportEmail != null) out.supportEmail = sanitizeOptionalString(payload.supportEmail);
  if (payload.supportName != null) out.supportName = sanitizeOptionalString(payload.supportName);
  if (payload.adminEmergencyCode != null) out.adminEmergencyCode = sanitizeOptionalString(payload.adminEmergencyCode);

  return out;
};

const sanitizeApprovalAction = (action) => {
  const normalized = String(action || '').trim().toUpperCase();
  const allowed = new Set(['APP_ACCESS', 'URL_ACCESS', 'UNKNOWN']);
  return allowed.has(normalized) ? normalized : 'UNKNOWN';
};

const buildApprovalGrantPayload = ({ packageName, action, expiresAt }) => JSON.stringify({
  packageName,
  action,
  expiresAt
});

const sanitizeOptionalString = (value) => {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const requestCounters = new Map();
const hitRateLimit = ({ key, limit, windowMs }) => {
  const now = Date.now();
  const item = requestCounters.get(key);
  if (!item || (now - item.windowStartMs) > windowMs) {
    requestCounters.set(key, { count: 1, windowStartMs: now });
    return false;
  }
  if (item.count >= limit) return true;
  item.count += 1;
  requestCounters.set(key, item);
  return false;
};

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
    const communities = await Community.find({ adminId: req.admin._id, active: true });
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

    // Wake up all active devices so they pick up the change within one poll cycle
    await TetherDevice.updateMany(
      { communityId: community._id, active: true },
      { $push: { pendingCommands: { type: 'FORCE_SYNC', payload: '' } } }
    );

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

    res.json(requests.map(formatApproval));
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

    const request = await ApprovalRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'בקשה לא נמצאה' });

    const community = await Community.findById(request.communityId).select('adminId policy.approvalResolverMode');
    if (!community) return res.status(404).json({ message: 'Community not found' });

    const isOwner = String(community.adminId) === String(req.admin._id);
    const isSuper = isSuperAdmin(req.admin);
    const approvalMode = community.policy?.approvalResolverMode || 'OWNER_ONLY';

    if (approvalMode === 'OWNER_ONLY' && !isOwner) {
      return res.status(403).json({ message: 'Only the community manager can resolve approvals.' });
    }
    if (approvalMode === 'SUPERADMIN_ONLY' && !isSuper) {
      return res.status(403).json({ message: 'Only superadmin can resolve approvals.' });
    }
    if (approvalMode === 'OWNER_OR_SUPERADMIN' && !(isOwner || isSuper)) {
      return res.status(403).json({ message: 'Only manager or superadmin can resolve approvals.' });
    }

    let grantExpiresAt = null;
    if (status === 'approved' && request.action === 'APP_ACCESS' && request.packageName) {
      const requestedMinutes = Number(req.body?.grantMinutes);
      const grantMinutes = Number.isFinite(requestedMinutes)
        ? Math.max(1, Math.min(120, Math.floor(requestedMinutes)))
        : 15;
      grantExpiresAt = Date.now() + grantMinutes * 60 * 1000;

      const device = await TetherDevice.findOne({
        deviceId: request.deviceId,
        communityId: request.communityId
      });
      if (device) {
        device.pendingCommands.push({
          type: 'APPROVAL_GRANTED',
          payload: buildApprovalGrantPayload({
            packageName: request.packageName,
            action: request.action,
            expiresAt: grantExpiresAt
          })
        });
        await device.save();
      }
    }

    request.status = status;
    request.resolvedByAdminId = req.admin._id;
    request.resolvedAt = new Date();
    request.grantExpiresAt = grantExpiresAt;
    await request.save();

    res.json(formatApproval(request));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Verify PIN from Android app locally to allow uninstall
router.post('/devices/:deviceId/verify-uninstall-pin', requireDeviceAuth, async (req, res) => {
  try {
    const { pin } = req.body;
    const rlKey = `uninstall-pin:${req.ip}:${req.params.deviceId}`;
    if (hitRateLimit({ key: rlKey, limit: 8, windowMs: 10 * 60 * 1000 })) {
      return res.status(429).json({ message: 'Too many attempts. Try again later.' });
    }

    const device = await TetherDevice.findOne({ deviceId: req.params.deviceId }).populate('communityId');
    
    if (!device) return res.status(404).json({ message: 'Device not found' });
    if (!device.communityId) return res.status(404).json({ message: 'Community not found' });

    const communityPolicy = device.communityId.policy || {};
    // אין יותר PIN ברירת-מחדל '0000' — אם לא הוגדר PIN/קוד חירום, אין קוד תקף (fail-secure).
    const validPins = new Set([
      communityPolicy.uninstallPin || null,
      communityPolicy.adminEmergencyCode || null,
      device.devicePolicy?.adminEmergencyCode || null
    ].filter(Boolean));

    const submitted = String(pin || '').trim();
    if (submitted && validPins.has(submitted)) {
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

router.get('/admin/global/devices', requireTetherAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.admin)) return res.status(403).json({ message: 'גישה אסורה' });
    const devices = await TetherDevice.find({}).populate('communityId', 'name code').sort({ createdAt: -1 });
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000);
    res.json(devices.map(d => ({
      id:              d._id.toString(),
      deviceId:        d.deviceId,
      deviceModel:     d.deviceModel,
      deviceNickname:  d.deviceNickname ?? null,
      communityId:     d.communityId?._id?.toString() ?? null,
      communityName:   d.communityId?.name ?? 'לא משויך',
      communityCode:   d.communityId?.code ?? '',
      isDeviceOwner:   d.isDeviceOwner,
      allowUninstall:  d.allowUninstall ?? false,
      active:          d.active,
      lastSeen:        d.lastSeen,
      createdAt:       d.createdAt,
      isOnline:        d.lastSeen > staleThreshold,
      protectionStatus: d.protectionStatus ?? {}
    })));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// All communities across all admins, no filters
router.get('/admin/global/communities', requireTetherAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.admin)) return res.status(403).json({ message: 'גישה אסורה' });
    const communities = await Community.find({}).populate('adminId', 'name email').sort({ createdAt: -1 });
    const counts = await TetherDevice.aggregate([
      { $group: { _id: '$communityId', total: { $sum: 1 }, active: { $sum: { $cond: ['$active', 1, 0] } } } }
    ]);
    const countMap = Object.fromEntries(counts.map(c => [c._id.toString(), c]));
    res.json(communities.map(c => ({
      id:                c._id.toString(),
      name:              c.name,
      code:              c.code,
      active:            c.active,
      adminName:         c.adminId?.name  ?? 'לא ידוע',
      adminEmail:        c.adminId?.email ?? '',
      deviceCount:       countMap[c._id.toString()]?.total  ?? 0,
      activeDeviceCount: countMap[c._id.toString()]?.active ?? 0,
      createdAt:         c.createdAt
    })));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Hard-delete device by MongoDB _id
router.delete('/admin/global/devices/:id', requireTetherAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.admin)) return res.status(403).json({ message: 'גישה אסורה' });
    await TetherDevice.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Hard-delete community by MongoDB _id
router.delete('/admin/global/communities/:id', requireTetherAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.admin)) return res.status(403).json({ message: 'גישה אסורה' });
    await Community.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Rename community
router.put('/admin/global/communities/:id/rename', requireTetherAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.admin)) return res.status(403).json({ message: 'גישה אסורה' });
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'שם חובה' });
    const c = await Community.findByIdAndUpdate(req.params.id, { name: name.trim() }, { new: true });
    if (!c) return res.status(404).json({ message: 'קהילה לא נמצאה' });
    res.json({ name: c.name });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/admin/maintenance/reset-allow-uninstall', requireTetherAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req.admin)) return res.status(403).json({ message: 'גישה אסורה' });
    const result = await TetherDevice.updateMany({ allowUninstall: true }, { $set: { allowUninstall: false } });
    res.json({ revoked: result.modifiedCount });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Toggle allow-uninstall for a device
router.put('/admin/devices/:deviceId/allow-uninstall', requireTetherAuth, async (req, res) => {
  try {
    const { allowUninstall } = req.body;
    const device = await findOwnedDevice(req.admin, req.params.deviceId);
    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });
    device.allowUninstall = !!allowUninstall;
    await device.save();
    res.json({ allowUninstall: device.allowUninstall });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Remove device from community
router.delete('/admin/devices/:deviceId', requireTetherAuth, async (req, res) => {
  try {
    const device = await findOwnedDevice(req.admin, req.params.deviceId);
    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });
    device.active = false;
    await device.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get full details for a single device
router.get('/admin/devices/:deviceId', requireTetherAuth, async (req, res) => {
  try {
    const device = await findOwnedDevice(req.admin, req.params.deviceId, { populateCommunity: true });
    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });
    const communityDoc = device.communityId; // populated document
    res.json({
      id: device._id.toString(),
      deviceId: device.deviceId,
      deviceModel: device.deviceModel,
      deviceNickname: device.deviceNickname ?? null,
      communityId: communityDoc?._id?.toString() ?? '',
      communityName: communityDoc?.name ?? '',
      isDeviceOwner: device.isDeviceOwner,
      allowUninstall: device.allowUninstall ?? false,
      lastSeen: device.lastSeen,
      active: device.active,
      createdAt: device.createdAt,
      devicePolicy: device.devicePolicy ?? {},
      installedApps: device.installedApps ?? [],
      protectionStatus: device.protectionStatus ?? {},
      securityEvents: device.securityEvents ?? [],
      mergedPolicy: mergePolicy(communityDoc?.policy ?? {}, device.devicePolicy)
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Update per-device policy overrides
router.put('/admin/devices/:deviceId/device-policy', requireTetherAuth, async (req, res) => {
  try {
    const device = await findOwnedDevice(req.admin, req.params.deviceId, { populateCommunity: true });
    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });
    device.devicePolicy = sanitizeDevicePolicyPayload(req.body);
    // Push FORCE_SYNC so device picks up changes on next poll
    device.pendingCommands.push({ type: 'FORCE_SYNC', payload: '' });
    await device.save();
    res.json({ devicePolicy: device.devicePolicy, mergedPolicy: mergePolicy(device.communityId.policy, device.devicePolicy) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Rename device (nickname)
router.put('/admin/devices/:deviceId/nickname', requireTetherAuth, async (req, res) => {
  try {
    const { nickname } = req.body;
    const device = await findOwnedDevice(req.admin, req.params.deviceId);
    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });
    device.deviceNickname = nickname || null;
    await device.save();
    res.json({ deviceNickname: device.deviceNickname });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Dashboard stats
router.get('/admin/dashboard', requireTetherAuth, async (req, res) => {
  try {
    const ownedCommunityIds = await getOwnedCommunityIds(req.admin);
    const communityScope = ownedCommunityIds ? { communityId: { $in: ownedCommunityIds } } : {};
    const totalCommunities = ownedCommunityIds
      ? ownedCommunityIds.length
      : await Community.countDocuments({});

    const [totalDevices, pendingApprovals, inactiveDevices] = await Promise.all([
      TetherDevice.countDocuments({ ...communityScope, active: true }),
      ApprovalRequest.countDocuments({ ...communityScope, status: 'pending' }),
      TetherDevice.countDocuments({
        ...communityScope,
        active: true,
        lastSeen: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
    ]);

    res.json({
      totalCommunities,
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
    const communities = isSuperAdmin(req.admin)
      ? await Community.find({}).select('_id name')
      : await Community.find({ adminId: req.admin._id }).select('_id name');
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
    const ownedCommunityIds = await getOwnedCommunityIds(req.admin);
    const approvals = await ApprovalRequest.find({
      ...(ownedCommunityIds ? { communityId: { $in: ownedCommunityIds } } : {}),
      status: 'pending'
    }).sort({ createdAt: -1 });

    res.json(approvals.map(formatApproval));
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


router.get('/admin/members', requireTetherAuth, async (req, res) => {
  try {
    if (req.admin.role !== 'superadmin') return res.status(403).json({ message: 'גישה אסורה' });
    const admins = await TetherAdmin.find({}, 'name email role active createdAt');
    res.json(admins.map(formatAdmin));
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
    res.status(201).json(formatAdmin(admin));
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

// Approved apps list for device updater/store
router.get('/apps/approved', async (_req, res) => {
  try {
    const apps = await TetherApprovedApp.find({ active: true })
      .sort({ appName: 1 })
      .select('packageName appName versionCode downloadUrl iconUrl');
    res.json(apps.map((app) => ({
      packageName: app.packageName,
      appName: app.appName,
      versionCode: app.versionCode,
      downloadUrl: app.downloadUrl,
      iconUrl: app.iconUrl || null
    })));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Admin: manage approved app catalog
router.get('/admin/apps/approved', requireTetherAuth, async (_req, res) => {
  try {
    const apps = await TetherApprovedApp.find({}).sort({ appName: 1 });
    res.json(apps);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/admin/apps/approved', requireTetherAuth, async (req, res) => {
  try {
    const packageName = String(req.body?.packageName || '').trim();
    const appName = String(req.body?.appName || '').trim();
    const versionCode = Number(req.body?.versionCode || 1);
    const downloadUrl = String(req.body?.downloadUrl || '').trim();
    const iconUrl = sanitizeOptionalString(req.body?.iconUrl);

    if (!packageName || !appName || !downloadUrl || !Number.isFinite(versionCode) || versionCode < 1) {
      return res.status(400).json({ message: 'packageName, appName, versionCode>=1, downloadUrl are required.' });
    }

    const app = await TetherApprovedApp.findOneAndUpdate(
      { packageName },
      { packageName, appName, versionCode: Math.floor(versionCode), downloadUrl, iconUrl, active: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(app);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.put('/admin/apps/approved/:id', requireTetherAuth, async (req, res) => {
  try {
    const updates = {};
    if (req.body?.appName != null) updates.appName = String(req.body.appName).trim();
    if (req.body?.versionCode != null) {
      const parsed = Number(req.body.versionCode);
      if (!Number.isFinite(parsed) || parsed < 1) return res.status(400).json({ message: 'versionCode must be >= 1' });
      updates.versionCode = Math.floor(parsed);
    }
    if (req.body?.downloadUrl != null) updates.downloadUrl = String(req.body.downloadUrl).trim();
    if (req.body?.iconUrl != null) updates.iconUrl = sanitizeOptionalString(req.body.iconUrl);
    if (req.body?.active != null) updates.active = !!req.body.active;

    const app = await TetherApprovedApp.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!app) return res.status(404).json({ message: 'App not found' });
    res.json(app);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.delete('/admin/apps/approved/:id', requireTetherAuth, async (req, res) => {
  try {
    const app = await TetherApprovedApp.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!app) return res.status(404).json({ message: 'App not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get('/app/download', (req, res) => {
  const apkPath = path.join(__dirname, '../../uploads/tether-latest.apk');
  res.download(apkPath, 'tether-latest.apk', (err) => {
    if (err) res.status(404).json({ message: 'APK לא נמצא — העלה את הקובץ לשרת' });
  });
});

router.get('/app/version', (req, res) => {
  try {
    const versionPath = path.join(__dirname, '../../uploads/tether-version.json');
    const data = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    res.json(data);
  } catch {
    res.status(404).json({ message: 'קובץ גרסה לא נמצא' });
  }
});

router.post('/admin/app/version', requireTetherAuth, (req, res) => {
  try {
    const { versionCode, versionName } = req.body;
    if (!versionCode || !versionName) {
      return res.status(400).json({ message: 'versionCode ׳•-versionName ׳—׳•׳‘׳”' });
    }
    const versionPath = path.join(__dirname, '../../uploads/tether-version.json');
    fs.writeFileSync(versionPath, JSON.stringify({ versionCode, versionName }, null, 2));
    res.json({ versionCode, versionName });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// דיווח אפליקציות מהמכשיר
router.post('/devices/:deviceId/apps', requireDeviceAuth, async (req, res) => {
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
router.post('/community/:id/lock', requireTetherAuth, async (req, res) => {
  try {
    const { lockedUntilTs } = req.body;
    const communityFilter = isSuperAdmin(req.admin)
      ? { _id: req.params.id }
      : { _id: req.params.id, adminId: req.admin._id };
    const community = await Community.findOneAndUpdate(communityFilter, {
      'policy.lockedUntilTs': lockedUntilTs
    });
    if (!community) return res.status(404).json({ message: 'קהילה לא נמצאה' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all devices across admin's communities
router.get('/admin/devices', requireTetherAuth, async (req, res) => {
  try {
    const communities = isSuperAdmin(req.admin)
      ? await Community.find({}).select('_id name')
      : await Community.find({ adminId: req.admin._id }).select('_id name');
    const communityIds = communities.map(c => c._id);
    const communityMap = Object.fromEntries(communities.map(c => [c._id.toString(), c.name]));
    const devices = await TetherDevice.find({ communityId: { $in: communityIds }, active: true });
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000);
    res.json(devices.map(d => ({
      ...formatDevice(d),
      deviceNickname: d.deviceNickname ?? null,
      communityName: communityMap[d.communityId.toString()] ?? '',
      protectionStatus: d.protectionStatus ?? {},
      isOnline: d.lastSeen > staleThreshold,
    })));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/devices/:deviceId/heartbeat', requireDeviceAuth, async (req, res) => {
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

router.post('/devices/:deviceId/events', requireDeviceAuth, async (req, res) => {
  try {
    const { type, packageName } = req.body;
    const validTypes = [
      'UNINSTALL_ATTEMPT', 'ADMIN_DEACTIVATE_ATTEMPT',
      'BLOCKED_APP_OPENED', 'TIME_LOCK_BLOCKED', 'NEW_APP_INSTALLED'
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

router.get('/admin/devices/:deviceId/events', requireTetherAuth, async (req, res) => {
  try {
    const device = await findOwnedDevice(req.admin, req.params.deviceId);
    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });
    res.json({
      protectionStatus: device.protectionStatus,
      events: device.securityEvents.slice().reverse() // newest first
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// The command is delivered on the device's next policy poll (at most 15 min later).
router.post('/admin/devices/:deviceId/commands', requireTetherAuth, async (req, res) => {
  try {
    const { type, payload } = req.body;
    if (!type) return res.status(400).json({ message: 'type ׳—׳•׳‘׳”' });

    const device = await findOwnedDevice(req.admin, req.params.deviceId);
    if (!device) return res.status(404).json({ message: 'מכשיר לא נמצא' });
    device.pendingCommands.push({ type, payload: payload || '' });
    await device.save();
    res.json({ success: true, pendingCount: device.pendingCommands.length });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

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




