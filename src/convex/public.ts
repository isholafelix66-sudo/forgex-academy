import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { difficultyValidator, ROLES } from "./schema";
import { hydrateCourse, hydrateCourses, publicUser, slugify } from "./lib";

// ---------------------------------------------------------------------------
// Site content
// ---------------------------------------------------------------------------

export const siteContentAll = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("siteContent").collect();
    return Object.fromEntries(docs.map((d) => [d.key, d.value]));
  },
});

export const siteContent = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const doc = await ctx.db
      .query("siteContent")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    return doc?.value ?? null;
  },
});

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const categoriesList = query({
  args: {},
  handler: async (ctx) => {
    const cats = await ctx.db.query("categories").collect();
    return cats.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
});

export const featuredCourses = query({
  args: {},
  handler: async (ctx) => {
    const courses = await ctx.db.query("courses").collect();
    const published = courses.filter((c) => c.published && c.featured);
    return hydrateCourses(
      ctx,
      published.sort((a, b) => b.rating - a.rating).slice(0, 3),
    );
  },
});

/** Featured tutors — only those with featuredOnHomepage = true. */
export const featuredTutors = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const tutors = users.filter(
      (u) =>
        u.role === ROLES.TUTOR &&
        !!u.verified &&
        u.featuredOnHomepage === true,
    );
    const hydrated = await Promise.all(
      tutors.map(async (t) => {
        const courses = (await ctx.db.query("courses").collect()).filter(
          (c) => c.tutorId === t._id && c.published,
        );
        return {
          ...publicUser(t),
          slug: t.slug ?? null,
          bio: t.bio ?? "",
          socials: t.socials ?? null,
          courseCount: courses.length,
          avgRating: courses.length
            ? courses.reduce((s, c) => s + c.rating, 0) / courses.length
            : 0,
          studentCount: courses.reduce((s, c) => s + c.enrolledCount, 0),
        };
      }),
    );
    return hydrated.sort((a, b) => b.avgRating - a.avgRating).slice(0, 4);
  },
});

export const popularTutors = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const tutors = users.filter((u) => u.role === ROLES.TUTOR && !!u.verified);
    const hydrated = await Promise.all(
      tutors.map(async (t) => {
        const courses = (await ctx.db.query("courses").collect()).filter(
          (c) => c.tutorId === t._id && c.published,
        );
        return {
          ...publicUser(t),
          slug: t.slug ?? null,
          bio: t.bio ?? "",
          socials: t.socials ?? null,
          courseCount: courses.length,
          avgRating: courses.length
            ? courses.reduce((s, c) => s + c.rating, 0) / courses.length
            : 0,
          studentCount: courses.reduce((s, c) => s + c.enrolledCount, 0),
        };
      }),
    );
    return hydrated.sort((a, b) => b.avgRating - a.avgRating).slice(0, 4);
  },
});

export const tutorsList = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const tutors = users.filter((u) => u.role === ROLES.TUTOR && !!u.verified);
    const hydrated = await Promise.all(
      tutors.map(async (t) => {
        const courses = (await ctx.db.query("courses").collect()).filter(
          (c) => c.tutorId === t._id && c.published,
        );
        return {
          ...publicUser(t),
          slug: t.slug ?? null,
          bio: t.bio ?? "",
          skills: t.skills ?? [],
          socials: t.socials ?? null,
          courseCount: courses.length,
          avgRating: courses.length
            ? courses.reduce((s, c) => s + c.rating, 0) / courses.length
            : 0,
          studentCount: courses.reduce((s, c) => s + c.enrolledCount, 0),
        };
      }),
    );
    return hydrated.sort((a, b) => b.avgRating - a.avgRating);
  },
});

