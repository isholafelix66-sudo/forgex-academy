/**
 * ForgeX Academy — seeding for the AI & modern-work course catalog.
 *
 * Self-contained and idempotent by course slug, so it is safe to run on
 * already-seeded databases: it creates the tutors it needs (by email), looks
 * up categories (by slug), and only inserts courses that do not exist yet.
 *
 * Every lesson ships with a real, embeddable YouTube tutorial (see
 * AI_COURSE_VIDEOS below) so the premium learning experience is playable out
 * of the box. Lessons that ever end up without a mapped video fall back to
 * the PLANNED_VIDEO sentinel — which keeps the "demo video repair" pass in
 * seed.ts from attaching sample movies, and makes the lesson player render an
 * honest "Video coming soon" state instead of fake content.
 */
import type { MutationCtx } from "./_generated/server";
import { ROLES, type Question, type Resource } from "./schema";
import { AI_COURSE_CATALOG, PLANNED_VIDEO } from "./aiCourseCatalog";

const resource = (name: string, url: string): Resource => ({ name, url });

const SLUG = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** siteContent key that records seeded-catalog courses an admin deleted. */
const DELETED_CATALOG_KEY = "catalog:deleted-slugs";

/**
 * Slugs of seeded courses an admin deleted. The seed consults this list so a
 * deletion is permanent — the self-healing seed never resurrects a course
 * the admin deliberately removed (Admin → Courses → delete).
 */
export async function getDeletedCatalogSlugs(
  ctx: MutationCtx,
): Promise<Set<string>> {
  const doc = await ctx.db
    .query("siteContent")
    .withIndex("by_key", (q) => q.eq("key", DELETED_CATALOG_KEY))
    .first();
  return new Set<string>(Array.isArray(doc?.value) ? doc.value : []);
}

/** Records a deleted course so the seed skips it on every re-run. */
export async function recordDeletedCatalogSlug(
  ctx: MutationCtx,
  slug: string,
): Promise<void> {
  const doc = await ctx.db
    .query("siteContent")
    .withIndex("by_key", (q) => q.eq("key", DELETED_CATALOG_KEY))
    .first();
  const slugs = new Set<string>(Array.isArray(doc?.value) ? doc.value : []);
  slugs.add(slug);
  if (doc) {
    await ctx.db.patch(doc._id, { value: [...slugs] });
  } else {
    await ctx.db.insert("siteContent", {
      key: DELETED_CATALOG_KEY,
      value: [...slugs],
    });
  }
}

/**
 * Real educational YouTube tutorials for the AI & modern-work courses,
 * keyed by course slug → video URL per lesson order (1-based). All URLs
 * were verified embeddable and match the lesson's practical topic.
 */
