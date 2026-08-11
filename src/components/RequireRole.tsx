import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { Loader2, ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

function GateScreen({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-8 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-lime-400/12 text-lime-300">
          {icon}
        </span>
        <h1 className="font-display mt-5 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        {children && <div className="mt-6 flex justify-center gap-3">{children}</div>}
      </div>
    </div>
  );
}

export function RequireTutor({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { token, isAdmin, loading: adminLoading } = useAdminSession();
  const application = useQuery(
    api.users.myTutorApplication,
    isAuthenticated ? {} : "skip",
  );
  const location = useLocation();

  // Wait for BOTH the auth state and the admin-session check to settle
  // before deciding anything. Otherwise the password-gated admin preview
  // (no user account) is redirected to /auth while isAdminUnlocked is still
  // loading, making the preview appear to bounce/reload.
  if (isLoading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // A valid admin session (password gate, no user account) can preview the
  // tutor dashboard read-only — the admin needs no registration to view it.
  if (isAdmin) return children;

  // A stored admin token that failed validation (expired/locked) belongs at
  // the admin gate — never at the student sign-in page.
  if (token) {
    return <Navigate to="/admin" replace />;
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  const isTutor = user?.role === "tutor" && !!user.verified;
  const isAdminUser = user?.role === "admin";

  if (isTutor || isAdminUser) return children;

  if (user?.role === "tutor" && !user.verified) {
    return (
      <GateScreen
        icon={<Clock className="size-7" />}
        title="Tutor verification pending"
        body="Your tutor account is still under review — most decisions are made within 24 hours or less. The Tutor Dashboard unlocks as soon as an admin verifies you, and we'll email you the decision."
      >
        <Link to="/dashboard">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </GateScreen>
    );
  }

  if (
    application?.status === "submitted" ||
    application?.status === "under-review"
  ) {
    return (
      <GateScreen
        icon={<Clock className="size-7" />}
        title="Application under review"
        body="Your application is under review — check back within the next 24 hours or less. An admin will verify your account, and we'll email you the moment a decision is made. The Tutor Dashboard unlocks automatically once verified."
      >
        <Link to="/dashboard">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </GateScreen>
    );
  }

  return (
    <GateScreen
      icon={<ShieldCheck className="size-7" />}
      title="Tutor access required"
      body="This area is for verified tutors. Apply to teach — applications are reviewed by our admin team."
    >
      <Link to="/become-tutor">
        <Button className="bg-lime-400 font-semibold text-black hover:bg-lime-300">
          Apply to teach
        </Button>
      </Link>
      <Link to="/dashboard">
        <Button variant="outline">Student dashboard</Button>
      </Link>
    </GateScreen>
  );
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user?.role === "admin") return children;

  return (
    <GateScreen
      icon={<ShieldAlert className="size-7" />}
      title="Administrator access required"
      body="You don't have permission to view the Admin Dashboard. If you're the first user of this Academy, claim administrator access from your profile."
    >
      <Link to="/dashboard">
        <Button variant="outline">Back to dashboard</Button>
      </Link>
    </GateScreen>
  );
}
