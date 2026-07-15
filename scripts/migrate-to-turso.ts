// One-off: copy the local SQLite database up to Turso (cloud libSQL).
//
// Usage:
//   sqlite3 prisma/dev.db .dump > /tmp/dump.sql
//   npx tsx scripts/migrate-to-turso.ts /tmp/dump.sql
//
// The dump includes CREATE TABLE + all INSERTs + _prisma_migrations, so a fresh
// Turso database ends up schema-identical with migration history intact. After
// loading it prints per-table row counts so you can compare against the local
// counts (e.g. `sqlite3 prisma/dev.db "SELECT count(*) FROM Task;"`).
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const TABLES = [
  "User",
  "UserSettings",
  "Task",
  "Habit",
  "Event",
  "RecurringEvent",
  "TimeOff",
] as const;

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    throw new Error(
      "Usage: tsx scripts/migrate-to-turso.ts <dump.sql>  (make it with: sqlite3 prisma/dev.db .dump > dump.sql)",
    );
  }
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set (see .env).");
  if (!authToken) throw new Error("TURSO_AUTH_TOKEN is not set (see .env).");

  const dump = readFileSync(dumpPath, "utf8");
  const client = createClient({ url, authToken });

  console.log(`Loading ${dumpPath} into ${url} ...`);
  await client.executeMultiple(dump); // schema + data in one shot

  console.log("Done. Row counts in Turso:");
  for (const t of TABLES) {
    const r = await client.execute(`SELECT count(*) AS n FROM "${t}"`);
    console.log(`  ${t.padEnd(16)} ${r.rows[0].n}`);
  }
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
