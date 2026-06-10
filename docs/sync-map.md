# Sync Map — Coupled Files Registry

> When you change a file in the LEFT column, you MUST also check/update the files in the RIGHT column.
> Last updated: 2026-06-09

---

## Software Library Module

| File changed | Must also check |
|---|---|
| `server/models/Software.js` | `server/controllers/softwareController.js`, `docs/modules/software-library.md`, `docs/database.md` |
| `server/routes/softwareRoutes.js` | `server/app.js`, `docs/api-reference.md`, `docs/modules/software-library.md` |
| `client/src/pages/SoftwareLibraryPage.jsx` | `client/src/App.jsx` (route), `client/src/components/Navbar.jsx` (nav item) |

---

## Auth & Security

| File changed | Must also check |
|---|---|
| `server/middlewares/authMiddleware.js` | `client/src/stores/authStore.js`, `server/routes/auth.js`, `docs/auth-flow.md` |
| `server/routes/auth.js` | `client/src/stores/authStore.js`, `client/src/pages/LoginPage.jsx`, `docs/auth-flow.md` |
| `client/src/stores/authStore.js` | `client/src/components/ProtectedRoute.jsx`, `client/src/components/AdminOnlyRoute.jsx`, `client/src/App.jsx` |
| `client/src/utils/api.js` | Every page that calls the API (CSRF token logic lives here) |
| `client/src/utils/sanitizeHtml.js` | Every `dangerouslySetInnerHTML` consumer: `PriceQuoteGenerator.jsx`, `PriceQuoteGeneratorPdf.jsx`, `PaymentRequestGenerator.jsx`, `QuoteManager.jsx`, `HotelNewOrderPage.jsx`, `HotelEditOrderPage.jsx` (changing the tag/attr allowlist affects rendered formatting in all of them) |
| `client/nginx.conf` (CSP / security headers) | Production reverse-proxy CSP (Cloudflare / outer nginx — not in repo), `docs/architecture.md` |

---

## Hotel Orders Module

| File changed | Must also check |
|---|---|
| `server/models/HotelOrder.js` | `server/controllers/hotelOrderController.js`, `client/src/pages/HotelNewOrderPage.jsx`, `client/src/pages/HotelEditOrderPage.jsx`, `client/src/pages/HotelQuotePage.jsx`, `client/src/pages/HotelOrderConfirmationPage.jsx`, `docs/modules/hotel-orders.md` |
| `server/models/zipori/PriceList.js` | `server/controllers/hotelZiporiDataController.js`, `client/src/lib/priceCalculator.js`, `client/src/components/orders/AddRoomForm.jsx`, `docs/modules/hotel-orders.md` |
| `server/models/zipori/RoomType.js` | `server/controllers/hotelZiporiDataController.js`, `client/src/components/orders/AddRoomForm.jsx`, `client/src/components/orders/OrderSummaryTable.jsx` |
| `client/src/lib/priceCalculator.js` | `client/src/pages/HotelNewOrderPage.jsx`, `client/src/pages/HotelEditOrderPage.jsx`, `client/src/components/orders/AddRoomForm.jsx` |
| `server/routes/hotelOrderRoutes.js` | `docs/api-reference.md`, `docs/modules/hotel-orders.md` |
| `server/routes/hotelZiporiDataRoutes.js` | `server/db/ziporiDb.js`, `docs/architecture.md` (ZIPORI_MONGO_URI) |
| `server/db/ziporiDb.js` | `docs/architecture.md`, ALL zipori models |

---

## Finance Module

| File changed | Must also check |
|---|---|
| `client/src/stores/financeStore.js` | All `client/src/pages/Finance*.jsx` pages |
| `server/models/FinanceTransaction.js` | `financeTransactionRoutes.js`, `financeAnalyticsRoutes.js`, `financeDashboardRoutes.js`, `docs/modules/finance.md` |
| `server/models/FinanceCategory.js` | `FinanceCategoryRule.js`, `financeTransactionRoutes.js`, `financeCategoryRoutes.js`, `financeImportRoutes.js` |
| `server/models/FinanceBudget.js` | `financeBudgetRoutes.js`, `financeDashboardRoutes.js` |
| Any finance route | `docs/api-reference.md`, `docs/modules/finance.md` |

---

## Groups & Kitchen Module

| File changed | Must also check |
|---|---|
| `server/models/Group.js` | `groupRoutes.js`, `client/src/pages/GroupDetailsPage.jsx`, `client/src/pages/GroupsPage.jsx`, `client/src/pages/KitchenReportPage.jsx`, `client/src/pages/FullScheduleReportPage.jsx`, `client/src/stores/groupsStore.js` |
| `server/models/Meal.js` | `mealsRoutes.js`, `KitchenReportPage.jsx`, `KitchenStaffManager.jsx`, `KitchenPrintPageA3.jsx` |
| `client/src/stores/groupsStore.js` | All group-related pages |
| `client/src/pages/GroupDetailsPage.jsx` | `GroupPageComponents.jsx`, `GroupPageHeader.jsx`, `GroupPageModals.jsx`, `GroupQuickAdd.jsx` |

