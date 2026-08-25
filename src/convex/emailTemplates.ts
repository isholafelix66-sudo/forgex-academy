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
            <td align="right" style="font-size:11px;color:${BRAND.muted};">Learn. Build. Succeed.</td>
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
