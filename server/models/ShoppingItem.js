import mongoose from 'mongoose';

const shoppingItemSchema = new mongoose.Schema({
  family: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Family', 
    required: true, 
    index: true 
  },
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  quantity: { 
    type: String, 
    default: '' 
  },
  category: { 
    type: String, 
    default: 'כללי'
  },
  isBought: { 
    type: Boolean, 
    default: false 
  },
  boughtBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  boughtAt: { 
    type: Date 
  },
  addedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  notes: { 
    type: String, 
    default: '' 
  },
  createdAt: { type: Date, default: Date.now }
});

// Auto-delete bought items after 7 days
shoppingItemSchema.index({ boughtAt: 1 }, { 
  expireAfterSeconds: 7 * 24 * 60 * 60,
  partialFilterExpression: { isBought: true }
});

export default mongoose.model('ShoppingItem', shoppingItemSchema);
