import mongoose from 'mongoose';

/**
 * AppSecret — סודות שהשרת מייצר לבד ושומר ב-DB (במקום .env), למשל מפתחות VAPID ל-Web Push
 * כשלא הוגדרו במשתני הסביבה. key ייחודי.
 *
 * Coupled: server/services/assignmentNotifier.js (key: 'vapid')
 */
const appSecretSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true },
        value: { type: mongoose.Schema.Types.Mixed, required: true },
    },
    { timestamps: true }
);

export default mongoose.models.AppSecret || mongoose.model('AppSecret', appSecretSchema);
