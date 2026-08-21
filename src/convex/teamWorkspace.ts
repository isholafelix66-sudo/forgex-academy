import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireAuth(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  return user;
}

async function requireTeamRole(ctx: any, allowedRoles: string[]) {
  const user = await requireAuth(ctx);
  if (user.role === "admin") return user;
  if (!user.teamRole || !allowedRoles.includes(user.teamRole)) {
    throw new Error("You do not have permission for this action.");
  }
  return user;
}

async function logActivity(ctx: any, data: {
  userId?: string;
  teamId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  details?: string;
}) {
  await ctx.db.insert("teamActivity", {
    userId: data.userId as any,
    teamId: data.teamId as any,
    action: data.action,
    targetType: data.targetType,
    targetId: data.targetId,
    targetLabel: data.targetLabel,
    details: data.details,
    createdAt: Date.now(),
  });
}

async function createNotification(ctx: any, data: {
  userId: string;
  title: string;
  body: string;
  type: string;
  link?: string;
}) {
  await ctx.db.insert("notifications", {
    userId: data.userId as any,
    title: data.title,
    body: data.body,
    type: data.type,
    link: data.link,
    read: false,
    createdAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Student Support Cases
// ---------------------------------------------------------------------------

let caseCounter = 0;

export const submitStudentSupport = mutation({
  args: {
    category: v.union(
      v.literal("course"),
      v.literal("video"),
      v.literal("quiz"),
      v.literal("account"),
      v.literal("technical"),
      v.literal("academic"),
      v.literal("learning"),
      v.literal("general"),
      v.literal("other"),
    ),
    subject: v.string(),
    description: v.string(),
    courseId: v.optional(v.id("courses")),
    moduleLesson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const now = Date.now();
    caseCounter++;
    const caseNumber = `SUP-${new Date().getFullYear()}-${String(caseCounter).padStart(6, "0")}`;

    const id = await ctx.db.insert("studentSupportCases", {
      studentId: user._id,
      caseNumber,
      category: args.category,
      subject: args.subject.trim().slice(0, 200),
      description: args.description.trim().slice(0, 5000),
      courseId: args.courseId,
      moduleLesson: args.moduleLesson,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    // Notify student support team
    const studentSupportUsers = await ctx.db.query("users").collect();
    for (const u of studentSupportUsers) {
      if (u.teamRole === "student-support" || u.role === "admin") {
        await createNotification(ctx, {
          userId: u._id,
          title: `New student support: ${args.subject}`,
          body: `${user.name || "A student"} submitted a support request.`,
          type: "student_support",
          link: "/team/student-support",
        });
      }
    }

    await logActivity(ctx, {
      userId: user._id,
      action: "submitted_support",
      targetType: "student_support",
      targetId: id,
      targetLabel: args.subject,
    });

    return { id, caseNumber };
  },
});

export const listStudentSupportCases = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["student-support"]);
    let q = ctx.db.query("studentSupportCases").order("desc");
    if (args.status) {
      q = q.filter((q) => q.eq(q.field("status"), args.status));
    }
    const cases = await q.take(100);
    const enriched = [];
    for (const c of cases) {
      const student = await ctx.db.get(c.studentId);
      const assignee = c.assignedTo ? await ctx.db.get(c.assignedTo) : null;
      enriched.push({ ...c, student, assignee });
    }
    return enriched;
  },
});

export const updateStudentSupportCase = mutation({
  args: {
    caseId: v.id("studentSupportCases"),
    status: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    escalatedTo: v.optional(v.union(v.literal("admin"), v.literal("academic"))),
    escalationNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["student-support"]);
    const doc = await ctx.db.get(args.caseId);
    if (!doc) throw new Error("Case not found");

    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.status) patch.status = args.status;
    if (args.assignedTo) patch.assignedTo = args.assignedTo;
    if (args.escalatedTo) {
      patch.escalatedTo = args.escalatedTo;
      patch.escalationNote = args.escalationNote;
      patch.status = "escalated";
    }
    if (args.status === "resolved") patch.resolvedAt = Date.now();

    await ctx.db.patch(args.caseId, patch);

    // Notify student of status change
    if (args.status) {
      await createNotification(ctx, {
        userId: doc.studentId,
        title: `Support case ${doc.caseNumber} updated`,
        body: `Your support request status changed to ${args.status.replace(/_/g, " ")}.`,
        type: "student_support",
        link: "/dashboard",
      });
    }

    await logActivity(ctx, {
      userId: user._id,
      action: `case_${args.status || "updated"}`,
      targetType: "student_support",
      targetId: args.caseId,
      targetLabel: doc.caseNumber,
      details: args.escalatedTo ? `Escalated to ${args.escalatedTo}` : undefined,
    });

    return true;
  },
});

