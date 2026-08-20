import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Team slug → {name, description} mapping for auto-creating teams records
const TEAM_SLUG_MAP: Record<string, { name: string; description: string }> = {
  academic: { name: "Academic Team", description: "Academic operations, academic quality, and learning support." },
  "tutor-support": { name: "Tutor Support", description: "Tutor-related support, onboarding, and tutor issues." },
  "student-support": { name: "Student Support", description: "Student-facing support, student issues, and student experience." },
  content: { name: "Content Team", description: "Content creation, learning materials, and content operations." },
  "ai-prompts": { name: "AI & Prompt Team", description: "AI Hub, prompt resources, AI-related tools, and prompt-library operations." },
};

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

  // If team is still null (e.g. hub session with no teams record),
  // try to find by slug from the account
  if (!team && account.teamSlug) {
    team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q: any) => q.eq("slug", account.teamSlug))
      .unique();
  }

  return { account, membership, team };
}

/**
 * Resolve the team record and teamId for the current session.
 * Hub sessions (password-based) don't have memberships but have a teamSlug
 * on the account — look up the `teams` table by slug.
 * Legacy sessions have a membership with a teamId.
 */
async function resolveTeamContext(ctx: any, account: any, membership: any, team: any) {
  if (team) {
    return { teamId: team._id, team };
  }
  // Hub session without a team record: look up by slug from the account
  if (account.teamSlug) {
    const teamBySlug = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q: any) => q.eq("slug", account.teamSlug))
      .unique();
    if (teamBySlug) return { teamId: teamBySlug._id, team: teamBySlug };
    // Auto-create the team record if it doesn't exist yet
    const catInfo = TEAM_SLUG_MAP[account.teamSlug];
    if (catInfo) {
      const newId = await ctx.db.insert("teams", {
        name: catInfo.name,
        slug: account.teamSlug,
        description: catInfo.description,
        memberCount: 0,
        activeWorkCount: 0,
        status: "active",
        createdAt: Date.now(),
      });
      const newTeam = await ctx.db.get(newId);
      return { teamId: newId, team: newTeam };
    }
  }
  return { teamId: null, team: null };
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
    const { account, membership, team } = await requireTeamToken(ctx, args.token);
    const { teamId } = await resolveTeamContext(ctx, account, membership, team);
    if (!teamId) return [];

    try {
      let q = ctx.db
        .query("workItems")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .order("desc");
      if (args.status) {
        q = q.filter((q) => q.eq(q.field("status"), args.status));
      }
      const items = await q.collect();
      const enriched = [];
      for (const item of items) {
        let assignee = null;
        try {
          assignee = item.assignedTo ? await ctx.db.get(item.assignedTo) : null;
        } catch { /* ignore */ }
        let creator = null;
        try {
          creator = item.createdBy ? await ctx.db.get(item.createdBy) : null;
        } catch { /* ignore */ }
        enriched.push({ ...item, assignee, creator });
      }
      return enriched;
    } catch {
      return [];
    }
  },
});

/** Get activity for the team member's team. */
export const getTeamActivity = query({
  args: {
    token: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { account, membership, team } = await requireTeamToken(ctx, args.token);
    const { teamId } = await resolveTeamContext(ctx, account, membership, team);
    if (!teamId) return [];

    try {
      const activities = await ctx.db
        .query("teamActivity")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .order("desc")
        .take(args.limit ?? 30);
      const enriched = [];
      for (const a of activities) {
        let u = null;
        try {
          u = await ctx.db.get(a.userId);
        } catch { /* ignore — hub account */ }
        enriched.push({ ...a, user: u });
      }
      return enriched;
    } catch {
      return [];
    }
  },
});

