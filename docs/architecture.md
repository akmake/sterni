# Architecture & Environment

> Last updated: 2026-06-09

## Environment Variables

### Required (server will not start without these)
| Variable | Description |
|----------|-------------|
| `MONGO_URI` | Main MongoDB connection string. Local dev: `mongodb://127.0.0.1:27017/sterni` with `NODE_ENV=development` (otherwise auth cookies are `secure` and login fails over http). When `NODE_ENV !== 'production'`, CORS in `server/app.js` allows any origin |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |

### Required for features
| Variable | Description | Used by |
|----------|-------------|---------|
| `ZIPORI_MONGO_URI` | Secondary MongoDB (hotel data) | **No longer used at runtime** — hotel data lives in the main DB; only `migrateHotelData.js` reads it |
| `CLIENT_URL` | Frontend URL for CORS | `server/app.js` (default: `http://localhost:5173`) |
| `NODE_ENV` | `production` / `development` | CSRF cookie secure flag, various guards |
| `PORT` | Server port | `server/app.js` (default: 5000) |

### Email & WhatsApp
| Variable | Description |
|----------|-------------|
| `EMAIL_*` | Email listener credentials (see emailListener.js) |
| `ENCRYPTION_KEY` | 32-char AES-256 key used by `server/utils/encryption.js` to encrypt stored email-account passwords. **Must be set** — there is no insecure fallback. ⚠️ If you change this key, previously-encrypted passwords can no longer be decrypted (re-enter them). |
| WhatsApp credentials stored in `server/auth_info_baileys/` and `server/credentials/` |

### Admin bootstrap scripts (manual, run-once)
| Variable | Description |
|----------|-------------|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Required by `createAdmin.js` and `createTetherAdmin.js`. No hardcoded credentials — set these in `.env` before running the scripts. `ADMIN_NAME` optional. |

### Tether / Shieor device auth (rollout flags)
| Variable | Description |
|----------|-------------|
| `TETHER_BOOTSTRAP_SECRET` | Required for the one-time `POST /api/tether/auth/bootstrap` superadmin creation (replaces the old hardcoded `tether-init-2025`). If unset, bootstrap is disabled. |
| `TETHER_ENFORCE_DEVICE_AUTH` | `'true'` → reject `/api/tether/devices/:id/*` calls that lack a valid `X-Device-Token`. Default (unset) is **rollout mode**: missing token allowed (legacy devices), wrong token always rejected. Flip to `'true'` only after all field devices send the token. |
| `SHIEOR_ENFORCE_AUTH` | Same rollout pattern for `GET/PUT /api/user/:userId` — `'true'` requires a valid `Authorization: Bearer <syncToken>`. |

> **Device token model:** `/api/tether/devices/join` returns a one-time `deviceToken`; `/api/user/register` and `/api/user/login` return a one-time `syncToken`. Only the SHA-256 hash is stored server-side (`TetherDevice.deviceSecretHash`, `UserData.syncTokenHash`, both `select:false`). The app persists the plaintext and sends it back on every device call. See "rollout flags" above for the 3-phase enable.

---

## Server Architecture

```
Request → helmet/cors → loggingMiddleware → rateLimiter
       → Public routes (chat, auth, logs)
       → csrfProtection
       → requireAuth
       → Protected routes
```

### Security layers
1. **helmet** — HTTP headers
2. **cors** — Only `CLIENT_URL` origin allowed, credentials: true
3. **mongoSanitize** — Prevents NoSQL injection
4. **csurf** — CSRF token required on all mutating requests after `/api/csrf-token`
5. **requireAuth** — Validates JWT from `req.cookies.jwt`
6. **rateLimiter** — Applied to CSRF token endpoint

> **JWT is stored in HTTP-only cookies, never in localStorage.** `client/src/stores/authStore.js` keeps only the `user` profile object + `activeView` in localStorage — no tokens. XSS cannot exfiltrate the session.

