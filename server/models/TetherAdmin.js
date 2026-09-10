import mongoose from 'mongoose';

const tetherAdminSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['admin', 'superadmin'], default: 'admin' },
  active:       { type: Boolean, default: true },
  // Bumped on an explicit logout. Admin tokens never expire on their own, so this counter is the
  // only thing that invalidates them: a token whose `tv` claim no longer matches is rejected.
  tokenVersion: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });

export default mongoose.models.TetherAdmin || mongoose.model('TetherAdmin', tetherAdminSchema);
