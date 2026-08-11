import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { checkRateLimit, requireAdminSession } from "./lib";

// ---------------------------------------------------------------------------
// Student stories — "Share Your ForgeX Story"
//
// Security model (enforced server-side, never in the client):
//   • submitStory      → any visitor; ALWAYS creates a `pending` story with
//                        featured:false. No role can skip moderation.
//   • approvedStories / featuredStories → read-only public queries; only
//                        `approved` rows are ever returned (featured returns
//                        approved AND featured rows only).
//   • Every admin action (review / edit / delete / feature) requires a valid
//     admin session token — students have no path to approve, feature,
//     delete or edit anyone's story.
// ---------------------------------------------------------------------------

const NAME_MAX = 120;
const COURSE_MAX = 120;
const STORY_MIN = 30;
const STORY_MAX = 4000;

function validateContent(args: { name: string; course: string; story: string }) {
  const name = args.name.trim().slice(0, NAME_MAX);
  const course = args.course.trim().slice(0, COURSE_MAX);
  const story = args.story.trim().slice(0, STORY_MAX);
  if (name.length < 2) {
    throw new Error("Please tell us your name.");
  }
  if (course.length < 2) {
    throw new Error("Please tell us the course or program you did at ForgeX.");
  }
  if (story.length < STORY_MIN) {
    throw new Error(
      `Please share a little more — your story needs at least ${STORY_MIN} characters so it can inspire others.`,
    );
  }
  return { name, course, story };
}

/** Resolve a stored photo to a fresh, usable URL. Falls back to the stored
 *  URL when resolution fails so expired links degrade gracefully. */
async function resolvePhoto(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage"> | undefined,
  storedUrl: string | undefined,
): Promise<string | null> {
  if (!storageId) return storedUrl ?? null;
  try {
    const url = await ctx.storage.getUrl(storageId);
    return url ?? storedUrl ?? null;
  } catch {
    return storedUrl ?? null;
  }
}

/** Public upload URL for story photos — works signed-out (the public form
 *  shouldn't require an account just to attach a photo). The storage POST is
 *  inherently capability-based (the URL is the credential), so the only guard
 *  needed is rate limiting against abuse. */
export const generateStoryUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await checkRateLimit(
      ctx,
      "story-upload:global",
      60,
      60 * 1000,
      "Too many uploads are happening right now — please try again in a minute.",
    );
    return await ctx.storage.generateUploadUrl();
  },
});

/** Public submission — always starts as `pending` and never appears publicly
 *  until an admin approves it. Signed-in submitters are linked to their
 *  account so admins can see who wrote what; signed-out visitors can still
 *  share (rate-limited). */
export const submitStory = mutation({
  args: {
    name: v.string(),
    course: v.string(),
    story: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { name, course, story } = validateContent(args);

    const userId = await getAuthUserId(ctx);
    // Spam guards: per-person (when signed in) + global ceiling so a single
    // script can't flood the moderation queue.
    if (userId !== null) {
      await checkRateLimit(
        ctx,
        `story:${userId}`,
        3,
        24 * 60 * 60 * 1000,
        "You've already shared a few stories today — come back tomorrow to share more.",
      );
    }
    await checkRateLimit(
      ctx,
      "story:global",
      40,
      60 * 60 * 1000,
      "Too many stories are being shared right now — please try again in a little while.",
    );

    let photoUrl: string | undefined;
    if (args.photoStorageId) {
      // Resolve the authoritative URL server-side — never trust the client.
      photoUrl = (await ctx.storage.getUrl(args.photoStorageId)) ?? undefined;
    }

    const id = await ctx.db.insert("studentStories", {
      userId: userId ?? undefined,
      name,
      course,
      story,
      photoStorageId: args.photoStorageId,
      photoUrl,
      status: "pending",
      featured: false,
      createdAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

/** Approved stories for the public page — featured first, then newest. Only
 *  `approved` rows are ever returned. */
export const approvedStories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("studentStories")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const hydrated = await Promise.all(
      rows.map(async (s) => ({
        ...s,
        photoUrl: await resolvePhoto(ctx, s.photoStorageId, s.photoUrl),
      })),
    );
    return hydrated.sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) || b.createdAt - a.createdAt,
    );
  },
});

/** Featured stories for the homepage — approved AND admin-selected only. */
export const featuredStories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("studentStories")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const featured = rows.filter((s) => s.featured);
    const hydrated = await Promise.all(
      featured.map(async (s) => ({
        ...s,
        photoUrl: await resolvePhoto(ctx, s.photoStorageId, s.photoUrl),
      })),
    );
    return hydrated.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** The signed-in user's own submissions (with status) — used on the public
 *  page so students can track whether their story was approved. */
