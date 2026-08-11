import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getLessonContent = internalQuery({
  args: {
    courseId: v.id("courses"),
    lessonId: v.id("lessons"),
    userId: v.id("users"),
  },
  handler: async (ctx, { courseId, lessonId, userId }) => {
    const course = await ctx.db.get(courseId);
    if (!course) throw new Error("Course not found.");
    const user = await ctx.db.get(userId);
    if (!user || (course.tutorId !== userId && user.role !== "admin")) {
      throw new Error("Not your course.");
    }
    const lesson = await ctx.db.get(lessonId);
    if (!lesson || lesson.courseId !== courseId) {
      throw new Error("Lesson not found.");
    }
    return { course, lesson };
  },
});

export const getCourseContent = internalQuery({
  args: { courseId: v.id("courses"), userId: v.id("users") },
  handler: async (ctx, { courseId, userId }) => {
    const course = await ctx.db.get(courseId);
    if (!course) throw new Error("Course not found.");
    const user = await ctx.db.get(userId);
    if (!user || (course.tutorId !== userId && user.role !== "admin")) {
      throw new Error("Not your course.");
    }
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
      .collect();
    return { course, lessons: [...lessons].sort((a, b) => a.order - b.order) };
  },
});
