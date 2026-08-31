"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppError, userMessage } from "@/core/errors";
import { newId } from "@/core/ids";
import { formatMoney } from "@/core/money";
import { api } from "@/core/mutation/client";
import { formatListDate } from "@/core/date";
import { Button } from "@/core/ui/button";
import { cn } from "@/core/ui/cn";
import { ImpactPreviewDialog } from "@/core/ui/impact-preview-dialog";
import { Input } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";
import { Segmented } from "@/core/ui/segmented";
import { Select, SelectItem } from "@/core/ui/select";
import { CATEGORY_COLORS } from "@/modules/calendar/schema";

import {
  ACCOUNT_KINDS,
  KIND_LABELS,
  type AccountKind,
  type AccountView,
  type BudgetGroupView,
  type BudgetView,
  type CategoryView,
  type TransactionView,
} from "../schema";

// Radix Select forbids an empty item value, so these stand in for "no selection".
const UNCATEGORISED = "__uncategorised__";
const NO_GROUP = "__no-group__";

const invalidateFinance = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ["finance"] });

/**
 * A category can back budgets in more than one group (spec: a "Food" budget
 * in a trip group and a separate everyday "Food" budget resolve to the same
 * category). Flat lists — the transaction category dropdown, the
 * transactions filter pills — lose that context, so this maps each grouped
 * category to its group's name for a "Group - Category" label.
 */
export function useCategoryGroupLabels(month: string) {
  const { data } = useQuery({
    queryKey: ["finance", "budgets", month],
    queryFn: () =>
      api.get<{ groups: BudgetGroupView[]; ungrouped: BudgetView[] }>(
        `/api/finance/budgets?month=${month}`,
      ),
  });

  return useMemo(() => {
    const map = new Map<string, string>();
    for (const group of data?.groups ?? []) {
      for (const budget of group.budgets) {
        map.set(budget.categoryId, group.name);
      }
    }
    return map;
  }, [data]);
}

export function categoryLabel(
  category: { id: string; name: string },
  groupLabels: Map<string, string>,
): string {
  const group = groupLabels.get(category.id);
  return group ? `${group} - ${category.name}` : category.name;
}

// ---------------------------------------------------------------------------

/**
 * The check → impact-preview → reassign/cascade delete flow for an account,
 * shared between the modal's "delete" action and the Accounts tab's
 * per-card quick-delete button so the three mutations exist in one place.
 */
export function useAccountDelete(
  account: AccountView | null,
  accounts: AccountView[],
  onDone: () => void,
) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<{
    accountName: string;
    transactions: { id: string; name: string; occurredOn: string; amount: string }[];
  } | null>(null);

  const done = () => {
    void invalidateFinance(queryClient);
    onDone();
  };

  const attemptDelete = useMutation({
    mutationFn: () =>
      api.delete("/api/finance/accounts", { id: account!.id, mode: "check" }),
    onSuccess: done,
    onError: async (e) => {
      if (e instanceof AppError && e.code === "REFERENCED") {
        setImpact(
          await api.get(`/api/finance/accounts?impactFor=${account!.id}`),
        );
        return;
      }
      // Includes "you need at least one account", which is blocked outright
      // rather than offered as a choice (product spec §9).
      setError(userMessage(e, "That could not be deleted."));
    },
  });

  const resolveDelete = useMutation({
    mutationFn: (vars: { mode: "reassign" | "cascade"; targetAccountId?: string }) =>
      api.delete("/api/finance/accounts", { id: account!.id, ...vars }),
    onSuccess: done,
  });

  const dialog =
    impact && account ? (
      <ImpactPreviewDialog
        open
        onOpenChange={(open) => !open && setImpact(null)}
        title={`Delete "${impact.accountName}"?`}
        noun="transactions"
        records={impact.transactions.map((t) => ({
          id: t.id,
          label: t.name,
          meta: `${formatListDate(t.occurredOn)} · ${formatMoney(t.amount)}`,
        }))}
        reassignTargets={accounts
          .filter((a) => a.id !== account.id)
          .map((a) => ({ id: a.id, label: a.name }))}
        reassignLabel="Move all to"
        pending={resolveDelete.isPending}
        onReassign={(targetAccountId) =>
          resolveDelete.mutate({ mode: "reassign", targetAccountId })
        }
        onDeleteAll={() => resolveDelete.mutate({ mode: "cascade" })}
      />
    ) : null;

  return { attemptDelete, error, dialog };
}

