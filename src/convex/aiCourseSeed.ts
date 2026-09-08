/**
 * ForgeX Academy — seeding for the AI & modern-work course catalog.
 *
 * Self-contained and idempotent by course slug, so it is safe to run on
 * already-seeded databases: it creates the tutors it needs (by email), looks
 * up categories (by slug), and only inserts courses that do not exist yet.
 *
 * Every lesson is stored with the PLANNED_VIDEO sentinel instead of a fake
 * clip. That keeps the "demo video repair" pass in seed.ts from attaching
 * sample movies to these courses, and the lesson player renders an honest
 * "Video coming soon" state until real recordings are uploaded.
 */
import type { MutationCtx } from "./_generated/server";
import { ROLES, type Question, type Resource } from "./schema";
import { AI_COURSE_CATALOG, PLANNED_VIDEO } from "./aiCourseCatalog";

const resource = (name: string, url: string): Resource => ({ name, url });

const SLUG = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Inserts any missing AI & modern-work courses. Returns how many were created. */
export async function seedAiCourses(ctx: MutationCtx): Promise<number> {
  const catBySlug = async (slug: string) => {
    const c = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!c) throw new Error(`seedAiCourses: category "${slug}" not found`);
    return c._id;
  };

  const tutorByEmail = async (
    name: string,
    email: string,
    headline: string,
    bio: string,
    skills: string[],
    socials: Record<string, string>,
  ) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("users", {
      name,
      email,
      role: ROLES.TUTOR,
      verified: true,
      headline,
      bio,
      skills,
      socials,
      streak: 0,
      streakLastDay: 0,
      badges: [],
      isSeed: true,
    });
  };

  // Tutors — created idempotently by email, so the main seed reuses them.
  const tDaniel = await tutorByEmail(
    "Daniel Mensah",
    "daniel@forgex.academy",
    "Full-Stack Engineer · ex-Google",
    "Daniel builds for the web at scale and believes anyone can learn to code with the right path. He teaches JavaScript, React and backend engineering with real projects.",
    ["JavaScript", "React", "Node.js", "System Design"],
    {
      website: "https://danielcodes.dev",
      github: "https://github.com/danielmensah",
      linkedin: "https://linkedin.com/in/danielmensah",
    },
  );
  const tLayla = await tutorByEmail(
    "Layla Haddad",
    "layla@forgex.academy",
    "Data Scientist · Fintech",
    "Layla turns messy data into product decisions at a fintech unicorn. Her courses are hands-on: you learn by analyzing real datasets and shipping dashboards.",
    ["SQL", "Python", "Machine Learning", "Data Viz"],
    {
      website: "https://laylahaddad.com",
      linkedin: "https://linkedin.com/in/laylahaddad",
      twitter: "https://x.com/layla_data",
    },
  );
  const tNneka = await tutorByEmail(
    "Nneka Eze",
    "nneka@forgex.academy",
    "AI Content & Automation Expert",
    "Nneka builds AI-powered content and automation systems for startups and creators. She teaches practical AI workflows — video, automation and productivity — that students can apply the same day.",
    ["AI Video", "AI Automation", "Prompt Engineering", "Productivity Systems"],
    {
      website: "https://nnekaworks.ai",
      linkedin: "https://linkedin.com/in/nnekaeze",
      twitter: "https://x.com/nneka_builds",
    },
  );
  const tutorId = { daniel: tDaniel, layla: tLayla, nneka: tNneka };
  const catId = {
    design: await catBySlug("design"),
    development: await catBySlug("development"),
    "data-ai": await catBySlug("data-ai"),
    business: await catBySlug("business"),
    marketing: await catBySlug("marketing"),
  };

  let created = 0;
  for (const c of AI_COURSE_CATALOG) {
    const slug = SLUG(c.title);
    const existing = await ctx.db
      .query("courses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      // Self-heal: backfill a cover photo onto courses seeded without one.
      if (!existing.image && c.image) {
        await ctx.db.patch(existing._id, { image: c.image });
      }
      continue;
    }

    const courseId = await ctx.db.insert("courses", {
      title: c.title,
      slug,
      subtitle: c.subtitle,
      description: c.description,
      longDescription: c.long,
      categoryId: catId[c.category],
      tutorId: tutorId[c.tutor],
      difficulty: c.difficulty,
      durationHours: c.hours,
      rating: c.rating,
      ratingCount: c.ratingCount,
      gradient: c.gradient,
      icon: c.icon,
      image: c.image,
      prerequisites: c.prerequisites,
      skills: c.skills,
      featured: c.featured,
      published: true,
      enrolledCount: Math.floor(120 + Math.random() * 900),
      createdAt: Date.now() - Math.floor(Math.random() * 40000000),
    });

    for (const [i, l] of c.lessons.entries()) {
      await ctx.db.insert("lessons", {
        courseId,
        title: l.t,
        order: i + 1,
        durationMinutes: l.m,
        videoUrl: PLANNED_VIDEO,
        notes: l.n,
        transcript: l.tr,
        resources: (l.r ?? []).map(([n, u]) => resource(n, u)),
      });
    }

    for (const quiz of c.quizzes) {
      await ctx.db.insert("quizzes", {
        courseId,
        tutorId: tutorId[c.tutor],
        title: quiz.t,
        description: quiz.d,
        timeLimitMinutes: quiz.time,
        questions: quiz.qs as Question[],
        createdAt: Date.now(),
      });
    }

    for (const a of c.assignments) {
      await ctx.db.insert("assignments", {
        courseId,
        tutorId: tutorId[c.tutor],
        title: a.t,
        description: a.d,
        instructions: a.i,
        maxScore: 100,
        files: [resource("Assignment brief (PDF)", "https://learn.forgex.academy/brief.pdf")],
        createdAt: Date.now(),
      });
    }
    created += 1;
  }
  return created;
}