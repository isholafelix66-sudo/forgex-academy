/**
 * Communication & Community — ADMIN MODERATION.
 *
 * Password-session gated (requireAdminSession) like the rest of the admin
 * portal — no user account is involved, so every admin action is logged to
 * `moderationAuditLogs` + `moderationActions` for accountability. Admins can
 * manage ANY course community, review student DMs, play voice notes, remove
 * members, lock/unlock/archive communities, restrict users and send messages
 * clearly attributed to “ForgeX Admin”.
 */
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdminSession, notify, publicUser } from "./lib";
import {
  addMembership,
  ensureCommunityForCourse,
  logModeration,
  messagePreview,
  threadKey,
} from "./community";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const PAGE = 50;

async function hydrateSender(ctx: QueryCtx | MutationCtx, m: {
  senderId?: Id<"users"> | null;
  senderKind: string;
  senderLabel?: string | null;
}) {
  if (m.senderKind === "admin") {
    return { _id: null, name: m.senderLabel || "ForgeX Admin", image: null, role: "admin", isStaff: true };
  }
  if (m.senderKind === "system") {
    return { _id: null, name: m.senderLabel || "ForgeX", image: null, role: "system", isStaff: true };
  }
  const u = m.senderId ? await ctx.db.get(m.senderId) : null;
  if (!u) return { _id: null, name: "Deleted user", image: null, role: "student", isStaff: false };
  const p = publicUser(u);
  return { _id: p._id, name: p.name, image: p.image, role: p.role, isStaff: p.role === "tutor" || p.role === "admin" };
}

/** Notify a user about a moderation outcome. */
async function moderateNotify(
  ctx: MutationCtx,
  userId: Id<"users">,
  title: string,
  body: string,
) {
  try {
    await notify(ctx, { userId, title, body, type: "moderation", link: "/dashboard/notifications" });
  } catch {
    /* target may be deleted — ignore */
  }
}

// ---------------------------------------------------------------------------
// Queries — communities
// ---------------------------------------------------------------------------

export const adminCommunities = query({
  args: { token: v.string(), search: v.optional(v.string()) },
  handler: async (ctx, { token, search }) => {
    await requireAdminSession(ctx, token);
    const q = (search ?? "").trim().toLowerCase();
    const communities = await ctx.db.query("courseCommunities").collect();
    const [members, messages, reports] = await Promise.all([
      ctx.db.query("communityMembers").collect(),
      ctx.db.query("communityMessages").collect(),
      ctx.db.query("communicationReports").collect(),
    ]);
    const hydrated = await Promise.all(
      communities.map(async (c) => {
        const course = await ctx.db.get(c.courseId);
        const memberCount = members.filter(
          (m) => m.communityId === c._id && m.status !== "removed",
        ).length;
        const messageCount = messages.filter((m) => m.communityId === c._id).length;
        const reportCount = reports.filter(
          (r) => r.communityId === c._id && r.status === "open",
        ).length;
        return {
          _id: c._id,
          name: c.name,
          status: c.status,
          lockedReason: c.lockedReason ?? null,
          courseTitle: course?.title ?? "Unknown course",
          memberCount,
          messageCount,
          reportCount,
          lastActivityAt: c.lastActivityAt ?? null,
          createdAt: c.createdAt,
        };
      }),
    );
    return hydrated
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.courseTitle.toLowerCase().includes(q))
      .sort((a, b) => (b.lastActivityAt ?? b.createdAt) - (a.lastActivityAt ?? a.createdAt));
  },
});

export const adminCommunityDetail = query({
  args: { token: v.string(), communityId: v.id("courseCommunities") },
  handler: async (ctx, { token, communityId }) => {
    await requireAdminSession(ctx, token);
    const community = await ctx.db.get(communityId);
    if (!community) return null;
    const course = await ctx.db.get(community.courseId);
    const [members, messages, reports] = await Promise.all([
      ctx.db
        .query("communityMembers")
        .withIndex("by_community", (q) => q.eq("communityId", communityId))
        .collect(),
      ctx.db
        .query("communityMessages")
        .withIndex("by_community", (q) => q.eq("communityId", communityId))
        .collect(),
      ctx.db
        .query("communicationReports")
        .collect(),
    ]);
    return {
      community: {
        _id: community._id,
        name: community.name,
        status: community.status,
        lockedReason: community.lockedReason ?? null,
        createdAt: community.createdAt,
        lastActivityAt: community.lastActivityAt ?? null,
      },
      course: course ? { _id: course._id, title: course.title, slug: course.slug } : null,
      memberCount: members.filter((m) => m.status !== "removed").length,
      removedCount: members.filter((m) => m.status === "removed").length,
      restrictedCount: members.filter((m) => m.status === "restricted").length,
      messageCount: messages.length,
      openReports: reports.filter((r) => r.communityId === communityId && r.status === "open").length,
    };
  },
});

