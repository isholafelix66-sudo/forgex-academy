import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser } from "./lib";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validate an admin session token — returns true if the token is valid. */
async function requireAdminToken(ctx: any, token: string) {
  const session = await ctx.db
    .query("adminSessions")
    .filter((q: any) => q.eq(q.field("token"), token))
    .first();
  if (!session) throw new Error("Invalid admin session.");
  return true;
}

/** Fetch the full user document (not just the Id). */
async function getUserDoc(ctx: any) {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found.");
  return user;
}

/** Fetch the team membership record for the current user (or null). */
async function getTeamMembership(ctx: any) {
  const user = await getUserDoc(ctx);
  if (!user.teamMemberId) return { user, membership: null as any };
  const membership = await ctx.db.get(user.teamMemberId);
  return { user, membership };
}

/** Verify the user is an active team member on the given team, or an admin. */
async function requireTeamAccess(
  ctx: any,
  teamId: string,
): Promise<{ user: any; membership: any }> {
  const user = await getUserDoc(ctx);
  if (user.role === "admin") return { user, membership: null };
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

// ---------------------------------------------------------------------------
// Team CRUD (admin only)
// ---------------------------------------------------------------------------

export const createTeam = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminToken(ctx, args.token);
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new Error("A team with that slug already exists.");
    const id = await ctx.db.insert("teams", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      memberCount: 0,
      activeWorkCount: 0,
      status: "active",
      createdAt: Date.now(),
    });
    return id;
  },
});

export const updateTeam = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    leadUserId: v.optional(v.id("users")),
    status: v.optional(v.union(v.literal("active"), v.literal("disabled"))),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminToken(ctx, args.token);
    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.leadUserId !== undefined) patch.leadUserId = args.leadUserId;
    if (args.status !== undefined) patch.status = args.status;
    if (Object.keys(patch).length > 0) await ctx.db.patch(args.teamId, patch);
    return args.teamId;
  },
});

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export const submitApplication = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    skill: v.string(),
    preferredTeamId: v.optional(v.id("teams")),
    introduction: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserDoc(ctx);
    // Check for existing pending application
    const existing = await ctx.db
      .query("teamApplications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    if (existing) throw new Error("You already have a pending application.");
    const id = await ctx.db.insert("teamApplications", {
      userId: user._id,
      name: args.name,
      email: args.email,
      phone: args.phone,
      skill: args.skill,
      preferredTeamId: args.preferredTeamId,
      introduction: args.introduction,
      status: "pending",
      createdAt: Date.now(),
    });
    return id;
  },
});

export const listPendingApplications = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminToken(ctx, args.token);
    return await ctx.db
      .query("teamApplications")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();
  },
});

export const listAllApplications = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminToken(ctx, args.token);
    return await ctx.db.query("teamApplications").order("desc").collect();
  },
});

export const reviewApplication = mutation({
  args: {
    applicationId: v.id("teamApplications"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    teamId: v.optional(v.id("teams")),
    role: v.optional(
      v.union(v.literal("teamLead"), v.literal("teamMember")),
    ),
    reviewNote: v.optional(v.string()),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminToken(ctx, args.token);
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found.");
    if (app.status !== "pending") throw new Error("Already reviewed.");

    // Update application status
    await ctx.db.patch(args.applicationId, {
      status: args.decision,
      reviewedBy: undefined,
      reviewedAt: Date.now(),
      reviewNote: args.reviewNote,
    });

    if (args.decision === "approved" && args.teamId) {
      const membershipId = await ctx.db.insert("teamMemberships", {
        userId: app.userId,
        teamAccountId: app.teamAccountId,
        teamId: args.teamId,
        role: args.role ?? "teamMember",
        status: "active",
        joinedAt: Date.now(),
      });
      if (app.userId) {
        await ctx.db.patch(app.userId, { teamMemberId: membershipId });
      }
      const team = await ctx.db.get(args.teamId);
      if (team) {
        await ctx.db.patch(args.teamId, {
          memberCount: (team.memberCount ?? 0) + 1,
        });
      }
    }

    return args.applicationId;
  },
});

// ---------------------------------------------------------------------------
// Team Members (admin)
// ---------------------------------------------------------------------------

export const listTeamMembers = query({
  args: { teamId: v.id("teams"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.token) {
      await requireAdminToken(ctx, args.token);
    } else {
      await requireTeamAccess(ctx, args.teamId);
    }
    const memberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
    const members = [];
    for (const m of memberships) {
      const u = m.userId ? await ctx.db.get(m.userId) : null;
      const acct = m.teamAccountId ? await ctx.db.get(m.teamAccountId) : null;
      members.push({ ...m, user: u, teamAccount: acct });
    }
    return members;
  },
});

export const listAllTeams = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teams").collect();
  },
});

