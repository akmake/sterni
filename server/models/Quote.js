import mongoose from 'mongoose';

const quoteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'חובה לתת שם להצעת המחיר'],
    trim: true,
    unique: true // מונע שמות כפולים
  },
  content: {
    type: mongoose.Schema.Types.Mixed, // שומר את כל האובייקט של ההצעה כמו שהוא
    required: true
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

// עדכון תאריך שינוי אחרון אוטומטית
quoteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Quote = mongoose.model('Quote', quoteSchema);
export default Quote;