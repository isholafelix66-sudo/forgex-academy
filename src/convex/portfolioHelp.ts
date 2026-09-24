import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { checkRateLimit } from "./lib";
import { requirePortfolioAdminSession } from "./portfolioAdmin";
import { getPortfolioUser } from "./portfolioUsers";

/* ═══════════════════════════════════════════════════════════════════════════
   PORTFOLIO HELP DESK — "Get help / report an issue".

   • Anyone can send a request: no account, no sign-in, minimal identity
     (name + email so we can answer).
   • Every request lands in the Portfolio admin portal's Help desk
     (/adminbrand → Help desk) where it can be replied to and resolved.
   • Replies are threaded on the request and emailed to the sender through the
     Portfolio mail service (queue + retry + platform fallback), so an answer
     is never lost.

   Nothing here reads or writes the Academy support tables.
   ═══════════════════════════════════════════════════════════════════════════ */

const TOPICS = v.union(
  v.literal("bug"),
  v.literal("account"),
  v.literal("portfolio"),
  v.literal("billing"),
  v.literal("other"),
);

const TOPIC_LABELS: Record<string, string> = {
  bug: "Something is broken",
  account: "Sign-in / account",
  portfolio: "My portfolio",
  billing: "Billing",
  other: "Something else",
};

function cleanEmail(email: string) {
  const value = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    throw new Error("Enter a valid email address so we can reply.");
  }
  return value.slice(0, 160);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function replyEmailHtml(args: {
  name: string;
  subject: string;
  reply: string;
  adminName: string;
}) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0d08;color:#f2f6ec;padding:32px;border-radius:16px;max-width:560px;margin:0 auto">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#a3e635">ForgeX Network · Portfolio support</p>
    <h2 style="margin:0 0 14px;font-size:21px">Re: ${escapeHtml(args.subject)}</h2>
    <p style="margin:0 0 16px;line-height:1.65;color:#c9d1c2">Hi ${escapeHtml(args.name)},</p>
    <div style="margin:0 0 18px;padding:16px;border-radius:12px;background:#12160f;border:1px solid rgba(163,230,53,0.22);line-height:1.65;color:#e9f2df;white-space:pre-line">${escapeHtml(args.reply)}</div>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#8b977f">
      — ${escapeHtml(args.adminName || "The ForgeX Portfolio team")}<br/>
      Reply to this email if you need anything else.
    </p>
  </div>`;
}

/* ── Public: send a request ────────────────────────────────────────────── */

export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    topic: TOPICS,
    subject: v.string(),
    message: v.string(),
    pageUrl: v.optional(v.string()),
    /** Optional creator session token so the request links to their account. */
    creatorToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 80);
    if (name.length < 2) throw new Error("Tell us your name so we can address you.");
    const email = cleanEmail(args.email);
    const subject = args.subject.trim().slice(0, 160);
    if (subject.length < 3) throw new Error("Add a short subject.");
    const message = args.message.trim();
    if (message.length < 10) {
      throw new Error("Describe the issue in a little more detail.");
    }
    if (message.length > 4000) throw new Error("Please keep it under 4,000 characters.");

    // Spam guard: 5 requests per hour per email address.
    await checkRateLimit(
      ctx,
      `pf-help:${email}`,
      5,
      60 * 60 * 1000,
      "You've sent us a few requests already — we'll reply by email soon.",
    );

    let creatorId: Doc<"portfolioUsers">["_id"] | undefined;
    if (args.creatorToken) {
      const creator = await getPortfolioUser(ctx, args.creatorToken);
      creatorId = creator?._id;
    }

    const now = Date.now();
    const id = await ctx.db.insert("portfolioHelpRequests", {
      name,
      email,
      topic: args.topic,
      subject,
      message,
      pageUrl: args.pageUrl?.trim().slice(0, 300) || undefined,
      creatorId,
      status: "open",
      replies: [],
      createdAt: now,
      updatedAt: now,
    });

    // Confirm to the sender + alert the team (respects the email pause switch;
    // the queue holds both if the service is paused).
    await ctx.scheduler.runAfter(0, internal.portfolioEmailLog.deliver, {
      to: email,
      subject: `We got your message — ${subject}`,
      html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0d08;color:#f2f6ec;padding:32px;border-radius:16px;max-width:560px;margin:0 auto">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#a3e635">ForgeX Network · Portfolio support</p>
        <h2 style="margin:0 0 14px;font-size:21px">We're on it, ${escapeHtml(name)}</h2>
        <p style="margin:0 0 14px;line-height:1.65;color:#c9d1c2">
          Your request (<strong>${escapeHtml(TOPIC_LABELS[args.topic] ?? args.topic)}</strong>) reached the Portfolio team.
          We reply to this address, usually within one working day.
        </p>
        <div style="margin:0;padding:14px;border-radius:12px;background:#12160f;border:1px solid rgba(255,255,255,0.08);line-height:1.6;color:#c9d1c2;white-space:pre-line">${escapeHtml(message.slice(0, 1200))}</div>
      </div>`,
      template: "help_ack",
      kind: "notification",
    });

    return { ok: true, id: id as string };
  },
});

