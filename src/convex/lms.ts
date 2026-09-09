import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { checkRateLimit, requireUserDoc } from "./lib";
import {
  coveredSeconds,
  courseRequirements,
} from "./lmsShared";
import { autoCompleteWatchedLesson, enrollmentFor } from "./learn";

// ---------------------------------------------------------------------------
// Heartbeat watch tracking — replaces trusting client percentages.
//
// The player sends {positionSeconds, playing} every ~12s. The server credits
// only the span the player genuinely traversed, bounded by elapsed wall-clock
// time (×1.35 buffering tolerance). A seek (jump beyond the allowance) moves
// the frontier WITHOUT credit, so jumping 0%→end earns nothing; rewinding and
// re-watching adds nothing new (ranges are unique). Progress therefore only
// accumulates through actual viewing.
// ---------------------------------------------------------------------------

const HEARTBEAT_WINDOW_MS = 60_000; // ignore stale/gapped heartbeats beyond this
const BUFFER_TOLERANCE = 1.35; // credit up to 135% of wall time (buffering slack)
const MIN_CREDIT_SPAN_S = 0.75; // ignore sub-second jitter

const videoSourceValidator = v.optional(
  v.union(
    v.literal("mux"),
    v.literal("youtube"),
    v.literal("mp4"),
    v.literal("vimeo"),
    v.literal("loom"),
  ),
);

export const watchHeartbeat = mutation({
  args: {
    lessonId: v.id("lessons"),
    positionSeconds: v.number(),
    durationSeconds: v.optional(v.number()),
    playing: v.boolean(),
    /** Which player reported this heartbeat (mux | youtube | mp4 | …). */
    videoSource: videoSourceValidator,
  },
  handler: async (ctx, { lessonId, positionSeconds, durationSeconds, playing, videoSource }) => {
    const user = await requireUserDoc(ctx);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) return { percent: 0 };
    const enrollment = await enrollmentFor(ctx, user._id, lesson.courseId);
    if (!enrollment) return { percent: 0 };

    // Generous limit: one heartbeat per ~12s ≈ 300/hour of real watching.
    const ok = await checkRateLimit(
      ctx,
      `watch:${user._id}`,
      600,
      10 * 60 * 1000,
      "",
      true,
    );
    if (!ok) return { percent: 0 };

    const now = Date.now();
    const pos = Math.max(0, positionSeconds);
    const dur = durationSeconds && durationSeconds > 0 ? durationSeconds : undefined;

    const rows = await ctx.db
      .query("watchProgress")
      .withIndex("by_student_course", (q) =>
        q.eq("studentId", user._id).eq("courseId", lesson.courseId),
      )
      .collect();
    const row = rows.find((r) => r.lessonId === lessonId);

    if (!row || row.watchedRanges === undefined) {
      // First contact (or a legacy percent-only row): seed the tracker at the
      // current position without granting new credit yet. Legacy rows keep
      // their historical percent so old progress survives the upgrade.
      if (row) {
        await ctx.db.patch(row._id, {
          watchedRanges: [],
          positionSeconds: pos,
          durationSeconds: dur ?? row.durationSeconds,
          lastPosition: pos,
          lastSeenAt: now,
          updatedAt: now,
          videoSource: videoSource ?? row.videoSource,
        });
      } else {
        await ctx.db.insert("watchProgress", {
          studentId: user._id,
          courseId: lesson.courseId,
          lessonId,
          percent: 0,
          watchedRanges: [],
          positionSeconds: pos,
          durationSeconds: dur,
          lastPosition: pos,
          lastSeenAt: now,
          updatedAt: now,
          videoSource,
        });
      }
      return { percent: row?.percent ?? 0 };
    }

    const ranges = row.watchedRanges ?? [];
    const effectiveDur = dur ?? row.durationSeconds;
    const lastPos = row.lastPosition ?? pos;
    const lastSeen = row.lastSeenAt ?? now;
    const elapsedMs = now - lastSeen;

    if (!playing || elapsedMs <= 0 || elapsedMs > HEARTBEAT_WINDOW_MS) {
      // Paused / stale / first beat after a long gap → resync, no credit.
      await ctx.db.patch(row._id, {
        positionSeconds: pos,
        durationSeconds: effectiveDur ?? row.durationSeconds,
        lastPosition: pos,
        lastSeenAt: now,
        updatedAt: now,
        videoSource: videoSource ?? row.videoSource,
      });
      return { percent: row.percent };
    }

    const allowance = (elapsedMs / 1000) * BUFFER_TOLERANCE + 2;
    let newRanges = ranges;
    let frontier = lastPos;

    if (pos >= frontier) {
      const span = pos - frontier;
      if (span <= allowance) {
        // Natural continuous playback → credit the traversed span.
        if (span >= MIN_CREDIT_SPAN_S) {
          newRanges = [...ranges, frontier, pos];
          frontier = pos;
        }
      } else {
        // Seek forward: move the frontier, grant nothing for skipped span.
        frontier = pos;
      }
    }
    // Rewind (pos < frontier): coverage already exists; nothing to credit.

    const percent = effectiveDur
      ? Math.min(100, Math.round((coveredSeconds(newRanges) / effectiveDur) * 100))
      : row.percent;

    await ctx.db.patch(row._id, {
      percent,
      watchedRanges: newRanges,
      positionSeconds: pos,
      durationSeconds: effectiveDur ?? row.durationSeconds,
      lastPosition: frontier,
      lastSeenAt: now,
      updatedAt: now,
      videoSource: videoSource ?? row.videoSource,
    });

    // Auto-complete the lesson once credited coverage meets the course's
    // required watch percentage (backend verifies — never client state).
    if (percent > 0) {
      const course = await ctx.db.get(lesson.courseId);
      if (course && percent >= courseRequirements(course).videoWatchPercent) {
        try {
          await autoCompleteWatchedLesson(ctx, user, lessonId);
        } catch {
          // Sequential gate not satisfied yet — they'll finish in order.
        }
      }
    }

    return { percent };
  },
});

