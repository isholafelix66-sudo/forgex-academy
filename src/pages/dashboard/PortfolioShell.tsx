import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  FolderKanban,
  LayoutDashboard,
  Loader2,
  PenSquare,
  Settings,
  User,
} from "lucide-react";
import { AppShell } from "@/components/dash/AppShell";
import type { MobileNavItem, MobileNavSection } from "@/components/site/MobileBottomNav";
import { useBranding } from "@/lib/branding";
import {
  getPortfolioUserToken,
  clearPortfolioUserToken,
  PORTFOLIO_AUTH_PATH,
} from "@/lib/portfolio-user-session";

/**
 * Portfolio CREATOR dashboard shell — /portfolio/dashboard.
 *
 * This is the creator's own workspace: five sections (Overview, My Portfolio,
 * Projects, Profile, Settings) that only ever manage THEIR portfolio. There
 * are no platform-wide admin tools here — the Portfolio admin lives at
 * /adminbrand behind its own credential, and a creator session can never
 * reach it.
 */
export default function PortfolioShell() {
  const branding = useBranding();
  const userToken = getPortfolioUserToken();

  // Signed out? The shell itself sends the visitor to the Portfolio auth
  // screen — it never falls back to Academy authentication.
  useEffect(() => {
    if (!userToken) {
      window.location.replace(PORTFOLIO_AUTH_PATH);
    }
  }, [userToken]);

  const session = useQuery(
    api.portfolioUsers.validateSession,
    userToken ? { token: userToken } : "skip",
  );
  const portfolio = useQuery(
    api.projects.myPortfolio,
    userToken ? { token: userToken } : "skip",
  );
  const ensurePortfolio = useMutation(api.projects.ensureMyPortfolio);
  const [error, setError] = useState<string | null>(null);

  // Create the portfolio on first visit so every section has something to
  // edit. The mutation is idempotent and cannot double-create.
  useEffect(() => {
    if (!userToken) return;
    if (session && portfolio === null) {
      void ensurePortfolio({ token: userToken }).catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "We couldn't prepare your portfolio. Please refresh and try again.",
        );
      });
    }
  }, [userToken, session, portfolio, ensurePortfolio]);

  // Session genuinely invalid/expired → clear the stale token and re-auth.
  useEffect(() => {
    if (userToken && session === null && !error) {
      clearPortfolioUserToken();
      window.location.replace(PORTFOLIO_AUTH_PATH);
    }
  }, [userToken, session, error]);

  const loading =
    !userToken ||
    session === undefined ||
    portfolio === undefined ||
    portfolio === null;

  const sections = [
    {
      label: "Portfolio",
      items: [
        {
          to: "/portfolio/dashboard",
          label: "Overview",
          icon: <LayoutDashboard className="size-4" />,
          end: true,
        },
        {
          to: "/portfolio/dashboard/edit",
          label: "My Portfolio",
          icon: <PenSquare className="size-4" />,
        },
        {
          to: "/portfolio/dashboard/projects",
          label: "Projects",
          icon: <FolderKanban className="size-4" />,
        },
      ],
    },
    {
      label: "Account",
      items: [
        {
          to: "/portfolio/dashboard/profile",
          label: "Profile",
          icon: <User className="size-4" />,
        },
        {
          to: "/portfolio/dashboard/settings",
          label: "Settings",
          icon: <Settings className="size-4" />,
        },
      ],
    },
  ];

  const mobilePrimary: MobileNavItem[] = [
    {
      to: "/portfolio/dashboard",
      label: "Overview",
      icon: <LayoutDashboard className="size-5" />,
      end: true,
    },
    {
      to: "/portfolio/dashboard/edit",
      label: "Edit",
      icon: <PenSquare className="size-5" />,
    },
    {
      to: "/portfolio/dashboard/projects",
      label: "Projects",
      icon: <FolderKanban className="size-5" />,
    },
    {
      to: "/portfolio/dashboard/profile",
      label: "Profile",
      icon: <User className="size-5" />,
    },
  ];

  const mobileMore: MobileNavSection[] = [
    {
      label: "Account",
      items: [
        {
          to: "/portfolio/dashboard/settings",
          label: "Settings",
          icon: <Settings className="size-4" />,
        },
      ],
    },
  ];

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-3xl border border-rose-400/25 bg-card p-8 text-center">
          <h1 className="font-display text-xl font-bold">We hit a snag</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell
      title="Portfolio"
      brand={
        <>
          {branding.wordmark}
          {branding.wordmarkAccent ? (
            <span className="text-lime-400"> {branding.wordmarkAccent}</span>
          ) : null}
        </>
      }
      brandAlt={branding.name}
      profilePath="/portfolio/dashboard/profile"
      showRoleLink={false}
      sections={sections}
      mobilePrimaryItems={mobilePrimary}
      mobileMoreSections={mobileMore}
    />
  );
}
