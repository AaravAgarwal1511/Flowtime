-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "flexible" BOOLEAN NOT NULL DEFAULT true,
    "state" TEXT NOT NULL DEFAULT 'FREE',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#5b5bd6',
    "sourceTaskId" TEXT,
    "sourceHabitId" TEXT,
    "sourceSeriesId" TEXT,
    "noBuffer" BOOLEAN NOT NULL DEFAULT false,
    "seriesOverride" BOOLEAN NOT NULL DEFAULT false,
    "seriesOriginalDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_sourceHabitId_fkey" FOREIGN KEY ("sourceHabitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_sourceSeriesId_fkey" FOREIGN KEY ("sourceSeriesId") REFERENCES "RecurringEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("color", "createdAt", "end", "flexible", "id", "locked", "sourceHabitId", "sourceSeriesId", "sourceTaskId", "start", "state", "title", "type", "userId") SELECT "color", "createdAt", "end", "flexible", "id", "locked", "sourceHabitId", "sourceSeriesId", "sourceTaskId", "start", "state", "title", "type", "userId" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE INDEX "Event_userId_start_idx" ON "Event"("userId", "start");
CREATE TABLE "new_RecurringEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "days" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "color" TEXT NOT NULL DEFAULT '#0e7490',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedDates" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RecurringEvent" ("active", "color", "createdAt", "days", "endMin", "id", "startMin", "title", "userId") SELECT "active", "color", "createdAt", "days", "endMin", "id", "startMin", "title", "userId" FROM "RecurringEvent";
DROP TABLE "RecurringEvent";
ALTER TABLE "new_RecurringEvent" RENAME TO "RecurringEvent";
CREATE INDEX "RecurringEvent_userId_idx" ON "RecurringEvent"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
