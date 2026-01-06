import mongoose from 'mongoose';

// --- סכמה לאירוע בודד (Event) ---
const eventSchema = new mongoose.Schema({
  title: { type: String, required: true }, 
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  
  // קישור לאולם (לא חובה - אם רוצים מיקום חופשי)
  hall: { type: mongoose.Schema.Types.ObjectId, ref: 'Hall', required: false },
  
  // שדה למיקום חופשי (טקסט) - בשימוש כאשר לא בוחרים אולם מסודר
  locationText: { type: String, required: false, default: '' },

  eventType: { 
    type: String, 
    enum: ['meal', 'activity', 'general', 'regular'], 
    default: 'regular' 
  },
  
  // --- לוגיקה לארוחות ---
  isMeal: { type: Boolean, default: false },

  mealType: { 
    type: String, 
    // התיקון הקריטי: הוספנו "" (מחרוזת ריקה) לסוף הרשימה כדי למנוע קריסה באירועים רגילים
    enum: ['breakfast', 'lunch', 'dinner', 'light_meal', 'light_evening', 'night_treats', 'light', ''],
    default: '', 
    required: false
  },
  
  kosherType: { type: String, required: false },
  menuItem: { type: String, required: false },
  notes: { type: String },

  pax: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  requirements: { type: String }
});

// --- סכמה לקבוצה (Group) ---
const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },

  pax: { type: Number, required: true, default: 0 },

  minPax: { type: Number, required: true, default: 0 },
  
  hostingType: { 
    type: String, 
    enum: ['seminar', 'overnight'], 
    required: true,
    default: 'seminar'
  },

  contactPerson: {
    name: String,
    phone: String,
    email: String
  },

  // תאריכים לא חובה (למנוע קריסה בקבוצות ישנות)
  startDate: { type: Date, required: false }, 
  endDate: { type: Date, required: false },

  schedule: [eventSchema],
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Group', groupSchema);