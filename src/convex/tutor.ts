import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  checkRateLimit,
  hydrateCourse,
  publicUser,
  requireAdminSession,
  requireTutor,
  requireTutorOrToken,
  requireTutorPreview,
  slugify,
} from "./lib";
import {
  assignmentQuestionValidator,
  difficultyValidator,
  questionValidator,
  resourceValidator,
  ROLES,
  type AssignmentQuestion,
  type Question,
} from "./schema";

// ---------------------------------------------------------------------------
// Builder validation — publishing rules enforced server-side.
// Drafts may be saved incomplete; publishing never can be.
// ---------------------------------------------------------------------------

/** Throws with a precise message if a quiz cannot go live. */
export function validateQuizForPublish(questions: Question[], publishing: boolean) {
  if (!publishing) return;
  if (questions.length === 0) {
    throw new Error("Add at least one question before publishing this quiz.");
  }
  questions.forEach((q, i) => {
    const label = `Question ${i + 1}`;
    if (!q.question.trim()) throw new Error(`${label}: the question text is missing.`);
    if (q.type === "multiple-choice") {
      const opts = (q.options ?? []).filter((o) => o.trim());
      if (opts.length < 2)
        throw new Error(`${label}: multiple choice needs at least two answer options.`);
      if (!q.answer?.trim() || !opts.some((o) => o.trim().toLowerCase() === q.answer!.trim().toLowerCase()))
        throw new Error(`${label}: select which option is the correct answer.`);
    } else if (q.type === "true-false") {
      if (!q.answer?.trim())
        throw new Error(`${label}: choose whether the correct answer is True or False.`);
    } else if (q.type === "short-answer") {
      const hasKey =
        (q.answer ?? "").trim() !== "" || (q.acceptedAnswers ?? []).some((a) => a.trim());
      if (!hasKey)
        throw new Error(`${label}: provide an expected answer (plus any acceptable alternatives).`);
    }
  });
}

/** Throws if an assignment cannot go live. Legacy assignments (no structured
 *  questions) remain publishable — they keep the classic text submission. */
