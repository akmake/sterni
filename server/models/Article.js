import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    originalFilename: {
      type: String,
      default: '',
    },
    rawText: {
      type: String,
      required: true,
    },
    pageCount: {
      type: Number,
      default: 0,
    },
    userId: {
      type: String,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Article', articleSchema);
