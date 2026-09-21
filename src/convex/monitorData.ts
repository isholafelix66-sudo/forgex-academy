/**
 * Monitoring data layer (V8 runtime queries/mutations).
 *
 * monitor.ts (node runtime) orchestrates; this module does the actual DB
 * reads/writes. All writes are additive and self-contained: a failure here
 * is caught by the caller and NEVER propagates into feature flows.
 *
 * Everything is indexed for cheap aggregation — no unbounded table scans on
 * hot paths.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, query, mutation, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdminSession } from "./lib";
import {
  classifySeverity,
  fingerprintOf,
  incidentIsFresh,
  ruleFor,
  securityKind,
  securityRuleFor,
  DEFAULT_ALERT_RULES,
  alertRuleKeyFor,
  preview,
  type Severity,
  type SecurityKind,
} from "./monitorCore";

// ---------------------------------------------------------------------------
// Write-side internals (called from monitor.ts actions)
// ---------------------------------------------------------------------------

/** Record a feature event (success or failure) + update health counters. */
export const recordEventRow = internalMutation({
  args: {
    module: v.string(),
    action: v.string(),
    status: v.union(v.literal("success"), v.literal("failure")),
    latencyMs: v.optional(v.number()),
    userId: v.optional(v.id("users")),
    requestId: v.string(),
    route: v.optional(v.string()),
    meta: v.optional(v.any()),
    at: v.number(),
  },
  handler: async (ctx, args) => {
    // Success/failure counters live in monitorActivity (result field) so the
    // health evaluator can aggregate a module's ok/fail with one index.
    await ctx.db.insert("monitorActivity", {
      userId: args.userId,
      action: `event.${args.module}.${args.action}`,
      module: args.module,
      result: args.status,
      requestId: args.requestId,
      route: args.route,
      detail: args.meta ? JSON.stringify(args.meta).slice(0, 180) : undefined,
      at: args.at,
    });
  },
});

/**
 * Unified error/security recorder with transactional incident detection.
 *
 * Called from BOTH monitor.ts (action callers) and direct mutation callers
 * (feature modules without an action ctx) — detection runs in the same
 * transaction as the occurrence insert, so counts are exact and incidents
 * dedupe correctly under concurrency.
 */
export const recordErrorWithDetection = internalMutation({
  args: {
    kind: v.union(v.literal("error"), v.literal("security")),
    module: v.string(),
    action: v.optional(v.string()),
    /** Security events pass a kind-level fingerprint (module+security kind). */
    fingerprintOverride: v.optional(v.string()),
    message: v.string(),
    severity: v.optional(
      v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low"),
      ),
    ),
    errorStatus: v.optional(v.number()),
    route: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    requestId: v.string(),
    env: v.optional(v.string()),
    meta: v.optional(v.any()),
    latencyMs: v.optional(v.number()),
    at: v.number(),
  },
  handler: async (ctx, args) => {
    // ---- 1) Group + persist ------------------------------------------------
    const severity: Severity = classifySeverity({
      module: args.module,
      message: args.message,
      explicit: args.severity,
      status: args.errorStatus,
    });

    const fingerprint =
      args.fingerprintOverride ??
      fingerprintOf({
        module: args.module,
        action: args.action,
        message: args.message,
        kind: args.kind,
      });

    const securityKindLabel =
      args.kind === "security" ? securityKind(args.action ?? "") : undefined;
    const title =
      args.kind === "security"
        ? preview(`${args.module}: ${securityKindLabel} — ${args.message}`, 140)
        : preview(
            args.action
              ? `${args.module}: ${args.action} failed — ${args.message}`
              : `${args.module} error — ${args.message}`,
            140,
          );

    const existing = await ctx.db
      .query("monitorErrors")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint))
      .first();

    if (existing) {
      // Upgrade severity, never downgrade an existing group.
      const rank = { low: 0, medium: 1, high: 2, critical: 3 } as const;
      const groupSeverity =
        rank[severity] > rank[existing.severity] ? severity : existing.severity;
      await ctx.db.patch(existing._id, {
        severity: groupSeverity,
        lastMessage: args.message,
        sampleMeta: args.meta ?? existing.sampleMeta,
        occurrences: existing.occurrences + 1,
        lastSeenAt: args.at,
        route: args.route ?? existing.route,
        requestId: args.requestId,
        env: args.env ?? existing.env,
        resolvedAt: undefined, // a new occurrence re-opens the group
      });
    } else {
      await ctx.db.insert("monitorErrors", {
        fingerprint,
        module: args.module,
        action: args.action,
        kind: args.kind,
        severity,
        title,
        lastMessage: args.message,
        sampleMeta: args.meta,
        occurrences: 1,
        firstSeenAt: args.at,
        lastSeenAt: args.at,
        route: args.route,
        requestId: args.requestId,
        env: args.env,
      });
    }

    await ctx.db.insert("monitorOccurrences", {
      fingerprint,
      module: args.module,
      severity,
      kind: args.kind,
      message: args.message,
      meta: args.meta,
      userId: args.userId,
      route: args.route,
      requestId: args.requestId,
      env: args.env,
      at: args.at,
    });

    // ---- 2) Incident detection (transactional, deduped) --------------------
    try {
      await detectIncidentFor(ctx, {
        kind: args.kind,
        fingerprint,
        module: args.module,
        action: args.action,
        securityKindLabel,
        severity,
        title,
        message: args.message,
        route: args.route,
        at: args.at,
      });
    } catch (err) {
      console.warn("[monitor] incident detection failed:", err instanceof Error ? err.message : err);
    }
  },
});

