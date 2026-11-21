# Socket.IO Events

> Last updated: 2026-03-12
> Setup: `server/services/socketService.js`
> IO instance: `app.set('io', io)` → accessed via `req.app.get('io').emit(...)`

## Rooms
- `family:<familyId>` — auto-joined on connect (household real-time)
- `admins` — auto-joined on connect when `user.role === 'admin'` (visitor-intelligence alerts)

## Server → Client Events

| Event | Payload | Triggered by |
|-------|---------|-------------|
| `visitor:alert` | `{ ip, page, country, city, isp, reason: 'vpn'\|'datacenter'\|'bot', timestamp }` | `loggingMiddleware.js` when a suspicious visitor is logged (throttled ≤1/IP per 10 min). Emitted to the `admins` room. Listened in `AdminLogsPage.jsx` → toast. |
| `wa-monitor:message` | WhatsAppMessage fields (no `raw`): `{ messageId, chatJid, phone, fromMe, senderName, type, text, quotedText, mediaMime, fileName, fileSize, durationSeconds, isVoiceNote, mediaUnavailable, location?, contactCard?, poll?, timestamp }` | `whatsappMonitorService.js` on each **new live** incoming/outgoing message (before media download). Emitted to the `admins` room. Listened in `WhatsAppMonitorPage.jsx`. |
| `wa-monitor:update` | `{ messageId, chatJid, patch }` — patch of `mediaPath/mediaUnavailable`, `deleted/deletedAt`, `text/edited/editedAt/originalText`, or `reactions` | `whatsappMonitorService.js` after media download, delete-for-everyone, edit, reaction. `admins` room. Listened in `WhatsAppMonitorPage.jsx`. (`WaViewerPage` polls `changedSince` instead.) |
| `tasks:changed` | `{ taskId, action }` | `assignmentNotifier.js` when someone creates a task for you. Room `user:<ownerId>`. Listened in `TasksPage.jsx` → silent refetch. |
| `projects:changed` | `{ projectId, action }` | `assignmentNotifier.js` when someone creates a project for you. Room `user:<ownerId>`. Listened in `ProjectsPage.jsx` → refetch. |
| `assignments:changed` | `{ kind: 'task'\|'project' }` | To the **creator** (`user:<createdBy>`) on create / owner seen / task toggled / deleted (`taskController.js`, `projectController.js` seen). Listened in `WaViewerPage.jsx` → reload `/wa-view/assignments`. |
| `wa-view:changed` | `{ at }` | `whatsappMonitorService.js` (`emitToAdmins`) on any new live message / patch. Rooms `wa-viewers` + `admins`. Listened in `WaViewerPage.jsx` → pull `changedSince`. Carries no content. |
| `wa-monitor:status` | `{ state: 'connected'\|'connecting'\|'disconnected', user?, hasQr? }` | `whatsappMonitorService.js` on connection changes. Emitted to the `admins` room. Listened in `WhatsAppMonitorPage.jsx`. |

## Client → Server Events

| Event | Payload | Handled in |
|-------|---------|-----------|
| `family:join` | — | `socketService.js` — (re)join the caller's family room |

---

## CORS
Socket.IO CORS matches `CLIENT_URL` env var (or `http://localhost:5173`).

## Adding new events
1. Add server handler in `server/services/socketService.js`
2. Add client listener in relevant page/component
3. Update this file with the event name, payload shape, and trigger
