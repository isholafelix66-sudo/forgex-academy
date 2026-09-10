import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { nameFromEmail } from "./lib";

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

// ---------------------------------------------------------------------------
// AI Support CRUD — Connected to existing aiResources + prompts tables
// ---------------------------------------------------------------------------

export const createAiTool = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    category: v.string(),
    url: v.string(),
    pricingType: v.union(v.literal("free"), v.literal("freemium"), v.literal("paid")),
    body: v.optional(v.string()),
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["ai-support"]);
    const now = Date.now();
    const id = await ctx.db.insert("aiResources", {
      title: args.title.trim(),
      slug: args.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      description: args.description.trim(),
      category: args.category,
      resourceType: "tool",
      url: args.url.trim(),
      pricingType: args.pricingType,
      noCreditCard: false,
      body: args.body,
      featured: false,
      published: args.published ?? false,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      userId: user._id,
      action: args.published ? "published_ai_tool" : "created_ai_tool",
      targetType: "ai_tool",
      targetId: id,
      targetLabel: args.title,
    });
    return id;
  },
});

export const updateAiTool = mutation({
  args: {
    toolId: v.id("aiResources"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    url: v.optional(v.string()),
    pricingType: v.optional(v.union(v.literal("free"), v.literal("freemium"), v.literal("paid"))),
    body: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["ai-support"]);
    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;
    if (args.category !== undefined) patch.category = args.category;
    if (args.url !== undefined) patch.url = args.url;
    if (args.pricingType !== undefined) patch.pricingType = args.pricingType;
    if (args.body !== undefined) patch.body = args.body;
    await ctx.db.patch(args.toolId, patch);
    const tool = await ctx.db.get(args.toolId);
    await logActivity(ctx, {
      userId: user._id,
      action: "updated_ai_tool",
      targetType: "ai_tool",
      targetId: args.toolId,
      targetLabel: tool?.title,
    });
    return true;
  },
});

export const toggleAiToolPublish = mutation({
  args: { toolId: v.id("aiResources") },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["ai-support"]);
    const tool = await ctx.db.get(args.toolId);
    if (!tool) throw new Error("Tool not found");
    const newPublished = !tool.published;
    await ctx.db.patch(args.toolId, {
      published: newPublished,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      userId: user._id,
      action: newPublished ? "published_ai_tool" : "unpublished_ai_tool",
      targetType: "ai_tool",
      targetId: args.toolId,
      targetLabel: tool.title,
    });
    return newPublished;
  },
});

export const deleteAiTool = mutation({
  args: { toolId: v.id("aiResources") },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["ai-support"]);
    const tool = await ctx.db.get(args.toolId);
    if (!tool) throw new Error("Tool not found");
    await ctx.db.delete(args.toolId);
    await logActivity(ctx, {
      userId: user._id,
      action: "deleted_ai_tool",
      targetType: "ai_tool",
      targetId: args.toolId,
      targetLabel: tool.title,
    });
    return true;
  },
});

// --- Prompts CRUD ---

export const createPrompt = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    categoryId: v.id("promptCategories"),
    template: v.string(),
    usefulFor: v.string(),
    tags: v.array(v.string()),
    published: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["ai-support"]);
    const now = Date.now();
    const id = await ctx.db.insert("prompts", {
      title: args.title.trim(),
      slug: args.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      description: args.description.trim(),
      categoryId: args.categoryId,
      tags: args.tags,
      usefulFor: args.usefulFor,
      requiredInputs: [],
      template: args.template,
      fields: [],
      featured: args.featured ?? false,
      published: args.published ?? false,
      order: 0,
      views: 0,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      userId: user._id,
      action: args.published ? "published_prompt" : "created_prompt",
      targetType: "prompt",
      targetId: id,
      targetLabel: args.title,
    });
    return id;
  },
});

