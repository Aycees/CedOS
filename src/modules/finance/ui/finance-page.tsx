"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { formatListDate } from "@/core/date";
import { formatMoney, isOverdrawn, progress } from "@/core/money";
import { api } from "@/core/mutation/client";
import { newId } from "@/core/ids";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/ui/cn";
import { Input } from "@/core/ui/input";
import { EmptyState } from "@/core/ui/page-header";
import { Segmented } from "@/core/ui/segmented";

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
  BudgetModal,
  CategoryModal,
  DebtModal,
  IncomeModal,
  TransactionModal,
} from "./money-modals";

type Tab = "overview" | "transactions" | "budget" | "debts";

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
  const [accountModal, setAccountModal] = useState<{ account: AccountView | null } | null>(
    null,
  );

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
    <div className="p-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented
          aria-label="Money view"
          value={tab}
          onChange={setTab}
          options={[
            { label: "Overview", value: "overview" },
            { label: "Transactions", value: "transactions" },
            { label: "Budget", value: "budget" },
            { label: "Debts", value: "debts" },
          ]}
        />
        <Button
          className="ml-auto"
          disabled={!hasAccount}
          onClick={() => setTxModal({ tx: null })}
        >
          + transaction
        </Button>
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
          onNewAccount={() => setAccountModal({ account: null })}
          onEditAccount={(account) => setAccountModal({ account })}
        />
      )}
      {tab === "transactions" && (
        <Transactions
          categories={cats}
          month={month}
          onEdit={(tx) => setTxModal({ tx })}
        />
      )}
      {tab === "budget" && <Budgets categories={cats} month={month} />}
      {tab === "debts" && <Debts />}

      {txModal && (
        <TransactionModal
          transaction={txModal.tx}
          accounts={accounts}
          categories={cats}
          today={today}
          onClose={() => setTxModal(null)}
        />
      )}
      {accountModal && (
        <AccountModal
          account={accountModal.account}
          accounts={accounts}
          onClose={() => setAccountModal(null)}
        />
      )}
    </div>
  );
}

function Overview({
  data,
  today,
  onNewAccount,
  onEditAccount,
}: {
  data: FinanceOverview;
  today: string;
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
    <div className="flex max-w-180 flex-col gap-4.5">
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
        </div>
        {data.recent.length === 0 ? (
          <p className="m-0 py-2 font-serif text-[15px] italic text-muted">
            no transactions yet
          </p>
        ) : (
          data.recent.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
        )}
      </Card>
    </div>
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
      className="row-divider list-row flex w-full items-baseline gap-3 text-left"
    >
      <span
        aria-hidden
        className="size-2 flex-none translate-y-0.5 rounded-full"
        style={{
          background: tx.categoryColor
            ? `var(--accent-${tx.categoryColor})`
            : "var(--dot)",
        }}
      />
      <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{tx.name}</span>
      <span className="flex-none font-mono text-[10.5px] text-muted">
        {tx.type === "TRANSFER"
          ? `${tx.transferFrom} → ${tx.transferTo}`
          : (tx.categoryName ?? tx.accountName)}
      </span>
      <span className="flex-none font-mono text-[10.5px] tracking-[0.08em] text-muted">
        {formatListDate(tx.occurredOn)}
      </span>
      <span
        className={cn(
          "w-23 flex-none text-right font-mono text-[12.5px]",
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
  const [newCategory, setNewCategory] = useState(false);

  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (categoryId) params.set("categoryId", categoryId);

  const { data: rows = [] } = useQuery({
    queryKey: ["finance", "transactions", query.trim(), categoryId, month],
    queryFn: () => api.get<TransactionView[]>(`/api/finance/transactions?${params}`),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="max-w-205">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Input
          className="max-w-55"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transactions"
          aria-label="Search transactions"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filter by category"
          className="rounded-input border border-border bg-transparent px-2.75 py-2 font-mono text-[12.5px] text-text outline-none"
        >
          <option value="">all categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => setNewCategory(true)}>
          + category
        </Button>
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

      {rows.length === 0 ? (
        <EmptyState line={query || categoryId ? "no transactions match" : "no transactions logged"} />
      ) : (
        <Card className="pb-3">
          {rows.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} onEdit={onEdit} />
          ))}
        </Card>
      )}

      {newCategory && <CategoryModal onClose={() => setNewCategory(false)} />}
    </div>
  );
}

