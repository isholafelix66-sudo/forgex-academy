/**
 * Communication & Community module (student-facing + tutor participation).
 *
 * This is an INDEPENDENT module. The existing tutor ↔ student private chat
 * (`messages` table / messages.ts) is untouched — this file owns:
 *
 *   1. Course communities  — one community per course; enrolled students and
 *      the course tutor are automatically members.
 *   2. Student ↔ student DMs — private threads between connected (or
 *      same-course) students, with text / voice / images / files / replies /
 *      reactions / edit / delete / report / block.
 *   3. Student connections — request → accept → message (prevents spam).
 *
 * Admin moderation lives in `communityAdmin.ts` (password-session gated and
 * fully audit-logged).
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { checkRateLimit, notify, requireUserDoc, publicUser } from "./lib";
import { ROLES } from "./schema";

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB (matches chat)
const COMMUNITY_PAGE = 50;
const DM_PAGE = 50;

export const threadKey = (a: string, b: string) => [a, b].sort().join("|");

export function messagePreview(m: {
  body: string;
  kind?: string | null;
  fileName?: string | null;
}) {
  if (m.kind === "voice") return "🎤 Voice message";
  if (m.kind === "image") return "📷 Photo";
  if (m.kind === "file") return `📎 ${m.fileName || "File"}`;
  return m.body;
}

/** Moderation audit entry — every sensitive admin action goes here. */
export async function logModeration(
  ctx: MutationCtx,
  action: string,
  opts: {
    targetType?: string;
    targetId?: string;
    communityId?: Id<"courseCommunities">;
    conversationId?: Id<"studentConversations">;
    messageId?: string;
    userId?: Id<"users">;
    reason?: string;
  } = {},
) {
  await ctx.db.insert("moderationAuditLogs", {
    action,
    targetType: opts.targetType,
    targetId: opts.targetId,
    communityId: opts.communityId,
    conversationId: opts.conversationId,
    messageId: opts.messageId,
    userId: opts.userId,
    reason: opts.reason,
    createdAt: Date.now(),
  });
  await ctx.db.insert("moderationActions", {
    action,
    userId: opts.userId,
    communityId: opts.communityId,
    conversationId: opts.conversationId,
    messageId: opts.messageId,
    reason: opts.reason,
    createdAt: Date.now(),
  });
}

/** Get (or lazily create) the community for a course. */
export async function ensureCommunityForCourse(
  ctx: MutationCtx,
  courseId: Id<"courses">,
): Promise<Doc<"courseCommunities">> {
  const existing = await ctx.db
    .query("courseCommunities")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .first();
  if (existing) return existing;
  const course = await ctx.db.get(courseId);
  const id = await ctx.db.insert("courseCommunities", {
    courseId,
    name: `${course?.title ?? "Course"} Community`,
    status: "active",
    createdAt: Date.now(),
  });
  const doc = await ctx.db.get(id);
  if (!doc) throw new Error("Could not create community.");
  return doc;
}

/** Insert an active membership row (idempotent — never downgrades an existing
 *  row's status unless the user was removed, in which case the admin's removal
 *  decision wins and we refuse to silently re-add). */
export async function addMembership(
  ctx: MutationCtx,
  communityId: Id<"courseCommunities">,
  userId: Id<"users">,
  role: Doc<"communityMembers">["role"],
) {
  const existing = await ctx.db
    .query("communityMembers")
    .withIndex("by_community", (q) =>
      q.eq("communityId", communityId).eq("userId", userId),
    )
    .first();
  if (existing) {
    // A removed/restricted member stays that way until an admin acts.
    if (existing.status === "removed") return existing;
    if (existing.status === "restricted") return existing;
    if (existing.role === role) return existing;
    await ctx.db.patch(existing._id, { role });
    return existing;
  }
  const id = await ctx.db.insert("communityMembers", {
    communityId,
    userId,
    role,
    status: "active",
    joinedAt: Date.now(),
  });
  return await ctx.db.get(id);
}

/**
 * Sync the current user's community memberships from their enrollments +
 * courses they teach. Called when opening the Communities area so students
 * are never stuck behind a manual registration step, and tutors are members
 * of every course they teach.
 */
export const syncMyCommunities = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUserDoc(ctx);
    const [enrollments, taughtCourses] = await Promise.all([
      ctx.db
        .query("enrollments")
        .withIndex("by_student", (q) => q.eq("studentId", user._id))
        .collect(),
      ctx.db
        .query("courses")
        .withIndex("by_tutor", (q) => q.eq("tutorId", user._id))
        .collect(),
    ]);
    const targets = new Set<string>();
    for (const e of enrollments) targets.add(e.courseId);
    for (const c of taughtCourses) targets.add(c._id);
    for (const courseId of targets) {
      const community = await ensureCommunityForCourse(ctx, courseId as Id<"courses">);
      const role: Doc<"communityMembers">["role"] =
        user.role === ROLES.ADMIN
          ? "admin"
          : user.role === ROLES.TUTOR
            ? "tutor"
            : "student";
      await addMembership(ctx, community._id, user._id, role);
    }
    return targets.size;
  },
});

/** This user's membership row for a community, or null. */
export async function myMembership(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  communityId: Id<"courseCommunities">,
): Promise<Doc<"communityMembers"> | null> {
  return (
    (await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) =>
        q.eq("communityId", communityId).eq("userId", userId),
      )
      .first()) ?? null
  );
}

