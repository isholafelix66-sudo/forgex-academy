import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdminSession, slugify } from "./lib";
import { cloudinaryDestroy } from "./cloudinary";

// ---------------------------------------------------------------------------
// ForgeX AI Hub — curated AI tools, articles, tutorials, setup guides and
// learning resources.
//
// Security / publication model (enforced server-side, never in the client):
//   • Public queries (listPublished / listFeatured) filter `published: true`
//     in the database query — drafts can never leak, no matter what a client
//     sends.
//   • Every write (create / update / delete / publish / feature) requires a
//     valid admin session token. Students and visitors have no path to them.
// ---------------------------------------------------------------------------

export const AI_CATEGORIES = [
  "AI Tools",
  "AI Writing",
  "AI Design",
  "AI Coding",
  "AI Video & Audio",
  "AI Research",
  "AI Productivity",
  "AI Automation",
  "AI Tutorials",
  "AI Setup Guides",
  "AI Articles",
  "Free AI Resources",
] as const;

export const AI_RESOURCE_TYPES = [
  "tool",
  "article",
  "tutorial",
  "setup-guide",
  "learning-resource",
] as const;

export const AI_PRICING_TYPES = ["free", "freemium", "paid"] as const;

export type AiPricingType = (typeof AI_PRICING_TYPES)[number];

const TITLE_MAX = 120;
const DESC_MAX = 600;
const URL_MAX = 2000;
const STEP_MAX = 400;
const STEPS_MAX = 12;
const VIDEO_URL_MAX = 2000;
const BODY_MAX = 50000; // article / post body

const isCategory = (c: string): c is (typeof AI_CATEGORIES)[number] =>
  (AI_CATEGORIES as readonly string[]).includes(c);
const isResourceType = (t: string): t is (typeof AI_RESOURCE_TYPES)[number] =>
  (AI_RESOURCE_TYPES as readonly string[]).includes(t);
const isPricingType = (p: string): p is AiPricingType =>
  (AI_PRICING_TYPES as readonly string[]).includes(p);

function validateFields(args: {
  title: string;
  description: string;
  category: string;
  resourceType: string;
  url: string;
  pricingType: string;
  instructions?: string[] | undefined;
  videoUrl?: string | undefined;
  body?: string | undefined;
}) {
  const title = args.title.trim().slice(0, TITLE_MAX);
  const description = args.description.trim().slice(0, DESC_MAX);
  const url = args.url.trim().slice(0, URL_MAX);
  const instructions = (args.instructions ?? [])
    .map((s) => s.trim().slice(0, STEP_MAX))
    .filter((s) => s.length > 0)
    .slice(0, STEPS_MAX);
  const videoUrl = args.videoUrl?.trim().slice(0, VIDEO_URL_MAX) ?? "";
  const body = args.body?.trim().slice(0, BODY_MAX) ?? "";

  if (title.length < 2) {
    throw new Error("Please give the resource a title (at least 2 characters).");
  }
  if (description.length < 10) {
    throw new Error(
      "Please add a short description (at least 10 characters) so visitors know what this resource does.",
    );
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      "The resource URL must start with http:// or https:// so it can open safely in a new tab.",
    );
  }
  if (!isCategory(args.category)) {
    throw new Error("Please pick a valid category.");
  }
  if (!isResourceType(args.resourceType)) {
    throw new Error("Please pick a valid resource type.");
  }
  if (!isPricingType(args.pricingType)) {
    throw new Error("Please pick a valid pricing type (Free, Freemium or Paid).");
  }
  if (videoUrl && !/^https?:\/\//i.test(videoUrl)) {
    throw new Error("The video URL must start with http:// or https://.");
  }
  return {
    title,
    description,
    url,
    instructions,
    videoUrl: videoUrl || undefined,
    body: body || undefined,
  };
}

/** Find a free slug for `base` (appends -2, -3, … until unique). */
async function uniqueSlug(
  ctx: MutationCtx,
  base: string,
  excludeId?: Id<"aiResources">,
): Promise<string> {
  let candidate = base;
  let i = 2;
  for (;;) {
    const existing = await ctx.db
      .query("aiResources")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!existing || existing._id === excludeId) return candidate;
    candidate = `${base}-${i++}`;
  }
}

async function adminLog(
  ctx: MutationCtx,
  action: string,
  detail: string,
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    action,
    detail,
    createdAt: Date.now(),
  });
}

/** Best-effort removal of the Cloudinary asset behind a thumbnail. */
async function destroyThumbnail(
  publicId: string | undefined,
): Promise<void> {
  if (!publicId) return;
  try {
    await cloudinaryDestroy(publicId);
  } catch {
    // Already gone or Cloudinary not configured — nothing to clean up.
  }
}

// ---------------------------------------------------------------------------
// Public queries — published only, always.
// ---------------------------------------------------------------------------

/** All published resources, featured first, then newest. */
export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("aiResources")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();
    return rows.sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        b.createdAt - a.createdAt,
    );
  },
});

/** Published + featured resources (homepage teaser). */
export const listFeatured = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("aiResources")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();
    return rows
      .filter((r) => r.featured)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ---------------------------------------------------------------------------
// Admin — every call requires a valid admin session token.
// ---------------------------------------------------------------------------

/** Every resource (drafts included), newest first — for the admin portal. */
export const listAll = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const rows = await ctx.db.query("aiResources").collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

