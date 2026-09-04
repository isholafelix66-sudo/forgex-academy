import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
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
import { MobileBottomNav } from "./MobileBottomNav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { Avatar } from "./Avatar";
import type { MobileNavItem, MobileNavSection } from "./MobileBottomNav";

/* ═══════════════════════════════════════════════════════════════════════
   NAV DATA
   ═══════════════════════════════════════════════════════════════════════ */

type NavItemDef = {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
};

const PRIMARY_NAV: NavItemDef[] = [
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

/** Reset scroll on every in-app navigation click (header links, CTAs…). */
function scrollTop() {
  window.scrollTo({ top: 0, behavior: "instant" });
}

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
          "absolute top-full z-50 mt-1.5 min-w-[200px] overflow-hidden rounded-xl border border-white/10 bg-[#111311]/95 shadow-xl shadow-black/30 backdrop-blur-xl transition-all duration-150",
          align === "right" ? "right-0" : "left-0",
          open
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-1 pointer-events-none",
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
  const content = useQuery(api.public.siteContentAll);
  const navigate = useNavigate();
  const location = useLocation();
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const exploreHasActive = EXPLORE_ITEMS.some(
    (i) =>
      location.pathname === i.to ||
      (!i.end && location.pathname.startsWith(i.to + "/")),
  );
  const moreHasActive = MORE_ITEMS.some(
    (i) =>
      location.pathname === i.to ||
      (!i.end && location.pathname.startsWith(i.to + "/")),
  );

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-full px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap",
      isActive
        ? "bg-lime-400/10 text-lime-300"
        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
    );

  /* ── Mobile bottom nav data ──────────────────────────────────────
     Exactly: Home | Courses | Certificates | Profile/Inbox | More.
     Roadmap lives in the More menu. Guests get bounced to auth from
     protected destinations (handled by RequireAuth). */
  const profileLabel = isAuthenticated ? "Profile" : "Inbox";

  const mobilePrimary: MobileNavItem[] = [
    { to: "/", label: "Home", icon: <Home className="size-5" />, end: true },
    { to: "/courses", label: "Courses", icon: <BookOpen className="size-5" /> },
    {
      to: "/dashboard/certificates",
      label: "Certificates",
      icon: <Bookmark className="size-5" />,
    },
    {
      to: isAuthenticated ? profileTo : "/contact",
      label: profileLabel,
      icon: <User className="size-5" />,
      end: true,
    },
  ];

  const mobileMore: MobileNavSection[] = [
    {
      label: "Explore",
      items: [
        { to: "/roadmap", label: "Roadmap", icon: <Map className="size-4" /> },
        { to: "/ai-hub", label: "AI Hub", icon: <Sparkles className="size-4" /> },
        { to: "/prompts", label: "Prompt Library", icon: <FileText className="size-4" /> },
        { to: "/updates", label: "Updates", icon: <Bell className="size-4" /> },
        { to: "/stories", label: "Stories", icon: <Bookmark className="size-4" /> },
      ],
    },
    {
      label: "About",
      items: [
        { to: "/contact", label: "Contact", icon: <Mail className="size-4" /> },
        { to: "/about", label: "About", icon: <InfoIcon className="size-4" /> },
      ],
    },
    ...(isAuthenticated
      ? [
          {
            label: "Account" as const,
            items: [
              {
                to: dashboardTo,
                label: "Dashboard",
                icon: <LayoutDashboard className="size-4" />,
              },
            ],
          },
        ]
      : [
          {
            label: "Account" as const,
            items: [
              {
                to: "/auth?mode=signin",
                label: "Login",
                icon: <User className="size-4" />,
              },
            ],
          },
        ]),
  ];

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b transition-all duration-300",
          scrolled
            ? "border-white/10 bg-[#0d0f0c]/85 backdrop-blur-xl"
            : "border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-16">
          {/* ── Logo ─────────────────────────────────────────────────── */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5" onClick={scrollTop}>
            <img
              src={brandLogo}
              alt="ForgeX Academy"
              className="size-8 rounded-lg lg:size-9 lg:rounded-xl"
            />
            <span className="font-display text-base font-bold tracking-tight lg:text-lg">
              ForgeX<span className="text-lime-400"> Academy</span>
            </span>
          </Link>

          {/* ═══════════════════════════════════════════════════════════
              DESKTOP NAV (≥ md) — no hamburger exists at any size
              ═══════════════════════════════════════════════════════════ */}
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

            {/* Explore dropdown */}
            <HoverDropdown
              trigger={
                <>
                  Explore
                  <ChevronDown className="ml-1 size-3.5" />
                </>
              }
              triggerClassName={cn(
                "flex items-center rounded-full px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap",
                exploreHasActive
                  ? "bg-lime-400/10 text-lime-300"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <div className="py-1.5">
                {EXPLORE_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
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

            {/* More dropdown */}
            <HoverDropdown
              trigger={
                <>
                  More
                  <ChevronDown className="ml-1 size-3.5" />
                </>
              }
              triggerClassName={cn(
                "flex items-center rounded-full px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap",
                moreHasActive
                  ? "bg-lime-400/10 text-lime-300"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <div className="py-1.5">
                {MORE_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
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

          {/* ═══════════════════════════════════════════════════════════
              RIGHT SIDE
              ═══════════════════════════════════════════════════════════ */}
          <div className="flex shrink-0 items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Desktop: exactly one Dashboard link */}
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

                {/* Desktop: account dropdown (avatar) */}
                <div className="hidden md:block">
                  <HoverDropdown
                    align="right"
                    trigger={
                      <Avatar
                        name={user?.name ?? "Student"}
                        image={user?.image}
                        className="size-8 cursor-pointer"
                      />
                    }
                    triggerClassName="rounded-full outline-none"
                  >
                    <div className="px-3 py-2.5">
                      <p className="truncate text-sm font-semibold">
                        {user?.name ?? "Student"}
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
                        <User className="size-4" />
                        Profile
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-rose-400 transition-colors hover:bg-rose-400/8 hover:text-rose-300"
                      >
                        <LogOut className="size-4" />
                        Logout
                      </button>
                    </div>
                  </HoverDropdown>
                </div>

                {/* Mobile: only the profile avatar links to Profile */}
                <button
                  className="md:hidden"
                  aria-label="Profile"
                  onClick={() => {
                    navigate(profileTo);
                    scrollTop();
                  }}
                >
                  <Avatar
                    name={user?.name ?? "Student"}
                    image={user?.image}
                    className="size-8"
                  />
                </button>
              </>
            ) : (
              <>
                {/* Desktop: Login + Sign up */}
                <div className="hidden items-center gap-2 md:flex">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-medium"
                    data-prefetch="/auth"
                    onClick={() => navigate("/auth?mode=signin")}
                  >
                    Login
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 bg-lime-400 text-xs font-semibold text-black hover:bg-lime-300 glow-lime-soft"
                    data-prefetch="/auth"
                    onClick={() => navigate("/auth?mode=signup")}
                  >
                    Sign up
                  </Button>
                </div>

                {/* Mobile: one Get Started CTA beside the logo */}
                <Button
                  size="sm"
                  className="h-8 bg-lime-400 text-xs font-semibold text-black hover:bg-lime-300 md:hidden"
                  data-prefetch="/auth"
                  onClick={() => navigate("/auth?mode=signup")}
                >
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <MobileBottomNav primaryItems={mobilePrimary} moreSections={mobileMore} />
    </>
  );
}
