-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('PAPER', 'DARK');

-- CreateEnum
CREATE TYPE "Density" AS ENUM ('COMFORTABLE', 'COMPACT');

-- CreateEnum
CREATE TYPE "TaskBucket" AS ENUM ('TODAY', 'THIS_WEEK', 'SOMEDAY');

-- CreateEnum
CREATE TYPE "HabitTimeSlot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'ANYTIME');

-- CreateEnum
CREATE TYPE "HabitCadenceType" AS ENUM ('DAILY', 'WEEKDAYS', 'TIMES_PER_WEEK', 'INTERVAL');

-- CreateEnum
CREATE TYPE "HabitCompletion" AS ENUM ('BINARY', 'COUNT');

-- CreateEnum
CREATE TYPE "HabitLogStatus" AS ENUM ('LOGGED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('CASH', 'EWALLET', 'BANK');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DebtDirection" AS ENUM ('OWED_TO_ME', 'I_OWE');

-- CreateEnum
CREATE TYPE "IncomeCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "VaultUnlockMethod" AS ENUM ('PIN', 'MASTER_PASSWORD', 'BOTH');

-- CreateEnum
CREATE TYPE "VaultAuditAction" AS ENUM ('UNLOCK_SUCCESS', 'UNLOCK_FAILURE', 'ITEM_REVEALED', 'ITEM_DELETED', 'KEY_ROTATED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "email" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "pronouns" TEXT,
    "birthday" DATE,
    "location" TEXT,
    "contact_email" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "bio" TEXT,
    "user_id" UUID NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "theme" "Theme" NOT NULL DEFAULT 'PAPER',
    "accent_color" TEXT NOT NULL DEFAULT 'terracotta',
    "density" "Density" NOT NULL DEFAULT 'COMFORTABLE',
    "week_starts_on" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "user_id" UUID NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_categories" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "calendar_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "start_time" TIME(0),
    "location" TEXT,
    "note" TEXT,
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "source_stop_id" UUID,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "bucket" "TaskBucket" NOT NULL,
    "completed_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "user_id" UUID NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "title" TEXT NOT NULL DEFAULT '',
    "tag" TEXT,
    "note_date" DATE NOT NULL,
    "body" TEXT NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "entry_date" DATE NOT NULL,
    "body" TEXT NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habits" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "time_slot" "HabitTimeSlot" NOT NULL DEFAULT 'ANYTIME',
    "user_id" UUID NOT NULL,

    CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_schedules" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cadence_type" "HabitCadenceType" NOT NULL,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "times_per_week" INTEGER,
    "interval_days" INTEGER,
    "anchor_date" DATE,
    "completion_type" "HabitCompletion" NOT NULL DEFAULT 'BINARY',
    "target_value" DECIMAL(10,2),
    "unit" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "user_id" UUID NOT NULL,
    "habit_id" UUID NOT NULL,

    CONSTRAINT "habit_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_logs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "log_date" DATE NOT NULL,
    "status" "HabitLogStatus" NOT NULL DEFAULT 'LOGGED',
    "value" DECIMAL(10,2),
    "target_snapshot" DECIMAL(10,2),
    "unit_snapshot" TEXT,
    "user_id" UUID NOT NULL,
    "habit_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,

    CONSTRAINT "habit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "opening_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "last_used_at" TIMESTAMP(3),
    "user_id" UUID NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_categories" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "occurred_on" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "type" "TransactionType" NOT NULL,
    "transfer_group_id" UUID,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "category_id" UUID,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_groups" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "user_id" UUID NOT NULL,

    CONSTRAINT "budget_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "limit_amount" DECIMAL(14,2) NOT NULL,
    "period" "BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
    "period_start" DATE,
    "period_end" DATE,
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "group_id" UUID,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_incomes" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "cadence" "IncomeCadence" NOT NULL DEFAULT 'MONTHLY',
    "next_on" DATE NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "recurring_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debts" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "direction" "DebtDirection" NOT NULL,
    "person_name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "settled_at" TIMESTAMP(3),
    "user_id" UUID NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "place_name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_stops" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "stop_date" DATE NOT NULL,
    "start_time" TIME(0),
    "activity" TEXT NOT NULL,
    "location" TEXT,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "user_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,

    CONSTRAINT "itinerary_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_settings" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "kdf_salt" BYTEA NOT NULL,
    "kdf_memory_kib" INTEGER NOT NULL DEFAULT 65536,
    "kdf_iterations" INTEGER NOT NULL DEFAULT 3,
    "kdf_parallelism" INTEGER NOT NULL DEFAULT 1,
    "wrapped_dek" BYTEA NOT NULL,
    "wrapped_dek_iv" BYTEA NOT NULL,
    "recovery_dek" BYTEA,
    "recovery_dek_iv" BYTEA,
    "verifier" BYTEA NOT NULL,
    "verifier_iv" BYTEA NOT NULL,
    "unlock_method" "VaultUnlockMethod" NOT NULL DEFAULT 'MASTER_PASSWORD',
    "lock_on_load" BOOLEAN NOT NULL DEFAULT true,
    "auto_lock_seconds" INTEGER NOT NULL DEFAULT 300,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "user_id" UUID NOT NULL,

    CONSTRAINT "vault_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_items" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "user_id" UUID NOT NULL,

    CONSTRAINT "vault_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_audit_events" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "VaultAuditAction" NOT NULL,
    "item_id" UUID,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "user_id" UUID NOT NULL,

    CONSTRAINT "vault_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE INDEX "calendar_categories_user_id_deleted_at_idx" ON "calendar_categories"("user_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_source_stop_id_key" ON "calendar_events"("source_stop_id");

-- CreateIndex
CREATE INDEX "calendar_events_user_id_event_date_idx" ON "calendar_events"("user_id", "event_date");

-- CreateIndex
CREATE INDEX "calendar_events_category_id_idx" ON "calendar_events"("category_id");

-- CreateIndex
CREATE INDEX "tasks_user_id_bucket_sort_order_idx" ON "tasks"("user_id", "bucket", "sort_order");

-- CreateIndex
CREATE INDEX "notes_user_id_deleted_at_note_date_idx" ON "notes"("user_id", "deleted_at", "note_date");

-- CreateIndex
CREATE INDEX "notes_user_id_tag_idx" ON "notes"("user_id", "tag");

-- CreateIndex
CREATE INDEX "journal_entries_user_id_entry_date_idx" ON "journal_entries"("user_id", "entry_date");

-- CreateIndex
CREATE INDEX "habits_user_id_archived_at_deleted_at_idx" ON "habits"("user_id", "archived_at", "deleted_at");

-- CreateIndex
CREATE INDEX "habit_schedules_habit_id_effective_from_effective_to_idx" ON "habit_schedules"("habit_id", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "habit_schedules_habit_id_effective_from_key" ON "habit_schedules"("habit_id", "effective_from");

-- CreateIndex
CREATE INDEX "habit_logs_user_id_log_date_idx" ON "habit_logs"("user_id", "log_date");

-- CreateIndex
CREATE UNIQUE INDEX "habit_logs_habit_id_log_date_key" ON "habit_logs"("habit_id", "log_date");

-- CreateIndex
CREATE INDEX "accounts_user_id_deleted_at_idx" ON "accounts"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "transaction_categories_user_id_deleted_at_idx" ON "transaction_categories"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "transactions_user_id_occurred_on_idx" ON "transactions"("user_id", "occurred_on");

-- CreateIndex
CREATE INDEX "transactions_account_id_idx" ON "transactions"("account_id");

-- CreateIndex
CREATE INDEX "transactions_category_id_idx" ON "transactions"("category_id");

-- CreateIndex
CREATE INDEX "transactions_transfer_group_id_idx" ON "transactions"("transfer_group_id");

-- CreateIndex
CREATE INDEX "budget_groups_user_id_deleted_at_idx" ON "budget_groups"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "budgets_user_id_deleted_at_idx" ON "budgets"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "budgets_group_id_idx" ON "budgets"("group_id");

-- CreateIndex
CREATE INDEX "recurring_incomes_user_id_deleted_at_idx" ON "recurring_incomes"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "debts_user_id_direction_settled_at_idx" ON "debts"("user_id", "direction", "settled_at");

-- CreateIndex
CREATE INDEX "trips_user_id_start_date_idx" ON "trips"("user_id", "start_date");

-- CreateIndex
CREATE INDEX "itinerary_stops_trip_id_stop_date_sort_order_idx" ON "itinerary_stops"("trip_id", "stop_date", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "vault_settings_user_id_key" ON "vault_settings"("user_id");

-- CreateIndex
CREATE INDEX "vault_items_user_id_deleted_at_idx" ON "vault_items"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "vault_audit_events_user_id_created_at_idx" ON "vault_audit_events"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_categories" ADD CONSTRAINT "calendar_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "calendar_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_source_stop_id_fkey" FOREIGN KEY ("source_stop_id") REFERENCES "itinerary_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_schedules" ADD CONSTRAINT "habit_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_schedules" ADD CONSTRAINT "habit_schedules_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "habit_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_groups" ADD CONSTRAINT "budget_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "budget_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_incomes" ADD CONSTRAINT "recurring_incomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_stops" ADD CONSTRAINT "itinerary_stops_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_stops" ADD CONSTRAINT "itinerary_stops_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_settings" ADD CONSTRAINT "vault_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_audit_events" ADD CONSTRAINT "vault_audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================================================
-- Hand-written additions.
--
-- Five things Prisma cannot express in schema.prisma, per
-- docs/ced-os-system-design.md §6. Everything above this line is generated by
-- `prisma migrate dev`; everything below is maintained by hand and must be
-- carried forward if this migration is ever regenerated.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1 · Partial unique indexes for soft-delete compatibility.
--
-- A plain unique constraint interacts badly with soft delete: a soft-deleted
-- category named "Work" would block ever creating a new "Work". The WHERE
-- clause is what frees the name on delete; lower() implements the
-- case-insensitive duplicate rule from product spec §9.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "calendar_categories_user_name_uniq"
  ON "calendar_categories" ("user_id", lower("name"))
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "accounts_user_name_uniq"
  ON "accounts" ("user_id", lower("name"))
  WHERE "deleted_at" IS NULL;


-- ---------------------------------------------------------------------------
-- 2 · Exactly one active schedule per habit.
--
-- Decision A6 versions cadence and target over time. A habit with two open
-- schedule rows would make "which schedule was in effect on this date?"
-- ambiguous, which is the one question the whole design exists to answer.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "habit_schedules_one_active"
  ON "habit_schedules" ("habit_id")
  WHERE "effective_to" IS NULL;


-- ---------------------------------------------------------------------------
-- 3 · Full-text search over notes (product spec §6).
--
-- A generated column rather than a trigger: Postgres keeps it in sync on
-- every write with no application code to forget. Title is weighted above
-- body so a title match outranks a passing mention.
-- ---------------------------------------------------------------------------

ALTER TABLE "notes"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("body",  '')), 'B')
  ) STORED;

CREATE INDEX "notes_search_vector_idx" ON "notes" USING GIN ("search_vector");


-- ---------------------------------------------------------------------------
-- 4 · Check constraints the enums cannot cover.
--
-- Each of these encodes a rule that is otherwise only enforced in Zod, where
-- a bad migration or a direct SQL edit could bypass it.
-- ---------------------------------------------------------------------------

-- INTERVAL cadence is meaningless without an origin and a step.
ALTER TABLE "habit_schedules"
  ADD CONSTRAINT "habit_schedules_interval_requires_anchor"
  CHECK (
    "cadence_type" <> 'INTERVAL'
    OR ("anchor_date" IS NOT NULL AND "interval_days" IS NOT NULL AND "interval_days" > 0)
  );

-- WEEKDAYS cadence needs at least one weekday, and only ISO 1-7 are valid.
ALTER TABLE "habit_schedules"
  ADD CONSTRAINT "habit_schedules_weekdays_valid"
  CHECK (
    "cadence_type" <> 'WEEKDAYS'
    OR (
      array_length("weekdays", 1) BETWEEN 1 AND 7
      AND "weekdays" <@ ARRAY[1,2,3,4,5,6,7]
    )
  );

-- TIMES_PER_WEEK needs a count inside the week.
ALTER TABLE "habit_schedules"
  ADD CONSTRAINT "habit_schedules_times_per_week_valid"
  CHECK (
    "cadence_type" <> 'TIMES_PER_WEEK'
    OR ("times_per_week" IS NOT NULL AND "times_per_week" BETWEEN 1 AND 7)
  );

-- A COUNT habit without a target cannot be scored.
ALTER TABLE "habit_schedules"
  ADD CONSTRAINT "habit_schedules_count_requires_target"
  CHECK (
    "completion_type" <> 'COUNT'
    OR ("target_value" IS NOT NULL AND "target_value" > 0)
  );

-- A schedule version cannot end before it starts.
ALTER TABLE "habit_schedules"
  ADD CONSTRAINT "habit_schedules_effective_range"
  CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

-- A CUSTOM budget period (e.g. the Siargao trip) needs both bounds.
ALTER TABLE "budgets"
  ADD CONSTRAINT "budgets_custom_requires_period"
  CHECK (
    "period" <> 'CUSTOM'
    OR ("period_start" IS NOT NULL AND "period_end" IS NOT NULL AND "period_end" >= "period_start")
  );

-- A trip cannot end before it starts.
ALTER TABLE "trips"
  ADD CONSTRAINT "trips_date_range"
  CHECK ("end_date" >= "start_date");

-- G1: both legs of a transfer are type TRANSFER with no category, so that
-- budget and category reporting can exclude transfers with one predicate.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_transfer_shape"
  CHECK (
    ("type" = 'TRANSFER' AND "transfer_group_id" IS NOT NULL AND "category_id" IS NULL)
    OR ("type" <> 'TRANSFER' AND "transfer_group_id" IS NULL)
  );


-- ---------------------------------------------------------------------------
-- 5 · Row-level security: deny-all on every table.
--
-- Prisma connects as a privileged role and BYPASSES RLS entirely, so this is
-- not the app's security boundary — core/db/scope.ts is (decision log §5).
-- These policies exist purely as a backstop: enabling RLS with no policies
-- means a leaked or misused anon key reads nothing.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'profiles', 'user_settings',
    'calendar_categories', 'calendar_events',
    'tasks', 'notes', 'journal_entries',
    'habits', 'habit_schedules', 'habit_logs',
    'accounts', 'transaction_categories', 'transactions',
    'budget_groups', 'budgets', 'recurring_incomes', 'debts',
    'trips', 'itinerary_stops',
    'vault_settings', 'vault_items', 'vault_audit_events'
  ] LOOP
    -- ENABLE, deliberately not FORCE. FORCE would subject the table owner to
    -- these policies too, and the owner is the role Prisma connects as —
    -- which would lock the application out of its own data.
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
