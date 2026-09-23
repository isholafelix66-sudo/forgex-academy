/**
 * ForgeX Projects — the portfolio platform backend.
 *
 * What Projects is: users create ONE portfolio, turn it into their own
 * professional website, and share a single link (/p/<slug>).
 *
 * Academy and Opportunity Hub are LOCKED future products. They still exist in
 * the codebase and database, but normal users have no route to them —
 * `featureFlags` is the single source of truth for what is live, so launching
 * a product later is a flag change, not a rebuild.
 *
 * Convex remains the primary database. Nothing here migrates or deletes
 * existing data.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { checkRateLimit, nameFromEmail, requireAdminSession, slugify } from "./lib";
import {
  portfolioEducationValidator,
  portfolioExperienceValidator,
  portfolioLinkValidator,
  portfolioServiceValidator,
  portfolioSkillValidator,
  portfolioTemplateValidator,
  portfolioVisibilityValidator,
  type PortfolioVisibility,
} from "./schema";
import {
  portfolioPublishedEmail,
  projectsWelcomeEmail,
} from "./emailTemplates";

// ---------------------------------------------------------------------------
// Product feature flags
// ---------------------------------------------------------------------------

export type FeatureState = "active" | "locked" | "hidden";

type FlagDef = {
  key: string;
  label: string;
  tagline: string;
  state: FeatureState;
  comingSoonCopy: string;
  order: number;
};

/**
 * Platform defaults. `Projects` is the live product; the two future products
 * are locked (visible as "Coming Soon" but with no functional access).
 */
export const DEFAULT_FLAGS: FlagDef[] = [
  {
    key: "projects",
    label: "Projects",
    tagline: "Create your portfolio once. Share one link.",
    state: "active",
    comingSoonCopy: "",
    order: 0,
  },
  {
    key: "academy",
    label: "Academy",
    tagline: "Learn. Build. Succeed.",
    state: "locked",
    comingSoonCopy:
      "We're building something to help you learn, grow and create better opportunities.",
    order: 1,
  },
  {
    key: "opportunity-hub",
    label: "Opportunity Hub",
    tagline: "Internships, jobs, scholarships and entrepreneurship.",
    state: "locked",
    comingSoonCopy:
      "We're connecting skills to real opportunities — internships, jobs, scholarships and ventures, all in one place.",
    order: 2,
  },
];

const SITE_BASE = (process.env.SITE_URL ?? "").replace(/\/+$/, "");

function portfolioUrl(slug: string) {
  return `${SITE_BASE}/p/${slug}`;
}

/** All products, merged with the platform defaults (missing row = default). */
export const featureFlags = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("featureFlags").collect();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return DEFAULT_FLAGS.map((d) => {
      const r = byKey.get(d.key);
      return {
        key: d.key,
        label: r?.label ?? d.label,
        tagline: r?.tagline ?? d.tagline,
        state: (r?.state ?? d.state) as FeatureState,
        comingSoonCopy: r?.comingSoonCopy ?? d.comingSoonCopy,
        order: r?.order ?? d.order,
      };
    }).sort((a, b) => a.order - b.order);
  },
});

/** Whether one product is currently live. Guest-safe. */
export const isProductActive = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    const fallback = DEFAULT_FLAGS.find((f) => f.key === key);
    if (!fallback) return false;
    return (row?.state ?? fallback.state) === "active";
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ownerName(user: Doc<"users">) {
  const stored = user.name?.trim();
  if (stored) return stored;
  const derived = nameFromEmail(user.email);
  return derived || "New creator";
}

