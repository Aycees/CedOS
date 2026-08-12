"use client";

import { api } from "@/core/mutation/client";

import { base64ToBytes, openItem } from "../crypto";
import type { VaultItemRow } from "../schema";
import type { VaultItemDecrypted } from "./session";

/** Fetches every item's ciphertext and decrypts it client-side, right after unlock. */
export async function loadAndDecryptItems(dek: CryptoKey): Promise<VaultItemDecrypted[]> {
  const rows = await api.get<VaultItemRow[]>("/api/vault/items");

  return Promise.all(
    rows.map(async (row) => {
      const plain = await openItem(base64ToBytes(row.ciphertext), base64ToBytes(row.iv), dek);
      return {
        ...plain,
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }),
  );
}
