import mongoose from 'mongoose';

const financeRecurringSchema = new mongoose.Schema({
  family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true, index: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  description: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  type: {
    type: String,
    enum: ['הוצאה', 'הכנסה'],
    required: true,
    set: v => (v === 'income' || v === 'הכנסה') ? 'הכנסה' : 'הוצאה'
  },
  category: { type: String, default: 'כללי', trim: true },
  account: {
    type: String,
    enum: ['checking', 'cash', 'deposits', 'stocks'],
    default: 'checking',
    set: v => {
      const map = { 'עו"ש': 'checking', 'מזומן': 'cash' };
      return map[v] || v || 'checking';
    }
  },

  frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], default: 'monthly' },
  dayOfMonth: { type: Number, min: 1, max: 31 },
  dayOfWeek: { type: Number, min: 0, max: 6 },

  startDate: { type: Date, required: true },
  endDate: { type: Date },

  isActive: { type: Boolean, default: true },
  isPaused: { type: Boolean, default: false },

  lastExecuted: { type: Date },
  nextExecution: { type: Date },
  executionCount: { type: Number, default: 0 },

  subcategory: {
    type: String,
    enum: ['subscription', 'bill', 'salary', 'rent', 'insurance', 'loan_payment', 'savings', 'other'],
    default: 'other'
  },

  provider: { type: String, trim: true },
  notes: { type: String, maxlength: 500, trim: true },
  remindDaysBefore: { type: Number, default: 0, min: 0, max: 30 },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

financeRecurringSchema.virtual('annualCost').get(function () {
  const multipliers = { daily: 365, weekly: 52, monthly: 12, yearly: 1 };
  return this.amount * (multipliers[this.frequency] || 12);
});

financeRecurringSchema.virtual('monthlyCost').get(function () {
  return this.annualCost / 12;
});

financeRecurringSchema.index({ family: 1, isActive: 1 });
financeRecurringSchema.index({ family: 1, nextExecution: 1 });

export default mongoose.model('FinanceRecurring', financeRecurringSchema);