/** A slug that is unique across portfolios, appending -2, -3 … as needed. */
async function uniqueSlug(
  ctx: QueryCtx | MutationCtx,
  base: string,
  excludeId?: Id<"portfolios">,
): Promise<string> {
  const root = slugify(base).slice(0, 40) || "portfolio";
  let candidate = root;
  for (let i = 2; i < 200; i += 1) {
    const existing = await ctx.db
      .query("portfolios")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!existing || existing._id === excludeId) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Queue a transactional email; email must never break a business flow. */
async function queueEmail(
  ctx: MutationCtx,
  args: {
    to: string;
    subject: string;
    html: string;
    emailType: string;
    dedupeKey?: string;
    automationKey?: string;
  },
) {
  if (!args.to) return;
  try {
    await ctx.scheduler.runAfter(0, internal.emailData.queueSystemEmail, {
      to: args.to,
      subject: args.subject,
      html: args.html,
      emailType: args.emailType,
      priority: "normal",
      dedupeKey: args.dedupeKey,
      automationKey: args.automationKey,
    });
  } catch (err) {
    console.error("[projects] email queue failed:", err);
  }
}

const STATS_KEY = "projects";
const STATS_TTL_MS = 6 * 60 * 60 * 1000;

/** Recompute the Projects rollup row (one small doc — never a page scan). */
async function recomputeStats(ctx: MutationCtx) {
  const portfolios = await ctx.db.query("portfolios").collect();
  const projects = await ctx.db.query("portfolioProjects").collect();
  const live = portfolios.filter((p) => !p.suspended);
  const value = {
    key: STATS_KEY,
    portfolios: live.filter((p) => p.visibility !== "draft").length,
    creators: portfolios.length,
    discoverable: live.filter((p) => p.visibility === "discoverable").length,
    projects: projects.filter((p) => !p.removed).length,
    views: live.reduce((s, p) => s + p.views, 0),
    updatedAt: Date.now(),
  };
  const row = await ctx.db
    .query("siteStatsCache")
    .withIndex("by_key", (q) => q.eq("key", STATS_KEY))
    .unique();
  if (row) await ctx.db.patch(row._id, value);
  else await ctx.db.insert("siteStatsCache", value);
}

// ---------------------------------------------------------------------------
// Public stats (landing page) — cache first, bounded fallback otherwise
// ---------------------------------------------------------------------------

export const projectsStats = query({
  args: {},
  handler: async (ctx) => {
    const cached = await ctx.db
      .query("siteStatsCache")
      .withIndex("by_key", (q) => q.eq("key", STATS_KEY))
      .unique();
    if (cached && Date.now() - cached.updatedAt < STATS_TTL_MS) {
      return {
        portfolios: cached.portfolios ?? 0,
        creators: cached.creators ?? 0,
        discoverable: cached.discoverable ?? 0,
        projects: cached.projects ?? 0,
        views: cached.views ?? 0,
      };
    }
    // Bounded fallback: at most 500 docs per table until the rollup is written.
    const portfolios = await ctx.db.query("portfolios").take(500);
    const projects = await ctx.db.query("portfolioProjects").take(500);
    const live = portfolios.filter((p) => !p.suspended);
    return {
      portfolios: live.filter((p) => p.visibility !== "draft").length,
      creators: portfolios.length,
      discoverable: live.filter((p) => p.visibility === "discoverable").length,
      projects: projects.filter((p) => !p.removed).length,
      views: live.reduce((s, p) => s + p.views, 0),
    };
  },
});

// ---------------------------------------------------------------------------
// Owner-side portfolio
// ---------------------------------------------------------------------------

/** The signed-in user's portfolio + projects, or null when they have none. */
export const myPortfolio = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!portfolio) return null;
    const projects = await ctx.db
      .query("portfolioProjects")
      .withIndex("by_portfolio", (q) => q.eq("portfolioId", portfolio._id))
      .collect();
    return {
      portfolio,
      projects: projects
        .filter((p) => !p.removed)
        .sort((a, b) => a.order - b.order),
      allProjects: projects.sort((a, b) => a.order - b.order),
    };
  },
});

/** Create the owner's portfolio on first dashboard visit (idempotent). */
export const ensureMyPortfolio = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to build your portfolio.");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Account not found.");
    if (user.suspended) throw new Error("Your account has been suspended.");

    const existing = await ctx.db
      .query("portfolios")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing._id;

    const display = ownerName(user);
    const slug = await uniqueSlug(ctx, display || user.email || "portfolio");
    const now = Date.now();
    const id = await ctx.db.insert("portfolios", {
      userId,
      slug,
      displayName: display,
      headline: "",
      bio: "",
      about: "",
      template: "carbon",
      visibility: "draft",
      skills: [],
      experience: [],
      education: [],
      services: [],
      links: [],
      featured: false,
      suspended: false,
      views: 0,
      createdAt: now,
      updatedAt: now,
    });

    if (user.email) {
      const tpl = projectsWelcomeEmail({
        name: display,
        portfolioPath: `/p/${slug}`,
      });
      await queueEmail(ctx, {
        to: user.email,
        subject: tpl.subject,
        html: tpl.html,
        emailType: "projects_welcome",
        dedupeKey: `projects-welcome-${userId}`,
        automationKey: "projects_welcome",
      });
    }
    await recomputeStats(ctx);
    return id;
  },
});

/**
 * Update the portfolio profile. Only the owner can (the userId is derived
 * server-side from the session — never trusted from the client payload).
 */
