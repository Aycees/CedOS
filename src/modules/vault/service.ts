import "server-only";

import { prisma } from "@/core/db/client";
import { assertOwned, live, softDeleted } from "@/core/db/scope";
import { AppError } from "@/core/errors";

import type {
  InitVaultInput,
  RecordAuditInput,
  RewrapDekInput,
  UpsertItemInput,
  VaultItemRow,
  VaultPreferencesInput,
  VaultSettingsView,
} from "./schema";

/**
 * The only place in this module that touches Prisma (decision log §7) — and,
 * for Vault, the harder rule from system design §4.4: everything in and out
 * of this file is ciphertext, an iv, or metadata. A function here that could
 * see a plaintext password is a bug by definition.
 */

function toB64(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString("base64");
}

/**
 * `Uint8Array.from` rather than a bare `Buffer.from` — Prisma's generated
 * types want a `Uint8Array<ArrayBuffer>` for a `Bytes` column, and a `Buffer`
 * is typed as `Uint8Array<ArrayBufferLike>`, which TypeScript no longer
 * treats as assignable to it.
 */
function fromB64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

export async function getSettings(userId: string): Promise<VaultSettingsView> {
  const settings = await prisma.vaultSettings.findUnique({ where: { userId } });
  if (!settings) return null;

  return {
    kdfSalt: toB64(settings.kdfSalt),
    kdfMemoryKiB: settings.kdfMemoryKiB,
    kdfIterations: settings.kdfIterations,
    kdfParallelism: settings.kdfParallelism,
    wrappedDek: toB64(settings.wrappedDek),
    wrappedDekIv: toB64(settings.wrappedDekIv),
    recoveryDek: settings.recoveryDek ? toB64(settings.recoveryDek) : "",
    recoveryDekIv: settings.recoveryDekIv ? toB64(settings.recoveryDekIv) : "",
    verifier: toB64(settings.verifier),
    verifierIv: toB64(settings.verifierIv),
    unlockMethod: settings.unlockMethod,
    lockOnLoad: settings.lockOnLoad,
    autoLockSeconds: settings.autoLockSeconds,
    keyVersion: settings.keyVersion,
  };
}

/** Rejects if a vault already exists — setup runs exactly once per account. */
export async function initVault(userId: string, input: InitVaultInput) {
  const existing = await prisma.vaultSettings.findUnique({ where: { userId } });
  if (existing) {
    throw new AppError("CONFLICT", "This vault is already set up.");
  }

  await prisma.vaultSettings.create({
    data: {
      id: input.id,
      userId,
      kdfSalt: fromB64(input.kdfSalt),
      kdfMemoryKiB: input.kdfMemoryKiB,
      kdfIterations: input.kdfIterations,
      kdfParallelism: input.kdfParallelism,
      wrappedDek: fromB64(input.wrappedDek),
      wrappedDekIv: fromB64(input.wrappedDekIv),
      recoveryDek: fromB64(input.recoveryDek),
      recoveryDekIv: fromB64(input.recoveryDekIv),
      verifier: fromB64(input.verifier),
      verifierIv: fromB64(input.verifierIv),
    },
  });
}

/**
 * Master-password change: replaces the wrapped DEK, verifier and salt in one
 * atomic update. The DEK itself, and therefore every item, is untouched —
 * the O(1) rewrap envelope encryption exists for.
 */
export async function rewrapDek(userId: string, input: RewrapDekInput) {
  await requireSettings(userId);

  await prisma.vaultSettings.update({
    where: { userId },
    data: {
      kdfSalt: fromB64(input.kdfSalt),
      kdfMemoryKiB: input.kdfMemoryKiB,
      kdfIterations: input.kdfIterations,
      kdfParallelism: input.kdfParallelism,
      wrappedDek: fromB64(input.wrappedDek),
      wrappedDekIv: fromB64(input.wrappedDekIv),
      verifier: fromB64(input.verifier),
      verifierIv: fromB64(input.verifierIv),
    },
  });
}

export async function updatePreferences(userId: string, input: VaultPreferencesInput) {
  await requireSettings(userId);

  await prisma.vaultSettings.update({
    where: { userId },
    data: {
      unlockMethod: input.unlockMethod,
      ...(input.lockOnLoad !== undefined ? { lockOnLoad: input.lockOnLoad } : {}),
      ...(input.autoLockSeconds !== undefined
        ? { autoLockSeconds: input.autoLockSeconds }
        : {}),
    },
  });
}

export async function listItems(userId: string): Promise<VaultItemRow[]> {
  const items = await prisma.vaultItem.findMany({
    where: live(userId),
    orderBy: { createdAt: "asc" },
  });

  return items.map((item) => ({
    id: item.id,
    ciphertext: toB64(item.ciphertext),
    iv: toB64(item.iv),
    keyVersion: item.keyVersion,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
}

export async function upsertItem(userId: string, input: UpsertItemInput) {
  const existing = await prisma.vaultItem.findUnique({ where: { id: input.id } });
  if (existing) assertOwned(existing, userId, "credential");

  await prisma.vaultItem.upsert({
    where: { id: input.id },
    update: { ciphertext: fromB64(input.ciphertext), iv: fromB64(input.iv) },
    create: {
      id: input.id,
      userId,
      ciphertext: fromB64(input.ciphertext),
      iv: fromB64(input.iv),
    },
  });
}

export async function softDeleteItem(userId: string, id: string) {
  const item = await prisma.vaultItem.findUnique({ where: { id } });
  assertOwned(item, userId, "credential");

  await prisma.vaultItem.update({ where: { id }, data: softDeleted() });
}

/**
 * Client-driven by design: UNLOCK_SUCCESS/FAILURE and ITEM_REVEALED describe
 * events the server cannot observe on its own — the verifier check and every
 * decrypt happen in the browser (system design §4.4). The id is supplied by
 * the caller, like every other write in the app (non-negotiable #1).
 */
export async function recordAudit(userId: string, input: RecordAuditInput) {
  await prisma.vaultAuditEvent.create({
    data: {
      id: input.id,
      userId,
      action: input.action,
      itemId: input.itemId,
    },
  });
}

async function requireSettings(userId: string) {
  const settings = await prisma.vaultSettings.findUnique({ where: { userId } });
  if (!settings) {
    throw new AppError("PRECONDITION_FAILED", "Set up the vault first.");
  }
  return settings;
}
