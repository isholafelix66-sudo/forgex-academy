import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { ROLES, socialsValidator } from "./schema";
import { notify, requireUser, requireUserDoc } from "./lib";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return null;
    return user;
  },
});

/** Internal helper: current user document or null. */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
};

/** First sign-in setup: assign default role, capture name, mark onboarded. */
export const initializeUser = mutation({
  args: { name: v.optional(v.string()) },
  handler: async (ctx, { name }) => {
    const user = await requireUserDoc(ctx);
    const patch: Record<string, unknown> = {};
    if (!user.role) patch.role = ROLES.STUDENT;
    if (!user.onboarded) patch.onboarded = true;
    if (name && !user.name) patch.name = name;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
    }
    return await ctx.db.get(user._id);
  },
});

/** Update the student's public profile. */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    socials: v.optional(socialsValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUserDoc(ctx);
    await ctx.db.patch(user._id, args);
    return await ctx.db.get(user._id);
  },
});

/** True when no real (non-seed) admin account exists yet. */
export const hasAdmins = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("users").collect();
    return all.some((u) => u.role === ROLES.ADMIN && !u.isSeed);
  },
});

/** Promote the caller to admin — only allowed while no real admin exists. */
export const claimAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUserDoc(ctx);
    const all = await ctx.db.query("users").collect();
    if (all.some((u) => u.role === ROLES.ADMIN && !u.isSeed)) {
      throw new Error("An administrator already exists.");
    }
    await ctx.db.patch(user._id, { role: ROLES.ADMIN });
    await notify(ctx, {
      userId: user._id,
      title: "Administrator access granted",
      body: "You are now an administrator of ForgeX Academy. The Admin Dashboard is unlocked.",
      type: "role",
      link: "/admin",
    });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Tutor application flow
// ---------------------------------------------------------------------------

export const submitTutorApplication = mutation({
  args: {
    headline: v.string(),
    bio: v.string(),
    expertise: v.array(v.string()),
    socials: v.optional(socialsValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUserDoc(ctx);
    const existing = await ctx.db
      .query("tutorApplications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (existing && existing.status === "pending") {
      throw new Error("You already have an application under review.");
    }
    const id = await ctx.db.insert("tutorApplications", {
      userId: user._id,
      status: "pending",
      headline: args.headline,
      bio: args.bio,
      expertise: args.expertise,
      socials: args.socials,
      submittedAt: Date.now(),
    });
    await notify(ctx, {
      userId: user._id,
      title: "Application submitted",
      body: "Your tutor application is under review. You'll be notified once an admin verifies your account.",
      type: "tutor",
      link: "/become-tutor",
    });
    return id;
  },
});

export const myTutorApplication = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return await ctx.db
      .query("tutorApplications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const cancelTutorApplication = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUserDoc(ctx);
    const app = await ctx.db
      .query("tutorApplications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (app && app.status === "pending") {
      await ctx.db.delete(app._id);
    }
    return true;
  },
});
