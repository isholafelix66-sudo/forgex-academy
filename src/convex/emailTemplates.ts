/**
 * ForgeX Academy transactional email templates.
 *
 * Pure functions (V8-runtime safe — importable from mutations and the auth
 * provider). Every template shares one mobile-responsive layout with the
 * ForgeX electric-black + lime-green branding. Inline styles only: email
 * clients strip <style> tags.
 *
 * SECURITY: templates never embed OTP codes for logging purposes — the OTP
 * template is rendered at send time by the SMTP action and the code is NOT
 * persisted into emailLogs.
 */

export const BRAND = {
  name: process.env.EMAIL_FROM_NAME || "ForgeX Academy",
  black: "#0c0e0a",
  panel: "#15180f",
  lime: "#a3e635",
  limeSoft: "#ecfccb",
  text: "#f4f7ee",
  muted: "#9aa38c",
  border: "#2a2e20",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wrap body content in the shared ForgeX shell. */
function layout(opts: {
  heading: string;
  bodyHtml: string;
  footerNote?: string;
}): string {
  const { name } = BRAND;
  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#070806;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070806;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.black};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
        <tr><td style="padding:22px 28px;border-bottom:1px solid ${BRAND.border};">
          <table role="presentation" width="100%"><tr>
            <td style="font-size:18px;font-weight:800;color:${BRAND.lime};letter-spacing:-0.02em;">
              Forge<span style="color:${BRAND.text};">X</span> Academy
            </td>
            <td align="right" style="font-size:11px;color:${BRAND.muted};">Discover. Express. Build.</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;">
          <h1 style="margin:0 0 14px;font-size:20px;font-weight:700;line-height:1.3;">${opts.heading}</h1>
          <div style="font-size:14px;line-height:1.65;color:#d8ddcf;">${opts.bodyHtml}</div>
        </td></tr>
        <tr><td style="padding:18px 28px 26px;">
          <p style="margin:0;font-size:11px;color:${BRAND.muted};line-height:1.6;">
            ${opts.footerNote ?? `You are receiving this because you have a ${name} account.`}<br/>
            © ${new Date().getFullYear()} ${name} · ForgeX Network
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Big lime pill used for OTP / reset codes. */
function codePill(code: string): string {
  return `<div style="text-align:center;margin:22px 0;">
    <div style="display:inline-block;background:${BRAND.panel};border:1px solid ${BRAND.lime};border-radius:14px;padding:16px 34px;">
      <span style="font-size:32px;font-weight:800;letter-spacing:10px;color:${BRAND.lime};">${escapeHtml(code)}</span>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Public template builders
// ---------------------------------------------------------------------------

export function otpEmail(opts: { code: string; expiryMinutes: number }): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: `${opts.code} is your ForgeX Academy verification code`,
    html: layout({
      heading: "Your verification code",
      bodyHtml: `
        <p>Use the code below to verify your email address and continue.</p>
        ${codePill(opts.code)}
        <p style="text-align:center;font-size:13px;color:${BRAND.muted};">
          This code <strong style="color:${BRAND.text};">expires in ${opts.expiryMinutes} minutes</strong>.
          Never share it with anyone.
        </p>
        <p style="font-size:13px;color:${BRAND.muted};">Didn't request this code? You can safely ignore this email.</p>`,
    }),
    text: `Your ForgeX Academy verification code is ${opts.code}. It expires in ${opts.expiryMinutes} minutes.`,
  };
}

export function welcomeEmail(opts: { name: string }): { subject: string; html: string; text: string } {
  return {
    subject: "Welcome to ForgeX Academy 🎉",
    html: layout({
      heading: `Welcome aboard, ${escapeHtml(opts.name || "friend")}! 👋`,
      bodyHtml: `
        <p>Your ForgeX Academy account is ready. Here's how to get started:</p>
        <ul style="padding-left:18px;margin:12px 0;">
          <li style="margin:6px 0;">📚 Explore structured learning paths built for real skills</li>
          <li style="margin:6px 0;">🛠️ Build projects and grow your portfolio</li>
          <li style="margin:6px 0;">🎓 Earn certificates you can share</li>
          <li style="margin:6px 0;">🤖 Get instant help from our AI Support Assistant anytime</li>
        </ul>
        <p>We're glad you're here. Let's forge your future.</p>`,
    }),
    text: `Welcome to ForgeX Academy, ${opts.name}! Your account is ready — explore learning paths, build projects, and earn certificates.`,
  };
}

