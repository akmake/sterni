import mongoose from 'mongoose';

const extraTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true }
}, { timestamps: true });

export default mongoose.models.ExtraType || mongoose.model('ExtraType', extraTypeSchema);
