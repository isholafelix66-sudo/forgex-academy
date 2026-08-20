import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ---------------------------------------------------------------------------
// Helpers (imported from team.ts pattern)
// ---------------------------------------------------------------------------

async function requireUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated.");
  const user = await ctx.db.get(identity.subject as any);
  if (!user) throw new Error("User not found.");
  return user;
}

async function requireTeamAccess(ctx: any, teamId: string) {
  const user = await requireUser(ctx);
  if (user.role === "admin") return { user, membership: null as any };
  if (!user.teamMemberId) throw new Error("You are not a team member.");
  const membership = await ctx.db.get(user.teamMemberId);
  if (!membership || membership.status !== "active") {
    throw new Error("Your team access is not active.");
  }
  if (membership.teamId !== teamId) {
    throw new Error("You do not have access to this team.");
  }
  return { user, membership };
}

async function logActivity(
  ctx: any,
  userId: any,
  teamId: any,
  action: string,
  targetType: string,
  targetId: string,
  targetLabel?: string,
  details?: string,
) {
  await ctx.db.insert("teamActivity", {
    userId,
    teamId,
    action,
    targetType,
    targetId,
    targetLabel,
    details,
    createdAt: Date.now(),
  });
}

// ===========================================================================
// CASE NOTES (all teams)
// ===========================================================================

export const addCaseNote = mutation({
  args: {
    teamId: v.id("teams"),
    targetType: v.string(),
    targetId: v.string(),
    targetLabel: v.optional(v.string()),
    content: v.string(),
    isPrivate: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireTeamAccess(ctx, args.teamId);
    const now = Date.now();
    const id = await ctx.db.insert("teamCaseNotes", {
      teamId: args.teamId,
      userId: user._id,
      targetType: args.targetType,
      targetId: args.targetId,
      targetLabel: args.targetLabel,
      content: args.content,
      isPrivate: args.isPrivate,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, user._id, args.teamId, "added_note", args.targetType, args.targetId, args.targetLabel);
    return id;
  },
});

export const getCaseNotes = query({
  args: {
    teamId: v.id("teams"),
    targetType: v.string(),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    const notes = await ctx.db
      .query("teamCaseNotes")
      .withIndex("by_target", (q) => q.eq("targetType", args.targetType).eq("targetId", args.targetId))
      .collect();
    const enriched = [];
    for (const n of notes) {
      const u = n.userId ? await ctx.db.get(n.userId) : null;
      enriched.push({ ...n, user: u });
    }
    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ===========================================================================
// ACADEMIC TEAM — Tutor Verification
// ===========================================================================

export const listPendingTutorApplications = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    const apps = await ctx.db
      .query("tutorApplications")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect();
    const enriched = [];
    for (const app of apps) {
      const user = await ctx.db.get(app.userId);
      const existingReview = await ctx.db
        .query("teamTutorReviews")
        .withIndex("by_application", (q) => q.eq("applicationId", app._id))
        .filter((q) => q.eq(q.field("teamId"), args.teamId))
        .first();
      enriched.push({ ...app, user, review: existingReview });
    }
    return enriched;
  },
});

export const listAllTutorApplications = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    const apps = await ctx.db.query("tutorApplications").collect();
    const enriched = [];
    for (const app of apps) {
      const user = await ctx.db.get(app.userId);
      const review = await ctx.db
        .query("teamTutorReviews")
        .withIndex("by_application", (q) => q.eq("applicationId", app._id))
        .filter((q) => q.eq(q.field("teamId"), args.teamId))
        .first();
      enriched.push({ ...app, user, review });
    }
    return enriched.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
  },
});

export const reviewTutorApplication = mutation({
  args: {
    teamId: v.id("teams"),
    applicationId: v.id("tutorApplications"),
    status: v.union(
      v.literal("reviewing"),
      v.literal("approved"),
      v.literal("revision_required"),
      v.literal("rejected"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireTeamAccess(ctx, args.teamId);
    const now = Date.now();
    const existing = await ctx.db
      .query("teamTutorReviews")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .filter((q) => q.eq(q.field("teamId"), args.teamId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        note: args.note,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("teamTutorReviews", {
        applicationId: args.applicationId,
        teamId: args.teamId,
        userId: user._id,
        status: args.status,
        note: args.note,
        createdAt: now,
        updatedAt: now,
      });
    }
    await logActivity(ctx, user._id, args.teamId, `tutor_review_${args.status}`, "tutorApplication", args.applicationId, args.status);
    return true;
  },
});

export const getTutorReviewHistory = query({
  args: { applicationId: v.id("tutorApplications") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("teamTutorReviews")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .collect();
    const enriched = [];
    for (const r of reviews) {
      const u = r.userId ? await ctx.db.get(r.userId) : null;
      const team = r.teamId ? await ctx.db.get(r.teamId) : null;
      enriched.push({ ...r, user: u, team });
    }
    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ===========================================================================
// ACADEMIC TEAM — Course Reviews
// ===========================================================================

export const listTutorCourses = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    const courses = await ctx.db.query("courses").collect();
    const enriched = [];
    for (const c of courses) {
      const tutor = await ctx.db.get(c.tutorId);
      const reviews = await ctx.db
        .query("teamReviews")
        .withIndex("by_course", (q) => q.eq("courseId", c._id))
        .filter((q) => q.eq(q.field("teamId"), args.teamId))
        .collect();
      enriched.push({ ...c, tutor, teamReviews: reviews });
    }
    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getCourseLessonsForReview = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    return lessons.sort((a, b) => a.order - b.order);
  },
});

export const getCourseQuizzesForReview = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("quizzes")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
  },
});

