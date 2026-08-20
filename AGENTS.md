# AGENTS.md

Canonical agent guidance for this repository. `CLAUDE.md` points here; keep this file the single source of truth and edit it in one place.

## What This Is

**Rosterline** — a hockey tryout evaluation app for multi-day tryout events: organizations, admins/coordinators/scorers, age groups, rosters, session blocks, check-in, scoring, rankings, and event-scoped import/export. Docker monorepo: React/Vite frontend, Express API, PostgreSQL 16.

Domain language and entity semantics live in `CONTEXT.md`. Read it before changing anything that touches domain vocabulary (event vs. season team, registration vs. player, session status meanings).

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
cd backend && npm run dev   # nodemon
```

**View backend logs:**
```bash
docker compose logs backend -f
```

**Connect to the database:**
```bash
docker exec -it tryout_db psql -U postgres -d tryoutapp
```

**Apply a migration to a running DB:**
```bash
docker exec -i tryout_db psql -U postgres -d tryoutapp \
  < postgres/migrations/<file>.sql
```

**Run backend tests** (there is no root `npm test` — the root `package.json` has no scripts):
```bash
cd backend
DB_HOST=localhost DB_USER=postgres DB_PASS=postgres DB_NAME=tryoutapp \
  JWT_SECRET=test-secret-minimum-32-chars-xxxxxxxxxxx npm test
```
Tests live in `backend/tests/` and need a live Postgres. Jest maps `bcrypt` → `bcryptjs` in `backend/package.json` so they run on macOS without the Docker-compiled native module.

**Run the tenancy audit:**
```bash
cd backend && npm run audit-tenancy   # or: node scripts/audit-tenancy.js
```
Flags any query on a Class 1 (tenant-owned) table that lacks `organization_id` scoping. Exits non-zero in CI. Suppress an intentional global query with `/* tenant-global: reason */` — e.g. the scheduler.

## Database Credentials

Docker Postgres reads `.env`. Local defaults: `POSTGRES_USER=postgres`, `POSTGRES_DB=tryoutapp`, matching `POSTGRES_PASSWORD`. There is no separate `tryout` role — always `-U postgres -d tryoutapp`.

## Migrations

`postgres/migrations/` holds the applied migrations in numeric order; read the directory for the current list.

Two rules:

1. **Every new migration must also be folded into `postgres/init.sql`.** That file is maintained as the fully-migrated state, and it is the only thing a fresh install runs. Skip this and `docker compose down -v` produces a DB the app cannot run against.
2. **Do not add a fourth `009`.** Three exist; they touch disjoint tables, so their relative order does not matter. A fourth invites real ordering ambiguity.

New org feature flags go in the `organizations.features` JSONB column, not new columns — see `docs/adr/0001-org-feature-flags-jsonb.md`.

## Default Credentials

- App URL: `http://localhost:3000`
- Admin login: `admin@tryouts.local` / `Admin1234!`
- Organization login code: `weymouth` — **required** by `POST /api/auth/login`; the sign-in page resolves it from `/login/:loginCode`
- Mailhog UI (catches all outgoing mail): `http://localhost:8025`

## Architecture

```text
frontend/ (React 18 + Vite, port 3000)
backend/  (Node.js + Express, port 4000)
postgres/ (init.sql + migrations, PostgreSQL 16, port 5432)
scripts/  (repo-level utilities, including the tenancy audit)
```

### Backend Structure

- `backend/index.js` — entry point; validates env, registers security middleware, mounts routers, starts scheduler.
- `backend/db/pool.js` — shared PostgreSQL pool. Do not create new pools in route files.
- `backend/middleware/auth.js` — JWT cookie validation, role guards, assigned-session access guard.
- `backend/middleware/org.js` — derives **`req.org_id`** from `req.user.organization_id` and sets `app.current_org` for RLS.
- `backend/middleware/security.js` — CORS, Helmet, request IDs, and three rate limiters (auth, general API, import upload).
- `backend/middleware/upload.js` — CSV/XLSX upload validation for import endpoints.
- `backend/routes/` — `auth`, `sessions`, `session-blocks`, `session-players`, `scores`, `admin`, `import` (event-scoped), `import-legacy`, `export`, `evaluation-templates`.
- `backend/utils/registrations.js` — persistent player identity and event registration helpers.
- `backend/utils/session-assignment.js` — roster assignment across session blocks.
- `backend/utils/seed-org.js` — seeds a new organization.
- `backend/utils/parse-upload.js`, `export-formatters.js` — import/export support.
- `backend/utils/ids.js` — `parsePositiveInt()`; use it to validate route ID params.
- `backend/scheduler.js` — auto-activates sessions 10 minutes before start time.

