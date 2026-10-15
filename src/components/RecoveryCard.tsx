import React from "react";
import { clearReloadThrottle } from "@/lib/recovery";

export default function RecoveryCard({ onHardReload }: { onHardReload?: () => void }) {
  const copyDiagnostics = async () => {
    try {
      const diag = sessionStorage.getItem("fx_diag") ?? JSON.stringify({
        ts: Date.now(),
        path: window.location.pathname,
        reloadCount: sessionStorage.getItem("fx_chunk_reload_count") ?? "0",
      }, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(diag);
        // eslint-disable-next-line no-alert
        alert("Diagnostics copied to clipboard. Please share with support.");
        return;
      }
      // Fallback
      // eslint-disable-next-line no-alert
      alert("Could not copy diagnostics automatically; open the console to view them.");
      // eslint-disable-next-line no-console
      console.error("[ForgeX diagnostic]", diag);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[ForgeX] Copy diagnostics failed:", e);
      // eslint-disable-next-line no-alert
      alert("Diagnostics unavailable — check the console.");
    }
  };

  const hardReload = () => {
    try {
      clearReloadThrottle();
    } catch {
      // ignore
    }
    if ((window as any).fx__orig_reload) {
      try {
        (window as any).fx__orig_reload();
        return;
      } catch {
        // fall through
      }
    }
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-lime-400/25 bg-lime-400/10 mb-4">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 2v6" stroke="#84CC16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 16v6M5 12h14" stroke="#84CC16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="font-display text-lg font-bold">Recovery paused</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Automatic recovery has been paused to avoid repeated page reloads. You can try a manual hard reload or copy diagnostics to share with support.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => (onHardReload ? onHardReload() : hardReload())}
            className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2 text-sm font-semibold text-black hover:bg-lime-300"
          >
            Hard reload
          </button>
          <button
            onClick={() => copyDiagnostics()}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-white/5"
          >
            Copy diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}
