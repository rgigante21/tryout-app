# Environment Variables Reference

All values live in `.env` at the project root. Never commit this file.

## Backend (required — app exits on startup if missing)

| Variable | Example | Purpose |
|----------|---------|---------|
| `JWT_SECRET` | `a-long-random-string` | Signs JWTs. Use a cryptographically random value (32+ chars). |
| `DB_HOST` | `db` (Docker) / `localhost` (standalone) | Postgres hostname |
| `DB_NAME` | `tryoutapp` | Database name |
| `DB_USER` | `tryout` | Database user |
| `DB_PASS` | `yourpassword` | Database password |

## Backend (optional with defaults)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `4000` | Express listen port |
| `DB_PORT` | `5432` | Postgres port |
| `DB_POOL_MAX` | `10` | Max pool connections |
| `DB_POOL_IDLE_MS` | `30000` | Idle connection timeout |
| `NODE_ENV` | `development` | Controls logging format, SSL, error verbosity |
| `MAIL_HOST` | — | SMTP hostname (Mailhog: `mailhog`) |
| `MAIL_PORT` | — | SMTP port (Mailhog: `1025`) |
| `CORS_ORIGINS` | — | Required in production; comma-separated allowed origins |

## Frontend (Vite)

Frontend env vars must be prefixed `VITE_` to be bundled into client code.
Access in React: `import.meta.env.VITE_API_URL`

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:4000` | Backend base URL |

## Postgres (docker-compose)

| Variable | Notes |
|----------|-------|
| `POSTGRES_DB` | Same value as `DB_NAME` |
| `POSTGRES_USER` | Same value as `DB_USER` |
| `POSTGRES_PASSWORD` | Same value as `DB_PASS` |

## How docker-compose.yml uses them

`docker-compose.yml` reads from `.env` automatically via `${VAR_NAME}` substitution. Services receive their env vars via the `environment:` block, which maps compose-level vars to container env vars. The names don't have to match — for example, `POSTGRES_PASSWORD` in docker-compose becomes `DB_PASS` inside the backend container.