export const adminCommunityMessages = query({
  args: {
    token: v.string(),
    communityId: v.id("courseCommunities"),
    cursor: v.optional(v.number()),
    filter: v.optional(v.union(v.literal("all"), v.literal("text"), v.literal("voice"), v.literal("files"), v.literal("images"), v.literal("reported"))),
  },
  handler: async (ctx, { token, communityId, cursor, filter }) => {
    await requireAdminSession(ctx, token);
    const community = await ctx.db.get(communityId);
    if (!community) return { messages: [], nextCursor: null };
    let rows = await ctx.db
      .query("communityMessages")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .order("desc")
      .take(PAGE + 1);
    if (cursor !== undefined) rows = rows.filter((m) => m.createdAt < cursor);
    const hasMore = rows.length > PAGE;
    const page = hasMore ? rows.slice(0, PAGE) : rows;
    const oldest = page.length ? page[page.length - 1].createdAt : null;
    const reports = await ctx.db.query("communicationReports").collect();
    const reportedIds = new Set(
      reports.filter((r) => r.communityId === communityId && r.messageId).map((r) => r.messageId),
    );
    const filtered = page.filter((m) => {
      if (filter === "all" || !filter) return true;
      if (filter === "reported") return reportedIds.has(m._id.toString());
      if (filter === "text") return (m.kind ?? "text") === "text" && !m.deleted;
      if (filter === "voice") return m.kind === "voice" && !m.deleted;
      if (filter === "images") return m.kind === "image" && !m.deleted;
      if (filter === "files") return (m.kind === "file") && !m.deleted;
      return true;
    });
    const messages = await Promise.all(
      [...filtered].reverse().map(async (m) => ({
        _id: m._id,
        communityId: m.communityId,
        sender: await hydrateSender(ctx, m),
        senderKind: m.senderKind,
        body: m.body,
        kind: m.kind ?? null,
        storageId: m.storageId ?? null,
        url: m.url ?? null,
        fileName: m.fileName ?? null,
        fileSize: m.fileSize ?? null,
        mimeType: m.mimeType ?? null,
        duration: m.duration ?? null,
        reactions: m.reactions,
        deleted: m.deleted,
        deletedBy: m.deletedBy ?? null,
        editedAt: m.editedAt ?? null,
        createdAt: m.createdAt,
        reported: reportedIds.has(m._id.toString()),
      })),
    );
    return { messages, nextCursor: hasMore ? oldest : null };
  },
});

export const adminCommunityMembers = query({
  args: { token: v.string(), communityId: v.id("courseCommunities"), search: v.optional(v.string()) },
  handler: async (ctx, { token, communityId, search }) => {
    await requireAdminSession(ctx, token);
    const q = (search ?? "").trim().toLowerCase();
    const rows = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .collect();
    const hydrated = await Promise.all(
      rows.map(async (r) => {
        const u = await ctx.db.get(r.userId);
        return {
          _id: r._id,
          userId: r.userId,
          name: u?.name ?? "Deleted user",
          image: u?.image ?? null,
          email: u?.email ?? null,
          role: r.role,
          status: r.status,
          joinedAt: r.joinedAt,
          lastReadAt: r.lastReadAt ?? null,
          removedAt: r.removedAt ?? null,
          removedReason: r.removedReason ?? null,
          online: !!u?.lastActivity && Date.now() - u.lastActivity < 60_000,
          suspended: !!u?.suspended,
        };
      }),
    );
    return hydrated
      .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q))
      .sort((a, b) => {
        const rank = (s: string) => (s === "removed" ? 3 : s === "restricted" ? 2 : 1);
        return rank(a.status) - rank(b.status) || b.joinedAt - a.joinedAt;
      });
  },
});

