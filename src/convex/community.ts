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

// ---------------------------------------------------------------------------
// Mutations - capacity & cohorts
// ---------------------------------------------------------------------------

/**
 * Community Tutor / Admin: set the maximum number of students allowed in this
 * community. `0` (or a negative) clears the limit back to unlimited. Spaces
 * are computed from live memberships, so existing students are never
 * affected - a lower limit simply shows the community as FULL.
 */
export const tutorSetCommunityCapacity = mutation({
  args: {
    communityId: v.id("courseCommunities"),
    capacity: v.number(),
  },
  handler: async (ctx, { communityId, capacity }) => {
    const user = await requireUserDoc(ctx);
    const { isAdmin } = await requireStaff(ctx, user, communityId);
    if (!Number.isInteger(capacity) || capacity < 0 || capacity > 100_000) {
      throw new Error("Enter a valid student limit (0 = unlimited).");
    }
    const community = await ctx.db.get(communityId);
    if (!community) throw new Error("Community not found.");
    await ctx.db.patch(communityId, {
      studentCapacity: capacity > 0 ? capacity : undefined,
    });
    await logModeration(
      ctx,
      isAdmin ? "ADMIN_SET_CAPACITY" : "TUTOR_SET_CAPACITY",
      {
        targetType: "community",
        targetId: communityId,
        communityId,
        reason: capacity > 0 ? String(capacity) : "unlimited",
      },
    );
    return true;
  },
});

/** Community Tutor / Admin: manually stop (or reopen) new enrollment. */
export const tutorSetCommunityEnrollment = mutation({
  args: {
    communityId: v.id("courseCommunities"),
    closed: v.boolean(),
  },
  handler: async (ctx, { communityId, closed }) => {
    const user = await requireUserDoc(ctx);
    const { isAdmin } = await requireStaff(ctx, user, communityId);
    const community = await ctx.db.get(communityId);
    if (!community) throw new Error("Community not found.");
    await ctx.db.patch(communityId, { enrollmentClosed: closed || undefined });
    await logModeration(
      ctx,
      isAdmin ? "ADMIN_TOGGLED_ENROLLMENT" : "TUTOR_TOGGLED_ENROLLMENT",
      {
        targetType: "community",
        targetId: communityId,
        communityId,
        reason: closed ? "closed" : "reopened",
      },
    );
    return true;
  },
});

/**
 * Community Tutor / Admin: create another community (cohort) for the same
 * course, e.g. "NUD 417 - Cohort B". Cohorts share the course but keep
 * separate members, messages and settings. The course tutor is auto-membered.
 */
export const tutorCreateCohort = mutation({
  args: {
    communityId: v.id("courseCommunities"),
    name: v.string(),
    cohortLabel: v.optional(v.string()),
    description: v.optional(v.string()),
    studentCapacity: v.optional(v.number()),
    messageMode: v.optional(v.union(v.literal("everyone"), v.literal("tutors_only"))),
  },
  handler: async (ctx, args) => {
    const user = await requireUserDoc(ctx);
    const { isAdmin } = await requireStaff(ctx, user, args.communityId);
    const source = await ctx.db.get(args.communityId);
    if (!source) throw new Error("Community not found.");
    const name = args.name.trim();
    if (!name) throw new Error("Give the cohort a name.");
    if (name.length > 80) throw new Error("Cohort name is too long.");
    if (
      args.studentCapacity !== undefined &&
      (!Number.isInteger(args.studentCapacity) || args.studentCapacity < 0 || args.studentCapacity > 100_000)
    ) {
      throw new Error("Enter a valid student limit (0 = unlimited).");
    }
    const course = await ctx.db.get(source.courseId);
    const id = await ctx.db.insert("courseCommunities", {
      courseId: source.courseId,
      name,
      status: "active",
      messageMode: args.messageMode ?? "everyone",
      studentCapacity:
        args.studentCapacity && args.studentCapacity > 0 ? args.studentCapacity : undefined,
      cohortLabel: args.cohortLabel?.trim() || undefined,
      description: args.description?.trim() || undefined,
      createdAt: Date.now(),
    });
    const tutor = course?.tutorId ? await ctx.db.get(course.tutorId) : null;
    if (tutor) await addMembership(ctx, id, tutor._id, "tutor");
    await logModeration(
      ctx,
      isAdmin ? "ADMIN_CREATED_COHORT" : "TUTOR_CREATED_COHORT",
      {
        targetType: "community",
        targetId: id,
        communityId: id,
        reason: name,
      },
    );
    return id;
  },
});
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

async function communityName(
  ctx: QueryCtx | MutationCtx,
  communityId: Id<"courseCommunities">,
) {
  const c = await ctx.db.get(communityId);
  return c?.name ?? "a community";
}

/**
 * Student capacity state of a community.
 *
 * - `studentCount` counts active (non-removed) student memberships.
 * - `capacity` is the configured student limit (null = unlimited).
 * - `state`: "open" (below limit), "full" (at limit), "closed" (manually
 *   stopped via `enrollmentClosed` — wins over everything).
 * - `spaces` is how many more students fit (null when unlimited).
 *
 * Leaving/moving students automatically frees spaces because the count is
 * derived from live memberships — nothing extra to "unlock".
 */
