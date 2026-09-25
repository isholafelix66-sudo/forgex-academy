import { Suspense } from "react";
import type { ReactNode } from "react";
import { Outlet } from "react-router";
import { AcademyNav } from "./AcademyNav";
import { Footer } from "./Footer";
import { BackgroundFX, DeferredPageFallback } from "./PublicLayout";

/**
 * Persistent shell for every ForgeX Academy public page — including the root
 * "/" homepage. Mirrors `PublicLayout` (which now belongs to the Portfolio
 * product) but mounts the Academy navigation and the Academy footer, so no
 * Academy screen can ever show Portfolio chrome.
 */
export function AcademyLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <BackgroundFX />
      <AcademyNav />
      <main className="relative overflow-x-clip pb-24 md:pb-6">
        {children ?? (
          <Suspense fallback={<DeferredPageFallback />}>
            <Outlet />
          </Suspense>
        )}
      </main>
      <Footer product="academy" />
    </div>
  );
}
