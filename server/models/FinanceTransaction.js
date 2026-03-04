import mongoose from 'mongoose';

const financeTransactionSchema = new mongoose.Schema({
  family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, required: true },
  description: { type: String, default: '' },
  rawDescription: { type: String, default: '' },
  amount: { type: Number, required: true },
  type: {
    type: String,
    enum: ['הוצאה', 'הכנסה', 'expense', 'income'],
    required: true,
    set: (v) => {
      if (v === 'expense') return 'הוצאה';
      if (v === 'income') return 'הכנסה';
      return v;
    }
  },
  category: { type: String, default: 'כללי' },
  account: {
    type: String,
    enum: ['checking', 'cash', 'deposits', 'stocks', 'עו"ש', 'מזומן'],
    default: 'checking',
    set: (v) => {
      const map = { 'עו"ש': 'checking', 'מזומן': 'cash' };
      return map[v] || v;
    }
  }
}, { timestamps: true });

financeTransactionSchema.index({ family: 1, date: 1, description: 1, amount: 1, type: 1 }, { unique: true });
financeTransactionSchema.index({ family: 1, date: -1 });
financeTransactionSchema.index({ family: 1, category: 1 });
financeTransactionSchema.index({ family: 1, type: 1 });

export default mongoose.model('FinanceTransaction', financeTransactionSchema);
