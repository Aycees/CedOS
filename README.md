# Ced OS

A personal life-management platform — one place to plan, capture, track, and secure the different threads of your life: schedule, tasks, notes, journal, habits, money, travel, and credentials. Single-user by design, with everything rolled up into one Home dashboard.

## Features

- **Home** — a daily rollup of today's events, tasks, and other at-a-glance signals from every other app.
- **Calendar** — month-view scheduling with user-defined categories and color-coded events.
- **Tasks** — a lightweight to-do list bucketed by Today / This week / Someday.
- **Notes** — freeform markdown notes with checklists, headings, and tags.
- **Journal** — dated, diary-style entries.
- **Habits** — flexible-cadence habit tracking (daily, weekday, N-times-per-week, interval) with streaks and completion stats.
- **Finance** — accounts, transactions, grouped budgets, recurring income, and informal debts.
- **Itinerary** — trip planning with day-by-day stops, and a one-click push of stops into Calendar.
- **Vault** — encrypted credential storage, client-side only, with master-password unlock and optional PIN re-entry.
- **Settings** — theme, accent color, density, and profile.

See `docs/Ced OS - Product Specification.md` for full product detail and `docs/ced-os-system-design.md` for architecture and schema.

## Stack

Next.js (App Router) · Postgres via Supabase · Prisma · TanStack Query · Luxon · Tailwind CSS

## Getting started

**Prerequisites:** Node.js, [pnpm](https://pnpm.io), and Docker (for the local Supabase stack).

```bash
# install dependencies
pnpm install

# copy env template and fill in values printed by `supabase start`
cp .env.example .env

# start the local Supabase stack (Postgres, Auth, Studio)
pnpm db:start

# run migrations and seed data
pnpm prisma migrate dev
pnpm seed

# start the dev server
pnpm dev
```

The app runs at `http://localhost:3000`. Local Supabase uses shifted ports (API `54421`, DB `54422`, Studio `54423`) so it can coexist with other projects' stacks.

## Other commands

```bash
pnpm build          # production build
pnpm lint            # eslint
pnpm typecheck       # tsc --noEmit
pnpm test            # unit tests (vitest)
pnpm test:e2e        # end-to-end tests (playwright)
pnpm prisma studio   # browse the database
pnpm db:stop         # stop the local Supabase stack
```

## Project layout

```
src/
  app/            routes — (app)/ is the authenticated shell, api/ holds route handlers
  core/           db, auth, mutation, theme, ui, date, money, ids, errors, nav
  modules/<app>/  schema.ts (Zod) · service.ts (Prisma) · ui/
prisma/           schema.prisma, migrations, seed.ts
tests/e2e/        Playwright tests
docs/             product spec, technical decisions, system design
```

See `CLAUDE.md` for contribution rules and non-negotiables (ID generation, mutation flow, Vault isolation, money/date handling, etc.).
