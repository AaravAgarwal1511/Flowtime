import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

// Runtime is Turso (cloud libSQL) via the Prisma libSQL adapter. The datasource
// `url` in schema.prisma (DATABASE_URL) is only used by the Prisma CLI; at
// runtime every query flows through this adapter instead.
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL is not set — this app requires Turso. See .env.example.",
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaLibSQL({ url, authToken }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Single-user app: every server query resolves "the current user" through this
 * helper. The seeded user has a fixed id so no auth/session is required.
 */
export const DEMO_USER_ID = "demo-user";

export async function getCurrentUser() {
  const user = await prisma.user.findUnique({
    where: { id: DEMO_USER_ID },
    include: { settings: true },
  });
  if (!user) throw new Error("Demo user not found — run `npm run db:seed`.");
  return user;
}

export async function getSettings() {
  const settings = await prisma.userSettings.findUnique({
    where: { userId: DEMO_USER_ID },
  });
  if (!settings) throw new Error("Settings not found — run `npm run db:seed`.");
  return settings;
}
