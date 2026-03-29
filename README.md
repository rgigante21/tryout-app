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

# 2. Start everything
docker compose up --build

# 3. Open the app
open http://localhost:3000
```

First build takes ~2 minutes while Docker pulls images and installs packages. Subsequent starts are fast.

---

## Default Logins

| Role  | Email                  | Password   |
|-------|------------------------|------------|
| Admin | admin@tryouts.local    | Admin1234! |

> Passwords are bcrypt-hashed. The seed admin account is created in `postgres/init.sql`. Change it before any real deployment.

To create scorer/coordinator accounts, use the **Coaches** section in the admin dashboard.

---

## URLs

| Service    | URL                              |
|------------|----------------------------------|
| App        | http://localhost:3000            |
| API        | http://localhost:4000            |
| API health | http://localhost:4000/health     |
| Postgres   | localhost:5432 (user: `tryout`)  |

---

## User Roles

| Role        | What they can do                                                      |
|-------------|-----------------------------------------------------------------------|
| `scorer`    | View assigned sessions, score players, see their own scoring progress |
| `coordinator` | Same as scorer + admin dashboard access                            |
| `admin`     | Full access — manage events, age groups, sessions, players, and users |

---

## Features

### Admin Dashboard (`/admin`)
- **Overview** — Live dashboard showing active sessions with assigned scorers and player scoring progress; today's schedule with status and progress bars; age group cards with player/session counts
- **Age Groups** — Create and manage age groups (e.g. 8U, 10U, 12U); drill into each group to manage sessions and players
- **Sessions** — Full session management per age group; date filtering; expand any session to edit details, view the assigned player roster, reassign players using split methods, and manage scorers
- **Session Blocks** — Wizard to create blocks of sessions with automatic player splits by last name, jersey number, or division; game session support with team assignment
- **Players / Rosters** — Add players individually or import from a SportEngine CSV export; players auto-assigned to sessions based on last-name or jersey splits; view and remove players per age group
- **Events** — Create and archive tryout events (e.g. "Fall 2025 Tryouts"); each event is independently scoped
- **Coaches** — Create and manage user accounts; grouped by role (Admins / Coordinators / Coaches); separate profile editing and password reset flows
- **Results** — Post-tryout outcome tracking (moved up / retained / left program) per player; view historical event stats broken down by age group

### Scorer View (`/score`)
- Session list showing only sessions the scorer is assigned to
- Jersey-number grid showing scoring status per player: complete (green), partial (amber), not started (default)
- Per-player scoring form with criteria: Skating, Puck Skills, Hockey Sense + optional notes
- Incomplete indicator — amber badge on jersey grid + per-criterion "needed" markers if a player is partially scored
- Draft persistence — partial scores are saved locally when navigating back to the player list, preventing data loss
- Active session highlighted with gold border and live badge

---

## Project Structure

```
tryout-app/
├── docker-compose.yml
├── .env.example
├── postgres/
│   └── init.sql                  # Full schema + seed data
├── backend/
│   ├── Dockerfile
│   ├── index.js                  # Express app entry point
│   ├── scheduler.js              # Background jobs
│   ├── db/pool.js                # Postgres connection pool
│   ├── middleware/auth.js        # JWT auth + role guard
│   ├── utils/session-assignment.js  # Player → session assignment logic
│   └── routes/
│       ├── auth.js               # /api/auth/*
│       ├── sessions.js           # /api/sessions/*
│       ├── session-blocks.js     # /api/session-blocks/*
│       ├── scores.js             # /api/scores/*
│       ├── admin.js              # /api/admin/*
│       ├── import.js             # /api/import/*
│       └── evaluation-templates.js  # /api/evaluation-templates/*
└── frontend/
    ├── Dockerfile
    ├── vite.config.js            # /api proxy → localhost:4000
    └── src/
        ├── App.jsx               # Route definitions
        ├── index.css             # Global dark theme (scorer view)
        ├── hooks/useAuth.jsx     # Auth context + JWT storage
        ├── utils/api.js          # All API calls
        ├── components/
        │   └── ProtectedRoute.jsx
        ├── pages/
        │   ├── Login.jsx         # /login
        │   ├── Score.jsx         # /score  — scorer evaluator interface
        │   └── Admin.jsx         # /admin  — all admin state + data fetching
        └── features/admin/
            ├── styles.js         # Admin theme (CSS vars + style objects)
            ├── shared.jsx        # Sidebar, BlockWizardPanel, shared helpers
            └── views/
                ├── OverviewView.jsx    # Live dashboard
                ├── GroupsView.jsx      # Age group detail + sessions + roster
                ├── SessionsView.jsx    # Sessions list with expand/manage
                ├── EventsView.jsx      # Event create/archive/stats
                ├── CoachesView.jsx     # User management
                ├── RankingsView.jsx    # Per-group player rankings
                └── ResultsView.jsx     # Post-tryout outcomes
```

---

## API Reference

### Auth — `/api/auth`
```
POST   /login                        { email, password }
POST   /register                     { firstName, lastName, email, password, role }
GET    /me
```

### Sessions — `/api/sessions`
```
GET    /mine                         Scorer's assigned sessions
GET    /                             All sessions (admin); ?age_group_id= &event_id= &date=
POST   /                             Create a single session
PATCH  /:id                          Update name, date, time, status, type
DELETE /:id
GET    /:id/players                  Player roster for a session
PATCH  /:id/players/:playerId/checkin
GET    /:id/scorers
POST   /:id/assign                   { userId } — assign a scorer
DELETE /:id/scorers/:userId          Remove a scorer
```

### Session Blocks — `/api/session-blocks`
```
GET    /                             List blocks; ?event_id= &age_group_id=
POST   /                             Create a block + sessions with player splits
PATCH  /:id                          Update split method (triggers player reassignment)
DELETE /:id
POST   /:id/reassign                 Re-run player assignment
GET    /:id/suggest-ranges           Suggest last-name or jersey splits
```

### Scores — `/api/scores`
```
POST   /                             Submit or update a score (upsert)
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
PATCH  /users/:id
GET    /users/:id/sessions
```

### Import — `/api/import`
```
POST   /preview                      Parse CSV, return preview + summary
POST   /commit                       Import validated players (SportEngine format)
GET    /csv-template                 Download blank import template
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
docker exec -it tryout_db psql -U tryout -d tryoutapp

# Run a one-off Node script in the backend container
docker exec tryout_backend node -e "const bcrypt = require('bcrypt'); ..."
```

---

## Database Schema (key tables)

| Table                | Purpose                                              |
|----------------------|------------------------------------------------------|
| `users`              | Admins, coordinators, and scorers                    |
| `tryout_events`      | A tryout event (e.g. "Fall 2025 Tryouts")            |
| `age_groups`         | 8U, 10U, 12U, etc.                                   |
| `session_blocks`     | Groups related sessions (same day, same split logic) |
| `sessions`           | Individual ice sessions (skills or game)             |
| `session_players`    | Explicit player roster per session                   |
| `session_scorers`    | Scorer-to-session assignments                        |
| `players`            | Players registered for a tryout event                |
| `scores`             | Scorer evaluations (skating, puck skills, sense)     |
| `evaluation_templates` | Configurable scoring criteria per age group        |

---

## Known Limitations

- No email notifications when a scorer is assigned to a session
- No mobile PWA install prompt
- No PDF/CSV export for rankings
- Goalie-specific evaluation criteria not yet supported
