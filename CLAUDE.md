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

## Production Server

**URL:** `https://dahanswebsite.com/`
- API: `https://dahanswebsite.com/api/...`
- אל תנסה localhost — השרת רץ בפרודקשן בלבד

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
| Tether MDM module | use `/tether` skill |

## Tether MDM Module (summary)

Android MDM system for religious communities. Separate auth — Tether admins are NOT the same as main app users.

**Key files:**
- `server/routes/tetherRoutes.js` — all Tether API (prefix `/api/tether`)
- `server/models/TetherDevice.js`, `TetherCommunity.js`, `TetherAdmin.js`
- `client/src/pages/TetherAdminPage.jsx` — entry point (65 lines, imports from `pages/tether/`)
- `client/src/pages/tether/` — all Tether UI components

**Architecture:**
- Two-layer Android protection: Accessibility Service (UI blocking) + VPN (DNS-level blocking)
- Policy: community policy (base) merged with device policy (per-device overrides, `null` = inherit from community)
- `mergePolicy(communityPolicy, devicePolicy)` on server — null fields inherit
- `pendingCommands` queue: `SHOW_MESSAGE`, `FORCE_SYNC`, `RELEASE_ALL` — fetched atomically by device heartbeat
- Heartbeat every 5 min: reports `accessibilityEnabled`, `isDeviceAdmin`, `isDeviceOwner`, `vpnActive`

**Admin route:** `/admin/tether` — requires `role === 'admin'` in main app + separate Tether JWT login

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

---

## Token-saving rules (mandatory)

**NEVER read these — they are huge and useless to AI:**
- `directory_structure.txt` — 809 KB auto-generated, use Glob/Grep instead
- `LOGS_FULL_FILES.md` — raw logs dump
- `server/auth_info_baileys/` — WhatsApp binary session data
- `node_modules/`, `client/dist/`, `uploads/` — already in .claudeignore

**Navigation strategy — read only what you need:**
1. Check `docs/sync-map.md` FIRST to know which files are coupled
2. Read the specific `docs/` file for the area you're working in
3. Read source files only after knowing what you're looking for
4. Never glob `server/routes/` blindly — 41 route files, use Grep to find the one you need