export async function communityCapacity(
  ctx: QueryCtx | MutationCtx,
  community: Pick<Doc<"courseCommunities">, "_id" | "studentCapacity" | "enrollmentClosed">,
): Promise<{
  studentCount: number;
  capacity: number | null;
  state: "open" | "full" | "closed";
  spaces: number | null;
  closed: boolean;
}> {
  const members = await ctx.db
    .query("communityMembers")
    .withIndex("by_community", (q) => q.eq("communityId", community._id))
    .collect();
  const studentCount = members.filter(
    (m) => m.status !== "removed" && m.role === "student",
  ).length;
  const capacity =
    community.studentCapacity && community.studentCapacity > 0
      ? Math.floor(community.studentCapacity)
      : null;
  const closed = !!community.enrollmentClosed;
  const full = capacity !== null && studentCount >= capacity;
  return {
    studentCount,
    capacity,
    state: closed ? "closed" : full ? "full" : "open",
    spaces: capacity === null ? null : Math.max(0, capacity - studentCount),
    closed,
  };
}

/**
 * The community a new enrollment should auto-join for a course: the oldest
 * community that is open (not manually closed) and still has space. Falls
 * back to `ensureCommunityForCourse` (creates the primary community) when
 * every existing one is full/closed — the student is then left unassigned
 * until a tutor/admin places them (sync swallows the capacity error).
 */
export async function pickCommunityForCourse(
  ctx: MutationCtx,
  courseId: Id<"courses">,
): Promise<Doc<"courseCommunities">> {
  const communities = await ctx.db
    .query("courseCommunities")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .order("asc")
    .collect();
  for (const c of communities) {
    if (c.enrollmentClosed) continue;
    const info = await communityCapacity(ctx, c);
    if (info.capacity === null || info.studentCount < info.capacity) {
      return c;
    }
  }
  return communities[0] ?? ensureCommunityForCourse(ctx, courseId);
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
 *  decision wins and we refuse to silently re-add).
 *
 * New STUDENT memberships are gated by the community's student capacity:
 *  closed → error, full → error. Staff (tutor/admin) memberships and existing
 *  members are never blocked. */
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
  if (role === "student") {
    const community = await ctx.db.get(communityId);
    if (!community) throw new Error("Community not found.");
    const info = await communityCapacity(ctx, community);
    if (info.closed) {
      throw new Error("Enrollment for this community is currently closed.");
    }
    if (info.capacity !== null && info.studentCount >= info.capacity) {
      throw new Error("This community is currently full.");
    }
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
    const role: Doc<"communityMembers">["role"] =
      user.role === ROLES.ADMIN
        ? "admin"
        : user.role === ROLES.TUTOR
          ? "tutor"
          : "student";
    for (const courseId of targets) {
      // If the user is already an active member of ANY community of this
      // course (e.g. assigned to a specific cohort), keep them there — never
      // silently add a second membership in another cohort.
      const courseCommunities = await ctx.db
        .query("courseCommunities")
        .withIndex("by_course", (q) => q.eq("courseId", courseId as Id<"courses">))
        .collect();
      const mine = await Promise.all(
        courseCommunities.map((c) => myMembership(ctx, user._id, c._id)),
      );
      if (mine.some((m) => m && m.status !== "removed")) continue;
      try {
        const community = await pickCommunityForCourse(ctx, courseId as Id<"courses">);
        await addMembership(ctx, community._id, user._id, role);
      } catch {
        // Community full or closed — the student stays unassigned until a
        // tutor/admin places them in a cohort. Never fail the whole sync.
      }
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
  const base = { communityRole: undefined as string | undefined };
  if (m.senderKind === "admin") {
    return { ...base, _id: null, name: m.senderLabel || "ForgeX Admin", image: null, role: "admin", isStaff: true };
  }
  if (m.senderKind === "system") {
    return { ...base, _id: null, name: m.senderLabel || "ForgeX", image: null, role: "system", isStaff: true };
  }
  const u = m.senderId ? await ctx.db.get(m.senderId) : null;
  if (!u) return { ...base, _id: null, name: "Former member", image: null, role: "student", isStaff: false };
  const p = publicUser(u);
  return {
    ...base,
    _id: p._id,
    name: p.name,
    image: p.image,
    role: p.role,
    isStaff: p.role === "tutor" || p.role === "admin",
  };
}

/**
 * Full public shape of a community message, used by every community query
 * (main feed, search, pins, saved, discussions, jump-to-message context…).
 * Deleted content stays visible to moderators only — everyone else sees the
 * deletion placeholder, exactly as before.
 */
async function hydrateCommunityMessage(
  ctx: QueryCtx,
  m: Doc<"communityMessages">,
  viewerId: Id<"users">,
  communityId: Id<"courseCommunities">,
) {
  const sender = await hydrateSender(ctx, m);
  // The sender's role in THIS community (not their platform role) —
  // drives role-aware delete UI. Backend rules stay authoritative.
  const senderMembership = m.senderId
    ? await myMembership(ctx, m.senderId, communityId)
    : null;
  if (senderMembership) sender.communityRole = senderMembership.role;
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
  // Deleted content is retained in storage for moderation but never
  // leaked to students/tutors — they see the deletion placeholder only.
  const hidden = m.deleted;
  return {
    _id: m._id,
    communityId: m.communityId,
    senderId: m.senderId ?? null,
    sender,
    senderKind: m.senderKind,
    body: hidden ? "" : m.body,
    kind: hidden ? null : (m.kind ?? null),
    storageId: hidden ? null : (m.storageId ?? null),
    url: hidden ? null : (m.url ?? null),
    fileName: hidden ? null : (m.fileName ?? null),
    fileSize: hidden ? null : (m.fileSize ?? null),
    mimeType: hidden ? null : (m.mimeType ?? null),
    duration: hidden ? null : (m.duration ?? null),
    replyToId: m.replyToId ?? null,
    replyTo,
    discussionId: hidden ? null : (m.discussionId ?? null),
    isDiscussion: !hidden && !!m.isDiscussion,
    isAnnouncement: !hidden && !!m.isAnnouncement,
    pinned: !hidden && !!m.pinned,
    tutorAnswer: !hidden && !!m.tutorAnswer,
    pollId: hidden ? null : (m.pollId ?? null),
    mentions: hidden ? [] : (m.mentions ?? []),
    reactions: m.reactions,
    deleted: m.deleted,
    deletedBy: m.deletedBy ?? null,
    deletedById: hidden ? null : (m.deletedById ?? null),
    deletedAt: m.deletedAt ?? null,
    editedAt: m.editedAt ?? null,
    createdAt: m.createdAt,
    mine: m.senderId === viewerId,
  };
}

/**
 * Can this user post in this community? Returns an error message or null.
 *
 * Rules (all enforced server-side — the frontend never decides):
 *   - Removed / restricted / suspended members can't post.
 *   - Archived communities are read-only for everyone.
 *   - Students can't post when the community is locked OR its messaging
 *     mode is TUTORS_ONLY. Community tutors + admins can always post
 *     (unless archived).
 */
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
  const staffOnly =
    community.status === "locked" ||
    community.messageMode === "tutors_only";
  if (staffOnly && membership.role === "student") {
    return "Only community tutors can send messages right now.";
  }
  if (user.suspended) return "Your account is suspended.";
  return null;
}

