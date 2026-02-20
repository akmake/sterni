import mongoose from 'mongoose';

const paymentRequestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'חובה לתת שם לדרישת התשלום'],
    trim: true
  },

  // --- CRM fields ---
  clientName: { type: String },
  contactPerson: {
    name: String,
    phone: String,
    email: String
  },
  
  // Total amount to pay
  totalAmount: { type: Number, default: 0 },
  
  // Currency
  currency: { type: String, default: 'ILS' },
  
  // Description/Notes
  description: { type: String },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'cancelled'],
    default: 'draft'
  },
  
  // Payment details (bank transfer, etc)
  paymentDetails: { type: String },
  
  // Due date
  dueDate: { type: Date },

  // The structured content (blocks array for editor) - can be empty
  content: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Full rendered HTML body
  htmlBody: {
    type: String,
    default: ''
  },

  // Who created this
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Who it was sent to
  sentTo: [{
    userId: mongoose.Schema.Types.ObjectId,
    email: String,
    sentAt: Date
  }],

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

paymentRequestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('PaymentRequest', paymentRequestSchema);
