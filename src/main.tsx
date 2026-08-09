import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { FloatingChat } from "@/components/chat/FloatingChat";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireTutor } from "@/components/RequireRole";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
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

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
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

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
            <button
              onClick={() => this.setState({ hasError: false, message: "", stack: "" })}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
            >
              Retry preview
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

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
    </RootErrorBoundary>
  </StrictMode>,
);
