# Ced OS — Remaining build plan (phases 8–10 + wrap-up)

Handoff document. Phases 0–7 are built and committed on `feat/foundation`.
This file is the working plan for a fresh session; it is not a source-of-truth
document — `docs/ced-os-system-design.md` still is.

---

## Where things stand

Branch `feat/foundation`, cut from `main`, **unmerged by instruction**.

| Commit | Phase |
|---|---|
| `9d21197` | 0–2 · Foundation, core, Tasks, Journal |
| `735de66` | 3 · Calendar — categories, events, A1 delete flow |
| `5a48d57` | 4 · Notes — markdown round-trip, tsvector search |
| `03c6899` | 5 · Habits — cadence engine, then UI |
| `ec392b5` | 6 · Finance — accounts, transactions, transfers, budgets, debts |
| `78693b2` | 7 · Itinerary — trips, stops, calendar sync engine |

Green at `78693b2`: **63 Vitest · 61 Playwright · clean `build`, `lint`, `typecheck`.**

Already in place and reusable, so do not rebuild them:

- `core/mutation` — `route()`/`readRoute()` server side, `api.{get,post,patch,delete}` client side. Reads DELETE bodies as well as query strings.
- `core/errors` — `AppError`, code enum, `userMessage()` (shows the first field detail for `VALIDATION_ERROR`, the message itself otherwise).
- `core/ui` — Button (`solid|outline|ghost|dashed`), Card, Chip, Input, Textarea, Segmented, Modal + ModalActions, PageHeader, ImpactPreviewDialog.
- `core/db/scope.ts` — `live()`, `owned()`, `includingDeleted()`, `assertOwned()`; every helper demands an explicit `userId`.
- `core/date` (Luxon, `Profile.timezone`), `core/money` (decimal.js, ₱), `core/ids` (`newId()` → uuidv7).
- `tests/e2e/reset.ts` — wipes the e2e account's module data before each run; called from `auth.setup.ts`. **Any new tables need a line added here in FK order**, or tests will accumulate state and flake.

The module shape every phase follows:

```
src/modules/<app>/
  schema.ts   · Zod, shared by route handler and form
  service.ts  · the ONLY Prisma consumer
  engine/     · pure functions, no I/O (only habits + itinerary have one)
  ui/         · client components
src/app/(app)/<app>/page.tsx      · server component, fetches initial data
src/app/api/<app>/<resource>/route.ts
```

Then flip `built: true` in `src/core/nav/config.ts`.

---

## Phase 8 · Vault

The schema already exists (`VaultSettings`, `VaultItem`, `VaultAuditEvent` in
`prisma/schema.prisma`) and the ESLint rule banning server/DB imports under
`src/modules/vault/ui/**` is already active. `src/modules/vault/ui/` is an
empty directory and `src/app/(app)/vault/page.tsx` is the "not built yet" stub.

### The rules that cannot bend

From system design §4 and `CLAUDE.md` non-negotiable #3:

1. **No plaintext ever reaches a route handler.** Handlers accept and return `ciphertext` + `iv` bytes only. A Vault handler that can see a password is a bug by definition.
2. `"use client"` at the Vault route root. No RSC fetch, no server component, anywhere beneath it.
3. **The DEK lives in a module-scoped JS variable.** Never `localStorage`, never `sessionStorage`, never React state — React state can land in a serialized payload.
4. All search, filter and sort is **client-side**, over the decrypted in-memory array (§4.1 decision C — the whole record is sealed, including category).
5. The master password is **not recoverable**. Say so in the setup UI, plainly.

### 8.1 Crypto layer — `src/modules/vault/crypto/`

Pure and unit-testable. Install `hash-wasm` (Argon2id); everything else is WebCrypto.

