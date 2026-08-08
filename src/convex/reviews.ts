import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { MutationCtx, mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requireUser } from "./lib";

/**
 * Recompute the aggregate `rating` / `ratingCount` stored on the course from
 * its review docs. Keeps cards, listings and the course page in sync with the
 * actual review data.
 */
async function recomputeCourseRating(
  ctx: MutationCtx,
  courseId: Doc<"courses">["_id"],
) {
  const reviews = await ctx.db
    .query("courseReviews")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();
  const count = reviews.length;
  const rating = count
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / count
    : 0;
  await ctx.db.patch(courseId, {
    rating: Math.round(rating * 10) / 10,
    ratingCount: count,
  });
}

export const listByCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const reviews = await ctx.db
      .query("courseReviews")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    reviews.sort((a, b) => b.createdAt - a.createdAt);

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
    }

    const hydrated = await Promise.all(
      reviews.map(async (r) => {
        const author = await ctx.db.get(r.userId);
        return {
          _id: r._id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          author: author
            ? { name: author.name || "Anonymous", image: author.image ?? null }
            : { name: "Anonymous", image: null },
        };
      }),
    );

    return {
      reviews: hydrated,
      distribution,
      total: reviews.length,
    };
  },
});

/** The signed-in user's review for a course, or null. */
export const myReview = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const review = await ctx.db
      .query("courseReviews")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", userId).eq("courseId", courseId),
      )
      .first();
    return review ?? null;
  },
});

/** Create or update the signed-in user's review for a course. */
export const upsert = mutation({
  args: {
    courseId: v.id("courses"),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, { courseId, rating, comment }) => {
    const userId = await requireUser(ctx);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error("Rating must be a whole number between 1 and 5 stars.");
    }
    const course = await ctx.db.get(courseId);
    if (!course) throw new Error("Course not found.");

    const trimmed = (comment ?? "").trim().slice(0, 1000);
    const now = Date.now();
    const existing = await ctx.db
      .query("courseReviews")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", userId).eq("courseId", courseId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        rating,
        comment: trimmed,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("courseReviews", {
        courseId,
        userId,
        rating,
        comment: trimmed,
        createdAt: now,
        updatedAt: now,
      });
    }
    await recomputeCourseRating(ctx, courseId);
  },
});

/** Delete the signed-in user's review for a course. */
export const remove = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("courseReviews")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", userId).eq("courseId", courseId),
      )
      .first();
    if (!existing) throw new Error("You haven't reviewed this course yet.");
    await ctx.db.delete(existing._id);
    await recomputeCourseRating(ctx, courseId);
  },
});
