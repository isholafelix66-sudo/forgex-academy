import { useEffect, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar } from "@/components/site/Avatar";
import { MobileBottomNav } from "@/components/site/MobileBottomNav";
import type { MobileNavItem, MobileNavSection } from "@/components/site/MobileBottomNav";
import logo from "@/assets/logo.svg";

export type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  badge?: ReactNode;
};

export type NavSection = {
  label?: string;
  items: NavItem[];
};

export function AppShell({
  sections,
  footer,
  title,
  banner,
  mobilePrimaryItems,
  mobileMoreSections,
}: {
  sections: NavSection[];
  footer?: NavItem[];
  title: string;
  /** Optional full-width strip rendered above the header (e.g. admin preview). */
  banner?: ReactNode;
  mobilePrimaryItems?: MobileNavItem[];
  mobileMoreSections?: MobileNavSection[];
}) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminSession();
  const siteContent = useQuery(api.public.siteContentAll);
  const navigate = useNavigate();
  const location = useLocation();

  // Password-gated admin sessions have no user account — fall back to the
  // admin profile stored in site content so the header never says "Guest".
  const adminProfile = (siteContent?.adminProfile ?? {}) as {
    name?: string;
    title?: string;
    image?: string;
  };
  const hasAccount = !!user;
  const identityName = user?.name ?? (isAdmin ? adminProfile.name || "Administrator" : "Guest");
  const identityImage = user?.image ?? (isAdmin ? adminProfile.image : undefined);
  const identityRole = user?.role ?? (isAdmin ? adminProfile.title || "admin" : "guest");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // The admin dashboard is password-gated and reachable ONLY by visiting
  // /admin directly — it must never appear as a button to students, tutors
  // or even signed-in admins. Verified tutors get a link to their dashboard.
  const roleLink =
    user?.role === "tutor" && user.verified
      ? { to: "/tutor", label: "Tutor dashboard" }
      : null;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/8 px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="ForgeX Academy" className="size-8 rounded-lg" />
          <span className="font-display text-base font-bold">
            ForgeX<span className="text-lime-400"> Academy</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {sections.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-lime-400/12 text-lime-300"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                    )
                  }
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
        {roleLink && (
          <Link
            to={roleLink.to}
            className="flex items-center gap-3 rounded-xl border border-lime-400/25 bg-lime-400/8 px-3 py-2.5 text-sm font-medium text-lime-300 transition-colors hover:bg-lime-400/15"
          >
            <span className="flex size-5 items-center justify-center rounded-md bg-lime-400/15 text-[10px] font-bold">
              T
            </span>
            {roleLink.label}
          </Link>
        )}
        {footer?.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-lime-400/12 text-lime-300"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )
            }
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/8 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={identityName} image={identityImage} className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{identityName}</p>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {identityRole}
            </p>
          </div>
          {hasAccount && (
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
              <LogOut className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full overflow-x-clip bg-background">
      {/* Desktop sidebar — visible from md so tablets (768–1023px) always
          have navigation once the mobile bottom nav is hidden. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/8 bg-sidebar md:block">
        {sidebar}
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        {banner}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/8 bg-background/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="font-display min-w-0 truncate text-lg font-bold">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {/* roleLink intentionally NOT duplicated in the header — the
                sidebar (≥768px) is the single source for dashboard links, so
                desktop never shows the same Dashboard link twice. */}
            {hasAccount ? (
              <Link to="/dashboard/profile">
                <Avatar name={identityName} image={identityImage} className="size-9" />
              </Link>
            ) : (
              <Avatar name={identityName} image={identityImage} className="size-9" />
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 md:px-8 md:pb-6 pb-24 overflow-x-clip">
          <div className="mx-auto min-w-0 max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      {mobilePrimaryItems && mobileMoreSections && (
        <MobileBottomNav primaryItems={mobilePrimaryItems} moreSections={mobileMoreSections} />
      )}
    </div>
  );
}
