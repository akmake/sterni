# Agent Instruction — Credit-Efficient Project Documentation System

Your task is to build a **documentation system optimized for minimal AI token usage**.
The goal: any future AI agent must understand this project with the **fewest possible file reads**.

Core principles:
- One canonical source per information type — never duplicate
- Summarize structure, never copy code
- Map dependencies explicitly so AI knows what changes together
- Document uncertainty rather than guess

Do not ask unnecessary questions. If something is unclear, write: `unknown — requires clarification`

---

# Phase 1 — Progressive Project Scan

**Do not scan the entire repository at once.**
Use three targeted passes.

## Pass A — Skeleton (always required)

Read only:
- Server entrypoint (`app.js`, `index.js`, `main.py`, `server.ts`, etc.)
- Client entrypoint (`App.jsx`, `main.tsx`, `router.js`, etc.)
- Dependency manifest (`package.json`, `requirements.txt`, etc.)
- Environment config (`.env`, `.env.example`, config files)
- Database connection file
- Global route registration
- State management entrypoint

**Goal:** understand how the system starts and how modules connect.

## Pass B — Critical Systems

From the skeleton, locate and read only:
- Authentication middleware and routes
- Database models/schemas directory listing (not every file — just names first)
- API route registration
- Global middleware chain

**Goal:** understand security, data shape, and request lifecycle.

## Pass C — Module Expansion

Identify the main business modules. For each module, read only what is needed to understand:
- Main user flow
- API routes
- Schema fields used
- Coupling with other modules

Stop reading when architectural understanding is sufficient. Do not scan unrelated directories.

---

# Phase 2 — File Structure to Create

```
CLAUDE.md                     ← mandatory entry point for all AI agents
docs/
  README.md                   ← documentation index
  architecture.md             ← infrastructure, env vars, ports, security
  auth-flow.md                ← full auth lifecycle
  database.md                 ← all models/schemas
  api-reference.md            ← all API routes
  state-management.md         ← all stores/context
  socket-events.md            ← real-time events (or note: none)
  contracts.md                ← project conventions AI must not rediscover
  sync-map.md                 ← change impact rules (most critical file)
  known-unknowns.md           ← open questions found during scan
  modules/
    <module-name>.md          ← one file per major business domain
```

---

# Phase 3 — File Content Specifications

## CLAUDE.md (root — mandatory entry point)

Begin with:

```
⚠️ MANDATORY: Documentation Update Protocol
```

**Rules (written as hard requirements, not suggestions):**

- **Rule 1** — Before modifying any file, read `docs/sync-map.md` to find what else must change.
- **Rule 2** — After any code change, update the canonical documentation affected. No exceptions.
- **Rule 3** — If a doc is found to be outdated, update it immediately, even if it was not part of the task.
- **Rule 4** — Every new route, model, env var, store, or module must be documented before the task is complete.
- **Rule 5** — Never duplicate canonical information across documents. Cross-reference only.

Then include:

**Quick Navigation Table**
```
| Document              | Canonical source for                        |
|-----------------------|---------------------------------------------|
| architecture.md       | env vars, ports, infrastructure             |
| auth-flow.md          | authentication, tokens, middleware, guards  |
| database.md           | schemas, models, DB connections             |
| api-reference.md      | all API routes                              |
| state-management.md   | stores, context, state shape                |
| socket-events.md      | real-time events                            |
| contracts.md          | conventions, response formats, naming       |
| sync-map.md           | which files change together                 |
| known-unknowns.md     | open questions, unclear logic               |
```

Then: stack overview, route guards, key architectural decisions (2–5 bullet points max).

---

## docs/architecture.md

Canonical source for: infrastructure, environment, security.

Every environment variable must follow this format:
```
| Name              | Description          | Used in                  | Breaks if missing                        |
|-------------------|----------------------|--------------------------|------------------------------------------|
| DATABASE_URL      | Main DB connection   | server/db/connection.js  | Server fails to start                    |
| STRIPE_SECRET_KEY | Payment provider key | server/services/payment  | All payment endpoints return 500         |
```

Also document:
- Request lifecycle (middleware order, security layers)
- All database connections (name, env var, which models use it)
- Ports and base URLs
- Background services that start on boot

---

## docs/auth-flow.md

Canonical source for: authentication, sessions, tokens, route guards.

Document:
- Login → token/session lifecycle → logout
- Where tokens are stored (cookie / localStorage / memory)
- Middleware: name, file path, what it sets on the request object
- Route guards: name, file, condition checked
- Refresh mechanism if present
- Common auth bugs and their causes (table format)

---

## docs/database.md

Canonical source for: schemas, models, DB connections.

For each model:
```
| Model     | File              | Key fields                    | Used by                          |
|-----------|-------------------|-------------------------------|----------------------------------|
| User      | models/user.js    | _id, email, role, createdAt   | auth, admin, all user-scoped ops |
```

