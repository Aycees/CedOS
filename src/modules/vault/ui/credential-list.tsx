"use client";

import { useEffect, useRef, useState } from "react";

import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Chip } from "@/core/ui/chip";
import { cn } from "@/core/ui/cn";
import { Input } from "@/core/ui/input";
import { EmptyState } from "@/core/ui/page-header";

import {
  VAULT_CATEGORIES,
  VAULT_CATEGORY_COLORS,
  VAULT_CATEGORY_LABELS,
  type VaultCategory,
} from "../crypto/item";
import type { VaultItemDecrypted } from "./session";

/** How long a copied password may live on the system clipboard. */
const CLIPBOARD_CLEAR_MS = 30_000;

/**
 * All search, filter and sort happens here, over the already-decrypted array
 * (system design §4.1, decision C) — the server never sees a query term.
 * Duplicate site names are legal and never collapsed (product spec §11).
 */
export function CredentialList({
  items,
  onEdit,
  onNew,
}: {
  items: VaultItemDecrypted[];
  onEdit: (item: VaultItemDecrypted) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<VaultCategory | null>(null);

  const filtered = items
    .filter((item) => (category ? item.category === category : true))
    .filter((item) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        item.site.toLowerCase().includes(q) || item.username.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.site.localeCompare(b.site));

  if (items.length === 0) {
    return (
      <EmptyState
        line="no credentials yet"
        action={
          <Button variant="dashed" className="w-full" onClick={onNew}>
            + new credential
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-60"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search site or username"
          aria-label="Search credentials"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setCategory(null)}>
          <Chip className={cn(!category && "border-border-strong")}>all</Chip>
        </button>
        {VAULT_CATEGORIES.map((option) => (
          <button key={option} type="button" onClick={() => setCategory(option)}>
            <Chip
              dot
              color={`var(--accent-${VAULT_CATEGORY_COLORS[option]})`}
              className={cn(category === option && "border-border-strong")}
            >
              {VAULT_CATEGORY_LABELS[option]}
            </Chip>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState line="no credentials match" />
      ) : (
        <div className="max-w-180 rounded-card border border-border bg-card px-3 sm:px-4">
          {filtered.map((item) => (
            <CredentialRow key={item.id} item={item} onEdit={() => onEdit(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CredentialRow({
  item,
  onEdit,
}: {
  item: VaultItemDecrypted;
  onEdit: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<"username" | "password" | null>(null);
  const clearTimer = useRef<number | null>(null);

  // A pending clear must not outlive the row: locking the vault unmounts this
  // tree, and a timer that fired afterwards would wipe an unrelated clipboard.
  useEffect(
    () => () => {
      if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
    },
    [],
  );

  const accent = `var(--accent-${VAULT_CATEGORY_COLORS[item.category]})`;

  const reveal = () => {
    if (!revealed) {
      void api.post("/api/vault/audit", {
        id: newId(),
        action: "ITEM_REVEALED",
        itemId: item.id,
      });
    }
    setRevealed((r) => !r);
  };

  const copy = async (field: "username" | "password") => {
    await navigator.clipboard.writeText(field === "username" ? item.username : item.password);
    setCopied(field);
    window.setTimeout(() => setCopied(null), 1500);

    // The label resets after 1.5s, but the secret itself would otherwise sit
    // on the system clipboard indefinitely — readable by any other app, any
    // extension, or whoever uses the machine next. Auto-clearing a copied
    // password is what every password manager does; the window is deliberately
    // long enough to paste into a login form.
    if (field !== "password") return;

    if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => {
      // Best-effort: the document may have lost focus by now, which makes
      // writeText reject. Nothing useful to do about it either way.
      void navigator.clipboard.writeText("").catch(() => {});
      clearTimer.current = null;
    }, CLIPBOARD_CLEAR_MS);
  };

  return (
    <div className="row-divider list-row flex items-center gap-3">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-label={`Edit ${item.site}`}
      >
        <span
          aria-hidden
          className="flex size-7.5 flex-none items-center justify-center rounded-input font-mono text-[12px] font-medium"
          style={{
            background: `color-mix(in srgb, ${accent} 14%, transparent)`,
            color: accent,
          }}
        >
          {(item.site.charAt(0) || "?").toUpperCase()}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[13.5px] font-semibold text-text">
            {item.site}
          </span>
          <span className="block truncate font-mono text-[11px] text-muted">
            {item.username || "no username"} · {VAULT_CATEGORY_LABELS[item.category]}
          </span>
          {revealed && (
            <span className="mt-1 block font-mono text-[12px] text-text sm:hidden">
              {item.password || "—"}
            </span>
          )}
        </span>
      </button>

      <span
        className="hidden flex-none font-mono text-[12.5px] text-muted sm:block sm:w-28"
        style={revealed ? { letterSpacing: 0, color: "var(--text)" } : { letterSpacing: "0.12em" }}
      >
        {revealed ? item.password || "—" : "••••••••"}
      </span>

      <div className="flex flex-none items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted hover:text-text"
          onClick={reveal}
          aria-label={revealed ? `Hide password for ${item.site}` : `Reveal password for ${item.site}`}
        >
          {revealed ? "hide" : "show"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted hover:text-text"
          onClick={() => copy("username")}
          aria-label={`Copy username for ${item.site}`}
        >
          {copied === "username" ? "copied" : "user"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted hover:text-text"
          onClick={() => copy("password")}
          aria-label={`Copy password for ${item.site}`}
        >
          {copied === "password" ? "copied" : "pass"}
        </Button>
      </div>
    </div>
  );
}
