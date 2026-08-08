import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib";

export const myNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const docs = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return docs.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const docs = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return docs.filter((n) => !n.read).length;
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const docs = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const n of docs) {
      if (!n.read) await ctx.db.patch(n._id, { read: true });
    }
    return true;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx);
    const doc = await ctx.db.get(id);
    if (doc && doc.userId === userId) {
      await ctx.db.patch(id, { read: true });
    }
    return true;
  },
});