interface DetectInput {
  kind: "error" | "security";
  fingerprint: string;
  module: string;
  action?: string;
  securityKindLabel?: SecurityKind;
  severity: Severity;
  title: string;
  message: string;
  route?: string;
  at: number;
}

/**
 * Evaluate incident thresholds for one occurrence and open/touch incidents.
 * Security events use kind-level fingerprints + their own (lower) thresholds;
 * regular errors use module rules. Runs inside the caller's transaction.
 */
async function detectIncidentFor(ctx: MutationCtx, input: DetectInput): Promise<void> {
  const now = input.at;

  let rule: { occurrences: number; windowMs: number; minSeverity: Severity; title: string; ruleKey: string } | null = null;
  if (input.kind === "security") {
    const sr = input.securityKindLabel ? securityRuleFor(input.securityKindLabel) : null;
    if (sr) {
      rule = {
        occurrences: sr.occurrences,
        windowMs: sr.windowMs,
        minSeverity: sr.minSeverity,
        title: sr.title,
        ruleKey: `security:${input.securityKindLabel}`,
      };
    }
  } else {
    const r = ruleFor(input.module, input.severity);
    if (r) {
      rule = {
        occurrences: r.occurrences,
        windowMs: r.windowMs,
        minSeverity: r.minSeverity,
        title: r.title,
        ruleKey: `incident:${r.module}`,
      };
    }
  }
  if (!rule) return;
  if (
    { low: 0, medium: 1, high: 2, critical: 3 }[input.severity] <
    { low: 0, medium: 1, high: 2, critical: 3 }[rule.minSeverity]
  ) {
    return;
  }

  // Windowed occurrence count for THIS fingerprint (indexed, bounded).
  const since = now - rule.windowMs;
  const recent = await ctx.db
    .query("monitorOccurrences")
    .withIndex("by_fingerprint_at", (q) =>
      q.eq("fingerprint", input.fingerprint).gte("at", since),
    )
    .take(400);
  if (recent.length < rule.occurrences) return;

  const users = new Set<string>();
  for (const row of recent) if (row.userId) users.add(row.userId);
  const firstSeenAt = recent[0].at;
  const lastSeenAt = recent[recent.length - 1].at;

  // Open/incidents absorb fresh hits instead of duplicating.
  const anyOpen =
    (await ctx.db
      .query("monitorIncidents")
      .withIndex("by_fingerprint_status", (q) =>
        q.eq("fingerprint", input.fingerprint).eq("status", "open"),
      )
      .first()) ??
    (await ctx.db
      .query("monitorIncidents")
      .withIndex("by_fingerprint_status", (q) =>
        q.eq("fingerprint", input.fingerprint).eq("status", "investigating"),
      )
      .first()) ??
    (await ctx.db
      .query("monitorIncidents")
      .withIndex("by_fingerprint_status", (q) =>
        q.eq("fingerprint", input.fingerprint).eq("status", "acknowledged"),
      )
      .first());

  if (anyOpen) {
    if (incidentIsFresh(anyOpen.lastSeenAt, now)) {
      await ctx.db.patch(anyOpen._id, { lastSeenAt: now });
      return;
    }
    // Stale open incident (no hits for 30+ min): close it out as resolved
    // before opening the new one, so the history stays truthful.
    await ctx.db.patch(anyOpen._id, {
      status: "resolved",
      resolvedAt: now,
      resolvedBy: "auto (stale)",
    });
    await ctx.db.insert("monitorIncidentEvents", {
      incidentId: anyOpen._id,
      type: "status",
      fromStatus: anyOpen.status,
      toStatus: "resolved",
      by: "system",
      note: "Auto-resolved: no new occurrences for 30 minutes.",
      at: now,
    });
  }

  // ---- Open the new incident -------------------------------------------
  const latest = await ctx.db
    .query("monitorIncidents")
    .withIndex("by_detected", (q) => q.gt("detectedAt", 0))
    .order("desc")
    .first();
  const number = (latest?.number ?? 0) + 1;
  const incidentTitle = rule.title
    .replace("{module}", input.module)
    .replace("{action}", input.action ?? "operation");

  const incidentId = await ctx.db.insert("monitorIncidents", {
    number,
    title: incidentTitle,
    fingerprint: input.fingerprint,
    module: input.module,
    action: input.action,
    severity: input.severity,
    status: "open",
    ruleKey: `${rule.ruleKey}:${rule.occurrences}/${Math.round(rule.windowMs / 60_000)}m`,
    occurrences: recent.length,
    affectedUsers: users.size,
    sampleMessage: input.message,
    route: input.route,
    firstSeenAt,
    lastSeenAt,
    detectedAt: now,
  });

  await ctx.db.insert("monitorIncidentEvents", {
    incidentId,
    type: "detected",
    note: `Auto-detected: ${recent.length} occurrences in ${Math.round(rule.windowMs / 60_000)} min${users.size ? `, ${users.size} user(s) affected` : ""}`,
    at: now,
  });

  // ---- Alerts (email via the EXISTING queue + in-app row) ---------------
  try {
    await dispatchAlerts(ctx, {
      ruleKey: alertRuleKeyFor({
        kind: input.kind,
        module: input.module,
        securityKind: input.securityKindLabel,
      }),
      fingerprint: input.fingerprint,
      incidentId,
      number,
      severity: input.severity,
      title: `#${number} ${incidentTitle}`,
      summary: input.message,
      at: now,
    });
  } catch (err) {
    console.warn("[monitor] alert dispatch failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Fire alerts for a new incident: in-app row + email through the existing
 * email queue (queueSystemEmail resolves no recipients from a blank "to", so
 * we resolve staff recipients here like emailTriggers does).
 */
async function dispatchAlerts(
  ctx: MutationCtx,
  args: {
    ruleKey: string;
    fingerprint: string;
    incidentId: string;
    number: number;
    severity: Severity;
    title: string;
    summary: string;
    at: number;
  },
): Promise<void> {
  // Resolve config: DB row wins over the pure defaults.
  const candidates = [args.ruleKey, "incident:*"];
  let config: { key: string; enabled: boolean; minSeverity: Severity; cooldownMinutes: number } | null = null;
  for (const key of candidates) {
    const row = await ctx.db
      .query("monitorAlertRules")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    const def = DEFAULT_ALERT_RULES.find((r) => r.key === key);
    if (row || def) {
      config = {
        key,
        enabled: row?.enabled ?? true,
        minSeverity: (row?.minSeverity as Severity | undefined) ?? def?.minSeverity ?? "high",
        cooldownMinutes: row?.cooldownMinutes ?? def?.cooldownMinutes ?? 60,
      };
      break;
    }
  }
  if (!config || !config.enabled) return;
  const rank = { low: 0, medium: 1, high: 2, critical: 3 } as const;
  if (rank[args.severity] < rank[config.minSeverity]) return;

  // Cooldown claim.
  const cooldownKey = `${config.key}:${args.fingerprint}`;
  const state = await ctx.db
    .query("monitorAlertState")
    .withIndex("by_key", (q) => q.eq("key", cooldownKey))
    .first();
  if (state && args.at - state.lastSentAt < config.cooldownMinutes * 60_000) return;
  if (state) await ctx.db.patch(state._id, { lastSentAt: args.at });
  else await ctx.db.insert("monitorAlertState", { key: cooldownKey, lastSentAt: args.at });

  // In-app alert row.
  await ctx.db.insert("monitorAlerts", {
    ruleKey: config.key,
    fingerprint: args.fingerprint,
    incidentId: args.incidentId as never,
    severity: args.severity,
    title: preview(args.title, 140),
    summary: preview(args.summary, 300),
    channel: "inapp",
    deliveredAt: args.at,
  });

  // Email through the EXISTING queue — staff recipients resolved like
  // emailTriggers does (registered account emails of admins/team roles).
  const staff = (await ctx.db.query("users").collect())
    .filter((u) => !u.suspended && (u.role === "admin" || u.role === "owner" || !!u.teamRole))
    .map((u) => ({ id: u._id as string, email: (u as { email?: string }).email }))
    .filter((m): m is { id: string; email: string } => !!m.email)
    .slice(0, 20);
  if (staff.length === 0) return;

  const colors: Record<Severity, string> = {
    critical: "#ef4444",
    high: "#f59e0b",
    medium: "#eab308",
    low: "#84cc16",
  };
  const html = `<div style="background:#0b0e0a;color:#e5e7eb;font-family:Arial,sans-serif;padding:24px;border-radius:12px;max-width:560px">
  <div style="border-left:4px solid ${colors[args.severity]};padding-left:14px;margin-bottom:14px">
    <div style="font-size:12px;letter-spacing:2px;color:#a3e635;text-transform:uppercase">ForgeX monitoring</div>
    <h1 style="font-size:18px;margin:6px 0">${args.title}</h1>
    <div style="font-size:12px;color:#9ca3af">Severity: ${args.severity.toUpperCase()}</div>
  </div>
  <p style="font-size:14px;line-height:1.5;color:#d1d5db">${args.summary}</p>
  <p style="font-size:12px;color:#9ca3af">Incident #${args.number} — open Admin &rarr; System &rarr; Incidents to investigate and update its status.</p>
</div>`;

  for (const member of staff) {
    await ctx.runMutation(internal.emailData.queueSystemEmail, {
      to: member.email,
      subject: `[ForgeX Alert] ${preview(args.title, 90)}`,
      html,
      emailType: "monitor_alert",
      priority: args.severity === "critical" ? "critical" : "high",
      dedupeKey: `monitor-alert:${args.incidentId}:${member.email}`,
    });
  }
}

/**
 * Windowed occurrence counts for a fingerprint + open-incident state.
 * Uses the fingerprint index — bounded by the window (limit 400).
 */
export const incidentStateFor = internalQuery({
  args: { fingerprint: v.string(), windowMs: v.number() },
  handler: async (ctx, args) => {
    const since = Date.now() - args.windowMs;
    const recent = await ctx.db
      .query("monitorOccurrences")
      .withIndex("by_fingerprint_at", (q) =>
        q.eq("fingerprint", args.fingerprint).gte("at", since),
      )
      .take(400);

    const users = new Set<string>();
    for (const row of recent) {
      if (row.userId) users.add(row.userId);
    }
    const firstSeenAt = recent.length ? recent[0].at : Date.now();
    const lastSeenAt = recent.length ? recent[recent.length - 1].at : Date.now();

    const openIncident = await ctx.db
      .query("monitorIncidents")
      .withIndex("by_fingerprint_status", (q) =>
        q.eq("fingerprint", args.fingerprint).eq("status", "open"),
      )
      .first();
    let openIncidentId = openIncident?._id ?? null;
    let openLastSeenAt = openIncident?.lastSeenAt ?? null;
    if (!openIncident) {
      // investigating/acknowledged incidents also stay open.
      const investigating = await ctx.db
        .query("monitorIncidents")
        .withIndex("by_fingerprint_status", (q) =>
          q.eq("fingerprint", args.fingerprint).eq("status", "investigating"),
        )
        .first();
      const acknowledged = investigating
        ? null
        : await ctx.db
            .query("monitorIncidents")
            .withIndex("by_fingerprint_status", (q) =>
              q.eq("fingerprint", args.fingerprint).eq("status", "acknowledged"),
            )
            .first();
      const anyOpen = investigating ?? acknowledged;
      openIncidentId = anyOpen?._id ?? null;
      openLastSeenAt = anyOpen?.lastSeenAt ?? null;
    }

    return {
      occurrencesInWindow: recent.length,
      affectedUsers: users.size,
      firstSeenAt,
      lastSeenAt,
      openIncidentId,
      openLastSeenAt,
    };
  },
});

/** Keep an existing incident's lastSeenAt fresh (dedupe absorber). */
export const touchIncident = internalMutation({
  args: { incidentId: v.id("monitorIncidents"), at: v.number() },
  handler: async (ctx, args) => {
    const incident = await ctx.db.get(args.incidentId);
    if (!incident || incident.resolvedAt) return;
    await ctx.db.patch(args.incidentId, { lastSeenAt: args.at });
  },
});

/** Open a new incident. No-ops when one is already open (dedupe). */
export const createIncident = internalMutation({
  args: {
    title: v.string(),
    fingerprint: v.string(),
    module: v.string(),
    action: v.optional(v.string()),
    severity: v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    ruleKey: v.string(),
    occurrences: v.number(),
    affectedUsers: v.optional(v.number()),
    sampleMessage: v.optional(v.string()),
    route: v.optional(v.string()),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    detectedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("monitorIncidents")
      .withIndex("by_fingerprint_status", (q) =>
        q.eq("fingerprint", args.fingerprint).eq("status", "open"),
      )
      .first();
    if (existing) return null; // dedupe under concurrency

    // Human-friendly sequential number: max+1 (bounded query).
    const latest = await ctx.db
      .query("monitorIncidents")
      .withIndex("by_detected", (q) => q.gt("detectedAt", 0))
      .order("desc")
      .first();
    const number = (latest?.number ?? 0) + 1;

    const id = await ctx.db.insert("monitorIncidents", {
      number,
      title: args.title,
      fingerprint: args.fingerprint,
      module: args.module,
      action: args.action,
      severity: args.severity,
      status: "open",
      ruleKey: args.ruleKey,
      occurrences: args.occurrences,
      affectedUsers: args.affectedUsers,
      sampleMessage: args.sampleMessage,
      route: args.route,
      firstSeenAt: args.firstSeenAt,
      lastSeenAt: args.lastSeenAt,
      detectedAt: args.detectedAt,
    });
    return { incidentId: id, number };
  },
});

export const addIncidentEvent = internalMutation({
  args: {
    incidentId: v.id("monitorIncidents"),
    type: v.union(v.literal("detected"), v.literal("status"), v.literal("note")),
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    by: v.optional(v.string()),
    note: v.optional(v.string()),
    at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("monitorIncidentEvents", {
      incidentId: args.incidentId,
      type: args.type,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
      by: args.by,
      note: args.note,
      at: args.at,
    });
  },
});

// ---------------------------------------------------------------------------
// Alert plumbing
// ---------------------------------------------------------------------------

export const alertRuleFor = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("monitorAlertRules")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

/** Cooldown claim: true when this alert may send now. */
export const claimAlertSlot = internalMutation({
  args: { key: v.string(), cooldownMs: v.number(), at: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("monitorAlertState")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing && args.at - existing.lastSentAt < args.cooldownMs) return false;
    if (existing) {
      await ctx.db.patch(existing._id, { lastSentAt: args.at });
    } else {
      await ctx.db.insert("monitorAlertState", { key: args.key, lastSentAt: args.at });
    }
    return true;
  },
});

export const recordAlert = internalMutation({
  args: {
    ruleKey: v.string(),
    fingerprint: v.optional(v.string()),
    incidentId: v.optional(v.id("monitorIncidents")),
    severity: v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    title: v.string(),
    summary: v.optional(v.string()),
    channel: v.union(v.literal("email"), v.literal("inapp")),
    deliveredAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("monitorAlerts", args);
  },
});

/** Record an activity row (from monitorActivity helper). */
export const recordActivityRow = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    actorLabel: v.optional(v.string()),
    action: v.string(),
    module: v.string(),
    result: v.union(v.literal("success"), v.literal("failure")),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    requestId: v.optional(v.string()),
    route: v.optional(v.string()),
    detail: v.optional(v.string()),
    at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("monitorActivity", args);
  },
});

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

