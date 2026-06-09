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
| GET/POST/PUT/DELETE | `/tasks` | Tasks CRUD |

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

---

## When updating this file
- Add new routes when registering them in `server/app.js`
- Remove routes when deleting route files
- Note auth requirements changes
