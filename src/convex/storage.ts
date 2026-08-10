import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit, requireAdminSession, requireUser } from "./lib";

/**
 * Generate a URL the client can PUT a file to (works from any device /
 * browser / file picker). The client uploads, receives a storageId, and
 * passes it to the relevant save mutation.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    await checkRateLimit(ctx, `upload:${userId}`, 40, 60 * 60 * 1000);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Resolve one storage id to its public URL (only stored internally). */
export const getStorageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

/** Delete an orphaned file (e.g. when a course image is replaced). */
export const deleteFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const userId = await requireUser(ctx);
    await checkRateLimit(ctx, `upload:${userId}`, 40, 60 * 60 * 1000);
    await ctx.storage.delete(storageId);
    return true;
  },
});

/**
 * Record a private document (CV, verification file) in the `documents` table.
 * Files live in Convex private file storage with an unguessable URL — never
 * in the public Cloudinary media library. Only admins can list them.
 */
export const recordDocument = mutation({
  args: {
    name: v.string(),
    mime: v.string(),
    size: v.optional(v.number()),
    storageId: v.id("_storage"),
    url: v.string(),
    purpose: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await checkRateLimit(ctx, `upload:${userId}`, 40, 60 * 60 * 1000);
    return await ctx.db.insert("documents", {
      ...args,
      uploadedBy: userId,
      createdAt: Date.now(),
    });
  },
});

/** Admin-only: private documents (CVs, verification files) in the media library. */
export const documentsList = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const rows = await ctx.db.query("documents").collect();
    const hydrated = await Promise.all(
      rows.map(async (r) => {
        const uploader = await ctx.db.get(r.uploadedBy);
        return {
          ...r,
          uploaderName: uploader?.name ?? "Unknown",
        };
      }),
    );
    return hydrated.sort((a, b) => b.createdAt - a.createdAt);
  },
});
