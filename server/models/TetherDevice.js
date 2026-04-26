import mongoose from 'mongoose';

const securityEventSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['UNINSTALL_ATTEMPT', 'ADMIN_DEACTIVATE_ATTEMPT', 'BLOCKED_APP_OPENED', 'TIME_LOCK_BLOCKED'],
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
