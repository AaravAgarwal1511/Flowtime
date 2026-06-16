import "dotenv/config";
import path from "node:path";

/**
 * Resolve the on-disk SQLite file from DATABASE_URL. Prisma resolves a relative
 * `file:` URL against the schema directory (prisma/), so we do the same.
 */
export const ROOT = process.cwd();
export const BACKUPS_DIR = path.resolve(ROOT, "prisma", "backups");
export const SIDECAR_EXTS = ["-wal", "-shm", "-journal"];

export function resolveDbPath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const rel = url.replace(/^file:/, "");
  if (path.isAbsolute(rel)) return rel;
  return path.resolve(ROOT, "prisma", rel.replace(/^\.\//, ""));
}
