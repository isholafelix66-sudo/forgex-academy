import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ---------------------------------------------------------------------------
// Password hashing — same DJB2 multi-round as teamAuth.ts
// ---------------------------------------------------------------------------

function randomHex(n: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < n; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function hashPassword(password: string, salt?: string): string {
  const s = salt || randomHex(16);
  const base = s + ":" + password;
  return `${s}:${djb2(base)}${djb2(base + djb2(base))}${djb2(djb2(base) + base)}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const firstColon = storedHash.indexOf(":");
  if (firstColon === -1) return false;
  const salt = storedHash.substring(0, firstColon);
  return hashPassword(password, salt) === storedHash;
}

// ---------------------------------------------------------------------------
// Default teams
// ---------------------------------------------------------------------------

const DEFAULT_TEAMS = [
  { slug: "academic", name: "Academic Team", description: "Academic operations, academic quality, and learning support." },
  { slug: "tutor-support", name: "Tutor Support", description: "Tutor-related support and tutor issues." },
  { slug: "student-support", name: "Student Support", description: "Student-facing support, student issues, and student experience." },
  { slug: "content", name: "Content Team", description: "Content, learning materials, and content-related operations." },
  { slug: "ai-prompts", name: "AI & Prompt Team", description: "AI Hub, prompt resources, AI-related tools, and prompt-library operations." },
] as const;

// Initial passwords (seeded once, then only admin can change)
const INITIAL_PASSWORDS: Record<string, string> = {
  "academic": "ACADEMIC001",
  "tutor-support": "TUTOR001",
  "student-support": "STUDENT001",
  "content": "CONTENT001",
  "ai-prompts": "AIPROMPT001",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSessionFromToken(ctx: any, token: string) {
  if (!token) return null;
  const session = await ctx.db
    .query("teamAccessSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .unique();
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    await ctx.db.delete(session._id);
    return null;
  }
  const access = await ctx.db
    .query("teamAccess")
    .withIndex("by_slug", (q: any) => q.eq("teamSlug", session.teamSlug))
    .unique();
  if (!access || !access.isActive) return null;
  return { session, access };
}

// ---------------------------------------------------------------------------
// Seed initial team access records (idempotent)
// ---------------------------------------------------------------------------

export const seedTeamAccess = mutation({
  args: {},
  handler: async (ctx) => {
    let seeded = 0;
    for (const team of DEFAULT_TEAMS) {
      const existing = await ctx.db
        .query("teamAccess")
        .withIndex("by_slug", (q) => q.eq("teamSlug", team.slug))
        .unique();
      if (!existing) {
        const pw = INITIAL_PASSWORDS[team.slug] || "CHANGEME001";
        await ctx.db.insert("teamAccess", {
          teamSlug: team.slug,
          teamName: team.name,
          passwordHash: hashPassword(pw),
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        seeded++;
      }
    }
    return { seeded };
  },
});

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/** List all teams for the Team Hub (public — no auth needed). */
export const listTeams = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("teamAccess").collect();
    return all.map((t) => ({
      slug: t.teamSlug,
      name: t.teamName,
      isActive: t.isActive,
    }));
  },
});

/** Verify a password against a team and create a session. */
export const verifyTeamPassword = mutation({
  args: {
    teamSlug: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.db
      .query("teamAccess")
      .withIndex("by_slug", (q) => q.eq("teamSlug", args.teamSlug))
      .unique();

    if (!access) {
      throw new Error("Team not found.");
    }

    if (!access.isActive) {
      throw new Error("This team is currently unavailable. Please contact the Admin.");
    }

    if (!verifyPassword(args.password, access.passwordHash)) {
      throw new Error("Incorrect team password. Please try again.");
    }

    // Create session
    const token = randomHex(32);
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    await ctx.db.insert("teamAccessSessions", {
      teamSlug: args.teamSlug,
      token,
      expiresAt,
      createdAt: Date.now(),
    });

    return {
      token,
      teamSlug: args.teamSlug,
      teamName: access.teamName,
      expiresAt,
    };
  },
});

/** Validate an existing session token. Returns team info or null. */
export const getSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    const result = await getSessionFromToken(ctx, args.token);
    if (!result) return null;
    return {
      teamSlug: result.access.teamSlug,
      teamName: result.access.teamName,
      expiresAt: result.session.expiresAt,
    };
  },
});

/** Destroy a session (logout). */
export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return true;
    const session = await ctx.db
      .query("teamAccessSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (session) await ctx.db.delete(session._id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Admin-only mutations
// ---------------------------------------------------------------------------

/** Admin changes a team's password. */
export const adminChangePassword = mutation({
  args: {
    teamSlug: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    const access = await ctx.db
      .query("teamAccess")
      .withIndex("by_slug", (q) => q.eq("teamSlug", args.teamSlug))
      .unique();

    if (!access) throw new Error("Team not found.");

    await ctx.db.patch(access._id, {
      passwordHash: hashPassword(args.newPassword),
      updatedAt: Date.now(),
    });

    // Invalidate all existing sessions for this team
    const sessions = await ctx.db
      .query("teamAccessSessions")
      .withIndex("by_slug", (q) => q.eq("teamSlug", args.teamSlug))
      .collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
    }

    return true;
  },
});

/** Admin toggles a team's active/disabled status. */
export const adminToggleTeam = mutation({
  args: {
    teamSlug: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.db
      .query("teamAccess")
      .withIndex("by_slug", (q) => q.eq("teamSlug", args.teamSlug))
      .unique();

    if (!access) throw new Error("Team not found.");

    await ctx.db.patch(access._id, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    // If disabling, invalidate all sessions
    if (!args.isActive) {
      const sessions = await ctx.db
        .query("teamAccessSessions")
        .withIndex("by_slug", (q) => q.eq("teamSlug", args.teamSlug))
        .collect();
      for (const s of sessions) {
        await ctx.db.delete(s._id);
      }
    }

    return true;
  },
});

/** Admin lists all teams with status info. */
export const adminListTeams = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("teamAccess").collect();
    return all.map((t) => ({
      _id: t._id,
      teamSlug: t.teamSlug,
      teamName: t.teamName,
      isActive: t.isActive,
      hasPassword: !!t.passwordHash,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  },
});
