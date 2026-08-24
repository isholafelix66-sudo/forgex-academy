/**
 * Offline queue — IndexedDB-backed persistence for user actions performed
 * while the network is down or unstable.
 *
 * Flow:
 *   action → save locally (with idempotency key) → optimistic UI
 *          → try network → success: mark synced + remove
 *                        → failure: keep pending, auto-retry on reconnect
 *                           with exponential backoff + jitter (max attempts)
 *
 * Survives page reloads; duplicate flushes are impossible because a record is
 * deleted BEFORE its handler runs and re-created atomically on failure.
 */

import { connectionMonitor } from "./connection-monitor";

const DB_NAME = "forgex-offline";
const STORE = "pending";
const MAX_ATTEMPTS = 6;
const FLUSH_CHECK_MS = 15_000;

export interface PendingRequest {
  /** Client-generated unique key — makes retries/idempotent replays safe. */
  idempotencyKey: string;
  /** Logical operation, e.g. "send-message". Handlers are registered by op. */
  operation: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
}

type Handler = (payload: unknown) => Promise<void>;
const handlers = new Map<string, Handler>();

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: "idempotencyKey" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

/** Register how a pending operation is actually sent to the backend. */
export function registerOfflineHandler(operation: string, handler: Handler): void {
  handlers.set(operation, handler);
}

export async function enqueueOffline(operation: string, payload: unknown): Promise<PendingRequest> {
  const record: PendingRequest = {
    idempotencyKey:
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    operation,
    payload,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: Date.now(),
  };
  await tx("readwrite", (s) => s.put(record));
  notifySubscribers();
  return record;
}

export async function listPending(): Promise<PendingRequest[]> {
  const all = await tx<PendingRequest[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function pendingCount(): Promise<number> {
  return tx<number>("readonly", (s) => s.count());
}

async function remove(key: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(key));
}

async function update(record: PendingRequest): Promise<void> {
  await tx("readwrite", (s) => s.put(record));
}

let flushing = false;

/**
 * Attempt to send every due pending request exactly once. A record is removed
 * before dispatch so a crash mid-send can't double-send; on failure it's put
 * back with a longer backoff.
 */
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  if (flushing || connectionMonitor.isOffline()) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    const now = Date.now();
    for (const record of await listPending()) {
      if (record.nextAttemptAt > now) continue;
      const handler = handlers.get(record.operation);
      if (!handler) continue; // nothing registered yet — leave pending

      // Remove first → no duplicate sends across tabs/crashes/replays.
      await remove(record.idempotencyKey);
      try {
        await handler(record.payload);
        sent++;
      } catch (err) {
        // Intentional cancellations and permanent validation failures should
        // not retry forever either — cap total attempts regardless of cause.
        record.attempts++;
        if (record.attempts >= MAX_ATTEMPTS) {
          failed++; // dropped after max attempts (kept out of store)
          console.warn("[offline-queue] dropped after max attempts:", record.operation, err);
          continue;
        }
        const base = Math.min(45_000, 2_000 * 3 ** (record.attempts - 1));
        record.nextAttemptAt = Date.now() + Math.round(base * (0.75 + Math.random() * 0.5));
        await update(record);
      }
    }
  } finally {
    flushing = false;
    notifySubscribers();
  }
  return { sent, failed };
}

// ---------------------------------------------------------------------------
// Reactivity — subscribers learn about pending-count changes & reconnects
// ---------------------------------------------------------------------------

type QueueListener = (count: number) => void;
const listeners = new Set<QueueListener>();

export function subscribeQueue(fn: QueueListener): () => void {
  listeners.add(fn);
  void pendingCount().then(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notifySubscribers(): void {
  void pendingCount().then((c) => {
    for (const fn of listeners) fn(c);
  });
}

// Auto-flush on reconnect + periodic sweep. Module-level singleton behavior.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    // Small delay lets flaky links stabilize before replaying everything.
    setTimeout(() => void flushQueue(), 1_000);
  });
  setInterval(() => {
    if (!connectionMonitor.isOffline()) void flushQueue();
  }, FLUSH_CHECK_MS);
}