export const updatePortfolio = mutation({
  args: {
    displayName: v.optional(v.string()),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
    about: v.optional(v.string()),
    location: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    availability: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    coverUrl: v.optional(v.string()),
    template: v.optional(portfolioTemplateValidator),
    accent: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    skills: v.optional(v.array(portfolioSkillValidator)),
    experience: v.optional(v.array(portfolioExperienceValidator)),
    education: v.optional(v.array(portfolioEducationValidator)),
    services: v.optional(v.array(portfolioServiceValidator)),
    links: v.optional(v.array(portfolioLinkValidator)),
    sectionOrder: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to edit your portfolio.");
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!portfolio) throw new Error("Create your portfolio first.");

    // Trim long free-text fields so nothing balloons into the database.
    const patch: Partial<Doc<"portfolios">> = { updatedAt: Date.now() };
    if (args.displayName !== undefined)
      patch.displayName = args.displayName.slice(0, 80).trim();
    if (args.headline !== undefined)
      patch.headline = args.headline.slice(0, 140);
    if (args.bio !== undefined) patch.bio = args.bio.slice(0, 600);
    if (args.about !== undefined) patch.about = args.about.slice(0, 6000);
    if (args.location !== undefined) patch.location = args.location.slice(0, 80);
    if (args.email !== undefined) patch.email = args.email.slice(0, 160);
    if (args.phone !== undefined) patch.phone = args.phone.slice(0, 40);
    if (args.availability !== undefined)
      patch.availability = args.availability.slice(0, 80);
    if (args.avatarUrl !== undefined) patch.avatarUrl = args.avatarUrl;
    if (args.coverUrl !== undefined) patch.coverUrl = args.coverUrl;
    if (args.template !== undefined) patch.template = args.template;
    if (args.accent !== undefined) patch.accent = args.accent;
    if (args.seoTitle !== undefined) patch.seoTitle = args.seoTitle.slice(0, 80);
    if (args.seoDescription !== undefined)
      patch.seoDescription = args.seoDescription.slice(0, 200);
    if (args.skills !== undefined) patch.skills = args.skills.slice(0, 40);
    if (args.experience !== undefined)
      patch.experience = args.experience.slice(0, 30);
    if (args.education !== undefined) patch.education = args.education.slice(0, 20);
    if (args.services !== undefined) patch.services = args.services.slice(0, 24);
    if (args.links !== undefined) patch.links = args.links.slice(0, 12);
    if (args.sectionOrder !== undefined)
      patch.sectionOrder = args.sectionOrder.slice(0, 20);

    await ctx.db.patch(portfolio._id, patch);
    return portfolio._id;
  },
});

/**
 * Portfolio visibility is a deliberate setting:
 *   draft        → only the owner
 *   published    → anyone with the link
 *   discoverable → link + the public Explore section
 */
export const setVisibility = mutation({
  args: { visibility: portfolioVisibilityValidator },
  handler: async (ctx, { visibility }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to publish your portfolio.");
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!portfolio) throw new Error("Create your portfolio first.");

    const firstPublish = portfolio.visibility === "draft" && visibility !== "draft";
    await ctx.db.patch(portfolio._id, {
      visibility,
      publishedAt: visibility === "draft" ? undefined : (portfolio.publishedAt ?? Date.now()),
      updatedAt: Date.now(),
    });

    if (firstPublish) {
      const user = await ctx.db.get(userId);
      if (user?.email) {
        const tpl = portfolioPublishedEmail({
          name: portfolio.displayName,
          portfolioUrl: portfolioUrl(portfolio.slug),
          discoverable: visibility === "discoverable",
        });
        await queueEmail(ctx, {
          to: user.email,
          subject: tpl.subject,
          html: tpl.html,
          emailType: "portfolio_published",
          dedupeKey: `portfolio-published-${portfolio._id}`,
          automationKey: "portfolio_published",
        });
      }
      if (!portfolio.publishedAt) {
        await ensureRelatedPortfolioSlug(ctx, portfolio.userId);
      }
    }
    await recomputeStats(ctx);
    return { visibility };
  },
});

/** Keep the shareable /tutor/<slug>-style user slug mirrored for the owner. */
async function ensureRelatedPortfolioSlug(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user || user.slug) return;
  const slug = await uniqueSlug(ctx, ownerName(user));
  await ctx.db.patch(userId, { slug });
}

/** Change the public URL (/p/<slug>) with a uniqueness guard. */
export const setSlug = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to change your link.");
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!portfolio) throw new Error("Create your portfolio first.");

    const wanted = slugify(slug).slice(0, 40);
    if (wanted.length < 3) {
      throw new Error("Your link needs at least 3 letters, numbers or dashes.");
    }
    const clash = await ctx.db
      .query("portfolios")
      .withIndex("by_slug", (q) => q.eq("slug", wanted))
      .first();
    if (clash && clash._id !== portfolio._id) {
      throw new Error("That link is already taken — try another.");
    }
    await ctx.db.patch(portfolio._id, {
      slug: wanted,
      updatedAt: Date.now(),
    });
    return { slug: wanted };
  },
});

