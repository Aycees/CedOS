"use client";

import { unwrapDek, wrapDek, type Bytes } from "../crypto/key";

/**
 * PIN unlock (system design §4.3) — device-local convenience, never a second
 * credential. A 4-digit PIN alone has 10,000 possibilities, so it cannot be a
 * KDF input for the DEK on its own; it is combined with a high-entropy
 * device secret that lives only in this browser's IndexedDB and is never
 * sent to the server. Five wrong PINs wipe the device secret, which forces
 * the master password again — there is nothing left to brute-force locally
 * after that.
 */

const DB_NAME = "ced-os-vault";
const STORE = "pin";
const RECORD_KEY = "current";
const PBKDF2_ITERATIONS = 100_000;
const MAX_ATTEMPTS = 5;

type PinRecord = {
  deviceSecret: Bytes;
  salt: Bytes;
  wrappedDek: Bytes;
  wrappedDekIv: Bytes;
  failedAttempts: number;
};

export class PinLockedOutError extends Error {
  constructor() {
    super("Too many wrong PINs. Use your master password.");
    this.name = "PinLockedOutError";
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readRecord(): Promise<PinRecord | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(RECORD_KEY);
      req.onsuccess = () => resolve((req.result as PinRecord | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function writeRecord(record: PinRecord | null): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      if (record) tx.objectStore(STORE).put(record, RECORD_KEY);
      else tx.objectStore(STORE).delete(RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function isPinEnabled(): Promise<boolean> {
  return (await readRecord()) !== null;
}

async function deriveFromPin(
  pin: string,
  deviceSecret: Bytes,
  salt: Bytes,
): Promise<CryptoKey> {
  const material = new TextEncoder().encode(pin);
  const combined = new Uint8Array(material.length + deviceSecret.length);
  combined.set(material, 0);
  combined.set(deviceSecret, material.length);

  const keyMaterial = await crypto.subtle.importKey("raw", combined, "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

/** Enables PIN unlock on this device only. Nothing here reaches the server. */
export async function enablePin(pin: string, dek: CryptoKey): Promise<void> {
  const deviceSecret = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pinKey = await deriveFromPin(pin, deviceSecret, salt);
  const { ciphertext, iv } = await wrapDek(dek, pinKey);

  await writeRecord({
    deviceSecret,
    salt,
    wrappedDek: ciphertext,
    wrappedDekIv: iv,
    failedAttempts: 0,
  });
}

export async function disablePin(): Promise<void> {
  await writeRecord(null);
}

/**
 * Wrong PIN throws a plain Error; the fifth wrong PIN wipes the record and
 * throws `PinLockedOutError` instead, telling the caller to fall back to the
 * master password. Product spec §11: no attempt count is ever shown.
 */
export async function unlockWithPin(pin: string): Promise<CryptoKey> {
  const record = await readRecord();
  if (!record) {
    throw new Error("PIN is not set up on this device.");
  }

  const pinKey = await deriveFromPin(pin, record.deviceSecret, record.salt);

  try {
    const dek = await unwrapDek(record.wrappedDek, record.wrappedDekIv, pinKey);
    if (record.failedAttempts > 0) {
      await writeRecord({ ...record, failedAttempts: 0 });
    }
    return dek;
  } catch {
    const failedAttempts = record.failedAttempts + 1;
    if (failedAttempts >= MAX_ATTEMPTS) {
      await writeRecord(null);
      throw new PinLockedOutError();
    }
    await writeRecord({ ...record, failedAttempts });
    throw new Error("That PIN doesn't match.");
  }
}
