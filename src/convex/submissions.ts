import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { checkRateLimit, notify, requireUser, requireUserDoc } from "./lib";
import { resourceValidator } from "./schema";
import { tryCompleteCourseInternal } from "./learn";

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
      .filter((a) => a.published !== false)
      .map((a) => ({
        ...a,
        submission:
          submissions.find((s) => s.assignmentId === a._id) ?? null,
      }));
  },
});

/** ALL published assignments across the signed-in student's enrolled courses,
 *  hydrated with the course and the student's own submission (if any). This is
 *  the dashboard's source of truth: students must see assignments that have
 *  NOT been submitted yet — `mySubmissions` only ever listed submitted work,
 *  which is why posted assignments never appeared in the student dashboard. */
export const myAssignments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    if (enrollments.length === 0) return [];
    const courseIds = new Set(enrollments.map((e) => e.courseId));
    const assignments = (await ctx.db.query("assignments").collect()).filter(
      (a) => courseIds.has(a.courseId) && a.published !== false,
    );
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const byAssignment = new Map(submissions.map((s) => [s.assignmentId, s]));
    const hydrated = await Promise.all(
      assignments.map(async (a) => {
        const course = await ctx.db.get(a.courseId);
        return {
          ...a,
          course: course
            ? { _id: course._id, title: course.title, slug: course.slug }
            : null,
          submission: byAssignment.get(a._id) ?? null,
        };
      }),
    );
    return hydrated.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Validate per-question answers against the built questions before accepting
 *  a submission. Legacy assignments (no questions) skip this entirely. */
function validateAnswers(
  questions: NonNullable<Doc<"assignments">["questions"]>,
  answers: Array<{
    questionIndex: number;
    text?: string;
    url?: string;
    fileName?: string;
    fileUrl?: string;
  }>,
) {
  const byIdx = new Map(answers.map((a) => [a.questionIndex, a]));
  questions.forEach((q, i) => {
    const a = byIdx.get(i);
    const hasText = !!a?.text?.trim();
    const hasFile = !!a?.fileUrl;
    const hasLink = !!a?.url?.trim();
    if (!a || (!hasText && !hasFile && !hasLink)) {
      throw new Error(`Question ${i + 1} needs an answer before you can submit.`);
    }
    if ((q.type === "file" || q.type === "text-and-file") && !hasFile) {
      throw new Error(`Question ${i + 1}: attach the required file.`);
    }
    if (
      (q.type === "short-text" || q.type === "long-text" || q.type === "text-and-file") &&
      !hasText
    ) {
      throw new Error(`Question ${i + 1}: write your answer.`);
    }
    if (q.type === "link" && !hasLink) {
      throw new Error(`Question ${i + 1}: add your link.`);
    }
  });
}

export const submitAssignment = mutation({
  args: {
    assignmentId: v.id("assignments"),
    text: v.string(),
    links: v.array(v.string()),
    // Storage-backed uploads are preferred ({name, url, storageId}); legacy
    // callers may still send bare {name, url} pasted links.
    files: v.array(resourceValidator),
    // Per-question answers for built assignments.
    answers: v.optional(
      v.array(
        v.object({
          questionIndex: v.number(),
          text: v.optional(v.string()),
          url: v.optional(v.string()),
          fileName: v.optional(v.string()),
          fileUrl: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, { assignmentId, text, links, files, answers }) => {
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
    if (!assignment || assignment.published === false) {
      throw new Error("Assignment not found.");
    }
    const qs = assignment.questions ?? [];
    if (qs.length > 0) validateAnswers(qs, answers ?? []);

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
        answers,
        submittedAt: Date.now(),
        grade: undefined,
        feedback: undefined,
        gradedAt: undefined,
        questionGrades: undefined,
        status: "submitted",
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
      answers,
      submittedAt: Date.now(),
      status: "submitted",
    });
    await notify(ctx, {
      userId: assignment.tutorId,
      title: "New assignment submission",
      body: `${user.name || "A student"} submitted "${assignment.title}".`,
      type: "submission",
      link: "/tutor",
    });
    await ctx.scheduler.runAfter(0, internal.emailTriggers.notifyAssignmentSubmissionToTutor, {
      submissionId: id,
    });

    // Backend-authoritative completion: submitting a required assignment may
    // complete the course right here.
    await tryCompleteCourseInternal(ctx, user, assignment.courseId);
    return id;
  },
});

/** Resolve freshly-uploaded attachment files into resource-shaped records
 *  (name + authoritative server-resolved URL + storage id) so a submission
 *  always references real stored files — never a client-invented URL. The
 *  client uploads bytes via storage.generateUploadUrl first, then calls this
 *  to turn the storage ids into submission-ready file records. */
export const saveSubmittedFiles = mutation({
  args: {
    files: v.array(
      v.object({
        name: v.string(),
        storageId: v.id("_storage"),
        fileType: v.optional(v.string()),
        fileSize: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { files }) => {
    const user = await requireUserDoc(ctx);
    await checkRateLimit(ctx, `upload:${user._id}`, 60, 60 * 1000);
    const resolved = await Promise.all(
      files.map(async (f) => ({
        name: f.name,
        url: (await ctx.storage.getUrl(f.storageId)) ?? "",
        storageId: f.storageId,
        kind: "file" as const,
        fileType: f.fileType,
        fileSize: f.fileSize,
        uploadedBy: user._id,
        createdAt: Date.now(),
      })),
    );
    if (resolved.some((f) => !f.url)) {
      throw new Error(
        "The file couldn't be stored — please upload it again.",
      );
    }
    return resolved;
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



// ---------------------------------------------------------------------------
// Tutor grading
// ---------------------------------------------------------------------------

export const gradeSubmission = mutation({
  args: {
    submissionId: v.id("submissions"),
    grade: v.number(),
    feedback: v.string(),
    // Optional per-question grading — total is recomputed server-side.
    questionGrades: v.optional(
      v.array(
        v.object({
          questionIndex: v.number(),
          score: v.number(),
          comment: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, { submissionId, grade, feedback, questionGrades }) => {
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

    let finalGrade = grade;
    if (questionGrades && questionGrades.length > 0) {
      const qs = assignment.questions ?? [];
      // Clamp each question score to its max marks, then total server-side so
      // the stored grade can never exceed the assignment maximum.
      finalGrade = questionGrades.reduce((sum, g) => {
        const maxMarks = qs[g.questionIndex]?.maxMarks ?? 0;
        return sum + Math.max(0, Math.min(g.score, maxMarks || g.score));
      }, 0);
    }
    finalGrade = Math.max(0, Math.min(finalGrade, assignment.maxScore));

    await ctx.db.patch(submission._id, {
      grade: finalGrade,
      feedback,
      questionGrades,
      gradedAt: Date.now(),
      status: "graded",
    });
    await notify(ctx, {
      userId: submission.studentId,
      title: "Assignment graded",
      body: `"${assignment.title}" — ${finalGrade}/${assignment.maxScore}${feedback ? ". Read your feedback." : ""}`,
      type: "grade",
      link: "/dashboard/assignments",
    });
    return true;
  },
});
