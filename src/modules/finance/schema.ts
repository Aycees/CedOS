import { z } from "zod";

import { CATEGORY_COLORS } from "@/modules/calendar/schema";

export const ACCOUNT_KINDS = ["CASH", "EWALLET", "BANK", "CREDIT", "OTHER"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const KIND_LABELS: Record<AccountKind, string> = {
  CASH: "Cash",
  EWALLET: "E-wallet",
  BANK: "Bank",
  CREDIT: "Credit",
  OTHER: "Other",
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-08-11.");

/**
 * Money crosses the wire as a decimal string, never a JS number.
 *
 * A float would already have lost precision by the time it reached the
 * server, so parsing has to happen against the string form (decision A10).
 */
const moneyString = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,2})?$/, "Use an amount like 1240 or 1240.50");

export const createAccountSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "An account needs a name.").max(80),
  kind: z.enum(ACCOUNT_KINDS),
  openingBalance: moneyString.default("0"),
});

export const updateAccountSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "An account needs a name.").max(80).optional(),
  kind: z.enum(ACCOUNT_KINDS).optional(),
  openingBalance: moneyString.optional(),
  /**
   * Reconciliation: "make the derived balance equal this number." The
   * service translates it into an openingBalance adjustment so transaction
   * history stays untouched. Distinct from `openingBalance`, which sets that
   * value directly — the two are never sent together.
   */
  balance: moneyString.optional(),
});

/**
 * Account deletion has the same three modes as calendar-category deletion
 * (A1): check first, then either move the transactions or delete them.
 */
export const deleteAccountSchema = z.object({
  id: z.uuid(),
  mode: z.enum(["check", "reassign", "cascade"]).default("check"),
  targetAccountId: z.uuid().optional(),
});

export const createCategorySchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "A category needs a name.").max(80),
  color: z.enum(CATEGORY_COLORS),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  id: z.uuid(),
});

export const deleteCategorySchema = z.object({ id: z.uuid() });

export const createTransactionSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "What was it?").max(200),
  occurredOn: isoDate,
  /** Signed: negative is an outflow. */
  amount: moneyString,
  type: z.enum(["INCOME", "EXPENSE"]),
  accountId: z.uuid("Pick an account."),
  categoryId: z.uuid().nullable().optional(),
});

export const updateTransactionSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  occurredOn: isoDate.optional(),
  amount: moneyString.optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  accountId: z.uuid().optional(),
  categoryId: z.uuid().nullable().optional(),
});

/**
 * G1: a transfer is two rows written in one transaction, sharing a
 * transferGroupId. The client sends one intent; the service writes both legs.
 */
export const createTransferSchema = z.object({
  groupId: z.uuid(),
  outId: z.uuid(),
  inId: z.uuid(),
  name: z.string().trim().max(200).default("Transfer"),
  occurredOn: isoDate,
  /** Always positive — direction comes from the two account ids. */
  amount: moneyString.refine((v) => Number(v) > 0, "A transfer needs a positive amount."),
  fromAccountId: z.uuid(),
  toAccountId: z.uuid(),
});

export const deleteTransactionSchema = z.object({ id: z.uuid() });

export const createBudgetGroupSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "A group needs a name.").max(80),
});

export const deleteBudgetGroupSchema = z.object({ id: z.uuid() });

export const createBudgetSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1, "A budget needs a name.").max(80),
    limitAmount: moneyString,
    period: z.enum(["MONTHLY", "CUSTOM"]).default("MONTHLY"),
    periodStart: isoDate.nullable().optional(),
    periodEnd: isoDate.nullable().optional(),
    groupId: z.uuid().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.period === "CUSTOM" && (!value.periodStart || !value.periodEnd)) {
      ctx.addIssue({
        code: "custom",
        path: ["periodStart"],
        message: "A custom period needs both dates.",
      });
    }
  });

export const deleteBudgetSchema = z.object({ id: z.uuid() });

export const updateBudgetSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "A budget needs a name.").max(80).optional(),
  limitAmount: moneyString.optional(),
  groupId: z.uuid().nullable().optional(),
});