/** Prune old occurrence rows (bounded batches). Returns deleted count. */
export const pruneOccurrencesInternal = internalMutation({
  args: { olderThan: v.number() },
  handler: async (ctx, args) => {
    const old = await ctx.db
      .query("monitorOccurrences")
      .withIndex("by_at", (q) => q.lt("at", args.olderThan))
      .take(500);
    for (const row of old) await ctx.db.delete(row._id);

    // Heartbeats only need ~7 days.
    const hb = await ctx.db
      .query("monitorHeartbeats")
      .withIndex("by_at", (q) => q.lt("at", args.olderThan / 2))
      .take(500);
    for (const row of hb) await ctx.db.delete(row._id);

    return old.length;
  },
});

// ---------------------------------------------------------------------------
// Admin-facing API (all gated by the admin session token)
// ---------------------------------------------------------------------------

const SESSION_ARGS = { token: v.string() };

function sevRank(s: string): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[s] ?? 0;
}

/** Overview counters for the System landing page — real data only. */
export const adminOverview = query({
  args: SESSION_ARGS,
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const recentErrors = await ctx.db
      .query("monitorErrors")
      .withIndex("by_lastSeen", (q) => q.gte("lastSeenAt", weekAgo))
      .take(500);

    const errorsToday = recentErrors
      .filter((e) => e.lastSeenAt >= dayAgo)
      .reduce((sum, e) => sum + e.occurrences, 0);
    const errorsWeek = recentErrors.reduce((sum, e) => sum + e.occurrences, 0);
    const criticalWeek = recentErrors.filter((e) => e.severity === "critical").length;

    const openIncidents = await ctx.db
      .query("monitorIncidents")
      .withIndex("by_status_detected", (q) => q.eq("status", "open"))
      .order("desc")
      .take(10);
    const investigating = await ctx.db
      .query("monitorIncidents")
      .withIndex("by_status_detected", (q) => q.eq("status", "investigating"))
      .order("desc")
      .take(10);

    // Usage counters from real activity rows (24h window).
    const activity = await ctx.db
      .query("monitorActivity")
      .withIndex("by_at", (q) => q.gte("at", dayAgo))
      .take(2000);
    const eventCount = (module: string, status?: "success" | "failure") =>
      activity.filter((a) => a.module === module && (!status || a.result === status)).length;

    // Security counters.
    const securityWeek = recentErrors.filter((e) => e.kind === "security");
    const failedLogins = securityWeek
      .filter((e) => e.action?.includes("login") || e.module === "auth")
      .reduce((s, e) => s + e.occurrences, 0);
    const authzFailures = securityWeek
      .filter((e) => e.action?.includes("unauthorized") || e.action?.includes("admin-gate"))
      .reduce((s, e) => s + e.occurrences, 0);

    // Service rollup.
    const health = await ctx.db.query("monitorServiceHealth").collect();
    const servicesOk = health.filter((h) => h.status === "operational").length;
    const servicesDegraded = health.filter((h) => h.status === "degraded").length;
    const servicesDown = health.filter((h) => h.status === "down").length;

    const recentIncidents = [...openIncidents, ...investigating]
      .sort((a, b) => b.detectedAt - a.detectedAt)
      .slice(0, 5);

    const recentActivity = await ctx.db
      .query("monitorActivity")
      .withIndex("by_at", (q) => q.gte("at", now - 6 * 60 * 60 * 1000))
      .order("desc")
      .take(12);

    return {
      generatedAt: now,
      services: { ok: servicesOk, degraded: servicesDegraded, down: servicesDown, total: health.length },
      errors: {
        today: errorsToday,
        week: errorsWeek,
        criticalWeek,
        unresolvedIncidents: openIncidents.length + investigating.length,
      },
      usage: {
        enrollments: eventCount("enrollment", "success"),
        assignmentSubmissions: eventCount("assignments", "success"),
        fileUploads: eventCount("uploads", "success"),
        aiRequests: eventCount("ai-chat", "success"),
        voiceMessages: eventCount("ai-voice", "success"),
        newUsers: activity.filter((a) => a.action === "user.registered").length,
        // Database-level counts for active users are available in stats (admin.ts);
        // here we only count observed monitorActivity rows.
        activeUsersObserved: new Set(activity.map((a) => a.userId).filter(Boolean)).size,
      },
      security: {
        failedLogins,
        authzFailures,
        securityEventsWeek: securityWeek.reduce((s, e) => s + e.occurrences, 0),
      },
      recentIncidents: recentIncidents.map((i) => ({
        _id: i._id,
        number: i.number,
        title: i.title,
        severity: i.severity,
        status: i.status,
        module: i.module,
        detectedAt: i.detectedAt,
        occurrences: i.occurrences,
      })),
      recentActivity: recentActivity.map((a) => ({
        _id: a._id,
        action: a.action,
        module: a.module,
        result: a.result,
        at: a.at,
        actorLabel: a.actorLabel,
      })),
      historicalNote:
        "Monitoring started collecting from deployment — older windows may show zero because no data was recorded yet.",
    };
  },
});

