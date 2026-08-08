import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { notify, requireUser, requireUserDoc } from "./lib";

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Full quizzes for a course (available to enrolled learners so they can take them). */
export const quizzesByCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    await requireUser(ctx);
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    return quizzes.sort((a, b) => a.createdAt - b.createdAt);
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
    const quiz = await ctx.db.get(quizId);
    if (!quiz) throw new Error("Quiz not found.");

    let score = 0;
    let maxScore = 0;
    let hasShortAnswer = false;
    const answerMap = new Map(answers.map((a) => [a.questionIndex, a.answer]));

    for (const [idx, q] of quiz.questions.entries()) {
      const points = q.points ?? 1;
      maxScore += points;
      if (q.type === "short-answer") {
        hasShortAnswer = true;
        continue;
      }
      const given = normalize(answerMap.get(idx) ?? "");
      const correct = normalize(q.answer ?? "");
      if (given && given === correct) {
        score += points;
      }
    }

    const gradedMax = quiz.questions
      .filter((q) => q.type !== "short-answer")
      .reduce((s, q) => s + (q.points ?? 1), 0);
    const passed = gradedMax > 0 && score / Math.max(1, gradedMax) >= 0.7;

    const attemptId = await ctx.db.insert("quizAttempts", {
      quizId: quiz._id,
      courseId: quiz.courseId,
      studentId: user._id,
      answers,
      score,
      maxScore,
      pendingReview: hasShortAnswer,
      passed,
      submittedAt: Date.now(),
      timeTakenSeconds,
    });

    const course = await ctx.db.get(quiz.courseId);
    await notify(ctx, {
      userId: user._id,
      title: passed ? "Quiz passed ✓" : "Quiz submitted",
      body: `"${quiz.title}": ${score}/${maxScore}${hasShortAnswer ? " — short answers await tutor review" : ""}.`,
      type: "quiz",
      link: course ? `/learn/${course.slug}` : "/dashboard",
    });

    return attemptId;
  },
});
