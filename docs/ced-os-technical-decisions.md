# Ced OS — Technical Decision Log

**Status:** Blocks A–C complete. Blocks D–H pending.
**Companion to:** `Ced OS - Product Specification.md` (product source of truth)
**Purpose:** Records every technical decision made during requirements planning, with rationale. This document is the handoff brief for implementation. Where this document and the product spec disagree on a deferred question, this document wins — it exists to resolve the spec's explicit "decide this" markers.

---

## 0. Context and constraints

| Constraint | Value | Consequence |
|---|---|---|
| Tenancy | Single user now, multi-tenant-ready | `userId` on every table; real auth in v1 |
| Runtime | Web + installable PWA | Manifest + app-shell caching in v1 |
| Offline writes | Deferred to v2 | See §1 |
| Team | Solo + Claude Code | Modular monolith; heavy tests on engines |
| Scale | ~low thousands of rows/year | Scale is explicitly **not** a design criterion |
| UI source | Claude Design → plain HTML/CSS | Token extraction required before components |

**Selection rubric used throughout,** in priority order:

1. Maturity — years in production, stability of release cadence, quality of the migration story
2. Solo maintainability — what one person plus an AI agent can debug at 2am
3. Correctness primitives — native decimal, real date/interval types, transactional integrity
4. Escape hatches — how hard it is to leave, whether data walks out cleanly
5. Cost at idle

**Explicitly not criteria:** benchmark numbers, novelty, hiring market, "scales to millions."

---

## 1. Offline strategy

**Decision: ship v1 online-only. Keep the schema foundations, defer the machinery.**

Rationale — offline is two separable things with different cost curves. Schema foundations (client IDs, tombstones) are cheap now and brutal to retrofit against years of real data. The machinery (service worker, outbox, replay, conflict UI) is expensive now and merely tedious to retrofit, because it touches the data-access layer rather than the schema. Building it in v1 would also mean debugging an unstable sync layer against an unstable domain layer simultaneously, solo.

| Foundation | v1? | Reasoning |
|---|---|---|
| Client-generated UUIDv7 primary keys | **Yes** | Enables optimistic UI now; worst migration on this list if deferred |
| Tombstones (`deletedAt` on all user data) | **Yes** | Already implied by spec §13; also gives undo |
| Monotonic `syncVersion` column | No | `updatedAt` covers ~80% of delta-pull; additive later |
| Idempotency keys on mutations | No | Only meaningful once a replay queue exists |

**The load-bearing rule:** all writes go through a single typed mutation client. No component calls `fetch` directly. This is where validation, error handling, and cache invalidation live — and it is the seam where an outbox queue slots in for v2. Violating this rule is what turns v2 offline from a contained project into an archaeology dig.

**v2 target when built:** offline writes for Tasks, Habit logs, Journal, Notes (capture-oriented apps). Read-only offline for Calendar, Finance, Itinerary. **Vault excluded from offline entirely** — an encrypted local cache is a meaningfully harder security problem, revisit separately.

---

## 2. Resolved product decisions (Block A)

These resolve the ten points where the product spec says "decide explicitly."

### A1 · Deleting a Calendar category that owns events → **block, then preview, then choose**

Spec §4 forbids uncategorized events at creation, so an "uncategorized" fallback would contradict the creation rule. Deletion is therefore blocked at the schema level and resolved through an explicit flow.

**Flow:** attempting to delete a category with events opens a dialog that **lists the affected events**, not just a count. The user cannot reach either destructive option without seeing what is at stake.

- **List, don't just count.** Show title, date, and time per event. A bare *"42 events will be deleted"* gives the user no way to judge whether those 42 events matter.
- **Order by date descending** (most recent first). Recent events are the ones a user recognizes and cares about; the long tail of old events is what they are willing to lose.
- **Truncate at 10** with an expandable *"and 32 more"*, mirroring the day-cell truncation pattern in spec §4. The dialog must stay readable when a category owns hundreds of events.
- **Two exits:** *Move all to [category picker]* (default, non-destructive) or *Delete category and all 42 events* (destructive, visually secondary).
- Typed confirmation is **not** required. The list is the confirmation — spec §13 asks for a confirmation step, and having read the actual events is a stronger one than retyping a name.

