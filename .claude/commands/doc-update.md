# Doc Update Protocol

Run this after completing any code change. Follow the mandatory rules from CLAUDE.md exactly.

Check each condition and update the relevant doc if true:

- Changed a route or added an endpoint? → Update `docs/api-reference.md`
- Changed a Mongoose model? → Update `docs/database.md`
- Changed auth/middleware logic? → Update `docs/auth-flow.md`
- Changed a Zustand store? → Update `docs/state-management.md`
- Changed Socket.IO events? → Update `docs/socket-events.md`
- Changed hotel orders? → Update `docs/modules/hotel-orders.md`
- Changed finance? → Update `docs/modules/finance.md`
- Changed groups/kitchen? → Update `docs/modules/groups-kitchen.md`
- Changed household? → Update `docs/modules/household.md`
- Changed payments? → Update `docs/modules/payments.md`
- Changed admin? → Update `docs/modules/admin.md`
- Changed Tether? → Update `docs/modules/tether.md` (create if missing)
- Added/removed coupling between files? → Update `docs/sync-map.md`
- Changed env vars? → Update `docs/architecture.md`
- Added a new feature/module? → Create `docs/modules/<module>.md` and link from `CLAUDE.md`

Read the relevant doc first, then update only what changed. Keep it concise.
