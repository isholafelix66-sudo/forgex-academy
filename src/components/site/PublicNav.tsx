import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  User,
  Home,
  BookOpen,
  GraduationCap,
  Map,
  Sparkles,
  FileText,
  Bell,
  Bookmark,
  Mail,
  InfoIcon,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { Avatar } from "./Avatar";

/* ── Desktop link list (unchanged) ──────────────────────────────────── */

const DESKTOP_LINKS: Array<{ to: string; label: string; end?: boolean }> = [
  { to: "/", label: "Home", end: true },
  { to: "/courses", label: "Courses" },
  { to: "/tutors", label: "Tutors" },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/updates", label: "Updates" },
  { to: "/ai-hub", label: "AI Hub" },
  { to: "/prompts", label: "Prompt Library" },
  { to: "/stories", label: "Stories" },
  { to: "/contact", label: "Contact" },
  { to: "/about", label: "About" },
];

/* ── Mobile nav structure ────────────────────────────────────────────── */

type NavItemDef = {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
};

const MAIN_NAV: NavItemDef[] = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/courses", label: "Courses", icon: BookOpen },
  { to: "/tutors", label: "Tutors", icon: GraduationCap },
  { to: "/roadmap", label: "Roadmap", icon: Map },
];

const EXPLORE_ITEMS: NavItemDef[] = [
  { to: "/ai-hub", label: "AI Hub", icon: Sparkles },
  { to: "/prompts", label: "Prompt Library", icon: FileText },
  { to: "/updates", label: "Updates", icon: Bell },
  { to: "/stories", label: "Stories", icon: Bookmark },
];

const MORE_ITEMS: NavItemDef[] = [
  { to: "/contact", label: "Contact", icon: Mail },
  { to: "/about", label: "About", icon: InfoIcon },
];

/* ── Reusable mobile link ────────────────────────────────────────────── */

function MobileNavLink({
  item,
  onNavigate,
}: {
  item: NavItemDef;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-lime-400/12 text-lime-300"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        )
      }
    >
      <item.icon className="size-[18px] shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  );
}

/* ── Collapsible section ─────────────────────────────────────────────── */

