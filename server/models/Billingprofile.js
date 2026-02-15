import mongoose from 'mongoose';

// --- פרופיל חיוב לקבוצה ---
// מאחסן את הסכום הכולל הצפוי, הנחות, תנאי תשלום וכו'
const billingProfileSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
    unique: true,
    index: true,
  },

  // הסכום הכולל שהלקוח צריך לשלם (מהצעת המחיר / דרישת תשלום)
  totalExpected: {
    type: Number,
    default: 0,
    min: 0,
  },

  // מטבע
  currency: {
    type: String,
    enum: ['ILS', 'USD', 'EUR'],
    default: 'ILS',
  },

  // הנחות
  discount: {
    type: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
    value: { type: Number, default: 0 },
    reason: { type: String },
  },

  // מע"מ
  vatRate: {
    type: Number,
    default: 17,
  },

  includesVat: {
    type: Boolean,
    default: true,
  },

  // תנאי תשלום
  paymentTerms: {
    type: String,
    enum: ['immediate', 'net_15', 'net_30', 'net_60', 'custom'],
    default: 'immediate',
  },

  customTermsDescription: { type: String },

  // תאריך יעד לתשלום
  dueDate: { type: Date },

  // פירוט שורות חיוב
  lineItems: [{
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    total: { type: Number },
    category: {
      type: String,
      enum: ['accommodation', 'meals', 'activities', 'transport', 'equipment', 'other'],
      default: 'other',
    },
  }],

  // הערות
  notes: { type: String },

  // קישור להצעת מחיר
  linkedQuote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
  },

  // מי יצר
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

}, { timestamps: true });

// --- Virtuals ---
billingProfileSchema.virtual('netTotal').get(function() {
  let base = this.totalExpected;
  if (this.discount) {
    if (this.discount.type === 'percentage') {
      base -= base * (this.discount.value / 100);
    } else {
      base -= this.discount.value;
    }
  }
  return Math.max(0, base);
});

billingProfileSchema.virtual('vatAmount').get(function() {
  if (this.includesVat) {
    return this.netTotal - (this.netTotal / (1 + this.vatRate / 100));
  }
  return this.netTotal * (this.vatRate / 100);
});

billingProfileSchema.virtual('grandTotal').get(function() {
  if (this.includesVat) return this.netTotal;
  return this.netTotal + this.vatAmount;
});

billingProfileSchema.set('toJSON', { virtuals: true });
billingProfileSchema.set('toObject', { virtuals: true });

export default mongoose.model('BillingProfile', billingProfileSchema);