/** Resolve the display identity of a message sender. */
async function hydrateSender(
  ctx: QueryCtx,
  m: {
    senderId?: Id<"users"> | null;
    senderKind: string;
    senderLabel?: string | null;
  },
) {
  if (m.senderKind === "admin") {
    return {
      _id: null,
      name: m.senderLabel || "ForgeX Admin",
      image: null,
      role: "admin",
      isStaff: true,
    };
  }
  if (m.senderKind === "system") {
    return { _id: null, name: m.senderLabel || "ForgeX", image: null, role: "system", isStaff: true };
  }
  const u = m.senderId ? await ctx.db.get(m.senderId) : null;
  if (!u) return { _id: null, name: "Former member", image: null, role: "student", isStaff: false };
  const p = publicUser(u);
  return {
    _id: p._id,
    name: p.name,
    image: p.image,
    role: p.role,
    isStaff: p.role === "tutor" || p.role === "admin",
  };
}

/** Can this user post in this community? Returns an error message or null. */
async function canPostInCommunity(
  ctx: QueryCtx,
  user: Doc<"users">,
  community: Doc<"courseCommunities">,
): Promise<string | null> {
  const membership = await myMembership(ctx, user._id, community._id);
  if (!membership) return "You're not a member of this community.";
  if (membership.status === "removed")
    return "You've been removed from this community.";
  if (membership.status === "restricted")
    return "Your posting access is restricted. Contact an admin.";
  if (community.status === "archived")
    return "This community is archived and read-only.";
  if (community.status === "locked") {
    // Locked: students can read; staff can still communicate.
    if (membership.role === "student") {
      return "This community is temporarily locked — only staff can post.";
    }
  }
  if (user.suspended) return "Your account is suspended.";
  return null;
}

/** Can these two users DM? Returns an error message or null. */
async function canDm(
  ctx: QueryCtx,
  me: Doc<"users">,
  other: Doc<"users">,
): Promise<string | null> {
  if (me._id === other._id) return "You can't message yourself.";
  if (me.suspended || other.suspended) return "Messaging is unavailable.";
  const pair = threadKey(me._id, other._id);
  const conn = await ctx.db
    .query("studentConnections")
    .withIndex("by_key", (q) => q.eq("key", pair))
    .first();
  if (conn?.status === "blocked") {
    return "You can't message this student right now.";
  }
  if (conn?.status === "accepted") return null;
  // Same-course students may DM without a formal connection.
  const [mine, theirs] = await Promise.all([
    ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", me._id))
      .collect(),
    ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", other._id))
      .collect(),
  ]);
  const myCourses = new Set(mine.map((e) => e.courseId));
  if (theirs.some((e) => myCourses.has(e.courseId))) return null;
  return "Connect with this student first — send a connection request from Discover Students.";
}

/** Resolve a storage id to its authoritative URL server-side. */
async function resolveStoredUrl(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined,
  fallback: string | undefined,
): Promise<string | undefined> {
  if (!storageId) return fallback;
  try {
    return (await ctx.storage.getUrl(storageId)) ?? fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Queries — communities
// ---------------------------------------------------------------------------

export const myCommunities = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const memberships = await ctx.db
      .query("communityMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const active = memberships.filter((m) => m.status !== "removed");
    const hydrated = await Promise.all(
      active.map(async (m) => {
        const community = await ctx.db.get(m.communityId);
        if (!community) return null;
        const course = await ctx.db.get(community.courseId);
        const members = await ctx.db
          .query("communityMembers")
          .withIndex("by_community", (q) => q.eq("communityId", community._id))
          .collect();
        const memberCount = members.filter((x) => x.status !== "removed").length;
        // Unread = messages newer than my last read, excluding my own.
        const msgs = await ctx.db
          .query("communityMessages")
          .withIndex("by_community", (q) => q.eq("communityId", community._id))
          .collect();
        const unread = msgs.filter(
          (msg) =>
            msg.createdAt > (m.lastReadAt ?? 0) &&
            msg.senderId !== userId &&
            msg.senderKind !== "system",
        ).length;
        const last = [...msgs].sort((a, b) => b.createdAt - a.createdAt)[0];
        return {
          community: {
            _id: community._id,
            name: community.name,
            status: community.status,
            lockedReason: community.lockedReason ?? null,
            createdAt: community.createdAt,
            lastActivityAt: community.lastActivityAt ?? null,
          },
          course: course
            ? { _id: course._id, title: course.title, slug: course.slug, image: course.image ?? null, gradient: course.gradient ?? null }
            : null,
          myRole: m.role,
          myStatus: m.status,
          memberCount,
          unread,
          lastMessage: last ? messagePreview(last) : null,
          lastMessageAt: last?.createdAt ?? null,
        };
      }),
    );
    return hydrated
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => (b.lastMessageAt ?? b.community.createdAt) - (a.lastMessageAt ?? a.community.createdAt));
  },
});

