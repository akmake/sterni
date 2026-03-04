import mongoose from 'mongoose';
import crypto from 'crypto';

const familySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  code: { 
    type: String, 
    unique: true, 
    required: true,
    index: true
  },
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['owner', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  shoppingCategories: [{
    name: { type: String, required: true, trim: true },
    color: { type: String, default: 'bg-gray-50 text-gray-600' }
  }],
  taskCategories: [{
    name: { type: String, required: true, trim: true },
    color: { type: String, default: 'bg-gray-50 text-gray-600' }
  }],
  expenseCategories: [{
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#9ca3af' }
  }],
  createdAt: { type: Date, default: Date.now }
});

// Generate a unique 6-char family code before saving
familySchema.statics.generateUniqueCode = async function() {
  let code;
  let exists = true;
  while (exists) {
    code = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
    exists = await this.findOne({ code });
  }
  return code;
};

export default mongoose.model('Family', familySchema);
