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
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense, useState, LazyExoticComponent, ComponentType } from "react";
import { RefreshCw } from "lucide-react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";
import { attachRoutePrefetch } from "@/lib/prefetch";
import { registerServiceWorker } from "@/lib/sw";
import { ConnectionBanner } from "@/components/network/ConnectionBanner";
import { AiSupportAssistant } from "@/components/site/AiSupportAssistant";



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
        // One retry after a short delay — handles momentary network drops.
        await new Promise((r) => setTimeout(r, 300));
        try {
          return await loader();
        } catch {
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
          const KEY = "fx_chunk_reload_at";
          const last = Number(sessionStorage.getItem(KEY) ?? 0);
          if (Date.now() - last > 10_000) {
            sessionStorage.setItem(KEY, String(Date.now()));
            window.location.reload();
          }
        }
      }
      throw err;
    }
  });
}

/** Route lazy-loader with deploy-safe retry. Use this instead of raw lazy(). */
const L = lazyRetry;

const LazyFloatingChat = L(() =>
  import("@/components/chat/FloatingChat").then((m) => ({
    default: m.FloatingChat,
  })),
);

/**
 * Wraps FloatingChat in a dedicated error boundary so that any crash in the
 * chat component (e.g. Convex Auth hooks failing for team members who
 * authenticate via token, not Convex Auth) can never take down the entire
 * application. Also skips rendering entirely on /team/* routes where the
 * global chat is not needed and the Convex Auth hooks may not be available.
 */
class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[ForgeX] FloatingChat suppressed error:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/**
 * Conditionally renders FloatingChat — skipped on /team/* routes where team
 * members authenticate via their own token system and don't have a Convex
 * Auth session. The chat hooks (useAuth, useMessageSound) depend on Convex
 * Auth and would fail for team-only users.
 */
function LazyFloatingChatWrapper() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/team")) return null;
  return (
    <ChatErrorBoundary>
      <LazyFloatingChat />
    </ChatErrorBoundary>
  );
}

const Landing = L(() => import("./pages/Landing.tsx"));
const About = L(() => import("./pages/About.tsx"));
const Courses = L(() => import("./pages/Courses.tsx"));
const CourseDetail = L(() => import("./pages/CourseDetail.tsx"));
const Tutors = L(() => import("./pages/Tutors.tsx"));
const TutorDetail = L(() => import("./pages/TutorDetail.tsx"));
const RoadmapPage = L(() => import("./pages/RoadmapPage.tsx"));
const Updates = L(() => import("./pages/Updates.tsx"));
const Stories = L(() => import("./pages/Stories.tsx"));
const AIHub = L(() => import("./pages/AIHub.tsx"));
const PromptLibrary = L(() => import("./pages/PromptLibrary.tsx"));
const PromptDetail = L(() => import("./pages/PromptDetail.tsx"));
const Contact = L(() => import("./pages/Contact.tsx"));
const VerifyCertificate = L(() => import("./pages/VerifyCertificate.tsx"));
const BecomeTutor = L(() => import("./pages/BecomeTutor.tsx"));
const AuthPage = L(() => import("./pages/Auth.tsx"));
const NotFound = L(() => import("./pages/NotFound.tsx"));

// ---------------------------------------------------------------------------
// Learning + student dashboard
// ---------------------------------------------------------------------------
const Learn = L(() => import("./pages/Learn.tsx"));
const DashboardShell = L(() => import("./pages/dashboard/DashboardShell.tsx"));
const DashboardHome = L(() => import("./pages/dashboard/DashboardHome.tsx"));
const MyCourses = L(() => import("./pages/dashboard/MyCourses.tsx"));
const RoadmapProgress = L(() => import("./pages/dashboard/RoadmapProgress.tsx"));
const Assignments = L(() => import("./pages/dashboard/Assignments.tsx"));
const Certificates = L(() => import("./pages/dashboard/Certificates.tsx"));
const Messages = L(() => import("./pages/dashboard/Messages.tsx"));
const Notifications = L(() => import("./pages/dashboard/Notifications.tsx"));
const Profile = L(() => import("./pages/dashboard/Profile.tsx"));
const Settings = L(() => import("./pages/dashboard/Settings.tsx"));

