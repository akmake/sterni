# Code Review

Review the selected code or the files changed in this session. Focus on:

1. **Security** — SQL/NoSQL injection, XSS, missing auth middleware, exposed secrets, open endpoints
2. **React bugs** — direct state mutation, missing keys, stale closures, missing deps in useEffect
3. **Mongoose pitfalls** — missing `await`, calling `.toString()` on populated documents (returns `[object Object]`), forgetting `{ new: true }` on findByIdAndUpdate
4. **Project conventions** — auth via `protect`/`adminOnly` middleware, CSRF token in axios via `utils/api.js`, Zustand for global state
5. **Performance** — N+1 queries, missing indexes, unnecessary re-renders

Report: list of issues with file:line, severity (critical/warn/info), and a one-line fix for each.
If nothing found, say "clean" — don't invent issues.
