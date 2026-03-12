# Groups & Kitchen Module

> Last updated: 2026-03-12

## Overview
Core event management. Groups represent events/bookings. Kitchen module handles meal planning and staff for groups.

## Key Files
| File | Role |
|------|------|
| `client/src/pages/GroupsPage.jsx` | Groups list |
| `client/src/pages/GroupDetailsPage.jsx` | Group detail + tabs |
| `client/src/pages/NewGroupPage.jsx` | Create group |
| `client/src/pages/GroupPageComponents.jsx` | Sub-components for group detail |
| `client/src/pages/GroupPageHeader.jsx` | Group detail header |
| `client/src/pages/GroupPageModals.jsx` | Group modals |
| `client/src/pages/GroupQuickAdd.jsx` | Quick add widget |
| `client/src/pages/Grouppaymentspage.jsx` | Group payments |
| `client/src/pages/KitchenReportPage.jsx` | Kitchen report |
| `client/src/pages/KitchenStaffManager.jsx` | Staff management |
| `client/src/pages/KitchenPrintPageA3.jsx` | Print view (A3) — outside Layout |
| `client/src/pages/FullScheduleReportPage.jsx` | Full schedule report |
| `client/src/pages/ThaiSchedulePage.jsx` | Thai staff schedule |
| `client/src/pages/StaffPrintView.jsx` | Staff print view |
| `client/src/pages/Staffprinta3.jsx` | Staff A3 print |
| `client/src/stores/groupsStore.js` | Groups state |
| `server/models/Group.js` | Group schema |
| `server/models/Meal.js` | Meal/menu schema |
| `server/models/Hall.js` | Hall/venue schema |
| `server/routes/groupRoutes.js` | Group CRUD |
| `server/routes/mealsRoutes.js` | Meals CRUD |
| `server/routes/hallRoutes.js` | Halls CRUD |

## Coupling
Changes to `Group.js` model affect:
- `GroupDetailsPage` (and all GroupPage* components)
- `KitchenReportPage`
- `FullScheduleReportPage`
- `groupsStore.js`
- `Grouppaymentspage.jsx`

## Print Pages
`KitchenPrintPageA3` and `GroupSchedulePrintPage` are rendered **outside Layout** (no Navbar).
- Routes: `/print/kitchen-a3`, `/print/group-schedule`
- These are direct-print views — no auth guard by default