/** Get comments for a work item. */
export const getWorkItemComments = query({
  args: { token: v.string(), workItemId: v.id("workItems") },
  handler: async (ctx, args) => {
    await requireTeamToken(ctx, args.token);
    const item = await ctx.db.get(args.workItemId);
    if (!item) return [];

    try {
      const comments = await ctx.db
        .query("workComments")
        .withIndex("by_workItem", (q) => q.eq("workItemId", args.workItemId))
        .collect();
      const enriched = [];
      for (const c of comments) {
        let u = null;
        try {
          u = await ctx.db.get(c.userId);
        } catch { /* ignore */ }
        enriched.push({ ...c, user: u });
      }
      return enriched;
    } catch {
      return [];
    }
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
    const { account, membership, team } = await requireTeamToken(ctx, args.token);
    const { teamId } = await resolveTeamContext(ctx, account, membership, team);
    if (!teamId) throw new Error("You are not assigned to a team.");
    const now = Date.now();
    // Use a safe createdBy — Hub accounts don't have users records,
    // so we store null and rely on the team context for attribution.
    const safeCreatorId = (account as any).userId || null;
    const id = await ctx.db.insert("workItems", {
      title: args.title,
      description: args.description,
      teamId: teamId as any,
      courseId: args.courseId,
      assignedTo: args.assignedTo,
      createdBy: safeCreatorId,
      priority: args.priority,
      status: "todo",
      deadline: args.deadline,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("teamActivity", {
      userId: safeCreatorId,
      teamId: teamId as any,
      action: "created_work",
      targetType: "workItem",
      targetId: id,
      targetLabel: args.title,
      details: account.name ? `${account.name} created this task` : undefined,
      createdAt: now,
    });
    try {
      const teamDoc = teamId ? await ctx.db.get(teamId) as any : null;
      if (teamDoc) {
        await ctx.db.patch(teamId, {
          activeWorkCount: (teamDoc.activeWorkCount ?? 0) + 1,
        });
      }
    } catch { /* ignore */ }
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
    const safeUserId = (account as any).userId || null;
    try {
      await ctx.db.insert("teamActivity", {
        userId: safeUserId,
        teamId: item.teamId,
        action: args.status ? `status_${args.status}` : "updated_work",
        targetType: "workItem",
        targetId: args.workItemId,
        targetLabel: item.title,
        details: args.status ? `Status → ${statusLabel}` : (account.name ? `${account.name} updated this task` : undefined),
        createdAt: Date.now(),
      });
    } catch { /* ignore activity logging errors */ }
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
    const safeUserId = (account as any).userId || null;
    try {
      await ctx.db.insert("workComments", {
        workItemId: args.workItemId,
        userId: safeUserId,
        content: args.content,
        createdAt: now,
      });
    } catch { /* workComments insert failed — skip */ }
    await ctx.db.patch(args.workItemId, {
      commentCount: (item.commentCount ?? 0) + 1,
      updatedAt: now,
    });
    try {
      await ctx.db.insert("teamActivity", {
        userId: safeUserId,
        teamId: item.teamId,
        action: "added_comment",
        targetType: "workItem",
        targetId: args.workItemId,
        targetLabel: item.title,
        details: account.name ? `${account.name} commented` : undefined,
        createdAt: now,
      });
    } catch { /* ignore */ }
    return args.workItemId;
  },
});

/** List team members. */
export const listTeamMembers = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { account, membership, team } = await requireTeamToken(ctx, args.token);
    const { teamId } = await resolveTeamContext(ctx, account, membership, team);
    if (!teamId) return [];

    try {
      const memberships = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team", (q) => q.eq("teamId", teamId as any))
        .collect();
      const members = [];
      for (const m of memberships) {
        let acct = null;
        try {
          acct = m.teamAccountId ? await ctx.db.get(m.teamAccountId) : null;
        } catch { /* ignore */ }
        let user = null;
        try {
          user = m.userId ? await ctx.db.get(m.userId) : null;
        } catch { /* ignore */ }
        members.push({ ...m, teamAccount: acct, user });
      }
      return members;
    } catch {
      return [];
    }
  },
});

/** List all teams. */
export const listAllTeams = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teams").collect();
  },
});
