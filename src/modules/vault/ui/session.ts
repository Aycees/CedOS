"use client";

import { useSyncExternalStore } from "react";

import type { VaultItemPlain } from "../crypto/item";

/**
 * The Vault's in-memory session — a module-scoped store, deliberately not a
 * React store (system design §4.4). The DEK must never be able to land in a
 * serialized payload, which rules out React state; `useSyncExternalStore` is
 * only used to let components *observe* lock state and the decrypted list,
 * never the key itself. `getDek` is exported for code that needs to seal or
 * open an item and is never threaded through the hook's return value.
 */

export type VaultItemDecrypted = VaultItemPlain & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

type Snapshot = { locked: boolean; items: VaultItemDecrypted[] };

let dek: CryptoKey | null = null;
let items: VaultItemDecrypted[] = [];
let snapshot: Snapshot = { locked: true, items: [] };
const listeners = new Set<() => void>();

function publish(): void {
  snapshot = { locked: dek === null, items };
  for (const listener of listeners) listener();
}

/** Called once per unlock, with the DEK and every item already decrypted. */
export function unlock(nextDek: CryptoKey, nextItems: VaultItemDecrypted[]): void {
  dek = nextDek;
  items = nextItems;
  publish();
}

/** Zeroes the key and clears the list — the only two things auto-lock has to do. */
export function lock(): void {
  dek = null;
  items = [];
  publish();
}

export function setItems(nextItems: VaultItemDecrypted[]): void {
  items = nextItems;
  publish();
}

export function getDek(): CryptoKey | null {
  return dek;
}

export function isUnlocked(): boolean {
  return dek !== null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Snapshot {
  return snapshot;
}

export function useVaultSession(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
