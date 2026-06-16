# Flowtime — AI Smart Calendar

A self-contained clone of [Reclaim.ai](https://reclaim.ai): an AI-powered smart
calendar that **auto-schedules your tasks, habits, and focus time** around your
fixed meetings — and dynamically defends that time as your day fills up.

Built with **Next.js (App Router) + TypeScript + Tailwind + Prisma (SQLite)**.
The scheduling brain is a deterministic rule engine; an optional **Groq** LLM
layer adds natural-language convenience features on top.

## Features

- **Smart Calendar Canvas** — day/week views (FullCalendar) with drag, drop &
  resize. AI-placed blocks render translucent **"Free"** and turn solid
  **"Busy" / locked** as the time approaches (the signature Reclaim behavior).
- **AI Tasks** — give a task a duration, deadline, and priority; the engine
  chunks it and slots it into open time before the due date.
- **AI Habits** — recurring routines (Lunch, Gym, Standup…) scheduled inside
  their ideal time window at the right frequency (daily / weekdays / N-per-week).
- **AI Focus Time** — deep-work blocks auto-filled toward a weekly hours target.
- **Buffer & travel time** — automatic buffers around meetings so nothing is
  back-to-back.
- **Defend focus** — flexible blocks re-fit around new meetings on every replan.
- **Manual meetings** — drag-select on the calendar to create fixed events the
  engine schedules around.
- **Analytics** — donut + stacked weekly bars of how your time is distributed.
- **Drag-to-lock** — move a block and it locks; the rest of the day re-plans
  around it.

### Optional AI (Groq)

When `GROQ_API_KEY` is set, four LLM features light up (all degrade gracefully
to deterministic fallbacks when the key is absent — the app is fully functional
without it):

1. **Natural-language task entry** — “Finish report by Friday, ~3h, high”.
2. **“Plan my day” command** — natural-language calendar commands + reasoning.
3. **Daily insights** — a short work-life-balance note on the Planner.
4. **Smart prioritization** — suggests priority & duration for a task title.

## Getting started

```bash
npm install
cp .env.example .env          # DATABASE_URL is pre-filled; GROQ_API_KEY optional
npx prisma migrate dev        # create the SQLite database
npm run db:seed               # seed a demo user + sample data, then plan it
npm run dev                   # http://localhost:3000
```

To enable the AI features, add a free key from
[console.groq.com](https://console.groq.com) to `.env`:

```
GROQ_API_KEY=gsk_...
```

## Scripts

| Script             | Purpose                                  |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Start the dev server                     |
| `npm run build`    | Production build                         |
| `npm run db:seed`  | Reset & seed demo data, then auto-plan   |
| `npm run db:reset` | Drop, re-migrate and re-seed the DB      |
| `npm run db:studio`| Open Prisma Studio                       |

## Architecture

```
app/
  planner | tasks | habits | analytics   # pages (RSC fetch + client islands)
  api/                                    # tasks · habits · events · settings · plan · llm/*
components/                               # Sidebar, CalendarCanvas, ContextDrawer, forms, charts
lib/
  scheduler.ts   # pure, deterministic placement engine (the heart)
  time.ts        # free/busy timeline + gap-finding helpers
  plan.ts        # DB ↔ scheduler orchestration (used by /api/plan and the seed)
  groq.ts        # optional Groq layer with graceful fallbacks
  db.ts          # Prisma client + single-user resolver
prisma/          # schema.prisma + seed.ts
```

The engine (`lib/scheduler.ts`) is a pure function — no DB, no LLM — so it's
easy to reason about and test. `lib/plan.ts` wraps it: it reads the DB, treats
fixed meetings and any locked blocks as immovable, wipes the previously
generated flexible blocks, runs the engine, and writes the fresh schedule back.

## Postgres readiness

Local dev uses SQLite for zero setup. The schema avoids SQLite-only types and
stores enum-like fields as validated strings, so switching to Postgres is just a
matter of changing the `datasource` provider and `DATABASE_URL`.
