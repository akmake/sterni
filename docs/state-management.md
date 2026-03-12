# State Management (Zustand)

> Last updated: 2026-03-12
> All stores in `client/src/stores/`

## authStore (`authStore.js`)
**Central auth state — used across the entire app**

```js
state: {
  user: { _id, name, role, householdAccess, canViewCommissions, ... } | null,
  activeView: 'main' | 'household',
  isAuthenticated: boolean,
}
```

Key actions: `login`, `logout`, `checkAuth`, `setActiveView`

Used by: `ProtectedRoute`, `AdminOnlyRoute`, `TzitzitRoute`, `Navbar`, `App.jsx (DefaultRedirect)`, `HotelNewOrderPage` (canViewCommissions)

---

## groupsStore (`groupsStore.js`)
**Groups list and selected group state**

Used by: `GroupsPage`, `GroupDetailsPage`, `NewGroupPage`

---

## projectsStore (`projectsStore.js`)
**Projects list and selected project state**

Used by: `ProjectsPage`, `ProjectPage`, `NewProjectPage`

---

## financeStore (`financeStore.js`)
**Finance data — tightly coupled with all Finance pages**

Used by: ALL `Finance*.jsx` pages
Note: Changing financeStore state shape requires updating every finance page

---

## householdStore (`householdStore.js`)
**Household tasks, shopping list, family data**

Used by: `HouseholdDashboard`, `ShoppingListPage`, `HouseholdTasksPage`, `FamilySettingsPage`

---

## householdProjectStore (`householdProjectStore.js`)
**Household projects**

Used by: `HouseholdProjectsPage`, `HouseholdProjectPage`, `NewHouseholdProjectPage`

---

## mealsStore (`mealsStore.js`)
**Kitchen/meals data**

Used by: `KitchenReportPage`, `KitchenStaffManager`, `AdminMealsPage`

---

## Paymentstore (`Paymentstore.js`)
**Payment data**

Used by: `Grouppaymentspage`, payment-related components

---

## Notes
- Most pages also use TanStack Query (`useQuery`, `useMutation`) for server state — stores are for shared/persistent client state
- `authStore` is the only store used across ALL modules
- When adding a new field to a store, search for all pages that destructure it
