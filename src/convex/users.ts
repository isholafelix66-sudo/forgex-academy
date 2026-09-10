import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { internalQuery, mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { ROLES, socialsValidator } from "./schema";
import { checkRateLimit, notify, publicUser, requireUser, requireUserDoc, nameFromEmail } from "./lib";
import { welcomeEmail } from "./emailTemplates";
import { deleteUserData } from "./admin";

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

/** Internal query: is this admin session token still valid? (for actions). */
export const internalAdminSessionValid = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!session) return false;
    return Date.now() - session.createdAt <= 12 * 60 * 60 * 1000;
  },
});

/** Record the user's last activity (called from the app shell). */
export const touchActivity = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    // Not signed in (visitors / password-gated admin sessions) — nothing to record.
    if (userId === null) return false;
    const now = Date.now();
    const user = await ctx.db.get(userId);
    if (user && (!user.lastActivity || now - user.lastActivity > 5 * 60 * 1000)) {
      await ctx.db.patch(userId, { lastActivity: now });
    }
    return true;
  },
});

/**
 * Presence heartbeat — called while the app is open so other users can see
 * “online / offline”. Writes `lastActivity` every ~25s; a user is considered
 * online when their last activity is within the last 60 seconds.
 *
 * Note: this deliberately NO-OPS for signed-out callers instead of throwing,
 * so the globally-mounted chat widget can never spam server errors.
 */
export const presenceHeartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    await ctx.db.patch(userId, { lastActivity: Date.now() });
    return true;
  },
});

/**
 * Search platform users (tutors, students, admins) to start a new
 * conversation. Excludes yourself and seeded demo accounts.
 */
export const searchUsers = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const me = await requireUserDoc(ctx);
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => u._id !== me._id && !u.isSeed)
      .filter((u) => {
        const name = (u.name ?? "").toLowerCase();
        const email = (u.email ?? "").toLowerCase();
        return name.includes(term) || email.includes(term);
      })
      .slice(0, 15)
      .map((u) => ({
        _id: u._id,
        name: u.name || "Anonymous",
        image: u.image ?? null,
        role: u.role ?? "student",
        headline: u.headline ?? null,
        online: !!u.lastActivity && Date.now() - u.lastActivity < 60_000,
      }));
  },
});

/** Public-safe profile of any user (used to start a new conversation). */
export const getPublicUser = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    const u = await ctx.db.get(id);
    return u ? publicUser(u) : null;
  },
});

/**
 * First sign-in setup: assign default role, capture name, mark onboarded.
 *
 * Role assignment is the single source of truth for the account's identity
 * — ONE account = ONE role, and the role is never guessed from a profile.
 *
 *  • The role is only ever set ONCE (when the account has none). It is never
 *    overwritten afterwards, so an approved tutor can never be re-labelled
 *    as a student by signing in again.
 *  • The role comes from the signup intent first: signing up through the
 *    Become-a-Tutor flow creates a TUTOR account (pending verification), not
 *    a student account. A plain student signup creates a STUDENT account.
 *  • Existing accounts that already submitted a tutor application are also
 *    treated as tutor accounts — the application is the intent.
 */