### Frontend Structure

- `frontend/src/App.jsx` — top-level routes only: `/login`, `/login/:loginCode`, `/score`, `/admin/*`.
- `frontend/src/hooks/useAuth.jsx` — auth context: cookie session, current user, login/logout, auth error handling.
- `frontend/src/utils/api.js` — centralized API client. Components and hooks do not call `fetch` directly, except via the download/upload helpers already modeled here.
- `frontend/src/pages/Score.jsx` — scorer session picker and evaluation screen.
- `frontend/src/pages/Admin.jsx` — URL-based admin shell and view switcher.
- `frontend/src/features/admin/views/` — Overview, Events, Sessions, Groups, Check-In, Results, Rankings, Rosters, Import/Export, Coaches.
- `frontend/src/features/workspace/` — event + age-group workspace at `/admin/events/:eventId/age-groups/:ageGroupId`, with Check-In, Rosters, Evaluations, Results tabs.
- `frontend/src/features/admin/shared.jsx` — `NAV_ITEMS`, status metadata, date formatting, sidebar, default session block form state.
- `frontend/src/features/admin/styles.js` — exports `ADMIN_CSS` (a CSS template string) plus inline style objects. Not styled-components.

## Auth, Roles, And Tenant Context

JWT auth uses a 12-hour `auth_token` HttpOnly cookie — never localStorage. `Authorization: Bearer` is also accepted by middleware, for API tooling and tests. Frontend requests send `credentials: 'include'`. On mount, `useAuth` calls `GET /api/auth/me` to verify the session.

`POST /api/auth/login` takes `{ email, password, loginCode }`; all three are required, and it 400s without `loginCode`. The JWT always carries `organization_id`. Self-service registration is disabled (`POST /api/auth/register` → 404) — users are created admin-only via `POST /api/admin/users`.

Roles:
- `scorer` — view and submit scores for assigned sessions only.
- `coordinator` — scorer plus limited admin access; no admin-only setup views, cannot finalize.
- `admin` — full access.

Admin-only nav: **Tryout Setup**, **Age Groups**, **Import / Export**, **Coaches**. Coordinators see Today, Sessions, Check-In, Results, Rosters. Role gating lives on each `NAV_ITEMS` entry in `features/admin/shared.jsx` and must stay in sync with the `Admin.jsx` view guards.

Backend route protection pattern:
- Mount API routers in `index.js` behind `authMiddleware, orgMiddleware` unless they are `/api/auth` or `/health`.
- Inside routers use `requireRole('admin')`, `requireRole('admin', 'coordinator')`, or `requireAssignedSessionAccess()`.
- Every tenant-owned query filters on `req.org_id` directly, or joins through an org-scoped parent such as `tryout_events`. App-layer `WHERE organization_id = $1` is the primary gate; Postgres RLS is the safety net. See `docs/adr/0002-organization-scoped-authentication.md`.

## Key Data Model

- `organizations` own users, events, age groups, sessions, players, templates, and audit logs. Branding: `accent_color`; feature flags: `features` JSONB.
- `tryout_events` → `age_groups` → `player_event_registrations`.
- `players` are persistent org-level identities. Event-specific jersey, position, shot, `will_tryout`, and outcome live on `player_event_registrations`.
- `sessions` belong to an event, an age group, and usually a `session_block`.
- `session_players` links sessions to players; carries `registration_id`, check-in state, attendance status, team assignment.
- `session_scorers` assigns evaluators to sessions.
- `scores` stores legacy aggregate criteria (`skating`, `puck_skills`, `hockey_sense`, `notes`) and may reference `registration_id`. Upserted on `(session_id, player_id, scorer_id)` via `ON CONFLICT DO UPDATE`.
- `score_entries` exists for per-criterion scoring, but export aggregation still reads the legacy aggregate columns.
- `import_batches` / `import_batch_rows` persist event-scoped upload preview, validation, errors, and commit data.

