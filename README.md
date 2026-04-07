# Weymouth Youth Hockey — Tryout Evaluator

A full-stack web app for managing youth hockey tryout evaluations across multiple age groups, events, and sessions. Designed for internal use by Weymouth Youth Hockey staff and volunteer scorers.

---

## Stack

| Layer     | Tech                        |
|-----------|-----------------------------|
| Frontend  | React 18 + Vite             |
| Backend   | Node.js + Express           |
| Database  | PostgreSQL 16               |
| Container | Docker Compose              |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- That's it — no local Node, npm, or Postgres required

---

## Quick Start

```bash
# 1. Clone or unzip the project
cd tryout-app

# 2. Copy env template and fill in secrets
cp .env.example .env
# Edit .env — set DB_PASS, JWT_SECRET, and CORS_ORIGINS

# 3. Start everything
docker compose up --build

# 4. Open the app
open http://localhost:3000
```

First build takes ~2 minutes while Docker pulls images and installs packages. Subsequent starts are fast.

### Rebuilding after dependency changes

If you update `backend/package.json`, rebuild the backend image:

```bash
docker compose up --build backend
```

---

## Required Environment Variables

| Variable       | Description                                          | Required |
|----------------|------------------------------------------------------|----------|
| `DB_PASS`      | PostgreSQL password                                  | Always   |
| `JWT_SECRET`   | Secret for signing JWTs (min 32 random chars)        | Always   |
| `DB_HOST`      | Database hostname (default: `tryout_db`)             | Always   |
| `DB_NAME`      | Database name (default: `tryoutapp`)                 | Always   |
| `DB_USER`      | Database user (default: `postgres`)                  | Always   |
| `CORS_ORIGINS` | Comma-separated allowed origins (required in prod)   | Prod     |
| `NODE_ENV`     | `production` enables Secure cookies, SSL, strict CORS| Prod     |
| `PORT`         | API port (default: 4000)                             | No       |

