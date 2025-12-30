import mongoose from 'mongoose';

// סכמה למשימה (בלי כסף)
const taskSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false },
});

// סכמה לקובץ מצורף
const fileSchema = new mongoose.Schema({
  name: { type: String, required: true }, // שם הקובץ המקורי
  url: { type: String, required: true },  // נתיב או URL לקובץ
  type: { type: String },                 // סוג הקובץ (image/pdf etc)
  uploadedAt: { type: Date, default: Date.now }
});

const projectSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectName: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  
  // אין יותר projectType, הכל משימות
  
  tasks: [taskSchema],
  files: [fileSchema], // המקום החדש לקבצים

  dueDate: { type: Date },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// וירטואל לחישוב אחוז התקדמות
projectSchema.virtual('progress').get(function() {
  if (!this.tasks || this.tasks.length === 0) return 0;
  const completed = this.tasks.filter(t => t.done).length;
  return Math.round((completed / this.tasks.length) * 100);
});

export default mongoose.model('Project', projectSchema);