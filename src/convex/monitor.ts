"use node";

/**
 * ForgeX monitoring persistence layer — node-runtime entry points.
 *
 * Feature modules call the helpers here to record events, errors, security
 * events and activity. Design rules (see monitorCore.ts for the pure logic):
 *
 *  - NEVER let monitoring break the caller: every helper catches its own
 *    errors and only logs to the server console.
 *  - Everything is redacted through monitorCore.redact before persisting.
 *  - Errors are grouped by fingerprint so repeats update ONE row.
 *  - Incident detection + alert dispatch happen transactionally inside
 *    monitorData.ts mutations (works for BOTH mutation and action callers),
 *    and alert emails flow through the EXISTING email queue.
 *
 * PRIVACY: message bodies, AI conversations, passwords and tokens are never
 * persisted — only redacted previews and metadata.
 */

import { internal } from "./_generated/api";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import type { GenericActionCtx } from "convex/server";
import { DataModel } from "./_generated/dataModel";
import {
  fingerprintOf,
  newRequestId,
  preview,
  redact,
  securityKind,
  type Severity,
} from "./monitorCore";

type Ctx = GenericActionCtx<DataModel>;

const IS_PROD = !!process.env.CONVEX_DEPLOYMENT;

export interface MonitorMeta {
  /** Signed-in user id, when the caller has one. */
  userId?: string;
  /** Client route or convex function name, e.g. "submissions:submitAssignment". */
  route?: string;
  /** Correlation id (generated when absent). */
  requestId?: string;
  /** Extra structured metadata — REDACTED before storage. */
  meta?: Record<string, unknown>;
}

export interface RecordEventArgs extends MonitorMeta {
  module: string;
  action: string;
  status: "success" | "failure";
  latencyMs?: number;
  /** On failure: the error (redacted preview is stored). */
  error?: unknown;
  message?: string;
  severity?: Severity;
}

/**
 * Record a feature event. Successes feed usage/health counters; failures
 * also create/update an error group and can trigger incidents.
 * Never throws — monitoring must never break the caller.
 */
export async function monitorEvent(ctx: Ctx, args: RecordEventArgs): Promise<string> {
  const requestId = args.requestId || newRequestId();
  try {
    const at = Date.now();
    if (args.status === "failure") {
      const raw =
        args.error instanceof Error
          ? args.error.message
          : typeof args.error === "string"
            ? args.error
            : (args.message ?? "Operation failed");
      await ctx.runMutation(internal.monitorData.recordErrorWithDetection, {
        kind: "error",
        module: args.module,
        action: args.action,
        message: preview(raw, 300),
        severity: args.severity,
        errorStatus: (args.error as { status?: number } | undefined)?.status,
        route: args.route ? preview(args.route, 120) : undefined,
        userId: args.userId as never,
        requestId,
        env: IS_PROD ? "production" : "development",
        meta: args.meta ? (redact(args.meta) as Record<string, unknown>) : undefined,
        latencyMs: args.latencyMs,
        at,
      });
    } else {
      await ctx.runMutation(internal.monitorData.recordEventRow, {
        module: args.module,
        action: args.action,
        status: "success",
        latencyMs: args.latencyMs,
        userId: args.userId as never,
        requestId,
        route: args.route ? preview(args.route, 120) : undefined,
        meta: args.meta ? (redact(args.meta) as Record<string, unknown>) : undefined,
        at,
      });
    }
    return requestId;
  } catch (err) {
    console.warn("[monitor] monitorEvent failed:", err instanceof Error ? err.message : err);
    return requestId;
  }
}

export interface RecordErrorArgs extends MonitorMeta {
  module: string;
  action?: string;
  error: unknown;
  severity?: Severity;
}

