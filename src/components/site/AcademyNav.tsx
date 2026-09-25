import { useNavigate, useLocation, Link, NavLink } from "react-router";
import {
  BookOpen,
  Home,
  LayoutDashboard,
  Map as MapIcon,
  PenSquare,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileBottomNav, type MobileNavItem } from "./MobileBottomNav";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { scrollToTopInstant } from "@/lib/scroll";
import logo from "@/assets/logo.svg";

/* ---------------------------------------------------------------------------
   ForgeX Academy header + bottom navigation.

   Academy-only chrome. It is rendered for Academy routes (including the root
   "/" homepage) and never contains Portfolio navigation, a product switcher,
   or Portfolio notifications — the two products stay visually and logically
   separate.
   --------------------------------------------------------------------------- */

type NavItemDef = { to: string; label: string; end?: boolean };

const ACADEMY_NAV: NavItemDef[] = [
  { to: "/academy", label: "Home", end: true },
  { to: "/academy/courses", label: "Courses" },
  { to: "/academy/tutors", label: "Tutors" },
  { to: "/academy/roadmap", label: "Roadmap" },
  { to: "/academy/showcase", label: "Showcase" },
  { to: "/academy/prompts", label: "Prompts" },
];

const scrollTop = scrollToTopInstant;

export function AcademyNav() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated, user } = useAuth();

  // Academy auth context only — the signed-in destination is always an
  // Academy route. This is what keeps Academy sign-in out of the Portfolio
  // dashboard.
  const destination =
    !isLoading && isAuthenticated
      ? user?.role === "admin" || user?.role === "owner"
        ? "/academy/admin"
        : user?.role === "tutor" && user.verified
          ? "/academy/tutor"
          : "/academy/dashboard"
      : "/academy/login";

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-full px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap",
      isActive
        ? "bg-lime-400/10 text-lime-300"
        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
    );

  const mobileItems: MobileNavItem[] = [
    { to: "/academy", label: "Home", icon: <Home className="size-5" />, end: true },
    { to: "/academy/courses", label: "Courses", icon: <BookOpen className="size-5" /> },
    { to: "/academy/roadmap", label: "Roadmap", icon: <MapIcon className="size-5" /> },
    { to: "/academy/showcase", label: "Showcase", icon: <Sparkles className="size-5" /> },
    {
      to: destination,
      label: isAuthenticated ? "Me" : "Sign in",
      icon: isAuthenticated ? <User className="size-5" /> : <PenSquare className="size-5" />,
      end: true,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d0f0c]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:px-6 lg:h-[4.5rem]">
          <Link
            to="/academy"
            onClick={scrollTop}
            className="flex min-w-0 items-center gap-2.5"
          >
            <img src={logo} alt="ForgeX Academy" className="size-8 shrink-0 rounded-lg" />
            <span className="font-display truncate text-sm font-extrabold uppercase tracking-[0.18em] sm:text-lg">
              ForgeX <span className="text-lime-400">Academy</span>
            </span>
          </Link>

          <nav
            className="hidden min-w-0 items-center gap-0.5 md:flex"
            aria-label="Academy navigation"
          >
            {ACADEMY_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={scrollTop}
                className={desktopLinkClass}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Button
            size="sm"
            className="h-9 shrink-0 bg-lime-400 px-3 text-xs font-semibold text-black hover:bg-lime-300 sm:px-4"
            onClick={() => {
              navigate(destination);
              scrollTop();
            }}
          >
            {isLoading ? "Loading…" : isAuthenticated ? "Dashboard" : "Sign in"}
          </Button>
        </div>
      </header>
      <MobileBottomNav primaryItems={mobileItems} moreSections={[]} />
    </>
  );
}

/**
 * Exposes the Academy destination for the given auth state — used by the
 * layout so a single source of truth decides where Academy takes people.
 */
export function useAcademyDestination() {
  const location = useLocation();
  const { isLoading, isAuthenticated, user } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    // Never loop back to an auth page.
    if (location.pathname.startsWith("/academy/login")) return null;
    return `/academy/login?returnTo=${encodeURIComponent(returnTo)}`;
  }
  if (user?.role === "admin" || user?.role === "owner") return "/academy/admin";
  if (user?.role === "tutor" && user.verified) return "/academy/tutor";
  return "/academy/dashboard";
}

export function AcademyDashboardLink({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  return (
    <button
      type="button"
      onClick={() => {
        navigate(isAuthenticated ? "/academy/dashboard" : "/academy/login");
        scrollTop();
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-lime-300",
        className,
      )}
    >
      <LayoutDashboard className="size-4" />
      Dashboard
    </button>
  );
}
