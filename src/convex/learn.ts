import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { monitorEventM, monitorActivityM } from "./monitorMutation";
import { checkRateLimit, requireUser, requireUserDoc, hydrateCourses, hydrateCourse, notify, yyyymmdd, makeCertificateId } from "./lib";
import { addMembership, ensureCommunityForCourse } from "./community";
import { enrollmentEmail, certificateEmail } from "./emailTemplates";
import { courseRequirements, effectiveWatchedPercent, recomputeCourseDuration, sanitizeWatchPercent, type Requirements } from "./lmsShared";

// ---------------------------------------------------------------------------
// Shared learning helpers (imported by lessonquizzes.ts / exams.ts)
// ---------------------------------------------------------------------------

/** Deterministic per-account hash — same student always gets the same mix,
 *  different students get a different starting point in the pool. */
function stableHash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Admin-curated "Recommended for You" pool, personalised per individual.
 *
 *  Admin picks the pool and its order (siteContent.recommendedCourseIds);
 *  every student then sees their own mix of it:
 *    • courses they already take are skipped,
 *    • categories they are studying / finished rank first,
 *    • the remainder is rotated by a stable per-account hash, so two students
 *      with the same interests still see a different combination.
 *  With no admin selection the whole published catalogue is used as the pool. */
export const recommendedCourses = query({
  args: {},
  handler: async (ctx) => {
    const content = await ctx.db
      .query("siteContent")
      .withIndex("by_key", (q) => q.eq("key", "recommendedCourseIds"))
      .first();
    const ids =
      Array.isArray(content?.value) &&
      content.value.every((x): x is string => typeof x === "string")
        ? content.value
        : [];

    const all = await ctx.db.query("courses").collect();
    const published = all.filter((c) => c.published && !c.archived);

    // Admin pool (catalogue-wide when the admin hasn't curated anything yet).
    const pool = ids.length
      ? ids
          .map((id) => published.find((c) => c._id.toString() === id))
          .filter((c): c is Doc<"courses"> => !!c)
      : published;
    if (!pool.length) return [];

    const userId = await getAuthUserId(ctx);
    const enrollments = userId
      ? await ctx.db
          .query("enrollments")
          .withIndex("by_student", (q) => q.eq("studentId", userId))
          .collect()
      : [];
    const enrolledIds = new Set(enrollments.map((e) => e.courseId.toString()));
    const interestCats = new Set<string>();
    for (const e of enrollments) {
      if (e.status !== "completed" && e.progress <= 0) continue;
      const c = all.find((x) => x._id === e.courseId);
      if (c) interestCats.add(c.categoryId.toString());
    }

    // Never recommend something the student is already taking — the dashboard
    // falls back to automatic recommendations when nothing here is fresh.
    const usable = pool.filter((c) => !enrolledIds.has(c._id.toString()));
    if (!usable.length) return [];

    const rotation = userId ? stableHash(userId.toString()) % usable.length : 0;
    const rotated = [...usable.slice(rotation), ...usable.slice(0, rotation)];

    const picked = rotated
      .map((course, index) => ({
        course,
        score:
          (interestCats.has(course.categoryId.toString()) ? 100 : 0) +
          (course.rating ?? 0) +
          // keeps the admin's own ordering meaningful inside each tier
          (usable.length - index) / (usable.length + 1),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((s) => s.course);

    return hydrateCourses(ctx, picked);
  },
});

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

/** Backend-authoritative course completion evaluation — THE single path to
 *  status "completed". Called automatically after lesson / quiz / assignment
 *  state changes; client-supplied completion values are never trusted.
 *  Returns which requirement groups still block completion. */
export async function tryCompleteCourseInternal(
  ctx: MutationCtx,
  user: Doc<"users">,
  courseId: Id<"courses">,
): Promise<{ completed: boolean; blockers: string[] }> {
  const course = await ctx.db.get(courseId);
  if (!course) return { completed: false, blockers: ["course"] };
  const enrollment = await enrollmentFor(ctx, user._id, courseId);
  if (!enrollment || enrollment.status === "completed") {
    return { completed: enrollment?.status === "completed", blockers: [] };
  }
  const req = courseRequirements(course);
  const blockers: string[] = [];

  // 1) Every lesson completed (module-level rule: all required activities done).
  const lessons = await ctx.db
    .query("lessons")
    .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
    .collect();
  const lessonsDone =
    lessons.length > 0 &&
    lessons.every((l) => enrollment.completedLessons.includes(l._id));
  if (req.requireAllLessons && !lessonsDone) blockers.push("lessons");

  // 2) Every published course quiz passed at the configured score.
  if (req.requireQuizzes) {
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const attempts =
      blockers.length === 0
        ? await ctx.db
            .query("quizAttempts")
            .withIndex("by_student", (s) => s.eq("studentId", user._id))
            .collect()
        : [];
    for (const qz of quizzes.filter((q) => q.published !== false && q.questions.length > 0)) {
      const best = attempts
        .filter((a) => a.quizId === qz._id)
        .sort((a, b) => b.score - a.score)[0];
      const autoGradableMax = qz.questions.reduce((sum, q) => {
        if (q.type === "short-answer") {
          const hasKey = (q.answer ?? "").trim() !== "" || (q.acceptedAnswers?.length ?? 0) > 0;
          return sum + (hasKey ? q.points ?? 1 : 0);
        }
        return sum + (q.points ?? 1);
      }, 0);
      const ok =
        autoGradableMax > 0 &&
        (best?.score ?? 0) / autoGradableMax >= req.quizPassPercent / 100;
      if (!ok) blockers.push(`quiz:${qz.title}`);
    }
  }

  // 3) Every published assignment submitted.
  if (req.requireAssignments && blockers.length === 0) {
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    for (const a of assignments.filter((x) => x.published !== false)) {
      const submitted = await ctx.db
        .query("submissions")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", a._id))
        .collect()
        .then((rows) => rows.some((s) => s.studentId === user._id));
      if (!submitted) blockers.push(`assignment:${a.title}`);
    }
  }

  // 4) Published final exam still gates the certificate (preserved behaviour).
  let examPassed = false;
  let examPending = false;
  const exam = await ctx.db
    .query("finalExams")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .first();
  if (exam?.published) {
    examPassed = await ctx.db
      .query("finalExamAttempts")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .collect()
      .then((rows) => rows.some((a) => a.examId === exam._id && a.passed));
    examPending = !examPassed;
    if (!examPassed) blockers.push("exam");
  }

  // Keep progress% consistent with lesson completions either way.
  const progress = lessons.length
    ? Math.min(
        100,
        Math.round(
          (enrollment.completedLessons.filter((id) => lessons.some((l) => l._id === id)).length /
            lessons.length) *
            100,
        ),
      )
    : enrollment.progress;
  await ctx.db.patch(enrollment._id, { progress, lastActivityAt: Date.now() });

  if (blockers.length === 0) {
    await finishCourseInternal(ctx, user, course, {
      ...enrollment,
      progress: 100,
      status: "completed",
    });
    return { completed: true, blockers: [] };
  }
  return { completed: false, examPending, blockers } as {
    completed: boolean;
    blockers: string[];
  };
}

/** Issue a certificate + badge + notification when a course is truly finished. */
export async function finishCourseInternal(
  ctx: MutationCtx,
  user: Doc<"users">,
  course: Doc<"courses">,
  enrollment: Doc<"enrollments">,
) {
  await ctx.db.patch(enrollment._id, { status: "completed", progress: 100 });
  // Only issue a certificate when the admin/tutor explicitly enabled it.
  if (course.hasCertificate) {
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

  if (!enrollment.completedLessons.includes(lessonId)) {
    // Watch gate: video lessons only complete once the credited (range-based)
    // watch coverage meets the course's configured threshold. Enforced here on
    // the backend so the "Mark complete" button can never bypass watching —
    // the frontend mirrors this by disabling the button until the threshold
    // is reached. Lessons without a playable video (notes-only, Loom embeds,
    // recordings still marked "planned") skip the gate.
    const hasRealVideo =
      !!lesson.muxPlaybackId ||
      (!!lesson.videoUrl &&
        lesson.videoUrl !== "" &&
        lesson.videoUrl !== "planned-recording" &&
        lesson.videoType !== "loom");
    if (hasRealVideo && req) {
      const watchRows = await ctx.db
        .query("watchProgress")
        .withIndex("by_student_course", (q) =>
          q.eq("studentId", user._id).eq("courseId", lesson.courseId),
        )
        .collect();
      const wp = watchRows.find((r) => r.lessonId === lessonId);
      const watched = effectiveWatchedPercent(wp);
      if (watched < req.videoWatchPercent) {
        throw new Error(
          `Watch at least ${req.videoWatchPercent}% of this lesson's video before completing it (${Math.floor(watched)}% watched so far).`,
        );
      }
    }

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
    // Comprehensive progress: count all required learning activities
    // (lessons + quizzes if required + assignments if required).
    let totalActivities = allLessons.length;
    let completedActivities = completedLessons.length;
    if (req) {
      if (req.requireQuizzes) {
        const courseQuizzes = await ctx.db
          .query("quizzes")
          .withIndex("by_course", (q) => q.eq("courseId", lesson.courseId))
          .collect();
        const publishedQuizzes = courseQuizzes.filter(
          (q) => q.published !== false && q.questions.length > 0,
        );
        totalActivities += publishedQuizzes.length;
        if (publishedQuizzes.length > 0) {
          const quizAttempts = await ctx.db
            .query("quizAttempts")
            .withIndex("by_student", (q) => q.eq("studentId", user._id))
            .collect();
          for (const qz of publishedQuizzes) {
            const best = quizAttempts
              .filter((a) => a.quizId === qz._id)
              .sort((a, b) => b.score - a.score)[0];
            const autoMax = qz.questions.reduce((sum, q) => {
              if (q.type === "short-answer") {
                const hasKey = (q.answer ?? "").trim() !== "" || (q.acceptedAnswers?.length ?? 0) > 0;
                return sum + (hasKey ? q.points ?? 1 : 0);
              }
              return sum + (q.points ?? 1);
            }, 0);
            if (
              autoMax > 0 &&
              (best?.score ?? 0) / autoMax >= req.quizPassPercent / 100
            ) {
              completedActivities++;
            }
          }
        }
      }
      if (req.requireAssignments) {
        const courseAssignments = await ctx.db
          .query("assignments")
          .withIndex("by_course", (q) => q.eq("courseId", lesson.courseId))
          .collect();
        const publishedAssignments = courseAssignments.filter(
          (a) => a.published !== false,
        );
        totalActivities += publishedAssignments.length;
        if (publishedAssignments.length > 0) {
          const subs = await ctx.db
            .query("submissions")
            .withIndex("by_student", (q) => q.eq("studentId", user._id))
            .collect();
          for (const a of publishedAssignments) {
            if (subs.some((s) => s.assignmentId === a._id)) {
              completedActivities++;
            }
          }
        }
      }
    }
    const progress = Math.min(
      100,
      Math.round((completedActivities / Math.max(1, totalActivities)) * 100),
    );
    const allDone =
      progress >= 100 && completedLessons.length >= allLessons.length;

    await ctx.db.patch(enrollment._id, { completedLessons, progress, lastActivityAt: Date.now() });

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
    const started = Date.now();
    try {
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
      lastActivityAt: Date.now(),
      inactivityStage: 0,
    });
    await ctx.db.patch(courseId, { enrolledCount: course.enrolledCount + 1 });

    // Real event → real notification (header bell): enrollment confirmation.
    await notify(ctx, {
      userId: user._id,
      title: "Enrolled in a new course",
      body: `You're enrolled in "${course.title}". Jump in and start the first lesson.`,
      type: "course",
      link: `/courses/${course.slug}`,
    });

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
      await ctx.scheduler.runAfter(0, internal.emailTriggers.notifyNewEnrollmentToTutor, {
        enrollmentId: id,
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
    // Monitoring: successful enrollment (course title only — metadata).
    void monitorEventM(ctx, {
      userId: user._id,
      module: "enrollment",
      action: "enroll",
      status: "success",
      latencyMs: Date.now() - started,
      route: "learn:enroll",
      meta: { courseId },
    });
    void monitorActivityM(ctx, {
      userId: user._id,
      action: "course.enrolled",
      module: "enrollment",
      resourceType: "course",
      resourceId: courseId,
      detail: course.title.slice(0, 120),
      route: "learn:enroll",
    });
    return id;
    } catch (err) {
      // Monitoring: enrollment failure path (kept real: rethrow after record).
      void monitorEventM(ctx, {
        module: "enrollment",
        action: "enroll",
        status: "failure",
        error: err,
        route: "learn:enroll",
        meta: { courseId },
      });
      throw err;
    }
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
 * Persist the REAL duration of a lesson's video, as reported by the player
 * once it loads (YouTube IFrame API `getDuration()`, Mux metadata, native
 * `loadedmetadata`). The stored `videoDurationSeconds` is the authoritative
 * lesson length and the course total is recomputed from it — so a course
 * automatically shows the actual video length (e.g. 1h 12m instead of a
 * manually entered 22 min) with no admin effort. No-ops when unchanged.
 */
export const saveLessonVideoDuration = mutation({
  args: {
    lessonId: v.id("lessons"),
    durationSeconds: v.number(),
  },
  handler: async (ctx, { lessonId, durationSeconds }) => {
    const userId = await requireUser(ctx);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) return null;
    const rounded = Math.max(0, Math.round(durationSeconds));
    if (rounded <= 0) return null;
    await checkRateLimit(ctx, `dur:${userId}`, 120, 10 * 60 * 1000, "", true);
    if ((lesson.videoDurationSeconds ?? 0) !== rounded) {
      await ctx.db.patch(lessonId, { videoDurationSeconds: rounded });
    }
    const courseDurationHours = await recomputeCourseDuration(ctx, lesson.courseId);
    return { videoDurationSeconds: rounded, courseDurationHours };
  },
});

/**
 * A lesson's downloadable/viewable resources with real, current URLs.
 *
 * Storage-backed files (admin PDF uploads) are resolved server-side to their
 * Convex file-storage URLs at read time — the DB only keeps the storage id,
 * never a signed URL that expires. Placeholder links seeded before real
 * files existed (learn.forgex.academy/…) are dropped so students never see
 * dead “PDF” cards.
 */
export const lessonResources = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, { lessonId }) => {
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) return [];
    const PLACEHOLDER_HOSTS = ["learn.forgex.academy"];
    const out: {
      index: number;
      name: string;
      url: string;
      storageId?: string;
      kind: "file" | "link";
      fileType: string;
      fileSize: number;
      createdAt: number;
    }[] = [];
    for (let i = 0; i < lesson.resources.length; i++) {
      const r = lesson.resources[i];
      let url = r.url ?? "";
      if (r.storageId) {
        try {
          url = (await ctx.storage.getUrl(r.storageId)) ?? "";
        } catch {
          url = "";
        }
      }
      if (!url && !r.storageId) continue;
      if (PLACEHOLDER_HOSTS.some((h) => url.includes(h))) continue;
      out.push({
        index: i,
        name: r.name,
        url,
        storageId: r.storageId ?? undefined,
        kind: r.kind ?? (r.storageId ? "file" : "link"),
        fileType: r.fileType ?? "",
        fileSize: r.fileSize ?? 0,
        createdAt: r.createdAt ?? 0,
      });
    }
    return out;
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
    const course = await ctx.db.get(courseId);
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
        const wp = watchRows.find((w) => w.lessonId === l._id);
        return {
          lesson: l,
          watchedPercent: effectiveWatchedPercent(wp),
          resumePosition: wp?.positionSeconds ?? 0,
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
      completionRequirements: course ? courseRequirements(course) : undefined,
    };
  },
});

/**
 * One centralized completion-requirements readout used by the Learn page,
 * dashboards and completion screen: per-lesson watch %, quiz pass state,
 * assignment submission state, and what remains before completion.
 */
export const courseCompletionStatus = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const user = await requireUser(ctx);
    const course = await ctx.db.get(courseId);
    if (!course) return null;
    const enrollment = await enrollmentFor(ctx, user, courseId);
    const req = courseRequirements(course);
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const sorted = [...lessons].sort((a, b) => a.order - b.order);
    const completedSet = new Set(enrollment?.completedLessons ?? []);

    const watchRows = enrollment
      ? await ctx.db
          .query("watchProgress")
          .withIndex("by_student_course", (q) =>
            q.eq("studentId", user).eq("courseId", courseId),
          )
          .collect()
      : [];

    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const quizAttempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_student", (q) => q.eq("studentId", user))
      .collect();

    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_student", (q) => q.eq("studentId", user))
      .collect();

    const hasVideo = (l: Doc<"lessons">) =>
      !!(
        l.muxPlaybackId ||
        l.videoType === "youtube" ||
        l.videoType === "mp4" ||
        l.videoType === "vimeo" ||
        l.videoType === "mux"
      );

    // Centralized activity list — every required learning activity with its
    // completion state. Progress = completed activities / total activities.
    type Activity = {
      kind: "lesson-video" | "lesson-reading" | "lesson-quiz" | "quiz" | "assignment";
      refId: string;
      title: string;
      completed: boolean;
      detail?: string;
    };
    const activities: Activity[] = sorted.map((l) => {
      if (hasVideo(l)) {
        const wp = watchRows.find((r) => r.lessonId === l._id);
        const watched = effectiveWatchedPercent(wp);
        const done = completedSet.has(l._id);
        return {
          kind: "lesson-video",
          refId: l._id,
          title: l.title,
          completed: done,
          detail: done ? undefined : `${Math.floor(watched)}% watched`,
        };
      }
      return {
        kind: "lesson-reading",
        refId: l._id,
        title: l.title,
        completed: completedSet.has(l._id),
      };
    });

    const publishedQuizzes = quizzes.filter(
      (q) => q.published !== false && q.questions.length > 0,
    );
    for (const qz of publishedQuizzes) {
      const attempts = quizAttempts.filter((a) => a.quizId === qz._id);
      const best = [...attempts].sort((a, b) => b.score - a.score)[0];
      const autoGradableMax = qz.questions.reduce((sum, q) => {
        if (q.type === "short-answer") {
          const hasKey = (q.answer ?? "").trim() !== "" || (q.acceptedAnswers?.length ?? 0) > 0;
          return sum + (hasKey ? q.points ?? 1 : 0);
        }
        return sum + (q.points ?? 1);
      }, 0);
      const passed =
        autoGradableMax > 0 &&
        (best?.score ?? 0) / autoGradableMax >= req.quizPassPercent / 100;
      activities.push({
        kind: "quiz",
        refId: qz._id,
        title: qz.title,
        completed: passed,
        detail: passed
          ? undefined
          : best
            ? `Best score ${best.score}/${autoGradableMax} — pass mark ${req.quizPassPercent}%`
            : req.requireQuizzes
              ? "Required — not yet taken"
              : undefined,
      });
    }

    for (const a of assignments.filter((x) => x.published !== false)) {
      const submitted = submissions.some((s) => s.assignmentId === a._id);
      activities.push({
        kind: "assignment",
        refId: a._id,
        title: a.title,
        completed: submitted,
        detail: submitted ? undefined : req.requireAssignments ? "Required — not submitted" : undefined,
      });
    }

    // Only count activities that actually gate completion toward progress.
    const gating = activities.filter((act) => {
      if (act.kind === "quiz") return req.requireQuizzes;
      if (act.kind === "assignment") return req.requireAssignments;
      return true;
    });
    const doneCount = gating.filter((a) => a.completed).length;
    const progress = gating.length
      ? Math.round((doneCount / gating.length) * 100)
      : 100;

    const exam = await ctx.db
      .query("finalExams")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .first();
    const examPassed = exam?.published
      ? await ctx.db
          .query("finalExamAttempts")
          .withIndex("by_student", (q) => q.eq("studentId", user))
          .collect()
          .then((rows) => rows.some((r) => r.examId === exam._id && r.passed))
      : false;
    if (exam?.published && !examPassed) {
      activities.push({
        kind: "quiz",
        refId: exam._id,
        title: exam.title || "Final exam",
        completed: false,
        detail: `Final exam — pass mark ${exam.passPercent}%`,
      });
    }

    const completed = enrollment?.status === "completed";
    return {
      requirements: req,
      enrollment: enrollment
        ? { status: enrollment.status, progress: enrollment.progress, enrolledAt: enrollment.enrolledAt }
        : null,
      lessonsTotal: sorted.length,
      lessonsCompleted: sorted.filter((l) => completedSet.has(l._id)).length,
      activities,
      remaining: activities.filter((a) => !a.completed),
      progress,
      completed,
      certificateUnlocked:
        completed ||
        (gating.every((a) => a.completed) && (!exam?.published || examPassed)),
    };
  },
});

/** Instructor/admin: save the Course Completion Requirements block. */
export const setCourseRequirements = mutation({
  args: {
    videoWatchPercent: v.number(),
    requireQuizzes: v.boolean(),
    quizPassPercent: v.number(),
    requireAssignments: v.boolean(),
    requireAllLessons: v.boolean(),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const user = await requireUserDoc(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found.");
    if (user.role !== "admin" && (user.role !== "tutor" || course.tutorId !== user._id)) {
      throw new Error("Only the course tutor can change completion settings.");
    }
    await ctx.db.patch(course._id, {
      completionRequirements: {
        videoWatchPercent: sanitizeWatchPercent(args.videoWatchPercent),
        requireQuizzes: args.requireQuizzes,
        quizPassPercent: Math.max(1, Math.min(100, Math.round(args.quizPassPercent))),
        requireAssignments: args.requireAssignments,
        requireAllLessons: args.requireAllLessons,
      },
    });
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