/** Shared public projection of a tutor's mini website profile. */
async function tutorProfile(ctx: import("./_generated/server").QueryCtx, tutor: Doc<"users">) {
  const allCourses = await ctx.db.query("courses").collect();
  const courses = await hydrateCourses(
    ctx,
    allCourses
      .filter((c) => c.tutorId === tutor._id && c.published)
      .sort((a, b) => b.rating - a.rating),
  );
  const ratings = courses.map((c) => c.rating);
  return {
    ...publicUser(tutor),
    slug: tutor.slug ?? null,
    bio: tutor.bio ?? "",
    skills: tutor.skills ?? [],
    socials: tutor.socials ?? null,
    courses,
    avgRating: ratings.length
      ? ratings.reduce((s, r) => s + r, 0) / ratings.length
      : 0,
    studentCount: courses.reduce((s, c) => s + c.enrolledCount, 0),
  };
}

export const tutorDetail = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    // A hand-typed or malformed URL id must never crash this public page —
    // it just resolves to the “not found” state.
    let tutor: Doc<"users"> | null = null;
    try {
      tutor = await ctx.db.get(id as Id<"users">);
    } catch {
      return null;
    }
    if (!tutor || tutor.role !== ROLES.TUTOR) return null;
    return tutorProfile(ctx, tutor);
  },
});

/**
 * Public tutor mini-website — the shareable `forgeX.academy/tutor/<slug>`
 * page. Resolves the tutor's stable slug first; falls back to a slugified
 * name match so tutors verified before slugs existed still get a page.
 */
export const tutorBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const s = slug.trim().toLowerCase();
    if (!s) return null;
    let tutor = await ctx.db
      .query("users")
      .withIndex("by_slug", (q) => q.eq("slug", s))
      .first();
    if (!tutor) {
      const all = await ctx.db.query("users").collect();
      tutor =
        all.find(
          (u) =>
            u.role === ROLES.TUTOR &&
            !!u.verified &&
            slugify(u.name ?? "") === s,
        ) ?? null;
    }
    if (!tutor || tutor.role !== ROLES.TUTOR) return null;
    return tutorProfile(ctx, tutor);
  },
});

/**
 * Resolve a tutor's public profile from either a user id (`/tutors/<id>`,
 * the legacy link) or their stable slug (`/tutors/david-ogunleye`, the
 * shareable username link). Both URL shapes land on the same page.
 */
export const tutorByIdOrSlug = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const k = key.trim();
    if (!k) return null;
    // Try as a user id first (legacy links use the raw id).
    let tutor: Doc<"users"> | null = null;
    try {
      tutor = await ctx.db.get(k as Id<"users">);
    } catch {
      tutor = null;
    }
    if (!tutor || tutor.role !== ROLES.TUTOR) {
      // Not an id (or not a tutor id) — try the slug / slugified name.
      const s = k.toLowerCase();
      tutor =
        (await ctx.db
          .query("users")
          .withIndex("by_slug", (q) => q.eq("slug", s))
          .first()) ?? null;
      if (!tutor) {
        const all = await ctx.db.query("users").collect();
        tutor =
          all.find(
            (u) =>
              u.role === ROLES.TUTOR &&
              !!u.verified &&
              slugify(u.name ?? "") === s,
          ) ?? null;
      }
    }
    if (!tutor || tutor.role !== ROLES.TUTOR) return null;
    return tutorProfile(ctx, tutor);
  },
});

export const coursesList = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    difficulty: v.optional(difficultyValidator),
    tutor: v.optional(v.id("users")),
    minRating: v.optional(v.number()),
    maxDuration: v.optional(v.number()),
    roadmap: v.optional(v.string()),
    sort: v.optional(
      v.union(
        v.literal("popular"),
        v.literal("rating"),
        v.literal("newest"),
        v.literal("duration"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let courses = (await ctx.db.query("courses").collect()).filter(
      (c) => c.published,
    );

    const q = (args.search ?? "").trim().toLowerCase();
    if (q) {
      courses = courses.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.subtitle.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.skills.some((s) => s.toLowerCase().includes(q)),
      );
    }
    if (args.category) {
      const cat = await ctx.db
        .query("categories")
        .withIndex("by_slug", (x) => x.eq("slug", args.category!))
        .first();
      if (cat) courses = courses.filter((c) => c.categoryId === cat._id);
    }
    if (args.roadmap) {
      const rm = await ctx.db
        .query("roadmaps")
        .withIndex("by_slug", (x) => x.eq("slug", args.roadmap!))
        .first();
      if (rm) courses = courses.filter((c) => c.roadmapId === rm._id);
    }
    if (args.difficulty) {
      courses = courses.filter((c) => c.difficulty === args.difficulty);
    }
    if (args.tutor) {
      courses = courses.filter((c) => c.tutorId === args.tutor);
    }
    if (args.minRating) {
      courses = courses.filter((c) => c.rating >= args.minRating!);
    }
    if (args.maxDuration) {
      courses = courses.filter((c) => c.durationHours <= args.maxDuration!);
    }

    switch (args.sort ?? "popular") {
      case "rating":
        courses.sort((a, b) => b.rating - a.rating);
        break;
      case "newest":
        courses.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "duration":
        courses.sort((a, b) => a.durationHours - b.durationHours);
        break;
      default:
        courses.sort((a, b) => b.enrolledCount - a.enrolledCount);
    }
    return hydrateCourses(ctx, courses);
  },
});

