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
 * Send one queued message from `portfolioEmailLogs` and record the outcome.
 * Called by the scheduler after `portfolioEmailLog.attemptSend` checks the
 * queue row and SMTP config.
 */
export const sendQueued = internalAction({
  args: {
    logId: v.id("portfolioEmailLogs"),
    smtp: v.object({
      host: v.string(),
      port: v.number(),
      username: v.string(),
      password: v.string(),
      fromEmail: v.string(),
      fromName: v.string(),
      secure: v.boolean(),
    }),
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  handler: async (ctx, { logId, smtp, to, subject, html }) => {
    const transport = buildTransport(smtp);
    try {
      await transport.sendMail({
        from: fromHeader(smtp),
        to,
        subject,
        html,
      });
      await ctx.runMutation(internal.portfolioEmailLog.recordOutcome, {
        logId,
        ok: true,
      });
    } catch (err) {
      await ctx.runMutation(internal.portfolioEmailLog.recordOutcome, {
        logId,
        ok: false,
        error: err instanceof Error ? err.message : "Send failed.",
      });
    } finally {
      transport.close();
    }
    return { ok: true };
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
    if (!smtp) {
      throw new Error(
        "Sign in to the Portfolio admin portal and save your SMTP settings first.",
      );
    }
    if (!smtp.host || !smtp.username || !smtp.password) {
      throw new Error(
        "Portfolio SMTP is incomplete — add the host, username and password, then save.",
      );
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
        html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0d08;color:#f2f6ec;padding:32px;border-radius:16px">
          <h2 style="margin:0 0 12px;font-size:20px">Your Portfolio email is working ✅</h2>
          <p style="margin:0 0 12px;line-height:1.6;color:#c9d1c2">
            This test proves the <strong>Portfolio</strong> SMTP configuration is
            correct. Portfolio OTP codes, creator notifications and admin
            messages will be delivered through this account.
          </p>
          <p style="margin:0;font-size:13px;color:#8b977f">
            Sent via ${smtp.host}:${smtp.port} — the Portfolio's own email account.
          </p>
        </div>`,
      });
    } finally {
      transport.close();
    }

    return { ok: true, to: address };
  },
});
