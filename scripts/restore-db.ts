// Restore the SQLite database from a backup snapshot.
//   npm run db:restore            → restore the most recent snapshot
//   npm run db:restore -- <file>  → restore a specific snapshot in prisma/backups/
//   npm run db:restore -- --list  → list available snapshots
//
// Stop the dev server first so nothing is holding the database open.

import fs from "node:fs";
import path from "node:path";
import { ROOT, BACKUPS_DIR, SIDECAR_EXTS, resolveDbPath } from "./db-path";
import { backupDb } from "./backup-db";

function listSnapshots(): string[] {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  return fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => /\.db$/.test(f) && !f.endsWith(".db-wal") && !f.endsWith(".db-shm"))
    .sort();
}

function main() {
  const arg = process.argv[2];
  const snapshots = listSnapshots();

  if (snapshots.length === 0) {
    console.error("No backups found in prisma/backups/. Run `npm run db:backup` first.");
    process.exit(1);
  }

  if (arg === "--list") {
    console.log("Available snapshots (newest last):");
    for (const s of snapshots) console.log("  " + s);
    return;
  }

  const chosen = arg ?? snapshots[snapshots.length - 1];
  const src = path.join(BACKUPS_DIR, chosen);
  if (!fs.existsSync(src)) {
    console.error(`Snapshot not found: ${chosen}`);
    console.error("Available: " + snapshots.join(", "));
    process.exit(1);
  }

  // Safety net: snapshot the current DB before overwriting it.
  backupDb("pre-restore");

  const dbPath = resolveDbPath();
  // Remove stale sidecar files so they can't shadow the restored DB.
  for (const ext of SIDECAR_EXTS)
    fs.rmSync(dbPath + ext, { force: true });

  fs.copyFileSync(src, dbPath);
  console.log(`Restored ${chosen} → ${path.relative(ROOT, dbPath)}`);
  console.log("If the dev server was running, restart it to pick up the change.");
}

main();
