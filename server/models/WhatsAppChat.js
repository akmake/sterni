import mongoose from 'mongoose';

/**
 * WhatsAppChat — סיכום שיחה אחת (איש קשר) עבור רשימת הצ'אטים בפאנל.
 * מתעדכן (upsert) בכל הודעה חדשה כדי שרשימת הצ'אטים תהיה מהירה
 * בלי aggregation על כל ההודעות.
 *
 * jid קנוני: מספר טלפון ('972...@s.whatsapp.net') כשידוע; אחרת ה-LID ('...@lid').
 * כשמתגלה מיפוי LID→טלפון, השיחה וההודעות ממוזגות ל-jid הטלפוני (mergeLidChat בשירות).
 *
 * Coupled: server/services/whatsappMonitorService.js (כותב),
 *          server/routes/whatsappMonitorRoutes.js (קורא)
 */
const whatsAppChatSchema = new mongoose.Schema(
    {
        // jid של איש הקשר — מפתח ייחודי
        jid: { type: String, required: true, unique: true, index: true },

        // LID (מזהה הפרטיות החדש של וואצפ) אם ידוע — לשיוך הודעות שמגיעות כ-@lid
        lid: { type: String, default: null, index: true },

        // מספר טלפון (ספרות בלבד) — ריק אם השיחה ידועה רק כ-LID
        phone: { type: String, default: '' },

        // שם לתצוגה (pushName של איש הקשר)
        name: { type: String, default: '' },

        // שם איש הקשר כפי ששמור בטלפון שלך (מסנכרון אנשי קשר)
        contactName: { type: String, default: '' },

        // תצוגה מקדימה של ההודעה האחרונה
        lastMessageText: { type: String, default: '' },
        lastMessageAt: { type: Date, default: null, index: true },
        lastFromMe: { type: Boolean, default: false },

        // ספירת הודעות כוללת (אינדיקציה בלבד)
        messageCount: { type: Number, default: 0 },

        // הודעות נכנסות חיות שלא נצפו בפאנל (מתאפס ב-POST /chats/:jid/read)
        unreadCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default mongoose.model('WhatsAppChat', whatsAppChatSchema);
