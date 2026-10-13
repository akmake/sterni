# Hotel Orders Module

> Last updated: 2026-10-13

## Overview
Hotel room booking system. Agents create orders, generate quotes, and track confirmations.

## User Flow
```
HotelOrdersPage (list)
  → HotelNewOrderPage (create)
  → HotelEditOrderPage (edit)
  → HotelQuotePage (generate quote PDF)
  → HotelOrderConfirmationPage (confirm booking)
```

## Data Sources
- **Order data:** Main DB → `HotelOrder` model → `/api/hotel-orders`
- **Hotel/Room data:** Main DB → `Hotel`, `PriceList`, `RoomType`, `ExtraType` → `/api/hotel-data/*`
- Full CRUD available on all hotel data entities (hotels, price lists, room types, extras)

## Key Files
| File | Role |
|------|------|
| `client/src/pages/HotelNewOrderPage.jsx` | Order creation, room selection, price calculation |
| `client/src/pages/HotelEditOrderPage.jsx` | Edit existing order |
| `client/src/pages/HotelQuotePage.jsx` | Quote generation/PDF |
| `client/src/pages/HotelOrderConfirmationPage.jsx` | Booking confirmation |
| `server/services/hotelOrderPdf.js` | Shared Hebrew PDF template and text-based rendering |
| `server/controllers/hotelOrderPdfController.js` | Loads saved order data for PDF generation |
| `client/src/components/orders/HotelPdfPreview.jsx` | Displays the actual generated PDF |
| `client/src/pages/HotelOrdersPage.jsx` | Orders list |
| `client/src/components/orders/AddRoomForm.jsx` | Room adding form |
| `client/src/components/orders/OrderSummaryTable.jsx` | Order summary |
| `client/src/components/orders/OrderExtrasForm.jsx` | Extras (meals, services) |
| `client/src/lib/priceCalculator.js` | Price calculation logic |
| `server/routes/hotelOrderRoutes.js` | Order CRUD routes |
| `server/routes/hotelZiporiDataRoutes.js` | Hotel data routes (zipori) |
| `server/models/HotelOrder.js` | Order schema |
| `server/models/HotelCounter.js` | Auto-increment order numbers |
| `server/models/Hotel.js` | Hotel schema (main DB) |
| `server/models/PriceList.js` | Pricing schema (main DB) |
| `server/models/RoomType.js` | Room types schema (main DB) |
| `server/models/ExtraType.js` | Extra types schema (main DB) |

## HotelOrder Schema Fields (key fields)
```
customerName, customerPhone, customerEmail
hotelId, hotelName
eventDate, numberOfNights
rooms: [{ roomTypeId, roomType, adults, teens, children, babies, price, price_list_names, roomSupplement, notes }]
extras: [{ extraType, price, quantity }]
discountPercent, total_price
status: 'בהמתנה' | 'בוצע' | 'לא רלוונטי'
optimaNumber (external booking ref)
notes
createdByName
```

## Price Calculation
- Lives in `client/src/lib/priceCalculator.js`
- Inputs: room config + price lists map + number of nights + room supplement
- Called on: room add, nights change, price list change

## Hotel PDF documents
- `GET /api/hotel-orders/public/:id/pdf?type=quote|confirmation&includePayment=true|false` follows the existing public-order access model and is rate limited.
- Downloads, email attachments and print previews all use the server renderer. No canvas, screenshots or image-based text.
- On-screen preview uses PDF.js to display the generated PDF on white pages with a selectable text layer; it does not generate the downloaded document or use the browser's dark embedded PDF viewer.
- The template is built from persisted order data; user content is escaped. Assets are embedded locally and JavaScript is disabled during rendering.
- Noto Sans Hebrew is bundled in `server/assets/fonts` with its OFL license. Chromium handles RTL layout and isolated LTR numbers, phone numbers, email addresses and amounts.
- A4 pages flow by content height. Table headings repeat and ordinary rows stay together. Confirmation download/preview includes the payment appendix; email preserves the existing behavior of omitting it.
- The hotel renderer respects `PUPPETEER_EXECUTABLE_PATH`, then tries Puppeteer's installed Chrome, then automatically discovers Chrome or Edge in standard Windows installation directories. On other platforms install Puppeteer's Chrome (`npx puppeteer browsers install chrome`) or configure `PUPPETEER_EXECUTABLE_PATH`.
- Run `node --test server/services/hotelOrderPdf.test.js` for template checks. Set `GENERATE_HOTEL_PDF_SAMPLES=1` to also write short, confirmation and long examples into `output/pdf`.

## Duplicate Detection
- On `HotelNewOrderPage`, after 3 seconds of inactivity on phone/name fields
- Searches `GET /hotel-orders/search?query=...`
- If active duplicate found → shows dialog to close existing order with optima number

## Permissions
- `user.role === 'admin'` OR `user.canViewCommissions` → shows 3% sales commission in UI

## Known Issues / Pitfalls
- Hotel data (hotels, price lists, room types, extras) now lives in the main DB — no longer depends on `ZIPORI_MONGO_URI`
- The zipori models (`server/models/zipori/`) are no longer used anywhere at runtime (only `migrateHotelData.js`) — `hotelOrderController.js` reads `PriceList`/`RoomType`/`Hotel` from the main DB, and `app.js` no longer opens the zipori connection
- `req.user` has no `name` — the controller loads it from `User` (`getUserName`) for `salespersonName`/`createdByName`/`closedByName`
- `getMyHotelOrderStats` matches on `req.user._id` (ObjectId) — aggregate does not cast strings
- Saved orders are opened from `/hotel-orders` (sidebar "הזמנות מלון"): edit / quote / confirmation per row
- Room types are fetched with `GET /api/hotel-data/room-types/by-hotel/:hotelId` (New + Edit order pages). There is no `GET /room-types/:hotelId` — calling it returns 404 and the room-type dropdown stays empty
- Price semantics: a price list value is a **package price** (not per night); only `roomSupplement` (from `RoomType.supplementPerNight`) is multiplied by `numberOfNights`. Client `lib/priceCalculator.js` and server `lib/hotelPriceCalculator.js` must stay identical
- `updateHotelOrder` recalculates from `order.rooms.map(r => r.toObject())` when only nights change — never spread Mongoose subdocs directly
- `client/src/pages/HotelDataAdminPage.jsx` is not routed and calls endpoints that don't exist (`PUT /hotels/:id`, `GET /room-types/all`) — the live admin pages are `ManageHotelsPage` / `ManagePriceListsPage` / `ManageExtrasPage`
- `total_price` is always computed by the server (rooms recalculated + extras − discount). A `total_price` sent by the client is ignored on create and update
- `roomTypeId` is stored on each room so `HotelEditOrderPage` can preselect the room type and the server can re-read the current supplement
- Status `בוצע` requires `optimaNumber` on **create and update** (server 400 otherwise). `HotelNewOrderPage` shows the Optima field when status is `בוצע`; closing sets `closedBy`/`closedByName`
- Edit page caches price lists under `['hotelPriceListsMapAll', hotelId]` (all lists, incl. hidden) — separate from the new-order page's `['hotelPriceListsMap', hotelId]` (visible only). Sharing one key served the wrong set from cache
- `/hotel-orders/search` escapes the query (literal match) — the client also `encodeURIComponent`s it
- `PriceList.maxNights` is stored but not enforced anywhere (only `fixedNights` is used, to auto-set the nights)