export const communityDetail = query({
  args: { communityId: v.id("courseCommunities") },
  handler: async (ctx, { communityId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const community = await ctx.db.get(communityId);
    if (!community) return null;
    const membership = await myMembership(ctx, userId, communityId);
    if (!membership || membership.status === "removed") {
      // A removed student can still be told they're removed (no content leak).
      if (membership?.status === "removed") {
        return {
          community: { _id: community._id, name: community.name, status: community.status, lockedReason: community.lockedReason ?? null },
          course: null,
          membership: { role: membership.role, status: "removed" },
          memberCount: 0,
          allowed: false,
          removedReason: membership.removedReason ?? null,
        };
      }
      return null;
    }
    const course = await ctx.db.get(community.courseId);
    const members = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .collect();
    const memberCount = members.filter((x) => x.status !== "removed").length;
    return {
      community: {
        _id: community._id,
        name: community.name,
        status: community.status,
        lockedReason: community.lockedReason ?? null,
      },
      course: course
        ? { _id: course._id, title: course.title, slug: course.slug, image: course.image ?? null }
        : null,
      membership: { role: membership.role, status: membership.status },
      memberCount,
      allowed: true,
    };
  },
});

export const communityMessages = query({
  args: {
    communityId: v.id("courseCommunities"),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, { communityId, cursor }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { messages: [], nextCursor: null };
    const community = await ctx.db.get(communityId);
    if (!community) return { messages: [], nextCursor: null };
    const membership = await myMembership(ctx, userId, communityId);
    if (!membership || membership.status === "removed") {
      return { messages: [], nextCursor: null };
    }
    let rows = await ctx.db
      .query("communityMessages")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .order("desc")
      .take(COMMUNITY_PAGE + 1);
    if (cursor !== undefined) {
      rows = rows.filter((m) => m.createdAt < cursor);
    }
    const hasMore = rows.length > COMMUNITY_PAGE;
    const page = hasMore ? rows.slice(0, COMMUNITY_PAGE) : rows;
    const oldest = page.length > 0 ? page[page.length - 1].createdAt : null;
    const messages = await Promise.all(
      [...page].reverse().map(async (m) => {
        const sender = await hydrateSender(ctx, m);
        let replyTo = null;
        if (m.replyToId) {
          const r = await ctx.db.get(m.replyToId);
          if (r && !r.deleted) {
            replyTo = {
              _id: r._id,
              body: messagePreview(r),
              senderName:
                r.senderKind === "admin"
                  ? r.senderLabel || "ForgeX Admin"
                  : r.senderId
                    ? ((await ctx.db.get(r.senderId))?.name ?? "Former member")
                    : "ForgeX",
            };
          }
        }
        return {
          _id: m._id,
          communityId: m.communityId,
          senderId: m.senderId ?? null,
          sender,
          senderKind: m.senderKind,
          body: m.body,
          kind: m.kind ?? null,
          storageId: m.storageId ?? null,
          url: m.url ?? null,
          fileName: m.fileName ?? null,
          fileSize: m.fileSize ?? null,
          mimeType: m.mimeType ?? null,
          duration: m.duration ?? null,
          replyToId: m.replyToId ?? null,
          replyTo,
          reactions: m.reactions,
          deleted: m.deleted,
          deletedBy: m.deletedBy ?? null,
          editedAt: m.editedAt ?? null,
          createdAt: m.createdAt,
          mine: m.senderId === userId,
        };
      }),
    );
    return { messages, nextCursor: hasMore ? oldest : null };
  },
});

export const communityMembers = query({
  args: { communityId: v.id("courseCommunities"), search: v.optional(v.string()) },
  handler: async (ctx, { communityId, search }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const membership = await myMembership(ctx, userId, communityId);
    if (!membership || membership.status === "removed") return [];
    const rows = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .collect();
    const q = (search ?? "").trim().toLowerCase();
    const hydrated = await Promise.all(
      rows
        .filter((r) => r.status !== "removed")
        .map(async (r) => {
          const u = await ctx.db.get(r.userId);
          return {
            _id: r._id,
            userId: r.userId,
            name: u?.name ?? "Former member",
            image: u?.image ?? null,
            role: r.role,
            status: r.status,
            joinedAt: r.joinedAt,
            lastReadAt: r.lastReadAt ?? null,
            online: !!u?.lastActivity && Date.now() - u.lastActivity < 60_000,
          };
        }),
    );
    return hydrated
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const rank = (r: string) => (r === "admin" ? 3 : r === "tutor" ? 2 : r === "moderator" ? 2 : 1);
        return rank(b.role) - rank(a.role) || a.joinedAt - b.joinedAt;
      });
  },
});

export const communityUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;
    const memberships = await ctx.db
      .query("communityMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    let total = 0;
    for (const m of memberships) {
      if (m.status !== "active") continue;
      const msgs = await ctx.db
        .query("communityMessages")
        .withIndex("by_community", (q) => q.eq("communityId", m.communityId))
        .collect();
      total += msgs.filter(
        (msg) =>
          msg.createdAt > (m.lastReadAt ?? 0) &&
          msg.senderId !== userId &&
          msg.senderKind !== "system",
      ).length;
    }
    return total;
  },
});

// ---------------------------------------------------------------------------
// Queries — connections & discovery
// ---------------------------------------------------------------------------

