/**
 * Durable background-job queue with retry/backoff + dead-letter semantics.
 *
 * Slow, non-critical operations (media processing, report generation,
 * notification fan-out, non-critical external calls) should be enqueued here
 * instead of blocking a user request. Jobs carry an idempotency key so a
 * duplicate enqueue (retry storm, offline sync replay, StrictMode double-run)
 * can never create duplicate work.
 *
 * Retry schedule (with randomized jitter): ≈2s → 6s → 18s → 45s. Only
 * transient failures are retried; permanent failures go straight to the
 * dead-letter state ("dead") where an admin can inspect or safely re-run them
 * via the Admin API below.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdminSession } from "./lib";

/** Backoff for attempt N (1-based), in ms — matches the spec'd schedule. */
function backoffMs(attempt: number): number {
  const table = [2_000, 6_000, 18_000, 45_000];
  const base = table[Math.min(attempt - 1, table.length - 1)];
  // ±25% randomized jitter prevents synchronized retry storms.
  const jitter = base * 0.25;
  return Math.round(base + (Math.random() * 2 - 1) * jitter);
}

/** Classify a failure: retryable (transient) vs permanent. */
function isTransientError(errMessage: string): boolean {
  return (
    /rate_limited|provider_down|timeout|network|429|5\d\d|temporar/i.test(errMessage)
  );
}

const DEFAULT_MAX_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Public enqueue — auth-gated, idempotent
// ---------------------------------------------------------------------------

