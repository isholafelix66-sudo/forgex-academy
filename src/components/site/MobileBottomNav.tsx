import { Link, NavLink, useLocation } from "react-router";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { X, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { scrollToTopInstant } from "@/lib/scroll";

export type MobileNavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
};

export type MobileNavSection = {
  label?: string;
  items: MobileNavItem[];
};

/** Reset scroll on every in-app navigation click (bottom nav, More menu…). */
const scrollTop = scrollToTopInstant;

/**
 * Mobile bottom navigation.
 *
 * A floating dark pill (Home · Explore · + · Portfolio · Profile) where the
 * active destination slides into a lime circle with a dark notch — the same
 * treatment as the ForgeX Network mobile reference. Labels stay available to
 * screen readers; the pill itself is icon-only so it never overflows on small
 * phones.
 */
export function MobileBottomNav({
  primaryItems,
  moreSections,
  moreFooter,
  fab,
}: {
  primaryItems: MobileNavItem[];
  moreSections: MobileNavSection[];
  /** Optional extras rendered at the bottom of the More menu (e.g. theme). */
  moreFooter?: ReactNode;
  /** Raised centre action, rendered between the tab groups (ForgeX "+"). */
  fab?: { to: string; label: string };
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  // Close the menu on navigation
  useEffect(() => setMoreOpen(false), [location.pathname]);

  // Lock body scroll while the full-screen More menu is open
  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  const hasMore = moreSections.some((s) => s.items.length > 0);

  // The raised centre action sits between the tab groups (ForgeX "+").
  const fabIndex = Math.ceil(primaryItems.length / 2) - 1;

  const isItemActive = (item: MobileNavItem) =>
    location.pathname === item.to ||
    (!item.end && location.pathname.startsWith(item.to + "/"));

  const moreHasActive = moreSections.some((s) => s.items.some(isItemActive));
  const primaryHasActive = primaryItems.some(isItemActive);
  const moreIsActive = moreHasActive && !primaryHasActive;

  const activeCircle =
    "bg-lime-400 text-black shadow-[0_0_0_6px_#0a0c0a,0_8px_20px_rgba(163,230,53,0.35)]";
  const inactiveCircle = "rounded-full text-muted-foreground group-active:text-foreground/70";

  return (
    <>
      {/* Floating pill tab bar (< md only) */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden safe-area-bottom">
        <div className="pointer-events-auto mx-auto mb-2 w-[calc(100%-1.5rem)] max-w-lg rounded-full border border-white/10 bg-[#0a0c0a]/95 px-1.5 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            {primaryItems.map((item, index) => (
              <Fragment key={`${item.to}-${item.label}`}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={scrollTop}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    cn(
                      "group flex min-w-0 flex-1 items-center justify-center py-0.5",
                      isActive ? "text-black" : "text-muted-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center transition-colors",
                        isActive ? activeCircle : inactiveCircle,
                      )}
                    >
                      {item.icon}
                      <span className="sr-only">{item.label}</span>
                    </span>
                  )}
                </NavLink>

                {/* Raised centre button (ForgeX "+") */}
                {fab && index === fabIndex && (
                  <Link
                    to={fab.to}
                    onClick={scrollTop}
                    aria-label={fab.label}
                    className="relative flex shrink-0 items-center justify-center px-1"
                  >
                    <span className="flex size-11 items-center justify-center rounded-full bg-lime-400 text-black shadow-[0_6px_22px_rgba(163,230,53,0.45)] ring-4 ring-[#0a0c0a] transition-transform active:scale-95">
                      <Plus className="size-5" />
                    </span>
                  </Link>
                )}
              </Fragment>
            ))}

            {hasMore && (
              <button
                onClick={() => setMoreOpen(true)}
                aria-label="More"
                className={cn(
                  "group flex min-w-0 flex-1 items-center justify-center py-0.5",
                  moreIsActive ? "text-black" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center transition-colors",
                    moreIsActive ? activeCircle : inactiveCircle,
                  )}
                >
                  <span className="grid grid-cols-2 gap-[3px]">
                    <span className="size-[4px] rounded-full bg-current" />
                    <span className="size-[4px] rounded-full bg-current" />
                    <span className="size-[4px] rounded-full bg-current" />
                    <span className="size-[4px] rounded-full bg-current" />
                  </span>
                  <span className="sr-only">More</span>
                </span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── More: full-screen menu ──────────────────────────────────── */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 h-full w-full overflow-y-auto bg-background md:hidden safe-area-bottom"
          role="dialog"
          aria-modal="true"
          aria-label="More menu"
        >
          {/* Header with clear Close button */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-background/95 px-4 py-3 backdrop-blur-xl" data-more-header>
            <span className="font-display text-sm font-bold">More</span>
            <button
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <X className="size-4" />
              Close
            </button>
          </div>

          {/* Sections */}
          <div className="p-3 pb-24">
            {moreSections
              .filter((s) => s.items.length > 0)
              .map((section, i) => (
                <div key={i} className={i > 0 ? "mt-5" : ""}>
                  {section.label && (
                    <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {section.label}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={scrollTop}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-lime-400/12 text-lime-300"
                              : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                          )
                        }
                      >
                        <span className="shrink-0">{item.icon}</span>
                        <span className="flex-1">{item.label}</span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/30" />
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          {moreFooter && (
            <div className="px-3 pb-6">{moreFooter}</div>
          )}
        </div>
      )}
    </>
  );
}
