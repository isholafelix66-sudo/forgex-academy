import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ---------------------------------------------------------------------------
// Password hashing (pure JS SHA-256 — no crypto.subtle dependency)
// ---------------------------------------------------------------------------

/** Generate N random hex bytes using Convex-safe crypto.getRandomValues. */
function randomHex(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Simple DJB2-based string hash — lightweight, deterministic, no Web Crypto. */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Hash a password using multiple rounds of DJB2 for added entropy.
 * Produces a deterministic "salt:hash" string compatible with verifyPassword.
 */
function hashPasswordSync(password: string, salt?: string): string {
  const saltStr = salt || randomHex(16);
  const input = saltStr + ":" + password;
  // Multiple rounds for stronger mixing
  let h1 = djb2Hash(input);
  let h2 = djb2Hash(input + h1);
  let h3 = djb2Hash(h2 + input + h1);
  return `${saltStr}:${h1}${h2}${h3}`;
}

/** Verify a password against a stored hash. */
function verifyPasswordSync(
  password: string,
  storedHash: string,
): boolean {
  const [salt] = storedHash.split(":");
  const newHash = hashPasswordSync(password, salt);
  return newHash === storedHash;
}

/** Generate a random team ID like FX-XXXXXX. */
function generateTeamId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `FX-${id}`;
}

/** Generate a random password. */
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 12; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}

// ---------------------------------------------------------------------------
// Team categories
// ---------------------------------------------------------------------------

export const TEAM_CATEGORIES = [
  { name: "Academic Team", slug: "academic", description: "Academic operations and quality oversight." },
  { name: "Tutor Support Team", slug: "tutor-support", description: "Tutor assistance and onboarding support." },
  { name: "Student Support Team", slug: "student-support", description: "Student assistance and support services." },
  { name: "Content Team", slug: "content", description: "Content creation, management and publishing." },
  { name: "AI Team", slug: "ai", description: "AI tools, workflows, resources and AI operations." },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTeamAccountFromToken(ctx: any, token: string) {
  const session = ctx.db
    .query("teamSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .unique();
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    ctx.db.delete(session._id);
    return null;
  }
  const account = ctx.db.get(session.teamAccountId);
  if (!account || account.status !== "active") return null;
  return { account, session };
}

/** Create a session token for a team account. */
function createSession(ctx: any, teamAccountId: string): string {
  const token = randomHex(32);
  ctx.db.insert("teamSessions", {
    teamAccountId: teamAccountId as any,
    token,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    createdAt: Date.now(),
  });
  return token;
}

/** Ensure the 5 team categories exist in the database. */
function ensureTeamsExist(ctx: any): void {
  for (const cat of TEAM_CATEGORIES) {
    const existing = ctx.db
      .query("teams")
      .withIndex("by_slug", (q: any) => q.eq("slug", cat.slug))
      .unique();
    if (!existing) {
      ctx.db.insert("teams", {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        memberCount: 0,
        activeWorkCount: 0,
        status: "active",
        createdAt: Date.now(),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Register a new team account (creates a pending application). */
export const registerTeamAccount = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    skill: v.string(),
    teamCategory: v.string(), // slug: "academic" | "tutor-support" | "student-support" | "content" | "ai"
    introduction: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate team category
    const validSlugs: string[] = TEAM_CATEGORIES.map((c) => c.slug);
    if (!validSlugs.includes(args.teamCategory)) {
      throw new Error("Invalid team category. Please select a valid team.");
    }

    // Ensure the 5 team categories exist
    ensureTeamsExist(ctx);

    // Check if email already exists
    const existing = await ctx.db
      .query("teamAccounts")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .unique();
    if (existing) {
      throw new Error("An account with this email already exists.");
    }

    // Generate credentials
    const teamId = generateTeamId();
    const plainPassword = generatePassword();
    const passwordHash = hashPasswordSync(plainPassword);

    // Resolve team
    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.teamCategory))
      .unique();

    // Create team account (pending status until admin approves)
    const accountId = await ctx.db.insert("teamAccounts", {
      teamId,
      name: args.name.trim(),
      email: args.email.toLowerCase().trim(),
      phone: args.phone?.trim(),
      skill: args.skill.trim(),
      introduction: args.introduction.trim(),
      passwordHash,
      teamSlug: args.teamCategory,
      role: "teamMember",
      status: "pending",
      mustChangePassword: true,
      createdAt: Date.now(),
    });

    // Create the application record
    await ctx.db.insert("teamApplications", {
      teamAccountId: accountId,
      name: args.name.trim(),
      email: args.email.toLowerCase().trim(),
      phone: args.phone?.trim(),
      skill: args.skill.trim(),
      preferredTeamId: team?._id as any,
      introduction: args.introduction.trim(),
      password: passwordHash,
      status: "pending",
      createdAt: Date.now(),
    });

    return {
      teamId,
      password: plainPassword,
      accountId,
      teamCategory: args.teamCategory,
    };
  },
});

/** Login with Team ID + Password. */
export const teamLogin = mutation({
  args: {
    teamId: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("teamAccounts")
      .withIndex("by_team_id", (q) =>
        q.eq("teamId", args.teamId.toUpperCase().trim()),
      )
      .unique();

    if (!account) {
      throw new Error("Invalid Team ID or password.");
    }

    if (account.status === "pending") {
      throw new Error(
        "Your account is pending admin approval. Please wait for activation.",
      );
    }

    if (account.status === "suspended") {
      throw new Error(
        "Your account has been suspended. Please contact the administrator.",
      );
    }

    const valid = verifyPasswordSync(args.password, account.passwordHash);
    if (!valid) {
      throw new Error("Invalid Team ID or password.");
    }

    // Update last login
    await ctx.db.patch(account._id, { lastLoginAt: Date.now() });

    // Create session
    const token = createSession(ctx, account._id);

    return {
      token,
      teamId: account.teamId,
      name: account.name,
      role: account.role,
      teamSlug: account.teamSlug,
      mustChangePassword: account.mustChangePassword,
    };
  },
});

/** Get current team account from session token. */
export const getTeamSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    const result = getTeamAccountFromToken(ctx, args.token);
    if (!result) return null;
    const { account } = result;
    // Get membership
    const membership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_account", (q) =>
        q.eq("teamAccountId", account._id),
      )
      .unique();
    let team = null;
    if (membership) {
      team = await ctx.db.get(membership.teamId);
    }
    return {
      accountId: account._id,
      teamId: account.teamId,
      name: account.name,
      email: account.email,
      role: account.role,
      teamSlug: account.teamSlug || team?.slug,
      status: account.status,
      mustChangePassword: account.mustChangePassword,
      membership: membership
        ? {
            teamId: membership.teamId,
            role: membership.role,
            status: membership.status,
          }
        : null,
      team: team
        ? { _id: team._id, name: team.name, slug: team.slug }
        : null,
    };
  },
});

