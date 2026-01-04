// server/models/Email.js
import mongoose from 'mongoose';

const emailSchema = new mongoose.Schema({
  fromName: String,
  fromAddress: String,
  subject: String,
  body: String,
  receivedAt: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['new', 'in_progress', 'done'],
    default: 'new' 
  }
});

export default mongoose.model('Email', emailSchema);