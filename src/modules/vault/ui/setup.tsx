"use client";

import { useRef, useState } from "react";

import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { userMessage } from "@/core/errors";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Input } from "@/core/ui/input";

import { bytesToBase64 } from "../crypto/base64";
import { deriveKek, DEFAULT_KDF_PARAMS, generateDek, randomBytes, wrapDek } from "../crypto/key";
import { deriveRkek, generateRecoveryKit } from "../crypto/recovery";
import { makeVerifier } from "../crypto/verifier";
import { unlock } from "./session";

/**
 * First-run setup. Product spec §11 / system design §4.2: the master
 * password is not recoverable, so the recovery kit is generated and shown
 * here, once, with an explicit "I've saved this" gate before the vault can
 * be used.
 */
export function VaultSetup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"password" | "recovery">("password");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kit, setKit] = useState("");
  const [saved, setSaved] = useState(false);

  const pending = useRef<{
    dek: CryptoKey | null;
    payload: Record<string, string | number> | null;
  }>({ dek: null, payload: null });

  const createVault = async () => {
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those don't match.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const salt = randomBytes(16);
      const kek = await deriveKek(password, salt, DEFAULT_KDF_PARAMS);
      const dek = await generateDek();
      const wrapped = await wrapDek(dek, kek);

      const recoveryKit = generateRecoveryKit();
      const rkek = await deriveRkek(recoveryKit);
      const recoveryWrapped = await wrapDek(dek, rkek);

      const verifier = await makeVerifier(kek);

      pending.current.dek = dek;
      pending.current.payload = {
        id: newId(),
        kdfSalt: bytesToBase64(salt),
        kdfMemoryKiB: DEFAULT_KDF_PARAMS.memoryKiB,
        kdfIterations: DEFAULT_KDF_PARAMS.iterations,
        kdfParallelism: DEFAULT_KDF_PARAMS.parallelism,
        wrappedDek: bytesToBase64(wrapped.ciphertext),
        wrappedDekIv: bytesToBase64(wrapped.iv),
        recoveryDek: bytesToBase64(recoveryWrapped.ciphertext),
        recoveryDekIv: bytesToBase64(recoveryWrapped.iv),
        verifier: bytesToBase64(verifier.verifier),
        verifierIv: bytesToBase64(verifier.iv),
      };

      setKit(recoveryKit);
      setStep("recovery");
    } catch {
      setError("Something went wrong setting up encryption. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!pending.current.payload || !pending.current.dek) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/vault/settings", pending.current.payload);
      unlock(pending.current.dek, []);
      onDone();
    } catch (e) {
      setError(userMessage(e, "That didn't save."));
    } finally {
      setBusy(false);
    }
  };

  if (step === "password") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="w-full max-w-[420px]">
          <div className="kicker mb-2.5">Set up</div>
          <h1 className="m-0 font-serif text-[22px] font-normal">Create a master password</h1>
          <p className="m-0 mt-2 font-mono text-[11.5px] leading-relaxed text-muted">
            This unlocks every credential. It is not recoverable — losing it
            means losing everything stored here, unless you keep the recovery
            kit on the next screen safe.
          </p>

          <div className="mt-5 flex flex-col gap-3">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master password"
              aria-label="Master password"
              autoFocus
            />
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm master password"
              aria-label="Confirm master password"
            />
            {error && <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>}
            <Button onClick={createVault} disabled={busy || !password || !confirm}>
              {busy ? "setting up…" : "continue"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-[480px]">
        <div className="kicker mb-2.5">Recovery kit</div>
        <h1 className="m-0 font-serif text-[22px] font-normal">Save this now</h1>
        <p className="m-0 mt-2 font-mono text-[11.5px] leading-relaxed text-muted">
          This code independently unlocks the vault if you forget your master
          password. It is shown once. We cannot recover it for you — write it
          down or store it somewhere safe, separate from the password itself.
        </p>

        <div className="mt-4 rounded-input border border-border-strong bg-[color-mix(in_srgb,var(--text)_4%,transparent)] px-4 py-3 text-center font-mono text-[13px] tracking-[0.04em]">
          {kit}
        </div>

        <label className="mt-4 flex items-center gap-2.5 font-mono text-[11.5px] text-text">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
          />
          I&rsquo;ve saved this recovery kit somewhere safe
        </label>

        {error && <p className="m-0 mt-3 font-mono text-[11.5px] text-accent-red">{error}</p>}

        <Button className="mt-5 w-full" onClick={finish} disabled={!saved || busy}>
          {busy ? "finishing…" : "open vault"}
        </Button>
      </Card>
    </div>
  );
}
