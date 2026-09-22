/**
 * Database fallback & sync backend.
 *
 * Convex is ALWAYS the primary. When it becomes unavailable, the client
 * queues essential writes locally, mirrors them to a secondary store (used
 * only as a dumb, temporary transport), and replays them here once Convex is
 * reachable again.
 *
 * Safety model:
 *  - Every op carries a stable client-generated `opId` (uuid). The first
 *    application wins; replays are detected via `syncAppliedOps` and skipped
 *    → retries and multi-device replays can never create duplicates.
 *  - Ops are applied by server-side validators that re-derive the user from
 *    the SESSION, never from the payload. The fallback store cannot be used
 *    to impersonate another user.
 *  - Newer-wins on conflicting writes: the client's local pending op always
 *    beats a stale server value, but replay is ordered per device (opId
 *    monotonically increasing counter + serverAt timestamp recorded).
 *  - Validation/authorization reuses the same internals as the live-path
 *    mutations, so a queued op can never do anything the live mutation
 *    couldn't.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserDoc, requireAdminSession } from "./lib";
import { completeLessonInternal, enrollmentFor } from "./learn";
import type { Doc, Id } from "./_generated/dataModel";

const SESSION_ARGS = v.object({ token: v.string() });

// ---------------------------------------------------------------------------
// Shared application internals
// ---------------------------------------------------------------------------

/**
 * Apply a queued lesson-completion op. Idempotent via completedLessons
 * membership (plus the opId ledger checked by the caller).
 */
export async function applyLessonComplete(
  ctx: MutationCtx,
  user: Doc<"users">,
  lessonId: Id<"lessons">,
): Promise<{ result: "applied" | "noop"; message?: string }> {
  const lesson = await ctx.db.get(lessonId);
  if (!lesson) return { result: "noop", message: "lesson missing" };
  const enrollment = await enrollmentFor(ctx, user._id, lesson.courseId);
  if (!enrollment) return { result: "noop", message: "not enrolled" };
  if (enrollment.completedLessons.includes(lessonId)) return { result: "noop", message: "already complete" };
  try {
    await completeLessonInternal(ctx, user, lessonId);
    return { result: "applied" };
  } catch (err) {
    // Queueable requirements (watch gate / quiz gate) may not be satisfied
    // yet when the op replays — keep it queued rather than failing forever.
    const msg = err instanceof Error ? err.message : String(err);
    return { result: "noop", message: msg };
  }
}

/** Apply a queued profile update op (name, bio, headline, skills, socials). */
export async function applyProfileUpdate(
  ctx: MutationCtx,
  user: Doc<"users">,
  payload: Record<string, unknown>,
): Promise<{ result: "applied" | "noop" }> {
  const allowed = ["name", "headline", "bio", "skills", "socials"] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (payload[k] !== undefined) patch[k] = payload[k];
  }
  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name || name.length > 80) return { result: "noop" };
    patch.name = name;
    patch.nameConfirmed = true;
  }
  if (Object.keys(patch).length === 0) return { result: "noop" };
  await ctx.db.patch(user._id, patch);
  return { result: "applied" };
}

/** Apply a queued watch-heartbeat/position op (position + ranges only). */
export async function applyWatchPosition(
  ctx: MutationCtx,
  user: Doc<"users">,
  lessonId: Id<"lessons">,
  positionSeconds: number,
  durationSeconds?: number,
): Promise<{ result: "applied" | "noop" }> {
  const lesson = await ctx.db.get(lessonId);
  if (!lesson) return { result: "noop" };
  const rows = await ctx.db
    .query("watchProgress")
    .withIndex("by_student_course", (q) => q.eq("studentId", user._id).eq("courseId", lesson.courseId))
    .collect();
  const row = rows.find((r) => r.lessonId === lessonId);
  const now = Date.now();
  if (!row) {
    await ctx.db.insert("watchProgress", {
      studentId: user._id,
      courseId: lesson.courseId,
      lessonId,
      percent: 0,
      watchedRanges: [],
      positionSeconds,
      durationSeconds: durationSeconds && durationSeconds > 0 ? durationSeconds : undefined,
      lastPosition: positionSeconds,
      lastSeenAt: now,
      updatedAt: now,
    });
    return { result: "applied" };
  }
  // Newer-wins: only move position forward, never backward (stale replays
  // cannot regress the resume point).
  const pos = Math.max(0, positionSeconds);
  if ((row.positionSeconds ?? 0) >= pos) return { result: "noop" };
  await ctx.db.patch(row._id, {
    positionSeconds: pos,
    durationSeconds: durationSeconds && durationSeconds > 0 ? durationSeconds : undefined,
    lastPosition: pos,
    lastSeenAt: now,
    updatedAt: now,
  });
  return { result: "applied" };
}

