import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ---------------------------------------------------------------------------
// Helper: validate a team session token
// ---------------------------------------------------------------------------

async function requireTeamToken(
  ctx: any,
  token: string,
): Promise<{ account: any; membership: any; team: any; teamId: any }> {
  // 1) Check the new Team Hub sessions (teamAccessSessions)
  const hubSession = await ctx.db
    .query("teamAccessSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .unique();
  if (hubSession) {
    if (hubSession.expiresAt < Date.now()) {
      await ctx.db.delete(hubSession._id);
      throw new Error("Session expired.");
    }
    const access = await ctx.db
      .query("teamAccess")
      .withIndex("by_slug", (q: any) => q.eq("teamSlug", hubSession.teamSlug))
      .unique();
    if (!access || !access.isActive) throw new Error("Team is not active.");
    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q: any) => q.eq("slug", hubSession.teamSlug))
      .unique();
    if (!team) throw new Error("Team not found.");
    const account = {
      _id: access._id,
      teamId: access.teamSlug,
      name: access.teamName,
      email: `${access.teamSlug}@forgex.team`,
      role: "teamMember" as const,
      teamSlug: hubSession.teamSlug,
      status: "active" as const,
    };
    return { account, membership: null, team, teamId: team._id };
  }

  // 2) Fallback: check the legacy per-user sessions (teamSessions)
  const session = await ctx.db
    .query("teamSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .unique();
  if (!session) throw new Error("Not authenticated as a team member.");
  if (session.expiresAt < Date.now()) {
    await ctx.db.delete(session._id);
    throw new Error("Session expired.");
  }
  const account = await ctx.db.get(session.teamAccountId);
  if (!account || account.status !== "active")
    throw new Error("Account not active.");

  const membership = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team_account", (q: any) =>
      q.eq("teamAccountId", account._id),
    )
    .unique();
  if (!membership) throw new Error("You are not assigned to a team.");

  const team = await ctx.db.get(membership.teamId);
  return { account, membership, team, teamId: membership.teamId };
}

/** Extract the resolved team ID from a token result. Works for both Hub
 *  sessions (membership is null, team has the id) and legacy sessions. */
function getTeamId(result: { membership: any; team: any; teamId?: any }): any {
  if (result.teamId) return result.teamId;
  if (result.membership?.teamId) return result.membership.teamId;
  if (result.team?._id) return result.team._id;
  return null;
}

// ===========================================================================
// Academic Team — Tutor Applications
// ===========================================================================

export const listPendingTutorApplications = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenResult = await requireTeamToken(ctx, args.token);
    const tid = getTeamId(tokenResult);
    const apps = await ctx.db
      .query("tutorApplications")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect();
    const enriched = [];
    for (const app of apps) {
      let user = null;
      try { user = await ctx.db.get(app.userId); } catch { /* ignore */ }
      const existingReview = await ctx.db
        .query("teamTutorReviews")
        .withIndex("by_application", (q) => q.eq("applicationId", app._id))
        .filter((q) => q.eq(q.field("teamId"), tid))
        .first();
      enriched.push({ ...app, user, review: existingReview });
    }
    return enriched;
  },
});

export const listAllTutorApplications = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenResult = await requireTeamToken(ctx, args.token);
    const tid = getTeamId(tokenResult);
    const apps = await ctx.db.query("tutorApplications").collect();
    const enriched = [];
    for (const app of apps) {
      let user = null;
      try { user = await ctx.db.get(app.userId); } catch { /* ignore */ }
      const review = await ctx.db
        .query("teamTutorReviews")
        .withIndex("by_application", (q) => q.eq("applicationId", app._id))
        .filter((q) => q.eq(q.field("teamId"), tid))
        .first();
      enriched.push({ ...app, user, review });
    }
    return enriched.sort(
      (a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0),
    );
  },
});

