/**
 * Email data layer — emailLogs lifecycle + admin Email Center API.
 *
 * V8 runtime (queries/mutations). Actual SMTP sending lives in the
 * "use node" action module (emailService.ts); this file persists the ONE
 * shared queue (manual, bulk and automated emails all flow through it),
 * claims due batches, and exposes admin-gated views.
 *
 * Queue statuses: pending → processing → sent | retrying → sent/failed,
 * plus cancelled. Priority: critical > high > normal. Duplicate automated
 * sends are prevented via dedupeKey. Retry limits are configurable in
 * emailSettings ("queue" singleton).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdminSession } from "./lib";
import { AUTOMATIONS } from "./emailTriggers";

const BATCH_SIZE = 20;
/** How long a log row stays "pending" before the batch worker may retry it. */
const PENDING_RETRY_MS = 60 * 1000;
/** Default automatic retries per email before it lands in "failed". */
const DEFAULT_MAX_RETRIES = 3;
/** Processing rows older than this are considered crashed and reclaimed. */
const STALE_PROCESSING_MS = 10 * 60 * 1000;

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, normal: 2 };

// ---------------------------------------------------------------------------
// Internal lifecycle
// ---------------------------------------------------------------------------

async function maxRetries(ctx: any): Promise<number> {
  const s = await ctx.db
    .query("emailSettings")
    .withIndex("by_key", (q: any) => q.eq("key", "queue"))
    .unique();
  return Math.max(0, Math.min(10, s?.maxRetries ?? DEFAULT_MAX_RETRIES));
}

/** True when the named automation is enabled (missing config = enabled). */
export async function automationEnabledInternal(
  ctx: any,
  key: string | undefined,
): Promise<boolean> {
  if (!key) return true;
  const row = await ctx.db
    .query("emailAutomations")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .unique();
  return row?.enabled ?? true;
}

/** Resolve an automation's subject (admin override wins over the default). */
export async function automationSubjectInternal(
  ctx: any,
  key: string | undefined,
  fallbackSubject: string,
): Promise<string> {
  if (!key) return fallbackSubject;
  const row = await ctx.db
    .query("emailAutomations")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .unique();
  return row?.subjectOverride?.trim() || fallbackSubject;
}

/**
 * Queue a transactional email for delivery through Gmail SMTP. Inserts a
 * pending log row and kicks (or schedules) the batch processor. Never throws
 * into the caller's business flow — email failure must not break enrollment,
 * certificates, etc.
 *
 * Queue features:
 *  - priority: "critical" rows are claimed before "high"/"normal"
 *  - scheduledAt: row is only claimed once the scheduled time has passed
 *  - dedupeKey: an identical key already pending/sent is NOT queued again
 *  - automationKey: disabled automations are dropped silently
 */
export const queueSystemEmail = internalMutation({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()), // ignored by the queue sender; accepted for legacy callers
    emailType: v.string(),
    priority: v.optional(
      v.union(v.literal("normal"), v.literal("high"), v.literal("critical")),
    ),
    scheduledAt: v.optional(v.number()),
    dedupeKey: v.optional(v.string()),
    automationKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      // Disabled automations never enter the queue.
      if (!(await automationEnabledInternal(ctx, args.automationKey))) return;

      // Duplicate prevention: same dedupe key still active (or delivered).
      if (args.dedupeKey) {
        const existing = await ctx.db
          .query("emailLogs")
          .withIndex("by_dedupe", (q) => q.eq("dedupeKey", args.dedupeKey!))
          .first();
        if (
          existing &&
          ["pending", "processing", "sent", "retrying"].includes(existing.status)
        ) {
          return;
        }
      }

      await ctx.db.insert("emailLogs", {
        to: args.to,
        subject: await automationSubjectInternal(ctx, args.automationKey, args.subject),
        html: args.html,
        emailType: args.emailType,
        status: "pending",
        automated: true,
        retryCount: 0,
        createdAt: Date.now(),
        priority: args.priority ?? "normal",
        scheduledAt: args.scheduledAt,
        dedupeKey: args.dedupeKey,
        automationKey: args.automationKey,
      });
      await ctx.scheduler.runAfter(0, internal.emailService.processPendingBatch, {});
    } catch (err) {
      console.warn("[email] failed to queue system email", err);
    }
  },
});