/** Record a public view (owner views and drafts are not counted). */
export const recordView = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!portfolio || portfolio.suspended) return false;
    if (portfolio.visibility === "draft") return false;
    const viewer = await getAuthUserId(ctx);
    if (viewer === portfolio.userId) return false;
    await ctx.db.patch(portfolio._id, { views: portfolio.views + 1 });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Public portfolio page
// ---------------------------------------------------------------------------

export type PublicPortfolioResult =
  | { status: "ok"; portfolio: Doc<"portfolios">; projects: Doc<"portfolioProjects">[]; isOwner: boolean }
  | { status: "draft"; displayName: string; isOwner: boolean }
  | { status: "removed" }
  | { status: "not-found" };

export const publicPortfolio = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<PublicPortfolioResult> => {
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_slug", (q) => q.eq("slug", slugify(slug)))
      .first();
    if (!portfolio) return { status: "not-found" };

    const viewer = await getAuthUserId(ctx);
    const isOwner = !!viewer && viewer === portfolio.userId;

    if (portfolio.suspended && !isOwner) return { status: "removed" };
    if (portfolio.visibility === "draft" && !isOwner) {
      return { status: "draft", displayName: portfolio.displayName, isOwner: false };
    }

    const projects = await ctx.db
      .query("portfolioProjects")
      .withIndex("by_portfolio", (q) => q.eq("portfolioId", portfolio._id))
      .collect();

    return {
      status: "ok",
      portfolio,
      projects: projects
        .filter((p) => !p.removed)
        .sort((a, b) => a.order - b.order),
      isOwner,
    };
  },
});

// ---------------------------------------------------------------------------
// Explore (public discovery)
// ---------------------------------------------------------------------------

export type ExploreCard = {
  _id: Id<"portfolios">;
  slug: string;
  displayName: string;
  headline: string;
  bio: string;
  avatarUrl: string | null;
  template: Doc<"portfolios">["template"];
  accent: string | null;
  location: string | null;
  skills: Doc<"portfolios">["skills"];
  links: Doc<"portfolios">["links"];
  featured: boolean;
  views: number;
  projectCount: number;
  tags: string[];
};

export const explorePortfolios = query({
  args: {
    q: v.optional(v.string()),
    skill: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { q, skill, limit }): Promise<ExploreCard[]> => {
    const cap = Math.min(Math.max(limit ?? 24, 1), 60);
    // Bounded read: newest discoverable portfolios first, then filtered.
    const rows = await ctx.db
      .query("portfolios")
      .withIndex("by_visibility", (i) => i.eq("visibility", "discoverable"))
      .order("desc")
      .take(cap * 4);

    const visible = rows.filter((p) => !p.suspended);
    const needle = (q ?? "").trim().toLowerCase();
    const wantedSkill = (skill ?? "").trim().toLowerCase();

    const cards = await Promise.all(
      visible.map(async (p): Promise<ExploreCard & { search: string }> => {
        const projects = await ctx.db
          .query("portfolioProjects")
          .withIndex("by_portfolio", (i) => i.eq("portfolioId", p._id))
          .collect();
        const live = projects.filter((x) => !x.removed);
        const tags = [
          ...p.skills.map((s) => s.name),
          ...live.flatMap((x) => x.tags),
        ].filter(Boolean);
        return {
          _id: p._id,
          slug: p.slug,
          displayName: p.displayName,
          headline: p.headline ?? "",
          bio: p.bio ?? "",
          avatarUrl: p.avatarUrl ?? null,
          template: p.template,
          accent: p.accent ?? null,
          location: p.location ?? null,
          skills: p.skills,
          links: p.links,
          featured: p.featured,
          views: p.views,
          projectCount: live.length,
          tags: Array.from(new Set(tags)).slice(0, 12),
          search: [
            p.displayName,
            p.headline ?? "",
            p.bio ?? "",
            p.location ?? "",
            ...tags,
            ...live.map((x) => x.title),
          ]
            .join(" ")
            .toLowerCase(),
        };
      }),
    );

    const filtered = cards.filter((c) => {
      if (wantedSkill && !c.search.includes(wantedSkill)) return false;
      if (needle && !c.search.includes(needle)) return false;
      return true;
    });

    return filtered
      .sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return b.views - a.views;
      })
      .slice(0, cap)
      .map(({ search: _search, ...card }) => card);
  },
});

/** Distinct skills currently on discoverable portfolios (Explore filters). */
export const exploreSkills = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("portfolios")
      .withIndex("by_visibility", (i) => i.eq("visibility", "discoverable"))
      .take(200);
    const counts = new Map<string, number>();
    for (const p of rows) {
      if (p.suspended) continue;
      for (const s of p.skills) {
        const key = s.name.trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 18)
      .map(([name, count]) => ({ name, count }));
  },
});