/** System Health: per-service rollup rows. */
export const adminServiceHealth = query({
  args: SESSION_ARGS,
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const rows = await ctx.db.query("monitorServiceHealth").collect();
    return rows.sort((a, b) => a.serviceId.localeCompare(b.serviceId));
  },
});

/** Errors list with filters (severity, module, status, since, kind). */
export const adminErrorsList = query({
  args: {
    token: v.string(),
    severity: v.optional(v.string()),
    module: v.optional(v.string()),
    kind: v.optional(v.string()),
    status: v.optional(v.string()), // "unresolved" | "resolved"
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { token, severity, module, kind, status, since, limit }) => {
    await requireAdminSession(ctx, token);
    const cap = Math.min(limit ?? 100, 300);
    let rows = await ctx.db
      .query("monitorErrors")
      .withIndex("by_lastSeen", (q) => q.gte("lastSeenAt", since ?? 0))
      .order("desc")
      .take(cap * 3);
    if (severity) rows = rows.filter((r) => r.severity === severity);
    if (module) rows = rows.filter((r) => r.module === module);
    if (kind) rows = rows.filter((r) => r.kind === kind);
    if (status === "unresolved") rows = rows.filter((r) => !r.resolvedAt);
    if (status === "resolved") rows = rows.filter((r) => !!r.resolvedAt);
    return rows.slice(0, cap);
  },
});

