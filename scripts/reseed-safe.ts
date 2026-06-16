// Safe reseed WITHOUT `prisma migrate reset`: clears the demo user via the
// client (cascades), so the idempotent seed will repopulate full demo data.
import { prisma, DEMO_USER_ID } from "../lib/db";

(async () => {
  await prisma.user.deleteMany({ where: { id: DEMO_USER_ID } });
  console.log("Cleared demo user — run `npm run db:seed` to repopulate.");
  await prisma.$disconnect();
})();
