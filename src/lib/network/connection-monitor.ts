/**
 * Network quality monitor — a single app-wide source of truth for how well
 * the user's connection is performing.
 *
 * Modes:
 *   HIGH     full experience (streaming, audio, prefetching)
 *   NORMAL   default behavior
 *   LOW      prioritize text; skip media prefetch and non-critical requests
 *   OFFLINE  save locally, show sync state, flush when the connection returns
 *
 * Signals used (never just navigator.onLine):
 *  - online/offline browser events
 *  - Network Information API (effectiveType / downlink / rtt) when available
 *  - a rolling window of REAL request outcomes reported by app code via
 *    reportRequestOutcome()
 */

export type NetMode = "high" | "normal" | "low" | "offline";

type Listener = (mode: NetMode) => void;

interface RequestSample {
  ok: boolean;
  ms: number;
  at: number;
}

const WINDOW_MS = 60_000;
const SLOW_MS = 2_500;

class ConnectionMonitor {
  private mode: NetMode = "normal";
  private listeners = new Set<Listener>();
  private samples: RequestSample[] = [];
  private started = false;

  start(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;

    window.addEventListener("online", this.recompute);
    window.addEventListener("offline", this.recompute);
    // Network Information API (Chromium/Android) — free live quality signal.
    const nav = navigator as any;
    const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    if (conn?.addEventListener) {
      conn.addEventListener("change", this.recompute);
    }
    this.recompute();
  }

  subscribe(fn: Listener): () => void {
    this.start();
    this.listeners.add(fn);
    fn(this.mode);
    return () => {
      this.listeners.delete(fn);
    };
  }

  getMode(): NetMode {
    this.start();
    return this.mode;
  }

  isOffline(): boolean {
    return this.getMode() === "offline";
  }

  /**
   * Report the outcome of any real network request. This is what separates
   * genuine slow/offline conditions from a stale online flag.
   */
  reportRequestOutcome(ok: boolean, ms: number): void {
    const now = Date.now();
    this.samples.push({ ok, ms, at: now });
    while (this.samples.length > 0 && now - this.samples[0].at > WINDOW_MS) {
      this.samples.shift();
    }
    if (this.samples.length >= 5) this.recompute();
  }

  private recompute = (): void => {
    const next = this.compute();
    if (next !== this.mode) {
      this.mode = next;
      for (const fn of this.listeners) fn(next);
    }
  };

  private compute(): NetMode {
    if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";

    const now = Date.now();
    const recent = this.samples.filter((s) => now - s.at <= WINDOW_MS);
    if (recent.length >= 5) {
      const failureRate = recent.filter((s) => !s.ok).length / recent.length;
      if (failureRate >= 0.8) return "offline"; // requests failing wholesale
      const avg = recent.reduce((a, s) => a + s.ms, 0) / recent.length;
      if (failureRate >= 0.4 || avg > SLOW_MS * 1.5) return "low";
    }

    // Browser-reported link quality (when available).
    const nav = navigator as any;
    const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    if (conn) {
      const t = String(conn.effectiveType ?? "");
      if (t === "slow-2g" || t === "2g") return "low";
      if (typeof conn.saveData === "boolean" && conn.saveData) return "low";
    }
    return "normal";
  }
}

export const connectionMonitor = new ConnectionMonitor();

/** True when the current mode should suppress media prefetching/audio extras. */
export function shouldSkipMediaPrefetch(): boolean {
  const m = connectionMonitor.getMode();
  return m === "offline" || m === "low";
}
