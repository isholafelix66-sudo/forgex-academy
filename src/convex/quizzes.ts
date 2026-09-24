import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit, notify, requireUser, requireUserDoc } from "./lib";
import { tryCompleteCourseInternal } from "./academy/learn";
import { courseRequirements } from "./lmsShared";
import type { Question } from "./schema";

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Is `given` a correct answer for this question? Short answers match the
 *  expected answer OR any accepted alternative (case/whitespace-insensitive). */
function isCorrect(q: Question, given: string): boolean {
  const g = normalize(given);
  if (!g) return false;
  if (q.type === "short-answer") {
    if ((q.answer ?? "").trim() && g === normalize(q.answer!)) return true;
    return (q.acceptedAnswers ?? []).some((a) => a.trim() && g === normalize(a));
  }
  return g === normalize(q.answer ?? "");
}

/** Auto-gradable marks: MCQ + true/false always; short answers only when the
 *  instructor provided an expected answer or alternatives to grade against. */
export function autoGradableMax(questions: Question[]): number {
  return questions.reduce((sum, q) => {
    if (q.type === "short-answer") {
      const hasKey =
        (q.answer ?? "").trim() !== "" || (q.acceptedAnswers ?? []).some((a) => a.trim());
      return sum + (hasKey ? q.points ?? 1 : 0);
    }
    return sum + (q.points ?? 1);
  }, 0);
}

/** Full quizzes for a course — enrolled learners see published ones only;
 *  drafts stay private to the builder. */
export const quizzesByCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    await requireUser(ctx);
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    return quizzes
      .filter((q) => q.published !== false)
      .sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const myQuizAttempts = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUser(ctx);
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    return attempts
      .filter((a) => a.courseId === courseId)
      .sort((a, b) => b.submittedAt - a.submittedAt);
  },
});

export const submitQuiz = mutation({
  args: {
    quizId: v.id("quizzes"),
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
    if (!quiz || quiz.published === false) {
      throw new Error("Quiz not found.");
    }

    // Attempt limit: retakes are capped when the tutor configured a limit.
    if ((quiz.attemptLimit ?? 0) > 0) {
      const mine = await ctx.db
        .query("quizAttempts")
        .withIndex("by_student", (q) => q.eq("studentId", user._id))
        .collect()
        .then((rows) => rows.filter((a) => a.quizId === quiz._id));
      if (mine.length >= (quiz.attemptLimit ?? 0)) {
        throw new Error(
          `You've used all ${quiz.attemptLimit} allowed attempt(s) for this quiz.`,
        );
      }
    }

    let score = 0;
    let maxScore = 0;
    const answerMap = new Map(answers.map((a) => [a.questionIndex, a.answer]));

    for (const [idx, q] of quiz.questions.entries()) {
      const points = q.points ?? 1;
      maxScore += points;
      if (isCorrect(q, answerMap.get(idx) ?? "")) {
        score += points;
      }
    }

    const gradedMax = Math.max(1, autoGradableMax(quiz.questions));
    const passingPercent =
      quiz.passingScorePercent ?? courseRequirements(
        (await ctx.db.get(quiz.courseId))!,
      ).quizPassPercent;
    const percentPassed = score / gradedMax >= passingPercent / 100;

    const attemptId = await ctx.db.insert("quizAttempts", {
      quizId: quiz._id,
      courseId: quiz.courseId,
      studentId: user._id,
      answers,
      score,
      maxScore,
      pendingReview: false,
      passed: percentPassed,
      submittedAt: Date.now(),
      timeTakenSeconds,
    });

    // Backend-authoritative completion check: a required quiz just got its
    // newest result — the course may now be complete.
    const course = await ctx.db.get(quiz.courseId);
    if (course && percentPassed) {
      await tryCompleteCourseInternal(ctx, user, quiz.courseId);
    }

    await notify(ctx, {
      userId: user._id,
      title: percentPassed ? "Quiz passed ✓" : "Quiz submitted",
      body: `"${quiz.title}": ${score}/${maxScore}${percentPassed ? "" : ` — ${passingPercent}% needed to pass`}.`,
      type: "quiz",
      link: course ? `/academy/learn/${course.slug}` : "/academy/dashboard",
    });

    return { attemptId, score, maxScore, passed: percentPassed, passingPercent };
  },
});
