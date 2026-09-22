/**
 * Global sync-status indicator (non-intrusive).
 *
 * Shows a small pill only while fallback/queue mode is active:
 *   - "Sync temporarily unavailable — your changes are safely queued."
 *   - "All changes synced." (fades away after a few seconds)
 *
 * Subscribes to the resilience core — it renders nothing during normal
 * (healthy) operation, so it never distracts users.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CloudOff } from "lucide-react";
import { subscribeSync, getSyncState, type SyncState } from "@/lib/resilience";

export function SyncStatusBanner() {
  const [state, setState] = useState<SyncState>(() => getSyncState());
  // "All changes synced." lingers briefly after the queue drains.
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    let prevPending = getSyncState().pending;
    const unsub = subscribeSync((s) => {
      setState(s);
      if (prevPending > 0 && s.pending === 0 && s.failed === 0) {
        setJustSynced(true);
        window.setTimeout(() => setJustSynced(false), 4_000);
      }
      prevPending = s.pending;
    });
    return unsub;
  }, []);

  const showDegraded = state.mode !== "healthy" && state.pending + state.failed > 0;
  const show = showDegraded || justSynced;
  if (typeof window === "undefined") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[80] flex justify-center px-3">
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex max-w-[92vw] items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-lg backdrop-blur sm:text-sm ${
              showDegraded
                ? "border-amber-400/30 bg-amber-950/80 text-amber-200"
                : "border-lime-400/30 bg-black/80 text-lime-300"
            }`}
          >
            {showDegraded ? (
              <CloudOff className="size-4 shrink-0" aria-hidden />
            ) : (
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            )}
            <span className="truncate">
              {showDegraded
                ? `Sync temporarily unavailable — your changes are safely queued.${state.pending > 0 ? ` (${state.pending})` : ""}`
                : "All changes synced."}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
