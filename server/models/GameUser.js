import mongoose from 'mongoose';

const gameUserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9_]{3,20}$/,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    pushTokens: [
      {
        token: { type: String, required: true },
        platform: { type: String, enum: ['android'], default: 'android' },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    stats: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, versionKey: false },
);

gameUserSchema.index({ displayName: 'text', username: 'text' });

export default mongoose.models.GameUser ||
  mongoose.model('GameUser', gameUserSchema);