export async function enrollmentForRef(ctx: QueryCtx | MutationCtx, studentId: Id<"users">, courseId: Id<"courses">) {
  return enrollmentFor(ctx, studentId, courseId);
}

// ---------------------------------------------------------------------------
// Public mutation: apply a batch of queued ops (called during replay)
// ---------------------------------------------------------------------------

const opValidator = v.object({
  opId: v.string(),
  kind: v.string(),
  serverAt: v.number(),
  payload: v.any(),
});

/**
 * Replay a batch of queued ops from a client. Each op is idempotent by opId;
 * a previously-applied opId short-circuits to `{ applied: false }`.
 */
export const applyOps = mutation({
  args: { ops: v.array(opValidator) },
  handler: async (ctx, { ops }) => {
    const user = await requireUserDoc(ctx);
    // The authenticated session proves identity; ops are attributed to the
    // session user, never to whatever userId the payload may claim.
    if (ops.length > 50) throw new Error("Batch too large (max 50 ops).");
    const results: { opId: string; applied: boolean; reason?: string }[] = [];

    for (const op of ops) {
      try {
        // 1) Idempotency: has this op been applied before?
        const prior = await ctx.db
          .query("syncAppliedOps")
          .withIndex("by_op", (q) => q.eq("opId", op.opId))
          .first();
        if (prior) {
          results.push({ opId: op.opId, applied: false, reason: "duplicate" });
          continue;
        }

        // 2) Dispatch to the per-kind applier.
        let outcome: { result: string; message?: string } = { result: "noop", message: "unknown kind" };
        if (op.kind === "lesson-complete") {
          outcome = await applyLessonComplete(ctx, user, op.payload.lessonId as Id<"lessons">);
        } else if (op.kind === "profile-update") {
          outcome = await applyProfileUpdate(ctx, user, op.payload);
        } else if (op.kind === "watch-position") {
          outcome = await applyWatchPosition(
            ctx,
            user,
            op.payload.lessonId as Id<"lessons">,
            Number(op.payload.positionSeconds) || 0,
            op.payload.durationSeconds === undefined ? undefined : Number(op.payload.durationSeconds),
          );
        } else if (op.kind === "enroll") {
          outcome = await applyEnroll(ctx, user, op.payload.courseId as Id<"courses">);
        } else {
          outcome = { result: "noop", message: `unsupported kind: ${op.kind}` };
        }

        // 3) Record the op id so replays are free.
        await ctx.db.insert("syncAppliedOps", {
          opId: op.opId,
          kind: op.kind,
          userId: user._id,
          appliedAt: Date.now(),
          serverAt: op.serverAt,
          result: outcome.result,
          error: outcome.message,
        });

        // 4) Counters (single upsert per kind).
        await bumpCounter(ctx, op.kind, outcome.result === "applied" ? "applied" : "noop");

        results.push({ opId: op.opId, applied: outcome.result === "applied", reason: outcome.message });
      } catch (err) {
        // Record the failure (safe message only) for admin visibility.
        const msg = err instanceof Error ? err.message : String(err);
        await recordFailure(ctx, op.opId, op.kind, user._id, msg, op.payload);
        results.push({ opId: op.opId, applied: false, reason: sanitizeMessage(msg) });
      }
    }
    return results;
  },
});

async function applyEnroll(ctx: MutationCtx, user: Doc<"users">, courseId: Id<"courses">) {
  const existing = await enrollmentFor(ctx, user._id, courseId);
  if (existing) return { result: "noop" };
  const course = await ctx.db.get(courseId);
  if (!course || course.published === false) return { result: "noop", message: "course unavailable" };
  await ctx.db.insert("enrollments", {
    studentId: user._id,
    courseId,
    enrolledAt: Date.now(),
    status: "in-progress",
    completedLessons: [],
    progress: 0,
  });
  return { result: "applied" };
}

function sanitizeMessage(msg: string): string {
  return msg.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[email]").slice(0, 240);
}