/* ── Admin help desk (/adminbrand → Help desk) ─────────────────────────── */

export const list = query({
  args: {
    token: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { token, status, limit }) => {
    await requirePortfolioAdminSession(ctx, token);
    const cap = Math.min(Math.max(limit ?? 100, 1), 300);
    const rows = await ctx.db
      .query("portfolioHelpRequests")
      .withIndex("by_createdAt")
      .order("desc")
      .take(cap * 2);
    const filtered =
      status && status !== "all" ? rows.filter((r) => r.status === status) : rows;
    return filtered.slice(0, cap).map((r) => ({
      _id: r._id as string,
      name: r.name,
      email: r.email,
      topic: r.topic,
      topicLabel: TOPIC_LABELS[r.topic] ?? r.topic,
      subject: r.subject,
      message: r.message,
      pageUrl: r.pageUrl ?? null,
      status: r.status,
      replies: r.replies,
      replyCount: r.replies.length,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      fromCreator: !!r.creatorId,
    }));
  },
});

export const stats = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requirePortfolioAdminSession(ctx, token);
    const rows = await ctx.db
      .query("portfolioHelpRequests")
      .withIndex("by_createdAt")
      .order("desc")
      .take(400);
    return {
      total: rows.length,
      open: rows.filter((r) => r.status === "open").length,
      answered: rows.filter((r) => r.status === "answered").length,
      resolved: rows.filter((r) => r.status === "resolved").length,
      oldestOpen: rows
        .filter((r) => r.status === "open")
        .reduce<number | null>((min, r) => (min === null ? r.createdAt : Math.min(min, r.createdAt)), null),
    };
  },
});

/** Reply to a request (and email the answer to the sender). */
export const reply = mutation({
  args: {
    token: v.string(),
    id: v.id("portfolioHelpRequests"),
    body: v.string(),
    adminName: v.optional(v.string()),
    /** Resolve the request at the same time as replying. */
    resolve: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requirePortfolioAdminSession(ctx, args.token);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("That request no longer exists.");

    const body = args.body.trim();
    if (body.length < 2) throw new Error("Write a reply first.");
    if (body.length > 4000) throw new Error("Keep replies under 4,000 characters.");

    const now = Date.now();
    const willResolve = args.resolve ?? false;

    await ctx.db.patch(args.id, {
      replies: [
        ...row.replies,
        {
          body,
          adminName: (args.adminName ?? "Portfolio team").slice(0, 60),
          createdAt: now,
          emailed: true,
        },
      ],
      status: willResolve ? "resolved" : "answered",
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.portfolioEmailLog.deliver, {
      to: row.email,
      subject: `Re: ${row.subject}`,
      html: replyEmailHtml({
        name: row.name,
        subject: row.subject,
        reply: body,
        adminName: args.adminName ?? "The ForgeX Portfolio team",
      }),
      template: "help_reply",
      kind: "notification",
    });

    return { ok: true };
  },
});

/** Move a request between open / answered / resolved. */
export const setStatus = mutation({
  args: {
    token: v.string(),
    id: v.id("portfolioHelpRequests"),
    status: v.union(
      v.literal("open"),
      v.literal("answered"),
      v.literal("resolved"),
    ),
  },
  handler: async (ctx, { token, id, status }) => {
    await requirePortfolioAdminSession(ctx, token);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("That request no longer exists.");
    await ctx.db.patch(id, { status, updatedAt: Date.now() });
    return { ok: true };
  },
});

/** Remove a request (spam, duplicates). */
export const remove = mutation({
  args: { token: v.string(), id: v.id("portfolioHelpRequests") },
  handler: async (ctx, { token, id }) => {
    await requirePortfolioAdminSession(ctx, token);
    const row = await ctx.db.get(id);
    if (row) await ctx.db.delete(id);
    return { ok: true };
  },
});
