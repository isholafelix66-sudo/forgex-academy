import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ---------------------------------------------------------------------------
// Password hashing — pure JS, zero Web Crypto dependency
// ---------------------------------------------------------------------------

/** Generate N random hex chars using Math.random. */
function randomHex(n: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < n; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** DJB2 hash — fast, deterministic, pure JS. */
function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Multi-round DJB2 password hash. Format: salt:h1h2h3 (24 hex chars). */
function hashPassword(password: string, salt?: string): string {
  const s = salt || randomHex(16);
  const base = s + ":" + password;
  return `${s}:${djb2(base)}${djb2(base + djb2(base))}${djb2(djb2(base) + base)}`;
}

/**
 * Verify a password against a stored hash.
 * Detects old SHA-256 format (64 hex-char hash) vs new DJB2 (24 hex-char hash).
 * Old hashes are auto-migrated to DJB2 on successful verification.
 */
function verifyPassword(
  password: string,
  storedHash: string,
): { valid: boolean; migratedHash?: string } {
  const firstColon = storedHash.indexOf(":");
  if (firstColon === -1) return { valid: false };
  const salt = storedHash.substring(0, firstColon);
  const hashPart = storedHash.substring(firstColon + 1);

  // Detect format by hash length
  if (hashPart.length === 64) {
    // Old SHA-256 format: we CANNOT verify it with pure JS DJB2.
    // Return invalid — the account needs a password reset.
    return { valid: false };
  }

  // New DJB2 format
  const newHash = hashPassword(password, salt);
  if (newHash === storedHash) {
    return { valid: true };
  }
  return { valid: false };
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

async function getTeamAccountFromToken(ctx: any, token: string) {
  if (!token) return null;
  try {
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
  } catch {
    return null;
  }
}

async function createSession(ctx: any, teamAccountId: string): Promise<string> {
  const token = randomHex(32);
  await ctx.db.insert("teamSessions", {
    teamAccountId: teamAccountId as any,
    token,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    createdAt: Date.now(),
  });
  return token;
}

async function ensureTeamsExist(ctx: any): Promise<void> {
  for (const cat of TEAM_CATEGORIES) {
    try {
      const existing = await ctx.db
        .query("teams")
        .withIndex("by_slug", (q: any) => q.eq("slug", cat.slug))
        .unique();
      if (!existing) {
        await ctx.db.insert("teams", {
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          memberCount: 0,
          activeWorkCount: 0,
          status: "active",
          createdAt: Date.now(),
        });
      }
    } catch {
      // Ignore — team may already exist
    }
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const registerTeamAccount = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    skill: v.string(),
    teamCategory: v.string(),
    introduction: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const validSlugs: string[] = TEAM_CATEGORIES.map((c) => c.slug);
      if (!validSlugs.includes(args.teamCategory)) {
        throw new Error("Invalid team category. Please select a valid team.");
      }

      await ensureTeamsExist(ctx);

      const email = args.email.toLowerCase().trim();
      const existing = await ctx.db
        .query("teamAccounts")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (existing) {
        throw new Error("An account with this email already exists.");
      }

      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let teamId = "FX-";
      for (let i = 0; i < 6; i++) {
        teamId += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const pwChars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
      let plainPassword = "";
      for (let i = 0; i < 12; i++) {
        plainPassword += pwChars.charAt(Math.floor(Math.random() * pwChars.length));
      }

      const passwordHash = hashPassword(plainPassword);

      const team = await ctx.db
        .query("teams")
        .withIndex("by_slug", (q) => q.eq("slug", args.teamCategory))
        .unique();

      const accountId = await ctx.db.insert("teamAccounts", {
        teamId,
        name: args.name.trim(),
        email,
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

      await ctx.db.insert("teamApplications", {
        teamAccountId: accountId,
        name: args.name.trim(),
        email,
        phone: args.phone?.trim(),
        skill: args.skill.trim(),
        preferredTeamId: team?._id as any,
        introduction: args.introduction.trim(),
        password: passwordHash,
        status: "pending",
        createdAt: Date.now(),
      });

      return { teamId, password: plainPassword, accountId, teamCategory: args.teamCategory };
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error("Registration failed. Please try again.");
    }
  },
});

export const teamLogin = mutation({
  args: {
    teamId: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const normalizedId = args.teamId.toUpperCase().trim();

      const account = await ctx.db
        .query("teamAccounts")
        .withIndex("by_team_id", (q) => q.eq("teamId", normalizedId))
        .unique();

      if (!account) {
        throw new Error("Invalid Team ID or password.");
      }

      if (account.status === "pending") {
        throw new Error("Your account is pending admin approval. Please wait for activation.");
      }

      if (account.status === "suspended") {
        throw new Error("Your account has been suspended. Please contact the administrator.");
      }

      if (!account.passwordHash) {
        throw new Error("Invalid Team ID or password.");
      }

      const result = verifyPassword(args.password, account.passwordHash);

      if (!result.valid) {
        // Check if this is an old-format hash that needs migration
        const hashPart = account.passwordHash.substring(account.passwordHash.indexOf(":") + 1);
        if (hashPart.length === 64) {
          // Old SHA-256 hash — can't verify with DJB2. Reset password needed.
          throw new Error(
            "Your password needs to be reset. Please contact the administrator to reset your password, then try logging in again.",
          );
        }
        throw new Error("Invalid Team ID or password.");
      }

      // Migrate hash if needed (e.g., format changed)
      if (result.migratedHash) {
        await ctx.db.patch(account._id, { passwordHash: result.migratedHash });
      }

      await ctx.db.patch(account._id, { lastLoginAt: Date.now() });

      const token = await createSession(ctx, account._id);

      return {
        token,
        teamId: account.teamId,
        name: account.name,
        role: account.role,
        teamSlug: account.teamSlug,
        mustChangePassword: account.mustChangePassword,
      };
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error("We couldn't sign you in right now. Please try again.");
    }
  },
});

export const getTeamSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    try {
      const result = await getTeamAccountFromToken(ctx, args.token);
      if (!result) return null;
      const { account } = result;
      const membership = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_account", (q) => q.eq("teamAccountId", account._id))
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
          ? { teamId: membership.teamId, role: membership.role, status: membership.status }
          : null,
        team: team ? { _id: team._id, name: team.name, slug: team.slug } : null,
      };
    } catch {
      return null;
    }
  },
});

