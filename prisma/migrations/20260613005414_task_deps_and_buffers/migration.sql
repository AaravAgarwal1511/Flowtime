-- CreateTable
CREATE TABLE "_TaskDeps" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TaskDeps_A_fkey" FOREIGN KEY ("A") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_TaskDeps_B_fkey" FOREIGN KEY ("B") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workdayStartMin" INTEGER NOT NULL DEFAULT 540,
    "workdayEndMin" INTEGER NOT NULL DEFAULT 1020,
    "workdays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "defaultBufferMin" INTEGER NOT NULL DEFAULT 15,
    "weeklyFocusTargetHours" INTEGER NOT NULL DEFAULT 12,
    "lockHorizonHours" INTEGER NOT NULL DEFAULT 24,
    "planHorizonDays" INTEGER NOT NULL DEFAULT 14,
    "minTaskDurationForBuffer" INTEGER NOT NULL DEFAULT 90,
    "minGapBetweenTaskChunks" INTEGER NOT NULL DEFAULT 15,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserSettings" ("defaultBufferMin", "id", "lockHorizonHours", "planHorizonDays", "userId", "weeklyFocusTargetHours", "workdayEndMin", "workdayStartMin", "workdays") SELECT "defaultBufferMin", "id", "lockHorizonHours", "planHorizonDays", "userId", "weeklyFocusTargetHours", "workdayEndMin", "workdayStartMin", "workdays" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "_TaskDeps_AB_unique" ON "_TaskDeps"("A", "B");

-- CreateIndex
CREATE INDEX "_TaskDeps_B_index" ON "_TaskDeps"("B");
