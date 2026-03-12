# Household Module

> Last updated: 2026-03-12

## Overview
Personal household management. Separate "view" from the main app — toggled via `activeView` in authStore.

## Access
- Requires `user.householdAccess === true`
- Guarded by `ProtectedRoute` (standard auth) + `activeView` logic
- Default redirect when `activeView === 'household'` → `/household/quick-tasks`

## Pages & Routes
| Page | Route | Description |
|------|-------|-------------|
| `HouseholdDashboard` | `/household` | Overview |
| `ShoppingListPage` | `/household/shopping` | Shopping list |
| `HouseholdTasksPage` | `/household/tasks` | Tasks |
| `HouseholdQuickTasksPage` | `/household/quick-tasks` | Quick task entry (default landing) |
| `FamilySettingsPage` | `/household/family` | Family members |
| `HouseholdProjectsPage` | `/household/projects` | Projects list |
| `HouseholdProjectPage` | `/household/projects/:id` | Project detail |
| `NewHouseholdProjectPage` | `/household/projects/new` | Create project |
| Finance pages | `/household/finance/*` | See `docs/modules/finance.md` |

## Key Files
| File | Role |
|------|------|
| `client/src/stores/householdStore.js` | Tasks, shopping, family state |
| `client/src/stores/householdProjectStore.js` | Household projects state |
| `server/models/Family.js` | Family members schema |
| `server/models/ShoppingItem.js` | Shopping items schema |
| `server/models/HouseholdTask.js` | Household task schema |
| `server/models/HouseholdProject.js` | Household project schema |

## API Routes
- `/api/family` — family members
- `/api/shopping` — shopping list
- `/api/household-tasks` — tasks
- `/api/household-projects` — projects