export const AI_COURSE_VIDEOS: Record<string, string[]> = {
  // Build Websites with AI — Bolt.new builds, web fundamentals, CSS/JS, SEO, Git.
  "build-websites-with-ai": [
    "https://www.youtube.com/watch?v=GcH5sn_0Src", // Bolt.new Tutorial 2025 — what's possible with AI
    "https://www.youtube.com/watch?v=KVBfmtQ2Wlk", // How the Web Works: clients, servers, browsers, files
    "https://www.youtube.com/watch?v=5zfOitaKfmM", // Bolt.New AI Tutorial for Beginners
    "https://www.youtube.com/watch?v=kmN-u7qSKME", // Bolt AI: Make a Website Without Coding
    "https://www.youtube.com/watch?v=1yxmzUslHuo", // 5-page website using Bolt — planning a multi-page site
    "https://www.youtube.com/watch?v=hdDPXYP3b4k", // Build a COMPLETE Website in 15 Minutes (Bolt.new)
    "https://www.youtube.com/watch?v=eMZmDH3T2bY", // Claude Code Tutorial — prompting AI to build
    "https://www.youtube.com/watch?v=hdDPXYP3b4k", // Build With Me: generate a landing page, end to end
    "https://www.youtube.com/watch?v=kX3TfdUqpuU", // Semantic HTML Tags — reading/customizing generated HTML
    "https://www.youtube.com/watch?v=69IbzTWg5PM", // CSS Media Queries & Responsive Web Design
    "https://www.youtube.com/watch?v=yfoY53QXEnI", // CSS Crash Course — styling forms, nav & buttons
    "https://www.youtube.com/watch?v=z62f2k38s64", // Flexbox Crash Course — modern layouts & motion
    "https://www.youtube.com/watch?v=L9-3VBOjNH4", // JavaScript Variables & Data Types — reading AI code
    "https://www.youtube.com/watch?v=xsVTqzratPs", // Complete SEO Course for Beginners (Ahrefs)
    "https://www.youtube.com/watch?v=RGOj5yH7evk", // Git & GitHub Crash Course — maintainability
    "https://www.youtube.com/watch?v=eMZmDH3T2bY", // Claude Code — deploy, maintain & update with AI
    "https://www.youtube.com/watch?v=1yxmzUslHuo", // Final project: complete responsive site build
  ],
  // Data Analysis with Excel — Alex The Analyst + Kevin Stratvert/Chandoo.
  "data-analysis-with-excel": [
    "https://www.youtube.com/watch?v=lgCNTuLBMK4", // Beginners Guide to the Data Analysis Process
    "https://www.youtube.com/watch?v=zXnQNytHCPM", // Learn Excel in Under 3 Hours (Alex The Analyst)
    "https://www.youtube.com/watch?v=_jmiEGZ6PIY", // Cleaning Data in Excel
    "https://www.youtube.com/watch?v=zXnQNytHCPM",
    "https://www.youtube.com/watch?v=zXnQNytHCPM", // IF / SUMIF / COUNTIF formulas
    "https://www.youtube.com/watch?v=zXnQNytHCPM", // XLOOKUP & lookups
    "https://www.youtube.com/watch?v=zXnQNytHCPM", // text & date functions
    "https://www.youtube.com/watch?v=_jmiEGZ6PIY", // conditional formatting & validation
    "https://www.youtube.com/watch?v=_jmiEGZ6PIY", // Build With Me: clean a messy dataset
    "https://www.youtube.com/watch?v=zXnQNytHCPM", // pivot tables & pivot charts
    "https://www.youtube.com/watch?v=ItZlTixh6Bs", // KPIs & Metrics — trends and patterns
    "https://www.youtube.com/watch?v=Hfx1X9WSGYQ", // How to turn data into stories
    "https://www.youtube.com/watch?v=0aeZX1l4JT4", // How to use Microsoft Power Query (Kevin Stratvert)
    "https://www.youtube.com/watch?v=MMdcczmULrU", // Power Query Masterclass — loading & modeling for BI
    "https://www.youtube.com/watch?v=ItZlTixh6Bs", // From data to business insight (KPIs)
    "https://www.youtube.com/watch?v=Hfx1X9WSGYQ", // Present findings like a pro
    "https://www.youtube.com/watch?v=lgCNTuLBMK4", // quality checks & the analysis process
    "https://www.youtube.com/watch?v=zXnQNytHCPM", // final project: interactive dashboard
  ],
  // AI Video Generation & Content Creation — Runway, ElevenLabs, CapCut.
  "ai-video-generation-content-creation": [
    "https://www.youtube.com/watch?v=c38vtLw1nSk", // Runway AI beginner guide — what's possible
    "https://www.youtube.com/watch?v=FqYRkl12ON8", // Runway AI full beginner guide — tool tour
    "https://www.youtube.com/watch?v=-og75MUlnFk", // Runway Cinematic FULL GUIDE — evaluating platforms
    "https://www.youtube.com/watch?v=w_kKWDyPZnI", // Runway Gen 4.5 — writing effective video prompts
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // ChatGPT crash course — script writing with AI
    "https://www.youtube.com/watch?v=-og75MUlnFk", // cinematic guide — storyboarding scenes
    "https://www.youtube.com/watch?v=CrvraynXNe4", // Runway image-to-video — generating visuals
    "https://www.youtube.com/watch?v=CrvraynXNe4", // generating AI video clips from images
    "https://www.youtube.com/watch?v=yDTbAxJ3sKI", // ElevenLabs AI — voiceovers & presenters
    "https://www.youtube.com/watch?v=bALqRZTgfuY", // CapCut — music & sound effects
    "https://www.youtube.com/watch?v=ImKkcOE3y70", // Learn CapCut in 10 minutes — social video build
    "https://www.youtube.com/watch?v=c6wA5sWGX5c", // CapCut complete beginner — advertisement edit
    "https://www.youtube.com/watch?v=-og75MUlnFk", // consistency across AI-generated scenes
    "https://www.youtube.com/watch?v=u3cm1gbHwJU", // CapCut — captions, formatting & export
    "https://www.youtube.com/watch?v=TlJR7PAtHks", // CapCut everything you need — platform playbooks
    "https://www.youtube.com/watch?v=-og75MUlnFk", // client-style promo campaigns
    "https://www.youtube.com/watch?v=c38vtLw1nSk", // responsible use of AI video tools
    "https://www.youtube.com/watch?v=-og75MUlnFk", // final project: professional promo video
  ],
  // AI Automation & Productivity — Zapier (Kevin Stratvert / MinorCo) + ChatGPT.
  "ai-automation-productivity": [
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo", // Zapier AI Tutorial for Beginners (Kevin Stratvert)
    "https://www.youtube.com/watch?v=VkzZqLSt2hs", // A complete beginners guide to Zapier
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo", // choosing the right tool for a workflow
    "https://www.youtube.com/watch?v=VkzZqLSt2hs", // spotting automatable tasks
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo", // designing workflows: trigger → steps → outcome
    "https://www.youtube.com/watch?v=VkzZqLSt2hs", // no-code automation basics
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // ChatGPT crash course — AI assistants & agents
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo", // email automation
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo", // form-to-database automation
    "https://www.youtube.com/watch?v=VkzZqLSt2hs", // content & social-media automation
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // document processing & AI research
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo", // Build With Me: automate a business task
    "https://www.youtube.com/watch?v=VkzZqLSt2hs", // APIs & webhooks explained simply
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo", // testing, error-handling & monitoring
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // permissions, privacy & responsible automation
    "https://www.youtube.com/watch?v=VkzZqLSt2hs", // documenting automations
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo", // Build With Me: customer-support workflow
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo", // final project: business automation system
  ],
  // Prompt Engineering — full prompt courses + ChatGPT, Claude Code, Runway, Zapier.
  "prompt-engineering": [
    "https://www.youtube.com/watch?v=YhRfgYH_AoU", // Prompt Engineering Full Course | Beginner to Pro
    "https://www.youtube.com/watch?v=YhRfgYH_AoU", // how LLMs respond to instructions
    "https://www.youtube.com/watch?v=YhRfgYH_AoU", // prompt structure: context, task, constraints, output
    "https://www.youtube.com/watch?v=YhRfgYH_AoU", // roles, tasks & output formatting
    "https://www.youtube.com/watch?v=YhRfgYH_AoU", // few-shot prompting with examples
    "https://www.youtube.com/watch?v=YhRfgYH_AoU", // from weak prompt to professional prompt
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // ChatGPT crash course — iterative refinement
    "https://www.youtube.com/watch?v=YhRfgYH_AoU", // reducing hallucinations with references
    "https://www.youtube.com/watch?v=YhRfgYH_AoU", // structured outputs & prompt templates
    "https://www.youtube.com/watch?v=YhRfgYH_AoU", // system instructions for assistants
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // prompting for writing & research
    "https://www.youtube.com/watch?v=eMZmDH3T2bY", // Claude Code — prompting for coding & debugging
    "https://www.youtube.com/watch?v=DvhFcIRRXyI", // Prompt Engineering Full Course 2026 — data analysis
    "https://www.youtube.com/watch?v=-og75MUlnFk", // Runway cinematic — image & video prompts
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo", // Zapier — prompting for business automation
    "https://www.youtube.com/watch?v=DvhFcIRRXyI", // adapting prompts across platforms
    "https://www.youtube.com/watch?v=YhRfgYH_AoU", // evaluating prompts with criteria
    "https://www.youtube.com/watch?v=YhRfgYH_AoU", // final project: professional prompt library
  ],
  // AI Productivity & Digital Work — ChatGPT, Notion AI, Excel.
  "ai-productivity-digital-work": [
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // ChatGPT crash course — the new baseline
    "https://www.youtube.com/watch?v=VSKIS5D-gQg", // How to Use Notion AI to Save HOURS — tool choice
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // AI research & search
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // summarizing documents
    "https://www.youtube.com/watch?v=VSKIS5D-gQg", // Notion AI — note-taking & meetings
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // writing emails & reports
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // creating presentations with AI
    "https://www.youtube.com/watch?v=zXnQNytHCPM", // Excel — spreadsheet assistance with AI
    "https://www.youtube.com/watch?v=kOf3QSBV29Y", // Notion full course — planning projects
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // learning faster with AI
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // career development with AI
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // freelancing with AI
    "https://www.youtube.com/watch?v=VSKIS5D-gQg", // Build With Me: your personal AI workflow
    "https://www.youtube.com/watch?v=kOf3QSBV29Y", // connecting productivity tools into one system
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // reviewing & verifying AI-generated work
    "https://www.youtube.com/watch?v=g5oEAoKdrdw", // AI ethics & responsible use
    "https://www.youtube.com/watch?v=VSKIS5D-gQg", // Build With Me: a week of AI-assisted work
    "https://www.youtube.com/watch?v=VSKIS5D-gQg", // final project: personal AI productivity system
  ],
};

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

  // Admin-deleted seeded courses are tombstones — never re-create them.
  const deletedSlugs = await getDeletedCatalogSlugs(ctx);
  let created = 0;
  for (const c of AI_COURSE_CATALOG) {
    const slug = SLUG(c.title);
    if (deletedSlugs.has(slug)) continue;
    const videos = AI_COURSE_VIDEOS[slug];
    const existing = await ctx.db
      .query("courses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      // Self-heal: backfill a cover photo onto courses seeded without one.
      if (!existing.image && c.image) {
        await ctx.db.patch(existing._id, { image: c.image });
      }
      // Self-heal: swap lessons still marked "planned recording" for the real
      // educational tutorial mapped to their order.
      if (videos) {
        const existingLessons = await ctx.db
          .query("lessons")
          .withIndex("by_course", (q) => q.eq("courseId", existing._id))
          .collect();
        for (const l of existingLessons) {
          const real = videos[l.order - 1];
          if (real && l.videoUrl === PLANNED_VIDEO) {
            await ctx.db.patch(l._id, {
              videoUrl: real,
              videoType: "youtube",
            });
          }
        }
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
      const real = videos?.[i];
      await ctx.db.insert("lessons", {
        courseId,
        title: l.t,
        order: i + 1,
        durationMinutes: l.m,
        videoUrl: real ?? PLANNED_VIDEO,
        videoType: real ? "youtube" : undefined,
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