export const updatePrompt = mutation({
  args: {
    promptId: v.id("prompts"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    template: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    usefulFor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["ai-support"]);
    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;
    if (args.template !== undefined) patch.template = args.template;
    if (args.tags !== undefined) patch.tags = args.tags;
    if (args.usefulFor !== undefined) patch.usefulFor = args.usefulFor;
    await ctx.db.patch(args.promptId, patch);
    return true;
  },
});

export const togglePromptPublish = mutation({
  args: { promptId: v.id("prompts") },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["ai-support"]);
    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) throw new Error("Prompt not found");
    await ctx.db.patch(args.promptId, {
      published: !prompt.published,
      updatedAt: Date.now(),
    });
    return !prompt.published;
  },
});

export const togglePromptFeatured = mutation({
  args: { promptId: v.id("prompts") },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["ai-support"]);
    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) throw new Error("Prompt not found");
    await ctx.db.patch(args.promptId, {
      featured: !prompt.featured,
      updatedAt: Date.now(),
    });
    return !prompt.featured;
  },
});

// ---------------------------------------------------------------------------
// Academic Team — Course Review Actions
// ---------------------------------------------------------------------------

export const requestCourseRevision = mutation({
  args: {
    courseId: v.id("courses"),
    feedback: v.string(),
    section: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["academic"]);
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found");
    const now = Date.now();

    // Update course status
    await ctx.db.patch(args.courseId, {
      status: "rejected",
      reviewNote: args.feedback,
    });

    // Notify tutor
    await createNotification(ctx, {
      userId: course.tutorId,
      title: `Revision requested: ${course.title}`,
      body: args.feedback.slice(0, 200),
      type: "course_review",
      link: "/tutor/courses",
    });

    await logActivity(ctx, {
      userId: user._id,
      action: "requested_revision",
      targetType: "course",
      targetId: args.courseId,
      targetLabel: course.title,
      details: args.section ? `Section: ${args.section}` : undefined,
    });

    return true;
  },
});

export const approveCourse = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["academic"]);
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found");

    await ctx.db.patch(args.courseId, {
      status: "approved",
      published: true,
      reviewNote: undefined,
    });

    await createNotification(ctx, {
      userId: course.tutorId,
      title: `Course approved: ${course.title}`,
      body: "Your course has been approved and is now live.",
      type: "course_review",
      link: "/tutor/courses",
    });

    await logActivity(ctx, {
      userId: user._id,
      action: "approved_course",
      targetType: "course",
      targetId: args.courseId,
      targetLabel: course.title,
    });

    return true;
  },
});

