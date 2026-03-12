# Docs Index

> This folder contains the living documentation for the sterni project.
> **Every AI system must keep these docs up to date. See CLAUDE.md for rules.**

## Files

| File | Contents |
|------|----------|
| `../CLAUDE.md` | **START HERE** — AI rules + project overview |
| `architecture.md` | Environment variables, server architecture, ports, two-DB setup |
| `auth-flow.md` | JWT + CSRF + cookies, middleware, route guards |
| `database.md` | All models, both DB connections |
| `api-reference.md` | All API routes |
| `state-management.md` | All Zustand stores |
| `socket-events.md` | Socket.IO events |
| `sync-map.md` | **Which files change together** — check before editing |

## Modules

| File | Module |
|------|--------|
| `modules/hotel-orders.md` | Hotel room booking system |
| `modules/finance.md` | Finance management |
| `modules/groups-kitchen.md` | Groups & kitchen/meals |
| `modules/household.md` | Household management |
| `modules/payments.md` | Payments & payment requests |
| `modules/communication.md` | Chat, WhatsApp, Email |
| `modules/admin.md` | Admin panel & logging |

## How to use these docs

1. **Before any task** — check `sync-map.md` for coupling
2. **For a specific module** — read the relevant `modules/*.md`
3. **For auth issues** — read `auth-flow.md`
4. **For missing data in production** — check `architecture.md` env vars
5. **After any change** — update the relevant doc(s)
