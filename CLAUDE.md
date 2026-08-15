# Ced OS

Single-user life-management platform (calendar, tasks, notes, journal, habits, finance, itinerary, vault). Next.js App Router · Postgres/Supabase · Prisma · TanStack Query · Luxon · Tailwind.

## Source of truth

`docs/Ced OS - Product Specification.md` (product) · `docs/ced-os-technical-decisions.md` (decisions A–C) · `docs/ced-os-system-design.md` (schema, engines, build order). Read before changing anything. Never contradict them silently.

`design-reference/` is the design system, extracted from the `Ced OS.dc.html` mockup. `readme.md` there is binding on visual questions; `tokens/` holds the values; `components/core/*.prompt.md` records each primitive's intent. The mockup is a template DSL, not React — port from it, don't copy it.

## Non-negotiables

1. **IDs** — client-generated UUIDv7 via `newId()` in `core/ids.ts`. Never `crypto.randomUUID()`, never `@default`.
2. **Writes** — all mutations go through `core/mutation`. No component calls `fetch` directly.
3. **Vault is client-only.** No server component, RSC fetch, or route handler ever touches plaintext credentials.
4. **Money** — `Decimal(14,2)` server, `decimal.js` client. Never `Float`.
5. **Dates** — calendar dates are `@db.Date`; only instants use timestamptz. "Today" = user's `Profile.timezone` via Luxon.
6. **Prisma** — only `service.ts` imports it, always scoped by `userId` through `core/db/scope.ts`.
7. **Styling** — CSS variables only. Never hardcode a color or spacing value.

All seven are enforced by ESLint (`eslint.config.mjs`), not by memory. If a rule blocks you, that is the rule working — do not disable it without a comment saying why.

## Layout

```
src/
  app/            · routes. (app)/ is the authenticated shell; api/ holds route handlers
  core/           · db (client + scope), auth, mutation, theme, ui, date, money, ids, errors, nav
  modules/<app>/  · schema.ts (Zod) · service.ts (the ONLY Prisma consumer) · ui/
  generated/      · Prisma client, not hand-edited
prisma/           · schema.prisma, migrations, seed.ts
tests/e2e/        · Playwright, one test per product-spec edge case
```

Adding app #12 = one folder under `modules/` plus one entry in `core/nav/config.ts`. No cross-module imports except through a module's public interface.

## Commands

```
pnpm db:start                    # Supabase local stack (Docker must be running)
pnpm dev · pnpm build · pnpm lint · pnpm typecheck
pnpm test · pnpm test:e2e
pnpm prisma migrate dev · pnpm prisma studio · pnpm seed
```

Local Supabase runs on shifted ports (API 54421, DB 54422, Studio 54423) so it can coexist with another project's stack.

## Deviations from the planning documents

Both forced by dependency majors, not chosen:

- **Prisma 7** moved the connection URL out of `schema.prisma` into `prisma.config.ts` and requires a driver adapter (`@prisma/adapter-pg`) on the client. The system design's §3.1 `datasource` snippet no longer applies verbatim; the models are unchanged.
- **Tailwind v4** expresses the §6 token mapping in CSS (`@theme inline` in `src/styles/globals.css`) rather than a JS config. Radii are inlined as literals there because a theme key cannot self-reference a token of the same name.

Columns are `@map`ped to snake_case, not just tables — the system design's §6 raw SQL assumes snake_case columns, and hand-written SQL is permanent.

## Known issues

**Design-system contrast (open).** Building §6's contrast matrix over the four accents × two themes found several token pairs below WCAG AA. These are values inherited from `design-reference/tokens/colors.css`, not implementation bugs, so they have not been changed unilaterally:

| Pair | Where it shows | Ratio | Needs |
|---|---|---|---|
| `--muted` on `--bg`, paper | kickers, metadata, counts, empty-state lines | **2.93** | 4.5 |
| `--on-dark` on `--accent-default`, dark | primary button labels | **3.02–3.61** | 4.5 |
| `--accent-default` on `--card`, dark | "open calendar →" text links | **2.58–3.09** | 4.5 |

Kickers are 10.5px, so the first one is the most consequential. Resolving this means darkening `--muted` in the paper theme and lightening the accents in the dark theme — a change to the design system, which is the user's call.

## Working style

When a decision has a real tradeoff — schema shape, dependency, architecture — stop and present 2–3 options with pros and cons, then recommend one. Otherwise proceed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
