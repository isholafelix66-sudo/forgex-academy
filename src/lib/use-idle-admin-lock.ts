import { useEffect, useRef } from "react";

/**
 * How long the admin dashboard stays unlocked with zero user activity
 * (mouse movement, clicks, keyboard, touch, scroll) before it auto-locks.
 *
 * NOTE: this is intentionally very short per product request — any real
 * interaction (moving the mouse, typing, scrolling) resets the timer, so it
 * only fires when the admin is genuinely away from the page.
 */
export const ADMIN_IDLE_LOCK_MS = 5_000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "pointermove",
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
];

/**
 * Clears the admin session (via onLock) after ADMIN_IDLE_LOCK_MS of
 * inactivity. Only active while `enabled` is true.
 */
export function useIdleAdminLock({ enabled, onLock }: { enabled: boolean; onLock: () => void }) {
  // Keep the callback fresh without re-binding listeners every render.
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let locked = false;

    const reset = () => {
      if (locked) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        locked = true;
        onLockRef.current();
      }, ADMIN_IDLE_LOCK_MS);
    };

    reset();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, reset, { passive: true });
    }

    return () => {
      if (timer) clearTimeout(timer);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, reset);
      }
    };
  }, [enabled]);
}
