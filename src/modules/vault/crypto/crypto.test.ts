import { describe, expect, it } from "vitest";

import { deriveKek, generateDek, randomBytes, unwrapDek, wrapDek } from "./key";
import { openItem, sealItem, type VaultItemPlain } from "./item";
import { deriveRkek, generateRecoveryKit } from "./recovery";
import { checkVerifier, makeVerifier } from "./verifier";

/**
 * Low-cost KDF params so the suite runs in a reasonable time — production
 * strength (m=64MiB, t=3) is a VaultSettings column, not a constant, and
 * correctness here does not depend on it.
 */
const FAST_KDF = { memoryKiB: 1024, iterations: 1, parallelism: 1 };

const ITEM: VaultItemPlain = {
  site: "example.com",
  username: "cedric",
  password: "correct horse battery staple",
  url: "https://example.com",
  category: "WORK",
  notes: "2FA via Authenticator app",
};

describe("vault crypto", () => {
  it("round-trips an item through seal and open", async () => {
    const dek = await generateDek();
    const { ciphertext, iv } = await sealItem(ITEM, dek);
    const opened = await openItem(ciphertext, iv, dek);
    expect(opened).toEqual(ITEM);
  });

  it("fails the verifier on a wrong password and never reaches openItem", async () => {
    const salt = randomBytes(16);
    const rightKek = await deriveKek("correct-password", salt, FAST_KDF);
    const { verifier, iv } = await makeVerifier(rightKek);

    const wrongKek = await deriveKek("wrong-password", salt, FAST_KDF);
    await expect(checkVerifier(verifier, iv, wrongKek)).resolves.toBe(false);
    await expect(checkVerifier(verifier, iv, rightKek)).resolves.toBe(true);

    const dek = await generateDek();
    const wrapped = await wrapDek(dek, rightKek);
    await expect(unwrapDek(wrapped.ciphertext, wrapped.iv, wrongKek)).rejects.toThrow();
  });

  it("unwraps the same DEK from the password and from the recovery kit", async () => {
    const salt = randomBytes(16);
    const kek = await deriveKek("a-master-password", salt, FAST_KDF);
    const dek = await generateDek();

    const wrappedByPassword = await wrapDek(dek, kek);

    const kit = generateRecoveryKit();
    const rkek = await deriveRkek(kit);
    const wrappedByKit = await wrapDek(dek, rkek);

    const fromPassword = await unwrapDek(
      wrappedByPassword.ciphertext,
      wrappedByPassword.iv,
      kek,
    );
    const fromKit = await unwrapDek(wrappedByKit.ciphertext, wrappedByKit.iv, rkek);

    // Same underlying key material: an item sealed under one opens under the other.
    const { ciphertext, iv } = await sealItem(ITEM, fromPassword);
    await expect(openItem(ciphertext, iv, fromKit)).resolves.toEqual(ITEM);
  });

  it("rewraps the DEK on a password change without touching the item", async () => {
    const oldSalt = randomBytes(16);
    const oldKek = await deriveKek("old-password", oldSalt, FAST_KDF);
    const dek = await generateDek();
    const { ciphertext, iv } = await sealItem(ITEM, dek);

    // The password change: unwrap under the old KEK, wrap under a new one.
    const oldWrapped = await wrapDek(dek, oldKek);
    const recoveredDek = await unwrapDek(oldWrapped.ciphertext, oldWrapped.iv, oldKek);

    const newSalt = randomBytes(16);
    const newKek = await deriveKek("new-password", newSalt, FAST_KDF);
    const newWrapped = await wrapDek(recoveredDek, newKek);

    const dekAfterRewrap = await unwrapDek(newWrapped.ciphertext, newWrapped.iv, newKek);

    // The item's own ciphertext/iv are untouched — it still opens under the
    // rewrapped DEK with no re-encryption step.
    await expect(openItem(ciphertext, iv, dekAfterRewrap)).resolves.toEqual(ITEM);
  });
});
