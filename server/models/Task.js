import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date }, // נשמור מתי בוצע כדי למחוק אחרי 30 יום
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Task', taskSchema);