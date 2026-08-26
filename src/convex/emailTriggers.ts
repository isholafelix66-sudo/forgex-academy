/**
 * Email automations — every trigger flows through the ONE existing email
 * queue (emailData.queueSystemEmail → Gmail SMTP). Nothing here sends email
 * directly; it only enqueues with priority / dedupe / automation keys so the
 * Email Center can enable/disable each trigger and customise subjects.
 *
 * All functions are internal: business mutations schedule them with
 * ctx.runAfter(0, ...) so an email problem can never break the main flow.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  adminSummaryEmail,
  courseDecisionEmail,
  inactivityReminderEmail,
  staffAlertEmail,
  teamAssignedEmail,
  tutorApprovedEmail,
  tutorInactivityEmail,
  tutorInfoRequiredEmail,
  tutorNewEnrollmentEmail,
  tutorRejectedEmail,
  tutorSubmissionEmail,
} from "./emailTemplates";

const DAY_MS = 24 * 60 * 60 * 1000;

function siteUrl(): string {
  return (
    process.env.CONVEX_SITE_URL ||
    process.env.VITE_CONVEX_SITE_URL ||
    "https://forgex.academy"
  );
}

// ---------------------------------------------------------------------------
// Automation catalog — shown (and toggleable) in the Admin Email Center.
// ---------------------------------------------------------------------------

export const AUTOMATIONS = [
  // Tutor registration lifecycle
  { key: "tutor_registration_received", label: "Tutor registration received", description: "Sent to the applicant the moment their tutor application is submitted.", defaultSubject: "We received your ForgeX Academy tutor application", audience: "tutor" },
  { key: "tutor_approved", label: "Tutor registration approved", description: "Congratulations email with login link and next steps. Fires once per approval.", defaultSubject: "🎉 You're approved — welcome to the ForgeX tutoring team!", audience: "tutor" },
  { key: "tutor_rejected", label: "Tutor registration rejected", description: "Sent when an application is rejected.", defaultSubject: "Update on your ForgeX Academy tutor application", audience: "tutor" },
  { key: "tutor_info_required", label: "Tutor — more information required", description: "Sent when an admin requests more information on an application.", defaultSubject: "Action needed: more information on your tutor application", audience: "tutor" },
  { key: "staff_tutor_awaiting_approval", label: "Staff — new tutor awaiting approval", description: "Alerts admins/team when a new tutor application needs review.", defaultSubject: "New tutor application awaiting review", audience: "team" },
  // Student inactivity
  { key: "student_inactive_3d", label: "Student inactive — day 3 reminder", description: "First nudge after 3 days without learning activity.", defaultSubject: "Continue where you left off", audience: "student" },
  { key: "student_inactive_7d", label: "Student inactive — day 7 reminder", description: "Second nudge after 7 days without learning activity.", defaultSubject: "Don't stop now — your course is waiting", audience: "student" },
  { key: "student_inactive_14d", label: "Student inactive — day 14 reminder", description: "Final nudge after 14 days without learning activity.", defaultSubject: "Your learning streak is waiting", audience: "student" },
  // Staff / admin notifications
  { key: "team_role_assigned", label: "User assigned to a team/role", description: "Emails a user when they're assigned (or removed from) a team role.", defaultSubject: "You've been assigned to a ForgeX team", audience: "user" },
  { key: "support_ticket_new", label: "Staff — new support ticket", description: "Alerts the support team about every new ticket.", defaultSubject: "New support ticket received", audience: "team" },
  { key: "support_escalated", label: "Staff — escalated support issue", description: "Critical-priority alert for AI-escalated conversations.", defaultSubject: "⚠️ Escalated support issue", audience: "team" },
  { key: "critical_system_error", label: "Staff — critical system error", description: "Critical alert when the platform detects a serious fault (max one per day).", defaultSubject: "🚨 Critical system error detected", audience: "team" },
  { key: "admin_activity_summary", label: "Admin daily activity summary", description: "Daily digest of platform activity sent to admins and the team.", defaultSubject: "ForgeX daily activity summary", audience: "team" },
  // Tutor notifications
  { key: "tutor_new_enrollment", label: "Tutor — new student enrolled", description: "Tells the course tutor when a student enrolls.", defaultSubject: "New student enrolled in your course", audience: "tutor" },
  { key: "tutor_assignment_submission", label: "Tutor — assignment submission", description: "Tells the tutor new assignment work is waiting for review.", defaultSubject: "Assignment submitted — review needed", audience: "tutor" },
  { key: "course_submitted_for_review", label: "Staff — course awaiting review", description: "Alerts admins when a tutor submits a course for approval.", defaultSubject: "New course awaiting review", audience: "team" },
  { key: "course_approved", label: "Tutor — course approved", description: "Tells the tutor their course passed review and went live.", defaultSubject: "✅ Course approved and live", audience: "tutor" },
  { key: "course_rejected", label: "Tutor — course rejected / changes needed", description: "Tells the tutor what to change before resubmitting.", defaultSubject: "Changes needed before your course can go live", audience: "tutor" },
  { key: "tutor_inactivity", label: "Tutor inactivity reminder", description: "Weekly check-in for tutors who haven't signed in recently.", defaultSubject: "We miss you on ForgeX Academy", audience: "tutor" },
] as const;

type EnqueueArgs = {
  to: string;
  subject: string;
  html: string;
  emailType: string;
  priority?: "normal" | "high" | "critical";
  scheduledAt?: number;
  dedupeKey?: string;
  automationKey?: string;
};

async function enqueue(ctx: any, args: EnqueueArgs) {
  await ctx.runMutation(internal.emailData.queueSystemEmail, args);
}

/** All admins + anyone holding a team role. */
async function staffRecipients(ctx: any): Promise<{ id: string; email: string; name?: string; role?: string }[]> {
  const users = await ctx.db.query("users").collect();
  return users.filter((u: any) => u.role === "admin" || !!u.teamRole);
}

