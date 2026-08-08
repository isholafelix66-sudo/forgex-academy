import { internalAction } from "./_generated/server";
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
  handler: async (_ctx, { to, subject, html, text }) => {
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