export const escalateToAdmin = mutation({
  args: {
    targetType: v.string(),
    targetId: v.string(),
    targetLabel: v.optional(v.string()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const now = Date.now();

    // Find or create a team for escalations
    const adminTeam = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", "admin"))
      .first();

    await ctx.db.insert("teamEscalations", {
      teamId: adminTeam?._id as any,
      userId: user._id,
      targetType: args.targetType,
      targetId: args.targetId,
      targetLabel: args.targetLabel,
      escalateTo: "admin",
      reason: args.reason,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Notify all admins
    const admins = await ctx.db.query("users").collect();
    for (const a of admins) {
      if (a.role === "admin") {
        await createNotification(ctx, {
          userId: a._id,
          title: `Escalation: ${args.targetLabel || args.targetType}`,
          body: `${user.name || "Team member"} escalated: ${args.reason.slice(0, 150)}`,
          type: "escalation",
          link: "/admin",
        });
      }
    }

    await logActivity(ctx, {
      userId: user._id,
      action: "escalated_to_admin",
      targetType: args.targetType,
      targetId: args.targetId,
      targetLabel: args.targetLabel,
      details: args.reason,
    });

    return true;
  },
});

// ---------------------------------------------------------------------------
// Support Team — Ticket Actions
// ---------------------------------------------------------------------------

export const claimSupportCase = mutation({
  args: { caseId: v.id("studentSupportCases") },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["student-support"]);
    await ctx.db.patch(args.caseId, {
      assignedTo: user._id,
      status: "in_progress",
      updatedAt: Date.now(),
    });
    const doc = await ctx.db.get(args.caseId);
    await logActivity(ctx, {
      userId: user._id,
      action: "claimed_case",
      targetType: "student_support",
      targetId: args.caseId,
      targetLabel: doc?.caseNumber,
    });
    return true;
  },
});

export const replyToStudentCase = mutation({
  args: {
    caseId: v.id("studentSupportCases"),
    body: v.string(),
    isInternal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["student-support"]);
    const doc = await ctx.db.get(args.caseId);
    if (!doc) throw new Error("Case not found");
    const now = Date.now();

    // Create conversation if not exists
    const convKey = `student_support:${args.caseId}`;
    let conv = await ctx.db
      .query("teamConversations")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "student_support").eq("entityId", args.caseId)
      )
      .first();

    if (!conv) {
      const convId = await ctx.db.insert("teamConversations", {
        entityType: "student_support",
        entityId: args.caseId,
        subject: `Support: ${doc.subject}`,
        status: "open",
        lastMessageAt: now,
        createdAt: now,
      });
      conv = await ctx.db.get(convId);
    }

    if (conv) {
      await ctx.db.insert("teamConversationMessages", {
        conversationId: conv._id,
        senderId: user._id,
        senderRole: user.teamRole || "support",
        body: args.body.trim().slice(0, 5000),
        isInternal: args.isInternal || false,
        createdAt: now,
      });
      await ctx.db.patch(conv._id, { lastMessageAt: now });
    }

    // Notify student (non-internal only)
    if (!args.isInternal) {
      await createNotification(ctx, {
        userId: doc.studentId,
        title: `Reply to your support case ${doc.caseNumber}`,
        body: args.body.slice(0, 150),
        type: "student_support",
        link: "/dashboard",
      });
    }

    await logActivity(ctx, {
      userId: user._id,
      action: args.isInternal ? "added_internal_note" : "replied_to_case",
      targetType: "student_support",
      targetId: args.caseId,
      targetLabel: doc.caseNumber,
    });

    return true;
  },
});

export const escalateStudentCase = mutation({
  args: {
    caseId: v.id("studentSupportCases"),
    escalateTo: v.union(v.literal("admin"), v.literal("academic")),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["student-support"]);
    const doc = await ctx.db.get(args.caseId);
    if (!doc) throw new Error("Case not found");

    await ctx.db.patch(args.caseId, {
      status: "escalated",
      escalatedTo: args.escalateTo,
      escalationNote: args.note,
      updatedAt: Date.now(),
    });

    // Notify target team
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      if (args.escalateTo === "academic" && u.teamRole === "academic") {
        await createNotification(ctx, {
          userId: u._id,
          title: `Escalated: ${doc.caseNumber}`,
          body: args.note.slice(0, 150),
          type: "escalation",
          link: "/team/academic",
        });
      }
      if (args.escalateTo === "admin" && u.role === "admin") {
        await createNotification(ctx, {
          userId: u._id,
          title: `Escalated: ${doc.caseNumber}`,
          body: args.note.slice(0, 150),
          type: "escalation",
          link: "/admin",
        });
      }
    }

    await logActivity(ctx, {
      userId: user._id,
      action: `escalated_to_${args.escalateTo}`,
      targetType: "student_support",
      targetId: args.caseId,
      targetLabel: doc.caseNumber,
    });

    return true;
  },
});

// ---------------------------------------------------------------------------
// List all AI tools (for AI Support team)
// ---------------------------------------------------------------------------

export const listAllAiTools = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireTeamRole(ctx, ["ai-support"]);
    return await ctx.db.query("aiResources").order("desc").take(100);
  },
});

export const listAllPrompts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireTeamRole(ctx, ["ai-support"]);
    return await ctx.db.query("prompts").order("desc").take(100);
  },
});

export const listPromptCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("promptCategories").collect();
  },
});

// ---------------------------------------------------------------------------
// Tutor Support — List tutor support cases + reply
// ---------------------------------------------------------------------------