/** True when the member is a community tutor (or admin) in this community. */
export async function isStaffMember(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  communityId: Id<"courseCommunities">,
): Promise<boolean> {
  const m = await myMembership(ctx, userId, communityId);
  if (!m || m.status !== "active") return false;
  return m.role === "tutor" || m.role === "admin";
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
            msg.senderKind !== "system" &&
            !msg.discussionId,
        ).length;
        const last = [...msgs].sort((a, b) => b.createdAt - a.createdAt)[0];
        const capacityInfo = await communityCapacity(ctx, community);
        return {
          community: {
            _id: community._id,
            name: community.name,
            status: community.status,
            messageMode: community.messageMode ?? "everyone",
            lockedReason: community.lockedReason ?? null,
            createdAt: community.createdAt,
            lastActivityAt: community.lastActivityAt ?? null,
            cohortLabel: community.cohortLabel ?? null,
            image: community.image ?? null,
          },
          course: course
            ? { _id: course._id, title: course.title, slug: course.slug, image: course.image ?? null, gradient: course.gradient ?? null }
            : null,
          myRole: m.role,
          myStatus: m.status,
          memberCount,
          capacity: capacityInfo,
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
          community: { _id: community._id, name: community.name, status: community.status, messageMode: community.messageMode ?? "everyone", lockedReason: community.lockedReason ?? null },
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
    const capacityInfo = await communityCapacity(ctx, community);
    // Sibling cohorts for the same course (used by staff for capacity
    // management + "create another cohort" — a single account may belong to
    // several of these, never duplicated).
    const courseCommunities = await ctx.db
      .query("courseCommunities")
      .withIndex("by_course", (q) => q.eq("courseId", community.courseId))
      .collect();
    const cohorts = await Promise.all(
      courseCommunities
        .filter((c) => c._id !== community._id)
        .map(async (c) => {
          const info = await communityCapacity(ctx, c);
          return {
            _id: c._id,
            name: c.name,
            status: c.status,
            cohortLabel: c.cohortLabel ?? null,
            capacity: info,
          };
        }),
    );
    return {
      community: {
        _id: community._id,
        name: community.name,
        status: community.status,
        messageMode: community.messageMode ?? "everyone",
        lockedReason: community.lockedReason ?? null,
        description: community.description ?? null,
        rules: community.rules ?? null,
        image: community.image ?? null,
        cohortLabel: community.cohortLabel ?? null,
      },
      course: course
        ? { _id: course._id, title: course.title, slug: course.slug, image: course.image ?? null }
        : null,
      membership: { role: membership.role, status: membership.status },
      memberCount,
      capacity: capacityInfo,
      cohorts,
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
    // The main feed shows every message EXCEPT replies that belong to a
    // learning discussion — those live in the discussion thread only.
    let rows = (
      await ctx.db
        .query("communityMessages")
        .withIndex("by_community", (q) => q.eq("communityId", communityId))
        .collect()
    )
      .filter((m) => !m.discussionId)
      .sort((a, b) => b.createdAt - a.createdAt);
    if (cursor !== undefined) {
      rows = rows.filter((m) => m.createdAt < cursor);
    }
    const hasMore = rows.length > COMMUNITY_PAGE;
    const page = hasMore ? rows.slice(0, COMMUNITY_PAGE) : rows;
    const oldest = page.length > 0 ? page[page.length - 1].createdAt : null;
    const messages = await Promise.all(
      [...page].reverse().map((m) =>
        hydrateCommunityMessage(ctx, m, userId, communityId),
      ),
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
          msg.senderKind !== "system" &&
          !msg.discussionId,
      ).length;
    }
    return total;
  },
});

// ---------------------------------------------------------------------------
// Queries — community upgrade (pins, polls, search, saved, resources…)
// ---------------------------------------------------------------------------

