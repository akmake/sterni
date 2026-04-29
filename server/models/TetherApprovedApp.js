import mongoose from 'mongoose';

const tetherApprovedAppSchema = new mongoose.Schema({
  packageName: { type: String, required: true, unique: true, trim: true },
  appName: { type: String, required: true, trim: true },
  versionCode: { type: Number, default: 1, min: 1 },
  downloadUrl: { type: String, required: true, trim: true },
  iconUrl: { type: String, default: null, trim: true },
  active: { type: Boolean, default: true }
}, {
  timestamps: true,
  versionKey: false
});

export default mongoose.models.TetherApprovedApp ||
  mongoose.model('TetherApprovedApp', tetherApprovedAppSchema);
