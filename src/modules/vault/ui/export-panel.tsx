"use client";

import { useState } from "react";

import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";

import { base64ToBytes } from "../crypto/base64";
import { deriveKek, unwrapDek } from "../crypto/key";
import { checkVerifier } from "../crypto/verifier";
import type { VaultSettingsView } from "../schema";
import { loadAndDecryptItems } from "./load-items";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The "include decrypted credentials" export (G2 / system design). Always a
 * fresh master-password entry, independent of whether the Vault happens to
 * be unlocked elsewhere right now — a plaintext credential file is highest-
 * stakes output this app produces, and re-authenticating for it is
 * deliberate friction. The server never assembles this version: it only
 * ever hands back ciphertext (GET /api/export), and every byte of
 * decryption here happens in the browser.
 */
export function VaultExportPanel() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const settings = await api.get<VaultSettingsView>("/api/vault/settings");
      if (!settings) {
        setError("Set up the vault before exporting its credentials.");
        return;
      }

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
        setError("That password doesn't match.");
        setPassword("");
        return;
      }

      const dek = await unwrapDek(
        base64ToBytes(settings.wrappedDek),
        base64ToBytes(settings.wrappedDekIv),
        kek,
      );
      const [exportData, items] = await Promise.all([
        api.get<Record<string, unknown>>("/api/export"),
        loadAndDecryptItems(dek),
      ]);

      downloadJson(
        { ...exportData, vault: { encrypted: false, items } },
        `ced-os-export-with-decrypted-credentials-${new Date().toISOString().slice(0, 10)}.json`,
      );
      setOpen(false);
      setPassword("");
    } catch {
      setError("Something went wrong preparing the export.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        include decrypted credentials
      </Button>

      {open && (
        <Modal
          open
          onOpenChange={(next) => !next && setOpen(false)}
          kicker="Export"
          title="Decrypt for export"
          width={400}
        >
          <div className="mt-5 flex flex-col gap-3">
            <p className="m-0 font-mono text-[11.5px] leading-relaxed text-muted">
              This produces a plainly-labeled file with every credential in
              readable text. It never touches the server — decryption happens
              here, in this browser, after you confirm the master password.
            </p>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master password"
              aria-label="Master password for export"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
            {error && <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>}
          </div>

          <ModalActions>
            <Button variant="outline" onClick={() => setOpen(false)}>
              cancel
            </Button>
            <Button onClick={run} disabled={busy || !password}>
              {busy ? "decrypting…" : "download"}
            </Button>
          </ModalActions>
        </Modal>
      )}
    </>
  );
}