// ---------------------------------------------------------------------------
// ForgeX Projects templates
// ---------------------------------------------------------------------------

/** Welcome email sent once when a Projects account creates its portfolio. */
export function projectsWelcomeEmail(opts: {
  name: string;
  portfolioPath: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: "Welcome to Projects — your portfolio awaits 🚀",
    html: layout({
      heading: `Welcome to Projects, ${escapeHtml(opts.name || "friend")}!`,
      bodyHtml: `
        <p>Your <strong>Projects</strong> account is ready. Projects is the place to build one professional portfolio and turn it into your own personal website.</p>
        <ul style="padding-left:18px;margin:12px 0;">
          <li style="margin:6px 0;">🧑‍🎨 Add your about, skills, experience, education and services</li>
          <li style="margin:6px 0;">🛠️ Showcase the work you're proud of</li>
          <li style="margin:6px 0;">🔗 Publish it and share one link anywhere</li>
        </ul>
        <p>Your portfolio link will be <strong style="color:${BRAND.lime};">${escapeHtml(opts.portfolioPath)}</strong> — you can change your URL any time in settings.</p>`,
      footerNote: `You are receiving this because you created a ${BRAND.name} account.`,
    }),
    text: `Welcome to Projects, ${opts.name}! Your portfolio lives at ${opts.portfolioPath}. Add your work, publish it, and share one link anywhere.`,
  };
}

/** Sent the first time a portfolio goes live (published or discoverable). */
export function portfolioPublishedEmail(opts: {
  name: string;
  portfolioUrl: string;
  discoverable: boolean;
}): { subject: string; html: string; text: string } {
  return {
    subject: "Your portfolio is live 🎉",
    html: layout({
      heading: "Your portfolio is live",
      bodyHtml: `
        <p>Nice work, ${escapeHtml(opts.name || "friend")} — your portfolio is published.</p>
        <p style="margin:16px 0;">
          <a href="${escapeHtml(opts.portfolioUrl)}" style="display:inline-block;background:${BRAND.lime};color:#0b0d08;font-weight:700;text-decoration:none;border-radius:12px;padding:12px 22px;">View my portfolio</a>
        </p>
        <p style="font-size:13px;color:${BRAND.muted};">Share this link anywhere — it's your personal website:</p>
        <p style="font-size:13px;word-break:break-all;color:${BRAND.lime};">${escapeHtml(opts.portfolioUrl)}</p>
        ${
          opts.discoverable
            ? `<p>Your portfolio is also <strong>discoverable</strong> — it can appear in the Projects Explore section.</p>`
            : `<p style="font-size:13px;color:${BRAND.muted};">Only people with your link can view it. Make it discoverable to appear in Explore.</p>`
        }`,
    }),
    text: `Your portfolio is live: ${opts.portfolioUrl}`,
  };
}

export function passwordResetEmail(opts: { code: string; expiryMinutes: number }): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: "Reset your ForgeX Academy access",
    html: layout({
      heading: "Account recovery code",
      bodyHtml: `
        <p>We received a request to regain access to your account. Enter this recovery code to continue:</p>
        ${codePill(opts.code)}
        <p style="text-align:center;font-size:13px;color:${BRAND.muted};">
          Expires in <strong style="color:${BRAND.text};">${opts.expiryMinutes} minutes</strong>.
        </p>
        <p style="font-size:13px;color:${BRAND.muted};">If you didn't request this, your account is safe — just ignore this email.</p>`,
    }),
    text: `Your ForgeX Academy recovery code is ${opts.code}. It expires in ${opts.expiryMinutes} minutes.`,
  };
}

