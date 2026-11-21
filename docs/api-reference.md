# API Reference

> Last updated: 2026-03-12
> Base URL: `/api`
> All protected routes require: JWT cookie + `X-CSRF-Token` header (on mutations)

## Public Routes (no auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login |
| POST | `/auth/register` | Register |
| POST | `/auth/logout` | Logout |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/csrf-token` | Get CSRF token |
| `*` | `/chat/*` | Chat (Socket.IO HTTP) |
| GET | `/logs` | System logs (admin UI) |
| POST | `/logs/device-ping` | Client device-info cache (once on app load) |
| POST | `/logs/behavior` | On-page behavior beacon (scroll/clicks/active-time/biometrics) — `navigator.sendBeacon` |
| POST | `/logs/consent` | Record data-collection consent (banner acknowledged) → `ConsentRecord` |

---

## Visitor Intelligence (admin only — `requireAuth` + `requireAdmin`)
Prefix `/api/logs/admin`. UI: `AdminLogsPage.jsx` (+ `pages/logs/` components).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/all` | Raw request logs (filters: device, ipAddress, dates) |
| GET | `/admin/summary` | Stats + analytics (topBrowsers/OS/devices/pages/IPs/**countries**) |
| GET | `/admin/visitors` | Requests grouped into unique visitors (by fingerprint→IP); source classification, returning/new, suspicious. Params: `limit`, `days`, `suspicious` |
| GET | `/admin/journey?key=` | One visitor's chronological page-by-page timeline |
| GET | `/admin/live?minutes=5` | Visitors active in the last N minutes ("online now") |
| GET | `/admin/user-activity` | Per registered-user activity summary |
| POST | `/admin/toggle` | Enable/disable logging |
| GET | `/admin/status` | Logging on/off status |
| DELETE | `/admin/cleanup` | Delete logs older than `days` |
| DELETE | `/admin/delete-all` | Delete all logs |

---

## WhatsApp Monitor (admin only — `requireAuth` + `requireAdmin`)
Prefix `/api/whatsapp-monitor`. UI: `WhatsAppMonitorPage.jsx`. Separate Baileys connection (`whatsappMonitorService.js`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | Connection status `{ state, user, reconnectAttempts }` |
| GET | `/qr` | `{ state, qr }` — QR data-URL to link your WhatsApp (null when connected) |
| POST | `/connect` | Start the monitor connection (if not running) |
| POST | `/logout` | Unlink + delete session (`auth_info_monitor/`) — new QR next time |
| GET | `/settings` | Tracking settings `{ mode: 'all'\|'selected', tracked: [{ jid, phone, name }] }` |
| PUT | `/settings` | Save settings (phones normalized to `972…`). `selected` = store only tracked contacts' messages |
| GET | `/chats` | Chat list (per-contact summary), sorted by `lastMessageAt`, limit 300. In `selected` mode only tracked chats, unless `?all=1` |
| POST | `/chats/:jid/read` | Reset `unreadCount` |
| GET | `/chats/:jid/messages` | Messages for a chat (`?before=ISO&limit=50` older page, or `?after=ISO` only newer), old→new, `{ messages, hasMore }` |
| POST | `/media/:messageId/fetch` | Download media now from WhatsApp (history / failed download) using stored raw message; 409 if impossible |
| GET | `/media/:messageId` | Stream a message's media file (private, not via `/uploads`). `?download=1` → attachment with original file name |

## WhatsApp Viewer (read-only — `requireAuth` + role `wa-viewer` or `admin`)
Prefix `/api/wa-view`. UI: `WaViewerPage.jsx` (`/wa-view`, outside Layout). Shows only the chat(s) matching `WhatsAppMonitorSettings.tracked`. File: `server/routes/waViewRoutes.js`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/messages` | `{ contact:{name,phone}, count, hasMore, serverTime, messages[] }`, always old→new. Params: `since=ISO` (sent after), `afterId=<id>` (after that message), `changedSince=ISO` (inserted/edited/deleted/reacted/media-downloaded since — pass previous `serverTime` to poll), `before=ISO` (older page), `limit` (default 500, max 2000). No params → latest N. `notice` when no contact configured |
| GET | `/media/:messageId` | Media of a tracked-chat message. If not on disk yet — downloads from WhatsApp on the fly. `?download=1` → attachment |
| GET | `/tasks` | `{ enabled, targetName, tasks[] }` — whether the caller has `User.taskTargetUser`, and the tasks the caller created for that user (last 100) |
| POST | `/tasks` | `{ text }` (≤2000) → creates `Task { userId: taskTargetUser, createdBy: caller }`. 403 without `taskTargetUser` |

Message shape: `{ id, direction:'in'|'out', from, timestamp, type, text, quotedText, media:{available,url,downloadUrl,mime,fileName,fileSize,durationSeconds,isVoiceNote}|null, location?, contact?, poll?, deleted, edited, originalText?, reactions:[{emoji,by:'me'|'them'}], updatedAt }`. `id` = WhatsApp message id (unique, stable).

Script usage: `POST /api/auth/login` (cookies `jwt` + refresh cookie, CSRF token from `GET /api/csrf-token`), then `GET /api/wa-view/messages?since=…` with the cookies; access token lives 15 min → `POST /api/auth/refresh` on 401.

---

## Protected Routes

### Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/me` | Current user info |

### Software Library
| Method | Path | Description |
|--------|------|-------------|
| GET | `/software` | רשימת תוכנות (query: `category`, `search`) |
| GET | `/software/:id` | פרטי תוכנה |
| GET | `/software/:id/download` | הורדת קובץ + increment counter |
| POST | `/software` | העלאת תוכנה (`multipart/form-data`, עד 2GB) |
| PATCH | `/software/:id` | עדכון פרטים |
| DELETE | `/software/:id` | מחיקת תוכנה + קובץ |

### Projects
| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | List projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project |
| PUT | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Delete project |

### Groups
| Method | Path | Description |
|--------|------|-------------|
| GET | `/groups` | List groups |
| POST | `/groups` | Create group |
| GET | `/groups/:id` | Get group |
| PUT | `/groups/:id` | Update group |
| DELETE | `/groups/:id` | Delete group |

### Halls
| Method | Path | Description |
|--------|------|-------------|
| GET | `/halls` | List halls |
| POST | `/halls` | Create hall |
| PUT | `/halls/:id` | Update hall |
| DELETE | `/halls/:id` | Delete hall |

### Hotel Orders
| Method | Path | Description |
|--------|------|-------------|
| GET | `/hotel-orders` | List orders |
| POST | `/hotel-orders` | Create order |
| GET | `/hotel-orders/search?query=` | Search orders |
| GET | `/hotel-orders/:id` | Get order |
| PUT | `/hotel-orders/:id` | Update order |
| DELETE | `/hotel-orders/:id` | Delete order |

### Hotel Data (Main DB — full CRUD)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/hotel-data/hotels` | List hotels |
| POST | `/hotel-data/hotels` | Create hotel |
| PUT | `/hotel-data/hotels/:id` | Update hotel |
| DELETE | `/hotel-data/hotels/:id` | Delete hotel |
| GET | `/hotel-data/pricelists?hotelId=&active=` | Price lists (filter by hotel) |
| POST | `/hotel-data/pricelists` | Create price list |
| PUT | `/hotel-data/pricelists/:id` | Update price list |
| DELETE | `/hotel-data/pricelists/:id` | Delete price list |
| GET | `/hotel-data/room-types/:hotelId` | Room types for hotel |
| POST | `/hotel-data/room-types` | Create room type |
| PUT | `/hotel-data/room-types/:id` | Update room type |
| DELETE | `/hotel-data/room-types/:id` | Delete room type |
| GET | `/hotel-data/extras` | Extra types |
| POST | `/hotel-data/extras` | Create extra type |
| PUT | `/hotel-data/extras/:id` | Update extra type |
| DELETE | `/hotel-data/extras/:id` | Delete extra type |

### Finance
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/finance/transactions` | Transactions CRUD |
| GET/POST/PUT/DELETE | `/finance/categories` | Categories CRUD |
| GET/POST/PUT/DELETE | `/finance/budgets` | Budgets CRUD |
| GET/POST/PUT/DELETE | `/finance/recurring` | Recurring CRUD |
| GET/POST/PUT/DELETE | `/finance/deposits` | Deposits CRUD |
| GET | `/finance/analytics` | Analytics data |
| GET | `/finance/dashboard` | Dashboard summary |
| POST | `/finance/import` | Import transactions |

### Payments
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/payments` | Payments CRUD |
| GET/POST/PUT/DELETE | `/payment-requests` | Payment requests CRUD |

### Quotes
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/quotes` | Quotes CRUD |

### Household
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/family` | Family members |
| GET/POST/PUT/DELETE | `/shopping` | Shopping list |
| GET/POST/PUT/DELETE | `/household-tasks` | Household tasks |
| GET/POST/PUT/DELETE | `/household-projects` | Household projects |

### Tasks
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/tasks` | Tasks CRUD. GET populates `createdBy: { _id, name }` (shown as "מאת …" badge in `TasksPage.jsx`) |

### Admin users (`/api/admin/users`, admin)
| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/admin/users/:id/task-target` | `{ taskTargetUser: <userId>\|null }` — allow this user to create tasks that land in the target user's `/tasks` (null = revoke). UI: "יוצר מטלות עבור" column in `AdminUsersPage.jsx` |

### Meals / Kitchen
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/meals` | Meals CRUD |

### Emails
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/emails` | Emails CRUD |

### Settings
| Method | Path | Description |
|--------|------|-------------|
| GET/PUT | `/settings` | System settings |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| `*` | `/admin/*` | Admin routes (users, orders, centers) |

### Tzitzit
| Method | Path | Description |
|--------|------|-------------|
| `*` | `/tzitzit/*` | Tzitzit management |

### Daily Study
| Method | Path | Description |
|--------|------|-------------|
| GET | `/study/day?date=YYYY-MM-DD&diaspora=true&timezone=...` | Returns daily study tracks (Chumash with Rashi, Rambam 1/3 chapters with Siyumim, book introductions and mitzvot list, Tanya, Sefer HaMitzvot, Shnayim Mikra, Tehillim). Supports Chabad Chitas transition on Simchat Torah (completing Vezot Haberakhah and starting Bereshit) for Israel (22 Tishrei) and Diaspora (23 Tishrei). Tanya daily range resolves transitions across all 5 Tanya sections (including single-depth parts like Chinukh Katan and final-chapter conclusions) and leverages local disk cache. |
| GET | `/study/tehillim-chapters?chapters=...` | Returns chapters for personal Tehillim reader |


---

## When updating this file
- Add new routes when registering them in `server/app.js`
- Remove routes when deleting route files
- Note auth requirements changes
