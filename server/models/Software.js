import mongoose from 'mongoose';

const softwareSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    version: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      enum: ['כלים', 'אופיס', 'אנטי-וירוס', 'גיבוי', 'רשת', 'שרת', 'מולטימדיה', 'כלליות'],
      default: 'כלליות',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    filename: {
      type: String,
      required: true, // שם הקובץ בדיסק
    },
    originalFilename: {
      type: String,
      required: true, // שם המקורי שהמשתמש העלה
    },
    url: {
      type: String,
      required: true, // /uploads/software/filename
    },
    size: {
      type: Number,
      required: true, // bytes
    },
    mimetype: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    isPublic: {
      type: Boolean,
      default: true, // כולם יכולים לראות ולהוריד
    },
  },
  { timestamps: true }
);

export default mongoose.model('Software', softwareSchema);