export function enrollmentEmail(opts: { name: string; courseTitle: string }): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: `You're enrolled in "${opts.courseTitle}"`,
    html: layout({
      heading: "Enrollment confirmed ✅",
      bodyHtml: `
        <p>Hi ${escapeHtml(opts.name)}, you're officially enrolled in:</p>
        <div style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;padding:16px 20px;margin:16px 0;">
          <strong style="color:${BRAND.lime};font-size:15px;">${escapeHtml(opts.courseTitle)}</strong>
        </div>
        <p>Your progress is saved automatically as you watch lessons and complete quizzes. Jump in whenever you're ready.</p>`,
    }),
    text: `Hi ${opts.name}, you're enrolled in "${opts.courseTitle}". Start learning on ForgeX Academy.`,
  };
}

export function assessmentNotificationEmail(opts: {
  kind: "quiz" | "exam";
  name: string;
  courseTitle?: string;
  score?: number;
  passed?: boolean;
}): { subject: string; html: string; text: string } {
  const label = opts.kind === "exam" ? "exam" : "quiz";
  const resultLine =
    typeof opts.score === "number"
      ? `<p>You scored <strong style="color:${BRAND.lime};">${opts.score}%</strong> — ${
          opts.passed ? "passed 🎉" : "not passed this time"
        }${!opts.passed ? ". Review the material and try again — every attempt helps you learn." : ""}</p>`
      : "";
  return {
    subject:
      typeof opts.score === "number"
        ? `${opts.kind === "exam" ? "Exam" : "Quiz"} result: ${opts.score}%`
        : `New ${label} available`,
    html: layout({
      heading: opts.kind === "exam" ? "Exam update" : "Quiz update",
      bodyHtml: `
        <p>Hi ${escapeHtml(opts.name)},</p>
        ${
          typeof opts.score === "number"
            ? `<p>You completed a ${label}${
                opts.courseTitle ? ` in <strong>${escapeHtml(opts.courseTitle)}</strong>` : ""
              }.</p>${resultLine}`
            : `<p>A new ${label}${
                opts.courseTitle ? ` was added to <strong>${escapeHtml(opts.courseTitle)}</strong>` : ""
              }. Sign in to take it while it's fresh.</p>`
        }`,
    }),
    text:
      typeof opts.score === "number"
        ? `You scored ${opts.score}% on your ${label} at ForgeX Academy.`
        : `A new ${label} is available on ForgeX Academy.`,
  };
}

export function certificateEmail(opts: {
  name: string;
  courseTitle: string;
  certificateId: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `🎓 Certificate earned: ${opts.courseTitle}`,
    html: layout({
      heading: "Congratulations — you did it! 🎓",
      bodyHtml: `
        <p>Hi ${escapeHtml(opts.name)}, you've completed all requirements and earned a certificate for:</p>
        <div style="background:${BRAND.panel};border:1px solid ${BRAND.lime};border-radius:12px;padding:20px;margin:16px 0;text-align:center;">
          <div style="font-size:16px;font-weight:700;color:${BRAND.text};">${escapeHtml(opts.courseTitle)}</div>
          <div style="margin-top:8px;font-size:12px;color:${BRAND.muted};">Certificate ID: ${escapeHtml(opts.certificateId)}</div>
        </div>
        <p>Download it from your dashboard and share it on your profile or CV. This is proof of real skill — be proud of it.</p>`,
    }),
    text: `Congratulations ${opts.name}! You earned a certificate for "${opts.courseTitle}" (ID: ${opts.certificateId}).`,
  };
}

export function supportNotificationEmail(opts: {
  ticketId: string;
  category: string;
  summary: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `Support ticket ${opts.ticketId} received`,
    html: layout({
      heading: "We've got your request 🛠️",
      bodyHtml: `
        <p>Your support request has been received and routed to the right team.</p>
        <div style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;padding:16px 20px;margin:16px 0;">
          <div style="font-size:13px;"><span style="color:${BRAND.muted};">Ticket:</span> <strong style="color:${BRAND.lime};">${escapeHtml(opts.ticketId)}</strong></div>
          <div style="font-size:13px;margin-top:4px;"><span style="color:${BRAND.muted};">Category:</span> ${escapeHtml(opts.category)}</div>
          <div style="font-size:13px;margin-top:8px;color:#d8ddcf;">${escapeHtml(opts.summary)}</div>
        </div>
        <p>A team member will reply in this conversation as soon as possible — you'll see their response right where you started the chat.</p>`,
    }),
    text: `Support ticket ${opts.ticketId} (${opts.category}) has been received. A team member will respond soon.`,
  };
}

