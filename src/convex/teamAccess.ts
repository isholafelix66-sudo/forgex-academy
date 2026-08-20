import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ---------------------------------------------------------------------------
// Password hashing (DJB2 multi-round)
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
// 4 Workspaces
// ---------------------------------------------------------------------------

export const WORKSPACES = [
  { slug: "academic", name: "Academic Support", description: "Academic operations, course quality, and learning support.", icon: "BookOpen", initialPassword: "ACADEMIC001" },
  { slug: "ai-support", name: "AI Support", description: "AI Hub, prompt resources, and AI-related tools.", icon: "Bot", initialPassword: "AI001" },
  { slug: "tutor-support", name: "Tutor Support", description: "Tutor-related support, onboarding, and tutor issues.", icon: "GraduationCap", initialPassword: "TUTOR00Y" },
  { slug: "student-support", name: "Student Support", description: "Student-facing support, issues, and student experience.", icon: "HeartHandshake", initialPassword: "STUDENT001" },
] as const;

// ---------------------------------------------------------------------------
// Public: List workspaces
// ---------------------------------------------------------------------------

export const listWorkspaces = query({
  args: {},
  handler: async () => {
    return WORKSPACES.map((w) => ({ slug: w.slug, name: w.name, description: w.description, icon: w.icon, isActive: true }));
  },
});

// ---------------------------------------------------------------------------
// Verify workspace password → returns a signed token
// ---------------------------------------------------------------------------

export const verifyWorkspacePassword = mutation({
  args: { workspaceSlug: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const ws = WORKSPACES.find((w) => w.slug === args.workspaceSlug);
    if (!ws) throw new Error("Workspace not found.");

    let access = await ctx.db
      .query("teamAccess")
      .withIndex("by_slug", (q) => q.eq("teamSlug", args.workspaceSlug))
      .unique();

    if (!access) {
      await ctx.db.insert("teamAccess", {
        teamSlug: ws.slug, teamName: ws.name, passwordHash: hashPassword(ws.initialPassword),
        isActive: true, createdAt: Date.now(), updatedAt: Date.now(),
      });
      access = await ctx.db
        .query("teamAccess")
        .withIndex("by_slug", (q) => q.eq("teamSlug", args.workspaceSlug))
        .unique();
      if (!access || !access.isActive) throw new Error("This workspace is currently unavailable.");
      if (!verifyPassword(args.password, access.passwordHash)) throw new Error("Incorrect password. Please try again.");
    } else {
      if (!access.isActive) throw new Error("This workspace is currently unavailable.");
      if (!verifyPassword(args.password, access.passwordHash)) throw new Error("Incorrect password. Please try again.");
    }

    const token = `${args.workspaceSlug}:${randomHex(24)}:${Date.now() + 30 * 24 * 60 * 60 * 1000}`;
    return { token, workspaceSlug: args.workspaceSlug, workspaceName: ws.name };
  },
});

// ---------------------------------------------------------------------------
// Validate workspace token
// ---------------------------------------------------------------------------

export const validateWorkspaceToken = query({
  args: { token: v.string(), workspaceSlug: v.string() },
  handler: async (ctx, args) => {
    if (!args.token || !args.workspaceSlug) return null;
    try {
      const parts = args.token.split(":");
      if (parts.length !== 3) return null;
      const [tokenSlug, , expiryStr] = parts;
      const expiry = parseInt(expiryStr, 10);
      if (tokenSlug !== args.workspaceSlug) return null;
      if (isNaN(expiry) || Date.now() > expiry) return null;
      const access = await ctx.db.query("teamAccess").withIndex("by_slug", (q) => q.eq("teamSlug", args.workspaceSlug)).unique();
      if (!access || !access.isActive) return null;
      const ws = WORKSPACES.find((w) => w.slug === args.workspaceSlug);
      if (!ws) return null;
      return { workspaceSlug: args.workspaceSlug, workspaceName: ws.name };
    } catch { return null; }
  },
});

// ---------------------------------------------------------------------------
// Admin functions
// ---------------------------------------------------------------------------

export const adminListWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const results = [];
    for (const ws of WORKSPACES) {
      const access = await ctx.db.query("teamAccess").withIndex("by_slug", (q) => q.eq("teamSlug", ws.slug)).unique();
      results.push({ slug: ws.slug, name: ws.name, description: ws.description, icon: ws.icon, isActive: access?.isActive ?? false, hasPassword: !!access?.passwordHash, updatedAt: access?.updatedAt, teamSlug: ws.slug, teamName: ws.name });
    }
    return results;
  },
});

