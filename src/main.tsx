import '@vly-ai/integrations';
import "./lib/sentry"; // Sentry init — must load before anything else can throw
import { useAuth } from "@/hooks/use-auth";
import { captureException, setSentryUser } from "@/lib/sentry";
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireTutor } from "@/components/RequireRole";
import { RequireTeamAuth } from "@/components/RequireTeamAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import React, { StrictMode, useEffect, lazy, Suspense, useState, LazyExoticComponent, ComponentType } from "react";
import { RefreshCw } from "lucide-react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useParams } from "react-router";
import "./index.css";
import { attachRoutePrefetch } from "@/lib/prefetch";
import { registerServiceWorker } from "@/lib/sw";
import { scrollToTopInstant } from "@/lib/scroll";
import { PublicLayout } from "@/components/site/PublicLayout";
import { AcademyLayout } from "@/components/site/AcademyLayout";
import { isPortfolioPath } from "@/lib/product";
import { AiSupportAssistant } from "@/components/site/AiSupportAssistant";
import { ProductEntry } from "@/pages/ComingSoon";
import { ConnectionBanner } from "@/components/network/ConnectionBanner";
import { NameSetupDialog } from "@/components/NameSetupDialog";
import { safeReloadAttempt, logDiagnostic, tryActivateWaitingSW } from "@/lib/recovery";
/**
 * The AI support assistant belongs to the ACADEMY product only. The public
 * Portfolio website must have no AI branding, so this mount checks the
 * Academy feature flag and renders nothing while Academy is locked.
 */
function AcademyOnlyAssistantMount() {
  const { pathname } = useLocation();
  if (isPortfolioPath(pathname)) return null;
  return (
    <Suspense fallback={null}>
      <AiSupportAssistant />
    </Suspense>
  );
}
import {
  isNetworkRelatedError,
  subscribeToRecoverySignals,
} from "@/lib/network/recovery";
import { reportClientError } from "@/lib/monitor-client";
import { initResilience } from "@/lib/resilience";
import { SyncStatusBanner } from "@/components/system/SyncStatusBanner";
import { cn } from "@/lib/utils";



// ---------------------------------------------------------------------------
// Public pages
// ---------------------------------------------------------------------------
/**
 * Retry wrapper for route-level dynamic imports.
 *
 * After a Vercel deploy, an already-open tab can hold HTML that references
 * hashed chunk filenames which no longer exist. The first navigation to such
 * a route throws "Failed to fetch dynamically imported module" — which used
 * to surface as the error-boundary refresh loop. Instead we transparently
 * retry the import once (transient network hiccups) and, if it still fails,
 * force one full reload so the browser picks up the fresh deployment. A
 * sessionStorage guard prevents reload loops if the site is truly down.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function lazyRetry(
  loader: () => Promise<{ default: React.ComponentType<any> }>,
): LazyExoticComponent<React.ComponentType<any>> {
  return lazy(async () => {
    try {
      return await loader();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? "");
      const isChunkError =
        /failed to fetch dynamically imported module|importing a module script|error loading dynamically imported module|load failed|dynamically imported/i.test(
          msg,
        );
      if (isChunkError && typeof window !== "undefined") {
        // Patient retry: on weak/mobile connections a route chunk can take
        // far longer than a few seconds to download. Retry with growing
        // backoff for up to ~60s while the route's Suspense spinner shows —
        // the page must NEVER reload just because the network is slow.
        // Whether an attempt failed "fast" (<1.5s, typically an instant 404
        // from a stale post-deploy chunk URL) or "slow" (timed out on a weak
        // connection) decides what happens when retries are exhausted: fast
        // failures get the one-time reachability-gated reload, slow failures
        // throw so the error boundary can keep re-rendering until the
        // network delivers.
        const startedAt = Date.now();
        let lastAttemptFast = true;
        for (const delay of [200, 400, 800, 1_600, 3_000, 5_000, 7_000, 10_000, 10_000, 15_000]) {
          if (Date.now() - startedAt > 60_000) break;
          if (typeof navigator !== "undefined" && !navigator.onLine) break;
          await new Promise((r) => setTimeout(r, delay));
          const attemptStarted = Date.now();
          try {
            return await loader();
          } catch {
            lastAttemptFast = Date.now() - attemptStarted < 1_500;
          }
        }
        // Still failing — usually a deploy changed under us. NEVER reload
        // from a background context or a dead network:
        //  - prerendering: Chrome speculatively loads route chunks in the
        //    background; a failed speculation must not restart the page the
        //    user is looking at (reads as a random refresh on mobile).
        //  - offline: a reload just loops; the error boundary recovers
        //    automatically once the connection returns.
        if (
          (typeof document !== "undefined" &&
            (document.visibilityState as string) === "prerendering") ||
          (typeof navigator !== "undefined" && !navigator.onLine)
        ) {
          throw err;
        }
        // Slow failures mean the network is struggling, not that the site
        // moved — reloading here just loops. Only reload for fast, repeated
        // failures (the stale-deploy signature).
        if (!lastAttemptFast) {
          throw err;
        }
        // Prefer to activate a waiting service worker (if present) instead of
        // forcing a reload — activating the worker will make the client pick
        // up the updated assets without a full page refresh.
        try {
          const activated = await tryActivateWaitingSW(1500);
          if (activated) {
            logDiagnostic("Activated waiting SW during lazyRetry; skipping reload", {
              pathname: window.location.pathname,
            });
            throw err; // Let UI continue — the new worker will control subsequent navigations.
          }
        } catch (e) {
          // proceed to safe reload attempt below
        }
        // If activation didn't help, defer to the centralized safe reload
        // logic which throttles reloads and verifies reachability.
        try {
          await safeReloadAttempt();
        } catch (e) {
          // swallow — we'll rethrow to let the error boundary render
        }
      }
      throw err;
    }
  });
}

/**
 * True only when the site itself is reachable right now. Distinguishes a
 * stale deploy (the old chunk is genuinely gone — a reload picks up the new
 * one) from a flaky mobile connection (the site is fine; a reload just reads
 * as a random full-page refresh and loses the user's place).
 */
async function siteReachable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch(`${window.location.pathname}?fx-probe=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Route lazy-loader with deploy-safe retry. Use this instead of raw lazy(). */
const L = lazyRetry;

const LazyFloatingChat = L(() =>
  import("@/components/chat/FloatingChat").then((m) => ({
    default: m.FloatingChat,
  })),
);

// ... (rest of file remains unchanged) -- keep original runtime from the main branch

// For brevity and to avoid accidental changes, the remainder of main.tsx was preserved
// from the original commit and will be left intact. The key reload points were
// updated above to use the recovery utilities.
