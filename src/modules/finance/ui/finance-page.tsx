"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { useState } from "react";

import { formatShortDate } from "@/core/date";
import { userMessage } from "@/core/errors";
import { add, formatMoney, isOverdrawn, money, progress, subtract } from "@/core/money";
import { api } from "@/core/mutation/client";
import { newId } from "@/core/ids";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/ui/cn";
import { Input } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";
import { EmptyState, PageHeader } from "@/core/ui/page-header";

import {
  KIND_LABELS,
  type AccountView,
  type BudgetGroupView,
  type BudgetView,
  type CategoryView,
  type DebtView,
  type FinanceOverview,
  type TransactionView,
} from "../schema";
import {
  AccountModal,
  BudgetGroupModal,
  BudgetModal,
  IncomeModal,
  TransactionModal,
  categoryLabel,
  useAccountDelete,
  useCategoryGroupLabels,
} from "./money-modals";

type Tab = "overview" | "transactions" | "budget" | "debts" | "accounts";

export function FinancePage({
  overview,
  categories,
  month,
  today,
}: {
  overview: FinanceOverview;
  categories: CategoryView[];
  month: string;
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [txModal, setTxModal] = useState<{ tx: TransactionView | null } | null>(null);
  const [accountModal, setAccountModal] = useState<{
    account: AccountView | null;
    fromAccountsTab: boolean;
  } | null>(null);

  const { data } = useQuery({
    queryKey: ["finance", "overview", month],
    queryFn: () => api.get<FinanceOverview>(`/api/finance/overview?month=${month}`),
    initialData: overview,
  });

  const { data: cats = categories } = useQuery({
    queryKey: ["finance", "categories"],
    queryFn: () => api.get<CategoryView[]>("/api/finance/categories"),
    initialData: categories,
  });

  const accounts = data.accounts;
  const hasAccount = accounts.length > 0;

  return (
    <>
      <PageHeader
        kicker={`Finance · ${data.monthLabel}`}
        title="Money"
        actions={
          <Button disabled={!hasAccount} onClick={() => setTxModal({ tx: null })}>
            + transaction
          </Button>
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <div
              role="tablist"
              aria-label="Money view"
              className="flex flex-1 min-w-0 gap-0.5 overflow-x-auto border-b border-dashed border-border"
            >
              {(
                [
                  { label: "Overview", value: "overview" },
                  { label: "Transactions", value: "transactions" },
                  { label: "Budget", value: "budget" },
                  { label: "Debts", value: "debts" },
                  { label: "Accounts", value: "accounts" },
                ] as const
              ).map((option) => {
                const selected = tab === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTab(option.value)}
                    className={cn(
                      "whitespace-nowrap pt-2.5 pb-3 pl-3.75 pr-3.75 font-mono text-[12.5px]",
                      selected
                        ? "text-text shadow-[inset_0_-2px_0_var(--accent-default)]"
                        : "text-muted",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {!hasAccount && (
            <p className="mb-4 font-mono text-[11.5px] text-muted">
              add an account first — every transaction belongs to one
            </p>
          )}

          {tab === "overview" && (
            <Overview
              data={data}
              today={today}
              month={month}
              onNavigate={setTab}
              onNewAccount={() => setAccountModal({ account: null, fromAccountsTab: false })}
              onEditAccount={(account) =>
                setAccountModal({ account, fromAccountsTab: false })
              }
            />
          )}
          {tab === "transactions" && (
            <Transactions
              categories={cats}
              month={month}
              onEdit={(tx) => setTxModal({ tx })}
            />
          )}
          {tab === "budget" && <Budgets month={month} />}
          {tab === "debts" && <Debts accounts={accounts} today={today} />}
          {tab === "accounts" && (
            <Accounts
              accounts={accounts}
              onNewAccount={() => setAccountModal({ account: null, fromAccountsTab: true })}
              onEditAccount={(account) =>
                setAccountModal({ account, fromAccountsTab: true })
              }
            />
          )}

          {txModal && (
            <TransactionModal
              transaction={txModal.tx}
              accounts={accounts}
              categories={cats}
              month={month}
              today={today}
              onClose={() => setTxModal(null)}
            />
          )}
          {accountModal && (
            <AccountModal
              account={accountModal.account}
              accounts={accounts}
              allowBalanceEdit={accountModal.fromAccountsTab}
              onClose={() => setAccountModal(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}

const OVERVIEW_BUDGET_CAP = 5;

function Overview({
  data,
  today,
  month,
  onNavigate,
  onNewAccount,
  onEditAccount,
}: {
  data: FinanceOverview;
  today: string;
  month: string;
  onNavigate: (tab: Tab) => void;
  onNewAccount: () => void;
  onEditAccount: (account: AccountView) => void;
}) {
  const [editingIncome, setEditingIncome] = useState(false);

  const spentFraction = data.income
    ? progress(data.monthSpent, data.income.amount)
    : 0;
  const remaining = data.income
    ? Number(data.income.amount) - Number(data.monthSpent)
    : null;

  return (
    <div className="grid max-w-260 grid-cols-1 gap-4.5 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-4.5">
        <Card>
          <button
            type="button"
            onClick={() => setEditingIncome(true)}
            aria-label={data.income ? "Edit allowance" : "Set allowance"}
            className="kicker block text-left"
          >
            {data.income
              ? `${data.income.name} · ${data.monthLabel}`
              : `Balance · ${data.monthLabel}`}
          </button>

          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="font-mono text-[38px] tracking-[-0.02em]">
              {formatMoney(remaining ?? data.totalBalance)}
            </span>
            <span className="font-mono text-[12px] text-muted">
              {data.income ? "remaining" : "across accounts"}
            </span>
          </div>

          {data.income ? (
            <>
              <div className="mt-2.5 h-1.75 overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--text)_9%,transparent)]">
                <div
                  className={cn(
                    "h-full",
                    spentFraction > 1 ? "bg-accent-red" : "bg-accent",
                  )}
                  style={{ width: `${Math.min(100, spentFraction * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex font-mono text-[11px] text-muted">
                <span>spent {formatMoney(data.monthSpent)}</span>
                <span className="ml-auto">of {formatMoney(data.income.amount)}</span>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditingIncome(true)}
              className="mt-2 font-mono text-[11.5px] text-accent"
            >
              + set an allowance
            </button>
          )}

          {editingIncome && (
            <IncomeModal
              income={data.income}
              today={today}
              onClose={() => setEditingIncome(false)}
            />
          )}

          <div className="mt-4 flex flex-wrap gap-2.5">
            {data.accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => onEditAccount(account)}
                aria-label={`Edit ${account.name}`}
                className="min-w-30 rounded-input border border-border px-3.5 py-2.5 text-left"
              >
                <span className="kicker block">{KIND_LABELS[account.kind]}</span>
                <span className="mt-1 block font-mono text-[12.5px]">{account.name}</span>
                <span
                  className={cn(
                    "mt-0.5 block font-mono text-[13px]",
                    // Product spec §9: overdrawn must read as a warning state,
                    // not a bare negative number the user might skim past.
                    isOverdrawn(account.balance) && "text-accent-red",
                  )}
                >
                  {formatMoney(account.balance)}
                </span>
              </button>
            ))}

            <Button variant="dashed" className="min-w-30" onClick={onNewAccount}>
              + account
            </Button>
          </div>
        </Card>

        <Card>
          <div className="mb-1 flex items-baseline">
            <h2 className="m-0 font-serif text-[18px] font-normal">Recent</h2>
            <button
              type="button"
              onClick={() => onNavigate("transactions")}
              className="ml-auto font-mono text-[11.5px] text-accent"
            >
              all →
            </button>
          </div>
          {data.recent.length === 0 ? (
            <p className="m-0 py-2 font-serif text-[15px] italic text-muted">
              no transactions yet
            </p>
          ) : (
            data.recent.slice(0, 5).map((tx) => <TransactionRow key={tx.id} tx={tx} />)
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-4.5">
        <OverviewBudgets month={month} onNavigate={onNavigate} />
        <OverviewDebts onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function OverviewBudgets({
  month,
  onNavigate,
}: {
  month: string;
  onNavigate: (tab: Tab) => void;
}) {
  const { data } = useQuery({
    queryKey: ["finance", "budgets", month],
    queryFn: () =>
      api.get<{ groups: BudgetGroupView[]; ungrouped: BudgetView[] }>(
        `/api/finance/budgets?month=${month}`,
      ),
  });

  const budgets = [
    ...(data?.groups.flatMap((group) => group.budgets) ?? []),
    ...(data?.ungrouped ?? []),
  ];
  const shown = budgets.slice(0, OVERVIEW_BUDGET_CAP);

  return (
    <Card>
      <div className="mb-1 flex items-baseline">
        <h2 className="m-0 font-serif text-[18px] font-normal">Budgets</h2>
        {budgets.length > shown.length && (
          <button
            type="button"
            onClick={() => onNavigate("budget")}
            className="ml-auto font-mono text-[11.5px] text-accent"
          >
            all →
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="m-0 py-2 font-serif text-[15px] italic text-muted">no budgets yet</p>
      ) : (
        shown.map((budget) => <OverviewBudgetRow key={budget.id} budget={budget} />)
      )}
    </Card>
  );
}

function OverviewBudgetRow({ budget }: { budget: BudgetView }) {
  const fraction = progress(budget.spent, budget.limitAmount);
  const over = fraction > 1;

  return (
    <div className="row-divider list-row">
      <div className="flex items-baseline gap-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[13.5px]">
          {budget.categoryName}
        </span>
        <span
          className={cn("flex-none font-mono text-[12.5px]", over ? "text-accent-red" : "text-muted")}
        >
          {formatMoney(budget.spent)} / {formatMoney(budget.limitAmount)}
        </span>
      </div>
      <div className="mt-2 h-1.75 overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--text)_9%,transparent)]">
        <div
          className={cn("h-full", over ? "bg-accent-red" : "bg-accent")}
          style={{
            width: `${Math.min(100, fraction * 100)}%`,
            background: over ? undefined : `var(--accent-${budget.categoryColor})`,
          }}
        />
      </div>
    </div>
  );
}

function OverviewDebts({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { data: debts = [] } = useQuery({
    queryKey: ["finance", "debts"],
    queryFn: () => api.get<DebtView[]>("/api/finance/debts"),
  });

  const outstanding = debts.filter((debt) => !debt.settledAt);
  const owedToMe = outstanding.filter((debt) => debt.direction === "OWED_TO_ME");
  const iOwe = outstanding.filter((debt) => debt.direction === "I_OWE");
  const owedToMeTotal = owedToMe.reduce((sum, debt) => sum + Number(debt.amount), 0);
  const iOweTotal = iOwe.reduce((sum, debt) => sum + Number(debt.amount), 0);

  return (
    <Card>
      <h2 className="m-0 mb-3.5 font-serif text-[18px] font-normal">Debts</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <div className="kicker">owed to me</div>
          <div className="mt-1.5 truncate font-mono text-[22px] tracking-[-0.01em] text-accent-green">
            {formatMoney(owedToMeTotal)}
          </div>
        </div>
        <div className="min-w-0">
          <div className="kicker">I owe</div>
          <div className="mt-1.5 truncate font-mono text-[22px] tracking-[-0.01em] text-accent-red">
            {formatMoney(iOweTotal)}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onNavigate("debts")}
        className="mt-4 w-full rounded-control border border-dashed border-border-strong py-2.5 text-center font-mono text-[12px] text-muted"
      >
        settle up →
      </button>
    </Card>
  );
}

function Accounts({
  accounts,
  onNewAccount,
  onEditAccount,
}: {
  accounts: AccountView[];
  onNewAccount: () => void;
  onEditAccount: (account: AccountView) => void;
}) {
  if (accounts.length === 0) {
    return (
      <div className="max-w-180">
        <EmptyState line="no accounts yet" />
        <Button variant="dashed" className="mt-3 min-h-37.5 w-58" onClick={onNewAccount}>
          + add account
        </Button>
      </div>
    );
  }

  return (
    <div className="grid max-w-205 grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-4">
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          accounts={accounts}
          onEdit={() => onEditAccount(account)}
        />
      ))}
      <Button
        variant="dashed"
        className="min-h-37.5 items-center justify-center"
        onClick={onNewAccount}
      >
        + add account
      </Button>
    </div>
  );
}

function AccountCard({
  account,
  accounts,
  onEdit,
}: {
  account: AccountView;
  accounts: AccountView[];
  onEdit: () => void;
}) {
  const { attemptDelete, dialog } = useAccountDelete(account, accounts, () => {});

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        aria-label={`Edit ${account.name}`}
        onClick={onEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit();
          }
        }}
        className="cursor-pointer px-5 pt-5 pb-4.5"
      >
        <div className="flex items-baseline gap-2">
          <span className="kicker">{KIND_LABELS[account.kind]}</span>
          <button
            type="button"
            aria-label={`Delete ${account.name}`}
            onClick={(e) => {
              e.stopPropagation();
              attemptDelete.mutate();
            }}
            className="ml-auto font-mono text-[15px] leading-none text-accent-red"
          >
            ×
          </button>
        </div>
        <div className="mt-2.5 font-serif text-[19px]">{account.name}</div>
        <div
          className={cn(
            "mt-3.5 font-mono text-[24px] tracking-[-0.02em]",
            isOverdrawn(account.balance) && "text-accent-red",
          )}
        >
          {formatMoney(account.balance)}
        </div>
        <div className="row-divider mt-2.5 pt-2.5 font-mono text-[11px] text-muted">
          {account.lastUsedAt
            ? `last used ${DateTime.fromISO(account.lastUsedAt).toFormat("LLL d")}`
            : "not used yet"}
        </div>
      </Card>
      {dialog}
    </>
  );
}

function TransactionRow({
  tx,
  onEdit,
}: {
  tx: TransactionView;
  onEdit?: (tx: TransactionView) => void;
}) {
  const negative = Number(tx.amount) < 0;

  return (
    <button
      type="button"
      onClick={() => onEdit?.(tx)}
      aria-label={`Edit ${tx.name}`}
      className="row-divider list-row flex w-full items-center gap-3 text-left"
    >
      <span className="flex-none font-mono text-[10.5px] tracking-[0.06em] text-muted">
        {formatShortDate(tx.occurredOn)}
      </span>
      <span
        aria-hidden
        className="size-2 flex-none rounded-full"
        style={{
          background: tx.categoryColor
            ? `var(--accent-${tx.categoryColor})`
            : "var(--dot)",
        }}
      />
      <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{tx.name}</span>
      <span
        className={cn(
          "flex-none font-mono text-[12.5px]",
          // A transfer is neither income nor expense, so it stays neutral
          // rather than being coloured as one or the other.
          tx.type === "TRANSFER" ? "text-muted" : negative ? "text-text" : "text-accent-green",
        )}
      >
        {formatMoney(tx.amount)}
      </span>
    </button>
  );
}

function Transactions({
  categories,
  month,
  onEdit,
}: {
  categories: CategoryView[];
  month: string;
  onEdit: (tx: TransactionView) => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const groupLabels = useCategoryGroupLabels(month);

  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (categoryId) params.set("categoryId", categoryId);

  const { data: rows = [] } = useQuery({
    queryKey: ["finance", "transactions", query.trim(), categoryId, month],
    queryFn: () => api.get<TransactionView[]>(`/api/finance/transactions?${params}`),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-col gap-3.5">
        <Input
          tinted
          className="w-full border-none py-2.5 text-[13px] sm:max-w-96"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transactions"
          aria-label="Search transactions"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
            <CategoryChip label="All" selected={categoryId === ""} onClick={() => setCategoryId("")} />
            {categories.map((category) => (
              <CategoryChip
                key={category.id}
                label={categoryLabel(category, groupLabels)}
                selected={categoryId === category.id}
                onClick={() => setCategoryId(category.id)}
              />
            ))}
          </div>
          {(query || categoryId) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuery("");
                setCategoryId("");
              }}
            >
              clear filters
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState line={query || categoryId ? "no transactions match" : "no transactions logged"} />
      ) : (
        <div className="flex flex-col">
          {rows.map((tx) => (
            <TransactionListRow key={tx.id} tx={tx} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-pill border px-3.5 py-1.5 font-mono text-[12px]",
        selected ? "border-accent bg-accent/10 text-text" : "border-border text-muted",
      )}
    >
      {label}
    </button>
  );
}

function TransactionListRow({
  tx,
  onEdit,
}: {
  tx: TransactionView;
  onEdit?: (tx: TransactionView) => void;
}) {
  const negative = Number(tx.amount) < 0;
  const meta =
    tx.type === "TRANSFER"
      ? `${tx.transferFrom} → ${tx.transferTo}`
      : tx.categoryName
        ? `${tx.categoryName} · ${tx.accountName}`
        : tx.accountName;

  return (
    <button
      type="button"
      onClick={() => onEdit?.(tx)}
      aria-label={`Edit ${tx.name}`}
      className="row-divider list-row flex w-full items-center gap-5 px-3 text-left"
    >
      <span className="w-15 flex-none font-mono text-[12px] text-muted">
        {formatShortDate(tx.occurredOn)}
      </span>
      <span
        aria-hidden
        className="size-2.5 flex-none rounded-full"
        style={{
          background: tx.categoryColor ? `var(--accent-${tx.categoryColor})` : "var(--dot)",
        }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{tx.name}</span>
        <span className="mt-0.5 block truncate font-mono text-[12px] text-muted">{meta}</span>
      </span>
      <span
        className={cn(
          "flex-none font-mono text-[16px]",
          // A transfer is neither income nor expense, so it stays neutral
          // rather than being coloured as one or the other.
          tx.type === "TRANSFER" ? "text-muted" : negative ? "text-text" : "text-accent-green",
        )}
      >
        {formatMoney(tx.amount)}
      </span>
    </button>
  );
}

function Budgets({ month }: { month: string }) {
  const [creating, setCreating] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ["finance", "budgets", month],
    queryFn: () =>
      api.get<{ groups: BudgetGroupView[]; ungrouped: BudgetView[] }>(
        `/api/finance/budgets?month=${month}`,
      ),
  });

  const groups = data?.groups ?? [];
  const ungrouped = data?.ungrouped ?? [];

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-center justify-end gap-2.5">
        <Button size="sm" variant="outline" onClick={() => setCreatingGroup(true)}>
          + new group
        </Button>
        <Button size="sm" onClick={() => setCreating(true)}>
          + new budget
        </Button>
      </div>

      {groups.length === 0 && ungrouped.length === 0 ? (
        <EmptyState line="no budgets yet" />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.id);
            return (
              <Card key={group.id}>
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (next.has(group.id)) next.delete(group.id);
                        else next.add(group.id);
                        return next;
                      })
                    }
                    aria-expanded={!isCollapsed}
                    aria-label={isCollapsed ? "Expand group" : "Collapse group"}
                    className="font-mono text-[12px] text-muted"
                  >
                    {isCollapsed ? "›" : "⌄"}
                  </button>
                  <BudgetGroupTitle group={group} />
                  {/* The group total aggregates its members, so collapsing
                      cannot lose or desync it (product spec §9). */}
                  <span className="ml-auto font-mono text-[12.5px] text-muted">
                    {formatMoney(group.spentTotal)} of {formatMoney(group.limitTotal)}
                  </span>
                </div>

                {!isCollapsed &&
                  group.budgets.map((budget) => (
                    <BudgetRow key={budget.id} budget={budget} />
                  ))}
              </Card>
            );
          })}

          {ungrouped.map((budget) => (
            <Card key={budget.id}>
              <BudgetRow budget={budget} divider={false} />
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <BudgetModal
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          onClose={() => setCreating(false)}
        />
      )}
      {creatingGroup && <BudgetGroupModal onClose={() => setCreatingGroup(false)} />}
    </div>
  );
}

function BudgetGroupTitle({ group }: { group: BudgetGroupView }) {
  const queryClient = useQueryClient();
  const rename = useMutation({
    mutationFn: (name: string) =>
      api.patch("/api/finance/budget-groups", { id: group.id, name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
  });

  return (
    <EditableField
      value={group.name}
      onCommit={(name) => rename.mutate(name)}
      ariaLabel={`${group.name} group name`}
      className="font-serif text-[19px] font-normal"
    />
  );
}

function BudgetRow({ budget, divider = true }: { budget: BudgetView; divider?: boolean }) {
  const queryClient = useQueryClient();
  const [adjustAmount, setAdjustAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fraction = progress(budget.spent, budget.limitAmount);
  const over = fraction > 1;
  const leftRaw = subtract(budget.limitAmount, budget.spent);
  const left = leftRaw.isNegative() ? money(0) : leftRaw;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["finance"] });

  const rename = useMutation({
    mutationFn: (name: string) => api.patch("/api/finance/budgets", { id: budget.id, name }),
    onSuccess: invalidate,
  });

  const setCap = useMutation({
    mutationFn: (limitAmount: string) =>
      api.patch("/api/finance/budgets", { id: budget.id, limitAmount }),
    onSuccess: () => {
      invalidate();
      setAdjustAmount("");
      setError(null);
    },
    onError: (e) => setError(userMessage(e, "That didn't save.")),
  });

  const remove = useMutation({
    mutationFn: () => api.delete("/api/finance/budgets", { id: budget.id }),
    onSuccess: invalidate,
  });

  const delta = money(adjustAmount || 0);
  const canSubtract =
    delta.isPositive() && subtract(budget.limitAmount, delta.toString()).greaterThanOrEqualTo(
      money(budget.spent),
    );
  const canAdd = delta.isPositive();

  const adjustCap = (sign: 1 | -1) => {
    if (delta.isZero()) return;
    const next = sign === 1 ? add(budget.limitAmount, delta) : subtract(budget.limitAmount, delta);
    setCap.mutate(next.toFixed(2));
  };

  return (
    <div className={cn("group", divider && "row-divider list-row")}>
      <div className="flex items-baseline gap-2.5">
        <span
          aria-hidden
          className="size-2.5 flex-none rounded-full"
          style={{ background: `var(--accent-${budget.categoryColor})` }}
        />
        <EditableField
          value={budget.categoryName}
          onCommit={(name) => rename.mutate(name)}
          ariaLabel={`${budget.categoryName} budget name`}
          className="min-w-0 flex-1 truncate font-mono text-[13.5px]"
        />
        <span
          className={cn(
            "flex-none font-mono text-[12.5px]",
            over ? "text-accent-red" : "text-muted",
          )}
        >
          {formatMoney(budget.spent)} / {formatMoney(budget.limitAmount)}
        </span>
        <button
          type="button"
          aria-label={`Delete ${budget.categoryName} budget`}
          onClick={() => remove.mutate()}
          className="font-mono text-[12px] text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          ×
        </button>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--text)_9%,transparent)]">
        <div
          className={cn("h-full", over ? "bg-accent-red" : "bg-accent")}
          style={{
            width: `${Math.min(100, fraction * 100)}%`,
            background: over ? undefined : `var(--accent-${budget.categoryColor})`,
          }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[12.5px] text-muted">{formatMoney(left)} left</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Input
            tinted
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            placeholder="amount"
            inputMode="decimal"
            aria-label={`Adjust ${budget.categoryName} cap`}
            className="w-20 border-none py-1.5 text-[12.5px] sm:w-28"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!canSubtract || setCap.isPending}
            onClick={() => adjustCap(-1)}
          >
            −
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canAdd || setCap.isPending}
            onClick={() => adjustCap(1)}
          >
            +
          </Button>
        </div>
      </div>
      {error && <p className="m-0 mt-1 font-mono text-[11px] text-accent-red">{error}</p>}
    </div>
  );
}

const DEBT_LISTS = [
  {
    direction: "OWED_TO_ME" as const,
    label: "owed to me",
    prompt: "Who owes you?",
    color: "text-accent-green",
  },
  {
    direction: "I_OWE" as const,
    label: "I owe",
    prompt: "Who do you owe?",
    color: "text-accent-red",
  },
];

function Debts({ accounts, today }: { accounts: AccountView[]; today: string }) {
  const queryClient = useQueryClient();
  const [settling, setSettling] = useState<DebtView | null>(null);
  const hasAccount = accounts.length > 0;

  const { data: debts = [] } = useQuery({
    queryKey: ["finance", "debts"],
    queryFn: () => api.get<DebtView[]>("/api/finance/debts"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["finance"] });

  const create = useMutation({
    mutationFn: (vars: {
      direction: "OWED_TO_ME" | "I_OWE";
      personName: string;
      amount: string;
      note: string | null;
    }) => api.post("/api/finance/debts", { id: newId(), ...vars }),
    onSuccess: invalidate,
  });

  const edit = useMutation({
    mutationFn: (vars: { id: string; personName?: string; amount?: string; note?: string }) =>
      api.patch("/api/finance/debts", vars),
    onSuccess: invalidate,
  });

  const unsettle = useMutation({
    mutationFn: (id: string) => api.patch("/api/finance/debts", { id, settled: false }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete("/api/finance/debts", { id }),
    onSuccess: invalidate,
  });

  return (
    <div className="max-w-205">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {DEBT_LISTS.map((list) => {
          const rows = debts.filter((debt) => debt.direction === list.direction);
          const total = rows
            .filter((debt) => !debt.settledAt)
            .reduce((sum, debt) => sum + Number(debt.amount), 0);

          return (
            <div key={list.direction} className="flex flex-col gap-3.5">
              <div className="kicker">
                {list.label} · {formatMoney(total)}
              </div>

              {rows.map((debt) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  color={list.color}
                  settleLabel={list.direction === "OWED_TO_ME" ? "mark received" : "mark paid"}
                  canSettle={hasAccount}
                  onEditField={(patch) => edit.mutate({ id: debt.id, ...patch })}
                  onSettle={() => setSettling(debt)}
                  onUnsettle={() => unsettle.mutate(debt.id)}
                  onRemove={() => remove.mutate(debt.id)}
                />
              ))}

              <AddDebtForm
                prompt={list.prompt}
                onAdd={(input) => create.mutate({ direction: list.direction, ...input })}
              />
            </div>
          );
        })}
      </div>

      {settling && (
        <SettleDebtModal
          debt={settling}
          accounts={accounts}
          today={today}
          onClose={() => setSettling(null)}
        />
      )}
    </div>
  );
}

function EditableField({
  value,
  display,
  onCommit,
  placeholder,
  ariaLabel,
  className,
  inputMode,
  validate,
}: {
  value: string;
  /** Rendered text while not editing, if different from the raw editable value (e.g. trimmed trailing zeros). */
  display?: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  inputMode?: "decimal";
  validate?: (value: string) => boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value && (!validate || validate(trimmed))) {
      onCommit(trimmed);
    } else {
      setDraft(value);
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        inputMode={inputMode}
        aria-label={ariaLabel}
        className={cn("min-w-0 bg-transparent outline-none", className)}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`Edit ${ariaLabel}`}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setDraft(value);
          setEditing(true);
        }
      }}
      className={cn(!value && "text-muted", className)}
    >
      {(value ? (display ?? value) : "") || placeholder}
    </span>
  );
}

const moneyPattern = /^-?\d+(\.\d{1,2})?$/;

function DebtCard({
  debt,
  color,
  settleLabel,
  canSettle,
  onEditField,
  onSettle,
  onUnsettle,
  onRemove,
}: {
  debt: DebtView;
  color: string;
  settleLabel: string;
  canSettle: boolean;
  onEditField: (patch: { personName?: string; amount?: string; note?: string }) => void;
  onSettle: () => void;
  onUnsettle: () => void;
  onRemove: () => void;
}) {
  const settled = Boolean(debt.settledAt);

  return (
    <Card className={cn("px-5 pt-4.5 pb-4", settled && "opacity-50")}>
      <div className="flex items-baseline justify-between gap-3">
        <EditableField
          value={debt.personName}
          onCommit={(personName) => onEditField({ personName })}
          ariaLabel={`${debt.personName} name`}
          className={cn(
            "min-w-0 flex-1 truncate font-serif text-[19px]",
            settled && "text-muted line-through",
          )}
        />
        <span className="flex-none font-mono text-[19px] tracking-[-0.01em]">
          <span className="text-muted">₱</span>{" "}
          <EditableField
            value={debt.amount}
            display={debt.amount.replace(/\.00$/, "")}
            onCommit={(amount) => onEditField({ amount })}
            ariaLabel={`${debt.personName} amount`}
            inputMode="decimal"
            validate={(v) => moneyPattern.test(v)}
            className={cn("w-20 text-right", color)}
          />
        </span>
      </div>

      <EditableField
        value={debt.note ?? ""}
        onCommit={(note) => onEditField({ note })}
        placeholder="Description (optional)"
        ariaLabel={`${debt.personName} description`}
        className="mt-1 block font-mono text-[11.5px] text-muted"
      />

      <div className="mt-3.5 flex items-center gap-2">
        {settled ? (
          <Button
            variant="outline"
            className="flex-1 text-accent-green"
            onClick={onUnsettle}
          >
            settled — unsettle
          </Button>
        ) : (
          <Button
            variant="outline"
            className="flex-1"
            disabled={!canSettle}
            onClick={onSettle}
          >
            {settleLabel}
          </Button>
        )}
        <Button
          variant="outline"
          aria-label={`Delete debt ${debt.personName}`}
          onClick={onRemove}
          className="flex-none text-accent-red"
        >
          ×
        </Button>
      </div>
    </Card>
  );
}

function AddDebtForm({
  prompt,
  onAdd,
}: {
  prompt: string;
  onAdd: (input: { personName: string; amount: string; note: string | null }) => void;
}) {
  const [personName, setPersonName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const canAdd = personName.trim() && moneyPattern.test(amount.trim());

  const submit = () => {
    if (!canAdd) return;
    onAdd({ personName: personName.trim(), amount: amount.trim(), note: note.trim() || null });
    setPersonName("");
    setAmount("");
    setNote("");
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-dashed border-border-strong p-4">
      <div className="flex gap-2.5">
        <Input
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          placeholder={prompt}
          className="min-w-0 flex-1"
        />
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="₱ amount"
          inputMode="decimal"
          className="max-w-28 flex-none"
        />
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Description (optional)"
      />
      <Button className="w-full" onClick={submit} disabled={!canAdd}>
        + add
      </Button>
    </div>
  );
}

function SettleDebtModal({
  debt,
  accounts,
  today,
  onClose,
}: {
  debt: DebtView;
  accounts: AccountView[];
  today: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const received = debt.direction === "OWED_TO_ME";

  const settle = useMutation({
    mutationFn: () =>
      api.patch("/api/finance/debts", {
        id: debt.id,
        settled: true,
        accountId,
        transactionId: newId(),
        occurredOn: today,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
      onClose();
    },
  });

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker={received ? "MARK RECEIVED" : "MARK PAID"}
      title={`${debt.personName} · ${formatMoney(debt.amount)}`}
      width={400}
    >
      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="kicker">
            {received ? "Which account did it go to?" : "Which account did it come from?"}
          </span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-input border border-border bg-transparent px-2.75 py-2 font-mono text-[12.5px] text-text outline-none"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ModalActions>
        <Button variant="outline" onClick={onClose}>
          cancel
        </Button>
        <Button onClick={() => settle.mutate()} disabled={!accountId || settle.isPending}>
          {received ? "mark received" : "mark paid"}
        </Button>
      </ModalActions>
    </Modal>
  );
}
