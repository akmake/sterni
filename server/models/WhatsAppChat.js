import mongoose from 'mongoose';

/**
 * WhatsAppChat — סיכום שיחה אחת (איש קשר) עבור רשימת הצ'אטים בפאנל.
 * מתעדכן (upsert) בכל הודעה חדשה כדי שרשימת הצ'אטים תהיה מהירה
 * בלי aggregation על כל ההודעות.
 *
 * Coupled: server/services/whatsappMonitorService.js (כותב),
 *          server/routes/whatsappMonitorRoutes.js (קורא)
 */
const whatsAppChatSchema = new mongoose.Schema(
    {
        // jid של איש הקשר — מפתח ייחודי
        jid: { type: String, required: true, unique: true, index: true },

        // מספר טלפון (ספרות בלבד)
        phone: { type: String, default: '' },

        // שם לתצוגה (pushName של איש הקשר)
        name: { type: String, default: '' },

        // תצוגה מקדימה של ההודעה האחרונה
        lastMessageText: { type: String, default: '' },
        lastMessageAt: { type: Date, default: null, index: true },
        lastFromMe: { type: Boolean, default: false },

        // ספירת הודעות כוללת (אינדיקציה בלבד)
        messageCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default mongoose.model('WhatsAppChat', whatsAppChatSchema);
