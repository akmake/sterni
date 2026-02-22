import mongoose from 'mongoose';

const supplierPaymentSchema = new mongoose.Schema(
  {
    // תאריך התשלום — ברירת מחדל: היום
    date: {
      type: Date,
      default: Date.now,
    },

    // ספק
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'חובה לבחור ספק'],
      index: true,
    },

    // סכום שהתקבל
    amount: {
      type: Number,
      required: [true, 'חובה להזין סכום'],
      min: [0.01, 'סכום חייב להיות חיובי'],
    },

    // אמצעי תשלום
    method: {
      type: String,
      enum: ['cash', 'transfer', 'check', 'bit', 'other'],
      default: 'cash',
    },

    // הערות
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

const SupplierPayment = mongoose.model('SupplierPayment', supplierPaymentSchema);
export default SupplierPayment;
