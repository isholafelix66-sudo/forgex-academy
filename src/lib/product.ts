/**
 * Route-based product context.
 *
 * ForgeX has two independent products that share one application:
 *   • ForgeX Academy   → "/" and every "/academy" route (the MAIN website)
 *   • ForgeX Portfolio  → "/portfolio" (and its public/creator sub-routes)
 *
 * The active product is ALWAYS derived from the route — never from the signed
 * in user, their email, or their role. This is what keeps Academy chrome,
 * notifications, dashboards and data out of the Portfolio (and vice versa).
 */
export type Product = "academy" | "portfolio";

/** True for every path that belongs to the Portfolio product. */
export function isPortfolioPath(pathname: string): boolean {
  return (
    pathname === "/portfolio" ||
    pathname.startsWith("/portfolio/") ||
    pathname === "/help" ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/admin-brand") ||
    pathname.startsWith("/adminbrand")
  );
}

/** True for every path that belongs to the Academy product (the main site). */
export function isAcademyPath(pathname: string): boolean {
  return !isPortfolioPath(pathname);
}

/** Resolve the active product for a route. */
export function productForPath(pathname: string): Product {
  return isPortfolioPath(pathname) ? "portfolio" : "academy";
}