/** Incident detail + its occurrences + timeline. */
export const adminIncidentDetail = query({
  args: { token: v.string(), incidentId: v.id("monitorIncidents") },
  handler: async (ctx, { token, incidentId }) => {
    await requireAdminSession(ctx, token);
    const incident = await ctx.db.get(incidentId);
    if (!incident) return null;

    const events = await ctx.db
      .query("monitorIncidentEvents")
      .withIndex("by_incident_at", (q) => q.eq("incidentId", incidentId).gte("at", 0))
      .collect();

    // Recent occurrences of the same fingerprint (bounded).
    const occurrences = await ctx.db
      .query("monitorOccurrences")
      .withIndex("by_fingerprint_at", (q) =>
        q.eq("fingerprint", incident.fingerprint).gte("at", incident.firstSeenAt),
      )
      .take(100);

    return {
      incident,
      timeline: events.sort((a, b) => a.at - b.at),
      occurrences: occurrences
        .sort((a, b) => b.at - a.at)
        .slice(0, 50)
        .map((o) => ({
          _id: o._id,
          at: o.at,
          message: o.message,
          route: o.route,
          userId: o.userId,
          requestId: o.requestId,
          severity: o.severity,
        })),
    };
  },
});

/** Incidents list with status filter. */
export const adminIncidentsList = query({
  args: {
    token: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { token, status, limit }) => {
    await requireAdminSession(ctx, token);
    const cap = Math.min(limit ?? 100, 200);
    if (status) {
      return ctx.db
        .query("monitorIncidents")
        .withIndex("by_status_detected", (q) => q.eq("status", status as "open"))
        .order("desc")
        .take(cap);
    }
    return ctx.db
      .query("monitorIncidents")
      .withIndex("by_detected", (q) => q.gt("detectedAt", 0))
      .order("desc")
      .take(cap);
  },
});

