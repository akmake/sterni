import mongoose from 'mongoose';

const mealSchema = new mongoose.Schema(
  {
    // שם הארוחה (ארוחת בוקר, ארוחת צהריים וכו')
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // סוגי כשרות זמינים לארוחה זו
    kosherOptions: {
      type: [String],
      enum: ['meat', 'halavi', 'parve', 'בשרי', 'חלבי', 'פרווה'],
      required: true,
    },

    // אפשרויות התפריט - מה בדיוק אפשר להגיש
    menuOptions: {
      type: [String],
      required: true,
      trim: true,
    },

    // סדר הצגה בinterface
    order: {
      type: Number,
      default: 0,
    },

    // האם פעיל או מושבת
    active: {
      type: Boolean,
      default: true,
    },

    // מי יצר את זה
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Meal', mealSchema);

