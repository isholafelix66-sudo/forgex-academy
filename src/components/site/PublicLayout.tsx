import { Suspense, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Outlet } from "react-router";
import { PublicNav } from "./PublicNav";
import { Footer } from "./Footer";

/* ── Ambient background — identical to the old PageShell version ── */
export function BackgroundFX() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-lime-400/10 blur-3xl animate-pulse-glow" />
      <div className="absolute right-[-12rem] top-1/3 h-80 w-80 rounded-full bg-lime-400/5 blur-3xl" />
      <div className="absolute bottom-[-10rem] left-[-10rem] h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
    </div>
  );
}

/**
 * Suspense fallback that only appears after 300 ms. Prefetched / fast chunk
 * loads therefore render NO loading UI at all — the previous page swaps
 * straight into the new one without a flash of a spinner or a white frame.
 */
export function DeferredPageFallback() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="size-9 animate-spin rounded-full border-2 border-lime-400/20 border-t-lime-400" />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          ForgeX
        </p>
      </div>
    </div>
  );
}

/**
 * Persistent shell for every public page. Rendered ONCE as a router layout
 * route: navigating between public pages swaps only the page content inside
 * <main> — the nav, footer, mobile bottom nav and ambient background stay
 * mounted, so desktop navigation never repaints the whole viewport (which
 * used to read as a white flash before each page loaded).
 */
export function PublicLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <BackgroundFX />
      <PublicNav />
      <main className="relative overflow-x-clip pb-24 md:pb-6">
        {children ?? (
          <Suspense fallback={<DeferredPageFallback />}>
            <Outlet />
          </Suspense>
        )}
      </main>
      <Footer />
    </div>
  );
}