export const listTutorSupportCases = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireTeamRole(ctx, ["tutor-support", "admin"]);
    const cases = await ctx.db.query("tutorSupportMessages").order("desc").take(100);
    const enriched = [];
    for (const c of cases) {
      const tutor = await ctx.db.get(c.tutorId);
      enriched.push({ ...c, tutor });
    }
    return enriched;
  },
});

export const replyToTutorSupportCase = mutation({
  args: {
    caseId: v.id("tutorSupportMessages"),
    body: v.string(),
    isInternal: v.optional(v.boolean()),
    status: v.optional(v.union(v.literal("open"), v.literal("responded"), v.literal("resolved"))),
  },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["tutor-support", "admin"]);
    const doc = await ctx.db.get(args.caseId);
    if (!doc) throw new Error("Support case not found");
    const now = Date.now();

    // Find or create a conversation for this case
    let conv = await ctx.db
      .query("teamConversations")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "tutor_support").eq("entityId", args.caseId)
      )
      .first();

    if (!conv) {
      const convId = await ctx.db.insert("teamConversations", {
        entityType: "tutor_support",
        entityId: args.caseId,
        subject: `Tutor Support: ${doc.subject}`,
        status: "open",
        lastMessageAt: now,
        createdAt: now,
      });
      conv = await ctx.db.get(convId);
      // Add tutor as participant
      if (conv) {
        await ctx.db.insert("teamConversationParticipants", {
          conversationId: conv._id,
          userId: doc.tutorId,
          role: "tutor",
          joinedAt: now,
        });
        await ctx.db.insert("teamConversationParticipants", {
          conversationId: conv._id,
          userId: user._id,
          role: "team",
          joinedAt: now,
        });
      }
    }

    if (conv) {
      await ctx.db.insert("teamConversationMessages", {
        conversationId: conv._id,
        senderId: user._id,
        senderRole: user.teamRole || "support",
        body: args.body.trim().slice(0, 5000),
        isInternal: args.isInternal || false,
        createdAt: now,
      });
      await ctx.db.patch(conv._id, { lastMessageAt: now });
    }

    // Update the tutorSupportMessages doc
    const patch: Record<string, any> = { updatedAt: now };
    if (args.status) {
      patch.status = args.status;
      patch.adminNote = args.body.trim().slice(0, 5000);
      patch.adminNoteAt = now;
    } else {
      patch.status = "responded";
      patch.adminNote = args.body.trim().slice(0, 5000);
      patch.adminNoteAt = now;
    }
    await ctx.db.patch(args.caseId, patch);

    // Notify tutor
    await createNotification(ctx, {
      userId: doc.tutorId,
      title: `Update on: ${doc.subject}`,
      body: args.body.trim().slice(0, 150),
      type: "support",
      link: "/tutor/support",
    });

    await logActivity(ctx, {
      userId: user._id,
      action: args.isInternal ? "added_internal_note" : "replied_to_tutor_case",
      targetType: "tutor_support",
      targetId: args.caseId,
      targetLabel: doc.subject,
    });

    return true;
  },
});

// ---------------------------------------------------------------------------
// Academic Team — List courses for review
// ---------------------------------------------------------------------------

export const listCoursesForReview = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireTeamRole(ctx, ["academic", "admin"]);
    let q = ctx.db.query("courses").order("desc");
    const all = await q.take(100);
    if (args.status) {
      return all.filter((c) => c.status === args.status);
    }
    return all;
  },
});

// ---------------------------------------------------------------------------
// List all users (for team messaging contact directory)
// ---------------------------------------------------------------------------

export const listTeamDirectory = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => !u.isSeed && u._id !== user._id)
      .map((u) => ({
        _id: u._id,
        name: u.name || nameFromEmail(u.email) || "Member",
        email: u.email ?? "",
        role: u.role ?? "student",
        teamRole: u.teamRole ?? null,
      }));
  },
});

// ---------------------------------------------------------------------------
// List admin users (for team members to message admin directly)
// ---------------------------------------------------------------------------

