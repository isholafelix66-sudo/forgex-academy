import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Bell,
  ChevronDown,
  Compass,
  Home,
  InfoIcon,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  PenSquare,
  User,
} from "lucide-react";
import { MobileBottomNav } from "./MobileBottomNav";
import {
  PortfolioAnnouncementStrip,
  PortfolioNotifications,
  usePortfolioNotificationCount,
} from "./PortfolioNotifications";
import { BrandMark } from "./BrandMark";
import { SharePortfolioButton } from "./SharePortfolioButton";
import { cn } from "@/lib/utils";
import { scrollToTopInstant } from "@/lib/scroll";
import { Button } from "@/components/ui/button";
import { Avatar } from "./Avatar";
import type { MobileNavItem } from "./MobileBottomNav";
import {
  getPortfolioUserToken,
  clearPortfolioUserToken,
  PORTFOLIO_USER_DASHBOARD_PATH,
  PORTFOLIO_AUTH_PATH,
} from "@/lib/portfolio-user-session";

/* ═══════════════════════════════════════════════════════════════════════
   AUTH SEPARATION — the public site is a PORTFOLIO surface.

   Every signed-in destination here is derived ONLY from the Portfolio
   creator session (fx-portfolio-user-token). The Academy auth session and
   Academy roles (`users.role`) are never consulted on this surface:

     • An Academy admin browsing the public site is just a signed-in
       Portfolio visitor — if they have a creator account they get the
       creator dashboard link, otherwise the Portfolio sign-in link.
     • Nothing on this surface can navigate to /admin or /admin-brand:
       those routes are only reachable by typing the URL directly, and each
       is gated by its OWN credential system.
   ═══════════════════════════════════════════════════════════════════════ */

type NavItemDef = { to: string; label: string; icon: typeof Home; end?: boolean };

const PRIMARY_NAV: NavItemDef[] = [
  { to: "/portfolio", label: "Home", icon: Home, end: true },
  { to: "/portfolio/explore", label: "Explore", icon: Compass },
];

const MORE_ITEMS: NavItemDef[] = [
  { to: "/portfolio/about", label: "About", icon: InfoIcon },
  { to: "/help", label: "Get help", icon: LifeBuoy },
];

const scrollTop = scrollToTopInstant;

/* ═══════════════════════════════════════════════════════════════════════
   DESKTOP HOVER DROPDOWN (lightweight, no Radix)
   ═══════════════════════════════════════════════════════════════════════ */

