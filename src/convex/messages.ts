import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit, notify, requireUser, requireUserDoc } from "./lib";

const threadKey = (a: string, b: string) => [a, b].sort().join("|");

/** A user counts as online when their activity was within the last 60s. */
const isOnline = (lastActivity?: number) =>
  !!lastActivity && Date.now() - lastActivity < 60_000;

/** Human-friendly preview for conversations, notifications and emails. */
export function messagePreview(m: {
  body: string;
  kind?: string;
  fileName?: string;
}) {
  if (m.kind === "voice") return "🎤 Voice message";
  if (m.kind === "image") return "📷 Photo";
  if (m.kind === "file") return `📎 ${m.fileName || "File"}`;
  return m.body;
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB per chat attachment

export const myConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    // Not signed in (e.g. an admin session previewing the tutor dashboard
    // without an account) — there are no conversations to show.
    if (userId === null) return [];
    // Indexed scan: only this user's messages (sent OR received), never a
    // full-table collect — this query runs on every page for signed-in users.
    const [sent, received] = await Promise.all([
      ctx.db
        .query("messages")
        .withIndex("by_sender", (q) => q.eq("senderId", userId))
        .collect(),
      ctx.db
        .query("messages")
        .withIndex("by_receiver", (q) => q.eq("receiverId", userId))
        .collect(),
    ]);
    // Merge + dedupe (a message is either sent or received, never both).
    const mine = sent.concat(received);
    const byThread = new Map<string, typeof mine>();
    for (const m of mine) {
      const list = byThread.get(m.threadId) ?? [];
      list.push(m);
      byThread.set(m.threadId, list);
    }
    const conversations = await Promise.all(
      [...byThread.entries()].map(async ([threadId, msgs]) => {
        const sorted = msgs.sort((a, b) => a.createdAt - b.createdAt);
        const last = sorted[sorted.length - 1];
        const otherId =
          last.senderId === userId ? last.receiverId : last.senderId;
        const other = await ctx.db.get(otherId);
        const unread = msgs.filter(
          (m) => m.receiverId === userId && !m.readAt,
        ).length;
        return {
          threadId,
          other: other
            ? {
                _id: other._id,
                name: other.name || "Anonymous",
                image: other.image ?? null,
                role: other.role ?? "student",
              }
            : null,
          lastMessage: messagePreview(last),
          lastAt: last.createdAt,
          lastSenderId: last.senderId,
          unread,
          otherOnline: other ? isOnline(other.lastActivity) : false,
          otherLastSeen: other?.lastActivity ?? null,
        };
      }),
    );
    return conversations.sort((a, b) => b.lastAt - a.lastAt);
  },
});

export const threadMessages = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const userId = await requireUser(ctx);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    // Only thread participants may read the thread.
    return messages
      .filter(
        (m) => m.senderId === userId || m.receiverId === userId,
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const markThreadRead = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const userId = await requireUser(ctx);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    const isParticipant = messages.some(
      (m) => m.senderId === userId || m.receiverId === userId,
    );
    if (!isParticipant) return false;
    for (const m of messages) {
      if (m.receiverId === userId && !m.readAt) {
        await ctx.db.patch(m._id, { readAt: Date.now() });
      }
    }
    return true;
  },
});

