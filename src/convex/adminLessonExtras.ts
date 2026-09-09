import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminSession } from "./lib";
import { recomputeCourseDuration } from "./lmsShared";
import { audit } from "./admin";

// ---------------------------------------------------------------------------
// Admin lesson extras — real video duration + lesson resources (PDFs etc.).
//
// These live in their own module so admin.ts stays small; every endpoint is
// guarded by the admin-session token on the backend, never just hidden in
// the UI. Students only ever READ resources through learn.lessonResources.
// ---------------------------------------------------------------------------

/**
 * Persist the REAL duration of a lesson's video, as detected by the admin
 * editor (YouTube IFrame API once the player loads) or by real playback.
 * The stored `videoDurationSeconds` is the authoritative lesson length and
 * the course total is recomputed from it. Pass 0 to clear a stale value.
 */
export const adminSetLessonVideoDuration = mutation({
  args: {
    lessonId: v.id("lessons"),
    token: v.string(),
    durationSeconds: v.number(),
  },
  handler: async (ctx, { lessonId, token, durationSeconds }) => {
    await requireAdminSession(ctx, token);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) throw new Error("Lesson not found.");
    const rounded = Math.max(0, Math.round(durationSeconds));
    const next = rounded > 0 ? rounded : undefined;
    if ((lesson.videoDurationSeconds ?? 0) !== (next ?? 0)) {
      await ctx.db.patch(lessonId, { videoDurationSeconds: next });
    }
    const courseDurationHours = await recomputeCourseDuration(ctx, lesson.courseId);
    await audit(ctx, undefined, undefined, "lesson-duration-set", `Lesson duration set: ${rounded}s`);
    return { videoDurationSeconds: next ?? 0, courseDurationHours };
  },
});

/**
 * Recompute a course's total duration from its lessons' real durations —
 * used after manual lesson edits/deletes so the catalog total stays exact
 * without anyone typing a course-level number.
 */
export const adminRecomputeCourseDuration = mutation({
  args: {
    courseId: v.id("courses"),
    token: v.string(),
  },
  handler: async (ctx, { courseId, token }) => {
    await requireAdminSession(ctx, token);
    const courseDurationHours = await recomputeCourseDuration(ctx, courseId);
    return { courseDurationHours };
  },
});

export const adminAddLessonResource = mutation({
  args: {
    lessonId: v.id("lessons"),
    token: v.string(),
    name: v.string(),
    url: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    kind: v.optional(v.union(v.literal("file"), v.literal("link"))),
    fileType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
  },
  handler: async (ctx, { lessonId, token, name, url, storageId, kind, fileType, fileSize }) => {
    await requireAdminSession(ctx, token);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) throw new Error("Lesson not found.");
    if (!storageId && !url) throw new Error("A resource needs either an uploaded file or a link.");
    const resource = {
      name,
      url: url ?? "",
      storageId: storageId ?? undefined,
      kind: kind ?? (storageId ? "file" : "link"),
      fileType: fileType ?? undefined,
      fileSize: fileSize ?? undefined,
      uploadedBy: undefined,
      createdAt: Date.now(),
    } as typeof lesson.resources[number];
    await ctx.db.patch(lessonId, { resources: [...lesson.resources, resource] });
    await audit(ctx, undefined, undefined, "lesson-resource-added", `Resource added: ${name}`);
    return lesson.resources.length;
  },
});

export const adminDeleteLessonResource = mutation({
  args: {
    lessonId: v.id("lessons"),
    token: v.string(),
    index: v.number(),
  },
  handler: async (ctx, { lessonId, token, index }) => {
    await requireAdminSession(ctx, token);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) throw new Error("Lesson not found.");
    const target = lesson.resources[index];
    if (!target) return false;
    const next = lesson.resources.filter((_, i) => i !== index);
    await ctx.db.patch(lessonId, { resources: next });
    // Remove the file from storage too — the record and the bytes stay in sync.
    if (target.storageId) {
      try {
        await ctx.storage.delete(target.storageId);
      } catch {
        // Already gone — the record is removed regardless.
      }
    }
    await audit(ctx, undefined, undefined, "lesson-resource-deleted", `Resource removed: ${target.name}`);
    return true;
  },
});

export const adminReplaceLessonResource = mutation({
  args: {
    lessonId: v.id("lessons"),
    token: v.string(),
    index: v.number(),
    name: v.string(),
    url: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    kind: v.optional(v.union(v.literal("file"), v.literal("link"))),
    fileType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
  },
  handler: async (ctx, { lessonId, token, index, name, url, storageId, kind, fileType, fileSize }) => {
    await requireAdminSession(ctx, token);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) throw new Error("Lesson not found.");
    const target = lesson.resources[index];
    if (!target) throw new Error("Resource not found.");
    const replacement = {
      name,
      url: url ?? "",
      storageId: storageId ?? undefined,
      kind: kind ?? (storageId ? "file" : "link"),
      fileType: fileType ?? undefined,
      fileSize: fileSize ?? undefined,
      uploadedBy: undefined,
      createdAt: Date.now(),
    } as typeof lesson.resources[number];
    const next = [...lesson.resources];
    next[index] = replacement;
    await ctx.db.patch(lessonId, { resources: next });
    // The old file is no longer referenced — clean it up.
    if (target.storageId && target.storageId !== storageId) {
      try {
        await ctx.storage.delete(target.storageId);
      } catch {
        // Already gone.
      }
    }
    await audit(ctx, undefined, undefined, "lesson-resource-replaced", `Resource replaced: ${name}`);
    return true;
  },
});