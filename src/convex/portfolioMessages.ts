import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { checkRateLimit } from "./lib";
import { randomHex, sha256Hex } from "./portfolioAdmin";
import { getPortfolioUser, requirePortfolioUser } from "./portfolioUsers";

/* ═══════════════════════════════════════════════════════════════════════════
   PORTFOLIO MESSAGING — visitors message a portfolio owner.

   Same architecture as the ForgeX chat (one conversation per visitor, ordered
   messages, unread counters, read receipts, attachments in file storage, the
   same ChatBubble/ChatComposer UI) with two deliberate differences:

     1. Visitors do NOT need an account. A guest token is issued by the server
        when they start a conversation and kept in the browser; only its hash
        is stored, so the conversation is theirs to continue but nobody else
        can read it.
     2. Conversations are keyed to a portfolio + its creator, so an owner only
        ever sees threads addressed to portfolios they own, and Academy
        conversations never appear here (separate tables entirely).

   Nothing in this module reads or writes the Academy `messages` table.
   ═══════════════════════════════════════════════════════════════════════════ */

const MAX_BODY = 2000;
const MAX_NAME = 60;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
/** How many new conversations one portfolio accepts per hour (spam guard). */
const NEW_THREADS_PER_HOUR = 30;

export type PortfolioChatMessage = {
  _id: string;
  body: string;
  kind: string | null;
  storageId: string | null;
  url: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  duration: number | null;
  createdAt: number;
  readAt: number | null;
  from: "guest" | "owner";
};

type AttachmentInput = {
  kind?: "image" | "file" | "voice";
  storageId?: Id<"_storage">;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
};

/** Normalises the optional attachment arguments sent by composers. */
function attachmentArgs(args: {
  kind?: "text" | "image" | "file" | "voice";
  storageId?: Id<"_storage">;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
}): AttachmentInput {
  if (!args.kind || args.kind === "text") return {};
  return {
    kind: args.kind,
    storageId: args.storageId,
    fileName: args.fileName,
    fileSize: args.fileSize,
    mimeType: args.mimeType,
    duration: args.duration,
  };
}

function preview(body: string, kind?: string) {
  if (kind === "voice") return "🎤 Voice message";
  if (kind === "image") return "📷 Photo";
  if (kind === "file") return "📎 File";
  return body.slice(0, 120);
}

function cleanName(name: string) {
  const value = name.trim().slice(0, MAX_NAME);
  if (value.length < 2) {
    throw new Error("Please add your name so they know who's messaging.");
  }
  return value;
}

function cleanBody(body: string, hasAttachment: boolean) {
  const value = body.trim();
  if (!value && !hasAttachment) throw new Error("Write a message first.");
  if (value.length > MAX_BODY) {
    throw new Error(`Messages are limited to ${MAX_BODY} characters.`);
  }
  return value;
}

function cleanEmail(email?: string) {
  const value = (email ?? "").trim().toLowerCase();
  if (!value) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    throw new Error("That email address doesn't look right.");
  }
  return value.slice(0, 160);
}

/** Resolve a published portfolio + its owner for guest messaging. */
async function openPortfolio(ctx: QueryCtx | MutationCtx, slug: string) {
  const portfolio = await ctx.db
    .query("portfolios")
    .withIndex("by_slug", (q) => q.eq("slug", slug.trim().toLowerCase()))
    .first();
  if (!portfolio || portfolio.suspended || portfolio.visibility === "draft") {
    return null;
  }
  if (!portfolio.creatorId) return null;
  return portfolio;
}

