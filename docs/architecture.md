# Architecture & Environment

> Last updated: 2026-03-12

## Environment Variables

### Required (server will not start without these)
| Variable | Description |
|----------|-------------|
| `MONGO_URI` | Main MongoDB connection string |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |

### Required for features
| Variable | Description | Used by |
|----------|-------------|---------|
| `ZIPORI_MONGO_URI` | Secondary MongoDB (hotel data) | `server/db/ziporiDb.js` → all `/api/hotel-data/*` routes |
| `CLIENT_URL` | Frontend URL for CORS | `server/app.js` (default: `http://localhost:5173`) |
| `NODE_ENV` | `production` / `development` | CSRF cookie secure flag, various guards |
| `PORT` | Server port | `server/app.js` (default: 5000) |

### Email & WhatsApp
| Variable | Description |
|----------|-------------|
| `EMAIL_*` | Email listener credentials (see emailListener.js) |
| WhatsApp credentials stored in `server/auth_info_baileys/` and `server/credentials/` |

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
- Connected via `mongoose.createConnection(ZIPORI_MONGO_URI)` in `server/db/ziporiDb.js`
- Models in `server/models/zipori/`: Hotel, PriceList, RoomType, ExtraType
- Used ONLY by: `server/routes/hotelZiporiDataRoutes.js`
- **If `ZIPORI_MONGO_URI` is missing → hotel creation page shows no hotels/room types**

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