function dayBucket(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Tutor registration lifecycle
// ---------------------------------------------------------------------------

/**
 * Decision email after an admin reviews a tutor application. Fired by
 * admin.reviewTutorApplication ONLY when the status actually changed, so each
 * approval/rejection/info-request sends exactly once per event.
 */
export const notifyTutorDecision = internalMutation({
  args: {
    applicationId: v.id("tutorApplications"),
    prevStatus: v.string(),
    nextStatus: v.string(),
    decisionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const app = await ctx.db.get(args.applicationId);
      if (!app) return;
      if (args.prevStatus === args.nextStatus) return; // no state change → no email

      const user = await ctx.db.get(app.userId);
      const email = app.email || (user && "email" in user ? String(user.email ?? "") : "");
      if (!email) return;
      const name = app.fullName || (user?.name as string | undefined) || "there";

      if (args.nextStatus === "approved" || args.nextStatus === "verified") {
        // One email per approval event — verified-after-approved does not re-send.
        if (args.prevStatus === "verified") return;
        await enqueue(ctx, {
          to: email,
          subject: "🎉 You're approved — welcome to the ForgeX tutoring team!",
          html: tutorApprovedEmail({ name, loginUrl: `${siteUrl()}/auth?returnTo=/tutor` }).html,
          emailType: "tutor_approved",
          priority: "high",
          automationKey: "tutor_approved",
          dedupeKey: `tutor-decision:${args.applicationId}:${args.nextStatus}`,
        });
        return;
      }
      if (args.nextStatus === "rejected") {
        await enqueue(ctx, {
          to: email,
          subject: "Update on your ForgeX Academy tutor application",
          html: tutorRejectedEmail({ name, reason: args.decisionNote }).html,
          emailType: "tutor_rejected",
          priority: "high",
          automationKey: "tutor_rejected",
          dedupeKey: `tutor-decision:${args.applicationId}:rejected`,
        });
        return;
      }
      if (args.nextStatus === "information-required") {
        await enqueue(ctx, {
          to: email,
          subject: "Action needed: more information on your tutor application",
          html: tutorInfoRequiredEmail({ name, request: args.decisionNote ?? "Please sign in to see what's missing." }).html,
          emailType: "tutor_info_required",
          priority: "high",
          automationKey: "tutor_info_required",
          dedupeKey: `tutor-decision:${args.applicationId}:info`,
        });
      }
    } catch (err) {
      console.warn("[email] tutor decision notification failed", err);
    }
  },
});

