import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  className,
  labelClassName,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  labelClassName?: string;
}) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - (circ * pct) / 100}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <span
        className={cn(
          "absolute text-sm font-bold text-foreground",
          labelClassName,
        )}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}
