import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { checkRateLimit, requireUser, requireUserDoc, hydrateCourses, hydrateCourse, notify, yyyymmdd, makeCertificateId } from "./lib";
import { addMembership, ensureCommunityForCourse } from "./community";
import { enrollmentEmail, certificateEmail } from "./emailTemplates";
import { courseRequirements, effectiveWatchedPercent, sanitizeWatchPercent, type Requirements } from "./lmsShared";

// ---------------------------------------------------------------------------
// Shared learning helpers (imported by lessonquizzes.ts / exams.ts)
// ---------------------------------------------------------------------------

export async function enrollmentFor(
  ctx: QueryCtx | MutationCtx,
  studentId: Id<"users">,
  courseId: Id<"courses">,
) {
  return await ctx.db
    .query("enrollments")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect()
    .then((rows) => rows.find((e) => e.courseId === courseId) ?? null);
}

/** Sequential gate: the lesson immediately before `lesson` (by order) must be
 *  completed before this one can be completed. The first lesson has no gate. */
async function assertPreviousCompleted(
  ctx: MutationCtx,
  courseId: Id<"courses">,
  lesson: Doc<"lessons">,
  enrollment: Doc<"enrollments">,
) {
  const allLessons = await ctx.db
    .query("lessons")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();
  const sorted = [...allLessons].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((l) => l._id === lesson._id);
  if (idx > 0) {
    const prev = sorted[idx - 1];
    if (!enrollment.completedLessons.includes(prev._id)) {
      throw new Error(
        `Complete "${prev.title}" before moving on to this lesson.`,
      );
    }
  }
}

/** Issue a certificate + badge + notification when a course is truly finished. */
export async function finishCourseInternal(
  ctx: MutationCtx,
  user: Doc<"users">,
  course: Doc<"courses">,
  enrollment: Doc<"enrollments">,
) {
  await ctx.db.patch(enrollment._id, { status: "completed", progress: 100 });
  const existing = await ctx.db
    .query("certificates")
    .withIndex("by_student", (q) => q.eq("studentId", user._id))
    .collect()
    .then((rows) => rows.find((c) => c.courseId === course._id));
  if (!existing) {
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
    // Transactional email: certificate notification via Gmail SMTP.
    const email = "email" in user ? String(user.email ?? "") : "";
    if (email) {
      await ctx.runMutation(internal.emailData.queueSystemEmail, {
        to: email,
        subject: `🎓 Certificate earned: ${course.title}`,
        html: certificateEmail({
          name: user.name || "Student",
          courseTitle: course.title,
          certificateId,
        }).html,
        emailType: "certificate",
      });
    }
  }
}

/** Shared lesson-completion path. The manual "Mark complete" button, the
 *  watch-gate auto-complete, and passing a lesson quiz all land here.
 *
 *  Backend-authoritative: video lessons can only complete once the credited
 *  (range-based) watch coverage meets the course's required percentage —
 *  client-supplied state is never trusted. */