export function validateAssignmentForPublish(questions: AssignmentQuestion[]) {
  if (questions.length === 0) return;
  questions.forEach((q, i) => {
    if (!q.question.trim())
      throw new Error(`Question ${i + 1}: the question text is missing.`);
    if ((q.maxMarks ?? 0) < 0) throw new Error(`Question ${i + 1}: marks can't be negative.`);
  });
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------


export const myCourses = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let tutor = await requireTutorPreview(ctx);
    if (!tutor) {
      // Admin-session preview (no user account): act as the first verified
      // tutor so the preview can create, list and reopen real courses.
      if (args.token) {
        await requireAdminSession(ctx, args.token);
        const users = await ctx.db.query("users").collect();
        tutor =
          users.find((u) => u.role === ROLES.TUTOR && !!u.verified) ??
          users.find((u) => u.role === ROLES.ADMIN) ??
          null;
        if (!tutor) return [];
      } else {
        return []; // plain admin session preview without token — no identity
      }
    }
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_tutor", (q) => q.eq("tutorId", tutor._id))
      .collect();
    const submissions = await ctx.db.query("submissions").collect();
    const assignments = await ctx.db.query("assignments").collect();
    const lessons = await ctx.db.query("lessons").collect();

    const hydrated = await Promise.all(
      courses.map(async (c) => {
        const hc = await hydrateCourse(ctx, c);
        const courseAssignments = assignments.filter((a) => a.courseId === c._id);
        const pending = submissions.filter(
          (s) =>
            courseAssignments.some((a) => a._id === s.assignmentId) &&
            s.grade === undefined,
        ).length;
        return {
          ...hc,
          lessonsCount: lessons.filter((l) => l.courseId === c._id).length,
          assignmentsCount: courseAssignments.length,
          pendingSubmissions: pending,
          totalStudents: c.enrolledCount,
        };
      }),
    );
    return hydrated.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const tutorStudents = query({
  args: {},
  handler: async (ctx) => {
    const tutor = await requireTutorPreview(ctx);
    if (!tutor) return [];
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_tutor", (q) => q.eq("tutorId", tutor._id))
      .collect();
    const courseIds = new Set(courses.map((c) => c._id));
    const enrollments = await ctx.db.query("enrollments").collect();
    const mine = enrollments.filter((e) => courseIds.has(e.courseId));
    const users = await ctx.db.query("users").collect();
    const byStudent = new Map<string, typeof mine>();
    for (const e of mine) {
      const list = byStudent.get(e.studentId) ?? [];
      list.push(e);
      byStudent.set(e.studentId, list);
    }
    const students = await Promise.all(
      [...byStudent.entries()].map(async ([id, enrolls]) => {
        const u = users.find((x) => x._id === id);
        const courseRows = await Promise.all(
          enrolls.map(async (e) => {
            const course = courses.find((c) => c._id === e.courseId);
            return {
              courseId: e.courseId,
              courseTitle: course?.title ?? "Unknown",
              courseSlug: course?.slug ?? "",
              progress: e.progress,
              status: e.status,
              enrolledAt: e.enrolledAt,
            };
          }),
        );
        return {
          student: u ? publicUser(u) : null,
          enrolledCourses: courseRows,
          avgProgress: enrolls.reduce((s, e) => s + e.progress, 0) / Math.max(1, enrolls.length),
        };
      }),
    );
    return students.sort((a, b) => b.avgProgress - a.avgProgress);
  },
});

export const pendingSubmissions = query({
  args: {},
  handler: async (ctx) => {
    const tutor = await requireTutorPreview(ctx);
    if (!tutor) return [];
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_tutor", (q) => q.eq("tutorId", tutor._id))
      .collect();
    const courseIds = new Set(courses.map((c) => c._id));
    const assignments = await ctx.db.query("assignments").collect();
    const myAssignments = assignments.filter((a) => courseIds.has(a.courseId));
    const submissions = await ctx.db.query("submissions").collect();
    const pending = submissions.filter(
      (s) =>
        myAssignments.some((a) => a._id === s.assignmentId) &&
        s.grade === undefined,
    );
    const hydrated = await Promise.all(
      pending.map(async (s) => {
        const assignment = myAssignments.find((a) => a._id === s.assignmentId);
        const student = await ctx.db.get(s.studentId);
        const course = courses.find((c) => c._id === s.courseId);
        return {
          ...s,
          assignment: assignment
            ? {
                _id: assignment._id,
                title: assignment.title,
                maxScore: assignment.maxScore,
              }
            : null,
          student: student ? publicUser(student) : null,
          course: course
            ? { _id: course._id, title: course.title, slug: course.slug }
            : null,
        };
      }),
    );
    return hydrated.sort((a, b) => b.submittedAt - a.submittedAt);
  },
});

export const courseSubmissions = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const tutor = await requireTutorPreview(ctx);
    if (!tutor) return [];
    const course = await ctx.db.get(courseId);
    if (!course || (course.tutorId !== tutor._id && tutor.role !== "admin")) {
      throw new Error("Not your course.");
    }
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_course", (q) => q.eq("courseId", courseId as never))
      .collect();
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_course", (q) => q.eq("courseId", courseId as never))
      .collect();
    const hydrated = await Promise.all(
      submissions.map(async (s) => {
        const student = await ctx.db.get(s.studentId);
        const assignment = assignments.find((a) => a._id === s.assignmentId);
        return {
          ...s,
          student: student ? publicUser(student) : null,
          assignment: assignment ?? null,
        };
      }),
    );
    return hydrated.sort((a, b) => b.submittedAt - a.submittedAt);
  },
});

// ---------------------------------------------------------------------------
// Course CRUD
// ---------------------------------------------------------------------------

