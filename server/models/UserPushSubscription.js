import mongoose from 'mongoose';

/**
 * UserPushSubscription — מנוי Web Push של משתמש באפליקציה הראשית (מכשיר/דפדפן אחד).
 * נפרד מ-CompanyPushSubscription (Company OS). משמש להתראות על מטלות/פרויקטים שמישהו אחר יצר עבורך.
 *
 * Coupled: server/services/assignmentNotifier.js (שולח + מוחק מנויים שפגו),
 *          server/routes/pushRoutes.js (subscribe/unsubscribe),
 *          client/src/utils/push.js, client/public/company-push.js (ה-SW שמציג את ההתראה)
 */
const userPushSubscriptionSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        endpoint: { type: String, required: true, unique: true },
        keys: {
            p256dh: { type: String, required: true },
            auth: { type: String, required: true },
        },
        userAgent: { type: String, default: '' },
    },
    { timestamps: true }
);

export default mongoose.models.UserPushSubscription ||
    mongoose.model('UserPushSubscription', userPushSubscriptionSchema);
