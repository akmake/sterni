import mongoose from 'mongoose';

const financeCategorySchema = new mongoose.Schema({
  family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['הוצאה', 'הכנסה', 'כללי', 'expense', 'income', 'general'],
    default: 'הוצאה',
    set: (v) => {
      const map = { 'expense': 'הוצאה', 'income': 'הכנסה', 'general': 'כללי' };
      return map[v] || v;
    }
  },
  color: { type: String, default: '#64748b' }
}, { timestamps: true });

financeCategorySchema.index({ family: 1, name: 1 }, { unique: true });

export default mongoose.model('FinanceCategory', financeCategorySchema);