/** Alerts admins + team that a new tutor application awaits review. */
export const notifyStaffNewTutorApplication = internalMutation({
  args: { applicationId: v.id("tutorApplications"), applicantName: v.string() },
  handler: async (ctx, args) => {
    try {
      for (const member of await staffRecipients(ctx)) {
        await enqueue(ctx, {
          to: String(member.email),
          subject: "New tutor application awaiting review",
          html: staffAlertEmail({
            title: "New tutor application awaiting review",
            rows: [
              ["Applicant", args.applicantName],
              ["Action", "Review & approve from the Admin Applications page"],
            ],
            ctaLabel: "Open applications",
            ctaUrl: `${siteUrl()}/admin/applications`,
          }).html,
          emailType: "staff_tutor_pending",
          priority: "high",
          automationKey: "staff_tutor_awaiting_approval",
          dedupeKey: `tutor-app-staff:${args.applicationId}`,
        });
      }
    } catch (err) {
      console.warn("[email] staff tutor-application alert failed", err);
    }
  },
});

// ---------------------------------------------------------------------------
// Enrollment + assignment + course flows
// ---------------------------------------------------------------------------

/** Tells the tutor a new student enrolled (never emailed for self-enrollment). */
export const notifyNewEnrollmentToTutor = internalMutation({
  args: { enrollmentId: v.id("enrollments") },
  handler: async (ctx, args) => {
    try {
      const enrollment = await ctx.db.get(args.enrollmentId);
      if (!enrollment) return;
      const [course, student] = await Promise.all([
        ctx.db.get(enrollment.courseId),
        ctx.db.get(enrollment.studentId),
      ]);
      if (!course) return;
      const tutor = await ctx.db.get(course.tutorId);
      const email = tutor && "email" in tutor ? String(tutor.email ?? "") : "";
      if (!email) return;
      await enqueue(ctx, {
        to: email,
        subject: `New student enrolled in "${course.title}"`,
        html: tutorNewEnrollmentEmail({
          tutorName: (tutor?.name as string) || "there",
          studentName: (student?.name as string) || "A student",
          courseTitle: course.title,
        }).html,
        emailType: "tutor_new_enrollment",
        priority: "normal",
        automationKey: "tutor_new_enrollment",
        dedupeKey: `enroll-tutor:${args.enrollmentId}`,
      });
    } catch (err) {
      console.warn("[email] enrollment notification failed", err);
    }
  },
});

/** Tells the tutor a student submitted assignment work needing review. */
export const notifyAssignmentSubmissionToTutor = internalMutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    try {
      const submission = await ctx.db.get(args.submissionId);
      if (!submission) return;
      const [assignment, student] = await Promise.all([
        ctx.db.get(submission.assignmentId),
        ctx.db.get(submission.studentId),
      ]);
      if (!assignment) return;
      const tutor = await ctx.db.get(assignment.tutorId);
      const email = tutor && "email" in tutor ? String(tutor.email ?? "") : "";
      if (!email) return;
      let courseTitle = "";
      if (assignment.courseId) {
        const course = await ctx.db.get(assignment.courseId);
        courseTitle = course?.title ?? "";
      }
      await enqueue(ctx, {
        to: email,
        subject: `Assignment submitted: "${assignment.title}"`,
        html: tutorSubmissionEmail({
          tutorName: (tutor?.name as string) || "there",
          studentName: (student?.name as string) || "A student",
          assignmentTitle: assignment.title,
          courseTitle: courseTitle || "your course",
        }).html,
        emailType: "tutor_submission",
        priority: "normal",
        automationKey: "tutor_assignment_submission",
        dedupeKey: `submission-tutor:${args.submissionId}`,
      });
    } catch (err) {
      console.warn("[email] submission notification failed", err);
    }
  },
});

