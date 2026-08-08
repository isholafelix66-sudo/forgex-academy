import { cn } from "@/lib/utils";
import { DIFFICULTY_META, type Difficulty } from "@/lib/format";

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  const meta = DIFFICULTY_META[difficulty] ?? DIFFICULTY_META.beginner;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        meta.badge,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}