// Communication & Community module (student side)
const Communities = L(() => import("./pages/dashboard/Communities.tsx"));
const CommunityRoom = L(() => import("./pages/dashboard/CommunityRoom.tsx"));
const Discover = L(() => import("./pages/dashboard/Discover.tsx"));
const Connections = L(() => import("./pages/dashboard/Connections.tsx"));
const StudentDMs = L(() => import("./pages/dashboard/StudentDMs.tsx"));
const StudentDMThread = L(() => import("./pages/dashboard/StudentDMThread.tsx"));
const StudentSupport = L(() => import("./pages/dashboard/StudentSupport.tsx"));

// ---------------------------------------------------------------------------
// Tutor dashboard
// ---------------------------------------------------------------------------
const TutorShell = L(() => import("./pages/tutor/TutorShell.tsx"));
const TutorOverview = L(() => import("./pages/tutor/TutorOverview.tsx"));
const TutorCourses = L(() => import("./pages/tutor/TutorCourses.tsx"));
const CourseEditor = L(() => import("./pages/tutor/CourseEditor.tsx"));
const TutorGrading = L(() => import("./pages/tutor/TutorGrading.tsx"));
const TutorStudents = L(() => import("./pages/tutor/TutorStudents.tsx"));
const TutorInbox = L(() => import("./pages/tutor/TutorInbox.tsx"));
const TutorAnnouncements = L(() => import("./pages/tutor/TutorAnnouncements.tsx"));
const TutorSupport = L(() => import("./pages/tutor/TutorSupport.tsx"));
const TutorCommunities = L(() => import("./pages/tutor/TutorCommunities.tsx"));
const TutorCommunityManage = L(() => import("./pages/tutor/TutorCommunityManage.tsx"));
const TutorProfile = L(() => import("./pages/tutor/TutorProfile.tsx"));
const TutorSettings = L(() => import("./pages/tutor/TutorSettings.tsx"));

// Public tutor mini-website (shareable /tutor/<slug> page)
const TutorPage = L(() => import("./pages/TutorPage.tsx"));

// ---------------------------------------------------------------------------
// Team Workspace
// ---------------------------------------------------------------------------
const TeamHub = L(() => import("./pages/team/TeamHub.tsx"));
const TeamPassword = L(() => import("./pages/team/TeamPassword.tsx"));
const TeamDashboardShell = L(() => import("./pages/team/TeamDashboardShell.tsx"));
const AcademicOverview = L(() => import("./pages/team/AcademicOverview.tsx"));
const AISupportOverview = L(() => import("./pages/team/AISupportOverview.tsx"));
const TutorSupportOverview = L(() => import("./pages/team/TutorSupportOverview.tsx"));
const StudentSupportOverview = L(() => import("./pages/team/StudentSupportOverview.tsx"));
const TeamSettings = L(() => import("./pages/team/TeamSettings.tsx"));


// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------
const AdminShell = L(() => import("./pages/admin/AdminShell.tsx"));
const AdminOverview = L(() => import("./pages/admin/AdminOverview.tsx"));
const AdminUsers = L(() => import("./pages/admin/AdminUsers.tsx"));
const AdminApplications = L(() => import("./pages/admin/AdminApplications.tsx"));
const AdminCourses = L(() => import("./pages/admin/AdminCourses.tsx"));
const AdminCatalog = L(() => import("./pages/admin/AdminCatalog.tsx"));
const AdminUpdates = L(() => import("./pages/admin/AdminUpdates.tsx"));
const AdminStories = L(() => import("./pages/admin/AdminStories.tsx"));
const AdminAIHub = L(() => import("./pages/admin/AdminAIHub.tsx"));
const AdminPrompts = L(() => import("./pages/admin/AdminPrompts.tsx"));
const AdminCertificates = L(() => import("./pages/admin/AdminCertificates.tsx"));
const AdminContent = L(() => import("./pages/admin/AdminContent.tsx"));
const AdminMedia = L(() => import("./pages/admin/AdminMedia.tsx"));
const AdminFormBuilder = L(() => import("./pages/admin/AdminFormBuilder.tsx"));
const AdminAudit = L(() => import("./pages/admin/AdminAudit.tsx"));
const AdminProfile = L(() => import("./pages/admin/AdminProfile.tsx"));
const AdminChat = L(() => import("./pages/admin/AdminChat.tsx"));
const AdminInbox = L(() => import("./pages/admin/AdminInbox.tsx"));
const AdminCoursePreview = L(() => import("./pages/admin/AdminCoursePreview.tsx"));
const AdminTeamManagement = L(() => import("./pages/admin/AdminTeamManagement.tsx"));
const AdminAiSupport = L(() => import("./pages/admin/AdminAiSupport.tsx"));
const AdminEmailCenter = L(() => import("./pages/admin/AdminEmailCenter.tsx"));

