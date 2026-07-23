import GameUser from '../models/GameUser.js';

let messagingPromise;

async function getMessaging() {
  if (messagingPromise) return messagingPromise;
  messagingPromise = (async () => {
    const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!rawCredentials) return null;
    try {
      const adminModule = await import('firebase-admin');
      const admin = adminModule.default;
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(rawCredentials)),
        });
      }
      return admin.messaging();
    } catch (error) {
      console.error('[GAME PUSH] Firebase initialization failed:', error.message);
      return null;
    }
  })();
  return messagingPromise;
}

export async function sendGameInvitePush(userId, inviterName, inviteId) {
  const messaging = await getMessaging();
  if (!messaging) return;
  const user = await GameUser.findById(userId).select('pushTokens').lean();
  const tokens = (user?.pushTokens || []).map((entry) => entry.token);
  if (!tokens.length) return;

  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: 'הזמנה למשחק',
      body: `${inviterName} רוצה לשחק איתך`,
    },
    data: { type: 'game_invite', inviteId: String(inviteId) },
    android: {
      priority: 'high',
      notification: { channelId: 'game_invites', sound: 'default' },
    },
  });

  const invalidTokens = [];
  result.responses.forEach((response, index) => {
    if (
      !response.success &&
      response.error?.code === 'messaging/registration-token-not-registered'
    ) {
      invalidTokens.push(tokens[index]);
    }
  });
  if (invalidTokens.length) {
    await GameUser.updateOne(
      { _id: userId },
      { $pull: { pushTokens: { token: { $in: invalidTokens } } } },
    );
  }
}