export const adminChangeWorkspacePassword = mutation({
  args: { workspaceSlug: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 4) throw new Error("Password must be at least 4 characters.");
    const access = await ctx.db.query("teamAccess").withIndex("by_slug", (q) => q.eq("teamSlug", args.workspaceSlug)).unique();
    if (!access) throw new Error("Workspace not found.");
    await ctx.db.patch(access._id, { passwordHash: hashPassword(args.newPassword), updatedAt: Date.now() });
    return true;
  },
});


export const seedWorkspaces = mutation({
  args: {},
  handler: async (ctx) => {
    let seeded = 0;
    for (const ws of WORKSPACES) {
      const existing = await ctx.db.query("teamAccess").withIndex("by_slug", (q) => q.eq("teamSlug", ws.slug)).unique();
      if (!existing) {
        await ctx.db.insert("teamAccess", { teamSlug: ws.slug, teamName: ws.name, passwordHash: hashPassword(ws.initialPassword), isActive: true, createdAt: Date.now(), updatedAt: Date.now() });
        seeded++;
      }
    }
    return { seeded };
  },
});

// ---------------------------------------------------------------------------
// Backward-compat aliases — old frontend files reference these
// ---------------------------------------------------------------------------

/** @deprecated Use listWorkspaces */
export const listTeams = listWorkspaces;

/** @deprecated Use seedWorkspaces */
export const seedTeamAccess = seedWorkspaces;

/** @deprecated Use verifyWorkspacePassword. Accepts teamSlug for backward compat. */
export const verifyTeamPassword = mutation({
  args: { teamSlug: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const slug = args.teamSlug;
    const ws = WORKSPACES.find((w) => w.slug === slug);
    if (!ws) throw new Error("Workspace not found.");
    let access = await ctx.db.query("teamAccess").withIndex("by_slug", (q) => q.eq("teamSlug", slug)).unique();
    if (!access) {
      await ctx.db.insert("teamAccess", { teamSlug: ws.slug, teamName: ws.name, passwordHash: hashPassword(ws.initialPassword), isActive: true, createdAt: Date.now(), updatedAt: Date.now() });
      access = await ctx.db.query("teamAccess").withIndex("by_slug", (q) => q.eq("teamSlug", slug)).unique();
      if (!access || !access.isActive) throw new Error("This workspace is currently unavailable.");
      if (!verifyPassword(args.password, access.passwordHash)) throw new Error("Incorrect password. Please try again.");
    } else {
      if (!access.isActive) throw new Error("This workspace is currently unavailable.");
      if (!verifyPassword(args.password, access.passwordHash)) throw new Error("Incorrect password. Please try again.");
    }
    const token = `${slug}:${randomHex(24)}:${Date.now() + 30 * 24 * 60 * 60 * 1000}`;
    return { token, teamSlug: slug, teamName: ws.name, workspaceSlug: slug, workspaceName: ws.name };
  },
});

/** @deprecated No-op — workspace tokens don't need server-side logout */
export const logout = mutation({
  args: { token: v.string() },
  handler: async () => true,
});

/** @deprecated Backward compat — accepts {token} without workspaceSlug */
export const getSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    try {
      const parts = args.token.split(":");
      if (parts.length !== 3) return null;
      const [tokenSlug, , expiryStr] = parts;
      const expiry = parseInt(expiryStr, 10);
      if (isNaN(expiry) || Date.now() > expiry) return null;
      const access = await ctx.db.query("teamAccess").withIndex("by_slug", (q) => q.eq("teamSlug", tokenSlug)).unique();
      if (!access || !access.isActive) return null;
      const ws = WORKSPACES.find((w) => w.slug === tokenSlug);
      if (!ws) return null;
      return { teamSlug: tokenSlug, teamName: ws.name, workspaceSlug: tokenSlug, workspaceName: ws.name };
    } catch { return null; }
  },
});

/** @deprecated Use adminListWorkspaces */
export const adminListTeams = adminListWorkspaces;

/** @deprecated Use adminChangeWorkspacePassword. Accepts teamSlug for backward compat. */
export const adminChangePassword = mutation({
  args: { teamSlug: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 4) throw new Error("Password must be at least 4 characters.");
    const access = await ctx.db.query("teamAccess").withIndex("by_slug", (q) => q.eq("teamSlug", args.teamSlug)).unique();
    if (!access) throw new Error("Workspace not found.");
    await ctx.db.patch(access._id, { passwordHash: hashPassword(args.newPassword), updatedAt: Date.now() });
    return true;
  },
});

/** @deprecated No toggle needed — use adminChangeWorkspacePassword */
export const adminToggleTeam = mutation({
  args: { teamSlug: v.string(), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const access = await ctx.db.query("teamAccess").withIndex("by_slug", (q) => q.eq("teamSlug", args.teamSlug)).unique();
    if (!access) throw new Error("Workspace not found.");
    await ctx.db.patch(access._id, { isActive: args.isActive, updatedAt: Date.now() });
    return true;
  },
});