export const discoverStudents = query({
  args: { q: v.optional(v.string()) },
  handler: async (ctx, { q }) => {
    const me = await requireUserDoc(ctx);
    const term = (q ?? "").trim().toLowerCase();
    const all = await ctx.db.query("users").collect();
    const candidates = all.filter(
      (u) =>
        u._id !== me._id &&
        !u.isSeed &&
        !u.suspended &&
        u.role !== ROLES.ADMIN &&
        (u.role === ROLES.STUDENT || (u.role === ROLES.TUTOR && u.verified)),
    );
    // My enrollments → same-course students rank first.
    const myEnrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", me._id))
      .collect();
    const myCourseIds = new Set(myEnrollments.map((e) => e.courseId));
    const enriched = await Promise.all(
      candidates.map(async (u) => {
        const theirs = await ctx.db
          .query("enrollments")
          .withIndex("by_student", (q) => q.eq("studentId", u._id))
          .collect();
        const shared = theirs.filter((e) => myCourseIds.has(e.courseId));
        const pair = threadKey(me._id, u._id);
        const conn = await ctx.db
          .query("studentConnections")
          .withIndex("by_key", (q) => q.eq("key", pair))
          .first();
        return {
          _id: u._id,
          name: u.name || "Anonymous",
          image: u.image ?? null,
          headline: u.headline ?? null,
          role: u.role ?? "student",
          verified: !!u.verified,
          online: !!u.lastActivity && Date.now() - u.lastActivity < 60_000,
          sharedCourses: shared.map((e) => e.courseId),
          connectionStatus: conn?.status ?? null,
          connectionId: conn?._id ?? null,
          pendingFromMe: conn?.status === "pending" && conn.requesterId === me._id,
        };
      }),
    );
    const filtered = enriched.filter(
      (s) =>
        !term ||
        s.name.toLowerCase().includes(term) ||
        (s.headline ?? "").toLowerCase().includes(term),
    );
    return filtered
      .sort((a, b) => {
        const aShared = a.sharedCourses.length > 0 ? 1 : 0;
        const bShared = b.sharedCourses.length > 0 ? 1 : 0;
        return bShared - aShared || b.online ? 1 : 0 - (a.online ? 1 : 0);
      })
      .slice(0, 60);
  },
});

export const myConnections = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserDoc(ctx);
    const [sent, received] = await Promise.all([
      ctx.db
        .query("studentConnections")
        .withIndex("by_requester", (q) => q.eq("requesterId", me._id))
        .collect(),
      ctx.db
        .query("studentConnections")
        .withIndex("by_addressee", (q) => q.eq("addresseeId", me._id))
        .collect(),
    ]);
    const rows = [...sent, ...received].filter((r) => r.status !== "removed");
    const hydrated = await Promise.all(
      rows.map(async (r) => {
        const otherId = r.requesterId === me._id ? r.addresseeId : r.requesterId;
        const u = await ctx.db.get(otherId);
        return {
          _id: r._id,
          userId: otherId,
          name: u?.name ?? "Former member",
          image: u?.image ?? null,
          headline: u?.headline ?? null,
          role: u?.role ?? "student",
          online: !!u?.lastActivity && Date.now() - u.lastActivity < 60_000,
          status: r.status,
          blockedBy: r.blockedBy ?? null,
          incoming: r.addresseeId === me._id,
          createdAt: r.createdAt,
          respondedAt: r.respondedAt ?? null,
        };
      }),
    );
    return hydrated.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ---------------------------------------------------------------------------
// Queries — student DMs
// ---------------------------------------------------------------------------

export const myStudentConversations = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserDoc(ctx);
    const [asA, asB] = await Promise.all([
      ctx.db
        .query("studentConversations")
        .withIndex("by_userA", (q) => q.eq("userAId", me._id))
        .collect(),
      ctx.db
        .query("studentConversations")
        .withIndex("by_userB", (q) => q.eq("userBId", me._id))
        .collect(),
    ]);
    const convos = [...asA, ...asB];
    const hydrated = await Promise.all(
      convos.map(async (c) => {
        const otherId = c.userAId === me._id ? c.userBId : c.userAId;
        const other = await ctx.db.get(otherId);
        const msgs = await ctx.db
          .query("studentMessages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
          .collect();
        const last = [...msgs].sort((a, b) => b.createdAt - a.createdAt)[0];
        const myPart = await ctx.db
          .query("studentConversationParticipants")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", c._id).eq("userId", me._id),
          )
          .first();
        const unread = msgs.filter(
          (m) => m.senderId !== me._id && m.createdAt > (myPart?.lastReadAt ?? 0),
        ).length;
        return {
          conversationId: c._id,
          status: c.status,
          other: other
            ? { _id: other._id, name: other.name || "Anonymous", image: other.image ?? null, role: other.role ?? "student", online: !!other.lastActivity && Date.now() - other.lastActivity < 60_000 }
            : null,
          lastMessage: last ? messagePreview(last) : null,
          lastAt: last?.createdAt ?? c.createdAt,
          unread,
        };
      }),
    );
    return hydrated
      .filter((c) => c.other !== null)
      .sort((a, b) => b.lastAt - a.lastAt);
  },
});

