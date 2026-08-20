import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ---------------------------------------------------------------------------
// Helper: validate a team session token and return account + membership
// ---------------------------------------------------------------------------

async function resolveTeamToken(ctx: any, token: string) {
  if (!token) return null;

  // 1) Check the new Team Hub sessions (teamAccessSessions)
  const hubSession = await ctx.db
    .query("teamAccessSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .unique();
  if (hubSession) {
    if (hubSession.expiresAt < Date.now()) {
      await ctx.db.delete(hubSession._id);
      return null;
    }
    // Check the team is active
    const access = await ctx.db
      .query("teamAccess")
      .withIndex("by_slug", (q: any) => q.eq("teamSlug", hubSession.teamSlug))
      .unique();
    if (!access || !access.isActive) return null;

    // Find the teams record for this slug
    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q: any) => q.eq("slug", hubSession.teamSlug))
      .unique();
    if (!team) return null;

    // Create a virtual account object compatible with workspace functions
    const account = {
      _id: access._id,
      teamId: access.teamSlug,
      name: access.teamName,
      email: `${access.teamSlug}@forgex.team`,
      role: "teamMember" as const,
      teamSlug: hubSession.teamSlug,
      status: "active" as const,
    };

    return { account, session: hubSession, team };
  }

  // 2) Fallback: check the legacy per-user sessions (teamSessions)
  const session = await ctx.db
    .query("teamSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .unique();
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    await ctx.db.delete(session._id);
    return null;
  }
  const account = await ctx.db.get(session.teamAccountId);
  if (!account || account.status !== "active") return null;
  return { account, session };
}

async function requireTeamToken(
  ctx: any,
  token: string,
): Promise<{ account: any; membership: any; team: any }> {
  const result = await resolveTeamToken(ctx, token);
  if (!result) throw new Error("Not authenticated as a team member.");
  const { account } = result;

  // If resolveTeamToken already found a team (hub session), use it
  if ((result as any).team) {
    return { account, membership: null, team: (result as any).team };
  }

  // Otherwise, look up via membership (legacy per-user sessions)
  const membership = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team_account", (q: any) =>
      q.eq("teamAccountId", account._id),
    )
    .unique();

  let team = null;
  if (membership) {
    team = await ctx.db.get(membership.teamId);
  }

  return { account, membership, team };
}

// ===========================================================================
// Workspace queries (team-token-authenticated)
// ===========================================================================

/** Get the current team member's workspace context. */
export const getTeamWorkspace = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { account, membership, team } = await requireTeamToken(
      ctx,
      args.token,
    );
    return {
      account: {
        _id: account._id,
        teamId: account.teamId,
        name: account.name,
        email: account.email,
        role: account.role,
        teamSlug: account.teamSlug,
        status: account.status,
      },
      membership: membership
        ? {
            _id: membership._id,
            teamId: membership.teamId,
            role: membership.role,
            status: membership.status,
          }
        : null,
      team: team
        ? {
            _id: team._id,
            name: team.name,
            slug: team.slug,
            description: team.description,
            memberCount: team.memberCount,
            activeWorkCount: team.activeWorkCount,
          }
        : null,
    };
  },
});

/** Get work items for the team member's team. */
export const getTeamWorkItems = query({
  args: {
    token: v.string(),
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
    const { membership } = await requireTeamToken(ctx, args.token);
    if (!membership) throw new Error("You are not assigned to a team.");

    let q = ctx.db
      .query("workItems")
      .withIndex("by_team", (q) => q.eq("teamId", membership.teamId))
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
      const creator = await ctx.db.get(item.createdBy);
      enriched.push({ ...item, assignee, creator });
    }
    return enriched;
  },
});

/** Get activity for the team member's team. */
export const getTeamActivity = query({
  args: {
    token: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { membership } = await requireTeamToken(ctx, args.token);
    if (!membership) throw new Error("You are not assigned to a team.");

    const activities = await ctx.db
      .query("teamActivity")
      .withIndex("by_team", (q) => q.eq("teamId", membership.teamId))
      .order("desc")
      .take(args.limit ?? 30);
    const enriched = [];
    for (const a of activities) {
      const u = await ctx.db.get(a.userId);
      enriched.push({ ...a, user: u });
    }
    return enriched;
  },
});

/** Get comments for a work item. */
export const getWorkItemComments = query({
  args: { token: v.string(), workItemId: v.id("workItems") },
  handler: async (ctx, args) => {
    await requireTeamToken(ctx, args.token);
    const item = await ctx.db.get(args.workItemId);
    if (!item) throw new Error("Work item not found.");

    const comments = await ctx.db
      .query("workComments")
      .withIndex("by_workItem", (q) => q.eq("workItemId", args.workItemId))
      .collect();
    const enriched = [];
    for (const c of comments) {
      const u = await ctx.db.get(c.userId);
      enriched.push({ ...c, user: u });
    }
    return enriched;
  },
});

/** Create a work item. */
export const createWorkItem = mutation({
  args: {
    token: v.string(),
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
    const { account, membership } = await requireTeamToken(ctx, args.token);
    if (!membership) throw new Error("You are not assigned to a team.");
    const now = Date.now();
    const id = await ctx.db.insert("workItems", {
      title: args.title,
      description: args.description,
      teamId: membership.teamId,
      courseId: args.courseId,
      assignedTo: args.assignedTo,
      createdBy: account._id as any,
      priority: args.priority,
      status: "todo",
      deadline: args.deadline,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("teamActivity", {
      userId: account._id as any,
      teamId: membership.teamId,
      action: "created_work",
      targetType: "workItem",
      targetId: id,
      targetLabel: args.title,
      createdAt: now,
    });
    const team = await ctx.db.get(membership.teamId) as any;
    if (team) {
      await ctx.db.patch(membership.teamId, {
        activeWorkCount: (team.activeWorkCount ?? 0) + 1,
      });
    }
    return id;
  },
});

/** Update a work item. */
export const updateWorkItem = mutation({
  args: {
    token: v.string(),
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
    const { account } = await requireTeamToken(ctx, args.token);
    const item = await ctx.db.get(args.workItemId);
    if (!item) throw new Error("Work item not found.");

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
      userId: account._id as any,
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

/** Add a comment to a work item. */
export const addWorkComment = mutation({
  args: {
    token: v.string(),
    workItemId: v.id("workItems"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { account } = await requireTeamToken(ctx, args.token);
    const item = await ctx.db.get(args.workItemId);
    if (!item) throw new Error("Work item not found.");

    const now = Date.now();
    await ctx.db.insert("workComments", {
      workItemId: args.workItemId,
      userId: account._id as any,
      content: args.content,
      createdAt: now,
    });
    await ctx.db.patch(args.workItemId, {
      commentCount: (item.commentCount ?? 0) + 1,
      updatedAt: now,
    });
    await ctx.db.insert("teamActivity", {
      userId: account._id as any,
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

/** List team members. */
export const listTeamMembers = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { membership } = await requireTeamToken(ctx, args.token);
    if (!membership) throw new Error("You are not assigned to a team.");

    const memberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team", (q) => q.eq("teamId", membership.teamId))
      .collect();
    const members = [];
    for (const m of memberships) {
      const acct = m.teamAccountId
        ? await ctx.db.get(m.teamAccountId)
        : null;
      const user = m.userId ? await ctx.db.get(m.userId) : null;
      members.push({ ...m, teamAccount: acct, user });
    }
    return members;
  },
});

/** List all teams. */
export const listAllTeams = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teams").collect();
  },
});