/** Alerts admins/team that a course was submitted for review. */
export const notifyCourseSubmittedToStaff = internalMutation({
  args: { courseId: v.id("courses"), courseTitle: v.string(), tutorName: v.string() },
  handler: async (ctx, args) => {
    try {
      for (const member of await staffRecipients(ctx)) {
        await enqueue(ctx, {
          to: String(member.email),
          subject: "New course awaiting review",
          html: staffAlertEmail({
            title: "New course awaiting review",
            rows: [
              ["Course", args.courseTitle],
              ["Tutor", args.tutorName],
              ["Action", "Preview and approve from the Admin Courses page"],
            ],
            ctaLabel: "Open courses",
            ctaUrl: `${siteUrl()}/admin/courses`,
          }).html,
          emailType: "staff_course_review",
          priority: "high",
          automationKey: "course_submitted_for_review",
          dedupeKey: `course-review:${args.courseId}:${dayBucket()}`,
        });
      }
    } catch (err) {
      console.warn("[email] course review alert failed", err);
    }
  },
});

/** Tells the tutor whether their course was approved or rejected. */
export const notifyCourseDecisionToTutor = internalMutation({
  args: {
    courseId: v.id("courses"),
    approved: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const course = await ctx.db.get(args.courseId);
      if (!course) return;
      const tutor = await ctx.db.get(course.tutorId);
      const email = tutor && "email" in tutor ? String(tutor.email ?? "") : "";
      if (!email) return;
      await enqueue(ctx, {
        to: email,
        subject: args.approved
          ? `✅ Course approved: "${course.title}" is live`
          : `Changes needed: "${course.title}" was not approved`,
        html: courseDecisionEmail({
          tutorName: (tutor?.name as string) || "there",
          courseTitle: course.title,
          approved: args.approved,
          note: args.note,
        }).html,
        emailType: args.approved ? "course_approved" : "course_rejected",
        priority: "high",
        automationKey: args.approved ? "course_approved" : "course_rejected",
        dedupeKey: `course-decision:${args.courseId}:${args.approved ? "approved" : "rejected"}:${dayBucket()}`,
      });
    } catch (err) {
      console.warn("[email] course decision notification failed", err);
    }
  },
});

/** Emails a user when a team role is assigned or removed. */
export const notifyTeamRoleAssigned = internalMutation({
  args: { userId: v.id("users"), roleLabel: v.string(), removed: v.boolean() },
  handler: async (ctx, args) => {
    try {
      const user = await ctx.db.get(args.userId);
      const email = user && "email" in user ? String(user.email ?? "") : "";
      if (!email) return;
      await enqueue(ctx, {
        to: email,
        subject: args.removed
          ? "Your ForgeX team role has been updated"
          : `You've been assigned to the ${args.roleLabel} team`,
        html: teamAssignedEmail({
          name: (user?.name as string) || "there",
          role: args.roleLabel,
          removed: args.removed,
        }).html,
        emailType: "team_role_assigned",
        priority: "normal",
        automationKey: "team_role_assigned",
        dedupeKey: `team-role:${args.userId}:${args.removed ? "removed" : args.roleLabel}:${dayBucket()}`,
      });
    } catch (err) {
      console.warn("[email] team role notification failed", err);
    }
  },
});

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

/** Normal-priority alert to assigned team + admins for a new ticket. */
export const notifySupportTicketCreated = internalMutation({
  args: {
    ticketNumber: v.string(),
    category: v.string(),
    subject: v.string(),
    requesterName: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      for (const member of await staffRecipients(ctx)) {
        await enqueue(ctx, {
          to: String(member.email),
          subject: `New support ticket ${args.ticketNumber}`,
          html: staffAlertEmail({
            title: `New support ticket ${args.ticketNumber}`,
            rows: [
              ["Ticket", args.ticketNumber],
              ["Category", args.category],
              ["Requester", args.requesterName],
              ["Issue", args.subject],
            ],
            ctaLabel: "Open support dashboard",
            ctaUrl: `${siteUrl()}/admin/ai-support`,
          }).html,
          emailType: "support_ticket_staff",
          priority: "normal",
          automationKey: "support_ticket_new",
          dedupeKey: `ticket-staff:${args.ticketNumber}`,
        });
      }
    } catch (err) {
      console.warn("[email] ticket alert failed", err);
    }
  },
});

