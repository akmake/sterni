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