export const reviewTutorApplication = mutation({
  args: {
    token: v.string(),
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
    const tokenResult = await requireTeamToken(ctx, args.token);
    const { account } = tokenResult;
    const tid = getTeamId(tokenResult);
    if (!tid) throw new Error("Team not found.");
    const now = Date.now();
    const safeUserId = (account as any).userId || null;
    const existing = await ctx.db
      .query("teamTutorReviews")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .filter((q) => q.eq(q.field("teamId"), tid))
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
        teamId: tid,
        userId: safeUserId,
        status: args.status,
        note: args.note,
        createdAt: now,
        updatedAt: now,
      });
    }
    return true;
  },
});

// ===========================================================================
// Academic Team — Course Reviews
// ===========================================================================

export const listTutorCourses = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenResult = await requireTeamToken(ctx, args.token);
    const tid = getTeamId(tokenResult);
    const courses = await ctx.db.query("courses").collect();
    const enriched = [];
    for (const c of courses) {
      const tutor = await ctx.db.get(c.tutorId);
      const reviews = await ctx.db
        .query("teamReviews")
        .withIndex("by_course", (q) => q.eq("courseId", c._id))
        .filter((q) => q.eq(q.field("teamId"), tid))
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
// Content Team — Submissions
// ===========================================================================

export const listContentSubmissions = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenResult = await requireTeamToken(ctx, args.token);
    const tid = getTeamId(tokenResult);
    const subs = await ctx.db
      .query("teamContentSubmissions")
      .withIndex("by_team", (q) => q.eq("teamId", tid))
      .order("desc")
      .collect();
    const enriched = [];
    for (const s of subs) {
      let u = null;
      try { u = await ctx.db.get(s.userId); } catch { /* ignore */ }
      enriched.push({ ...s, user: u });
    }
    return enriched;
  },
});

export const createContentSubmission = mutation({
  args: {
    token: v.string(),
    type: v.union(
      v.literal("testimonial"),
      v.literal("resource"),
      v.literal("content-edit"),
    ),
    title: v.string(),
    description: v.string(),
    content: v.string(),
    targetId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tokenResult = await requireTeamToken(ctx, args.token);
    const { account } = tokenResult;
    const tid = getTeamId(tokenResult);
    if (!tid) throw new Error("Team not found.");
    const now = Date.now();
    const safeUserId = (account as any).userId || null;
    const id = await ctx.db.insert("teamContentSubmissions", {
      teamId: tid,
      userId: safeUserId,
      type: args.type,
      title: args.title,
      description: args.description,
      content: args.content,
      targetId: args.targetId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// ===========================================================================
// AI Team — Tool Drafts
// ===========================================================================

export const listAiToolDrafts = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenResult = await requireTeamToken(ctx, args.token);
    const tid = getTeamId(tokenResult);
    const drafts = await ctx.db
      .query("teamAiToolDrafts")
      .withIndex("by_team", (q) => q.eq("teamId", tid))
      .order("desc")
      .collect();
    const enriched = [];
    for (const d of drafts) {
      const u = await ctx.db.get(d.userId);
      enriched.push({ ...d, user: u });
    }
    return enriched;
  },
});

export const createAiToolDraft = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    url: v.string(),
    pricingType: v.union(
      v.literal("free"),
      v.literal("freemium"),
      v.literal("paid"),
    ),
  },
  handler: async (ctx, args) => {
    const tokenResult = await requireTeamToken(ctx, args.token);
    const { account } = tokenResult;
    const tid = getTeamId(tokenResult);
    if (!tid) throw new Error("Team not found.");
    const now = Date.now();
    const safeUserId = (account as any).userId || null;
    const id = await ctx.db.insert("teamAiToolDrafts", {
      teamId: tid,
      userId: safeUserId,
      title: args.title,
      description: args.description,
      category: args.category,
      url: args.url,
      pricingType: args.pricingType,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// ===========================================================================
// AI Team — Prompt Drafts
// ===========================================================================

export const listPromptDrafts = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenResult = await requireTeamToken(ctx, args.token);
    const tid = getTeamId(tokenResult);
    const drafts = await ctx.db
      .query("teamPromptDrafts")
      .withIndex("by_team", (q) => q.eq("teamId", tid))
      .order("desc")
      .collect();
    const enriched = [];
    for (const d of drafts) {
      const u = await ctx.db.get(d.userId);
      enriched.push({ ...d, user: u });
    }
    return enriched;
  },
});

export const createPromptDraft = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    template: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenResult = await requireTeamToken(ctx, args.token);
    const { account } = tokenResult;
    const tid = getTeamId(tokenResult);
    if (!tid) throw new Error("Team not found.");
    const now = Date.now();
    const safeUserId = (account as any).userId || null;
    const id = await ctx.db.insert("teamPromptDrafts", {
      teamId: tid,
      userId: safeUserId,
      title: args.title,
      description: args.description,
      category: args.category,
      template: args.template,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// ===========================================================================
// Support Cases
// ===========================================================================

export const listSupportTickets = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenResult = await requireTeamToken(ctx, args.token);
    const tid = getTeamId(tokenResult);
    const cases = await ctx.db
      .query("teamSupportCases")
      .withIndex("by_team", (q) => q.eq("teamId", tid))
      .order("desc")
      .collect();
    const enriched = [];
    for (const c of cases) {
      let msg = null;
      try { msg = await ctx.db.get(c.supportMessageId); } catch { /* ignore */ }
      let tutor = null;
      try { tutor = msg ? await ctx.db.get(msg.tutorId) : null; } catch { /* ignore */ }
      let assignee = null;
      try { assignee = c.assignedTo ? await ctx.db.get(c.assignedTo) : null; } catch { /* ignore */ }
      enriched.push({ ...c, message: msg, tutor, assignee });
    }
    return enriched;
  },
});

