import mongoose from 'mongoose';
import crypto from 'crypto';

const userDataSchema = new mongoose.Schema(
  {
    /** 4-digit unique user code, auto-generated */
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    /** Reading positions, keyed by a scroll key (e.g. "scroll_mamaar_abc_idx") */
    readingPositions: {
      type: Map,
      of: Number,
      default: {},
    },
    /** User preferences (text size, scroll speed, etc.) */
    preferences: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    /** IDs of articles saved in the user's personal library */
    savedArticleIds: {
      type: [String],
      default: [],
    },
    /** Last sync timestamp (client sends this to get only newer changes) */
    lastSyncAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

/** Generate a unique 4-digit numeric code. */
userDataSchema.statics.generateUserId = async function () {
  for (let i = 0; i < 20; i++) {
    const code = crypto.randomInt(1000, 9999).toString();
    const exists = await this.findOne({ userId: code });
    if (!exists) return code;
  }
  throw new Error('Failed to generate unique userId');
};

export default mongoose.model('UserData', userDataSchema);
