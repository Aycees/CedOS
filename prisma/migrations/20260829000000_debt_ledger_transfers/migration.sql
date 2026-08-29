-- Debts become real double-entry transfers against a hidden per-user "Debts"
-- account (G1's transfer pattern), instead of an ad-hoc side-effect
-- transaction bolted onto settle with no persisted link back to the debt.

-- AlterTable: marks the hidden per-user "Debts" account. Excluded from
-- listAccounts, so it never appears in an account picker, the Accounts tab,
-- or Total Balance.
ALTER TABLE "accounts" ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false;

-- No real debt data exists yet -- reset before adding the required
-- ledger-link columns below.
TRUNCATE "debts";

-- AlterTable: link each debt to the transfer legs that moved real money.
ALTER TABLE "debts"
  ADD COLUMN "account_id" UUID NOT NULL,
  ADD COLUMN "creation_transfer_group_id" UUID NOT NULL,
  ADD COLUMN "settle_account_id" UUID,
  ADD COLUMN "settle_transfer_group_id" UUID;

-- CreateIndex
CREATE INDEX "debts_account_id_idx" ON "debts"("account_id");

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_settle_account_id_fkey" FOREIGN KEY ("settle_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
