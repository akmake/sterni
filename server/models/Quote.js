import mongoose from 'mongoose';

const quoteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'חובה לתת שם להצעת המחיר'],
    trim: true,
    unique: true
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  // התיקון: sparse מאפשר לשמור הצעות ללא מספר, בלי שהמסד יצעק על כפילויות
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

// עדכון תאריך שינוי
quoteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Quote = mongoose.model('Quote', quoteSchema);

// 🔥 שורת הקסם: מוחקת את האינדקס הישן שתוקע את המערכת 🔥
// ברגע שהשרת יעלה מחדש, השורה הזו תרוץ, תנקה את החסימה, והשמירה תעבוד חלק.
Quote.collection.dropIndex('quoteNumber_1').catch(() => { 
    // מתעלם משגיאות אם האינדקס כבר נמחק או לא קיים
});

export default Quote;