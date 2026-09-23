import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Briefcase,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Link2,
  Loader2,
  PenSquare,
  Settings,
  Sparkles,
  User,
  UserCog,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/dash/AppShell";
import type { MobileNavItem, MobileNavSection } from "@/components/site/MobileBottomNav";
import { useBranding } from "@/lib/branding";

/**
 * Portfolio dashboard shell.
 *
 * The sidebar is about ONE thing: the owner's portfolio. There are no Academy
 * courses, assignments, certificates, student community or AI career coach
 * here — Academy is a locked product and lives behind its own flag.
 */
export default function PortfolioShell() {
  const branding = useBranding();
  const portfolio = useQuery(api.projects.myPortfolio);
  const ensurePortfolio = useMutation(api.projects.ensureMyPortfolio);
  const [error, setError] = useState<string | null>(null);

  // Create the portfolio on first visit so every section has something to
  // edit. The mutation is idempotent and cannot double-create.
  useEffect(() => {
    if (portfolio === null) {
      void ensurePortfolio({}).catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "We couldn't prepare your portfolio. Please refresh and try again.",
        );
      });
    }
  }, [portfolio, ensurePortfolio]);

  const loading = portfolio === undefined || portfolio === null;

  const sections = [
    {
      label: "Portfolio",
      items: [
        {
          to: "/portfolio",
          label: "Overview",
          icon: <LayoutDashboard className="size-4" />,
          end: true,
        },
        {
          to: "/portfolio/edit",
          label: "My Portfolio",
          icon: <PenSquare className="size-4" />,
        },
        {
          to: "/portfolio/projects",
          label: "Projects",
          icon: <FolderKanban className="size-4" />,
        },
      ],
    },
    {
      label: "Profile",
      items: [
        {
          to: "/portfolio/edit/about",
          label: "About Me",
          icon: <User className="size-4" />,
        },
        {
          to: "/portfolio/edit/skills",
          label: "Skills",
          icon: <Sparkles className="size-4" />,
        },
        {
          to: "/portfolio/edit/experience",
          label: "Experience",
          icon: <Briefcase className="size-4" />,
        },
        {
          to: "/portfolio/edit/education",
          label: "Education",
          icon: <GraduationCap className="size-4" />,
        },
        {
          to: "/portfolio/edit/services",
          label: "Services",
          icon: <Wrench className="size-4" />,
        },
        {
          to: "/portfolio/edit/links",
          label: "Social Links",
          icon: <Link2 className="size-4" />,
        },
      ],
    },
    {
      label: "Account",
      items: [
        {
          to: "/portfolio/settings",
          label: "Portfolio Settings",
          icon: <Settings className="size-4" />,
        },
        {
          to: "/portfolio/account",
          label: "Account",
          icon: <UserCog className="size-4" />,
        },
      ],
    },
  ];

  const mobilePrimary: MobileNavItem[] = [
    {
      to: "/portfolio",
      label: "Overview",
      icon: <LayoutDashboard className="size-5" />,
      end: true,
    },
    {
      to: "/portfolio/edit",
      label: "Edit",
      icon: <PenSquare className="size-5" />,
    },
    {
      to: "/portfolio/projects",
      label: "Projects",
      icon: <FolderKanban className="size-5" />,
    },
    {
      to: "/portfolio/account",
      label: "Account",
      icon: <User className="size-5" />,
    },
  ];

  const mobileMore: MobileNavSection[] = [
    {
      label: "Profile",
      items: [
        {
          to: "/portfolio/edit/about",
          label: "About Me",
          icon: <User className="size-4" />,
        },
        {
          to: "/portfolio/edit/skills",
          label: "Skills",
          icon: <Sparkles className="size-4" />,
        },
        {
          to: "/portfolio/edit/experience",
          label: "Experience",
          icon: <Briefcase className="size-4" />,
        },
        {
          to: "/portfolio/edit/education",
          label: "Education",
          icon: <GraduationCap className="size-4" />,
        },
        {
          to: "/portfolio/edit/services",
          label: "Services",
          icon: <Wrench className="size-4" />,
        },
        {
          to: "/portfolio/edit/links",
          label: "Social Links",
          icon: <Link2 className="size-4" />,
        },
      ],
    },
    {
      label: "Settings",
      items: [
        {
          to: "/portfolio/settings",
          label: "Portfolio Settings",
          icon: <Settings className="size-4" />,
        },
        {
          to: "/portfolio/account",
          label: "Account",
          icon: <UserCog className="size-4" />,
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
      profilePath="/portfolio/account"
      showRoleLink={false}
      sections={sections}
      mobilePrimaryItems={mobilePrimary}
      mobileMoreSections={mobileMore}
    />
  );
}
