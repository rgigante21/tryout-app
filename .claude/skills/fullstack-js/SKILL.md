---
name: fullstack-js
description: >
  Expert skill for full-stack JavaScript development with Node.js/Express backends, React frontends, and PostgreSQL databases. Use this skill whenever working on: Express routes or middleware, JWT authentication, pg Pool queries, REST API design, React hooks or context, React Router patterns, centralized API clients, role-based access control, or any feature that spans the frontend/backend boundary. Trigger broadly — if the task involves adding an endpoint, wiring up a new page, debugging an API call, writing a SQL query, or modifying auth logic, invoke this skill immediately. Don't wait for the user to say "full stack" explicitly.
---

This skill encodes the architecture, conventions, and idioms used in this codebase's full-stack JavaScript setup: Express (CommonJS) on the backend, React 18 + Vite (ESM) on the frontend, PostgreSQL via `pg` Pool, and JWT auth via HttpOnly cookies.

When working on any feature, read the relevant existing files first — the patterns are consistent and extending them is always better than inventing something new.

---

## Backend: Express Conventions

### Entry Point (`backend/index.js`)

The app follows a strict startup contract:
1. Validate required env vars and exit if any are missing — never let the app start in a broken state.
2. Register security middleware first (helmet, CORS, rate limiter, request ID).
3. Mount route files under `/api/<domain>` — one file per domain.
4. Add a 404 handler and a centralized error handler last.

The centralized error handler signature must include 4 args (`err, req, res, _next`) or Express won't treat it as an error handler. In production, never expose `err.message` in the response body.

### Route Files (`backend/routes/`)

Each route file is a self-contained Express Router. The pattern:

```js
const router = require('express').Router();
const pool   = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM my_table WHERE active = $1', [true]);
    res.json({ items: rows });
  } catch (err) {
    console.error('route error:', err);
    res.status(500).json({ error: 'Failed to load items' });
  }
});

module.exports = router;
```

Key rules:
- Always use `async/await` with try/catch — never let an unhandled promise rejection reach the global handler.
- Always use parameterized queries (`$1`, `$2`, ...) — never string-interpolate user input into SQL.
- Return consistent shapes: `{ items: [] }`, `{ item: {} }`, `{ error: '...' }` — not bare arrays or mixed structures.
- Mount the router in `index.js` after writing it.

### Database (`backend/db/pool.js`)

A single shared Pool is exported. Never create new Pool instances in route files — import the shared one.