// ===========================================================================
// CONTENT TEAM — Submissions
// ===========================================================================

export const listContentSubmissions = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    const subs = await ctx.db
      .query("teamContentSubmissions")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .collect();
    const enriched = [];
    for (const s of subs) {
      const u = s.userId ? await ctx.db.get(s.userId) : null;
      enriched.push({ ...s, user: u });
    }
    return enriched;
  },
});

export const createContentSubmission = mutation({
  args: {
    teamId: v.id("teams"),
    type: v.union(v.literal("testimonial"), v.literal("resource"), v.literal("content-edit")),
    title: v.string(),
    description: v.string(),
    content: v.string(),
    targetId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireTeamAccess(ctx, args.teamId);
    const now = Date.now();
    const id = await ctx.db.insert("teamContentSubmissions", {
      teamId: args.teamId,
      userId: user._id,
      type: args.type,
      title: args.title,
      description: args.description,
      content: args.content,
      targetId: args.targetId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, user._id, args.teamId, "created_submission", "contentSubmission", id, args.title);
    return id;
  },
});

// ===========================================================================
// AI TEAM — Tool Drafts
// ===========================================================================

export const listAiToolDrafts = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    const drafts = await ctx.db
      .query("teamAiToolDrafts")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .collect();
    const enriched = [];
    for (const d of drafts) {
      const u = d.userId ? await ctx.db.get(d.userId) : null;
      enriched.push({ ...d, user: u });
    }
    return enriched;
  },
});

export const createAiToolDraft = mutation({
  args: {
    teamId: v.id("teams"),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    url: v.string(),
    pricingType: v.union(v.literal("free"), v.literal("freemium"), v.literal("paid")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireTeamAccess(ctx, args.teamId);
    const now = Date.now();
    const id = await ctx.db.insert("teamAiToolDrafts", {
      teamId: args.teamId,
      userId: user._id,
      title: args.title,
      description: args.description,
      category: args.category,
      url: args.url,
      pricingType: args.pricingType,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, user._id, args.teamId, "created_ai_tool", "aiToolDraft", id, args.title);
    return id;
  },
});

export const updateAiToolDraft = mutation({
  args: {
    draftId: v.id("teamAiToolDrafts"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    url: v.optional(v.string()),
    pricingType: v.optional(v.union(v.literal("free"), v.literal("freemium"), v.literal("paid"))),
    status: v.optional(v.union(v.literal("draft"), v.literal("submitted"))),
  },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found.");
    await requireTeamAccess(ctx, draft.teamId);
    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;
    if (args.category !== undefined) patch.category = args.category;
    if (args.url !== undefined) patch.url = args.url;
    if (args.pricingType !== undefined) patch.pricingType = args.pricingType;
    if (args.status !== undefined) patch.status = args.status;
    await ctx.db.patch(args.draftId, patch);
    return true;
  },
});

// ===========================================================================
// AI TEAM — Prompt Drafts
// ===========================================================================

export const listPromptDrafts = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    const drafts = await ctx.db
      .query("teamPromptDrafts")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .collect();
    const enriched = [];
    for (const d of drafts) {
      const u = d.userId ? await ctx.db.get(d.userId) : null;
      enriched.push({ ...d, user: u });
    }
    return enriched;
  },
});

export const createPromptDraft = mutation({
  args: {
    teamId: v.id("teams"),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    template: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireTeamAccess(ctx, args.teamId);
    const now = Date.now();
    const id = await ctx.db.insert("teamPromptDrafts", {
      teamId: args.teamId,
      userId: user._id,
      title: args.title,
      description: args.description,
      category: args.category,
      template: args.template,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, user._id, args.teamId, "created_prompt_draft", "promptDraft", id, args.title);
    return id;
  },
});

// ===========================================================================
// STUDENT EXPERIENCE TEAM — Support Tickets
// ===========================================================================

export const listSupportTickets = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    const cases = await ctx.db
      .query("teamSupportCases")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .collect();
    const enriched = [];
    for (const c of cases) {
      const msg = await ctx.db.get(c.supportMessageId);
      const tutor = msg ? await ctx.db.get(msg.tutorId) : null;
      const assignee = c.assignedTo ? await ctx.db.get(c.assignedTo) : null;
      enriched.push({ ...c, message: msg, tutor, assignee });
    }
    return enriched;
  },
});