/**
 * Claim up to BATCH_SIZE due emails (marks them "processing"). Claims both
 * fresh pending rows and due retries, prioritising critical > high > normal
 * and oldest first within each priority — which also rate-limits sending to
 * BATCH_SIZE per processor run.
 */
export const internalClaimBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Paused? Claim nothing. Every queued email keeps its place in line, so
    // resuming the service delivers the backlog untouched.
    const pause = await ctx.db
      .query("emailPause")
      .withIndex("by_key", (q) => q.eq("key", "email"))
      .unique();
    if (pause?.paused) return [];

    // Recover rows stuck in "processing" (crashed isolate mid-batch).
    const stale = await ctx.db
      .query("emailLogs")
      .withIndex("by_status_created", (q) => q.eq("status", "processing"))
      .order("asc")
      .take(50);
    for (const row of stale) {
      if (now - (row.failedAt ?? row.createdAt) > STALE_PROCESSING_MS) {
        await ctx.db.patch(row._id, { status: "pending", lastError: undefined });
      }
    }

    // Fresh pending rows.
    const pendingRows = await ctx.db
      .query("emailLogs")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(BATCH_SIZE * 4);
    // Due retries.
    const retryingRows = await ctx.db
      .query("emailLogs")
      .withIndex("by_retrying_next", (q) => q.eq("status", "retrying"))
      .order("asc")
      .take(BATCH_SIZE);

    const candidates = [...pendingRows, ...retryingRows]
      .filter((r) => !r.scheduledAt || r.scheduledAt <= now)
      .filter(
        (r) =>
          r.status === "retrying" ||
          r.retryCount === 0 ||
          now - (r.failedAt ?? r.createdAt) > PENDING_RETRY_MS,
      )
      .sort((a, b) => {
        const p = (PRIORITY_RANK[a.priority ?? "normal"] ?? 2) - (PRIORITY_RANK[b.priority ?? "normal"] ?? 2);
        return p !== 0 ? p : a.createdAt - b.createdAt;
      })
      .slice(0, BATCH_SIZE);

    for (const row of candidates) {
      await ctx.db.patch(row._id, { status: "processing", lastError: undefined });
    }
    return candidates.map((r) => ({
      id: r._id,
      to: r.to,
      subject: r.subject,
      html: r.html ?? "",
    }));
  },
});

/** Log metadata for an authentication email (OTP / reset) — code NEVER stored. */
export const logAuthEmailMeta = internalMutation({
  args: {
    to: v.string(),
    subject: v.string(),
    emailType: v.string(),
    ok: v.boolean(),
    errorCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.db.insert("emailLogs", {
        to: args.to,
        // Subject stored redacted; HTML omitted entirely so codes can never
        // leak through the Email Center.
        subject: args.subject,
        emailType: args.emailType,
        status: args.ok ? "sent" : "failed",
        automated: true,
        retryCount: 0,
        lastError: args.ok ? undefined : (args.errorCode ?? "send_failed"),
        createdAt: Date.now(),
        sentAt: args.ok ? Date.now() : undefined,
        failedAt: args.ok ? undefined : Date.now(),
        priority: "critical",
      });
    } catch (err) {
      console.warn("[email] failed to log auth email", err);
    }
  },
});

/**
 * Mark one email sent, or move it to "retrying" (with exponential backoff)
 * until the configurable retry limit is reached, then "failed".
 */
