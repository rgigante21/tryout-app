# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A hockey tryout evaluation app for managing multi-day tryout events with scorers, players, age groups, and session-based evaluations. Built as a Docker monorepo.

## Development Commands

**Start everything (recommended):**
```bash
docker compose up --build
```

**Wipe DB and start fresh:**
```bash
docker compose down -v && docker compose up --build
```

**Frontend standalone (port 3000):**
```bash
cd frontend && npm run dev
```

**Backend standalone (port 4000):**
```bash
cd backend && npm run dev   # uses nodemon
```

**View backend logs:**
```bash
docker compose logs backend -f
```

**Connect to database:**
```bash
docker exec -it tryout_db psql -U postgres -d tryoutapp
```

**Apply a migration to a running DB:**
```bash
docker exec -i tryout_db psql -U postgres -d tryoutapp \
  < postgres/migrations/<file>.sql
```

**Run the API security test suite:**
```bash
DB_HOST=localhost DB_USER=postgres DB_PASS=postgres DB_NAME=tryoutapp \
  JWT_SECRET=test-secret-minimum-32-chars-xxxxxxxxxxx npm test
```
Tests live in `backend/tests/` and require a live Postgres DB. Use `moduleNameMapper` in Jest config to alias `bcrypt` → `bcryptjs` (pure JS) so tests run on macOS without the Docker-compiled Linux native binary.

**Run the static multi-tenant query audit:**
```bash
node scripts/audit-tenancy.js
# or from backend/: npm run audit-tenancy
```
Scans all route/middleware/util files and flags any query on a Class 1 table that lacks `organization_id` scoping. Exits non-zero in CI. Add `/* tenant-global: reason */` to suppress intentional global queries (e.g. scheduler).

## Database Credentials

The Postgres superuser is `postgres` (no separate `tryout` role). Database name is `tryoutapp`. Always use `-U postgres -d tryoutapp` when connecting via `docker exec`.

## Migrations

Applied in order. Fresh installs pick up everything via `postgres/init.sql` automatically.

| File | Status | What it does |
|---|---|---|
| `001_production_readiness.sql` | ✅ Applied | audit_log, attendance_status, scoring_complete/finalized session statuses |
| `002_player_shot_and_import_fields.sql` | ✅ Applied | shot, date_of_birth, external_id, gender on players; partial unique index on external_id |
| `003_drop_jersey_unique_constraint.sql` | ✅ Applied | Drops jersey uniqueness constraint; adds non-unique index |
| `004_session_blocks.sql` | ✅ Applied | session_blocks table, block_type/split_method/session_type columns |
| `005_evaluation_templates.sql` | ✅ Applied | evaluation_templates + evaluation_criteria tables |
| `006_import_batches.sql` | ✅ Applied | import_batches + import_batch_rows tables |
| `007_multi_tenant_foundation.sql` | ⏳ Pending | organizations table; organization_id on all Class 1 tables; RLS policies; consistency triggers; composite indexes |

## Default Credentials

- URL: `http://localhost:3000`
- Admin login: `admin@tryouts.local` / `Admin1234!`
- Mailhog UI (catches all outgoing email): `http://localhost:8025`

## Architecture

```
frontend/ (React 18 + Vite, port 3000)
backend/  (Node.js + Express, port 4000)
postgres/ (init SQL scripts, PostgreSQL 16, port 5432)
```

### Backend Structure (`backend/`)

- `index.js` — Express entry point; mounts all routers
- `db/pool.js` — shared PostgreSQL connection pool
- `middleware/auth.js` — JWT validation (`authMiddleware`) and role guard (`requireRole`)
- `scheduler.js` — cron job that auto-activates sessions 10 min before start time
- `routes/` — one file per domain: `auth`, `sessions`, `scores`, `admin`, `session-blocks`, `import`, `evaluation-templates`
- `utils/session-assignment.js` — player distribution logic across sessions

### Frontend Structure (`frontend/src/`)