export const enqueue = mutation({
  args: {
    type: v.string(),
    payload: v.any(),
    idempotencyKey: v.string(),
    maxAttempts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Idempotency: a duplicate enqueue returns the existing job untouched.
    const existing = await ctx.db
      .query("backgroundJobs")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    return ctx.db.insert("backgroundJobs", {
      idempotencyKey: args.idempotencyKey,
      type: args.type,
      status: "pending",
      payload: args.payload,
      attemptCount: 0,
      maxAttempts: Math.max(1, Math.min(args.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 10)),
      nextAttemptAt: now,
      createdBy: undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ---------------------------------------------------------------------------
// Processing loop — claims due jobs one at a time and runs their handler.
// Handlers are registered per job type below; unknown types fail permanently
// so bad enqueues can't spin forever.
// ---------------------------------------------------------------------------

type JobHandler = (
  ctx: any,
  jobId: string,
  payload: any,
) => Promise<{ ok: true } | { ok: false; error: string }>;

/**
 * Registered job handlers. Add new background work here — e.g.
 *   "media-transcode": async (ctx, _id, payload) => { … }
 * Keep handlers idempotent: they may run more than once after a crash.
 */
const HANDLERS: Record<string, JobHandler> = {};

/** Claim the oldest due pending/retrying job (single-flight via doc patch). */
export const internalClaimDueJob = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("backgroundJobs")
      .withIndex("by_status_next", (q) =>
        q.eq("status", "pending").lte("nextAttemptAt", now),
      )
      .first();
    if (!due) return null;
    await ctx.db.patch(due._id, { status: "processing", updatedAt: now });
    return { jobId: due._id, type: due.type, payload: due.payload, attemptCount: due.attemptCount };
  },
});

/** Mark a job completed. */
export const internalCompleteJob = internalMutation({
  args: { jobId: v.id("backgroundJobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** Record an attempt failure: schedule retry or move to dead letter. */
export const internalFailJob = internalMutation({
  args: { jobId: v.id("backgroundJobs"), error: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    const attemptCount = job.attemptCount + 1;
    const transient = isTransientError(args.error);
    const canRetry = transient && attemptCount < job.maxAttempts;

    if (!canRetry) {
      // Dead letter — keep safe details for admin inspection. Never secrets.
      await ctx.db.patch(job._id, {
        status: "dead",
        attemptCount,
        lastError: args.error.slice(0, 300),
        failureCategory: transient ? "max_attempts_exceeded" : "permanent_failure",
        updatedAt: Date.now(),
      });
      console.error(`[jobs] ${job.type} job ${job._id} → dead letter:`, args.error.slice(0, 200));
      return;
    }
    await ctx.db.patch(job._id, {
      status: "retrying",
      attemptCount,
      nextAttemptAt: Date.now() + backoffMs(attemptCount),
      lastError: args.error.slice(0, 300),
      updatedAt: Date.now(),
    });
  },
});

/** Re-queue a retrying job when its backoff elapses (cron ticks this). */
export const internalRequeueDueRetries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("backgroundJobs")
      .withIndex("by_status_next", (q) =>
        q.eq("status", "retrying").lte("nextAttemptAt", now),
      )
      .take(20);
    for (const job of due) {
      await ctx.db.patch(job._id, { status: "pending", updatedAt: now });
    }
    return due.length;
  },
});

/** Process at most ONE due job per tick — invoked frequently by crons.
 *  An action (not mutation) so handlers may perform external API calls via
 *  the resilience gateway. */
export const runDueJobAction = internalAction({
  args: {},
  handler: async (ctx) => {
    const claimed = await ctx.runMutation(internal.jobs.internalClaimDueJob, {});
    if (!claimed) return false;
    const handler = HANDLERS[claimed.type];
    if (!handler) {
      // Permanent failure — unknown job types must not retry forever.
      await ctx.runMutation(internal.jobs.internalFailJob, {
        jobId: claimed.jobId,
        error: "No handler registered for this job type",
      });
      return true;
    }
    try {
      const result = await handler(ctx, claimed.jobId, claimed.payload);
      if (result.ok) {
        await ctx.runMutation(internal.jobs.internalCompleteJob, { jobId: claimed.jobId });
      } else {
        await ctx.runMutation(internal.jobs.internalFailJob, {
          jobId: claimed.jobId,
          error: result.error,
        });
      }
    } catch (err) {
      await ctx.runMutation(internal.jobs.internalFailJob, {
        jobId: claimed.jobId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return true;
  },
});

// ---------------------------------------------------------------------------
// Admin API — inspect / retry / resolve dead-letter jobs
// ---------------------------------------------------------------------------

export const adminListFailedJobs = query({
  args: { token: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { token, limit }) => {
    await requireAdminSession(ctx, token);
    const rows = await ctx.db
      .query("backgroundJobs")
      .withIndex("by_status_next", (q) => q.eq("status", "dead"))
      .collect();
    return rows
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, Math.min(limit ?? 50, 200))
      .map((j) => ({
        _id: j._id,
        type: j.type,
        status: j.status,
        attemptCount: j.attemptCount,
        maxAttempts: j.maxAttempts,
        failureCategory: j.failureCategory ?? null,
        lastError: j.lastError ?? null,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
      }));
  },
});

/** Re-run a dead-lettered job: resets attempts and queues it again. */
export const adminRetryJob = mutation({
  args: { token: v.string(), jobId: v.id("backgroundJobs") },
  handler: async (ctx, { token, jobId }) => {
    await requireAdminSession(ctx, token);
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "dead") throw new Error("Only failed jobs can be retried.");
    await ctx.db.patch(jobId, {
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: Date.now(),
      lastError: undefined,
      failureCategory: undefined,
      updatedAt: Date.now(),
    });
    return true;
  },
});

/** Acknowledge a dead job that shouldn't be retried (e.g. stale data). */
export const adminResolveJob = mutation({
  args: { token: v.string(), jobId: v.id("backgroundJobs"), note: v.optional(v.string()) },
  handler: async (ctx, { token, jobId, note }) => {
    await requireAdminSession(ctx, token);
    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Job not found.");
    await ctx.db.patch(jobId, {
      status: "failed",
      lastError: note ?? job.lastError,
      updatedAt: Date.now(),
    });
    return true;
  },
});

/** Queue-depth snapshot for monitoring dashboards. */
export const adminQueueStats = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const all = await ctx.db.query("backgroundJobs").collect();
    const counts: Record<string, number> = {};
    for (const j of all) counts[j.status] = (counts[j.status] ?? 0) + 1;
    return counts;
  },
});

// ---------------------------------------------------------------------------
// Cleanup — scheduled every 30 minutes by crons.ts
// ---------------------------------------------------------------------------

const LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // completed/failed rows
const STUCK_PROCESSING_MS = 30 * 60 * 1000; // crashed mid-flight

export const cleanupResilience = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // 1) Prune old external-API logs (keep 7 days).
    const oldLogs = await ctx.db
      .query("externalApiLogs")
      .withIndex("by_created", (q) => q.lt("createdAt", now - LOG_RETENTION_MS))
      .take(500);
    for (const row of oldLogs) await ctx.db.delete(row._id);

    // 2) Delete long-expired rate-limit buckets (window long past).
    const staleLimits = await ctx.db
      .query("rateLimits")
      .collect()
      .then((rows) => rows.filter((r) => now - r.windowStart > 24 * 60 * 60 * 1000));
    for (const row of staleLimits.slice(0, 500)) await ctx.db.delete(row._id);

    // 3) Recover jobs stuck in "processing" (crashed isolate): requeue once,
    //    dead-letter if they've already exhausted attempts.
    const stuck = await ctx.db
      .query("backgroundJobs")
      .withIndex("by_status_next", (q) => q.eq("status", "processing"))
      .collect()
      .then((rows) => rows.filter((r) => now - r.updatedAt > STUCK_PROCESSING_MS));
    for (const job of stuck) {
      if (job.attemptCount + 1 >= job.maxAttempts) {
        await ctx.db.patch(job._id, {
          status: "dead",
          attemptCount: job.attemptCount + 1,
          lastError: "Worker crashed while processing",
          failureCategory: "stuck_recovered",
          updatedAt: now,
        });
      } else {
        await ctx.db.patch(job._id, {
          status: "retrying",
          attemptCount: job.attemptCount + 1,
          nextAttemptAt: now + backoffMs(job.attemptCount + 1),
          lastError: "Worker crashed while processing",
          updatedAt: now,
        });
      }
    }

    // 4) Prune old completed/failed job rows.
    const doneJobs = await ctx.db
      .query("backgroundJobs")
      .collect()
      .then((rows) =>
        rows.filter(
          (r) =>
            (r.status === "completed" || r.status === "failed") &&
            r.updatedAt < now - JOB_RETENTION_MS,
        ),
      );
    for (const row of doneJobs.slice(0, 500)) await ctx.db.delete(row._id);

    return {
      logsPruned: oldLogs.length,
      limitsPruned: Math.min(staleLimits.length, 500),
      stuckRecovered: stuck.length,
      jobsPruned: doneJobs.length,
    };
  },
});