export const internalMarkResult = internalMutation({
  args: {
    id: v.id("emailLogs"),
    ok: v.boolean(),
    errorCode: v.optional(v.string()),
    bumpRetry: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.ok) {
      await ctx.db.patch(args.id, {
        status: "sent",
        sentAt: Date.now(),
        nextRetryAt: undefined,
        lastError: undefined,
        failedAt: undefined,
      });
      return;
    }
    const row = await ctx.db.get(args.id);
    const retryCount =
      (args.bumpRetry === false ? (row?.retryCount ?? 0) : (row?.retryCount ?? 0) + 1);
    const limit = await maxRetries(ctx);
    const now = Date.now();
    if (retryCount < limit) {
      // Backoff: ~2, 4, 8… minutes capped at 30 — transient issues self-heal.
      const backoffMs = Math.min(2 ** retryCount * 60_000, 30 * 60_000);
      await ctx.db.patch(args.id, {
        status: "retrying",
        retryCount,
        lastRetryAt: now,
        nextRetryAt: now + backoffMs,
        failedAt: now,
        lastError: args.errorCode ?? "send_failed",
      });
    } else {
      await ctx.db.patch(args.id, {
        status: "failed",
        retryCount,
        lastRetryAt: now,
        failedAt: now,
        lastError: args.errorCode ?? "send_failed",
        nextRetryAt: undefined,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Admin Email Center — all gated by the admin session token
// ---------------------------------------------------------------------------

function safeProjection(r: any) {
  return {
    _id: r._id as string,
    to: r.to as string,
    subject: r.subject as string,
    emailType: r.emailType as string,
    status: r.status as
      | "pending"
      | "processing"
      | "sent"
      | "failed"
      | "retrying"
      | "cancelled",
    automated: !!r.automated,
    priority: (r.priority ?? "normal") as "normal" | "high" | "critical",
    retryCount: (r.retryCount ?? 0) as number,
    lastError: (r.lastError ?? null) as string | null,
    createdAt: r.createdAt as number,
    scheduledAt: (r.scheduledAt ?? null) as number | null,
    sentAt: (r.sentAt ?? null) as number | null,
    failedAt: (r.failedAt ?? null) as number | null,
    lastRetryAt: (r.lastRetryAt ?? null) as number | null,
    automationKey: (r.automationKey ?? null) as string | null,
    htmlLength: typeof r.html === "string" ? r.html.length : 0,
  };
}

/** Recipient picker data for Compose (id/name/email/role only). */
export const adminListRecipients = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => "email" in u && !!u.email)
      .map((u) => ({
        id: u._id,
        name: u.name || "(no name)",
        email: String(u.email),
        role: u.role ?? "student",
        teamRole: ("teamRole" in u ? String(u.teamRole ?? "") : "") || null,
      }));
  },
});

export const adminStats = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const rows = await ctx.db.query("emailLogs").collect();
    return {
      total: rows.length,
      sent: rows.filter((r) => r.status === "sent").length,
      failed: rows.filter((r) => r.status === "failed").length,
      pending: rows.filter((r) => r.status === "pending").length,
      processing: rows.filter((r) => r.status === "processing").length,
      retrying: rows.filter((r) => r.status === "retrying").length,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
      automated: rows.filter((r) => r.automated).length,
      lastSentAt: rows.reduce<number | null>(
        (acc, r) => (r.sentAt && (!acc || r.sentAt > acc) ? r.sentAt : acc),
        null,
      ),
      byType: Object.entries(
        rows.reduce<Record<string, number>>((acc, r) => {
          acc[r.emailType] = (acc[r.emailType] ?? 0) + 1;
          return acc;
        }, {}),
      ).sort((a, b) => b[1] - a[1]),
    };
  },
});

export const adminListEmails = query({
  args: {
    token: v.string(),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("sent"),
        v.literal("failed"),
        v.literal("retrying"),
        v.literal("cancelled"),
      ),
    ),
    emailType: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    let rows = ctx.db.query("emailLogs");
    if (args.status) {
      rows = rows.withIndex("by_status_created", (q) => q.eq("status", args.status!)) as never;
    } else if (args.emailType) {
      rows = rows.withIndex("by_type_created", (q) => q.eq("emailType", args.emailType!)) as never;
    }
    const collected = await rows.order("desc").take(500);
    const search = args.search?.trim().toLowerCase();
    const filtered = search
      ? collected.filter(
          (r) =>
            r.to.toLowerCase().includes(search) ||
            r.subject.toLowerCase().includes(search) ||
            (r.emailType ?? "").toLowerCase().includes(search),
        )
      : collected;
    return filtered.slice(0, 200).map(safeProjection);
  },
});

/** Full detail of one log (includes rendered HTML preview; never OTP codes). */
export const adminGetEmail = query({
  args: { token: v.string(), id: v.id("emailLogs") },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    // Defense in depth: auth-type emails are never persisted with their code.
    const html = row.emailType === "otp" || row.emailType === "password_reset" ? null : (row.html ?? null);
    return { ...safeProjection(row), html };
  },
});