export const courseBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const course = await ctx.db
      .query("courses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!course || !course.published) return null;
    const hydrated = await hydrateCourse(ctx, course);
    const tutor = await ctx.db.get(course.tutorId);
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .collect();
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .collect();
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .collect();
    return {
      ...hydrated,
      tutorProfile: tutor
        ? {
            ...publicUser(tutor),
            bio: tutor.bio ?? "",
            skills: tutor.skills ?? [],
            socials: tutor.socials ?? null,
          }
        : null,
      lessons: lessons.sort((a, b) => a.order - b.order),
      assignments: assignments
        .sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity))
        .map((a) => ({
          _id: a._id,
          title: a.title,
          description: a.description,
          deadline: a.deadline ?? null,
          maxScore: a.maxScore,
        })),
      quizzes: quizzes.map((q) => ({
        _id: q._id,
        title: q.title,
        description: q.description,
        timeLimitMinutes: q.timeLimitMinutes,
        questionCount: q.questions.length,
      })),
    };
  },
});

export const lessonsByCourse = query({
  args: { courseId: v.string() },
  handler: async (ctx, { courseId }) => {
    try {
      const lessons = await ctx.db
        .query("lessons")
        .withIndex("by_course", (q) => q.eq("courseId", courseId as never))
        .collect();
      return lessons.sort((a, b) => a.order - b.order);
    } catch {
      return []; // malformed course id — never crash the page
    }
  },
});

// ---------------------------------------------------------------------------
// Roadmaps
// ---------------------------------------------------------------------------

async function hydrateRoadmaps(ctx: import("./_generated/server").QueryCtx) {
  const roadmaps = await ctx.db.query("roadmaps").collect();
  const levels = await ctx.db.query("roadmapLevels").collect();
  const courses = await ctx.db.query("courses").collect();
  const published = courses.filter((c) => c.published);

  const hydrated = await Promise.all(
    roadmaps.map(async (r) => {
      const rLevels = levels
        .filter((l) => l.roadmapId === r._id)
        .sort((a, b) => a.order - b.order);
      const withCourses = await Promise.all(
        rLevels.map(async (l) => {
          const levelCourses = published.filter((c) => c.levelId === l._id);
          return {
            ...l,
            courses: await hydrateCourses(
              ctx,
              levelCourses.sort((a, b) => b.rating - a.rating),
            ),
          };
        }),
      );
      return {
        ...r,
        levels: withCourses,
      };
    }),
  );
  return hydrated.sort(
    (a, b) => (a.featured ? -1 : 1) - (b.featured ? -1 : 1),
  );
}

export const roadmapsAll = query({
  args: {},
  handler: async (ctx) => {
    return hydrateRoadmaps(ctx);
  },
});

export const roadmapBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const all = await hydrateRoadmaps(ctx);
    return all.find((r) => r.slug === slug) ?? null;
  },
});

// ---------------------------------------------------------------------------
// Updates & announcements
// ---------------------------------------------------------------------------

export const updatesList = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("updates").collect();
    return docs
      .filter((u) => u.published)
      .sort((a, b) => b.date - a.date);
  },
});

