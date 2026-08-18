import { argon2id } from "hash-wasm";

import { DEFAULT_KDF_PARAMS, KDF_BOUNDS, type KdfParams } from "./kdf-params";

/**
 * Envelope-encryption primitives (system design §4.2).
 *
 * ```
 * master password ──Argon2id(salt)──▶ KEK ──unwrap──▶ DEK ──AES-GCM──▶ items
 * recovery kit ──HKDF──▶ RKEK ──unwrap──▶ DEK
 * ```
 *
 * The DEK is wrapped twice — once under a password-derived KEK, once under a
 * recovery-kit-derived RKEK — so either one alone recovers it. Changing the
 * master password only re-wraps the DEK; it never touches an item, which is
 * the entire reason for envelope encryption over encrypting each item
 * directly with a password-derived key.
 *
 * Pure WebCrypto beyond the KDF: Argon2id has no browser-native
 * implementation, hence hash-wasm.
 */

export { DEFAULT_KDF_PARAMS, KDF_BOUNDS, type KdfParams };

/**
 * TypeScript's DOM lib types every WebCrypto buffer parameter as backed by a
 * (non-shared) `ArrayBuffer`. Values arriving from other libraries (hash-wasm,
 * Node's `Buffer`) are typed as `Uint8Array<ArrayBufferLike>`, which is wider
 * and not assignable — `freshBytes` re-materialises them into that exact
 * shape, once, at the boundary.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

export function freshBytes(input: ArrayLike<number>): Bytes {
  return Uint8Array.from(input);
}

const AES_GCM = "AES-GCM";
export const AES_KEY_LENGTH = 256;
const IV_BYTES = 12;

export function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** Derives the KEK from the master password. Not extractable — it never leaves this key handle. */
export async function deriveKek(
  password: string,
  salt: Bytes,
  params: KdfParams,
): Promise<CryptoKey> {
  assertDerivable(params);

  const bytes = await argon2id({
    password,
    salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memoryKiB,
    hashLength: 32,
    outputType: "binary",
  });
  return crypto.subtle.importKey("raw", freshBytes(bytes), AES_GCM, false, [
    "wrapKey",
    "unwrapKey",
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Rejects cost parameters that would make this call never return.
 *
 * Only the ceiling is checked here, not the floor. These params come back
 * from the server describing how an *existing* vault was wrapped, and the
 * only correct response to a weak stored value is still to unlock with it —
 * refusing would lock the owner out of their own data to punish a write that
 * already happened. The floor belongs on the write path, in `../schema.ts`,
 * where it can stop the weak value being stored at all. What cannot be
 * survived is an absurd value: Argon2id at 2^31 KiB does not fail, it hangs
 * the tab trying to allocate, so a corrupted or tampered row would brick
 * every future unlock with no in-app way back.
 */
function assertDerivable(params: KdfParams): void {
  const tooLarge =
    params.memoryKiB > KDF_BOUNDS.memoryKiB.max ||
    params.iterations > KDF_BOUNDS.iterations.max ||
    params.parallelism > KDF_BOUNDS.parallelism.max;

  if (tooLarge) {
    throw new Error(
      "This vault's key-derivation settings are out of range. It cannot be unlocked on this device.",
    );
  }
}

/** A fresh, random, extractable-once DEK — wrapped immediately and never persisted raw. */
export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: AES_GCM, length: AES_KEY_LENGTH }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function wrapDek(
  dek: CryptoKey,
  kek: CryptoKey,
): Promise<{ ciphertext: Bytes; iv: Bytes }> {
  const iv = randomBytes(IV_BYTES);
  const wrapped = await crypto.subtle.wrapKey("raw", dek, kek, { name: AES_GCM, iv });
  return { ciphertext: new Uint8Array(wrapped), iv };
}

/**
 * Unwraps the DEK. AES-GCM's auth tag means a wrong KEK — i.e. a wrong
 * password — makes this throw rather than silently return garbage, so this
 * alone is enough to detect a wrong password. The `verifier` field exists so
 * that check can happen without risking an unwrap of real key material.
 */
export async function unwrapDek(
  ciphertext: Bytes,
  iv: Bytes,
  kek: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    "raw",
    ciphertext,
    kek,
    { name: AES_GCM, iv },
    { name: AES_GCM, length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );
}
