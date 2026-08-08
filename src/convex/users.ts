import { getAuthUserId } from "@convex-dev/auth/server";
import { internalQuery, mutation, query, QueryCtx } from "./_generated/server";
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

/** Internal query used by actions that need the caller's role/verified flags. */
export const internalCurrentUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

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

// ---------------------------------------------------------------------------
// Tutor application flow — the tutor owns & maintains this data.
// Admins may only review / verify — never edit it.
// ---------------------------------------------------------------------------

const applicationFields = {
  fullName: v.string(),
  email: v.string(),
  phone: v.string(),
  profilePictureUrl: v.optional(v.string()),
  residentialAddress: v.string(),
  city: v.string(),
  state: v.string(),
  country: v.string(),
  professionalTitle: v.string(),
  biography: v.string(),
  yearsOfExperience: v.string(),
  currentOccupation: v.string(),
  highestQualification: v.string(),
  fieldOfStudy: v.string(),
  institution: v.string(),
  graduationYear: v.string(),
  skills: v.array(v.string()),
  areasOfExpertise: v.string(),
  teachingExperience: v.string(),
  teachingSubjects: v.array(v.string()),
  teachingFormat: v.string(),
  teachingStatement: v.string(),
  whyForgeX: v.string(),
  cvUrl: v.optional(v.string()),
  cvFileName: v.optional(v.string()),
  nin: v.string(),
  linkedin: v.optional(v.string()),
  website: v.optional(v.string()),
  portfolio: v.optional(v.string()),
  github: v.optional(v.string()),
  youtube: v.optional(v.string()),
  otherLink: v.optional(v.string()),
  acceptedAgreement: v.boolean(),
};

export const saveTutorApplication = mutation({
  args: {
    ...applicationFields,
    submit: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserDoc(ctx);
    const { submit, ...fields } = args;
    const existing = await ctx.db
      .query("tutorApplications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Only the owner can edit; an admin never touches this data.
    const nextStatus = submit ? "submitted" : "draft";
    const base = {
      ...fields,
      userId: user._id,
      updatedAt: Date.now(),
      submittedAt: submit ? Date.now() : existing?.submittedAt,
      reviewedAt: undefined,
      reviewedBy: undefined,
      reviewNote: undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, { ...base, status: nextStatus });
      if (submit) {
        await notify(ctx, {
          userId: user._id,
          title: "Application submitted",
          body: "Your tutor application is in for review. You'll be notified when a decision is made.",
          type: "tutor",
          link: "/become-tutor",
        });
      }
      return existing._id;
    }

    const id = await ctx.db.insert("tutorApplications", {
      ...base,
      status: nextStatus,
      wasVerified: false,
    });
    if (submit) {
      await notify(ctx, {
        userId: user._id,
        title: "Application submitted",
        body: "Your tutor application is in for review. You'll be notified when a decision is made.",
        type: "tutor",
        link: "/become-tutor",
      });
    }
    return id;
  },
});

/** Tutor's own application (public-facing fields only, no admin data). */
export const myTutorApplication = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const user = await ctx.db.get(userId);
    const app = await ctx.db
      .query("tutorApplications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!app) return null;
    return {
      ...app,
      verified: !!user?.verified,
    };
  },
});
