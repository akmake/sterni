# Admin Module

> Last updated: 2026-03-12

## Access
- All admin pages require `AdminOnlyRoute` → `user.role === 'admin'`

## Pages
| Page | Route | Description |
|------|-------|-------------|
| `AdminUsersPage` | `/admin/users` | User management |
| `AdminMealsPage` | `/admin/meals` | Meals management |
| `AdminLogsPage` | `/admin/logs` | System logs viewer |
| `UserActivityPage` | `/admin/user-activity` | User activity tracking |

## Logging System
- Middleware: `server/middlewares/loggingMiddleware.js`
- Applied globally in `app.js` — logs all requests
- Model: `server/models/Log.js`
- Viewed in: `AdminLogsPage`
- **Changing loggingMiddleware affects Log model and AdminLogsPage**

## API Routes
- `/api/admin/*` — various admin operations (users, orders, centers)
- `/api/logs` — PUBLIC read (for admin UI display, no auth needed on GET)

## Notes
- Tzitzit management (`/admin/tzitzit`) has its OWN route guard (`TzitzitRoute`) — not `AdminOnlyRoute`
