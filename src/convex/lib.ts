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
  // Hard security: suspended accounts are blocked from every protected
  // mutation server-side (admins gate separately via the access password).
  if (user.suspended) {
    throw new Error(
      "Your account has been suspended. Contact support@forgex.academy if you believe this is a mistake.",
    );
  }
  return user;
}

/**
 * Fixed-window rate limiter backed by the `rateLimits` table. Counts calls
 * under `key` inside `windowMs`; once `limit` is reached it throws a friendly
 * error (or returns `false` when `soft` is set). Safe under concurrency:
 * Convex serializes reads/writes to the same document, so two simultaneous
 * calls can't both pass the last allowed slot.
 */
export async function checkRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number,
  message = "You're moving a little fast — please slow down and try again shortly.",
  soft = false,
): Promise<boolean> {
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (!existing) {
    await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    return true;
  }
  if (now - existing.windowStart >= windowMs) {
    // Window rolled over — start a fresh bucket in place.
    await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
    return true;
  }
  if (existing.count >= limit) {
    if (soft) return false;
    throw new Error(message);
  }
  await ctx.db.patch(existing._id, { count: existing.count + 1 });
  return true;
}

/** Require the caller to be an admin. */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await requireUserDoc(ctx);
  if (user.role !== ROLES.ADMIN) {
    throw new Error("Admin access required.");
  }
  return user;
}

/**
 * Require the caller to be a verified tutor (or an admin). The Tutor
 * Dashboard is only usable by tutors that an admin has explicitly verified
 * (`verified: true`); an approved-but-unverified application is not enough.
 */
export async function requireTutor(ctx: QueryCtx | MutationCtx) {
  const user = await requireUserDoc(ctx);
  if (user.role === ROLES.ADMIN) return user;
  if (user.role !== ROLES.TUTOR || !user.verified) {
    throw new Error("Tutor access required.");
  }
  return user;
}

/**
 * Query-only variant of `requireTutor` used by the tutor dashboard pages.
 * When the caller isn't signed in at all (e.g. an admin session previewing
 * the tutor dashboard without a user account) it returns `null`, and the
 * calling query should return empty results. Signed-in non-tutors are still
 * rejected with an error.
 */
export async function requireTutorPreview(
  ctx: QueryCtx,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  if (user.role === ROLES.ADMIN) return user;
  if (user.role !== ROLES.TUTOR || !user.verified) {
    throw new Error("Tutor access required.");
  }
  return user;
}

export const isAdminUser = (u: Doc<"users"> | null | undefined) =>
  u?.role === ROLES.ADMIN;

/**
 * Resolve the acting identity for tutor mutations. A signed-in verified
 * tutor (or admin user) authenticates normally. An admin-session token
 * (password gate — the tutor-dashboard preview, no account) is also
 * accepted, so the preview can create and edit courses end-to-end.
 * Returns `isPreview: true` with `tutor: null` for admin-token sessions.
 */
export async function requireTutorOrToken(
  ctx: MutationCtx,
  token?: string,
): Promise<{ tutor: Doc<"users"> | null; isPreview: boolean }> {
  if (token) {
    await requireAdminSession(ctx, token);
    return { tutor: null, isPreview: true };
  }
  return { tutor: await requireTutor(ctx), isPreview: false };
}

// ---------------------------------------------------------------------------
// Password-only admin sessions (no user account required)
// ---------------------------------------------------------------------------

const ADMIN_SESSION_TTL = 12 * 60 * 60 * 1000; // 12 hours

/** Create a fresh admin session token (cryptographically random). */
export function makeAdminToken(): string {
  // 24 random bytes → 48 hex chars (~192 bits of entropy). Far stronger than
  // the previous Math.random() based token, which was predictable.
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Require a valid, unexpired admin session token. The admin dashboard is
 * unlocked purely by the access password — no user account is involved.
 */
export async function requireAdminSession(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<boolean> {
  if (!token) throw new Error("Admin access required.");
  const session = await ctx.db
    .query("adminSessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!session) throw new Error("Admin access required.");
  if (Date.now() - session.createdAt > ADMIN_SESSION_TTL) {
    throw new Error("Admin session expired. Enter the access password again.");
  }
  return true;
}


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
