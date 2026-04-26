# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What This Is

A hockey tryout evaluation app for managing multi-day tryout events with organizations, admins/coordinators/scorers, age groups, rosters, session blocks, check-in, scoring, rankings, and event-scoped import/export workflows. It is a Docker-based monorepo with a React/Vite frontend, Express API, and PostgreSQL 16 database.

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

**Run backend tests:**
```bash
cd backend
DB_HOST=localhost DB_USER=postgres DB_PASS=postgres DB_NAME=tryoutapp \
  JWT_SECRET=test-secret-minimum-32-chars-xxxxxxxxxxx npm test
```

Tests live in `backend/tests/` and require a live Postgres DB. Jest maps `bcrypt` to `bcryptjs` in `backend/package.json` so tests run on macOS without a Docker-compiled native module.

**Run the tenancy audit:**
```bash
cd backend && npm run audit-tenancy
```

## Database Credentials

The Docker Postgres service uses the values from `.env`. Local defaults are still expected to be `POSTGRES_USER=postgres`, `POSTGRES_DB=tryoutapp`, and the matching `POSTGRES_PASSWORD`. When connecting with `docker exec`, use `-U postgres -d tryoutapp`.

## Migrations

Applied in order. Fresh installs pick up the full current schema via `postgres/init.sql`.

| File | What it does |
|---|---|
| `001_production_readiness.sql` | audit_log, attendance_status, scoring_complete/finalized session statuses |
| `002_player_shot_and_import_fields.sql` | shot, date_of_birth, external_id, gender on players |
| `003_drop_jersey_unique_constraint.sql` | drops jersey uniqueness; adds non-unique jersey lookup index |
| `004_robustness.sql` | CHECK constraints, NOT NULL hardening, indexes, updated_at triggers, audit JSONB index |
| `005_registration_model.sql` | adds `player_event_registrations`; dual-writes roster/score registration references |
| `006_import_batch_tracking.sql` | adds `import_batches` and `import_batch_rows` for upload preview/commit |
| `007_multi_tenant_foundation.sql` | adds `organizations`, org-scoped uniqueness, org IDs, RLS safety net |
| `008_org_branding.sql` | adds organization accent color |

## Default Credentials

- App URL: `http://localhost:3000`
- Admin login: `admin@tryouts.local` / `Admin1234!`
- Mailhog UI: `http://localhost:8025`

## Architecture

```text
frontend/ (React 18 + Vite, port 3000)
backend/  (Node.js + Express, port 4000)
postgres/ (init SQL + migrations, PostgreSQL 16, port 5432)
scripts/  (repo-level utilities, including tenancy audit)
```

### Backend Structure

- `backend/index.js` — Express entry point; validates env, registers security middleware, mounts routers, starts scheduler.
- `backend/db/pool.js` — shared PostgreSQL pool. Do not create new pools in route files.
- `backend/middleware/auth.js` — JWT cookie validation, role guards, and assigned-session access guard.
- `backend/middleware/org.js` — derives `req.org_id` from `req.user.organization_id` and sets `app.current_org` for RLS.
- `backend/middleware/security.js` — CORS, Helmet, request IDs, auth/API/import rate limiters.
- `backend/middleware/upload.js` — CSV/XLSX upload validation for import endpoints.
- `backend/routes/` — route files for `auth`, `sessions`, `session-blocks`, `session-players`, `scores`, `admin`, `import`, `import-legacy`, `export`, and `evaluation-templates`.
- `backend/utils/registrations.js` — persistent player identity and event registration helpers.
- `backend/utils/session-assignment.js` — roster assignment logic across session blocks.
- `backend/utils/parse-upload.js` and `export-formatters.js` — import/export support.
- `backend/scheduler.js` — auto-activates sessions 10 minutes before start time.

### Frontend Structure

- `frontend/src/App.jsx` — top-level routes: `/login`, `/score`, `/admin/*`.
- `frontend/src/hooks/useAuth.jsx` — auth context for cookie session, current user, login/logout, auth error handling.
- `frontend/src/utils/api.js` — centralized API client. Components and hooks should not call `fetch` directly except for file download/upload helpers already modeled here.
- `frontend/src/pages/Score.jsx` — scorer-facing session picker and evaluation screen.
- `frontend/src/pages/Admin.jsx` — URL-based admin shell and view switcher.
- `frontend/src/features/admin/views/` — admin views: Overview, Events, Sessions, Groups, Check-In, Results, Rankings, Rosters, Import/Export, Coaches.
- `frontend/src/features/workspace/` — event + age-group workspace at `/admin/events/:eventId/age-groups/:ageGroupId` with Check-In, Rosters, Evaluations, and Results tabs.
- `frontend/src/features/admin/shared.jsx` — nav items, status metadata, date formatting, sidebar, and default session block form state.
- `frontend/src/features/admin/styles.js` — shared inline style objects and CSS used by admin/workspace views.

## Auth, Roles, And Tenant Context

JWT auth uses a 12-hour `auth_token` HttpOnly cookie. `Authorization: Bearer` is still accepted by middleware for API tooling and tests. Frontend requests include `credentials: 'include'`.

Login accepts `{ email, password, subdomain? }`. `subdomain` is optional for the current single-org phase, but the JWT always includes `organization_id`; all non-auth API routers are mounted after `authMiddleware` and `orgMiddleware`.