// ---------------------------------------------------------------------------
// Queries — student DMs
// ---------------------------------------------------------------------------

export const adminStudentConversations = query({
  args: { token: v.string(), search: v.optional(v.string()) },
  handler: async (ctx, { token, search }) => {
    await requireAdminSession(ctx, token);
    const q = (search ?? "").trim().toLowerCase();
    const convos = await ctx.db.query("studentConversations").collect();
    const [messages, reports] = await Promise.all([
      ctx.db.query("studentMessages").collect(),
      ctx.db.query("communicationReports").collect(),
    ]);
    const hydrated = await Promise.all(
      convos.map(async (c) => {
        const [a, b] = await Promise.all([ctx.db.get(c.userAId), ctx.db.get(c.userBId)]);
        const msgs = messages.filter((m) => m.conversationId === c._id);
        const last = [...msgs].sort((x, y) => y.createdAt - x.createdAt)[0];
        const openReports = reports.filter(
          (r) => r.conversationId === c._id && r.status === "open",
        ).length;
        return {
          _id: c._id,
          status: c.status,
          lockedReason: c.lockedReason ?? null,
          participants: [
            { _id: a?._id, name: a?.name ?? "Deleted user", image: a?.image ?? null, email: a?.email ?? null, role: a?.role ?? "student" },
            { _id: b?._id, name: b?.name ?? "Deleted user", image: b?.image ?? null, email: b?.email ?? null, role: b?.role ?? "student" },
          ].filter((p) => p._id),
          messageCount: msgs.length,
          lastMessage: last ? messagePreview(last) : null,
          lastAt: last?.createdAt ?? c.createdAt,
          openReports,
        };
      }),
    );
    return hydrated
      .filter(
        (c) =>
          !q ||
          c.participants.some((p) =>
            (p.name ?? "").toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => b.lastAt - a.lastAt);
  },
});

export const adminConversationMessages = query({
  args: { token: v.string(), conversationId: v.id("studentConversations"), cursor: v.optional(v.number()) },
  handler: async (ctx, { token, conversationId, cursor }) => {
    await requireAdminSession(ctx, token);
    const convo = await ctx.db.get(conversationId);
    if (!convo) return { messages: [], nextCursor: null, convo: null };
    let rows = await ctx.db
      .query("studentMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(PAGE + 1);
    if (cursor !== undefined) rows = rows.filter((m) => m.createdAt < cursor);
    const hasMore = rows.length > PAGE;
    const page = hasMore ? rows.slice(0, PAGE) : rows;
    const oldest = page.length ? page[page.length - 1].createdAt : null;
    const [a, b] = await Promise.all([ctx.db.get(convo.userAId), ctx.db.get(convo.userBId)]);
    const messages = await Promise.all(
      [...page].reverse().map(async (m) => {
        const sender = m.senderId === a?._id ? a : b;
        return {
          _id: m._id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          sender: {
            _id: m.senderId,
            name: sender?.name ?? "Deleted user",
            image: sender?.image ?? null,
            role: sender?.role ?? "student",
            email: sender?.email ?? null,
            isStaff: false,
          },
          body: m.body,
          kind: m.kind ?? null,
          storageId: m.storageId ?? null,
          url: m.url ?? null,
          fileName: m.fileName ?? null,
          fileSize: m.fileSize ?? null,
          mimeType: m.mimeType ?? null,
          duration: m.duration ?? null,
          replyToId: m.replyToId ?? null,
          reactions: m.reactions,
          deleted: m.deleted,
          deletedBy: m.deletedBy ?? null,
          editedAt: m.editedAt ?? null,
          createdAt: m.createdAt,
          readAt: m.readAt ?? null,
        };
      }),
    );
    return {
      messages,
      nextCursor: hasMore ? oldest : null,
      convo: {
        _id: convo._id,
        status: convo.status,
        lockedReason: convo.lockedReason ?? null,
        participants: [
          { _id: a?._id, name: a?.name ?? "Deleted user", image: a?.image ?? null, email: a?.email ?? null },
          { _id: b?._id, name: b?.name ?? "Deleted user", image: b?.image ?? null, email: b?.email ?? null },
        ].filter((p) => p._id),
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Queries — reports & audit
// ---------------------------------------------------------------------------

export const adminReports = query({
  args: { token: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, { token, status }) => {
    await requireAdminSession(ctx, token);
    const rows = await ctx.db.query("communicationReports").collect();
    const hydrated = await Promise.all(
      rows
        .filter((r) => !status || r.status === status)
        .map(async (r) => {
          const reporter = await ctx.db.get(r.reporterId);
          const target = r.targetUserId ? await ctx.db.get(r.targetUserId) : null;
          let context = "";
          if (r.communityId) {
            const c = await ctx.db.get(r.communityId);
            context = c?.name ?? "Community";
          } else if (r.conversationId) {
            context = "Student DM";
          }
          let messagePreviewText = null;
          if (r.messageId) {
            if (r.scope === "community" && r.communityId) {
              const msg = await ctx.db.get(r.messageId as Id<"communityMessages">).catch(() => null);
              messagePreviewText = msg ? messagePreview(msg) : "Message deleted";
            } else if (r.scope === "dm" && r.conversationId) {
              const msg = await ctx.db.get(r.messageId as Id<"studentMessages">).catch(() => null);
              messagePreviewText = msg ? messagePreview(msg) : "Message deleted";
            }
          }
          return {
            ...r,
            reporterName: reporter?.name ?? "Deleted user",
            targetName: target?.name ?? null,
            targetEmail: target?.email ?? null,
            context,
            messagePreview: messagePreviewText,
          };
        }),
    );
    return hydrated.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const adminModerationAudit = query({
  args: { token: v.string(), action: v.optional(v.string()) },
  handler: async (ctx, { token, action }) => {
    await requireAdminSession(ctx, token);
    const rows = await ctx.db.query("moderationAuditLogs").collect();
    const hydrated = await Promise.all(
      rows
        .filter((r) => !action || r.action === action)
        .map(async (r) => {
          const user = r.userId ? await ctx.db.get(r.userId) : null;
          let context = "";
          if (r.communityId) {
            const c = await ctx.db.get(r.communityId);
            context = c?.name ?? "Community";
          } else if (r.conversationId) {
            context = "Student DM";
          }
          return {
            ...r,
            userName: user?.name ?? null,
            context,
          };
        }),
    );
    return hydrated.sort((a, b) => b.createdAt - a.createdAt).slice(0, 200);
  },
});

// ---------------------------------------------------------------------------
// Mutations — community controls
// ---------------------------------------------------------------------------

export const adminSetCommunityStatus = mutation({
  args: {
    token: v.string(),
    communityId: v.id("courseCommunities"),
    status: v.union(v.literal("active"), v.literal("locked"), v.literal("archived")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, communityId, status, reason }) => {
    await requireAdminSession(ctx, token);
    const community = await ctx.db.get(communityId);
    if (!community) throw new Error("Community not found.");
    await ctx.db.patch(communityId, {
      status,
      lockedReason: status === "active" ? undefined : reason?.trim() || undefined,
    });
    await logModeration(ctx, `ADMIN_${status.toUpperCase()}_COMMUNITY`, {
      targetType: "community",
      targetId: communityId,
      communityId,
      reason: reason?.trim(),
    });
    return true;
  },
});

export const adminRemoveMember = mutation({
  args: {
    token: v.string(),
    communityId: v.id("courseCommunities"),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, communityId, userId, reason }) => {
    await requireAdminSession(ctx, token);
    const membership = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", communityId).eq("userId", userId))
      .first();
    if (!membership) throw new Error("This user isn't a member.");
    await ctx.db.patch(membership._id, {
      status: "removed",
      removedAt: Date.now(),
      removedReason: reason?.trim() || undefined,
    });
    const user = await ctx.db.get(userId);
    await logModeration(ctx, "ADMIN_REMOVED_MEMBER", {
      targetType: "member",
      targetId: userId,
      communityId,
      userId,
      reason: reason?.trim(),
    });
    await moderateNotify(
      ctx,
      userId,
      "Removed from community",
      `You were removed from a course community${reason ? `: ${reason}` : "."}`,
    );
    return true;
  },
});

export const adminRestoreMember = mutation({
  args: {
    token: v.string(),
    communityId: v.id("courseCommunities"),
    userId: v.id("users"),
  },
  handler: async (ctx, { token, communityId, userId }) => {
    await requireAdminSession(ctx, token);
    const membership = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", communityId).eq("userId", userId))
      .first();
    if (!membership) throw new Error("This user isn't a member.");
    const user = await ctx.db.get(userId);
    const role: Doc<"communityMembers">["role"] =
      user?.role === "admin" ? "admin" : user?.role === "tutor" ? "tutor" : "student";
    await ctx.db.patch(membership._id, {
      status: "active",
      role,
      removedAt: undefined,
      removedReason: undefined,
    });
    await logModeration(ctx, "ADMIN_RESTORED_MEMBER", {
      targetType: "member",
      targetId: userId,
      communityId,
      userId,
    });
    await moderateNotify(ctx, userId, "Community access restored", "Your access to a course community has been restored.");
    return true;
  },
});

export const adminRestrictMember = mutation({
  args: {
    token: v.string(),
    communityId: v.id("courseCommunities"),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, communityId, userId, reason }) => {
    await requireAdminSession(ctx, token);
    const membership = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", communityId).eq("userId", userId))
      .first();
    if (!membership) throw new Error("This user isn't a member.");
    await ctx.db.patch(membership._id, { status: "restricted" });
    await logModeration(ctx, "ADMIN_RESTRICTED_USER", {
      targetType: "member",
      targetId: userId,
      communityId,
      userId,
      reason: reason?.trim(),
    });
    await moderateNotify(ctx, userId, "Posting restricted", `Your posting access was restricted in a community${reason ? `: ${reason}` : "."}`);
    return true;
  },
});

export const adminRemoveMessage = mutation({
  args: {
    token: v.string(),
    scope: v.union(v.literal("community"), v.literal("dm")),
    messageId: v.string(),
    communityId: v.optional(v.id("courseCommunities")),
    conversationId: v.optional(v.id("studentConversations")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, scope, messageId, communityId, conversationId, reason }) => {
    await requireAdminSession(ctx, token);
    if (scope === "community") {
      const msg = await ctx.db.get(messageId as Id<"communityMessages">).catch(() => null);
      if (!msg) throw new Error("Message not found.");
      await ctx.db.patch(msg._id, { deleted: true, deletedBy: "admin", body: "" });
      await logModeration(ctx, "ADMIN_REMOVED_MESSAGE", {
        targetType: "community-message",
        targetId: msg._id,
        communityId: msg.communityId,
        messageId: msg._id,
        userId: msg.senderId,
        reason: reason?.trim(),
      });
    } else {
      const msg = await ctx.db.get(messageId as Id<"studentMessages">).catch(() => null);
      if (!msg) throw new Error("Message not found.");
      await ctx.db.patch(msg._id, { deleted: true, deletedBy: "admin", body: "" });
      await logModeration(ctx, "ADMIN_REMOVED_MESSAGE", {
        targetType: "dm-message",
        targetId: msg._id,
        conversationId: msg.conversationId,
        messageId: msg._id,
        userId: msg.senderId,
        reason: reason?.trim(),
      });
    }
    return true;
  },
});

export const adminSendCommunityNotice = mutation({
  args: {
    token: v.string(),
    communityId: v.id("courseCommunities"),
    body: v.string(),
  },
  handler: async (ctx, { token, communityId, body }) => {
    await requireAdminSession(ctx, token);
    const community = await ctx.db.get(communityId);
    if (!community) throw new Error("Community not found.");
    const trimmed = body.trim();
    if (!trimmed) throw new Error("Message can't be empty.");
    if (trimmed.length > 4000) throw new Error("Messages are limited to 4,000 characters.");
    await ctx.db.insert("communityMessages", {
      communityId,
      senderKind: "admin",
      senderLabel: "ForgeX Admin",
      body: trimmed,
      reactions: [],
      deleted: false,
      createdAt: Date.now(),
    });
    await ctx.db.patch(communityId, { lastActivityAt: Date.now() });
    await logModeration(ctx, "ADMIN_SENT_MODERATOR_MESSAGE", {
      targetType: "community",
      targetId: communityId,
      communityId,
    });
    return true;
  },
});

export const adminLockConversation = mutation({
  args: {
    token: v.string(),
    conversationId: v.id("studentConversations"),
    locked: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, conversationId, locked, reason }) => {
    await requireAdminSession(ctx, token);
    const convo = await ctx.db.get(conversationId);
    if (!convo) throw new Error("Conversation not found.");
    await ctx.db.patch(conversationId, {
      status: locked ? "locked" : "active",
      lockedReason: locked ? reason?.trim() || "Locked by moderator" : undefined,
    });
    await logModeration(ctx, locked ? "ADMIN_LOCKED_CONVERSATION" : "ADMIN_UNLOCKED_CONVERSATION", {
      targetType: "conversation",
      targetId: conversationId,
      conversationId,
      reason: reason?.trim(),
    });
    if (locked) {
      await moderateNotify(ctx, convo.userAId, "Conversation locked", "A moderator locked one of your private conversations.");
      await moderateNotify(ctx, convo.userBId, "Conversation locked", "A moderator locked one of your private conversations.");
    }
    return true;
  },
});

export const adminWarnUser = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, { token, userId, reason }) => {
    await requireAdminSession(ctx, token);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");
    await logModeration(ctx, "ADMIN_WARNED_USER", {
      targetType: "user",
      targetId: userId,
      userId,
      reason: reason.trim(),
    });
    await moderateNotify(ctx, userId, "Moderation warning", reason.trim() || "Please review the ForgeX community guidelines.");
    return true;
  },
});

export const adminSuspendUserComms = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, { token, userId, reason }) => {
    await requireAdminSession(ctx, token);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");
    // Hard security: suspending lives on the user doc so EVERY mutation in the
    // app is blocked by requireUserDoc — not just communication ones.
    await ctx.db.patch(userId, { suspended: true });
    await logModeration(ctx, "ADMIN_SUSPENDED_USER", {
      targetType: "user",
      targetId: userId,
      userId,
      reason: reason.trim(),
    });
    await moderateNotify(ctx, userId, "Account suspended", reason.trim() || "Your account was suspended. Contact support@forgex.academy.");
    return true;
  },
});

export const adminResolveReport = mutation({
  args: {
    token: v.string(),
    reportId: v.id("communicationReports"),
    status: v.union(v.literal("resolved"), v.literal("dismissed")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { token, reportId, status, note }) => {
    await requireAdminSession(ctx, token);
    const report = await ctx.db.get(reportId);
    if (!report) throw new Error("Report not found.");
    await ctx.db.patch(reportId, {
      status,
      adminNote: note?.trim() || undefined,
      resolvedAt: Date.now(),
    });
    await logModeration(ctx, status === "resolved" ? "ADMIN_RESOLVED_REPORT" : "ADMIN_DISMISSED_REPORT", {
      targetType: "report",
      targetId: reportId,
      communityId: report.communityId,
      conversationId: report.conversationId,
      messageId: report.messageId,
      userId: report.targetUserId,
      reason: note?.trim(),
    });
    return true;
  },
});

/** Log an admin viewing a private DM thread (called once when opened). */
export const adminLogConversationView = mutation({
  args: { token: v.string(), conversationId: v.id("studentConversations") },
  handler: async (ctx, { token, conversationId }) => {
    await requireAdminSession(ctx, token);
    await logModeration(ctx, "ADMIN_VIEW_CONVERSATION", {
      targetType: "conversation",
      targetId: conversationId,
      conversationId,
    });
    return true;
  },
});

/** Log an admin playing a voice message (for accountability). */
export const adminLogAudioPlay = mutation({
  args: {
    token: v.string(),
    scope: v.union(v.literal("community"), v.literal("dm")),
    messageId: v.string(),
    communityId: v.optional(v.id("courseCommunities")),
    conversationId: v.optional(v.id("studentConversations")),
  },
  handler: async (ctx, { token, scope, messageId, communityId, conversationId }) => {
    await requireAdminSession(ctx, token);
    await logModeration(ctx, "ADMIN_PLAYED_AUDIO", {
      targetType: scope === "community" ? "community-message" : "dm-message",
      targetId: messageId,
      communityId,
      conversationId,
      messageId,
    });
    return true;
  },
});
