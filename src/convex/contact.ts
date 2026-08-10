import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { checkRateLimit, notify, requireAdminSession } from "./lib";

const threadKey = (a: string, b: string) => [a, b].sort().join("|");

/**
 * Find the platform-wide ForgeX Admin messaging identity (create on demand).
 * Mirrors the helper in admin.ts so the public contact form can deliver
 * signed-in users' messages straight into the admin chat inbox.
 */
async function ensureAdminUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const existing = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", "admin@forgex.academy"))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("users", {
    name: "ForgeX Admin",
    email: "admin@forgex.academy",
    role: "admin",
    verified: true,
    headline: "Academy Support",
    isSeed: true, // system identity — hidden from search & platform stats
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Could not create the admin identity.");
  return created;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/**
 * Contact form handler — no email-app redirect.
 *
 *  • Signed-in users: the message is delivered as a chat message to the
 *    ForgeX Admin identity, so it lands in the admin Chat logs and the admin
 *    can reply in-app (the user sees it in their floating chat).
 *  • Signed-out visitors: the message is stored as a contact submission and
 *    shows up in Admin → Inbox, where the admin replies by email.
 */
export const submitContact = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { name, email, subject, body }) => {
    const trimmedName = name.trim().slice(0, 120);
    const trimmedEmail = email.trim().toLowerCase().slice(0, 254);
    const trimmedSubject = subject.trim().slice(0, 200);
    const trimmedBody = body.trim().slice(0, 5000);

    if (!trimmedName || !trimmedEmail || !trimmedBody) {
      throw new Error("Please fill in your name, email and message.");
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      throw new Error("Please enter a valid email address.");
    }

    // Spam guards (DB-backed rate limiter): max 5 submissions per email per
    // hour, plus a global ceiling so a single script can't flood the inbox.
    await checkRateLimit(
      ctx,
      `contact:${trimmedEmail}`,
      5,
      60 * 60 * 1000,
      "You've sent several messages recently — please wait a while before sending more.",
    );
    await checkRateLimit(
      ctx,
      "contact:global",
      40,
      60 * 1000,
      "Too many messages are being sent right now — please try again in a minute.",
    );

    const userId = await getAuthUserId(ctx);

    // Registered user → deliver into the chat inbox as a real conversation.
    if (userId !== null) {
      const admin = await ensureAdminUser(ctx);
      const messageBody = trimmedSubject
        ? `[${trimmedSubject}]\n\n${trimmedBody}`
        : trimmedBody;
      await ctx.db.insert("messages", {
        threadId: threadKey(userId, admin._id),
        senderId: userId,
        receiverId: admin._id,
        body: messageBody,
        createdAt: Date.now(),
      });
      await notify(ctx, {
        userId: admin._id,
        title: `New contact message from ${trimmedName}`,
        body: messageBody.slice(0, 90),
        type: "message",
        link: "/admin/chat",
      });
      return { via: "chat" as const };
    }

    // Visitor → store it for the admin inbox.
    await ctx.db.insert("contactSubmissions", {
      name: trimmedName,
      email: trimmedEmail,
      subject: trimmedSubject,
      body: trimmedBody,
      status: "new",
      createdAt: Date.now(),
    });
    return { via: "inbox" as const };
  },
});

// ---------------------------------------------------------------------------
// Admin inbox — contact submissions from the public form
// ---------------------------------------------------------------------------

export const adminContactList = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const subs = await ctx.db
      .query("contactSubmissions")
      .withIndex("by_created")
      .collect();
    return subs.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Reply to a visitor submission by email and mark it replied. */
export const adminContactReply = mutation({
  args: {
    token: v.string(),
    id: v.id("contactSubmissions"),
    reply: v.string(),
  },
  handler: async (ctx, { token, id, reply }) => {
    await requireAdminSession(ctx, token);
    const sub = await ctx.db.get(id);
    if (!sub) throw new Error("Message not found.");
    const trimmed = reply.trim().slice(0, 5000);
    if (!trimmed) throw new Error("Reply can't be empty.");

    await ctx.db.patch(id, {
      status: "replied",
      reply: trimmed,
      repliedAt: Date.now(),
    });

    const site = (process.env.SITE_URL ?? "https://forgex.academy").replace(
      /\/$/,
      "",
    );
    await ctx.scheduler.runAfter(0, internal.email.sendEmail, {
      to: sub.email,
      subject: `Re: ${sub.subject || "Your message to ForgeX Academy"}`,
      html: `
        <div style="background:#0d0f0c;color:#e7e5e4;font-family:Segoe UI,Arial,sans-serif;padding:32px 16px">
          <div style="max-width:560px;margin:0 auto;background:#14170f;border:1px solid #2a2e22;border-radius:16px;overflow:hidden">
            <div style="background:#a3e635;padding:20px 28px"><p style="margin:0;color:#0d0f0c;font-weight:800;font-size:18px">⚡ ForgeX Academy</p></div>
            <div style="padding:28px">
              <p style="margin:0 0 12px;font-size:20px;font-weight:700;color:#a3e635">The ForgeX team replied</p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#d6d3d1">Hi ${sub.name},</p>
              <div style="margin:0 0 20px;background:#0d0f0c;border:1px solid #2a2e22;border-radius:12px;padding:14px 16px;font-size:14px;color:#f5f5f4;line-height:1.6">${trimmed.replace(/\n/g, "<br/>")}</div>
              <p style="margin:0 0 20px;font-size:12px;color:#78716c;line-height:1.6">Your original message: “${sub.body.slice(0, 240)}${sub.body.length > 240 ? "…" : ""}”</p>
              <div>
                <a href="${site}/contact" style="display:inline-block;background:#a3e635;color:#0d0f0c;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">Contact us again</a>
              </div>
            </div>
            <div style="padding:16px 28px;border-top:1px solid #2a2e22;font-size:12px;color:#78716c">You contacted ForgeX Academy through the website contact form.</div>
          </div>
        </div>`,
      text: `Hi ${sub.name},\n\nThe ForgeX team replied to your message:\n\n“${trimmed}”\n\nOriginal message: “${sub.body}”\n\nVisit ${site}/contact to reach us again.`,
    });

    return true;
  },
});

/** Mark a submission resolved (or reopen it). */
export const adminContactStatus = mutation({
  args: {
    token: v.string(),
    id: v.id("contactSubmissions"),
    status: v.union(v.literal("new"), v.literal("replied"), v.literal("resolved")),
  },
  handler: async (ctx, { token, id, status }) => {
    await requireAdminSession(ctx, token);
    const sub = await ctx.db.get(id);
    if (!sub) throw new Error("Message not found.");
    await ctx.db.patch(id, { status });
    return true;
  },
});
