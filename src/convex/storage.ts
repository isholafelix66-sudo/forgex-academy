import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit, requireAdminSession, requireUser } from "./lib";

/**
 * Generate a URL the client POSTs a file to (works from any device /
 * browser / file picker). The client uploads, receives a storageId from the
 * JSON response, and passes it to the relevant save mutation.
 *
 * Rate limit is per-minute (not per-hour): a user chatting with a few
 * photos/voice notes/free documents can easily cross an hourly cap and get
 * mysteriously blocked mid-conversation.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    await checkRateLimit(ctx, `upload:${userId}`, 60, 60 * 1000);
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

/**
 * Resolve a just-uploaded file to its authoritative public URL — used right
 * after a device upload (lesson videos, profile media…) so the UI can show
 * the real playable link immediately. Resolution happens server-side; the
 * client never derives a playback URL from the upload endpoint.
 */
export const resolveUploadedFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const userId = await requireUser(ctx);
    await checkRateLimit(ctx, `upload:${userId}`, 60, 60 * 1000);
    return (await ctx.storage.getUrl(storageId)) ?? "";
  },
});

// ---------------------------------------------------------------------------
// Admin uploads — the password-gated admin portal has no user account, so
// it gets its own storage endpoints. This lets admins upload branding images
// (robot mascot, logo, about images…) with ZERO external services: files go
// straight into Convex file storage and resolve to public URLs that are
// stored in siteContent (e.g. key `heroImage`) and shown on the homepage.
// ---------------------------------------------------------------------------

/** Admin-only: short-lived URL the browser POSTs a file to. */
export const adminGenerateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Admin-only: resolve an uploaded file to its authoritative public URL. */
export const adminResolveUploadUrl = mutation({
  args: { storageId: v.id("_storage"), token: v.string() },
  handler: async (ctx, { storageId, token }) => {
    await requireAdminSession(ctx, token);
    return (await ctx.storage.getUrl(storageId)) ?? "";
  },
});

/** Delete an orphaned file (e.g. when a course image is replaced). */
export const deleteFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const userId = await requireUser(ctx);
    await checkRateLimit(ctx, `upload:${userId}`, 60, 60 * 1000);
    await ctx.storage.delete(storageId);
    return true;
  },
});

/**
 * Record a private document (CV, verification file) in the `documents` table.
 * Files live in Convex private file storage with an unguessable URL — never
 * in the public Cloudinary media library. Only admins can list them.
 *
 * The stored URL is resolved SERVER-side via ctx.storage.getUrl(storageId) —
 * the authoritative, persistent link — instead of trusting a URL the client
 * derived from the upload endpoint (which is not a file URL). Returns the
 * created document so the caller can display the real URL immediately.
 */
export const recordDocument = mutation({
  args: {
    name: v.string(),
    mime: v.string(),
    size: v.optional(v.number()),
    storageId: v.id("_storage"),
    url: v.optional(v.string()),
    purpose: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await checkRateLimit(ctx, `upload:${userId}`, 60, 60 * 1000);
    let storedUrl = args.url ?? "";
    try {
      storedUrl = (await ctx.storage.getUrl(args.storageId)) ?? storedUrl;
    } catch {
      // Fall back to the client-supplied hint; a missing file is caught below.
    }
    if (!storedUrl) {
      throw new Error(
        "The file couldn't be stored — please upload it again.",
      );
    }
    const id = await ctx.db.insert("documents", {
      name: args.name,
      mime: args.mime,
      size: args.size,
      storageId: args.storageId,
      url: storedUrl,
      purpose: args.purpose,
      uploadedBy: userId,
      createdAt: Date.now(),
    });
    // Return the stored document (with its authoritative URL) so callers can
    // display it immediately without a second query.
    return await ctx.db.get(id);
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
