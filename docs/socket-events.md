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
