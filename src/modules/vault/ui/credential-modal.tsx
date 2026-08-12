"use client";

import { useState } from "react";

import { userMessage } from "@/core/errors";
import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Input, Textarea } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";

import { bytesToBase64 } from "../crypto/base64";
import { sealItem, VAULT_CATEGORIES, VAULT_CATEGORY_LABELS, type VaultCategory } from "../crypto/item";
import { getDek, setItems, type VaultItemDecrypted } from "./session";

/**
 * Create and edit share one form: an edit reseals the entire record rather
 * than patching a field, so there is only one write shape (system design
 * §4.1). Delete needs its own confirmation step (product spec §11's
 * sensitivity/irreversibility note) — a bare button here would be one
 * misclick away from losing a credential permanently.
 */
export function CredentialModal({
  item,
  items,
  onClose,
}: {
  item: VaultItemDecrypted | null;
  items: VaultItemDecrypted[];
  onClose: () => void;
}) {
  const [site, setSite] = useState(item?.site ?? "");
  const [username, setUsername] = useState(item?.username ?? "");
  const [password, setPassword] = useState(item?.password ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [url, setUrl] = useState(item?.url ?? "");
  const [category, setCategory] = useState<VaultCategory>(item?.category ?? "OTHER");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const save = async () => {
    const dek = getDek();
    if (!dek || !site.trim()) return;

    setBusy(true);
    setError(null);
    try {
      const id = item?.id ?? newId();
      const plain = {
        site: site.trim(),
        username,
        password,
        url: url.trim() || null,
        category,
        notes: notes.trim() || null,
      };
      const { ciphertext, iv } = await sealItem(plain, dek);
      const payload = {
        id,
        ciphertext: bytesToBase64(ciphertext),
        iv: bytesToBase64(iv),
      };

      if (item) {
        await api.patch("/api/vault/items", payload);
      } else {
        await api.post("/api/vault/items", payload);
      }

      const now = new Date().toISOString();
      const next: VaultItemDecrypted = {
        ...plain,
        id,
        createdAt: item?.createdAt ?? now,
        updatedAt: now,
      };
      setItems(
        item
          ? items.map((existing) => (existing.id === id ? next : existing))
          : [...items, next],
      );
      onClose();
    } catch (e) {
      setError(userMessage(e, "That didn't save."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    setBusy(true);
    try {
      await api.delete("/api/vault/items", { id: item.id });
      await api.post("/api/vault/audit", {
        id: newId(),
        action: "ITEM_DELETED",
        itemId: item.id,
      });
      setItems(items.filter((existing) => existing.id !== item.id));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker={item ? "EDIT CREDENTIAL" : "NEW CREDENTIAL"}
      title={item ? "Edit credential" : "New credential"}
      width={440}
    >
      <div className="mt-5 flex flex-col gap-4">
        <Input
          variant="ghost"
          value={site}
          onChange={(e) => setSite(e.target.value)}
          placeholder="Site or service"
          aria-label="Site"
          autoFocus
        />

        <label className="flex flex-col gap-1.5">
          <span className="kicker">Username</span>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="kicker">Password</span>
          <div className="flex items-center gap-2">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Password"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "hide" : "show"}
            </Button>
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="kicker">URL · optional</span>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="kicker">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as VaultCategory)}
            className="w-full rounded-input border border-border bg-transparent px-[11px] py-2 font-mono text-[12.5px] text-text outline-none"
          >
            {VAULT_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {VAULT_CATEGORY_LABELS[option]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="kicker">Notes · optional</span>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="2FA via Authenticator app…"
          />
        </label>

        {error && <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>}
      </div>

      <ModalActions
        destructive={
          item ? (
            <Button
              variant="outline"
              onClick={() => (confirmingDelete ? remove() : setConfirmingDelete(true))}
              onBlur={() => setConfirmingDelete(false)}
              disabled={busy}
              className={confirmingDelete ? "text-accent-red" : undefined}
            >
              {confirmingDelete ? "confirm delete" : "delete"}
            </Button>
          ) : null
        }
      >
        <Button variant="outline" onClick={onClose}>
          cancel
        </Button>
        <Button onClick={save} disabled={busy || !site.trim()}>
          save
        </Button>
      </ModalActions>
    </Modal>
  );
}
