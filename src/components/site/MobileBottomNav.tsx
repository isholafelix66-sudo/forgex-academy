import { NavLink, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
function scrollTop() {
  window.scrollTo({ top: 0, behavior: "instant" });
}

export function MobileBottomNav({
  primaryItems,
  moreSections,
}: {
  primaryItems: MobileNavItem[];
  moreSections: MobileNavSection[];
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

  const moreHasActive = moreSections.some((s) =>
    s.items.some(
      (item) =>
        location.pathname === item.to ||
        (!item.end && location.pathname.startsWith(item.to + "/")),
    ),
  );

  return (
    <>
      {/* ── Fixed bottom bar (< md only) ────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-[#0a0c0a]/95 backdrop-blur-xl md:hidden safe-area-bottom">
        <div className="mx-auto flex h-[60px] max-w-lg items-stretch px-1">
          {primaryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={scrollTop}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center justify-center gap-[3px] px-1 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-lime-300"
                    : "text-muted-foreground active:text-foreground/70",
                )
              }
            >
              <span className="flex size-6 items-center justify-center">
                {item.icon}
              </span>
              <span className="truncate max-w-[64px] text-center leading-tight">
                {item.label}
              </span>
            </NavLink>
          ))}
          {hasMore && (
            <button
              onClick={() => {
                setMoreOpen(true);
                scrollTop();
              }}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-[3px] px-1 text-[10px] font-medium transition-colors active:text-foreground/70",
                moreHasActive &&
                  !primaryItems.some(
                    (p) =>
                      location.pathname === p.to ||
                      (!p.end && location.pathname.startsWith(p.to + "/")),
                  )
                  ? "text-lime-300"
                  : "text-muted-foreground",
              )}
            >
              <span className="flex size-6 items-center justify-center">
                <div className="grid grid-cols-2 gap-[3px]">
                  <span className="size-[4px] rounded-full bg-current" />
                  <span className="size-[4px] rounded-full bg-current" />
                  <span className="size-[4px] rounded-full bg-current" />
                  <span className="size-[4px] rounded-full bg-current" />
                </div>
              </span>
              <span className="leading-tight">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* ── More: full-screen menu ──────────────────────────────────── */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 w-full h-full overflow-y-auto bg-background md:hidden safe-area-bottom"
          role="dialog"
          aria-modal="true"
          aria-label="More menu"
        >
          {/* Header with clear Close button */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-background/95 px-4 py-3 backdrop-blur-xl">
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
        </div>
      )}
    </>
  );
}
