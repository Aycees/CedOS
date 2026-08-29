-- Hardening follow-up from code review on the debt ledger transfers change.
--
-- getOrCreateDebtsAccount's create() could collide with a real account a
-- user already named "Debts" (accounts_user_name_uniq didn't distinguish
-- system from real accounts), and its check-then-create had no DB-level
-- guard against a race producing two hidden accounts for the same user.

-- The per-user name-uniqueness constraint only makes sense for real,
-- user-named accounts -- the hidden system account sharing a name with one
-- isn't a meaningful collision.
DROP INDEX "accounts_user_name_uniq";
CREATE UNIQUE INDEX "accounts_user_name_uniq"
  ON "accounts" ("user_id", lower("name"))
  WHERE "deleted_at" IS NULL AND "is_system" = false;

-- At most one hidden system account per user, enforced at the DB level so
-- concurrent debt creation can't create two (getOrCreateDebtsAccount falls
-- back to re-reading on conflict).
CREATE UNIQUE INDEX "accounts_user_system_uniq"
  ON "accounts" ("user_id")
  WHERE "is_system" = true;
