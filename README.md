# Hockey Tryout Evaluator

A web app for managing youth hockey tryout evaluations across multiple age groups, sessions, and days.

---

## Stack

| Layer     | Tech                  |
|-----------|-----------------------|
| Frontend  | React + Vite          |
| Backend   | Node.js + Express     |
| Database  | PostgreSQL 16         |
| Email     | Mailhog (local dev)   |
| Container | Docker Compose        |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- That's it

---

## Quick Start

```bash
# 1. Clone or unzip the project
cd tryout-app

# 2. Start everything
docker compose up --build

# 3. Open the app
open http://localhost:3000

# 4. View emails (local only)
open http://localhost:8025
```

First build takes ~2 minutes while Docker pulls images and installs packages. After that, `docker compose up` starts in seconds.

---

## Default Login

| Role  | Email                  | Password   |
|-------|------------------------|------------|
| Admin | admin@tryouts.local    | Admin1234! |

> The admin password is set by the seed SQL in `db/init.sql`. Change it before deploying anywhere.

---

## URLs

| Service  | URL                        |
|----------|----------------------------|
| App      | http://localhost:3000       |
| API      | http://localhost:4000       |
| API health | http://localhost:4000/health |
| Mailhog  | http://localhost:8025       |
| Postgres | localhost:5432              |

---

## Project Structure

```
tryout-app/
├── docker-compose.yml
├── db/
│   └── init.sql              # Schema + seed data
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js          # Express entry point
│       ├── db/index.js       # Postgres connection
│       ├── middleware/auth.js # JWT middleware
│       └── routes/
│           ├── auth.js       # /api/auth/*
│           ├── sessions.js   # /api/sessions/*
│           └── admin.js      # /api/admin/*
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx           # Routes
        ├── index.css         # Global CSS variables
        ├── components/
        │   └── ProtectedRoute.jsx
        ├── hooks/
        │   └── useAuth.jsx   # Auth context
        ├── pages/
        │   ├── Login.jsx     # /login
        │   ├── Score.jsx     # /score  (scorer view)
        │   └── Admin.jsx     # /admin  (admin/coordinator view)
        └── utils/
            └── api.js        # All API calls
```

---

## User Roles

| Role        | Access                                    |
|-------------|-------------------------------------------|
| scorer      | /score — assigned sessions only           |
| coordinator | /score + /admin — one age group focus     |
| admin       | /score + /admin — full dashboard          |

---

## API Endpoints

### Auth
```
POST   /api/auth/login       { email, password }
POST   /api/auth/register    { email, name, password, role }
GET    /api/auth/me
```

### Scorer
```
GET    /api/sessions/mine
GET    /api/sessions/:id/players
POST   /api/sessions/:id/scores   { player_id, scores: [{criteria_id, score}] }
```

### Admin
```
GET    /api/admin/dashboard
GET    /api/admin/age-groups/:id/rankings
GET    /api/admin/users
POST   /api/admin/sessions/:id/assign    { user_id }
DELETE /api/admin/sessions/:id/assign/:userId
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
docker compose down -v
docker compose up --build

# View backend logs
docker compose logs backend -f

# View all logs
docker compose logs -f

# Connect to database directly
docker exec -it tryout_db psql -U tryout -d tryoutapp
```

---

## Next Steps (Roadmap)

- [ ] Admin UI to create/manage sessions and assign scorers
- [ ] Email invite when scorer is assigned to a session
- [ ] Multi-session view toggle on scorer grid
- [ ] Export rankings to PDF/CSV
- [ ] Player notes field per scorer
- [ ] Goalie-specific evaluation criteria
- [ ] Mobile PWA install prompt
