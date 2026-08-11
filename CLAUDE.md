# Ced OS

Single-user life-management platform (calendar, tasks, notes, journal, habits, finance, itinerary, vault). Next.js App Router · Postgres/Supabase · Prisma · TanStack Query · Luxon · Tailwind.

## Source of truth

`Ced OS - Product Specification.md` (product) · `ced-os-technical-decisions.md` (decisions A–C) · `ced-os-system-design.md` (schema, engines, build order). Read before changing anything. Never contradict them silently.

## Non-negotiables

1. **IDs** — client-generated UUIDv7 via `uuidv7`. Never `crypto.randomUUID()`, never `@default`.
2. **Writes** — all mutations go through `core/mutation`. No component calls `fetch` directly.
3. **Vault is client-only.** No server component, RSC fetch, or route handler ever touches plaintext credentials.
4. **Money** — `Decimal(14,2)` server, `decimal.js` client. Never `Float`.
5. **Dates** — calendar dates are `@db.Date`; only instants use timestamptz. "Today" = user's `Profile.timezone` via Luxon.
6. **Prisma** — only `service.ts` imports it, always scoped by `userId`.
7. **Styling** — CSS variables only. Never hardcode a color or spacing value.

## Working style

When a decision has a real tradeoff — schema shape, dependency, architecture — stop and present 2–3 options with pros and cons, then recommend one. Otherwise proceed.

## Commands

```
pnpm dev · pnpm test · pnpm test:e2e
pnpm prisma migrate dev · pnpm prisma studio · pnpm seed
```
