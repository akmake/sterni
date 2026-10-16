import mongoose from 'mongoose';

/**
 * Launcher icon of an app installed on a managed device, shown next to the app's name in the
 * manager's app list.
 *
 * Content-addressed: the key is the SHA-1 of the PNG bytes, verified on upload, so the same icon
 * reported by a thousand devices is stored once, and one device can never overwrite the icon
 * another device's app list points at.
 */
const tetherAppIconSchema = new mongoose.Schema({
  hash:        { type: String, required: true, unique: true },
  data:        { type: Buffer, required: true },
  contentType: { type: String, default: 'image/png' },
  // The package the icon was first uploaded for — informational only, never used as a key.
  packageName: { type: String, default: null },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

export default mongoose.models.TetherAppIcon || mongoose.model('TetherAppIcon', tetherAppIconSchema);
