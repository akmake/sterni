import mongoose from 'mongoose';

const householdTaskSchema = new mongoose.Schema({
  family: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Family', 
    required: true, 
    index: true 
  },
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String, 
    default: '' 
  },
  category: { 
    type: String, 
    default: 'כללי'
  },
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  isCompleted: { 
    type: Boolean, 
    default: false 
  },
  completedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  completedAt: { 
    type: Date 
  },
  dueDate: { 
    type: Date 
  },
  recurring: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' }
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('HouseholdTask', householdTaskSchema);
