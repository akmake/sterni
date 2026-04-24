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
  type:    { type: String, required: true }, // SHOW_MESSAGE | FORCE_SYNC
  payload: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const tetherDeviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  deviceModel: {
    type: String,
    default: 'Unknown'
  },
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

  // Live protection-layer status (updated by heartbeat)
  protectionStatus: {
    accessibilityEnabled: { type: Boolean, default: false },
    isDeviceAdmin:        { type: Boolean, default: false },
    isDeviceOwner:        { type: Boolean, default: false },
    vpnActive:            { type: Boolean, default: false },
    lastHeartbeat:        { type: Date,    default: null }
  },

  // Rolling log of the last 50 security events
  securityEvents: {
    type: [securityEventSchema],
    default: [],
    validate: {
      validator(v) { return v.length <= 50; },
      message: 'securityEvents capped at 50'
    }
  },

  // Commands queued by admin — cleared atomically on next policy poll
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
