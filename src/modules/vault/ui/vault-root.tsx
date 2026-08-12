"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/core/mutation/client";

import type { VaultSettingsView } from "../schema";
import { VaultLockScreen } from "./lock-screen";
import { VaultSetup } from "./setup";
import { useVaultSession } from "./session";
import { VaultUnlocked } from "./unlocked";

/**
 * The client-only Vault root (system design §4.4) — three states, and the
 * fourth possibility, "unlocked", only exists as long as `VaultUnlocked`
 * stays mounted. Locking (manual, auto-lock, or a PIN lockout) flips
 * `locked` back to true here, which unmounts `VaultUnlocked` and any open
 * credential modal with it — that unmount *is* the "discard the draft"
 * behaviour decision A9 calls for, with no extra bookkeeping.
 */
export function VaultRoot() {
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ["vault", "settings"],
    queryFn: () => api.get<VaultSettingsView>("/api/vault/settings"),
  });
  const { locked } = useVaultSession();

  if (isLoading) return null;

  if (!settings) {
    return <VaultSetup onDone={() => void refetch()} />;
  }

  if (locked) {
    return <VaultLockScreen settings={settings} />;
  }

  return <VaultUnlocked settings={settings} onSettingsChanged={() => void refetch()} />;
}