function Budgets({
  categories,
  month,
}: {
  categories: CategoryView[];
  month: string;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ["finance", "budgets", month],
    queryFn: () =>
      api.get<{ groups: BudgetGroupView[]; ungrouped: BudgetView[] }>(
        `/api/finance/budgets?month=${month}`,
      ),
  });

  const newGroup = useMutation({
    mutationFn: (name: string) =>
      api.post("/api/finance/budget-groups", { id: newId(), name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
  });

  const groups = data?.groups ?? [];
  const ungrouped = data?.ungrouped ?? [];

  return (
    <div className="max-w-180">
      <div className="mb-4 flex items-center gap-2.5">
        <Button size="sm" disabled={categories.length === 0} onClick={() => setCreating(true)}>
          + new budget
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const name = window.prompt("Group name");
            if (name?.trim()) newGroup.mutate(name.trim());
          }}
        >
          + new group
        </Button>
      </div>

      {groups.length === 0 && ungrouped.length === 0 ? (
        <EmptyState line="no budgets yet" />
      ) : (
        <div className="flex flex-col gap-4.5">
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.id);
            return (
              <Card key={group.id}>
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
                  className="flex w-full items-baseline gap-2.5 text-left"
                >
                  <span aria-hidden className="font-mono text-[11px] text-muted">
                    {isCollapsed ? "›" : "⌄"}
                  </span>
                  <h2 className="m-0 font-serif text-[17px] font-normal">{group.name}</h2>
                  {/* The group total aggregates its members, so collapsing
                      cannot lose or desync it (product spec §9). */}
                  <span className="ml-auto font-mono text-[11.5px] text-muted">
                    {formatMoney(group.spentTotal)} of {formatMoney(group.limitTotal)}
                  </span>
                </button>

                {!isCollapsed &&
                  group.budgets.map((budget) => (
                    <BudgetRow key={budget.id} budget={budget} />
                  ))}
              </Card>
            );
          })}

          {ungrouped.length > 0 && (
            <Card>
              <div className="kicker mb-1">No group</div>
              {ungrouped.map((budget) => (
                <BudgetRow key={budget.id} budget={budget} />
              ))}
            </Card>
          )}
        </div>
      )}

      {creating && (
        <BudgetModal
          categories={categories}
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

function BudgetRow({ budget }: { budget: BudgetView }) {
  const queryClient = useQueryClient();
  const fraction = progress(budget.spent, budget.limitAmount);
  const over = fraction > 1;

  const remove = useMutation({
    mutationFn: () => api.delete("/api/finance/budgets", { id: budget.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
  });

  return (
    <div className="row-divider list-row group">
      <div className="flex items-baseline gap-2.5">
        <span
          aria-hidden
          className="size-2 flex-none rounded-full"
          style={{ background: `var(--accent-${budget.categoryColor})` }}
        />
        <span className="font-mono text-[12.5px]">{budget.categoryName}</span>
        <span
          className={cn(
            "ml-auto font-mono text-[11.5px]",
            over ? "text-accent-red" : "text-muted",
          )}
        >
          {formatMoney(budget.spent)} / {formatMoney(budget.limitAmount)}
        </span>
        <button
          type="button"
          aria-label={`Delete ${budget.categoryName} budget`}
          onClick={() => remove.mutate()}
          className="font-mono text-[11px] text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          ×
        </button>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--text)_9%,transparent)]">
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

function Debts() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: debts = [] } = useQuery({
    queryKey: ["finance", "debts"],
    queryFn: () => api.get<DebtView[]>("/api/finance/debts"),
  });

  const settle = useMutation({
    mutationFn: (vars: { id: string; settled: boolean }) =>
      api.patch("/api/finance/debts", vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete("/api/finance/debts", { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
  });

  const lists = [
    { direction: "OWED_TO_ME" as const, label: "Owed to me" },
    { direction: "I_OWE" as const, label: "I owe" },
  ];

  return (
    <div className="max-w-180">
      <Button size="sm" className="mb-4" onClick={() => setCreating(true)}>
        + new debt
      </Button>

      <div className="grid grid-cols-1 gap-4.5 md:grid-cols-2">
        {lists.map((list) => {
          const rows = debts.filter((debt) => debt.direction === list.direction);
          return (
            <Card key={list.direction} className="pb-3">
              <div className="kicker mb-1">{list.label}</div>
              {rows.length === 0 ? (
                <p className="m-0 py-2 font-serif text-[15px] italic text-muted">
                  nothing here
                </p>
              ) : (
                rows.map((debt) => (
                  <div
                    key={debt.id}
                    className="row-divider list-row group flex items-baseline gap-2.5"
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={Boolean(debt.settledAt)}
                      aria-label={
                        debt.settledAt
                          ? `Unsettle ${debt.personName}`
                          : `Settle ${debt.personName}`
                      }
                      // Reversible in case of a mis-click (product spec §9).
                      onClick={() =>
                        settle.mutate({ id: debt.id, settled: !debt.settledAt })
                      }
                      className={cn(
                        "grid size-3.75 flex-none place-items-center rounded-sm border-[1.5px] font-mono text-[9px] leading-none",
                        debt.settledAt
                          ? "border-accent-green bg-accent-green text-on-dark"
                          : "border-checkbox",
                      )}
                    >
                      {debt.settledAt ? "✓" : ""}
                    </button>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block font-mono text-[12.5px]",
                          debt.settledAt && "text-muted line-through",
                        )}
                      >
                        {debt.personName}
                      </span>
                      {debt.note && (
                        <span className="block font-mono text-[10.5px] text-muted">
                          {debt.note}
                        </span>
                      )}
                    </span>

                    <span className="flex-none font-mono text-[12.5px]">
                      {formatMoney(debt.amount)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete debt ${debt.personName}`}
                      onClick={() => remove.mutate(debt.id)}
                      className="flex-none font-mono text-[11px] text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </Card>
          );
        })}
      </div>

      {creating && <DebtModal onClose={() => setCreating(false)} />}
    </div>
  );
}
