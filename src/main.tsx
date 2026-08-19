import '@vly-ai/integrations';
import "./lib/sentry"; // Sentry init — must load before anything else can throw
import { useAuth } from "@/hooks/use-auth";
import { captureException, setSentryUser } from "@/lib/sentry";
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireTutor } from "@/components/RequireRole";
import { RequireTeam } from "@/components/RequireTeam";
import { RequireTeamAuth } from "@/components/RequireTeamAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense, useState } from "react";
import { RefreshCw } from "lucide-react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";
import { attachRoutePrefetch } from "@/lib/prefetch";
import { registerServiceWorker } from "@/lib/sw";

// ---------------------------------------------------------------------------
// Public pages
// ---------------------------------------------------------------------------
const LazyFloatingChat = lazy(() =>
  import("@/components/chat/FloatingChat").then((m) => ({
    default: m.FloatingChat,
  })),
);

const Landing = lazy(() => import("./pages/Landing.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const Courses = lazy(() => import("./pages/Courses.tsx"));
const CourseDetail = lazy(() => import("./pages/CourseDetail.tsx"));
const Tutors = lazy(() => import("./pages/Tutors.tsx"));
const TutorDetail = lazy(() => import("./pages/TutorDetail.tsx"));
const RoadmapPage = lazy(() => import("./pages/RoadmapPage.tsx"));
const Updates = lazy(() => import("./pages/Updates.tsx"));
const Stories = lazy(() => import("./pages/Stories.tsx"));
const AIHub = lazy(() => import("./pages/AIHub.tsx"));
const PromptLibrary = lazy(() => import("./pages/PromptLibrary.tsx"));
const PromptDetail = lazy(() => import("./pages/PromptDetail.tsx"));
const Contact = lazy(() => import("./pages/Contact.tsx"));
const VerifyCertificate = lazy(() => import("./pages/VerifyCertificate.tsx"));
const BecomeTutor = lazy(() => import("./pages/BecomeTutor.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// ---------------------------------------------------------------------------
// Learning + student dashboard
// ---------------------------------------------------------------------------
const Learn = lazy(() => import("./pages/Learn.tsx"));
const DashboardShell = lazy(() => import("./pages/dashboard/DashboardShell.tsx"));
const DashboardHome = lazy(() => import("./pages/dashboard/DashboardHome.tsx"));
const MyCourses = lazy(() => import("./pages/dashboard/MyCourses.tsx"));
const RoadmapProgress = lazy(() => import("./pages/dashboard/RoadmapProgress.tsx"));
const Assignments = lazy(() => import("./pages/dashboard/Assignments.tsx"));
const Certificates = lazy(() => import("./pages/dashboard/Certificates.tsx"));
const Messages = lazy(() => import("./pages/dashboard/Messages.tsx"));
const Notifications = lazy(() => import("./pages/dashboard/Notifications.tsx"));
const Profile = lazy(() => import("./pages/dashboard/Profile.tsx"));
const Settings = lazy(() => import("./pages/dashboard/Settings.tsx"));

// Communication & Community module (student side)
const Communities = lazy(() => import("./pages/dashboard/Communities.tsx"));
const CommunityRoom = lazy(() => import("./pages/dashboard/CommunityRoom.tsx"));
const Discover = lazy(() => import("./pages/dashboard/Discover.tsx"));
const Connections = lazy(() => import("./pages/dashboard/Connections.tsx"));
const StudentDMs = lazy(() => import("./pages/dashboard/StudentDMs.tsx"));
const StudentDMThread = lazy(() => import("./pages/dashboard/StudentDMThread.tsx"));

// ---------------------------------------------------------------------------
// Tutor dashboard
// ---------------------------------------------------------------------------
const TutorShell = lazy(() => import("./pages/tutor/TutorShell.tsx"));
const TutorOverview = lazy(() => import("./pages/tutor/TutorOverview.tsx"));
const TutorCourses = lazy(() => import("./pages/tutor/TutorCourses.tsx"));
const CourseEditor = lazy(() => import("./pages/tutor/CourseEditor.tsx"));
const TutorGrading = lazy(() => import("./pages/tutor/TutorGrading.tsx"));
const TutorStudents = lazy(() => import("./pages/tutor/TutorStudents.tsx"));
const TutorInbox = lazy(() => import("./pages/tutor/TutorInbox.tsx"));
const TutorAnnouncements = lazy(() => import("./pages/tutor/TutorAnnouncements.tsx"));
const TutorSupport = lazy(() => import("./pages/tutor/TutorSupport.tsx"));
const TutorCommunities = lazy(() => import("./pages/tutor/TutorCommunities.tsx"));
const TutorCommunityManage = lazy(() => import("./pages/tutor/TutorCommunityManage.tsx"));
const TutorProfile = lazy(() => import("./pages/tutor/TutorProfile.tsx"));
const TutorSettings = lazy(() => import("./pages/tutor/TutorSettings.tsx"));

// Public tutor mini-website (shareable /tutor/<slug> page)
const TutorPage = lazy(() => import("./pages/TutorPage.tsx"));

// ---------------------------------------------------------------------------
// Team Workspace
// ---------------------------------------------------------------------------
const TeamEntry = lazy(() => import("./pages/team/TeamEntry.tsx"));
const TeamRegister = lazy(() => import("./pages/team/TeamRegister.tsx"));
const TeamLogin = lazy(() => import("./pages/team/TeamLogin.tsx"));
const TeamShell = lazy(() => import("./pages/team/TeamShell.tsx"));
const TeamOverview = lazy(() => import("./pages/team/TeamOverview.tsx"));
const TeamWork = lazy(() => import("./pages/team/TeamWork.tsx"));
const TeamCourses = lazy(() => import("./pages/team/TeamCourses.tsx"));
const TeamReviews = lazy(() => import("./pages/team/TeamReviews.tsx"));
const TeamActivity = lazy(() => import("./pages/team/TeamActivity.tsx"));
const TeamMembers = lazy(() => import("./pages/team/TeamMembers.tsx"));
const TeamProfile = lazy(() => import("./pages/team/TeamProfile.tsx"));
const TeamSettings = lazy(() => import("./pages/team/TeamSettings.tsx"));
const TeamTutors = lazy(() => import("./pages/team/TeamTutors.tsx"));
const TeamAITools = lazy(() => import("./pages/team/TeamAITools.tsx"));
const TeamPrompts = lazy(() => import("./pages/team/TeamPrompts.tsx"));
const TeamContentSubmissions = lazy(() => import("./pages/team/TeamContentSubmissions.tsx"));
const TeamTestimonials = lazy(() => import("./pages/team/TeamTestimonials.tsx"));
const TeamSupportCases = lazy(() => import("./pages/team/TeamSupportCases.tsx"));
const TeamTutorProfiles = lazy(() => import("./pages/team/TeamTutorProfiles.tsx"));
const TeamForgotPassword = lazy(() => import("./pages/team/TeamForgotPassword.tsx"));

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------
const AdminShell = lazy(() => import("./pages/admin/AdminShell.tsx"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview.tsx"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.tsx"));
const AdminApplications = lazy(() => import("./pages/admin/AdminApplications.tsx"));
const AdminCourses = lazy(() => import("./pages/admin/AdminCourses.tsx"));
const AdminCatalog = lazy(() => import("./pages/admin/AdminCatalog.tsx"));
const AdminUpdates = lazy(() => import("./pages/admin/AdminUpdates.tsx"));
const AdminStories = lazy(() => import("./pages/admin/AdminStories.tsx"));
const AdminAIHub = lazy(() => import("./pages/admin/AdminAIHub.tsx"));
const AdminPrompts = lazy(() => import("./pages/admin/AdminPrompts.tsx"));
const AdminCertificates = lazy(() => import("./pages/admin/AdminCertificates.tsx"));
const AdminContent = lazy(() => import("./pages/admin/AdminContent.tsx"));
const AdminMedia = lazy(() => import("./pages/admin/AdminMedia.tsx"));
const AdminFormBuilder = lazy(() => import("./pages/admin/AdminFormBuilder.tsx"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit.tsx"));
const AdminProfile = lazy(() => import("./pages/admin/AdminProfile.tsx"));
const AdminChat = lazy(() => import("./pages/admin/AdminChat.tsx"));
const AdminInbox = lazy(() => import("./pages/admin/AdminInbox.tsx"));
const AdminCoursePreview = lazy(() => import("./pages/admin/AdminCoursePreview.tsx"));
const AdminTeamManagement = lazy(() => import("./pages/admin/AdminTeamManagement.tsx"));

// Communication & Community module (admin moderation)
const AdminCommunication = lazy(() => import("./pages/admin/AdminCommunication.tsx"));
const AdminCommunityDetail = lazy(() => import("./pages/admin/AdminCommunityDetail.tsx"));
const AdminDMs = lazy(() => import("./pages/admin/AdminDMs.tsx"));
const AdminDMDetail = lazy(() => import("./pages/admin/AdminDMDetail.tsx"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports.tsx"));
const AdminCommAudit = lazy(() => import("./pages/admin/AdminCommAudit.tsx"));

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
    <div className="fixed bottom-20 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-lime-400/25 bg-black/90 px-4 py-1.5 text-xs font-medium text-lime-300 shadow-lg shadow-black/40 backdrop-blur">
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
          <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string}>
            <ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
        <SentryUserSync />
        {/* WhatsApp-style floating chat — global, signed-in users only.
            Lazy-loaded so it (and its data queries) never block first paint
            or initial bundle for visitors. Rendered inside the router so it
            can hide itself on screens that have their own composer. */}
        <OfflineBadge />
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={null}>
            <LazyFloatingChat />
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

              {/* Team Workspace — internal entry point */}
              <Route path="/team" element={<TeamEntry />} />
              <Route path="/team/register" element={<TeamRegister />} />
              <Route path="/team/login" element={<TeamLogin />} />
              <Route path="/team/forgot-password" element={<TeamForgotPassword />} />
              <Route path="/team/:teamSlug" element={<RequireTeamAuth><TeamShell /></RequireTeamAuth>}>
                <Route index element={<TeamOverview />} />
                <Route path="work" element={<TeamWork />} />
                <Route path="courses" element={<TeamCourses />} />
                <Route path="reviews" element={<TeamReviews />} />
                <Route path="activity" element={<TeamActivity />} />
                <Route path="members" element={<TeamMembers />} />
                <Route path="profile" element={<TeamProfile />} />
                <Route path="settings" element={<TeamSettings />} />
                {/* Academic Team */}
                <Route path="tutors" element={<TeamTutors />} />
                {/* Content Team */}
                <Route path="submissions" element={<TeamContentSubmissions />} />
                <Route path="testimonials" element={<TeamTestimonials />} />
                {/* AI Team */}
                <Route path="ai-tools" element={<TeamAITools />} />
                <Route path="prompts" element={<TeamPrompts />} />
                {/* Student Experience + Tutor Support */}
                <Route path="support" element={<TeamSupportCases />} />
                <Route path="cases" element={<TeamSupportCases />} />
                <Route path="feedback" element={<TeamTestimonials />} />
                <Route path="escalations" element={<TeamSupportCases />} />
                <Route path="tutor-profiles" element={<TeamTutorProfiles />} />
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
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
            </RouteBoundary>
          </Suspense>
        </BrowserRouter>
            <Toaster />
          </ConvexProviderWithClerk>
          </ClerkProvider>
        </>
      ) : (
        <BootMessage />
      )}
    </RootErrorBoundary>
  </StrictMode>,
);
