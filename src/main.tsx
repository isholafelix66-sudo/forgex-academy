import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { FloatingChat } from "@/components/chat/FloatingChat";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireTutor } from "@/components/RequireRole";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// ---------------------------------------------------------------------------
// Public pages
// ---------------------------------------------------------------------------
const Landing = lazy(() => import("./pages/Landing.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const Courses = lazy(() => import("./pages/Courses.tsx"));
const CourseDetail = lazy(() => import("./pages/CourseDetail.tsx"));
const Tutors = lazy(() => import("./pages/Tutors.tsx"));
const TutorDetail = lazy(() => import("./pages/TutorDetail.tsx"));
const RoadmapPage = lazy(() => import("./pages/RoadmapPage.tsx"));
const Updates = lazy(() => import("./pages/Updates.tsx"));
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
const AdminCertificates = lazy(() => import("./pages/admin/AdminCertificates.tsx"));
const AdminContent = lazy(() => import("./pages/admin/AdminContent.tsx"));
const AdminMedia = lazy(() => import("./pages/admin/AdminMedia.tsx"));
const AdminFormBuilder = lazy(() => import("./pages/admin/AdminFormBuilder.tsx"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit.tsx"));
const AdminProfile = lazy(() => import("./pages/admin/AdminProfile.tsx"));
const AdminChat = lazy(() => import("./pages/admin/AdminChat.tsx"));
const AdminInbox = lazy(() => import("./pages/admin/AdminInbox.tsx"));
const AdminCoursePreview = lazy(() => import("./pages/admin/AdminCoursePreview.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
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

// Create the Convex client only when a deployment URL is actually available.
// If it's missing (or the client fails to construct) the app still renders a
// friendly "warming up" screen instead of crashing to a blank page.
const convexUrl = (import.meta.env.VITE_CONVEX_URL as string | undefined)?.trim();
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      {convex ? (
        <>
          <ToolbarErrorBoundary>
            <VlyToolbar />
          </ToolbarErrorBoundary>
          <ConvexAuthProvider client={convex}>
        {/* WhatsApp-style floating chat — global, signed-in users only */}
        <FloatingChat />
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
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
                <Route path="certificates" element={<AdminCertificates />} />
                <Route path="content" element={<AdminContent />} />
                <Route path="media" element={<AdminMedia />} />
                <Route path="form-builder" element={<AdminFormBuilder />} />
                <Route path="audit" element={<AdminAudit />} />
                <Route path="profile" element={<AdminProfile />} />
                <Route path="inbox" element={<AdminInbox />} />
                <Route path="chat" element={<AdminChat />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
            <Toaster />
          </ConvexAuthProvider>
        </>
      ) : (
        <BootMessage />
      )}
    </RootErrorBoundary>
  </StrictMode>,
);