async function threadByToken(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<Doc<"portfolioThreads"> | null> {
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await ctx.db
    .query("portfolioThreads")
    .withIndex("by_token", (q) => q.eq("guestTokenHash", tokenHash))
    .first();
  return row ?? null;
}

async function threadMessages(ctx: QueryCtx, threadId: Id<"portfolioThreads">) {
  const rows = await ctx.db
    .query("portfolioMessages")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .collect();
  return rows
    .sort((a, b) => a.createdAt - b.createdAt)
    .map<PortfolioChatMessage>((m) => ({
      _id: m._id as string,
      body: m.body,
      kind: m.kind ?? null,
      storageId: m.storageId ?? null,
      url: m.url ?? null,
      fileName: m.fileName ?? null,
      fileSize: m.fileSize ?? null,
      mimeType: m.mimeType ?? null,
      duration: m.duration ?? null,
      createdAt: m.createdAt,
      readAt: m.readAt ?? null,
      from: m.from,
    }));
}

/** Resolve the attachment URL server-side so playback never depends on the client. */
async function resolveAttachment(
  ctx: MutationCtx,
  attachment: AttachmentInput,
) {
  if (!attachment.kind) return {};
  const { kind, storageId } = attachment;
  if (!storageId && !attachment.fileName) {
    throw new Error("That attachment is missing its file.");
  }
  if (attachment.fileSize && attachment.fileSize > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachments are limited to 25 MB.");
  }
  let url: string | undefined;
  if (storageId) {
    url = (await ctx.storage.getUrl(storageId)) ?? undefined;
  }
  return {
    kind,
    storageId,
    url,
    fileName: attachment.fileName?.slice(0, 200),
    fileSize: attachment.fileSize,
    mimeType: attachment.mimeType?.slice(0, 120),
    duration: attachment.duration,
  };
}

/* ── Guest side ────────────────────────────────────────────────────────── */

/**
 * Start a conversation with a portfolio owner. Works signed-out: the visitor
 * gives a display name (and optionally an email) and we hand back a guest
 * token that keeps the conversation theirs.
 */
export const startThread = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    context: v.optional(v.string()),
    body: v.string(),
    kind: v.optional(
      v.union(
        v.literal("text"),
        v.literal("image"),
        v.literal("file"),
        v.literal("voice"),
      ),
    ),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const portfolio = await openPortfolio(ctx, args.slug);
    if (!portfolio) throw new Error("This portfolio isn't available for messages.");

    await checkRateLimit(
      ctx,
      `pf-msg-new:${portfolio._id}`,
      NEW_THREADS_PER_HOUR,
      60 * 60 * 1000,
      "This portfolio is receiving a lot of messages right now — try again shortly.",
    );

    const name = cleanName(args.name);
    const email = cleanEmail(args.email);
    const body = cleanBody(args.body, !!args.kind && args.kind !== "text");
    const attachment = await resolveAttachment(ctx, attachmentArgs(args));

    const token = randomHex(24);
    const now = Date.now();
    const threadId = await ctx.db.insert("portfolioThreads", {
      portfolioId: portfolio._id,
      portfolioSlug: portfolio.slug,
      creatorId: portfolio.creatorId!,
      guestTokenHash: await sha256Hex(token),
      guestName: name,
      guestEmail: email,
      context: args.context?.trim().slice(0, 120) || undefined,
      status: "open",
      lastMessageAt: now,
      lastMessagePreview: preview(body, args.kind),
      lastFrom: "guest",
      guestUnread: 0,
      ownerUnread: 1,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("portfolioMessages", {
      threadId,
      from: "guest",
      body,
      ...attachment,
      createdAt: now,
    });

    return { token, threadId: threadId as string, slug: portfolio.slug };
  },
});

/** Reactive state of the visitor's own conversation (null before they start). */
export const guestThread = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const thread = await threadByToken(ctx, token);
    if (!thread) return null;
    return {
      _id: thread._id as string,
      portfolioSlug: thread.portfolioSlug,
      guestName: thread.guestName,
      status: thread.status,
      lastMessageAt: thread.lastMessageAt,
      guestUnread: thread.guestUnread,
      messages: await threadMessages(ctx, thread._id),
    };
  },
});