// ---------------------------------------------------------------------------
// Explore — showcased work (project cards with their creator attached)
// ---------------------------------------------------------------------------

/** Fallback filter chips so Explore always shows a usable set. */
export const DEFAULT_EXPLORE_CATEGORIES = [
  "Web",
  "Design",
  "Video",
  "Branding",
  "Mobile App",
] as const;

export type ExploreProjectCard = {
  _id: Id<"portfolioProjects">;
  title: string;
  summary: string;
  category: string | null;
  imageUrl: string | null;
  tags: string[];
  liveUrl: string | null;
  year: string | null;
  featured: boolean;
  createdAt: number;
  owner: {
    slug: string;
    displayName: string;
    headline: string;
    avatarUrl: string | null;
  };
};

/**
 * Public feed of showcased work from discoverable portfolios. Only work
 * inside a discoverable, non-suspended portfolio is ever returned.
 */
export const exploreProjects = query({
  args: {
    q: v.optional(v.string()),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { q, category, limit }): Promise<ExploreProjectCard[]> => {
    const cap = Math.min(Math.max(limit ?? 30, 1), 60);

    // Bounded reads: discoverable owners first, then their newest work.
    const portfolios = await ctx.db
      .query("portfolios")
      .withIndex("by_visibility", (i) => i.eq("visibility", "discoverable"))
      .order("desc")
      .take(150);
    const owners = new Map(
      portfolios.filter((p) => !p.suspended).map((p) => [p._id, p] as const),
    );
    if (owners.size === 0) return [];

    const rows = await ctx.db
      .query("portfolioProjects")
      .withIndex("by_createdAt")
      .order("desc")
      .take(cap * 8);

    const needle = (q ?? "").trim().toLowerCase();
    const wantedCat = (category ?? "").trim().toLowerCase();

    return rows
      .filter((p) => !p.removed && owners.has(p.portfolioId))
      .map((p) => {
        const owner = owners.get(p.portfolioId)!;
        return {
          _id: p._id,
          title: p.title,
          summary: p.summary,
          category: p.category ?? null,
          imageUrl: p.imageUrl ?? null,
          tags: p.tags,
          liveUrl: p.liveUrl ?? null,
          year: p.year ?? null,
          featured: p.featured,
          createdAt: p.createdAt,
          owner: {
            slug: owner.slug,
            displayName: owner.displayName,
            headline: owner.headline ?? "",
            avatarUrl: owner.avatarUrl ?? null,
          },
          search: [
            p.title,
            p.summary,
            p.category ?? "",
            p.year ?? "",
            owner.displayName,
            owner.headline ?? "",
            ...p.tags,
          ]
            .join(" ")
            .toLowerCase(),
        };
      })
      .filter((c) => {
        if (
          wantedCat &&
          (c.category ?? "").trim().toLowerCase() !== wantedCat
        ) {
          return false;
        }
        if (needle && !c.search.includes(needle)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return b.createdAt - a.createdAt;
      })
      .slice(0, cap)
      .map(({ search: _search, ...card }) => card);
  },
});

/** Category chips for Explore: real categories first, padded with defaults. */
export const exploreCategories = query({
  args: {},
  handler: async (ctx): Promise<{ name: string; count: number }[]> => {
    const portfolios = await ctx.db
      .query("portfolios")
      .withIndex("by_visibility", (i) => i.eq("visibility", "discoverable"))
      .take(150);
    const allowed = new Set(
      portfolios.filter((p) => !p.suspended).map((p) => p._id),
    );

    const rows = await ctx.db
      .query("portfolioProjects")
      .withIndex("by_createdAt")
      .order("desc")
      .take(400);

    const counts = new Map<string, { name: string; count: number }>();
    for (const p of rows) {
      if (p.removed || !allowed.has(p.portfolioId)) continue;
      const name = (p.category ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { name, count: 1 });
    }

    const out = Array.from(counts.values()).sort((a, b) => b.count - a.count);
    const seen = new Set(counts.keys());
    for (const name of DEFAULT_EXPLORE_CATEGORIES) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, count: 0 });
    }
    return out.slice(0, 10);
  },
});