/** Occurrences of an error group (error detail drill-down). */
export const adminErrorDetail = query({
  args: { token: v.string(), fingerprint: v.string() },
  handler: async (ctx, { token, fingerprint }) => {
    await requireAdminSession(ctx, token);
    const group = await ctx.db
      .query("monitorErrors")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint))
      .first();
    if (!group) return null;
    const occurrences = await ctx.db
      .query("monitorOccurrences")
      .withIndex("by_fingerprint_at", (q) =>
        q.eq("fingerprint", fingerprint).gte("at", group.firstSeenAt),
      )
      .take(100);
    return {
      group,
      occurrences: occurrences.sort((a, b) => b.at - a.at).slice(0, 50),
    };
  },
});

/** Activity log (filters: module, action, since). */
export const adminActivityList = query({
  args: {
    token: v.string(),
    module: v.optional(v.string()),
    action: v.optional(v.string()),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { token, module, action, since, limit }) => {
    await requireAdminSession(ctx, token);
    const cap = Math.min(limit ?? 150, 400);
    let rows = await ctx.db
      .query("monitorActivity")
      .withIndex("by_at", (q) => q.gte("at", since ?? 0))
      .order("desc")
      .take(cap * 2);
    if (module) rows = rows.filter((r) => r.module === module);
    if (action) rows = rows.filter((r) => r.action === action);
    return rows.slice(0, cap);
  },
});

/** Security events list (kind filter) + counters. */
export const adminSecurityList = query({
  args: { token: v.string(), since: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, { token, since, limit }) => {
    await requireAdminSession(ctx, token);
    const cap = Math.min(limit ?? 100, 300);
    const rows = await ctx.db
      .query("monitorErrors")
      .withIndex("by_lastSeen", (q) => q.gte("lastSeenAt", since ?? 0))
      .order("desc")
      .take(cap * 2);
    const security = rows.filter((r) => r.kind === "security");
    const byKind: Record<string, number> = {};
    for (const row of security) {
      const action = row.action ?? "suspicious";
      const kind = /admin-password|admin-gate/i.test(action)
        ? "admin-gate-failure"
        : /login|signin|sign-in/i.test(action)
          ? "failed-login"
          : /rate|limit|spam/i.test(action)
            ? "rate-limit"
            : /unauthorized|forbidden|denied/i.test(action)
              ? "authz-failure"
              : "suspicious";
      byKind[kind] = (byKind[kind] ?? 0) + row.occurrences;
    }
    return { events: security.slice(0, cap), byKind };
  },
});

