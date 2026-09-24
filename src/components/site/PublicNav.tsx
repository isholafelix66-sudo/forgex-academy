import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Bell,
  ChevronDown,
  Compass,
  Home,
  InfoIcon,
  LayoutDashboard,
  LogOut,
  Mail,
  PenSquare,
  Sparkles,
  User,
} from "lucide-react";
import { MobileBottomNav } from "./MobileBottomNav";
import { SiteNotifications } from "./SiteNotifications";
import { BrandMark } from "./BrandMark";
import { SharePortfolioButton } from "./SharePortfolioButton";
import { cn } from "@/lib/utils";
import { scrollToTopInstant } from "@/lib/scroll";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "./Avatar";
import type { MobileNavItem } from "./MobileBottomNav";

/* ═══════════════════════════════════════════════════════════════════════
   NAV DATA — the public site is a focused Portfolio experience. Academy and
   Opportunity Hub remain isolated behind their locked product routes.
   ═══════════════════════════════════════════════════════════════════════ */

type NavItemDef = { to: string; label: string; icon: typeof Home; end?: boolean };

const PRIMARY_NAV: NavItemDef[] = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/explore", label: "Explore", icon: Compass },
];

const MORE_ITEMS: NavItemDef[] = [
  { to: "/about", label: "About", icon: InfoIcon },
  { to: "/contact", label: "Contact", icon: Mail },
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
  const { isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const headerNotifications = useQuery(api.notifications.myNotificationsForHeader);
  const unreadCount = headerNotifications?.filter((n) => !n.read).length ?? 0;

  const dashboardTo =
    user?.role === "admin" || user?.role === "owner" ? "/admin" : "/portfolio/dashboard";
  const profileTo =
    user?.role === "admin" || user?.role === "owner"
      ? "/admin/profile"
      : "/portfolio/dashboard/profile";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
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
  const authTo = isAuthenticated ? "/portfolio/dashboard" : "/portfolio/auth";
  const mobilePrimary: MobileNavItem[] = [
    { to: "/", label: "Home", icon: <Home className="size-5" />, end: true },
    { to: "/explore", label: "Explore", icon: <Compass className="size-5" /> },
    {
      to: authTo,
      label: "Portfolio",
      icon: isAuthenticated ? (
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
    to: isAuthenticated ? "/portfolio/dashboard/projects" : "/portfolio/auth",
    label: isAuthenticated ? "Add a project" : "Portfolio sign in",
  };

  const iconButtonClass =
    "relative flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300";

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
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[4.5rem]">
          {/* Brand */}
          <BrandMark
            onClick={scrollTop}
            size="lg"
            showProduct
            className="transition-opacity hover:opacity-90"
          />

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

          {/* Right side */}
          <div className="flex shrink-0 items-center gap-2">
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

            <SharePortfolioButton />

            {isAuthenticated ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden h-8 gap-1.5 text-xs font-medium md:inline-flex"
                  data-prefetch={dashboardTo}
                  onClick={() => {
                    navigate(dashboardTo);
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
                        name={user?.name ?? "Creator"}
                        image={user?.image}
                        className="size-9 cursor-pointer"
                      />
                    }
                    triggerClassName="rounded-full outline-none"
                  >
                    <div className="px-3 py-2.5">
                      <p className="truncate text-sm font-semibold">
                        {user?.name ?? "Creator"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user?.email ?? ""}
                      </p>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="py-1.5">
                      <button
                        data-prefetch={profileTo}
                        onClick={() => {
                          navigate(profileTo);
                          scrollTop();
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                      >
                        <User className="size-4" /> Account
                      </button>
                      <button
                        onClick={() => void handleSignOut()}
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
                    navigate(profileTo);
                    scrollTop();
                  }}
                >
                  <Avatar name={user?.name ?? "Creator"} image={user?.image} className="size-9" />
                </button>
              </>
            ) : (
              <>
                {/* The public site offers exactly two actions: share your
                    portfolio link (the lime pill above) and Portfolio sign
                    in — which never opens an admin portal. */}
                <Button
                  size="sm"
                  data-prefetch="/portfolio/auth"
                  className="h-8 bg-lime-400 text-xs font-semibold text-black hover:bg-lime-300"
                  onClick={() => {
                    navigate("/portfolio/auth");
                    scrollTop();
                  }}
                >
                  Sign In
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <SiteNotifications open={notifOpen} onOpenChange={setNotifOpen} />

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
