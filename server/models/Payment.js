import mongoose from 'mongoose';

// --- סכמה לתשלום בודד ---
const paymentSchema = new mongoose.Schema({
  // קישור לקבוצה
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'חובה לשייך תשלום לקבוצה'],
    index: true,
  },

  // סוג התשלום
  type: {
    type: String,
    enum: ['invoice', 'receipt', 'transfer', 'check', 'cash', 'credit_card', 'other'],
    required: [true, 'חובה לציין סוג תשלום'],
  },

  // סכום
  amount: {
    type: Number,
    required: [true, 'חובה לציין סכום'],
    min: [0, 'סכום חייב להיות חיובי'],
  },

  // מטבע
  currency: {
    type: String,
    enum: ['ILS', 'USD', 'EUR'],
    default: 'ILS',
  },

  // תאריך התשלום
  paymentDate: {
    type: Date,
    required: [true, 'חובה לציין תאריך תשלום'],
  },

  // מספר אסמכתא (מס' חשבונית / קבלה / צ'ק)
  referenceNumber: {
    type: String,
    trim: true,
  },

  // תיאור / הערות
  description: {
    type: String,
    trim: true,
  },

  // סטטוס
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'cancelled'],
    default: 'pending',
  },

  // קבצים מצורפים (אסמכתאות)
  attachments: [{
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimetype: { type: String },
    size: { type: Number },
    path: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  }],

  // מי רשם את התשלום
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  // מי אישר את התשלום
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  confirmedAt: { type: Date },

  // הערות פנימיות (לא נראות ללקוח)
  internalNotes: { type: String },

  // תגיות לסיווג
  tags: [{ type: String, trim: true }],

}, { timestamps: true });

// --- אינדקסים ---
paymentSchema.index({ group: 1, paymentDate: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ type: 1 });

// --- Virtual: סה"כ ששולם לקבוצה ---
paymentSchema.statics.getTotalPaidForGroup = async function(groupId) {
  const result = await this.aggregate([
    { $match: { group: new mongoose.Types.ObjectId(groupId), status: { $in: ['pending', 'confirmed'] } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  return result[0]?.total || 0;
};

// --- Virtual: סיכום תשלומים לקבוצה ---
paymentSchema.statics.getPaymentSummary = async function(groupId) {
  const result = await this.aggregate([
    { $match: { group: new mongoose.Types.ObjectId(groupId) } },
    {
      $group: {
        _id: '$status',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      }
    }
  ]);

  const summary = { pending: 0, confirmed: 0, rejected: 0, cancelled: 0, pendingCount: 0, confirmedCount: 0 };
  for (const r of result) {
    summary[r._id] = r.total;
    summary[`${r._id}Count`] = r.count;
  }
  return summary;
};

export default mongoose.model('Payment', paymentSchema);