/** Critical-priority alert for escalated issues (AI limit fallback etc.). */
export const notifyEscalatedTicket = internalMutation({
  args: {
    ticketNumber: v.string(),
    category: v.string(),
    subject: v.string(),
    summary: v.string(),
    assignedTeam: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      for (const member of await staffRecipients(ctx)) {
        await enqueue(ctx, {
          to: String(member.email),
          subject: `⚠️ Escalated support issue ${args.ticketNumber}`,
          html: staffAlertEmail({
            title: `Escalated support issue ${args.ticketNumber}`,
            rows: [
              ["Ticket", args.ticketNumber],
              ["Assigned team", args.assignedTeam],
              ["Category", args.category],
              ["Issue", args.subject],
              ["Handoff summary", args.summary.slice(0, 400)],
            ],
            ctaLabel: "Respond now",
            ctaUrl: `${siteUrl()}/admin/ai-support`,
          }).html,
          emailType: "support_escalated_staff",
          priority: "critical",
          automationKey: "support_escalated",
          dedupeKey: `ticket-escalated:${args.ticketNumber}`,
        });
      }
    } catch (err) {
      console.warn("[email] escalation alert failed", err);
    }
  },
});

/**
 * Critical system error notification. Deduped to at most one email per error
 * signature per day so a recurring fault can't flood the inbox.
 */
export const criticalSystemError = internalMutation({
  args: { title: v.string(), detail: v.string() },
  handler: async (ctx, args) => {
    try {
      for (const member of await staffRecipients(ctx)) {
        await enqueue(ctx, {
          to: String(member.email),
          subject: "🚨 Critical system error detected",
          html: staffAlertEmail({
            title: "Critical system error detected",
            rows: [
              ["Fault", args.title],
              ["Detail", args.detail.slice(0, 600)],
              ["Detected", new Date().toUTCString()],
            ],
            ctaLabel: "Open the admin dashboard",
            ctaUrl: `${siteUrl()}/admin`,
          }).html,
          emailType: "critical_error",
          priority: "critical",
          automationKey: "critical_system_error",
          dedupeKey: `crit-err:${dayBucket()}:${args.title.replace(/\W+/g, "-").slice(0, 40)}`,
        });
      }
    } catch (err) {
      console.warn("[email] critical error notification failed", err);
    }
  },
});

// ---------------------------------------------------------------------------
// Inactivity scans (cron-driven)
// ---------------------------------------------------------------------------

const INACTIVITY_STAGES = [3, 7, 14];

/**
 * Student course-inactivity scan. For every in-progress enrollment:
 *  - completed courses are skipped entirely
 *  - resumed students have their stage reset (reminders stop immediately)
 *  - reminders fire at 3 / 7 / 14 days, never twice for the same stage
 *    (dedupeKey includes enrollment + stage, and inactivityStage tracks the
 *    highest stage already sent).
 */
