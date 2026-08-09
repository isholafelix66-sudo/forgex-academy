import { internal } from "./_generated/api";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { hydrateCourse, hydrateCourses, makeAdminToken, notify, publicUser, requireAdminSession, slugify } from "./lib";
import { difficultyValidator, ROLES, roleValidator } from "./schema";

// ---------------------------------------------------------------------------
// Admin password gate (access is URL-only: /admin + this password)
//
// The Admin Dashboard is unlocked purely by the access password. No user
// account is involved — the password gate issues a session token that every
// admin function validates. Default password: "Discovery" (case-insensitive),
// overridable via the ADMIN_ACCESS_PASSWORD environment key.
// ---------------------------------------------------------------------------

const ADMIN_PASSWORD = process.env.ADMIN_ACCESS_PASSWORD ?? "Discovery";

const matches = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** Verify the admin access password and mint a session token. */
export const verifyAccessPassword = mutation({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    if (!matches(password, ADMIN_PASSWORD)) {
      throw new Error("Incorrect access password.");
    }
    const token = makeAdminToken();
    await ctx.db.insert("adminSessions", { token, createdAt: Date.now() });
    await audit(ctx, undefined, undefined, "admin-access", "Admin dashboard unlocked with password");
    return { token };
  },
});

/** Whether a session token is still valid (client calls on every admin page). */
export const isAdminUnlocked = query({
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

/** Invalidate a session token (locks the dashboard). */
export const lockAdmin = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (session) await ctx.db.delete(session._id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export const stats = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const [users, courses, enrollments, certificates, applications] =
      await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db.query("courses").collect(),
        ctx.db.query("enrollments").collect(),
        ctx.db.query("certificates").collect(),
        ctx.db.query("tutorApplications").collect(),
      ]);
    const real = users.filter((u) => !u.isSeed);
    const pendingApplications = applications.filter(
      (a) => a.status === "submitted" || a.status === "under-review",
    );
    return {
      users: real.length,
      students: real.filter((u) => u.role === ROLES.STUDENT).length,
      tutors: real.filter((u) => u.role === ROLES.TUTOR).length,
      verifiedTutors: real.filter((u) => u.role === ROLES.TUTOR && !!u.verified).length,
      admins: real.filter((u) => u.role === ROLES.ADMIN).length,
      courses: courses.length,
      publishedCourses: courses.filter((c) => c.published && !c.archived).length,
      archivedCourses: courses.filter((c) => c.archived).length,
      enrollments: enrollments.length,
      certificates: certificates.length,
      pendingApplications: pendingApplications.length,
      recentUsers: real
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 6)
        .map((u) => ({
          _id: u._id,
          name: u.name ?? "Unnamed",
          image: u.image ?? null,
          email: u.email ?? null,
          role: u.role ?? "student",
          suspended: !!u.suspended,
          createdAt: u._creationTime,
        })),
      recentApplications: applications
        .sort((a, b) => (b.submittedAt ?? b.updatedAt ?? 0) - (a.submittedAt ?? a.updatedAt ?? 0))
        .slice(0, 6)
        .map((a) => ({
          _id: a._id,
          fullName: a.fullName,
          professionalTitle: a.professionalTitle,
          status: a.status,
          submittedAt: a.submittedAt ?? null,
        })),
      recentCourses: courses
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 6)
        .map((c) => ({
          _id: c._id,
          title: c.title,
          slug: c.slug,
          status: c.status ?? "draft",
          published: c.published,
          archived: !!c.archived,
          createdAt: c.createdAt,
        })),
    };
  },
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const usersList = query({
  args: {
    search: v.optional(v.string()),
    role: v.optional(roleValidator),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("verified"),
        v.literal("suspended"),
      ),
    ),
    token: v.string(),
  },
  handler: async (ctx, { search, role, status, token }) => {
    await requireAdminSession(ctx, token);
    const users = await ctx.db.query("users").collect();
    const [enrollments, certificates, applications] = await Promise.all([
      ctx.db.query("enrollments").collect(),
      ctx.db.query("certificates").collect(),
      ctx.db.query("tutorApplications").collect(),
    ]);
    const q = (search ?? "").trim().toLowerCase();
    const hydrated = users
      .map((u) => {
        const app = applications.find((a) => a.userId === u._id);
        return {
          ...publicUser(u),
          email: u.email ?? null,
          bio: u.bio ?? "",
          skills: u.skills ?? [],
          isAnonymous: !!u.isAnonymous,
          isSeed: !!u.isSeed,
          suspended: !!u.suspended,
          lastActivity: u.lastActivity ?? null,
          appStatus: app?.status ?? null,
          enrollments: enrollments.filter((e) => e.studentId === u._id).length,
          certificates: certificates.filter((c) => c.studentId === u._id).length,
          joinedAt: u._creationTime,
        };
      })
      .filter((u) => {
        if (q && !u.name.toLowerCase().includes(q) && !(u.email ?? "").toLowerCase().includes(q)) return false;
        if (role && u.role !== role) return false;
        if (status === "suspended" && !u.suspended) return false;
        if (status === "verified" && !(u.role === ROLES.TUTOR && u.verified)) return false;
        if (status === "approved" && u.appStatus !== "approved") return false;
        if (status === "pending" && u.appStatus !== "submitted" && u.appStatus !== "under-review" && u.appStatus !== "information-required") return false;
        return true;
      });
    return hydrated.sort((a, b) => b.joinedAt - a.joinedAt);
  },
});

