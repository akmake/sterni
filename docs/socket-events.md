# Socket.IO Events

> Last updated: 2026-03-12
> Setup: `server/services/socketService.js`
> IO instance: `app.set('io', io)` → accessed via `req.app.get('io').emit(...)`

## Server → Client Events

| Event | Payload | Triggered by |
|-------|---------|-------------|
| *(document as you add events)* | | |

## Client → Server Events

| Event | Payload | Handled in |
|-------|---------|-----------|
| *(document as you add events)* | | |

---

## CORS
Socket.IO CORS matches `CLIENT_URL` env var (or `http://localhost:5173`).

## Adding new events
1. Add server handler in `server/services/socketService.js`
2. Add client listener in relevant page/component
3. Update this file with the event name, payload shape, and trigger