// ---------------------------------------------------------------------------

const ACCOUNT_KIND_PILLS: { value: AccountKind; label: string }[] = ACCOUNT_KINDS.map(
  (value) => ({ value, label: KIND_LABELS[value] }),
);

function AccountKindPicker({
  value,
  onChange,
}: {
  value: AccountKind;
  onChange: (kind: AccountKind) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.75">
      {ACCOUNT_KIND_PILLS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className="rounded-pill border px-3.25 py-1.5 font-mono text-[11.5px] text-text"
            style={{
              borderColor: selected ? "var(--accent-default)" : "var(--border)",
              background: selected
                ? "color-mix(in srgb, var(--accent-default) 10%, transparent)"
                : "transparent",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * `allowBalanceEdit` scopes the reconciliation field to the Accounts tab —
 * the Overview tab's quick chip-edit stays name/type only.
 */
export function AccountModal({
  account,
  accounts,
  allowBalanceEdit = false,
  onClose,
}: {
  account: AccountView | null;
  accounts: AccountView[];
  allowBalanceEdit?: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "CASH");
  const [opening, setOpening] = useState("");
  const [balance, setBalance] = useState(account?.balance ?? "0");
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const done = () => {
    void invalidateFinance(queryClient);
    onClose();
  };

  const save = useMutation({
    mutationFn: () =>
      account
        ? api.patch("/api/finance/accounts", {
            id: account.id,
            name,
            kind,
            ...(allowBalanceEdit ? { balance } : {}),
          })
        : api.post("/api/finance/accounts", {
            id: newId(),
            name,
            kind,
            openingBalance: opening || "0",
          }),
    onSuccess: done,
    onError: (e) => setError(userMessage(e, "That didn't save.")),
  });

  const { attemptDelete, error: deleteError, dialog } = useAccountDelete(
    account,
    accounts,
    done,
  );

  if (dialog) return dialog;

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker={account ? "EDIT ACCOUNT" : "NEW ACCOUNT"}
      title={account ? "Edit account" : "New account"}
      width={420}
      titleVisible={false}
    >
      <Input
        variant="ghost"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Wallet, GCash, Savings…"
        aria-label="Account name"
        autoFocus
        className="mt-3"
      />

      <div className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="kicker">Type</span>
          <AccountKindPicker value={kind} onChange={setKind} />
        </label>

        {!account && (
          <label className="flex flex-col gap-1.5">
            <span className="kicker">Opening balance</span>
            <Input
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
          </label>
        )}

        {account && allowBalanceEdit && (
          <label className="flex flex-col gap-1.5">
            <span className="kicker">Balance (PHP)</span>
            <Input
              tinted
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              inputMode="decimal"
            />
          </label>
        )}

        {(error || deleteError) && (
          <p className="m-0 font-mono text-[11.5px] text-accent-red">
            {error || deleteError}
          </p>
        )}
      </div>

      <ModalActions
        destructive={
          account ? (
            <Button variant="outline" onClick={() => attemptDelete.mutate()}>
              delete
            </Button>
          ) : null
        }
      >
        <Button variant="outline" onClick={onClose}>
          cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}>
          save
        </Button>
      </ModalActions>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function TransactionModal({
  transaction,
  accounts,
  categories,
  month,
  today,
  onClose,
}: {
  transaction: TransactionView | null;
  accounts: AccountView[];
  categories: CategoryView[];
  month: string;
  today: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const groupLabels = useCategoryGroupLabels(month);
  const isTransferRow = transaction?.type === "TRANSFER";

  const [mode, setMode] = useState<"EXPENSE" | "INCOME" | "TRANSFER">(
    transaction ? (transaction.type === "TRANSFER" ? "TRANSFER" : transaction.type) : "EXPENSE",
  );
  const [name, setName] = useState(transaction?.name ?? "");
  const [occurredOn, setOccurredOn] = useState(transaction?.occurredOn ?? today);
  const [amount, setAmount] = useState(
    transaction ? String(Math.abs(Number(transaction.amount))) : "",
  );
  const [accountId, setAccountId] = useState(transaction?.accountId ?? accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? "");
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    void invalidateFinance(queryClient);
    onClose();
  };

  const save = useMutation({
    mutationFn: () => {
      if (mode === "TRANSFER") {
        return api.post("/api/finance/transfers", {
          groupId: newId(),
          outId: newId(),
          inId: newId(),
          name: name || "Transfer",
          occurredOn,
          amount,
          fromAccountId: accountId,
          toAccountId,
        });
      }

      const payload = {
        name,
        occurredOn,
        amount,
        type: mode,
        accountId,
        categoryId: categoryId || null,
      };
      return transaction
        ? api.patch("/api/finance/transactions", { id: transaction.id, ...payload })
        : api.post("/api/finance/transactions", { id: newId(), ...payload });
    },
    onSuccess: done,
    onError: (e) => setError(userMessage(e, "That didn't save.")),
  });

  const remove = useMutation({
    mutationFn: () =>
      api.delete("/api/finance/transactions", { id: transaction!.id }),
    onSuccess: done,
  });

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker={transaction ? "EDIT TRANSACTION" : "NEW TRANSACTION"}
      title={transaction ? "Edit transaction" : "New transaction"}
      width={460}
    >
      <div className="mt-5 flex flex-col gap-4">
        {!transaction && (
          <Segmented
            aria-label="Kind"
            value={mode}
            onChange={setMode}
            options={[
              { label: "Expense", value: "EXPENSE" },
              { label: "Income", value: "INCOME" },
              { label: "Transfer", value: "TRANSFER" },
            ]}
          />
        )}

        {isTransferRow && (
          <p className="m-0 font-mono text-[11.5px] text-muted">
            {/* G1: a transfer is two paired rows presented as one movement. */}
            this is one leg of a transfer — deleting it removes both
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="kicker">Name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={mode === "TRANSFER" ? "Transfer" : "Groceries, jeepney fare…"}
            disabled={isTransferRow}
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="kicker">Date</span>
            <Input
              type="date"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              disabled={isTransferRow}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="kicker">Amount</span>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              disabled={isTransferRow}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="kicker">{mode === "TRANSFER" ? "From" : "Account"}</span>
          <Select
            value={accountId}
            onValueChange={setAccountId}
            disabled={isTransferRow}
            aria-label={mode === "TRANSFER" ? "Transfer from" : "Account"}
          >
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </Select>
        </label>

        {mode === "TRANSFER" ? (
          <label className="flex flex-col gap-1.5">
            <span className="kicker">To</span>
            <Select value={toAccountId} onValueChange={setToAccountId} aria-label="Transfer to">
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </Select>
          </label>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="kicker">Category</span>
            <Select
              value={categoryId || UNCATEGORISED}
              onValueChange={(next) => setCategoryId(next === UNCATEGORISED ? "" : next)}
              disabled={isTransferRow}
            >
              <SelectItem value={UNCATEGORISED}>uncategorised</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {categoryLabel(category, groupLabels)}
                </SelectItem>
              ))}
            </Select>
          </label>
        )}

        {error && <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>}
      </div>

      <ModalActions
        destructive={
          transaction ? (
            <Button variant="outline" onClick={() => remove.mutate()}>
              delete
            </Button>
          ) : null
        }
      >
        <Button variant="outline" onClick={onClose}>
          cancel
        </Button>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || isTransferRow || !amount}
        >
          save
        </Button>
      </ModalActions>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function CategoryModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("blue");

  const save = useMutation({
    mutationFn: () => api.post("/api/finance/categories", { id: newId(), name, color }),
    onSuccess: () => {
      void invalidateFinance(queryClient);
      onClose();
    },
  });

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker="NEW CATEGORY"
      title="New category"
      width={400}
    >
      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="kicker">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="kicker">Color</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option}
                aria-pressed={color === option}
                onClick={() => setColor(option)}
                className={cn(
                  "size-6 rounded-full border-2",
                  color === option ? "border-text" : "border-transparent",
                )}
                style={{ background: `var(--accent-${option})` }}
              />
            ))}
          </div>
        </div>
      </div>
      <ModalActions>
        <Button variant="outline" onClick={onClose}>
          cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={!name.trim()}>
          save
        </Button>
      </ModalActions>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

