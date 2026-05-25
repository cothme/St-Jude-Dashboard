# Docker and Railway Deployment

This repository is set up as a single Docker service. The container builds the React frontend, builds the Express backend, serves the frontend from Express in production, and runs Prisma migrations on startup.

## Required Railway Variables

Set these on the Railway service:

- `DATABASE_URL`: Railway Postgres connection string.
- `BETTER_AUTH_SECRET`: a random 32+ character secret.
- `BETTER_AUTH_URL`: your Railway public service URL, for example `https://your-app.up.railway.app`.
- `CLIENT_ORIGIN`: the same Railway public service URL.
- `NODE_ENV`: `production`.
- `PORT`: Railway usually injects this automatically. If needed, set `3001`.

## Local Docker Test

```bash
docker build -t st-jude-admin-dashboard .
docker run --env-file backend/.env -p 3001:3001 st-jude-admin-dashboard
```

Open `http://localhost:3001`.

## Railway Notes

Attach a Railway Postgres database before the first deploy. The container startup command runs:

```bash
prisma migrate deploy && node dist/src/index.js
```

That applies committed migrations before the app starts.

## Create the First Super Admin

After the first deploy, run this from your local backend folder with the Railway CLI:

```bash
railway run npm run seed:super-admin
```

Optional variables:

```bash
railway run --set "SUPER_ADMIN_EMAIL=admin@stjude.local" --set "SUPER_ADMIN_NAME=Maria Santos" --set "SUPER_ADMIN_PASSWORD=Password123!" npm run seed:super-admin
```

The script creates the user if missing. If the user already exists, it promotes and verifies the account without changing the password.
