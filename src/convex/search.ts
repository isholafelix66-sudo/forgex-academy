import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Public site search — queries the REAL published content (courses, roadmaps,
 * prompts, AI resources). No fake data; everything comes from the existing
 * tables the rest of the app reads. Certificates/opportunities resolve to
 * their existing routes via the published announcements/updates feeds.
 */
export const siteSearch = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) {
      return { courses: [], roadmaps: [], prompts: [], resources: [], announcements: [] };
    }

    const [coursesDocs, roadmapsDocs, promptsDocs, resourcesDocs, announcementsDocs] =
      await Promise.all([
        ctx.db.query("courses").collect(),
        ctx.db.query("roadmaps").collect(),
        ctx.db.query("prompts").withIndex("by_published", (x) => x.eq("published", true)).collect(),
        ctx.db.query("aiResources").withIndex("by_published", (x) => x.eq("published", true)).collect(),
        ctx.db.query("announcements").collect(),
      ]);

    const match = (...fields: Array<string | null | undefined>) =>
      fields.some((f) => (f ?? "").toLowerCase().includes(term));

    // ── Courses (published only) ──
    const published = coursesDocs.filter((c) => c.published && !c.archived);
    const courses = published
      .filter((c) => match(c.title, c.subtitle, c.description, ...c.skills))
      .sort((a, b) => b.enrolledCount - a.enrolledCount)
      .slice(0, 8)
      .map((c) => ({
        id: c._id,
        slug: c.slug,
        title: c.title,
        subtitle: c.subtitle,
        difficulty: c.difficulty,
        durationHours: c.durationHours,
        gradient: c.gradient ?? null,
        icon: c.icon ?? null,
        image: c.image ?? null,
      }));

    // ── Roadmaps (all are public) ──
    const roadmaps = roadmapsDocs
      .filter((r) => match(r.name, r.tagline, r.description))
      .slice(0, 6)
      .map((r) => ({
        id: r._id,
        slug: r.slug,
        name: r.name,
        tagline: r.tagline,
        icon: r.icon,
      }));

    // ── Prompts ──
    const prompts = promptsDocs
      .filter((p) => match(p.title, p.description, ...p.tags))
      .sort((a, b) => b.views - a.views)
      .slice(0, 6)
      .map((p) => ({ id: p._id, slug: p.slug, title: p.title, description: p.description }));

    // ── AI resources ──
    const resources = resourcesDocs
      .filter((r) => match(r.title, r.description, r.category))
      .slice(0, 6)
      .map((r) => ({ id: r._id, slug: r.slug, title: r.title, description: r.description }));

    // ── Announcements / opportunities ──
    const announcements = announcementsDocs
      .filter((a) => a.published && match(a.title, a.body))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 4)
      .map((a) => ({
        id: a._id,
        title: a.title,
        body: a.body,
        category: a.category,
        createdAt: a.createdAt,
      }));

    return { courses, roadmaps, prompts, resources, announcements };
  },
});