export const claimSupportCase = mutation({
  args: { token: v.string(), caseId: v.id("teamSupportCases") },
  handler: async (ctx, args) => {
    const { account } = await requireTeamToken(ctx, args.token);
    const c = await ctx.db.get(args.caseId);
    if (!c) throw new Error("Case not found.");
    const now = Date.now();
    const safeUserId = (account as any).userId || null;
    await ctx.db.patch(args.caseId, {
      assignedTo: safeUserId,
      status: "in_progress",
      updatedAt: now,
    });
    try {
      await ctx.db.insert("teamCaseHistory", {
        caseId: args.caseId,
        userId: safeUserId,
        action: "claimed",
        details: `${account.name ?? "Member"} claimed this case`,
        createdAt: now,
      });
    } catch { /* ignore */ }
    return true;
  },
});

export const resolveSupportCase = mutation({
  args: {
    token: v.string(),
    caseId: v.id("teamSupportCases"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { account } = await requireTeamToken(ctx, args.token);
    const c = await ctx.db.get(args.caseId);
    if (!c) throw new Error("Case not found.");
    const now = Date.now();
    await ctx.db.patch(args.caseId, { status: "resolved", updatedAt: now });
    const safeUserId = (account as any).userId || null;
    try {
      await ctx.db.insert("teamCaseHistory", {
        caseId: args.caseId,
        userId: safeUserId,
        action: "resolved",
        details: args.note ?? "Case resolved",
        createdAt: now,
      });
    } catch { /* ignore */ }
    return true;
  },
});

// ===========================================================================
// Escalations
// ===========================================================================

export const listEscalations = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenResult = await requireTeamToken(ctx, args.token);
    const tid = getTeamId(tokenResult);
    const esc = await ctx.db
      .query("teamEscalations")
      .withIndex("by_team", (q) => q.eq("teamId", tid))
      .order("desc")
      .collect();
    const enriched = [];
    for (const e of esc) {
      let u = null;
      try { u = await ctx.db.get(e.userId); } catch { /* ignore */ }
      enriched.push({ ...e, user: u });
    }
    return enriched;
  },
});

// ===========================================================================
// Tutor Support Team — Tutor Profiles
// ===========================================================================

export const listTutorProfiles = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireTeamToken(ctx, args.token);
    const users = await ctx.db.query("users").collect();
    const tutors = users.filter((u: any) => u.role === "tutor");
    const enriched = [];
    for (const t of tutors) {
      const apps = await ctx.db
        .query("tutorApplications")
        .withIndex("by_user", (q) => q.eq("userId", t._id))
        .collect();
      const latestApp = apps.sort(
        (a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0),
      )[0];
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