- `App.jsx` — React Router root; defines 3 top-level routes: `/login`, `/score`, `/admin`
- `hooks/useAuth.jsx` — auth context: login/logout, HTTP-only cookie session, current user
- `utils/api.js` — single centralized API client; all backend calls go through here
- `components/ProtectedRoute.jsx` — role-based route guard
- `pages/Score.jsx` — scorer view: pick session → evaluate players (skating, puck_skills, hockey_sense on 1–5 scale)
- `pages/Admin.jsx` — admin dashboard; switches between sub-views based on URL segment
- `features/admin/views/` — 7 admin sub-views: Overview, Events, Sessions, GroupIndex, GroupDetail, Coaches, Results/Rankings
- `features/admin/shared.jsx` — shared UI utilities (formatting, status metadata, nav items)
- `features/admin/styles.js` — shared styled component definitions

### Auth & Roles

JWT-based (12h expiration), stored in an HTTP-only cookie (not localStorage). Frontend sends `credentials: 'include'` on all API calls so cookies travel automatically. On mount, `useAuth` calls `GET /api/auth/me` to verify the session. Self-service registration is disabled (`POST /api/auth/register` → 404); all users are created admin-only via `POST /api/admin/users`.

Three roles with escalating access:
- `scorer` — can only view and submit scores for assigned sessions
- `coordinator` — scorer + limited admin access
- `admin` — full access

### Key Data Model Relationships

- `tryout_events` → `age_groups` → `players`
- `sessions` → `session_players` (roster) + `session_scorers` (assigned scorers)
- `sessions` belong to a `session_block` which organizes sessions by split strategy (last_name, jersey_range, etc.)
- `scores` — upserted on `(session_id, player_id, scorer_id)` via `ON CONFLICT DO UPDATE`
- Session status flow: `pending` → `active` (scheduler, 10 min before start) → `complete` → `scoring_complete` → `finalized`
  - Coordinators can set `scoring_complete`; only admins can set `finalized`
  - Once `finalized`, scores and player moves in that session are locked (admin-only override)

### CSV Import

Two-phase: `POST /api/import/preview` returns what would be imported, then `POST /api/import/commit` executes it atomically.

### Frontend Routing Pattern

Admin uses URL-based routing — the `/admin` page reads the URL segment to pick which sub-view to render. Adding a new admin view means: create a view in `features/admin/views/`, add a route in `App.jsx`, and add a nav entry in `features/admin/shared.jsx`.

### Backend Conventions

- **Transactions**: multi-step DB writes use `pool.connect()` with explicit `BEGIN`/`COMMIT`/`ROLLBACK`. Functions that participate in a transaction accept a `client` argument instead of using `pool` directly.
- **`syncEventDates()`**: called automatically when sessions are created/modified to keep `tryout_events.start_date/end_date` in sync with their sessions.
- **Rate limiting** (`backend/middleware/security.js`): auth routes (`/api/auth/*`) — 30 req/15 min; all other API routes — 300 req/60 sec; both per IP.
- **Audit logging** (`backend/utils/audit.js`): never log passwords, tokens, or secrets; audit failures don't crash the request. Tracked events: `login_success`, `login_failure`, `logout`, `session_status_changed`, `score_submitted`.

### Frontend Conventions

- **Vite proxy**: `/api` proxies to `VITE_API_TARGET` (default `http://localhost:4000`). Docker Compose overrides this to `http://backend:4000` for container-to-container networking.
- **Score page polling**: `Score.jsx` re-fetches the sessions list every 30s so `pending → active` flips automatically. Score drafts are held in a per-player map that survives tab switches within a session.

### Player Split Methods (`backend/utils/session-assignment.js`)

Four strategies: `last_name` (A-Z alphabetic ranges), `jersey_range` (numeric min-max), `none` (all players to all sessions), `manual` (no auto-assign). Game blocks always assign all players to every session in the block regardless of split method.