/**
 * Compose + send. Recipients resolved server-side:
 *  - explicit user ids, OR
 *  - audience groups ("all_students" | "all_tutors" | "all_team").
 * Returns how many emails were queued. Bulk sends are processed in batches
 * in the background — the UI can show them as Pending → Sent live.
 */
export const adminCompose = mutation({
  args: {
    token: v.string(),
    subject: v.string(),
    messageHtml: v.string(),
    userIds: v.optional(v.array(v.id("users"))),
    audience: v.optional(
      v.union(
        v.literal("all_students"),
        v.literal("all_tutors"),
        v.literal("all_team"),
      ),
    ),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const subject = args.subject.trim();
    const body = args.messageHtml.trim();
    if (!subject || !body) throw new Error("Subject and message are required.");
    if (!args.userIds?.length && !args.audience) throw new Error("Choose at least one recipient.");

    let recipients: { id: string; email: string }[] = [];
    if (args.audience) {
      const users = await ctx.db.query("users").collect();
      recipients = users
        .filter((u) => {
          const email = "email" in u ? String(u.email ?? "") : "";
          if (!email) return false;
          if (args.audience === "all_students") return u.role === "student";
          if (args.audience === "all_tutors") return u.role === "tutor";
          return !!u.teamRole;
        })
        .map((u) => ({ id: u._id as string, email: String(u.email) }));
    } else {
      for (const uid of args.userIds!) {
        const u = await ctx.db.get(uid);
        const email = u && "email" in u ? String(u.email ?? "") : "";
        if (u && email) recipients.push({ id: uid, email });
      }
    }

    const now = Date.now();
    const scheduledAt = args.scheduledAt && args.scheduledAt > now ? args.scheduledAt : undefined;
    for (const r of recipients.slice(0, 1000)) {
      await ctx.db.insert("emailLogs", {
        to: r.email,
        subject,
        emailType: "admin_broadcast",
        status: "pending",
        automated: false,
        sentBy: undefined,
        html: body,
        retryCount: 0,
        createdAt: now,
        priority: "normal",
        scheduledAt,
      });
    }
    if (recipients.length > 0) {
      await ctx.scheduler.runAfter(0, internal.emailService.processPendingBatch, {});
    }
    return { queued: Math.min(recipients.length, 1000), skipped: recipients.length === 0 };
  },
});

/** Retry a failed / retrying / cancelled email (admin action). */
export const adminRetryEmail = mutation({
  args: { token: v.string(), id: v.id("emailLogs") },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Email not found.");
    if (row.status === "sent") throw new Error("That email was already delivered.");
    if (!row.html) throw new Error("This email's content is no longer available for resend.");
    await ctx.db.patch(args.id, {
      status: "pending",
      lastError: undefined,
      nextRetryAt: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.emailService.processPendingBatch, {});
    return { queued: true };
  },
});

/** Cancel a queued email (only while pending / retrying). */
export const adminCancelEmail = mutation({
  args: { token: v.string(), id: v.id("emailLogs") },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Email not found.");
    if (row.status === "sent") throw new Error("That email was already delivered.");
    if (row.status === "cancelled") return { cancelled: true };
    if (row.status === "processing") throw new Error("That email is being sent right now.");
    await ctx.db.patch(args.id, {
      status: "cancelled",
      nextRetryAt: undefined,
    });
    return { cancelled: true };
  },
});

/** Resend a previously sent email as a NEW log row (duplicate-safe). */
export const adminResendEmail = mutation({
  args: { token: v.string(), id: v.id("emailLogs") },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Email not found.");
    if (row.emailType === "otp" || row.emailType === "password_reset") {
      throw new Error("Authentication emails cannot be resent from the Email Center.");
    }
    if (!row.html) throw new Error("This email's content is no longer available for resend.");
    const id = await ctx.db.insert("emailLogs", {
      to: row.to,
      subject: row.subject,
      emailType: row.emailType,
      status: "pending",
      automated: false,
      html: row.html,
      retryCount: 0,
      createdAt: Date.now(),
      priority: "normal",
    });
    await ctx.scheduler.runAfter(0, internal.emailService.processPendingBatch, {});
    return { id };
  },
});

// ---------------------------------------------------------------------------
// Automations + queue settings (admin Email Center)
// ---------------------------------------------------------------------------

