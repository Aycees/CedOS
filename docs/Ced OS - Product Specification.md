# Ced OS — Product Specification

**Source of truth for product scope.** This document describes what Ced OS *is*, as a product: the apps it contains, what each does, and how it should behave — including edge cases. It intentionally excludes technical architecture, stack, and security implementation. Use this as the reference brief for building or extending the product.

---

## 1. What Ced OS is

A personal life-management platform — one place for a single person to plan, capture, track, and secure the different threads of their life: schedule, tasks, notes, journal, habits, money, travel plans, and credentials. Everything rolls up into a single "Home" dashboard so the user never has to open eight different apps to know what's going on.

**Product principles:**
- **One dashboard, many apps.** Home is the front door; every other app is a focused workspace for one kind of thing.
- **Personal, not team.** Single-user by design. No sharing, comments, or collaboration features unless explicitly scoped later.
- **Calm, not naggy.** No push notifications, streaks-guilt, or gamified pressure. Habits and budgets show status; they don't scold.
- **Everything is inspectable and editable.** No dead-end read-only views — anything shown can be opened and edited.
- **Scalable by construction.** New apps get added to the nav over time (see §10). The information architecture and interaction patterns below are meant to extend, not be redesigned per addition.

---

## 2. Information architecture

Left navigation is grouped by intent, not by app type:

- **Home** — Home (the dashboard)
- **Plan** — Calendar, Tasks
- **Capture** — Notes, Journal
- **Track** — Habits, Finance, Itinerary
- **Secure** — Vault
- **Settings** — pinned separately at the bottom, always visible

