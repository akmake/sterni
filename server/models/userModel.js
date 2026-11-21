import mongoose from 'mongoose';

const MAX_FAILED = 5;       // נעילה אחרי 5 כשלונות
const LOCK_MS    = 10 * 60 * 1000; // 10 דקות

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'שם חובה'],
      trim: true,
    },

    email: {
      type: String,
      required: [true, 'אימייל חובה'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'פורמט אימייל לא תקין'],
    },
    passwordHash: {
      type: String,
      required: [true, 'סיסמה חובה'],
      minlength: 60,
    },
    role: {
      type: String,
      // 'wa-viewer' = צופה בלבד בעמוד /wa-view (חסום מכל שאר ה-API ב-authMiddleware)
      enum: ['user', 'admin', 'wa-viewer'],
      default: 'user',
    },
    tzitzitAccess: {
      type: Boolean,
      default: false,
    },
    householdAccess: {
      type: Boolean,
      default: false,
    },
    // אם מוגדר — המשתמש (בד"כ צופה וואצפ) יכול ליצור מטלות שיופיעו במטלות של המשתמש הזה.
    // נקבע ע"י אדמין ב-PATCH /api/admin/users/:id/task-target. null = אין הרשאה.
    taskTargetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // מפתח API קבוע לגישה אוטומטית ל-/api/wa-view (middlewares/apiKeyAuth.js). רק hash נשמר.
    apiKeyHash: { type: String, default: null, select: false, index: { sparse: true } },
    apiKeyCreatedAt: { type: Date, default: null },
    preferredView: {
      type: String,
      enum: ['management', 'household'],
      default: 'management',
    },
    twoFactorEnabled: { type: Boolean, default: false },
    totpSecret:        { type: String,  default: '' },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.methods.incrementLoginAttempts = function () {
  if (this.isLocked) return;
  const updates = { $inc: { failedLoginAttempts: 1 } };
  if (this.failedLoginAttempts + 1 >= MAX_FAILED) {
    updates.$set = { lockUntil: Date.now() + LOCK_MS };
  }
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function () {
  if (this.failedLoginAttempts || this.lockUntil) {
    return this.updateOne({ failedLoginAttempts: 0, lockUntil: null });
  }
};

export default mongoose.models.User || mongoose.model('User', userSchema);