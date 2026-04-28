import mongoose from 'mongoose';

const quoteTemplateItemSchema = new mongoose.Schema({
  templateId: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  quoteTitle: { type: String, default: '' },
  eventType: { type: String, default: '' },
  minPaxPrefix: { type: String, default: '' },
  minPaxSuffix: { type: String, default: '' },
  blocks: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { _id: false });

const systemConfigSchema = new mongoose.Schema({
  // 1. הגדרות כספים (השולח)
  financeEmailId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailAccount' },

  // 2. הגדרות תפעול/וואצאפ (השולח)
  opsEmailId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailAccount' },

  // 3. המייל שאליו יגיעו הודעות הוואצאפ
  targetWhatsAppEmail: { type: String, default: '' },

  // 4. ★ חדש: האם לשמור לוגים של מבקרים
  loggingEnabled: { type: Boolean, default: false },

  // 5. Default template for PDF quote generator
  quoteTemplate: {
    quoteTitle: { type: String, default: '' },
    eventType: { type: String, default: '' },
    minPaxPrefix: { type: String, default: '' },
    minPaxSuffix: { type: String, default: '' },
    blocks: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  quoteTemplates: { type: [quoteTemplateItemSchema], default: [] },
  activeQuoteTemplateId: { type: String, default: '' },

}, { timestamps: true });

export default mongoose.model('SystemConfig', systemConfigSchema);
