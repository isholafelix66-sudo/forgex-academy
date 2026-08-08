import { action, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireAdminSession, requireUser } from "./lib";

// ---------------------------------------------------------------------------
// Cloudinary — image hosting for the media library and website assets.
//
// Keys (set in the project's Keys tab):
//   CLOUDINARY_CLOUD_NAME      cloud name (public)
//   CLOUDINARY_UPLOAD_PRESET   an UNSIGNED upload preset name (public)
//   CLOUDINARY_API_KEY         API key (server only)
//   CLOUDINARY_API_SECRET      API secret (server only)
//
// Uploads happen directly from the device/browser to Cloudinary using the
// unsigned preset, so users never paste image URLs. Deletion runs server-side
// with the API key/secret so assets can actually be destroyed.
// ---------------------------------------------------------------------------

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? "";
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET ?? "";
const API_KEY = process.env.CLOUDINARY_API_KEY ?? "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? "";

export const CLOUDINARY_CONFIGURED = !!(CLOUD_NAME && UPLOAD_PRESET && API_KEY && API_SECRET);

/** Public config the browser needs to upload directly to Cloudinary. */
export const mediaConfig = query({
  args: {},
  handler: async () => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      return { configured: false as const, cloudName: "", uploadPreset: "" };
    }
    return { configured: true as const, cloudName: CLOUD_NAME, uploadPreset: UPLOAD_PRESET };
  },
});

/** Admin-only: all media library entries, newest first. */
export const mediaList = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const rows = await ctx.db.query("media").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Record an uploaded image into the media library + audit log.
 *
 * Called from the reusable ImageUploader wherever an image is uploaded:
 *   - with `token`  -> password-gated admin session (media page, branding)
 *   - without token -> any signed-in user (tutor/student/profile uploads)
 * Stores Cloudinary metadata (public_id, optimized URL, width, height,
 * format, bytes) — never binary image data.
 */
export const mediaRecord = mutation({
  args: {
    publicId: v.string(),
    secureUrl: v.string(),
    kind: v.string(),
    label: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    format: v.optional(v.string()),
    bytes: v.optional(v.number()),
    alt: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { token, ...data } = args;
    let uploadedBy: Id<"users"> | undefined;
    if (token) {
      await requireAdminSession(ctx, token);
    } else {
      uploadedBy = await requireUser(ctx);
    }
    const id = await ctx.db.insert("media", {
      ...data,
      uploadedBy,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLogs", {
      adminId: undefined,
      tutorId: uploadedBy ?? undefined,
      action: "image-uploaded",
      detail: `Image uploaded (${data.label ?? data.kind}): ${data.publicId}`,
      reason: undefined,
      createdAt: Date.now(),
    });
    return id;
  },
});

/** Admin-only: remove a media row (used after the Cloudinary asset is gone). */
export const deleteMediaRow = mutation({
  args: { id: v.id("media"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.delete(id);
    return true;
  },
});

/** Admin-only: destroy an image on Cloudinary and remove it from the library. */
export const mediaDelete = action({
  args: { id: v.id("media"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    const valid = await ctx.runQuery(internal.users.internalAdminSessionValid, { token });
    if (!valid) throw new Error("Admin session expired or invalid.");

    const rows = await ctx.runQuery(api.cloudinary.mediaList, { token });
    const media = rows.find((m) => m._id === id);
    if (!media) throw new Error("Media not found.");

    if (CLOUD_NAME && API_KEY && API_SECRET) {
      await cloudinaryDestroy(media.publicId);
    }
    await ctx.runMutation(api.cloudinary.deleteMediaRow, { id, token });
    return true;
  },
});

/** Destroy a Cloudinary asset by public id (server-side, basic auth). */
export async function cloudinaryDestroy(publicId: string): Promise<void> {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) return;
  const form = new URLSearchParams({ public_id: publicId });
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${API_KEY}:${API_SECRET}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  );
  if (!res.ok) {
    throw new Error(`Cloudinary destroy failed (${res.status}).`);
  }
}
