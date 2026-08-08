import { getAuthUserId } from "@convex-dev/auth/server";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { ROLES } from "./schema";

/** Throw if not signed in, otherwise return the user id. */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">["_id"]> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("You must be signed in to do that.");
  }
  return userId;
}

/** Require a signed-in user and return their document. */
export async function requireUserDoc(ctx: QueryCtx | MutationCtx) {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Account not found.");
  return user;
}

/** Require the caller to be an admin. */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await requireUserDoc(ctx);
  if (user.role !== ROLES.ADMIN) {
    throw new Error("Admin access required.");
  }
  return user;
}

/** Require the caller to be a verified tutor (or an admin). */
export async function requireTutor(ctx: QueryCtx | MutationCtx) {
  const user = await requireUserDoc(ctx);
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.TUTOR) {
    throw new Error("Tutor access required.");
  }
  if (user.role === ROLES.TUTOR && !user.verified) {
    throw new Error("Your tutor account is still pending verification.");
  }
  return user;
}

export const isAdminUser = (u: Doc<"users"> | null | undefined) =>
  u?.role === ROLES.ADMIN;

export const isTutorUser = (u: Doc<"users"> | null | undefined) =>
  u?.role === ROLES.TUTOR && !!u?.verified;

/** Public-safe projection of a user. */
export function publicUser(u: Doc<"users">) {
  return {
    _id: u._id,
    name: u.name || "Anonymous",
    image: u.image ?? null,
    headline: u.headline ?? null,
    role: u.role ?? ROLES.STUDENT,
    verified: !!u.verified,
  };
}

/** Attach tutor + category + roadmap/level info to a course. */
export async function hydrateCourse(ctx: QueryCtx, course: Doc<"courses">) {
  const tutor = await ctx.db.get(course.tutorId);
  const category = await ctx.db.get(course.categoryId);
  const roadmap = course.roadmapId ? await ctx.db.get(course.roadmapId) : null;
  const level = course.levelId ? await ctx.db.get(course.levelId) : null;
  return {
    ...course,
    tutor: tutor ? publicUser(tutor) : null,
    category: category
      ? {
          name: category.name,
          slug: category.slug,
          icon: category.icon,
          color: category.color,
        }
      : null,
    roadmap: roadmap
      ? { name: roadmap.name, slug: roadmap.slug, icon: roadmap.icon }
      : null,
    level: level ? { title: level.title } : null,
  };
}

export async function hydrateCourses(ctx: QueryCtx, courses: Doc<"courses">[]) {
  return Promise.all(courses.map((c) => hydrateCourse(ctx, c)));
}

/** Create a notification for a user (fire-and-forget style helper). */
export async function notify(
  ctx: MutationCtx,
  args: {
    userId: string;
    title: string;
    body: string;
    type: string;
    link?: string;
  },
) {
  await ctx.db.insert("notifications", {
    userId: args.userId as Doc<"users">["_id"],
    title: args.title,
    body: args.body,
    type: args.type,
    link: args.link,
    read: false,
    createdAt: Date.now(),
  });
}

export function yyyymmdd(ts: number) {
  const d = new Date(ts);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function makeCertificateId() {
  const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FA-${Date.now().toString(36).toUpperCase()}-${rand()}-${rand()}`;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
