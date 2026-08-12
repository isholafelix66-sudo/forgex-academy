import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { requireAdminSession, slugify } from "./lib";
import { promptFieldValidator, type PromptField } from "./schema";

// ---------------------------------------------------------------------------
// ForgeX AI Prompt Library — a curated, searchable collection of prompts with
// a dynamic variable builder.
//
// Security / publication model (enforced server-side, never in the client):
//   • Public queries filter `published: true` in the database query — drafts
//     can never leak.
//   • Every write (prompt + category CRUD, publish, feature, reorder)
//     requires a valid admin session token. Students and visitors have no
//     path to them.
//   • The dynamic builder needs no AI API: templates store `{{field-key}}`
//     placeholders and the frontend replaces them with user input. An AI API
//     can be added later for Improve/Expand/Rewrite etc. without changing the
//     data model.
// ---------------------------------------------------------------------------

const TITLE_MAX = 120;
const DESC_MAX = 600;
const USEFUL_MAX = 600;
const TEMPLATE_MAX = 10000;
const TAG_COUNT_MAX = 12;
const TAG_LEN_MAX = 30;
const INPUT_COUNT_MAX = 12;
const INPUT_LEN_MAX = 200;
const FIELD_COUNT_MAX = 12;
const FIELD_KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DIFFICULTIES = [
  "beginner",
  "intermediate",
  "advanced",
  "professional",
  "expert",
] as const;

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

/** Find a free slug for `base` (appends -2, -3, … until unique). */
async function uniquePromptSlug(
  ctx: MutationCtx,
  base: string,
  excludeId?: Id<"prompts">,
): Promise<string> {
  let candidate = base;
  let i = 2;
  for (;;) {
    const existing = await ctx.db
      .query("prompts")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!existing || existing._id === excludeId) return candidate;
    candidate = `${base}-${i++}`;
  }
}

async function uniqueCategorySlug(
  ctx: MutationCtx,
  base: string,
  excludeId?: Id<"promptCategories">,
): Promise<string> {
  let candidate = base;
  let i = 2;
  for (;;) {
    const existing = await ctx.db
      .query("promptCategories")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!existing || existing._id === excludeId) return candidate;
    candidate = `${base}-${i++}`;
  }
}

function cleanList(
  values: string[] | undefined,
  countMax: number,
  lenMax: number,
): string[] {
  return (values ?? [])
    .map((s) => s.trim().slice(0, lenMax))
    .filter((s) => s.length > 0)
    .slice(0, countMax);
}

function validateFields(args: {
  title: string;
  description: string;
  categoryId: Id<"promptCategories">;
  subcategory?: string;
  tags?: string[];
  difficulty?: string;
  usefulFor: string;
  requiredInputs?: string[];
  template: string;
  fields?: PromptField[];
}) {
  const title = args.title.trim().slice(0, TITLE_MAX);
  const description = args.description.trim().slice(0, DESC_MAX);
  const usefulFor = args.usefulFor.trim().slice(0, USEFUL_MAX);
  const template = args.template.trim().slice(0, TEMPLATE_MAX);
  const subcategory = args.subcategory?.trim().slice(0, 80) || undefined;
  const tags = cleanList(args.tags, TAG_COUNT_MAX, TAG_LEN_MAX);
  const requiredInputs = cleanList(
    args.requiredInputs,
    INPUT_COUNT_MAX,
    INPUT_LEN_MAX,
  );

  if (title.length < 2) {
    throw new Error("Please give the prompt a title (at least 2 characters).");
  }
  if (description.length < 10) {
    throw new Error(
      "Please add a short description (at least 10 characters) so visitors know what this prompt does.",
    );
  }
  if (usefulFor.length < 2) {
    throw new Error("Please describe what the prompt is useful for.");
  }
  if (template.length < 10) {
    throw new Error(
      "The prompt template is quite short — write at least a few sentences of instructions.",
    );
  }
  if (
    args.difficulty &&
    !(DIFFICULTIES as readonly string[]).includes(args.difficulty)
  ) {
    throw new Error("Please pick a valid difficulty level.");
  }

  // Fields: keys must be slug-shaped, unique, and every template variable
  // must have a matching field so the builder can always generate a prompt.
  const seenKeys = new Set<string>();
  const fields: PromptField[] = (args.fields ?? []).slice(0, FIELD_COUNT_MAX);
  for (const f of fields) {
    const key = f.key.trim().toLowerCase();
    if (!FIELD_KEY_RE.test(key)) {
      throw new Error(
        `Field key “${f.key}” is invalid — use lowercase letters, numbers and dashes (e.g. product-name).`,
      );
    }
    if (seenKeys.has(key)) {
      throw new Error(`Field key “${key}” is used more than once.`);
    }
    seenKeys.add(key);
    if (!f.label.trim()) {
      throw new Error(`Field “${key}” needs a label (shown to visitors).`);
    }
    if (f.type === "select" && cleanList(f.options, 20, 100).length === 0) {
      throw new Error(`Select field “${key}” needs at least one option.`);
    }
  }

  const usedKeys = template.match(/\{\{([a-z0-9-]+)\}\}/g) ?? [];
  for (const raw of usedKeys) {
    const key = raw.slice(2, -2);
    if (!seenKeys.has(key)) {
      throw new Error(
        `The template uses {{${key}}} but there's no matching input field. Add a field with key “${key}” or remove the placeholder.`,
      );
    }
  }

  return {
    title,
    description,
    usefulFor,
    template,
    subcategory,
    tags,
    requiredInputs,
    fields: fields.map((f) => ({
      key: f.key.trim().toLowerCase(),
      label: f.label.trim().slice(0, 80),
      type: f.type,
      placeholder: f.placeholder?.trim().slice(0, 160) || undefined,
      options:
        f.type === "select"
          ? cleanList(f.options, 20, 100)
          : undefined,
      required: f.required === true,
    })),
  };
}