/** Alerts page: rules with defaults + sent alerts history. */
export const adminAlertsView = query({
  args: SESSION_ARGS,
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const rules = await ctx.db.query("monitorAlertRules").collect();
    const alerts = await ctx.db
      .query("monitorAlerts")
      .withIndex("by_delivered", (q) => q.gt("deliveredAt", 0))
      .order("desc")
      .take(100);
    return { rules, alerts };
  },
});

// ---------------------------------------------------------------------------
// Admin mutations: incident status, alert rules, error resolve
// ---------------------------------------------------------------------------

const STATUSES = ["open", "investigating", "acknowledged", "resolved", "ignored"] as const;

export const adminSetIncidentStatus = mutation({
  args: {
    token: v.string(),
    incidentId: v.id("monitorIncidents"),
    status: v.union(
      v.literal("investigating"),
      v.literal("acknowledged"),
      v.literal("resolved"),
      v.literal("ignored"),
      v.literal("open"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { token, incidentId, status, note }) => {
    await requireAdminSession(ctx, token);
    const incident = await ctx.db.get(incidentId);
    if (!incident) throw new Error("Incident not found.");
    const from = incident.status;
    const now = Date.now();
    await ctx.db.patch(incidentId, {
      status: status as (typeof STATUSES)[number],
      updatedAt: now,
      updatedBy: "admin-session",
      resolvedAt: status === "resolved" ? now : undefined,
      resolvedBy: status === "resolved" ? "admin-session" : undefined,
    });
    await ctx.db.insert("monitorIncidentEvents", {
      incidentId,
      type: "status",
      fromStatus: from,
      toStatus: status,
      by: "admin-session",
      note: note ? note.slice(0, 300) : undefined,
      at: now,
    });
    return true;
  },
});

export const adminSetErrorResolved = mutation({
  args: { token: v.string(), fingerprint: v.string(), resolved: v.boolean() },
  handler: async (ctx, { token, fingerprint, resolved }) => {
    await requireAdminSession(ctx, token);
    const group = await ctx.db
      .query("monitorErrors")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint))
      .first();
    if (!group) throw new Error("Error group not found.");
    await ctx.db.patch(group._id, {
      resolvedAt: resolved ? Date.now() : undefined,
    });
    return true;
  },
});

export const adminSetAlertRule = mutation({
  args: {
    token: v.string(),
    key: v.string(),
    enabled: v.boolean(),
    minSeverity: v.optional(v.string()),
    cooldownMinutes: v.optional(v.number()),
  },
  handler: async (ctx, { token, key, enabled, minSeverity, cooldownMinutes }) => {
    await requireAdminSession(ctx, token);
    const existing = await ctx.db
      .query("monitorAlertRules")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    const patch = {
      key,
      enabled,
      minSeverity: minSeverity as "critical" | "high" | "medium" | "low" | undefined,
      cooldownMinutes,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("monitorAlertRules", patch);
    }
    return true;
  },
});

/**
 * Database heartbeat — the mere fact this mutation commits proves the DB and
 * the write path are alive. The health sweep marks the database service
 * operational only when a heartbeat is recent.
 */
export const heartbeatInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const started = Date.now();
    // A real read + write: read the latest heartbeat to compute latency.
    const latest = await ctx.db
      .query("monitorHeartbeats")
      .withIndex("by_at", (q) => q.gt("at", 0))
      .order("desc")
      .first();
    const latencyMs = latest ? started - latest.at : undefined;
    await ctx.db.insert("monitorHeartbeats", {
      source: "cron",
      latencyMs: latencyMs !== undefined ? Math.min(latencyMs, 600_000) : undefined,
      at: Date.now(),
    });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Sweeper: periodic evaluation of service health from REAL counters
// ---------------------------------------------------------------------------

/**
 * Evaluate every registered service's health from real activity/errors and
 * upsert monitorServiceHealth rows. Called by cron every 5 minutes.
 * A service with NO observed signals reads "unknown" — never "operational".
 */
