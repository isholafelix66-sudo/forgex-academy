"use node";

/**
 * ForgeX Network PORTFOLIO — SMTP transport (Node action).
 *
 * The ONLY place nodemailer is used for the Portfolio. Sends queued log
 * messages on behalf of `portfolioEmailLog` and the admin SMTP test button.
 * Uses ONLY the Portfolio SMTP credentials stored in `portfolioSettings`
 * (managed at /adminbrand → Email) — never the Academy mail configuration.
 */

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import nodemailer from "nodemailer";
import { vly } from "../lib/vly-integrations";

type SmtpConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  secure: boolean;
};

function buildTransport(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure || cfg.port === 465,
    auth: { user: cfg.username, pass: cfg.password },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export function fromHeader(cfg: SmtpConfig): string {
  const name = cfg.fromName?.trim() || "ForgeX Network Portfolio";
  const email = cfg.fromEmail?.trim() || cfg.username;
  return `${name} <${email}>`;
}

/**
 * Platform email fallback.
 *
 * Uses the project's provisioned platform email integration — no SMTP keys
 * required — so Portfolio mail (OTP codes included) still reaches people on a
 * deployment where the Portfolio SMTP account was never configured or is
 * temporarily rejecting mail. This is the same fallback the Academy mailer
 * uses, and it carries Portfolio content only.
 */
async function sendViaPlatform(msg: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await vly.email.send({
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });
    if (res && res.success && res.data?.status !== "failed") return { ok: true };
    return { ok: false, error: "Platform email sender reported a failure." };
  } catch (err) {
    console.error("[portfolio-email] platform sender failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Platform send failed.",
    };
  }
}

/**
 * Send one queued message from `portfolioEmailLogs` and record the outcome.
 * Called by the scheduler after `portfolioEmailLog.attemptSend` checks the
 * queue row and the SMTP config.
 *
 * Order of attempts: the Portfolio SMTP account (when configured), then the
 * platform email fallback. A failure is only recorded once BOTH have failed,
 * so a missing or unhealthy SMTP account can no longer stop delivery.
 */
export const sendQueued = internalAction({
  args: {
    logId: v.id("portfolioEmailLogs"),
    smtp: v.optional(
      v.object({
        host: v.string(),
        port: v.number(),
        username: v.string(),
        password: v.string(),
        fromEmail: v.string(),
        fromName: v.string(),
        secure: v.boolean(),
      }),
    ),
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  handler: async (ctx, { logId, smtp, to, subject, html }) => {
    let error: string | undefined;

    if (smtp?.host && smtp.username && smtp.password) {
      const transport = buildTransport(smtp);
      try {
        await transport.sendMail({ from: fromHeader(smtp), to, subject, html });
        await ctx.runMutation(internal.portfolioEmailLog.recordOutcome, {
          logId,
          ok: true,
        });
        return { ok: true, via: "smtp" as const };
      } catch (err) {
        error = err instanceof Error ? err.message : "Send failed.";
        console.error("[portfolio-email] SMTP send failed — trying the platform sender:", err);
      } finally {
        transport.close();
      }
    } else {
      console.warn("[portfolio-email] SMTP not configured — using the platform sender");
    }

    const platform = await sendViaPlatform({ to, subject, html });
    await ctx.runMutation(internal.portfolioEmailLog.recordOutcome, {
      logId,
      ok: platform.ok,
      error: platform.ok ? undefined : (platform.error ?? error),
    });
    return { ok: platform.ok, via: platform.ok ? ("platform" as const) : ("none" as const) };
  },
});

/** Admin-portal "Send test email" — verifies the Portfolio SMTP settings. */
export const sendTestEmail = action({
  args: { token: v.string(), to: v.string() },
  handler: async (ctx, { token, to }) => {
    const address = to.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
      throw new Error("Enter a valid email address to send the test to.");
    }

    const settings = await ctx.runQuery(
      internal.portfolioAdmin.settingsByToken,
      { token },
    );
    const smtp = settings?.smtp ?? null;

    const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0d08;color:#f2f6ec;padding:32px;border-radius:16px">
          <h2 style="margin:0 0 12px;font-size:20px">Your Portfolio email is working ✅</h2>
          <p style="margin:0 0 12px;line-height:1.6;color:#c9d1c2">
            This test proves Portfolio email delivery is working. Portfolio OTP
            codes, creator notifications and admin messages will be delivered.
          </p>
          <p style="margin:0;font-size:13px;color:#8b977f">
            ${smtp?.host ? `Sent via ${smtp.host}:${smtp.port} — the Portfolio's own email account.` : "Sent through the platform email fallback (no SMTP account configured yet)."}
          </p>
        </div>`;

    // No SMTP account yet? Prove the fallback path works instead of failing.
    if (!smtp || !smtp.host || !smtp.username || !smtp.password) {
      const platform = await sendViaPlatform({
        to: address,
        subject: "ForgeX Network Portfolio — email test",
        html,
      });
      if (!platform.ok) {
        throw new Error(
          platform.error ??
            "Neither your SMTP account nor the platform fallback could deliver — check the address and try again.",
        );
      }
      return { ok: true, to: address, via: "platform" as const };
    }

    const transport = buildTransport(smtp);
    try {
      await transport.sendMail({
        from: fromHeader(smtp),
        to: address,
        subject: "ForgeX Network Portfolio — SMTP test",
        text:
          "Your ForgeX Network Portfolio email settings are working.\n\n" +
          "This message was sent with the Portfolio's own SMTP configuration.",
        html,
      });
      return { ok: true, to: address, via: "smtp" as const };
    } catch (err) {
      // SMTP rejected the send — fall back rather than leaving the admin stuck.
      const platform = await sendViaPlatform({
        to: address,
        subject: "ForgeX Network Portfolio — email test",
        html,
      });
      if (!platform.ok) {
        throw new Error(
          `SMTP said: ${err instanceof Error ? err.message : "send failed"}. The platform fallback also failed.`,
        );
      }
      return { ok: true, to: address, via: "platform" as const };
    } finally {
      transport.close();
    }
  },
});
