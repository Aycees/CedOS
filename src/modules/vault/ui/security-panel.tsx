"use client";

import { useEffect, useState } from "react";

import { userMessage } from "@/core/errors";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";
import { Segmented } from "@/core/ui/segmented";

import { base64ToBytes, bytesToBase64 } from "../crypto/base64";
import { deriveKek, DEFAULT_KDF_PARAMS, randomBytes, wrapDek } from "../crypto/key";
import { checkVerifier, makeVerifier } from "../crypto/verifier";
import type { VaultSettingsView } from "../schema";
import { disablePin, enablePin, isPinEnabled } from "./pin";
import { getDek } from "./session";

/**
 * Master-password change (an O(1) DEK rewrap) and this device's PIN, in one
 * place — both are "how the vault gets unlocked" settings, distinct from the
 * credentials themselves.
 */
export function SecurityPanel({
  settings,
  onClose,
  onSettingsChanged,
}: {
  settings: VaultSettingsView;
  onClose: () => void;
  onSettingsChanged: () => void;
}) {
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [settingPin, setSettingPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const [autoLockSeconds, setAutoLockSeconds] = useState(settings?.autoLockSeconds ?? 300);
  const [autoLockBusy, setAutoLockBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    isPinEnabled().then(setPinEnabled);
  }, []);

  const dek = getDek();

  const submitPin = async () => {
    if (!dek) return;
    if (!/^\d{4}$/.test(newPin)) {
      setPinError("PIN must be 4 digits.");
      return;
    }
    if (newPin !== newPinConfirm) {
      setPinError("Those don't match.");
      return;
    }
    setPinBusy(true);
    setPinError(null);
    try {
      await enablePin(newPin, dek);
      await api.patch("/api/vault/settings/preferences", { unlockMethod: "BOTH" });
      setPinEnabled(true);
      setSettingPin(false);
      setNewPin("");
      setNewPinConfirm("");
    } finally {
      setPinBusy(false);
    }
  };

  const changeAutoLock = async (seconds: number) => {
    if (!settings) return;
    setAutoLockBusy(true);
    try {
      await api.patch("/api/vault/settings/preferences", {
        unlockMethod: settings.unlockMethod,
        autoLockSeconds: seconds,
      });
      setAutoLockSeconds(seconds);
      onSettingsChanged();
    } finally {
      setAutoLockBusy(false);
    }
  };

  const removePin = async () => {
    setPinBusy(true);
    try {
      await disablePin();
      await api.patch("/api/vault/settings/preferences", { unlockMethod: "MASTER_PASSWORD" });
      setPinEnabled(false);
    } finally {
      setPinBusy(false);
    }
  };

  const changePassword = async () => {
    if (!settings || !dek) return;
    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError("Those don't match.");
      return;
    }

    setPasswordBusy(true);
    setPasswordError(null);
    try {
      const oldKek = await deriveKek(currentPassword, base64ToBytes(settings.kdfSalt), {
        memoryKiB: settings.kdfMemoryKiB,
        iterations: settings.kdfIterations,
        parallelism: settings.kdfParallelism,
      });
      const ok = await checkVerifier(
        base64ToBytes(settings.verifier),
        base64ToBytes(settings.verifierIv),
        oldKek,
      );
      if (!ok) {
        setPasswordError("Current password doesn't match.");
        return;
      }

      const newSalt = randomBytes(16);
      const newKek = await deriveKek(newPassword, newSalt, DEFAULT_KDF_PARAMS);
      const wrapped = await wrapDek(dek, newKek);
      const verifier = await makeVerifier(newKek);

      await api.patch("/api/vault/settings/rewrap", {
        kdfSalt: bytesToBase64(newSalt),
        kdfMemoryKiB: DEFAULT_KDF_PARAMS.memoryKiB,
        kdfIterations: DEFAULT_KDF_PARAMS.iterations,
        kdfParallelism: DEFAULT_KDF_PARAMS.parallelism,
        wrappedDek: bytesToBase64(wrapped.ciphertext),
        wrappedDekIv: bytesToBase64(wrapped.iv),
        verifier: bytesToBase64(verifier.verifier),
        verifierIv: bytesToBase64(verifier.iv),
      });

      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      onSettingsChanged();
    } catch (e) {
      setPasswordError(userMessage(e, "That didn't save."));
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} kicker="Security" title="Vault security" width={440}>
      <div className="mt-5 flex flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          <span className="kicker">This device&rsquo;s PIN</span>
          <p className="m-0 font-mono text-[11px] leading-relaxed text-muted">
            A quick re-unlock after auto-lock, on this device only. Five wrong
            PINs erase it and the master password is required again.
          </p>

          {pinEnabled ? (
            <Button variant="outline" onClick={removePin} disabled={pinBusy}>
              disable PIN on this device
            </Button>
          ) : settingPin ? (
            <div className="flex flex-col gap-2">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                placeholder="New 4-digit PIN"
                aria-label="New PIN"
              />
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPinConfirm}
                onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, ""))}
                placeholder="Confirm PIN"
                aria-label="Confirm PIN"
              />
              {pinError && <p className="m-0 font-mono text-[11.5px] text-accent-red">{pinError}</p>}
              <Button onClick={submitPin} disabled={pinBusy || newPin.length !== 4}>
                set PIN
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setSettingPin(true)}>
              enable PIN on this device
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2.5 border-t border-dashed border-border pt-4">
          <span className="kicker">Auto-lock after</span>
          <Segmented
            aria-label="Auto-lock duration"
            value={String(autoLockSeconds)}
            onChange={(value) => changeAutoLock(Number(value))}
            options={[
              { label: "1 min", value: "60" },
              { label: "5 min", value: "300" },
              { label: "15 min", value: "900" },
              { label: "30 min", value: "1800" },
            ]}
          />
          {autoLockBusy && <p className="m-0 font-mono text-[11px] text-muted">saving…</p>}
        </div>

        <div className="flex flex-col gap-2.5 border-t border-dashed border-border pt-4">
          <span className="kicker">Change master password</span>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            aria-label="Current password"
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            aria-label="New password"
          />
          <Input
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            placeholder="Confirm new password"
            aria-label="Confirm new password"
          />
          {passwordError && (
            <p className="m-0 font-mono text-[11.5px] text-accent-red">{passwordError}</p>
          )}
          <Button
            variant="outline"
            onClick={changePassword}
            disabled={passwordBusy || !currentPassword || !newPassword}
          >
            change password
          </Button>
        </div>
      </div>

      <ModalActions>
        <Button variant="outline" onClick={onClose}>
          close
        </Button>
      </ModalActions>
    </Modal>
  );
}
