import mongoose from 'mongoose';

const tetherAdminSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['admin', 'superadmin'], default: 'admin' },
  active:       { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

export default mongoose.models.TetherAdmin || mongoose.model('TetherAdmin', tetherAdminSchema);