export const initializeUser = mutation({
  args: {
    name: v.optional(v.string()),
    intendedRole: v.optional(
      v.union(v.literal("student"), v.literal("tutor")),
    ),
  },
  handler: async (ctx, { name, intendedRole }) => {
    const user = await requireUserDoc(ctx);
    await checkRateLimit(ctx, `profile:${user._id}`, 60, 60 * 60 * 1000);
    const patch: Record<string, unknown> = {};
    if (!user.role) {
      // A tutor application (any status) is intent to teach — the account is
      // a tutor account from that moment on, never a student one.
      const hasApplication = !!(await ctx.db
        .query("tutorApplications")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first());
      patch.role =
        intendedRole === "tutor" || hasApplication
          ? ROLES.TUTOR
          : ROLES.STUDENT;
    }
    if (!user.onboarded) {
      patch.onboarded = true;
      // Transactional email: one-time welcome via Gmail SMTP (never blocks
      // onboarding — failures are logged, not thrown).
      const email = "email" in user ? String(user.email ?? "") : "";
      if (email) {
        try {
          await ctx.runMutation(internal.emailData.queueSystemEmail, {
            to: email,
            subject: "Welcome to ForgeX Academy 🎉",
            html: welcomeEmail({ name: name || "there" }).html,
            emailType: "welcome",
          });
        } catch {
          // email must never break onboarding
        }
      }
    }
    // Name backfill: accounts created before the email-derived naming (or
    // any that slipped through without one) get a friendly name from their
    // email prefix — never "Anonymous". An explicit signup name always wins;
    // a stored name is never overwritten.
    if (!user.name) {
      const email = "email" in user ? String(user.email ?? "") : "";
      const derived = nameFromEmail(email);
      if (derived) patch.name = derived;
    }
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
    await checkRateLimit(ctx, `profile:${user._id}`, 60, 60 * 60 * 1000);
    // Hard security: never trust client payloads wholesale — normalize lengths
    // and shapes so oversized / malformed profiles can't be stored.
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      patch.name = args.name.trim().slice(0, 80);
    }
    if (args.image !== undefined) {
      patch.image = args.image.trim().slice(0, 500);
    }
    if (args.headline !== undefined) {
      patch.headline = args.headline.trim().slice(0, 120);
    }
    if (args.bio !== undefined) {
      patch.bio = args.bio.trim().slice(0, 2000);
    }
    if (args.skills !== undefined) {
      patch.skills = args.skills
        .map((s) => s.trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 20);
    }
    if (args.socials !== undefined) patch.socials = args.socials;
    await ctx.db.patch(user._id, patch);
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
  // admin-configured custom form fields (label -> answer)
  customAnswers: v.optional(
    v.record(v.string(), v.union(v.string(), v.array(v.string()))),
  ),
};

export const saveTutorApplication = mutation({
  args: {
    ...applicationFields,
    submit: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserDoc(ctx);
    // Abuse guard: max 30 application saves per user per hour.
    await checkRateLimit(ctx, `profile:${user._id}`, 30, 60 * 60 * 1000);
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

    let appId = existing?._id as never; // set below for brand-new applications
    const confirmSubmitted = async () => {
      await notify(ctx, {
        userId: user._id,
        title: "Application submitted",
        body: "Your tutor application is in for review. Expect a decision within 24 hours or less — we'll email you as soon as an admin decides.",
        type: "tutor",
        link: "/become-tutor",
      });
      // Staff alert: a new tutor application is awaiting review.
      await ctx.scheduler.runAfter(0, internal.emailTriggers.notifyStaffNewTutorApplication, {
        applicationId: appId,
        applicantName: fields.fullName || user.name || "A tutor",
      });
      // Respect the Email Center toggle for this automation.
      const regAuto = await ctx.db
        .query("emailAutomations")
        .withIndex("by_key", (q) => q.eq("key", "tutor_registration_received"))
        .first();
      if (fields.email && regAuto?.enabled !== false) {
        const site = (process.env.SITE_URL ?? "https://forgex.academy").replace(/\/$/, "");
        await ctx.runMutation(internal.emailData.queueSystemEmail, {
          to: fields.email,
          emailType: "tutor_registration_received",
          automationKey: "tutor_registration_received",
          priority: "high",
          subject: "We received your tutor application 📬",
          html: `
            <div style="background:#0d0f0c;color:#e7e5e4;font-family:Segoe UI,Arial,sans-serif;padding:32px 16px">
              <div style="max-width:560px;margin:0 auto;background:#14170f;border:1px solid #2a2e22;border-radius:16px;overflow:hidden">
                <div style="background:#a3e635;padding:20px 28px"><p style="margin:0;color:#0d0f0c;font-weight:800;font-size:18px">⚡ ForgeX Academy</p></div>
                <div style="padding:28px">
                  <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#a3e635">Application received ✓</p>
                  <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#d6d3d1">Hi ${fields.fullName},</p>
                  <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#d6d3d1">Thanks for applying to teach on ForgeX Academy. Your application is now under review.</p>
                  <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#d6d3d1">Most decisions are made within <b>24 hours or less</b> — we'll email you the moment an admin approves, verifies or needs more from you.</p>
                  <div style="margin-top:24px">
                    <a href="${site}/become-tutor" style="display:inline-block;background:#a3e635;color:#0d0f0c;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">Check application status</a>
                  </div>
                </div>
                <div style="padding:16px 28px;border-top:1px solid #2a2e22;font-size:12px;color:#78716c">You're receiving this because you applied to teach on ForgeX Academy.</div>
              </div>
            </div>`,
          text: `Hi ${fields.fullName},\n\nThanks for applying to teach on ForgeX Academy. Your application is now under review.\n\nMost decisions are made within 24 hours or less — we'll email you the moment an admin approves, verifies or needs more from you.\n\nCheck application status: ${site}/become-tutor`,
        });
      }
    };

    if (existing) {
      await ctx.db.patch(existing._id, { ...base, status: nextStatus });
      if (submit) await confirmSubmitted();
      return existing._id;
    }

    const id = await ctx.db.insert("tutorApplications", {
      ...base,
      status: nextStatus,
      wasVerified: false,
    });
    appId = id as never;
    if (submit) await confirmSubmitted();
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

// ---------------------------------------------------------------------------
// Account self-deletion — exposed in Profile → Account Management.
// Reuses the admin deleteUserData helper so exactly the same records are
// removed (enrollments, certificates, submissions, attempts, applications,
// notifications, messages, owned courses + content, auth accounts, user doc).
// ---------------------------------------------------------------------------

export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const user = await ctx.db.get(userId);
    if (!user) return false;
    // Tutors keep their application trail — only an admin may remove a tutor
    // account so verified tutors can never self-destruct mid-course.
    if (user.role === "tutor") {
      throw new Error(
        "Tutor accounts must be deleted by an administrator. Please contact support.",
      );
    }
    await deleteUserData(ctx, userId);
    return true;
  },
});