// Communication & Community module (admin moderation)
const AdminCommunication = L(() => import("./pages/admin/AdminCommunication.tsx"));
const AdminCommunityDetail = L(() => import("./pages/admin/AdminCommunityDetail.tsx"));
const AdminDMs = L(() => import("./pages/admin/AdminDMs.tsx"));
const AdminDMDetail = L(() => import("./pages/admin/AdminDMDetail.tsx"));
const AdminReports = L(() => import("./pages/admin/AdminReports.tsx"));
const AdminCommAudit = L(() => import("./pages/admin/AdminCommAudit.tsx"));

// Compact spinner fallback for lazy route transitions — matches the brand
// and avoids the layout shift of a full-page text swap.
function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="size-9 animate-spin rounded-full border-2 border-lime-400/20 border-t-lime-400" />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          ForgeX
        </p>
      </div>
    </div>
  );
}

/** Shown only when the Convex deployment URL is missing from the client env —
 *  a friendly, self-explanatory screen instead of a blank/error page. */
function BootMessage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-lime-400/25 bg-lime-400/10">
          <RefreshCw className="size-7 text-lime-300" />
        </div>
        <h1 className="font-display mt-5 text-xl font-bold">Warming up</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ForgeX Academy is still connecting. If this screen sticks around, hit
          reload and the app will finish loading.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
        >
          Reload app
        </button>
      </div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/**
 * Hard guard so runtime errors never leave the preview as a blank page or a
 * permanent error screen. When anything throws (a transient Convex hiccup, a
 * stale route, a lazy chunk failure…) the app shows a short "recovering"
 * screen and re-renders automatically — no error details are ever exposed to
 * the visitor. If the same failure keeps happening, auto-recovery gives up
 * after a few tries and offers a single friendly reload button. The full
 * error is logged to the console only, where it can be pasted back for
 * diagnosis.
 */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; attempts: number; countdown: number }
