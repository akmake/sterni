# sterni — AI Working Rules

## ⚠️ MANDATORY: Documentation Update Protocol

**Every AI system (Claude, Copilot, Cursor, or any other) MUST follow these rules without exception:**

### Rule 1 — Update docs on every change
Before finishing ANY task that modifies code, you MUST update the relevant doc file(s) in `docs/`.
- Changed a route? → Update `docs/api-reference.md`
- Changed a model? → Update `docs/database.md`
- Changed auth logic? → Update `docs/auth-flow.md`
- Changed a Zustand store? → Update `docs/state-management.md`
- Changed a module? → Update `docs/modules/<module>.md`
- Added/removed coupling between files? → Update `docs/sync-map.md`
- Changed env vars? → Update `docs/architecture.md`

### Rule 2 — Check sync-map before touching any file
Before modifying a file, read `docs/sync-map.md` to find what else must change in sync.

### Rule 3 — Never leave docs stale
If you discover that a doc is outdated (doesn't match the code), update it immediately, even if it wasn't part of the original task.

### Rule 4 — Add to docs when adding new features
Every new route, model, store, component, or env var MUST be documented before the task is considered complete.

---

## Project Overview

Full-stack event management + household + finance platform.

- **Frontend:** React + Vite, Zustand, TailwindCSS, React Router v6, TanStack Query
- **Backend:** Node.js + Express, MongoDB + Mongoose, Socket.IO
- **Auth:** JWT (access + refresh) in HTTP-only cookies + CSRF (csurf)
- **Real-time:** Socket.IO (`server/services/socketService.js`)
- **WhatsApp:** Baileys (`server/services/whatsappService.js`)
- **Two DBs:** main (`MONGO_URI`) + zipori secondary (`ZIPORI_MONGO_URI`)

## Quick Navigation

| Question | Go to |
|----------|-------|
| Which files change together? | `docs/sync-map.md` |
| Environment variables | `docs/architecture.md` |
| How auth works | `docs/auth-flow.md` |
| All API routes | `docs/api-reference.md` |
| Database models | `docs/database.md` |
| Zustand stores | `docs/state-management.md` |
| Socket.IO events | `docs/socket-events.md` |
| Hotel orders module | `docs/modules/hotel-orders.md` |
| Finance module | `docs/modules/finance.md` |
| Groups & kitchen | `docs/modules/groups-kitchen.md` |
| Household module | `docs/modules/household.md` |
| Payments module | `docs/modules/payments.md` |
| Admin module | `docs/modules/admin.md` |
| Chat/WhatsApp/Email | `docs/modules/communication.md` |

## Route Guards
- `ProtectedRoute` — requires login
- `AdminOnlyRoute` — requires `role === 'admin'`
- `TzitzitRoute` — special tzitzit access flag

## Default Redirect Logic
- `activeView === 'household'` AND `user.householdAccess` → `/household/quick-tasks`
- Otherwise → `/tasks`

## Print Pages (outside Layout)
- `/print/kitchen-a3` → `KitchenPrintPageA3`
- `/print/group-schedule` → `GroupSchedulePrintPage`
