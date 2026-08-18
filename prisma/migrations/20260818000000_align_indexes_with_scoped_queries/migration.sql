-- Aligns the indexes with the queries the app actually issues.
--
-- Every read of user-generated data goes through core/db/scope.ts's `live()`,
-- which expands to `{ userId, deletedAt: null, ...extra }`. So `deleted_at` is
-- an unconditional predicate on all of these tables, but most of the original
-- composite indexes either omitted it or buried it behind a column that is
-- never filtered on — leaving Postgres to filter rows it should never have
-- read. Each index below is reordered to lead with the columns that are
-- always in the WHERE clause, and to end with the column being ordered by.
--
-- Two are more than a reordering:
--   · debts led with `direction`, which no query filters on (listDebts only
--     scopes by user and orders by settled_at; direction is split in JS).
--   · transactions gains a (user_id, category_id, occurred_on) index, which is
--     what the budget-spend rollup groups by.
--
-- tasks keeps `bucket`: unlike `direction`, it IS a real predicate
-- (listBucket filters `live(userId, { bucket })`), so it stays — just behind
-- deleted_at now.

-- calendar_events: listEventsInMonth / listEventsOnDate / countTodayEvents
DROP INDEX "calendar_events_user_id_event_date_idx";
CREATE INDEX "calendar_events_user_id_deleted_at_event_date_idx" ON "calendar_events"("user_id", "deleted_at", "event_date");

-- journal_entries: listEntries, reverse-chronological
DROP INDEX "journal_entries_user_id_entry_date_idx";
CREATE INDEX "journal_entries_user_id_deleted_at_entry_date_idx" ON "journal_entries"("user_id", "deleted_at", "entry_date");

-- tasks: listBucket filters on bucket; countOpenTasks filters on completed_at
-- and runs on every authenticated page render.
DROP INDEX "tasks_user_id_bucket_sort_order_idx";
CREATE INDEX "tasks_user_id_deleted_at_bucket_sort_order_idx" ON "tasks"("user_id", "deleted_at", "bucket", "sort_order");
CREATE INDEX "tasks_user_id_deleted_at_completed_at_idx" ON "tasks"("user_id", "deleted_at", "completed_at");

-- habits: deleted_at is always filtered, archived_at only sometimes
DROP INDEX "habits_user_id_archived_at_deleted_at_idx";
CREATE INDEX "habits_user_id_deleted_at_archived_at_idx" ON "habits"("user_id", "deleted_at", "archived_at");

-- debts: direction is never a WHERE predicate
DROP INDEX "debts_user_id_direction_settled_at_idx";
CREATE INDEX "debts_user_id_deleted_at_settled_at_idx" ON "debts"("user_id", "deleted_at", "settled_at");

-- transactions: the month window, plus the per-category budget rollup
DROP INDEX "transactions_user_id_occurred_on_idx";
CREATE INDEX "transactions_user_id_deleted_at_occurred_on_idx" ON "transactions"("user_id", "deleted_at", "occurred_on");
CREATE INDEX "transactions_user_id_category_id_occurred_on_idx" ON "transactions"("user_id", "category_id", "occurred_on");

-- trips: listTrips, ordered by start_date
DROP INDEX "trips_user_id_start_date_idx";
CREATE INDEX "trips_user_id_deleted_at_start_date_idx" ON "trips"("user_id", "deleted_at", "start_date");
