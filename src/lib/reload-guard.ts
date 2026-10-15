// Guard that overrides window.location.reload to use safeReloadAttempt first.
// Stores the original reload as window.fx__orig_reload so safeReloadAttempt
// can invoke it directly and avoid recursion.

import { safeReloadAttempt } from "@/lib/recovery";

(function installReloadGuard() {
  if (typeof window === "undefined") return;
  try {
    // Keep original reload available for safeReloadAttempt to call.
    if (!(window as any).fx__orig_reload) {
      try {
        (window as any).fx__orig_reload = window.location.reload.bind(window);
      } catch {
        (window as any).fx__orig_reload = undefined;
      }
    }
    // Replace reload with a guarded wrapper that defers to safeReloadAttempt.
    // We intentionally do not await safeReloadAttempt here to avoid blocking
    // the caller; safeReloadAttempt handles its own async flow and will call
    // the original reload when appropriate.
    // eslint-disable-next-line no-restricted-globals
    window.location.reload = function () {
      void safeReloadAttempt();
    } as unknown as () => void;
  } catch {
    // ignore — we must never throw during import
  }
})();
