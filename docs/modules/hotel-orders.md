# Hotel Orders Module

> Last updated: 2026-03-12

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
- **Hotel/Room data:** Zipori DB → `Hotel`, `PriceList`, `RoomType`, `ExtraType` → `/api/hotel-data/*`
- **CRITICAL:** Zipori DB requires `ZIPORI_MONGO_URI` env var. If missing → no hotels/room types shown.

## Key Files
| File | Role |
|------|------|
| `client/src/pages/HotelNewOrderPage.jsx` | Order creation, room selection, price calculation |
| `client/src/pages/HotelEditOrderPage.jsx` | Edit existing order |
| `client/src/pages/HotelQuotePage.jsx` | Quote generation/PDF |
| `client/src/pages/HotelOrderConfirmationPage.jsx` | Booking confirmation |
| `client/src/pages/HotelOrdersPage.jsx` | Orders list |
| `client/src/components/orders/AddRoomForm.jsx` | Room adding form |
| `client/src/components/orders/OrderSummaryTable.jsx` | Order summary |
| `client/src/components/orders/OrderExtrasForm.jsx` | Extras (meals, services) |
| `client/src/lib/priceCalculator.js` | Price calculation logic |
| `server/routes/hotelOrderRoutes.js` | Order CRUD routes |
| `server/routes/hotelZiporiDataRoutes.js` | Hotel data routes (zipori) |
| `server/models/HotelOrder.js` | Order schema |
| `server/models/HotelCounter.js` | Auto-increment order numbers |
| `server/models/zipori/Hotel.js` | Hotel schema (zipori) |
| `server/models/zipori/PriceList.js` | Pricing schema (zipori) |
| `server/models/zipori/RoomType.js` | Room types schema (zipori) |

## HotelOrder Schema Fields (key fields)
```
customerName, customerPhone, customerEmail
hotelId, hotelName
eventDate, numberOfNights
rooms: [{ roomType, adults, children, babies, price, price_list_names, roomSupplement }]
extras: [{ name, price, quantity }]
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

## Duplicate Detection
- On `HotelNewOrderPage`, after 3 seconds of inactivity on phone/name fields
- Searches `GET /hotel-orders/search?query=...`
- If active duplicate found → shows dialog to close existing order with optima number

## Permissions
- `user.role === 'admin'` OR `user.canViewCommissions` → shows 3% sales commission in UI

## Known Issues / Pitfalls
- If `ZIPORI_MONGO_URI` missing in production → hotel dropdowns empty → order cannot be created
- Zipori DB is read-only — never write to zipori models
