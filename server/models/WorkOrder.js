import mongoose from 'mongoose';

const workOrderSchema = new mongoose.Schema(
  {
    // תאריך קבלת הסחורה — ברירת מחדל: היום
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

    // סוג: טלית או ציציות
    type: {
      type: String,
      enum: ['tallit', 'tzitzit'],
      required: [true, 'חובה לבחור סוג (טלית / ציציות)'],
    },

    // כמות
    quantity: {
      type: Number,
      required: [true, 'חובה להזין כמות'],
      min: [1, 'כמות חייבת להיות לפחות 1'],
    },

    // מחיר ליחידה
    pricePerUnit: {
      type: Number,
      required: [true, 'חובה להזין מחיר ליחידה'],
      min: [0, 'מחיר חייב להיות חיובי'],
    },

    // סכום כולל (מחושב אוטומטית)
    totalAmount: {
      type: Number,
      default: 0,
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

// חישוב אוטומטי של הסכום הכולל לפני שמירה
workOrderSchema.pre('save', function (next) {
  this.totalAmount = this.quantity * this.pricePerUnit;
  next();
});

workOrderSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update.quantity != null && update.pricePerUnit != null) {
    update.totalAmount = update.quantity * update.pricePerUnit;
  } else if (update.quantity != null || update.pricePerUnit != null) {
    // אם רק אחד עודכן, נחשב בקונטרולר
  }
  next();
});

const WorkOrder = mongoose.model('WorkOrder', workOrderSchema);
export default WorkOrder;