export const sweepServiceHealthInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const windowMs = 30 * 60 * 1000; // evaluate over the last 30 minutes
    const since = now - windowMs;

    // 1) DB heartbeat: the fact this mutation runs IS the signal.
    const latestHb = await ctx.db
      .query("monitorHeartbeats")
      .withIndex("by_at", (q) => q.gt("at", 0))
      .order("desc")
      .first();

    // 2) Module ok/fail from activity rows.
    const activity = await ctx.db
      .query("monitorActivity")
      .withIndex("by_at", (q) => q.gte("at", since))
      .take(4000);

    const byModule = new Map<string, { ok: number; fail: number; last: number }>();
    for (const row of activity) {
      const m = byModule.get(row.module) ?? { ok: 0, fail: 0, last: 0 };
      if (row.result === "success") m.ok++;
      else m.fail++;
      m.last = Math.max(m.last, row.at);
      byModule.set(row.module, m);
    }

    // 3) Error groups recently seen (for modules with no activity rows).
    const recentErrors = await ctx.db
      .query("monitorErrors")
      .withIndex("by_lastSeen", (q) => q.gte("lastSeenAt", since))
      .take(500);

    // 4) Email queue state.
    const emailPending = await ctx.db
      .query("emailLogs")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .take(200);
    const emailFailed = await ctx.db
      .query("emailLogs")
      .withIndex("by_status_created", (q) => q.eq("status", "failed"))
      .order("desc")
      .take(100)
      .then((rows) => rows.filter((r) => (r.failedAt ?? 0) >= since).length);
    const emailSent = await ctx.db
      .query("emailLogs")
      .withIndex("by_status_created", (q) => q.eq("status", "sent"))
      .order("desc")
      .take(200)
      .then((rows) => rows.filter((r) => (r.sentAt ?? 0) >= since).length);

    // 5) Provider health (AI/external) from the existing breaker table.
    const providers = await ctx.db.query("providerHealth").collect();

    // Service → counters assembly. Sources are REAL: activity rows, error
    // groups, emailLogs, providerHealth, heartbeat.
    const svc = (
      id: string,
      ok: number,
      fail: number,
      opts?: { hasSignal?: boolean; last?: number },
    ) => ({
      serviceId: id,
      ok,
      fail,
      hasSignal: opts?.hasSignal ?? ok + fail > 0,
      last: opts?.last,
    });

    const dbHbFresh = !!latestHb && now - latestHb.at < 15 * 60 * 1000;
    const evaluations: ReturnType<typeof svc>[] = [
      svc("database", dbHbFresh ? 1 : 0, dbHbFresh ? 0 : 1, {
        hasSignal: !!latestHb,
        last: latestHb?.at,
      }),
      svc("auth", byModule.get("auth")?.ok ?? 0, byModule.get("auth")?.fail ?? 0, {
        last: byModule.get("auth")?.last,
      }),
      svc("web", byModule.get("web")?.ok ?? 0, byModule.get("web")?.fail ?? 0, {
        last: byModule.get("web")?.last,
      }),
      svc("registration", byModule.get("registration")?.ok ?? 0, byModule.get("registration")?.fail ?? 0, {
        last: byModule.get("registration")?.last,
      }),
      svc("enrollment", byModule.get("enrollment")?.ok ?? 0, byModule.get("enrollment")?.fail ?? 0, {
        last: byModule.get("enrollment")?.last,
      }),
      svc("assignments", byModule.get("assignments")?.ok ?? 0, byModule.get("assignments")?.fail ?? 0, {
        last: byModule.get("assignments")?.last,
      }),
      svc("uploads", byModule.get("uploads")?.ok ?? 0, byModule.get("uploads")?.fail ?? 0, {
        last: byModule.get("uploads")?.last,
      }),
      svc("ai-chat", byModule.get("ai-chat")?.ok ?? 0, byModule.get("ai-chat")?.fail ?? 0, {
        last: byModule.get("ai-chat")?.last,
      }),
      svc("ai-quizgen", byModule.get("ai-quizgen")?.ok ?? 0, byModule.get("ai-quizgen")?.fail ?? 0, {
        last: byModule.get("ai-quizgen")?.last,
      }),
      svc("ai-voice", byModule.get("ai-voice")?.ok ?? 0, byModule.get("ai-voice")?.fail ?? 0, {
        last: byModule.get("ai-voice")?.last,
      }),
      svc("email", emailSent, emailFailed, {
        hasSignal: emailSent + emailFailed + emailPending.length > 0,
      }),
      svc("admin", byModule.get("admin")?.ok ?? 0, byModule.get("admin")?.fail ?? 0, {
        last: byModule.get("admin")?.last,
      }),
      svc("background-jobs", byModule.get("background-jobs")?.ok ?? 0, byModule.get("background-jobs")?.fail ?? 0, {
        last: byModule.get("background-jobs")?.last,
      }),
      svc("storage", byModule.get("storage")?.ok ?? 0, byModule.get("storage")?.fail ?? 0, {
        last: byModule.get("storage")?.last,
      }),
    ];

    // Derive status from counters.
    const rank = { low: 0, medium: 1, high: 2, critical: 3 };
    for (const ev of evaluations) {
      const total = ev.ok + ev.fail;
      let status: "operational" | "degraded" | "down" | "unknown" = "unknown";
      if (ev.serviceId === "database") {
        status = dbHbFresh ? "operational" : latestHb ? "degraded" : "unknown";
      } else if (total === 0) {
        status = "unknown";
      } else if (ev.ok === 0) {
        status = ev.fail >= 3 ? "down" : "degraded";
      } else {
        const failRate = ev.fail / total;
        status = failRate >= 0.5 && ev.fail >= 3 ? "down" : failRate >= 0.1 ? "degraded" : "operational";
      }

      // AI services also consider the existing circuit breaker state.
      if (ev.serviceId.startsWith("ai-") && status === "operational") {
        const openBreakers = providers.filter(
          (p) => p.state === "open" && now - (p.updatedAt ?? 0) < windowMs,
        );
        if (openBreakers.length > 0) status = "degraded";
      }

      const existing = await ctx.db
        .query("monitorServiceHealth")
        .withIndex("by_service", (q) => q.eq("serviceId", ev.serviceId))
        .first();
      const row = {
        serviceId: ev.serviceId,
        status,
        ok: ev.ok,
        fail: ev.fail,
        lastActivityAt: ev.last,
        recentFailures: ev.fail,
        evaluatedAt: now,
      };
      if (existing) await ctx.db.patch(existing._id, row);
      else await ctx.db.insert("monitorServiceHealth", row);
    }
    void rank;
    return evaluations.length;
  },
});