function HoverDropdown({
  trigger,
  children,
  align = "left",
  triggerClassName,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMenu = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const closeMenu = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="relative" onMouseEnter={openMenu} onMouseLeave={closeMenu}>
      <button className={triggerClassName}>{trigger}</button>
      <div
        className={cn(
          "absolute top-full z-50 mt-1.5 min-w-[220px] overflow-hidden rounded-xl border border-white/10 bg-[#111311]/95 shadow-xl shadow-black/30 backdrop-blur-xl transition-all duration-150",
          align === "right" ? "right-0" : "left-0",
          open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none",
        )}
        onMouseEnter={openMenu}
        onMouseLeave={closeMenu}
      >
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

export function PublicNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const revokeSession = useMutation(api.portfolioUsers.signOut);

  // ── PORTFOLIO session only ────────────────────────────────────────────
  // Signed-in state comes from the Portfolio creator session token — never
  // from the Academy Convex Auth session (`useAuth()`), which is what used
  // to leak Academy admin roles onto this public surface.
  const portfolioToken = getPortfolioUserToken();
  const portfolioSession = useQuery(
    api.portfolioUsers.validateSession,
    portfolioToken ? { token: portfolioToken } : "skip",
  );
  // Treat a still-validating session as signed-out *for link targets*, but
  // never navigate on it — the session query resolves in a tick and the
  // header simply re-renders with the correct links.
  const isPortfolioSignedIn = !!portfolioSession;

  // Portfolio announcements only — the header notification belongs to the
  // Portfolio website and is published from the Portfolio admin portal,
  // never from Academy.
  const unreadCount = usePortfolioNotificationCount();

  // ── Sign-out clears ONLY the Portfolio creator session ───────────────
  // The server-side session row is revoked (best effort) and the local
  // token is always dropped. No Academy state is read or touched.
  const handleSignOut = () => {
    const token = getPortfolioUserToken();
    if (token) void revokeSession({ token }).catch(() => {});
    clearPortfolioUserToken();
    navigate("/");
    scrollTop();
  };

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-full px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap",
      isActive
        ? "bg-lime-400/10 text-lime-300"
        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
    );

  // Bottom tab bar — matches the ForgeX Network Portfolio app:
  // Home · Explore · [+] · Portfolio · Profile
  const authTo = isPortfolioSignedIn ? PORTFOLIO_USER_DASHBOARD_PATH : PORTFOLIO_AUTH_PATH;
  const mobilePrimary: MobileNavItem[] = [
    { to: "/portfolio", label: "Home", icon: <Home className="size-5" />, end: true },
    { to: "/portfolio/explore", label: "Explore", icon: <Compass className="size-5" /> },
    {
      to: authTo,
      label: "Portfolio",
      icon: isPortfolioSignedIn ? (
        <LayoutDashboard className="size-5" />
      ) : (
        <PenSquare className="size-5" />
      ),
      end: true,
    },
    {
      to: authTo,
      label: "Profile",
      icon: <User className="size-5" />,
      end: true,
    },
  ];

  // The centre action opens the creator's project manager when signed in;
  // signed-out visitors go to the Portfolio auth screen (never account
  // creation on the public website, never an admin route).
  const mobileFab = {
    to: isPortfolioSignedIn ? "/portfolio/dashboard/projects" : PORTFOLIO_AUTH_PATH,
    label: isPortfolioSignedIn ? "Add a project" : "Portfolio sign in",
  };

  // Compact-but-readable controls so the header always fits 320–430px.
  const iconButtonClass =
    "relative flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300 sm:size-9";

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b transition-all duration-300",
          scrolled
            ? "border-white/10 bg-[#0d0f0c]/90 backdrop-blur-xl shadow-lg shadow-black/20"
            : "border-white/8 bg-[#0d0f0c]/85 backdrop-blur-xl",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6 lg:h-[4.5rem]">
          {/* Brand — compact and truncating on phones, full size from sm up. */}
          <span className="min-w-0 flex-1 sm:hidden">
            <BrandMark
              onClick={scrollTop}
              size="sm"
              className="truncate transition-opacity hover:opacity-90"
              shrink={false}
            />
          </span>
          <span className="hidden sm:inline-flex">
            <BrandMark
              onClick={scrollTop}
              size="lg"
              showProduct
              className="transition-opacity hover:opacity-90"
            />
          </span>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {PRIMARY_NAV.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={scrollTop}
                className={desktopLinkClass}
              >
                {l.label}
              </NavLink>
            ))}

            {/* Portfolio-only public navigation: no product teaser links. */}
            <HoverDropdown
              trigger={
                <>
                  More
                  <ChevronDown className="ml-1 size-3.5" />
                </>
              }
              triggerClassName="flex items-center rounded-full px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground whitespace-nowrap"
            >
              <div className="py-1.5">
                {MORE_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={scrollTop}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-lime-400/10 text-lime-300"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </HoverDropdown>
          </nav>

          {/* Right side — two actions only, sized to fit the smallest phones. */}
          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              aria-label={
                unreadCount > 0
                  ? `Notifications (${unreadCount} unread)`
                  : "Notifications"
              }
              className={iconButtonClass}
              onClick={() => setNotifOpen(true)}
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-lime-400 text-[9px] font-bold text-black shadow-[0_0_10px_rgba(192,253,2,0.6)]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Icon-only share on phones; the labelled pill returns ≥ sm. */}
            <SharePortfolioButton showLabel={false} className="sm:hidden" />
            <SharePortfolioButton className="hidden sm:inline-flex" />

            {isPortfolioSignedIn ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden h-8 gap-1.5 text-xs font-medium md:inline-flex"
                  data-prefetch={PORTFOLIO_USER_DASHBOARD_PATH}
                  onClick={() => {
                    navigate(PORTFOLIO_USER_DASHBOARD_PATH);
                    scrollTop();
                  }}
                >
                  <LayoutDashboard className="size-3.5" />
                  Dashboard
                </Button>

                <div className="hidden md:block">
                  <HoverDropdown
                    align="right"
                    trigger={
                      <Avatar
                        name={portfolioSession?.name ?? "Creator"}
                        image={portfolioSession?.avatarUrl ?? undefined}
                        className="size-9 cursor-pointer"
                      />
                    }
                    triggerClassName="rounded-full outline-none"
                  >
                    <div className="px-3 py-2.5">
                      <p className="truncate text-sm font-semibold">
                        {portfolioSession?.name ?? "Creator"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {portfolioSession?.email ?? ""}
                      </p>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="py-1.5">
                      <button
                        data-prefetch="/portfolio/dashboard/profile"
                        onClick={() => {
                          navigate("/portfolio/dashboard/profile");
                          scrollTop();
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                      >
                        <User className="size-4" /> Account
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-rose-400 transition-colors hover:bg-rose-400/8 hover:text-rose-300"
                      >
                        <LogOut className="size-4" /> Logout
                      </button>
                    </div>
                  </HoverDropdown>
                </div>

                <button
                  className="md:hidden"
                  aria-label="Account"
                  onClick={() => {
                    navigate("/portfolio/dashboard/profile");
                    scrollTop();
                  }}
                >
                  <Avatar
                    name={portfolioSession?.name ?? "Creator"}
                    image={portfolioSession?.avatarUrl ?? undefined}
                    className="size-9"
                  />
                </button>
              </>
            ) : (
              <>
                {/* The public site offers exactly two actions: share your
                    portfolio link (the lime pill above) and Portfolio sign
                    in — which never opens an admin portal. */}
                <Button
                  size="sm"
                  data-prefetch={PORTFOLIO_AUTH_PATH}
                  className="h-8 shrink-0 whitespace-nowrap bg-lime-400 px-3 text-xs font-semibold text-black hover:bg-lime-300 sm:px-4"
                  onClick={() => {
                    navigate(PORTFOLIO_AUTH_PATH);
                    scrollTop();
                  }}
                >
                  Sign in
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* The published Portfolio announcement, right under the header. */}
      <PortfolioAnnouncementStrip />

      <PortfolioNotifications open={notifOpen} onOpenChange={setNotifOpen} />

      {/* Bottom bar matches the ForgeX Network Portfolio app exactly:
          Home · Explore · [+] · Portfolio · Profile. The secondary
          destinations live in the footer's mobile link row. */}
      <MobileBottomNav
        primaryItems={mobilePrimary}
        moreSections={[]}
        fab={mobileFab}
      />
    </>
  );
}