Session status flow: `pending` → `active` (scheduler, 10 min before start) → `complete` → `scoring_complete` → `finalized`. Coordinators can set most statuses; only admins finalize. Finalized sessions lock scoring and player moves except where an admin route explicitly overrides.

## Import And Export

Two import systems coexist:

- **Event-scoped (current)** — `backend/routes/import.js`, mounted at `/api/events`, so paths are `/api/events/:eventId/import/...`. Accepts CSV/XLSX multipart uploads, writes `import_batches`, previews the persisted rows, then commits the batch atomically. Supported types: `players`, `evaluators`, `session_assignments`.
- **Legacy CSV text (still live)** — `backend/routes/import-legacy.js`, mounted at `/api/import`: `/preview`, `/commit`, `/csv-template`. Still called by `WorkspacePage.jsx`, `Admin.jsx`, and `GroupsView.jsx` via `api.importPreview` / `api.importCommit`.

Do not conflate the two: `/api/import/*` is the legacy path, not the event-scoped one.

Event-scoped exports live under `/api/events/:eventId/export/...` — `team-recommendations`, `sportsengine`, `preview`. Read-only apart from audit logging; can filter by age group, finalized-only, and outcome.

## Frontend Routing Pattern

`/admin/*` is handled entirely by `Admin.jsx` — there is no route per admin view in `App.jsx`. `getAdminRoute()` in `Admin.jsx` maps URL patterns to view IDs.

Admin URLs:
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

Adding an admin view means updating route matching and rendering in `Admin.jsx` plus a `NAV_ITEMS` entry in `features/admin/shared.jsx`. `App.jsx` changes only for a new top-level route family outside `/admin/*`.

## Backend Conventions

- Use the shared `pool` from `backend/db/pool.js`.
- Parameterized SQL only.
- Multi-step writes use `pool.connect()` with explicit `BEGIN`/`COMMIT`/`ROLLBACK`. Helpers that participate in a transaction take a `client` argument instead of reaching for `pool`.
- Return object-shaped JSON: `{ sessions: [] }`, `{ player: {} }`, `{ error: '...' }`.
- Keep route-level `try/catch`; log useful context, never secrets.
- `syncEventDates()` in `routes/sessions.js` runs on session create/modify to keep `tryout_events.start_date/end_date` aligned with their sessions.
- Audit logging: `backend/utils/audit.js` — read it for the current event list. Never log passwords, tokens, cookies, or secrets; audit failure must not fail the request.
- Rate limits (`middleware/security.js`): `/api/auth/*` 30 req/15 min; general API 300 req/min; import uploads 10 req/min. Keep upload endpoints on `importUploadLimiter`.

## Frontend Conventions

- All normal API calls go through `frontend/src/utils/api.js`.
- `useAuth()` is the source of truth for the current user.
- Admin/workspace data loaders keep page state local and call API helpers directly.
- `Score.jsx` re-polls assigned sessions every 30s so `pending → active` flips on its own. Score drafts live in a per-player map that survives tab switches within a session.
- Check-in gating (`Score.jsx`): players not checked in render greyed-out and disabled. The gate is enforced ahead of `btnState` and `openPlayer`, so a scorer cannot evaluate a non-attending player.
- `useWorkspaceData()` refreshes event/age-group workspace data every 15s.
- Match the existing inline-style and `ADMIN_CSS` patterns before introducing a new styling approach.

## Player Split Methods

`backend/utils/session-assignment.js` supports four session-block split methods:
- `last_name` — alphabetic ranges by last initial.
- `jersey_range` — numeric jersey ranges from event registration jersey numbers.
- `none` — all eligible players to every matching skills session.
- `manual` — no automatic assignment.

Game blocks are special: player and team assignments from the block are copied into every game session in that block, whatever the split method says.

## Agent Workflow

- **Issue tracker** — issues and planning artifacts live in this repository's GitHub Issues. See `docs/agents/issue-tracker.md`.
- **Triage labels** — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.
- **Domain docs** — single-context repo: root `CONTEXT.md` plus system-wide `docs/adr/`. See `docs/agents/domain.md`.
