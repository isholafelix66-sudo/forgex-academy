import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  checkRateLimit,
  notify,
  requireUserDoc,
  requireTutor,
  requireTutorPreview,
} from "./lib";
import { questionValidator, type Question } from "./schema";
import { enrollmentFor, finishCourseInternal } from "./learn";

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function grade(
  questions: Question[],
  answers: { questionIndex: number; answer: string }[],
) {
  let score = 0;
  let gradedMax = 0;
  const answerMap = new Map(answers.map((a) => [a.questionIndex, a.answer]));
  for (const [idx, q] of questions.entries()) {
    const points = q.points ?? 1;
    if (q.type === "short-answer") continue;
    gradedMax += points;
    const given = normalize(answerMap.get(idx) ?? "");
    const correct = normalize(q.answer ?? "");
    if (given && given === correct) score += points;
  }
  return { score, gradedMax };
}

// ---------------------------------------------------------------------------
// Learner
// ---------------------------------------------------------------------------

export const submitFinalExam = mutation({
  args: {
    examId: v.id("finalExams"),
    answers: v.array(
      v.object({ questionIndex: v.number(), answer: v.string() }),
    ),
    timeTakenSeconds: v.optional(v.number()),
  },
  handler: async (ctx, { examId, answers, timeTakenSeconds }) => {
    const user = await requireUserDoc(ctx);
    await checkRateLimit(
      ctx,
      `exam:${user._id}`,
      10,
      60 * 60 * 1000,
      "You're submitting exams very quickly — please slow down.",
    );
    const exam = await ctx.db.get(examId);
    if (!exam || !exam.published) throw new Error("Exam not found.");
    const enrollment = await enrollmentFor(ctx, user._id, exam.courseId);
    if (!enrollment) throw new Error("Enroll in this course first.");

    // The final exam unlocks only after every required lesson is complete.
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_courseId", (q) => q.eq("courseId", exam.courseId))
      .collect();
    const allDone =
      lessons.length > 0 &&
      lessons.every((l) => enrollment.completedLessons.includes(l._id));
    if (!allDone) {
      throw new Error(
        "Complete every lesson before taking the final exam.",
      );
    }

    const g = grade(exam.questions, answers);
    const percent =
      g.gradedMax > 0 ? Math.round((g.score / g.gradedMax) * 100) : 0;
    const passed = g.gradedMax > 0 && percent >= exam.passPercent;

    const attemptId = await ctx.db.insert("finalExamAttempts", {
      examId: exam._id,
      courseId: exam.courseId,
      studentId: user._id,
      answers,
      score: g.score,
      totalMarks: exam.totalMarks,
      percent,
      passed,
      submittedAt: Date.now(),
      timeTakenSeconds,
      examTitle: exam.title,
      examPassPercent: exam.passPercent,
    });

    if (passed) {
      const course = await ctx.db.get(exam.courseId);
      if (course) {
        await ctx.db.patch(enrollment._id, {
          status: "completed",
          progress: 100,
        });
        await finishCourseInternal(ctx, user, course, {
          ...enrollment,
          status: "completed",
          progress: 100,
        });
      }
    }

    const course = await ctx.db.get(exam.courseId);
    await notify(ctx, {
      userId: user._id,
      title: passed ? "Final exam passed! 🎉" : "Final exam submitted",
      body: passed
        ? `You passed the final exam for "${exam.title}" (${percent}%) — certificate unlocked!`
        : `"${exam.title}": you scored ${percent}% (${exam.passPercent}% needed to pass).`,
      type: "exam",
      link: course ? `/academy/learn/${course.slug}` : "/academy/dashboard",
    });

    return { attemptId, score: g.score, totalMarks: exam.totalMarks, percent, passed };
  },
});

// ---------------------------------------------------------------------------
// Tutor
// ---------------------------------------------------------------------------

export const finalExamByCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const tutor = await requireTutorPreview(ctx);
    if (!tutor) return null;
    const course = await ctx.db.get(courseId);
    if (!course || (course.tutorId !== tutor._id && tutor.role !== "admin")) {
      throw new Error("Not your course.");
    }
    const exam = await ctx.db
      .query("finalExams")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .first();
    return exam ?? null;
  },
});

export const upsertFinalExam = mutation({
  args: {
    id: v.optional(v.id("finalExams")),
    courseId: v.id("courses"),
    title: v.string(),
    description: v.string(),
    questionCount: v.number(),
    totalMarks: v.number(),
    passPercent: v.number(),
    timeLimitMinutes: v.number(),
    questions: v.array(questionValidator),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    const tutor = await requireTutor(ctx);
    await checkRateLimit(ctx, `tutor:${tutor._id}`, 20, 60 * 60 * 1000);
    const course = await ctx.db.get(args.courseId);
    if (!course || (course.tutorId !== tutor._id && tutor.role !== "admin")) {
      throw new Error("Not your course.");
    }
    if (args.questions.length === 0) {
      throw new Error("Add at least one question before saving the exam.");
    }
    const pass = Math.min(100, Math.max(1, Math.round(args.passPercent)));
    const marks = Math.max(1, Math.round(args.totalMarks));
    const count = Math.max(1, Math.round(args.questionCount));
    if (args.id) {
      await ctx.db.patch(args.id, {
        courseId: args.courseId,
        title: args.title,
        description: args.description,
        questionCount: count,
        totalMarks: marks,
        passPercent: pass,
        timeLimitMinutes: Math.max(1, Math.round(args.timeLimitMinutes)),
        questions: args.questions,
        published: args.published,
      });
      return args.id;
    }
    return await ctx.db.insert("finalExams", {
      courseId: args.courseId,
      tutorId: tutor._id,
      title: args.title,
      description: args.description,
      questionCount: count,
      totalMarks: marks,
      passPercent: pass,
      timeLimitMinutes: Math.max(1, Math.round(args.timeLimitMinutes)),
      questions: args.questions,
      published: args.published,
      createdAt: Date.now(),
    });
  },
});

export const deleteFinalExam = mutation({
  args: { id: v.id("finalExams") },
  handler: async (ctx, { id }) => {
    const tutor = await requireTutor(ctx);
    const exam = await ctx.db.get(id);
    if (!exam || (exam.tutorId !== tutor._id && tutor.role !== "admin")) {
      throw new Error("Not your exam.");
    }
    await ctx.db.delete(id);
    return true;
  },
});