export function adminBroadcastEmail(opts: {
  subject: string;
  messageHtml: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: opts.subject,
    html: layout({
      heading: "A message from ForgeX Academy",
      bodyHtml: opts.messageHtml,
      footerNote: `Sent to you as part of the ${BRAND.name} community.`,
    }),
    text: opts.messageHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  };
}

// ---------------------------------------------------------------------------
// Automation templates (Email Center) — every automated trigger below flows
// through the same queue; subjects are overridable via emailAutomations.
// ---------------------------------------------------------------------------

function infoBox(rows: [string, string][]): string {
  return `<div style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;padding:16px 20px;margin:16px 0;">${rows
    .map(
      ([k, val]) =>
        `<div style="font-size:13px;margin-top:${k === rows[0][0] ? "0" : "6px"};"><span style="color:${BRAND.muted};">${escapeHtml(k)}:</span> <strong style="color:${BRAND.text};">${val}</strong></div>`,
    )
    .join("")}</div>`;
}

function limeButton(label: string, url: string): string {
  return `<div style="text-align:center;margin:22px 0;"><a href="${url}" style="display:inline-block;background:${BRAND.lime};color:#10120c;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:10px;">${escapeHtml(label)}</a></div>`;
}

export function tutorApprovedEmail(opts: {
  name: string;
  loginUrl: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: "🎉 You're approved — welcome to the ForgeX tutoring team!",
    html: layout({
      heading: `Congratulations, ${escapeHtml(opts.name)}! 🎉`,
      bodyHtml: `
        <p>Your tutor application has been <strong style="color:${BRAND.lime};">approved</strong>. You're now part of the ForgeX Academy tutoring team.</p>
        ${infoBox([
          ["Next steps", "Sign in, complete your tutor profile and start building your first course."],
          ["Your dashboard", "Create lessons, quizzes and assignments, and follow your students' progress."],
        ])}
        ${limeButton("Sign in to your Tutor Dashboard", opts.loginUrl)}
        <p style="font-size:13px;color:${BRAND.muted};">We can't wait to see what you teach.</p>`,
    }),
    text: `Congratulations ${opts.name}! Your ForgeX Academy tutor application has been approved. Sign in at ${opts.loginUrl} to start building your courses.`,
  };
}

export function tutorRejectedEmail(opts: {
  name: string;
  reason?: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: "Update on your ForgeX Academy tutor application",
    html: layout({
      heading: `Hi ${escapeHtml(opts.name)},`,
      bodyHtml: `
        <p>Thank you for applying to teach on ForgeX Academy. After careful review, we're unable to approve your application at this time.</p>
        ${opts.reason ? infoBox([["Reviewer note", escapeHtml(opts.reason)]]) : ""}
        <p>You're still welcome to learn with us — and you can apply again in the future.</p>`,
    }),
    text: `Hi ${opts.name}, after careful review we're unable to approve your tutor application at this time.${opts.reason ? ` Note: ${opts.reason}` : ""}`,   
  };
}

export function tutorInfoRequiredEmail(opts: {
  name: string;
  request: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: "Action needed: more information on your tutor application",
    html: layout({
      heading: "We need a little more from you",
      bodyHtml: `
        <p>Hi ${escapeHtml(opts.name)}, your tutor application is on hold until we receive the following:</p>
        ${infoBox([["Information required", escapeHtml(opts.request)]])}
        <p>Sign in and update your application — review resumes as soon as you submit.</p>`,
    }),
    text: `Hi ${opts.name}, we need more information on your ForgeX tutor application: ${opts.request}`,
  };
}

