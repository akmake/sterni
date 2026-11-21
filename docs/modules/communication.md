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
- Models: `server/models/WhatsAppMessage.js`, `server/models/WhatsAppChat.js`, `server/models/WhatsAppMonitorSettings.js`
- Viewer: `client/src/pages/WaViewerPage.jsx` — `/wa-view` (מחוץ ל-Layout), צפייה בלבד בשיחה עם איש הקשר שבמעקב; API `server/routes/waViewRoutes.js` (`/api/wa-view`). גישה: role `wa-viewer` (חסום מכל שאר המערכת) או admin. רכיב בועה משותף: `client/src/components/whatsapp/WaMessageBubble.jsx`
- תפריט צד (admin): "מעקב וואצפ" + "צ'אט במעקב" כקישורים ישירים בשתי התצוגות (`waMonitorNav` ב-`Navbar.jsx`)
- Auth session: `server/auth_info_monitor/` (נפרד מ-`auth_info_baileys/`) — gitignored
- Media: `server/storage/wa-monitor/` — מחוץ ל-`/uploads` הפומבי, מוגש רק דרך `GET /api/whatsapp-monitor/media/:messageId` (admin) — gitignored
- מה עושה: ממשכפל את ההתכתבויות של **חשבון הוואצפ שלך** (שני הכיוונים: `emitOwnEvents: true`) + מושך היסטוריה (`syncFullHistory: true`), שומר ב-DB, ומציג פאנל בסגנון וואצפ ווב עם תמונות/וידאו/הקלטות ועדכון חי.
- אתחול: עולה ב-boot ב-`app.js` (אחרי `connectToWhatsApp()`), ניתן לכבות עם `WA_MONITOR_ENABLED=false`
- **LID:** מאז Baileys v7 / וואצפ 2025 הרבה שיחות אישיות מגיעות כ-`...@lid` ולא כ-`@s.whatsapp.net`. השירות ממפה LID→טלפון (`key.remoteJidAlt` / `signalRepository.lidMapping`) ושומר תחת ה-jid הטלפוני; שיחה שנשמרה כ-LID ממוזגת אוטומטית כשהמיפוי מתגלה (`mergeLidChat`). (עד התיקון ב-2026-11 כל הודעות ה-LID נזרקו — זה היה הבאג "לא מציג הודעות".)
- תוכן: `normalizeMessageContent` פותח ephemeral / view-once / document-with-caption / edited. נתמכים טקסט, תמונה, וידאו (כולל ptv), שמע (הקלטה `isVoiceNote` / קובץ), מסמך, מדבקה, מיקום, איש קשר, סקר. עריכה (`protocolMessage` 14) שומרת `originalText`; מחיקה לכולם (0) מסמנת `deleted` ושומרת את התוכן; ריאקציות נשמרות על ההודעה.
- מדיה: מורדת אוטומטית בהודעות חיות (`messages.upsert` — notify + append, עד 100MB) עם `reuploadRequest: sock.updateMediaMessage`. להיסטוריה נשמר `raw` → הורדה לפי דרישה (`POST /media/:id/fetch` בפאנל, או אוטומטית בעמוד הצופה).
- הגדרות מעקב (`WhatsAppMonitorSettings`): איש הקשר במעקב (`tracked`) + `mode` — `all` שומר הכל, `selected` שומר רק את מי שבמעקב (במצב הזה ה-LID של המספר נשלף מראש ב-USync כדי לזהות הודעות `@lid`).
- מגבלה טכנית: רואים רק שיחות שאתה צד בהן (חשבון שלך). שיחות אישיות בלבד — קבוצות/סטטוס/ערוצים מסוננים.
- Socket events: `wa-monitor:message`, `wa-monitor:update`, `wa-monitor:status` → נשלחים ל-room `admins`

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
