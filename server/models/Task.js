import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date }, // נשמור מתי בוצע כדי למחוק אחרי 30 יום
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // מי יצר את המטלה, כשזה לא בעל המטלה (למשל צופה וואצפ שיוצר עבור userId). null = הבעלים עצמו
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Task', taskSchema);