# Auth Flow

> Last updated: 2026-06-09

## Overview

JWT-based auth with HTTP-only cookies + CSRF protection.

```
Login → Server sets 2 cookies (jwt + refreshToken) → Client stores nothing in localStorage
Every request → Browser sends cookies automatically → Server validates jwt cookie
Mutating requests → Client must include X-CSRF-Token header
```

---

## Tokens

| Token | Cookie name | Storage | Expiry |
|-------|-------------|---------|--------|
| Access token | `jwt` | HTTP-only cookie | Short (minutes/hours) |
| Refresh token | `refreshToken` | HTTP-only cookie | Long (days) |

Both cookies are HTTP-only → cannot be accessed by JavaScript → XSS-safe.

---

## Server Middleware

### `requireAuth` (`server/middlewares/authMiddleware.js`)
1. Reads `req.cookies.jwt`
2. Verifies with `JWT_ACCESS_SECRET`
3. Sets `req.user = { _id: ObjectId, id: string, role: string }`
4. **Note:** `_id` is MongoDB ObjectId, `id` is string alias — both exist for compatibility
5. **`wa-viewer` lockdown:** if `role === 'wa-viewer'` and `isWaViewerAllowedPath(req)` is false → 403. Allowed: `/api/wa-view/*`, `/api/push/*` (phone notifications), `GET /api/auth/profile`, `/api/auth/change-password` (login/logout/refresh don't pass through requireAuth). Same check in `server/middlewares/requireAuth.js`.

6. **401 carries `code`** (no secrets): `NO_TOKEN` (no `jwt` cookie arrived), `TOKEN_EXPIRED`, `TOKEN_BAD_SIGNATURE` (signed with a different `JWT_ACCESS_SECRET` — another process/server), `TOKEN_INVALID`. On `/api/wa-view` it also logs one line to stdout (pm2 logs): `[wa-view 401] <code> <method> <path, no query> cookies=<cookie names only> expiredAgo=<s> pid=<pid> ua="…"`. API key failures: `code: 'API_KEY_INVALID'`, same log prefix.

### API key (`server/middlewares/apiKeyAuth.js`) — `/api/wa-view` only
For automated consumers: `Authorization: Bearer wav_…` / `X-Api-Key` / `?key=`. Looked up by `sha256` in `User.apiKeyHash` (`select:false`); role must be `wa-viewer` or `admin`. Sets `req.user` + `req.apiKeyAuth = true`; `app.js` skips CSRF for such requests; `waViewRoutes` skips cookie `requireAuth`. Created/revoked by admin (`/api/admin/users/:id/api-key`). Invalid key → 401.

### Roles (`User.role`)
| Role | Access |
|------|--------|
| `user` | Regular app |
| `admin` | Everything + admin pages |
| `wa-viewer` | **Only** `/wa-view` (read-only WhatsApp chat of the tracked contact). Server blocks every other API; client `Layout.jsx` redirects every in-Layout route to `/wa-view`; `LoginPage` navigates there after login. Set via admin users page. If admin set `taskTargetUser`, can also create tasks for that user via `/api/wa-view/tasks` ("מטלה חדשה" button) — the only write it has. |

### `requireAdmin`
- Checks `req.user?.role === 'admin'`
- Returns 403 if not admin

---

## Rate Limiting (`server/middlewares/rateLimiter.js`)

- `authLimiter` — applied to `POST /api/auth/login` (`server/routes/auth.js`). Max 10 **failed** attempts per IP / 15 min (`skipSuccessfulRequests: true`), so legitimate users are never blocked. Brute-force protection.
- `publicLimiter` (default export) — applied to `GET /api/csrf-token` (`server/app.js`).
- In development (`NODE_ENV !== 'production'`) all limiters are pass-through no-ops.

---

## CSRF Protection

All protected routes require a CSRF token.

### Flow
1. Client calls `GET /api/csrf-token` → receives `{ csrfToken: "..." }`
2. Client stores token in memory (NOT localStorage)
3. Every POST/PUT/DELETE includes header: `X-CSRF-Token: <token>`
4. Server rejects with 403 if token missing or invalid: `"Form has been tampered with (CSRF Invalid)"`

### Exempt routes (before csrfProtection in app.js)
- `POST /api/auth/*` — login/register/refresh
- `GET/POST /api/chat/*` — chat
- `GET /api/logs` — logs

### CSRF token is in `client/src/utils/api.js`
The axios instance handles fetching and attaching the CSRF token automatically.

---

## Client State (`client/src/stores/authStore.js`)

```js
{
  user: { _id, name, role, householdAccess, canViewCommissions, ... } | null,
  activeView: 'main' | 'household',
  isAuthenticated: boolean,
}
```

### Actions
- `login(credentials)` — calls POST /api/auth/login, sets user in store
- `logout()` — calls POST /api/auth/logout, clears store
- ⚠️ **No `checkAuth()` exists** — there is no server-side session re-validation on app load. `isAuthenticated` is derived from the persisted `user` in localStorage; if the cookie/session expired, the UI still shows "logged in" until an API call returns 401 (handled by the `api.js` interceptor). Adding a `checkAuth` that calls `/api/auth/profile` on mount is an open improvement.

---

## Route Guards (client)

| Component | File | Logic |
|-----------|------|-------|
| `ProtectedRoute` | `client/src/components/ProtectedRoute.jsx` | Redirects to /login if not authenticated |
| `AdminOnlyRoute` | `client/src/components/AdminOnlyRoute.jsx` | Requires `user.role === 'admin'` |
| `TzitzitRoute` | `client/src/components/TzitzitRoute.jsx` | Special tzitzit access flag |
| (inline) | `client/src/pages/WaViewerPage.jsx` | `/wa-view` — requires `role` `wa-viewer` or `admin` |
| (Layout) | `client/src/components/Layout.jsx` | `role === 'wa-viewer'` → `<Navigate to="/wa-view">` (except `/login`) |

**Sidebar (`client/src/components/Navbar.jsx`):** `getManagementNav` returns an empty list when `!isAuthenticated` — logged-out users see only the "התחברות" button, no nav items.

---

## Common Auth Bugs

| Symptom | Likely cause |
|---------|-------------|
| All API calls return 401 | CSRF token not being sent, or access token expired |
| Automated `/api/wa-view` reader: messages OK, media 401 right after | Unproven (2026-11-24). Compare the two requests: `pm2 logs sterni-backend | grep "wa-view 401"` (`code`, cookie names, pid) and the admin request log (`Log`: status, userAgent, `cookies.count`). `NO_TOKEN` → the media request didn't carry the refreshed cookie (different client/tool) — use the API key / `?key=` on media URLs; `TOKEN_BAD_SIGNATURE` → parallel process with another secret. Don't lengthen TTLs or weaken auth to hide it |
| 403 "Form has been tampered" | Missing `X-CSRF-Token` header on mutating request |
| User gets `_id` as string instead of ObjectId | Use `req.user._id` (ObjectId) not `req.user.id` (string) for MongoDB queries |
| "לא מחובר" on valid session | Cookie not sent — check `credentials: 'include'` in fetch/axios |