export const myStudentSupportCases = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    return await ctx.db
      .query("studentSupportCases")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .order("desc")
      .take(50);
  },
});

// ---------------------------------------------------------------------------
// Team Conversations
// ---------------------------------------------------------------------------

export const getOrCreateConversation = mutation({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    teamId: v.optional(v.id("teams")),
    subject: v.string(),
    participantIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check for existing conversation
    const existing = await ctx.db
      .query("teamConversations")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId)
      )
      .first();

    if (existing) return existing._id;

    const now = Date.now();
    const convId = await ctx.db.insert("teamConversations", {
      entityType: args.entityType,
      entityId: args.entityId,
      teamId: args.teamId as any,
      subject: args.subject,
      status: "open",
      lastMessageAt: now,
      createdAt: now,
    });

    // Add participants
    const allParticipantIds = new Set([user._id, ...args.participantIds]);
    for (const pid of allParticipantIds) {
      await ctx.db.insert("teamConversationParticipants", {
        conversationId: convId,
        userId: pid,
        role: "member",
        joinedAt: now,
      });
    }

    return convId;
  },
});

export const sendConversationMessage = mutation({
  args: {
    conversationId: v.id("teamConversations"),
    body: v.string(),
    isInternal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");
    if (conv.status === "closed") throw new Error("Conversation is closed");

    const now = Date.now();
    const msgId = await ctx.db.insert("teamConversationMessages", {
      conversationId: args.conversationId,
      senderId: user._id,
      senderRole: user.teamRole || user.role || "member",
      body: args.body.trim().slice(0, 5000),
      isInternal: args.isInternal || false,
      createdAt: now,
    });

    await ctx.db.patch(args.conversationId, { lastMessageAt: now });

    // Notify other participants
    const participants = await ctx.db
      .query("teamConversationParticipants")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    for (const p of participants) {
      if (p.userId !== user._id) {
        await createNotification(ctx, {
          userId: p.userId,
          title: `New message in ${conv.subject}`,
          body: `${user.name || "Someone"}: ${args.body.slice(0, 80)}`,
          type: "message",
          link: `/team`,
        });
      }
    }

    return msgId;
  },
});

export const getConversationMessages = query({
  args: { conversationId: v.id("teamConversations") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const messages = await ctx.db
      .query("teamConversationMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    // Filter internal notes for non-team users
    return messages.filter((m) => {
      if (m.isInternal && user.role !== "admin" && !user.teamRole) return false;
      return true;
    });
  },
});

export const listTeamConversations = query({
  args: {
    entityType: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    let convs;

    if (args.entityType) {
      const et = args.entityType;
      convs = await ctx.db
        .query("teamConversations")
        .withIndex("by_entity", (q) => q.eq("entityType", et))
        .order("desc")
        .take(50);
    } else if (args.teamId) {
      const tid = args.teamId;
      convs = await ctx.db
        .query("teamConversations")
        .withIndex("by_team", (q) => q.eq("teamId", tid))
        .order("desc")
        .take(50);
    } else {
      // Get conversations the user participates in
      const participations = await ctx.db
        .query("teamConversationParticipants")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const ids = participations.map((p) => p.conversationId);
      convs = [];
      for (const id of ids) {
        const c = await ctx.db.get(id);
        if (c) convs.push(c);
      }
      convs.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    }

    return convs;
  },
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const myNotifications = query({
  args: { unreadOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    let q = ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc");
    if (args.unreadOnly) {
      q = q.filter((q) => q.eq(q.field("read"), false));
    }
    return await q.take(50);
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, { read: true });
    return true;
  },
});

export const markAllNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();
    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
    return unread.length;
  },
});

// ---------------------------------------------------------------------------
// Team Activity
// ---------------------------------------------------------------------------

