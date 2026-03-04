import mongoose from 'mongoose';

const budgetItemSchema = new mongoose.Schema({
  category: { type: String, required: true, trim: true },
  limit: { type: Number, required: true, min: 0 },
  spent: { type: Number, default: 0, min: 0 },
  color: { type: String, default: '#3b82f6' },
}, { _id: true });

const financeBudgetSchema = new mongoose.Schema({
  family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true, index: true },

  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },

  totalLimit: { type: Number, required: true, min: 0 },
  items: [budgetItemSchema],

  alertThreshold: { type: Number, default: 80, min: 0, max: 100 },
  isActive: { type: Boolean, default: true },
  totalSpent: { type: Number, default: 0 },
  notes: { type: String, maxlength: 500, trim: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

financeBudgetSchema.index({ family: 1, month: 1, year: 1 }, { unique: true });

financeBudgetSchema.virtual('percentUsed').get(function () {
  if (this.totalLimit === 0) return 0;
  return Math.round((this.totalSpent / this.totalLimit) * 100);
});

financeBudgetSchema.virtual('remaining').get(function () {
  return this.totalLimit - this.totalSpent;
});

financeBudgetSchema.virtual('isOverBudget').get(function () {
  return this.totalSpent > this.totalLimit;
});

export default mongoose.model('FinanceBudget', financeBudgetSchema);
