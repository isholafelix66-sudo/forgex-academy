import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  checkRateLimit,
  notify,
  requireAdminSession,
  requireUser,
  requireUserDoc,
  requireTutor,
  requireTutorOrToken,
  requireTutorPreview,
} from "./lib";
import { questionValidator, type Question } from "./schema";
import { completeLessonInternal, enrollmentFor } from "./learn";
import { courseRequirements, effectiveWatchedPercent } from "./lmsShared";

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Auto-grade a question set (short answers contribute 0 and are excluded
 *  from the pass calculation, mirroring the legacy course quizzes). */
function grade(questions: Question[], answers: { questionIndex: number; answer: string }[]) {
  let score = 0;
  let maxScore = 0;
  let gradedMax = 0;
  const answerMap = new Map(answers.map((a) => [a.questionIndex, a.answer]));
  for (const [idx, q] of questions.entries()) {
    const points = q.points ?? 1;
    maxScore += points;
    if (q.type === "short-answer") continue;
    gradedMax += points;
    const given = normalize(answerMap.get(idx) ?? "");
    const correct = normalize(q.answer ?? "");
    if (given && given === correct) score += points;
  }
  return { score, maxScore, gradedMax };
}

// ---------------------------------------------------------------------------
// Learner
// ---------------------------------------------------------------------------

export const submitLessonQuiz = mutation({
  args: {
    quizId: v.id("lessonQuizzes"),
    answers: v.array(
      v.object({ questionIndex: v.number(), answer: v.string() }),
    ),
    timeTakenSeconds: v.optional(v.number()),
  },
  handler: async (ctx, { quizId, answers, timeTakenSeconds }) => {
    const user = await requireUserDoc(ctx);
    // Spam guard: max 30 quiz submissions per user per hour.
    await checkRateLimit(
      ctx,
      `quiz:${user._id}`,
      30,
      60 * 60 * 1000,
      "You're taking quizzes very quickly — please slow down.",
    );
    const quiz = await ctx.db.get(quizId);
    if (!quiz || !quiz.published) throw new Error("Quiz not found.");
    const lesson = await ctx.db.get(quiz.lessonId);
    if (!lesson) throw new Error("Lesson not found.");
    const enrollment = await enrollmentFor(ctx, user._id, quiz.courseId);
    if (!enrollment) throw new Error("Enroll in this course first.");

    // Watch gate: learners must watch the course's threshold percentage of
    // the video before the quiz unlocks. Lessons without a playable video
    // (notes-only, videos an admin cleared, "planned-recording" placeholders)
    // and players that can't report progress (Loom embeds) skip the gate.
    // Same rule as completeLessonInternal so both gates always agree.
    const trackable =
      !!lesson.muxPlaybackId ||
      (!!lesson.videoUrl &&
        lesson.videoUrl !== "" &&
        lesson.videoUrl !== "planned-recording" &&
        lesson.videoType !== "loom");
    if (trackable) {
      const rows = await ctx.db
        .query("watchProgress")
        .withIndex("by_student_course", (q) =>
          q.eq("studentId", user._id).eq("courseId", quiz.courseId),
        )
        .collect();
      const wp = rows.find((r) => r.lessonId === lesson._id);
      const course = await ctx.db.get(quiz.courseId);
      const gate = course ? courseRequirements(course).videoWatchPercent : 90;
      if (!wp || effectiveWatchedPercent(wp) < gate) {
        throw new Error(
          `Watch at least ${gate}% of the video to unlock this quiz.`,
        );
      }
    }

    const g = grade(quiz.questions, answers);
    const passed =
      g.gradedMax > 0 && g.score / Math.max(1, g.gradedMax) >= (quiz.passPercent / 100);

    const attemptId = await ctx.db.insert("lessonQuizAttempts", {
      quizId: quiz._id,
      lessonId: lesson._id,
      courseId: quiz.courseId,
      studentId: user._id,
      answers,
      score: g.score,
      maxScore: g.maxScore,
      passed,
      submittedAt: Date.now(),
      timeTakenSeconds,
    });

    if (passed) {
      await completeLessonInternal(ctx, user, lesson._id);
    }

    const course = await ctx.db.get(quiz.courseId);
    await notify(ctx, {
      userId: user._id,
      title: passed ? "Lesson quiz passed ✓" : "Lesson quiz submitted",
      body: `"${quiz.title}": ${g.score}/${g.maxScore}${
        passed ? " — lesson unlocked!" : ""
      }.`,
      type: "quiz",
      link: course ? `/academy/learn/${course.slug}` : "/academy/dashboard",
    });

    return {
      attemptId,
      score: g.score,
      maxScore: g.maxScore,
      gradedMax: g.gradedMax,
      passed,
    };
  },
});

// ---------------------------------------------------------------------------
// Tutor
// ---------------------------------------------------------------------------

/** All lesson quizzes for a course (drafts included) with their lesson title. */
export const courseLessonQuizzesFull = query({
  args: { courseId: v.id("courses"), token: v.optional(v.string()) },
  handler: async (ctx, { courseId, token }) => {
    let tutor = null;
    if (token) {
      await requireAdminSession(ctx, token);
    } else {
      tutor = await requireTutorPreview(ctx);
      if (!tutor) return [];
    }
    const course = await ctx.db.get(courseId);
    if (!course) return [];
    if (
      !token &&
      course.tutorId !== tutor!._id &&
      tutor!.role !== "admin"
    ) {
      throw new Error("Not your course.");
    }
    const quizzes = await ctx.db
      .query("lessonQuizzes")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
      .collect();
    return quizzes
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((qz) => ({
        ...qz,
        lessonTitle: lessons.find((l) => l._id === qz.lessonId)?.title ?? "Unknown lesson",
      }));
  },
});

export const upsertLessonQuiz = mutation({
  args: {
    id: v.optional(v.id("lessonQuizzes")),
    courseId: v.id("courses"),
    lessonId: v.id("lessons"),
    title: v.string(),
    description: v.string(),
    passPercent: v.number(),
    timeLimitMinutes: v.number(),
    questions: v.array(questionValidator),
    published: v.boolean(),
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
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson || lesson.courseId !== args.courseId) {
      throw new Error("Lesson not found in this course.");
    }
    const pass = Math.min(100, Math.max(1, Math.round(args.passPercent)));
    if (args.questions.length === 0) {
      throw new Error("Add at least one question before saving the quiz.");
    }
    if (args.id) {
      await ctx.db.patch(args.id, {
        courseId: args.courseId,
        lessonId: args.lessonId,
        title: args.title,
        description: args.description,
        passPercent: pass,
        timeLimitMinutes: Math.max(1, Math.round(args.timeLimitMinutes)),
        questions: args.questions,
        published: args.published,
      });
      return args.id;
    }
    return await ctx.db.insert("lessonQuizzes", {
      courseId: args.courseId,
      lessonId: args.lessonId,
      tutorId: course.tutorId,
      title: args.title,
      description: args.description,
      passPercent: pass,
      timeLimitMinutes: Math.max(1, Math.round(args.timeLimitMinutes)),
      questions: args.questions,
      published: args.published,
      createdAt: Date.now(),
    });
  },
});

export const deleteLessonQuiz = mutation({
  args: { id: v.id("lessonQuizzes"), token: v.optional(v.string()) },
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