export const scanStudentInactivity = internalMutation({
  args: {},
  handler: async (ctx) => {
    try {
      const now = Date.now();
      const enrollments = await ctx.db
        .query("enrollments")
        .filter((q: any) => q.eq(q.field("status"), "in-progress"))
        .take(2000);

      for (const enrollment of enrollments) {
        const lastActivityAt = enrollment.lastActivityAt ?? enrollment.enrolledAt;
        const progress = enrollment.progress ?? 0;
        const stage = enrollment.inactivityStage ?? 0;
        const inactiveDays = Math.floor((now - lastActivityAt) / DAY_MS);

        // Student resumed learning → stop all future reminders.
        if (inactiveDays < INACTIVITY_STAGES[0]) {
          if (stage !== 0) await ctx.db.patch(enrollment._id, { inactivityStage: 0 });
          continue;
        }

        // Highest threshold crossed that hasn't been reminded yet.
        const targetStage = [...INACTIVITY_STAGES]
          .reverse()
          .find((t) => inactiveDays >= t && stage < t);
        if (!targetStage) continue;

        const [student, course] = await Promise.all([
          ctx.db.get(enrollment.studentId),
          ctx.db.get(enrollment.courseId),
        ]);
        const email = student && "email" in student ? String(student.email ?? "") : "";
        if (!student || !email || !course) continue;
        if (progress >= 100) continue;

        await enqueue(ctx, {
          to: email,
          subject:
            targetStage >= 7
              ? `Don't stop now — "${course.title}" is waiting`
              : `Continue where you left off: ${course.title}`,
          html: inactivityReminderEmail({
            name: student.name || "there",
            courseTitle: course.title,
            progress,
            continueUrl: `${siteUrl()}/learn/${course.slug}`,
            inactiveDays: targetStage,
          }).html,
          emailType: `student_inactive_${targetStage}d`,
          priority: "normal",
          automationKey: `student_inactive_${targetStage}d`,
          dedupeKey: `inact:${String(enrollment._id)}:${targetStage}`,
        });

        await ctx.db.patch(enrollment._id, { inactivityStage: targetStage });
      }
    } catch (err) {
      console.warn("[email] inactivity scan failed", err);
    }
  },
});

/** Weekly nudge for tutors who haven't signed in for 21+ days. */
export const scanTutorInactivity = internalMutation({
  args: {},
  handler: async (ctx) => {
    try {
      const now = Date.now();
      const users = await ctx.db.query("users").collect();
      const week = dayBucket().slice(0, 7); // YYYY-MM so at most one per month
      for (const u of users) {
        if (u.role !== "tutor" || u.suspended) continue;
        const email = "email" in u ? String(u.email ?? "") : "";
        if (!email) continue;
        const lastActivity = u.lastActivity ?? 0;
        if (!lastActivity) continue;
        const days = Math.floor((now - lastActivity) / DAY_MS);
        if (days < 21) continue;
        await enqueue(ctx, {
          to: email,
          subject: "We miss you on ForgeX Academy",
          html: tutorInactivityEmail({ name: u.name || "there", days }).html,
          emailType: "tutor_inactivity",
          priority: "normal",
          automationKey: "tutor_inactivity",
          dedupeKey: `tutor-inactive:${String(u._id)}:${week}`,
        });
      }
    } catch (err) {
      console.warn("[email] tutor inactivity scan failed", err);
    }
  },
});

/** Daily platform digest to admins + team (deduped per calendar day). */
export const sendAdminDailySummary = internalMutation({
  args: {},
  handler: async (ctx) => {
    try {
      const now = Date.now();
      const since = now - DAY_MS;
      const bucket = dayBucket(now);

      const [users, enrollments, courses, logs] = await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db.query("enrollments").collect(),
        ctx.db.query("courses").collect(),
        ctx.db.query("emailLogs").collect(),
      ]);

      const stats: [string, number][] = [
        ["New members (24h)", users.filter((u) => (u as any)._creationTime >= since).length],
        ["New enrollments (24h)", enrollments.filter((e) => e.enrolledAt >= since).length],
        ["Courses pending review", courses.filter((c) => (c as any).status === "pending").length],
        ["Active learners", enrollments.filter((e) => e.status === "in-progress").length],
        ["Certificates issued (24h)", logs.filter((l) => l.emailType === "certificate" && (l.sentAt ?? 0) >= since).length],
        ["Emails sent (24h)", logs.filter((l) => (l.sentAt ?? 0) >= since).length],
        ["Emails failed (24h)", logs.filter((l) => l.status === "failed" && (l.failedAt ?? 0) >= since).length],
      ];

      for (const member of await staffRecipients(ctx)) {
        await enqueue(ctx, {
          to: String(member.email),
          subject: "ForgeX daily activity summary",
          html: adminSummaryEmail({ periodLabel: "Daily", stats }).html,
          emailType: "admin_summary",
          priority: "normal",
          automationKey: "admin_activity_summary",
          dedupeKey: `admin-summary:${bucket}`,
        });
      }
    } catch (err) {
      console.warn("[email] daily summary failed", err);
    }
  },
});