function CollapsibleSection({
  label,
  icon: Icon,
  items,
  onNavigate,
}: {
  label: string;
  icon: typeof Sparkles;
  items: NavItemDef[];
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Auto-close on route change
  useEffect(() => setOpen(false), [location.pathname]);

  // Check if any child is active — keep section open if so
  const hasActive = items.some(
    (item) =>
      location.pathname === item.to ||
      (!item.end && location.pathname.startsWith(item.to + "/")),
  );

  const expanded = open || hasActive;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          hasActive
            ? "text-lime-300"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        )}
      >
        <Icon className="size-[18px] shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          expanded ? "max-h-60 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/8 pl-2">
          {items.map((item) => (
            <MobileNavLink key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */

export function PublicNav() {
  const { isAuthenticated, user, signOut } = useAuth();
  const content = useQuery(api.public.siteContentAll);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const brandLogo = (content?.logo as string | undefined) || logo;

  const dashboardTo =
    user?.role === "tutor"
      ? "/tutor"
      : user?.role === "admin"
        ? "/admin"
        : "/dashboard";
  const profileTo = user?.role === "tutor" ? "/tutor" : "/dashboard/profile";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const closeMenu = () => setOpen(false);

  /* ── Desktop link class (unchanged) ──────────────────────────────── */

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
      isActive
        ? "bg-lime-400/10 text-lime-300"
        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
    );

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-all duration-300",
        scrolled
          ? "border-white/10 bg-[#0d0f0c]/85 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* ── Logo ─────────────────────────────────────────────────── */}
        <Link to="/" className="flex items-center gap-2.5">
          <img src={brandLogo} alt="ForgeX Academy" className="size-9 rounded-xl" />
          <span className="font-display text-lg font-bold tracking-tight">
            ForgeX<span className="text-lime-400"> Academy</span>
          </span>
        </Link>

        {/* ── Desktop nav (hidden < lg) ────────────────────────────── */}
        <nav className="hidden items-center gap-1 lg:flex">
          {DESKTOP_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* ── Desktop account buttons (hidden < md) ────────────────── */}
        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                data-prefetch={dashboardTo}
                onClick={() => navigate(dashboardTo)}
              >
                <LayoutDashboard className="mr-2 size-4" />
                Dashboard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                data-prefetch={profileTo}
                onClick={() => navigate(profileTo)}
              >
                <User className="mr-2 size-4" />
                Profile
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={handleSignOut}
                title="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
              <Link to={profileTo}>
                <Avatar
                  name={user?.name ?? "Student"}
                  image={user?.image}
                  className="size-8"
                />
              </Link>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                data-prefetch="/auth"
                onClick={() => navigate("/auth?mode=signin")}
              >
                Login
              </Button>
              <Button
                size="sm"
                data-prefetch="/auth"
                className="bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft"
                onClick={() => navigate("/auth?mode=signup")}
              >
                Sign up
              </Button>
            </>
          )}
        </div>

        {/* ── Hamburger (mobile only) ──────────────────────────────── */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE DRAWER
          ═══════════════════════════════════════════════════════════════ */}
      {open && (
        <div className="border-t border-white/10 bg-[#0d0f0c]/98 backdrop-blur-xl md:hidden">
          <nav className="flex max-h-[calc(100dvh-5rem)] flex-col overflow-y-auto px-3 pb-5 pt-2">
            {/* ── Main navigation ──────────────────────────────────── */}
            <div className="space-y-0.5">
              {MAIN_NAV.map((item) => (
                <MobileNavLink
                  key={item.to}
                  item={item}
                  onNavigate={closeMenu}
                />
              ))}
            </div>

            {/* ── Explore (collapsible) ────────────────────────────── */}
            <div className="mt-2">
              <CollapsibleSection
                label="Explore"
                icon={Sparkles}
                items={EXPLORE_ITEMS}
                onNavigate={closeMenu}
              />
            </div>

            {/* ── More (collapsible) ───────────────────────────────── */}
            <div className="mt-1">
              <CollapsibleSection
                label="More"
                icon={InfoIcon}
                items={MORE_ITEMS}
                onNavigate={closeMenu}
              />
            </div>

            {/* ── Account section ──────────────────────────────────── */}
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Account
              </p>
              {isAuthenticated ? (
                <div className="space-y-0.5">
                  {/* Dashboard */}
                  <button
                    data-prefetch={dashboardTo}
                    onClick={() => {
                      navigate(dashboardTo);
                      closeMenu();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                  >
                    <LayoutDashboard className="size-[18px] shrink-0" />
                    <span>Dashboard</span>
                  </button>

                  {/* Profile */}
                  <button
                    data-prefetch={profileTo}
                    onClick={() => {
                      navigate(profileTo);
                      closeMenu();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                  >
                    <User className="size-[18px] shrink-0" />
                    <span>Profile</span>
                  </button>

                  {/* Logout */}
                  <button
                    onClick={() => {
                      handleSignOut();
                      closeMenu();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-400/80 transition-colors hover:bg-rose-400/8 hover:text-rose-300"
                  >
                    <LogOut className="size-[18px] shrink-0" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full border-white/15"
                    data-prefetch="/auth"
                    onClick={() => {
                      navigate("/auth?mode=signin");
                      closeMenu();
                    }}
                  >
                    Login
                  </Button>
                  <Button
                    className="w-full bg-lime-400 font-semibold text-black hover:bg-lime-300"
                    data-prefetch="/auth"
                    onClick={() => {
                      navigate("/auth?mode=signup");
                      closeMenu();
                    }}
                  >
                    Sign up
                  </Button>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
