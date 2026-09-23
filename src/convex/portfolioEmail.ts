"use node";

/**
 * ForgeX Network PORTFOLIO — email transport.
 *
 * Uses ONLY the Portfolio SMTP credentials stored in `portfolioSettings`
 * (managed at /adminbrand → Email / SMTP). It never reads the Academy mail
 * environment variables, so the two products' email configuration and
 * deliverability can never conflict.
 *
 * Every Portfolio email is sent through `sendPortfolioMail`, so the
 * authentication emails (verification, password reset) and notification
 * emails all share this one Portfolio-owned transport.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
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
 * Send one Portfolio email. Called by the SMTP test button and by any future
 * Portfolio auth/notification flow.
 */
export async function deliverPortfolioMail(
  cfg: SmtpConfig,
  message: { to: string; subject: string; html: string; text?: string },
): Promise<void> {
  const transport = buildTransport(cfg);
  try {
    await transport.sendMail({
      from: fromHeader(cfg),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  } finally {
    transport.close();
  }
}

/** Admin-portal "Send test email" — verifies the Portfolio SMTP settings. */
export const sendTestEmail = action({
  args: { token: v.string(), to: v.string() },
  handler: async (ctx, { token, to }) => {
    const address = to.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      throw new Error("Enter a valid email address to send the test to.");
    }

    const smtp: SmtpConfig | null = await ctx.runQuery(
      internal.portfolioAdmin.smtpForToken,
      { token },
    );
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

    await deliverPortfolioMail(smtp, {
      to: address,
      subject: "ForgeX Network Portfolio — SMTP test",
      text:
        "Your ForgeX Network Portfolio email settings are working.\n\n" +
        "This message was sent with the Portfolio's own SMTP configuration, " +
        "which is separate from Academy email.",
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0d08;color:#f2f6ec;padding:32px;border-radius:16px">
          <h2 style="margin:0 0 12px;font-size:20px">Your Portfolio email is working ✅</h2>
          <p style="margin:0 0 12px;line-height:1.6;color:#c9d1c2">
            This test proves the <strong>Portfolio</strong> SMTP configuration is
            correct. Portfolio authentication emails, password resets and
            notifications will be delivered through this account.
          </p>
          <p style="margin:0;font-size:13px;color:#8b977f">
            Sent via ${smtp.host}:${smtp.port} — separate from Academy email.
          </p>
        </div>`,
    });

    return { ok: true, to: address };
  },
});