export const updateBudgetGroupSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "A group needs a name.").max(80),
});

/**
 * A debt is created as a transfer pair (G1), same shape as createTransferSchema:
 * one leg on the real account picked here, one leg on the hidden per-user
 * "Debts" account, both client-generated ids so the write is one round trip.
 */
export const createDebtSchema = z.object({
  id: z.uuid(),
  direction: z.enum(["OWED_TO_ME", "I_OWE"]),
  personName: z.string().trim().min(1, "Who?").max(120),
  amount: moneyString,
  note: z.string().trim().max(500).nullable().optional(),
  accountId: z.uuid("Pick an account."),
  occurredOn: isoDate,
  transferGroupId: z.uuid(),
  outId: z.uuid(),
  inId: z.uuid(),
});

/**
 * Covers inline field edits (personName/amount/note), settling, and
 * unsettling.
 *
 * Settling posts a transfer pair (G1) reversing the creation leg, so it
 * needs the account plus two client-generated ids for that pair — mirroring
 * createDebtSchema. Unsettling is a pure status flip that also reverses the
 * settlement transfer pair (see updateDebt in service.ts); it takes no extra
 * fields. A settled debt's amount is locked (enforced in the service) so the
 * debt row and its posted transfer legs never drift apart.
 */
export const updateDebtSchema = z
  .object({
    id: z.uuid(),
    personName: z.string().trim().min(1, "Who?").max(120).optional(),
    amount: moneyString.optional(),
    note: z.string().trim().max(500).nullable().optional(),
    settled: z.boolean().optional(),
    accountId: z.uuid().optional(),
    occurredOn: isoDate.optional(),
    transferGroupId: z.uuid().optional(),
    outId: z.uuid().optional(),
    inId: z.uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.settled &&
      (!value.accountId || !value.occurredOn || !value.transferGroupId || !value.outId || !value.inId)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["accountId"],
        message: "Pick an account to settle against.",
      });
    }
  });
export const deleteDebtSchema = z.object({ id: z.uuid() });

export const upsertIncomeSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120).default("Allowance"),
  amount: moneyString,
  cadence: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]).default("MONTHLY"),
  nextOn: isoDate,
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type UpdateBudgetGroupInput = z.infer<typeof updateBudgetGroupSchema>;
export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;
export type UpsertIncomeInput = z.infer<typeof upsertIncomeSchema>;

export type AccountView = {
  id: string;
  name: string;
  kind: AccountKind;
  /** Derived: openingBalance + SUM(transactions.amount). Never stored. */
  balance: string;
  lastUsedAt: string | null;
  transactionCount: number;
};

export type CategoryView = {
  id: string;
  name: string;
  color: string;
};

export type TransactionView = {
  id: string;
  name: string;
  occurredOn: string;
  amount: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  transferGroupId: string | null;
  /**
   * Set only on a collapsed transfer. G1 stores a transfer as two rows so
   * that balance and budget queries stay trivial; the cost of that choice is
   * that the UI has to present those two rows as one movement, which is what
   * these two fields carry.
   */
  transferFrom?: string;
  transferTo?: string;
};

export type BudgetView = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  limitAmount: string;
  spent: string;
  period: "MONTHLY" | "CUSTOM";
  periodStart: string | null;
  periodEnd: string | null;
  groupId: string | null;
};

export type BudgetGroupView = {
  id: string;
  name: string;
  budgets: BudgetView[];
  limitTotal: string;
  spentTotal: string;
};

export type DebtView = {
  id: string;
  direction: "OWED_TO_ME" | "I_OWE";
  personName: string;
  amount: string;
  note: string | null;
  settledAt: string | null;
  accountId: string;
};

export type IncomeView = {
  id: string;
  name: string;
  amount: string;
  cadence: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  nextOn: string;
} | null;

export type FinanceOverview = {
  accounts: AccountView[];
  totalBalance: string;
  income: IncomeView;
  monthSpent: string;
  monthLabel: string;
  recent: TransactionView[];
};