export const listUnassignedSupportTickets = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    const cases = await ctx.db
      .query("teamSupportCases")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .collect();
    const unassigned = [];
    for (const c of cases) {
      if (!c.assignedTo && (c.status === "open" || c.status === "in_progress")) {
        const msg = await ctx.db.get(c.supportMessageId);
        const tutor = msg ? await ctx.db.get(msg.tutorId) : null;
        unassigned.push({ ...c, message: msg, tutor });
      }
    }
    return unassigned;
  },
});

export const claimSupportCase = mutation({
  args: {
    caseId: v.id("teamSupportCases"),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.caseId);
    if (!c) throw new Error("Case not found.");
    const { user } = await requireTeamAccess(ctx, c.teamId);
    const now = Date.now();
    await ctx.db.patch(args.caseId, {
      assignedTo: user._id,
      status: "in_progress",
      updatedAt: now,
    });
    await ctx.db.insert("teamCaseHistory", {
      caseId: args.caseId,
      userId: user._id,
      action: "claimed",
      details: `${user.name ?? "Member"} claimed this case`,
      createdAt: now,
    });
    await logActivity(ctx, user._id, c.teamId, "claimed_case", "supportCase", args.caseId, undefined, "Claimed support case");
    return true;
  },
});

export const resolveSupportCase = mutation({
  args: {
    caseId: v.id("teamSupportCases"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.caseId);
    if (!c) throw new Error("Case not found.");
    const { user } = await requireTeamAccess(ctx, c.teamId);
    const now = Date.now();
    await ctx.db.patch(args.caseId, {
      status: "resolved",
      updatedAt: now,
    });
    await ctx.db.insert("teamCaseHistory", {
      caseId: args.caseId,
      userId: user._id,
      action: "resolved",
      details: args.note ?? "Case resolved",
      createdAt: now,
    });
    // Also update the original tutor support message
    const msg = await ctx.db.get(c.supportMessageId);
    if (msg) {
      await ctx.db.patch(c.supportMessageId, {
        status: "resolved",
        adminNote: args.note ?? "Resolved by team",
        adminNoteAt: now,
        updatedAt: now,
      });
    }
    await logActivity(ctx, user._id, c.teamId, "resolved_case", "supportCase", args.caseId);
    return true;
  },
});

// ===========================================================================
// ESCALATIONS (all teams)
// ===========================================================================

export const createEscalation = mutation({
  args: {
    teamId: v.id("teams"),
    targetType: v.string(),
    targetId: v.string(),
    targetLabel: v.optional(v.string()),
    escalateTo: v.union(v.literal("admin"), v.literal("team")),
    escalateToTeamId: v.optional(v.id("teams")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireTeamAccess(ctx, args.teamId);
    const now = Date.now();
    const id = await ctx.db.insert("teamEscalations", {
      teamId: args.teamId,
      userId: user._id,
      targetType: args.targetType,
      targetId: args.targetId,
      targetLabel: args.targetLabel,
      escalateTo: args.escalateTo,
      escalateToTeamId: args.escalateToTeamId,
      reason: args.reason,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, user._id, args.teamId, `escalated_to_${args.escalateTo}`, args.targetType, args.targetId, args.targetLabel, args.reason);
    return id;
  },
});

export const listEscalations = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    const esc = await ctx.db
      .query("teamEscalations")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .collect();
    const enriched = [];
    for (const e of esc) {
      const u = e.userId ? await ctx.db.get(e.userId) : null;
      enriched.push({ ...e, user: u });
    }
    return enriched;
  },
});

// ===========================================================================
// TUTOR SUPPORT TEAM — Case management
// ===========================================================================

/** Import tutor support messages for the Tutor Support Team. */
export const importTutorSupportMessages = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const { user } = await requireTeamAccess(ctx, args.teamId);
    const now = Date.now();
    const msgs = await ctx.db.query("tutorSupportMessages").collect();
    let imported = 0;
    for (const msg of msgs) {
      const existing = await ctx.db
        .query("teamSupportCases")
        .withIndex("by_support", (q) => q.eq("supportMessageId", msg._id))
        .first();
      if (!existing) {
        await ctx.db.insert("teamSupportCases", {
          teamId: args.teamId,
          supportMessageId: msg._id,
          status: "open",
          createdAt: now,
          updatedAt: now,
        });
        imported++;
      }
    }
    if (imported > 0) {
      await logActivity(ctx, user._id, args.teamId, "imported_support_messages", "supportCase", "bulk", undefined, `Imported ${imported} support messages`);
    }
    return imported;
  },
});

/** List all tutor profiles for the Tutor Support Team. */
export const listTutorProfiles = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    const users = await ctx.db.query("users").collect();
    const tutors = users.filter((u: any) => u.role === "tutor");
    const enriched = [];
    for (const t of tutors) {
      const apps = await ctx.db
        .query("tutorApplications")
        .withIndex("by_user", (q) => q.eq("userId", t._id))
        .collect();
      const latestApp = apps.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))[0];
      const courses = (await ctx.db.query("courses").collect()).filter(
        (c) => c.tutorId === t._id,
      );
      enriched.push({
        ...t,
        application: latestApp ?? null,
        courseCount: courses.length,
        publishedCourses: courses.filter((c) => c.published).length,
      });
    }
    return enriched;
  },
});
