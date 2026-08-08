import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { hydrateCourse, publicUser, requireTutor, requireTutorPreview, slugify } from "./lib";
import { difficultyValidator, questionValidator, resourceValidator } from "./schema";

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export const myCourses = query({
  args: {},
  handler: async (ctx) => {
    const tutor = await requireTutorPreview(ctx);
    if (!tutor) return []; // admin session preview — no tutor identity
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
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
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
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const tutor = await requireTutor(ctx);
    if (args.tutorId !== tutor._id && tutor.role !== "admin") {
      throw new Error("You can only create courses for yourself.");
    }
    const isAdmin = tutor.role === "admin";

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
    if (args.id) {
      await ctx.db.patch(args.id, {
        title: args.title,
        subtitle: args.subtitle,
        description: args.description,
        longDescription: args.longDescription,
        categoryId: args.categoryId,
        tutorId: args.tutorId,
        roadmapId: args.roadmapId,
        levelId: args.levelId,
        difficulty: args.difficulty,
        durationHours: args.durationHours,
        image: args.image,
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
      categoryId: args.categoryId,
      tutorId: args.tutorId,
      roadmapId: args.roadmapId,
      levelId: args.levelId,
      difficulty: args.difficulty,
      durationHours: args.durationHours,
      rating: 0,
      ratingCount: 0,
      image: args.image,
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
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const tutor = await requireTutor(ctx);
    const course = await ctx.db.get(courseId);
    if (!course || (course.tutorId !== tutor._id && tutor.role !== "admin")) {
      throw new Error("Not your course.");
    }
    await ctx.db.patch(courseId, {
      status: "pending",
      published: false,
      reviewNote: undefined,
    });
    return true;
  },
});

export const deleteCourse = mutation({
  args: { id: v.id("courses") },
  handler: async (ctx, { id }) => {
    const tutor = await requireTutor(ctx);
    const course = await ctx.db.get(id);
    if (!course || (course.tutorId !== tutor._id && tutor.role !== "admin")) {
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
      ),
    ),
    image: v.optional(v.string()),
    muxAssetId: v.optional(v.string()),
    muxPlaybackId: v.optional(v.string()),
    notes: v.string(),
    transcript: v.string(),
    resources: v.array(resourceValidator),
  },
  handler: async (ctx, args) => {
    await requireTutor(ctx);
    if (args.id) {
      await ctx.db.patch(args.id, {
        courseId: args.courseId,
        title: args.title,
        order: args.order,
        durationMinutes: args.durationMinutes,
        videoUrl: args.videoUrl,
        videoType: args.videoType,
        image: args.image,
        muxAssetId: args.muxAssetId,
        muxPlaybackId: args.muxPlaybackId,
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
      videoUrl: args.videoUrl,
      videoType: args.videoType,
      image: args.image,
      muxAssetId: args.muxAssetId,
      muxPlaybackId: args.muxPlaybackId,
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
  args: { id: v.id("lessons") },
  handler: async (ctx, { id }) => {
    await requireTutor(ctx);
    await ctx.db.delete(id);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

export const courseQuizzesFull = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const tutor = await requireTutorPreview(ctx);
    if (!tutor) return [];
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
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
  },
  handler: async (ctx, args) => {
    const tutor = await requireTutor(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course || (course.tutorId !== tutor._id && tutor.role !== "admin")) {
      throw new Error("Not your course.");
    }
    if (args.id) {
      await ctx.db.patch(args.id, {
        title: args.title,
        description: args.description,
        timeLimitMinutes: args.timeLimitMinutes,
        questions: args.questions,
      });
      return args.id;
    }
    return await ctx.db.insert("quizzes", {
      courseId: args.courseId,
      tutorId: tutor._id,
      title: args.title,
      description: args.description,
      timeLimitMinutes: args.timeLimitMinutes,
      questions: args.questions,
      createdAt: Date.now(),
    });
  },
});

export const deleteQuiz = mutation({
  args: { id: v.id("quizzes") },
  handler: async (ctx, { id }) => {
    const tutor = await requireTutor(ctx);
    const quiz = await ctx.db.get(id);
    if (!quiz || (quiz.tutorId !== tutor._id && tutor.role !== "admin")) {
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
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const tutor = await requireTutorPreview(ctx);
    if (!tutor) return [];
    const docs = await ctx.db
      .query("assignments")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
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
  },
  handler: async (ctx, args) => {
    const tutor = await requireTutor(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course || (course.tutorId !== tutor._id && tutor.role !== "admin")) {
      throw new Error("Not your course.");
    }
    if (args.id) {
      await ctx.db.patch(args.id, {
        title: args.title,
        description: args.description,
        instructions: args.instructions,
        deadline: args.deadline,
        maxScore: args.maxScore,
        files: args.files,
      });
      return args.id;
    }
    return await ctx.db.insert("assignments", {
      courseId: args.courseId,
      tutorId: tutor._id,
      title: args.title,
      description: args.description,
      instructions: args.instructions,
      deadline: args.deadline,
      maxScore: args.maxScore,
      files: args.files,
      createdAt: Date.now(),
    });
  },
});

export const deleteAssignment = mutation({
  args: { id: v.id("assignments") },
  handler: async (ctx, { id }) => {
    await requireTutor(ctx);
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