export const communityPinnedMessages = query({
  args: { communityId: v.id("courseCommunities") },
  handler: async (ctx, { communityId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const membership = await myMembership(ctx, userId, communityId);
    if (!membership || membership.status === "removed") return [];
    const rows = await ctx.db
      .query("communityMessages")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .collect();
    const pinned = rows
      .filter((m) => m.pinned && !m.deleted)
      .sort((a, b) => (b.pinnedAt ?? b.createdAt) - (a.pinnedAt ?? a.createdAt))
      .slice(0, 30);
    return Promise.all(
      pinned.map((m) => hydrateCommunityMessage(ctx, m, userId, communityId)),
    );
  },
});

export const communityPolls = query({
  args: { communityId: v.id("courseCommunities") },
  handler: async (ctx, { communityId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const membership = await myMembership(ctx, userId, communityId);
    if (!membership || membership.status === "removed") return [];
    const polls = await ctx.db
      .query("communityPolls")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .order("desc")
      .take(50);
    return polls.map((p) => ({
      _id: p._id,
      messageId: p.messageId,
      question: p.question,
      options: p.options,
      voteCounts: p.options.map(
        (_, i) => p.votes.filter((v) => v.optionIndex === i).length,
      ),
      totalVotes: p.votes.length,
      closed: p.closed,
      closesAt: p.closesAt ?? null,
      multiple: p.multiple,
      anonymous: p.anonymous,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
      myVotes: p.votes
        .filter((v) => v.userId === userId)
        .map((v) => v.optionIndex),
    }));
  },
});

export const communityTyping = query({
  args: { communityId: v.id("courseCommunities") },
  handler: async (ctx, { communityId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const membership = await myMembership(ctx, userId, communityId);
    if (!membership || membership.status === "removed") return [];
    const rows = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .collect();
    const typing = rows.filter(
      (m) => m.status === "active" && m.typingAt && m.userId !== userId,
    );
    const hydrated = await Promise.all(
      typing.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return {
          userId: m.userId,
          name: u?.name ?? "Someone",
          image: u?.image ?? null,
          typingAt: m.typingAt as number,
        };
      }),
    );
    return hydrated.sort((a, b) => b.typingAt - a.typingAt);
  },
});

export const searchCommunityMessages = query({
  args: {
    communityId: v.id("courseCommunities"),
    q: v.string(),
    senderId: v.optional(v.id("users")),
    kind: v.optional(v.string()),
  },
  handler: async (ctx, { communityId, q, senderId, kind }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const membership = await myMembership(ctx, userId, communityId);
    if (!membership || membership.status === "removed") return [];
    const term = q.trim();
    if (!term) return [];
    const rows = await ctx.db
      .query("communityMessages")
      .withSearchIndex("search_body", (s) =>
        s.search("body", term).eq("communityId", communityId),
      )
      .take(60);
    const matches = rows
      .filter((m) => !m.deleted && !m.discussionId)
      .filter((m) => !senderId || m.senderId === senderId)
      .filter((m) => !kind || m.kind === kind)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 40);
    return Promise.all(
      matches.map((m) => hydrateCommunityMessage(ctx, m, userId, communityId)),
    );
  },
});