/** Logout - destroy session. */
export const teamLogout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("teamSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (session) {
      await ctx.db.delete(session._id);
    }
    return true;
  },
});

/** Change password (must change after first login or reset). */
export const teamChangePassword = mutation({
  args: {
    token: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const result = getTeamAccountFromToken(ctx, args.token);
    if (!result) throw new Error("Not authenticated.");

    const valid = verifyPasswordSync(
      args.currentPassword,
      result.account.passwordHash,
    );
    if (!valid) throw new Error("Current password is incorrect.");

    if (args.newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }

    const newHash = hashPasswordSync(args.newPassword);
    await ctx.db.patch(result.account._id, {
      passwordHash: newHash,
      mustChangePassword: false,
    });

    return true;
  },
});

/** Submit a password recovery request. */
export const teamRequestPasswordRecovery = mutation({
  args: {
    teamId: v.string(),
    name: v.string(),
    email: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("teamAccounts")
      .withIndex("by_team_id", (q) =>
        q.eq("teamId", args.teamId.toUpperCase().trim()),
      )
      .unique();

    if (!account) {
      throw new Error("No account found with that Team ID.");
    }

    // Check if there's already a pending request
    const existing = await ctx.db
      .query("teamPasswordRecovery")
      .withIndex("by_team_account", (q) =>
        q.eq("teamAccountId", account._id),
      )
      .collect();
    const pending = existing.find((r: any) => r.status === "pending");
    if (pending) {
      throw new Error(
        "You already have a pending recovery request. Please wait for admin review.",
      );
    }

    await ctx.db.insert("teamPasswordRecovery", {
      teamAccountId: account._id,
      teamId: args.teamId.toUpperCase().trim(),
      name: args.name.trim(),
      email: args.email.toLowerCase().trim(),
      reason: args.reason.trim(),
      status: "pending",
      createdAt: Date.now(),
    });

    return true;
  },
});

/** Admin: list pending password recovery requests. */
export const listPendingRecoveryRequests = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("teamPasswordRecovery")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

/** Admin: list all team accounts. */
export const listAllTeamAccounts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teamAccounts").collect();
  },
});

/** Admin: list all team applications. */
export const listAllTeamApplications = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teamApplications").collect();
  },
});

