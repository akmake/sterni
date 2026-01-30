import mongoose from 'mongoose';

const quoteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'חובה לתת שם להצעת המחיר'],
    trim: true,
    unique: true
  },
  // --- שדות חדשים ל-CRM (הוספתי כאן) ---
  clientName: { type: String }, // שם הלקוח לתצוגה ברשימה
  contactPerson: {
    name: String,
    phone: String,
    email: String
  },
  dates: {
    from: Date,
    to: Date
  },
  pax: { type: Number, default: 0 },
  eventType: String,
  
  // שדות סטטוס להמרה
  isConverted: { type: Boolean, default: false },
  convertedGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  // -------------------------------------

  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  quoteNumber: {
    type: Number,
    unique: true,
    sparse: true 
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false 
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

quoteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Quote = mongoose.model('Quote', quoteSchema);

// שמירת התיקון שלך לאינדקס
Quote.collection.dropIndex('quoteNumber_1').catch(() => {});

export default Quote;