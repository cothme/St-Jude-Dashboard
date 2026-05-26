# St. Jude's Administrator Dashboard

Admin dashboard for a psychiatric and custodial home. The system includes patient management, checkups, appointment scheduling, medication schedules, employee management, payroll, activity logs, and role-based access for Super admin, Staff, and Doctor users.

## Tech Stack

- React + TypeScript + Vite frontend
- Express + TypeScript backend
- PostgreSQL database
- Prisma ORM
- Better Auth authentication
- Docker-ready production build

## Core Modules

- Dashboard with upcoming appointments and medication schedules
- Patient records and discharge workflow
- Appointment scheduling and checkup execution
- Medication schedules and administration logs
- Employee management
- Payroll and payslip export
- User and role management
- Backend-persisted activity logs

## Local Setup

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd backend
npm install
```

Create environment files from the examples:

```bash
copy .env.example .env
copy backend\.env.example backend\.env
```

Run Prisma migrations:

```bash
cd backend
npm run prisma:generate
npx prisma migrate deploy
```

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend:

```bash
npm run dev
```

## Production Build

Frontend:

```bash
npm run build
```

Backend:

```bash
cd backend
npm run build
```

## Backup and Restore

Database backups are handled by CLI scripts that use PostgreSQL `pg_dump` and `pg_restore`.

Create a backup:

```bash
cd backend
npm run backup:db
```

After `npm run build`, you can also use:

```bash
npm run backup:db:compiled
```

Restore a backup:

```bash
cd backend
npm run restore:db -- ./backups/stjude-db-file.dump --force
```

Full guide: [Backup and Restore Guide](docs/BACKUP_AND_RESTORE.md)

## Deployment

The project includes a root `Dockerfile` for deploying the combined frontend/backend app. On startup, the backend runs Prisma migrations and ensures the Super admin account exists.

Important production environment variables include:

```env
DATABASE_URL=
BETTER_AUTH_URL=
BETTER_AUTH_SECRET=
CLIENT_ORIGIN=
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_PASSWORD=
```

## Security Notes

- Do not commit real credentials.
- Keep `BETTER_AUTH_SECRET` private.
- Use strong PostgreSQL credentials in production.
- Keep production backups outside ephemeral container storage.