export const studentConversationMessages = query({
  args: {
    conversationId: v.id("studentConversations"),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, { conversationId, cursor }) => {
    const me = await requireUserDoc(ctx);
    const convo = await ctx.db.get(conversationId);
    if (!convo) return { messages: [], nextCursor: null, convo: null };
    const participant = await ctx.db
      .query("studentConversationParticipants")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId).eq("userId", me._id),
      )
      .first();
    if (!participant) return { messages: [], nextCursor: null, convo: null };
    let rows = await ctx.db
      .query("studentMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(DM_PAGE + 1);
    if (cursor !== undefined) {
      rows = rows.filter((m) => m.createdAt < cursor);
    }
    const hasMore = rows.length > DM_PAGE;
    const page = hasMore ? rows.slice(0, DM_PAGE) : rows;
    const oldest = page.length > 0 ? page[page.length - 1].createdAt : null;
    const otherId = convo.userAId === me._id ? convo.userBId : convo.userAId;
    const other = await ctx.db.get(otherId);
    const messages = await Promise.all(
      [...page].reverse().map(async (m) => {
        let replyTo = null;
        if (m.replyToId) {
          const r = await ctx.db.get(m.replyToId);
          if (r && !r.deleted) {
            const ru = await ctx.db.get(r.senderId);
            replyTo = {
              _id: r._id,
              body: messagePreview(r),
              senderName: ru?.name ?? "Former member",
            };
          }
        }
        return {
          _id: m._id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          sender: {
            _id: m.senderId,
            name: (m.senderId === me._id ? me.name || "You" : other?.name) ?? "Student",
            image: m.senderId === me._id ? me.image ?? null : other?.image ?? null,
            role: m.senderId === me._id ? me.role ?? "student" : other?.role ?? "student",
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
          replyTo,
          reactions: m.reactions,
          deleted: m.deleted,
          deletedBy: m.deletedBy ?? null,
          editedAt: m.editedAt ?? null,
          createdAt: m.createdAt,
          mine: m.senderId === me._id,
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
        other: other
          ? { _id: other._id, name: other.name || "Anonymous", image: other.image ?? null, role: other.role ?? "student", online: !!other.lastActivity && Date.now() - other.lastActivity < 60_000 }
          : null,
      },
    };
  },
});

export const dmUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserDoc(ctx);
    const [asA, asB] = await Promise.all([
      ctx.db
        .query("studentConversations")
        .withIndex("by_userA", (q) => q.eq("userAId", me._id))
        .collect(),
      ctx.db
        .query("studentConversations")
        .withIndex("by_userB", (q) => q.eq("userBId", me._id))
        .collect(),
    ]);
    let total = 0;
    for (const c of [...asA, ...asB]) {
      const myPart = await ctx.db
        .query("studentConversationParticipants")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", c._id).eq("userId", me._id),
        )
        .first();
      if (!myPart) continue;
      const msgs = await ctx.db
        .query("studentMessages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
        .collect();
      total += msgs.filter(
        (m) => m.senderId !== me._id && m.createdAt > (myPart.lastReadAt ?? 0),
      ).length;
    }
    return total;
  },
});

export const myReports = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserDoc(ctx);
    const rows = await ctx.db.query("communicationReports").collect();
    return rows
      .filter((r) => r.reporterId === me._id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30);
  },
});

// ---------------------------------------------------------------------------
// Mutations — communities
// ---------------------------------------------------------------------------

export const sendCommunityMessage = mutation({
  args: {
    communityId: v.id("courseCommunities"),
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
    replyToId: v.optional(v.id("communityMessages")),
  },
  handler: async (ctx, args) => {
    const user = await requireUserDoc(ctx);
    const community = await ctx.db.get(args.communityId);
    if (!community) throw new Error("Community not found.");
    const blocked = await canPostInCommunity(ctx, user, community);
    if (blocked) throw new Error(blocked);
    await checkRateLimit(ctx, `community-msg:${user._id}`, 20, 60_000, "You're sending messages too fast — please slow down.");

    const trimmed = (args.body ?? "").trim();
    const hasAttachment =
      args.kind === "image" || args.kind === "file" || args.kind === "voice";
    if (!trimmed && !hasAttachment) throw new Error("Message can't be empty.");
    if (hasAttachment && !args.storageId && !args.url) {
      throw new Error("Attachment is missing its file.");
    }
    if (trimmed.length > 4000) throw new Error("Messages are limited to 4,000 characters.");
    if (args.fileSize && args.fileSize > MAX_ATTACHMENT_BYTES) {
      throw new Error("Attachments are limited to 25 MB.");
    }
    const storedUrl = await resolveStoredUrl(ctx, args.storageId, args.url);
    if (hasAttachment && !storedUrl) {
      throw new Error("The attachment couldn't be stored — please send it again.");
    }

    const id = await ctx.db.insert("communityMessages", {
      communityId: args.communityId,
      senderId: user._id,
      senderKind: "user",
      body: trimmed,
      kind: hasAttachment ? args.kind : undefined,
      storageId: args.storageId,
      url: storedUrl,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      duration: args.duration,
      replyToId: args.replyToId,
      reactions: [],
      deleted: false,
      createdAt: Date.now(),
    });
    await ctx.db.patch(community._id, { lastActivityAt: Date.now() });

    // Notify the community's staff (tutors / moderators / admins) when a
    // student posts, so questions don't sit unanswered. Staff never notify
    // themselves, and students are tracked via unread counts instead.
    const staff = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", community._id))
      .collect();
    const staffIds = new Set(
      staff
        .filter(
          (m) =>
            m.status === "active" &&
            (m.role === "tutor" || m.role === "admin" || m.role === "moderator") &&
            m.userId !== user._id,
        )
        .map((m) => m.userId),
    );
    for (const sId of staffIds) {
      await notify(ctx, {
        userId: sId,
        title: `New message in ${community.name}`,
        body: messagePreview({ body: trimmed, kind: args.kind, fileName: args.fileName }).slice(0, 90),
        type: "community",
        link: "/dashboard/communities",
      });
    }
    return id;
  },
});

