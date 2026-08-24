/**
 * Resilient fetch — timeout + safe retries with exponential backoff & jitter,
 * wired into the app-wide network quality monitor.
 *
 * Rules:
 *  - Only transient failures are retried (network errors, 408/429/5xx).
 *  - 4xx validation/auth errors surface immediately.
 *  - Cancellations (AbortError from the CALLER's signal) are never retried
 *    and never reported as failures.
 *  - Every outcome feeds connectionMonitor so LOW/OFFLINE modes react to real
 *    conditions, and LOW mode damps retry pressure automatically.
 */

import { connectionMonitor } from "./connection-monitor";

const RETRY_DELAYS_MS = [0, 1_500, 4_000]; // attempt 2 after ~1.5s, attempt 3 after ~4s

export class CancelledError extends Error {
  constructor() {
    super("cancelled");
  }
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function jitter(ms: number): number {
  return ms === 0 ? 0 : Math.round(ms * (0.75 + Math.random() * 0.5));
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * fetch() with a timeout budget and up to `retries` extra attempts.
 * The caller's AbortSignal is respected across attempts; cancelling throws
 * CancelledError which callers should treat as intentional, not failure.
 */
export async function resilientFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: { timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxRetries = opts.retries ?? 2;
  const started = Date.now();

  for (let attempt = 0; ; attempt++) {
    // LOW mode: one fewer retry so flaky links aren't hammered.
    const retries = connectionMonitor.getMode() === "low" ? Math.min(1, maxRetries) : maxRetries;
    if (attempt > 0) {
      await sleep(jitter(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]));
      if (init.signal?.aborted) throw new CancelledError();
    }

    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    init.signal?.addEventListener("abort", onCallerAbort);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let outcomeOk = false;
    let took = 0;
    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      took = Date.now() - started;
      outcomeOk = res.ok;
      if (!res.ok && isTransientStatus(res.status) && attempt < retries) {
        continue; // retryable → next attempt
      }
      return res;
    } catch (err) {
      took = Date.now() - started;
      // Caller-initiated cancellation must propagate untouched.
      if (init.signal?.aborted) throw new CancelledError();
      const timeout = err instanceof DOMException && err.name === "AbortError";
      if (timeout && attempt < retries) continue; // timed out → retry
      connectionMonitor.reportRequestOutcome(false, took);
      throw err;
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", onCallerAbort);
      if (outcomeOk || attempt >= retries + 0) {
        if (outcomeOk) connectionMonitor.reportRequestOutcome(true, took);
      }
    }
  }
}
