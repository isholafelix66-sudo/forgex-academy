import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { hydrateCourses, notify, publicUser, requireAdmin, requireUserDoc, slugify } from "./lib";
import { ROLES, roleValidator } from "./schema";

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [users, courses, enrollments, certificates, applications] =
      await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db.query("courses").collect(),
        ctx.db.query("enrollments").collect(),
        ctx.db.query("certificates").collect(),
        ctx.db.query("tutorApplications").collect(),
      ]);
    const real = users.filter((u) => !u.isSeed);
    return {
      users: real.length,
      students: real.filter((u) => u.role === ROLES.STUDENT).length,
      tutors: real.filter((u) => u.role === ROLES.TUTOR).length,
      admins: real.filter((u) => u.role === ROLES.ADMIN).length,
      courses: courses.length,
      publishedCourses: courses.filter((c) => c.published).length,
      enrollments: enrollments.length,
      certificates: certificates.length,
      pendingApplications: applications.filter(
        (a) => a.status === "submitted" || a.status === "under-review",
      ).length,
    };
  },
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const usersList = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const [enrollments, certificates] = await Promise.all([
      ctx.db.query("enrollments").collect(),
      ctx.db.query("certificates").collect(),
    ]);
    const q = (search ?? "").trim().toLowerCase();
    const hydrated = users
      .map((u) => ({
        ...publicUser(u),
        email: u.email ?? null,
        bio: u.bio ?? "",
        skills: u.skills ?? [],
        isAnonymous: !!u.isAnonymous,
        enrollments: enrollments.filter((e) => e.studentId === u._id).length,
        certificates: certificates.filter((c) => c.studentId === u._id).length,
        joinedAt: u._creationTime,
      }))
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q),
      );
    return hydrated.sort((a, b) => b.joinedAt - a.joinedAt);
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  handler: async (ctx, { userId, role }) => {
    const admin = await requireAdmin(ctx);
    if (userId === admin._id && role !== ROLES.ADMIN) {
      throw new Error("You can't demote yourself.");
    }
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
  args: { userId: v.id("users"), verified: v.boolean() },
  handler: async (ctx, { userId, verified }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(userId, { verified });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Admin password gate (access is URL-only: /admin + this password)
// ---------------------------------------------------------------------------

const ADMIN_PASSWORD = process.env.ADMIN_ACCESS_PASSWORD ?? "DISCOVERY";

/** Verify the admin access password. Never rendered in any UI copy. */
export const verifyAccessPassword = mutation({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    const user = await requireUserDoc(ctx);
    if (password !== ADMIN_PASSWORD) {
      throw new Error("Incorrect access password.");
    }
    if (user.role !== ROLES.ADMIN) {
      throw new Error("Administrator role required.");
    }
    await ctx.db.patch(user._id, { adminAccess: true });
    await audit(ctx, user._id, undefined, "admin-access", "Admin password gate unlocked");
    return true;
  },
});

export const isAdminUnlocked = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const user = await requireUserDoc(ctx);
    return !!user.adminAccess;
  },
});

export const lockAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUserDoc(ctx);
    await ctx.db.patch(user._id, { adminAccess: false });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

async function audit(
  ctx: import("./_generated/server").MutationCtx,
  adminId: string,
  tutorId: string | undefined,
  action: string,
  detail: string,
  reason?: string,
) {
  await ctx.db.insert("auditLogs", {
    adminId: adminId as never,
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
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    await requireAdmin(ctx);
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
  args: { id: v.id("tutorApplications") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
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
  },
  handler: async (ctx, { applicationId, action, reason }) => {
    const admin = await requireAdmin(ctx);
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
      reviewedBy: admin._id,
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
        body: "Your tutor application was approved. The Tutor Dashboard is now unlocked.",
        link: "/tutor",
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

    await audit(ctx, admin._id, tutorId, action, `Tutor: ${app.fullName}`, reason);
    return true;
  },
});

export const auditLogs = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("auditLogs").collect();
    const hydrated = await Promise.all(
      rows.map(async (r) => {
        const admin = await ctx.db.get(r.adminId);
        const tutor = r.tutorId ? await ctx.db.get(r.tutorId) : null;
        return {
          ...r,
          adminName: admin?.name ?? "Unknown",
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
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const courses = await ctx.db.query("courses").collect();
    const pending = courses.filter(
      (c) => c.status === "pending" || c.status === undefined,
    );
    return hydrateCourses(ctx, pending.sort((a, b) => b.createdAt - a.createdAt));
  },
});

export const reviewCourse = mutation({
  args: {
    courseId: v.id("courses"),
    approve: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { courseId, approve, note }) => {
    const admin = await requireAdmin(ctx);
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
    await audit(ctx, admin._id, course.tutorId, approve ? "course-approved" : "course-rejected", `Course: ${course.title}`, note);
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
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
  args: { id: v.id("categories") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
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
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
  args: { id: v.id("roadmaps") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
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
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
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
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
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
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
  args: { id: v.id("updates") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Certificates (admin)
// ---------------------------------------------------------------------------

export const certificatesList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
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
  args: { id: v.id("certificates") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Site content
// ---------------------------------------------------------------------------

export const contentSet = mutation({
  args: { key: v.string(), value: v.any() },
  handler: async (ctx, { key, value }) => {
    await requireAdmin(ctx);
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
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("siteContent")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return true;
  },
});