export const myStories = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("studentStories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const hydrated = await Promise.all(
      rows.map(async (s) => ({
        ...s,
        photoUrl: await resolvePhoto(ctx, s.photoStorageId, s.photoUrl),
      })),
    );
    return hydrated.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ---------------------------------------------------------------------------
// Admin portal — every function below requires a valid admin session token
// ---------------------------------------------------------------------------

async function adminLog(ctx: MutationCtx, action: string, detail: string) {
  await ctx.db.insert("auditLogs", {
    action,
    detail,
    createdAt: Date.now(),
  });
}

/** All stories for the admin portal — optionally filtered by status. */
export const storiesList = query({
  args: { token: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, { token, status }) => {
    await requireAdminSession(ctx, token);
    let rows;
    if (
      status === "pending" ||
      status === "approved" ||
      status === "rejected"
    ) {
      rows = await ctx.db
        .query("studentStories")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
    } else {
      rows = await ctx.db.query("studentStories").collect();
    }
    const hydrated = await Promise.all(
      rows.map(async (s) => {
        const submitter = s.userId ? await ctx.db.get(s.userId) : null;
        return {
          ...s,
          photoUrl: await resolvePhoto(ctx, s.photoStorageId, s.photoUrl),
          submitterName: submitter?.name ?? null,
          submitterEmail: submitter?.email ?? null,
        };
      }),
    );
    return hydrated.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Approve or reject a story. Rejection automatically un-features it. */
export const reviewStory = mutation({
  args: {
    token: v.string(),
    id: v.id("studentStories"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, status, note }) => {
    await requireAdminSession(ctx, token);
    const story = await ctx.db.get(id);
    if (!story) throw new Error("Story not found.");

    await ctx.db.patch(id, {
      status,
      featured: status === "rejected" ? false : story.featured,
      adminNote: note?.trim().slice(0, 500) || undefined,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await adminLog(
      ctx,
      status === "approved" ? "story-approved" : "story-rejected",
      `${status === "approved" ? "Approved" : "Rejected"} story by ${story.name} ("${story.course}")`,
    );
    return await ctx.db.get(id);
  },
});

/** Edit a story's content (name / course / story / note). Photo is set by
 *  the submitter only — admins can clear it if it's inappropriate. */
export const updateStory = mutation({
  args: {
    token: v.string(),
    id: v.id("studentStories"),
    name: v.string(),
    course: v.string(),
    story: v.string(),
    clearPhoto: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, id, name, course, story, clearPhoto }) => {
    await requireAdminSession(ctx, token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Story not found.");

    const clean = validateContent({ name, course, story });

    const patch: Record<string, unknown> = {
      name: clean.name,
      course: clean.course,
      story: clean.story,
      updatedAt: Date.now(),
    };
    if (clearPhoto) {
      if (existing.photoStorageId) {
        try {
          await ctx.storage.delete(existing.photoStorageId);
        } catch {
          // Already gone — nothing to clean up.
        }
      }
      patch.photoStorageId = undefined;
      patch.photoUrl = undefined;
    }

    await ctx.db.patch(id, patch);
    await adminLog(ctx, "story-edited", `Edited story by ${clean.name}`);
    return await ctx.db.get(id);
  },
});

/** Delete a story (and its stored photo, best-effort). */
export const deleteStory = mutation({
  args: { token: v.string(), id: v.id("studentStories") },
  handler: async (ctx, { token, id }) => {
    await requireAdminSession(ctx, token);
    const story = await ctx.db.get(id);
    if (!story) throw new Error("Story not found.");
    if (story.photoStorageId) {
      try {
        await ctx.storage.delete(story.photoStorageId);
      } catch {
        // Already gone — nothing to clean up.
      }
    }
    await ctx.db.delete(id);
    await adminLog(ctx, "story-deleted", `Deleted story by ${story.name}`);
    return true;
  },
});

/** Feature / unfeature a story for the homepage. Only approved stories can
 *  be featured — hard-enforced server-side, so a pending or rejected story
 *  can never leak onto the homepage no matter what the client sends. */
export const setStoryFeatured = mutation({
  args: {
    token: v.string(),
    id: v.id("studentStories"),
    featured: v.boolean(),
  },
  handler: async (ctx, { token, id, featured }) => {
    await requireAdminSession(ctx, token);
    const story = await ctx.db.get(id);
    if (!story) throw new Error("Story not found.");
    if (featured && story.status !== "approved") {
      throw new Error(
        "Only approved stories can be featured. Approve the story first.",
      );
    }
    await ctx.db.patch(id, { featured, updatedAt: Date.now() });
    await adminLog(
      ctx,
      featured ? "story-featured" : "story-unfeatured",
      `${featured ? "Featured" : "Unfeatured"} story by ${story.name}`,
    );
    return await ctx.db.get(id);
  },
});
