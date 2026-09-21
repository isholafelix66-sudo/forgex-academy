/**
 * Monitoring helpers for V8 mutation/query contexts.
 *
 * monitor.ts helpers take an ACTION ctx (node runtime, runMutation). Feature
 * code living in ordinary mutations only has a mutation ctx, so these thin
 * adapters accept a MutationCtx and call the monitorData internals directly.
 *
 * All helpers are self-catching: monitoring failures NEVER break the feature
 * flow that is being monitored.
 */

import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import {
  fingerprintOf,
  newRequestId,
  preview,
  redact,
  securityKind,
  type Severity,
} from "./monitorCore";

const IS_PROD = !!process.env.CONVEX_DEPLOYMENT;

export interface MonitorMetaM {
  userId?: string;
  route?: string;
  requestId?: string;
  meta?: Record<string, unknown>;
}

export interface RecordEventArgsM extends MonitorMetaM {
  module: string;
  action: string;
  status: "success" | "failure";
  latencyMs?: number;
  error?: unknown;
  message?: string;
  severity?: Severity;
}

/** Record a feature event (success or failure) from a mutation. Never throws. */
export async function monitorEventM(ctx: MutationCtx, args: RecordEventArgsM): Promise<string> {
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
    console.warn("[monitor] monitorEventM failed:", err instanceof Error ? err.message : err);
    return requestId;
  }
}

export interface RecordErrorArgsM extends MonitorMetaM {
  module: string;
  action?: string;
  error: unknown;
  severity?: Severity;
}

/** Record an error from a mutation. Never throws. */
export async function monitorErrorM(ctx: MutationCtx, args: RecordErrorArgsM): Promise<string> {
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
  } catch (merr) {
    console.warn("[monitor] monitorErrorM failed:", merr instanceof Error ? merr.message : merr);
    return requestId;
  }
}

export interface RecordSecurityArgsM extends MonitorMetaM {
  module: string;
  action: string;
  message: string;
  severity?: Severity;
}

/** Record a security event from a mutation. Never throws. */
export async function monitorSecurityM(ctx: MutationCtx, args: RecordSecurityArgsM): Promise<string> {
  const requestId = args.requestId || newRequestId();
  try {
    const kind = securityKind(args.action);
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
    console.warn("[monitor] monitorSecurityM failed:", err instanceof Error ? err.message : err);
    return requestId;
  }
}

export interface RecordActivityArgsM extends MonitorMetaM {
  userId?: string;
  actorLabel?: string;
  action: string;
  module: string;
  result?: "success" | "failure";
  resourceType?: string;
  resourceId?: string;
  detail?: string;
}

/** Record an activity row from a mutation. Never throws. */
export async function monitorActivityM(ctx: MutationCtx, args: RecordActivityArgsM): Promise<void> {
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
    console.warn("[monitor] monitorActivityM failed:", err instanceof Error ? err.message : err);
  }
}