**Production startup will fail** if `JWT_SECRET`, `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, or `CORS_ORIGINS` are missing.

---

## Default Logins

| Role  | Email                  | Password   |
|-------|------------------------|------------|
| Admin | admin@tryouts.local    | Admin1234! |

> Passwords are bcrypt-hashed (cost 12). Change the seed admin password before any deployment.

To create scorer/coordinator accounts, use the **Coaches** section in the admin dashboard. Public self-service registration is disabled — all accounts are admin-created.

---

## URLs

| Service    | URL                              |
|------------|----------------------------------|
| App        | http://localhost:3000            |
| API        | http://localhost:4000            |
| API health | http://localhost:4000/health     |
| Postgres   | localhost:5432 (user: `postgres`, db: `tryoutapp`)  |

---

## User Roles

| Role          | What they can do                                                       |
|---------------|------------------------------------------------------------------------|
| `scorer`      | View assigned sessions, score players, see their own scoring progress  |
| `coordinator` | Same as scorer + admin dashboard access, session finalization          |
| `admin`       | Full access — manage events, age groups, sessions, players, users; can finalize sessions and create accounts |

---

## Authentication

Auth uses **HttpOnly cookies** (not localStorage tokens). The browser sends the `auth_token` cookie automatically with every API request.

- **Login:** `POST /api/auth/login` — sets `HttpOnly; SameSite=Lax` cookie
- **Logout:** `POST /api/auth/logout` — clears the cookie server-side
- **Session duration:** 12 hours
- **Production:** cookie also has `Secure` flag (HTTPS required)

---

## Features

### Admin Dashboard (`/admin`)

- **Overview** — Live dashboard showing active sessions, assigned scorers, check-in progress, and age group cards
- **Age Groups** — Create and manage age groups (8U, 10U, 12U…); drill into each group to manage sessions and players
- **Sessions** — Full session management per age group; date filtering; expand any session to edit details, view the player roster, reassign players, and manage scorers
- **Session Blocks** — Wizard to create blocks of sessions with automatic player splits by last name, jersey number, or division; game session support with team assignment
- **Players / Rosters** — Add players individually or import from a SportEngine CSV; players auto-assigned to sessions based on split logic
- **Events** — Create and archive tryout events; view event stats by age group
- **Coaches** — Create and manage user accounts (admin-only); edit profiles, reset passwords, assign to sessions
- **Check-in** — Track player attendance with attendance status (checked-in, late arrival, no-show, excused)
- **Results** — Post-tryout outcome tracking (moved up / retained / left program) per player

### Scorer View (`/score`)

- Session list showing only sessions the scorer is assigned to
- Jersey-number grid showing scoring status per player: complete (green), partial (amber), not started
- Per-player scoring form with criteria: Skating, Puck Skills, Hockey Sense + optional notes
- Draft persistence — partial scores preserved when navigating back
- Auto-refresh every 30s so pending → active transitions happen automatically

### Session Finalization

Sessions progress through: `pending → active → scoring_complete → finalized`

- **scoring_complete:** Admin or coordinator marks scoring done; visible in admin
- **finalized:** Admin-only; blocks further score edits and roster changes
- All status transitions are audit-logged

---

## Security Posture

### What changed in this version

| Area                        | Before                           | After                                    |
|-----------------------------|----------------------------------|------------------------------------------|
| Auth storage                | JWT in `localStorage`            | HttpOnly cookie (JS cannot read it)      |
| Account creation            | Public `POST /api/auth/register` | Admin-only `POST /api/admin/users`       |
| Score submission            | Any authenticated user           | Must be assigned to that session         |
| Session roster access       | Any authenticated user           | Must be assigned to that session (scorers) |
| Security headers            | None                             | Helmet (X-Frame-Options, HSTS, etc.)     |
| Rate limiting               | None                             | 30 login attempts / 15 min per IP; 300 req/min general |
| Request validation          | Ad-hoc field checks              | Structured validation middleware         |
| Audit log                   | None                             | Logs: login, logout, account creation, role changes, score submissions, player moves |
| Password policy             | Min 6 chars                      | Min 12 chars for admin/coordinator; min 8 for scorer; max 128 |
| DB safety timeouts          | None                             | `statement_timeout=30s`, `idle_in_transaction_session_timeout=10s` |
| Production SSL              | None                             | `ssl: { rejectUnauthorized: true }` when `NODE_ENV=production` |
| Session finalization        | None                             | `scoring_complete` and `finalized` statuses; blocks edits |

### Production deployment checklist

- [ ] Set `NODE_ENV=production`
- [ ] `JWT_SECRET` is at least 32 random characters (use a secrets manager, not `.env` in prod)
- [ ] `CORS_ORIGINS` set to your actual frontend domain(s)
- [ ] `DB_PASS` is strong and unique
- [ ] TLS 1.2+ terminated at reverse proxy (Nginx / Traefik)
- [ ] HSTS header enabled at proxy (`Strict-Transport-Security: max-age=31536000`)
- [ ] Database user has least-privilege (SELECT/INSERT/UPDATE/DELETE only — no DDL)
- [ ] `ssl` enforced on DB connection (`DB_SSL=true`)
- [ ] Nightly backups configured; restore tested
- [ ] `npm audit` passing (or all flagged issues reviewed)
- [ ] Change admin@tryouts.local password immediately after first login

---

## Database Migrations

Migrations live in `postgres/migrations/` and must be applied in order to existing databases. Fresh installs pick up all changes via `postgres/init.sql` automatically.

> **DB credentials:** the database user is `postgres` and the database name is `tryoutapp`.

### 001 — Production Readiness

```bash
docker exec -i tryout_db psql -U postgres -d tryoutapp \
  < postgres/migrations/001_production_readiness.sql
```

Adds: `audit_log` table, `attendance_status` on `session_players`, new session status values (`scoring_complete`, `finalized`), `UNIQUE(session_id, player_id)` constraint.

### 002 — Player Shot Hand and Import-Quality Fields

```bash
docker exec -i tryout_db psql -U postgres -d tryoutapp \
  < postgres/migrations/002_player_shot_and_import_fields.sql
```

Adds: `shot VARCHAR(1)`, `date_of_birth DATE`, `external_id VARCHAR(100)`, `gender VARCHAR(10)` to `players`. Creates a partial unique index on `(external_id, event_id)` for upsert-on-reimport. Backfills `date_of_birth` from `birth_year` for existing rows.

### 003 — Drop Jersey Uniqueness Constraint

```bash
docker exec -i tryout_db psql -U postgres -d tryoutapp \
  < postgres/migrations/003_drop_jersey_unique_constraint.sql
