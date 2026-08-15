import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  icon,
  label,
  value,
  hint,
  accent = false,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 w-full rounded-2xl border p-5",
        accent
          ? "border-lime-400/25 bg-lime-400/8"
          : "border-white/10 bg-card",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            accent
              ? "bg-lime-400/15 text-lime-300"
              : "bg-white/5 text-muted-foreground",
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-4 font-display text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
      {hint && <p className="mt-2 text-xs text-lime-300/80">{hint}</p>}
    </div>
  );
}