### Frontend security (nginx)
The static frontend is served by nginx (`client/nginx.conf`), which sets the CSP and security headers for the HTML shell (Express `helmet` only covers API responses):
- `Content-Security-Policy` — `script-src 'self'` (no `unsafe-inline`/`unsafe-eval`; the Vite build emits external module scripts only). `style-src` keeps `unsafe-inline` for Tailwind/React inline styles + Google Fonts. `connect-src 'self' ws: wss:` for the API + Socket.IO.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- ⚠️ If the production reverse proxy (Cloudflare / outer nginx) sets its own CSP, it must match this one — a weaker upstream CSP overrides it.

### HTML rendering (XSS)
All `dangerouslySetInnerHTML` usages go through `client/src/utils/sanitizeHtml.js` (DOMPurify, formatting allowlist). Never inject raw user HTML directly — always wrap with `sanitizeHtml()`. Affected: PriceQuoteGenerator(Pdf), PaymentRequestGenerator, QuoteManager, HotelNew/EditOrderPage.

### Error handling
All routes funnel errors to the central handler `server/middlewares/errorHandler.js` (registered last in `app.js`). It handles `EBADCSRFTOKEN` (403) and, in **production**, returns a generic `"Internal Server Error"` message for 5xx (no stack/internal message leakage). Stack traces are only included when `NODE_ENV !== 'production'`. Use `next(err)` (or the `catchAsync` wrapper) in controllers rather than ad-hoc `res.status(500)`.

### CSRF Flow
1. Client calls `GET /api/csrf-token` to get token
2. Token sent as `X-CSRF-Token` header on every POST/PUT/DELETE
3. Public routes (chat, auth, logs) are before csrfProtection — no token needed

---

## Two Database Architecture

### Main DB (mongoose default connection)
- Connected via `mongoose.connect(MONGO_URI)`
- All models in `server/models/` (except zipori/)
- Used for: users, groups, projects, finance, household, orders, etc.

### Zipori DB (secondary, read-mostly)
- `server/db/ziporiDb.js` (`mongoose.createConnection(ZIPORI_MONGO_URI)`) — **no longer imported by `app.js`**
- Models in `server/models/zipori/`: Hotel, PriceList, RoomType, ExtraType
- Used by: nothing at runtime (`hotelZiporiDataRoutes.js` uses main-DB models despite its name)
- Hotel data is in the main DB — `ZIPORI_MONGO_URI` is not needed

---

## Ports & URLs
| Service | Default |
|---------|---------|
| Frontend dev | http://localhost:5173 |
| Backend | http://localhost:5000 |
| API prefix | `/api/` |

---

## Real-time (Socket.IO)
- Setup in `server/services/socketService.js`
- IO instance stored on app: `app.set('io', io)` → accessed in controllers via `req.app.get('io')`
- CORS matches `CLIENT_URL`

## Background Services (start on boot)
- `startEmailListener()` — polls email inbox
- `connectToWhatsApp()` — initializes Baileys WhatsApp connection

## Memory footprint (server)

Measured locally 2026-10-13: idle server ≈ 150–215 MB RSS (WhatsApp not connected, no traffic).

| Source | Cost | Notes |
|--------|------|-------|
| Chromium from `utils/articleFetcher.js` (news article fetch) | 150–300 MB, **separate process** | Was kept open forever after first use. Now closed after 2 min idle (`BROWSER_IDLE_MS`) |
| Chromium from `controllers/quotePdfController.js` | per request | Launched and closed per PDF |
| Baileys WhatsApp (`services/whatsappService.js`) | ~35 MB + session/sockets | Only when connected |
| mongoose / socket.io / express | ~55 MB | Baseline |
| `googleapis` | ~100 MB if imported | Only `utils/googleSheets.js` imports it, and nothing imports that file — keep it that way |

In-memory caches are capped: `articleFetcher` cache (`CACHE_MAX = 100`), `loggingMiddleware` `geoCache` (`GEO_CACHE_MAX = 5000`, one entry per unique IP). `alertThrottle` and `deviceInfoCache` already self-prune.