export const deactivateMember = mutation({
  args: {
    membershipId: v.id("teamMemberships"),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminToken(ctx, args.token);
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error("Membership not found.");
    await ctx.db.patch(args.membershipId, { status: "deactivated" });
    if (membership.userId) {
      await ctx.db.patch(membership.userId, { teamMemberId: undefined });
    }
    const team = await ctx.db.get(membership.teamId);
    if (team && (team.memberCount ?? 0) > 0) {
      await ctx.db.patch(membership.teamId, {
        memberCount: team.memberCount - 1,
      });
    }
    return args.membershipId;
  },
});

export const changeMemberTeam = mutation({
  args: {
    membershipId: v.id("teamMemberships"),
    newTeamId: v.id("teams"),
    newRole: v.union(v.literal("teamLead"), v.literal("teamMember")),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminToken(ctx, args.token);
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error("Membership not found.");
    const oldTeam = await ctx.db.get(membership.teamId);
    if (oldTeam && (oldTeam.memberCount ?? 0) > 0) {
      await ctx.db.patch(membership.teamId, {
        memberCount: oldTeam.memberCount - 1,
      });
    }
    await ctx.db.patch(args.membershipId, {
      teamId: args.newTeamId,
      role: args.newRole,
    });
    const newTeam = await ctx.db.get(args.newTeamId);
    if (newTeam) {
      await ctx.db.patch(args.newTeamId, {
        memberCount: (newTeam.memberCount ?? 0) + 1,
      });
    }
    return args.membershipId;
  },
});

// ---------------------------------------------------------------------------
// Team Workspace — Queries
// ---------------------------------------------------------------------------

export const getMyTeam = query({
  args: {},
  handler: async (ctx) => {
    const { user, membership } = await getTeamMembership(ctx);
    if (!membership || membership.status !== "active") return null;
    const team = await ctx.db.get(membership.teamId);
    return { team, membership, user };
  },
});

export const getTeamWorkItems = query({
  args: {
    teamId: v.id("teams"),
    status: v.optional(
      v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("in_review"),
        v.literal("completed"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    let q = ctx.db
      .query("workItems")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .order("desc");
    if (args.status) {
      q = q.filter((q) => q.eq(q.field("status"), args.status));
    }
    const items = await q.collect();
    const enriched = [];
    for (const item of items) {
      const assignee = item.assignedTo
        ? await ctx.db.get(item.assignedTo)
        : null;
      const creator = item.createdBy ? await ctx.db.get(item.createdBy) : null;
      enriched.push({ ...item, assignee, creator });
    }
    return enriched;
  },
});

export const getWorkItemComments = query({
  args: { workItemId: v.id("workItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.workItemId);
    if (!item) throw new Error("Work item not found.");
    await requireTeamAccess(ctx, item.teamId);
    const comments = await ctx.db
      .query("workComments")
      .withIndex("by_workItem", (q) => q.eq("workItemId", args.workItemId))
      .collect();
    const enriched = [];
    for (const c of comments) {
      const u = c.userId ? await ctx.db.get(c.userId) : null;
      enriched.push({ ...c, user: u });
    }
    return enriched;
  },
});

export const getTeamActivity = query({
  args: {
    teamId: v.id("teams"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    const activities = await ctx.db
      .query("teamActivity")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .take(args.limit ?? 30);
    const enriched = [];
    for (const a of activities) {
      const u = a.userId ? await ctx.db.get(a.userId) : null;
      enriched.push({ ...a, user: u });
    }
    return enriched;
  },
});

// ---------------------------------------------------------------------------
// Team Workspace — Mutations
// ---------------------------------------------------------------------------

export const createWorkItem = mutation({
  args: {
    teamId: v.id("teams"),
    title: v.string(),
    description: v.string(),
    courseId: v.optional(v.id("courses")),
    assignedTo: v.optional(v.id("users")),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent"),
    ),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, membership } = await requireTeamAccess(ctx, args.teamId);
    const now = Date.now();
    const id = await ctx.db.insert("workItems", {
      title: args.title,
      description: args.description,
      teamId: args.teamId,
      courseId: args.courseId,
      assignedTo: args.assignedTo,
      createdBy: user._id,
      priority: args.priority,
      status: "todo",
      deadline: args.deadline,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("teamActivity", {
      userId: user._id,
      teamId: args.teamId,
      action: "created_work",
      targetType: "workItem",
      targetId: id,
      targetLabel: args.title,
      createdAt: now,
    });
    const team = await ctx.db.get(args.teamId);
    if (team) {
      await ctx.db.patch(args.teamId, {
        activeWorkCount: (team.activeWorkCount ?? 0) + 1,
      });
    }
    return id;
  },
});

export const updateWorkItem = mutation({
  args: {
    workItemId: v.id("workItems"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
      ),
    ),
    status: v.optional(
      v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("in_review"),
        v.literal("completed"),
      ),
    ),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.workItemId);
    if (!item) throw new Error("Work item not found.");
    const { user } = await requireTeamAccess(ctx, item.teamId);
    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;
    if (args.assignedTo !== undefined) patch.assignedTo = args.assignedTo;
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.status !== undefined) patch.status = args.status;
    if (args.deadline !== undefined) patch.deadline = args.deadline;
    await ctx.db.patch(args.workItemId, patch);
    const statusLabel = args.status
      ? args.status.replace(/_/g, " ")
      : "updated";
    await ctx.db.insert("teamActivity", {
      userId: user._id,
      teamId: item.teamId,
      action: args.status ? `status_${args.status}` : "updated_work",
      targetType: "workItem",
      targetId: args.workItemId,
      targetLabel: item.title,
      details: args.status ? `Status → ${statusLabel}` : undefined,
      createdAt: Date.now(),
    });
    return args.workItemId;
  },
});