```ts
// key.ts
deriveKek(password: string, salt: Uint8Array, params: KdfParams): Promise<CryptoKey>
wrapDek(dek: CryptoKey, kek: CryptoKey): Promise<{ ciphertext, iv }>
unwrapDek(wrapped, iv, kek): Promise<CryptoKey>
generateDek(): Promise<CryptoKey>
// item.ts
sealItem(plain: VaultItemPlain, dek): Promise<{ ciphertext, iv }>
openItem(ciphertext, iv, dek): Promise<VaultItemPlain>
// verifier.ts
makeVerifier(kek), checkVerifier(verifier, iv, kek): Promise<boolean>
// recovery.ts
generateRecoveryKit(): string          // 256-bit, grouped for transcription
deriveRkek(kit: string): Promise<CryptoKey>   // HKDF
```

Argon2id parameters live in `VaultSettings` (`m=64MiB, t=3, p=1` defaults are
already columns) so they can be raised later without a migration.

Vitest cases worth having: round-trip seal/open; wrong password fails the
verifier and never reaches `openItem`; recovery kit unwraps the same DEK the
password does; changing the master password rewraps the DEK without touching a
single item (that O(1) rewrap is the reason for envelope encryption at all).

### 8.2 Service + routes — ciphertext only

`src/modules/vault/service.ts`

- `getSettings(userId)` — returns salt, KDF params, wrapped DEK, verifier. Safe: all useless without the password.
- `initVault(userId, input)` — writes `VaultSettings` once. Reject if one exists.
- `rewrapDek(userId, input)` — master-password change; replaces `wrappedDek`/`verifier`/`kdfSalt` atomically.
- `listItems(userId)` / `upsertItem` / `softDeleteItem` — blobs in, blobs out.
- `recordAudit(userId, action, itemId?)` — `UNLOCK_SUCCESS`, `UNLOCK_FAILURE`, `ITEM_REVEALED`, `ITEM_DELETED`, `KEY_ROTATED`. No FK on `itemId` by design, so the trail outlives the item.

Routes under `src/app/api/vault/{settings,items,audit}/route.ts`, all through
`route()` from `core/mutation`. Zod schemas encode ciphertext as base64
strings; convert to `Buffer` in the service, never in the handler.

### 8.3 Session — `src/modules/vault/ui/session.ts`

Module-scoped, not a React store:

```ts
let dek: CryptoKey | null = null;
let items: VaultItemPlain[] = [];
```

Expose `unlock()`, `lock()`, `getDek()`, `useVaultSession()` (a `useSyncExternalStore`
subscription that exposes *locked/unlocked* and the decrypted list, but never
the key itself). `lock()` nulls the DEK, empties `items`, and notifies.

### 8.4 PIN — device-local only (§4.3)

- First unlock on a device **always** requires the master password.
- Enabling a PIN: generate a high-entropy device secret, store it in IndexedDB, wrap the DEK under `PBKDF2(pin + deviceSecret)`, store that wrapped copy in IndexedDB too. **Nothing goes to the server.**
- Count failures client-side; at 5, delete the IndexedDB record entirely and fall back to the master password.
- Product spec §11 says not to expose a lockout count in the UI — show a clear error, clear the input, and say nothing about attempts remaining.

### 8.5 Auto-lock (§4.5, decision A9)

Idle timer, activity = mouse/keyboard/scroll/click, **only while the Vault route
is mounted**. Warn at T−30s with a "still there?" affordance. On lock: discard
any open draft (A9 — decided; do not add an "unsaved changes" prompt), zero the
DEK, clear the items array, return to the lock screen.

### 8.6 UI

- **Setup** (no `VaultSettings` yet) — set master password, generate the recovery kit, display it once with an explicit "I've saved this" confirmation, and state that losing both means the credentials are gone forever.
- **Lock screen** — master password, or PIN when this device has one.
- **List** — client-side search over site/username/category, category chips (Social, Finance, Work, Shopping, Entertainment, Other) with color coding. Duplicates by site are legal (two Gmail accounts) — never dedupe.
- **Item modal** — site, username, password, URL, category, notes. Password masked by default; reveal is explicit and per-item, and logs `ITEM_REVEALED`. Copy-to-clipboard for username and password with a visible confirmation.
- **Delete** — confirmation step, per spec §13.
- **Empty state** — calm, prompting `+ new credential`.