const resourceFields = {
  title: v.string(),
  description: v.string(),
  category: v.string(),
  resourceType: v.string(),
  url: v.string(),
  thumbnailUrl: v.optional(v.string()),
  thumbnailPublicId: v.optional(v.string()),
  pricingType: v.union(
    v.literal("free"),
    v.literal("freemium"),
    v.literal("paid"),
  ),
  noCreditCard: v.boolean(),
  instructions: v.optional(v.array(v.string())),
  videoUrl: v.optional(v.string()),
  body: v.optional(v.string()),
  lastVerifiedAt: v.optional(v.number()),
};

export const createResource = mutation({
  args: {
    token: v.string(),
    published: v.boolean(),
    featured: v.boolean(),
    ...resourceFields,
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const clean = validateFields(args);
    const now = Date.now();
    const id = await ctx.db.insert("aiResources", {
      title: clean.title,
      slug: await uniqueSlug(ctx, slugify(clean.title)),
      description: clean.description,
      category: args.category,
      resourceType: args.resourceType,
      url: clean.url,
      thumbnailUrl: args.thumbnailUrl?.trim() || undefined,
      thumbnailPublicId: args.thumbnailPublicId?.trim() || undefined,
      pricingType: args.pricingType,
      noCreditCard: args.noCreditCard,
      instructions: clean.instructions,
      videoUrl: clean.videoUrl,
      body: clean.body,
      featured: args.featured,
      published: args.published,
      createdAt: now,
      updatedAt: now,
      lastVerifiedAt: args.lastVerifiedAt,
    });
    await adminLog(
      ctx,
      "ai-resource-created",
      `Created ${args.published ? "published" : "draft"} resource "${clean.title}" (${
        args.category
      })`,
    );
    return await ctx.db.get(id);
  },
});

export const updateResource = mutation({
  args: {
    token: v.string(),
    id: v.id("aiResources"),
    published: v.boolean(),
    featured: v.boolean(),
    clearThumbnail: v.optional(v.boolean()),
    ...resourceFields,
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Resource not found.");

    const clean = validateFields(args);
    const now = Date.now();
    const clearThumbnail = args.clearThumbnail === true;

    // Re-slug only when the title changed, keeping URLs stable otherwise.
    const slug =
      existing.title === clean.title
        ? existing.slug
        : await uniqueSlug(ctx, slugify(clean.title), args.id);

    await ctx.db.patch(args.id, {
      title: clean.title,
      slug,
      description: clean.description,
      category: args.category,
      resourceType: args.resourceType,
      url: clean.url,
      thumbnailUrl: clearThumbnail
        ? undefined
        : args.thumbnailUrl?.trim() || existing.thumbnailUrl,
      thumbnailPublicId: clearThumbnail
        ? undefined
        : args.thumbnailPublicId?.trim() || existing.thumbnailPublicId,
      pricingType: args.pricingType,
      noCreditCard: args.noCreditCard,
      instructions: clean.instructions,
      videoUrl: clean.videoUrl,
      body: clean.body,
      featured: args.featured,
      published: args.published,
      updatedAt: now,
      lastVerifiedAt: args.lastVerifiedAt,
    });

    if (clearThumbnail) {
      await destroyThumbnail(existing.thumbnailPublicId);
    } else if (
      args.thumbnailPublicId &&
      args.thumbnailPublicId !== existing.thumbnailPublicId
    ) {
      await destroyThumbnail(existing.thumbnailPublicId);
    }

    await adminLog(
      ctx,
      "ai-resource-updated",
      `Updated resource "${clean.title}" (${args.published ? "published" : "draft"})`,
    );
    return await ctx.db.get(args.id);
  },
});

export const deleteResource = mutation({
  args: { token: v.string(), id: v.id("aiResources") },
  handler: async (ctx, { token, id }) => {
    await requireAdminSession(ctx, token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Resource not found.");
    await destroyThumbnail(existing.thumbnailPublicId);
    await ctx.db.delete(id);
    await adminLog(
      ctx,
      "ai-resource-deleted",
      `Deleted resource "${existing.title}"`,
    );
    return true;
  },
});

/** Publish / unpublish without opening the editor. */
export const setResourcePublished = mutation({
  args: {
    token: v.string(),
    id: v.id("aiResources"),
    published: v.boolean(),
  },
  handler: async (ctx, { token, id, published }) => {
    await requireAdminSession(ctx, token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Resource not found.");
    await ctx.db.patch(id, { published, updatedAt: Date.now() });
    await adminLog(
      ctx,
      published ? "ai-resource-published" : "ai-resource-unpublished",
      `${published ? "Published" : "Unpublished"} resource "${existing.title}"`,
    );
    return true;
  },
});

/** Feature / unfeature. Featured rows show on the homepage and top of the
 *  public hub — but only when `published` is also true, which is enforced by
 *  the public queries themselves. */
export const setResourceFeatured = mutation({
  args: {
    token: v.string(),
    id: v.id("aiResources"),
    featured: v.boolean(),
  },
  handler: async (ctx, { token, id, featured }) => {
    await requireAdminSession(ctx, token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Resource not found.");
    await ctx.db.patch(id, { featured, updatedAt: Date.now() });
    await adminLog(
      ctx,
      featured ? "ai-resource-featured" : "ai-resource-unfeatured",
      `${featured ? "Featured" : "Unfeatured"} resource "${existing.title}"`,
    );
    return true;
  },
});