export const teamLogout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    try {
      const session = await ctx.db
        .query("teamSessions")
        .withIndex("by_token", (q) => q.eq("token", args.token))
        .unique();
      if (session) await ctx.db.delete(session._id);
    } catch {
      // Ignore
    }
    return true;
  },
});

export const teamChangePassword = mutation({
  args: {
    token: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await getTeamAccountFromToken(ctx, args.token);
    if (!result) throw new Error("Not authenticated.");

    const verification = verifyPassword(args.currentPassword, result.account.passwordHash);
    if (!verification.valid) throw new Error("Current password is incorrect.");

    if (args.newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }

    const newHash = hashPassword(args.newPassword);
    await ctx.db.patch(result.account._id, {
      passwordHash: newHash,
      mustChangePassword: false,
    });

    return true;
  },
});

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
      .withIndex("by_team_id", (q) => q.eq("teamId", args.teamId.toUpperCase().trim()))
      .unique();

    if (!account) throw new Error("No account found with that Team ID.");

    const existing = await ctx.db
      .query("teamPasswordRecovery")
      .withIndex("by_team_account", (q) => q.eq("teamAccountId", account._id))
      .collect();
    const pending = existing.find((r: any) => r.status === "pending");
    if (pending) {
      throw new Error("You already have a pending recovery request. Please wait for admin review.");
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

export const listPendingRecoveryRequests = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("teamPasswordRecovery")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const listAllTeamAccounts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teamAccounts").collect();
  },
});

export const listAllTeamApplications = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teamApplications").collect();
  },
});

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

    if (app.teamAccountId) {
      await ctx.db.patch(app.teamAccountId, {
        status: "active",
        teamSlug: args.teamSlug,
        role: args.role,
      });
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.teamSlug))
      .unique();

    if (team && app.teamAccountId) {
      const existingMembership = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_account", (q) => q.eq("teamAccountId", app.teamAccountId!))
        .unique();
      if (!existingMembership) {
        await ctx.db.insert("teamMemberships", {
          teamAccountId: app.teamAccountId,
          teamId: team._id,
          role: args.role,
          status: "active",
          joinedAt: Date.now(),
        });
        await ctx.db.patch(team._id, { memberCount: team.memberCount + 1 });
      }
    }

    await ctx.db.patch(args.applicationId, {
      status: "approved",
      reviewedAt: Date.now(),
    });

    return true;
  },
});

export const rejectTeamApplication = mutation({
  args: {
    applicationId: v.id("teamApplications"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found.");
    if (app.status !== "pending") throw new Error("Application already reviewed.");

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

export const adminResetTeamPassword = mutation({
  args: { teamAccountId: v.id("teamAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.teamAccountId);
    if (!account) throw new Error("Account not found.");

    const pwChars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let newPlain = "";
    for (let i = 0; i < 12; i++) {
      newPlain += pwChars.charAt(Math.floor(Math.random() * pwChars.length));
    }

    await ctx.db.patch(args.teamAccountId, {
      passwordHash: hashPassword(newPlain),
      mustChangePassword: true,
    });

    return { newPassword: newPlain };
  },
});

export const approvePasswordRecovery = mutation({
  args: { recoveryId: v.id("teamPasswordRecovery") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.recoveryId);
    if (!request) throw new Error("Recovery request not found.");
    if (request.status !== "pending") throw new Error("Already reviewed.");

    const pwChars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let newPlain = "";
    for (let i = 0; i < 12; i++) {
      newPlain += pwChars.charAt(Math.floor(Math.random() * pwChars.length));
    }

    await ctx.db.patch(request.teamAccountId, {
      passwordHash: hashPassword(newPlain),
      mustChangePassword: true,
    });

    await ctx.db.patch(args.recoveryId, {
      status: "approved",
      newTempPassword: newPlain,
      reviewedAt: Date.now(),
    });

    return { newPassword: newPlain };
  },
});

export const rejectPasswordRecovery = mutation({
  args: {
    recoveryId: v.id("teamPasswordRecovery"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.recoveryId);
    if (!request) throw new Error("Recovery request not found.");
    if (request.status !== "pending") throw new Error("Already reviewed.");

    await ctx.db.patch(args.recoveryId, { status: "rejected", reviewedAt: Date.now() });
    return true;
  },
});

export const toggleTeamAccountStatus = mutation({
  args: {
    teamAccountId: v.id("teamAccounts"),
    status: v.union(v.literal("active"), v.literal("suspended")),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.teamAccountId);
    if (!account) throw new Error("Account not found.");

    await ctx.db.patch(args.teamAccountId, { status: args.status });

    const membership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_account", (q) => q.eq("teamAccountId", args.teamAccountId))
      .unique();
    if (membership) {
      await ctx.db.patch(membership._id, {
        status: args.status === "active" ? "active" : "deactivated",
      });
    }

    return true;
  },
});

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

export const getTeamCategories = query({
  args: {},
  handler: async () => {
    return TEAM_CATEGORIES;
  },
});
