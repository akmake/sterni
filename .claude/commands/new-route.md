# New Route — Scaffold

Scaffold a new Express route following project conventions. Ask for: route name, method, path, auth required (yes/no/admin-only).

Then:

1. Create `server/routes/<name>Routes.js`:
   - Use `express.Router()`
   - Import `authMiddleware` from `server/middlewares/authMiddleware.js` if auth required
   - Export router

2. Register in `server/app.js`:
   - `const <name>Routes = require('./routes/<name>Routes');`
   - `app.use('/api/<name>', <name>Routes);`

3. If a new Mongoose model is needed, create `server/models/<Name>.js` following existing model patterns (timestamps: true, toJSON virtuals if needed).

4. Create the client page/hook if needed.

5. Run `/doc-update` after.

Auth middleware pattern:
```js
const { protect, adminOnly } = require('../middlewares/authMiddleware');
router.get('/', protect, handler);           // logged-in users
router.delete('/:id', protect, adminOnly, handler); // admin only
```
