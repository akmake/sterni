import webpush from 'web-push';
import { ApiError, sendData } from './access.js';
import { CompanyMember, CompanyPushSubscription } from './models.js';
import { isOnline } from './realtime.js';

const GONE_STATUSES = [404, 410];
const publicKey = () => process.env.COMPANY_VAPID_PUBLIC_KEY;
const privateKey = () => process.env.COMPANY_VAPID_PRIVATE_KEY;
const isConfigured = () => Boolean(publicKey() && privateKey());

let configuredWith = null;
const ensureVapid = () => {
  if (configuredWith === publicKey()) return;
  webpush.setVapidDetails(process.env.COMPANY_VAPID_SUBJECT || 'mailto:admin@dahanswebsite.com', publicKey(), privateKey());
  configuredWith = publicKey();
};

export const getPushConfig = async (req, res) => {
  sendData(req, res, { enabled: isConfigured(), public_key: publicKey() ?? null });
};

export const subscribe = async (req, res) => {
  const { endpoint, keys } = req.body;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'מנוי לא תקין');
  }
  await CompanyPushSubscription.findOneAndUpdate(
    { endpoint },
    { $set: { userId: req.user._id, keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) } } },
    { upsert: true }
  );
  sendData(req, res, { subscribed: true }, 201);
};

export const unsubscribe = async (req, res) => {
  await CompanyPushSubscription.deleteOne({ endpoint: req.body.endpoint, userId: req.user._id });
  sendData(req, res, { subscribed: false });
};

// Best effort and never awaited by the request: a push failure must not fail the action.
export const pushToUsers = (organizationId, userIds, payload, { skipOnline = true } = {}) => {
  if (!isConfigured() || userIds.length === 0) return;
  const deliver = async () => {
    ensureVapid();
    const available = await CompanyMember.find({
      organizationId,
      userId: { $in: userIds },
      status: 'active',
      availability: { $ne: 'dnd' },
    }).distinct('userId');
    const targets = available.filter((id) => !skipOnline || !isOnline(id));
    const subscriptions = await CompanyPushSubscription.find({ userId: { $in: targets } });

    await Promise.all(
      subscriptions.map((subscription) =>
        webpush
          .sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, JSON.stringify(payload))
          .catch((error) => {
            if (GONE_STATUSES.includes(error.statusCode)) return subscription.deleteOne();
            console.error('[companyos] push', error.statusCode ?? error.message);
            return null;
          })
      )
    );
  };
  deliver().catch((error) => console.error('[companyos] push', error));
};