export const markCommunityRead = mutation({
  args: { communityId: v.id("courseCommunities") },
  handler: async (ctx, { communityId }) => {
    const user = await requireUserDoc(ctx);
    const membership = await myMembership(ctx, user._id, communityId);
    if (membership && membership.status === "active") {
      await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
    }
    return true;
  },
});

export const toggleCommunityReaction = mutation({
  args: { messageId: v.id("communityMessages"), emoji: v.string() },
  handler: async (ctx, { messageId, emoji }) => {
    const user = await requireUserDoc(ctx);
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.deleted) throw new Error("Message not found.");
    const membership = await myMembership(ctx, user._id, msg.communityId);
    if (!membership || membership.status === "removed") {
      throw new Error("You're not a member of this community.");
    }
    const mine = user._id.toString();
    const existing = msg.reactions.find((r) => r.emoji === emoji);
    let reactions = msg.reactions;
    if (existing) {
      if (existing.userIds.includes(mine)) {
        const userIds = existing.userIds.filter((u) => u !== mine);
        reactions = userIds.length
          ? msg.reactions.map((r) => (r.emoji === emoji ? { ...r, userIds, count: userIds.length } : r))
          : msg.reactions.filter((r) => r.emoji !== emoji);
      } else {
        reactions = msg.reactions.map((r) =>
          r.emoji === emoji
            ? { ...r, userIds: [...r.userIds, mine], count: r.count + 1 }
            : r,
        );
      }
    } else {
      reactions = [...msg.reactions, { emoji, count: 1, userIds: [mine] }];
    }
    await ctx.db.patch(messageId, { reactions });
    return true;
  },
});

export const editCommunityMessage = mutation({
  args: { messageId: v.id("communityMessages"), body: v.string() },
  handler: async (ctx, { messageId, body }) => {
    const user = await requireUserDoc(ctx);
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.deleted) throw new Error("Message not found.");
    if (msg.senderId !== user._id) throw new Error("You can only edit your own messages.");
    const trimmed = body.trim();
    if (!trimmed) throw new Error("Message can't be empty.");
    if (trimmed.length > 4000) throw new Error("Messages are limited to 4,000 characters.");
    await ctx.db.patch(messageId, { body: trimmed, editedAt: Date.now() });
    return true;
  },
});

export const deleteCommunityMessage = mutation({
  args: { messageId: v.id("communityMessages") },
  handler: async (ctx, { messageId }) => {
    const user = await requireUserDoc(ctx);
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.deleted) throw new Error("Message not found.");
    if (msg.senderId !== user._id) throw new Error("You can only delete your own messages.");
    await ctx.db.patch(messageId, { deleted: true, deletedBy: "user", body: "" });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Mutations — student DMs
// ---------------------------------------------------------------------------

/** Find or create the conversation between two students. */
async function getOrCreateConversation(
  ctx: MutationCtx,
  me: Doc<"users">,
  other: Doc<"users">,
): Promise<Doc<"studentConversations">> {
  const key = threadKey(me._id, other._id);
  const existing = await ctx.db
    .query("studentConversations")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("studentConversations", {
    key,
    userAId: me._id,
    userBId: other._id,
    status: "active",
    createdAt: Date.now(),
  });
  const doc = await ctx.db.get(id);
  if (!doc) throw new Error("Could not start the conversation.");
  // Participants
  await ctx.db.insert("studentConversationParticipants", {
    conversationId: id,
    userId: me._id,
    lastReadAt: Date.now(),
  });
  await ctx.db.insert("studentConversationParticipants", {
    conversationId: id,
    userId: other._id,
  });
  return doc;
}

/** Open (or create) the DM thread with a student, if allowed. */
export const openConversationWith = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await requireUserDoc(ctx);
    const other = await ctx.db.get(userId);
    if (!other) throw new Error("Student not found.");
    const blocked = await canDm(ctx, me, other);
    if (blocked) throw new Error(blocked);
    const convo = await getOrCreateConversation(ctx, me, other);
    return convo._id;
  },
});

