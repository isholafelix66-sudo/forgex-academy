import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useAuth } from "@/hooks/use-auth";
import { ComingSoon } from "@/pages/ComingSoon";
import type { ProductKey } from "@/lib/features";

/**
 * Locks a whole product behind its feature flag.
 *
 * A route wrapped in <FeatureGate product="academy"> renders its real page only
 * while that product's flag is `active`. Locked or hidden products render the
 * Coming Soon page instead — so /academy, /courses, /dashboard, /tutor … never
 * leak the (fully intact) product to normal users, and launching it later is a
 * flag change rather than a rebuild.
 *
 * The password-gated admin session passes through so the team can still review
 * the underlying product while it's locked.
 */
export function FeatureGate({
  product,
  children,
  redirectAuthenticatedTo,
}: {
  product: ProductKey;
  children: ReactNode;
  /**
   * When set, a signed-in user who lands on this locked product's route is
   * sent to their live workspace instead of the Coming Soon page — e.g. a
   * student typing /dashboard belongs in their portfolio, not on a marketing
   * page. Signed-out visitors still get Coming Soon.
   */
  redirectAuthenticatedTo?: string;
}) {
  const flags = useQuery(api.projects.featureFlags);
  const { isAdmin } = useAdminSession();
  const { isAuthenticated } = useAuth();

  if (isAdmin) return <>{children}</>;

  if (flags === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const flag = flags.find((f) => f.key === product);
  const state = flag?.state ?? (product === "projects" ? "active" : "locked");
  if (state === "active") return <>{children}</>;

  if (redirectAuthenticatedTo && isAuthenticated) {
    return <Navigate to={redirectAuthenticatedTo} replace />;
  }

  return <ComingSoon product={product} />;
}
