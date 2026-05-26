import "dotenv/config";
import { spawn } from "node:child_process";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
const backupDir = path.resolve(process.env.BACKUP_DIR ?? "backups");
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? "30");
const pgDumpPath = process.env.PG_DUMP_PATH ?? "pg_dump";

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `stjude-db-${timestamp}.dump`);

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function pruneOldBackups() {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(backupDir).catch(() => []);

  await Promise.all(entries
    .filter((entry) => /^stjude-db-.*\.dump$/.test(entry))
    .map(async (entry) => {
      const filePath = path.join(backupDir, entry);
      const fileStat = await stat(filePath);
      if (fileStat.mtimeMs < cutoff) {
        await unlink(filePath);
        console.log(`Deleted old backup: ${filePath}`);
      }
    }));
}

await mkdir(backupDir, { recursive: true });
console.log(`Creating PostgreSQL backup: ${backupPath}`);

await run(pgDumpPath, [
  "--format=custom",
  "--no-owner",
  "--no-acl",
  "--file",
  backupPath,
  databaseUrl,
]);

await pruneOldBackups();
console.log(`Backup complete: ${backupPath}`);
