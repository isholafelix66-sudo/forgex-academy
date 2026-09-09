import type { ReactNode } from "react";

/**
 * The public chrome (nav, footer, ambient background, mobile bottom nav) is
 * now mounted ONCE by <PublicLayout /> — the router layout route that wraps
 * every public page. It stays mounted across navigation, so the viewport is
 * never unmounted/repainted between pages (which used to flash a white page
 * before loading on desktop).
 *
 * PageShell therefore remains only as a passthrough so existing pages keep
 * compiling unchanged — it renders exactly the page content it is given.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