export async function completeLessonInternal(
  ctx: MutationCtx,
  user: Doc<"users">,
  lessonId: Id<"lessons">,
) {
  const lesson = await ctx.db.get(lessonId);
  if (!lesson) throw new Error("Lesson not found.");
  const enrollment = await enrollmentFor(ctx, user._id, lesson.courseId);
  if (!enrollment) throw new Error("Enroll in this course first.");
  const course = await ctx.db.get(lesson.courseId);
  const req = course ? courseRequirements(course) : null;

  // Watch requirement for video lessons (applies to manual completion too —
  // students cannot force a video lesson to "complete" without watching).
  const hasVideo = !!(
    lesson.muxPlaybackId ||
    lesson.videoType === "youtube" ||
    lesson.videoType === "mp4" ||
    lesson.videoType === "vimeo"
  );
  if (hasVideo && req && !enrollment.completedLessons.includes(lessonId)) {
    const rows = await ctx.db
      .query("watchProgress")
      .withIndex("by_student_course", (q) =>
        q.eq("studentId", user._id).eq("courseId", lesson.courseId),
      )
      .collect();
    const wp = rows.find((r) => r.lessonId === lessonId);
    const watched = effectiveWatchedPercent(wp);
    if (watched < req.videoWatchPercent) {
      throw new Error(
        `Watch at least ${req.videoWatchPercent}% of this video first (${Math.floor(watched)}% so far).`,
      );
    }
  }

  if (!enrollment.completedLessons.includes(lessonId)) {
    // A published per-lesson quiz must be passed first — passing the quiz is
    // what marks the lesson complete (see submitLessonQuiz).
    const quiz = await ctx.db
      .query("lessonQuizzes")
      .withIndex("by_lesson", (q) => q.eq("lessonId", lessonId))
      .first();
    if (quiz?.published) {
      const attempts = await ctx.db
        .query("lessonQuizAttempts")
        .withIndex("by_quiz", (q) => q.eq("quizId", quiz._id))
        .collect();
      const passed = attempts.some((a) => a.studentId === user._id && a.passed);
      if (!passed) {
        throw new Error("Take this lesson's quiz to complete it.");
      }
    }
    await assertPreviousCompleted(ctx, lesson.courseId, lesson, enrollment);

    const completedLessons = [...enrollment.completedLessons, lessonId];
    const allLessons = await ctx.db
      .query("lessons")
      .withIndex("by_courseId", (q) => q.eq("courseId", lesson.courseId))
      .collect();
    const progress = Math.min(
      100,
      Math.round((completedLessons.length / Math.max(1, allLessons.length)) * 100),
    );
    const allDone =
      progress >= 100 && completedLessons.length >= allLessons.length;

    await ctx.db.patch(enrollment._id, { completedLessons, progress });

    // streak
    const today = yyyymmdd(Date.now());
    const yesterday = yyyymmdd(Date.now() - 86400000);
    const lastDay = user.streakLastDay ?? 0;
    let streak = user.streak ?? 0;
    if (lastDay !== today) {
      streak = lastDay === yesterday ? streak + 1 : 1;
      await ctx.db.patch(user._id, { streak, streakLastDay: today });
    }

    let status: "in-progress" | "completed" = "in-progress";
    let examPending = false;
    if (allDone) {
      // Backend-authoritative completion: quizzes / assignments / final exam
      // requirements are evaluated here (never by the client).
      const result = await tryCompleteCourseInternal(ctx, user, lesson.courseId);
      status = result.completed ? "completed" : "in-progress";
      const exam = await ctx.db
        .query("finalExams")
        .withIndex("by_course", (q) => q.eq("courseId", lesson.courseId))
        .first();
      examPending = !!exam?.published && !result.completed;
    }
    return { progress, status, allLessonsComplete: allDone, examPending };
  }
  return {
    progress: enrollment.progress,
    status: enrollment.status,
    allLessonsComplete: false,
    examPending: false,
  };
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export const enrollmentStatus = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUser(ctx);
    return await enrollmentFor(ctx, userId, courseId);
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
    const existing = await enrollmentFor(ctx, user._id, courseId);
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

    // Communication module: every course has a community, and enrolling
    // makes you a member automatically (no separate registration).
    try {
      const community = await ensureCommunityForCourse(ctx, courseId);
      await addMembership(ctx, community._id, user._id, "student");
    } catch {
      // Community creation must never break enrollment itself.
    }
    if (course.tutorId !== user._id) {
      await notify(ctx, {
        userId: course.tutorId,
        title: "New student enrolled",
        body: `${user.name || "A student"} enrolled in "${course.title}".`,
        type: "enrollment",
        link: `/tutor`,
      });
    }

    // Transactional email: enrollment confirmation to the student.
    const studentEmail = "email" in user ? String(user.email ?? "") : "";
    if (studentEmail) {
      await ctx.runMutation(internal.emailData.queueSystemEmail, {
        to: studentEmail,
        subject: `You're enrolled in "${course.title}"`,
        html: enrollmentEmail({ name: user.name || "there", courseTitle: course.title }).html,
        emailType: "enrollment",
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
// Watch progress → lesson completion → progress → certificate
// ---------------------------------------------------------------------------

/** Auto-complete helper used by lms.watchHeartbeat once credited coverage
 *  reaches the required percentage. Enforces the same gates as manual
 *  completion (sequential order + lesson quiz). */
export async function autoCompleteWatchedLesson(
  ctx: MutationCtx,
  user: Doc<"users">,
  lessonId: Id<"lessons">,
) {
  await completeLessonInternal(ctx, user, lessonId);
}

/** Legacy compatibility shim for older clients: stores the reported percent
 *  but NEVER completes anything or unlocks quizzes on its own — credited
 *  range tracking (lms.watchHeartbeat) is the only path that earns progress.
 *  Existing rows keep their historical values; nothing is reset. */
export const reportWatchProgress = mutation({
  args: { lessonId: v.id("lessons"), percent: v.number() },
  handler: async (ctx, { lessonId, percent }) => {
    const user = await requireUserDoc(ctx);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) return;
    const enrollment = await enrollmentFor(ctx, user._id, lesson.courseId);
    if (!enrollment) return;
    const ok = await checkRateLimit(
      ctx,
      `watch:${user._id}`,
      600,
      10 * 60 * 1000,
      "",
      true,
    );
    if (!ok) return;
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    const rows = await ctx.db
      .query("watchProgress")
      .withIndex("by_student_course", (q) =>
        q.eq("studentId", user._id).eq("courseId", lesson.courseId),
      )
      .collect();
    const existing = rows.find((r) => r.lessonId === lessonId);
    // Legacy rows (no ranges yet) keep their max-reported percent for
    // backward compatibility; rows with real ranges are heartbeat-managed
    // and ignore raw client percentages entirely.
    if (existing && existing.watchedRanges === undefined) {
      if (clamped <= existing.percent) return;
      await ctx.db.patch(existing._id, { percent: clamped, updatedAt: Date.now() });
    }
  },
});

export const completeLesson = mutation({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, { lessonId }) => {
    const user = await requireUserDoc(ctx);
    await checkRateLimit(ctx, `learn:${user._id}`, 60, 60 * 60 * 1000);
    // Backend verifies every requirement (watch %, quiz pass, sequence) —
    // forged requests are rejected here, never trusted from the frontend.
    await completeLessonInternal(ctx, user, lessonId);
    return true;
  },
});

/**
 * Everything the Learn page needs per lesson: watch %, optional quiz + pass
 * state, completion and lock state, plus the final exam + attempts.
 */
export const lessonStates = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const user = await requireUser(ctx);
    const enrollment = await enrollmentFor(ctx, user, courseId);
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const sorted = [...lessons].sort((a, b) => a.order - b.order);
    const watchRows = enrollment
      ? await ctx.db
          .query("watchProgress")
          .withIndex("by_student_course", (q) =>
            q.eq("studentId", user).eq("courseId", courseId),
          )
          .collect()
      : [];
    const quizzes = await ctx.db
      .query("lessonQuizzes")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const attempts = await ctx.db
      .query("lessonQuizAttempts")
      .withIndex("by_student", (q) => q.eq("studentId", user))
      .collect();
    const exam = await ctx.db
      .query("finalExams")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .first();
    const examAttempts = await ctx.db
      .query("finalExamAttempts")
      .withIndex("by_student", (q) => q.eq("studentId", user))
      .collect();

    const completedSet = new Set(enrollment?.completedLessons ?? []);
    return {
      enrollment: enrollment ?? null,
      lessons: sorted.map((l, idx) => {
        const quiz = quizzes.find((qz) => qz.lessonId === l._id);
        return {
          lesson: l,
          watchedPercent: watchRows.find((w) => w.lessonId === l._id)?.percent ?? 0,
          quiz:
            quiz?.published
              ? {
                  _id: quiz._id,
                  title: quiz.title,
                  description: quiz.description,
                  passPercent: quiz.passPercent,
                  timeLimitMinutes: quiz.timeLimitMinutes,
                  questions: quiz.questions,
                }
              : null,
          quizPassed: quiz?.published
            ? attempts.some((a) => a.quizId === quiz._id && a.passed)
            : false,
          completed: completedSet.has(l._id),
          locked: idx > 0 && !completedSet.has(sorted[idx - 1]._id),
        };
      }),
      exam:
        exam?.published
          ? {
              ...exam,
              attempts: examAttempts.filter((a) => a.examId === exam._id),
            }
          : null,
      allLessonsComplete:
        sorted.length > 0 && completedSet.size >= sorted.length,
    };
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
