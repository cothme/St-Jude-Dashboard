# Backup and Restore Guide

This project stores its durable application data in PostgreSQL. The backup CLI uses PostgreSQL's official tools:

- `pg_dump` for backups
- `pg_restore` for restores

Profile photos stored as database strings are included in the database backup. If the app later moves images to object storage, that storage must be backed up separately.

## Prerequisites

Install PostgreSQL command line tools on the machine running the commands.

Required commands:

```bash
pg_dump --version
pg_restore --version
```

If those commands are not in your PATH, set these in `backend/.env`:

```env
PG_DUMP_PATH="C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe"
PG_RESTORE_PATH="C:\\Program Files\\PostgreSQL\\16\\bin\\pg_restore.exe"
```

## Configuration

Set these in `backend/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
BACKUP_DIR="./backups"
BACKUP_RETENTION_DAYS="30"
```

`BACKUP_DIR` is relative to the `backend` folder unless you provide an absolute path.

`BACKUP_RETENTION_DAYS` controls automatic cleanup of old `stjude-db-*.dump` backup files. Set it to `0` to disable cleanup.

## Create a Backup

From the backend folder:

```bash
cd backend
npm run backup:db
```

The script creates a timestamped file:

```text
backend/backups/stjude-db-2026-05-26T07-30-00-000Z.dump
```

The backup format is PostgreSQL custom format. This is better than plain SQL for controlled restores.

After compiling the backend, the equivalent command is:

```bash
npm run backup:db:compiled
```

## Restore a Backup

Restore is destructive. It replaces database objects with the contents of the backup file.

From the backend folder:

```bash
cd backend
npm run restore:db -- ./backups/stjude-db-YYYY-MM-DDTHH-MM-SS-000Z.dump --force
```

The `--force` flag is required on purpose.

After compiling the backend, the equivalent command is:

```bash
npm run restore:db:compiled -- ./backups/stjude-db-YYYY-MM-DDTHH-MM-SS-000Z.dump --force
```

## Recommended Routine

For production:

1. Run a database backup before every deployment.
2. Run a database backup before every migration.
3. Keep at least one off-machine copy of important backups.
4. Test restore on a separate test database once in a while.

## Railway Notes

Railway containers are ephemeral. Do not treat files created inside a Railway container as permanent storage.

Recommended Railway options:

- Use Railway PostgreSQL backups if available on your plan.
- Run this CLI from a machine that can reach the production database.
- Store generated `.dump` files outside Railway, such as local secure storage, S3, Cloudflare R2, or another backup provider.

If your Railway `DATABASE_URL` uses `postgres.railway.internal`, it is only reachable from Railway's private network. For local backups, use a public database connection string or a Railway-supported connection method.

## Safety Checklist Before Restore

Before restoring production:

1. Confirm the target `DATABASE_URL`.
2. Create a fresh backup of the current database.
3. Verify the backup file path.
4. Restore during a maintenance window if users are active.
5. Restart the backend after restore if needed.

## Troubleshooting

If `pg_dump` or `pg_restore` is not found, install PostgreSQL tools or set `PG_DUMP_PATH` / `PG_RESTORE_PATH`.

If the command cannot reach Railway Postgres, check whether the host is private-only. Private hosts such as `postgres.railway.internal` cannot be reached from your local computer.

If restore fails because users are connected, stop the backend temporarily and retry.
