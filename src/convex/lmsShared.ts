import { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

// ---------------------------------------------------------------------------
// Pure LMS helpers shared by learn.ts (engine) and lms.ts (mutations).
// Type-only imports only — keeps the module graph cycle-free.
// ---------------------------------------------------------------------------

/**
 * Recompute a course's `durationHours` from its lessons' real durations.
 *
 * The authoritative per-lesson length is `videoDurationSeconds` (actual
 * video length once known — YouTube IFrame API, Mux metadata); lessons that
 * haven't reported one yet fall back to the manual `durationMinutes`. The
 * course total therefore updates automatically whenever a lesson's video
 * changes or a real duration is detected — no manual course-level duration
 * entry required.
 */
export async function recomputeCourseDuration(
  ctx: MutationCtx,
  courseId: Id<"courses">,
): Promise<number> {
  const lessons = await ctx.db
    .query("lessons")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();
  let totalSeconds = 0;
  for (const l of lessons) {
    if (l.videoDurationSeconds && l.videoDurationSeconds > 0) {
      totalSeconds += l.videoDurationSeconds;
    } else {
      totalSeconds += (l.durationMinutes ?? 0) * 60;
    }
  }
  const hours = Math.max(0, Math.round((totalSeconds / 3600) * 10) / 10);
  const course = await ctx.db.get(courseId);
  if (course && Math.abs(course.durationHours - hours) > 0.05) {
    await ctx.db.patch(courseId, { durationHours: hours });
  }
  return hours;
}

export const DEFAULT_VIDEO_WATCH_PERCENT = 90;
export const DEFAULT_QUIZ_PASS_PERCENT = 70;

const ALLOWED_WATCH_PERCENTS = [70, 80, 90, 95, 100];

export type Requirements = {
  videoWatchPercent: number;
  requireQuizzes: boolean;
  quizPassPercent: number;
  requireAssignments: boolean;
  requireAllLessons: boolean;
};

/** Resolve a course's completion rules; safe defaults for legacy courses. */
export function courseRequirements(course: Doc<"courses">): Requirements {
  const r = course.completionRequirements;
  return {
    videoWatchPercent: r?.videoWatchPercent ?? DEFAULT_VIDEO_WATCH_PERCENT,
    requireQuizzes: r?.requireQuizzes ?? false,
    quizPassPercent: r?.quizPassPercent ?? DEFAULT_QUIZ_PASS_PERCENT,
    requireAssignments: r?.requireAssignments ?? false,
    requireAllLessons: r?.requireAllLessons ?? true,
  };
}

/** Snap the instructor's chosen watch requirement to an allowed preset. */
export function sanitizeWatchPercent(p: number): number {
  const nearest = ALLOWED_WATCH_PERCENTS.reduce((a, b) =>
    Math.abs(b - p) < Math.abs(a - p) ? b : a,
  );
  return nearest;
}

/** Total unique seconds covered by a flattened [s0,e0,s1,e1,…] range list. */
export function coveredSeconds(ranges: number[]): number {
  if (ranges.length === 0) return 0;
  const sorted: Array<[number, number]> = [];
  for (let i = 0; i + 1 < ranges.length; i += 2) {
    const s = ranges[i];
    const e = ranges[i + 1];
    if (e > s && s >= 0) sorted.push([s, e]);
  }
  sorted.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, e] of sorted) {
    if (curEnd < 0 || s > curEnd) {
      if (curEnd >= 0) total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    } else {
      curEnd = Math.max(curEnd, e);
    }
  }
  if (curEnd >= 0) total += curEnd - curStart;
  return total;
}

/**
 * Effective credited coverage percent for a watch-progress row.
 * Rows with real watched ranges derive their percent from unique coverage
 * (anti-cheat). Legacy rows keep the historical stored percent so existing
 * student progress survives the upgrade untouched.
 */
export function effectiveWatchedPercent(
  row:
    | {
        percent: number;
        watchedRanges?: number[];
        durationSeconds?: number;
      }
    | undefined
    | null,
): number {
  if (!row) return 0;
  // If we have real watched ranges AND a known duration, compute from ranges (anti-cheat).
  if (row.watchedRanges && row.watchedRanges.length > 0 && row.durationSeconds && row.durationSeconds > 0) {
    const covered = coveredSeconds(row.watchedRanges);
    if (covered > 0) {
      return Math.min(
        100,
        Math.round((covered / row.durationSeconds) * 100),
      );
    }
  }
  // Fallback: use stored percent (legacy rows or first-seed rows).
  return Math.min(100, Math.round(row.percent));
}