List all DB connections. For each:
- Connection variable name
- Env var required
- Which models use it
- What breaks if disconnected

Do not paste schema code. Summarize field names and types.

---

## docs/api-reference.md

Canonical source for: all API routes.

Group by module. Format:
```
| Method | Path                          | Auth     | Description              |
|--------|-------------------------------|----------|--------------------------|
| GET    | /api/users                    | required | List users               |
| POST   | /api/users                    | admin    | Create user              |
```

Note the base URL and any global prefixes.

---

## docs/state-management.md

Canonical source for: client-side state.

For each store/context:
```
Store: authStore
File: client/src/stores/authStore.js
State shape: { user: {...} | null, isAuthenticated: boolean, activeView: string }
Key actions: login, logout, checkAuth, setActiveView
Used by: ProtectedRoute, AdminRoute, Navbar, App.jsx, [list pages]
```

---

## docs/socket-events.md

If real-time features exist:
```
| Event         | Direction       | Payload              | Purpose              |
|---------------|-----------------|----------------------|----------------------|
| message:new   | server → client | { id, text, author } | New chat message     |
```

If none exist, write: `No real-time features in this project.`

---

## docs/contracts.md

Canonical source for: conventions AI must not rediscover every session.

Document:
- API response format (success shape, error shape)
- Naming conventions (files, variables, routes)
- Folder structure conventions
- Validation patterns
- How new modules should be registered
- Any project-specific patterns that repeat across the codebase

Example entry:
```
## API Error Format
All errors return: { message: "string" }
HTTP status codes follow REST conventions.
CSRF errors return 403 with: { message: "Form has been tampered with" }
```

---

## docs/sync-map.md

**The most critical file. Must be explicit — no vague rules.**

Format for every coupling:
```
## <File or Component>

When changing: `server/models/User.js`
Also review:
- `server/controllers/authController.js` — uses User schema
- `server/routes/auth.js` — depends on User fields
- `client/src/stores/authStore.js` — mirrors user shape
- `docs/database.md` — update model table
- `docs/auth-flow.md` — if auth-related fields changed
```

Cover at minimum:
- Auth files
- Database models (each one)
- API route files
- State stores
- Environment variables → which files and features they enable
- `server/app.js` or equivalent (route registration)
- `client/src/App.jsx` or equivalent (frontend routing)

Every entry must use **exact file paths**, not vague descriptions.

---

## docs/known-unknowns.md

List uncertainties discovered during the scan.

Format:
```
| Item                          | Location                        | Status                    |
|-------------------------------|---------------------------------|---------------------------|
| JWT refresh logic             | server/routes/auth.js           | unknown — needs review    |
| ENV: PAYMENT_PROVIDER_KEY     | .env                            | purpose unclear           |
| Route /api/v1/legacy          | server/routes/legacy.js         | appears unused            |
```

This prevents every future AI session from reinvestigating the same questions.

---

## docs/modules/<module>.md

One file per major business domain.

Required sections:

```markdown
# <Module Name>

> Last updated: <date>

## Overview
What this module does. Two sentences max.

## User Flow (if applicable)
Step-by-step: entry point → actions → exit point

## Key Files
| File | Purpose |
|------|---------|

## API Routes
| Method | Path | Auth | Description |
|--------|------|------|-------------|

## Schemas Used
Key fields only. No code. Reference database.md for full schema.

## Coupling
| If you change... | Also update... |
|------------------|----------------|

## Known Issues / Pitfalls
Anything risky found during scan. Required env vars that cause silent failures. Common bugs.
```

---

# Phase 4 — Documentation Rules

**Timestamp** — Every file starts with: `> Last updated: <date>`

**Canonical source rule** — Each type of information lives in exactly one file.
Other files may reference it with: `See architecture.md → Environment Variables`
Never copy the information itself.

**Minimal context rule** — Summarize structure. Never paste large code blocks.
The goal is a map, not a copy of the codebase.

**Explicit uncertainty** — Never guess. Write `unknown — requires clarification`

---

# Agent Behavior Requirements

1. Read entrypoints and registries before scanning directories.
2. Use Pass A → B → C. Do not skip ahead.
3. Stop scanning when sufficient understanding is reached.
4. Summarize repetitive structures (e.g., 12 similar CRUD routes → one table row pattern).
5. Document relationships, not implementations.
6. When finished, verify: does sync-map.md have exact file paths for every major file touched during the scan? If not, complete it before stopping.

**Final check before completing:**
- [ ] Every env var documented in architecture.md with "breaks if missing" column
- [ ] sync-map.md has explicit file paths (no vague entries)
- [ ] contracts.md captures project conventions
- [ ] known-unknowns.md lists open questions
- [ ] CLAUDE.md mandatory rules are at the top and written as hard requirements
