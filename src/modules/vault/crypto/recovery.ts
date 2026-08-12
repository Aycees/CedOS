import { AES_KEY_LENGTH, randomBytes, type Bytes } from "./key";

/**
 * The recovery kit (G3, system design §4.2). Independently wraps the same
 * DEK the master password does, via HKDF over its own entropy — a device
 * that only ever sees the kit can recover the vault without the password,
 * and the server never sees either.
 */

const HKDF_INFO = "ced-os-vault-recovery-v1";

/** "XXXX-XXXX-…" — 256 random bits as 16 groups of 4 uppercase hex characters. */
export function generateRecoveryKit(): string {
  const bytes = randomBytes(32);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return hex.match(/.{1,4}/g)!.join("-");
}

function recoveryKitToBytes(kit: string): Bytes {
  const hex = kit.replace(/-/g, "");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function deriveRkek(kit: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    recoveryKitToBytes(kit),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(HKDF_INFO),
    },
    keyMaterial,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["wrapKey", "unwrapKey"],
  );
}
