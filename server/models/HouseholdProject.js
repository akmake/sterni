import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  amount: { type: Number, default: 0 },
  done: { type: Boolean, default: false },
});

const fundSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  destination: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const householdProjectSchema = new mongoose.Schema({
  family: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    required: true,
    index: true,
  },
  projectName: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  projectType: {
    type: String,
    enum: ['goal', 'task'],
    required: true,
  },
  targetAmount: {
    type: Number,
    default: 0,
  },
  currentAmount: {
    type: Number,
    default: 0,
  },
  tasks: [taskSchema],
  funds: [fundSchema],
  dueDate: {
    type: Date,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

// Auto-calculate currentAmount + targetAmount before saving
householdProjectSchema.pre('save', function (next) {
  if (this.projectType === 'goal') {
    this.currentAmount = this.funds.reduce((sum, f) => sum + f.amount, 0);
  } else if (this.projectType === 'task') {
    this.targetAmount = this.tasks.reduce((sum, t) => sum + t.amount, 0);
    this.currentAmount = this.tasks
      .filter((t) => t.done)
      .reduce((sum, t) => sum + t.amount, 0);
  }
  next();
});

export default mongoose.model('HouseholdProject', householdProjectSchema);
