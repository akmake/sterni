# Communication Module

> Last updated: 2026-03-12

## Components

### Chat (Socket.IO)
- Page: `client/src/pages/ChatPage.jsx` — route `/chat/:ticketId`
- Service: `client/src/services/chatService.js`
- Server routes: `server/routes/chatRoutes.js` (PUBLIC — no auth)
- Model: `server/models/Message.js`
- Real-time via Socket.IO

### WhatsApp
- Page: `client/src/pages/WhatsAppPage.jsx`
- Server service: `server/services/whatsappService.js` (Baileys)
- Credentials stored in: `server/auth_info_baileys/`, `server/credentials/`
- Starts automatically on boot via `connectToWhatsApp()`
- Note: WhatsApp session is persistent — credentials must exist in production

### WhatsApp Monitor (mirror panel) — "וואצפ ווב" פנימי
- Page: `client/src/pages/WhatsAppMonitorPage.jsx` — route `/admin/whatsapp-monitor` (**admin only**)
- Server service: `server/services/whatsappMonitorService.js` — **חיבור Baileys שני ונפרד** מ-`whatsappService.js`
- Server routes: `server/routes/whatsappMonitorRoutes.js` (prefix `/api/whatsapp-monitor`, admin only)
- Models: `server/models/WhatsAppMessage.js`, `server/models/WhatsAppChat.js`
- Auth session: `server/auth_info_monitor/` (נפרד מ-`auth_info_baileys/`) — gitignored
- Media: `server/storage/wa-monitor/` — מחוץ ל-`/uploads` הפומבי, מוגש רק דרך `GET /api/whatsapp-monitor/media/:messageId` (admin) — gitignored
- מה עושה: ממשכפל את ההתכתבויות של **חשבון הוואצפ שלך** (שני הכיוונים: `emitOwnEvents: true`) + מושך היסטוריה (`syncFullHistory: true`), שומר ב-DB, ומציג פאנל בסגנון וואצפ ווב עם תמונות/וידאו/הקלטות ועדכון חי.
- אתחול: עולה ב-boot ב-`app.js` (אחרי `connectToWhatsApp()`), ניתן לכבות עם `WA_MONITOR_ENABLED=false`
- מדיה: מורדת ונשמרת **רק להודעות חיות** (`type === 'notify'`); היסטוריה ישנה נשמרת כמטא-דאטה בלבד (`mediaUnavailable: true`) כי מפתחות המדיה פגים.
- מגבלה טכנית: רואים רק שיחות שאתה צד בהן (חשבון שלך). שיחות אישיות בלבד (`@s.whatsapp.net`) — קבוצות/סטטוס מסוננות.
- Socket events: `wa-monitor:message`, `wa-monitor:status` → נשלחים ל-room `admins`

### Email
- Page: `client/src/pages/EmailsPage.jsx`
- Server routes: `server/routes/emailRoutes.js`
- Server service: `server/services/emailService.js`
- Background listener: `server/services/emailListener.js` (starts on boot)
- Models: `server/models/Email.js`, `server/models/EmailAccount.js`

## Notes
- Chat routes are public (no requireAuth, no CSRF) — before the auth middleware in `app.js`
- WhatsApp and email services start automatically — check `server/app.js` bottom
- WhatsApp re-connection: if session expires, credentials in `auth_info_baileys/` must be refreshed