```

Drops the `UNIQUE(jersey_number, age_group_id, event_id)` constraint so duplicate jersey numbers are allowed within a group. Adds a non-unique index on the same columns for query performance.

> **Apply order:** 001 → 002 → 003. Apply 002 before 003.

### Fresh installs

`docker compose up --build` runs `postgres/init.sql` automatically and includes all migrations.

---

## API Reference

### Auth — `/api/auth`

```
POST   /login                     { email, password } → { user }  (sets auth_token cookie)
POST   /logout                    → { success }        (clears auth_token cookie)
GET    /me                        → { user }
```

> `POST /register` is intentionally removed. Use `POST /api/admin/users` instead.

### Sessions — `/api/sessions`

```
GET    /mine                      Scorer's assigned sessions
GET    /                          All sessions (admin/coordinator); ?age_group_id= &event_id= &date=
POST   /                          Create a single session
PATCH  /:id                       Update name, date, time, status (pending|active|complete|scoring_complete|finalized), type
DELETE /:id
GET    /:id/players               Player roster (scorers: assigned sessions only) + completion stats
GET    /:id/siblings              Other sessions from the same block
PATCH  /:id/players/:pid/checkin  { checkedIn, attendanceStatus? }
GET    /:id/scorers
POST   /:id/assign                { userId } — assign a scorer
DELETE /:id/scorers/:userId       Remove a scorer
```

### Session Blocks — `/api/session-blocks`

```
GET    /                          List blocks; ?event_id= &age_group_id=
POST   /                          Create a block + sessions with player splits
PATCH  /:id                       Update split method (triggers player reassignment)
DELETE /:id
POST   /:id/reassign              Re-run player assignment
GET    /:id/suggest-ranges        Suggest last-name or jersey splits
```

### Session Players — `/api/session-players`

```
PATCH  /move                      { playerId, fromSessionId, toSessionId, keepCheckinStatus }
```

### Scores — `/api/scores`

```
POST   /                          Submit or update a score (upsert); scorer must be assigned to session
GET    /rankings/:ageGroupId/:eventId
GET    /dashboard
```

### Admin — `/api/admin`

```
GET    /age-groups
POST   /age-groups
GET    /events
POST   /events
PATCH  /events/:id/archive
GET    /events/:id/stats
GET    /players?age_group_id=&event_id=
POST   /players
POST   /players/bulk
DELETE /players/:id
PATCH  /players/:id/outcome
GET    /users
POST   /users                     Admin-only account creation
PATCH  /users/:id
GET    /users/:id/sessions
GET    /sessions/:id/completion   Scorer completion stats for a session
PATCH  /sessions/:id/finalize     { status: 'scoring_complete' | 'finalized' }
```

### Import — `/api/import`

```
POST   /preview                   Parse CSV, return preview + summary
POST   /commit                    Import validated players (SportEngine format)
GET    /csv-template              Download blank import template
```

---

## Project Structure

```
tryout-app/
├── docker-compose.yml
├── .env.example
├── postgres/
│   ├── init.sql                      # Full schema + seed (run on fresh container)
│   └── migrations/
│       ├── 001_production_readiness.sql          # audit_log, attendance_status, session statuses
│       ├── 002_player_shot_and_import_fields.sql # shot, dob, external_id, gender on players
│       └── 003_drop_jersey_unique_constraint.sql # allow duplicate jersey numbers
├── backend/
│   ├── Dockerfile
│   ├── index.js                      # Express app entry point
│   ├── scheduler.js                  # Background jobs (session auto-activation)
│   ├── db/pool.js                    # Postgres pool (SSL + timeouts in prod)
│   ├── middleware/
│   │   ├── auth.js                   # JWT cookie auth, role guards, resource-level session guard
│   │   ├── security.js               # Helmet, CORS, rate limiting, request ID
│   │   └── validate.js               # Structured request validation middleware
│   ├── utils/
│   │   ├── audit.js                  # Audit log writer
│   │   └── session-assignment.js     # Player → session assignment logic
│   └── routes/
│       ├── auth.js                   # /api/auth/* (login, logout, me)
│       ├── sessions.js               # /api/sessions/*
│       ├── session-blocks.js         # /api/session-blocks/*
│       ├── session-players.js        # /api/session-players/* (move)
│       ├── scores.js                 # /api/scores/*
│       ├── admin.js                  # /api/admin/*
│       ├── import.js                 # /api/import/*
│       └── evaluation-templates.js  # /api/evaluation-templates/*
└── frontend/
    ├── Dockerfile
    ├── vite.config.js                # /api proxy → localhost:4000
    └── src/
        ├── App.jsx
        ├── index.css
        ├── hooks/useAuth.jsx         # Auth context (cookie-based, no localStorage)
        ├── utils/api.js              # All API calls (credentials: 'include')
        ├── components/
        │   └── ProtectedRoute.jsx
        ├── pages/
        │   ├── Login.jsx
        │   ├── Score.jsx             # Scorer evaluator interface
        │   └── Admin.jsx             # Admin state + data fetching
        └── features/admin/
            ├── styles.js
            ├── shared.jsx
            └── views/
                ├── OverviewView.jsx
                ├── GroupsView.jsx
                ├── SessionsView.jsx
                ├── EventsView.jsx
                ├── CoachesView.jsx
                ├── RankingsView.jsx
                ├── ResultsView.jsx
                └── CheckInView.jsx
