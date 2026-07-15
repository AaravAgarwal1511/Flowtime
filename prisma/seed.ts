import "dotenv/config"; // load .env before lib/db reads TURSO_* at module-eval
import { prisma, DEMO_USER_ID } from "../lib/db";
import { runPlan } from "../lib/plan";

function dateAt(offsetDays: number, hour: number, min = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, min, 0, 0);
  return d;
}

async function main() {
  // Idempotent: never clobber existing data. If the demo user is already
  // present, leave the database untouched. To force a fresh demo dataset,
  // run `npm run db:reset` (which drops the DB first, then reseeds).
  const existing = await prisma.user.findUnique({ where: { id: DEMO_USER_ID } });
  if (existing) {
    console.log(
      "Demo user already exists — leaving data untouched. " +
        "Run `npm run db:reset` to wipe and reseed from scratch.",
    );
    return;
  }

  await prisma.user.create({
    data: {
      id: DEMO_USER_ID,
      name: "Alex Rivera",
      email: "alex@reclaim-clone.dev",
      settings: {
        create: {
          workdayStartMin: 9 * 60,
          workdayEndMin: 17 * 60,
          workdays: "1,2,3,4,5",
          defaultBufferMin: 15,
          weeklyFocusTargetHours: 0, // standalone focus time off — tasks fill deep-work time
          lockHorizonHours: 24,
          planHorizonDays: 14,
        },
      },
    },
  });

  // --- Habits ---
  await prisma.habit.createMany({
    data: [
      {
        userId: DEMO_USER_ID,
        title: "Lunch",
        durationMin: 60,
        frequency: "DAILY",
        idealWindowStartMin: 12 * 60,
        idealWindowEndMin: 13 * 60 + 30,
        kind: "SOLO",
        color: "#f59e0b",
      },
      {
        userId: DEMO_USER_ID,
        title: "Review Emails",
        durationMin: 30,
        frequency: "WEEKDAYS",
        idealWindowStartMin: 9 * 60,
        idealWindowEndMin: 10 * 60 + 30,
        kind: "SOLO",
        color: "#0ea5e9",
      },
      {
        userId: DEMO_USER_ID,
        title: "Daily Standup",
        durationMin: 15,
        frequency: "WEEKDAYS",
        idealWindowStartMin: 9 * 60 + 30,
        idealWindowEndMin: 10 * 60 + 30,
        kind: "TEAM",
        color: "#8b5cf6",
      },
      {
        userId: DEMO_USER_ID,
        title: "Gym",
        durationMin: 60,
        frequency: "N_PER_WEEK",
        perWeek: 3,
        idealWindowStartMin: 17 * 60,
        idealWindowEndMin: 20 * 60,
        kind: "SOLO",
        color: "#10b981",
      },
    ],
  });

  // --- Tasks ---
  await prisma.task.createMany({
    data: [
      {
        userId: DEMO_USER_ID,
        title: "Finish quarterly report",
        notes: "Pull metrics, write summary, polish charts.",
        durationMin: 180,
        minChunkMin: 60,
        maxChunkMin: 120,
        due: dateAt(3, 17),
        priority: 1,
      },
      {
        userId: DEMO_USER_ID,
        title: "Prepare client presentation",
        durationMin: 120,
        minChunkMin: 45,
        maxChunkMin: 90,
        due: dateAt(5, 17),
        priority: 2,
      },
      {
        userId: DEMO_USER_ID,
        title: "Clear code review backlog",
        durationMin: 90,
        minChunkMin: 30,
        maxChunkMin: 60,
        due: dateAt(7, 17),
        priority: 3,
      },
      {
        userId: DEMO_USER_ID,
        title: "Write engineering blog post",
        durationMin: 120,
        minChunkMin: 45,
        maxChunkMin: 90,
        due: dateAt(10, 17),
        priority: 3,
      },
      {
        userId: DEMO_USER_ID,
        title: "Plan team offsite",
        durationMin: 60,
        minChunkMin: 30,
        maxChunkMin: 60,
        priority: 4,
      },
    ],
  });

  // --- Fixed meetings (immovable) ---
  await prisma.event.createMany({
    data: [
      {
        userId: DEMO_USER_ID,
        title: "Team Sync",
        start: dateAt(1, 11),
        end: dateAt(1, 12),
        type: "MEETING",
        flexible: false,
        state: "BUSY",
        color: "#475569",
      },
      {
        userId: DEMO_USER_ID,
        title: "1:1 with Manager",
        start: dateAt(1, 14),
        end: dateAt(1, 14, 30),
        type: "MEETING",
        flexible: false,
        state: "BUSY",
        color: "#475569",
      },
      {
        userId: DEMO_USER_ID,
        title: "Design Review",
        start: dateAt(2, 10),
        end: dateAt(2, 11),
        type: "MEETING",
        flexible: false,
        state: "BUSY",
        color: "#475569",
      },
      {
        userId: DEMO_USER_ID,
        title: "All Hands",
        start: dateAt(3, 15),
        end: dateAt(3, 16),
        type: "MEETING",
        flexible: false,
        state: "BUSY",
        color: "#475569",
      },
    ],
  });

  const result = await runPlan(DEMO_USER_ID);
  console.log(
    `Seeded demo user. Generated ${result.created} flexible blocks.` +
      (result.unscheduledTaskIds.length
        ? ` Unscheduled tasks: ${result.unscheduledTaskIds.length}.`
        : "") +
      (result.partialTaskIds.length
        ? ` Partial tasks: ${result.partialTaskIds.length}.`
        : ""),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
