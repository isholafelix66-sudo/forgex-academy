import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({
  value,
  count,
  size = "sm",
  className,
}: {
  value: number;
  count?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const sizes = { xs: "size-3", sm: "size-3.5", md: "size-4" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              sizes[size],
              i <= Math.round(value)
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-muted-foreground/30",
            )}
          />
        ))}
      </span>
      <span className="text-sm font-semibold text-foreground">
        {value.toFixed(1)}
      </span>
      {typeof count === "number" && (
        <span className="text-xs text-muted-foreground">
          ({count.toLocaleString()})
        </span>
      )}
    </span>
  );
}
