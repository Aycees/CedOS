import type { Bytes } from "./key";

/**
 * A fixed known plaintext encrypted under the KEK (system design §4.2).
 * Decrypting it successfully proves a password derived the right KEK,
 * without ever touching the DEK — so a wrong password fails here rather than
 * inside an unwrap of real key material.
 */

const AES_GCM = "AES-GCM";
const IV_BYTES = 12;
const KNOWN_PLAINTEXT = "ced-os-vault-verifier-v1";

export async function makeVerifier(
  kek: CryptoKey,
): Promise<{ verifier: Bytes; iv: Bytes }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const bytes = new TextEncoder().encode(KNOWN_PLAINTEXT);
  const ciphertext = await crypto.subtle.encrypt({ name: AES_GCM, iv }, kek, bytes);
  return { verifier: new Uint8Array(ciphertext), iv };
}

export async function checkVerifier(
  verifier: Bytes,
  iv: Bytes,
  kek: CryptoKey,
): Promise<boolean> {
  try {
    const bytes = await crypto.subtle.decrypt({ name: AES_GCM, iv }, kek, verifier);
    return new TextDecoder().decode(bytes) === KNOWN_PLAINTEXT;
  } catch {
    return false;
  }
}