### 8.7 Playwright (spec §11 edge cases)

Setup → lock → unlock round-trip; wrong password shows an error and clears the
input; auto-lock mid-edit discards the draft; two credentials for the same site
both persist; delete asks first; empty vault reads calm.

**Add `vault_audit_events`, `vault_items`, `vault_settings` to `tests/e2e/reset.ts`.**

A test worth writing even though it isn't a product edge case: assert that the
`/api/vault/items` response body contains no plaintext — read it in the test and
check the credential's password string does not appear.

---

## Phase 9 · Home

Pure composition (spec §3). The dashboard already exists in skeleton form at
`src/app/(app)/page.tsx` with only the Tasks snapshot real; the rest is
placeholder waiting for the modules that now exist.

- **Today's schedule** — from `modules/calendar/service`, time order, category color, untimed events grouped first (A2, same rule as the list view).
- **Task snapshot** — today's bucket with an inline complete toggle (already built; keep it).
- **Quick actions in the header** — `+ quick note` and `+ event`, reusing `NoteModal` and `EventModal` directly rather than reimplementing them.
- **At-a-glance strip** — habits due today (`modules/habits/service`), budget status (`modules/finance/service`), next trip if one is upcoming. Each number comes from that module's own summary function; **do not add a Home service that queries tables itself.**
- **Empty state** — "nothing on the calendar today", per card, not one blank void.

Flip Home to `built: true` in `core/nav/config.ts`.

Playwright: an empty day renders calm empty states in every card; completing a
task from Home updates the count without a reload.

---

## Phase 10 · PWA + export

**Manifest** — `src/app/manifest.ts`, name/short_name/theme_color from the token
values (`--bg` per theme), icons, `display: "standalone"`.

**App-shell caching** — a service worker caching the shell and static assets.
Do **not** cache API responses; there is no offline write story in v1 and the
mutation client is the seam an outbox slots into later (decision log §1). Keep
that seam clean rather than half-implementing offline here.

**JSON export (G2)** — one authenticated route producing a single file of all
modules.

- Vault is exported **as ciphertext by default**.
- A separate "include decrypted credentials" toggle requires re-entering the master password, decrypts **in the browser**, and produces a clearly-labeled plaintext file. The server never assembles that version — the ciphertext export plus a client-side decrypt pass is the only correct shape.
- No scheduled backup (needs a job runner; ruled out for v1).

Surface both from Settings.

---

## Wrap-up before merge

1. `pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` from a clean state.
2. `pnpm prisma migrate reset` then `pnpm seed` — migrations must apply from scratch, not just incrementally.
3. Walk the §8.3 acceptance criteria: roughly 45 Playwright tests, one per product-spec edge case in §3–§12. Count what exists against the spec and note any gaps in the PR body.
4. Update `CLAUDE.md` — remove "Known issues" entries that get resolved; keep the ones that don't.
5. Push `feat/foundation` and open the PR. **Do not merge to `main` without explicit approval.**

---

## Open decisions — mine to raise, yours to make

These are carried forward unresolved. None of them block phases 8–10.

**1 · Design-system contrast (from `CLAUDE.md`).** Three token pairs fail WCAG AA.
They are inherited from `design-reference/tokens/colors.css`, so changing them
is a change to the design system.

| Pair | Where | Ratio | Needs |
|---|---|---|---|
| `--muted` on `--bg`, paper | kickers, metadata, counts, empty states | 2.93 | 4.5 |
| `--on-dark` on `--accent-default`, dark | primary button labels | 3.02–3.61 | 4.5 |
| `--accent-default` on `--card`, dark | text links | 2.58–3.09 | 4.5 |

Kickers render at 10.5px, which makes the first the one that actually matters.

**2 · Finance — opening balance on account deletion.** Deleting an account and
reassigning its transactions moves the transactions but not the deleted
account's opening balance, so money disappears from the total. Reassigning is
not merging, and the dialog only promises to move transactions — but the number
still changes. Options: leave it (current), carry the opening balance over as an
adjustment transaction, or say so explicitly in the dialog.