export const addWorkComment = mutation({
  args: {
    workItemId: v.id("workItems"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.workItemId);
    if (!item) throw new Error("Work item not found.");
    const { user } = await requireTeamAccess(ctx, item.teamId);
    const now = Date.now();
    await ctx.db.insert("workComments", {
      workItemId: args.workItemId,
      userId: user._id,
      content: args.content,
      createdAt: now,
    });
    await ctx.db.patch(args.workItemId, {
      commentCount: (item.commentCount ?? 0) + 1,
      updatedAt: now,
    });
    await ctx.db.insert("teamActivity", {
      userId: user._id,
      teamId: item.teamId,
      action: "added_comment",
      targetType: "workItem",
      targetId: args.workItemId,
      targetLabel: item.title,
      createdAt: now,
    });
    return args.workItemId;
  },
});

// ---------------------------------------------------------------------------
// Course Reviews (Academic Team)
// ---------------------------------------------------------------------------

export const submitCourseReview = mutation({
  args: {
    courseId: v.id("courses"),
    teamId: v.id("teams"),
    section: v.union(
      v.literal("lessons"),
      v.literal("quizzes"),
      v.literal("resources"),
      v.literal("objectives"),
      v.literal("general"),
    ),
    decision: v.union(
      v.literal("approved"),
      v.literal("revision_required"),
      v.literal("pending"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireTeamAccess(ctx, args.teamId);
    const now = Date.now();
    const existing = await ctx.db
      .query("teamReviews")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), user._id),
          q.eq(q.field("section"), args.section),
        ),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        decision: args.decision,
        note: args.note,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("teamReviews", {
        courseId: args.courseId,
        teamId: args.teamId,
        userId: user._id,
        section: args.section,
        decision: args.decision,
        note: args.note,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("teamActivity", {
      userId: user._id,
      teamId: args.teamId,
      action: `reviewed_${args.section}`,
      targetType: "course",
      targetId: args.courseId,
      targetLabel: args.section,
      details: `Decision: ${args.decision.replace(/_/g, " ")}`,
      createdAt: now,
    });
    return true;
  },
});

export const getCourseReviews = query({
  args: {
    courseId: v.id("courses"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    return await ctx.db
      .query("teamReviews")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .filter((q) => q.eq(q.field("teamId"), args.teamId))
      .collect();
  },
});

export const getTeamCourseReviewSummary = query({
  args: {
    courseId: v.id("courses"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);
    const reviews = await ctx.db
      .query("teamReviews")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .filter((q) => q.eq(q.field("teamId"), args.teamId))
      .collect();
    const sections: Record<
      string,
      { decision: string; note?: string; user?: string }
    > = {};
    for (const r of reviews) {
      const u = await ctx.db.get(r.userId);
      sections[r.section] = {
        decision: r.decision,
        note: r.note,
        user: u?.name,
      };
    }
    return sections;
  },
});

// ---------------------------------------------------------------------------
// Admin — Activity Log
// ---------------------------------------------------------------------------

export const getAllTeamActivity = query({
  args: { token: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminToken(ctx, args.token);
    const activities = await ctx.db
      .query("teamActivity")
      .order("desc")
      .take(100);
    const enriched = [];
    for (const a of activities) {
      const u = a.userId ? await ctx.db.get(a.userId) : null;
      enriched.push({ ...a, user: u });
    }
    return enriched;
  },
});
