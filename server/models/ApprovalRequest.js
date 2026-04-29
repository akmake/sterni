import mongoose from 'mongoose';

const approvalRequestSchema = new mongoose.Schema({
  deviceId:    { type: String, required: true },
  communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
  action:      { type: String, required: true },
  packageName: { type: String, default: null },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  resolvedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'TetherAdmin', default: null },
  resolvedAt: { type: Date, default: null },
  grantExpiresAt: { type: Number, default: null }
}, {
  timestamps: true,
  versionKey: false
});

export default mongoose.models.ApprovalRequest || mongoose.model('ApprovalRequest', approvalRequestSchema);