```

---

## Common Commands

```bash
# Start everything
docker compose up

# Start in background
docker compose up -d

# Stop everything
docker compose down

# Wipe database and start fresh
docker compose down -v && docker compose up --build

# View backend logs
docker compose logs backend -f

# Connect to database
docker exec -it tryout_db psql -U postgres -d tryoutapp

# Run production readiness migration on existing DB
docker exec -i tryout_db psql -U postgres -d tryoutapp \
  < postgres/migrations/001_production_readiness.sql
```

---

## Database Schema (key tables)

| Table                | Purpose                                                       |
|----------------------|---------------------------------------------------------------|
| `users`              | Admins, coordinators, and scorers                             |
| `tryout_events`      | A tryout event (e.g. "Spring 2026 Tryouts")                   |
| `age_groups`         | 8U, 10U, 12U, etc.                                            |
| `session_blocks`     | Groups related sessions (same day, same split logic)          |
| `sessions`           | Individual ice sessions (skills or game)                      |
| `session_players`    | Explicit player roster per session + attendance_status        |
| `session_scorers`    | Scorer-to-session assignments                                 |
| `players`            | Players registered for a tryout event                         |
| `scores`             | Scorer evaluations (skating, puck skills, sense)              |
| `evaluation_templates` | Configurable scoring criteria per age group               |
| `audit_log`          | Security/ops event trail (login, role changes, score writes…) |

---

## Testing

API security tests live in `backend/tests/`. They run against a real PostgreSQL database (no mocks).

```bash
# Run from backend/ — set env vars to point at a local or test DB
DB_HOST=localhost DB_USER=postgres DB_PASS=postgres DB_NAME=tryoutapp \
  JWT_SECRET=<32+ char secret> npm test
```

**What is tested:**
- Public `/register` endpoint is blocked (404)
- Login sets HttpOnly cookie; response body never exposes the raw token
- Login returns identical error for bad password vs. unknown email (no user enumeration)
- Logout clears the auth cookie and requires authentication
- `/me` requires a valid cookie and sets `Cache-Control: no-store`
- Scorer can only submit scores for sessions they are assigned to
- Scorer cannot score players outside the session roster
- Finalized sessions reject score edits from scorers (admins bypass)
- Scorer can fetch their own session roster; 403 for any other session
- Move-player endpoint requires admin or coordinator role

**CI:** `.github/workflows/ci.yml` runs the full suite plus `npm audit` and a frontend build check on every push and pull request.

---

## Backup and Recovery

### Backup procedure

```bash
# Dump the database to a timestamped file
docker exec tryout_db pg_dump -U postgres tryoutapp \
  | gzip > backups/tryoutapp-$(date +%Y%m%d-%H%M%S).sql.gz
```

Run this nightly via cron or a managed backup service. Store files off-host (S3, Backblaze, etc.).

### Restore procedure

```bash
# Drop and recreate the database, then restore
docker exec tryout_db psql -U postgres -c "DROP DATABASE IF EXISTS tryoutapp;"
docker exec tryout_db psql -U postgres -c "CREATE DATABASE tryoutapp;"
gunzip -c backups/tryoutapp-<timestamp>.sql.gz \
  | docker exec -i tryout_db psql -U postgres -d tryoutapp
```

**Test your restore on a non-production instance before relying on it.**

### Retention policy

| Backup | Keep |
|---|---|
| Daily | 14 days |
| Weekly (Sunday) | 3 months |
| Monthly | 1 year |

---

## Monitoring and Alerting

The app logs structured JSON in production (`NODE_ENV=production`). Key signals to alert on:

| Signal | Source | Suggested threshold |
|---|---|---|
| `login_failure` events | `audit_log` table | > 10 in 1 minute from same IP |
| HTTP 429 responses | Reverse proxy / app logs | Any sustained rate |
| HTTP 5xx responses | App logs | > 1% of requests over 5 min |
| DB pool exhaustion | App logs (`database pool error`) | Any occurrence |
| Scheduler failures | App logs | Any `[scheduler]` error |

The audit log table (`audit_log`) is the authoritative record for: login success/failure, logout, score submissions, session status changes. Query it directly for incident investigation:

```sql
SELECT * FROM audit_log
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## Known Limitations

- No email notifications when a scorer is assigned to a session
- No mobile PWA install prompt
- No PDF/CSV export for rankings
- Goalie-specific evaluation criteria not yet supported
- Refresh-token rotation not yet implemented (access cookie TTL is 12h)
