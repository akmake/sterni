import mongoose from 'mongoose';

const merchantMapSchema = new mongoose.Schema({
  // גלובלי - ללא שדה משתמש/משפחה
  originalName: {
    type: String,
    required: true,
    trim: true,
    unique: true, // השם המקורי חייב להיות ייחודי בכל המערכת
  },
  newName: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinanceCategory',
    required: false,
  },
  categoryName: {
    type: String,
    trim: true,
    required: false,
  },
}, {
  timestamps: true,
});

export default mongoose.model('MerchantMap', merchantMapSchema);