/** Load a window of messages around one message (search / notification / save). */
export const messagesAround = query({
  args: {
    communityId: v.id("courseCommunities"),
    messageId: v.id("communityMessages"),
  },
  handler: async (ctx, { communityId, messageId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { messages: [], targetId: null };
    const membership = await myMembership(ctx, userId, communityId);
    if (!membership || membership.status === "removed") {
      return { messages: [], targetId: null };
    }
    const rows = (
      await ctx.db
        .query("communityMessages")
        .withIndex("by_community", (q) => q.eq("communityId", communityId))
        .collect()
    )
      .filter((m) => !m.discussionId)
      .sort((a, b) => a.createdAt - b.createdAt);
    const idx = rows.findIndex((m) => m._id === messageId);
    if (idx === -1) return { messages: [], targetId: null };
    const start = Math.max(0, idx - 20);
    const end = Math.min(rows.length, idx + 12);
    const slice = rows.slice(start, end);
    return {
      messages: await Promise.all(
        slice.map((m) => hydrateCommunityMessage(ctx, m, userId, communityId)),
      ),
      targetId: messageId,
    };
  },
});

export const mySavedCommunityMessages = query({
  args: { communityId: v.id("courseCommunities") },
  handler: async (ctx, { communityId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const membership = await myMembership(ctx, userId, communityId);
    if (!membership || membership.status === "removed") return [];
    const saved = await ctx.db
      .query("savedCommunityMessages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    const inCommunity = saved.filter((s) => s.communityId === communityId);
    const hydrated = await Promise.all(
      inCommunity.map(async (s) => {
        const msg = await ctx.db.get(s.messageId);
        if (!msg || msg.deleted) return null;
        return {
          ...(await hydrateCommunityMessage(ctx, msg, userId, communityId)),
          savedAt: s.createdAt,
        };
      }),
    );
    return hydrated.filter((x): x is NonNullable<typeof x> => x !== null);
  },
});

export const communityResources = query({
  args: { communityId: v.id("courseCommunities") },
  handler: async (ctx, { communityId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const membership = await myMembership(ctx, userId, communityId);
    if (!membership || membership.status === "removed") return [];
    const rows = await ctx.db
      .query("communityMessages")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .collect();
    const attachments = rows
      .filter(
        (m) =>
          !m.deleted &&
          !m.discussionId &&
          (m.kind === "image" || m.kind === "file" || m.kind === "voice") &&
          m.url,
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 200);
    return Promise.all(
      attachments.map(async (m) => {
        const sender = m.senderId ? await ctx.db.get(m.senderId) : null;
        return {
          _id: m._id,
          kind: m.kind as "image" | "file" | "voice",
          url: m.url as string,
          fileName: m.fileName ?? null,
          fileSize: m.fileSize ?? null,
          mimeType: m.mimeType ?? null,
          duration: m.duration ?? null,
          senderName:
            sender?.name ??
            (m.senderKind === "admin" ? "ForgeX Admin" : "Former member"),
          createdAt: m.createdAt,
        };
      }),
    );
  },
});

export const communityDiscussions = query({
  args: { communityId: v.id("courseCommunities") },
  handler: async (ctx, { communityId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const membership = await myMembership(ctx, userId, communityId);
    if (!membership || membership.status === "removed") return [];
    const rows = await ctx.db
      .query("communityMessages")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .collect();
    const roots = rows
      .filter((m) => m.isDiscussion && !m.deleted)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
    return Promise.all(
      roots.map(async (root) => {
        const replies = rows.filter(
          (m) => m.discussionId === root._id && !m.deleted,
        );
        const hydrated = await hydrateCommunityMessage(ctx, root, userId, communityId);
        return {
          ...hydrated,
          replyCount: replies.length,
          lastReplyAt: replies.length
            ? Math.max(...replies.map((r) => r.createdAt))
            : null,
        };
      }),
    );
  },
});

export const discussionMessages = query({
  args: {
    communityId: v.id("courseCommunities"),
    discussionId: v.id("communityMessages"),
  },
  handler: async (ctx, { communityId, discussionId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const membership = await myMembership(ctx, userId, communityId);
    if (!membership || membership.status === "removed") return [];
    const root = await ctx.db.get(discussionId);
    if (!root || root.communityId !== communityId || root.deleted) return [];
    const replies = await ctx.db
      .query("communityMessages")
      .withIndex("by_discussion", (q) => q.eq("discussionId", discussionId))
      .order("asc")
      .take(200);
    const hydratedRoot = await hydrateCommunityMessage(ctx, root, userId, communityId);
    const hydratedReplies = await Promise.all(
      replies.map((m) => hydrateCommunityMessage(ctx, m, userId, communityId)),
    );
    return [hydratedRoot, ...hydratedReplies];
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
        // Same-course students first, then online status, then name.
        const aShared = a.sharedCourses.length > 0 ? 1 : 0;
        const bShared = b.sharedCourses.length > 0 ? 1 : 0;
        if (bShared !== aShared) return bShared - aShared;
        const aOnline = a.online ? 1 : 0;
        const bOnline = b.online ? 1 : 0;
        if (bOnline !== aOnline) return bOnline - aOnline;
        return a.name.localeCompare(b.name);
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
        // Deleted content stays in storage for moderation but DM partners
        // only ever see the deletion placeholder.
        const hidden = m.deleted;
        return {
          _id: m._id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          senderKind: "user",
          sender: {
            _id: m.senderId,
            name: (m.senderId === me._id ? me.name || "You" : other?.name) ?? "Student",
            image: m.senderId === me._id ? me.image ?? null : other?.image ?? null,
            role: m.senderId === me._id ? me.role ?? "student" : other?.role ?? "student",
            isStaff: false,
          },
          body: hidden ? "" : m.body,
          kind: hidden ? null : (m.kind ?? null),
          storageId: hidden ? null : (m.storageId ?? null),
          url: hidden ? null : (m.url ?? null),
          fileName: hidden ? null : (m.fileName ?? null),
          fileSize: hidden ? null : (m.fileSize ?? null),
          mimeType: hidden ? null : (m.mimeType ?? null),
          duration: hidden ? null : (m.duration ?? null),
          replyToId: m.replyToId ?? null,
          replyTo,
          reactions: m.reactions,
          deleted: m.deleted,
          deletedBy: m.deletedBy ?? null,
          deletedById: m.deletedById ?? null,
          deletedAt: m.deletedAt ?? null,
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
    /** User ids mentioned with @name (resolved client-side, validated here). */
    mentionIds: v.optional(v.array(v.id("users"))),
    /** @everyone — community tutors and admins only. */
    mentionEveryone: v.optional(v.boolean()),
    /** Official announcement (community tutors and admins only). */
    isAnnouncement: v.optional(v.boolean()),
    /** Explicit discussion id when posting inside a learning thread. */
    discussionId: v.optional(v.id("communityMessages")),
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

    // Official announcements are staff-only.
    const isAnnouncement = !!args.isAnnouncement;
    if (isAnnouncement) {
      await requireStaff(ctx, user, community._id);
    }

    // Reply → inherit the discussion context when replying to a discussion
    // message (or its replies), so the reply lands inside the learning thread.
    let discussionId = args.discussionId;
    let replied: Doc<"communityMessages"> | null = null;
    if (args.replyToId) {
      replied = await ctx.db.get(args.replyToId);
      if (!replied || replied.communityId !== community._id || replied.deleted) {
        throw new Error("The message you're replying to no longer exists.");
      }
      if (!discussionId && replied.discussionId) discussionId = replied.discussionId;
      if (!discussionId && replied.isDiscussion) discussionId = replied._id;
    }
    if (discussionId) {
      const root = await ctx.db.get(discussionId);
      if (!root || root.communityId !== community._id || root.deleted) {
        throw new Error("The discussion you're replying to no longer exists.");
      }
    }

    // Mentions: only active community members can be mentioned, and only
    // community tutors/admins may use @everyone.
    const memberRows = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", community._id))
      .collect();
    const activeMemberIds = new Set(
      memberRows.filter((m) => m.status === "active").map((m) => m.userId.toString()),
    );
    const mentionIds = (args.mentionIds ?? [])
      .map((id) => id.toString())
      .filter((id) => activeMemberIds.has(id));
    const mentionEveryone = !!args.mentionEveryone;
    if (mentionEveryone && !(await isStaffMember(ctx, user._id, community._id))) {
      throw new Error("Only community tutors and admins can mention @everyone.");
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
      discussionId,
      isAnnouncement: isAnnouncement ? true : undefined,
      mentions: mentionIds.length ? mentionIds : undefined,
      reactions: [],
      deleted: false,
      createdAt: Date.now(),
    });
    await ctx.db.patch(community._id, { lastActivityAt: Date.now() });
    const preview = messagePreview({
      body: trimmed,
      kind: args.kind,
      fileName: args.fileName,
    });

    // Notify the community's staff (tutors / moderators / admins) when a
    // student posts, so questions don't sit unanswered. Staff never notify
    // themselves, and students are tracked via unread counts instead.
    const staffIds = new Set(
      memberRows
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
        body: preview.slice(0, 90),
        type: "community",
        link: `/dashboard/communities/${community._id}`,
      });
    }

    // Reply notification → the original sender (if it's not me).
    if (replied?.senderId && replied.senderId !== user._id) {
      await notify(ctx, {
        userId: replied.senderId,
        title: "💬 New reply to your message",
        body: `${user.name || "Someone"} replied: ${preview.slice(0, 80)}`,
        type: "community-reply",
        link: `/dashboard/communities/${community._id}`,
      });
    }

    // @mentions → notify each mentioned user (never myself).
    for (const mid of mentionIds) {
      if (mid === user._id.toString()) continue;
      await notify(ctx, {
        userId: mid as Id<"users">,
        title: "📣 You were mentioned",
        body: `${user.name || "Someone"} mentioned you in ${community.name}`,
        type: "community-mention",
        link: `/dashboard/communities/${community._id}`,
      });
    }

    // @everyone → notify active members (capped so huge communities stay sane).
    if (mentionEveryone) {
      let sent = 0;
      for (const m of memberRows) {
        if (sent >= 150) break;
        if (m.status !== "active" || m.userId === user._id) continue;
        await notify(ctx, {
          userId: m.userId,
          title: `📣 ${community.name}`,
          body: `${user.name || "A tutor"} said @everyone: ${preview.slice(0, 80)}`,
          type: "community-mention",
          link: `/dashboard/communities/${community._id}`,
        });
        sent += 1;
      }
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

/**
 * Role-aware community message deletion (enforced here, never on the client):
 *   - Any member deletes their own message.
 *   - Community Tutors delete their own + student messages.
 *   - Community Tutors can NEVER delete Admin messages or other tutors'.
 *   - Admins (platform role or community admin member) delete anything.
 * Deleted rows keep a placeholder — “This message was deleted.”
 */
export const deleteCommunityMessage = mutation({
  args: { messageId: v.id("communityMessages") },
  handler: async (ctx, { messageId }) => {
    const user = await requireUserDoc(ctx);
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.deleted) throw new Error("Message not found.");
    const membership = await myMembership(ctx, user._id, msg.communityId);
    if (!membership || membership.status !== "active") {
      throw new Error("You're not an active member of this community.");
    }
    const viewerIsAdmin =
      user.role === ROLES.ADMIN || membership.role === "admin";

    // Own message → always allowed. The original body/attachment is kept for
    // moderation (admins can review deleted content) — students see a placeholder.
    if (msg.senderId === user._id) {
      await ctx.db.patch(messageId, {
        deleted: true,
        deletedBy: "user",
        deletedById: user._id,
        deletedAt: Date.now(),
      });
      return true;
    }

    // Non-staff members can only delete their own messages.
    if (!viewerIsAdmin && membership.role !== "tutor") {
      throw new Error("You can only delete your own messages.");
    }

    // Community Tutors: student messages only — never Admin or tutor messages.
    if (!viewerIsAdmin) {
      const senderUser = msg.senderId ? await ctx.db.get(msg.senderId) : null;
      const senderMembership = msg.senderId
        ? await myMembership(ctx, msg.senderId, msg.communityId)
        : null;
      const senderIsAdmin =
        msg.senderKind === "admin" ||
        senderUser?.role === ROLES.ADMIN ||
        senderMembership?.role === "admin";
      const senderIsTutor = senderMembership?.role === "tutor";
      if (senderIsAdmin || senderIsTutor) {
        throw new Error("You can only delete student messages.");
      }
    }

    await ctx.db.patch(messageId, {
      deleted: true,
      deletedBy: viewerIsAdmin ? "admin" : "user",
      deletedById: user._id,
      deletedAt: Date.now(),
    });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Community Tutor tools (community-scoped, enforced on the backend)
// ---------------------------------------------------------------------------

/** Shared guard: viewer must be an active community tutor or admin member. */
async function requireStaff(
  ctx: MutationCtx,
  user: Doc<"users">,
  communityId: Id<"courseCommunities">,
): Promise<{ membership: Doc<"communityMembers">; isAdmin: boolean }> {
  const membership = await myMembership(ctx, user._id, communityId);
  if (!membership || membership.status !== "active") {
    throw new Error("You're not an active member of this community.");
  }
  const isAdmin =
    user.role === ROLES.ADMIN || membership.role === "admin";
  if (!isAdmin && membership.role !== "tutor") {
    throw new Error("Community tutor access required.");
  }
  return { membership, isAdmin };
}

/** Community Tutor: lock / unlock their assigned community (never archive). */
export const tutorSetCommunityStatus = mutation({
  args: {
    communityId: v.id("courseCommunities"),
    status: v.union(v.literal("active"), v.literal("locked")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { communityId, status, reason }) => {
    const user = await requireUserDoc(ctx);
    const { isAdmin } = await requireStaff(ctx, user, communityId);
    const community = await ctx.db.get(communityId);
    if (!community) throw new Error("Community not found.");
    await ctx.db.patch(communityId, {
      status,
      lockedReason: status === "active" ? undefined : reason?.trim() || "Locked by community tutor",
    });
    await logModeration(
      ctx,
      status === "locked" ? "TUTOR_LOCKED_COMMUNITY" : "TUTOR_UNLOCKED_COMMUNITY",
      { targetType: "community", targetId: communityId, communityId, reason: reason?.trim() },
    );
    return true;
  },
});

/**
 * Community Tutor: switch messaging mode between EVERYONE_CAN_MESSAGE and
 * TUTORS_ONLY for this community only (never affects other communities).
 */
export const tutorSetCommunityMessageMode = mutation({
  args: {
    communityId: v.id("courseCommunities"),
    mode: v.union(v.literal("everyone"), v.literal("tutors_only")),
  },
  handler: async (ctx, { communityId, mode }) => {
    const user = await requireUserDoc(ctx);
    await requireStaff(ctx, user, communityId);
    const community = await ctx.db.get(communityId);
    if (!community) throw new Error("Community not found.");
    await ctx.db.patch(communityId, { messageMode: mode });
    await logModeration(ctx, "TUTOR_SET_MESSAGE_MODE", {
      targetType: "community",
      targetId: communityId,
      communityId,
      reason: mode === "tutors_only" ? "TUTORS_ONLY" : "EVERYONE_CAN_MESSAGE",
    });
    return true;
  },
});

/**
 * Community Tutor: remove a STUDENT from their assigned community.
 * Tutors can never remove Admins (or other tutors); Admins can remove anyone.
 * Removing a member NEVER touches their course enrollment.
 */
export const tutorRemoveCommunityMember = mutation({
  args: {
    communityId: v.id("courseCommunities"),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { communityId, userId, reason }) => {
    const user = await requireUserDoc(ctx);
    const { isAdmin } = await requireStaff(ctx, user, communityId);
    if (userId === user._id) throw new Error("You can't remove yourself.");
    const targetMembership = await myMembership(ctx, userId, communityId);
    if (!targetMembership) throw new Error("This user isn't a member.");
    const targetUser = await ctx.db.get(userId);
    const targetIsAdmin =
      targetUser?.role === ROLES.ADMIN || targetMembership.role === "admin";
    if (targetIsAdmin) {
      throw new Error("Admins cannot be removed.");
    }
    if (!isAdmin && targetMembership.role !== "student") {
      throw new Error("You can only remove students from the community.");
    }
    await ctx.db.patch(targetMembership._id, {
      status: "removed",
      removedAt: Date.now(),
      removedReason: reason?.trim() || undefined,
    });
    await logModeration(
      ctx,
      isAdmin ? "ADMIN_REMOVED_MEMBER" : "TUTOR_REMOVED_MEMBER",
      {
        targetType: "member",
        targetId: userId,
        communityId,
        userId,
        reason: reason?.trim(),
      },
    );
    await notify(ctx, {
      userId,
      title: "Removed from community",
      body: `You were removed from ${communityName(ctx, communityId)}${reason ? `: ${reason}` : "."}`,
      type: "moderation",
      link: "/dashboard/communities",
    });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Mutations — community upgrade (pins, answers, discussions, polls, saved…)
// ---------------------------------------------------------------------------

/** Community Tutor / Admin: pin or unpin a message. */
export const setPinnedCommunityMessage = mutation({
  args: { messageId: v.id("communityMessages"), pinned: v.boolean() },
  handler: async (ctx, { messageId, pinned }) => {
    const user = await requireUserDoc(ctx);
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.deleted) throw new Error("Message not found.");
    await requireStaff(ctx, user, msg.communityId);
    await ctx.db.patch(messageId, {
      pinned: pinned ? true : undefined,
      pinnedBy: pinned ? user._id : undefined,
      pinnedAt: pinned ? Date.now() : undefined,
    });
    return true;
  },
});

/** Community Tutor / Admin: mark (or unmark) the verified tutor answer. */
export const setTutorAnswer = mutation({
  args: { messageId: v.id("communityMessages"), on: v.boolean() },
  handler: async (ctx, { messageId, on }) => {
    const user = await requireUserDoc(ctx);
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.deleted) throw new Error("Message not found.");
    await requireStaff(ctx, user, msg.communityId);
    await ctx.db.patch(messageId, {
      tutorAnswer: on ? true : undefined,
      tutorAnswerBy: on ? user._id : undefined,
    });
    return true;
  },
});

/** Community Tutor / Admin: turn a message into (or close) a learning thread. */
export const setDiscussion = mutation({
  args: { messageId: v.id("communityMessages"), on: v.boolean() },
  handler: async (ctx, { messageId, on }) => {
    const user = await requireUserDoc(ctx);
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.deleted) throw new Error("Message not found.");
    await requireStaff(ctx, user, msg.communityId);
    await ctx.db.patch(messageId, { isDiscussion: on ? true : undefined });
    return true;
  },
});

/** Community Tutor / Admin: create a poll. Renders as a message + poll card. */
export const createCommunityPoll = mutation({
  args: {
    communityId: v.id("courseCommunities"),
    question: v.string(),
    options: v.array(v.string()),
    multiple: v.boolean(),
    anonymous: v.boolean(),
    closesAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserDoc(ctx);
    await requireStaff(ctx, user, args.communityId);
    const community = await ctx.db.get(args.communityId);
    if (!community) throw new Error("Community not found.");
    const question = args.question.trim();
    const options = [...new Set(args.options.map((o) => o.trim()).filter(Boolean))];
    if (!question) throw new Error("Poll needs a question.");
    if (question.length > 200) throw new Error("Keep the question under 200 characters.");
    if (options.length < 2) throw new Error("Add at least two options.");
    if (options.length > 8) throw new Error("Max 8 options.");
    if (args.closesAt && args.closesAt <= Date.now()) {
      throw new Error("Closing time must be in the future.");
    }
    await checkRateLimit(ctx, `poll:${user._id}`, 10, 60 * 60 * 1000, "You're creating polls too quickly.");
    const msgId = await ctx.db.insert("communityMessages", {
      communityId: args.communityId,
      senderId: user._id,
      senderKind: "user",
      body: question,
      reactions: [],
      deleted: false,
      createdAt: Date.now(),
    });
    const pollId = await ctx.db.insert("communityPolls", {
      communityId: args.communityId,
      messageId: msgId,
      createdBy: user._id,
      question,
      options,
      votes: [],
      multiple: args.multiple,
      anonymous: args.anonymous,
      closesAt: args.closesAt,
      closed: false,
      createdAt: Date.now(),
    });
    await ctx.db.patch(msgId, { pollId });
    await ctx.db.patch(community._id, { lastActivityAt: Date.now() });
    return pollId;
  },
});

/** Any active member votes. Duplicate votes are impossible. */
export const voteCommunityPoll = mutation({
  args: { pollId: v.id("communityPolls"), optionIndexes: v.array(v.number()) },
  handler: async (ctx, { pollId, optionIndexes }) => {
    const user = await requireUserDoc(ctx);
    const poll = await ctx.db.get(pollId);
    if (!poll) throw new Error("Poll not found.");
    const membership = await myMembership(ctx, user._id, poll.communityId);
    if (!membership || membership.status !== "active") {
      throw new Error("You're not an active member of this community.");
    }
    if (poll.closed) throw new Error("This poll is closed.");
    if (poll.closesAt && poll.closesAt <= Date.now()) {
      throw new Error("This poll has closed.");
    }
    if (poll.votes.some((v) => v.userId === user._id)) {
      throw new Error("You've already voted in this poll.");
    }
    const idxs = [...new Set(optionIndexes)].filter(
      (i) => Number.isInteger(i) && i >= 0 && i < poll.options.length,
    );
    if (!idxs.length) throw new Error("Pick at least one option.");
    if (!poll.multiple && idxs.length > 1) {
      throw new Error("This poll only allows one answer.");
    }
    await ctx.db.patch(pollId, {
      votes: [
        ...poll.votes,
        ...idxs.map((optionIndex) => ({ optionIndex, userId: user._id })),
      ],
    });
    return true;
  },
});

/** Community Tutor / Admin: close a poll early. */
export const closeCommunityPoll = mutation({
  args: { pollId: v.id("communityPolls") },
  handler: async (ctx, { pollId }) => {
    const user = await requireUserDoc(ctx);
    const poll = await ctx.db.get(pollId);
    if (!poll) throw new Error("Poll not found.");
    await requireStaff(ctx, user, poll.communityId);
    await ctx.db.patch(pollId, { closed: true });
    return true;
  },
});

/** Bookmark a message (private to the user). */
export const saveCommunityMessage = mutation({
  args: { messageId: v.id("communityMessages") },
  handler: async (ctx, { messageId }) => {
    const user = await requireUserDoc(ctx);
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.deleted) throw new Error("Message not found.");
    const membership = await myMembership(ctx, user._id, msg.communityId);
    if (!membership || membership.status !== "active") {
      throw new Error("You're not an active member of this community.");
    }
    const existing = await ctx.db
      .query("savedCommunityMessages")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", user._id).eq("messageId", messageId),
      )
      .first();
    if (!existing) {
      await ctx.db.insert("savedCommunityMessages", {
        userId: user._id,
        communityId: msg.communityId,
        messageId,
        createdAt: Date.now(),
      });
    }
    return true;
  },
});

export const unsaveCommunityMessage = mutation({
  args: { messageId: v.id("communityMessages") },
  handler: async (ctx, { messageId }) => {
    const user = await requireUserDoc(ctx);
    const existing = await ctx.db
      .query("savedCommunityMessages")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", user._id).eq("messageId", messageId),
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return true;
  },
});

/** Debounced typing heartbeat. `typing: false` clears the indicator. */
export const setCommunityTyping = mutation({
  args: { communityId: v.id("courseCommunities"), typing: v.boolean() },
  handler: async (ctx, { communityId, typing }) => {
    const user = await requireUserDoc(ctx);
    const membership = await myMembership(ctx, user._id, communityId);
    if (!membership || membership.status !== "active") return true;
    await ctx.db.patch(membership._id, {
      typingAt: typing ? Date.now() : undefined,
    });
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
    // Original body is preserved for moderation; the DM partners see a placeholder.
    await ctx.db.patch(messageId, {
      deleted: true,
      deletedBy: "user",
      deletedById: me._id,
      deletedAt: Date.now(),
    });
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
