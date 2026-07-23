import mongoose from 'mongoose';

const moveSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'GameUser', required: true },
    move: { type: String, enum: ['rock', 'paper', 'scissors'], required: true },
  },
  { _id: false },
);

const roundSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    moves: [moveSchema],
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameUser' },
    reason: { type: String, enum: ['normal', 'timeout', 'disconnect', 'forfeit'] },
    startedAt: Date,
    finishedAt: Date,
  },
  { _id: false },
);

const playerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'GameUser', required: true },
    move: { type: String, enum: ['rock', 'paper', 'scissors'], default: null },
    lockedAt: { type: Date, default: null },
    rematchReady: { type: Boolean, default: false },
  },
  { _id: false },
);

const gameMatchSchema = new mongoose.Schema(
  {
    players: {
      type: [playerSchema],
      validate: {
        validator: (players) => players.length === 2,
        message: 'A match must have exactly two players',
      },
    },
    phase: {
      type: String,
      enum: ['countdown', 'revealing', 'finished', 'cancelled'],
      required: true,
      index: true,
    },
    round: { type: Number, default: 1 },
    deadline: Date,
    revealAt: Date,
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameUser', default: null },
    finishReason: {
      type: String,
      enum: ['normal', 'timeout', 'disconnect', 'forfeit'],
      default: null,
    },
    processedActionIds: { type: [String], default: [] },
    history: { type: [roundSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

gameMatchSchema.index({ 'players.user': 1, phase: 1, updatedAt: -1 });

export default mongoose.models.GameMatch ||
  mongoose.model('GameMatch', gameMatchSchema);

