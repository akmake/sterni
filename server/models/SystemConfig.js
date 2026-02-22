import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
  // 1. הגדרות כספים (השולח)
  financeEmailId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailAccount' },

  // 2. הגדרות תפעול/וואצאפ (השולח)
  opsEmailId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailAccount' },

  // 3. המייל שאליו יגיעו הודעות הוואצאפ
  targetWhatsAppEmail: { type: String, default: '' },

  // 4. ★ חדש: האם לשמור לוגים של מבקרים
  loggingEnabled: { type: Boolean, default: false },

}, { timestamps: true });

export default mongoose.model('SystemConfig', systemConfigSchema);