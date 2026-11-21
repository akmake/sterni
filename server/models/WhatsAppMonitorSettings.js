import mongoose from 'mongoose';

/**
 * WhatsAppMonitorSettings — הגדרות פאנל המעקב (מסמך יחיד, key='singleton').
 *
 * mode:
 *   'all'      — שומרים ומציגים את כל השיחות האישיות
 *   'selected' — שומרים ומציגים רק שיחות של אנשי הקשר ב-tracked (שאר ההודעות לא נשמרות בכלל)
 *
 * tracked: רשימת אנשי קשר למעקב. התאמה לפי jid / lid / phone (מספיק אחד מהם).
 *
 * Coupled: server/services/whatsappMonitorService.js (קורא + cache),
 *          server/routes/whatsappMonitorRoutes.js (GET/PUT /settings),
 *          client/src/pages/WhatsAppMonitorPage.jsx (חלון הגדרות)
 */
const trackedSchema = new mongoose.Schema(
    {
        jid: { type: String, default: '' },   // '9725XXXXXXXX@s.whatsapp.net' או 'XXXX@lid'
        phone: { type: String, default: '' }, // ספרות בלבד בפורמט בינלאומי (972...)
        name: { type: String, default: '' },  // לתצוגה בלבד
    },
    { _id: false }
);

const whatsAppMonitorSettingsSchema = new mongoose.Schema(
    {
        key: { type: String, default: 'singleton', unique: true },
        mode: { type: String, enum: ['all', 'selected'], default: 'all' },
        tracked: { type: [trackedSchema], default: [] },
    },
    { timestamps: true }
);

export default mongoose.model('WhatsAppMonitorSettings', whatsAppMonitorSettingsSchema);
