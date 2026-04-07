---
name: docker-dev
description: >
  Expert skill for Docker and Docker Compose development workflows. Use this skill whenever working with: docker-compose.yml configuration, container networking, volume mounts, environment variable management, multi-container startup ordering, hot reload in containers, Dockerfile authoring, container debugging, or any task involving "why isn't my container doing X". Trigger immediately when the user mentions docker, compose, containers, volumes, ports, images, Dockerfile, .env files in the context of the dev environment, or asks why the app won't start. Don't wait — if the dev environment is involved, invoke this skill.
---

This skill covers the Docker Compose development workflow for a multi-container monorepo: PostgreSQL database, Node/Express backend, React/Vite frontend, and a mail-catching sidecar (Mailhog). The patterns here apply broadly to any similar stack.

---

## This Project's Container Architecture

```
postgres:16-alpine  (tryout_db)       :5432
node backend        (tryout_backend)  :4000  → depends on db (health)
vite frontend       (tryout_frontend) :3000  → depends on backend
mailhog             (tryout_mail)     :1025 (SMTP), :8025 (UI)
```

All service-to-service communication uses Docker's internal DNS — the backend connects to the database as `DB_HOST: db`, not `localhost`. This is one of the most common sources of confusion when moving from standalone to Compose.

---

## Critical Volume Pattern: Named Modules Volume

```yaml
volumes:
  - ./backend:/app                         # source mount (live reload)
  - backend_node_modules:/app/node_modules # named volume (preserves container's npm install)
```

This two-volume pattern is essential. Without the named `node_modules` volume, the host directory mount would shadow the container's installed packages with your (likely empty or wrong-platform) local `node_modules`. The named volume takes precedence for that path, keeping the container's packages intact while still hot-reloading source changes.

If you ever get `Error: Cannot find module 'express'` or similar inside a container, the named volume is probably stale or missing. Fix: `docker compose down -v && docker compose up --build`.

---

## Startup Ordering and Health Checks

The `depends_on` with `condition: service_healthy` ensures the backend doesn't start until Postgres is actually ready to accept connections — not just "started":

```yaml
backend:
  depends_on:
    db:
      condition: service_healthy

db:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
    interval: 5s
    timeout: 5s
    retries: 5
```

Without the health check condition, you get timing races where the backend starts, can't connect to Postgres yet, and crashes on startup. The scheduler (`scheduler.js`) and all route handlers assume the pool is live.

If the backend keeps restarting, check `docker compose logs backend` — it's almost always a missing env var or a Postgres connection error on first boot.

---

## Environment Variables

Everything sensitive lives in `.env` at the project root (never commit this file). The `docker-compose.yml` references values via `${VAR_NAME}` syntax.

Required vars for this project:
```
POSTGRES_DB=tryoutapp
POSTGRES_USER=tryout
POSTGRES_PASSWORD=<choose one>
JWT_SECRET=<long random string>
VITE_API_URL=http://localhost:4000
MAIL_HOST=mailhog
MAIL_PORT=1025
```

The backend validates required env vars at startup and calls `process.exit(1)` if any are missing — so if the backend container exits immediately, check the env first.

Vite env vars must be prefixed with `VITE_` to be accessible in frontend code as `import.meta.env.VITE_API_URL`. Non-prefixed vars are server-only and won't be bundled.

---

## Common Commands

**Full rebuild from scratch (most reliable when things are broken):**
```bash
docker compose down -v && docker compose up --build
```
The `-v` removes named volumes, including `postgres_data`. This wipes the database — it'll be re-seeded from `postgres/init.sql` on next start.

**Rebuild just one service (faster iteration):**
```bash
docker compose up --build backend
```

**Follow logs for a specific service:**
```bash
docker compose logs backend -f
docker compose logs db -f
```

**Run a one-off command inside a running container:**
```bash
docker compose exec backend sh
docker compose exec db psql -U tryout -d tryoutapp
```

**Check what's actually running:**
```bash
docker compose ps
```

**Stop without wiping data:**
```bash
docker compose down    # keeps volumes
docker compose down -v # wipes volumes (including DB)
```

---

## Hot Reload

Both services support hot reload via source volume mounts:

- **Backend**: `nodemon` watches `backend/` and restarts on file changes. No manual restart needed.
- **Frontend**: Vite's HMR handles React changes. The browser updates without a full reload for most changes.

If hot reload stops working (file changes don't reflect), the volume mount may have gotten into a bad state. `docker compose restart backend` or `docker compose restart frontend` usually fixes it without a full rebuild.

---

## Mailhog (Email Sidecar)

All outgoing email from the backend is caught by Mailhog — nothing hits real inboxes in dev.
- SMTP: `mailhog:1025` (the backend's `MAIL_HOST`/`MAIL_PORT`)
- Web UI: `http://localhost:8025` — browse all sent emails here

This is especially useful when testing invitation flows, password resets, or any feature that sends email.

---

## Dockerfile Patterns

For a Node.js development Dockerfile, the key is installing dependencies in a layer before copying source, so `npm install` is cached unless `package.json` changes:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci              # locked install, reproducible
COPY . .
CMD ["npm", "run", "dev"]
```

Don't use `npm install` in production images — use `npm ci` for reproducibility. In dev, `npm ci` is still preferable.

---

## Debugging Container Issues

**Container exits immediately:**
1. `docker compose logs <service>` — read the actual error
2. Check env vars first — missing `JWT_SECRET` or `DB_PASS` will kill the backend on startup
3. Check if the service it depends on is healthy: `docker compose ps`

**Can't connect between containers:**
- Services talk to each other by service name, not `localhost`
- Backend → database: `DB_HOST: db` (the service name), not `localhost:5432`
- Frontend → backend in dev: requests go through the browser to `localhost:4000`, NOT container-to-container (the browser is outside Docker)
- Vite proxying: if configured, frontend's dev server can proxy `/api` requests to the backend container

**Port already in use:**
```bash
lsof -i :3000   # find what's using the port
docker compose down  # make sure previous containers are stopped
```

**Database schema out of sync:**
- Schema comes from `postgres/init.sql` which only runs on first initialization
- To apply schema changes: `docker compose down -v && docker compose up --build` (wipes data)
- For production-style migrations, use a migration tool (Flyway, node-pg-migrate, etc.)

---

## Adding a New Service

To add a new container (e.g., Redis for caching):

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: tryout_redis
    restart: unless-stopped
    ports:
      - "6379:6379"

  backend:
    # add to environment:
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      redis:
        condition: service_started  # redis has no healthcheck by default
```

Then reference `REDIS_HOST`/`REDIS_PORT` in the backend code via `process.env`.

---

## References

- `references/env-vars.md` — Full list of environment variables and their purpose
- `references/postgres-init.md` — Database initialization and schema change workflow
