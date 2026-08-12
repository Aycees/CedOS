import "server-only";

import { DateTime } from "luxon";

import { dbDateToIso, isoToDbDate } from "@/core/date";
import { prisma } from "@/core/db/client";
import { assertOwned, live, softDeleted } from "@/core/db/scope";
import { AppError } from "@/core/errors";
import { add, toStorage } from "@/core/money";

import type {
  AccountView,
  BudgetGroupView,
  BudgetView,
  CategoryView,
  CreateAccountInput,
  CreateBudgetInput,
  CreateDebtInput,
  CreateTransactionInput,
  CreateTransferInput,
  DebtView,
  DeleteAccountInput,
  FinanceOverview,
  IncomeView,
  TransactionView,
  UpdateAccountInput,
  UpdateTransactionInput,
  UpsertIncomeInput,
} from "./schema";

/** The only place in this module that touches Prisma (decision log §7). */

const decimal = (value: unknown) => toStorage(String(value ?? 0));

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/**
 * Balances are derived, never stored: opening balance plus the sum of the
 * account's transactions.
 *
 * Storing a running balance means every backdated edit has to
 * cascade-recompute, and any missed path produces a wrong number the user
 * will trust (system design §3.6). At this data volume the aggregate is free.
 */
export async function listAccounts(userId: string): Promise<AccountView[]> {
  const accounts = await prisma.account.findMany({
    where: live(userId),
    orderBy: { createdAt: "asc" },
  });

  const sums = await prisma.transaction.groupBy({
    by: ["accountId"],
    where: live(userId),
    _sum: { amount: true },
    _count: { _all: true },
  });

  const byAccount = new Map(sums.map((row) => [row.accountId, row]));

  return accounts.map((account) => {
    const row = byAccount.get(account.id);
    return {
      id: account.id,
      name: account.name,
      kind: account.kind as AccountView["kind"],
      balance: decimal(add(String(account.openingBalance), String(row?._sum.amount ?? 0))),
      lastUsedAt: account.lastUsedAt?.toISOString() ?? null,
      transactionCount: row?._count._all ?? 0,
    };
  });
}

export async function createAccount(userId: string, input: CreateAccountInput) {
  await assertAccountNameFree(userId, input.name);

  return prisma.account.create({
    data: {
      id: input.id,
      userId,
      name: input.name,
      kind: input.kind,
      openingBalance: input.openingBalance,
    },
  });
}

export async function updateAccount(userId: string, input: UpdateAccountInput) {
  const existing = await prisma.account.findUnique({ where: { id: input.id } });
  assertOwned(existing, userId, "account");

  if (input.name && input.name.toLowerCase() !== existing!.name.toLowerCase()) {
    await assertAccountNameFree(userId, input.name);
  }

  return prisma.account.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.openingBalance !== undefined
        ? { openingBalance: input.openingBalance }
        : {}),
    },
  });
}

/** The transactions an account deletion would affect, for the impact preview. */
export async function getAccountImpact(userId: string, accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  assertOwned(account, userId, "account");

  const transactions = await prisma.transaction.findMany({
    where: live(userId, { accountId }),
    orderBy: { occurredOn: "desc" },
  });

  return {
    accountName: account!.name,
    transactions: transactions.map((t) => ({
      id: t.id,
      name: t.name,
      occurredOn: dbDateToIso(t.occurredOn),
      amount: decimal(t.amount),
    })),
  };
}