export const listAdminUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => !u.isSeed && u.role === "admin")
      .map((u) => ({
        _id: u._id,
        name: u.name ?? "Admin",
        email: u.email ?? "",
        role: u.role ?? "admin",
        teamRole: u.teamRole ?? null,
      }));
  },
});

// ---------------------------------------------------------------------------
// Team member: get my conversations (unified for both admin and team)
// ---------------------------------------------------------------------------

export const myConversations = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    // Get conversations the user participates in
    const participations = await ctx.db
      .query("teamConversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const ids = participations.map((p) => p.conversationId);
    const convs = [] as any[];
    for (const id of ids) {
      const c = await ctx.db.get(id);
      if (!c) continue;
      // Get last message
      const lastMsgs = await ctx.db
        .query("teamConversationMessages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", id))
        .order("desc")
        .take(1);
      const lastMsg = lastMsgs[0];
      let lastSenderName = "";
      if (lastMsg) {
        const sender = await ctx.db.get(lastMsg.senderId) as any;
        lastSenderName = sender?.name ?? "Unknown";
      }
      // Get other participants' names for display
      const otherParts = await ctx.db
        .query("teamConversationParticipants")
        .withIndex("by_conversation", (q) => q.eq("conversationId", id))
        .collect();
      const otherNames = [] as string[];
      for (const op of otherParts) {
        if (op.userId !== user._id) {
          const ou = await ctx.db.get(op.userId) as any;
          otherNames.push(ou?.name ?? "Unknown");
        }
      }
      convs.push({
        ...c,
        lastSenderName,
        lastMessageBody: lastMsg?.body ?? "",
        otherParticipantNames: otherNames,
      });
    }
    convs.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return convs;
  },
});

// ---------------------------------------------------------------------------
// Admin: All Support Cases (Student + Tutor)
// ---------------------------------------------------------------------------

export const adminAllSupportCases = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const isAdmin = user.role === "admin";
    if (!isAdmin && !user.teamRole) throw new Error("Not authorized");

    // Student support cases
    const studentCasesRaw = await ctx.db.query("studentSupportCases").order("desc").take(200);
    const studentCases = [] as any[];
    for (const sc of studentCasesRaw) {
      const reporter = await ctx.db.get(sc.studentId);
      const rName = reporter && "name" in reporter ? (reporter as any).name : undefined;
      const rEmail = reporter && "email" in reporter ? (reporter as any).email : undefined;
      studentCases.push({
        ...sc,
        type: "student" as const,
        reporterName: rName ?? "Unknown",
        reporterEmail: rEmail ?? "",
      });
    }

    // Tutor support cases
    const tutorCasesRaw = await ctx.db.query("tutorSupportMessages").order("desc").take(200);
    const tutorCases = [] as any[];
    for (const tc of tutorCasesRaw) {
      const tutor = await ctx.db.get(tc.tutorId as any);
      const tName = tutor && "name" in tutor ? (tutor as any).name : undefined;
      const tEmail = tutor && "email" in tutor ? (tutor as any).email : undefined;
      tutorCases.push({
        ...tc,
        type: "tutor" as const,
        reporterName: tName ?? "Unknown",
        reporterEmail: tEmail ?? "",
      });
    }

    // Merge and sort by date
    const all = [...studentCases, ...tutorCases].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
    return all;
  },
});

// ---------------------------------------------------------------------------
// Admin: Send direct message to any user
// ---------------------------------------------------------------------------

