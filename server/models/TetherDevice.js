import mongoose from 'mongoose';

const tetherDeviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  deviceModel: {
    type: String,
    default: 'Unknown'
  },
  communityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true
  },
  isDeviceOwner: { type: Boolean, default: false },
  lastSeen:      { type: Date,    default: Date.now },
  active:        { type: Boolean, default: true }
}, {
  timestamps: true,
  versionKey: false
});

export default mongoose.models.TetherDevice || mongoose.model('TetherDevice', tetherDeviceSchema);