export async function deleteAccount(userId: string, input: DeleteAccountInput) {
  const account = await prisma.account.findUnique({ where: { id: input.id } });
  assertOwned(account, userId, "account");

  /*
   * Product spec §9: deleting the last account is blocked outright, because
   * every balance view in the app assumes at least one exists. The database
   * cannot express this, so it lives here.
   */
  const remaining = await prisma.account.count({ where: live(userId) });
  if (remaining <= 1) {
    throw new AppError(
      "PRECONDITION_FAILED",
      "You need at least one account — this is the only one left.",
    );
  }

  const count = await prisma.transaction.count({
    where: live(userId, { accountId: input.id }),
  });

  if (count === 0) {
    await prisma.account.update({ where: { id: input.id }, data: softDeleted() });
    return { deleted: true, transactionCount: 0 };
  }

  // Never silently orphan transaction history (product spec §9). Restrict on
  // the FK is what forces this conversation to happen.
  if (input.mode === "check") {
    throw new AppError(
      "REFERENCED",
      `${count} ${count === 1 ? "transaction is" : "transactions are"} linked to this account.`,
    );
  }

  if (input.mode === "reassign") {
    if (!input.targetAccountId || input.targetAccountId === input.id) {
      throw new AppError("VALIDATION_ERROR", "Choose an account to move these to.");
    }
    const target = await prisma.account.findUnique({
      where: { id: input.targetAccountId },
    });
    assertOwned(target, userId, "account");

    await prisma.$transaction([
      prisma.transaction.updateMany({
        where: { userId, accountId: input.id, deletedAt: null },
        data: { accountId: input.targetAccountId },
      }),
      prisma.account.update({ where: { id: input.id }, data: softDeleted() }),
    ]);
    return { deleted: true, movedTransactions: count };
  }

  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { userId, accountId: input.id, deletedAt: null },
      data: softDeleted(),
    }),
    prisma.account.update({ where: { id: input.id }, data: softDeleted() }),
  ]);
  return { deleted: true, deletedTransactions: count };
}

/** Product spec §9's case-insensitive duplicate rule, surfaced inline. */
async function assertAccountNameFree(userId: string, name: string) {
  const clash = await prisma.account.findFirst({
    where: live(userId, { name: { equals: name, mode: "insensitive" as const } }),
  });
  if (clash) {
    throw new AppError("CONFLICT", `You already have an account called "${clash.name}".`, {
      name: ["That name is already taken."],
    });
  }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories(userId: string): Promise<CategoryView[]> {
  const rows = await prisma.transactionCategory.findMany({
    where: live(userId),
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({ id: row.id, name: row.name, color: row.color }));
}

export async function createCategory(
  userId: string,
  input: { id: string; name: string; color: string },
) {
  return prisma.transactionCategory.create({
    data: { id: input.id, userId, name: input.name, color: input.color },
  });
}

export async function updateCategory(
  userId: string,
  input: { id: string; name?: string; color?: string },
) {
  const existing = await prisma.transactionCategory.findUnique({
    where: { id: input.id },
  });
  assertOwned(existing, userId, "category");

  return prisma.transactionCategory.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    },
  });
}

export async function deleteCategory(userId: string, id: string) {
  const existing = await prisma.transactionCategory.findUnique({ where: { id } });
  assertOwned(existing, userId, "category");

  // Categories are nullable on a transaction, so this does not orphan history.
  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { userId, categoryId: id, deletedAt: null },
      data: { categoryId: null },
    }),
    prisma.budget.updateMany({
      where: { userId, categoryId: id, deletedAt: null },
      data: softDeleted(),
    }),
    prisma.transactionCategory.update({ where: { id }, data: softDeleted() }),
  ]);
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export async function listTransactions(
  userId: string,
  options: { query?: string; categoryId?: string; month?: string } = {},
): Promise<TransactionView[]> {
  const where: Record<string, unknown> = {};

  if (options.query?.trim()) {
    where.name = { contains: options.query.trim(), mode: "insensitive" as const };
  }
  if (options.categoryId) where.categoryId = options.categoryId;
  if (options.month) {
    const start = DateTime.fromFormat(options.month, "yyyy-MM", { zone: "utc" });
    where.occurredOn = {
      gte: isoToDbDate(start.toFormat("yyyy-MM-dd")),
      lte: isoToDbDate(start.endOf("month").toFormat("yyyy-MM-dd")),
    };
  }

  const rows = await prisma.transaction.findMany({
    where: live(userId, where),
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    include: { account: true, category: true },
  });

  return collapseTransfers(rows.map(toTransactionView));
}

/**
 * Presents each transfer's two rows as the single movement it is.
 *
 * Keeps the outgoing leg — it carries the id the delete path expects, and
 * deleting either leg removes both — and folds in the destination account so
 * the row can read "Wallet → GCash". The amount is shown as a magnitude,
 * because a transfer is neither income nor expense.
 */