export const upsertCourse = mutation({
  args: {
    id: v.optional(v.id("courses")),
    title: v.string(),
    subtitle: v.string(),
    description: v.string(),
    longDescription: v.string(),
    categoryId: v.optional(v.id("categories")),
    tutorId: v.id("users"),
    roadmapId: v.optional(v.id("roadmaps")),
    levelId: v.optional(v.id("roadmapLevels")),
    difficulty: difficultyValidator,
    durationHours: v.number(),
    image: v.optional(v.string()),
    // Device-uploaded thumbnail: resolved to an authoritative URL below.
    imageStorageId: v.optional(v.id("_storage")),
    gradient: v.optional(v.string()),
    icon: v.optional(v.string()),
    prerequisites: v.array(v.string()),
    skills: v.array(v.string()),
    featured: v.boolean(),
    published: v.optional(v.boolean()),
    // Admin-session preview (password gate, no account) can build courses too.
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tutor, isPreview } = await requireTutorOrToken(ctx, args.token);
    if (!isPreview) {
      // Abuse guard: max 20 course create/update writes per tutor per hour.
      await checkRateLimit(ctx, `tutor:${tutor!._id}`, 20, 60 * 60 * 1000);
      if (args.tutorId !== tutor!._id && tutor!.role !== "admin") {
        throw new Error("You can only create courses for yourself.");
      }
    }
    // Category fallback — the builder must never dead-end on a missing pick;
    // mandatory validation happens at publish time instead.
    let categoryId = args.categoryId;
    if (!categoryId) {
      const first = await ctx.db.query("categories").first();
      categoryId = first?._id;
      if (!categoryId) {
        categoryId = await ctx.db.insert("categories", {
          name: "General",
          slug: "general",
          description: "Catch-all category for new courses.",
          icon: "Sparkles",
          color: "lime",
        });
      }
    }
    const isAdmin = isPreview ? true : tutor!.role === "admin";

    // Admins can publish directly; tutors always save as draft and must
    // submit for review before the course can go live.
    const published = isAdmin ? !!args.published : false;
    const status = isAdmin
      ? (args.published ? "approved" : "draft")
      : "draft";

    const baseSlug = slugify(args.title) || `course-${Date.now()}`;
    const exists = await ctx.db
      .query("courses")
      .withIndex("by_slug", (q) => q.eq("slug", baseSlug))
      .first();
    const slug =
      exists && exists._id !== args.id
        ? `${baseSlug}-${Date.now().toString(36)}`
        : baseSlug;
    // Resolve a device-uploaded thumbnail to its authoritative public URL.
    let image = args.image;
    if (args.imageStorageId) {
      image =
        (await ctx.storage.getUrl(args.imageStorageId)) ?? args.image;
    }
    if (args.id) {
      await ctx.db.patch(args.id, {
        title: args.title,
        subtitle: args.subtitle,
        description: args.description,
        longDescription: args.longDescription,
        categoryId,
        tutorId: args.tutorId,
        roadmapId: args.roadmapId,
        levelId: args.levelId,
        difficulty: args.difficulty,
        durationHours: args.durationHours,
        image,
        imageStorageId: args.imageStorageId,
        gradient: args.gradient,
        icon: args.icon,
        prerequisites: args.prerequisites,
        skills: args.skills,
        featured: args.featured,
        published,
        status,
      });
      return args.id;
    }
    return await ctx.db.insert("courses", {
      title: args.title,
      slug,
      subtitle: args.subtitle,
      description: args.description,
      longDescription: args.longDescription,
      categoryId,
      tutorId: args.tutorId,
      roadmapId: args.roadmapId,
      levelId: args.levelId,
      difficulty: args.difficulty,
      durationHours: args.durationHours,
      rating: 0,
      ratingCount: 0,
      image,
      imageStorageId: args.imageStorageId,
      gradient: args.gradient,
      icon: args.icon,
      prerequisites: args.prerequisites,
      skills: args.skills,
      featured: args.featured,
      published,
      status,
      enrolledCount: 0,
      createdAt: Date.now(),
    });
  },
});

