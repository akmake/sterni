import mongoose from 'mongoose';

const softwareItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['browser', 'security', 'office', 'media', 'development', 'utilities', 'communication', 'other'],
    default: 'other',
  },
  description: { type: String, default: '' },
  version:     { type: String, default: '' },
  username:    { type: String, default: '' },
  password:    { type: String, default: '' },
  downloadUrl: { type: String, default: '' },
  notes:       { type: String, default: '' },
  isPaid:      { type: Boolean, default: false },
  sortOrder:   { type: Number, default: 0 },

  // File stored on disk (outside project root)
  fileName:         { type: String, default: '' }, // generated filename on disk
  fileOriginalName: { type: String, default: '' }, // original uploaded name
  fileSize:         { type: Number, default: 0 },  // bytes
  uploadedAt:       { type: Date },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

softwareItemSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('SoftwareItem', softwareItemSchema);
