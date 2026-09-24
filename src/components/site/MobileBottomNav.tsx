import { Link, NavLink, useLocation } from "react-router";
import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
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
 * The active indicator from the ForgeX reference: one lime circle that slides
 * along the bar, with a dark "notch" ring behind it so the pill appears to dip
 * around the active destination. Shared across the row with a layout animation,
 * so it glides from tab to tab instead of fading in and out.
 *
 * `layoutId` must be unique per nav instance (both the public site and the
 * admin shells render one) — that's what keeps the two independent.
 */
export const NAV_INDICATOR_SPRING = {
  type: "spring" as const,
  stiffness: 560,
  damping: 38,
  mass: 0.75,
};

export function NavActiveIndicator({ layoutId }: { layoutId: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      transition={NAV_INDICATOR_SPRING}
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
    >
      {/* Notch — same colour as the bar, so it reads as a dip around the circle. */}
      <span className="absolute size-[3.85rem] rounded-full bg-[#0a0c0a] shadow-[inset_0_3px_9px_rgba(0,0,0,0.7)]" />
      {/* The lime circle itself. */}
      <span className="relative size-11 rounded-full bg-lime-400 shadow-[0_8px_22px_rgba(163,230,53,0.42)]" />
    </motion.span>
  );
}

/** Fixed-size slot every tab uses, so the circle always moves between equals. */
export function NavSlot({
  children,
  active,
  layoutId,
}: {
  children: ReactNode;
  active: boolean;
  layoutId: string;
}) {
  return (
    <span className="relative flex size-11 shrink-0 items-center justify-center">
      {active && <NavActiveIndicator layoutId={layoutId} />}
      <span
        className={cn(
          "relative z-10 flex items-center justify-center transition-colors",
          active ? "text-black" : "text-muted-foreground",
        )}
      >
        {children}
      </span>
    </span>
  );
}

/**
 * Mobile bottom navigation — the floating dark pill from the ForgeX reference.
 *
 * · The active destination is marked by ONE lime circle that slides between
 *   tabs with a spring, wrapped by a notch so the bar dips around it.
 * · The centre "+" is raised above the bar, ringed in the bar colour and
 *   glowing, so it reads as the primary action.
 * · Icon-only (labels stay for screen readers), so nothing overflows on small
 *   phones, and tap highlights are suppressed so pressing never paints a
 *   square behind the circle.
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
  const indicatorId = `fx-nav-indicator-${useId()}`;

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

  return (
    <>
      {/* Floating pill tab bar (< md only) */}
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden safe-area-bottom"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <div className="mobile-nav-pill pointer-events-auto mx-auto mb-2 w-[calc(100%-1.5rem)] max-w-lg rounded-full border border-white/10 bg-[#0a0c0a]/95 px-1.5 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex items-center justify-between overflow-visible">
            {primaryItems.map((item, index) => (
              <Fragment key={`${item.to}-${item.label}`}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={scrollTop}
                  aria-label={item.label}
                  className="group flex min-w-0 flex-1 items-center justify-center rounded-full outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-lime-400/50"
                >
                  {({ isActive }) => (
                    <NavSlot active={isActive} layoutId={indicatorId}>
                      {item.icon}
                      <span className="sr-only">{item.label}</span>
                    </NavSlot>
                  )}
                </NavLink>

                {/* Raised centre button (ForgeX "+") — floats above the bar so
                    it sits higher than the tabs without stretching the row. */}
                {fab && index === fabIndex && (
                  <Link
                    to={fab.to}
                    onClick={scrollTop}
                    aria-label={fab.label}
                    className="group relative z-20 flex w-14 shrink-0 items-center justify-center self-center outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-lime-400/50"
                  >
                    <span className="absolute -top-7 flex size-[3.25rem] items-center justify-center rounded-full bg-lime-400 text-black ring-4 ring-[#0a0c0a] shadow-[0_14px_28px_rgba(163,230,53,0.45),0_0_0_1px_rgba(163,230,53,0.35)] transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                      <Plus className="size-6" strokeWidth={2.6} />
                    </span>
                    <span className="sr-only">{fab.label}</span>
                  </Link>
                )}
              </Fragment>
            ))}

            {hasMore && (
              <button
                onClick={() => setMoreOpen(true)}
                aria-label="More"
                className="group flex min-w-0 flex-1 items-center justify-center rounded-full outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-lime-400/50"
              >
                <NavSlot active={moreIsActive} layoutId={indicatorId}>
                  <span className="grid grid-cols-2 gap-[3px]">
                    <span className="size-[4px] rounded-full bg-current" />
                    <span className="size-[4px] rounded-full bg-current" />
                    <span className="size-[4px] rounded-full bg-current" />
                    <span className="size-[4px] rounded-full bg-current" />
                  </span>
                  <span className="sr-only">More</span>
                </NavSlot>
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

          {moreFooter && <div className="px-3 pb-6">{moreFooter}</div>}
        </div>
      )}
    </>
  );
}
