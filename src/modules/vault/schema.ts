import { z } from "zod";

import { VAULT_CATEGORIES } from "./crypto/item";

/**
 * Shared by the route handlers and the client crypto layer — but every
 * ciphertext, iv and key here is a base64 string on the wire, converted to a
 * `Buffer` only inside `service.ts` (system design §4.4). No schema in this
 * file ever describes plaintext credential fields; that shape,
 * `VaultItemPlain`, lives entirely in `crypto/item.ts` and never crosses the
 * network.
 */

const base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, "Not valid base64.");

export const initVaultSchema = z.object({
  id: z.uuid(),
  kdfSalt: base64,
  kdfMemoryKiB: z.number().int().positive(),
  kdfIterations: z.number().int().positive(),
  kdfParallelism: z.number().int().positive(),
  wrappedDek: base64,
  wrappedDekIv: base64,
  recoveryDek: base64,
  recoveryDekIv: base64,
  verifier: base64,
  verifierIv: base64,
});

export type InitVaultInput = z.infer<typeof initVaultSchema>;

/** Master-password change: an O(1) rewrap of the DEK, no item is touched. */
export const rewrapDekSchema = z.object({
  kdfSalt: base64,
  kdfMemoryKiB: z.number().int().positive(),
  kdfIterations: z.number().int().positive(),
  kdfParallelism: z.number().int().positive(),
  wrappedDek: base64,
  wrappedDekIv: base64,
  verifier: base64,
  verifierIv: base64,
});

export type RewrapDekInput = z.infer<typeof rewrapDekSchema>;

export const vaultPreferencesSchema = z.object({
  unlockMethod: z.enum(["PIN", "MASTER_PASSWORD", "BOTH"]),
  lockOnLoad: z.boolean().optional(),
  autoLockSeconds: z.number().int().positive().optional(),
});

export type VaultPreferencesInput = z.infer<typeof vaultPreferencesSchema>;

export const upsertItemSchema = z.object({
  id: z.uuid(),
  ciphertext: base64,
  iv: base64,
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