export const sendMessage = mutation({
  args: {
    receiverId: v.id("users"),
    body: v.optional(v.string()),
    kind: v.optional(
      v.union(
        v.literal("text"),
        v.literal("image"),
        v.literal("file"),
        v.literal("voice"),
      ),
    ),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { receiverId } = args;
    const user = await requireUserDoc(ctx);
    const receiver = await ctx.db.get(receiverId);
    if (!receiver) throw new Error("Recipient not found.");
    if (receiverId === user._id) throw new Error("You can't message yourself.");

    const trimmed = (args.body ?? "").trim();
    const hasAttachment =
      args.kind === "image" || args.kind === "file" || args.kind === "voice";
    if (!trimmed && !hasAttachment) throw new Error("Message can't be empty.");
    if (hasAttachment && !args.storageId && !args.url) {
      throw new Error("Attachment is missing its file.");
    }
    if (trimmed.length > 4000) {
      throw new Error("Messages are limited to 4,000 characters.");
    }
    if (args.fileSize && args.fileSize > MAX_ATTACHMENT_BYTES) {
      throw new Error("Attachments are limited to 25 MB.");
    }

    // Simple spam guard: max 20 outbound messages per minute per user
    // (DB-backed rate limiter — constant-time, no message-table scan).
    await checkRateLimit(
      ctx,
      `msg:${user._id}`,
      20,
      60_000,
      "You're sending messages too fast — please slow down.",
    );

    // Throttle emails: at most one per receiver every 5 minutes so rapid
    // chats don't flood someone's inbox (the in-app notification always fires).
    const prevToReceiver = await ctx.db
      .query("messages")
      .withIndex("by_receiver", (q) => q.eq("receiverId", receiverId))
      .collect();
    const lastIncoming = prevToReceiver.reduce(
      (max, m) => Math.max(max, m.createdAt),
      0,
    );

    const previewText = messagePreview({
      body: trimmed,
      kind: args.kind,
      fileName: args.fileName,
    });

    // Resolve the playback URL server-side — the authoritative URL comes
    // from Convex storage (ctx.storage.getUrl), never from client-side
    // parsing of the upload URL. This guarantees a valid, stable link that
    // survives refreshes and works for both participants.
    let storedUrl = args.url;
    if (args.storageId) {
      try {
        storedUrl = (await ctx.storage.getUrl(args.storageId)) ?? args.url;
      } catch {
        storedUrl = args.url;
      }
    }
    if (hasAttachment && !storedUrl) {
      throw new Error(
        "The attachment couldn't be stored — please record or send it again.",
      );
    }

    const id = await ctx.db.insert("messages", {
      threadId: threadKey(user._id, receiverId),
      senderId: user._id,
      receiverId,
      body: trimmed,
      kind: hasAttachment ? args.kind : undefined,
      storageId: args.storageId,
      url: storedUrl,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      duration: args.duration,
      createdAt: Date.now(),
    });
    await notify(ctx, {
      userId: receiverId,
      title: `New message from ${user.name || "a student"}`,
      body: previewText.slice(0, 90),
      type: "message",
      link:
        receiver.role === "tutor"
          ? "/tutor/inbox"
          : receiver.role === "admin"
            ? "/admin/chat"
            : "/dashboard/messages",
    });

    // Email the recipient so they never miss a message even when offline.
    if (receiver.email && Date.now() - lastIncoming > 5 * 60 * 1000) {
      const site = (process.env.SITE_URL ?? "https://forgex.academy").replace(
        /\/$/,
        "",
      );
      const senderName = user.name || "a ForgeX user";
      const inbox =
        receiver.role === "tutor"
          ? "/tutor/inbox"
          : receiver.role === "admin"
            ? "/admin/chat"
            : "/dashboard/messages";
      await ctx.scheduler.runAfter(0, internal.email.sendEmail, {
        to: receiver.email,
        subject: `New message from ${senderName} 💬`,
        html: `
          <div style="background:#0d0f0c;color:#e7e5e4;font-family:Segoe UI,Arial,sans-serif;padding:32px 16px">
            <div style="max-width:560px;margin:0 auto;background:#14170f;border:1px solid #2a2e22;border-radius:16px;overflow:hidden">
              <div style="background:#a3e635;padding:20px 28px"><p style="margin:0;color:#0d0f0c;font-weight:800;font-size:18px">⚡ ForgeX Academy</p></div>
              <div style="padding:28px">
                <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#a3e635">New message 💬</p>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#d6d3d1">${senderName} sent you a message on ForgeX Academy:</p>
                <div style="margin:0 0 20px;background:#0d0f0c;border:1px solid #2a2e22;border-radius:12px;padding:14px 16px;font-size:14px;color:#f5f5f4;line-height:1.6">“${previewText.slice(0, 160)}”</div>
                <div>
                  <a href="${site}${inbox}" style="display:inline-block;background:#a3e635;color:#0d0f0c;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">Open conversation</a>
                </div>
              </div>
              <div style="padding:16px 28px;border-top:1px solid #2a2e22;font-size:12px;color:#78716c">You're receiving this because someone messaged you on ForgeX Academy.</div>
            </div>
          </div>`,
        text: `You have a new message from ${senderName} on ForgeX Academy:\n\n“${previewText}”\n\nOpen it here: ${site}${inbox}`,
      });
    }

    return id;
  },
});
