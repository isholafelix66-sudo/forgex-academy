"use node";

/**
 * Gmail SMTP email service.
 *
 * Credentials come ONLY from environment variables (SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, EMAIL_FROM_NAME, EMAIL_FROM) managed through the
 * project's Keys panel — they are never present in client code or logs.
 *
 * Delivery model:
 *  - Logs are created as "pending" rows by emailData.ts (V8 side).
 *  - This module claims batches and sends them sequentially over one pooled
 *    SMTP connection, then marks each row sent/failed with a SAFE error code
 *    (raw SMTP details go to server logs only).
 *  - A failed batch re-schedules itself with backoff so transient outages
 *    self-heal without blocking any business flow.
 */

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import nodemailer from "nodemailer";
import {
  otpEmail,
  passwordResetEmail,
} from "./emailTemplates";

export function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transport() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) throw new Error("SMTP_NOT_CONFIGURED");

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // Keep the pool small and connections short-lived for serverless.
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

function fromAddress(): string {
  const addr = process.env.EMAIL_FROM || process.env.SMTP_USER || "no-reply@forgex.academy";
  const name = process.env.EMAIL_FROM_NAME || "ForgeX Academy";
  return `"${name.replace(/"/g, "")}" <${addr}>`;
}

/** Map an SMTP failure into a safe, non-technical classification. */
function classifyError(err: unknown): string {
  const msg = err instanceof Error ? `${err.message}` : String(err);
  console.error("[smtp] send failed:", err); // full technical detail → server logs only
  if (/SMTP_NOT_CONFIGURED/.test(msg)) return "not_configured";
  if (/535|534|auth|credentials|EAUTH/i.test(msg)) return "auth_failed";
  if (/rate limit|too many|421/i.test(msg)) return "rate_limited";
  if (/timeout|ETIMEDOUT|ECONN|socket/i.test(msg)) return "network";
  return "send_failed";
}

/** Send one message. Returns ok + safe error code (never raw details). */
async function sendOne(
  mailer: ReturnType<typeof transport>,
  msg: { to: string; subject: string; html: string },
): Promise<{ ok: boolean; errorCode?: string }> {
  try {
    await mailer.sendMail({
      from: fromAddress(),
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, errorCode: classifyError(err) };
  }
}

// ---------------------------------------------------------------------------
// Batch processor — drains pending logs
// ---------------------------------------------------------------------------

export const processPendingBatch = internalAction({
  args: {},
  handler: async (ctx) => {
    let mailer: ReturnType<typeof transport> | null = null;
    try {
      const batch = await ctx.runMutation(internal.emailData.internalClaimBatch, {});
      if (batch.length === 0) return;

      if (!smtpConfigured()) {
        console.warn("[smtp] credentials missing — emails stay pending until keys are added");
        for (const item of batch) {
          await ctx.runMutation(internal.emailData.internalMarkResult, {
            id: item.id as never,
            ok: false,
            errorCode: "not_configured",
          });
        }
        return;
      }

      mailer = transport();
      let failures = 0;
      for (const item of batch) {
        const res = await sendOne(mailer, item);
        await ctx.runMutation(internal.emailData.internalMarkResult, {
          id: item.id as never,
          ok: res.ok,
          errorCode: res.errorCode,
          bumpRetry: !res.ok,
        });
        if (!res.ok && res.errorCode === "auth_failed") break; // don't hammer bad creds
        if (!res.ok) failures++;
      }

      // More waiting? Schedule the next drain (self-healing queue).
      const next = await ctx.runMutation(internal.emailData.internalClaimBatch, {});
      if (next.length > 0) {
        await ctx.scheduler.runAfter(failures > 0 ? 30_000 : 2_000, internal.emailService.processPendingBatch, {});
      }
    } catch (err) {
      console.error("[smtp] batch processor error:", err);
      await ctx.scheduler.runAfter(60_000, internal.emailService.processPendingBatch, {});
    } finally {
      try {
        mailer?.close();
      } catch {
        // ignore
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Authentication OTP / password reset — called via the internal HTTP endpoint
// because @convex-dev/auth's sendVerificationRequest runs in the V8 runtime
// where sockets are unavailable. The endpoint authenticates with a shared
// internal key and constructs the email content itself.
// ---------------------------------------------------------------------------

export const sendAuthCodeEmail = internalAction({
  args: {
    to: v.string(),
    code: v.string(),
    kind: v.union(v.literal("otp"), v.literal("password_reset")),
  },
  handler: async (ctx, args) => {
    const expiryMinutes = 15;
    const tpl =
      args.kind === "otp"
        ? otpEmail({ code: args.code, expiryMinutes })
        : passwordResetEmail({ code: args.code, expiryMinutes });

    if (!smtpConfigured()) {
      console.warn("[smtp] not configured — falling back to platform OTP sender");
      return { sent: false, fallback: true };
    }

    const mailer = transport();
    try {
      const res = await sendOne(mailer, {
        to: args.to,
        subject: tpl.subject,
        html: tpl.html,
      });
      // Log metadata only — the code itself is NEVER persisted.
      await ctx.runMutation(internal.emailData.logAuthEmailMeta, {
        to: args.to,
        subject: "[redacted] verification code",
        emailType: args.kind,
        ok: res.ok,
        errorCode: res.errorCode,
      });
      return { sent: res.ok, fallback: false };
    } finally {
      try {
        mailer.close();
      } catch {
        // ignore
      }
    }
  },
});
