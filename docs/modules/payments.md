# Payments Module

> Last updated: 2026-03-12

## Overview
Two separate payment systems: group payments and payment requests (invoices/quotes).

## Pages
| Page | Route | Description |
|------|-------|-------------|
| `Grouppaymentspage` | `/groups/:groupId/payments` | Payments for a specific group |
| `PaymentRequestsPage` | `/payment-requests` | List of payment requests |
| `PaymentRequestEditorPage` | `/payment-request/new` or `/payment-request/:id` | Create/edit payment request |
| `PriceQuoteGenerator` | `/price-quote` | Price quote generator component |
| `PaymentRequestGenerator` | `/groups/:groupId/payment-request` | Generate payment request for group |

## Key Files
| File | Role |
|------|------|
| `client/src/stores/Paymentstore.js` | Payment state |
| `server/models/Payment.js` | Payment schema |
| `server/models/PaymentRequest.js` | Payment request/invoice schema |
| `server/models/Quote.js` | Quote schema |
| `server/routes/Paymentroutes.js` | Payments CRUD |
| `server/routes/paymentRequestRoutes.js` | Payment requests CRUD |
| `server/routes/quoteRoutes.js` | Quotes CRUD |
| `client/src/components/PaymentRequestGenerator.jsx` | Generator component |
| `client/src/components/PriceQuoteGenerator.jsx` | Quote generator component |
| `client/src/components/QuoteManager.jsx` | Quote management |

## API Routes
- `GET/POST/PUT/DELETE /api/payments` — payments
- `GET/POST/PUT/DELETE /api/payment-requests` — payment requests
- `GET/POST/PUT/DELETE /api/quotes` — quotes

## Coupling
- `Grouppaymentspage` is coupled to `GroupDetailsPage` (accessed from group context)
- `PaymentRequestGenerator` is used inside group flow