export const sendStudentMessage = mutation({
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
    replyToId: v.optional(v.id("studentMessages")),
  },
  handler: async (ctx, args) => {
    const me = await requireUserDoc(ctx);
    const other = await ctx.db.get(args.receiverId);
    if (!other) throw new Error("Student not found.");
    const blocked = await canDm(ctx, me, other);
    if (blocked) throw new Error(blocked);
    await checkRateLimit(ctx, `dm:${me._id}`, 20, 60_000, "You're sending messages too fast — please slow down.");

    const trimmed = (args.body ?? "").trim();
    const hasAttachment =
      args.kind === "image" || args.kind === "file" || args.kind === "voice";
    if (!trimmed && !hasAttachment) throw new Error("Message can't be empty.");
    if (hasAttachment && !args.storageId && !args.url) {
      throw new Error("Attachment is missing its file.");
    }
    if (trimmed.length > 4000) throw new Error("Messages are limited to 4,000 characters.");
    if (args.fileSize && args.fileSize > MAX_ATTACHMENT_BYTES) {
      throw new Error("Attachments are limited to 25 MB.");
    }
    const storedUrl = await resolveStoredUrl(ctx, args.storageId, args.url);
    if (hasAttachment && !storedUrl) {
      throw new Error("The attachment couldn't be stored — please send it again.");
    }

    const convo = await getOrCreateConversation(ctx, me, other);
    if (convo.status === "locked") {
      throw new Error("This conversation was locked by a moderator.");
    }
    const id = await ctx.db.insert("studentMessages", {
      conversationId: convo._id,
      senderId: me._id,
      body: trimmed,
      kind: hasAttachment ? args.kind : undefined,
      storageId: args.storageId,
      url: storedUrl,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      duration: args.duration,
      replyToId: args.replyToId,
      reactions: [],
      deleted: false,
      createdAt: Date.now(),
    });
    await ctx.db.patch(convo._id, { lastActivityAt: Date.now() });
    // Mark my side read (I just wrote).
    const myPart = await ctx.db
      .query("studentConversationParticipants")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", convo._id).eq("userId", me._id),
      )
      .first();
    if (myPart) await ctx.db.patch(myPart._id, { lastReadAt: Date.now() });

    await notify(ctx, {
      userId: other._id,
      title: `New DM from ${me.name || "a student"}`,
      body: messagePreview({ body: trimmed, kind: args.kind, fileName: args.fileName }).slice(0, 90),
      type: "dm",
      link: "/dashboard/dms",
    });
    return id;
  },
});

export const markConversationRead = mutation({
  args: { conversationId: v.id("studentConversations") },
  handler: async (ctx, { conversationId }) => {
    const me = await requireUserDoc(ctx);
    const part = await ctx.db
      .query("studentConversationParticipants")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId).eq("userId", me._id),
      )
      .first();
    if (part) await ctx.db.patch(part._id, { lastReadAt: Date.now() });
    return true;
  },
});

export const toggleStudentReaction = mutation({
  args: { messageId: v.id("studentMessages"), emoji: v.string() },
  handler: async (ctx, { messageId, emoji }) => {
    const me = await requireUserDoc(ctx);
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.deleted) throw new Error("Message not found.");
    const part = await ctx.db
      .query("studentConversationParticipants")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", msg.conversationId).eq("userId", me._id),
      )
      .first();
    if (!part) throw new Error("You're not part of this conversation.");
    const mine = me._id.toString();
    const existing = msg.reactions.find((r) => r.emoji === emoji);
    let reactions = msg.reactions;
    if (existing) {
      if (existing.userIds.includes(mine)) {
        const userIds = existing.userIds.filter((u) => u !== mine);
        reactions = userIds.length
          ? msg.reactions.map((r) => (r.emoji === emoji ? { ...r, userIds, count: userIds.length } : r))
          : msg.reactions.filter((r) => r.emoji !== emoji);
      } else {
        reactions = msg.reactions.map((r) =>
          r.emoji === emoji
            ? { ...r, userIds: [...r.userIds, mine], count: r.count + 1 }
            : r,
        );
      }
    } else {
      reactions = [...msg.reactions, { emoji, count: 1, userIds: [mine] }];
    }
    await ctx.db.patch(messageId, { reactions });
    return true;
  },
});

export const editStudentMessage = mutation({
  args: { messageId: v.id("studentMessages"), body: v.string() },
  handler: async (ctx, { messageId, body }) => {
    const me = await requireUserDoc(ctx);
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.deleted) throw new Error("Message not found.");
    if (msg.senderId !== me._id) throw new Error("You can only edit your own messages.");
    const trimmed = body.trim();
    if (!trimmed) throw new Error("Message can't be empty.");
    if (trimmed.length > 4000) throw new Error("Messages are limited to 4,000 characters.");
    await ctx.db.patch(messageId, { body: trimmed, editedAt: Date.now() });
    return true;
  },
});

export const deleteStudentMessage = mutation({
  args: { messageId: v.id("studentMessages") },
  handler: async (ctx, { messageId }) => {
    const me = await requireUserDoc(ctx);
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.deleted) throw new Error("Message not found.");
    if (msg.senderId !== me._id) throw new Error("You can only delete your own messages.");
    await ctx.db.patch(messageId, { deleted: true, deletedBy: "user", body: "" });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Mutations — connections
// ---------------------------------------------------------------------------

export const requestConnection = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await requireUserDoc(ctx);
    const other = await ctx.db.get(userId);
    if (!other || other.suspended || other.isSeed) throw new Error("Student not found.");
    if (me._id === userId) throw new Error("You can't connect with yourself.");
    if (other.role === ROLES.ADMIN) throw new Error("Admins aren't listed for connections.");
    await checkRateLimit(ctx, `connect:${me._id}`, 30, 60 * 60 * 1000, "You're sending too many requests — please slow down.");
    const key = threadKey(me._id, userId);
    const existing = await ctx.db
      .query("studentConnections")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      if (existing.status === "blocked") {
        throw new Error("You can't connect with this student right now.");
      }
      if (existing.status === "pending") {
        throw new Error(
          existing.requesterId === me._id
            ? "Request already sent — waiting for a reply."
            : "This student already sent you a request — accept it from Connections.",
        );
      }
      if (existing.status === "accepted") return existing._id;
      // declined / removed → allow a fresh request
      await ctx.db.patch(existing._id, {
        status: "pending",
        requesterId: me._id,
        addresseeId: userId,
        blockedBy: undefined,
        createdAt: Date.now(),
        respondedAt: undefined,
      });
      await notify(ctx, {
        userId,
        title: "New connection request",
        body: `${me.name || "A student"} wants to connect with you.`,
        type: "connection",
        link: "/dashboard/connections",
      });
      return existing._id;
    }
    const id = await ctx.db.insert("studentConnections", {
      key,
      requesterId: me._id,
      addresseeId: userId,
      status: "pending",
      createdAt: Date.now(),
    });
    await notify(ctx, {
      userId,
      title: "New connection request",
      body: `${me.name || "A student"} wants to connect with you.`,
      type: "connection",
      link: "/dashboard/connections",
    });
    return id;
  },
});

