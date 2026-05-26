import "dotenv/config";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
const pgRestorePath = process.env.PG_RESTORE_PATH ?? "pg_restore";
const args = process.argv.slice(2);
const force = args.includes("--force");
const backupArg = args.find((arg) => arg !== "--force");

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

if (!backupArg || !force) {
  console.error("Usage: npm run restore:db -- <backup-file.dump> --force");
  console.error("Restore is destructive and requires --force.");
  process.exit(1);
}

const backupPath = path.resolve(backupArg);

async function run(command: string, commandArgs: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

await access(backupPath);
console.log(`Restoring PostgreSQL backup: ${backupPath}`);

await run(pgRestorePath, [
  "--clean",
  "--if-exists",
  "--no-owner",
  "--no-acl",
  "--dbname",
  databaseUrl,
  backupPath,
]);

console.log("Restore complete.");
