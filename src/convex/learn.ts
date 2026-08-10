import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit, requireUser, requireUserDoc, hydrateCourses, hydrateCourse, notify, yyyymmdd, makeCertificateId } from "./lib";

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export const enrollmentStatus = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUser(ctx);
    return await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect()
      .then((rows) => rows.find((e) => e.courseId === courseId) ?? null);
  },
});

export const enroll = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const user = await requireUserDoc(ctx);
    // Abuse guard: max 60 learn actions (enroll / complete) per user per hour.
    await checkRateLimit(ctx, `learn:${user._id}`, 60, 60 * 60 * 1000);
    const course = await ctx.db.get(courseId);
    if (!course || !course.published) throw new Error("Course not found.");
    const existing = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .collect()
      .then((rows) => rows.find((e) => e.courseId === courseId));
    if (existing) return existing._id;
    const id = await ctx.db.insert("enrollments", {
      studentId: user._id,
      courseId,
      enrolledAt: Date.now(),
      status: "in-progress",
      completedLessons: [],
      progress: 0,
    });
    await ctx.db.patch(courseId, { enrolledCount: course.enrolledCount + 1 });
    if (course.tutorId !== user._id) {
      await notify(ctx, {
        userId: course.tutorId,
        title: "New student enrolled",
        body: `${user.name || "A student"} enrolled in "${course.title}".`,
        type: "enrollment",
        link: `/tutor`,
      });
    }
    return id;
  },
});

export const myEnrollments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const hydrated = await Promise.all(
      enrollments.map(async (e) => {
        const course = await ctx.db.get(e.courseId);
        if (!course) return null;
        const hc = await hydrateCourse(ctx, course);
        const lessonCount = (await ctx.db.query("lessons").withIndex("by_courseId", (q) => q.eq("courseId", course._id)).collect()).length;
        return { enrollment: e, course: hc, lessonCount };
      }),
    );
    return hydrated
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.enrollment.enrolledAt - a.enrollment.enrolledAt);
  },
});

// ---------------------------------------------------------------------------
// Lesson completion → progress → certificate
// ---------------------------------------------------------------------------

export const completeLesson = mutation({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, { lessonId }) => {
    const user = await requireUserDoc(ctx);
    await checkRateLimit(ctx, `learn:${user._id}`, 60, 60 * 60 * 1000);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) throw new Error("Lesson not found.");
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .collect()
      .then((rows) => rows.find((e) => e.courseId === lesson.courseId));
    if (!enrollment) throw new Error("Enroll in this course first.");

    if (!enrollment.completedLessons.includes(lessonId)) {
      const completedLessons = [...enrollment.completedLessons, lessonId];
      const allLessons = await ctx.db
        .query("lessons")
        .withIndex("by_courseId", (q) => q.eq("courseId", lesson.courseId))
        .collect();
      const progress = Math.min(
        100,
        Math.round((completedLessons.length / Math.max(1, allLessons.length)) * 100),
      );
      const status =
        progress >= 100 && completedLessons.length >= allLessons.length
          ? ("completed" as const)
          : ("in-progress" as const);
      await ctx.db.patch(enrollment._id, { completedLessons, progress, status });

      // streak
      const today = yyyymmdd(Date.now());
      const yesterday = yyyymmdd(Date.now() - 86400000);
      const lastDay = user.streakLastDay ?? 0;
      let streak = user.streak ?? 0;
      if (lastDay !== today) {
        streak = lastDay === yesterday ? streak + 1 : 1;
        await ctx.db.patch(user._id, { streak, streakLastDay: today });
      }

      // certificate on completion
      if (status === "completed") {
        const course = await ctx.db.get(lesson.courseId);
        const existing = await ctx.db
          .query("certificates")
          .withIndex("by_student", (q) => q.eq("studentId", user._id))
          .collect()
          .then((rows) => rows.find((c) => c.courseId === lesson.courseId));
        if (course && !existing) {
          const certificateId = makeCertificateId();
          await ctx.db.insert("certificates", {
            certificateId,
            studentId: user._id,
            courseId: course._id,
            issuedAt: Date.now(),
            studentName: user.name || "Student",
            courseTitle: course.title,
          });
          await ctx.db.patch(user._id, {
            badges: [...(user.badges ?? []).filter((b) => b !== course.title), course.title],
          });
          await notify(ctx, {
            userId: user._id,
            title: "Course completed! 🎉",
            body: `You earned a certificate for "${course.title}". Show it off — it's verifiable.`,
            type: "certificate",
            link: "/dashboard/certificates",
          });
        }
      }
    }
    return true;
  },
});

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export const recommendations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const enrolledIds = new Set(enrollments.map((e) => e.courseId));
    const all = await ctx.db.query("courses").collect();
    const candidates = all.filter(
      (c) => c.published && !enrolledIds.has(c._id),
    );
    // prefer courses sharing a category with enrolled courses
    const myCats = new Set(
      enrollments
        .map((e) => all.find((c) => c._id === e.courseId)?.categoryId)
        .filter(Boolean),
    );
    candidates.sort((a, b) => {
      const aScore = myCats.has(a.categoryId) ? 1 : 0;
      const bScore = myCats.has(b.categoryId) ? 1 : 0;
      return bScore - aScore || b.rating - a.rating;
    });
    return hydrateCourses(ctx, candidates.slice(0, 6));
  },
});

// ---------------------------------------------------------------------------
// Roadmap progress for the signed-in student
// ---------------------------------------------------------------------------

export const roadmapProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const roadmaps = await ctx.db.query("roadmaps").collect();
    const levels = await ctx.db.query("roadmapLevels").collect();
    const courses = await ctx.db.query("courses").collect();

    const hydrated = await Promise.all(
      roadmaps.map(async (r) => {
        const rLevels = levels
          .filter((l) => l.roadmapId === r._id)
          .sort((a, b) => a.order - b.order);
        const levelData = [] as Array<unknown>;
        let prevStarted = false;
        for (const l of rLevels) {
          const levelCourses = courses.filter(
            (c) => c.levelId === l._id && c.published,
          );
          const withProgress = await Promise.all(
            levelCourses.map(async (c) => {
              const hc = await hydrateCourse(ctx, c);
              const enr = enrollments.find((e) => e.courseId === c._id);
              const { status: _courseStatus, ...rest } = hc;
              return {
                ...rest,
                progress: enr?.progress ?? 0,
                status: enr?.status ?? null,
              };
            }),
          );
          const allDone =
            levelCourses.length > 0 &&
            withProgress.every((c) => c.status === "completed");
          const anyStarted = withProgress.some(
            (c) => c.progress > 0 || c.status === "completed",
          );
          levelData.push({
            ...l,
            courses: withProgress,
            done: allDone,
            unlocked: levelData.length === 0 || prevStarted,
          });
          prevStarted = prevStarted || allDone || anyStarted;
        }
        return {
          ...r,
          levels: levelData as Array<
            (typeof rLevels)[number] & {
              courses: Array<
                Omit<Awaited<ReturnType<typeof hydrateCourse>>, "status"> & {
                  progress: number;
                  status: "in-progress" | "completed" | null;
                }
              >;
              done: boolean;
              unlocked: boolean;
            }
          >,
        };
      }),
    );
    return hydrated;
  },
});