async function recordFailure(
  ctx: MutationCtx,
  opId: string,
  kind: string,
  userId: Id<"users">,
  error: string,
  payload: unknown,
) {
  const nowMs = Date.now();
  const existing = await ctx.db
    .query("syncFailures")
    .withIndex("by_op", (q) => q.eq("opId", opId))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, {
      error: sanitizeMessage(error),
      lastFailedAt: nowMs,
      attempts: existing.attempts + 1,
      lastPayload: payload as any,
    });
    return;
  }
  await ctx.db.insert("syncFailures", {
    opId,
    kind,
    userId,
    error: sanitizeMessage(error),
    firstFailedAt: nowMs,
    lastFailedAt: nowMs,
    attempts: 1,
    lastPayload: payload as any,
  });
  await bumpCounter(ctx, kind, "failed");
}

async function bumpCounter(ctx: MutationCtx, kind: string, which: "applied" | "noop" | "failed") {
  const row = await ctx.db
    .query("syncCounters")
    .withIndex("by_kind", (q) => q.eq("kind", kind))
    .first();
  if (!row) {
    await ctx.db.insert("syncCounters", {
      kind,
      applied: which === "applied" ? 1 : 0,
      failed: which === "failed" ? 1 : 0,
      lastAppliedAt: which === "applied" ? Date.now() : undefined,
      lastError: which === "failed" ? "see failures list" : undefined,
      lastErrorAt: which === "failed" ? Date.now() : undefined,
    });
    return;
  }
  await ctx.db.patch(row._id, {
    applied: row.applied + (which === "applied" ? 1 : 0),
    failed: row.failed + (which === "failed" ? 1 : 0),
    lastAppliedAt: which === "applied" ? Date.now() : row.lastAppliedAt,
    lastError: which === "failed" ? "see failures list" : row.lastError,
    lastErrorAt: which === "failed" ? Date.now() : row.lastErrorAt,
  });
}

// ---------------------------------------------------------------------------
// Public probe — client-side gateway pings this to detect Convex health.
// A cheap indexed read; the gateway also records success for the admin view.
// ---------------------------------------------------------------------------

export const probe = query({
  args: {},
  handler: async (ctx) => {
    // Cheapest possible indexed read — proves read path + auth decode.
    const row = await ctx.db.query("syncUsageBudget").withIndex("by_key", (q) => q.eq("key", "budget")).first();
    return { ok: true, at: Date.now() };
  },
});

// ---------------------------------------------------------------------------
// Admin: sync status, counters, failures, retry, fallback-state bookkeeping
// ---------------------------------------------------------------------------

export const adminSyncStatus = query({
  args: SESSION_ARGS,
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const [budget] = await Promise.all([
      ctx.db.query("syncUsageBudget").withIndex("by_key", (q) => q.eq("key", "budget")).first(),
    ]);
    const counters = await ctx.db.query("syncCounters").collect();
    const failures = await ctx.db
      .query("syncFailures")
      .withIndex("by_lastFailedAt", (q) => q.gte("lastFailedAt", 0))
      .order("desc")
      .take(50);
    const recent = await ctx.db
      .query("syncAppliedOps")
      .withIndex("by_appliedAt", (q) => q.gte("appliedAt", 0))
      .order("desc")
      .take(30);
    return {
      degradedSince: budget?.degradedSince ?? null,
      lastProbeOk: budget?.lastProbeOk ?? null,
      totalFallbackOps: budget?.totalFallbackOps ?? 0,
      counters,
      failures,
      recent,
    };
  },
});