/** Featured discoverable portfolios (landing page showcase). */
export const featuredPortfolios = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const cap = Math.min(Math.max(limit ?? 6, 1), 12);
    const rows = await ctx.db
      .query("portfolios")
      .withIndex("by_featured", (q) => q.eq("featured", true))
      .take(cap * 3);
    return rows
      .filter((p) => !p.suspended && p.visibility === "discoverable")
      .slice(0, cap)
      .map((p) => ({
        _id: p._id,
        slug: p.slug,
        displayName: p.displayName,
        headline: p.headline ?? "",
        avatarUrl: p.avatarUrl ?? null,
        template: p.template,
        accent: p.accent ?? null,
        skills: p.skills.slice(0, 4),
        views: p.views,
      }));
  },
});

// ---------------------------------------------------------------------------
// Projects (work items inside a portfolio)
// ---------------------------------------------------------------------------

const PROJECT_LIMIT = 40;

export const createProject = mutation({
  args: {
    title: v.string(),
    summary: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    liveUrl: v.optional(v.string()),
    repoUrl: v.optional(v.string()),
    year: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to add a project.");
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!portfolio) throw new Error("Create your portfolio first.");
    await checkRateLimit(ctx, `project-create:${userId}`, 60, 10 * 60 * 1000);

    const existing = await ctx.db
      .query("portfolioProjects")
      .withIndex("by_portfolio", (q) => q.eq("portfolioId", portfolio._id))
      .collect();
    if (existing.length >= PROJECT_LIMIT) {
      throw new Error(
        `You can showcase up to ${PROJECT_LIMIT} projects — remove one to add another.`,
      );
    }

    const title = args.title.trim().slice(0, 120);
    if (title.length < 2) throw new Error("Give your project a title.");
    const now = Date.now();
    const id = await ctx.db.insert("portfolioProjects", {
      portfolioId: portfolio._id,
      userId,
      title,
      summary: args.summary.trim().slice(0, 300),
      description: args.description?.slice(0, 4000),
      imageUrl: args.imageUrl,
      category: args.category?.trim().slice(0, 40) || undefined,
      tags: (args.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 8),
      liveUrl: args.liveUrl,
      repoUrl: args.repoUrl,
      year: args.year,
      order: existing.length,
      featured: false,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(portfolio._id, { updatedAt: now });
    await recomputeStats(ctx);
    return id;
  },
});

export const updateProject = mutation({
  args: {
    projectId: v.id("portfolioProjects"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    liveUrl: v.optional(v.string()),
    repoUrl: v.optional(v.string()),
    year: v.optional(v.string()),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, { projectId, ...rest }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to edit your projects.");
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      throw new Error("That project isn't yours.");
    }
    const patch: Partial<Doc<"portfolioProjects">> = { updatedAt: Date.now() };
    if (rest.title !== undefined) patch.title = rest.title.trim().slice(0, 120);
    if (rest.summary !== undefined)
      patch.summary = rest.summary.trim().slice(0, 300);
    if (rest.description !== undefined)
      patch.description = rest.description.slice(0, 4000);
    if (rest.imageUrl !== undefined) patch.imageUrl = rest.imageUrl;
    if (rest.category !== undefined)
      patch.category = rest.category.trim().slice(0, 40) || undefined;
    if (rest.tags !== undefined)
      patch.tags = rest.tags.map((t) => t.trim()).filter(Boolean).slice(0, 8);
    if (rest.liveUrl !== undefined) patch.liveUrl = rest.liveUrl;
    if (rest.repoUrl !== undefined) patch.repoUrl = rest.repoUrl;
    if (rest.year !== undefined) patch.year = rest.year;
    if (rest.featured !== undefined) patch.featured = rest.featured;

    await ctx.db.patch(projectId, patch);
    return projectId;
  },
});

export const deleteProject = mutation({
  args: { projectId: v.id("portfolioProjects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to remove a project.");
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      throw new Error("That project isn't yours.");
    }
    await ctx.db.delete(projectId);
    await recomputeStats(ctx);
    return true;
  },
});

/** Reorder the showcase (direction: -1 up, 1 down). */
export const moveProject = mutation({
  args: { projectId: v.id("portfolioProjects"), direction: v.union(v.literal(-1), v.literal(1)) },
  handler: async (ctx, { projectId, direction }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to reorder your projects.");
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      throw new Error("That project isn't yours.");
    }
    const siblings = (
      await ctx.db
        .query("portfolioProjects")
        .withIndex("by_portfolio", (q) => q.eq("portfolioId", project.portfolioId))
        .collect()
    )
      .filter((p) => !p.removed)
      .sort((a, b) => a.order - b.order);

    const index = siblings.findIndex((p) => p._id === projectId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= siblings.length) return false;

    const other = siblings[target];
    await ctx.db.patch(project._id, { order: other.order });
    await ctx.db.patch(other._id, { order: project.order });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Reporting + "Notify me" (public)
// ---------------------------------------------------------------------------

export const notifyMe = mutation({
  args: { product: v.string(), email: v.string() },
  handler: async (ctx, { product, email }) => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
      throw new Error("Enter a valid email address.");
    }
    await checkRateLimit(ctx, `waitlist:${normalized}`, 5, 60 * 60 * 1000);
    const existing = await ctx.db
      .query("productWaitlist")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .collect();
    if (existing.some((r) => r.product === product)) {
      return { ok: true, already: true };
    }
    const userId = await getAuthUserId(ctx);
    await ctx.db.insert("productWaitlist", {
      product,
      email: normalized,
      userId: userId ?? undefined,
      createdAt: Date.now(),
    });
    return { ok: true, already: false };
  },
});

