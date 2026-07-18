// One-off: apply the `add_settings_timezone` migration to the live Turso DB.
//
// The Prisma-generated migration.sql rebuilds UserSettings via table-swap (how
// SQLite ALTERs columns); over the network against Turso we instead use libSQL's
// native `ALTER TABLE ... ADD COLUMN`, which is equivalent for a pure add and
// preserves the existing row. Idempotent: safe to run more than once.
//
// Usage: npx tsx scripts/apply-turso-timezone.ts
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";

const MIGRATION = "20260718011758_add_settings_timezone";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set (see .env).");
  if (!authToken) throw new Error("TURSO_AUTH_TOKEN is not set (see .env).");
  const client = createClient({ url, authToken });

  // 1. Add the column if it isn't there yet.
  const cols = await client.execute(`PRAGMA table_info("UserSettings")`);
  const hasTz = cols.rows.some((r) => r.name === "timezone");
  if (hasTz) {
    console.log("• timezone column already present — skipping ALTER");
  } else {
    await client.execute(
      `ALTER TABLE "UserSettings" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC'`,
    );
    console.log("✔ added UserSettings.timezone (default 'UTC')");
  }

  // 2. Record the migration in _prisma_migrations so history matches local.
  const migDir = join(process.cwd(), "prisma", "migrations", MIGRATION);
  const sql = readFileSync(join(migDir, "migration.sql"), "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const existing = await client.execute({
    sql: `SELECT id FROM "_prisma_migrations" WHERE migration_name = ?`,
    args: [MIGRATION],
  });
  if (existing.rows.length > 0) {
    console.log("• _prisma_migrations already has this migration — skipping");
  } else {
    const now = new Date().toISOString();
    await client.execute({
      sql: `INSERT INTO "_prisma_migrations"
              (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
            VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
      args: [crypto.randomUUID(), checksum, now, MIGRATION, now],
    });
    console.log("✔ recorded migration in _prisma_migrations");
  }

  // 3. Show the result.
  const rows = await client.execute(
    `SELECT userId, timezone FROM "UserSettings"`,
  );
  console.log("UserSettings now:");
  for (const r of rows.rows) console.log(`  ${r.userId} → ${r.timezone}`);
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