/** Tutor submits their course for admin review (goes live only if approved). */
export const submitCourseForReview = mutation({
  args: { courseId: v.id("courses"), token: v.optional(v.string()) },
  handler: async (ctx, { courseId, token }) => {
    const { tutor, isPreview } = await requireTutorOrToken(ctx, token);
    const course = await ctx.db.get(courseId);
    if (
      !course ||
      (!isPreview && course.tutorId !== tutor!._id && tutor!.role !== "admin")
    ) {
      throw new Error("Not your course.");
    }
    await ctx.db.patch(courseId, {
      status: "pending",
      published: false,
      reviewNote: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.emailTriggers.notifyCourseSubmittedToStaff, {
      courseId,
      courseTitle: course.title,
      tutorName: tutor?.name ?? "A tutor",
    });
    return true;
  },
});

export const deleteCourse = mutation({
  args: { id: v.id("courses"), token: v.optional(v.string()) },
  handler: async (ctx, { id, token }) => {
    const { tutor, isPreview } = await requireTutorOrToken(ctx, token);
    const course = await ctx.db.get(id);
    if (
      !course ||
      (!isPreview && course.tutorId !== tutor!._id && tutor!.role !== "admin")
    ) {
      throw new Error("Not your course.");
    }
    await ctx.db.delete(id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export const upsertLesson = mutation({
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
        v.literal("mux"),
      ),
    ),
    image: v.optional(v.string()),
    muxAssetId: v.optional(v.string()),
    muxPlaybackId: v.optional(v.string()),
    videoStorageId: v.optional(v.id("_storage")),
    notes: v.string(),
    transcript: v.string(),
    resources: v.array(resourceValidator),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tutor, isPreview } = await requireTutorOrToken(ctx, args.token);
    if (!isPreview) {
      await checkRateLimit(ctx, `tutor:${tutor!._id}`, 20, 60 * 60 * 1000);
    }
    // Direct device uploads: resolve the authoritative playback URL from
    // Convex storage server-side — never trust a client-derived URL.
    let videoUrl = args.videoUrl;
    if (args.videoStorageId) {
      videoUrl = (await ctx.storage.getUrl(args.videoStorageId)) ?? args.videoUrl;
    }
    if (args.id) {
      await ctx.db.patch(args.id, {
        courseId: args.courseId,
        title: args.title,
        order: args.order,
        durationMinutes: args.durationMinutes,
        videoUrl,
        videoType: args.videoType,
        image: args.image,
        muxAssetId: args.muxAssetId,
        muxPlaybackId: args.muxPlaybackId,
        videoStorageId: args.videoStorageId,
        notes: args.notes,
        transcript: args.transcript,
        resources: args.resources,
      });
      return args.id;
    }
    return await ctx.db.insert("lessons", {
      courseId: args.courseId,
      title: args.title,
      order: args.order,
      durationMinutes: args.durationMinutes,
      videoUrl,
      videoType: args.videoType,
      image: args.image,
      muxAssetId: args.muxAssetId,
      muxPlaybackId: args.muxPlaybackId,
      videoStorageId: args.videoStorageId,
      notes: args.notes,
      transcript: args.transcript,
      resources: args.resources,
    });
  },
});

/** Attach a finished Mux upload (asset + playback id) to an existing lesson. */
export const setLessonMux = mutation({
  args: {
    lessonId: v.id("lessons"),
    muxAssetId: v.string(),
    muxPlaybackId: v.string(),
  },
  handler: async (ctx, { lessonId, muxAssetId, muxPlaybackId }) => {
    await requireTutor(ctx);
    await ctx.db.patch(lessonId, { muxAssetId, muxPlaybackId });
    return true;
  },
});

export const deleteLesson = mutation({
  args: { id: v.id("lessons"), token: v.optional(v.string()) },
  handler: async (ctx, { id, token }) => {
    await requireTutorOrToken(ctx, token);
    await ctx.db.delete(id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

export const courseQuizzesFull = query({
  args: { courseId: v.string(), token: v.optional(v.string()) },
  handler: async (ctx, { courseId, token }) => {
    if (token) {
      await requireAdminSession(ctx, token);
    } else {
      const tutor = await requireTutorPreview(ctx);
      if (!tutor) return [];
    }
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_course", (q) => q.eq("courseId", courseId as never))
      .collect();
    return quizzes.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const upsertQuiz = mutation({
  args: {
    id: v.optional(v.id("quizzes")),
    courseId: v.id("courses"),
    title: v.string(),
    description: v.string(),
    timeLimitMinutes: v.number(),
    questions: v.array(questionValidator),
    // Quiz Builder settings
    passingScorePercent: v.optional(v.number()),
    attemptLimit: v.optional(v.number()),
    published: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tutor, isPreview } = await requireTutorOrToken(ctx, args.token);
    if (!isPreview) {
      await checkRateLimit(ctx, `tutor:${tutor!._id}`, 20, 60 * 60 * 1000);
    }
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found.");
    if (
      !isPreview &&
      course.tutorId !== tutor!._id &&
      tutor!.role !== "admin"
    ) {
      throw new Error("Not your course.");
    }
    validateQuizForPublish(args.questions, args.published !== false);
    const patch = {
      title: args.title,
      description: args.description,
      timeLimitMinutes: Math.max(0, Math.round(args.timeLimitMinutes)),
      questions: args.questions,
      passingScorePercent:
        args.passingScorePercent === undefined
          ? undefined
          : Math.max(1, Math.min(100, Math.round(args.passingScorePercent))),
      attemptLimit:
        args.attemptLimit === undefined
          ? undefined
          : Math.max(0, Math.round(args.attemptLimit)),
      updatedAt: Date.now(),
    };
    if (args.id) {
      await ctx.db.patch(args.id, {
        ...patch,
        published: args.published,
      });
      return args.id;
    }
    return await ctx.db.insert("quizzes", {
      courseId: args.courseId,
      tutorId: course.tutorId,
      ...patch,
      published: args.published ?? true, // legacy default: live immediately
      createdAt: Date.now(),
    });
  },
});

export const deleteQuiz = mutation({
  args: { id: v.id("quizzes"), token: v.optional(v.string()) },
  handler: async (ctx, { id, token }) => {
    const { tutor, isPreview } = await requireTutorOrToken(ctx, token);
    const quiz = await ctx.db.get(id);
    if (
      !quiz ||
      (!isPreview && quiz.tutorId !== tutor!._id && tutor!.role !== "admin")
    ) {
      throw new Error("Not your quiz.");
    }
    await ctx.db.delete(id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export const courseAssignmentsFull = query({
  args: { courseId: v.string(), token: v.optional(v.string()) },
  handler: async (ctx, { courseId, token }) => {
    if (token) {
      await requireAdminSession(ctx, token);
    } else {
      const tutor = await requireTutorPreview(ctx);
      if (!tutor) return [];
    }
    const docs = await ctx.db
      .query("assignments")
      .withIndex("by_course", (q) => q.eq("courseId", courseId as never))
      .collect();
    return docs.sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity));
  },
});

export const upsertAssignment = mutation({
  args: {
    id: v.optional(v.id("assignments")),
    courseId: v.id("courses"),
    title: v.string(),
    description: v.string(),
    instructions: v.string(),
    deadline: v.optional(v.number()),
    maxScore: v.number(),
    files: v.array(resourceValidator),
    // Assignment Builder settings
    questions: v.optional(v.array(assignmentQuestionValidator)),
    published: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tutor, isPreview } = await requireTutorOrToken(ctx, args.token);
    if (!isPreview) {
      await checkRateLimit(ctx, `tutor:${tutor!._id}`, 20, 60 * 60 * 1000);
    }
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found.");
    if (
      !isPreview &&
      course.tutorId !== tutor!._id &&
      tutor!.role !== "admin"
    ) {
      throw new Error("Not your course.");
    }
    if (args.published !== false) validateAssignmentForPublish(args.questions ?? []);
    if (args.id) {
      await ctx.db.patch(args.id, {
        title: args.title,
        description: args.description,
        instructions: args.instructions,
        deadline: args.deadline,
        maxScore: Math.max(1, Math.round(args.maxScore)),
        files: args.files,
        questions: args.questions ?? [],
        published: args.published,
      });
      return args.id;
    }
    return await ctx.db.insert("assignments", {
      courseId: args.courseId,
      tutorId: course.tutorId,
      title: args.title,
      description: args.description,
      instructions: args.instructions,
      deadline: args.deadline,
      maxScore: Math.max(1, Math.round(args.maxScore)),
      files: args.files,
      questions: args.questions ?? [],
      published: args.published ?? true, // legacy default: live immediately
      createdAt: Date.now(),
    });
  },
});

export const deleteAssignment = mutation({
  args: { id: v.id("assignments"), token: v.optional(v.string()) },
  handler: async (ctx, { id, token }) => {
    await requireTutorOrToken(ctx, token);
    await ctx.db.delete(id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Announcements (tutors can post)
// ---------------------------------------------------------------------------

export const upsertAnnouncement = mutation({
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
  },
  handler: async (ctx, args) => {
    const user = await requireTutor(ctx);
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
    return await ctx.db.insert("announcements", {
      authorId: user._id,
      title: args.title,
      body: args.body,
      category: args.category,
      pinned: args.pinned,
      published: args.published,
      createdAt: Date.now(),
    });
  },
});

export const deleteAnnouncement = mutation({
  args: { id: v.id("announcements") },
  handler: async (ctx, { id }) => {
    await requireTutor(ctx);
    await ctx.db.delete(id);
    return true;
  },
});

export const allAnnouncements = query({
  args: {},
  handler: async (ctx) => {
    const tutor = await requireTutorPreview(ctx);
    if (!tutor) return [];
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

// ---------------------------------------------------------------------------
// Analytical dashboard
// ---------------------------------------------------------------------------

/**
 * One-stop overview for the tutor dashboard: headline counts (students,
 * unanswered questions, active communities, announcements, pending grading)
 * plus per-cohort learning progress — how many students completed each
 * lesson/module in every community the tutor teaches, so the tutor can spot
 * where learners drop off without checking each student manually.
 *
 * “Unanswered questions” is a pragmatic heuristic: student messages in the
 * tutor's active communities (last 30 days) that are either open discussion
 * threads without a verified tutor answer, or standalone messages that have
 * received no reply at all.
 */
export const analyticsOverview = query({
  args: {},
  handler: async (ctx) => {
    const tutor = await requireTutorPreview(ctx);
    if (!tutor) return null;

    const courses = await ctx.db
      .query("courses")
      .withIndex("by_tutor", (q) => q.eq("tutorId", tutor._id))
      .collect();
    const courseIds = new Set(courses.map((c) => c._id));

    // Communities where this tutor is staff.
    const myMemberships = await ctx.db
      .query("communityMembers")
      .withIndex("by_user", (q) => q.eq("userId", tutor._id))
      .collect();
    const staffMemberships = myMemberships.filter(
      (m) =>
        (m.role === "tutor" || m.role === "admin" || m.role === "moderator") &&
        m.status === "active",
    );
    const communities = (
      await Promise.all(
        staffMemberships.map((m) => ctx.db.get(m.communityId)),
      )
    ).filter((c): c is NonNullable<typeof c> => !!c);
    const activeCommunities = communities.filter(
      (c) => c.status === "active",
    );

    // Enrollments across the tutor's courses.
    const enrollments = await ctx.db.query("enrollments").collect();
    const mine = enrollments.filter((e) => courseIds.has(e.courseId));
    const totalStudents = new Set(mine.map((e) => e.studentId)).size;

    // Unanswered questions in the tutor's active communities.
    let unansweredQuestions = 0;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const studentIdsByCommunity = new Map<string, Set<string>>();
    for (const community of activeCommunities) {
      const members = await ctx.db
        .query("communityMembers")
        .withIndex("by_community", (q) => q.eq("communityId", community._id))
        .collect();
      const studentIds = new Set(
        members
          .filter((m) => m.role === "student" && m.status === "active")
          .map((m) => m.userId),
      );
      studentIdsByCommunity.set(community._id, studentIds);
      const staffIds = new Set(
        members
          .filter((m) => m.role !== "student" && m.status === "active")
          .map((m) => m.userId),
      );
      const messages = await ctx.db
        .query("communityMessages")
        .withIndex("by_community", (q) =>
          q.eq("communityId", community._id).gt("createdAt", cutoff),
        )
        .collect();
      const repliedTo = new Set(
        messages
          .map((m) => m.replyToId?.toString())
          .filter((x): x is string => !!x),
      );
      for (const m of messages) {
        if (m.deleted || m.senderKind !== "user") continue;
        if (m.isAnnouncement || m.pollId) continue;
        if (!m.senderId) continue;
        if (staffIds.has(m.senderId)) continue; // staff posts aren't questions
        if (!studentIds.has(m.senderId)) continue;
        if (m.discussionId) continue; // replies inside a thread
        if (m.isDiscussion) {
          if (!m.tutorAnswer) unansweredQuestions += 1;
          continue;
        }
        if (!m.replyToId && !repliedTo.has(m._id)) {
          unansweredQuestions += 1;
        }
      }
    }

    // Announcements authored by this tutor (published only).
    const announcements = await ctx.db.query("announcements").collect();
    const announcementCount = announcements.filter(
      (a) => a.authorId === tutor._id && a.published,
    ).length;

    // Pending grading = ungraded submissions on the tutor's assignments.
    const assignments = await ctx.db.query("assignments").collect();
    const submissions = await ctx.db.query("submissions").collect();
    const myAssignmentIds = new Set(
      assignments
        .filter((a) => courseIds.has(a.courseId))
        .map((a) => a._id),
    );
    const pendingAssignments = submissions.filter(
      (s) => myAssignmentIds.has(s.assignmentId) && s.grade === undefined,
    ).length;

    // Per-cohort learning progress.
    const lessons = await ctx.db.query("lessons").collect();
    const users = await ctx.db.query("users").collect();
    const userById = new Map(users.map((u) => [u._id, u]));
    const cohorts = await Promise.all(
      activeCommunities.map(async (community) => {
        const course = courses.find((c) => c._id === community.courseId);
        const studentIds =
          studentIdsByCommunity.get(community._id) ?? new Set<string>();
        const courseEnrollments = mine.filter(
          (e) =>
            e.courseId === community.courseId &&
            studentIds.has(e.studentId),
        );
        const lessonRows = lessons
          .filter((l) => l.courseId === community.courseId)
          .sort((a, b) => a.order - b.order);
        const modules = lessonRows.map((lesson) => ({
          lessonId: lesson._id,
          title: lesson.title,
          order: lesson.order,
          completed: courseEnrollments.filter((e) =>
            e.completedLessons.some((l) => l === lesson._id),
          ).length,
          total: courseEnrollments.length,
        }));
        const avgProgress = courseEnrollments.length
          ? Math.round(
              courseEnrollments.reduce((s, e) => s + e.progress, 0) /
                courseEnrollments.length,
            )
          : 0;
        const atRisk = courseEnrollments
          .filter((e) => e.progress < 50)
          .sort((a, b) => a.progress - b.progress)
          .slice(0, 5)
          .map((e) => {
            const u = userById.get(e.studentId);
            return {
              student: u ? publicUser(u) : null,
              progress: e.progress,
              lastActivity: u?.lastActivity ?? null,
            };
          });
        const capacity = community.studentCapacity ?? 0;
        return {
          communityId: community._id,
          name: community.name,
          cohortLabel: community.cohortLabel ?? null,
          courseId: community.courseId,
          courseTitle: course?.title ?? "Course",
          status: community.status,
          studentCount: courseEnrollments.length,
          capacity,
          capacityState: !capacity
            ? ("open" as const)
            : community.enrollmentClosed
              ? ("closed" as const)
              : courseEnrollments.length >= capacity
                ? ("full" as const)
                : ("open" as const),
          avgProgress,
          modules,
          atRisk,
        };
      }),
    );
    cohorts.sort((a, b) => b.studentCount - a.studentCount);

    return {
      tutor: publicUser(tutor),
      counts: {
        totalStudents,
        unansweredQuestions,
        activeCommunities: activeCommunities.length,
        announcements: announcementCount,
        pendingAssignments,
      },
      cohorts,
    };
  },
});

/**
 * Assign (once) the tutor's public page slug — e.g. `/tutor/david-ogunleye`.
 * New tutors get it automatically at approval time; this covers any tutor
 * who was verified before slugs existed, and returns the stable slug.
 */
export const claimMySlug = mutation({
  args: {},
  handler: async (ctx) => {
    const tutor = await requireTutor(ctx);
    if (tutor.slug) return tutor.slug;
    const base =
      slugify(tutor.name ?? "") || `tutor-${tutor._id.toString().slice(0, 8)}`;
    let slug = base;
    let i = 2;
    while (
      await ctx.db
        .query("users")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()
    ) {
      slug = `${base}-${i}`;
      i += 1;
    }
    await ctx.db.patch(tutor._id, { slug });
    return slug;
  },
});
