/**
 * Route prefetching — makes navigation feel instant.
 *
 * While the pointer hovers, focuses or touches a link, we warm up the lazy
 * chunk for its route so the page is already downloaded (and often parsed)
 * by the time the tap/click lands. The dynamic imports below use the exact
 * same module specifiers as the router in main.tsx, so Vite dedupes them
 * into the same chunks — a module is never fetched twice.
 */

type Importer = () => Promise<unknown>;

const EXACT: Array<[string, Importer]> = [
  ["/courses", () => import("@/pages/Courses.tsx")],
  ["/tutors", () => import("@/pages/Tutors.tsx")],
  ["/roadmap", () => import("@/pages/RoadmapPage.tsx")],
  ["/updates", () => import("@/pages/Updates.tsx")],
  ["/stories", () => import("@/pages/Stories.tsx")],
  ["/ai-hub", () => import("@/pages/AIHub.tsx")],
  ["/prompts", () => import("@/pages/PromptLibrary.tsx")],
  ["/contact", () => import("@/pages/Contact.tsx")],
  ["/about", () => import("@/pages/About.tsx")],
  ["/become-tutor", () => import("@/pages/BecomeTutor.tsx")],
  ["/auth", () => import("@/pages/Auth.tsx")],
  ["/dashboard", () => import("@/pages/dashboard/DashboardShell.tsx")],
  ["/tutor", () => import("@/pages/tutor/TutorShell.tsx")],
  ["/admin", () => import("@/pages/admin/AdminShell.tsx")],
];

// Tutor dashboard subroutes live under /tutor/ too — they must keep
// resolving to the dashboard (or their own chunk), never the public
// mini-site. Public tutor pages are single-segment slugs, so we only
// prefetch TutorPage for /tutor/<slug>.
const TUTOR_DASHBOARD_SUBROUTES = new Set([
  "courses",
  "grading",
  "students",
  "inbox",
  "announcements",
  "support",
]);

const PREFIX: Array<[string, Importer]> = [
  ["/learn/", () => import("@/pages/Learn.tsx")],
  ["/verify/", () => import("@/pages/VerifyCertificate.tsx")],
  ["/courses/", () => import("@/pages/CourseDetail.tsx")],
  ["/prompts/", () => import("@/pages/PromptDetail.tsx")],
  ["/tutors/", () => import("@/pages/TutorDetail.tsx")],
  ["/tutor/", () => import("@/pages/TutorPage.tsx")],
];

const prefetched = new Set<string>();

function resolve(path: string): Importer | null {
  const clean = path.split("?")[0].split("#")[0];
  const exact = EXACT.find(([to]) => to === clean);
  if (exact) return exact[1];
  // A tutor-dashboard subroute (/tutor/courses, /tutor/grading, …) is not a
  // public slug — skip the /tutor/ prefix entry for those.
  if (clean.startsWith("/tutor/") && !clean.slice("/tutor/".length).includes("/")) {
    const segment = clean.slice("/tutor/".length).split("?")[0].split("#")[0];
    if (TUTOR_DASHBOARD_SUBROUTES.has(segment)) return null;
  }
  for (const [prefix, imp] of PREFIX) {
    if (clean.startsWith(prefix)) return imp;
  }
  return null;
}

/** Warm up the chunk for a route path (idempotent, silent on failure). */
export function prefetchRoute(path: string) {
  const clean = path.split("?")[0].split("#")[0];
  if (!clean || prefetched.has(clean)) return;
  const imp = resolve(clean);
  if (!imp) return;
  prefetched.add(clean);
  imp().catch(() => prefetched.delete(clean));
}

/**
 * One delegated listener for the whole app: any internal `<a href="/...">`
 * link — nav, footer, cards, sidebars — prefetches on hover, keyboard focus
 * or touch start. Elements can also opt in with a `data-prefetch="/path"`
 * attribute (used by CTA buttons that call `navigate()` instead of linking).
 */
export function attachRoutePrefetch() {
  if (typeof document === "undefined") return;

  const fire = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    const el = target.closest("a[href], [data-prefetch]");
    if (!el) return;
    const hint = el.getAttribute("data-prefetch");
    if (hint) {
      prefetchRoute(hint);
      return;
    }
    const href = el.getAttribute("href");
    if (href && href.startsWith("/")) prefetchRoute(href);
  };

  const opts = { passive: true } as AddEventListenerOptions;
  document.addEventListener("pointerover", (e) => fire(e.target), opts);
  document.addEventListener("focusin", (e) => fire(e.target), opts);
  document.addEventListener("touchstart", (e) => fire(e.target), opts);
}
