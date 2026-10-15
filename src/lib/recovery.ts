// Utilities for safe reload attempts, worker activation and diagnostics
// Keep minimal and safe: no secrets, best-effort logging.

export async function tryActivateWaitingSW(timeout = 1500): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    const waiting = registration.waiting;
    if (!waiting) return false;
    // Request activation
    try {
      waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      // ignore
    }
    // Wait for controllerchange
    return await new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }, timeout);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!resolved) {
          clearTimeout(timer);
          resolved = true;
          resolve(true);
        }
      });
    });
  } catch {
    return false;
  }
}

export function logDiagnostic(message: string, extra?: Record<string, unknown>) {
  try {
    // Console always available in browsers
    // Keep logs lightweight and avoid leaking secrets — only structured context
    console.error(`[ForgeX diagnostic] ${message}`, extra ?? {});
    // captureException is used in main.tsx via existing wrapper if available
  } catch {
    // ignore
  }
}

export function isReloadThrottled(): boolean {
  try {
    return sessionStorage.getItem("fx_reload_throttled") === "1";
  } catch {
    return false;
  }
}

export function clearReloadThrottle(): void {
  try {
    sessionStorage.removeItem("fx_reload_throttled");
  } catch {
    // ignore
  }
}

/**
 * Attempt a safe reload flow:
 *  - Throttle reloads to avoid loops (2 reloads per 5 minutes)
 *  - Prefer activating a waiting service worker before forcing a reload
 *  - If throttle exceeded, set a throttle flag so the UI can present a
 *    recovery card instead of auto-reloading.
 * Returns true if a reload was initiated, false if not.
 */
export async function safeReloadAttempt(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const KEY_AT = "fx_chunk_reload_at";
    const KEY_COUNT = "fx_chunk_reload_count";
    const THROTTLE_FLAG = "fx_reload_throttled";
    const now = Date.now();
    const last = Number(sessionStorage.getItem(KEY_AT) ?? 0);
    let count = Number(sessionStorage.getItem(KEY_COUNT) ?? 0);

    // Reset count if older than 5 minutes
    if (now - last > 5 * 60_000) {
      count = 0;
    }

    // If we've already reloaded twice in the window, set throttle flag and
    // avoid auto-reloading again — let the UI present a recovery card.
    if (count >= 2) {
      try {
        sessionStorage.setItem(THROTTLE_FLAG, "1");
      } catch {
        // ignore
      }
      logDiagnostic("Reload throttle engaged; automatic reload suppressed", { last, count });
      return false;
    }

    // Try to activate a waiting service worker first — a waiting SW will pick
    // up the new assets so a reload is unnecessary. If activation succeeds,
    // do NOT force a reload here (the controllerchange will cause the page to
    // be controlled by the new worker on its own timeline).
    try {
      const activated = await tryActivateWaitingSW(1500);
      if (activated) {
        // Mark we attempted a recovery
        sessionStorage.setItem(KEY_AT, String(now));
        sessionStorage.setItem(KEY_COUNT, String(count + 1));
        logDiagnostic("Activated waiting service worker instead of hard reload", { activated });
        return false; // no reload needed
      }
    } catch (err) {
      logDiagnostic("Error while attempting to activate waiting SW", { err: String(err) });
    }

    // No waiting worker or activation failed — perform the guarded reload.
    // Record attempt and throttle.
    sessionStorage.setItem(KEY_AT, String(now));
    sessionStorage.setItem(KEY_COUNT, String(count + 1));

    // Final guard: reload only when the site itself appears reachable. The
    // caller should have already called siteReachable() in many flows, but we
    // double-check here as insurance.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const siteReachable = (window as any).fx_siteReachable as (() => Promise<boolean> | undefined) | undefined;
      let ok = true;
      if (siteReachable) {
        const res = await siteReachable();
        ok = Boolean(res);
      }
      if (!ok) {
        logDiagnostic("Site not reachable — skipping reload");
        return false;
      }
    } catch (err) {
      // ignore and proceed to reload
    }

    try {
      window.location.reload();
      return true;
    } catch (err) {
      logDiagnostic("Reload() threw an error", { err: String(err) });
      return false;
    }
  } catch (err) {
    // Any unexpected error prevents reload to avoid loops
    logDiagnostic("safeReloadAttempt failed", { err: String(err) });
    return false;
  }
}
