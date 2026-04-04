# Environment Variables for Docker Dev

See `fullstack-js/references/env.md` for the full variable reference.

Quick `.env` template to get started:

```env
# Postgres
POSTGRES_DB=tryoutapp
POSTGRES_USER=tryout
POSTGRES_PASSWORD=dev_password_change_in_prod

# Backend
JWT_SECRET=dev-secret-change-in-prod-use-32-random-chars
MAIL_HOST=mailhog
MAIL_PORT=1025

# Frontend (Vite)
VITE_API_URL=http://localhost:4000
```

Never use these dev values in production. In production, generate a cryptographically random `JWT_SECRET` and use a real SMTP service instead of Mailhog.
