"use client";

import { useEffect, useState } from "react";

import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Input } from "@/core/ui/input";

import { base64ToBytes } from "../crypto/base64";
import { deriveKek, unwrapDek } from "../crypto/key";
import { checkVerifier } from "../crypto/verifier";
import type { VaultSettingsView } from "../schema";
import { loadAndDecryptItems } from "./load-items";
import { isPinEnabled, PinLockedOutError, unlockWithPin } from "./pin";
import { unlock } from "./session";

/**
 * Product spec §11: wrong password/PIN shows a clear error and clears the
 * input — no attempt count is ever surfaced.
 */
export function VaultLockScreen({ settings }: { settings: VaultSettingsView }) {
  const [mode, setMode] = useState<"password" | "pin">("password");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isPinEnabled().then((enabled) => {
      if (enabled) setMode("pin");
    });
  }, []);

  const audit = (action: "UNLOCK_SUCCESS" | "UNLOCK_FAILURE") => {
    void api.post("/api/vault/audit", { id: newId(), action, itemId: null });
  };

  const finishUnlock = async (dek: CryptoKey) => {
    const items = await loadAndDecryptItems(dek);
    unlock(dek, items, settings?.autoLockSeconds);
    audit("UNLOCK_SUCCESS");
  };

  const submitPassword = async () => {
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const kek = await deriveKek(password, base64ToBytes(settings.kdfSalt), {
        memoryKiB: settings.kdfMemoryKiB,
        iterations: settings.kdfIterations,
        parallelism: settings.kdfParallelism,
      });
      const ok = await checkVerifier(
        base64ToBytes(settings.verifier),
        base64ToBytes(settings.verifierIv),
        kek,
      );
      if (!ok) {
        audit("UNLOCK_FAILURE");
        setError("That password doesn't match.");
        setPassword("");
        return;
      }

      const dek = await unwrapDek(
        base64ToBytes(settings.wrappedDek),
        base64ToBytes(settings.wrappedDekIv),
        kek,
      );
      await finishUnlock(dek);
    } catch {
      setError("Something went wrong unlocking the vault.");
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  const submitPin = async () => {
    setBusy(true);
    setError(null);
    try {
      const dek = await unlockWithPin(pin);
      await finishUnlock(dek);
    } catch (e) {
      if (e instanceof PinLockedOutError) {
        setMode("password");
        setError(e.message);
      } else {
        setError("That PIN doesn't match.");
      }
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-95">
        <div className="kicker mb-2.5">Locked</div>
        <h1 className="m-0 font-serif text-[22px] font-normal">Vault</h1>

        {mode === "password" ? (
          <div className="mt-5 flex flex-col gap-3">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master password"
              aria-label="Master password"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submitPassword()}
            />
            {error && <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>}
            <Button onClick={submitPassword} disabled={busy || !password}>
              {busy ? "unlocking…" : "unlock"}
            </Button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="4-digit PIN"
              aria-label="PIN"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submitPin()}
            />
            {error && <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>}
            <Button onClick={submitPin} disabled={busy || pin.length !== 4}>
              {busy ? "unlocking…" : "unlock"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setMode("password");
                setError(null);
              }}
              className="font-mono text-[11px] text-muted"
            >
              use master password instead
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
