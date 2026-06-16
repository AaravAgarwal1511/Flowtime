// Snapshot the SQLite database into prisma/backups/, keeping the latest N.
// Runs on demand (`npm run db:backup`) and automatically before destructive
// commands (`predb:reset`, `predb:migrate`).

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, BACKUPS_DIR, SIDECAR_EXTS, resolveDbPath } from "./db-path";

const KEEP = Number(process.env.DB_BACKUP_KEEP ?? 10);

export function backupDb(prefix = "dev"): string | null {
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    console.log(`No database at ${path.relative(ROOT, dbPath)} — nothing to back up.`);
    return null;
  }

  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(BACKUPS_DIR, `${prefix}-${stamp}.db`);

  fs.copyFileSync(dbPath, dest);
  for (const ext of SIDECAR_EXTS) {
    if (fs.existsSync(dbPath + ext)) fs.copyFileSync(dbPath + ext, dest + ext);
  }
  console.log(`Backed up → ${path.relative(ROOT, dest)}`);

  prune();
  return dest;
}

function prune(): void {
  const snapshots = fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => /\.db$/.test(f) && !f.endsWith(".db-wal") && !f.endsWith(".db-shm"))
    .sort(); // ISO timestamps sort chronologically

  const excess = snapshots.length - KEEP;
  if (excess <= 0) return;
  for (const f of snapshots.slice(0, excess)) {
    fs.rmSync(path.join(BACKUPS_DIR, f), { force: true });
    for (const ext of SIDECAR_EXTS)
      fs.rmSync(path.join(BACKUPS_DIR, f + ext), { force: true });
  }
  console.log(`Pruned ${excess} old backup(s); keeping the latest ${KEEP}.`);
}

// Run only when invoked directly (tsx scripts/backup-db.ts [prefix]); importing
// this module (e.g. from restore) must not trigger a backup.
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) backupDb(process.argv[2] || "dev");
