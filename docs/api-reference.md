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

---

## Protected Routes

### Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/me` | Current user info |

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

### Hotel Data (Zipori DB — read only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/hotel-data/hotels` | List hotels |
| GET | `/hotel-data/pricelists?hotelId=&active=` | Price lists for hotel |
| GET | `/hotel-data/room-types/:hotelId` | Room types for hotel |
| GET | `/hotel-data/extras` | Extra types |

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
