import { useEffect } from "react";
import { Navigate } from "react-router";
import { getPortfolioUserToken } from "@/lib/portfolio-user-session";
import { Loader2 } from "lucide-react";

/**
 * /portfolio → /portfolio/dashboard.
 *
 * The old workspace path now lives entirely under /portfolio/dashboard; the
 * bare path bounces signed-in creators to their dashboard and everyone else
 * to the Portfolio auth screen. It never opens an Academy route.
 */
export function PortfolioRedirect() {
  const token = getPortfolioUserToken();
  if (!token) return <Navigate to="/portfolio/auth" replace />;
  return <Navigate to="/portfolio/dashboard" replace />;
}

/** Full-screen redirect splash while the effect runs (used by sign-in legacy). */
export function Redirecting({ to }: { to: string }) {
  useEffect(() => {
    // Handled by <Navigate /> in the caller; kept for symmetry.
  }, []);
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <span className="sr-only">Redirecting to {to}</span>
    </div>
  );
}

/**
 * Old Academy-admin portfolio routes → the Portfolio admin portal.
 * Portfolio management is NOT part of the Academy admin dashboard, so these
 * paths now send people to /adminbrand where the Portfolio credential gate
 * decides who gets in.
 */
export function AdminPortalRedirect() {
  return <Navigate to="/adminbrand" replace />;
}
