import mongoose from 'mongoose';

const financeAccountSchema = new mongoose.Schema({
  family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  name: { type: String, required: true },
  balance: { type: Number, default: 0 },
}, { timestamps: true });

financeAccountSchema.index({ family: 1, name: 1 }, { unique: true });

export default mongoose.model('FinanceAccount', financeAccountSchema);