function collapseTransfers(rows: TransactionView[]): TransactionView[] {
  const byGroup = new Map<string, TransactionView[]>();
  for (const row of rows) {
    if (!row.transferGroupId) continue;
    const legs = byGroup.get(row.transferGroupId) ?? [];
    legs.push(row);
    byGroup.set(row.transferGroupId, legs);
  }

  const seen = new Set<string>();
  const output: TransactionView[] = [];

  for (const row of rows) {
    if (!row.transferGroupId) {
      output.push(row);
      continue;
    }
    if (seen.has(row.transferGroupId)) continue;
    seen.add(row.transferGroupId);

    const legs = byGroup.get(row.transferGroupId)!;
    const out = legs.find((leg) => Number(leg.amount) < 0);
    const into = legs.find((leg) => Number(leg.amount) > 0);

    // A half-loaded pair (one leg filtered out by a search) still renders as
    // itself rather than vanishing.
    if (!out || !into) {
      output.push(row);
      continue;
    }

    output.push({
      ...out,
      amount: decimal(Math.abs(Number(out.amount))),
      transferFrom: out.accountName,
      transferTo: into.accountName,
    });
  }

  return output;
}

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
) {
  const account = await prisma.account.findUnique({ where: { id: input.accountId } });
  assertOwned(account, userId, "account");

  // Sign is derived from the type so the two can never disagree — an EXPENSE
  // is always an outflow regardless of how the amount was typed.
  const magnitude = Math.abs(Number(input.amount));
  const amount = input.type === "EXPENSE" ? -magnitude : magnitude;

  return prisma.$transaction([
    prisma.transaction.create({
      data: {
        id: input.id,
        userId,
        name: input.name,
        occurredOn: isoToDbDate(input.occurredOn),
        amount: toStorage(amount),
        type: input.type,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
      },
    }),
    prisma.account.update({
      where: { id: input.accountId },
      data: { lastUsedAt: new Date() },
    }),
  ]);
}

export async function updateTransaction(
  userId: string,
  input: UpdateTransactionInput,
) {
  const existing = await prisma.transaction.findUnique({ where: { id: input.id } });
  assertOwned(existing, userId, "transaction");

  if (existing!.type === "TRANSFER") {
    throw new AppError(
      "PRECONDITION_FAILED",
      "A transfer is two paired rows — delete it and make a new one.",
    );
  }

  const type = input.type ?? (existing!.type as "INCOME" | "EXPENSE");
  const magnitude = Math.abs(Number(input.amount ?? existing!.amount));

  return prisma.transaction.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.occurredOn !== undefined
        ? { occurredOn: isoToDbDate(input.occurredOn) }
        : {}),
      ...(input.amount !== undefined || input.type !== undefined
        ? { amount: toStorage(type === "EXPENSE" ? -magnitude : magnitude), type }
        : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    },
  });
}

/**
 * G1: a transfer is two rows sharing a transferGroupId, written in one
 * database transaction.
 *
 * The cost is that the UI must present two rows as one movement; the benefit
 * is that every balance query stays a plain SUM and every budget query
 * excludes transfers with a single predicate. A single from/to row would be
 * structurally atomic but would poison the most-run query in the app.
 */
export async function createTransfer(userId: string, input: CreateTransferInput) {
  if (input.fromAccountId === input.toAccountId) {
    throw new AppError("VALIDATION_ERROR", "Pick two different accounts.");
  }

  const [from, to] = await Promise.all([
    prisma.account.findUnique({ where: { id: input.fromAccountId } }),
    prisma.account.findUnique({ where: { id: input.toAccountId } }),
  ]);
  assertOwned(from, userId, "account");
  assertOwned(to, userId, "account");

  const magnitude = Math.abs(Number(input.amount));
  const occurredOn = isoToDbDate(input.occurredOn);

  const common = {
    userId,
    name: input.name,
    occurredOn,
    type: "TRANSFER" as const,
    transferGroupId: input.groupId,
    // Both legs carry no category, so budget reporting excludes them with
    // one `type != 'TRANSFER'` predicate. A check constraint enforces it.
    categoryId: null,
  };

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        ...common,
        id: input.outId,
        accountId: input.fromAccountId,
        amount: toStorage(-magnitude),
      },
    }),
    prisma.transaction.create({
      data: {
        ...common,
        id: input.inId,
        accountId: input.toAccountId,
        amount: toStorage(magnitude),
      },
    }),
  ]);
}

