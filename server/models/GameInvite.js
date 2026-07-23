import mongoose from 'mongoose';

const gameInviteSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameUser',
      required: true,
      index: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameUser',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
      default: 'pending',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    respondedAt: Date,
  },
  { timestamps: true, versionKey: false },
);

gameInviteSchema.index({ to: 1, status: 1, createdAt: -1 });

export default mongoose.models.GameInvite ||
  mongoose.model('GameInvite', gameInviteSchema);