/** Lightweight id/name/role list for dropdowns (e.g. assigning course tutors). */
export const userOptions = query({
  args: { token: v.string(), role: v.optional(roleValidator) },
  handler: async (ctx, { token, role }) => {
    await requireAdminSession(ctx, token);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => !role || u.role === role)
      .map((u) => ({
        _id: u._id,
        name: u.name ?? "Unnamed",
        role: u.role ?? "student",
        isSeed: !!u.isSeed,
        suspended: !!u.suspended,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Suspend a user account (blocks access but keeps their data). */
export const suspendUser = mutation({
  args: { userId: v.id("users"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.patch(userId, { suspended: true });
    await audit(ctx, undefined, userId, "user-suspended", `User suspended: ${(await ctx.db.get(userId))?.name ?? userId}`);
    return true;
  },
});

/** Reactivate a suspended account. */
export const reactivateUser = mutation({
  args: { userId: v.id("users"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.patch(userId, { suspended: false });
    await audit(ctx, undefined, userId, "user-reactivated", `User reactivated: ${(await ctx.db.get(userId))?.name ?? userId}`);
    return true;
  },
});

/** Permanently delete a user and all associated records (enrollments,
 *  certificates, applications, submissions, attempts, messages, notifications,
 *  their courses + course content, and auth accounts). */
export const deleteUser = mutation({
  args: { userId: v.id("users"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    await requireAdminSession(ctx, token);
    const user = await ctx.db.get(userId);
    if (!user) return false;
    await deleteUserData(ctx, userId);
    await audit(ctx, undefined, undefined, "user-deleted", `User permanently deleted: ${user.name ?? user.email ?? userId} (+ associated records)`);
    return true;
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("users"), role: roleValidator, token: v.string() },
  handler: async (ctx, { userId, role, token }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.patch(userId, { role });
    await notify(ctx, {
      userId,
      title:
        role === ROLES.TUTOR
          ? "You're now a tutor! 🎓"
          : `Role updated to ${role}`,
      body:
        role === ROLES.TUTOR
          ? "An admin granted you the tutor role. The Tutor Dashboard is unlocked."
          : "Your account role was updated by an administrator.",
      type: "role",
      link: role === ROLES.TUTOR ? "/tutor" : "/dashboard",
    });
    return true;
  },
});

export const setUserVerified = mutation({
  args: { userId: v.id("users"), verified: v.boolean(), token: v.string() },
  handler: async (ctx, { userId, verified, token }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.patch(userId, { verified });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

async function audit(
  ctx: MutationCtx,
  adminId: string | undefined,
  tutorId: string | undefined,
  action: string,
  detail: string,
  reason?: string,
) {
  await ctx.db.insert("auditLogs", {
    adminId: adminId ? (adminId as never) : undefined,
    tutorId: tutorId ? (tutorId as never) : undefined,
    action,
    detail,
    reason,
    createdAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Tutor applications — READ-ONLY review portal
// ---------------------------------------------------------------------------

export const tutorApplications = query({
  args: { search: v.optional(v.string()), token: v.string() },
  handler: async (ctx, { search, token }) => {
    await requireAdminSession(ctx, token);
    const apps = await ctx.db.query("tutorApplications").collect();
    const q = (search ?? "").trim().toLowerCase();
    const hydrated = await Promise.all(
      apps.map(async (a) => {
        const user = await ctx.db.get(a.userId);
        return {
          ...a,
          user: user ? publicUser(user) : null,
        };
      }),
    );
    return hydrated
      .filter(
        (a) =>
          !q ||
          a.fullName.toLowerCase().includes(q) ||
          a.professionalTitle.toLowerCase().includes(q) ||
          (a.user?.name ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => (b.submittedAt ?? b.updatedAt ?? 0) - (a.submittedAt ?? a.updatedAt ?? 0));
  },
});

/** Full application detail — admin only. Contains private NIN / CV / contact data. */
export const applicationDetail = query({
  args: { id: v.id("tutorApplications"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    await requireAdminSession(ctx, token);
    const app = await ctx.db.get(id);
    if (!app) return null;
    const user = await ctx.db.get(app.userId);
    const auditRows = await ctx.db
      .query("auditLogs")
      .withIndex("by_tutor", (q) => q.eq("tutorId", app.userId))
      .collect();
    return {
      ...app,
      user: user ? publicUser(user) : null,
      auditRows: auditRows.sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

const SITE_URL = process.env.SITE_URL ?? "https://forgex.academy";

/** Build the transactional email body for an application decision. */
function decisionEmail(
  action: string,
  fullName: string,
  reason?: string,
): { subject: string; html: string; text: string } | null {
  const site = SITE_URL.replace(/\/$/, "");
  const shell = (heading: string, lines: string[], cta: { label: string; href: string }) => `
    <div style="background:#0d0f0c;color:#e7e5e4;font-family:Segoe UI,Arial,sans-serif;padding:32px 16px">
      <div style="max-width:560px;margin:0 auto;background:#14170f;border:1px solid #2a2e22;border-radius:16px;overflow:hidden">
        <div style="background:#a3e635;padding:20px 28px">
          <p style="margin:0;color:#0d0f0c;font-weight:800;font-size:18px">⚡ ForgeX Academy</p>
        </div>
        <div style="padding:28px">
          <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#a3e635">${heading}</p>
          ${lines.map((l) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#d6d3d1">${l}</p>`).join("")}
          <div style="margin-top:24px">
            <a href="${cta.href}" style="display:inline-block;background:#a3e635;color:#0d0f0c;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">${cta.label}</a>
          </div>
        </div>
        <div style="padding:16px 28px;border-top:1px solid #2a2e22;font-size:12px;color:#78716c">
          You're receiving this because you applied to teach on ForgeX Academy.
        </div>
      </div>
    </div>`;
  const plain = (lines: string[], cta: { label: string; href: string }) =>
    `${lines.join("\n\n")}\n\n${cta.label}: ${cta.href}`;

  switch (action) {
    case "approve":
      return {
        subject: "Your ForgeX Academy tutor application was approved 🎉",
        html: shell("Application approved 🎉", [
          `Hi ${fullName},`, "Our admin team approved your application.",
          "The tutor dashboard unlocks once your account is verified — most verifications happen within 24 hours or less. We'll email you as soon as it's done.",
        ], { label: "View application status", href: `${site}/become-tutor` }),
        text: plain([`Hi ${fullName},`, "Our admin team approved your application.", "The tutor dashboard unlocks once your account is verified — most verifications happen within 24 hours or less."], { label: "View application status", href: `${site}/become-tutor` }),
      };
    case "verify":
      return {
        subject: "You're now a verified ForgeX tutor ✓",
        html: shell("You're now a verified tutor ✓", [
          `Congratulations ${fullName},`, "An admin verified your account. Your verified badge is live and the tutor dashboard is unlocked — you can start creating courses right away.",
        ], { label: "Open your tutor dashboard", href: `${site}/tutor` }),
        text: plain([`Congratulations ${fullName},`, "An admin verified your account. Your verified badge is live and the tutor dashboard is unlocked."], { label: "Open your tutor dashboard", href: `${site}/tutor` }),
      };
    case "reject":
      return {
        subject: "Update on your tutor application",
        html: shell("Application not approved", [
          `Hi ${fullName},`, "Unfortunately your application could not be approved at this time.",
          reason ? `Reason: ${reason}` : "", "You're welcome to re-apply with more detail — we'd love to have you teach.",
        ], { label: "Review & re-apply", href: `${site}/become-tutor` }),
        text: plain([`Hi ${fullName},`, "Unfortunately your application could not be approved at this time.", reason ? `Reason: ${reason}` : "", "You're welcome to re-apply with more detail."], { label: "Review & re-apply", href: `${site}/become-tutor` }),
      };
    case "request-info":
      return {
        subject: "More information needed for your tutor application",
        html: shell("More information required", [
          `Hi ${fullName},`, "Before we can verify your account we need a little more from you.",
          reason ? `What's needed: ${reason}` : "", "Please update your application and resubmit — we'll review it within 24 hours or less.",
        ], { label: "Update your application", href: `${site}/become-tutor` }),
        text: plain([`Hi ${fullName},`, "Before we can verify your account we need a little more from you.", reason ? `What's needed: ${reason}` : "", "Please update your application and resubmit."], { label: "Update your application", href: `${site}/become-tutor` }),
      };
    case "suspend":
      return {
        subject: "Your tutor account was suspended",
        html: shell("Account suspended", [
          `Hi ${fullName},`, "Your tutor account was suspended and dashboard access has been revoked.",
          reason ? `Reason: ${reason}` : "", "If you believe this is a mistake, contact the ForgeX support team.",
        ], { label: "Learn more", href: `${site}/become-tutor` }),
        text: plain([`Hi ${fullName},`, "Your tutor account was suspended and dashboard access has been revoked.", reason ? `Reason: ${reason}` : ""], { label: "Learn more", href: `${site}/become-tutor` }),
      };
    case "reactivate":
      return {
        subject: "Your tutor account is back ✓",
        html: shell("Account reactivated", [
          `Welcome back ${fullName}!`, "Your tutor account has been reactivated and your dashboard access is restored.",
        ], { label: "Open your tutor dashboard", href: `${site}/tutor` }),
        text: plain([`Welcome back ${fullName}!`, "Your tutor account has been reactivated and your dashboard access is restored."], { label: "Open your tutor dashboard", href: `${site}/tutor` }),
      };
    default:
      return null;
  }
}

/**
 * Admin review actions. Admins VERIFY/REVIEW — they never edit the
 * application data itself.
 *   approve        -> approved (dashboard access, no badge yet)
 *   verify         -> verified (✓ badge)
 *   reject         -> rejected + reason
 *   request-info   -> information-required + reason
 *   suspend        -> suspended (revokes access)
 *   reactivate     -> approved (or verified if previously verified)
 */
export const reviewTutorApplication = mutation({
  args: {
    applicationId: v.id("tutorApplications"),
    action: v.union(
      v.literal("approve"),
      v.literal("verify"),
      v.literal("reject"),
      v.literal("request-info"),
      v.literal("suspend"),
      v.literal("reactivate"),
    ),
    reason: v.optional(v.string()),
    token: v.string(),
  },
  handler: async (ctx, { applicationId, action, reason, token }) => {
    await requireAdminSession(ctx, token);
    const app = await ctx.db.get(applicationId);
    if (!app) throw new Error("Application not found.");

    if (action === "reject" && !reason?.trim()) {
      throw new Error("A rejection reason is required.");
    }
    if (action === "request-info" && !reason?.trim()) {
      throw new Error("Please describe what information is required.");
    }

    const tutorId = app.userId;
    let nextStatus: typeof app.status = app.status;
    let nextVerified = !!app.wasVerified;

    switch (action) {
      case "approve":
        nextStatus = "approved";
        nextVerified = false;
        break;
      case "verify":
        nextStatus = "verified";
        nextVerified = true;
        break;
      case "reject":
        nextStatus = "rejected";
        nextVerified = false;
        break;
      case "request-info":
        nextStatus = "information-required";
        break;
      case "suspend":
        nextStatus = "suspended";
        nextVerified = false;
        break;
      case "reactivate":
        nextStatus = app.wasVerified ? "verified" : "approved";
        nextVerified = !!app.wasVerified;
        break;
    }

    await ctx.db.patch(applicationId, {
      status: nextStatus,
      wasVerified: nextVerified,
      reviewedAt: Date.now(),
      reviewNote: reason,
    });

    // Tutor profile flags: the application data itself is never touched.
    const user = await ctx.db.get(tutorId);
    if (user) {
      if (action === "approve" || action === "verify" || action === "reactivate") {
        await ctx.db.patch(tutorId, {
          role: ROLES.TUTOR,
          verified: nextVerified,
          name: user.name || app.fullName,
          headline: user.headline || app.professionalTitle,
          bio: user.bio || app.biography,
          skills: user.skills?.length ? user.skills : app.skills,
        });
      } else if (action === "suspend") {
        await ctx.db.patch(tutorId, { verified: false });
      }
    }

    const messages: Record<string, { title: string; body: string; link: string }> = {
      approve: {
        title: "Application approved 🎉",
        body: "Your tutor application was approved. Once an admin verifies your account, the Tutor Dashboard unlocks.",
        link: "/become-tutor",
      },
      verify: {
        title: "You're now a verified tutor ✓",
        body: "The verified badge now appears on your profile, courses and the tutor directory.",
        link: "/tutor",
      },
      reject: {
        title: "Application not approved",
        body: reason ?? "Your application could not be approved.",
        link: "/become-tutor",
      },
      "request-info": {
        title: "More information required",
        body: reason ?? "Please update your application with the requested information.",
        link: "/become-tutor",
      },
      suspend: {
        title: "Account suspended",
        body: reason ?? "Your tutor account was suspended. Dashboard access is revoked.",
        link: "/become-tutor",
      },
      reactivate: {
        title: "Account reactivated",
        body: "Your tutor account has been reactivated. Welcome back!",
        link: "/tutor",
      },
    };

    await notify(ctx, {
      userId: tutorId,
      title: messages[action].title,
      body: messages[action].body,
      type: "tutor",
      link: messages[action].link,
    });

    // Email the decision to the applicant (async — sending happens in an action).
    if (app.email) {
      const mail = decisionEmail(action, app.fullName, reason);
      if (mail) {
        await ctx.scheduler.runAfter(0, internal.email.sendEmail, {
          to: app.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        });
      }
    }

    await audit(ctx, undefined, tutorId, action, `Tutor: ${app.fullName}`, reason);
    return true;
  },
});

export const auditLogs = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const rows = await ctx.db.query("auditLogs").collect();
    const hydrated = await Promise.all(
      rows.map(async (r) => {
        const admin = r.adminId ? await ctx.db.get(r.adminId) : null;
        const tutor = r.tutorId ? await ctx.db.get(r.tutorId) : null;
        return {
          ...r,
          adminName: admin?.name ?? "System Admin",
          tutorName: tutor?.name ?? null,
        };
      }),
    );
    return hydrated.sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
  },
});

// ---------------------------------------------------------------------------
// Course review — admin verifies tutor courses before they go live
// ---------------------------------------------------------------------------

export const coursesPendingReview = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const courses = await ctx.db.query("courses").collect();
    const pending = courses.filter(
      (c) => (c.status === "pending" || c.status === undefined) && !c.archived,
    );
    return hydrateCourses(ctx, pending.sort((a, b) => b.createdAt - a.createdAt));
  },
});

export const reviewCourse = mutation({
  args: {
    courseId: v.id("courses"),
    approve: v.boolean(),
    note: v.optional(v.string()),
    token: v.string(),
  },
  handler: async (ctx, { courseId, approve, note, token }) => {
    await requireAdminSession(ctx, token);
    const course = await ctx.db.get(courseId);
    if (!course) throw new Error("Course not found.");
    if (approve) {
      await ctx.db.patch(courseId, {
        status: "approved",
        published: true,
        reviewNote: undefined,
      });
    } else {
      await ctx.db.patch(courseId, {
        status: "rejected",
        published: false,
        reviewNote: note,
      });
    }
    await audit(ctx, undefined, course.tutorId, approve ? "course-approved" : "course-rejected", `Course: ${course.title}`, note);
    await notify(ctx, {
      userId: course.tutorId,
      title: approve ? "Course approved ✓" : "Course needs changes",
      body: approve
        ? `"${course.title}" is now live on ForgeX Academy.`
        : note
          ? `"${course.title}" was not approved. ${note}`
          : `"${course.title}" was not approved.`,
      type: "course",
      link: "/tutor/courses",
    });
    return true;
  },
});

/**
 * Full course preview for the admin review flow — the exact content a student
 * would see once the course goes live, PLUS the complete lesson / quiz /
 * assignment details so admins can verify quality before approving. Works for
 * unpublished, pending or archived courses (public pages hide those, so the
 * admin needs this dedicated view). A malformed or unknown id resolves to
 * `null` instead of crashing the page.
 */
export const coursePreview = query({
  args: { courseId: v.string(), token: v.string() },
  handler: async (ctx, { courseId, token }) => {
    await requireAdminSession(ctx, token);
    let course: Doc<"courses"> | null = null;
    try {
      course = await ctx.db.get(courseId as Id<"courses">);
    } catch {
      return null;
    }
    if (!course) return null;
    const hydrated = await hydrateCourse(ctx, course);
    const tutor = await ctx.db.get(course.tutorId);
    const [lessons, quizzes, assignments] = await Promise.all([
      ctx.db
        .query("lessons")
        .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
        .collect(),
      ctx.db
        .query("quizzes")
        .withIndex("by_course", (q) => q.eq("courseId", course._id))
        .collect(),
      ctx.db
        .query("assignments")
        .withIndex("by_course", (q) => q.eq("courseId", course._id))
        .collect(),
    ]);
    return {
      ...hydrated,
      tutorProfile: tutor
        ? {
            ...publicUser(tutor),
            bio: tutor.bio ?? "",
            skills: tutor.skills ?? [],
          }
        : null,
      lessons: lessons.sort((a, b) => a.order - b.order),
      quizzes: quizzes.sort((a, b) => a.createdAt - b.createdAt),
      assignments: assignments.sort(
        (a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity),
      ),
    };
  },
});

// ---------------------------------------------------------------------------
// Catalog CRUD
// ---------------------------------------------------------------------------

export const upsertCategory = mutation({
  args: {
    id: v.optional(v.id("categories")),
    name: v.string(),
    slug: v.optional(v.string()),
    description: v.string(),
    icon: v.string(),
    color: v.string(),
    order: v.optional(v.number()),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const slug = args.slug || slugify(args.name);
    if (args.id) {
      await ctx.db.patch(args.id, {
        name: args.name,
        description: args.description,
        icon: args.icon,
        color: args.color,
        order: args.order,
      });
      return args.id;
    }
    return await ctx.db.insert("categories", {
      name: args.name,
      slug,
      description: args.description,
      icon: args.icon,
      color: args.color,
      order: args.order ?? 0,
    });
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("categories"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.delete(id);
    return true;
  },
});

export const upsertRoadmap = mutation({
  args: {
    id: v.optional(v.id("roadmaps")),
    name: v.string(),
    slug: v.optional(v.string()),
    tagline: v.string(),
    description: v.string(),
    icon: v.string(),
    color: v.string(),
    featured: v.boolean(),
    levels: v.array(
      v.object({
        id: v.optional(v.id("roadmapLevels")),
        title: v.string(),
        description: v.string(),
        order: v.number(),
      }),
    ),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const slug = args.slug || slugify(args.name);
    let roadmapId: string;
    if (args.id) {
      await ctx.db.patch(args.id, {
        name: args.name,
        tagline: args.tagline,
        description: args.description,
        icon: args.icon,
        color: args.color,
        featured: args.featured,
      });
      roadmapId = args.id;
    } else {
      roadmapId = await ctx.db.insert("roadmaps", {
        name: args.name,
        slug,
        tagline: args.tagline,
        description: args.description,
        icon: args.icon,
        color: args.color,
        featured: args.featured,
      });
    }
    // replace levels: keep ids that still exist, delete removed, upsert rest
    const existing = await ctx.db
      .query("roadmapLevels")
      .withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId as never))
      .collect();
    const newIds = new Set(
      args.levels.map((l) => l.id?.toString()).filter(Boolean),
    );
    for (const l of existing) {
      if (!newIds.has(l._id.toString())) await ctx.db.delete(l._id);
    }
    for (const l of args.levels) {
      if (l.id) {
        await ctx.db.patch(l.id, {
          roadmapId: roadmapId as never,
          title: l.title,
          description: l.description,
          order: l.order,
        });
      } else {
        await ctx.db.insert("roadmapLevels", {
          roadmapId: roadmapId as never,
          title: l.title,
          description: l.description,
          order: l.order,
        });
      }
    }
    return roadmapId;
  },
});

export const deleteRoadmap = mutation({
  args: { id: v.id("roadmaps"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    await requireAdminSession(ctx, token);
    const levels = await ctx.db
      .query("roadmapLevels")
      .withIndex("by_roadmap", (q) => q.eq("roadmapId", id))
      .collect();
    for (const l of levels) await ctx.db.delete(l._id);
    await ctx.db.delete(id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// All courses (admin)
// ---------------------------------------------------------------------------

export const allCourses = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const courses = await ctx.db.query("courses").collect();
    return hydrateCourses(
      ctx,
      courses.sort((a, b) => b.createdAt - a.createdAt),
    );
  },
});

// ---------------------------------------------------------------------------
// Updates CRUD
// ---------------------------------------------------------------------------

export const updatesAll = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const docs = await ctx.db.query("updates").collect();
    return docs.sort((a, b) => b.date - a.date);
  },
});

export const upsertUpdate = mutation({
  args: {
    id: v.optional(v.id("updates")),
    type: v.union(
      v.literal("new-course"),
      v.literal("maintenance"),
      v.literal("event"),
      v.literal("competition"),
      v.literal("platform-news"),
    ),
    title: v.string(),
    body: v.string(),
    date: v.number(),
    link: v.optional(v.string()),
    published: v.boolean(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    if (args.id) {
      await ctx.db.patch(args.id, {
        type: args.type,
        title: args.title,
        body: args.body,
        date: args.date,
        link: args.link,
        published: args.published,
      });
      return args.id;
    }
    return await ctx.db.insert("updates", {
      type: args.type,
      title: args.title,
      body: args.body,
      date: args.date,
      link: args.link,
      published: args.published,
    });
  },
});

export const deleteUpdate = mutation({
  args: { id: v.id("updates"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.delete(id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Announcements (admin versions — password-session access, no user needed)
// ---------------------------------------------------------------------------

export const adminAnnouncementsList = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const docs = await ctx.db.query("announcements").collect();
    const hydrated = await Promise.all(
      docs.map(async (a) => {
        const author = a.authorId ? await ctx.db.get(a.authorId) : null;
        return { ...a, author: author ? publicUser(author) : null };
      }),
    );
    return hydrated.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const adminUpsertAnnouncement = mutation({
  args: {
    id: v.optional(v.id("announcements")),
    title: v.string(),
    body: v.string(),
    category: v.union(
      v.literal("Announcement"),
      v.literal("Event"),
      v.literal("Competition"),
      v.literal("Maintenance"),
      v.literal("News"),
    ),
    pinned: v.boolean(),
    published: v.boolean(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    if (args.id) {
      await ctx.db.patch(args.id, {
        title: args.title,
        body: args.body,
        category: args.category,
        pinned: args.pinned,
        published: args.published,
      });
      return args.id;
    }
    // No user is associated with password-only admin sessions.
    return await ctx.db.insert("announcements", {
      title: args.title,
      body: args.body,
      category: args.category,
      pinned: args.pinned,
      published: args.published,
      createdAt: Date.now(),
    });
  },
});

export const adminDeleteAnnouncement = mutation({
  args: { id: v.id("announcements"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.delete(id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Certificates (admin)
// ---------------------------------------------------------------------------

export const certificatesList = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const certs = await ctx.db.query("certificates").collect();
    const hydrated = await Promise.all(
      certs.map(async (c) => {
        const student = await ctx.db.get(c.studentId);
        const course = await ctx.db.get(c.courseId);
        return {
          ...c,
          student: student ? publicUser(student) : null,
          courseTitle: course?.title ?? c.courseTitle,
        };
      }),
    );
    return hydrated.sort((a, b) => b.issuedAt - a.issuedAt);
  },
});

export const deleteCertificate = mutation({
  args: { id: v.id("certificates"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.delete(id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Site content
// ---------------------------------------------------------------------------

export const contentSet = mutation({
  args: { key: v.string(), value: v.any(), token: v.string() },
  handler: async (ctx, { key, value, token }) => {
    await requireAdminSession(ctx, token);
    const existing = await ctx.db
      .query("siteContent")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value });
      return existing._id;
    }
    return await ctx.db.insert("siteContent", { key, value });
  },
});

export const deleteContent = mutation({
  args: { key: v.string(), token: v.string() },
  handler: async (ctx, { key, token }) => {
    await requireAdminSession(ctx, token);
    const existing = await ctx.db
      .query("siteContent")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Cascade-delete helpers (real database cleanup, not just UI hiding)
// ---------------------------------------------------------------------------

async function deleteCourseData(ctx: MutationCtx, courseId: Id<"courses">) {
  const lessons = await ctx.db
    .query("lessons")
    .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
    .collect();
  for (const r of lessons) await ctx.db.delete(r._id);
  const quizzes = await ctx.db
    .query("quizzes")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();
  for (const r of quizzes) {
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_quiz", (q) => q.eq("quizId", r._id))
      .collect();
    for (const a of attempts) await ctx.db.delete(a._id);
    await ctx.db.delete(r._id);
  }
  const assignments = await ctx.db
    .query("assignments")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();
  for (const r of assignments) await ctx.db.delete(r._id);
  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();
  for (const r of submissions) await ctx.db.delete(r._id);
  const enrollments = await ctx.db
    .query("enrollments")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();
  for (const r of enrollments) await ctx.db.delete(r._id);
  const certs = await ctx.db
    .query("certificates")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();
  for (const r of certs) await ctx.db.delete(r._id);
  await ctx.db.delete(courseId);
}

async function deleteUserData(ctx: MutationCtx, userId: Id<"users">) {
  const enrollments = await ctx.db
    .query("enrollments")
    .withIndex("by_student", (q) => q.eq("studentId", userId))
    .collect();
  for (const r of enrollments) await ctx.db.delete(r._id);
  const certs = await ctx.db
    .query("certificates")
    .withIndex("by_student", (q) => q.eq("studentId", userId))
    .collect();
  for (const r of certs) await ctx.db.delete(r._id);
  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_student", (q) => q.eq("studentId", userId))
    .collect();
  for (const r of submissions) await ctx.db.delete(r._id);
  const attempts = await ctx.db
    .query("quizAttempts")
    .withIndex("by_student", (q) => q.eq("studentId", userId))
    .collect();
  for (const r of attempts) await ctx.db.delete(r._id);
  const apps = await ctx.db
    .query("tutorApplications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const r of apps) await ctx.db.delete(r._id);
  const notifs = await ctx.db
    .query("notifications")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const r of notifs) await ctx.db.delete(r._id);
  const messages = await ctx.db.query("messages").collect();
  for (const m of messages) {
    if (m.senderId === userId || m.receiverId === userId) await ctx.db.delete(m._id);
  }
  // Courses the user created as a tutor (with all their content)
  const courses = await ctx.db
    .query("courses")
    .withIndex("by_tutor", (q) => q.eq("tutorId", userId))
    .collect();
  for (const c of courses) await deleteCourseData(ctx, c._id);
  // Revoke sign-in by removing auth accounts linked to this user
  const accounts = await ctx.db.query("authAccounts").collect();
  for (const a of accounts) {
    if ((a as { userId?: Id<"users"> }).userId === userId) await ctx.db.delete(a._id);
  }
  await ctx.db.delete(userId);
}

// ---------------------------------------------------------------------------
// Course management — full admin control (create / edit / publish / archive)
// ---------------------------------------------------------------------------

export const adminUpsertCourse = mutation({
  args: {
    id: v.optional(v.id("courses")),
    title: v.string(),
    subtitle: v.string(),
    description: v.string(),
    longDescription: v.string(),
    categoryId: v.id("categories"),
    tutorId: v.id("users"),
    roadmapId: v.optional(v.id("roadmaps")),
    levelId: v.optional(v.id("roadmapLevels")),
    difficulty: difficultyValidator,
    durationHours: v.number(),
    image: v.optional(v.string()),
    gradient: v.optional(v.string()),
    icon: v.optional(v.string()),
    prerequisites: v.array(v.string()),
    skills: v.array(v.string()),
    featured: v.boolean(),
    published: v.boolean(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const { token, id, ...data } = args;
    const baseSlug = slugify(data.title) || `course-${Date.now()}`;
    const exists = await ctx.db
      .query("courses")
      .withIndex("by_slug", (q) => q.eq("slug", baseSlug))
      .first();
    const slug =
      exists && exists._id !== id ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
    if (id) {
      await ctx.db.patch(id, {
        ...data,
        slug,
        status: data.published ? "approved" : "draft",
        reviewNote: undefined,
      });
      await audit(ctx, undefined, undefined, "course-edited", `Course edited: ${data.title}`);
      return id;
    }
    const newId = await ctx.db.insert("courses", {
      ...data,
      slug,
      rating: 0,
      ratingCount: 0,
      status: data.published ? "approved" : "draft",
      archived: false,
      enrolledCount: 0,
      createdAt: Date.now(),
    });
    await audit(ctx, undefined, undefined, "course-created", `Course created: ${data.title}`);
    return newId;
  },
});

export const setCoursePublished = mutation({
  args: { courseId: v.id("courses"), published: v.boolean(), token: v.string() },
  handler: async (ctx, { courseId, published, token }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.patch(courseId, {
      published,
      status: published ? "approved" : "draft",
    });
    await audit(ctx, undefined, undefined, published ? "course-published" : "course-unpublished", `Course ${published ? "published" : "unpublished"}`);
    return true;
  },
});

export const setCourseArchived = mutation({
  args: { courseId: v.id("courses"), archived: v.boolean(), token: v.string() },
  handler: async (ctx, { courseId, archived, token }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.patch(courseId, {
      archived,
      published: archived ? false : true,
    });
    await audit(ctx, undefined, undefined, archived ? "course-archived" : "course-restored", `Course ${archived ? "archived" : "restored"}`);
    return true;
  },
});

export const adminDeleteCourse = mutation({
  args: { courseId: v.id("courses"), token: v.string() },
  handler: async (ctx, { courseId, token }) => {
    await requireAdminSession(ctx, token);
    const course = await ctx.db.get(courseId);
    if (!course) return false;
    await deleteCourseData(ctx, courseId);
    await audit(ctx, undefined, undefined, "course-deleted", `Course deleted: ${course.title} (+ lessons, quizzes, assignments, enrollments)`);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Admin lesson / quiz / assignment management
// ---------------------------------------------------------------------------

export const adminUpsertLesson = mutation({
  args: {
    id: v.optional(v.id("lessons")),
    courseId: v.id("courses"),
    title: v.string(),
    order: v.number(),
    durationMinutes: v.number(),
    videoUrl: v.optional(v.string()),
    videoType: v.optional(
      v.union(
        v.literal("youtube"),
        v.literal("mp4"),
        v.literal("vimeo"),
        v.literal("loom"),
      ),
    ),
    image: v.optional(v.string()),
    notes: v.string(),
    transcript: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const { token, id, ...data } = args;
    if (id) {
      await ctx.db.patch(id, {
        ...data,
        muxAssetId: undefined,
        muxPlaybackId: undefined,
      });
      await audit(ctx, undefined, undefined, "lesson-edited", `Lesson edited: ${data.title}`);
      return id;
    }
    const newId = await ctx.db.insert("lessons", {
      ...data,
      image: data.image,
      resources: [],
    });
    await audit(ctx, undefined, undefined, "lesson-created", `Lesson created: ${data.title}`);
    return newId;
  },
});

export const adminDeleteLesson = mutation({
  args: { id: v.id("lessons"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.delete(id);
    await audit(ctx, undefined, undefined, "lesson-deleted", "Lesson deleted");
    return true;
  },
});

/** Admin-only: full lesson / quiz / assignment content of one course. */
export const courseContentDetail = query({
  args: { courseId: v.id("courses"), token: v.string() },
  handler: async (ctx, { courseId, token }) => {
    await requireAdminSession(ctx, token);
    const [lessons, quizzes, assignments] = await Promise.all([
      ctx.db
        .query("lessons")
        .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
        .collect(),
      ctx.db
        .query("quizzes")
        .withIndex("by_course", (q) => q.eq("courseId", courseId))
        .collect(),
      ctx.db
        .query("assignments")
        .withIndex("by_course", (q) => q.eq("courseId", courseId))
        .collect(),
    ]);
    return {
      lessons: lessons.sort((a, b) => a.order - b.order),
      quizzes: quizzes.sort((a, b) => a.createdAt - b.createdAt),
      assignments: assignments.sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity)),
    };
  },
});

/** Enrolled students for one course — admin control-center view. */
export const adminCourseStudents = query({
  args: { courseId: v.id("courses"), token: v.string() },
  handler: async (ctx, { courseId, token }) => {
    await requireAdminSession(ctx, token);
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const hydrated = await Promise.all(
      enrollments.map(async (e) => {
        const student = await ctx.db.get(e.studentId);
        return {
          ...e,
          student: student ? publicUser(student) : null,
          email: student?.email ?? null,
          joinedAt: student?._creationTime ?? null,
        };
      }),
    );
    return hydrated.sort(
      (a, b) => b.progress - a.progress || a.enrolledAt - b.enrolledAt,
    );
  },
});

export const adminUpsertQuiz = mutation({
  args: {
    id: v.optional(v.id("quizzes")),
    courseId: v.id("courses"),
    title: v.string(),
    description: v.string(),
    timeLimitMinutes: v.number(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const { token, id, courseId, title, description, timeLimitMinutes } = args;
    if (id) {
      await ctx.db.patch(id, { title, description, timeLimitMinutes });
      return id;
    }
    const course = await ctx.db.get(courseId);
    return await ctx.db.insert("quizzes", {
      courseId,
      tutorId: course?.tutorId ?? ("" as Id<"users">),
      title,
      description,
      timeLimitMinutes,
      questions: [],
      createdAt: Date.now(),
    });
  },
});

export const adminDeleteQuiz = mutation({
  args: { id: v.id("quizzes"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    await requireAdminSession(ctx, token);
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_quiz", (q) => q.eq("quizId", id))
      .collect();
    for (const a of attempts) await ctx.db.delete(a._id);
    await ctx.db.delete(id);
    return true;
  },
});

export const adminUpsertAssignment = mutation({
  args: {
    id: v.optional(v.id("assignments")),
    courseId: v.id("courses"),
    title: v.string(),
    description: v.string(),
    instructions: v.string(),
    deadline: v.optional(v.number()),
    maxScore: v.number(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const { token, id, courseId, title, description, instructions, deadline, maxScore } = args;
    if (id) {
      await ctx.db.patch(id, { title, description, instructions, deadline, maxScore });
      return id;
    }
    const course = await ctx.db.get(courseId);
    return await ctx.db.insert("assignments", {
      courseId,
      tutorId: course?.tutorId ?? ("" as Id<"users">),
      title,
      description,
      instructions,
      deadline,
      maxScore,
      files: [],
      createdAt: Date.now(),
    });
  },
});

export const adminDeleteAssignment = mutation({
  args: { id: v.id("assignments"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    await requireAdminSession(ctx, token);
    const subs = await ctx.db
      .query("submissions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", id))
      .collect();
    for (const s of subs) await ctx.db.delete(s._id);
    await ctx.db.delete(id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Demo data control — admin can wipe all seeded content (real DB records)
// ---------------------------------------------------------------------------

export const purgeDemoData = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const tables = [
      "lessons",
      "quizzes",
      "quizAttempts",
      "assignments",
      "submissions",
      "enrollments",
      "certificates",
      "announcements",
      "updates",
      "categories",
      "roadmaps",
      "roadmapLevels",
      "siteContent",
      "tutorApplications",
      "media",
    ] as const;
    for (const t of tables) {
      const rows = await ctx.db.query(t).collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }
    // Seed users + their messages / notifications
    const users = await ctx.db.query("users").collect();
    const messages = await ctx.db.query("messages").collect();
    const notifs = await ctx.db.query("notifications").collect();
    for (const u of users) {
      if (!u.isSeed) continue;
      for (const m of messages) {
        if (m.senderId === u._id || m.receiverId === u._id) await ctx.db.delete(m._id);
      }
      for (const n of notifs) {
        if (n.userId === u._id) await ctx.db.delete(n._id);
      }
      await ctx.db.delete(u._id);
    }
    await audit(ctx, undefined, undefined, "demo-data-purged", "All demo/seeded content and accounts deleted");
    return true;
  },
});

// ---------------------------------------------------------------------------
// Admin chat oversight — admins can read every conversation on the platform.
// Read-only: admins have no user account, so they can't participate in chats.
// ---------------------------------------------------------------------------

/** Every conversation across all users, newest first. */
export const allConversations = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const messages = await ctx.db.query("messages").collect();
    const byThread = new Map<string, Doc<"messages">[]>();
    for (const m of messages) {
      const list = byThread.get(m.threadId) ?? [];
      list.push(m);
      byThread.set(m.threadId, list);
    }
    const conversations = await Promise.all(
      [...byThread.entries()].map(async ([threadId, msgs]) => {
        const sorted = msgs.sort((a, b) => a.createdAt - b.createdAt);
        const last = sorted[sorted.length - 1];
        const [aId, bId] = threadId.split("|");
        const userA = await ctx.db.get(aId as Id<"users">);
        const userB = await ctx.db.get(bId as Id<"users">);
        const participants = [userA, userB]
          .filter((u): u is Doc<"users"> => !!u)
          .map((u) => ({
            _id: u._id,
            name: u.name || "Anonymous",
            image: u.image ?? null,
            role: u.role ?? "student",
            email: u.email ?? null,
            online: !!u.lastActivity && Date.now() - u.lastActivity < 60_000,
          }));
        return {
          threadId,
          participants,
          lastMessage: last.body,
          lastAt: last.createdAt,
          messageCount: msgs.length,
          unread: msgs.filter((m) => !m.readAt).length,
        };
      }),
    );
    return conversations.sort((a, b) => b.lastAt - a.lastAt);
  },
});

/** All messages in one thread, with sender identity — for admin review. */
export const conversationMessages = query({
  args: { token: v.string(), threadId: v.string() },
  handler: async (ctx, { token, threadId }) => {
    await requireAdminSession(ctx, token);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    const withSender = await Promise.all(
      messages
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(async (m) => {
          const sender = await ctx.db.get(m.senderId);
          return {
            _id: m._id,
            body: m.body,
            createdAt: m.createdAt,
            readAt: m.readAt ?? null,
            sender: sender
              ? {
                  _id: sender._id,
                  name: sender.name || "Anonymous",
                  image: sender.image ?? null,
                  role: sender.role ?? "student",
                }
              : null,
          };
        }),
    );
    return withSender;
  },
});

// ---------------------------------------------------------------------------
// Admin chat replies — admins answer users directly as the ForgeX Admin
// identity. Each reply lives in its own admin↔user thread, so the standard
// two-participant conversation model stays intact everywhere.
// ---------------------------------------------------------------------------

const adminThreadKey = (a: string, b: string) => [a, b].sort().join("|");

/** Find the platform-wide ForgeX Admin messaging identity (create on demand). */
async function ensureAdminUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const existing = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", "admin@forgex.academy"))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("users", {
    name: "ForgeX Admin",
    email: "admin@forgex.academy",
    role: ROLES.ADMIN,
    verified: true,
    headline: "Academy Support",
    isSeed: true, // system identity — hidden from search & platform stats
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Could not create the admin identity.");
  return created;
}

/**
 * Admin replies to any user from the chat oversight page. The reply is sent
 * as “ForgeX Admin” into a dedicated admin↔user thread; the recipient is
 * notified in-app and by email, exactly like a normal message.
 */
export const adminReply = mutation({
  args: {
    token: v.string(),
    threadId: v.string(),
    body: v.string(),
    replyToUserId: v.id("users"),
  },
  handler: async (ctx, { token, threadId, body, replyToUserId }) => {
    await requireAdminSession(ctx, token);
    const trimmed = body.trim();
    if (!trimmed) throw new Error("Message can't be empty.");

    const recipient = await ctx.db.get(replyToUserId);
    if (!recipient) throw new Error("Recipient not found.");

    // The admin is replying inside a real conversation — verify the thread
    // exists and that the chosen recipient is one of its participants.
    const threadMessages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    if (threadMessages.length === 0) {
      throw new Error("Conversation not found.");
    }
    const isParticipant = threadMessages.some(
      (m) => m.senderId === replyToUserId || m.receiverId === replyToUserId,
    );
    if (!isParticipant) {
      throw new Error("That user isn't part of this conversation.");
    }

    const admin = await ensureAdminUser(ctx);
    const senderName = admin.name || "ForgeX Admin";

    const id = await ctx.db.insert("messages", {
      threadId: adminThreadKey(admin._id, replyToUserId),
      senderId: admin._id,
      receiverId: replyToUserId,
      body: trimmed,
      createdAt: Date.now(),
    });

    await notify(ctx, {
      userId: replyToUserId,
      title: `New message from ${senderName}`,
      body: trimmed.slice(0, 90),
      type: "message",
      link:
        recipient.role === "tutor" ? "/tutor/inbox" : "/dashboard/messages",
    });

    // Email the recipient (throttled to one per 5 minutes per recipient).
    if (recipient.email) {
      const prev = await ctx.db
        .query("messages")
        .withIndex("by_receiver", (q) => q.eq("receiverId", replyToUserId))
        .collect();
      const lastIncoming = prev.reduce((max, m) => Math.max(max, m.createdAt), 0);
      if (Date.now() - lastIncoming > 5 * 60 * 1000) {
        const site = (SITE_URL ?? "https://forgex.academy").replace(/\/$/, "");
        const inbox =
          recipient.role === "tutor" ? "/tutor/inbox" : "/dashboard/messages";
        await ctx.scheduler.runAfter(0, internal.email.sendEmail, {
          to: recipient.email,
          subject: `New message from ${senderName} 💬`,
          html: `
            <div style="background:#0d0f0c;color:#e7e5e4;font-family:Segoe UI,Arial,sans-serif;padding:32px 16px">
              <div style="max-width:560px;margin:0 auto;background:#14170f;border:1px solid #2a2e22;border-radius:16px;overflow:hidden">
                <div style="background:#a3e635;padding:20px 28px"><p style="margin:0;color:#0d0f0c;font-weight:800;font-size:18px">⚡ ForgeX Academy</p></div>
                <div style="padding:28px">
                  <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#a3e635">${senderName} replied 💬</p>
                  <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#d6d3d1">${senderName} sent you a message on ForgeX Academy:</p>
                  <div style="margin:0 0 20px;background:#0d0f0c;border:1px solid #2a2e22;border-radius:12px;padding:14px 16px;font-size:14px;color:#f5f5f4;line-height:1.6">“${trimmed.slice(0, 160)}”</div>
                  <a href="${site}${inbox}" style="display:inline-block;background:#a3e635;color:#0d0f0c;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">Open conversation</a>
                </div>
                <div style="padding:16px 28px;border-top:1px solid #2a2e22;font-size:12px;color:#78716c">You're receiving this because ${senderName} messaged you on ForgeX Academy.</div>
              </div>
            </div>`,
          text: `You have a new message from ${senderName} on ForgeX Academy:\n\n“${trimmed}”\n\nOpen it here: ${site}${inbox}`,
        });
      }
    }

    await audit(ctx, undefined, replyToUserId, "admin-reply", `Admin replied to ${recipient.name ?? "a user"}`);
    return id;
  },
});