/** Deleting either leg of a transfer removes both — they are one movement. */
export async function deleteTransaction(userId: string, id: string) {
  const existing = await prisma.transaction.findUnique({ where: { id } });
  assertOwned(existing, userId, "transaction");

  if (existing!.transferGroupId) {
    await prisma.transaction.updateMany({
      where: { userId, transferGroupId: existing!.transferGroupId },
      data: softDeleted(),
    });
    return;
  }

  await prisma.transaction.update({ where: { id }, data: softDeleted() });
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

/**
 * Spend per budget, for the current month or the budget's custom window.
 *
 * Transfers are excluded — moving money between your own accounts is not
 * spending, and counting it would double-count against the budget (G1).
 */
export async function listBudgets(
  userId: string,
  month: string,
): Promise<{ groups: BudgetGroupView[]; ungrouped: BudgetView[] }> {
  const [budgets, groups] = await Promise.all([
    prisma.budget.findMany({
      where: live(userId),
      include: { category: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.budgetGroup.findMany({ where: live(userId), orderBy: { sortOrder: "asc" } }),
  ]);

  const monthStart = DateTime.fromFormat(month, "yyyy-MM", { zone: "utc" });

  const views: BudgetView[] = [];
  for (const budget of budgets) {
    const from =
      budget.period === "CUSTOM" && budget.periodStart
        ? dbDateToIso(budget.periodStart)
        : monthStart.toFormat("yyyy-MM-dd");
    const to =
      budget.period === "CUSTOM" && budget.periodEnd
        ? dbDateToIso(budget.periodEnd)
        : monthStart.endOf("month").toFormat("yyyy-MM-dd");

    const spend = await prisma.transaction.aggregate({
      where: live(userId, {
        categoryId: budget.categoryId,
        type: { not: "TRANSFER" as const },
        occurredOn: { gte: isoToDbDate(from), lte: isoToDbDate(to) },
      }),
      _sum: { amount: true },
    });

    // Spend is stored as a negative outflow; a budget reads it as a positive.
    views.push({
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      categoryColor: budget.category.color,
      limitAmount: decimal(budget.limitAmount),
      spent: decimal(Math.abs(Math.min(0, Number(spend._sum?.amount ?? 0)))),
      period: budget.period as BudgetView["period"],
      periodStart: budget.periodStart ? dbDateToIso(budget.periodStart) : null,
      periodEnd: budget.periodEnd ? dbDateToIso(budget.periodEnd) : null,
      groupId: budget.groupId,
    });
  }

  return {
    groups: groups.map((group) => {
      const members = views.filter((view) => view.groupId === group.id);
      return {
        id: group.id,
        name: group.name,
        budgets: members,
        // The group total aggregates its members rather than being stored,
        // so collapsing or expanding cannot lose or desync it (spec §9).
        limitTotal: decimal(add(...members.map((m) => m.limitAmount))),
        spentTotal: decimal(add(...members.map((m) => m.spent))),
      };
    }),
    ungrouped: views.filter((view) => view.groupId === null),
  };
}

export async function createBudget(userId: string, input: CreateBudgetInput) {
  const category = await prisma.transactionCategory.findUnique({
    where: { id: input.categoryId },
  });
  assertOwned(category, userId, "category");

  return prisma.budget.create({
    data: {
      id: input.id,
      userId,
      categoryId: input.categoryId,
      limitAmount: input.limitAmount,
      period: input.period,
      periodStart: input.periodStart ? isoToDbDate(input.periodStart) : null,
      periodEnd: input.periodEnd ? isoToDbDate(input.periodEnd) : null,
      groupId: input.groupId ?? null,
    },
  });
}

export async function deleteBudget(userId: string, id: string) {
  const existing = await prisma.budget.findUnique({ where: { id } });
  assertOwned(existing, userId, "budget");
  await prisma.budget.update({ where: { id }, data: softDeleted() });
}

export async function createBudgetGroup(
  userId: string,
  input: { id: string; name: string },
) {
  return prisma.budgetGroup.create({
    data: { id: input.id, userId, name: input.name },
  });
}

export async function deleteBudgetGroup(userId: string, id: string) {
  const existing = await prisma.budgetGroup.findUnique({ where: { id } });
  assertOwned(existing, userId, "budget group");

  // The FK is SetNull, so the member budgets survive as ungrouped rather than
  // disappearing with their group.
  await prisma.budgetGroup.update({ where: { id }, data: softDeleted() });
}

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

export async function listDebts(userId: string): Promise<DebtView[]> {
  const rows = await prisma.debt.findMany({
    where: live(userId),
    orderBy: [{ settledAt: "asc" }, { createdAt: "desc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    direction: row.direction as DebtView["direction"],
    personName: row.personName,
    amount: decimal(row.amount),
    note: row.note,
    settledAt: row.settledAt?.toISOString() ?? null,
  }));
}

export async function createDebt(userId: string, input: CreateDebtInput) {
  return prisma.debt.create({
    data: {
      id: input.id,
      userId,
      direction: input.direction,
      personName: input.personName,
      amount: input.amount,
      note: input.note ?? null,
    },
  });
}

/** Reversible by design — settledAt is a nullable timestamp, not a boolean. */
export async function settleDebt(userId: string, id: string, settled: boolean) {
  const existing = await prisma.debt.findUnique({ where: { id } });
  assertOwned(existing, userId, "debt");

  await prisma.debt.update({
    where: { id },
    data: { settledAt: settled ? new Date() : null },
  });
}

export async function deleteDebt(userId: string, id: string) {
  const existing = await prisma.debt.findUnique({ where: { id } });
  assertOwned(existing, userId, "debt");
  await prisma.debt.update({ where: { id }, data: softDeleted() });
}

// ---------------------------------------------------------------------------
// Recurring income and the overview
// ---------------------------------------------------------------------------

export async function getIncome(userId: string): Promise<IncomeView> {
  const row = await prisma.recurringIncome.findFirst({
    where: live(userId),
    orderBy: { createdAt: "asc" },
  });
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    amount: decimal(row.amount),
    cadence: row.cadence as NonNullable<IncomeView>["cadence"],
    nextOn: dbDateToIso(row.nextOn),
  };
}

export async function upsertIncome(userId: string, input: UpsertIncomeInput) {
  const existing = await prisma.recurringIncome.findFirst({ where: live(userId) });

  if (existing) {
    return prisma.recurringIncome.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        amount: input.amount,
        cadence: input.cadence,
        nextOn: isoToDbDate(input.nextOn),
      },
    });
  }

  return prisma.recurringIncome.create({
    data: {
      id: input.id,
      userId,
      name: input.name,
      amount: input.amount,
      cadence: input.cadence,
      nextOn: isoToDbDate(input.nextOn),
    },
  });
}

export async function getOverview(
  userId: string,
  month: string,
): Promise<FinanceOverview> {
  const [accounts, income, recent] = await Promise.all([
    listAccounts(userId),
    getIncome(userId),
    listTransactions(userId, {}).then((rows) => rows.slice(0, 8)),
  ]);

  const monthStart = DateTime.fromFormat(month, "yyyy-MM", { zone: "utc" });

  const spend = await prisma.transaction.aggregate({
    where: live(userId, {
      type: "EXPENSE" as const,
      occurredOn: {
        gte: isoToDbDate(monthStart.toFormat("yyyy-MM-dd")),
        lte: isoToDbDate(monthStart.endOf("month").toFormat("yyyy-MM-dd")),
      },
    }),
    _sum: { amount: true },
  });

  return {
    accounts,
    totalBalance: decimal(add(...accounts.map((account) => account.balance))),
    income,
    monthSpent: decimal(Math.abs(Number(spend._sum?.amount ?? 0))),
    monthLabel: monthStart.toFormat("LLLL").toUpperCase(),
    recent,
  };
}

type TransactionRow = {
  id: string;
  name: string;
  occurredOn: Date;
  amount: unknown;
  type: string;
  accountId: string;
  categoryId: string | null;
  transferGroupId: string | null;
  account: { name: string };
  category: { name: string; color: string } | null;
};

function toTransactionView(row: TransactionRow): TransactionView {
  return {
    id: row.id,
    name: row.name,
    occurredOn: dbDateToIso(row.occurredOn),
    amount: decimal(row.amount),
    type: row.type as TransactionView["type"],
    accountId: row.accountId,
    accountName: row.account.name,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    categoryColor: row.category?.color ?? null,
    transferGroupId: row.transferGroupId,
  };
}
