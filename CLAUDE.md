# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A self-contained clone of Reclaim.ai — an AI smart calendar that auto-schedules tasks, habits, and focus time around fixed meetings. Single local user, no auth.

## Stack & environment gotchas

- **Next 16 (App Router) · React 19 · Tailwind v4 · Prisma 6 · SQLite.** These are newer than most training data — see `@AGENTS.md`.
- **Prisma is pinned to v6 on purpose.** The environment's `prisma init` pulls v7, which drops `url` from the schema and requires driver adapters (breaks `migrate`). Keep `prisma`/`@prisma/client` on `^6`, use the `prisma-client-js` generator, and keep `url = env("DATABASE_URL")` in the schema. There is no `prisma.config.ts` (deleted intentionally).
- **`prisma migrate reset` / `npm run db:reset` is blocked for AI agents** by a Prisma safety guard (needs explicit user consent via `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`). To refresh demo data without it, use the safe path: `npx tsx scripts/reseed-safe.ts` (clears the demo user) then `npm run db:seed`.
- **Don't run `next build` while `next dev` is running** — they share `.next/` and it causes flaky behavior. Stop the dev server first.
- **Runtime data lives on Turso (cloud libSQL), not `dev.db`.** `lib/db.ts` builds the Prisma client with the `@prisma/adapter-libsql` driver adapter from `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (required — it throws if the URL is missing). The schema is unchanged (`provider = "sqlite"`; `driverAdapters` is GA in Prisma 6, no preview flag). `DATABASE_URL`/`prisma/dev.db` remain **only** for the Prisma CLI, so `npm run db:studio`, `db:backup`, and `db:restore` operate on the **local** file, not the cloud. tsx scripts that import `lib/db` (seed, reseed-safe) must `import "dotenv/config"` first so the Turso vars load. To author a schema change: run `prisma migrate dev` locally against `dev.db`, then apply the new migration's SQL to Turso (e.g. `client.executeMultiple(...)` of the generated `migration.sql`, or `prisma migrate diff --script`). Initial data was moved up with `scripts/migrate-to-turso.ts`.

## Commands

```bash
npm run dev            # start dev server (http://localhost:3000)
npm run build          # production build (stop dev first); also the main type+lint gate
npm run lint           # eslint
npx tsc --noEmit       # standalone typecheck (includes scripts/)

npm run db:migrate     # prisma migrate dev (auto-backs-up first via predb:migrate)
npm run db:seed        # idempotent: NO-OP if the demo user already exists
npm run db:reset       # wipe + reseed (user-only; AI-blocked) — auto-backs-up first
npm run db:studio      # Prisma Studio

npm run db:backup      # snapshot prisma/dev.db -> prisma/backups/ (rotates, keeps 10)
npm run db:restore     # restore newest snapshot (-- --list to list, -- <file> to pick)
```

There is no test runner. "Verifying" means: `npx tsc --noEmit` + `npm run build` + exercising the running app's API (curl `/api/*`) or headless-Chrome screenshots.

## Architecture

The core is a **pure scheduling engine** wrapped by a **DB orchestrator**, driven by API routes and a seed:

- **`lib/scheduler.ts` — `planHorizon(now, settings, fixed, tasks, habits, timeOff)`**: pure, deterministic, synchronous (no DB/LLM). Builds a 15-min free/busy timeline over the horizon and places blocks in priority order: meeting **buffers → habits → focus time → tasks**. Emits `GeneratedBlock[]` plus unscheduled/partial task ids. Two key behaviors: **Free→Busy locking** (blocks starting within `lockHorizonHours` become `state:"BUSY"` + `locked:true`), and **time-off suppression** (focus + habits are skipped inside any time-off interval).
- **`lib/plan.ts` — `runPlan(userId)`**: the only bridge between DB and engine. Treats fixed events (`flexible:false`) and any `locked` block as immovable, **wipes regenerable blocks** (`flexible && !locked`, plus focus/habit inside time-off ranges), runs `planHorizon`, writes the result, and updates task `status`. Used by `POST /api/plan`, `POST /api/llm/command`, and `prisma/seed.ts`.
- **`lib/time.ts`**: interval/gap helpers the engine relies on (working windows, `findGaps`, `subtractBusy`, week keys).

**The replan model is the thing to understand:** calendar blocks are *derived*, not durable. Generated blocks (focus/habit/task/buffer) are recreated on every plan from their sources (Tasks, Habits, weekly focus target). Deleting a block then replanning just regenerates it — to remove one for good you delete/pause its **source** (Task/Habit) or lock it. This is why the context drawer offers source-aware actions (`components/ContextDrawer.tsx`).

**Data flow:** pages under `app/{planner,tasks,habits,analytics}/` are RSC and fetch directly via Prisma. Client components mutate through `app/api/*` route handlers, then call `POST /api/plan` and `router.refresh()` (or refetch) to re-derive the schedule. Most mutating endpoints do NOT replan themselves — the client triggers it.

**Single user:** everything resolves through `DEMO_USER_ID` in `lib/db.ts` (`getCurrentUser`, `getSettings`). No sessions.

**Enum-like fields are strings, validated with Zod** at the API boundary (`lib/types.ts`) — SQLite has no native enums and this keeps the schema Postgres-compatible. Client-safe types/formatters live in `lib/ui.ts` (never import `lib/db`/Prisma there).

**Groq LLM (`lib/groq.ts`) is optional.** All four `/api/llm/*` routes work without `GROQ_API_KEY` via deterministic fallbacks (e.g. a regex parser for NL task entry). Gate any LLM use behind `isGroqEnabled()` and always provide a fallback.

## Data model (`prisma/schema.prisma`)

`User` → `UserSettings` (work hours, buffer, weekly focus target, lock/plan horizons), `Task` (duration, min/max chunk, due, priority 1–4, status), `Habit` (frequency DAILY/WEEKDAYS/N_PER_WEEK, ideal window, kind), `Event` (the concrete block: type, `flexible`, `state`, `locked`, optional `sourceTaskId`/`sourceHabitId`), `TimeOff` (away ranges; `start` inclusive, `end` exclusive). The local DB lives at `prisma/dev.db`; `prisma/backups/` and `*.db` are gitignored.