export const reportPortfolio = mutation({
  args: {
    slug: v.string(),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, { slug, reason, details }) => {
    const userId = await getAuthUserId(ctx);
    await checkRateLimit(ctx, `report:${userId ?? slug}`, 5, 60 * 60 * 1000);
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_slug", (q) => q.eq("slug", slugify(slug)))
      .first();
    if (!portfolio) throw new Error("That portfolio no longer exists.");
    await ctx.db.insert("portfolioReports", {
      portfolioId: portfolio._id,
      slug: portfolio.slug,
      reason: reason.slice(0, 120),
      details: details?.slice(0, 1000),
      reportedBy: userId ?? undefined,
      createdAt: Date.now(),
    });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Admin — portfolio & project management (password-gated session)
// ---------------------------------------------------------------------------

export const adminProjectsOverview = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const [portfolios, projects, reports, waitlist] = await Promise.all([
      ctx.db.query("portfolios").collect(),
      ctx.db.query("portfolioProjects").collect(),
      ctx.db.query("portfolioReports").collect(),
      ctx.db.query("productWaitlist").collect(),
    ]);
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
      totals: {
        users: new Set(portfolios.map((p) => p.userId)).size,
        portfolios: portfolios.length,
        published: portfolios.filter((p) => p.visibility !== "draft").length,
        drafts: portfolios.filter((p) => p.visibility === "draft").length,
        discoverable: portfolios.filter((p) => p.visibility === "discoverable").length,
        suspended: portfolios.filter((p) => p.suspended).length,
        featured: portfolios.filter((p) => p.featured).length,
        projects: projects.filter((p) => !p.removed).length,
        views: portfolios.reduce((s, p) => s + p.views, 0),
        newRegistrations: portfolios.filter((p) => p.createdAt > dayAgo).length,
        openReports: reports.filter((r) => !r.resolved).length,
        waitlist: waitlist.length,
      },
      waitlistByProduct: Object.entries(
        waitlist.reduce<Record<string, number>>((acc, w) => {
          acc[w.product] = (acc[w.product] ?? 0) + 1;
          return acc;
        }, {}),
      ).map(([product, count]) => ({ product, count })),
    };
  },
});

export const adminListPortfolios = query({
  args: { token: v.string(), q: v.optional(v.string()) },
  handler: async (ctx, { token, q }) => {
    await requireAdminSession(ctx, token);
    const needle = (q ?? "").trim().toLowerCase();
    const rows = await ctx.db.query("portfolios").order("desc").take(400);
    const filtered = needle
      ? rows.filter((p) =>
          `${p.displayName} ${p.slug} ${p.headline ?? ""} ${p.location ?? ""}`
            .toLowerCase()
            .includes(needle),
        )
      : rows;

    return Promise.all(
      filtered.slice(0, 200).map(async (p) => {
        const [user, projects] = await Promise.all([
          ctx.db.get(p.userId),
          ctx.db
            .query("portfolioProjects")
            .withIndex("by_portfolio", (i) => i.eq("portfolioId", p._id))
            .collect(),
        ]);
        return {
          _id: p._id,
          slug: p.slug,
          displayName: p.displayName,
          headline: p.headline ?? "",
          template: p.template,
          visibility: p.visibility,
          featured: p.featured,
          suspended: p.suspended,
          views: p.views,
          projects: projects.filter((x) => !x.removed).length,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          owner: user
            ? {
                _id: user._id,
                name: user.name ?? ownerName(user),
                email: user.email ?? "",
                suspended: !!user.suspended,
              }
            : null,
        };
      }),
    );
  },
});

