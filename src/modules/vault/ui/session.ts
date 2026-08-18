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

/**
 * The idle watchdog lives here, next to the DEK it protects, rather than in
 * the `useAutoLock` hook that used to own it.
 *
 * The DEK is module-scoped, so it outlives any component — it is cleared by
 * `lock()` or by a full page load, and by nothing else. When the timer was
 * owned by a hook mounted under the Vault route, navigating to any other
 * module unmounted that hook and tore the timer down *without locking*, so
 * the key sat in memory indefinitely and coming back to /vault walked
 * straight into an unlocked vault. Tying the watchdog to the key's own
 * lifetime instead of a component's is what makes the auto-lock setting mean
 * what it says.
 */
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "click"] as const;
const DEFAULT_AUTO_LOCK_SECONDS = 300;

let lastActivity = 0;
let autoLockSeconds = DEFAULT_AUTO_LOCK_SECONDS;
let watchdog: number | null = null;

function bump(): void {
  lastActivity = Date.now();
}

function startWatchdog(seconds: number): void {
  stopWatchdog();
  autoLockSeconds = seconds > 0 ? seconds : DEFAULT_AUTO_LOCK_SECONDS;
  lastActivity = Date.now();

  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, bump, { passive: true });
  }

  watchdog = window.setInterval(() => {
    if (idleSeconds() >= autoLockSeconds) lock();
  }, 1000);
}

function stopWatchdog(): void {
  if (watchdog !== null) {
    window.clearInterval(watchdog);
    watchdog = null;
  }
  for (const event of ACTIVITY_EVENTS) {
    window.removeEventListener(event, bump);
  }
}

function publish(): void {
  snapshot = { locked: dek === null, items };
  for (const listener of listeners) listener();
}

/** Called once per unlock, with the DEK and every item already decrypted. */
export function unlock(
  nextDek: CryptoKey,
  nextItems: VaultItemDecrypted[],
  seconds: number = DEFAULT_AUTO_LOCK_SECONDS,
): void {
  dek = nextDek;
  items = nextItems;
  startWatchdog(seconds);
  publish();
}

/** Zeroes the key and clears the list — the only two things auto-lock has to do. */
export function lock(): void {
  dek = null;
  items = [];
  stopWatchdog();
  publish();
}

/** Seconds since the last user activity. Meaningless while locked. */
export function idleSeconds(): number {
  return (Date.now() - lastActivity) / 1000;
}

export function getAutoLockSeconds(): number {
  return autoLockSeconds;
}

/** Push back the deadline — the "I'm here" button on the warning banner. */
export function noteActivity(): void {
  bump();
}

/**
 * Re-arm the watchdog after the user changes the setting mid-session, so a
 * shortened timeout takes effect now rather than at the next unlock.
 */
export function setAutoLockSeconds(seconds: number): void {
  if (dek === null) return;
  startWatchdog(seconds);
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