/** Visitor sends another message; this also clears their unread count. */
export const guestSend = mutation({
  args: {
    token: v.string(),
    body: v.string(),
    kind: v.optional(
      v.union(
        v.literal("text"),
        v.literal("image"),
        v.literal("file"),
        v.literal("voice"),
      ),
    ),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const thread = await threadByToken(ctx, args.token);
    if (!thread) throw new Error("This conversation has expired — start a new one.");

    await checkRateLimit(
      ctx,
      `pf-msg-thread:${thread._id}`,
      40,
      10 * 60 * 1000,
      "You're sending messages quickly — give them a moment to reply.",
    );

    const body = cleanBody(args.body, !!args.kind && args.kind !== "text");
    const attachment = await resolveAttachment(ctx, attachmentArgs(args));
    const now = Date.now();

    await ctx.db.insert("portfolioMessages", {
      threadId: thread._id,
      from: "guest",
      body,
      ...attachment,
      createdAt: now,
    });

    await ctx.db.patch(thread._id, {
      lastMessageAt: now,
      lastMessagePreview: preview(body, args.kind),
      lastFrom: "guest",
      ownerUnread: thread.ownerUnread + 1,
      guestUnread: 0,
      // A new message revives an archived conversation.
      status: thread.status === "spam" ? "spam" : "open",
      updatedAt: now,
    });

    return true;
  },
});

/** Mark the owner's replies as read for this visitor. */
export const guestMarkRead = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const thread = await threadByToken(ctx, token);
    if (!thread) return false;
    const rows = await ctx.db
      .query("portfolioMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .collect();
    for (const m of rows) {
      if (m.from === "owner" && !m.readAt) {
        await ctx.db.patch(m._id, { readAt: Date.now() });
      }
    }
    if (thread.guestUnread > 0) {
      await ctx.db.patch(thread._id, { guestUnread: 0 });
    }
    return true;
  },
});

/**
 * Upload URL for a guest replying inside an existing conversation. Gated by
 * the guest token + a per-thread rate limit so it can't be abused as free
 * file hosting.
 */
export const guestUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const thread = await threadByToken(ctx, token);
    if (!thread) throw new Error("This conversation has expired — start a new one.");
    await checkRateLimit(ctx, `pf-msg-upload:${thread._id}`, 20, 60 * 60 * 1000);
    return await ctx.storage.generateUploadUrl();
  },
});

/* ── Owner side (Portfolio creator dashboard) ──────────────────────────── */

/** Every conversation addressed to a portfolio this creator owns. */
export const ownerThreads = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getPortfolioUser(ctx, token);
    if (!user) return [];
    const rows = await ctx.db
      .query("portfolioThreads")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
      .collect();
    return rows
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
      .map((t) => ({
        _id: t._id as string,
        portfolioSlug: t.portfolioSlug,
        guestName: t.guestName,
        guestEmail: t.guestEmail ?? null,
        context: t.context ?? null,
        status: t.status,
        lastMessageAt: t.lastMessageAt,
        lastMessagePreview: t.lastMessagePreview,
        lastFrom: t.lastFrom,
        unread: t.ownerUnread,
        createdAt: t.createdAt,
      }));
  },
});

/** Unread badge for the dashboard navigation. */
export const ownerUnreadCount = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getPortfolioUser(ctx, token);
    if (!user) return 0;
    const rows = await ctx.db
      .query("portfolioThreads")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
      .collect();
    return rows.reduce((sum, t) => sum + t.ownerUnread, 0);
  },
});

/** One conversation — only the owner of that portfolio may read it. */
export const ownerThread = query({
  args: { token: v.string(), threadId: v.id("portfolioThreads") },
  handler: async (ctx, { token, threadId }) => {
    const user = await getPortfolioUser(ctx, token);
    if (!user) return null;
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.creatorId !== user._id) return null;
    return {
      _id: thread._id as string,
      portfolioSlug: thread.portfolioSlug,
      guestName: thread.guestName,
      guestEmail: thread.guestEmail ?? null,
      context: thread.context ?? null,
      status: thread.status,
      lastMessageAt: thread.lastMessageAt,
      ownerUnread: thread.ownerUnread,
      messages: await threadMessages(ctx, thread._id),
    };
  },
});