Roles:
- `scorer` — can view and submit scores for assigned sessions only.
- `coordinator` — scorer plus limited admin access; cannot access admin-only setup views or finalize sessions as admin.
- `admin` — full access.

Backend route protection pattern:
- Mount API routers in `index.js` behind `authMiddleware, orgMiddleware` unless they are `/api/auth` or `/health`.
- Inside routers, use `requireRole('admin')`, `requireRole('admin', 'coordinator')`, or `requireAssignedSessionAccess()`.
- Every tenant-owned query must filter by `req.org_id` directly or join through an org-scoped parent such as `tryout_events`.

## Key Data Model

- `organizations` own users, events, age groups, sessions, players, templates, and audit logs.
- `tryout_events` → `age_groups` → `player_event_registrations`.
- `players` are persistent org-level identities; event-specific jersey, position, shot, will_tryout, and outcome live on `player_event_registrations`.
- `sessions` belong to an event, age group, and usually a `session_block`.
- `session_players` connects sessions to players and can carry `registration_id`, check-in state, attendance status, and team assignment.
- `session_scorers` assigns evaluators to sessions.
- `scores` still stores legacy aggregate criteria (`skating`, `puck_skills`, `hockey_sense`, `notes`) and can reference `registration_id`.
- `score_entries` exists for per-criterion scoring, but export aggregation still uses the legacy aggregate score columns.
- `import_batches` and `import_batch_rows` persist event-scoped upload preview, validation, errors, and commit data.

Session status flow: `pending` → `active` → `complete` → `scoring_complete` → `finalized`.

Coordinators can set most statuses, but only admins can finalize. Finalized sessions lock scoring and player moves except where explicitly overridden by admin routes.

## Import And Export

There are two import systems:
- Legacy CSV text import at `/api/import/preview`, `/api/import/commit`, and `/api/import/csv-template`; still used by `WorkspacePage` and `GroupsView`.
- Current event-scoped import at `/api/events/:eventId/import/...`; accepts CSV/XLSX multipart uploads, writes `import_batches`, previews persisted row data, then commits the batch atomically.

Supported current import types are `players`, `evaluators`, and `session_assignments`.

Event-scoped exports live under `/api/events/:eventId/export/...`:
- `team-recommendations`
- `sportsengine`
- `preview`

Export endpoints are read-only except audit logging and can filter by age group, finalized-only, and outcome.

## Frontend Routing Pattern

`/admin/*` is handled by `Admin.jsx`, not by one route per admin view in `App.jsx`. `getAdminRoute()` in `Admin.jsx` maps URL patterns to view IDs.

Important admin URLs:
- `/admin/overview`
- `/admin/events`
- `/admin/events/:eventId/age-groups/:ageGroupId?tab=checkin|rosters|evaluations|results`
- `/admin/sessions` and `/admin/sessions/:groupCode`
- `/admin/groups` and `/admin/groups/:groupCode`
- `/admin/checkin`
- `/admin/results` and `/admin/results/:groupCode/rankings`
- `/admin/rosters` and `/admin/rosters/:groupCode`
- `/admin/import-export`
- `/admin/coaches`

Adding an admin view usually means updating `Admin.jsx` route matching/rendering and adding a nav entry in `features/admin/shared.jsx`. `App.jsx` only needs changes for new top-level route families outside `/admin/*`.

## Backend Conventions

- Use the shared `pool` from `backend/db/pool.js`.
- Use parameterized SQL only.
- Multi-step writes use `pool.connect()` with explicit `BEGIN`/`COMMIT`/`ROLLBACK`.
- Helpers participating in a transaction accept a `client` argument.
- Return object-shaped JSON such as `{ sessions: [] }`, `{ player: {} }`, `{ error: '...' }`.
- Keep route-level `try/catch` blocks and log useful context without leaking secrets.
- `syncEventDates()` in `routes/sessions.js` keeps event start/end dates aligned with sessions.
- Audit logging lives in `backend/utils/audit.js`; never log passwords, tokens, cookies, or secrets.
- Import upload limits are tighter than general API limits; keep upload endpoints on `importUploadLimiter`.

## Frontend Conventions

- All normal API calls go through `frontend/src/utils/api.js`.
- Use `useAuth()` as the source of truth for the current user; never read JWTs from localStorage.
- Admin/workspace data loaders generally keep page state local and call API helpers directly.
- `Score.jsx` polls assigned sessions so pending/active changes show up automatically.
- `useWorkspaceData()` refreshes event/age-group workspace data every 15 seconds.
- Keep coordinator/admin visibility in sync across `Admin.jsx` view guards and `NAV_ITEMS` role metadata.
- The frontend uses inline style objects in `features/admin/styles.js`; match existing patterns before introducing new styling approaches.

## Player Split Methods

`backend/utils/session-assignment.js` supports these session block split methods:
- `last_name` — alphabetic ranges based on player last initial.
- `jersey_range` — numeric jersey ranges from event registration jersey numbers.
- `none` — assign all eligible players to matching skills sessions.
- `manual` — no automatic assignment.

Game blocks are handled specially: players/team assignments from the block are copied into every game session in that block.
