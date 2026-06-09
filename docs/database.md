# Database

> Last updated: 2026-03-12

## Connections

### Main DB
- Env var: `MONGO_URI`
- Connection: `mongoose.connect()` in `server/app.js`
- All models in `server/models/` (except zipori/)

### Zipori DB (secondary, read-mostly)
- Env var: `ZIPORI_MONGO_URI`
- Connection: `mongoose.createConnection()` in `server/db/ziporiDb.js`
- Models in `server/models/zipori/`
- **Missing this var = hotel orders page shows no data**

---

## Main DB Models

| Model | File | Used by |
|-------|------|---------|
| User | `userModel.js` | auth, admin |
| Group | `Group.js` | groups module |
| Project | `Project.js` | projects module |
| Task | `Task.js` | tasks page |
| Hall | `Hall.js` | halls page |
| Meal | `Meal.js` | kitchen module |
| Payment | `Payment.js` | payments module |
| PaymentRequest | `PaymentRequest.js` | payment requests |
| Quote | `Quote.js` | price quote generator |
| HotelOrder | `HotelOrder.js` | hotel orders module |
| HotelCounter | `HotelCounter.js` | auto-increment order numbers |
| Family | `Family.js` | household/family settings |
| ShoppingItem | `ShoppingItem.js` | shopping list |
| HouseholdTask | `HouseholdTask.js` | household tasks |
| HouseholdProject | `HouseholdProject.js` | household projects |
| FinanceTransaction | `FinanceTransaction.js` | finance module |
| FinanceCategory | `FinanceCategory.js` | finance categories |
| FinanceCategoryRule | `FinanceCategoryRule.js` | auto-categorization rules |
| FinanceBudget | `FinanceBudget.js` | finance budgets |
| FinanceRecurring | `FinanceRecurring.js` | recurring transactions |
| FinanceDeposit | `FinanceDeposit.js` | deposits tracking |
| FinanceAccount | `FinanceAccount.js` | finance accounts |
| MerchantMap | `MerchantMap.js` | merchant name mapping |
| Message | `Message.js` | chat system |
| Email | `Email.js` | email module |
| EmailAccount | `EmailAccount.js` | email accounts config |
| Log | `Log.js` | visitor tracking / intelligence (AdminLogsPage) |
| SystemConfig | `SystemConfig.js` | system settings |
| WorkOrder | `WorkOrder.js` | work orders |
| BillingProfile | `Billingprofile.js` | billing profiles |
| Contact | `Contact.js` | contacts |
| Supplier | `Supplier.js` | suppliers |
| SupplierPayment | `SupplierPayment.js` | supplier payments |

---

## Zipori DB Models (read-only from external system)

| Model | File | Description |
|-------|------|-------------|
| Hotel | `zipori/Hotel.js` | Hotel list for order creation |
| PriceList | `zipori/PriceList.js` | Room pricing lists per hotel |
| RoomType | `zipori/RoomType.js` | Room types per hotel |
| ExtraType | `zipori/ExtraType.js` | Extra items (meals, services) |

---

## Notes
- All controllers use `req.user._id` (ObjectId) for user-scoped queries — not `req.user.id` (string)
- `HotelCounter` is used for auto-incrementing order reference numbers
- `MerchantMap` + `FinanceCategoryRule` are used together for automatic transaction categorization during import
- `Log` records every visitor request when `SystemConfig.loggingEnabled` is true (TTL: auto-deleted after 90 days). Written by `loggingMiddleware.js`, displayed in `AdminLogsPage.jsx`.
  - `location.*` is enriched from IP via ip-api.com: country/city/region/zip/lat/lon/timezone **plus** ISP, org, ASN (`location.asn`/`asName`), and threat flags `location.proxy` (VPN), `location.hosting` (datacenter/bot), `location.mobileCarrier`.
  - `fingerprint` combines hardware/locale + canvas + WebGL hashes (client `deviceInfo.js`) for cross-session visitor identification.
  - `behavior.{maxScrollDepth,clicks,rageClicks,activeSeconds}` is filled later by the `POST /api/logs/behavior` beacon (client `behaviorTracker.js`), matched to the page-view log by `fingerprint` + `page`.