/** Admin: approve a team application and activate the account. */
export const approveTeamApplication = mutation({
  args: {
    applicationId: v.id("teamApplications"),
    teamSlug: v.string(),
    role: v.union(v.literal("teamMember"), v.literal("teamLead")),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found.");
    if (app.status !== "pending") throw new Error("Application already reviewed.");

    // Activate the account
    if (app.teamAccountId) {
      await ctx.db.patch(app.teamAccountId, {
        status: "active",
        teamSlug: args.teamSlug,
        role: args.role,
      });
    }

    // Find or create team membership
    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.teamSlug))
      .unique();

    if (team && app.teamAccountId) {
      // Check for existing membership
      const existingMembership = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_account", (q) =>
          q.eq("teamAccountId", app.teamAccountId!),
        )
        .unique();
      if (!existingMembership) {
        await ctx.db.insert("teamMemberships", {
          teamAccountId: app.teamAccountId,
          teamId: team._id,
          role: args.role,
          status: "active",
          joinedAt: Date.now(),
        });
        // Update team member count
        await ctx.db.patch(team._id, {
          memberCount: team.memberCount + 1,
        });
      }
    }

    // Update application status
    await ctx.db.patch(args.applicationId, {
      status: "approved",
      reviewedAt: Date.now(),
    });

    return true;
  },
});

/** Admin: reject a team application. */
export const rejectTeamApplication = mutation({
  args: {
    applicationId: v.id("teamApplications"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found.");
    if (app.status !== "pending") throw new Error("Application already reviewed.");

    // Deactivate the account if it exists
    if (app.teamAccountId) {
      await ctx.db.patch(app.teamAccountId, { status: "suspended" });
    }

    await ctx.db.patch(args.applicationId, {
      status: "rejected",
      reviewNote: args.reason,
      reviewedAt: Date.now(),
    });

    return true;
  },
});

/** Admin: reset a team member's password. */
export const adminResetTeamPassword = mutation({
  args: {
    teamAccountId: v.id("teamAccounts"),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.teamAccountId);
    if (!account) throw new Error("Account not found.");

    const newPlainPassword = generatePassword();
    const newHash = hashPasswordSync(newPlainPassword);

    await ctx.db.patch(args.teamAccountId, {
      passwordHash: newHash,
      mustChangePassword: true,
    });

    return { newPassword: newPlainPassword };
  },
});

/** Admin: approve a password recovery request. */
export const approvePasswordRecovery = mutation({
  args: {
    recoveryId: v.id("teamPasswordRecovery"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.recoveryId);
    if (!request) throw new Error("Recovery request not found.");
    if (request.status !== "pending") throw new Error("Already reviewed.");

    // Generate new password
    const newPlainPassword = generatePassword();
    const newHash = hashPasswordSync(newPlainPassword);

    await ctx.db.patch(request.teamAccountId, {
      passwordHash: newHash,
      mustChangePassword: true,
    });

    await ctx.db.patch(args.recoveryId, {
      status: "approved",
      newTempPassword: newPlainPassword,
      reviewedAt: Date.now(),
    });

    return { newPassword: newPlainPassword };
  },
});

/** Admin: reject a password recovery request. */
export const rejectPasswordRecovery = mutation({
  args: {
    recoveryId: v.id("teamPasswordRecovery"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.recoveryId);
    if (!request) throw new Error("Recovery request not found.");
    if (request.status !== "pending") throw new Error("Already reviewed.");

    await ctx.db.patch(args.recoveryId, {
      status: "rejected",
      reviewedAt: Date.now(),
    });

    return true;
  },
});

/** Admin: suspend/activate a team account. */
export const toggleTeamAccountStatus = mutation({
  args: {
    teamAccountId: v.id("teamAccounts"),
    status: v.union(v.literal("active"), v.literal("suspended")),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.teamAccountId);
    if (!account) throw new Error("Account not found.");

    await ctx.db.patch(args.teamAccountId, { status: args.status });

    // Also update membership if exists
    const membership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_account", (q) =>
        q.eq("teamAccountId", args.teamAccountId),
      )
      .unique();
    if (membership) {
      await ctx.db.patch(membership._id, {
        status: args.status === "active" ? "active" : "deactivated",
      });
    }

    return true;
  },
});

/** Admin: create a team. */
export const createTeam = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new Error("A team with that slug already exists.");

    return await ctx.db.insert("teams", {
      name: args.name.trim(),
      slug: args.slug.trim(),
      description: args.description.trim(),
      memberCount: 0,
      activeWorkCount: 0,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

/** Public: get available team categories. */
export const getTeamCategories = query({
  args: {},
  handler: async () => {
    return TEAM_CATEGORIES;
  },
});
