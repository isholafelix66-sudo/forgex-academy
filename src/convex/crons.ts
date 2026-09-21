import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled resilience maintenance:
 *  - every minute: requeue retried jobs whose backoff elapsed + process one
 *    due background job (cheap no-ops when the queue is empty)
 *  - every 30 min: prune old API logs / expired rate-limit buckets, recover
 *    stuck jobs, and prune finished job rows.
 */
const crons = cronJobs();

crons.interval("resilience-requeue-retries", { minutes: 5 }, internal.jobs.internalRequeueDueRetries, {});
crons.interval("resilience-process-jobs", { minutes: 5 }, internal.jobs.runDueJobAction, {});
crons.interval("resilience-cleanup", { minutes: 30 }, internal.jobs.cleanupResilience, {});

// ---------------------------------------------------------------------------
// Monitoring / System Health center: evaluate real service counters, retain
// occurrence history, and prove the database+write path with a heartbeat.
// Every job is a cheap no-op when there is nothing to do.
// ---------------------------------------------------------------------------
/** Re-evaluate per-service health from real counters (Errors, email, breakers). */
crons.interval("monitor-health-sweep", { minutes: 5 }, internal.monitorData.sweepServiceHealthInternal, {});
/** Heartbeat row — “database” service shows operational only when this lands. */
crons.interval("monitor-heartbeat", { minutes: 5 }, internal.monitorData.heartbeatInternal, {});
/** Prune old occurrences + heartbeats (real-data retention, 14 days). */
crons.interval("monitor-retention", { hours: 6 }, internal.monitor.pruneOldOccurrences, {});

// ---------------------------------------------------------------------------
// Email queue + automations (extend the existing email system; every job is
// a cheap no-op when there is nothing to do, and failures never crash the
// platform — each trigger catches its own errors).
// ---------------------------------------------------------------------------
/** Background drain of the shared email queue (rate-limited batches). */
crons.interval("email-queue-drain", { minutes: 5 }, internal.emailService.processPendingBatch, {});
/** Student course-inactivity reminders (3 / 7 / 14 days). */
crons.interval("email-student-inactivity", { hours: 6 }, internal.emailTriggers.scanStudentInactivity, {});
/** Tutor inactivity check-in. */
crons.interval("email-tutor-inactivity", { hours: 24 }, internal.emailTriggers.scanTutorInactivity, {});
/** Daily admin activity summary. */
crons.interval("email-admin-summary", { hours: 24 }, internal.emailTriggers.sendAdminDailySummary, {});

// ---------------------------------------------------------------------------
// Catalog self-heal: re-runs the idempotent seed so courses added to the
// catalog after a database was first seeded (professional graphic design,
// Photoshop, CapCut, and the AI & modern-work courses) appear automatically.
// Cheap no-op when the catalog is already complete.
// ---------------------------------------------------------------------------
crons.interval("catalog-self-heal", { hours: 12 }, internal.seed.ensureSeedDataInternal, {});

export default crons;
