import { z } from "zod";

import { VAULT_CATEGORIES } from "./crypto/item";
import { KDF_BOUNDS } from "./crypto/kdf-params";

/**
 * Shared by the route handlers and the client crypto layer — but every
 * ciphertext, iv and key here is a base64 string on the wire, converted to a
 * `Buffer` only inside `service.ts` (system design §4.4). No schema in this
 * file ever describes plaintext credential fields; that shape,
 * `VaultItemPlain`, lives entirely in `crypto/item.ts` and never crosses the
 * network.
 */

/*
 * Every Vault field on the wire is base64 ciphertext. The columns behind them
 * are unbounded Postgres `text`, so without a cap a single request can commit
 * an arbitrarily large row — the shapes below bound each one at roughly an
 * order of magnitude more than the real payload ever needs.
 */
const base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, "Not valid base64.");

/** Salts, IVs, wrapped keys and verifiers — all fixed-size, tens of bytes. */
const base64Key = base64.max(2_000, "That value is too large.");

/** A sealed credential: a handful of short fields plus AES-GCM overhead. */
const base64Payload = base64.max(20_000, "That credential is too large.");

/*
 * Argon2id cost, bounded rather than merely positive.
 *
 * Every client in this app writes DEFAULT_KDF_PARAMS and nothing else, so an
 * out-of-range value reaching here is a tampered client or a stolen session
 * driving the endpoint directly. Left unbounded, `{"kdfMemoryKiB":1,
 * "kdfIterations":1}` on setup or rewrap is a silent downgrade attack: the
 * DEK gets re-wrapped under a KEK that a database dump brute-forces offline,
 * the vault keeps working normally, and nothing in the UI ever shows it. The
 * ceiling covers the mirror-image failure — a value large enough that the
 * next unlock can never finish deriving the key. See crypto/kdf-params.ts.
 */
const kdfParams = {
  kdfMemoryKiB: z
    .number()
    .int()
    .min(KDF_BOUNDS.memoryKiB.min, "Key-derivation memory is below the minimum.")
    .max(KDF_BOUNDS.memoryKiB.max, "Key-derivation memory is above the maximum."),
  kdfIterations: z
    .number()
    .int()
    .min(KDF_BOUNDS.iterations.min, "Too few key-derivation iterations.")
    .max(KDF_BOUNDS.iterations.max, "Too many key-derivation iterations."),
  kdfParallelism: z
    .number()
    .int()
    .min(KDF_BOUNDS.parallelism.min, "Key-derivation parallelism is below the minimum.")
    .max(KDF_BOUNDS.parallelism.max, "Key-derivation parallelism is above the maximum."),
};

export const initVaultSchema = z.object({
  id: z.uuid(),
  kdfSalt: base64Key,
  ...kdfParams,
  wrappedDek: base64Key,
  wrappedDekIv: base64Key,
  recoveryDek: base64Key,
  recoveryDekIv: base64Key,
  verifier: base64Key,
  verifierIv: base64Key,
});

export type InitVaultInput = z.infer<typeof initVaultSchema>;

/** Master-password change: an O(1) rewrap of the DEK, no item is touched. */
export const rewrapDekSchema = z.object({
  kdfSalt: base64Key,
  ...kdfParams,
  wrappedDek: base64Key,
  wrappedDekIv: base64Key,
  verifier: base64Key,
  verifierIv: base64Key,
});

export type RewrapDekInput = z.infer<typeof rewrapDekSchema>;

export const vaultPreferencesSchema = z.object({
  unlockMethod: z.enum(["PIN", "MASTER_PASSWORD", "BOTH"]),
  lockOnLoad: z.boolean().optional(),
  // Capped at 24h: an unbounded value silently disables auto-lock.
  autoLockSeconds: z.number().int().positive().max(86_400).optional(),
});

export type VaultPreferencesInput = z.infer<typeof vaultPreferencesSchema>;

export const upsertItemSchema = z.object({
  id: z.uuid(),
  ciphertext: base64Payload,
  iv: base64Key,
});

export type UpsertItemInput = z.infer<typeof upsertItemSchema>;

export const deleteItemSchema = z.object({ id: z.uuid() });

export const VAULT_AUDIT_ACTIONS = [
  "UNLOCK_SUCCESS",
  "UNLOCK_FAILURE",
  "ITEM_REVEALED",
  "ITEM_DELETED",
  "KEY_ROTATED",
] as const;

export const recordAuditSchema = z.object({
  id: z.uuid(),
  action: z.enum(VAULT_AUDIT_ACTIONS),
  itemId: z.uuid().nullable().default(null),
});

export type RecordAuditInput = z.infer<typeof recordAuditSchema>;

export type VaultSettingsView = {
  kdfSalt: string;
  kdfMemoryKiB: number;
  kdfIterations: number;
  kdfParallelism: number;
  wrappedDek: string;
  wrappedDekIv: string;
  recoveryDek: string;
  recoveryDekIv: string;
  verifier: string;
  verifierIv: string;
  unlockMethod: "PIN" | "MASTER_PASSWORD" | "BOTH";
  lockOnLoad: boolean;
  autoLockSeconds: number;
  keyVersion: number;
} | null;

export type VaultItemRow = {
  id: string;
  ciphertext: string;
  iv: string;
  keyVersion: number;
  createdAt: string;
  updatedAt: string;
};

export { VAULT_CATEGORIES };