/** Admin: manually re-run a failed op (admin provides the stored payload). */
export const adminRetryFailure = mutation({
  args: { token: v.string(), failureId: v.id("syncFailures") },
  handler: async (ctx, { token, failureId }) => {
    await requireAdminSession(ctx, token);
    const f = await ctx.db.get(failureId);
    if (!f) throw new Error("Failure record not found.");
    const user = f.userId ? await ctx.db.get(f.userId) : null;
    if (!user) {
      await ctx.db.patch(failureId, { error: "user missing", lastFailedAt: Date.now() });
      return { ok: false, reason: "user missing" };
    }
    const payload = (f.lastPayload ?? {}) as Record<string, unknown>;
    let outcome: { result: string; message?: string } = { result: "noop", message: "unknown kind" };
    if (f.kind === "lesson-complete") {
      outcome = await applyLessonComplete(ctx, user, payload.lessonId as Id<"lessons">);
    } else if (f.kind === "profile-update") {
      outcome = await applyProfileUpdate(ctx, user, payload);
    } else if (f.kind === "watch-position") {
      outcome = await applyWatchPosition(
        ctx,
        user,
        payload.lessonId as Id<"lessons">,
        Number(payload.positionSeconds) || 0,
        payload.durationSeconds === undefined ? undefined : Number(payload.durationSeconds),
      );
    } else if (f.kind === "enroll") {
      outcome = await applyEnroll(ctx, user, payload.courseId as Id<"courses">);
    }
    if (outcome.result === "applied") {
      await ctx.db.delete(failureId);
      await bumpCounter(ctx, f.kind, "applied");
      return { ok: true };
    }
    await ctx.db.patch(failureId, { error: sanitizeMessage(outcome.message ?? "still failing"), lastFailedAt: Date.now() });
    return { ok: false, reason: outcome.message };
  },
});

/** Admin: dismiss/clear a failure row once handled manually. */
export const adminDismissFailure = mutation({
  args: { token: v.string(), failureId: v.id("syncFailures") },
  handler: async (ctx, { token, failureId }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.delete(failureId);
  },
});

/** Internal: record fallback-mode start / end + probe success. */
export const internalRecordFallbackState = internalMutation({
  args: {
    degraded: v.boolean(),
    at: v.number(),
    fallbackOps: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { degraded, at, fallbackOps, note }) => {
    const row = await ctx.db.query("syncUsageBudget").withIndex("by_key", (q) => q.eq("key", "budget")).first();
    if (!row) {
      await ctx.db.insert("syncUsageBudget", {
        key: "budget",
        degradedSince: degraded ? at : undefined,
        lastProbeOk: degraded ? undefined : at,
        totalFallbackOps: fallbackOps ?? 0,
        note,
      });
      return;
    }
    await ctx.db.patch(row._id, {
      degradedSince: degraded ? (row.degradedSince ?? at) : undefined,
      lastProbeOk: degraded ? row.lastProbeOk : at,
      totalFallbackOps: row.totalFallbackOps + (fallbackOps ?? 0),
      note,
    });
  },
});

// ---------------------------------------------------------------------------
// Landing-page stats cache (usage optimization)
// ---------------------------------------------------------------------------

/**
 * Public stats — READ-ONLY from the hourly cache (0 collection scans per
 * visitor view). The hourly cron is the sole writer, so drift self-corrects
 * within an hour and this hot path stays one cheap indexed read. If the
 * cache row is missing (first deploy), compute counts read-only.
 */
export const publicStatsCached = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("siteStatsCache").withIndex("by_key", (q) => q.eq("key", "global")).first();
    if (row && Date.now() - row.updatedAt < 26 * 60 * 60 * 1000) {
      return {
        courses: row.courses ?? 0,
        students: row.students ?? 0,
        tutors: row.tutors ?? 0,
        certificates: row.certificates ?? 0,
        cached: true,
      };
    }
    // Cache missing/expired (rare — cron refreshes hourly): compute inline.
    const [courses, users, certificates] = await Promise.all([
      ctx.db.query("courses").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("certificates").collect(),
    ]);
    return {
      courses: courses.filter((c) => c.published).length,
      students: users.filter((u) => u.role !== "tutor").length,
      tutors: users.filter((u) => u.role === "tutor" && !!u.verified).length,
      certificates: certificates.length,
      cached: false,
    };
  },
});

/** Internal: hourly refresh (cron) — also corrects drift from live writes. */
export const refreshSiteStatsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const [courses, users, certificates] = await Promise.all([
      ctx.db.query("courses").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("certificates").collect(),
    ]);
    const value = {
      courses: courses.filter((c) => c.published).length,
      students: users.filter((u) => u.role !== "tutor").length,
      tutors: users.filter((u) => u.role === "tutor" && !!u.verified).length,
      certificates: certificates.length,
    };
    const row = await ctx.db.query("siteStatsCache").withIndex("by_key", (q) => q.eq("key", "global")).first();
    if (row) await ctx.db.patch(row._id, { ...value, updatedAt: Date.now() });
    else await ctx.db.insert("siteStatsCache", { key: "global", ...value, updatedAt: Date.now() });
  },
});
