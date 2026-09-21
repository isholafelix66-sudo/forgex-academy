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
import type { GenericActionCtx } from "convex/server";
import { internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import axios from "axios";
import nodemailer from "nodemailer";
import { vly } from "../lib/vly-integrations";
import {
  otpEmail,
  passwordResetEmail,
} from "./emailTemplates";

export function smtpConfigured(): boolean {
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && pass);
}

function transport() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  // Accept both naming conventions used in the Keys panel.
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
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
  const addr =
    process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "no-reply@forgex.academy";
  const name = process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || "ForgeX Academy";
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

/**
 * Deliver one message through the platform email integration. This needs no
 * SMTP credentials — VLY_INTEGRATION_KEY is provisioned for every project — so
 * transactional email keeps working on a deployment where SMTP_* keys were
 * never added. Previously that case marked EVERY queued email as failed.
 */
async function sendViaPlatformEmail(msg: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; errorCode?: string }> {
  try {
    const res = await vly.email.send({
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });
    if (!res) return { ok: false, errorCode: "send_failed" };
    if (res.success && res.data?.status !== "failed") return { ok: true };
    console.warn("[email] platform sender reported failure");
    return { ok: false, errorCode: "platform_failed" };
  } catch (err) {
    console.error("[email] platform sender failed:", err);
    return { ok: false, errorCode: "send_failed" };
  }
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

      // SMTP is preferred when configured; the platform integration below is
      // the guaranteed fallback, so a missing/expired SMTP key can never stop
      // the queue from delivering.
      if (smtpConfigured()) {
        try {
          mailer = transport();
        } catch (err) {
          console.warn("[smtp] transport unavailable — falling back to the platform sender:", err);
          mailer = null;
        }
      } else {
        console.warn("[smtp] credentials missing — using the platform email sender");
      }

      let failures = 0;
      for (const item of batch) {
        let res: { ok: boolean; errorCode?: string } = mailer
          ? await sendOne(mailer, item)
          : { ok: false, errorCode: "not_configured" };
        if (!res.ok) {
          // SMTP missing, misconfigured or rejected the message → deliver via
          // the platform integration instead of dropping the email.
          const platform = await sendViaPlatformEmail(item);
          res = platform.ok ? { ok: true } : { ok: false, errorCode: platform.errorCode };
        }
        await ctx.runMutation(internal.emailData.internalMarkResult, {
          id: item.id as never,
          ok: res.ok,
          errorCode: res.errorCode,
          bumpRetry: !res.ok,
        });
        if (!res.ok) {
          failures++;
          if (res.errorCode === "auth_failed") {
            // Don't hammer bad SMTP credentials — drop the pooled connection
            // and let the platform sender carry the rest of this batch.
            try {
              mailer?.close();
            } catch {
              // ignore
            }
            mailer = null;
          }
        }
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
      // No SMTP keys → branded send through the platform email integration,
      // then the platform OTP sender. Without this, security codes silently
      // vanished when SMTP wasn't configured.
      const sent = await sendViaPlatformEmail({ to: args.to, subject: tpl.subject, html: tpl.html });
      if (sent.ok) return { sent: true, fallback: true };
      if (await sendViaPlatformSender(ctx, args)) return { sent: true, fallback: true };
      await ctx.runMutation(internal.emailData.logAuthEmailMeta, {
        to: args.to,
        subject: "[redacted] verification code",
        emailType: args.kind,
        ok: false,
        errorCode: sent.errorCode ?? "not_configured",
      });
      return { sent: false, fallback: true };
    }

    const mailer = transport();
    try {
      const res = await sendOne(mailer, {
        to: args.to,
        subject: tpl.subject,
        html: tpl.html,
      });
      if (!res.ok) {
        // SMTP send failed → platform email integration, then the platform
        // OTP sender, so the code still goes out.
        const platform = await sendViaPlatformEmail({
          to: args.to,
          subject: tpl.subject,
          html: tpl.html,
        });
        if (platform.ok) return { sent: true, fallback: true };
        const sent = await sendViaPlatformSender(ctx, args);
        if (sent) return { sent: true, fallback: true };
      }
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

const PLATFORM_OTP_URL = "https://auth.freebuff.app/send_otp";

/**
 * Last-resort delivery through the platform OTP sender (same endpoint the
 * auth provider uses when the SMTP relay is unavailable). Returns whether
 * the platform accepted the message.
 */
async function sendViaPlatformSender(
  ctx: GenericActionCtx<DataModel>,
  args: { to: string; code: string; kind: string },
): Promise<boolean> {
  try {
    await axios.post(
      PLATFORM_OTP_URL,
      {
        to: args.to,
        otp: args.code,
        appName: process.env.VLY_APP_NAME || "a freebuff.com application",
      },
      {
        headers: {
          // Prefer the env var so the key can be rotated from the Keys tab.
          "x-api-key": process.env.FORGE_OTP_API_KEY ?? "fb_email_2crN1hqIArZP2bEfvjp5Qik4",
        },
        timeout: 20_000,
      },
    );
    await ctx.runMutation(internal.emailData.logAuthEmailMeta, {
      to: args.to,
      subject: "[redacted] verification code",
      emailType: args.kind,
      ok: true,
    });
    return true;
  } catch (err) {
    console.error("[smtp] platform OTP sender failed:", err);
    return false;
  }
}