> {
  state = { hasError: false, attempts: 0, countdown: 0 };
  private timer: ReturnType<typeof setInterval> | null = null;

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error("[ForgeX] Recovered runtime error (auto-retrying):", err);
    console.error("[ForgeX] Component stack:", info?.componentStack);
    // Report to Sentry so the error shows up in the dashboard alongside the
    // session context, while the UI still auto-recovers.
    try {
      captureException(err, { componentStack: info?.componentStack });
    } catch (reportErr) {
      console.warn("[ForgeX] Could not report error to Sentry:", reportErr);
    }
    // A stale-chunk error can never be fixed by re-rendering — only by
    // fetching the new deployment. Reload once instead of looping, but never
    // reload while offline (it just loops) or from a background prerender.
    const msg = err instanceof Error ? err.message : String(err ?? "");
    if (
      /failed to fetch dynamically imported module|importing a module script|error loading dynamically imported module/i.test(
        msg,
      ) &&
      (typeof navigator === "undefined" || navigator.onLine) &&
      (typeof document === "undefined" ||
        (document.visibilityState as string) !== "prerendering") &&
      typeof sessionStorage !== "undefined"
    ) {
      const KEY = "fx_chunk_reload_at";
      const last = Number(sessionStorage.getItem(KEY) ?? 0);
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    }
  }

  componentDidUpdate(
    _prevProps: { children: React.ReactNode },
    prevState: { hasError: boolean },
  ) {
    if (this.state.hasError && !prevState.hasError) {
      this.scheduleRecovery();
    }
  }

  componentWillUnmount() {
    this.clearRecovery();
  }

  private scheduleRecovery() {
    this.clearRecovery();
    // Persistent failures stop auto-recovering after 3 attempts and fall back
    // to a manual reload instead of looping forever.
    if (this.state.attempts >= 3) return;
    let left = 3;
    this.setState({ countdown: left });
    this.timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        this.clearRecovery();
        this.setState((s) => ({
          hasError: false,
          attempts: s.attempts + 1,
          countdown: 0,
        }));
      } else {
        this.setState({ countdown: left });
      }
    }, 1000);
  }

  private clearRecovery() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  render() {
    if (this.state.hasError) {
      const stillRetrying = this.state.attempts < 3;
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <div className="max-w-md text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-lime-400/25 bg-lime-400/10">
              <RefreshCw
                className={
                  stillRetrying
                    ? "size-7 animate-spin text-lime-300"
                    : "size-7 text-lime-300"
                }
              />
            </div>
            <h1 className="font-display mt-5 text-xl font-bold">
              {stillRetrying ? "One moment…" : "We hit a snag"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {stillRetrying
                ? `Something hiccuped — recovering automatically in ${this.state.countdown}s.`
                : "A quick reload usually sorts this out. You'll be right back where you were."}
            </p>
            {!stillRetrying && (
              <button
                onClick={() => window.location.reload()}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
              >
                Reload app
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Page-level error boundary: if ONE route crashes, only that page shows a
 * friendly "retry" card — the rest of the app (nav, footer, chat, other
 * routes) keeps working. It auto-resets on the next navigation, so a
 * transient failure never traps the user on an error screen. The error is
 * logged + reported to Sentry, never shown to the visitor.
 */
class RouteErrorBoundary extends React.Component<
  { locationKey: string; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error("[ForgeX] Route error (page kept alive):", err);
    try {
      captureException(err, { componentStack: info?.componentStack });
    } catch (reportErr) {
      console.warn("[ForgeX] Could not report route error:", reportErr);
    }
  }

  componentDidUpdate(prevProps: { locationKey: string }) {
    // Navigated away — clear the failure so the next page renders fresh.
    if (this.state.failed && this.props.locationKey !== prevProps.locationKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10">
              <RefreshCw className="size-6 text-amber-300" />
            </div>
            <h1 className="font-display mt-4 text-xl font-bold">
              This page hit a snag
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Something went wrong loading this page — a quick retry usually
              sorts it out.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => this.setState({ failed: false })}
                className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
              >
                <RefreshCw className="size-4" /> Try again
              </button>
              <a
                href="/"
                className="inline-flex items-center rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
              >
                Back to home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Binds the boundary to the current route key so it resets on navigation. */
function RouteBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <RouteErrorBoundary locationKey={location.key}>
      {children}
    </RouteErrorBoundary>
  );
}

// The Convex deployment URL is normally injected at build time through the
// VITE_CONVEX_URL environment variable (the managed platform build sets it;
// on Vercel it must live in Project → Settings → Environment Variables). If
// it is missing from the build, fall back to this app's production
// deployment so the deployed site can never boot to the "warming up"
// screen — the URL is public by design and already shipped in the client
// bundle. VITE_CONVEX_URL (when set) always wins over this fallback.
const DEFAULT_CONVEX_URL = "https://hidden-poodle-567.convex.cloud";
const convexUrl =
  (import.meta.env.VITE_CONVEX_URL as string | undefined)?.trim() ||
  DEFAULT_CONVEX_URL;
let convex: ConvexReactClient | null = null;
try {
  if (convexUrl) {
    convex = new ConvexReactClient(convexUrl);
  }
} catch (err) {
  console.error("[ForgeX] Could not initialise the Convex client:", err);
}

// Last-resort safety net: if the app fails before React even mounts (e.g. a
// module-level error), render a friendly screen instead of a blank page. It
// only acts while #root is still empty, so it never interferes with the
// running app.
function ensureBootFallback() {
  const rootEl = document.getElementById("root");
  if (!rootEl || rootEl.childElementCount > 0) return;
  rootEl.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0f0e;color:#e7e9e8;font-family:system-ui,sans-serif;padding:24px">' +
    '<div style="text-align:center;max-width:420px">' +
    '<div style="width:56px;height:56px;margin:0 auto;border-radius:16px;border:1px solid rgba(163,230,53,.25);background:rgba(163,230,53,.1);display:flex;align-items:center;justify-content:center;font-size:24px">⚡</div>' +
    '<h1 style="margin-top:20px;font-size:18px;font-weight:700">Give us a moment</h1>' +
    '<p style="margin-top:8px;font-size:13px;color:#9aa3a0;line-height:1.5">ForgeX Academy is still warming up. If this stays on screen, hit reload and you\'ll be right back in.</p>' +
    '<button onclick="location.reload()" style="margin-top:24px;padding:10px 20px;border-radius:12px;border:0;background:#a3e635;color:#000;font-weight:600;font-size:13px;cursor:pointer">Reload app</button>' +
    "</div></div>";
}
window.addEventListener("error", ensureBootFallback);
window.addEventListener("unhandledrejection", ensureBootFallback);

/**
 * Deploy-safety net #2: any *unhandled* stale-chunk failure (from code paths
 * outside our lazy() wrapper) triggers exactly one reload so the browser
 * picks up the new deployment instead of looping through error boundaries.
 */ window.addEventListener("unhandledrejection", (event) => {
  const reason: unknown = event?.reason;
  const msg = reason instanceof Error ? reason.message : String(reason ?? "");
  if (
    /failed to fetch dynamically imported module|importing a module script|error loading dynamically imported module/i.test(
      msg,
    ) &&
    // Never reload from a background speculation or while offline — the
    // visible page is fine and a reload would only loop (mobile flakiness).
    (typeof document === "undefined" ||
      (document.visibilityState as string) !== "prerendering") &&
    (typeof navigator === "undefined" || navigator.onLine) &&
    typeof sessionStorage !== "undefined"
  ) {
    event.preventDefault();
    const KEY = "fx_chunk_reload_at";
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last > 10_000) {
      sessionStorage.setItem(KEY, String(Date.now()));
      window.location.reload();
    }
  }
});

/**
 * Global scroll reset: whenever the route changes (header links, sidebar
 * links, bottom navigation, programmatic navigate()…) the page jumps back to
 * the top instantly, so a new page never opens midway down or at the footer.
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

/** Keep Sentry's user context in sync with the signed-in Convex user. */
function SentryUserSync() {
  const { isAuthenticated, user } = useAuth();
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSentryUser(null);
      return;
    }
    setSentryUser({
      id: user._id,
      name: (user as { name?: string }).name,
      email: (user as { email?: string }).email,
    });
  }, [isAuthenticated, user]);
  return null;
}

