import mongoose from 'mongoose';

// --- סכמה לאירוע בודד (Event) ---
const eventSchema = new mongoose.Schema({
  title: { type: String, required: true }, 
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  
  hall: { type: mongoose.Schema.Types.ObjectId, ref: 'Hall', required: false },
  
  eventType: { 
    type: String, 
    enum: ['meal', 'activity', 'general', 'regular'], 
    default: 'regular' 
  },
  
  // --- לוגיקה לארוחות ---
  isMeal: { type: Boolean, default: false },

  mealType: { 
    type: String, 
    // תיקון: הוספתי את 'light' לרשימה כדי לא לשבור אירועים ישנים
    enum: ['breakfast', 'lunch', 'dinner', 'light_meal', 'light_evening', 'night_treats', 'light'],
    required: false
  },
  
  kosherType: { type: String, required: false },
  menuItem: { type: String, required: false },
  notes: { type: String },

  // --- לוגיקה לאירוע כללי ---
  locationText: { type: String, required: false },

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