export function inactivityReminderEmail(opts: {
  name: string;
  courseTitle: string;
  progress: number;
  continueUrl: string;
  inactiveDays: number;
}): { subject: string; html: string; text: string } {
  const nudge =
    opts.inactiveDays >= 14
      ? "Your learning streak is waiting — pick up right where you left off."
      : opts.inactiveDays >= 7
        ? "You're closer than you think. One lesson today keeps the momentum alive."
        : "A quick lesson today keeps everything fresh.";
  return {
    subject:
      opts.inactiveDays >= 7
        ? `Don't stop now — "${opts.courseTitle}" is waiting`
        : `Continue where you left off: ${opts.courseTitle}`,
    html: layout({
      heading: `Hi ${escapeHtml(opts.name)}, ready to continue?`,
      bodyHtml: `
        <p>You've made great progress in this course:</p>
        ${infoBox([
          ["Course", escapeHtml(opts.courseTitle)],
          ["Progress", `<span style="color:${BRAND.lime};">${Math.round(opts.progress)}%</span> complete`],
          ["Last activity", `${opts.inactiveDays} day${opts.inactiveDays === 1 ? "" : "s"} ago`],
        ])}
        <div style="background:#1a1e12;border-radius:8px;height:12px;overflow:hidden;margin:4px 0 16px;"><div style="height:100%;width:${Math.min(100, Math.max(2, Math.round(opts.progress)))}%;background:${BRAND.lime};"></div></div>
        <p>${nudge}</p>
        ${limeButton("Continue Learning", opts.continueUrl)}`,
    }),
    text: `Hi ${opts.name}, you're ${Math.round(opts.progress)}% through "${opts.courseTitle}". Continue learning: ${opts.continueUrl}`,
  };
}

export function teamAssignedEmail(opts: {
  name: string;
  role: string;
  removed?: boolean;
}): { subject: string; html: string; text: string } {
  return {
    subject: opts.removed
      ? "Your ForgeX team role has been updated"
      : `You've been assigned to the ${opts.role} team`,
    html: layout({
      heading: opts.removed ? "Team role updated" : "Welcome to the team! 🤝",
      bodyHtml: opts.removed
        ? `<p>Hi ${escapeHtml(opts.name)}, your ForgeX team role has been removed. If you think this is a mistake, contact an administrator.</p>`
        : `<p>Hi ${escapeHtml(opts.name)}, you've been added to the <strong style="color:${BRAND.lime};">${escapeHtml(opts.role)}</strong> team on ForgeX Academy.</p><p>Sign in to see your team dashboard, tickets and tools.</p>${limeButton("Open ForgeX Academy", "https://forgex.academy/dashboard")}`,
    }),
    text: opts.removed
      ? `Hi ${opts.name}, your ForgeX team role has been removed.`
      : `Hi ${opts.name}, you've been assigned to the ${opts.role} team on ForgeX Academy.`,
  };
}

/** Generic alert used for all staff/admin notifications (new ticket,
 *  escalation, pending tutor/course review, critical error). */
export function staffAlertEmail(opts: {
  title: string;
  rows: [string, string][];
  ctaLabel?: string;
  ctaUrl?: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: opts.title,
    html: layout({
      heading: opts.title,
      bodyHtml: `
        ${infoBox(opts.rows)}
        ${opts.ctaLabel && opts.ctaUrl ? limeButton(opts.ctaLabel, opts.ctaUrl) : ""}`,
      footerNote: "Automated ForgeX Academy staff notification.",
    }),
    text: `${opts.title}\n${opts.rows.map(([k, v2]) => `${k}: ${v2}`).join("\n")}${opts.ctaUrl ? `\n${opts.ctaLabel ?? "Open"}: ${opts.ctaUrl}` : ""}`,
  };
}

