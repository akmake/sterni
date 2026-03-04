import mongoose from 'mongoose';

const householdExpenseSchema = new mongoose.Schema({
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
  amount: { 
    type: Number, 
    required: true 
  },
  category: { 
    type: String, 
    default: 'כללי'
  },
  paidBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  date: { 
    type: Date, 
    default: Date.now 
  },
  notes: { 
    type: String, 
    default: '' 
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('HouseholdExpense', householdExpenseSchema);