/** All automations with their live enabled state + subject override. */
export const adminListAutomations = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const rows = await ctx.db.query("emailAutomations").collect();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return AUTOMATIONS.map((a) => ({
      key: a.key,
      label: a.label,
      description: a.description,
      defaultSubject: a.defaultSubject,
      audience: a.audience,
      enabled: byKey.get(a.key)?.enabled ?? true,
      subjectOverride: byKey.get(a.key)?.subjectOverride ?? null,
      updatedAt: byKey.get(a.key)?.updatedAt ?? null,
    }));
  },
});

/** Per-automation log view — every email an automation produced. */
export const adminListAutomationEmails = query({
  args: { token: v.string(), automationKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    let q = ctx.db.query("emailLogs");
    const collected = await q.order("desc").take(800);
    const filtered = collected
      .filter((r) => !!r.automationKey)
      .filter((r) => !args.automationKey || r.automationKey === args.automationKey);
    return filtered.slice(0, 200).map(safeProjection);
  },
});

export const adminSetAutomationEnabled = mutation({
  args: { token: v.string(), key: v.string(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    if (!AUTOMATIONS.some((a) => a.key === args.key)) throw new Error("Unknown automation.");
    const existing = await ctx.db
      .query("emailAutomations")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("emailAutomations", {
        key: args.key,
        enabled: args.enabled,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const adminSetAutomationSubject = mutation({
  args: { token: v.string(), key: v.string(), subject: v.string() },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    if (!AUTOMATIONS.some((a) => a.key === args.key)) throw new Error("Unknown automation.");
    const existing = await ctx.db
      .query("emailAutomations")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    const subject = args.subject.trim();
    if (existing) {
      await ctx.db.patch(existing._id, {
        subjectOverride: subject || undefined,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("emailAutomations", {
        key: args.key,
        enabled: true,
        subjectOverride: subject || undefined,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

/** Queue settings: configurable retry limit + the global pause switch. */
export const adminGetQueueSettings = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const s = await ctx.db
      .query("emailSettings")
      .withIndex("by_key", (q) => q.eq("key", "queue"))
      .unique();
    const pause = await ctx.db
      .query("emailPause")
      .withIndex("by_key", (q) => q.eq("key", "email"))
      .unique();
    return {
      maxRetries: s?.maxRetries ?? DEFAULT_MAX_RETRIES,
      paused: pause?.paused ?? false,
      pausedAt: pause?.pausedAt ?? null,
      updatedAt: s?.updatedAt ?? null,
    };
  },
});

export const adminSetQueueSettings = mutation({
  args: { token: v.string(), maxRetries: v.number() },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const maxRetries = Math.max(0, Math.min(10, Math.round(args.maxRetries)));
    const existing = await ctx.db
      .query("emailSettings")
      .withIndex("by_key", (q) => q.eq("key", "queue"))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { maxRetries, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("emailSettings", { key: "queue", maxRetries, updatedAt: Date.now() });
    }
    return { ok: true };
  },
});

/** Internal: is the Academy email service currently paused? */
export const internalEmailPaused = internalQuery({
  args: {},
  handler: async (ctx) => {
    const pause = await ctx.db
      .query("emailPause")
      .withIndex("by_key", (q) => q.eq("key", "email"))
      .unique();
    return pause?.paused ?? false;
  },
});

/**
 * Pause / resume the Academy email service.
 *
 * Pausing is safe by design: the queue keeps accepting every email (welcome,
 * OTP, certificates, broadcasts, automations) and simply stops delivering
 * until an admin resumes. Nothing is lost, nothing errors, and the backlog
 * drains in order afterwards.
 */
export const adminSetEmailPaused = mutation({
  args: { token: v.string(), paused: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const existing = await ctx.db
      .query("emailPause")
      .withIndex("by_key", (q) => q.eq("key", "email"))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        paused: args.paused,
        pausedAt: args.paused ? Date.now() : undefined,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("emailPause", {
        key: "email",
        paused: args.paused,
        pausedAt: args.paused ? Date.now() : undefined,
        updatedAt: Date.now(),
      });
    }

    // Resuming dispatches the backlog right away instead of waiting for the
    // next cron tick.
    if (!args.paused) {
      await ctx.scheduler.runAfter(0, internal.emailService.processPendingBatch, {});
    }
    return { ok: true, paused: args.paused };
  },
});
