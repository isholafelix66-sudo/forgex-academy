import { query } from "./_generated/server";
import { requireUser } from "./lib";

export const myCertificates = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const certs = await ctx.db
      .query("certificates")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const hydrated = await Promise.all(
      certs.map(async (c) => {
        const course = await ctx.db.get(c.courseId);
        return {
          ...c,
          course: course
            ? { title: course.title, slug: course.slug, categoryId: course.categoryId }
            : null,
        };
      }),
    );
    return hydrated.sort((a, b) => b.issuedAt - a.issuedAt);
  },
});
