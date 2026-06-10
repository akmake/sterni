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

---

## Common Auth Bugs

| Symptom | Likely cause |
|---------|-------------|
| All API calls return 401 | CSRF token not being sent, or access token expired |
| 403 "Form has been tampered" | Missing `X-CSRF-Token` header on mutating request |
| User gets `_id` as string instead of ObjectId | Use `req.user._id` (ObjectId) not `req.user.id` (string) for MongoDB queries |
| "לא מחובר" on valid session | Cookie not sent — check `credentials: 'include'` in fetch/axios |