```js
const pool = require('../db/pool');

// Single row
const { rows: [user] } = await pool.query(
  'SELECT * FROM users WHERE id = $1', [id]
);
if (!user) return res.status(404).json({ error: 'Not found' });

// Multiple rows
const { rows } = await pool.query('SELECT * FROM sessions ORDER BY start_time');

// Transactions
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO ...', [...]);
  await client.query('UPDATE ...', [...]);
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### Auth Middleware (`backend/middleware/auth.js`)

Four exports — use the right one for the job:

| Export | When to use |
|--------|-------------|
| `authMiddleware` | Any route that requires a logged-in user |
| `requireRole('admin', 'coordinator')` | Role-restricted routes |
| `requireAdminOrCoordinator` | Shorthand for the above |
| `requireAssignedSessionAccess()` | Scorers can only access their own sessions |

Typical route protection pattern:
```js
router.patch('/:id/finalize', authMiddleware, requireAdminOrCoordinator, async (req, res) => { ... });
router.get('/:id/players',    authMiddleware, requireAssignedSessionAccess('id'), async (req, res) => { ... });
```

Auth lives in HttpOnly cookies. The middleware checks `req.cookies.auth_token` first, then falls back to `Authorization: Bearer` for API tooling. Don't replicate this logic — let the middleware handle it.

### JWT Payload Shape

When you need to know what's on `req.user`:
```js
{
  id:    number,   // users.id
  email: string,
  role:  'admin' | 'coordinator' | 'scorer',
  iat:   number,
  exp:   number
}
```

---

## Frontend: React Conventions

### API Client (`frontend/src/utils/api.js`)

All backend calls go through the centralized `api` object — never call `fetch` directly in components or hooks. Adding a new endpoint means adding a method here:

```js
export const api = {
  // existing methods...
  myNewThing: (id)       => request('GET',    `/my-things/${id}`),
  createThing: (data)    => request('POST',   '/my-things', data),
  updateThing: (id, data) => request('PATCH', `/my-things/${id}`, data),
  deleteThing: (id)      => request('DELETE', `/my-things/${id}`),
};
```

The `request` wrapper already handles: JSON serialization, cookie credentials, error extraction (throws with `err.status` and `err.message`), and non-2xx responses.

### Auth Context (`frontend/src/hooks/useAuth.jsx`)

Use the `useAuth()` hook in components to access the current user and auth actions:

```jsx
const { user, login, logout } = useAuth();
// user: { id, email, role } | null
```

Never read JWT from localStorage manually — the cookie is HttpOnly and the context is the source of truth.

### Admin Routing Pattern

The admin section uses URL-segment-based sub-view switching. Adding a new admin view requires three steps:

1. **Create the view** in `frontend/src/features/admin/views/MyView.jsx`
2. **Add a route** in `App.jsx`:
   ```jsx
   <Route path="/admin/my-view" element={<ProtectedRoute role="admin"><MyView /></ProtectedRoute>} />
   ```
3. **Add a nav entry** in `frontend/src/features/admin/shared.jsx` in the `NAV_ITEMS` array

Miss any of these three and the view either won't load or won't appear in the nav.

### Component Patterns

```jsx
import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function MyView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.myNewThing()
      .then(data => setItems(data.items))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error)   return <p>Error: {error}</p>;

  return ( /* render items */ );
}
```

---

## REST API Design Conventions

This codebase follows consistent REST patterns — new endpoints should match:

| Operation | Method | Path example |
|-----------|--------|--------------|
| List | GET | `/api/sessions` |
| Get one | GET | `/api/sessions/:id` |
| Create | POST | `/api/sessions` |
| Update (partial) | PATCH | `/api/sessions/:id` |
| Delete | DELETE | `/api/sessions/:id` |
| Sub-resource action | POST | `/api/sessions/:id/finalize` |

**Two-phase commit** (used for CSV import): `POST /preview` returns what would happen without side effects; `POST /commit` executes it atomically. Use this pattern for any destructive bulk operation.

**Query parameters** for list filtering: `?age_group_id=1&event_id=2&date=2026-04-01`

---

## Roles and Access Control

Three roles with escalating access:
- `scorer` — can view and submit scores for assigned sessions only
- `coordinator` — scorer + limited admin (read-heavy)
- `admin` — full access

The session assignment check (`requireAssignedSessionAccess`) is resource-level, not just role-level — a scorer with the right role but wrong session still gets a 403. Always apply this middleware to session-specific endpoints that scorers might call.

---

## Common Pitfalls

**Forgetting to mount a new router in `index.js`** — the file exists but 404s everywhere. Always check the mount after creating a route file.

**Returning bare arrays from the API** — breaks the client's destructuring assumptions. Always wrap: `res.json({ sessions: rows })`, not `res.json(rows)`.

**Missing `credentials: 'include'` on fetch** — the auth cookie won't be sent. The centralized `api.js` handles this, but direct `fetch` calls won't.

**SQL without parameterization** — even "safe" values like IDs from `req.params` should be parameterized. Parse integers with `parseInt()` and validate before querying.

**Unhandled promise rejections in routes** — always wrap async route handlers in try/catch. Express 4 does not auto-catch async errors without a wrapper or the `express-async-errors` package.

---

## References

- `references/schema.md` — Database schema overview (tables, relationships, key columns)
- `references/env.md` — Environment variables required and their purpose