/**
 * The "allowance" from product spec §9 — expected periodic income, which is
 * what the overview measures the month's spending against.
 *
 * There is one per user, so this upserts rather than creating a list.
 */
export function IncomeModal({
  income,
  today,
  onClose,
}: {
  income: { id: string; name: string; amount: string; nextOn: string } | null;
  today: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(income?.name ?? "Allowance");
  const [amount, setAmount] = useState(income?.amount ?? "");
  const [nextOn, setNextOn] = useState(income?.nextOn ?? today);

  const save = useMutation({
    mutationFn: () =>
      api.post("/api/finance/income", {
        id: income?.id ?? newId(),
        name,
        amount,
        cadence: "MONTHLY",
        nextOn,
      }),
    onSuccess: () => {
      void invalidateFinance(queryClient);
      onClose();
    },
  });

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker={income ? "EDIT ALLOWANCE" : "SET ALLOWANCE"}
      title={income ? "Edit allowance" : "Set allowance"}
      width={400}
    >
      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="kicker">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="kicker">Amount a month</span>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="kicker">Next on</span>
          <Input type="date" value={nextOn} onChange={(e) => setNextOn(e.target.value)} />
        </label>
      </div>
      <ModalActions>
        <Button variant="outline" onClick={onClose}>
          cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={!amount}>
          save
        </Button>
      </ModalActions>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function BudgetModal({
  groups,
  onClose,
}: {
  groups: { id: string; name: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [limitAmount, setLimitAmount] = useState("");
  const [groupId, setGroupId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api.post("/api/finance/budgets", {
        id: newId(),
        name,
        limitAmount,
        groupId: groupId || null,
      }),
    onSuccess: () => {
      void invalidateFinance(queryClient);
      onClose();
    },
    onError: (e) => setError(userMessage(e, "That didn't save.")),
  });

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker="NEW BUDGET"
      title="New budget"
      width={420}
      titleVisible={false}
    >
      <Input
        variant="ghost"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Budget name"
        aria-label="Budget name"
        autoFocus
        className="mt-3"
      />

      <div className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="kicker">Cap (PHP)</span>
          <Input
            tinted
            className="border-none"
            value={limitAmount}
            onChange={(e) => setLimitAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="kicker">Group · optional</span>
          <Select
            variant="tinted"
            value={groupId || NO_GROUP}
            onValueChange={(next) => setGroupId(next === NO_GROUP ? "" : next)}
          >
            <SelectItem value={NO_GROUP}>No group</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </Select>
        </label>

        {error && <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>}
      </div>
      <ModalActions>
        <Button variant="outline" onClick={onClose}>
          cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={!name.trim() || !limitAmount}>
          add
        </Button>
      </ModalActions>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function BudgetGroupModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.post("/api/finance/budget-groups", { id: newId(), name }),
    onSuccess: () => {
      void invalidateFinance(queryClient);
      onClose();
    },
    onError: (e) => setError(userMessage(e, "That didn't save.")),
  });

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker="NEW GROUP"
      title="New budget group"
      width={360}
      titleVisible={false}
    >
      <Input
        variant="ghost"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name"
        aria-label="Group name"
        autoFocus
        className="mt-3"
      />

      {error && <p className="m-0 mt-4 font-mono text-[11.5px] text-accent-red">{error}</p>}
      <ModalActions>
        <Button variant="outline" onClick={onClose}>
          cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={!name.trim()}>
          add
        </Button>
      </ModalActions>
    </Modal>
  );
}