export const getTeamActivityFeed = query({
  args: {
    teamId: v.optional(v.id("teams")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    let activities;

    if (args.teamId) {
      activities = await ctx.db
        .query("teamActivity")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .order("desc")
        .take(args.limit ?? 50);
    } else if (user.role === "admin") {
      activities = await ctx.db
        .query("teamActivity")
        .order("desc")
        .take(args.limit ?? 50);
    } else {
      activities = await ctx.db
        .query("teamActivity")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(args.limit ?? 50);
    }

    const enriched = [];
    for (const a of activities) {
      const u = a.userId ? await ctx.db.get(a.userId) : null;
      enriched.push({ ...a, user: u });
    }
    return enriched;
  },
});

// ---------------------------------------------------------------------------
// Course Review Communication (Academic Team)
// ---------------------------------------------------------------------------

export const startCourseReview = mutation({
  args: {
    courseId: v.id("courses"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["academic"]);
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found");

    const tutor = await ctx.db.get(course.tutorId);

    // Create conversation
    const now = Date.now();
    const convId = await ctx.db.insert("teamConversations", {
      entityType: "course",
      entityId: args.courseId,
      teamId: args.teamId as any,
      subject: `Academic Review: ${course.title}`,
      status: "open",
      lastMessageAt: now,
      createdAt: now,
    });

    // Add participants (academic reviewer + tutor)
    await ctx.db.insert("teamConversationParticipants", {
      conversationId: convId,
      userId: user._id,
      role: "academic",
      joinedAt: now,
    });
    if (tutor) {
      await ctx.db.insert("teamConversationParticipants", {
        conversationId: convId,
        userId: tutor._id,
        role: "tutor",
        joinedAt: now,
      });
    }

    // Notify tutor
    if (tutor) {
      await createNotification(ctx, {
        userId: tutor._id,
        title: `Course review started: ${course.title}`,
        body: `The Academic Team has started reviewing your course.`,
        type: "course_review",
        link: "/tutor/courses",
      });
    }

    // Update course status
    await ctx.db.patch(args.courseId, { status: "pending" });

    await logActivity(ctx, {
      userId: user._id,
      teamId: args.teamId,
      action: "started_review",
      targetType: "course",
      targetId: args.courseId,
      targetLabel: course.title,
    });

    return convId;
  },
});

// ---------------------------------------------------------------------------
// Admin: Seed Teams
// ---------------------------------------------------------------------------

export const seedTeams = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    if (user.role !== "admin") throw new Error("Admin only");

    const teamsToSeed = [
      { name: "Academic Team", slug: "academic", description: "Academic quality, course review, and curriculum standards." },
      { name: "AI Support Team", slug: "ai-support", description: "AI Hub management, tool curation, and prompt library." },
      { name: "Tutor Support Team", slug: "tutor-support", description: "Tutor onboarding, support tickets, and tutor issues." },
      { name: "Student Support Team", slug: "student-support", description: "Student-facing support, issues, and student experience." },
      { name: "Content Team", slug: "content", description: "Content management, resources, and platform content." },
    ];

    const seeded = [];
    for (const t of teamsToSeed) {
      const existing = await ctx.db
        .query("teams")
        .withIndex("by_slug", (q) => q.eq("slug", t.slug))
        .unique();
      if (!existing) {
        const id = await ctx.db.insert("teams", {
          name: t.name,
          slug: t.slug,
          description: t.description,
          memberCount: 0,
          activeWorkCount: 0,
          status: "active",
          createdAt: Date.now(),
        });
        seeded.push({ id, ...t });
      }
    }
    return seeded;
  },
});

// ---------------------------------------------------------------------------
// Admin: List all teams
// ---------------------------------------------------------------------------

export const listAllTeamsAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    if (user.role !== "admin") throw new Error("Admin only");
    return await ctx.db.query("teams").collect();
  },
});

// ---------------------------------------------------------------------------
// Admin: Global Activity Feed
// ---------------------------------------------------------------------------

export const adminGlobalActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "admin") throw new Error("Admin only");
    const activities = await ctx.db
      .query("teamActivity")
      .order("desc")
      .take(args.limit ?? 100);
    const enriched = [];
    for (const a of activities) {
      const u = a.userId ? await ctx.db.get(a.userId) : null;
      enriched.push({ ...a, user: u });
    }
    return enriched;
  },
});
