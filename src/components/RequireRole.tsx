import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { Loader2, ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export type TutorAccessState =
  | { kind: "loading" }
  | { kind: "render" }
  | { kind: "redirect-admin" }
  | { kind: "redirect-auth" }
  | { kind: "pending-verification" }
  | { kind: "under-review" }
  | { kind: "no-access" };

export type TutorAccessInput = {
  authLoading: boolean;
  adminLoading: boolean;
  isAdmin: boolean;
  token: string | null;
  isAuthenticated: boolean;
  role?: string | null;
  verified?: boolean | null;
  applicationStatus?: string | null;
};

/**
 * Pure decision logic for the tutor-dashboard guard.
 *
 * Order matters — the two regressions this ordering prevents:
 *  1. While the admin-session query is still loading (`adminLoading`),
 *     `isAdmin` is false; deciding anything before it settles bounced the
 *     password-gated admin preview (no account) to the student sign-in page.
 *  2. A stale/expired admin token must NOT trump a valid authenticated
 *     tutor/admin account — a verified tutor who once opened the admin
 *     preview keeps a token in sessionStorage, and it should not boot them
 *     to the admin gate when they visit their own dashboard.
 */
export function resolveTutorAccess(input: TutorAccessInput): TutorAccessState {
  if (input.authLoading || input.adminLoading) return { kind: "loading" };

  // A valid admin session (password gate, no user account) can preview the
  // tutor dashboard read-only.
  if (input.isAdmin) return { kind: "render" };

  // An authenticated verified tutor or admin user renders regardless of any
  // stale admin token they may be carrying.
  const isTutor = input.role === "tutor" && !!input.verified;
  const isAdminUser = input.role === "admin";
  if (input.isAuthenticated && (isTutor || isAdminUser)) {
    return { kind: "render" };
  }

  // A stored admin token that failed validation (expired/locked) belongs at
  // the admin gate — never at the student sign-in page.
  if (input.token) return { kind: "redirect-admin" };

  if (!input.isAuthenticated) return { kind: "redirect-auth" };

  if (input.role === "tutor" && !input.verified) {
    return { kind: "pending-verification" };
  }

  if (
    input.applicationStatus === "submitted" ||
    input.applicationStatus === "under-review"
  ) {
    return { kind: "under-review" };
  }

  return { kind: "no-access" };
}

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

  const state = resolveTutorAccess({
    authLoading: isLoading,
    adminLoading,
    isAdmin,
    token,
    isAuthenticated,
    role: user?.role,
    verified: user?.verified,
    applicationStatus: application?.status,
  });

  switch (state.kind) {
    case "loading":
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      );
    case "render":
      return children;
    case "redirect-admin":
      return <Navigate to="/admin" replace />;
    case "redirect-auth": {
      const returnTo = `${location.pathname}${location.search}`;
      return (
        <Navigate
          to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
          replace
        />
      );
    }
    case "pending-verification":
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
    case "under-review":
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
    case "no-access":
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
