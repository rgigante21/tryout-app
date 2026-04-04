# PostgreSQL Init and Schema Changes

## How Init Works

`postgres/init.sql` is mounted into the Postgres container at `/docker-entrypoint-initdb.d/init.sql`. Docker's Postgres image runs all `.sql` files in that directory **once** — only when the `postgres_data` named volume is empty (i.e., first container start, or after `docker compose down -v`).

This means: **editing init.sql has no effect on an existing database.** The volume already has data.

## Applying Schema Changes in Development

```bash
# Wipe the DB volume and rebuild everything
docker compose down -v && docker compose up --build
```

This destroys all data and re-runs `init.sql` from scratch. The seed data (admin user, age groups, etc.) is also re-created. Acceptable in development; not in production.

## Verifying the Schema

Connect to the running Postgres container:

```bash
docker compose exec db psql -U tryout -d tryoutapp
```

Useful psql commands:
```sql
\dt                    -- list all tables
\d sessions            -- describe a table
\d+ scores             -- describe with extra detail
SELECT * FROM users;   -- query data
\q                     -- quit
```

## Migration Strategy (Future)

For production deployments, `init.sql` is insufficient — you can't wipe the database to apply a change. A migration tool should be adopted. Options:

- **node-pg-migrate** — Node-native, integrates naturally with the existing JS stack
- **Flyway** — Java-based but widely used; can run as a Docker sidecar
- **Liquibase** — Another Java option, XML/SQL-based

Until migrations are adopted, `init.sql` is the schema source of truth and all schema changes require a dev environment reset.

## Seeded Data

`init.sql` includes seed data at the bottom. Check the file for what's pre-created (users, age groups, evaluation templates). The default admin account is seeded there — see `CLAUDE.md` for credentials.