---

## Household Module

| File changed | Must also check |
|---|---|
| `client/src/stores/householdStore.js` | `HouseholdDashboard.jsx`, `ShoppingListPage.jsx`, `HouseholdTasksPage.jsx` |
| `client/src/stores/householdProjectStore.js` | `HouseholdProjectsPage.jsx`, `HouseholdProjectPage.jsx`, `NewHouseholdProjectPage.jsx` |
| `server/models/Family.js` | `familyRoutes.js`, `FamilySettingsPage.jsx`, `householdStore.js` |
| `server/models/HouseholdTask.js` | `householdTaskRoutes.js`, `HouseholdTasksPage.jsx`, `HouseholdQuickTasksPage.jsx` |

---

## Payments Module

| File changed | Must also check |
|---|---|
| `server/models/Payment.js` | `Paymentroutes.js`, `client/src/stores/Paymentstore.js`, `client/src/pages/Grouppaymentspage.jsx` |
| `server/models/PaymentRequest.js` | `paymentRequestRoutes.js`, `PaymentRequestsPage.jsx`, `PaymentRequestEditorPage.jsx` |
| `client/src/stores/Paymentstore.js` | All payment pages |

---

## Projects Module

| File changed | Must also check |
|---|---|
| `server/models/Project.js` | `projectRoutes.js`, `client/src/stores/projectsStore.js`, `ProjectPage.jsx`, `ProjectsPage.jsx` |
| `client/src/stores/projectsStore.js` | `ProjectPage.jsx`, `ProjectsPage.jsx`, `NewProjectPage.jsx` |

---

## Device Auth (cross-repo — server ↔ Android apps)

> ⚠️ These couplings span **separate repositories**. A change on one side needs a coordinated change + redeploy on the other. See `docs/architecture.md` → "Tether / Shieor device auth".

| File changed | Must also check |
|---|---|
| `server/routes/tetherRoutes.js` (`/devices/join` token issuance, `requireDeviceAuth`, `TETHER_ENFORCE_DEVICE_AUTH`) | `server/models/TetherDevice.js` (`deviceSecretHash`), **ManagerApk** repo: `data/model/TetherModels.kt` (`JoinCommunityResponse.deviceToken`), `admin/TetherPolicyManager.kt` (token store), `data/api/RetrofitClient.kt` (interceptor), `ui/screens/join/JoinCommunityViewModel.kt`, `DailyStudyApp.kt` |
| `server/controllers/shieorUserController.js` + `server/routes/shieorUserRoutes.js` (`syncToken`, `requireSyncAuth`, `SHIEOR_ENFORCE_AUTH`) | `server/models/UserData.js` (`syncTokenHash`), **AppHome** repo: `network/UserService.kt` (`syncToken` fields + `@Header`), `sync/UserManager.kt` (token store + bearer) |

**Rollout order (do NOT enforce before apps ship):** (1) deploy server token issuance — non-breaking; (2) rebuild + roll out ManagerApk & AppHome so devices send the token; (3) once telemetry shows devices sending tokens, set `TETHER_ENFORCE_DEVICE_AUTH=true` / `SHIEOR_ENFORCE_AUTH=true`.

---

## System-wide

| File changed | Must also check |
|---|---|
| `server/app.js` | `docs/architecture.md`, `docs/api-reference.md` (new routes registered here) |
| `client/src/App.jsx` | `docs/api-reference.md` (new frontend routes) |
| Any `.env` variable added/removed | `docs/architecture.md` |
| `server/services/socketService.js` | `docs/socket-events.md`, any controller using `req.app.get('io')` |
| `server/middlewares/loggingMiddleware.js` | `server/models/Log.js`, `client/src/utils/deviceInfo.js`, `AdminLogsPage.jsx`, emits socket `visitor:alert` (`docs/socket-events.md`) |
| `client/src/utils/deviceInfo.js` | `server/models/Log.js` (any new collected field needs a schema field + middleware mapping + `AdminLogsPage.jsx` display) |
| `server/controllers/logsController.js` | `server/routes/logsRoutes.js`, `client/src/pages/logs/*` (VisitorsView/LiveView/VisitorJourneyModal/WorldMap), `docs/api-reference.md` |
| `client/src/utils/behaviorTracker.js` | `server/controllers/logsController.js` (`receiveBehavior`), `server/models/Log.js` (`behavior` field) — init in `client/src/main.jsx` |
| `client/src/utils/advancedSignals.js` | `client/src/utils/deviceInfo.js` (merges into payload), `server/models/Log.js` (`signals.*`), `server/middlewares/loggingMiddleware.js` (`computeVpnSignals`), `AdminLogsPage.jsx` display |
| `client/src/components/ConsentBanner.jsx` | `client/src/utils/deviceInfo.js` (`CONSENT_KEY`/`CONSENT_VERSION`), `server/models/ConsentRecord.js`, `POST /api/logs/consent` — mounted globally in `client/src/App.jsx` |