/** Error boundary for SentryUserSync so Convex Auth failures never crash the app. */
class SentrySyncBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[ForgeX] SentryUserSync suppressed error:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

// ---------------------------------------------------------------------------
// Offline indicator + boot-time hooks
// ---------------------------------------------------------------------------

/** Small pill that appears when the connection drops, so a cached/offline
 *  session (service worker serving the app shell) never feels broken. */
function OfflineBadge() {
  const [offline, setOffline] = useState(
    () => (typeof navigator === "undefined" ? false : !navigator.onLine),
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed left-1/2 z-[70] -translate-x-1/2 rounded-full border border-lime-400/25 bg-black/90 px-4 py-1.5 text-xs font-medium text-lime-300 shadow-lg shadow-black/40 backdrop-blur bottom-[calc(5rem+env(safe-area-inset-bottom,0px)+1rem)] md:bottom-12">
      You&rsquo;re offline — showing the saved version
    </div>
  );
}

// Fast navigation: warm up lazy route chunks on hover/focus/touch.
attachRoutePrefetch();

// Offline support: install the app-shell service worker. Best-effort — it
// skips silently in sandboxed iframes and older browsers.
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      {convex ? (
        <>
          <ToolbarErrorBoundary>
            <VlyToolbar />
          </ToolbarErrorBoundary>
          <ConvexAuthProvider client={convex}>
        <SentrySyncBoundary>
          <SentryUserSync />
        </SentrySyncBoundary>
        {/* WhatsApp-style floating chat — global, signed-in users only.
            Lazy-loaded so it (and its data queries) never block first paint
            or initial bundle for visitors. Rendered inside the router so it
            can hide itself on screens that have their own composer. */}
        <OfflineBadge />
        <BrowserRouter>
          <RouteSyncer />
          <ScrollToTop />
          <Suspense fallback={null}>
            <LazyFloatingChatWrapper />
          </Suspense>
          <Suspense fallback={null}>
            <AiSupportAssistant />
          </Suspense>
          <Suspense fallback={<RouteLoading />}>
            <RouteBoundary>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Landing />} />
              <Route path="/about" element={<About />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:slug" element={<CourseDetail />} />
              <Route path="/tutors" element={<Tutors />} />
              <Route path="/tutors/:id" element={<TutorDetail />} />
              <Route path="/roadmap" element={<RoadmapPage />} />
              <Route path="/updates" element={<Updates />} />
              <Route path="/stories" element={<Stories />} />
              <Route path="/ai-hub" element={<AIHub />} />
              <Route path="/prompts" element={<PromptLibrary />} />
              <Route path="/prompts/:slug" element={<PromptDetail />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/verify/:certificateId" element={<VerifyCertificate />} />
              <Route path="/become-tutor" element={<BecomeTutor />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />

              {/* Course player (signed in) */}
              <Route
                path="/learn/:slug"
                element={
                  <RequireAuth>
                    <Learn />
                  </RequireAuth>
                }
              />

              {/* Student dashboard */}
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <DashboardShell />
                  </RequireAuth>
                }
              >
                <Route index element={<DashboardHome />} />
                <Route path="my-courses" element={<MyCourses />} />
                <Route path="roadmap" element={<RoadmapProgress />} />
                <Route path="assignments" element={<Assignments />} />
                <Route path="certificates" element={<Certificates />} />
                <Route path="messages" element={<Messages />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />

                {/* Communication & Community */}
                <Route path="communities" element={<Communities />} />
                <Route path="communities/:id" element={<CommunityRoom />} />
                <Route path="discover" element={<Discover />} />
                <Route path="connections" element={<Connections />} />
                <Route path="dms" element={<StudentDMs />} />
                <Route path="dms/:id" element={<StudentDMThread />} />
                <Route path="support" element={<StudentSupport />} />
              </Route>

              {/* Tutor dashboard — verified tutors only, or the admin session
                  (password gate, no account) can preview it read-only. */}
              <Route
                path="/tutor"
                element={
                  <RequireTutor>
                    <TutorShell />
                  </RequireTutor>
                }
              >
                <Route index element={<TutorOverview />} />
                <Route path="courses" element={<TutorCourses />} />
                <Route path="courses/:id" element={<CourseEditor />} />
                <Route path="grading" element={<TutorGrading />} />
                <Route path="students" element={<TutorStudents />} />
                <Route path="inbox" element={<TutorInbox />} />
                <Route path="announcements" element={<TutorAnnouncements />} />
                <Route path="support" element={<TutorSupport />} />
                <Route path="communities" element={<TutorCommunities />} />
                <Route path="communities/:id" element={<TutorCommunityManage />} />
                <Route path="profile" element={<TutorProfile />} />
                <Route path="settings" element={<TutorSettings />} />
              </Route>

              {/* Public tutor mini-website — the shareable /tutor/<slug> page.
                  Static routes under /tutor (courses, grading, …) win over
                  this dynamic segment, so the dashboard keeps working. */}
              <Route path="/tutor/:slug" element={<TutorPage />} />

              {/* Team Hub — workspace password access */}
              <Route path="/team" element={<TeamHub />} />
              <Route path="/team/access/:teamSlug" element={<TeamPassword />} />
              <Route path="/team/:teamSlug" element={<RequireTeamAuth><TeamDashboardShell /></RequireTeamAuth>}>
                <Route index element={<AcademicOverview />} />
                <Route path="settings" element={<TeamSettings />} />
              </Route>


{/* Admin dashboard — password-gated only, no user account needed */}
              <Route path="/admin" element={<AdminShell />}>
                <Route index element={<AdminOverview />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="applications" element={<AdminApplications />} />
                <Route path="courses" element={<AdminCourses />} />
                <Route path="courses/preview/:id" element={<AdminCoursePreview />} />
                <Route path="catalog" element={<AdminCatalog />} />
                <Route path="updates" element={<AdminUpdates />} />
                <Route path="stories" element={<AdminStories />} />
                <Route path="ai-hub" element={<AdminAIHub />} />
                <Route path="prompts" element={<AdminPrompts />} />
                <Route path="certificates" element={<AdminCertificates />} />
                <Route path="content" element={<AdminContent />} />
                <Route path="media" element={<AdminMedia />} />
                <Route path="form-builder" element={<AdminFormBuilder />} />
                <Route path="audit" element={<AdminAudit />} />
                <Route path="profile" element={<AdminProfile />} />
                <Route path="inbox" element={<AdminInbox />} />
                <Route path="chat" element={<AdminChat />} />

                {/* Communication moderation */}
                <Route path="communication" element={<AdminCommunication />} />
                <Route path="communication/communities/:id" element={<AdminCommunityDetail />} />
                <Route path="communication/dms" element={<AdminDMs />} />
                <Route path="communication/dms/:id" element={<AdminDMDetail />} />
                <Route path="communication/reports" element={<AdminReports />} />
                <Route path="communication/audit" element={<AdminCommAudit />} />
                <Route path="teams" element={<AdminTeamManagement />} />
                <Route path="ai-support" element={<AdminAiSupport />} />
                <Route path="email-center" element={<AdminEmailCenter />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
            </RouteBoundary>
          </Suspense>
        </BrowserRouter>
            <ConnectionBanner />
            <Toaster />
          </ConvexAuthProvider>
        </>
      ) : (
        <BootMessage />
      )}
    </RootErrorBoundary>
  </StrictMode>,
);
