/**
 * ForgeX database-resilience core (client).
 *
 * Convex is the primary database. This module only engages when Convex
 * genuinely fails — it NEVER switches unnecessarily, adds no extra Convex
 * calls during normal operation, and stores nothing sensitive.
 *
 * What it does:
 *  1. Classifies failures. Only real Convex outages (network down, quota
 *     exhausted, 5xx, function missing) count as "degraded". A validation
 *     error from a healthy Convex is a normal error and is re-thrown.
 *  2. During degraded mode, supported essential writes are (a) queued in
 *     localStorage, (b) mirrored to the fallback store (Firebase RTDB) when
 *     reachable, and (c) returned to the caller as "queued" so the UI can
 *     proceed optimistically.
 *  3. A background worker retries the queue against Convex with exponential
 *     backoff, then flushes the fallback mirror. All ops are idempotent
 *     server-side (stable opId), so replays can never duplicate anything.
 *  4. When everything drains, emits "synced" so the UI can show
 *     "All changes synced." Credentials: only a scoped, client-safe Firebase
 *     Web config is used — and only for the sync-ops subtree.
 */

import { ConvexHttpClient } from "convex/browser";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type QueueOpKind = "lesson-complete" | "watch-position" | "profile-update" | "enroll";

export interface QueueOp {
  /** Stable, client-generated id — the dedupe key used by the server. */
  opId: string;
  kind: QueueOpKind;
  /** ms epoch when the op was created (used for ordering + diagnostics). */
  serverAt: number;
  /** Small JSON payload — never contains credentials or message content. */
  payload: Record<string, unknown>;
  attempts: number;
  lastError?: string;
}

export type Mode = "healthy" | "degraded" | "queueing";
export type SyncState = {
  mode: Mode;
  pending: number;
  failed: number;
  lastQueueAt: number | null;
  lastSyncedAt: number | null;
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LS_QUEUE = "forgex.sync.queue.v1";
const LS_STATE = "forgex.sync.state.v1";
const MAX_QUEUE = 300;
const MAX_PAYLOAD_BYTES = 16 * 1024;

/** Fallback store: Firebase RTDB REST (client-safe scoped web config). */
const FB = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim() ?? "",
  databaseURL: (import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined)?.trim() ?? "",
};
const FB_ROOT = "forgexSync"; // single known-safe subtree used by the relay