Nav groups are individually collapsible. Each app has a one-letter/glyph icon and, where relevant, a live badge (e.g. Home shows a count of today's events).

New apps are added by: choosing the nav group they belong to (or proposing a new one), giving them a header "+ new X" primary action if they support item creation, and a title/kicker pair for the page header — the same shape every existing app follows.

---

## 3. Home (dashboard)

**Purpose:** answer "what does today look like?" in one glance, and provide fast-entry points into the other apps. Holds no data of its own — it's a live rollup.

**Features:**
- Today's schedule: events pulled from Calendar, in time order, with their category color.
- Task snapshot: today's tasks from Tasks, with inline complete/incomplete toggle.
- Quick actions: "+ quick note" (opens Notes), "+ event" (opens Calendar's event modal) directly from the header.
- At-a-glance strip of other signals as the product grows (e.g. habits due today, budget status) — composed from each app's own summary logic, not duplicated data.

**Edge cases:**
- No events/tasks today: show a calm empty state, not a blank void ("nothing on the calendar today").
- Overdue/incomplete tasks from previous days: decide whether they roll forward into "today" or stay in their original section (currently: Tasks are bucketed by Today/This week/Someday, not by calendar date, so nothing can become "overdue" in the strict sense — a task just sits in its bucket until moved or completed).

---

## 4. Calendar

**Purpose:** scheduled events across life categories, viewable by month.

**Features:**
- **Categories ("calendars")**: none exist by default — the user creates every category themselves (new calendar = a name + a color swatch). Categories are also user-editable (rename, recolor) and deletable.
- **Filters**: toggle any category on/off to show/hide its events on the grid.
- Month grid view; each day cell shows its events, time-sorted.
- Event fields: title, date, time (optional — untimed/all-day events are supported), category.
- Create/edit/delete events via a modal, reachable from a day cell, the "+ new event" header action, or from Home.
- Itineraries can **push** their stops into Calendar as a batch of Travel-category events (see §9).

**Edge cases:**
- No categories yet (fresh account) — the calendar grid is empty and event creation should prompt the user to create a category first, rather than allowing an uncategorized event.
- All-day / untimed events (no time set) — sort before timed events, or list separately within the day.
- Deleting a category that still has events assigned — events need a fallback (e.g. become "uncategorized" or block deletion until reassigned; decide explicitly, don't silently orphan them).
- Multiple events at the same time on the same day — list stacks, no overlap-collision UI needed at this scale.
- Very event-dense days — day cell must truncate gracefully (e.g. "+3 more") rather than overflow the grid.
- Renaming/recoloring a category updates all its existing events' display immediately (color/label is a lookup, not copied per-event).

---

## 5. Tasks

**Purpose:** lightweight to-do list, separate from Calendar (undated commitments) and separate from Habits (one-off, not recurring).

**Features:**
- Three fixed buckets: **Today**, **This week**, **Someday** — not calendar-dated, just priority horizons.
- Each bucket: add via inline text input + Enter, check off to complete (strike-through style), remove.
- Each bucket shows a live "done/total" count.

**Edge cases:**
- Empty bucket — show the input affordance regardless, never hide a bucket for being empty.
- Completed tasks stay visible (struck through) rather than disappearing — user must explicitly remove them. Decide/confirm this is the desired permanence model as the app scales (vs. auto-archiving completed items after N days).
- No due-date or overdue concept exists yet by design — if a future version adds dates, reconcile with Calendar so a "task with a date" isn't a second parallel event system.

---

## 6. Notes

**Purpose:** freeform written notes with structure (headings, checklists, quotes, code, dividers) — for reference material, ongoing lists, reading notes, etc. Distinct from Journal, which is dated/diary-style.

**Features:**
- List view and grid view (toggle in header).
- Each note: title, tag (freeform, e.g. "school", "personal"), date, and a markdown-formatted body — headings, bold/italic, checklists (`- [ ]` / `- [x]`), blockquotes, inline code, horizontal rules.
- Edit mode (raw markdown) and preview mode (rendered), with an in-place editing toolbar (bold/italic/checklist/etc. insert selection-wrapping).
- Search/filter notes by title/tag/content.
- Create ("+ new note"), edit, delete.

**Edge cases:**
- Checklist items inside a note are per-note state, not synced to Tasks — a checklist in a note is content, not a task-tracker item; keep that boundary clear as the product grows (don't quietly merge the two systems).
- Switching from preview back to edit must not lose formatting fidelity (round-trip markdown ⇄ rendered HTML ⇄ markdown cleanly).
- Empty note body / empty title — allow save, show a placeholder title like "Untitled".
- Very long notes — grid view card should truncate/preview, not attempt to render full length.

---

## 7. Journal

**Purpose:** dated, diary-style personal writing. One entry generally corresponds to a day; unlike Notes, it's chronological and reflective rather than structured/reference.

**Features:**
- Reverse-chronological list of entries, each with a date and free-text body.
- Create ("+ new entry"), edit, delete.
- Plain prose — no markdown structure imposed (contrast with Notes' checklist/heading support).

**Edge cases:**
- Multiple entries on the same date — decide whether that's allowed (multiple check-ins per day) or entries are one-per-day (in which case creating a second same-day entry should either open the existing one or append rather than silently duplicate).
- Backdating an entry (writing today about yesterday) — support an editable date field, don't force "today" only.
- Very long entries — no length cap; list view should preview/truncate.

---

## 8. Habits

**Purpose:** recurring personal habit tracking with flexible cadence and completion types — distinct from Tasks (one-offs) and Calendar (scheduled events).

**Features:**
- **Cadence types**: daily (every day), specific weekdays (e.g. Mon–Fri), N times per week (e.g. "4x/week", not tied to specific days), and interval (e.g. "every 2 days" from an anchor date).
- **Completion types**: binary (done/not done) or count-based with a numeric target and unit (e.g. "8 glasses", "90 min", "20 pages"). Count-based habits can be partially completed (partial credit toward the day's score).
- **Time-of-day slot** per habit: morning / afternoon / evening / anytime — used to group the day's habit list.
- Color-coded per habit.
- Views: **today** (checklist due today) and a historical **grid/chart** view.
- Stats: current streak, best/longest streak, last-7-days completion rate — computed per habit and rolled up (e.g. "best streak across all habits").
- Skip vs. not-done distinction for a given day (a due-but-skipped habit is tracked differently from simply not logged).
- Archive a habit (soft-remove, keeps history) rather than hard delete; unarchive supported. Hard delete also available, separately.
- Create/edit via "+ new habit".

**Edge cases:**
- A habit "due today" under an N-times-per-week cadence isn't tied to a specific weekday — the UI must decide/communicate whether it's "due" every day until the weekly count is hit, or only flagged once behind pace.
- Interval cadence anchored to a specific start date — due-dates must recompute correctly across month/year boundaries and leap years.
- Changing a habit's cadence or target after history exists — past logged values shouldn't be silently reinterpreted against the new target (e.g. a habit retargeted from 20 to 30 pages/day shouldn't recolor old 20-page days as failures).
- Archiving a habit that's mid-streak — streak freezes/ends rather than silently continuing or erasing history.
- Count-based habit logged above target — treat as 100%+ complete, don't cap display oddly.
- No habits due on a given day (e.g. all weekday-only habits on a weekend) — today view shows a clear "nothing due" state, not an empty-looking error.

---

## 9. Finance ("Money")

**Purpose:** personal budget and spending tracker — accounts, transactions, budgets, and informal debts.

**Features:**
- **Accounts**: multiple accounts of different kinds (cash, e-wallet, bank), each with a name and running balance, "last used" timestamp. Create, edit, delete accounts.
- **Transactions**: date, name/description, category, account, amount (signed — negative for expenses, positive for income). Searchable and filterable by category.
- **Budgets**: per-category spending caps with a running "spent" amount and visual progress. Budgets can be **grouped** (e.g. a "Siargao trip" budget group containing Transportation/Food/Accommodation/Activities sub-budgets for that trip specifically) — groups are collapsible.
- **Recurring income**: an "allowance" figure tracked as expected periodic income.
- **Debts**: two lists — money the user is owed ("debts in") and money the user owes ("debts out") — each entry has a person, amount, note, and settled/unsettled status.
- Overview tab aggregating balances, budget status, and recent activity; can add a tab-per-concern (accounts, budgets, debts) as the app grows.

**Edge cases:**
- **Deleting an account that has transactions linked to it** — must warn explicitly before deleting ("has transactions linked to it, delete anyway?"), never silently orphan transaction history.
- **Deleting the only remaining account** — must be blocked ("you need at least one account") since the app assumes at least one account exists everywhere balances are shown.
- **Duplicate account names** — rejected at save time (case-insensitive match against existing accounts), with an inline error, not a silent overwrite.
- Account name required — empty name blocked with inline validation.
- A budget group total vs. its sub-budgets — the group should aggregate correctly and collapsing/expanding must not lose the sub-budget data.
- Settling a debt — should be reversible (unsettle) in case of mis-click, not a one-way action.
- Negative balances (overspending an account) — should render clearly (e.g. as a warning state) rather than silently showing a negative number with no visual distinction.
- Currency formatting — consistent thousands separators and a single currency symbol throughout (₱ in the current mockup); if multi-currency is ever needed, that's a scope decision, not an assumption to bake in silently.

---

## 10. Itinerary

**Purpose:** trip planning — day-by-day stop lists for upcoming (or past) travel.

**Features:**
- List of trips: place name, start date, end date.
- Per-trip, day-by-day **stops**: each stop has a time (optional — some stops are untimed, e.g. "day trip, decide the night before"), an activity description, a location, and a free-text note.
- Create/edit trips and stops via modals.
- **Push to Calendar**: converts a trip's stops into Travel-category Calendar events in one action, so the itinerary and the daily schedule stay in sync without manual re-entry. Re-pushing after edits should be idempotent (update, not duplicate) or clearly communicate it will create a fresh batch.

**Edge cases:**
- Stops with no set time — must sort sensibly within their day (e.g. before/after timed stops, or grouped separately) rather than defaulting to midnight and appearing first misleadingly.
- Multi-day trips spanning a month or year boundary — day-by-day breakdown must compute correctly across the boundary.
- A trip with zero stops yet (just place + dates, not planned in detail) — valid state, shown as "not planned yet" rather than broken.
- Editing trip dates after stops exist keyed to day-number — decide how day-numbered stops (Day 0, Day 1, Day 2…) remap if the trip is shortened/lengthened (e.g. stops beyond the new end date need explicit handling, not silent deletion).
- Pushing to calendar twice, or after editing stops post-push — define whether it updates existing pushed events or creates duplicates; duplicates are the failure mode to avoid.

---

## 11. Vault

**Purpose:** stores personal credentials (site, username, password, URL, notes) — the most sensitive app in the platform. Functionally this section covers *product* behavior only; encryption/security requirements live in the build planning doc, but the product-level rule is: **treat Vault as fundamentally higher-stakes than every other app, and never let a shortcut taken elsewhere (e.g. "just reuse the Notes modal") weaken it.**

**Features:**
- **Lock/unlock**: separate from general app access. Two unlock methods supported: 4-digit PIN or a master password. Locked by default on load (configurable).
- **Auto-lock on inactivity**: an idle timer (configurable duration) automatically re-locks the vault if the user is on the Vault screen without interaction (mouse/keyboard/scroll/click all count as activity).
- **Credential list**: searchable by site/username/category.
- **Categories**: Social, Finance, Work, Shopping, Entertainment, Other — filterable, color-coded, user-assignable per credential.
- **Credential fields**: site name, username, password, URL, category, freeform notes (e.g. "2FA via Authenticator app," "MPIN is separate — not stored here").
- **Reveal/hide password**: password is masked by default per-item; revealing is an explicit, per-item user action (never shown by default, never auto-revealed).
- Copy-to-clipboard for username/password, with a visible confirmation the copy happened.
- Create ("+ new credential"), edit, delete.

**Edge cases:**
- Wrong PIN/password entry — clear error messaging, input clears, no lockout-count exposed to the UI at the product level (rate-limiting, if any, is a security concern, not a UI feature to design around).
- Vault auto-locks *while mid-edit* of a credential — define behavior: discard the draft, or preserve it until next unlock. Losing sensitive typed data silently is bad; auto-saving an unsaved credential without confirmation is also risky — this needs an explicit decision.
- Deleting a credential — should require a confirmation step given the sensitivity and irreversibility.
- Duplicate entries for the same site (e.g. two Gmail accounts) — must be allowed (a person can have multiple accounts at the same service); don't dedupe by site name.
- Empty vault (no credentials yet) — calm empty state prompting "+ new credential", not an error.
- A note field accidentally containing another secret (e.g. a recovery code pasted into notes) — product-level awareness only; no special handling needed beyond treating the whole credential record as sensitive.

---

## 12. Settings

**Purpose:** personal preferences — not data of its own.

**Features:**
- **Theme**: Paper (light) and Dark modes.
- **Accent color**: user picks from a curated swatch set; applied across nav highlights, primary buttons, progress rings, etc.
- **Density**: Comfortable or Compact — adjusts spacing/padding platform-wide.
- **Account card**: name/avatar-initial, opens the Profile page.

**Edge cases:**
- Theme/accent/density changes must apply instantly and platform-wide, including inside open modals — no stale-themed surfaces.
- Contrast must hold across every accent choice, in both themes — an accent picked for Paper theme must not become illegible text-on-background in Dark theme.

### 12.1 Profile

**Purpose:** answer "who is this?" — the user's own identity record. Reached from the account card in Settings and from the sidebar avatar/name; not a separate nav item. Today this exists to identify the single user to themselves; it's built so it can later become the basis of a public-facing profile without rework.

**Fields:**
- **Name** — display name, shown in the sidebar and here.
- **Pronouns** — freeform, optional.
- **Birthday** — optional full date. **Age** is derived from it at render time, never stored — so it can't go stale. If birthday is unset, show "Birthday not set" rather than a blank/zero age.
- **Location** — freeform (e.g. city, country).
- **Email** — contact/account-level field.
- **Timezone** — freeform for now; matters once date-sensitive apps (Calendar, Habits) need to reconcile "today" across devices.
- **Bio** — short freeform text.
- Avatar — initial-letter avatar today (matches the sidebar); an uploaded photo is a natural future upgrade, not required now.

All fields are directly editable in place; there is no separate edit mode/modal for Profile (unlike other apps' create/edit flows, since this is a single record, not a list).

**Edge cases:**
- Empty name — sidebar/avatar should fall back to a placeholder initial rather than breaking, but Name should be treated as required for a sane identity display.
- No fields beyond Name are required — Profile must render cleanly with everything else blank.

**Future scope (when the platform opens to public profiles):** username/handle distinct from display name, per-field visibility toggles (e.g. show birthday without year), a public/private toggle for the whole profile, cover image, and social/website links. Not built now — flagged so the field set above doesn't need restructuring later.

---

## 13. Cross-cutting behaviors

- **Empty states everywhere.** Every app must have a real "you have nothing here yet" state — never a blank screen that looks broken, never placeholder/lorem content.
- **Every list is CRUD-complete.** If an app shows a list of things (events, notes, habits, credentials, trips…), the user can create, edit, and delete from that list — no read-only dead ends.
- **Destructive actions get confirmation** when the action is hard to undo or affects linked data (deleting an account with transactions, deleting the last account, deleting a vault credential).
- **Consistent header pattern**: kicker + title on the left, primary "+ new X" action (and secondary actions where relevant) on the right, per app.
- **Modals, not full-page navigation**, for create/edit flows (event, credential, habit, trip, account, budget, transaction) — keeps context (the list underneath) visible.

---

## 14. Scaling the platform — adding new apps

This platform is expected to grow. When adding a new app:

1. **Place it in an existing nav group** (Plan / Capture / Track / Secure) if it fits one of those intents; propose a new group only if it genuinely doesn't (e.g. a future "Health" group distinct from Track's current scope).
2. **Give it the standard shape**: a list/grid of its core entity, a create action in the header, modal-based create/edit, search/filter if the list can grow large, and a Home-dashboard contribution if it has anything worth surfacing at a glance.
3. **Classify its data sensitivity** up front (see the build planning doc's tiering) — most new apps are Tier 1/2 (personal but not Vault-grade); flag immediately if a new app would introduce Tier-0-grade secrets, since that changes its requirements substantially.
4. **Write its edge cases before building**, following the pattern in this document: empty states, deletion of referenced/linked data, boundary dates/values, and what happens when two features' data could overlap or conflict (e.g. Itinerary → Calendar, Habits vs. Tasks) — define which app owns the data and how the other reads/reflects it, rather than duplicating storage.
5. **Update this document** with the new app's section, and update the nav map in §2.

---

## 15. Explicitly out of scope (unless requested)

- Multi-user features: sharing, comments, collaboration, permissions between people.
- Notifications/reminders (push, email, SMS) — not currently part of the product's calm-by-design principle; revisit only if explicitly requested.
- Third-party integrations (bank sync, calendar import/export, external password manager import) — possible future scope, not assumed here.
- Gamification (points, badges, leaderboards) for habits or finance.