**Empty case:** a category with zero events deletes with a simple confirm, no preview dialog.

**Schema:** `onDelete: Restrict` on the event→category FK. The database refuses the delete; the UI is what makes that refusal useful rather than an error message.

**Generalize this.** The same shape applies to deleting a Finance account with linked transactions (spec §9) and any future "delete a thing other things point at" case. Build one `<ImpactPreviewDialog>` in `core/` that takes a list of affected records and a reassign target, rather than writing this dialog per module.

### A2 · Untimed events → **separate "All day" band at top of day cell**

Primarily a storage decision: `eventDate` is a plain `date`, `startTime` is a nullable `time`. Not one nullable timestamp. This avoids the midnight-UTC trap where an untimed event silently becomes 00:00 and sorts first for the wrong reason.

### A3 · Completed tasks → **stay visible, auto-collapse after 7 days**

Preserves the spec's strikethrough behavior; never auto-deletes (would violate "everything is inspectable").
**Schema:** `completedAt DateTime?` instead of a boolean — the collapse rule falls out for free. Items completed >7 days ago move behind a "show completed" toggle within their bucket.

### A4 · Journal → **multiple entries per date allowed**

A unique constraint creates an error state in a calm, reflective app. Instead: creating an entry on a date that already has one shows a non-blocking *"you already wrote on this date — open it?"* hint.
**Schema:** index on `(userId, entryDate)`, **no** unique constraint.

### A5 · N-times-per-week habits → **"available" daily, "behind pace" only when forced**

A 4×/week habit shows as available every day, flipping to "needed today" only when remaining days in the week equal remaining completions. Shows status without scolding (product principle: calm, not naggy).
**New requirement this introduces:** a user-level **week start day** setting (Sun/Mon). Habits cannot compute a weekly window without it. Not in the product spec — add to Settings §12.

### A6 · Habit cadence/target → **versioned rows, not mutable fields** ⚠️ most consequential

Split into:
- `Habit` — identity: name, color, time-of-day slot
- `HabitSchedule` — cadence, target, unit, `effectiveFrom`, `effectiveTo`

Every log row **additionally snapshots** target and unit at log time. Streak and grid views join a log to the schedule effective *on that date*.

This is what makes spec §8's requirement — *"a habit retargeted from 20 to 30 pages shouldn't recolor old 20-page days as failures"* — actually true rather than aspirational. The cheaper alternative (snapshot on the log only) still answers *"was this habit due on that day?"* incorrectly whenever cadence changes.
**Cost:** one extra table, slightly more involved queries. Worth it.

### A7 · Itinerary → Calendar push → **upsert keyed by provenance**

`CalendarEvent.sourceStopId` (nullable, unique) references the originating stop. Re-pushing upserts on that key, making duplicates — the failure mode spec §10 explicitly names — structurally impossible.
Stops deleted after a push leave their events flagged as orphaned with a prompt, rather than silently vanishing, since the event may have been edited directly.

### A8 · Itinerary stops → **store absolute date; "Day 2" is derived**

Same principle as deriving age from birthday (spec §12.1). Shortening a trip leaves out-of-range stops visible in an "outside trip dates" bucket rather than silently deleted or ambiguously remapped. Storing `dayIndex` creates exactly the remapping problem the spec flags.

### A9 · Vault auto-lock mid-edit → **discard draft, but warn first**

At T−30s of the idle timer: *"Vault locks in 30 seconds — keep working?"* If it locks, the draft is gone. Preserving it would mean holding plaintext across the lock boundary, defeating the lock's purpose. The warning removes nearly all real-world pain.

### A10 · Currency → **single currency, but store the code**

