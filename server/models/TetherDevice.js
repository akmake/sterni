import mongoose from 'mongoose';

const securityEventSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['UNINSTALL_ATTEMPT', 'ADMIN_DEACTIVATE_ATTEMPT', 'BLOCKED_APP_OPENED', 'TIME_LOCK_BLOCKED', 'NEW_APP_INSTALLED'],
    required: true
  },
  packageName: { type: String, default: null },
  timestamp:   { type: Date, default: Date.now }
}, { _id: false });

const pendingCommandSchema = new mongoose.Schema({
  type:    { type: String, required: true },
  payload: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const appTimeLockSchema = new mongoose.Schema({
  packageName:  { type: String, required: true },
  lockedUntilTs: { type: Number, default: null }, // epoch ms — null = permanent block
}, { _id: false });

const devicePolicySchema = new mongoose.Schema({
  blockInstallApps:  { type: Boolean, default: null }, // null = inherit from community
  hideGooglePlay:    { type: Boolean, default: null },
  blockAllStores:    { type: Boolean, default: null },
  blockApkInstall:   { type: Boolean, default: null },
  blockSafeBoot:     { type: Boolean, default: null },
  blockFactoryReset: { type: Boolean, default: null },
  blockUsbTransfer:  { type: Boolean, default: null },
  maxInstalledApps:  { type: Number, default: null },
  blockedActionBehavior: {
    type: String,
    enum: ['SILENT', 'SHOW_MESSAGE', 'REQUEST_APPROVAL'],
    default: null
  },
  logsEnabled:          { type: Boolean, default: null },
  blockWhatsAppChannels:{ type: Boolean, default: null },
  supportWhatsApp:      { type: String, default: null },
  supportEmail:         { type: String, default: null },
  supportName:          { type: String, default: null },
  webFilterMode: {
    type: String,
    enum: ['NONE', 'BLACKLIST', 'WHITELIST'],
    default: null
  },
  allowedDomains:    { type: [String], default: undefined },
  blockedDomains:    { type: [String], default: undefined },
  adminEmergencyCode:{ type: String, default: null },
  blockedApps:       { type: [String], default: [] },  // extra per-device blocks
  allowedApps:       { type: [String], default: [] },  // per-device overrides (force-allow)
  appTimeLocks:      { type: [appTimeLockSchema], default: [] },
  lockedUntilTs:     { type: Number, default: null },  // full device lock
}, { _id: false });

const tetherDeviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  hardwareId: {
    type: String,
    index: true,
    default: null
  },
  deviceModel: {
    type: String,
    default: 'Unknown'
  },
  deviceNickname: { type: String, default: null },
  communityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true
  },

  isDeviceOwner:  { type: Boolean, default: false },
  allowUninstall: { type: Boolean, default: false },

  installedApps: [{
    packageName: String,
    appName:     String,
    isSystemApp: Boolean
  }],

  // Per-device policy overrides (merged on top of community policy)
  devicePolicy: {
    type: devicePolicySchema,
    default: () => ({})
  },

  // Live protection-layer status (updated by heartbeat)
  protectionStatus: {
    accessibilityEnabled: { type: Boolean, default: false },
    isDeviceAdmin:        { type: Boolean, default: false },
    isDeviceOwner:        { type: Boolean, default: false },
    vpnActive:            { type: Boolean, default: false },
    lastHeartbeat:        { type: Date,    default: null }
  },

  securityEvents: {
    type: [securityEventSchema],
    default: [],
    validate: {
      validator(v) { return v.length <= 50; },
      message: 'securityEvents capped at 50'
    }
  },

  pendingCommands: {
    type: [pendingCommandSchema],
    default: []
  },

  lastSeen: { type: Date,    default: Date.now },
  active:   { type: Boolean, default: true }
}, {
  timestamps: true,
  versionKey: false
});

export default mongoose.models.TetherDevice || mongoose.model('TetherDevice', tetherDeviceSchema);
