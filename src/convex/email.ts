import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { vly } from "../lib/vly-integrations";

/**
 * Internal action that sends a transactional email through the VLY email
 * integration (billed via the VLY_INTEGRATION_KEY). Only actions have network
 * access in Convex, so callers schedule this with ctx.scheduler.runAfter.
 */
export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { to, subject, html, text }) => {
    // This action is also used by non-queued transactional flows (messages,
    // contact replies, admin notifications). The queue pause must therefore be
    // enforced at the final send boundary as well as in the queue worker.
    if (await ctx.runQuery(internal.emailData.internalEmailPaused, {})) {
      console.warn("[email] delivery skipped because Academy email is paused");
      return { ok: true, skipped: true, reason: "email_paused" };
    }
    try {
      const result = await vly.email.send({ to, subject, html, text });
      if (result && "ok" in result && result.ok === false) {
        console.warn("[email] send reported failure", result);
      }
      return result ?? null;
    } catch (err) {
      // Never crash the parent mutation because email delivery failed.
      console.error("[email] failed to send:", err);
      return null;
    }
  },
});
