import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date }, // נשמור מתי בוצע כדי למחוק אחרי 30 יום
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // מי יצר את המטלה, כשזה לא בעל המטלה (למשל צופה וואצפ שיוצר עבור userId). null = הבעלים עצמו
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // ── הקצאה ע"י אחר (createdBy) — "חפירה" עד שהבעלים ראה (assignmentNotifier.js) ──
  seenAt: { type: Date, default: null },          // הבעלים ראה את המטלה בעמוד המטלות
  reminderCount: { type: Number, default: 0 },
  nextReminderAt: { type: Date, default: null, index: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Task', taskSchema);