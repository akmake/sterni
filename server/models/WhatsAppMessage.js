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
const reactionSchema = new mongoose.Schema(
    {
        emoji: { type: String, default: '' },
        fromMe: { type: Boolean, default: false },
        at: { type: Date, default: Date.now },
    },
    { _id: false }
);

const whatsAppMessageSchema = new mongoose.Schema(
    {
        // מזהה הודעה ייחודי של WhatsApp (key.id) — מונע כפילויות
        messageId: { type: String, required: true, unique: true, index: true },

        // jid קנוני של השיחה — טלפוני כשידוע ('9725XXXXXXXX@s.whatsapp.net'), אחרת '...@lid'
        chatJid: { type: String, required: true, index: true },

        // מספר טלפון בלבד (ספרות) — ריק אם השיחה ידועה רק כ-LID
        phone: { type: String, default: '' },

        // true = הודעה שאתה שלחת, false = נכנסת מאיש הקשר
        fromMe: { type: Boolean, default: false },

        // שם השולח (pushName) — רלוונטי להודעות נכנסות
        senderName: { type: String, default: '' },

        // סוג ההודעה
        type: {
            type: String,
            enum: ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact', 'poll', 'other'],
            default: 'text',
        },

        // תוכן טקסטואלי / caption
        text: { type: String, default: '' },

        // ── מדיה ──
        // שם קובץ בדיסק (תיקיית storage/wa-monitor), null אם אין/לא הורד
        mediaPath: { type: String, default: null },
        mediaMime: { type: String, default: '' },
        fileName: { type: String, default: '' },
        fileSize: { type: Number, default: 0 },
        durationSeconds: { type: Number, default: 0 },
        // הקלטה קולית (ptt) לעומת קובץ שמע רגיל
        isVoiceNote: { type: Boolean, default: false },
        // true כשיש מדיה אבל הקובץ לא בדיסק — אפשר לנסות להוריד דרך POST /media/:id/fetch
        mediaUnavailable: { type: Boolean, default: false },
        // ההודעה הגולמית (BufferJSON) — נדרשת להורדת מדיה בדיעבד. לא נשלפת כברירת מחדל.
        raw: { type: String, default: null, select: false },

        // ── סוגים מיוחדים ──
        location: {
            lat: Number,
            lng: Number,
            name: String,
            address: String,
        },
        contactCard: {
            name: String,
            phone: String,
        },
        poll: {
            name: String,
            options: [String],
        },

        // טקסט ההודעה שצוטטה (אם זו תגובה לציטוט)
        quotedText: { type: String, default: null },

        // ── שינויים אחרי השליחה ──
        deleted: { type: Boolean, default: false },   // נמחקה "לכולם" — התוכן המקורי נשמר
        deletedAt: { type: Date, default: null },
        edited: { type: Boolean, default: false },
        editedAt: { type: Date, default: null },
        originalText: { type: String, default: null }, // הטקסט לפני העריכה הראשונה
        reactions: { type: [reactionSchema], default: [] },

        // חותמת הזמן של ההודעה עצמה (מ-WhatsApp)
        timestamp: { type: Date, required: true, index: true },
    },
    { timestamps: true }
);

// שליפת שיחה ממוינת לפי זמן — האינדקס הראשי של הפאנל
whatsAppMessageSchema.index({ chatJid: 1, timestamp: -1 });

export default mongoose.model('WhatsAppMessage', whatsAppMessageSchema);