/** Attach category info (name/slug/subcategories) to prompt rows. */
async function hydratePrompts(
  ctx: QueryCtx,
  rows: Doc<"prompts">[],
): Promise<HydratedPrompt[]> {
  if (rows.length === 0) return [];
  const cats = await ctx.db.query("promptCategories").collect();
  const byId = new Map(cats.map((c) => [c._id, c]));
  return rows.map((p) => {
    const cat = byId.get(p.categoryId);
    return {
      ...p,
      categoryName: cat?.name ?? "Uncategorized",
      categorySlug: cat?.slug ?? "",
      categorySubcategories: cat?.subcategories ?? [],
    };
  });
}

type HydratedPrompt = Doc<"prompts"> & {
  categoryName: string;
  categorySlug: string;
  categorySubcategories: string[];
};

// ---------------------------------------------------------------------------
// Public — published only, always.
// ---------------------------------------------------------------------------

/** All published prompts, hydrated. Featured first, then by order/views. */
export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("prompts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();
    rows.sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        a.order - b.order ||
        b.createdAt - a.createdAt,
    );
    return hydratePrompts(ctx, rows);
  },
});

/** Published + featured prompts (homepage teaser + featured strip). */
export const listFeatured = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("prompts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();
    const featured = rows
      .filter((p) => p.featured)
      .sort((a, b) => b.createdAt - a.createdAt);
    return hydratePrompts(ctx, featured);
  },
});

/** All prompt categories in admin-defined order. */
export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("promptCategories").collect();
    return rows.sort((a, b) => a.order - b.order);
  },
});

/** A single published prompt by slug (detail page). */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const row = await ctx.db
      .query("prompts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!row || !row.published) return null;
    const [hydrated] = await hydratePrompts(ctx, [row]);
    return hydrated;
  },
});

/** Up to 3 other published prompts in the same category (related strip). */
export const listRelated = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const row = await ctx.db
      .query("prompts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!row || !row.published) return [];
    const rows = await ctx.db
      .query("prompts")
      .withIndex("by_category", (q) => q.eq("categoryId", row.categoryId))
      .collect();
    const related = rows
      .filter((p) => p.published && p._id !== row._id)
      .sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) || b.createdAt - a.createdAt,
      )
      .slice(0, 3);
    return hydratePrompts(ctx, related);
  },
});

/** Bump a prompt's view counter (public, cheap, idempotent-ish). */
export const incrementViews = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const row = await ctx.db
      .query("prompts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (row && row.published) {
      await ctx.db.patch(row._id, { views: (row.views ?? 0) + 1 });
    }
    return true;
  },
});

// ---------------------------------------------------------------------------
// Admin — every call requires a valid admin session token.
// ---------------------------------------------------------------------------

