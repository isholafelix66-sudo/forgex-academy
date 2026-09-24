/**
 * ForgeX Network PORTFOLIO — email queue + log.
 *
 * Every Portfolio email flows through `deliver` here, which records the
 * message in `portfolioEmailLogs` and hands the actual SMTP send to the
 * Node action in `portfolioEmail.ts`. Outcomes (sent/failed + reason) are
 * written back to the log, powering the Email screens in /adminbrand
 * (Templates, Sent, Failed, Retry).
 *
 * The Academy email system (`emailData` / `emailService`) is never read or
 * written by this module.
 */

import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePortfolioAdminSession } from "./portfolioAdmin";

/** Automatic retries per message before it is parked as failed. */
export const MAX_SEND_ATTEMPTS = 4;
/** Backoff between retries: 30s → 2m → 8m (capped). */
function retryDelayMs(attempts: number) {
  return Math.min(30_000 * 4 ** Math.max(attempts - 1, 0), 15 * 60 * 1000);
}

/** Reads the Portfolio email pause switch (missing row = not paused). */
async function emailPaused(ctx: MutationCtx) {
  const doc = await ctx.db
    .query("portfolioSettings")
    .withIndex("by_key", (q) => q.eq("key", "portfolio"))
    .first();
  return !!doc?.emailPaused;
}

/* ── Deliver one message + log the outcome ─────────────────────────────── */

/**
 * The ONE entry point for Portfolio email. Called by the scheduler from
 * auth flows and admin composes; never throws into the user flow.
 */
export const deliver = internalMutation({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    template: v.string(),
    kind: v.union(
      v.literal("auth"),
      v.literal("notification"),
      v.literal("custom"),
    ),
  },
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("portfolioEmailLogs", {
      to: args.to,
      subject: args.subject,
      html: args.html,
      template: args.template,
      kind: args.kind,
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.portfolioEmailLog.attemptSend, {
      logId,
    });
    return logId;
  },
});

/** Reads the SMTP config + one queued message for the Node send action. */
export const queuedMessage = internalQuery({
  args: { logId: v.id("portfolioEmailLogs") },
  handler: async (ctx, { logId }) => {
    const row = await ctx.db.get(logId);
    if (!row || row.status === "sent") return null;
    const settings = await ctx.db
      .query("portfolioSettings")
      .withIndex("by_key", (q) => q.eq("key", "portfolio"))
      .first();
    if (!settings?.smtp?.host || !settings.smtp.username || !settings.smtp.password) {
      return { missingSmtp: true as const, smtp: null, message: null };
    }
    return {
      missingSmtp: false as const,
      smtp: settings.smtp,
      message: { to: row.to, subject: row.subject, html: row.html },
    };
  },
});

/** Actually queues the SMTP attempt (mutations can't use nodemailer). */
export const attemptSend = internalMutation({
  args: { logId: v.id("portfolioEmailLogs") },
  handler: async (ctx, { logId }) => {
    const row = await ctx.db.get(logId);
    if (!row || row.status === "sent") return;

    // Paused: keep the message queued and untouched. Nothing is sent and the
    // row stays "pending", so unpausing delivers it exactly as written.
    if (await emailPaused(ctx)) return;

    const settings = await ctx.db
      .query("portfolioSettings")
      .withIndex("by_key", (q) => q.eq("key", "portfolio"))
      .first();
    const smtp = settings?.smtp;
    const usable =
      !!smtp && !!smtp.host && !!smtp.username && !!smtp.password;

    // A missing SMTP account is no longer a dead end: the Node sender falls
    // back to the platform email integration, so OTP codes still arrive.
    await ctx.scheduler.runAfter(0, internal.portfolioEmail.sendQueued, {
      logId,
      smtp: usable ? smtp : undefined,
      to: row.to,
      subject: row.subject,
      html: row.html,
    });
  },
});

/** Write the outcome of one SMTP attempt back to the log row. */
export const recordOutcome = internalMutation({
  args: {
    logId: v.id("portfolioEmailLogs"),
    ok: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { logId, ok, error }) => {
    const row = await ctx.db.get(logId);
    if (!row) return;
    if (ok) {
      await ctx.db.patch(logId, {
        status: "sent",
        sentAt: Date.now(),
        attempts: row.attempts + 1,
        error: undefined,
      });
    } else {
      const attempts = row.attempts + 1;
      // Transient failures retry themselves with backoff instead of dying on
      // the first bad minute (network blips, rate limits, provider hiccups).
      const willRetry = attempts < MAX_SEND_ATTEMPTS;
      await ctx.db.patch(logId, {
        status: willRetry ? "pending" : "failed",
        error: (error ?? "Send failed.").slice(0, 400),
        attempts,
      });
      if (willRetry) {
        await ctx.scheduler.runAfter(
          retryDelayMs(attempts),
          internal.portfolioEmailLog.attemptSend,
          { logId },
        );
      }
    }
  },
});

/* ── Pause / resume the Portfolio mail service ─────────────────────────── */

/** Current pause state for the admin portal. */
export const emailSettings = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requirePortfolioAdminSession(ctx, token);
    const doc = await ctx.db
      .query("portfolioSettings")
      .withIndex("by_key", (q) => q.eq("key", "portfolio"))
      .first();
    const pending = await ctx.db
      .query("portfolioEmailLogs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(200);
    return {
      paused: !!doc?.emailPaused,
      pausedAt: doc?.emailPausedAt ?? null,
      smtpConfigured: !!(doc?.smtp?.host && doc?.smtp?.username && doc?.smtp?.password),
      pending: pending.length,
    };
  },
});

