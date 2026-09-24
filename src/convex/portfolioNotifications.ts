import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePortfolioAdminSession } from "./portfolioAdmin";

/* ═══════════════════════════════════════════════════════════════════════════
   PORTFOLIO NOTIFICATIONS — the announcement shown in the public Portfolio
   header.

   Owned entirely by the Portfolio website:
     • written and published from the Portfolio admin portal (/adminbrand)
     • read by the public header for signed-out visitors and creators alike
     • never reads or writes the Academy `announcements` table, and an Academy
       session can neither read drafts nor publish anything here.
   ═══════════════════════════════════════════════════════════════════════════ */

const MAX_TITLE = 120;
const MAX_BODY = 400;

const TONE = v.union(
  v.literal("info"),
  v.literal("success"),
  v.literal("warning"),
);

export type PortfolioNotification = {
  _id: string;
  title: string;
  body: string;
  link: string | null;
  linkLabel: string | null;
  tone: "info" | "success" | "warning";
  published: boolean;
  createdAt: number;
  updatedAt: number;
};

function validate(title: string, body: string) {
  const t = title.trim();
  const b = body.trim();
  if (t.length < 3) throw new Error("Give the notification a title.");
  if (b.length < 3) throw new Error("Write the notification message.");
  if (t.length > MAX_TITLE) throw new Error("Keep the title under 120 characters.");
  if (b.length > MAX_BODY) throw new Error("Keep the message under 400 characters.");
  return { title: t, body: b };
}

function cleanLink(link?: string) {
  const value = (link ?? "").trim();
  if (!value) return undefined;
  if (value.length > 500) throw new Error("That link is too long.");
  // In-app paths (/p/slug, /explore…) or absolute http(s) URLs only.
  if (!value.startsWith("/") && !/^https?:\/\//i.test(value)) {
    throw new Error("Links must be a /path or start with http(s)://");
  }
  return value;
}

/* ── Public: the header reads this ─────────────────────────────────────── */

/**
 * Currently published announcements, newest first. Public by design — the
 * header shows the same thing to guests and to signed-in creators.
 */
export const active = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("portfolioNotifications")
      .withIndex("by_published", (q) => q.eq("published", true))
      .order("desc")
      .take(8);
    return rows.map((r) => ({
      _id: r._id as string,
      title: r.title,
      body: r.body,
      link: r.link ?? null,
      linkLabel: r.linkLabel ?? null,
      tone: r.tone,
      published: true as const,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },
});

/* ── Admin portal (/adminbrand → Notifications) ────────────────────────── */

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requirePortfolioAdminSession(ctx, token);
    const rows = await ctx.db
      .query("portfolioNotifications")
      .withIndex("by_createdAt")
      .order("desc")
      .take(100);
    return rows.map((r) => ({
      _id: r._id as string,
      title: r.title,
      body: r.body,
      link: r.link ?? null,
      linkLabel: r.linkLabel ?? null,
      tone: r.tone,
      published: r.published,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },
});

/**
 * Coming-soon announcements for the rest of the ForgeX Network.
 *
 * Idempotent: it only inserts an announcement that doesn't exist yet (matched
 * by title), so clicking it twice — or opening the Notifications tab again —
 * never creates duplicates. Editing, unpublishing or deleting them afterwards
 * is entirely up to the admin.
 */
const DEFAULT_ANNOUNCEMENTS = [
  {
    title: "ForgeX Academy — coming soon",
    body: "Structured roadmaps, lessons, projects and certificates are on the way. Get notified the moment the Academy opens.",
    link: "/academy",
    linkLabel: "Get notified",
    tone: "info" as const,
  },
  {
    title: "ForgeX Opportunity Hub — coming soon",
    body: "Internships, jobs and scholarships that turn skills into opportunity. Be first in line.",
    link: "/opportunity-hub",
    linkLabel: "Join the waitlist",
    tone: "success" as const,
  },
];

export const ensureDefaults = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requirePortfolioAdminSession(ctx, token);
    const existing = await ctx.db
      .query("portfolioNotifications")
      .withIndex("by_createdAt")
      .take(200);
    const titles = new Set(existing.map((r) => r.title));
    let created = 0;
    for (const seed of DEFAULT_ANNOUNCEMENTS) {
      if (titles.has(seed.title)) continue;
      const now = Date.now();
      await ctx.db.insert("portfolioNotifications", {
        ...seed,
        published: true,
        createdAt: now,
        updatedAt: now,
      });
      created += 1;
    }
    return { created };
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    body: v.string(),
    link: v.optional(v.string()),
    linkLabel: v.optional(v.string()),
    tone: v.optional(TONE),
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requirePortfolioAdminSession(ctx, args.token);
    const { title, body } = validate(args.title, args.body);
    const now = Date.now();
    const id = await ctx.db.insert("portfolioNotifications", {
      title,
      body,
      link: cleanLink(args.link),
      linkLabel: args.linkLabel?.trim().slice(0, 40) || undefined,
      tone: args.tone ?? "info",
      published: args.published ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("portfolioNotifications"),
    title: v.string(),
    body: v.string(),
    link: v.optional(v.string()),
    linkLabel: v.optional(v.string()),
    tone: v.optional(TONE),
  },
  handler: async (ctx, args) => {
    await requirePortfolioAdminSession(ctx, args.token);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("That notification no longer exists.");
    const { title, body } = validate(args.title, args.body);
    await ctx.db.patch(args.id, {
      title,
      body,
      link: cleanLink(args.link),
      linkLabel: args.linkLabel?.trim().slice(0, 40) || undefined,
      tone: args.tone ?? row.tone,
      updatedAt: Date.now(),
    });
    return true;
  },
});

/** Publish / unpublish — the header only ever shows published rows. */
export const setPublished = mutation({
  args: {
    token: v.string(),
    id: v.id("portfolioNotifications"),
    published: v.boolean(),
  },
  handler: async (ctx, { token, id, published }) => {
    await requirePortfolioAdminSession(ctx, token);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("That notification no longer exists.");
    await ctx.db.patch(id, { published, updatedAt: Date.now() });
    return true;
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("portfolioNotifications") },
  handler: async (ctx, { token, id }) => {
    await requirePortfolioAdminSession(ctx, token);
    const row = await ctx.db.get(id);
    if (row) await ctx.db.delete(id);
    return true;
  },
});
