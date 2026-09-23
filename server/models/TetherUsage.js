import mongoose from 'mongoose';

/**
 * One foreground app session reported by a managed device: which app, when, for how long.
 *
 * Stored one document per session rather than embedded in the device, because this is the one
 * collection that grows without bound — a device produces hundreds of switches a day. Keeping it
 * separate means a device document stays small, and a TTL index expires the history on its own.
 */
const tetherUsageSchema = new mongoose.Schema({
  deviceId:    { type: String, required: true, index: true },
  communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', index: true },
  packageName: { type: String, required: true },
  appName:     { type: String, default: null },
  startTs:     { type: Number, required: true },  // epoch ms
  endTs:       { type: Number, required: true },
  durationMs:  { type: Number, required: true },
}, { versionKey: false });

// Device page queries are always "this device, newest first".
tetherUsageSchema.index({ deviceId: 1, startTs: -1 });

// The device re-sends a batch when an upload fails midway, so the same session can arrive twice.
// A unique key on (device, package, start) makes the ingest idempotent instead of duplicating rows.
tetherUsageSchema.index({ deviceId: 1, packageName: 1, startTs: 1 }, { unique: true });

// Usage history expires after 30 days. This is behavioural data about a person; keeping it forever
// serves no management purpose, so the database drops it automatically rather than relying on
// anyone remembering to prune.
tetherUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
tetherUsageSchema.add({ createdAt: { type: Date, default: Date.now } });

export default mongoose.models.TetherUsage || mongoose.model('TetherUsage', tetherUsageSchema);
