import mongoose from 'mongoose';
import crypto from 'crypto';

const policySchema = new mongoose.Schema({
  blockInstallApps:      { type: Boolean, default: true },
  hideGooglePlay:        { type: Boolean, default: true },
  blockSafeBoot:         { type: Boolean, default: true },
  blockFactoryReset:     { type: Boolean, default: true },
  blockUsbTransfer:      { type: Boolean, default: false },
  maxInstalledApps:      { type: Number,  default: null },
  allowedApps:           { type: [String], default: [] },
  blockedApps:           { type: [String], default: [] },
  blockedActionBehavior: {
    type: String,
    enum: ['SILENT', 'SHOW_MESSAGE', 'REQUEST_APPROVAL'],
    default: 'SILENT'
  },
  logsEnabled: { type: Boolean, default: false }
}, { _id: false });

const communitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'שם קהילה חובה'],
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
