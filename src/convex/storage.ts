import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib";

/**
 * Generate a URL the client can PUT a file to (works from any device /
 * browser / file picker). The client uploads, receives a storageId, and
 * passes it to the relevant save mutation.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
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
    await requireUser(ctx);
    await ctx.storage.delete(storageId);
    return true;
  },
});
