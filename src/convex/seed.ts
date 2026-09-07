import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit } from "./lib";
import { ROLES, type Question, type Resource } from "./schema";
import { PROMPT_CATEGORIES, PROMPT_SEED } from "./promptSeedData";

const VIDS = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
];

const resource = (name: string, url: string): Resource => ({ name, url });

function q(
  type: Question["type"],
  question: string,
  opts: { options?: string[]; answer?: string; points?: number; explanation?: string },
): Question {
  return { type, question, options: opts.options, answer: opts.answer, points: opts.points ?? 1, explanation: opts.explanation };
}

export const ensureSeedData = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }) => {
    // Self-healing seed: check the WHOLE catalog, not just categories. If a
    // first seed ever fails partway (e.g. a deploy-time timeout) it leaves
    // categories behind while courses/roadmaps are still missing — the old
    // "categories exist → skip everything" check would then never repair it,
    // and public pages would stay empty for visitors. Re-running repairs it.
    // ---
    const [existing, anyCourse, anyRoadmap] = await Promise.all([
      ctx.db.query("categories").first(),
      ctx.db.query("courses").first(),
      ctx.db.query("roadmaps").first(),
    ]);

    // Homepage “How it works” video (added after the first seed, so it's
    // guaranteed on both fresh and already-seeded databases). Defaults to the
    // built-in motion film; legacy string URLs are migrated to the object
    // config so an admin-set link is never lost.
    const tv = await ctx.db
      .query("siteContent")
      .withIndex("by_key", (q) => q.eq("key", "tutorialVideo"))
      .first();
    if (!tv) {
      // No demo video by default — the owner adds their own via
      // Admin → Website & branding → Homepage tutorial video. The built-in
      // motion film keeps the section alive until then.
      await ctx.db.insert("siteContent", {
        key: "tutorialVideo",
        value: { mode: "motion", title: "ForgeX in two minutes" },
      });
    } else if (typeof tv.value === "string") {
      await ctx.db.patch(tv._id, {
        value: { mode: "url", url: tv.value },
      });
    } else if (
      typeof tv.value === "object" &&
      tv.value !== null &&
      (tv.value as { url?: unknown }).url ===
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
    ) {
      // Remove the old seeded demo video on databases that already have it,
      // so only videos the admin deliberately added stay.
      await ctx.db.patch(tv._id, {
        value: { mode: "motion", title: "ForgeX in two minutes" },
      });
    }

    // ------------------------------------------------------------------
    // AI Prompt Library — starter categories + Design & Creative prompts.
    // Seeded only when the tables are empty (idempotent + self-healing), so
    // re-running the seed never duplicates them and admin edits are respected.
    // ------------------------------------------------------------------
    const anyPromptCategory = await ctx.db.query("promptCategories").first();
    if (!anyPromptCategory) {
      for (const [i, c] of PROMPT_CATEGORIES.entries()) {
        await ctx.db.insert("promptCategories", {
          name: c.name,
          slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
          description: c.description,
          subcategories: c.subcategories,
          order: i + 1,
        });
      }
    }
    const anyPrompt = await ctx.db.query("prompts").first();
    if (!anyPrompt) {
      const cats = await ctx.db.query("promptCategories").collect();
      const catByName = new Map(cats.map((c) => [c.name, c._id]));
      for (const [i, p] of PROMPT_SEED.entries()) {
        const catId = catByName.get(p.category);
        if (!catId) continue;
        const now = Date.now() - (PROMPT_SEED.length - i) * 86400000; // staggered dates
        await ctx.db.insert("prompts", {
          title: p.title,
          slug: p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
          description: p.description,
          categoryId: catId,
          subcategory: p.subcategory ?? undefined,
          tags: p.tags,
          difficulty: p.difficulty ?? undefined,
          usefulFor: p.usefulFor,
          requiredInputs: p.requiredInputs,
          template: p.template,
          fields: p.fields,
          featured: p.featured === true,
          published: true,
          order: i + 1,
          views: p.views,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (existing && anyCourse && anyRoadmap && !force) return { seeded: false };
    // Hard security: a forced reseed replaces catalog data — cap destructive
    // reseeds at 2 per 10 minutes.
    if (force) {
      await checkRateLimit(
        ctx,
        "seed:force",
        2,
        10 * 60 * 1000,
        "Reseeding is rate-limited — try again in a few minutes.",
      );
    }

    // ------------------------------------------------------------------
    // Categories
    // ------------------------------------------------------------------
    // Categories are only inserted when none exist; on a partial seed they're
    // looked up by slug so re-running the seed never duplicates them.
    if (!existing) {
      await ctx.db.insert("categories", {
        name: "Design", slug: "design", icon: "Palette", color: "violet",
        description: "Visual thinking, branding and product design skills.", order: 1,
      });
      await ctx.db.insert("categories", {
        name: "Development", slug: "development", icon: "Code2", color: "lime",
        description: "Build software, websites and APIs from scratch.", order: 2,
      });
      await ctx.db.insert("categories", {
        name: "Data & AI", slug: "data-ai", icon: "BrainCircuit", color: "cyan",
        description: "Analyze data and train intelligent systems.", order: 3,
      });
      await ctx.db.insert("categories", {
        name: "Business", slug: "business", icon: "Briefcase", color: "amber",
        description: "Launch ventures, manage teams and think strategically.", order: 4,
      });
      await ctx.db.insert("categories", {
        name: "Marketing", slug: "marketing", icon: "Megaphone", color: "rose",
        description: "Reach audiences, grow brands and drive demand.", order: 5,
      });
    }
    const catBySlug = async (slug: string) => {
      const c = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      return c!._id;
    };
    const catDesign = await catBySlug("design");
    const catDev = await catBySlug("development");
    const catData = await catBySlug("data-ai");
    const catBiz = await catBySlug("business");
    const catMkt = await catBySlug("marketing");

    // ------------------------------------------------------------------
    // Roadmaps
    // ------------------------------------------------------------------
    const mkRoadmap = async (
      name: string, slug: string, tagline: string, description: string,
      icon: string, color: string, featured: boolean,
      levels: Array<[string, string]>,
    ) => {
      const existingRm = await ctx.db
        .query("roadmaps")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (existingRm) {
        // Reuse the existing roadmap and its levels (partial-seed repair).
        const lvlDocs = await ctx.db
          .query("roadmapLevels")
          .withIndex("by_roadmap", (q) => q.eq("roadmapId", existingRm._id))
          .collect();
        return { id: existingRm._id, levelIds: lvlDocs.map((l) => l._id) };
      }
      const id = await ctx.db.insert("roadmaps", {
        name, slug, tagline, description, icon, color, featured,
      });
      const levelIds: string[] = [];
      for (const [i, [title, ldesc]] of levels.entries()) {
        levelIds.push(
          await ctx.db.insert("roadmapLevels", {
            roadmapId: id, title, description: ldesc, order: i + 1,
          }),
        );
      }
      return { id, levelIds };
    };

    const design = await mkRoadmap(
      "Digital Design", "digital-design",
      "From first principles to a portfolio that lands opportunities.",
      "A guided path from design fundamentals to a polished, certified portfolio ready for internships and jobs.",
      "Palette", "violet", true,
      [
        ["Design Fundamentals", "Visual language, color, typography and layout."],
        ["Branding", "Identity systems, logo design and brand strategy."],
        ["UI Design", "Interfaces, design systems and usability."],
        ["Portfolio", "Case studies, presentation and self-marketing."],
        ["Certification", "Final project and verified certificate."],
      ],
    );
    const webdev = await mkRoadmap(
      "Web Development", "web-development",
      "Go from zero to full-stack builder.",
      "A project-driven journey across HTML, CSS, JavaScript and modern full-stack engineering.",
      "Code2", "lime", true,
      [
        ["Web Basics", "HTML, CSS and how the web works."],
        ["Frontend", "JavaScript, React and interactive interfaces."],
        ["Backend", "APIs, databases and server logic."],
        ["Full-Stack", "Ship a complete product end-to-end."],
        ["Certification", "Final build + verified certificate."],
      ],
    );
    const data = await mkRoadmap(
      "Data Analytics", "data-analytics",
      "Turn raw data into decisions.",
      "Learn to collect, clean, analyze and visualize data — then model it with machine learning.",
      "BarChart3", "cyan", false,
      [
        ["Beginner", "Analytics thinking and spreadsheet foundations."],
        ["Intermediate", "SQL, statistics and data wrangling."],
        ["Advanced", "Python, visualization and storytelling."],
        ["Professional", "Machine learning and production pipelines."],
        ["Expert", "Capstone + verified certificate."],
      ],
    );
    const marketing = await mkRoadmap(
      "Digital Marketing", "digital-marketing",
      "Grow brands people remember.",
      "From marketing fundamentals to performance growth playbooks used by real startups.",
      "Megaphone", "rose", false,
      [
        ["Fundamentals", "Positioning, audiences and channels."],
        ["Strategy", "Campaign planning and messaging."],
        ["Execution", "Content, social and paid media."],
        ["Growth", "Analytics, optimization and scale."],
        ["Certification", "Growth plan + verified certificate."],
      ],
    );

    // ------------------------------------------------------------------
    // Tutors
    // ------------------------------------------------------------------
    const mkTutor = async (
      name: string, email: string, headline: string, bio: string,
      skills: string[], socials: Record<string, string>,
    ) => {
      const existingTutor = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      if (existingTutor) return existingTutor._id;
      return await ctx.db.insert("users", {
        name, email, role: ROLES.TUTOR, verified: true, headline, bio, skills,
        socials, streak: 0, streakLastDay: 0, badges: [], isSeed: true,
      });
    };

    const tAmara = await mkTutor(
      "Amara Okafor", "amara@forgex.academy",
      "Product Designer · ex-IBM",
      "Amara spent 8 years designing enterprise products at IBM and now teaches design with a focus on craft, clarity and career growth. Her students have landed roles at Figma, Paystack and Flutterwave.",
      ["Product Design", "Design Systems", "Figma", "Career Coaching"],
      { website: "https://amara.design", linkedin: "https://linkedin.com/in/amaraokafor", twitter: "https://x.com/amara_okafor" },
    );
    const tDaniel = await mkTutor(
      "Daniel Mensah", "daniel@forgex.academy",
      "Full-Stack Engineer · ex-Google",
      "Daniel builds for the web at scale and believes anyone can learn to code with the right path. He teaches JavaScript, React and backend engineering with real projects.",
      ["JavaScript", "React", "Node.js", "System Design"],
      { website: "https://danielcodes.dev", github: "https://github.com/danielmensah", linkedin: "https://linkedin.com/in/danielmensah" },
    );
    const tLayla = await mkTutor(
      "Layla Haddad", "layla@forgex.academy",
      "Data Scientist · Fintech",
      "Layla turns messy data into product decisions at a fintech unicorn. Her courses are hands-on: you learn by analyzing real datasets and shipping dashboards.",
      ["SQL", "Python", "Machine Learning", "Data Viz"],
      { website: "https://laylahaddad.com", linkedin: "https://linkedin.com/in/laylahaddad", twitter: "https://x.com/layla_data" },
    );
    const tMarcus = await mkTutor(
      "Marcus Chen", "marcus@forgex.academy",
      "Growth Marketer · 3x founder",
      "Marcus has scaled user bases from zero to millions across three startups. He teaches marketing that ties directly to revenue and growth experiments.",
      ["Growth", "SEO", "Paid Media", "Content Strategy"],
      { website: "https://marcusgrowth.com", linkedin: "https://linkedin.com/in/marcuschen", twitter: "https://x.com/marcusgrows" },
    );
    const tSofia = await mkTutor(
      "Sofia Reyes", "sofia@forgex.academy",
      "Brand Designer · Studio founder",
      "Sofia runs a boutique brand studio and has crafted identities for 40+ startups. She teaches branding as strategy, not decoration.",
      ["Branding", "Logo Design", "Art Direction", "Typography"],
      { website: "https://sofiareyes.studio", instagram: "https://instagram.com/sofia.brand", linkedin: "https://linkedin.com/in/sofiareyes" },
    );
    const tTunde = await mkTutor(
      "Tunde Bakare", "tunde@forgex.academy",
      "Founder & Investor",
      "Tunde built and exited a logistics company, then became an angel investor and mentor. He teaches entrepreneurship the practical way.",
      ["Startups", "Business Models", "Fundraising", "Leadership"],
      { website: "https://tundebakare.com", linkedin: "https://linkedin.com/in/tundebakare", twitter: "https://x.com/tunde_builds" },
    );

    // ------------------------------------------------------------------
    // Courses + lessons + quizzes + assignments
    // ------------------------------------------------------------------
    const mkCourse = async (c: {
      title: string; subtitle: string; description: string; long: string;
      categoryId: string; tutorId: string; roadmapId?: string; levelId?: string;
      difficulty: "beginner" | "intermediate" | "advanced" | "professional" | "expert";
      hours: number; rating: number; ratingCount: number; gradient: string; icon: string; image: string;
      prerequisites: string[]; skills: string[]; featured: boolean;
      lessons: Array<{ t: string; m: number; n: string; tr: string; r?: Array<[string, string]> }>;
      quizzes: Array<{ t: string; d: string; time: number; qs: Question[] }>;
      assignment?: { t: string; d: string; i: string; days: number };
    }) => {
      const slug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const existingCourse = await ctx.db
        .query("courses")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (existingCourse) {
        // Self-heal: backfill a real cover photo onto courses seeded before
        // covers existed, so existing databases get them without a wipe.
        if (!existingCourse.image && c.image) {
          await ctx.db.patch(existingCourse._id, { image: c.image });
        }
        return existingCourse._id;
      }
      const courseId = await ctx.db.insert("courses", {
        title: c.title, slug, subtitle: c.subtitle,
        description: c.description, longDescription: c.long,
        categoryId: c.categoryId as never, tutorId: c.tutorId as never,
        roadmapId: c.roadmapId as never, levelId: c.levelId as never,
        difficulty: c.difficulty, durationHours: c.hours,
        rating: c.rating, ratingCount: c.ratingCount,
        gradient: c.gradient, icon: c.icon, image: c.image,
        prerequisites: c.prerequisites, skills: c.skills,
        featured: c.featured, published: true,
        enrolledCount: Math.floor(120 + Math.random() * 900),
        createdAt: Date.now() - Math.floor(Math.random() * 40000000),
      });
      for (const [i, l] of c.lessons.entries()) {
        await ctx.db.insert("lessons", {
          courseId: courseId as never, title: l.t, order: i + 1,
          durationMinutes: l.m, videoUrl: VIDS[i % VIDS.length], videoType: "mp4",
          notes: l.n, transcript: l.tr,
          resources: (l.r ?? []).map(([n, u]) => resource(n, u)),
        });
      }
      for (const quiz of c.quizzes) {
        await ctx.db.insert("quizzes", {
          courseId: courseId as never, tutorId: c.tutorId as never,
          title: quiz.t, description: quiz.d,
          timeLimitMinutes: quiz.time, questions: quiz.qs, createdAt: Date.now(),
        });
      }
      if (c.assignment) {
        await ctx.db.insert("assignments", {
          courseId: courseId as never, tutorId: c.tutorId as never,
          title: c.assignment.t, description: c.assignment.d,
          instructions: c.assignment.i,
          deadline: Date.now() + c.assignment.days * 86400000,
          maxScore: 100,
          files: [resource("Assignment brief (PDF)", "https://learn.forgex.academy/brief.pdf")],
          createdAt: Date.now(),
        });
      }
      return courseId;
    };

    // --- Design roadmap courses ---
    await mkCourse({
      title: "Design Fundamentals", subtitle: "See like a designer, think like a designer",
      description: "Master the building blocks of visual design: color, typography, layout and composition — then apply them to real briefs.",
      long: "This course is your first step into the world of design. You'll learn the core principles every designer uses daily: hierarchy, balance, contrast and rhythm. Through hands-on exercises, you'll train your eye, understand how color and type communicate, and finish with a mini-brand project you can put in your portfolio.",
      categoryId: catDesign, tutorId: tAmara, roadmapId: design.id, levelId: design.levelIds[0],
      difficulty: "beginner", hours: 8, rating: 4.8, ratingCount: 412, gradient: "violet", icon: "👁️", image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&q=80",
      prerequisites: [], skills: ["Color theory", "Typography", "Composition", "Visual hierarchy", "Figma basics"],
      featured: true,
      lessons: [
        { t: "Welcome to Design Fundamentals", m: 12, n: "Course structure, materials and how to get the most from the program.", tr: "We'll cover the roadmap, the design briefs you'll complete, and the tools you need to install. Download the workbook from resources.", r: [["Workbook (PDF)", "https://learn.forgex.academy/workbook.pdf"]] },
        { t: "The Elements of Design", m: 18, n: "Line, shape, form, space, texture and value — the raw materials of every composition.", tr: "Elements are the ingredients; principles are the recipe. Learn to spot elements in the world around you and use them deliberately in your work.", r: [["Cheat sheet", "https://learn.forgex.academy/elements.pdf"]] },
        { t: "Color: Theory & Emotion", m: 22, n: "Color wheels, harmonies, psychology and accessibility contrast.", tr: "We break down hue, saturation and value, explore classic harmonies, and look at how brands use color to trigger emotion. Always check contrast for accessibility." },
        { t: "Typography That Works", m: 20, n: "Type anatomy, pairing, hierarchy and legibility systems.", tr: "Great type is invisible. Learn to pair serif and sans, build a type scale, and set comfortable reading experiences." },
        { t: "Composition & Layout", m: 24, n: "Grids, alignment, whitespace and the rule of thirds.", tr: "Grids give structure; whitespace gives breathing room. We'll rebuild a cluttered poster into a calm, focused layout." },
        { t: "Mini Brand: Putting It Together", m: 26, n: "Capstone exercise: design a one-page brand identity system.", tr: "You'll apply everything to a fictional coffee brand: palette, type system and a simple logo mark. This becomes portfolio piece #1." },
      ],
      quizzes: [
        {
          t: "Design Fundamentals Checkpoint", d: "Verify you've got the essentials.", time: 10,
          qs: [
            q("multiple-choice", "Which color harmony uses colors opposite each other on the wheel?", { options: ["Analogous", "Complementary", "Triadic", "Monochromatic"], answer: "Complementary", points: 2, explanation: "Complementary colors sit opposite each other on the color wheel." }),
            q("true-false", "Hierarchy helps viewers know where to look first.", { options: ["True", "False"], answer: "True", points: 1 }),
            q("multiple-choice", "What does contrast primarily improve?", { options: ["Aesthetics only", "Readability and emphasis", "File size", "Color saturation"], answer: "Readability and emphasis", points: 2 }),
            q("short-answer", "Name one principle of design you used in your mini brand.", { answer: "", points: 3 }),
          ],
        },
      ],
      assignment: {
        t: "Design a one-page brand identity", d: "Create a one-page identity board for a local business of your choice.",
        i: "Pick a local business. Design a one-page brand board showing: a logo concept, 2 colors with hex codes, a type pairing, and 2-3 mock applications. Submit a link to your Figma/Canva file or a PDF. Uploaded images are also welcome.",
        days: 10,
      },
    });

    await mkCourse({
      title: "Branding Essentials", subtitle: "Turn ideas into unforgettable identities",
      description: "Learn how strategy becomes identity: research, naming, logos, voice and brand guidelines.",
      long: "Branding is strategy made visible. This course takes you through the full identity process — from audience research and positioning, to logo exploration, color and type systems, and finally brand guidelines that keep a brand consistent everywhere it shows up.",
      categoryId: catDesign, tutorId: tSofia, roadmapId: design.id, levelId: design.levelIds[1],
      difficulty: "beginner", hours: 10, rating: 4.7, ratingCount: 289, gradient: "fuchsia", icon: "🧬", image: "https://images.unsplash.com/photo-1634942537034-2531766767d1?w=1200&q=80",
      prerequisites: ["Design Fundamentals"], skills: ["Brand strategy", "Logo design", "Brand voice", "Guidelines", "Presentation"],
      featured: false,
      lessons: [
        { t: "What Branding Actually Is", m: 14, n: "Brand vs logo: identity as a system of meaning.", tr: "A logo is a mark; a brand is the feeling people have. We start by defining the difference and why strategy comes first." },
        { t: "Research & Positioning", m: 20, n: "Audiences, competitors, and the positioning statement.", tr: "Interviews, competitive audits and positioning statements are the raw materials of identity. You'll write one for your own brand." },
        { t: "Logo Design Process", m: 24, n: "Moodboards, sketching, iteration and vectorizing.", tr: "From 50 rough sketches to 3 refined concepts to one final mark — the classic designer's funnel." },
        { t: "Color, Type & Voice", m: 18, n: "Assembling the toolkit that makes a brand consistent.", tr: "Palette, type system, tone of voice. Consistent use is what makes a brand feel premium." },
        { t: "Brand Guidelines & Handoff", m: 16, n: "Document your system so anyone can apply it.", tr: "A guideline deck protects the brand. Learn what to include and how to present it to clients." },
      ],
      quizzes: [
        {
          t: "Branding Essentials Quiz", d: "Strategy before style.", time: 8,
          qs: [
            q("multiple-choice", "What should come first in a branding project?", { options: ["Logo sketches", "Research & positioning", "Color palette", "Business cards"], answer: "Research & positioning", points: 2 }),
            q("true-false", "A brand is the same thing as its logo.", { options: ["True", "False"], answer: "False", points: 2, explanation: "The logo is a mark; the brand is the entire experience." }),
            q("short-answer", "Write a one-sentence positioning statement for a brand you admire.", { answer: "", points: 3 }),
          ],
        },
      ],
      assignment: {
        t: "Rebrand a local café", d: "Full identity: positioning to guidelines.",
        i: "Choose a local café. Deliver: positioning statement, moodboard, 1 final logo concept, brand palette, and a 5-slide guideline deck. Submit a PDF or a link to your presentation.",
        days: 12,
      },
    });

    await mkCourse({
      title: "UI Design Mastery", subtitle: "Design interfaces people love to use",
      description: "Design systems, component thinking, prototyping and usability — the full UI toolkit.",
      long: "Interfaces are everywhere, and the bar for quality is high. This course teaches you to design web and mobile interfaces with confidence: information architecture, wireframes, high-fidelity UI, design systems, prototyping in Figma, and usability testing.",
      categoryId: catDesign, tutorId: tAmara, roadmapId: design.id, levelId: design.levelIds[2],
      difficulty: "intermediate", hours: 14, rating: 4.9, ratingCount: 533, gradient: "sky", icon: "🖥️", image: "https://images.unsplash.com/photo-1559028012-481c04fa702d?w=1200&q=80",
      prerequisites: ["Design Fundamentals", "Branding Essentials"], skills: ["Wireframing", "Figma", "Design systems", "Prototyping", "Usability testing"],
      featured: true,
      lessons: [
        { t: "Information Architecture", m: 16, n: "Organize content so users never get lost.", tr: "Sitemaps, user flows and card sorting. Good IA is invisible — bad IA is a maze." },
        { t: "Wireframes & Low-Fi Prototypes", m: 20, n: "Layout first, polish later.", tr: "Quick grayscale wireframes let you test structure before investing in pixels." },
        { t: "High-Fidelity UI in Figma", m: 26, n: "From wireframe to polished screen: spacing, states and detail.", tr: "We build a real screen component by component, obsessing over the details that make UI feel professional." },
        { t: "Design Systems & Components", m: 22, n: "Tokens, components and consistency at scale.", tr: "Colors, type scales, spacing tokens and reusable components — the language of scalable design teams." },
        { t: "Prototyping & Handoff", m: 18, n: "Interactions, developer handoff and design specs.", tr: "Turn static screens into clickable prototypes and hand developers everything they need." },
        { t: "Usability Testing Basics", m: 14, n: "Watch real users, learn fast, iterate.", tr: "Five users find most problems. Learn to write tasks, moderate tests and prioritize fixes." },
      ],
      quizzes: [
        {
          t: "UI Design Checkpoint", d: "Systems thinking test.", time: 10,
          qs: [
            q("multiple-choice", "What is a design token?", { options: ["A password for Figma", "A named value like color or spacing", "A kind of font", "A user avatar"], answer: "A named value like color or spacing", points: 2 }),
            q("multiple-choice", "How many users typically find most usability problems?", { options: ["50", "20", "5", "1"], answer: "5", points: 2, explanation: "The classic '5 users' rule from Nielsen." }),
            q("true-false", "Wireframes should include final colors and imagery.", { options: ["True", "False"], answer: "False", points: 1 }),
            q("short-answer", "Describe one state a button component needs (hover, focus, disabled...).", { answer: "", points: 3 }),
          ],
        },
      ],
      assignment: {
        t: "Design a mobile banking screen set", d: "Wireframes → hi-fi → prototype.",
        i: "Design a 3-screen mobile banking flow (home, transfer, confirmation). Include a component sheet with 3 button states. Deliver a Figma link with a clickable prototype.",
        days: 14,
      },
    });

    await mkCourse({
      title: "Portfolio & Career Launchpad", subtitle: "Package your work and land your first role",
      description: "Case studies, personal brand, portfolio sites, interviews and internship applications.",
      long: "Great work won't sell itself. This course turns your projects into a portfolio that hiring managers understand in 30 seconds, builds your personal brand, and prepares you to apply for internships and junior roles with confidence.",
      categoryId: catDesign, tutorId: tSofia, roadmapId: design.id, levelId: design.levelIds[3],
      difficulty: "intermediate", hours: 6, rating: 4.6, ratingCount: 198, gradient: "violet", icon: "🚀", image: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=1200&q=80",
      prerequisites: ["UI Design Mastery"], skills: ["Case studies", "Portfolio sites", "Resume writing", "Interviews", "Job applications"],
      featured: false,
      lessons: [
        { t: "Case Study Anatomy", m: 18, n: "Problem → process → outcome. Tell the story of your work.", tr: "Hiring managers skim case studies. Lead with the problem and the result; keep process tight and visual." },
        { t: "Building Your Portfolio Site", m: 22, n: "Tools, structure, and the 3 projects that matter.", tr: "Three strong, focused projects beat ten shallow ones. We'll structure a one-page site that scrolls beautifully." },
        { t: "Resume & LinkedIn", m: 14, n: "Translate design skills into language recruiters scan.", tr: "Action verbs, measurable outcomes, and a headline that positions you." },
        { t: "Applying & Interviewing", m: 16, n: "Portfolio reviews, whiteboard exercises and salary talks.", tr: "Practice your pitch, handle critiques gracefully, and know what you're worth." },
      ],
      quizzes: [
        {
          t: "Career Launchpad Quiz", d: "Packaging your work.", time: 6,
          qs: [
            q("multiple-choice", "What should a case study lead with?", { options: ["Your tools", "The problem and result", "Your biography", "Client quotes"], answer: "The problem and result", points: 2 }),
            q("true-false", "Three strong projects beat ten shallow ones in a portfolio.", { options: ["True", "False"], answer: "True", points: 2 }),
          ],
        },
      ],
      assignment: {
        t: "Write your first case study", d: "Draft a case study for one portfolio project.",
        i: "Pick your strongest project and write a case study: problem, constraints, process (with 3-5 visuals), and measurable outcome. Submit as a Google Doc / Notion link or PDF.",
        days: 7,
      },
    });

    // --- Development roadmap courses ---
    await mkCourse({
      title: "HTML, CSS & the Modern Web", subtitle: "Build and style your first real web pages",
      description: "Semantic HTML, modern CSS, flexbox, grid, responsive design and deploying your first site.",
      long: "The web is built on three languages you'll master here. Write semantic HTML, style with modern CSS including Flexbox and Grid, make layouts responsive, and deploy a real site to the internet by the end of the course.",
      categoryId: catDev, tutorId: tDaniel, roadmapId: webdev.id, levelId: webdev.levelIds[0],
      difficulty: "beginner", hours: 12, rating: 4.9, ratingCount: 714, gradient: "lime", icon: "🌐", image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&q=80",
      prerequisites: [], skills: ["HTML5", "CSS3", "Flexbox & Grid", "Responsive design", "Deployment"],
      featured: true,
      lessons: [
        { t: "How the Web Works", m: 10, n: "Browsers, servers, URLs and the request cycle.", tr: "Understanding the fundamentals demystifies everything else. We trace a request from your browser to a server and back." },
        { t: "Semantic HTML", m: 20, n: "Structure content with meaning: header, nav, main, article, footer.", tr: "Semantic HTML is good for accessibility, SEO and maintainability. You'll build the skeleton of a real page." },
        { t: "Modern CSS Fundamentals", m: 22, n: "Selectors, cascade, box model and custom properties.", tr: "CSS is a language of rules and inheritance. Custom properties (variables) change the game — we use them everywhere." },
        { t: "Flexbox & Grid", m: 24, n: "The two layout engines that power modern interfaces.", tr: "Flexbox for one-dimensional rows, Grid for two-dimensional layouts. You'll build a responsive card grid." },
        { t: "Responsive Design", m: 18, n: "Media queries, fluid type and mobile-first thinking.", tr: "Design for the smallest screen first, then enhance. Your page will look great on every device." },
        { t: "Ship It: Deploy Your Site", m: 14, n: "Git, GitHub and free hosting so the world can see your work.", tr: "Push your code to GitHub and deploy with free static hosting. You now have a live URL to share." },
      ],
      quizzes: [
        {
          t: "Web Basics Checkpoint", d: "HTML & CSS essentials.", time: 8,
          qs: [
            q("multiple-choice", "Which tag defines the main content of a page?", { options: ["<header>", "<main>", "<div>", "<body>"], answer: "<main>", points: 2 }),
            q("multiple-choice", "What layout tool is best for a two-dimensional grid of cards?", { options: ["Float", "CSS Grid", "Position: absolute", "Table"], answer: "CSS Grid", points: 2 }),
            q("true-false", "Custom properties (CSS variables) can be redefined inside media queries.", { options: ["True", "False"], answer: "True", points: 1 }),
          ],
        },
      ],
      assignment: {
        t: "Build & deploy a personal landing page", d: "A one-page site about you.",
        i: "Create a responsive one-page site: semantic HTML, custom CSS variables, a flexbox nav and a grid of at least 3 project cards. Deploy it and submit the live URL.",
        days: 10,
      },
    });

    await mkCourse({
      title: "JavaScript Deep Dive", subtitle: "The language of the web, properly",
      description: "Variables to async: types, functions, arrays, DOM, events, promises and modules.",
      long: "JavaScript runs everywhere. This course gives you a genuinely deep understanding: values and types, functions and closures, the DOM and events, and the async patterns that power modern apps. You'll build an interactive project as you go.",
      categoryId: catDev, tutorId: tDaniel, roadmapId: webdev.id, levelId: webdev.levelIds[1],
      difficulty: "intermediate", hours: 18, rating: 4.8, ratingCount: 621, gradient: "amber", icon: "⚡", image: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=1200&q=80",
      prerequisites: ["HTML, CSS & the Modern Web"], skills: ["ES2023", "DOM manipulation", "Async/await", "Modules", "Debugging"],
      featured: true,
      lessons: [
        { t: "Values, Types & Variables", m: 18, n: "Primitives, objects, coercion and const/let.", tr: "Everything in JS is a value. Understanding types and coercion prevents a whole class of bugs." },
        { t: "Functions & Closures", m: 22, n: "First-class functions, scope, closures and higher-order functions.", tr: "Functions are values you can pass around. Closures are how JavaScript remembers — this unlocks functional patterns." },
        { t: "The DOM & Events", m: 24, n: "Select, create, update and listen. Build interactive UI.", tr: "The DOM is your API to the page. We build a working to-do list with events and rendering." },
        { t: "Arrays & Objects in Depth", m: 20, n: "map, filter, reduce and modern object patterns.", tr: "Transform data fluently with array methods instead of loops. This is the bread and butter of real codebases." },
        { t: "Async JavaScript", m: 26, n: "Promises, async/await, fetch and error handling.", tr: "The web is async. We fetch real data from an API, handle loading and errors, and render it." },
        { t: "Modules & Tooling", m: 16, n: "import/export, npm and the modern dev workflow.", tr: "Break code into modules, install packages, and meet the tools real developers use daily." },
      ],
      quizzes: [
        {
          t: "JavaScript Checkpoint", d: "Core language test.", time: 12,
          qs: [
            q("multiple-choice", "What does [1,2,3].map(x => x * 2) return?", { options: ["[1,2,3]", "[2,4,6]", "undefined", "NaN"], answer: "[2,4,6]", points: 2 }),
            q("multiple-choice", "Which keyword declares a block-scoped variable that can be reassigned?", { options: ["var", "const", "let", "static"], answer: "let", points: 2 }),
            q("true-false", "await can only be used inside an async function.", { options: ["True", "False"], answer: "True", points: 2 }),
            q("short-answer", "Explain what a closure is in one sentence.", { answer: "", points: 3 }),
          ],
        },
      ],
      assignment: {
        t: "Interactive quiz app", d: "Build an app that asks questions and scores answers.",
        i: "Build a browser quiz app: array of questions, event handling, score tracking, and a results screen. Use at least one higher-order array method and one fetch (or a JSON file). Submit a GitHub link.",
        days: 14,
      },
    });

    await mkCourse({
      title: "Backend APIs with Node", subtitle: "Design, build and document real APIs",
      description: "HTTP, REST, Express-style routing, databases, auth basics and testing APIs.",
      long: "Every app needs a brain. Learn to design clean REST APIs, build servers that handle real traffic, connect to databases, secure routes with authentication, and document everything so other developers love you.",
      categoryId: catDev, tutorId: tDaniel, roadmapId: webdev.id, levelId: webdev.levelIds[2],
      difficulty: "advanced", hours: 16, rating: 4.7, ratingCount: 342, gradient: "lime", icon: "🗄️", image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80",
      prerequisites: ["JavaScript Deep Dive"], skills: ["Node.js", "REST APIs", "Databases", "Auth & security", "API testing"],
      featured: false,
      lessons: [
        { t: "HTTP & REST in Practice", m: 16, n: "Methods, status codes, resources and idempotency.", tr: "REST is a set of conventions, not a framework. Master the verbs and status codes first." },
        { t: "Your First Server", m: 20, n: "Routing, middleware and JSON responses.", tr: "We scaffold a server, add routes, and handle requests and responses cleanly." },
        { t: "Working with Databases", m: 24, n: "Models, CRUD and query patterns.", tr: "Persist data with a database and model your resources. CRUD becomes second nature." },
        { t: "Authentication Basics", m: 22, n: "Passwords, hashing, tokens and protected routes.", tr: "Never store plaintext passwords. We implement hashing, sessions and protected endpoints." },
        { t: "Errors, Validation & Testing", m: 18, n: "Fail loudly and early — then verify it works.", tr: "Input validation, structured errors and a few automated tests turn a demo into a product." },
        { t: "Documenting & Shipping", m: 14, n: "OpenAPI docs, environment config and deployment.", tr: "Document your API, keep secrets out of code, and deploy so others can call it." },
      ],
      quizzes: [
        {
          t: "Backend Checkpoint", d: "APIs and servers.", time: 10,
          qs: [
            q("multiple-choice", "Which HTTP method is typically used to update an existing resource?", { options: ["GET", "POST", "PUT/PATCH", "DELETE"], answer: "PUT/PATCH", points: 2 }),
            q("multiple-choice", "What status code means 'resource not found'?", { options: ["200", "301", "404", "500"], answer: "404", points: 2 }),
            q("true-false", "Passwords should be stored as plain text in your database.", { options: ["True", "False"], answer: "False", points: 2 }),
          ],
        },
      ],
      assignment: {
        t: "Build a task API", d: "Full CRUD API with auth.",
        i: "Build a task-management API: create/list/update/delete tasks, one protected route (login required), validation, and a README with curl examples. Submit a GitHub link.",
        days: 14,
      },
    });

    await mkCourse({
      title: "Full-Stack Project: Build an LMS", subtitle: "Ship a complete product end-to-end",
      description: "The capstone of the web track: a real learning platform with frontend, API, database and deployment.",
      long: "Everything clicks when you build the whole thing. In this capstone you'll build a mini learning-management system: public pages, auth, an admin area, and a database — then deploy it and walk through the architecture in a recorded walkthrough.",
      categoryId: catDev, tutorId: tDaniel, roadmapId: webdev.id, levelId: webdev.levelIds[3],
      difficulty: "advanced", hours: 20, rating: 4.9, ratingCount: 187, gradient: "cyan", icon: "🎓", image: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?w=1200&q=80",
      prerequisites: ["Backend APIs with Node"], skills: ["Full-stack architecture", "Auth flows", "Database design", "Deployment", "Project planning"],
      featured: true,
      lessons: [
        { t: "Planning & Architecture", m: 16, n: "Requirements, data model, and the stack decision.", tr: "Great products start on paper. We define features, sketch the data model, and choose our stack deliberately." },
        { t: "Database & Data Model", m: 22, n: "Users, courses, enrollments — relationships done right.", tr: "We model the core entities and their relationships, then migrate and seed." },
        { t: "Auth & Roles", m: 20, n: "Sign up, sign in, protected routes and role guards.", tr: "Users, sessions and role-based access. Students see the app; admins see the admin." },
        { t: "Building the Product UI", m: 26, n: "Catalog, course pages and the student dashboard.", tr: "We build the public catalog and the dashboard, connecting every screen to real data." },
        { t: "Admin, Testing & Polish", m: 20, n: "Admin screens, edge cases and QA pass.", tr: "Admins manage content; testers break things. We fix the rough edges before launch." },
        { t: "Deploy & Walkthrough", m: 18, n: "Ship it and record the story.", tr: "Deploy to production, then record a 5-minute walkthrough that becomes your capstone deliverable." },
      ],
      quizzes: [
        {
          t: "Full-Stack Capstone Check", d: "Architecture review.", time: 10,
          qs: [
            q("multiple-choice", "Where should role checks like 'admin only' live?", { options: ["Only in the UI", "On the server, in every protected path", "In the database schema only", "In the README"], answer: "On the server, in every protected path", points: 2 }),
            q("multiple-choice", "What is the primary benefit of separating frontend and API concerns?", { options: ["Faster styling", "Independent scaling and clear boundaries", "Fewer files", "No benefit"], answer: "Independent scaling and clear boundaries", points: 2 }),
            q("true-false", "Environment variables should be committed to your repo.", { options: ["True", "False"], answer: "False", points: 1 }),
          ],
        },
      ],
      assignment: {
        t: "Capstone: LMS walkthrough", d: "Deploy and record your build.",
        i: "Deploy your LMS, record a 5-10 minute walkthrough covering architecture, auth, and the student flow, and submit the deploy URL + video link. Include a short architecture diagram.",
        days: 21,
      },
    });

    // --- Data roadmap courses ---
    await mkCourse({
      title: "Data Analytics Foundations", subtitle: "Think with data from day one",
      description: "Analytical thinking, metrics that matter, spreadsheets and your first analysis.",
      long: "Data skills start with questions, not tools. Learn how to frame problems, pick the metrics that matter, work confidently in spreadsheets, and deliver your first clean analysis that people actually understand.",
      categoryId: catData, tutorId: tLayla, roadmapId: data.id, levelId: data.levelIds[0],
      difficulty: "beginner", hours: 10, rating: 4.7, ratingCount: 356, gradient: "cyan", icon: "📊", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
      prerequisites: [], skills: ["Analytical thinking", "Metrics & KPIs", "Spreadsheets", "Data hygiene", "Storytelling"],
      featured: false,
      lessons: [
        { t: "Analytical Thinking", m: 14, n: "Ask better questions before touching data.", tr: "The best analysts are curious and structured. We practice turning vague questions into measurable ones." },
        { t: "Metrics That Matter", m: 18, n: "KPIs, vanity vs actionable metrics, and benchmarking.", tr: "A metric is only useful if it drives a decision. Learn to separate signals from noise." },
        { t: "Spreadsheet Superpowers", m: 24, n: "Formulas, pivots, lookups and clean modeling.", tr: "Spreadsheets are still the world's most-used analytics tool. We go deep on the functions that matter." },
        { t: "Data Hygiene 101", m: 16, n: "Clean data is half the battle: dedupe, validate, document.", tr: "Garbage in, garbage out. We build habits that keep datasets trustworthy." },
        { t: "First Analysis: From Question to Slides", m: 20, n: "Structure an analysis and present it with confidence.", tr: "Framing, analysis, and a tight narrative. You'll present your first insight deck." },
      ],
      quizzes: [
        {
          t: "Foundations Checkpoint", d: "Data thinking basics.", time: 8,
          qs: [
            q("multiple-choice", "What is a 'vanity metric'?", { options: ["A metric that looks impressive but drives no decision", "A metric with no numbers", "A private metric", "A fake metric"], answer: "A metric that looks impressive but drives no decision", points: 2 }),
            q("multiple-choice", "Which spreadsheet tool summarizes data into a table by grouping values?", { options: ["VLOOKUP", "Pivot table", "IF", "CONCAT"], answer: "Pivot table", points: 2 }),
            q("true-false", "Clean data reduces analysis errors more than advanced tools do.", { options: ["True", "False"], answer: "True", points: 2 }),
          ],
        },
      ],
      assignment: {
        t: "Analyze a public dataset", d: "Ask, clean, analyze, present.",
        i: "Choose a public dataset (e.g., from Kaggle or government open data). Define 3 questions, clean the data, answer the questions, and present findings in a 5-slide deck. Submit a link to your sheet + deck.",
        days: 12,
      },
    });

    await mkCourse({
      title: "SQL & Data Wrangling", subtitle: "Query anything, anywhere",
      description: "SELECT everything: joins, aggregations, subqueries, window functions and data cleanup.",
      long: "SQL is the language of data. This course builds real fluency: filtering, joins, aggregations, subqueries, window functions, and the messy art of wrangling raw data into analysis-ready tables.",
      categoryId: catData, tutorId: tLayla, roadmapId: data.id, levelId: data.levelIds[1],
      difficulty: "intermediate", hours: 12, rating: 4.8, ratingCount: 402, gradient: "sky", icon: "🗃️", image: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&q=80",
      prerequisites: ["Data Analytics Foundations"], skills: ["SQL", "Joins", "Aggregations", "Window functions", "Data cleaning"],
      featured: false,
      lessons: [
        { t: "SELECT, FROM, WHERE", m: 18, n: "The query skeleton and filtering with precision.", tr: "Every query starts the same. Master projection and filtering before touching anything advanced." },
        { t: "Joins: Connecting Tables", m: 22, n: "INNER, LEFT, RIGHT and when to reach for each.", tr: "Real data lives in many tables. Joins are how you bring it together without duplicating it." },
        { t: "Aggregations & GROUP BY", m: 20, n: "SUM, COUNT, AVG and grouping by dimension.", tr: "From rows to answers: group, aggregate, and filter groups with HAVING." },
        { t: "Subqueries & CTEs", m: 20, n: "Compose complex questions from simple pieces.", tr: "WITH clauses make monster queries readable. We break hard problems into steps." },
        { t: "Window Functions", m: 22, n: "Rankings, running totals and comparisons across rows.", tr: "Window functions unlock analytics like rank, lag, and rolling averages — the daily tools of data teams." },
        { t: "Wrangling Dirty Data", m: 18, n: "CASE, COALESCE, parsing and deduplication patterns.", tr: "Real data is messy. Learn the standard cleanup moves and when to automate them." },
      ],
      quizzes: [
        {
          t: "SQL Checkpoint", d: "Query fluency.", time: 10,
          qs: [
            q("multiple-choice", "Which JOIN returns all rows from the left table and matches from the right?", { options: ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL OUTER JOIN"], answer: "LEFT JOIN", points: 2 }),
            q("multiple-choice", "Which clause filters groups after aggregation?", { options: ["WHERE", "HAVING", "ORDER BY", "LIMIT"], answer: "HAVING", points: 2 }),
            q("true-false", "A CTE (WITH clause) can make complex queries more readable.", { options: ["True", "False"], answer: "True", points: 1 }),
          ],
        },
      ],
      assignment: {
        t: "Query challenge: sales dataset", d: "10 queries, 1 story.",
        i: "Given a sales dataset, write 10 queries: 3 with joins, 3 aggregations, 2 with CTEs and 2 window functions. Turn the results into one insight. Submit a .sql file or GitHub gist link.",
        days: 10,
      },
    });

    await mkCourse({
      title: "Machine Learning Essentials", subtitle: "From statistics to models that predict",
      description: "Python, pandas, scikit-learn: regression, classification, evaluation and your first models.",
      long: "Machine learning is more approachable than it looks. Using Python, pandas and scikit-learn, you'll learn the core ideas — features, training, evaluation, overfitting — and build real predictive models for classification and regression problems.",
      categoryId: catData, tutorId: tLayla, roadmapId: data.id, levelId: data.levelIds[2],
      difficulty: "advanced", hours: 22, rating: 4.8, ratingCount: 298, gradient: "cyan", icon: "🤖", image: "https://images.unsplash.com/photo-1527430253228-e93688616381?w=1200&q=80",
      prerequisites: ["SQL & Data Wrangling"], skills: ["Python", "pandas", "scikit-learn", "Model evaluation", "Feature engineering"],
      featured: true,
      lessons: [
        { t: "Python for Data", m: 20, n: "Notebooks, pandas and the data workflow.", tr: "A fast tour of the Python data stack: notebooks, DataFrames and the classic load-explore-clean loop." },
        { t: "Exploratory Data Analysis", m: 22, n: "Describe, visualize, hypothesize.", tr: "Plots and statistics that reveal what your data is really saying before any model sees it." },
        { t: "Regression: Predicting Numbers", m: 24, n: "Linear models, error metrics and baseline thinking.", tr: "Always beat a baseline. We train, evaluate with RMSE/MAE, and sanity-check our predictions." },
        { t: "Classification: Predicting Categories", m: 26, n: "Logistic regression, trees, accuracy and confusion matrices.", tr: "Spam or not? Churn or stay? We build classifiers and learn why accuracy can lie." },
        { t: "Overfitting & Validation", m: 22, n: "Train/test splits, cross-validation and regularization.", tr: "Models that memorize don't generalize. We use validation honestly and keep complexity in check." },
        { t: "Feature Engineering & Final Model", m: 24, n: "Turn raw fields into signals, then ship a model.", tr: "Great features beat fancy algorithms. You'll engineer features and deliver a final evaluated model." },
      ],
      quizzes: [
        {
          t: "ML Essentials Checkpoint", d: "Modeling fundamentals.", time: 12,
          qs: [
            q("multiple-choice", "Which metric is best when classes are imbalanced?", { options: ["Accuracy", "F1-score / precision-recall", "RMSE", "Count"], answer: "F1-score / precision-recall", points: 2 }),
            q("multiple-choice", "What does a train/test split prevent?", { options: ["Slow training", "Overfitting and optimistic evaluation", "Data loss", "GPU usage"], answer: "Overfitting and optimistic evaluation", points: 2 }),
            q("true-false", "Adding more features always improves a model.", { options: ["True", "False"], answer: "False", points: 2 }),
            q("short-answer", "Define overfitting in one sentence.", { answer: "", points: 3 }),
          ],
        },
      ],
      assignment: {
        t: "Predict customer churn", d: "Full modeling pipeline.",
        i: "Use a churn dataset: explore, engineer 3 features, train a classification model with proper validation, report precision/recall, and document your process in a notebook. Submit a GitHub/Colab link.",
        days: 16,
      },
    });

    // --- Marketing roadmap courses ---
    await mkCourse({
      title: "Marketing Fundamentals", subtitle: "The modern marketer's toolkit",
      description: "Positioning, audiences, channels, messaging and the marketing funnel.",
      long: "Marketing is understanding people and earning attention. Learn the foundational frameworks: segmentation and personas, positioning, the funnel, and how to choose channels that fit your product and budget.",
      categoryId: catMkt, tutorId: tMarcus, roadmapId: marketing.id, levelId: marketing.levelIds[0],
      difficulty: "beginner", hours: 8, rating: 4.6, ratingCount: 287, gradient: "rose", icon: "🎯", image: "https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=1200&q=80",
      prerequisites: [], skills: ["Positioning", "Personas", "Marketing funnel", "Channel selection", "Messaging"],
      featured: false,
      lessons: [
        { t: "Marketing Is Strategy", m: 14, n: "The difference between marketing, sales and branding.", tr: "Marketing starts before any ad: understanding the customer and deciding what to say." },
        { t: "Audiences & Personas", m: 18, n: "Segment, prioritize, and speak to a real person.", tr: "You can't market to everyone. Build a persona you can address in the first person." },
        { t: "Positioning & Messaging", m: 20, n: "The positioning statement that guides every campaign.", tr: "For [audience], [product] is the [category] that [benefit]. Get this right and everything gets easier." },
        { t: "The Funnel & Channels", m: 18, n: "Awareness → consideration → conversion, and where to show up.", tr: "Different channels play different roles. Map your funnel and pick channels by fit, not hype." },
        { t: "Content & Storytelling", m: 16, n: "Tell stories people want to share.", tr: "The best ads are stories. We study structure, hooks and calls to action." },
      ],
      quizzes: [
        {
          t: "Marketing Checkpoint", d: "Foundations test.", time: 8,
          qs: [
            q("multiple-choice", "What comes first in a marketing strategy?", { options: ["Choosing ad platforms", "Understanding the audience", "Designing logos", "Setting a budget"], answer: "Understanding the audience", points: 2 }),
            q("true-false", "A positioning statement guides every campaign you run.", { options: ["True", "False"], answer: "True", points: 2 }),
            q("multiple-choice", "Which funnel stage does brand awareness advertising mostly target?", { options: ["Conversion", "Retention", "Awareness", "Delivery"], answer: "Awareness", points: 1 }),
          ],
        },
      ],
      assignment: {
        t: "Write a positioning statement", d: "For a product you know.",
        i: "Choose a product you use daily. Research its audience, then write a one-sentence positioning statement plus a persona card. Explain which 2 channels you'd use to reach that audience and why. Submit as a doc link.",
        days: 8,
      },
    });

    await mkCourse({
      title: "Growth & Performance Marketing", subtitle: "Run campaigns that pay for themselves",
      description: "Paid ads, landing pages, A/B testing, analytics and growth loops.",
      long: "Performance marketing is measurable by design. Learn to set up and run paid campaigns, build landing pages that convert, run A/B tests properly, read analytics without fooling yourself, and design growth loops that compound.",
      categoryId: catMkt, tutorId: tMarcus, roadmapId: marketing.id, levelId: marketing.levelIds[2],
      difficulty: "intermediate", hours: 14, rating: 4.7, ratingCount: 244, gradient: "rose", icon: "📈", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80",
      prerequisites: ["Marketing Fundamentals"], skills: ["Paid media", "Conversion optimization", "A/B testing", "Analytics", "Growth loops"],
      featured: false,
      lessons: [
        { t: "The Performance Mindset", m: 14, n: "Every dollar accountable to a number.", tr: "Budget, spend, measure, learn. Performance marketing is a scientific loop, not an art project." },
        { t: "Paid Campaign Setup", m: 22, n: "Structures, targeting, creative testing and budgets.", tr: "We set up a real campaign structure: ad sets, audiences, creative variations and a starting budget." },
        { t: "Landing Pages That Convert", m: 20, n: "Headlines, proof, clarity and one clear CTA.", tr: "Your ad gets the click; your landing page closes the deal. We audit and rebuild one together." },
        { t: "A/B Testing Done Right", m: 18, n: "Hypotheses, sample sizes and reading results honestly.", tr: "Most tests are inconclusive because they run too short. Learn the discipline of valid testing." },
        { t: "Analytics: Read Without Fooling Yourself", m: 20, n: "Attribution, cohorts and the metrics that matter.", tr: "Attribution is hard. We separate what you can learn from what the dashboards pretend to tell you." },
        { t: "Growth Loops", m: 16, n: "Design products that market themselves.", tr: "Referrals, content engines and product-led growth — loops that compound instead of campaigns that stop." },
      ],
      quizzes: [
        {
          t: "Growth Checkpoint", d: "Performance marketing.", time: 10,
          qs: [
            q("multiple-choice", "What's the primary goal of A/B testing?", { options: ["Faster campaigns", "Evidence-based improvement", "Cheaper ads", "More impressions"], answer: "Evidence-based improvement", points: 2 }),
            q("true-false", "A landing page should usually have one clear call to action.", { options: ["True", "False"], answer: "True", points: 1 }),
            q("multiple-choice", "Which metric best measures ad efficiency?", { options: ["Impressions", "CPA / CAC", "Page views", "Follower count"], answer: "CPA / CAC", points: 2 }),
          ],
        },
      ],
      assignment: {
        t: "Design a landing page experiment", d: "Hypothesis + build + plan to measure.",
        i: "Pick a landing page. Write a hypothesis (change → expected effect → metric), redesign the section you'd test, and specify how you'd measure significance. Submit a link to your redesign + one-page plan.",
        days: 10,
      },
    });

    // --- Business course ---
    await mkCourse({
      title: "Entrepreneurship & Lean Startups", subtitle: "Validate, build, launch, learn",
      description: "Problem interviews, MVPs, business models, pricing and pitching.",
      long: "You don't need a perfect plan — you need a process. This course teaches the lean startup method: finding real problems, validating demand before building, creating MVPs, choosing business models, pricing, and pitching investors or customers with confidence.",
      categoryId: catBiz, tutorId: tTunde,
      difficulty: "beginner", hours: 9, rating: 4.8, ratingCount: 264, gradient: "amber", icon: "🚀", image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&q=80",
      prerequisites: [], skills: ["Lean methodology", "Customer interviews", "MVP design", "Business models", "Pitching"],
      featured: true,
      lessons: [
        { t: "Problems Before Products", m: 16, n: "Find a problem worth solving before writing code.", tr: "Great businesses start with painful, frequent problems. We practice interviewing and listening for pain." },
        { t: "Customer Discovery", m: 20, n: "Talk to 20 people before you build anything.", tr: "Discovery interviews are a skill. Ask about behavior and history, not hypotheticals." },
        { t: "The MVP Mindset", m: 18, n: "Smallest experiment that tests your biggest risk.", tr: "What's the riskiest assumption? Build the smallest thing that tests it — even a landing page." },
        { t: "Business Models & Pricing", m: 20, n: "Revenue models, pricing psychology and unit economics.", tr: "Free isn't a model. Explore subscription, marketplace, and one-time models — and price with confidence." },
        { t: "Pitching & Fundraising", m: 16, n: "The narrative, the numbers and the ask.", tr: "Whether it's investors, partners or first customers, you're always pitching. Master the structure." },
      ],
      quizzes: [
        {
          t: "Entrepreneurship Checkpoint", d: "Lean startup essentials.", time: 8,
          qs: [
            q("multiple-choice", "What should you do first with a new idea?", { options: ["Build the full product", "Validate the problem with customers", "Register the company", "Hire a team"], answer: "Validate the problem with customers", points: 2 }),
            q("multiple-choice", "What is an MVP?", { options: ["A buggy prototype", "The smallest experiment that tests your riskiest assumption", "The final product", "A marketing video"], answer: "The smallest experiment that tests your riskiest assumption", points: 2 }),
            q("true-false", "Unit economics matter more than top-line revenue for long-term survival.", { options: ["True", "False"], answer: "True", points: 1 }),
          ],
        },
      ],
      assignment: {
        t: "Pitch deck for your idea", d: "One idea, ten slides.",
        i: "Create a 10-slide pitch deck for an idea you've validated (problem, solution, market, business model, ask). Record a 2-minute pitch video. Submit both links.",
        days: 14,
      },
    });

    // ------------------------------------------------------------------
    // Demo video repair — every demo lesson should be playable. Courses that
    // were seeded before videos existed (or were edited to remove them) get
    // a public sample video attached on every re-run.
    // ------------------------------------------------------------------
    const demoCourses = await ctx.db.query("courses").collect();
    for (const course of demoCourses) {
      const courseLessons = await ctx.db
        .query("lessons")
        .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
        .collect();
      for (const lesson of courseLessons) {
        if (!lesson.videoUrl && !lesson.muxPlaybackId) {
          await ctx.db.patch(lesson._id, {
            videoUrl: VIDS[lesson.order % VIDS.length],
            videoType: "mp4",
          });
        }
      }
    }

    // ------------------------------------------------------------------
    // Announcements
    // ------------------------------------------------------------------
    const existingAdmin = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "team@forgex.academy"))
      .first();
    const adminUser =
      existingAdmin?._id ??
      (await ctx.db.insert("users", {
      name: "ForgeX Team", email: "team@forgex.academy",
      role: ROLES.ADMIN, verified: true, headline: "Academy Operations",
      bio: "The team behind ForgeX Academy.", streak: 0, streakLastDay: 0, badges: [], isSeed: true,
    }));
    const now = Date.now();
    await ctx.db.insert("announcements", {
      authorId: adminUser, title: "Welcome to ForgeX Academy 🎉",
      body: "We're live! ForgeX Academy is the new home of practical, career-focused learning at ForgeX Network. Browse courses, follow a roadmap, earn certificates — and get ready for internships, jobs and scholarships.",
      category: "Announcement", pinned: true, published: true, createdAt: now - 86400000 * 9,
    });
    await ctx.db.insert("announcements", {
      authorId: adminUser, title: "New drop: Machine Learning Essentials",
      body: "Layla Haddad's flagship ML course is now open for enrollment. 22 hours of hands-on modeling with real datasets. Free for all students.",
      category: "News", pinned: false, published: true, createdAt: now - 86400000 * 6,
    });
    await ctx.db.insert("announcements", {
      authorId: adminUser, title: "Design Sprint Competition",
      body: "Rebrand a local business in 48 hours. Top 3 designs win mentorship sessions with Amara Okafor and featured placement in the Academy showcase. Submissions open now.",
      category: "Competition", pinned: true, published: true, createdAt: now - 86400000 * 4,
    });
    await ctx.db.insert("announcements", {
      authorId: adminUser, title: "Scheduled maintenance: Sunday 2:00 AM UTC",
      body: "The Academy will be briefly unavailable for scheduled maintenance. Certificates and progress are unaffected. We expect downtime under 30 minutes.",
      category: "Maintenance", pinned: false, published: true, createdAt: now - 86400000 * 2,
    });
    await ctx.db.insert("announcements", {
      authorId: adminUser, title: "Live Q&A: Land your first internship",
      body: "Join Amara Okafor and Daniel Mensah for a live Q&A on internships, portfolios and applications. Bring your questions! Recording will be shared after.",
      category: "Event", pinned: false, published: true, createdAt: now - 86400000,
    });

    // ------------------------------------------------------------------
    // Updates
    // ------------------------------------------------------------------
    await ctx.db.insert("updates", { type: "new-course", title: "Full-Stack Project: Build an LMS now live", body: "The capstone of the web development roadmap is open. Ship a complete product end-to-end and earn your certificate.", date: now - 86400000 * 7, published: true });
    await ctx.db.insert("updates", { type: "competition", title: "Design Sprint Competition kicks off", body: "48 hours to rebrand a local business. Mentorship prizes for the top three submissions.", date: now - 86400000 * 4, published: true });
    await ctx.db.insert("updates", { type: "event", title: "Live Q&A with our tutors", body: "Internships, portfolios and applications — live with Amara and Daniel.", date: now + 86400000 * 3, published: true });
    await ctx.db.insert("updates", { type: "maintenance", title: "Scheduled platform maintenance", body: "Brief maintenance window on Sunday. 30 minutes max.", date: now + 86400000 * 4, published: true });
    await ctx.db.insert("updates", { type: "platform-news", title: "Certificates now verifiable via QR code", body: "Every certificate now ships with a QR code. Recruiters can verify instantly on our public verification page.", date: now - 86400000 * 2, published: true });
    await ctx.db.insert("updates", { type: "platform-news", title: "Coming next: Opportunity Hub", body: "The ForgeX Network modules — internships, scholarships and mentorship — are in development. Stay tuned.", date: now - 86400000, published: true });

    // ------------------------------------------------------------------
    // Site content
    // ------------------------------------------------------------------
    const content: Array<[string, unknown]> = [
      ["hero", {
        badge: "The learning platform of ForgeX Network",
        title: "Discover. Express. Build.",
        subtitle: "ForgeX Academy turns curiosity into career-ready skills — structured roadmaps, hands-on projects, expert tutors and verifiable certificates. Free to start, forever useful.",
        primaryCta: { label: "Start learning free", link: "/courses" },
        secondaryCta: { label: "Explore roadmaps", link: "/roadmap" },
      }],
      ["mission", "To empower individuals through accessible, practical, and industry-relevant learning that prepares them for real-world opportunities."],
      ["vision", "To become a trusted learning platform where people develop valuable skills, earn credible certifications, and unlock meaningful opportunities."],
      ["about", {
        story: "ForgeX Academy was born inside ForgeX Network — a community built to prepare young people for internships, jobs, scholarships and entrepreneurship. We saw too many learners stuck between tutorials and opportunity: endless free content, but no structure, no feedback and no proof of skill. So we built the missing bridge: structured learning paths, hands-on projects, real tutors, and certificates that actually verify.",
        impact: [
          { value: "100%", label: "Free core courses" },
          { value: "5+", label: "Career roadmaps" },
          { value: "24/7", label: "Learn at your pace" },
          { value: "QR", label: "Verifiable certificates" },
        ],
        values: [
          { title: "Practical first", description: "Every lesson ends in something you build. Theory is a means to applied skill." },
          { title: "Accessible to all", description: "Core learning is free. We exist to remove barriers, not create them." },
          { title: "Industry-relevant", description: "Curricula shaped with practitioners, reviewed against real job requirements." },
          { title: "Proof over promises", description: "Verifiable certificates and portfolios that speak louder than resumes." },
        ],
      }],
      ["upcoming", [
        { name: "Opportunity Hub", description: "One place for internships, jobs, scholarships and competitions matched to your skills.", eta: "Next up" },
        { name: "Recruitment", description: "Companies discover verified ForgeX talent and invite you to apply.", eta: "Soon" },
        { name: "Scholarships", description: "Need-based funding so money is never the reason you stop learning.", eta: "Planned" },
        { name: "Internships", description: "Structured internship placements for students completing their roadmaps.", eta: "Planned" },
        { name: "Volunteer Hub", description: "Real-world projects with nonprofits where you earn credit for your skills.", eta: "Planned" },
        { name: "Mentorship", description: "One-on-one guidance from verified professionals and alumni.", eta: "Planned" },
        { name: "Portfolio Builder", description: "Turn your certificates and projects into a shareable career portfolio.", eta: "Planned" },
        { name: "AI Career Coach", description: "Personalized career advice powered by your progress and goals.", eta: "Planned" },
      ]],
      ["testimonials", [
        { name: "Chidi N.", role: "Completed UI Design Mastery", quote: "I went from watching tutorials to a real internship offer. The roadmap kept me honest and the certificate opened doors.", initials: "CN" },
        { name: "Fatima A.", role: "Completed JavaScript Deep Dive", quote: "The projects were the difference. My portfolio finally shows what I can actually build.", initials: "FA" },
        { name: "Kwame B.", role: "Completed Data Analytics Foundations", quote: "Clear, practical and free. I used the SQL course to land a data analyst role within two months.", initials: "KB" },
        { name: "Zainab O.", role: "Completed Branding Essentials", quote: "The tutor feedback on my assignment was better than anything I got in paid courses.", initials: "ZO" },
      ]],
      ["settings", {
        siteName: "ForgeX Academy",
        tagline: "Discover. Express. Build.",
        supportEmail: "support@forgex.academy",
      }],
    ];
    for (const [key, value] of content) {
      await ctx.db.insert("siteContent", { key, value });
    }

    return { seeded: true };
  },
});
