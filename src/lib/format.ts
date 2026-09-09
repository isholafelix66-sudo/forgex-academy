/** Formatting + small presentation helpers shared across the app. */

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(ts);
}

export function formatHours(hours: number): string {
  if (hours >= 24) {
    const d = Math.round(hours / 8);
    return `${d}wks`;
  }
  return `${Math.round(hours)}h`;
}

/** Smart human duration: 45 sec / 12 min / 1 hr / 1 hr 12 min / 2 hr 5 min. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s <= 0) return "";
  if (s < 60) return `${s} sec`;
  const totalMin = Math.round(s / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

/** Authoritative per-lesson length in seconds: the real video duration when
 *  known, otherwise the manually entered minutes. 0 = unknown. */
export function lessonDurationSeconds(lesson: {
  videoDurationSeconds?: number | null;
  durationMinutes?: number | null;
}): number {
  if (lesson.videoDurationSeconds && lesson.videoDurationSeconds > 0) {
    return lesson.videoDurationSeconds;
  }
  return (lesson.durationMinutes ?? 0) * 60;
}

export function formatLessonDuration(lesson: {
  videoDurationSeconds?: number | null;
  durationMinutes?: number | null;
}): string {
  return formatDuration(lessonDurationSeconds(lesson));
}

/** Sum of every lesson's real duration (falls back to manual minutes). */
export function courseDurationSeconds(
  lessons: Array<{
    videoDurationSeconds?: number | null;
    durationMinutes?: number | null;
  }>,
): number {
  return lessons.reduce((sum, l) => sum + lessonDurationSeconds(l), 0);
}

/** Course total from its lessons, with a fallback to the stored durationHours
 *  (used only when every lesson is missing a duration). */
export function formatCourseDuration(
  lessons: Array<{
    videoDurationSeconds?: number | null;
    durationMinutes?: number | null;
  }>,
  fallbackHours?: number,
): string {
  const total = courseDurationSeconds(lessons);
  if (total > 0) return formatDuration(total);
  return fallbackHours ? formatHours(fallbackHours) : "";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function plural(n: number, word: string, pluralWord?: string) {
  return `${n} ${n === 1 ? word : (pluralWord ?? `${word}s`)}`;
}

export type Difficulty =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "professional"
  | "expert";

export const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; badge: string; dot: string }
> = {
  beginner: {
    label: "Beginner",
    badge: "border-lime-400/30 bg-lime-400/10 text-lime-300",
    dot: "bg-lime-400",
  },
  intermediate: {
    label: "Intermediate",
    badge: "border-sky-400/30 bg-sky-400/10 text-sky-300",
    dot: "bg-sky-400",
  },
  advanced: {
    label: "Advanced",
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    dot: "bg-amber-400",
  },
  professional: {
    label: "Professional",
    badge: "border-violet-400/30 bg-violet-400/10 text-violet-300",
    dot: "bg-violet-400",
  },
  expert: {
    label: "Expert",
    badge: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    dot: "bg-rose-400",
  },
};

export const GRADIENTS: Record<string, string> = {
  lime: "from-lime-400/40 via-lime-500/15 to-transparent",
  violet: "from-violet-500/40 via-violet-600/15 to-transparent",
  cyan: "from-cyan-400/40 via-cyan-500/15 to-transparent",
  amber: "from-amber-400/40 via-amber-500/15 to-transparent",
  rose: "from-rose-400/40 via-rose-500/15 to-transparent",
  sky: "from-sky-400/40 via-sky-500/15 to-transparent",
  fuchsia: "from-fuchsia-400/40 via-fuchsia-500/15 to-transparent",
};

export const GLOW: Record<string, string> = {
  lime: "bg-lime-400/25",
  violet: "bg-violet-500/25",
  cyan: "bg-cyan-400/25",
  amber: "bg-amber-400/25",
  rose: "bg-rose-400/25",
  sky: "bg-sky-400/25",
  fuchsia: "bg-fuchsia-400/25",
};

export function coverClass(gradient?: string | null): string {
  return GRADIENTS[gradient ?? ""] ?? GRADIENTS.lime;
}

export function glowClass(gradient?: string | null): string {
  return GLOW[gradient ?? ""] ?? GLOW.lime;
}

export function daysUntil(ts: number): number {
  return Math.ceil((ts - Date.now()) / 86400000);
}
