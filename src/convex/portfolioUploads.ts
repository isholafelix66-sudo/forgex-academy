import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requirePortfolioAdminSession } from "./portfolioAdmin";
import {
  getPortfolioUser,
  requirePortfolioUser,
} from "./portfolioUsers";
import { checkRateLimit } from "./lib";

/* ═══════════════════════════════════════════════════════════════════════════
   PORTFOLIO UPLOADS — device uploads for Portfolio-owned media.

   Creators and the Portfolio admin both live OUTSIDE Academy authentication,
   so they cannot use the Academy upload endpoints. These mirror the Academy
   endpoints (generate a one-time URL → POST the bytes → resolve the public
   URL server-side) against Portfolio sessions only.

   Cloudinary is preferred when configured (the browser uploads straight to
   Cloudinary); Convex file storage is the always-available fallback, so an
   upload can never fail just because an external key is missing.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Creator: one-time upload URL for a profile photo, cover or project media. */
export const creatorUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getPortfolioUser(ctx, token);
    if (!user) throw new Error("Sign in to your Portfolio account to upload.");
    await checkRateLimit(ctx, `pf-upload:${user._id}`, 60, 60 * 1000);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Creator: authoritative public URL for a freshly uploaded file. */
export const creatorResolveUrl = mutation({
  args: { token: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { token, storageId }) => {
    await requirePortfolioUser(ctx, token);
    return (await ctx.storage.getUrl(storageId)) ?? "";
  },
});

/** Portfolio admin: one-time upload URL (branding art, slideshow images…). */
export const adminUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requirePortfolioAdminSession(ctx, token);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Portfolio admin: authoritative public URL for a freshly uploaded file. */
export const adminResolveUrl = mutation({
  args: { token: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { token, storageId }) => {
    await requirePortfolioAdminSession(ctx, token);
    return (await ctx.storage.getUrl(storageId)) ?? "";
  },
});
