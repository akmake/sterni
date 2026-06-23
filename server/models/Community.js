import mongoose from 'mongoose';
import crypto from 'crypto';

const policySchema = new mongoose.Schema({
  blockInstallApps:      { type: Boolean, default: true },
  hideGooglePlay:        { type: Boolean, default: true },
  blockAllStores:        { type: Boolean, default: false },
  blockApkInstall:       { type: Boolean, default: true },
  blockSafeBoot:         { type: Boolean, default: true },
  blockFactoryReset:     { type: Boolean, default: true },
  blockUsbTransfer:      { type: Boolean, default: false },
  maxInstalledApps:      { type: Number,  default: null },
  // BLACKLIST: allow every app except blockedApps; WHITELIST: only allowedApps run (kiosk).
  appPolicyMode: {
    type: String,
    enum: ['BLACKLIST', 'WHITELIST'],
    default: 'BLACKLIST'
  },
  allowedApps:           { type: [String], default: [] },
  blockedApps:           { type: [String], default: [] },
  appTimeLocks: {
    type: [{
      packageName: { type: String, required: true },
      lockedUntilTs: { type: Number, default: null }
    }],
    default: []
  },
  blockedActionBehavior: {
    type: String,
    enum: ['SILENT', 'SHOW_MESSAGE', 'REQUEST_APPROVAL'],
    default: 'SILENT'
  },
  approvalResolverMode: {
    type: String,
    enum: ['OWNER_ONLY', 'SUPERADMIN_ONLY', 'OWNER_OR_SUPERADMIN'],
    default: 'OWNER_ONLY'
  },
  logsEnabled: { type: Boolean, default: false },
  blockWhatsAppChannels: { type: Boolean, default: false },
  supportWhatsApp: { type: String, default: null },
  supportEmail: { type: String, default: null },
  supportName: { type: String, default: 'Community Manager' },
  uninstallPin: { type: String, default: null }, // null = אין PIN מוגדר → ביטול נעילה נדחה (fail-secure)
  webFilterMode: {
    type: String,
    enum: ['NONE', 'BLACKLIST', 'WHITELIST'],
    default: 'NONE'
  },
  allowedDomains: { type: [String], default: [] },
  blockedDomains: { type: [String], default: [] },
  lockedUntilTs:  { type: Number,  default: null },
  adminEmergencyCode: { type: String, default: null }
}, { _id: false });

const communitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Community name is required'],
    trim: true
  },
  code: {
    type: String,
    unique: true,
    uppercase: true,
    default: () => crypto.randomBytes(4).toString('hex').toUpperCase()
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  policy: {
    type: policySchema,
    default: () => ({})
  },
  active: { type: Boolean, default: true }
}, {
  timestamps: true,
  versionKey: false
});

export default mongoose.models.Community || mongoose.model('Community', communitySchema);