/** Save just the resume position (fires on pause/unload — no credit math). */
export const saveWatchPosition = mutation({
  args: {
    lessonId: v.id("lessons"),
    positionSeconds: v.number(),
    durationSeconds: v.optional(v.number()),
    /** Which player reported this position (mux | youtube | mp4 | …). */
    videoSource: videoSourceValidator,
  },
  handler: async (ctx, { lessonId, positionSeconds, durationSeconds, videoSource }) => {
    const user = await requireUserDoc(ctx);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) return;
    const enrollment = await enrollmentFor(ctx, user._id, lesson.courseId);
    if (!enrollment) return;
    const rows = await ctx.db
      .query("watchProgress")
      .withIndex("by_student_course", (q) =>
        q.eq("studentId", user._id).eq("courseId", lesson.courseId),
      )
      .collect();
    const row = rows.find((r) => r.lessonId === lessonId);
    const dur = durationSeconds && durationSeconds > 0 ? durationSeconds : undefined;
    if (row) {
      await ctx.db.patch(row._id, {
        positionSeconds: Math.max(0, positionSeconds),
        durationSeconds: dur ?? row.durationSeconds,
        lastPosition: Math.max(0, positionSeconds),
        lastSeenAt: Date.now(),
        updatedAt: Date.now(),
        videoSource: videoSource ?? row.videoSource,
      });
    } else {
      await ctx.db.insert("watchProgress", {
        studentId: user._id,
        courseId: lesson.courseId,
        lessonId,
        percent: 0,
        watchedRanges: [],
        positionSeconds: Math.max(0, positionSeconds),
        durationSeconds: dur,
        lastPosition: Math.max(0, positionSeconds),
        lastSeenAt: Date.now(),
        updatedAt: Date.now(),
        videoSource,
      });
    }
  },
});