`currency` (ISO 4217, default `PHP`) on Account and Transaction; app enforces a single value in v1. Costs nothing now, makes multi-currency a future *feature* rather than a *migration*.
Amounts as `Decimal(14,2)`. Never float, anywhere, ever.

---

## 3. Gaps not covered by the product spec

Still open — resolve during Block D.

1. **Account transfers (Finance).** Moving ₱2,000 cash → e-wallet is neither income nor expense. With only signed amounts it double-counts in budgets. Needs a transaction `type` enum (`INCOME`/`EXPENSE`/`TRANSFER`) plus a paired-row or transfer-group concept.
2. **Backup and export.** Not mentioned anywhere in the spec. Non-optional for a platform holding a personal journal and credentials — and it is also the escape hatch if the stack is ever abandoned.
3. **Account recovery.** Now real, given multi-tenant-ready auth. Includes the deliberate decision about what happens when the Vault master password is forgotten (honest answer is usually "the data is unrecoverable" — but that must be chosen, not stumbled into).
4. **Attachments.** Notes and Journal have no media support. Confirm intentional — far cheaper to design a slot for now than to add later.

---

## 4. Stack (Block C)

| Layer | Choice | Primary reason |
|---|---|---|
| Framework | **Next.js (App Router)** | Existing operator experience — rubric #2 |
| Database | **PostgreSQL** | Native decimal + real date/interval types |
| DB hosting | **Supabase** | Bundles auth + storage; plain Postgres underneath |
| ORM | **Prisma** | Mature migrations; schema doubles as living ERD |
| Auth | **Supabase Auth** | Recovery/verification/rate-limiting are more work than they look |
| Mutations | **Route Handlers + TanStack Query** | Serialized HTTP replays into an outbox; Server Actions do not |
| Dates | **Luxon** | Zone is part of the value, not ambient state |
| Styling | **Tailwind + shadcn as component source** | Radix behavior without inheriting shadcn's aesthetic |
| App hosting | **Vercel** | Zero-friction for Next; free at this scale |

### Locked without debate

| Concern | Choice | Why |
|---|---|---|
| Validation | Zod | One schema shared by route handler and form |
| Forms | React Hook Form + Zod resolver | Modal-heavy spec = many forms |
| Money on client | decimal.js | Never float |
| Unit tests | Vitest | Cadence engine needs heavy coverage |
| E2E | Playwright | One test per product-spec edge case |
| Vault crypto | WebCrypto + Argon2id (hash-wasm) | Detail in Block F |
| Background jobs | **None** | No notifications in scope — do not add a queue |

### Rejected alternatives worth recording

- **Vite SPA + separate API** — cleaner fit for an offline PWA, rejected because operator velocity in Next.js outweighs it for a solo project.
- **SQLite / Turso** — no native decimal type, weak date handling. Would have been tempting for a local-first Tier 3 design, which was deferred.
- **Server Actions** — best DX, but opaque RPC that does not serialize into a durable replay queue. Choosing it would have quietly spent the offline option that §1 exists to preserve.
- **Auth.js v5** — extended beta period; rubric #1.
- **Temporal API** — correct destination, spec still landing. Revisit in ~18 months.

---

## 5. Cross-cutting rules

### Security enforcement

Supabase's security model is Row Level Security, enforced via user JWT. **Prisma connects as a privileged role and bypasses RLS entirely.** Do not assume both layers are active.

**Decision: app-layer is primary, RLS is a backstop.**
- Every query flows through a data-access module requiring an explicit `userId`. No exceptions.
- Separately, enable RLS with **deny-all** policies on every table, so a leaked or misused anon key reads nothing.

### Vault isolation

**Vault is a client-only island.** No server component ever touches decrypted credential data. In practice: a `"use client"` boundary at the Vault route root, no RSC data fetching inside it. Hard rule, not a preference — easy to honor deliberately, easy to violate by accident.

**Two separate secrets with different lifecycles:**
- *Login password* — owned by Supabase Auth, recoverable via email.
- *Vault master password / PIN* — derived to a key in-browser, never transmitted, never recoverable.

