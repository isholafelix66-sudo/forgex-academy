import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { hydrateCourses, notify, publicUser, requireAdmin, slugify } from "./lib";
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
        (a) => a.status === "pending",
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
// Tutor applications
// ---------------------------------------------------------------------------

export const tutorApplications = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const apps = await ctx.db.query("tutorApplications").collect();
    const hydrated = await Promise.all(
      apps.map(async (a) => {
        const user = await ctx.db.get(a.userId);
        return { ...a, user: user ? publicUser(user) : null };
      }),
    );
    return hydrated.sort((a, b) => b.submittedAt - a.submittedAt);
  },
});

export const reviewTutorApplication = mutation({
  args: {
    applicationId: v.id("tutorApplications"),
    approve: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { applicationId, approve, notes }) => {
    const admin = await requireAdmin(ctx);
    const app = await ctx.db.get(applicationId);
    if (!app) throw new Error("Application not found.");
    if (app.status !== "pending") throw new Error("Already reviewed.");
    await ctx.db.patch(applicationId, {
      status: approve ? "approved" : "rejected",
      reviewedAt: Date.now(),
      reviewedBy: admin._id,
      notes,
    });
    await ctx.db.patch(app.userId, {
      role: ROLES.TUTOR,
      verified: approve,
      headline: approve ? app.headline : undefined,
      bio: approve ? app.bio : undefined,
      skills: approve ? app.expertise : undefined,
      socials: approve ? app.socials : undefined,
    });
    await notify(ctx, {
      userId: app.userId,
      title: approve ? "Application approved 🎉" : "Application not approved",
      body: approve
        ? "Welcome aboard! Your tutor account is verified and the Tutor Dashboard is now unlocked."
        : notes
          ? `Your tutor application was not approved. Reason: ${notes}`
          : "Your tutor application was not approved. You can re-apply anytime.",
      type: "tutor",
      link: approve ? "/tutor" : "/become-tutor",
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