export const adminSendDirectMessage = mutation({
  args: {
    recipientId: v.id("users"),
    body: v.string(),
    subject: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const isAdmin = user.role === "admin" || user.teamRole;
    if (!isAdmin) throw new Error("Not authorized");

    const recipient = await ctx.db.get(args.recipientId) as any;
    if (!recipient) throw new Error("Recipient not found");

    const now = Date.now();
    const subject = args.subject || `Message from ${user.name || "Admin"}`;

    // Check for existing direct conversation between these two users
    const myParticipations = await ctx.db
      .query("teamConversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let convId = null;
    for (const p of myParticipations) {
      const otherPart = await ctx.db
        .query("teamConversationParticipants")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", p.conversationId)
        )
        .collect();
      const hasRecipient = otherPart.some((op) => op.userId === args.recipientId);
      if (hasRecipient && otherPart.length === 2) {
        convId = p.conversationId;
        break;
      }
    }

    if (!convId) {
      convId = await ctx.db.insert("teamConversations", {
        entityType: "direct",
        entityId: `dm-${user._id}-${args.recipientId}`,
        subject,
        status: "open",
        lastMessageAt: now,
        createdAt: now,
      });
      await ctx.db.insert("teamConversationParticipants", {
        conversationId: convId,
        userId: user._id,
        role: "member",
        joinedAt: now,
      });
      await ctx.db.insert("teamConversationParticipants", {
        conversationId: convId,
        userId: args.recipientId,
        role: "member",
        joinedAt: now,
      });
    }

    // Send message
    await ctx.db.insert("teamConversationMessages", {
      conversationId: convId,
      senderId: user._id,
      senderRole: user.role === "admin" ? "admin" : (user.teamRole || "team"),
      body: args.body.trim().slice(0, 5000),
      isInternal: false,
      createdAt: now,
    });
    await ctx.db.patch(convId, { lastMessageAt: now });

    // Notify recipient
    await createNotification(ctx, {
      userId: args.recipientId as string,
      title: `New message from ${user.name || "Admin"}`,
      body: args.body.slice(0, 80),
      type: "message",
      link: "/team",
    });

    return convId;
  },
});

// ---------------------------------------------------------------------------
// Get conversation with resolved participant names
// ---------------------------------------------------------------------------

export const getConversationParticipants = query({
  args: { conversationId: v.id("teamConversations") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const parts = await ctx.db
      .query("teamConversationParticipants")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();
    const result = [] as any[];
    for (const p of parts) {
      const u = await ctx.db.get(p.userId) as any;
      result.push({
        userId: p.userId,
        name: u?.name ?? "Unknown",
        email: u?.email ?? "",
        role: u?.role ?? "student",
        teamRole: u?.teamRole ?? null,
      });
    }
    return result;
  },
});

// ---------------------------------------------------------------------------
// Get messages with resolved sender names
// ---------------------------------------------------------------------------

export const getConversationMessagesDetailed = query({
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

    // Filter internal notes for non-staff users
    const filtered = messages.filter((m) => {
      if (m.isInternal && user.role !== "admin" && !user.teamRole) return false;
      return true;
    });

    // Resolve sender names
    const detailed = [] as any[];
    for (const m of filtered) {
      const sender = await ctx.db.get(m.senderId) as any;
      detailed.push({
        ...m,
        senderName: sender?.name ?? "Unknown",
        senderEmail: sender?.email ?? "",
        senderRoleLabel: sender?.role === "admin" ? "Admin" : sender?.teamRole ? sender.teamRole.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : sender?.role ?? "Member",
      });
    }
    return detailed;
  },
});

// ---------------------------------------------------------------------------
// Admin: List all conversations
// ---------------------------------------------------------------------------

export const adminListAllConversations = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const isAdmin = user.role === "admin" || user.teamRole;
    if (!isAdmin) throw new Error("Not authorized");

    // Get conversations the user participates in
    const participations = await ctx.db
      .query("teamConversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const ids = participations.map((p) => p.conversationId);
    const convs = [] as any[];
    for (const id of ids) {
      const c = await ctx.db.get(id);
      if (!c) continue;
      // Get last message
      const lastMsgs = await ctx.db
        .query("teamConversationMessages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", id))
        .order("desc")
        .take(1);
      const lastMsg = lastMsgs[0];
      let lastSenderName = "";
      if (lastMsg) {
        const sender = await ctx.db.get(lastMsg.senderId) as any;
        lastSenderName = sender?.name ?? "Unknown";
      }
      convs.push({
        ...c,
        lastSenderName,
        lastMessageBody: lastMsg?.body ?? "",
      });
    }
    convs.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return convs;
  },
});

