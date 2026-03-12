# Finance Module

> Last updated: 2026-03-12

## Overview
Personal/family finance management. Transactions, budgets, recurring payments, analytics, deposits, and import from bank files.

## Pages & Routes
| Page | Client Route | Description |
|------|-------------|-------------|
| `FinanceDashboardPage` | `/household/finance` | Overview dashboard |
| `FinanceTransactionsPage` | `/household/finance/transactions` | All transactions |
| `FinanceBudgetPage` | `/household/finance/budget` | Budget management |
| `FinanceRecurringPage` | `/household/finance/recurring` | Recurring payments |
| `FinanceAnalyticsPage` | `/household/finance/analytics` | Charts & analytics |
| `FinanceDepositsPage` | `/household/finance/deposits` | Deposits tracking |
| `FinanceImportPage` | `/household/finance/import` | Import bank CSV/Excel |
| `FinanceCategoriesPage` | `/household/finance/categories` | Category management |
| `FinanceAutomationPage` | `/household/finance/automation` | Auto-categorization rules |

## Key Files
| File | Role |
|------|------|
| `client/src/stores/financeStore.js` | Shared finance state (tightly coupled with all pages) |
| `server/models/FinanceTransaction.js` | Transaction schema |
| `server/models/FinanceCategory.js` | Category schema |
| `server/models/FinanceCategoryRule.js` | Auto-categorization rules |
| `server/models/FinanceBudget.js` | Budget schema |
| `server/models/FinanceRecurring.js` | Recurring transaction schema |
| `server/models/FinanceDeposit.js` | Deposit schema |
| `server/models/FinanceAccount.js` | Account schema |
| `server/models/MerchantMap.js` | Merchant name → display name mapping |

## Auto-Categorization Flow (Import)
```
Upload bank file → financeImportRoutes
  → Parse transactions
  → Match merchant names via MerchantMap
  → Apply FinanceCategoryRule rules
  → Assign categories automatically
  → Save FinanceTransaction records
```

## API Routes
All under `/api/finance/`:
- `transactions` — CRUD
- `categories` — CRUD
- `budgets` — CRUD
- `recurring` — CRUD
- `deposits` — CRUD
- `analytics` — GET (aggregated data)
- `dashboard` — GET (summary)
- `import` — POST (file import)

## Coupling Warning
`financeStore.js` is used by ALL finance pages. Changing the store's state shape requires updating every `Finance*.jsx` page.
