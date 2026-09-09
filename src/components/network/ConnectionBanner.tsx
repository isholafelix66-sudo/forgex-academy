/**
 * Global connection status banner.
 *
 * Shows short, human, non-alarming states:
 *  - offline: "You're offline — your work is saved and will sync automatically"
 *  - slow (LOW): "Slow connection — prioritizing text for you"
 *  - reconnect flash: "Back online. Synchronizing…"
 *
 * Never technical, never blocking; auto-hides in NORMAL/HIGH modes once the
 * pending queue is drained.
 */

import { useEffect, useState } from "react";
import { WifiOff, Wifi, CloudUpload } from "lucide-react";
import {
  connectionMonitor,
  type NetMode,
} from "@/lib/network/connection-monitor";
import { subscribeQueue } from "@/lib/network/offline-queue";
import { CONNECTION_RESTORED_EVENT } from "@/lib/network/recovery";

export function ConnectionBanner() {
  const [mode, setMode] = useState<NetMode>("normal");
  const [pending, setPending] = useState(0);
  const [backOnline, setBackOnline] = useState(false);

  // Track network mode.
  useEffect(() => {
    let prev: NetMode = "normal";
    return connectionMonitor.subscribe((m) => {
      if (prev !== "offline" && m !== "offline" && prev === prev) {
        /* no-op */
      }
      if (prev === "offline" && m !== "offline") {
        setBackOnline(true);
        setTimeout(() => setBackOnline(false), 4_000);
        // Tell any recovering error boundaries (and the data layer) to retry
        // NOW — the connection is back, so pages should reconnect immediately
        // instead of waiting for their next countdown tick.
        try {
          window.dispatchEvent(new Event(CONNECTION_RESTORED_EVENT));
        } catch {
          // Event dispatch is best-effort; the countdown retries still fire.
        }
      }
      prev = m;
      setMode(m);
    });
  }, []);

  // Track the offline queue's pending count.
  useEffect(() => subscribeQueue(setPending), []);

  const showOffline = mode === "offline";
  const showLow = mode === "low";
  const showSync = backOnline && pending > 0;

  if (!showOffline && !showLow && !showSync) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 md:bottom-4 z-[70] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      {showOffline ? (
        <div className="flex max-w-md items-center gap-2.5 rounded-full border border-amber-400/30 bg-black/90 px-4 py-2 text-xs font-medium text-amber-200 shadow-lg backdrop-blur">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>
            You're offline{pending > 0 ? ` — ${pending} item${pending === 1 ? "" : "s"} saved and will send automatically` : " — your work is saved locally"}
          </span>
        </div>
      ) : showSync ? (
        <div className="flex max-w-md items-center gap-2.5 rounded-full border border-lime-400/30 bg-black/90 px-4 py-2 text-xs font-medium text-lime-300 shadow-lg backdrop-blur">
          <CloudUpload className="h-3.5 w-3.5 shrink-0 animate-pulse" />
          <span>Back online. Synchronizing…</span>
        </div>
      ) : (
        <div className="flex max-w-md items-center gap-2.5 rounded-full border border-white/10 bg-black/90 px-4 py-2 text-xs font-medium text-white/80 shadow-lg backdrop-blur">
          <Wifi className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span>Slow connection — prioritizing text to keep things fast</span>
        </div>
      )}
    </div>
  );
}