// ---------------------------------------------------------------------------
// Course Preview: full detail for Academic team review
// ---------------------------------------------------------------------------

export const getCoursePreview = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found");

    // Get tutor info
    const tutor = await ctx.db.get(course.tutorId) as any;
    const category = await ctx.db.get(course.categoryId) as any;

    // Get lessons
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .order("asc")
      .collect();

    // Get quizzes
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    // Get lesson quizzes
    const lessonQuizzes = await ctx.db
      .query("lessonQuizzes")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    return {
      course,
      tutorName: tutor?.name ?? "Unknown",
      tutorEmail: tutor?.email ?? "",
      categoryName: category?.name ?? "Unknown",
      lessons: lessons.map((l) => ({
        _id: l._id,
        title: l.title,
        order: l.order,
        durationMinutes: l.durationMinutes,
        videoUrl: l.videoUrl,
        videoType: l.videoType,
        muxPlaybackId: l.muxPlaybackId,
        videoStorageId: l.videoStorageId,
        notes: l.notes,
        transcript: l.transcript,
        resources: l.resources,
      })),
      quizzes: quizzes.map((q) => ({
        _id: q._id,
        title: q.title,
        description: q.description,
        timeLimitMinutes: q.timeLimitMinutes,
        questionCount: q.questions.length,
        questions: q.questions,
      })),
      lessonQuizzes: lessonQuizzes.map((lq) => ({
        _id: lq._id,
        lessonId: lq.lessonId,
        title: lq.title,
        passPercent: lq.passPercent,
        questionCount: lq.questions.length,
        questions: lq.questions,
        published: lq.published,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Team-scoped stats for Overview panels
// ---------------------------------------------------------------------------

export const getTeamScopedStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const role = user.teamRole;
    const isAdmin = user.role === "admin";

    if (isAdmin || role === "academic") {
      const courses = await ctx.db.query("courses").collect();
      return {
        type: "academic" as const,
        totalCourses: courses.length,
        awaitingReview: courses.filter((c) => !c.status || c.status === "pending" || c.status === "draft").length,
        approved: courses.filter((c) => c.status === "approved").length,
        rejected: courses.filter((c) => c.status === "rejected").length,
      };
    }
    if (role === "tutor-support") {
      const tutorCases = await ctx.db.query("tutorSupportMessages").collect();
      return {
        type: "tutor-support" as const,
        totalCases: tutorCases.length,
        open: tutorCases.filter((c) => c.status === "open").length,
        responded: tutorCases.filter((c) => c.status === "responded").length,
        resolved: tutorCases.filter((c) => c.status === "resolved").length,
      };
    }
    if (role === "student-support") {
      const studentCases = await ctx.db.query("studentSupportCases").collect();
      return {
        type: "student-support" as const,
        totalCases: studentCases.length,
        open: studentCases.filter((c) => c.status === "open").length,
        inProgress: studentCases.filter((c) => c.status === "in_progress").length,
        escalated: studentCases.filter((c) => c.status === "escalated").length,
        resolved: studentCases.filter((c) => c.status === "resolved").length,
      };
    }
    if (role === "ai-support") {
      const tools = await ctx.db.query("aiResources").collect();
      const prompts = await ctx.db.query("prompts").collect();
      return {
        type: "ai-support" as const,
        totalTools: tools.length,
        publishedTools: tools.filter((t) => t.published).length,
        totalPrompts: prompts.length,
        publishedPrompts: prompts.filter((p) => p.published).length,
      };
    }
    if (role === "content") {
      const content = await ctx.db.query("siteContent").collect();
      return {
        type: "content" as const,
        totalContent: content.length,
        published: content.filter((c: any) => c.published).length,
      };
    }
    // Default fallback
    return { type: "default" as const };
  },
});