This separation is what makes "forgot login password" recoverable and "forgot vault password" permanent — the correct behavior for a credential vault.

### Dates

Calendar dates (`eventDate`, `entryDate`, habit log dates) are stored as `date`. Only true instants use `timestamptz`. This is what makes A2 correct.

### Derived values

Age is derived from birthday, never stored (spec §12.1). Apply platform-wide: account balances, budget "spent", habit streaks, and itinerary day numbers are each either computed on read **or** materialized with an explicit invalidation path. Never both by accident.

---

## 6. Theming architecture

Spec §12 requires theme (Paper/Dark), accent color, and density (comfortable/compact) to apply instantly and platform-wide **including inside open modals**. Three orthogonal axes multiplying together — this only works if every surface reads CSS custom properties rather than hardcoded values.

- `[data-theme]` on `<html>` → light/dark palette variables
- `[data-accent]` → small set of accent variables
- `[data-density]` → spacing multiplier that the Tailwind spacing scale references

Tailwind config points at these variables rather than literal values.

**Consequence:** spec §12's edge case — *"an accent picked for Paper theme must not become illegible in Dark"* — becomes a contrast test over a finite token matrix, rather than a hunt through screenshots.

**First implementation task, before any component is written:** extract the Claude Design mockup's CSS into this token layer. This is the highest-value artifact in the Claude Design → Claude Code handoff.

**shadcn framing:** pull `dialog`, `select`, `popover`, `tabs`, `switch`, `dropdown-menu` for their Radix behavior (focus trapping, keyboard nav, ARIA), then immediately restyle to the mockup's tokens and delete shadcn's default look. shadcn is a component *source*, not the design system. Do **not** adopt its default theme and nudge it toward the mockup.

---

## 7. Module structure

Spec §14 says the platform grows by adding apps, so the layout makes that a copy-paste operation.

```
src/modules/{calendar,tasks,notes,journal,habits,finance,itinerary,vault}/
  schema.ts      · Zod schemas
  service.ts     · domain logic — the ONLY place that touches Prisma
  api.ts         · route handler bindings
  ui/            · components
src/core/        · db client, auth adapter, mutation client, date utils
```

Adding app #12 = one new folder plus one nav entry. No shared "god service." No cross-module imports except through a module's public interface.

Two modules deserve isolated, heavily-tested engines rather than logic smeared across handlers:
- **Habit cadence/streak engine** — interval anchors across DST/month/leap boundaries, N-per-week pace, skip vs. not-done
- **Itinerary ↔ Calendar sync engine** — provenance-keyed upsert, orphan detection

---

## 8. Risks on the record

| Risk | Exposure | Mitigation |
|---|---|---|
| Supabase coupling | Auth + DB + storage | Auth adapter isolated to one module; Postgres is portable via `pg_dump` |
| Next.js release churn | App Router conventions have shifted across majors | Pin the major; upgrade deliberately; keep domain logic in `service.ts` files that know nothing about Next |
| Habit date math | Highest bug density in the spec | Luxon + exhaustive Vitest coverage of boundary cases |
| Vault client-only rule | Violated by a single careless server import | Lint rule + explicit review checklist item |

---

## 9. Remaining blocks

**Complete.** Blocks D–H are documented in `ced-os-system-design.md`, which also resolves the four gaps in §3 above.

**All five of that document's §9 sign-off items were accepted as specified, and the product specification has been updated to match.** Implementation is underway: phases 0–2 of the build order are complete. See §10 of the system design for status.

- **G1 · Account transfers** → paired double-entry rows sharing a `transferGroupId`
- **G2 · Backup/export** → JSON export endpoint in v1; Vault as ciphertext by default
- **G3 · Recovery** → Supabase email reset for login; one-time recovery kit for Vault, no server-side recovery
- **G4 · Attachments** → deferred entirely; additive migration when needed

See §9 of that document for the five items still requiring sign-off, three of which are changes to the product specification itself.
