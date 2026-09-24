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
import { AiSupportAssistant } from "@/components/site/AiSupportAssistant";
import { FeatureGate } from "@/components/site/FeatureGate";
import { ProductEntry } from "@/pages/ComingSoon";
import { ConnectionBanner } from "@/components/network/ConnectionBanner";
import { NameSetupDialog } from "@/components/NameSetupDialog";
/**
 * The AI support assistant belongs to the ACADEMY product only. The public
 * Portfolio website must have no AI branding, so this mount checks the
 * Academy feature flag and renders nothing while Academy is locked.
 */
function AcademyOnlyAssistantMount() {
  const flags = useQuery(api.projects.featureFlags);
  const academyActive =
    flags?.find((f) => f.key === "academy")?.state === "active";
  if (!academyActive) return null;
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
        // Patient retry: on mobile a transient network hiccup (weak signal,
        // radio waking up) fails the first fetch. Retry with growing backoff
        // before considering a reload — a full page reload reads as "the app
        // refreshed itself" and must stay a true last resort.
        for (const delay of [300, 1_200, 3_000]) {
          await new Promise((r) => setTimeout(r, delay));
          try {
            return await loader();
          } catch {
            // keep retrying
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
        // Reload ONLY when the site itself answers — otherwise this was a
        // weak-signal hiccup, not a deploy, and reloading would look like a
        // random page refresh (report: "some page is refreshing").
        if (await siteReachable()) {
          const KEY = "fx_chunk_reload_at";
          const last = Number(sessionStorage.getItem(KEY) ?? 0);
          if (Date.now() - last > 30_000) {
            sessionStorage.setItem(KEY, String(Date.now()));
            window.location.reload();
          }
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
// Projects — the live product
// ---------------------------------------------------------------------------
const Explore = L(() => import("./pages/Explore.tsx"));
const PublicPortfolio = L(() => import("./pages/PublicPortfolio.tsx"));
const PublicProject = L(() => import("./pages/PublicProject.tsx"));
const PortfolioShell = L(() => import("./pages/dashboard/PortfolioShell.tsx"));
const PortfolioOverview = L(() => import("./pages/dashboard/PortfolioOverview.tsx"));
const PortfolioEditor = L(() => import("./pages/dashboard/PortfolioEditor.tsx"));
const PortfolioProjects = L(() => import("./pages/dashboard/PortfolioProjects.tsx"));
const PortfolioMessages = L(() => import("./pages/dashboard/PortfolioMessages.tsx"));
const PortfolioSettings = L(() => import("./pages/dashboard/PortfolioSettings.tsx"));
const PortfolioAccount = L(() => import("./pages/dashboard/PortfolioAccount.tsx"));

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
const TeamRegister = L(() => import("./pages/team/TeamRegister.tsx"));
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
const AdminBrand = L(() => import("./pages/adminbrand/AdminBrand.tsx"));
const Help = L(() => import("./pages/Help.tsx"));
const PortfolioSignIn = L(() => import("./pages/PortfolioSignIn.tsx"));
const PortfolioAuth = L(() => import("./pages/PortfolioAuth.tsx"));
const PortfolioRedirect = L(
  () => import("./pages/PortfolioRedirect.tsx").then((m) => ({ default: m.PortfolioRedirect })),
);
const CreatorProfile = L(
  () => import("./pages/dashboard/CreatorProfile.tsx"),
);
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
const AdminSystemHealth = L(() => import("./pages/admin/AdminSystemHealth.tsx"));
const AdminSync = L(() => import("./pages/admin/AdminSync.tsx"));
const AdminErrors = L(() => import("./pages/admin/AdminErrors.tsx"));
const AdminIncidents = L(() => import("./pages/admin/AdminIncidents.tsx"));
const AdminActivity = L(() => import("./pages/admin/AdminActivity.tsx"));
const AdminAlertsPage = L(() => import("./pages/admin/AdminAlerts.tsx"));

// Projects platform management — now inside the dedicated /admin-brand portal.
const AdminPortalRedirect = L(
  () => import("./pages/PortfolioRedirect.tsx").then((m) => ({ default: m.AdminPortalRedirect })),
);

/**
 * Legacy /adminbrand path → the canonical /admin-brand portal route. The
 * Portfolio admin portal's ONLY authoritative URL is /admin-brand; the old
 * spelling is kept purely as a redirect so stale bookmarks still land in the
 * same (Portfolio-only) place.
 */
function AdminBrandLegacyRedirect() {
  return <Navigate to="/admin-brand" replace />;
}

/** Keep old Portfolio editor bookmarks working after the dashboard move. */
function LegacyPortfolioSectionRedirect() {
  const { section } = useParams<{ section?: string }>();
  return <Navigate to={`/portfolio/dashboard/edit${section ? `/${section}` : ""}`} replace />;
}

function LegacyPortfolioProjectsRedirect() {
  return <Navigate to="/portfolio/dashboard/projects" replace />;
}

function LegacyPortfolioSettingsRedirect() {
  return <Navigate to="/portfolio/dashboard/settings" replace />;
}

function LegacyPortfolioMessagesRedirect() {
  return <Navigate to="/portfolio/dashboard/messages" replace />;
}

function LegacyPortfolioProfileRedirect() {
  return <Navigate to="/portfolio/dashboard/profile" replace />;
}

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
 * suspended tab's dropped WebSocket, a lazy chunk failure…) the app shows a
 * short "reconnecting" screen and re-renders automatically — no error
 * details are ever exposed to the visitor.
 *
 * Recovery rules:
 *  - Network/connection failures (offline, dropped WebSocket, aborted fetch,
 *    chunk load failure) retry FOREVER, and retry IMMEDIATELY when the
 *    browser reports the connection is back or the app is resumed — the
 *    user simply returns to the app and it reconnects on its own.
 *  - Genuine code bugs stop auto-recovering after a few tries and offer a
 *    single reload button. The full error is logged to the console only.
 */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  {
    hasError: boolean;
    attempts: number;
    countdown: number;
    network: boolean;
  }
> {
  state = { hasError: false, attempts: 0, countdown: 0, network: false };
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;

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
    // Mirror into the ForgeX monitoring backend (same groups/incidents as
    // backend errors) — fire-and-forget, never affects recovery.
    try {
      reportClientError({ error: err, module: "web", componentStack: info?.componentStack ?? undefined });
    } catch {
      /* monitoring must never throw */
    }
    this.setState({ network: isNetworkRelatedError(err) });
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
      // Same reachability gate as lazyRetry: never reload into a dead
      // connection — the retry countdown handles those without a refresh.
      void siteReachable().then((ok) => {
        if (!ok || typeof sessionStorage === "undefined") return;
        const KEY = "fx_chunk_reload_at";
        const last = Number(sessionStorage.getItem(KEY) ?? 0);
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
        }
      });
    }
    this.scheduleRecovery();
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
    // Genuine code bugs stop auto-recovering after 3 attempts; network and
    // connection failures retry forever — the connection WILL come back, and
    // we must not strand the user on an error screen when it does.
    if (!this.state.network && this.state.attempts >= 3) return;
    let left = 3;
    this.setState({ countdown: left });
    // Retry the moment the browser says we're back online or the app resumes.
    this.unsubscribe = subscribeToRecoverySignals(() => this.recover());
    this.timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        this.recover();
      } else {
        this.setState({ countdown: left });
      }
    }, 1000);
  }

  private recover() {
    this.clearRecovery();
    this.setState((s) => ({
      hasError: false,
      attempts: s.attempts + 1,
      countdown: 0,
    }));
  }

  private clearRecovery() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  render() {
    if (this.state.hasError) {
      const network = this.state.network;
      const stillRetrying = network || this.state.attempts < 3;
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
              {network
                ? "Reconnecting…"
                : stillRetrying
                  ? "One moment…"
                  : "We hit a snag"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {network
                ? `Your connection dropped — reconnecting automatically in ${this.state.countdown}s. You'll be right back where you were.`
                : stillRetrying
                  ? `Something hiccuped — recovering automatically in ${this.state.countdown}s.`
                  : "A quick reload usually sorts this out. You'll be right back where you were."}
            </p>
            <button
              onClick={() => this.recover()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-lime-400/40 px-4 py-2 text-sm font-semibold text-lime-300 transition-colors hover:bg-lime-400/10"
            >
              <RefreshCw className="size-4" /> Retry now
            </button>
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
 * routes) keeps working. The error is logged + reported to Sentry, never
 * shown to the visitor.
 *
 * Auto-recovery (this is the screen users saw stuck until "Back to home"):
 *  - When the failure is network/connection-related (suspended tab dropped
 *    its WebSocket, query rejected while offline, chunk failed to load…),
 *    the page retries by itself — immediately on `online` / app-resume
 *    events and on a rolling countdown — until it succeeds. The user simply
 *    returns to the app and the SAME route reconnects and re-renders.
 *  - Genuine page bugs auto-retry a few times, then stay on a manual
 *    "Try again" card that retries THIS page (never a redirect home).
 *  - It also auto-resets on the next navigation.
 */
class RouteErrorBoundary extends React.Component<
  { locationKey: string; children: React.ReactNode },
  {
    failed: boolean;
    network: boolean;
    attempts: number;
    retryIn: number;
  }
> {
  state = { failed: false, network: false, attempts: 0, retryIn: 0 };
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;

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
    try {
      reportClientError({ error: err, module: "web", componentStack: info?.componentStack ?? undefined });
    } catch {
      /* monitoring must never throw */
    }
    this.setState({ network: isNetworkRelatedError(err) });
    this.startAutoRecovery();
  }

  componentDidUpdate(
    prevProps: { locationKey: string },
    prevState: { failed: boolean },
  ) {
    // Navigated away — clear the failure so the next page renders fresh.
    if (this.state.failed && this.props.locationKey !== prevProps.locationKey) {
      this.clearAutoRecovery();
      this.setState({ failed: false, retryIn: 0 });
    }
    // A retry failed again — resume auto-recovery for the current page.
    if (this.state.failed && !prevState.failed) {
      this.startAutoRecovery();
    }
  }

  componentWillUnmount() {
    this.clearAutoRecovery();
  }

  private startAutoRecovery() {
    this.clearAutoRecovery();
    // Network/connection failures retry indefinitely; genuine bugs give up
    // after a few attempts and stay on the manual "Try again" card.
    if (!this.state.network && this.state.attempts >= 5) return;
    let left = 4;
    this.setState({ retryIn: left });
    // Retry the instant the browser says we're back online or the app resumes
    // (visibilitychange) — no waiting for the next countdown tick.
    this.unsubscribe = subscribeToRecoverySignals(() => this.retryNow());
    this.timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        this.retryNow();
      } else {
        this.setState({ retryIn: left });
      }
    }, 1000);
  }

  private retryNow() {
    this.clearAutoRecovery();
    // Retry the CURRENT page: clearing `failed` re-renders the same route in
    // place — the URL is never changed and the user is never sent home.
    this.setState((s) => ({
      failed: false,
      attempts: s.attempts + 1,
      retryIn: 0,
    }));
  }

  private clearAutoRecovery() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  render() {
    if (this.state.failed) {
      const network = this.state.network;
      const autoRetrying = network || this.state.attempts < 5;
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-8 text-center">
            <div
              className={cn(
                "mx-auto flex size-12 items-center justify-center rounded-2xl border",
                network
                  ? "border-lime-400/25 bg-lime-400/10"
                  : "border-amber-400/25 bg-amber-400/10",
              )}
            >
              <RefreshCw
                className={cn(
                  "size-6",
                  autoRetrying ? "animate-spin" : "",
                  network ? "text-lime-300" : "text-amber-300",
                )}
              />
            </div>
            <h1 className="font-display mt-4 text-xl font-bold">
              {network
                ? "Reconnecting…"
                : "This page hit a snag"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {network
                ? `Your connection dropped — this page will reconnect automatically in ${this.state.retryIn}s. You'll be right back where you were.`
                : "Something went wrong loading this page — a quick retry usually sorts it out."}
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3">
              <button
                onClick={() => this.retryNow()}
                className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
              >
                <RefreshCw className="size-4" />{" "}
                {network ? "Retry now" : "Try again"}
              </button>
              {/* Escape hatch to the landing page — auto-recovery stays the
                  primary path, but users who want out can always head home. */}
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                Back to home
              </Link>
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

// Monitoring: mirror uncaught window errors / promise rejections into the
// ForgeX monitoring backend. Excludes chunk-load noise (handled by the deploy
// safety nets above) and anything an error boundary already reported — the
// server-side rate limit + client dedupe keep this bounded.
window.addEventListener("error", (event) => {
  const target = event?.target as HTMLImageElement | HTMLScriptElement | null;
  // Resource-load failures (img/script) have a target — report those lightly;
  // JS errors are reported through the boundaries, skip them here.
  if (target && ("src" in target || "href" in target)) return;
  const msg =
    event?.error instanceof Error
      ? event.error.message
      : String(event?.message ?? "");
  if (
    /failed to fetch dynamically imported module|importing a module script|error loading dynamically imported module/i.test(
      msg,
    )
  )
    return;
  reportClientError({ error: event?.error, message: event?.message, module: "web" });
});
window.addEventListener("unhandledrejection", (event) => {
  const reason: unknown = event?.reason;
  const msg = reason instanceof Error ? reason.message : String(reason ?? "");
  if (
    /failed to fetch dynamically imported module|importing a module script|error loading dynamically imported module/i.test(
      msg,
    )
  )
    return;
  reportClientError({ error: reason, message: msg, module: "web" });
});

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
    // Reload only when the site itself answers; offline / flaky-signal
    // failures must recover in place instead of visibly refreshing the page.
    void siteReachable().then((ok) => {
      if (!ok || typeof sessionStorage === "undefined") return;
      const KEY = "fx_chunk_reload_at";
      const last = Number(sessionStorage.getItem(KEY) ?? 0);
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    });
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
    scrollToTopInstant();
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

/**
 * Database-resilience bootstrap: resumes any essential writes queued during
 * a previous session and mounts the global sync-status pill. Renders null.
 */
function SyncBootstrap() {
  useEffect(() => {
    initResilience();
  }, []);
  return <SyncStatusBanner />;
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

// Critical: this component lives inside the Convex provider tree.

/**
 * Catalog self-heal — the Convex cron repairs the seeded catalog every 12h,
 * so a freshly published deploy can still show stale quiz/exam content until
 * it runs. Triggering the same idempotent seed once per browser session makes
 * those repairs (10-question quizzes, 30-question final exams, 40% pass mark,
 * no generic filler) apply as soon as a visitor loads the app. Best-effort:
 * it never surfaces errors into the UI, and the session guard means it runs
 * at most once per tab session.
 */
function CatalogSelfHeal() {
  const updateCatalog = useMutation(api.seed.ensureSeedData);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const KEY = "forgex:catalog-self-heal";
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      // Private-mode / blocked storage — fall through and heal anyway.
    }
    void updateCatalog({}).catch(() => {
      // A failed heal is harmless: the cron retries automatically.
    });
  }, [updateCatalog]);
  return null;
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
        <SyncBootstrap />
        <CatalogSelfHeal />
        <BrowserRouter>
          <RouteSyncer />
          <ScrollToTop />
          <Suspense fallback={null}>
            {/* The AI support assistant is an ACADEMY surface — it is not
                rendered on the public Portfolio website. */}
            <AcademyOnlyAssistantMount />
          </Suspense>
          <Suspense fallback={<RouteLoading />}>
            <RouteBoundary>
            <Routes>
              {/* ── Public: one persistent shell (nav/footer/background) is
                  mounted once as a layout route — navigating between public
                  pages swaps only the page content, so the whole viewport
                  never unmounts/repaints (the old white flash on every
                  desktop navigation). ── */}
              <Route element={<PublicLayout />}>
                {/* ── Projects — the live product ── */}
                <Route path="/" element={<Landing />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />

                {/* ── Locked future products. Their own URLs open a Coming
                    Soon page while locked, and forward to the real product
                    home if an admin flips the flag to active. ── */}
                <Route
                  path="/academy"
                  element={<ProductEntry product="academy" to="/courses" />}
                />
                <Route
                  path="/opportunity-hub"
                  element={<ProductEntry product="opportunity-hub" to="/" />}
                />

                {/* ── Academy stays wired end-to-end behind its flag, so
                    launching it later is a flag change, not a rebuild. ── */}
                <Route
                  path="/courses"
                  element={
                    <FeatureGate product="academy">
                      <Courses />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/courses/:slug"
                  element={
                    <FeatureGate product="academy">
                      <CourseDetail />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/tutors"
                  element={
                    <FeatureGate product="academy">
                      <Tutors />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/tutors/:id"
                  element={
                    <FeatureGate product="academy">
                      <TutorDetail />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/roadmap"
                  element={
                    <FeatureGate product="academy">
                      <RoadmapPage />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/updates"
                  element={
                    <FeatureGate product="academy">
                      <Updates />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/stories"
                  element={
                    <FeatureGate product="academy">
                      <Stories />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/ai-hub"
                  element={
                    <FeatureGate product="academy">
                      <AIHub />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/prompts"
                  element={
                    <FeatureGate product="academy">
                      <PromptLibrary />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/prompts/:slug"
                  element={
                    <FeatureGate product="academy">
                      <PromptDetail />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/become-tutor"
                  element={
                    <FeatureGate product="academy">
                      <BecomeTutor />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/verify/:certificateId"
                  element={
                    <FeatureGate product="academy">
                      <VerifyCertificate />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/tutor/:slug"
                  element={
                    <FeatureGate product="academy">
                      <TutorPage />
                    </FeatureGate>
                  }
                />

                {/* Catch-all 404 also renders inside the public shell. */}
                <Route path="*" element={<NotFound />} />
              </Route>

              {/* Public portfolio website — a standalone personal site
                  (/p/<slug>) with its own minimal chrome, deliberately
                  outside the marketing shell. */}
              <Route path="/p/:slug/project/:projectId" element={<PublicProject />} />
              <Route path="/p/:slug" element={<PublicPortfolio />} />

              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/portfolio" />}
              />

              {/* ── PORTFOLIO CREATOR system — its own auth, dashboard and
                  routes. Signing in here NEVER reaches an Academy dashboard
                  or the Portfolio admin portal. ── */}
              {/* Portfolio help / issue reporting — open to everyone. */}
              <Route path="/help" element={<Help />} />
              <Route path="/portfolio/auth" element={<PortfolioAuth />} />

              {/* Legacy password screen redirects to the creator auth flow. */}
              <Route path="/portfolio/signin" element={<PortfolioSignIn />} />

              <Route path="/portfolio/dashboard" element={<PortfolioShell />}>
                <Route index element={<PortfolioOverview />} />
                <Route path="edit" element={<PortfolioEditor />} />
                <Route path="edit/:section" element={<PortfolioEditor />} />
                <Route path="projects" element={<PortfolioProjects />} />
                <Route path="messages" element={<PortfolioMessages />} />
                <Route path="profile" element={<CreatorProfile />} />
                <Route path="settings" element={<PortfolioSettings />} />
              </Route>

              {/* Back-compat: the old workspace path redirects into the
                  creator dashboard. */}
              <Route path="/portfolio" element={<PortfolioRedirect />} />
              <Route path="/portfolio/edit" element={<LegacyPortfolioSectionRedirect />} />
              <Route path="/portfolio/edit/:section" element={<LegacyPortfolioSectionRedirect />} />
              <Route path="/portfolio/projects" element={<LegacyPortfolioProjectsRedirect />} />
              <Route path="/portfolio/settings" element={<LegacyPortfolioSettingsRedirect />} />
              <Route path="/portfolio/messages" element={<LegacyPortfolioMessagesRedirect />} />
              <Route path="/portfolio/profile" element={<LegacyPortfolioProfileRedirect />} />

              {/* Course player (signed in) — Academy, locked by default. */}
              <Route
                path="/learn/:slug"
                element={
                  <FeatureGate product="academy" redirectAuthenticatedTo="/portfolio">
                    <RequireAuth>
                      <Learn />
                    </RequireAuth>
                  </FeatureGate>
                }
              />

              {/* Student dashboard — Academy, locked by default. */}
              <Route
                path="/dashboard"
                element={
                  <FeatureGate product="academy" redirectAuthenticatedTo="/portfolio">
                    <RequireAuth>
                      <DashboardShell />
                    </RequireAuth>
                  </FeatureGate>
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
                  (password gate, no account) can preview it read-only.
                  Academy product, so it is gated like the rest of it. */}
              <Route
                path="/tutor"
                element={
                  <FeatureGate product="academy" redirectAuthenticatedTo="/portfolio">
                    <RequireTutor>
                      <TutorShell />
                    </RequireTutor>
                  </FeatureGate>
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

              {/* Public tutor mini-website — the shareable /tutor/<slug> page
                  is registered inside the persistent public shell above.
                  Static routes under /tutor (courses, grading, …) win over
                  this dynamic segment, so the dashboard keeps working. */}

              {/* Team Hub — workspace password access */}
              <Route path="/team" element={<TeamHub />} />
              <Route path="/team/register" element={<TeamRegister />} />
              <Route path="/team/access/:teamSlug" element={<TeamPassword />} />              <Route path="/team/:teamSlug" element={<RequireTeamAuth><TeamDashboardShell /></RequireTeamAuth>}>
                <Route index element={<AcademicOverview />} />
                <Route path="settings" element={<TeamSettings />} />
              </Route>


{/* ── ForgeX Network Portfolio — its OWN portal and sign-in.
                    Completely separate from the Academy admin dashboard
                    above: /admin-brand has its own credential, session,
                    content store and SMTP configuration. An Academy admin
                    session grants no access here, and vice versa. The
                    canonical URL is /admin-brand; /adminbrand only exists
                    as a redirect for legacy bookmarks. ── */}
              <Route path="/admin-brand" element={<AdminBrand />} />
              <Route path="/adminbrand" element={<AdminBrandLegacyRedirect />} />
              <Route path="/portfolio/signin" element={<PortfolioSignIn />} />

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
                <Route path="sync" element={<AdminSync />} />
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

                {/* ForgeX Projects management */}
                {/* Portfolio management moved to /admin-brand (separate
                    portal, guarded only by the Portfolio admin credential).
                    These Academy-admin routes redirect there so no stale
                    link can bypass the Portfolio's own credential gate. */}
                <Route path="portfolios" element={<AdminPortalRedirect />} />
                <Route path="projects" element={<AdminPortalRedirect />} />
                <Route path="waitlist" element={<AdminPortalRedirect />} />

                {/* System Health & monitoring */}
                <Route path="system" element={<AdminSystemHealth />} />
                <Route path="system/errors" element={<AdminErrors />} />
                <Route path="system/incidents" element={<AdminIncidents />} />
                <Route path="system/activity" element={<AdminActivity />} />
                <Route path="system/alerts" element={<AdminAlertsPage />} />
              </Route>
            </Routes>
            </RouteBoundary>
          </Suspense>
          {/* First-time profile name setup — global, driven by the profile
              record so it survives refreshes and never reappears once a name
              has been saved. */}
          <NameSetupDialog />
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
