import mongoose from 'mongoose';

// סכמה לאירוע בודד
const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  hall: { type: mongoose.Schema.Types.ObjectId, ref: 'Hall', required: true },
  pax: { type: Number, default: 0 }, // <-- הוספנו: כמות אנשים באירוע הספציפי
  requirements: { type: String }
});

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  
  // <-- הוספנו: כמות אנשים כללית לקבוצה
  pax: { type: Number, required: true, default: 0 },

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