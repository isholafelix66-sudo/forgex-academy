/**
 * Email data layer — emailLogs lifecycle + admin Email Center API.
 *
 * V8 runtime (queries/mutations). Actual SMTP sending lives in the
 * "use node" action module (emailService.ts); this file only persists logs,
 * claims pending batches, and exposes admin-gated views.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdminSession } from "./lib";

const BATCH_SIZE = 20;
/** How long a log row stays "pending" before the batch worker may retry it. */
const PENDING_RETRY_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// Internal lifecycle
// ---------------------------------------------------------------------------

/**
 * Queue a transactional email for delivery through Gmail SMTP. Inserts a
 * pending log row and kicks (or schedules) the batch processor. Never throws
 * into the caller's business flow — email failure must not break enrollment,
 * certificates, etc.
 */
export const queueSystemEmail = internalMutation({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    emailType: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.db.insert("emailLogs", {
        to: args.to,
        subject: args.subject,
        html: args.html,
        emailType: args.emailType,
        status: "pending",
        automated: true,
        retryCount: 0,
        createdAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.emailService.processPendingBatch, {});
    } catch (err) {
      console.warn("[email] failed to queue system email", err);
    }
  },
});

/** Claim up to BATCH_SIZE due pending logs (marks them processing). */
export const internalClaimBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("emailLogs")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(BATCH_SIZE);
    const claimable = due.filter(
      (r) => r.retryCount === 0 || now - (r.failedAt ?? r.createdAt) > PENDING_RETRY_MS,
    );
    for (const row of claimable) {
      await ctx.db.patch(row._id, { status: "pending", lastError: undefined });
    }
    return claimable.map((r) => ({
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
      });
    } catch (err) {
      console.warn("[email] failed to log auth email", err);
    }
  },
});

/** Mark one log sent or failed (with safe error classification). */
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
        lastError: undefined,
        failedAt: undefined,
      });
    } else {
      const row = await ctx.db.get(args.id);
      await ctx.db.patch(args.id, {
        status: "failed",
        failedAt: Date.now(),
        lastError: args.errorCode ?? "send_failed",
        retryCount: Math.max(row?.retryCount ?? 0, args.bumpRetry ? (row?.retryCount ?? 0) + 1 : row?.retryCount ?? 0),
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
    status: r.status as "pending" | "sent" | "failed",
    automated: !!r.automated,
    retryCount: (r.retryCount ?? 0) as number,
    lastError: (r.lastError ?? null) as string | null,
    createdAt: r.createdAt as number,
    sentAt: (r.sentAt ?? null) as number | null,
    failedAt: (r.failedAt ?? null) as number | null,
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
      automated: rows.filter((r) => r.automated).length,
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
    status: v.optional(v.union(v.literal("pending"), v.literal("sent"), v.literal("failed"))),
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
            r.subject.toLowerCase().includes(search),
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
      });
    }
    if (recipients.length > 0) {
      await ctx.scheduler.runAfter(0, internal.emailService.processPendingBatch, {});
    }
    return { queued: Math.min(recipients.length, 1000), skipped: recipients.length === 0 };
  },
});

/** Retry a failed email (admin action). Resets it to pending. */
export const adminRetryEmail = mutation({
  args: { token: v.string(), id: v.id("emailLogs") },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Email not found.");
    if (row.status === "sent") throw new Error("That email was already delivered.");
    if (!row.html) throw new Error("This email's content is no longer available for resend.");
    await ctx.db.patch(args.id, { status: "pending", lastError: undefined });
    await ctx.scheduler.runAfter(0, internal.emailService.processPendingBatch, {});
    return { queued: true };
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
    });
    await ctx.scheduler.runAfter(0, internal.emailService.processPendingBatch, {});
    return { id };
  },
});