export const respondConnection = mutation({
  args: { connectionId: v.id("studentConnections"), accept: v.boolean() },
  handler: async (ctx, { connectionId, accept }) => {
    const me = await requireUserDoc(ctx);
    const conn = await ctx.db.get(connectionId);
    if (!conn || conn.status !== "pending") throw new Error("Request not found.");
    if (conn.addresseeId !== me._id) throw new Error("This request isn't for you.");
    await ctx.db.patch(connectionId, {
      status: accept ? "accepted" : "declined",
      respondedAt: Date.now(),
    });
    if (accept) {
      await notify(ctx, {
        userId: conn.requesterId,
        title: "Connection accepted 🎉",
        body: `${me.name || "A student"} accepted your connection request. You can now message each other.`,
        type: "connection",
        link: "/dashboard/dms",
      });
    }
    return true;
  },
});

export const removeConnection = mutation({
  args: { connectionId: v.id("studentConnections") },
  handler: async (ctx, { connectionId }) => {
    const me = await requireUserDoc(ctx);
    const conn = await ctx.db.get(connectionId);
    if (!conn) throw new Error("Connection not found.");
    if (conn.requesterId !== me._id && conn.addresseeId !== me._id) {
      throw new Error("This connection isn't yours.");
    }
    await ctx.db.patch(connectionId, { status: "removed" });
    return true;
  },
});

export const blockUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await requireUserDoc(ctx);
    if (me._id === userId) throw new Error("You can't block yourself.");
    const key = threadKey(me._id, userId);
    const existing = await ctx.db
      .query("studentConnections")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "blocked",
        blockedBy: me._id,
        respondedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("studentConnections", {
        key,
        requesterId: me._id,
        addresseeId: userId,
        status: "blocked",
        blockedBy: me._id,
        createdAt: Date.now(),
      });
    }
    return true;
  },
});

export const unblockUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await requireUserDoc(ctx);
    const key = threadKey(me._id, userId);
    const existing = await ctx.db
      .query("studentConnections")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing && existing.status === "blocked" && existing.blockedBy === me._id) {
      await ctx.db.patch(existing._id, { status: "removed", blockedBy: undefined });
    }
    return true;
  },
});

// ---------------------------------------------------------------------------
// Mutations — reporting
// ---------------------------------------------------------------------------

export const reportContent = mutation({
  args: {
    targetType: v.union(
      v.literal("message"),
      v.literal("user"),
      v.literal("community"),
      v.literal("conversation"),
    ),
    scope: v.union(v.literal("community"), v.literal("dm")),
    communityId: v.optional(v.id("courseCommunities")),
    conversationId: v.optional(v.id("studentConversations")),
    messageId: v.optional(v.string()),
    targetUserId: v.optional(v.id("users")),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUserDoc(ctx);
    await checkRateLimit(ctx, `report:${me._id}`, 10, 60 * 60 * 1000, "You're submitting too many reports — please slow down.");
    if (!args.reason.trim()) throw new Error("Pick a reason for the report.");
    // Verify the target is real so reports can't be used to fish for ids.
    if (args.scope === "community" && args.communityId) {
      const community = await ctx.db.get(args.communityId);
      if (!community) throw new Error("Community not found.");
      const membership = await myMembership(ctx, me._id, args.communityId);
      if (!membership || membership.status === "removed") {
        throw new Error("You're not a member of this community.");
      }
    }
    if (args.scope === "dm" && args.conversationId) {
      const part = await ctx.db
        .query("studentConversationParticipants")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", args.conversationId!).eq("userId", me._id),
        )
        .first();
      if (!part) throw new Error("You're not part of this conversation.");
    }
    if (args.targetUserId) {
      const target = await ctx.db.get(args.targetUserId);
      if (!target) throw new Error("User not found.");
    }
    await ctx.db.insert("communicationReports", {
      reporterId: me._id,
      targetType: args.targetType,
      scope: args.scope,
      communityId: args.communityId,
      conversationId: args.conversationId,
      messageId: args.messageId,
      targetUserId: args.targetUserId,
      reason: args.reason.trim().slice(0, 200),
      details: (args.details ?? "").trim().slice(0, 2000) || undefined,
      status: "open",
      createdAt: Date.now(),
    });
    return true;
  },
});
