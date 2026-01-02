import mongoose from 'mongoose';

// סכמה לאירוע בודד
const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  
  // שינוי: אולם הוא כבר לא חובה (כי באירוע כללי יש טקסט חופשי)
  hall: { type: mongoose.Schema.Types.ObjectId, ref: 'Hall', required: false },
  
  // שדות חדשים לאירוע
  eventType: { 
    type: String, 
    enum: ['meal', 'general', 'regular'], // regular = תאימות לאחור
    default: 'regular' 
  },
  
  // לוגיקה לארוחות
  mealType: { 
    type: String, 
    enum: ['breakfast', 'lunch', 'dinner', 'light', 'night_treats'],
    required: false
  },
  kosherType: {
    type: String,
    enum: ['parve', 'meat'],
    required: false
  },

  // לוגיקה לאירוע כללי
  locationText: { type: String, required: false }, // מיקום טקסט חופשי

  pax: { type: Number, default: 0 },
  requirements: { type: String }
});

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },

  // כמות בפועל/משוערת
  pax: { type: Number, required: true, default: 0 },

  // --- שדות חדשים לקבוצה ---
  minPax: { type: Number, required: true, default: 0 }, // התחייבות מינימלית
  hostingType: { 
    type: String, 
    enum: ['seminar', 'overnight'], // יום עיון / אירוח עם לינה
    required: true,
    default: 'seminar'
  },
  // -------------------------

  contactPerson: {
    name: String,
    phone: String,
    email: String
  },

  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  schedule: [eventSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Group', groupSchema);