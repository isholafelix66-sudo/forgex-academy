import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdminSession } from "./lib";
import type { Id } from "./_generated/dataModel";

/**
 * Mux video records (`mediaVideos`) — kept fully separate from the Cloudinary
 * image library so image records and video records are never mixed.
 *
 * This module must NOT be a Node action file: `recordVideo` is a mutation that
 * runs in the default runtime, while the Mux API calls (createUpload /
 * getPlaybackId) live in `mux.ts` (`"use node"` actions).
 */

/** Track a Mux upload — called when an upload starts and again when ready. */
export const recordVideo = mutation({
  args: {
    uploadId: v.string(),
    title: v.string(),
    status: v.optional(
      v.union(
        v.literal("uploading"),
        v.literal("processing"),
        v.literal("ready"),
      ),
    ),
    assetId: v.optional(v.string()),
    playbackId: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    lessonId: v.optional(v.id("lessons")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let userId: Id<"users"> | null = null;
    if (args.token) {
      // Admin-session preview (password gate, no account).
      await requireAdminSession(ctx, args.token);
    } else {
      userId = await getAuthUserId(ctx);
      if (userId === null) throw new Error("Sign in required.");
      const user = await ctx.db.get(userId);
      if (!user) throw new Error("Account not found.");
      const isTutor = user.role === "tutor" && !!user.verified;
      const isTeamCreator = user.teamRole === "academic" || user.teamRole === "content";
      if (user.role !== "admin" && !isTutor && !isTeamCreator) {
        throw new Error("You do not have permission to upload videos. Admins, verified tutors, and team members with academic or content roles can upload.");
      }
    }

    const existing = await ctx.db
      .query("mediaVideos")
      .withIndex("by_upload", (q) => q.eq("uploadId", args.uploadId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        status: args.status ?? "ready",
        assetId: args.assetId,
        playbackId: args.playbackId,
        courseId: args.courseId,
        lessonId: args.lessonId,
      });
      return existing._id;
    }
    return await ctx.db.insert("mediaVideos", {
      uploadId: args.uploadId,
      title: args.title,
      status: args.status ?? "uploading",
      assetId: args.assetId,
      playbackId: args.playbackId,
      courseId: args.courseId,
      lessonId: args.lessonId,
      uploadedBy: userId ?? undefined,
      createdAt: Date.now(),
    });
  },
});

/**
 * Admin-portal variant of `recordVideo` — gated by the password-issued admin
 * session token, so the password-gated Admin portal can track tutorial-video
 * uploads without a signed-in user account.
 */
export const recordAdminVideo = mutation({
  args: {
    token: v.string(),
    uploadId: v.string(),
    title: v.string(),
    status: v.optional(
      v.union(
        v.literal("uploading"),
        v.literal("processing"),
        v.literal("ready"),
      ),
    ),
    assetId: v.optional(v.string()),
    playbackId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const { token: _token, ...rest } = args;
    const existing = await ctx.db
      .query("mediaVideos")
      .withIndex("by_upload", (q) => q.eq("uploadId", args.uploadId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        status: args.status ?? "ready",
        assetId: args.assetId,
        playbackId: args.playbackId,
      });
      return existing._id;
    }
    return await ctx.db.insert("mediaVideos", {
      ...rest,
      status: args.status ?? "uploading",
      createdAt: Date.now(),
    });
  },
});

/** Admin-only: all Mux videos tracked in the media library, newest first. */
export const videosList = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const rows = await ctx.db.query("mediaVideos").collect();
    const hydrated = await Promise.all(
      rows.map(async (r) => {
        const uploader = r.uploadedBy ? await ctx.db.get(r.uploadedBy) : null;
        const course = r.courseId ? await ctx.db.get(r.courseId) : null;
        return {
          ...r,
          uploaderName: uploader?.name ?? "Unknown",
          courseTitle: course?.title ?? null,
        };
      }),
    );
    return hydrated.sort((a, b) => b.createdAt - a.createdAt);
  },
});