/** Record an error (auto-severity, grouped, incident-aware). Never throws. */
export async function monitorError(ctx: Ctx, args: RecordErrorArgs): Promise<string> {
  const requestId = args.requestId || newRequestId();
  try {
    const err = args.error;
    const rawMessage =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
    await ctx.runMutation(internal.monitorData.recordErrorWithDetection, {
      kind: "error",
      module: args.module,
      action: args.action,
      message: preview(rawMessage, 300),
      severity: args.severity,
      errorStatus: (err as { status?: number })?.status,
      route: args.route ? preview(args.route, 120) : undefined,
      userId: args.userId as never,
      requestId,
      env: IS_PROD ? "production" : "development",
      meta: args.meta ? (redact(args.meta) as Record<string, unknown>) : undefined,
      at: Date.now(),
    });
    return requestId;
  } catch (err) {
    console.warn("[monitor] monitorError failed:", err instanceof Error ? err.message : err);
    return requestId;
  }
}

export interface RecordSecurityArgs extends MonitorMeta {
  module: string;
  action: string;
  message: string;
  severity?: Severity;
}

/**
 * Record a security-relevant event (failed logins, authz failures, rate
 * limits, admin-gate attempts). Grouped per (module, security kind) so spikes
 * auto-open incidents. Never throws.
 */
export async function monitorSecurity(ctx: Ctx, args: RecordSecurityArgs): Promise<string> {
  const requestId = args.requestId || newRequestId();
  try {
    const kind = securityKind(args.action);
    // Security groups fingerprint per (module, kind) — NOT per message — so
    // the group IS the spike detector and the Security page reads cleanly.
    const fingerprint = fingerprintOf({
      module: args.module,
      action: kind,
      message: "",
      kind: "security",
    });
    await ctx.runMutation(internal.monitorData.recordErrorWithDetection, {
      kind: "security",
      module: args.module,
      action: args.action.slice(0, 80),
      fingerprintOverride: fingerprint,
      message: preview(args.message, 300),
      severity: args.severity,
      route: args.route ? preview(args.route, 120) : undefined,
      userId: args.userId as never,
      requestId,
      env: IS_PROD ? "production" : "development",
      meta: args.meta ? (redact(args.meta) as Record<string, unknown>) : undefined,
      at: Date.now(),
    });
    return requestId;
  } catch (err) {
    console.warn("[monitor] monitorSecurity failed:", err instanceof Error ? err.message : err);
    return requestId;
  }
}

export interface RecordActivityArgs extends MonitorMeta {
  userId?: string;
  /** "admin-session", "system", or the user themself. */
  actorLabel?: string;
  action: string; // "user.registered", "assignment.submitted", ...
  module: string;
  result?: "success" | "failure";
  resourceType?: string;
  resourceId?: string;
  detail?: string;
}

/** Record an important platform action in the activity log. Never throws. */
export async function monitorActivity(ctx: Ctx, args: RecordActivityArgs): Promise<void> {
  try {
    await ctx.runMutation(internal.monitorData.recordActivityRow, {
      userId: args.userId as never,
      actorLabel: args.actorLabel ? preview(args.actorLabel, 80) : undefined,
      action: args.action.slice(0, 80),
      module: args.module.slice(0, 40),
      result: args.result ?? "success",
      resourceType: args.resourceType ? preview(args.resourceType, 40) : undefined,
      resourceId: args.resourceId ? preview(args.resourceId, 120) : undefined,
      requestId: args.requestId,
      route: args.route ? preview(args.route, 120) : undefined,
      detail: args.detail ? preview(args.detail, 200) : undefined,
      at: Date.now(),
    });
  } catch (err) {
    console.warn("[monitor] monitorActivity failed:", err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Cron entry points (thin wrappers so crons.ts stays declarative)
// ---------------------------------------------------------------------------

/** Prune old occurrence/heartbeat rows (cron entry). */
export const pruneOldOccurrences = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const deleted = (await ctx.runMutation(internal.monitorData.pruneOccurrencesInternal, {
        olderThan: Date.now() - 14 * 24 * 60 * 60 * 1000,
      })) as number;
      if (deleted > 0) console.log(`[monitor] pruned ${deleted} old occurrence rows`);
      return deleted;
    } catch (err) {
      console.warn("[monitor] prune failed:", err instanceof Error ? err.message : err);
      return 0;
    }
  },
});
