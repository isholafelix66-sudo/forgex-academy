import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { hydrateCourses, makeAdminToken, notify, publicUser, requireAdminSession, slugify } from "./lib";
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
    videoType: v.optional(v.union(v.literal("youtube"), v.literal("mp4"))),
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
    const newId = await ctx.db.insert("lessons", { ...data, resources: [] });
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
