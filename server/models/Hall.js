import mongoose from 'mongoose';

const hallSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  color: { type: String, default: '#3b82f6' }, // צבע לתצוגה בלוח שנה
  description: { type: String }
}, { timestamps: true });

export default mongoose.model('Hall', hallSchema);