/** Owner replies; also marks the visitor's messages read. */
export const ownerSend = mutation({
  args: {
    token: v.string(),
    threadId: v.id("portfolioThreads"),
    body: v.string(),
    kind: v.optional(
      v.union(
        v.literal("text"),
        v.literal("image"),
        v.literal("file"),
        v.literal("voice"),
      ),
    ),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePortfolioUser(ctx, args.token);
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.creatorId !== user._id) {
      throw new Error("That conversation isn't yours.");
    }

    await checkRateLimit(
      ctx,
      `pf-owner-msg:${user._id}`,
      60,
      60 * 1000,
      "You're sending messages too fast — please slow down.",
    );

    const body = cleanBody(args.body, !!args.kind && args.kind !== "text");
    const attachment = await resolveAttachment(ctx, attachmentArgs(args));
    const now = Date.now();

    await ctx.db.insert("portfolioMessages", {
      threadId: thread._id,
      from: "owner",
      body,
      ...attachment,
      createdAt: now,
    });

    // Replying marks the visitor's messages read.
    const incoming = await ctx.db
      .query("portfolioMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .collect();
    for (const m of incoming) {
      if (m.from === "guest" && !m.readAt) {
        await ctx.db.patch(m._id, { readAt: now });
      }
    }

    await ctx.db.patch(thread._id, {
      lastMessageAt: now,
      lastMessagePreview: preview(body, args.kind),
      lastFrom: "owner",
      guestUnread: thread.guestUnread + 1,
      ownerUnread: 0,
      updatedAt: now,
    });

    return true;
  },
});

/** Opening a conversation clears its unread counter. */
export const ownerMarkRead = mutation({
  args: { token: v.string(), threadId: v.id("portfolioThreads") },
  handler: async (ctx, { token, threadId }) => {
    const user = await requirePortfolioUser(ctx, token);
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.creatorId !== user._id) return false;
    const rows = await ctx.db
      .query("portfolioMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    const now = Date.now();
    for (const m of rows) {
      if (m.from === "guest" && !m.readAt) {
        await ctx.db.patch(m._id, { readAt: now });
      }
    }
    if (thread.ownerUnread > 0) {
      await ctx.db.patch(threadId, { ownerUnread: 0, updatedAt: now });
    }
    return true;
  },
});

/** Archive / reopen / flag a conversation. */
export const ownerSetStatus = mutation({
  args: {
    token: v.string(),
    threadId: v.id("portfolioThreads"),
    status: v.union(
      v.literal("open"),
      v.literal("archived"),
      v.literal("spam"),
    ),
  },
  handler: async (ctx, { token, threadId, status }) => {
    const user = await requirePortfolioUser(ctx, token);
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.creatorId !== user._id) {
      throw new Error("That conversation isn't yours.");
    }
    await ctx.db.patch(threadId, { status, updatedAt: Date.now() });
    return true;
  },
});

/** Delete a conversation and its messages (owner only). */
export const ownerDeleteThread = mutation({
  args: { token: v.string(), threadId: v.id("portfolioThreads") },
  handler: async (ctx, { token, threadId }) => {
    const user = await requirePortfolioUser(ctx, token);
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.creatorId !== user._id) {
      throw new Error("That conversation isn't yours.");
    }
    const rows = await ctx.db
      .query("portfolioMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    for (const m of rows) await ctx.db.delete(m._id);
    await ctx.db.delete(threadId);
    return true;
  },
});

/**
 * Internal maintenance — drops empty conversations abandoned before a first
 * message ever landed (kept as a safety net for interrupted flows).
 */
export const pruneEmptyThreads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const rows = await ctx.db
      .query("portfolioThreads")
      .withIndex("by_lastMessageAt", (q) => q.lt("lastMessageAt", cutoff))
      .take(50);
    let removed = 0;
    for (const t of rows) {
      const first = await ctx.db
        .query("portfolioMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", t._id))
        .first();
      if (!first) {
        await ctx.db.delete(t._id);
        removed += 1;
      }
    }
    return { removed };
  },
});
