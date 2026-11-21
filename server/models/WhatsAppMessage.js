import mongoose from 'mongoose';

/**
 * WhatsAppMessage — הודעה בודדת בשיחה הממושכפת לפאנל המעקב.
 * נשמר משני הצדדים (fromMe + נכנס). מדיה נשמרת בדיסק מחוץ ל-/uploads
 * ומוגשת רק דרך route מאובטח (admin).
 *
 * Coupled: server/services/whatsappMonitorService.js (כותב),
 *          server/routes/whatsappMonitorRoutes.js (קורא),
 *          server/models/WhatsAppChat.js (סיכום שיחה)
 */
const whatsAppMessageSchema = new mongoose.Schema(
    {
        // מזהה הודעה ייחודי של WhatsApp (key.id) — מונע כפילויות
        messageId: { type: String, required: true, unique: true, index: true },

        // jid של השיחה (איש הקשר) — זהה לשני הכיוונים, למשל '9725XXXXXXXX@s.whatsapp.net'
        chatJid: { type: String, required: true, index: true },

        // מספר טלפון בלבד (ספרות) — לתצוגה והתאמה
        phone: { type: String, default: '' },

        // true = הודעה שאתה שלחת, false = נכנסת מאיש הקשר
        fromMe: { type: Boolean, default: false },

        // שם השולח (pushName) — רלוונטי להודעות נכנסות
        senderName: { type: String, default: '' },

        // סוג ההודעה
        type: {
            type: String,
            enum: ['text', 'image', 'video', 'audio', 'document', 'sticker', 'other'],
            default: 'text',
        },

        // תוכן טקסטואלי / caption
        text: { type: String, default: '' },

        // ── מדיה ──
        // נתיב יחסי בדיסק (תיקיית storage/wa-monitor), null אם אין/לא הורד
        mediaPath: { type: String, default: null },
        mediaMime: { type: String, default: '' },
        fileName: { type: String, default: '' },
        durationSeconds: { type: Number, default: 0 },
        // true כשיש מדיה אבל הקובץ לא זמין (היסטוריה ישנה / מפתח פג)
        mediaUnavailable: { type: Boolean, default: false },

        // טקסט ההודעה שצוטטה (אם זו תגובה לציטוט)
        quotedText: { type: String, default: null },

        // חותמת הזמן של ההודעה עצמה (מ-WhatsApp)
        timestamp: { type: Date, required: true, index: true },
    },
    { timestamps: true }
);

// שליפת שיחה ממוינת לפי זמן — האינדקס הראשי של הפאנל
whatsAppMessageSchema.index({ chatJid: 1, timestamp: -1 });

export default mongoose.model('WhatsAppMessage', whatsAppMessageSchema);
