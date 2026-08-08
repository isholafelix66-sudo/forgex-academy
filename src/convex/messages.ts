import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { notify, requireUser, requireUserDoc } from "./lib";

const threadKey = (a: string, b: string) => [a, b].sort().join("|");

export const myConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    // Not signed in (e.g. an admin session previewing the tutor dashboard
    // without an account) — there are no conversations to show.
    if (userId === null) return [];
    const messages = await ctx.db.query("messages").collect();
    const mine = messages.filter(
      (m) => m.senderId === userId || m.receiverId === userId,
    );
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
          lastMessage: last.body,
          lastAt: last.createdAt,
          unread,
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
    body: v.string(),
  },
  handler: async (ctx, { receiverId, body }) => {
    const user = await requireUserDoc(ctx);
    const receiver = await ctx.db.get(receiverId);
    if (!receiver) throw new Error("Recipient not found.");
    if (receiverId === user._id) throw new Error("You can't message yourself.");
    const trimmed = body.trim();
    if (!trimmed) throw new Error("Message can't be empty.");
    const id = await ctx.db.insert("messages", {
      threadId: threadKey(user._id, receiverId),
      senderId: user._id,
      receiverId,
      body: trimmed,
      createdAt: Date.now(),
    });
    await notify(ctx, {
      userId: receiverId,
      title: `New message from ${user.name || "a student"}`,
      body: trimmed.slice(0, 90),
      type: "message",
      link: receiver.role === "tutor" ? "/tutor/inbox" : "/dashboard/messages",
    });
    return id;
  },
});