export const announcementsList = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("announcements").collect();
    const published = docs.filter((a) => a.published);
    published.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
    const hydrated = await Promise.all(
      published.map(async (a) => {
        const author = a.authorId ? await ctx.db.get(a.authorId) : null;
        return { ...a, author: author ? publicUser(author) : null };
      }),
    );
    return hydrated;
  },
});

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const [courses, users, certificates] = await Promise.all([
      ctx.db.query("courses").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("certificates").collect(),
    ]);
    return {
      courses: courses.filter((c) => c.published).length,
      students: users.filter((u) => u.role !== ROLES.TUTOR).length,
      tutors: users.filter((u) => u.role === ROLES.TUTOR && !!u.verified).length,
      certificates: certificates.length,
    };
  },
});

/**
 * The authenticated student's in-progress enrollments, surfaced on the
 * mobile homepage "Continue learning" pill. Guests and tutors/admins get
 * `null` (the section stays hidden) — only enrolled students see their
 * own active courses.
 */
export const myContinueLearning = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user || user.role === ROLES.TUTOR || user.role === ROLES.ADMIN) {
      return null;
    }
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const inProgress = enrollments.filter(
      (e) => e.status === "in-progress",
    );
    if (inProgress.length === 0) return null;
    const courseIds = inProgress.map((e) => e.courseId);
    const courses = await Promise.all(
      courseIds.map((id) => ctx.db.get(id)),
    );
    const hydrated = await Promise.all(
      (courses.filter(Boolean) as Doc<"courses">[]).map((c) =>
        hydrateCourse(ctx, c),
      ),
    );
    const courseMap = new Map(hydrated.map((h) => [h._id, h]));
    const totalLessonsByCourse = new Map<string, number>();
    for (const c of courses.filter(Boolean) as Doc<"courses">[]) {
      const lessons = await ctx.db
        .query("lessons")
        .withIndex("by_courseId", (q) => q.eq("courseId", c._id))
        .collect();
      totalLessonsByCourse.set(c._id, lessons.length);
    }
    return inProgress
      .map((e) => {
        const course = courseMap.get(e.courseId);
        if (!course) return null;
        const totalLessons = totalLessonsByCourse.get(e.courseId) ?? 0;
        return {
          course,
          progress: e.progress,
          completedLessons: e.completedLessons.length,
          totalLessons,
          enrolledAt: e.enrolledAt,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.enrolledAt - a.enrolledAt);
  },
});

/**
 * Admin-customizable certificate branding (logo, institution, signature,
 * accent color). Stored in `siteContent` under the `certificateBranding`
 * key; falls back to the platform defaults when not configured yet.
 */
export const certificateBranding = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("siteContent")
      .withIndex("by_key", (q) => q.eq("key", "certificateBranding"))
      .first();
    const b = doc?.value;
    return {
      institutionName:
        typeof b?.institutionName === "string" && b.institutionName
          ? b.institutionName
          : "ForgeX Academy",
      motto:
        typeof b?.motto === "string" && b.motto
          ? b.motto
          : "Learn. Build. Succeed.",
      signatoryName:
        typeof b?.signatoryName === "string" ? b.signatoryName : "",
      signatoryTitle:
        typeof b?.signatoryTitle === "string" ? b.signatoryTitle : "",
      logoUrl:
        typeof b?.logoUrl === "string" && b.logoUrl ? b.logoUrl : null,
      signatureUrl:
        typeof b?.signatureUrl === "string" && b.signatureUrl
          ? b.signatureUrl
          : null,
      accentColor:
        typeof b?.accentColor === "string" && b.accentColor
          ? b.accentColor
          : "#a3e635",
    };
  },
});

export const verifyCertificate = query({
  args: { certificateId: v.string() },
  handler: async (ctx, { certificateId }) => {
    const cert = await ctx.db
      .query("certificates")
      .withIndex("by_certificateId", (q) => q.eq("certificateId", certificateId))
      .first();
    if (!cert) return null;
    const student = await ctx.db.get(cert.studentId);
    const course = await ctx.db.get(cert.courseId);
    return {
      ...cert,
      studentImage: student?.image ?? null,
      course: course
        ? { title: course.title, categoryId: course.categoryId }
        : null,
    };
  },
});
