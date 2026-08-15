"use client";

import { useState } from "react";

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
        <div className="max-w-180">
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
  };

  return (
    <div className="row-divider list-row flex flex-wrap items-center gap-3">
      <span
        aria-hidden
        className="size-1.75 flex-none rounded-full"
        style={{ background: `var(--accent-${VAULT_CATEGORY_COLORS[item.category]})` }}
      />

      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 text-left"
        aria-label={`Edit ${item.site}`}
      >
        <span className="block font-mono text-[13px]">{item.site}</span>
        <span className="block font-mono text-[10.5px] text-muted">
          {item.username || "no username"}
        </span>
      </button>

      <span className="flex-none font-mono text-[12.5px] tracking-[0.08em] text-muted">
        {revealed ? item.password || "—" : "••••••••"}
      </span>

      <div className="flex flex-none items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={reveal}
          aria-label={revealed ? `Hide password for ${item.site}` : `Reveal password for ${item.site}`}
        >
          {revealed ? "hide" : "reveal"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copy("username")}
          aria-label={`Copy username for ${item.site}`}
        >
          {copied === "username" ? "copied" : "copy user"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copy("password")}
          aria-label={`Copy password for ${item.site}`}
        >
          {copied === "password" ? "copied" : "copy pass"}
        </Button>
      </div>
    </div>
  );
}