/** Everything the admin portal needs: all prompts + all categories. */
export const listAll = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const [prompts, categories] = await Promise.all([
      ctx.db.query("prompts").collect(),
      ctx.db.query("promptCategories").collect(),
    ]);
    return {
      prompts: prompts.sort(
        (a, b) => a.order - b.order || b.createdAt - a.createdAt,
      ),
      categories: categories.sort((a, b) => a.order - b.order),
    };
  },
});

const promptArgs = {
  title: v.string(),
  description: v.string(),
  categoryId: v.id("promptCategories"),
  subcategory: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  difficulty: v.optional(
    v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced"),
      v.literal("professional"),
      v.literal("expert"),
    ),
  ),
  usefulFor: v.string(),
  requiredInputs: v.optional(v.array(v.string())),
  template: v.string(),
  fields: v.optional(v.array(promptFieldValidator)),
};

export const createPrompt = mutation({
  args: {
    token: v.string(),
    published: v.boolean(),
    featured: v.boolean(),
    ...promptArgs,
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const clean = validateFields(args);
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Please pick a valid category.");

    const all = await ctx.db.query("prompts").collect();
    const order = all.reduce((m, p) => Math.max(m, p.order ?? 0), 0) + 1;
    const now = Date.now();
    const id = await ctx.db.insert("prompts", {
      title: clean.title,
      slug: await uniquePromptSlug(ctx, slugify(clean.title)),
      description: clean.description,
      categoryId: args.categoryId,
      subcategory: clean.subcategory,
      tags: clean.tags,
      difficulty: (args.difficulty as Doc<"prompts">["difficulty"]) ?? undefined,
      usefulFor: clean.usefulFor,
      requiredInputs: clean.requiredInputs,
      template: clean.template,
      fields: clean.fields,
      featured: args.featured,
      published: args.published,
      order,
      views: 0,
      createdAt: now,
      updatedAt: now,
    });
    await adminLog(
      ctx,
      "prompt-created",
      `Created ${args.published ? "published" : "draft"} prompt "${clean.title}" (${category.name})`,
    );
    return await ctx.db.get(id);
  },
});

export const updatePrompt = mutation({
  args: {
    token: v.string(),
    id: v.id("prompts"),
    published: v.boolean(),
    featured: v.boolean(),
    ...promptArgs,
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Prompt not found.");
    const clean = validateFields(args);
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Please pick a valid category.");

    const slug =
      existing.title === clean.title
        ? existing.slug
        : await uniquePromptSlug(ctx, slugify(clean.title), args.id);

    await ctx.db.patch(args.id, {
      title: clean.title,
      slug,
      description: clean.description,
      categoryId: args.categoryId,
      subcategory: clean.subcategory,
      tags: clean.tags,
      difficulty: (args.difficulty as Doc<"prompts">["difficulty"]) ?? undefined,
      usefulFor: clean.usefulFor,
      requiredInputs: clean.requiredInputs,
      template: clean.template,
      fields: clean.fields,
      featured: args.featured,
      published: args.published,
      updatedAt: Date.now(),
    });
    await adminLog(
      ctx,
      "prompt-updated",
      `Updated prompt "${clean.title}" (${args.published ? "published" : "draft"})`,
    );
    return await ctx.db.get(args.id);
  },
});

