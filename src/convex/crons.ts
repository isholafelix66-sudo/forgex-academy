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

crons.interval("resilience-requeue-retries", { minutes: 1 }, internal.jobs.internalRequeueDueRetries, {});
crons.interval("resilience-process-jobs", { minutes: 1 }, internal.jobs.runDueJobAction, {});
crons.interval("resilience-cleanup", { minutes: 30 }, internal.jobs.cleanupResilience, {});

export default crons;
