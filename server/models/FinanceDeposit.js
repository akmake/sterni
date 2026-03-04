import mongoose from 'mongoose';

const financeDepositSchema = new mongoose.Schema({
  family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true, index: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true, trim: true },
  principal: { type: Number, required: true, min: 0 },
  annualInterestRate: { type: Number, required: true, min: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['active', 'broken', 'matured'],
    default: 'active'
  },
  sourceAccount: { type: String, trim: true },
  exitPoints: { type: [Date], default: [] },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

financeDepositSchema.virtual('futureValue').get(function () {
  const years = (this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return this.principal * (1 + (this.annualInterestRate / 100) * years);
});

financeDepositSchema.virtual('daysLeft').get(function () {
  const now = new Date();
  const diff = this.endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

export default mongoose.model('FinanceDeposit', financeDepositSchema);
