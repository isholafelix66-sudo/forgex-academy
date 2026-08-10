import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit, notify, requireUser, requireUserDoc } from "./lib";

export const assignmentsByCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUser(ctx);
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    return assignments
      .sort(
        (a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity),
      )
      .map((a) => ({
        ...a,
        submission:
          submissions.find((s) => s.assignmentId === a._id) ?? null,
      }));
  },
});

export const submitAssignment = mutation({
  args: {
    assignmentId: v.id("assignments"),
    text: v.string(),
    links: v.array(v.string()),
    files: v.array(v.object({ name: v.string(), url: v.string() })),
  },
  handler: async (ctx, { assignmentId, text, links, files }) => {
    const user = await requireUserDoc(ctx);
    // Spam guard: max 20 assignment submissions per user per hour.
    await checkRateLimit(
      ctx,
      `submission:${user._id}`,
      20,
      60 * 60 * 1000,
      "You're submitting assignments very quickly — please slow down.",
    );
    const assignment = await ctx.db.get(assignmentId);
    if (!assignment) throw new Error("Assignment not found.");
    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignmentId))
      .collect()
      .then((rows) => rows.find((s) => s.studentId === user._id));

    if (existing) {
      await ctx.db.patch(existing._id, {
        text,
        links,
        files,
        submittedAt: Date.now(),
        grade: undefined,
        feedback: undefined,
        gradedAt: undefined,
      });
      await notify(ctx, {
        userId: assignment.tutorId,
        title: "Assignment resubmitted",
        body: `${user.name || "A student"} updated their submission for "${assignment.title}".`,
        type: "submission",
        link: "/tutor",
      });
      return existing._id;
    }
    const id = await ctx.db.insert("submissions", {
      assignmentId,
      courseId: assignment.courseId,
      studentId: user._id,
      text,
      links,
      files,
      submittedAt: Date.now(),
    });
    await notify(ctx, {
      userId: assignment.tutorId,
      title: "New assignment submission",
      body: `${user.name || "A student"} submitted "${assignment.title}".`,
      type: "submission",
      link: "/tutor",
    });
    return id;
  },
});

export const mySubmissions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const hydrated = await Promise.all(
      submissions.map(async (s) => {
        const assignment = await ctx.db.get(s.assignmentId);
        const course = assignment ? await ctx.db.get(assignment.courseId) : null;
        return {
          ...s,
          assignment: assignment ?? null,
          course: course
            ? { _id: course._id, title: course.title, slug: course.slug }
            : null,
        };
      }),
    );
    return hydrated.sort((a, b) => b.submittedAt - a.submittedAt);
  },
});

export const upcomingDeadlines = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const now = Date.now();
    const courseIds = enrollments.map((e) => e.courseId);
    const allAssignments = await ctx.db.query("assignments").collect();
    const mine = allAssignments
      .filter(
        (a) =>
          courseIds.includes(a.courseId) &&
          a.deadline &&
          a.deadline > now,
      )
      .sort((a, b) => (a.deadline ?? 0) - (b.deadline ?? 0));
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const hydrated = await Promise.all(
      mine.map(async (a) => {
        const course = await ctx.db.get(a.courseId);
        return {
          ...a,
          course: course
            ? { _id: course._id, title: course.title, slug: course.slug }
            : null,
          submitted: submissions.some((s) => s.assignmentId === a._id),
        };
      }),
    );
    return hydrated.slice(0, 6);
  },
});

// ---------------------------------------------------------------------------
// Tutor grading
// ---------------------------------------------------------------------------

export const gradeSubmission = mutation({
  args: {
    submissionId: v.id("submissions"),
    grade: v.number(),
    feedback: v.string(),
  },
  handler: async (ctx, { submissionId, grade, feedback }) => {
    const user = await requireUserDoc(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission) throw new Error("Submission not found.");
    const assignment = await ctx.db.get(submission.assignmentId);
    if (!assignment) throw new Error("Assignment not found.");
    if (
      user.role !== "admin" &&
      (user.role !== "tutor" || !user.verified || assignment.tutorId !== user._id)
    ) {
      throw new Error("Only the course tutor can grade this.");
    }
    await ctx.db.patch(submission._id, {
      grade: Math.max(0, Math.min(grade, assignment.maxScore)),
      feedback,
      gradedAt: Date.now(),
    });
    await notify(ctx, {
      userId: submission.studentId,
      title: "Assignment graded",
      body: `"${assignment.title}" — ${grade}/${assignment.maxScore}${feedback ? ". Read your feedback." : ""}`,
      type: "grade",
      link: "/dashboard/assignments",
    });
    return true;
  },
});
