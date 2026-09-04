import type { ReactNode } from "react";
import { PublicNav } from "./PublicNav";
import { Footer } from "./Footer";

export function BackgroundFX() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-lime-400/10 blur-3xl animate-pulse-glow" />
      <div className="absolute right-[-12rem] top-1/3 h-80 w-80 rounded-full bg-lime-400/5 blur-3xl" />
      <div className="absolute bottom-[-10rem] left-[-10rem] h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
    </div>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <BackgroundFX />
      <PublicNav />
      <main className="pb-24 md:pb-6 overflow-x-clip">{children}</main>
      <Footer />
    </div>
  );
}
