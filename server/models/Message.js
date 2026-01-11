import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  ticketId: { 
    type: String, 
    required: true, 
    index: true 
  },
  sender: { 
    type: String, 
    enum: ['me', 'client'], 
    required: true 
  },
  clientEmail: { 
    type: String, 
    required: true 
  },
  content: { 
    type: String, 
    default: '' 
  },
  type: { 
    type: String, 
    enum: ['text', 'image', 'video', 'file'], 
    default: 'text' 
  },
  fileUrl: { 
    type: String 
  },
  isRead: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

export const Message = mongoose.model('Message', MessageSchema);