export function tutorNewEnrollmentEmail(opts: {
  tutorName: string;
  studentName: string;
  courseTitle: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `New student enrolled in "${opts.courseTitle}"`,
    html: layout({
      heading: "A new student just joined your course 🎓",
      bodyHtml: `
        <p>Hi ${escapeHtml(opts.tutorName)},</p>
        ${infoBox([
          ["Student", escapeHtml(opts.studentName)],
          ["Course", escapeHtml(opts.courseTitle)],
        ])}
        <p>Say hello in the course community when you get a chance — early engagement makes a big difference.</p>`,
    }),
    text: `Hi ${opts.tutorName}, ${opts.studentName} enrolled in "${opts.courseTitle}".`,
  };
}

export function tutorSubmissionEmail(opts: {
  tutorName: string;
  studentName: string;
  assignmentTitle: string;
  courseTitle: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `Assignment submitted: "${opts.assignmentTitle}" needs review`,
    html: layout({
      heading: "New assignment submission 📥",
      bodyHtml: `
        <p>Hi ${escapeHtml(opts.tutorName)}, a student submitted work that's waiting for your review:</p>
        ${infoBox([
          ["Student", escapeHtml(opts.studentName)],
          ["Assignment", escapeHtml(opts.assignmentTitle)],
          ["Course", escapeHtml(opts.courseTitle)],
        ])}
        ${limeButton("Review submission", "https://forgex.academy/tutor")}`,
    }),
    text: `Hi ${opts.tutorName}, ${opts.studentName} submitted "${opts.assignmentTitle}" (${opts.courseTitle}). Review it in your tutor dashboard.`,
  };
}

export function courseDecisionEmail(opts: {
  tutorName: string;
  courseTitle: string;
  approved: boolean;
  note?: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: opts.approved
      ? `✅ Course approved: "${opts.courseTitle}" is live`
      : `Changes needed: "${opts.courseTitle}" was not approved`,
    html: layout({
      heading: opts.approved ? "Your course is live! 🚀" : "Your course needs changes",
      bodyHtml: opts.approved
        ? `<p>Great news, ${escapeHtml(opts.tutorName)} — <strong>"${escapeHtml(opts.courseTitle)}"</strong> passed review and is now published on ForgeX Academy.</p>${limeButton("View your course", "https://forgex.academy/tutor/courses")}`
        : `<p>Hi ${escapeHtml(opts.tutorName)}, <strong>"${escapeHtml(opts.courseTitle)}"</strong> was not approved in its current form.</p>${opts.note ? infoBox([["Reviewer feedback", escapeHtml(opts.note)]]) : ""}<p>Update the course and resubmit it for review whenever you're ready.</p>`,
    }),
    text: opts.approved
      ? `Congratulations ${opts.tutorName}! "${opts.courseTitle}" is approved and live.`
      : `Hi ${opts.tutorName}, "${opts.courseTitle}" needs changes before approval.${opts.note ? ` Feedback: ${opts.note}` : ""}`,
  };
}

export function tutorInactivityEmail(opts: {
  name: string;
  days: number;
}): { subject: string; html: string; text: string } {
  return {
    subject: "We miss you on ForgeX Academy",
    html: layout({
      heading: `It's been a while, ${escapeHtml(opts.name)}`, 
      bodyHtml: `
        <p>Your last sign-in was <strong>${opts.days} days ago</strong>. Your students and courses are waiting.</p>
        <p>Even a short check-in — answering questions or reviewing submissions — keeps your courses thriving.</p>
        ${limeButton("Return to your Tutor Dashboard", "https://forgex.academy/tutor")}`,
    }),
    text: `Hi ${opts.name}, it's been ${opts.days} days since your last sign-in. Your ForgeX students are waiting!`,
  };
}

export function adminSummaryEmail(opts: {
  periodLabel: string;
  stats: [string, string | number][];
}): { subject: string; html: string; text: string } {
  return {
    subject: `ForgeX ${opts.periodLabel} activity summary`,
    html: layout({
      heading: `${opts.periodLabel} at a glance 📊`,
      bodyHtml: infoBox(opts.stats.map(([k, v2]) => [k, String(v2)])),
      footerNote: "Automated daily summary — configure frequency in the Email Center.",
    }),
    text: `ForgeX ${opts.periodLabel} summary: ${opts.stats.map(([k, v2]) => `${k}: ${v2}`).join(" · ")}`,
  };
}
