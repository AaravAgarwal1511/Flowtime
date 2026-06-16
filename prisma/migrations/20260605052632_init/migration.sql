-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workdayStartMin" INTEGER NOT NULL DEFAULT 540,
    "workdayEndMin" INTEGER NOT NULL DEFAULT 1020,
    "workdays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "defaultBufferMin" INTEGER NOT NULL DEFAULT 15,
    "weeklyFocusTargetHours" INTEGER NOT NULL DEFAULT 12,
    "lockHorizonHours" INTEGER NOT NULL DEFAULT 24,
    "planHorizonDays" INTEGER NOT NULL DEFAULT 14,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "minChunkMin" INTEGER NOT NULL DEFAULT 30,
    "maxChunkMin" INTEGER NOT NULL DEFAULT 120,
    "due" DATETIME,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "scheduledMin" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "perWeek" INTEGER NOT NULL DEFAULT 3,
    "idealWindowStartMin" INTEGER NOT NULL DEFAULT 540,
    "idealWindowEndMin" INTEGER NOT NULL DEFAULT 1020,
    "kind" TEXT NOT NULL DEFAULT 'SOLO',
    "color" TEXT NOT NULL DEFAULT '#10b981',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_sourceHabitId_fkey" FOREIGN KEY ("sourceHabitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "Event_userId_start_idx" ON "Event"("userId", "start");