export const deletePrompt = mutation({
  args: { token: v.string(), id: v.id("prompts") },
  handler: async (ctx, { token, id }) => {
    await requireAdminSession(ctx, token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Prompt not found.");
    await ctx.db.delete(id);
    await adminLog(
      ctx,
      "prompt-deleted",
      `Deleted prompt "${existing.title}"`,
    );
    return true;
  },
});

export const setPromptPublished = mutation({
  args: {
    token: v.string(),
    id: v.id("prompts"),
    published: v.boolean(),
  },
  handler: async (ctx, { token, id, published }) => {
    await requireAdminSession(ctx, token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Prompt not found.");
    await ctx.db.patch(id, { published, updatedAt: Date.now() });
    await adminLog(
      ctx,
      published ? "prompt-published" : "prompt-unpublished",
      `${published ? "Published" : "Unpublished"} prompt "${existing.title}"`,
    );
    return true;
  },
});

export const setPromptFeatured = mutation({
  args: {
    token: v.string(),
    id: v.id("prompts"),
    featured: v.boolean(),
  },
  handler: async (ctx, { token, id, featured }) => {
    await requireAdminSession(ctx, token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Prompt not found.");
    await ctx.db.patch(id, { featured, updatedAt: Date.now() });
    await adminLog(
      ctx,
      featured ? "prompt-featured" : "prompt-unfeatured",
      `${featured ? "Featured" : "Unfeatured"} prompt "${existing.title}"`,
    );
    return true;
  },
});

/** Move a prompt up/down in the admin-defined order (swap order values). */
export const movePrompt = mutation({
  args: {
    token: v.string(),
    id: v.id("prompts"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, { token, id, direction }) => {
    await requireAdminSession(ctx, token);
    const rows = (await ctx.db.query("prompts").collect()).sort(
      (a, b) => a.order - b.order || b.createdAt - a.createdAt,
    );
    const idx = rows.findIndex((p) => p._id === id);
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || target < 0 || target >= rows.length) return false;
    const a = rows[idx];
    const b = rows[target];
    await Promise.all([
      ctx.db.patch(a._id, { order: b.order, updatedAt: Date.now() }),
      ctx.db.patch(b._id, { order: a.order, updatedAt: Date.now() }),
    ]);
    return true;
  },
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const createCategory = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    description: v.string(),
    subcategories: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const name = args.name.trim().slice(0, 80);
    const description = args.description.trim().slice(0, 400);
    const subcategories = cleanList(args.subcategories, 20, 80);
    if (name.length < 2) {
      throw new Error("Please give the category a name (at least 2 characters).");
    }
    if (description.length < 5) {
      throw new Error("Please add a short category description.");
    }
    const all = await ctx.db.query("promptCategories").collect();
    const order = all.reduce((m, c) => Math.max(m, c.order ?? 0), 0) + 1;
    const id = await ctx.db.insert("promptCategories", {
      name,
      slug: await uniqueCategorySlug(ctx, slugify(name)),
      description,
      subcategories,
      order,
    });
    await adminLog(ctx, "prompt-category-created", `Created category "${name}"`);
    return await ctx.db.get(id);
  },
});

export const updateCategory = mutation({
  args: {
    token: v.string(),
    id: v.id("promptCategories"),
    name: v.string(),
    description: v.string(),
    subcategories: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.token);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Category not found.");
    const name = args.name.trim().slice(0, 80);
    const description = args.description.trim().slice(0, 400);
    const subcategories = cleanList(args.subcategories, 20, 80);
    if (name.length < 2) {
      throw new Error("Please give the category a name (at least 2 characters).");
    }
    if (description.length < 5) {
      throw new Error("Please add a short category description.");
    }
    await ctx.db.patch(args.id, {
      name,
      slug:
        existing.name === name
          ? existing.slug
          : await uniqueCategorySlug(ctx, slugify(name), args.id),
      description,
      subcategories,
    });
    await adminLog(ctx, "prompt-category-updated", `Updated category "${name}"`);
    return await ctx.db.get(args.id);
  },
});

export const deleteCategory = mutation({
  args: { token: v.string(), id: v.id("promptCategories") },
  handler: async (ctx, { token, id }) => {
    await requireAdminSession(ctx, token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Category not found.");
    const count = await ctx.db
      .query("prompts")
      .withIndex("by_category", (q) => q.eq("categoryId", id))
      .collect();
    if (count.length > 0) {
      throw new Error(
        `This category still has ${count.length} prompt${count.length === 1 ? "" : "s"} — move or delete them first.`,
      );
    }
    await ctx.db.delete(id);
    await adminLog(
      ctx,
      "prompt-category-deleted",
      `Deleted category "${existing.name}"`,
    );
    return true;
  },
});

/** Move a category up/down in the admin-defined order. */
export const moveCategory = mutation({
  args: {
    token: v.string(),
    id: v.id("promptCategories"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, { token, id, direction }) => {
    await requireAdminSession(ctx, token);
    const rows = (await ctx.db.query("promptCategories").collect()).sort(
      (a, b) => a.order - b.order,
    );
    const idx = rows.findIndex((c) => c._id === id);
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || target < 0 || target >= rows.length) return false;
    const a = rows[idx];
    const b = rows[target];
    await Promise.all([
      ctx.db.patch(a._id, { order: b.order }),
      ctx.db.patch(b._id, { order: a.order }),
    ]);
    return true;
  },
});