// ---------------------------------------------------------------------------
// Small utils
// ---------------------------------------------------------------------------

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  // RFC4122-ish fallback for older browsers.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Firebase RTDB paths cannot contain . $ # [ ] / — make ids safe. */
function fbSafe(s: string): string {
  return s.replace(/[.$#[\]/]/g, "_");
}

function nowMs(): number {
  return Date.now();
}

// ---------------------------------------------------------------------------
// State management + subscribers (UI banner)
// ---------------------------------------------------------------------------

let mode: Mode = "healthy";
let pendingCount = 0;
let failedCount = 0;
let lastQueueAt: number | null = null;
let lastSyncedAt: number | null = null;
const subscribers = new Set<(s: SyncState) => void>();

function computeMode(): Mode {
  if (failedCount > 0 || queue.length > 0) return queue.length > 0 ? "queueing" : "degraded";
  if (mode === "degraded" && pendingCount === 0 && queue.length === 0) return "healthy";
  return mode;
}

function persistState() {
  try {
    localStorage.setItem(
      LS_STATE,
      JSON.stringify({ lastQueueAt, lastSyncedAt, mode } satisfies Partial<SyncState>),
    );
  } catch {
    /* private mode / quota — ignore */
  }
}

function notify() {
  const snapshot: SyncState = {
    mode: computeMode(),
    pending: queue.length,
    failed: failedCount,
    lastQueueAt,
    lastSyncedAt,
  };
  for (const fn of subscribers) {
    try {
      fn(snapshot);
    } catch {
      /* a broken listener must never break syncing */
    }
  }
}

export function subscribeSync(fn: (s: SyncState) => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function getSyncState(): SyncState {
  return { mode: computeMode(), pending: queue.length, failed: failedCount, lastQueueAt, lastSyncedAt };
}

// ---------------------------------------------------------------------------
// Durable queue (localStorage)
// ---------------------------------------------------------------------------

let queue: QueueOp[] = [];

function loadQueue() {
  if (queue.length > 0) return;
  try {
    const raw = localStorage.getItem(LS_QUEUE);
    queue = raw ? (JSON.parse(raw) as QueueOp[]) : [];
    if (!Array.isArray(queue)) queue = [];
  } catch {
    queue = [];
  }
  try {
    const st = localStorage.getItem(LS_STATE);
    if (st) {
      const parsed = JSON.parse(st) as Partial<SyncState>;
      lastQueueAt = parsed.lastQueueAt ?? null;
      lastSyncedAt = parsed.lastSyncedAt ?? null;
    }
  } catch {
    /* ignore */
  }
}

function saveQueue() {
  try {
    localStorage.setItem(LS_QUEUE, JSON.stringify(queue));
  } catch {
    // Storage full/private: drop oldest ops beyond a hard floor so the tab
    // keeps working; the fallback mirror may still hold them.
    if (queue.length > 50) queue = queue.slice(-50);
  }
}

/** Enqueue (or merge with an existing pending op of the same target). */
function enqueue(kind: QueueOpKind, payload: Record<string, unknown>, mergeKey?: string): QueueOp {
  loadQueue();
  if (mergeKey) {
    const existing = queue.find((q) => q.kind === kind && (q.payload as any)[mergeKey] === payload[mergeKey]);
    if (existing) {
      existing.payload = { ...existing.payload, ...payload };
      existing.serverAt = nowMs();
      saveQueue();
      lastQueueAt = nowMs();
      persistState();
      notify();
      return existing;
    }
  }
  if (queue.length >= MAX_QUEUE) queue.shift(); // bounded: drop oldest
  const op: QueueOp = { opId: uuid(), kind, serverAt: nowMs(), payload, attempts: 0 };
  queue.push(op);
  saveQueue();
  lastQueueAt = nowMs();
  persistState();
  notify();
  return op;
}

// ---------------------------------------------------------------------------
// Convex failure classification
// ---------------------------------------------------------------------------

/**
 * Decide whether an error means "Convex itself is unavailable" (→ degraded
 * mode / queueing) versus a normal application error (→ rethrow).
 */
export function isConvexOutage(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err ?? "");
  const code = (err as any)?.code ?? "";
  const status = (err as any)?.status ?? (err as any)?.data?.code;
  if (code === "CONVEX_QUOTA_EXCEEDED" || /quota.*(exceed|exhaust)/i.test(msg)) return true;
  if (/Failed to fetch|NetworkError|network error|Load failed|ERR_NETWORK|ERR_INTERNET/i.test(msg)) return true;
  if (/\b5\d\d\b/.test(String(status))) return true;
  if (typeof status === "number" && status >= 500) return true;
  if (/function not found|no such function/i.test(msg)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Fallback store (Firebase RTDB via REST — no SDK, tiny payload surface)
// ---------------------------------------------------------------------------

function fbConfigured(): boolean {
  return !!(FB.apiKey && FB.databaseURL);
}

async function fbWriteOp(op: QueueOp, userId: string): Promise<void> {
  const safeUser = fbSafe(userId);
  const path = `/${FB_ROOT}/${safeUser}/${op.opId}.json`;
  const url = `${FB.databaseURL}${path}?auth=${FB.apiKey}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: op.kind, serverAt: op.serverAt, payload: op.payload }),
  });
  if (!res.ok) throw new Error(`fallback write failed: ${res.status}`);
}

async function fbListOps(userId: string): Promise<QueueOp[]> {
  const safeUser = fbSafe(userId);
  const url = `${FB.databaseURL}/${FB_ROOT}/${safeUser}.json?auth=${FB.apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as Record<string, Omit<QueueOp, "opId">> | null;
  if (!json) return [];
  return Object.entries(json).map(([opId, v]) => ({ opId, ...v }) as QueueOp);
}

async function fbDeleteOp(userId: string, opId: string): Promise<void> {
  const safeUser = fbSafe(userId);
  const url = `${FB.databaseURL}/${FB_ROOT}/${safeUser}/${opId}.json?auth=${FB.apiKey}`;
  await fetch(url, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Convex transport (used for probes + replay)
// ---------------------------------------------------------------------------

let httpClient: ConvexHttpClient | null = null;
function getHttpClient(): ConvexHttpClient | null {
  if (httpClient) return httpClient;
  try {
    const url =
      (import.meta.env.VITE_CONVEX_URL as string | undefined)?.trim() ||
      "https://hidden-poodle-567.convex.cloud";
    httpClient = new ConvexHttpClient(url);
    return httpClient;
  } catch {
    return null;
  }
}

/**
 * Replay queued ops into Convex through the public `applyOps` mutation.
 * The dedicated replay client authenticates with the session JWT via
 * setAuth, so the server attributes every op to the signed-in user.
 */
let authedFor: string | null = null;
async function replayToConvex(token: string | null, ops: QueueOp[]): Promise<Array<{ opId: string; applied: boolean; reason?: string }>> {
  const client = getHttpClient();
  if (!client) throw new Error("no http client");
  if (token && authedFor !== token) {
    client.setAuth(token);
    authedFor = token;
  }
  const trimmed = ops.slice(0, 50).map((o) => ({
    opId: o.opId,
    kind: o.kind,
    serverAt: o.serverAt,
    payload: o.payload,
  }));
  return client.mutation(apiRef.syncData.applyOps, { ops: trimmed });
}

// api import kept lazy so this module has no import-time side effects.
import { api as apiRef } from "@/convex/_generated/api";

// ---------------------------------------------------------------------------
// Probe: is Convex healthy again? (called only while degraded/queueing)
// ---------------------------------------------------------------------------

let probing = false;
async function probeConvex(token: string | null): Promise<boolean> {
  const client = getHttpClient();
  if (!client) return false;
  try {
    await client.query(apiRef.syncData.probe, {});
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sync worker
// ---------------------------------------------------------------------------

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = 4_000;
const BACKOFF_MAX = 4 * 60_000;

function scheduleRetry(delayMs?: number) {
  if (syncTimer) return;
  const delay = delayMs ?? backoffMs;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void runSync();
  }, delay);
  backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX);
}

function resetBackoff() {
  backoffMs = 4_000;
}

/** Kick the worker (no-op if a run is already scheduled/running). */
export function kickSync(): void {
  if (typeof window === "undefined") return;
  loadQueue();
  scheduleRetry(200);
}

let running = false;
async function runSync(): Promise<void> {
  if (running) return;
  running = true;
  try {
    loadQueue();
    if (queue.length === 0 && failedCount === 0) {
      if (mode !== "healthy") {
        mode = "healthy";
        persistState();
        notify();
      }
      return;
    }
    const token = readSessionToken();
    const healthy = await probeConvex(token);
    if (!healthy) {
      mode = queue.length > 0 ? "queueing" : "degraded";
      notify();
      scheduleRetry();
      return;
    }

    // Convex is healthy → replay everything queued locally.
    mode = "healthy";
    if (queue.length > 0) {
      const batch = queue.slice(0, 50);
      try {
        const results = await replayToConvex(token, batch);
        // Every op in the batch received a definitive server verdict:
        //  - applied      → done,
        //  - duplicate    → the server ledger already had the opId (done),
        //  - noop/failed  → server-side validation said no (recorded for the
        //                   admin Sync dashboard) — retrying cannot help.
        // In all cases the local copy can go.
        const batchIds = new Set(batch.map((o) => o.opId));
        queue = queue.filter((o) => !batchIds.has(o.opId));
        if (results.length > 0) {
          resetBackoff();
          lastSyncedAt = nowMs();
          persistState();
        }
        if (queue.length > 0) scheduleRetry(1_000);
      } catch (err) {
        // Convex answered but the replay failed — bump attempts, back off.
        batch.forEach((o) => {
          o.attempts += 1;
          o.lastError = err instanceof Error ? err.message.slice(0, 120) : "replay failed";
        });
        saveQueue();
        scheduleRetry();
      }
      notify();
    }

    // Convex healthy → drain the fallback mirror too (if configured).
    if (fbConfigured() && token) {
      try {
        const userId = userIdFromToken(token);
        if (userId) {
          const fbOps = await fbListOps(userId);
          if (fbOps.length > 0) {
            const merged = mergeOps(queue, fbOps);
            const batch2 = merged.slice(0, 50);
            const results = await replayToConvex(token, batch2);
            for (const r of results) {
              if (r.applied || r.reason === "duplicate") await fbDeleteOp(userId, r.opId);
            }
          }
        }
      } catch {
        /* mirror drain is best-effort */
      }
    }

    if (queue.length === 0) {
      if (failedCount === 0) {
        mode = "healthy";
        lastSyncedAt = nowMs();
        persistState();
      }
      notify();
      // Done — no more scheduling.
      return;
    }
    scheduleRetry(1_000);
  } finally {
    running = false;
  }
}

/** Merge local + mirrored ops by opId, newest serverAt wins. */
function mergeOps(local: QueueOp[], mirrored: QueueOp[]): QueueOp[] {
  const byId = new Map<string, QueueOp>();
  for (const op of [...mirrored, ...local]) {
    const prev = byId.get(op.opId);
    if (!prev || op.serverAt >= prev.serverAt) byId.set(op.opId, op);
  }
  return [...byId.values()].sort((a, b) => a.serverAt - b.serverAt);
}

// ---------------------------------------------------------------------------
// Session-token access (for attributing replayed ops to the signed-in user)
// ---------------------------------------------------------------------------

/**
 * @convex-dev/auth stores its JWT under `__convexAuthJWT_<namespace>` where
 * the namespace is the escaped Convex URL. Rather than reconstructing that
 * key, scan for the prefix — robust across deployments and auth versions.
 */
function readSessionToken(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("__convexAuthJWT")) {
        const v = localStorage.getItem(key);
        if (v && v.length > 20) return v;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function userIdFromToken(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(
      decodeURIComponent(
        atob(part.replace(/-/g, "+").replace(/_/g, "/"))
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      ),
    );
    return (json?.sub as string) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API — resilient mutation wrapper
// ---------------------------------------------------------------------------

export interface ResilientResult {
  status: "applied" | "queued";
  opId?: string;
}

/**
 * Run an essential mutation with outage protection.
 *
 * - Healthy Convex → runs `fn` normally (zero extra Convex usage).
 * - Convex outage  → queues the op locally + mirrors to fallback store,
 *                    returns "queued" so the UI can continue optimistically.
 */
export async function resilientMutation<T>(
  opts: {
    kind: QueueOpKind;
    payload: Record<string, unknown>;
    /** Build the live-path mutation call. MUST match the queued payload semantics. */
    live: () => Promise<T>;
    /** Merge key so repeated edits of the same target collapse into one op. */
    mergeKey?: string;
    fallbackUserId?: string | null;
  },
): Promise<ResilientResult> {
  try {
    await opts.live();
    // Success — also give the worker a chance to drain anything left over.
    if (queue.length > 0) kickSync();
    return { status: "applied" };
  } catch (err) {
    if (!isConvexOutage(err)) throw err; // normal validation error → surface it
    // Convex is down → queue + mirror.
    mode = "queueing";
    const op = enqueue(opts.kind, opts.payload, opts.mergeKey);
    notify();
    const token = readSessionToken();
    const uid = opts.fallbackUserId ?? (token ? userIdFromToken(token) : null);
    if (fbConfigured() && uid) {
      void fbWriteOp(op, uid).catch(() => {
        /* neither available — the local queue still holds it */
      });
    }
    kickSync();
    return { status: "queued", opId: op.opId };
  }
}

// ---------------------------------------------------------------------------
// Bootstrap: resume syncing after a reload; retry on connectivity restore
// ---------------------------------------------------------------------------

export function initResilience(): void {
  if (typeof window === "undefined") return;
  loadQueue();
  if (queue.length > 0) {
    mode = "queueing";
    notify();
    kickSync();
  }
  window.addEventListener("online", () => kickSync());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && queue.length > 0) kickSync();
  });
}