export const adminListProjects = query({
  args: { token: v.string(), q: v.optional(v.string()) },
  handler: async (ctx, { token, q }) => {
    await requireAdminSession(ctx, token);
    const needle = (q ?? "").trim().toLowerCase();
    const rows = await ctx.db.query("portfolioProjects").order("desc").take(400);
    const filtered = needle
      ? rows.filter((p) =>
          `${p.title} ${p.summary} ${p.tags.join(" ")}`.toLowerCase().includes(needle),
        )
      : rows;
    return Promise.all(
      filtered.slice(0, 200).map(async (p) => {
        const [portfolio, owner] = await Promise.all([
          ctx.db.get(p.portfolioId),
          ctx.db.get(p.userId),
        ]);
        return {
          _id: p._id,
          title: p.title,
          summary: p.summary,
          tags: p.tags,
          imageUrl: p.imageUrl ?? null,
          liveUrl: p.liveUrl ?? null,
          repoUrl: p.repoUrl ?? null,
          removed: !!p.removed,
          removedReason: p.removedReason ?? null,
          createdAt: p.createdAt,
          portfolioSlug: portfolio?.slug ?? null,
          portfolioName: portfolio?.displayName ?? null,
          ownerName: owner?.name ?? (owner ? ownerName(owner) : null),
        };
      }),
    );
  },
});

export const adminListReports = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const rows = await ctx.db.query("portfolioReports").order("desc").take(200);
    return rows;
  },
});

export const adminListWaitlist = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    return ctx.db.query("productWaitlist").order("desc").take(300);
  },
});

export const adminSetPortfolioVisibility = mutation({
  args: {
    token: v.string(),
    portfolioId: v.id("portfolios"),
    visibility: portfolioVisibilityValidator,
  },
  handler: async (ctx, { token, portfolioId, visibility }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.patch(portfolioId, { visibility, updatedAt: Date.now() });
    await recomputeStats(ctx);
    return true;
  },
});

export const adminToggleFeatured = mutation({
  args: { token: v.string(), portfolioId: v.id("portfolios") },
  handler: async (ctx, { token, portfolioId }) => {
    await requireAdminSession(ctx, token);
    const p = await ctx.db.get(portfolioId);
    if (!p) throw new Error("Portfolio not found.");
    await ctx.db.patch(portfolioId, { featured: !p.featured, updatedAt: Date.now() });
    return !p.featured;
  },
});

export const adminToggleSuspended = mutation({
  args: { token: v.string(), portfolioId: v.id("portfolios") },
  handler: async (ctx, { token, portfolioId }) => {
    await requireAdminSession(ctx, token);
    const p = await ctx.db.get(portfolioId);
    if (!p) throw new Error("Portfolio not found.");
    await ctx.db.patch(portfolioId, { suspended: !p.suspended, updatedAt: Date.now() });
    await recomputeStats(ctx);
    return !p.suspended;
  },
});

export const adminRemoveProject = mutation({
  args: { token: v.string(), projectId: v.id("portfolioProjects"), reason: v.string() },
  handler: async (ctx, { token, projectId, reason }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.patch(projectId, {
      removed: true,
      removedReason: reason.slice(0, 200),
      updatedAt: Date.now(),
    });
    await recomputeStats(ctx);
    return true;
  },
});

export const adminRestoreProject = mutation({
  args: { token: v.string(), projectId: v.id("portfolioProjects") },
  handler: async (ctx, { token, projectId }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.patch(projectId, {
      removed: false,
      removedReason: undefined,
      updatedAt: Date.now(),
    });
    await recomputeStats(ctx);
    return true;
  },
});

export const adminResolveReport = mutation({
  args: { token: v.string(), reportId: v.id("portfolioReports") },
  handler: async (ctx, { token, reportId }) => {
    await requireAdminSession(ctx, token);
    await ctx.db.patch(reportId, { resolved: true, resolvedAt: Date.now() });
    return true;
  },
});

/** Turn a future product on/off without a rebuild. */
export const adminSetFeatureFlag = mutation({
  args: {
    token: v.string(),
    key: v.string(),
    state: v.union(v.literal("active"), v.literal("locked"), v.literal("hidden")),
    label: v.optional(v.string()),
    tagline: v.optional(v.string()),
    comingSoonCopy: v.optional(v.string()),
  },
  handler: async (ctx, { token, key, state, label, tagline, comingSoonCopy }) => {
    await requireAdminSession(ctx, token);
    const fallback = DEFAULT_FLAGS.find((f) => f.key === key);
    if (!fallback) throw new Error("Unknown product.");
    const existing = await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    const value = {
      key,
      label: label ?? existing?.label ?? fallback.label,
      tagline: tagline ?? existing?.tagline ?? fallback.tagline,
      state,
      comingSoonCopy:
        comingSoonCopy ?? existing?.comingSoonCopy ?? fallback.comingSoonCopy,
      order: existing?.order ?? fallback.order,
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.patch(existing._id, value);
    else await ctx.db.insert("featureFlags", value);
    return state;
  },
});

/** Rebuild the Projects rollup on demand (admin button). */
export const adminRefreshStats = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    await recomputeStats(ctx);
    return true;
  },
});
