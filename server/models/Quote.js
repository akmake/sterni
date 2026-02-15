import mongoose from 'mongoose';

const quoteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'חובה לתת שם להצעת המחיר'],
    trim: true,
    unique: true
  },

  // --- CRM fields ---
  clientName: { type: String },
  contactPerson: {
    name: String,
    phone: String,
    email: String
  },
  dates: {
    from: Date,
    to: Date
  },
  pax: { type: Number, default: 0 },
  eventType: String,

  // Conversion status
  isConverted: { type: Boolean, default: false },
  convertedGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },

  // The structured content (blocks array for editor)
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // ★ NEW: Full rendered HTML body of the quote for future reference
  htmlBody: {
    type: String,
    default: ''
  },

  quoteNumber: {
    type: Number,
    unique: true,
    sparse: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

quoteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Quote = mongoose.model('Quote', quoteSchema);

// Safely drop old unique index if it exists
Quote.collection.dropIndex('quoteNumber_1').catch(() => {});

export default Quote;