/**
 * Pause / resume all Portfolio email. Pausing never drops a message: queued
 * rows simply wait, and resuming re-dispatches every pending one immediately.
 */
export const setPaused = mutation({
  args: { token: v.string(), paused: v.boolean() },
  handler: async (ctx, { token, paused }) => {
    await requirePortfolioAdminSession(ctx, token);
    const doc = await ctx.db
      .query("portfolioSettings")
      .withIndex("by_key", (q) => q.eq("key", "portfolio"))
      .first();
    if (!doc) throw new Error("Portfolio settings are missing.");
    await ctx.db.patch(doc._id, {
      emailPaused: paused,
      emailPausedAt: paused ? Date.now() : undefined,
      updatedAt: Date.now(),
    });

    if (!paused) {
      // Resume exactly where we stopped.
      const pending = await ctx.db
        .query("portfolioEmailLogs")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .take(200);
      for (const row of pending) {
        await ctx.scheduler.runAfter(0, internal.portfolioEmailLog.attemptSend, {
          logId: row._id,
        });
      }
      return { paused, dispatched: pending.length };
    }
    return { paused, dispatched: 0 };
  },
});

/** Re-dispatch every queued message (admin "retry the queue" button). */
export const drainQueue = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requirePortfolioAdminSession(ctx, token);
    const pending = await ctx.db
      .query("portfolioEmailLogs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(200);
    for (const row of pending) {
      await ctx.scheduler.runAfter(0, internal.portfolioEmailLog.attemptSend, {
        logId: row._id,
      });
    }
    return { dispatched: pending.length };
  },
});

async function getSmtpForTest(ctx: MutationCtx) {
  const doc = await ctx.db
    .query("portfolioSettings")
    .withIndex("by_key", (q) => q.eq("key", "portfolio"))
    .first();
  return doc?.smtp ?? null;
}
void getSmtpForTest;

/* ── Admin management surface (/adminbrand → Email) ───────────────────── */

/** List the log (newest first) with an optional status filter. */
export const listLogs = query({
  args: {
    token: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { token, status, limit }) => {
    await requirePortfolioAdminSession(ctx, token);
    const cap = Math.min(Math.max(limit ?? 100, 1), 300);
    const rows = await ctx.db
      .query("portfolioEmailLogs")
      .withIndex("by_createdAt")
      .order("desc")
      .take(cap * 2);
    const filtered =
      status && status !== "all"
        ? rows.filter((r) => r.status === status)
        : rows;
    return filtered.slice(0, cap).map((r) => ({
      _id: r._id,
      to: r.to,
      subject: r.subject,
      template: r.template,
      kind: r.kind,
      status: r.status,
      error: r.error ?? null,
      attempts: r.attempts,
      sentAt: r.sentAt ?? null,
      createdAt: r.createdAt,
    }));
  },
});

/** Full body of one message (admin "view"). */
export const getLog = query({
  args: { token: v.string(), logId: v.id("portfolioEmailLogs") },
  handler: async (ctx, { token, logId }) => {
    await requirePortfolioAdminSession(ctx, token);
    const row = await ctx.db.get(logId);
    if (!row) return null;
    return {
      _id: row._id,
      to: row.to,
      subject: row.subject,
      html: row.html,
      template: row.template,
      kind: row.kind,
      status: row.status,
      error: row.error ?? null,
      attempts: row.attempts,
      sentAt: row.sentAt ?? null,
      createdAt: row.createdAt,
    };
  },
});

/** Retry a failed send (admin action). */
export const retrySend = mutation({
  args: { token: v.string(), logId: v.id("portfolioEmailLogs") },
  handler: async (ctx, { token, logId }) => {
    await requirePortfolioAdminSession(ctx, token);
    const row = await ctx.db.get(logId);
    if (!row) throw new Error("Message not found.");
    if (row.status === "sent") {
      throw new Error("That message was already sent.");
    }
    await ctx.db.patch(logId, { status: "pending", error: undefined });
    await ctx.scheduler.runAfter(0, internal.portfolioEmailLog.attemptSend, {
      logId,
    });
    return true;
  },
});

/** Compose a custom email from the admin portal. */
export const compose = mutation({
  args: {
    token: v.string(),
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  handler: async (ctx, { token, to, subject, html }) => {
    await requirePortfolioAdminSession(ctx, token);
    const address = to.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
      throw new Error("Enter a valid recipient address.");
    }
    if (!subject.trim()) throw new Error("Enter a subject.");
    if (!html.trim()) throw new Error("Write the message body first.");
    await ctx.scheduler.runAfter(0, internal.portfolioEmailLog.deliver, {
      to: address,
      subject: subject.trim().slice(0, 200),
      html,
      template: "custom",
      kind: "custom",
    });
    return true;
  },
});

/** Email log stats for the overview cards. */
export const stats = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requirePortfolioAdminSession(ctx, token);
    const rows = await ctx.db
      .query("portfolioEmailLogs")
      .withIndex("by_createdAt")
      .order("desc")
      .take(500);
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
      total: rows.length,
      sent: rows.filter((r) => r.status === "sent").length,
      failed: rows.filter((r) => r.status === "failed").length,
      pending: rows.filter((r) => r.status === "pending").length,
      last24h: rows.filter((r) => r.createdAt > dayAgo).length,
    };
  },
});
