import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit } from "./lib";
import { ROLES, type Question, type Resource } from "./schema";
import { PROMPT_CATEGORIES, PROMPT_SEED } from "./promptSeedData";
import { getDeletedCatalogSlugs, seedAiCourses } from "./aiCourseSeed";
import {
  bankQuestionsFor,
  quizAdditionsFor,
} from "./quizBank";

/**
 * Internal wrapper so the scheduler can re-run the idempotent catalog seed.
 * New courses shipped after a database was first seeded (e.g. the AI &
 * modern-work courses) then appear automatically — no manual action needed.
 * `ensureSeedData.handler` is only referenced at call time, so placing this
 * before its declaration is safe.
 */
export const ensureSeedDataInternal = internalMutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) =>
    // The generated type only exposes the registered function, but the runtime
    // object always carries the plain `handler` — invoke it directly so both
    // the public mutation and this cron wrapper share one implementation.
    (ensureSeedData as unknown as {
      handler: (c: MutationCtx, a: { force?: boolean }) => Promise<{ seeded: boolean }>;
    }).handler(ctx, args),
});

/**
 * Seeded stock-photo cover URLs that have died upstream (deleted Unsplash
 * uploads → HTTP 404 in the browser). The seed swaps any stored course cover
 * that still matches one of these for the fresh seed image, so existing
 * databases self-repair on the next seed run instead of showing broken
 * course images. Admin-uploaded covers never match, so they are never touched.
 */
const KNOWN_DEAD_IMAGE_URLS = [
  "https://images.unsplash.com/photo-1547334411-58a4a0e8e5a5?w=1200&q=80", // Photoshop Mastery / Pro Workflows (pre-2026 fix)
];

/** Replacement cover per course slug for the known-dead URLs above.
 *  `*` is the fallback for courses without a specific replacement. */
const SEED_IMAGE_FIXES: Record<string, string> = {
  "photoshop-mastery":
    "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1200&q=80",
  "photoshop-pro-workflows":
    "https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=1200&q=80",
  "*": "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&q=80",
};

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

/**
 * Every course the seed is expected to provide, by slug. Databases seeded
 * before a course was added to this list must still receive it, so the
 * short-circuit below only fires when the whole catalog is present.
 */
const EXPECTED_COURSE_SLUGS = [
  // Design roadmap
  "design-fundamentals",
  "branding-essentials",
  "ui-design-mastery",
  "portfolio-career-launchpad",
  "professional-graphic-design",
  "photoshop-mastery",
  "video-editing-with-capcut",
  "capcut-pro-editing",
  "capcut-pro-storytelling",
  "photoshop-pro-workflows",
  // Development roadmap
  "html-css-the-modern-web",
  "javascript-deep-dive",
  "backend-apis-with-node",
  "full-stack-project-build-an-lms",
  // Data roadmap
  "data-analytics-foundations",
  "sql-data-wrangling",
  "machine-learning-essentials",
  // Marketing roadmap
  "marketing-fundamentals",
  "growth-performance-marketing",
  // Business
  "entrepreneurship-lean-startups",
  // AI & modern-work courses (added to the catalog after the original seed)
  "build-websites-with-ai",
  "data-analysis-with-excel",
  "ai-video-generation-content-creation",
  "ai-automation-productivity",
  "prompt-engineering",
  "ai-productivity-digital-work",
];

/**
 * Courses whose lessons deliberately ship without videos yet. Their lessons
 * are clearly labelled “video coming soon” in the lesson notes — the demo
 * video repair pass must never attach sample clips to them.
 */
const NO_DEMO_VIDEO_SLUGS = new Set([
  "build-websites-with-ai",
  "data-analysis-with-excel",
  "ai-video-generation-content-creation",
  "ai-automation-productivity",
  "prompt-engineering",
  "ai-productivity-digital-work",
]);

/**
 * Real educational YouTube lessons for the seeded catalog, keyed by course
 * slug → video per lesson order (1-based). Used for fresh seeds and to
 * self-heal existing lessons that still point at placeholder clips.
 */
const REAL_LESSON_VIDEOS: Record<string, string[]> = {
  "ui-design-mastery": [
    "https://www.youtube.com/watch?v=SjbQ21klQP8",
    "https://www.youtube.com/watch?v=6t_dYhXyYjI",
    "https://www.youtube.com/watch?v=XT59i0Nyq-c",
    "https://www.youtube.com/watch?v=_uva2dQPlV8",
    "https://www.youtube.com/watch?v=E-H06QNkHTU",
    "https://www.youtube.com/watch?v=EYUL0N1Fjhg",
  ],
  "design-fundamentals": [
    "https://www.youtube.com/watch?v=YqQx75OPRa0",
    "https://www.youtube.com/watch?v=MshxnTQW4qU",
    "https://www.youtube.com/watch?v=_2LLXnUdUIc",
    "https://www.youtube.com/watch?v=sByzHoiYFX0",
    "https://www.youtube.com/watch?v=a5KYlHNKQB8",
    "https://www.youtube.com/watch?v=tvYDYtQhreo",
  ],
  "branding-essentials": [
    "https://www.youtube.com/watch?v=5D8sWNq-WUI",
    "https://www.youtube.com/watch?v=NPqEdQDraho",
    "https://www.youtube.com/watch?v=4MxRhjHmiVw",
    "https://www.youtube.com/watch?v=VTDycrlT1hI",
    "https://www.youtube.com/watch?v=4n7dC8AcfH8",
  ],
  "portfolio-career-launchpad": [
    "https://www.youtube.com/watch?v=cqHM7pay82E",
    "https://www.youtube.com/watch?v=mmgxspm9JWs",
    "https://www.youtube.com/watch?v=Y7wD38n7yl4",
    "https://www.youtube.com/watch?v=RYssJ_m60vE",
  ],
  "html-css-the-modern-web": [
    "https://www.youtube.com/watch?v=KVBfmtQ2Wlk",
    "https://www.youtube.com/watch?v=kX3TfdUqpuU",
    "https://www.youtube.com/watch?v=yfoY53QXEnI",
    "https://www.youtube.com/watch?v=z62f2k38s64",
    "https://www.youtube.com/watch?v=69IbzTWg5PM",
    "https://www.youtube.com/watch?v=RGOj5yH7evk",
  ],
  "javascript-deep-dive": [
    "https://www.youtube.com/watch?v=L9-3VBOjNH4",
    "https://www.youtube.com/watch?v=1S8SBDhA7HA",
    "https://www.youtube.com/watch?v=5fb2aPlgoys",
    "https://www.youtube.com/watch?v=8MoElay6dWU",
    "https://www.youtube.com/watch?v=VmQ6dHvnKIM",
    "https://www.youtube.com/watch?v=s9kNndJLOjg",
  ],
  "backend-apis-with-node": [
    "https://www.youtube.com/watch?v=Q-BpqyOT3a8",
    "https://www.youtube.com/watch?v=32M1al-Y6Ag",
    "https://www.youtube.com/watch?v=_7UQPve99r4",
    "https://www.youtube.com/watch?v=favjC6EKFgw",
    "https://www.youtube.com/watch?v=8gHEv5iNRKk",
    "https://www.youtube.com/watch?v=5aryMKiBEKY",
  ],
  "full-stack-project-build-an-lms": [
    "https://www.youtube.com/watch?v=9aZcnf2_py0",
    "https://www.youtube.com/watch?v=xsg9BDiwiJE",
    "https://www.youtube.com/watch?v=305q6IJHy0w",
    "https://www.youtube.com/watch?v=O3BUHwfHf84",
    "https://www.youtube.com/watch?v=8Xwq35cPwYg",
    "https://www.youtube.com/watch?v=l134cBAJCuc",
  ],
  "data-analytics-foundations": [
    "https://www.youtube.com/watch?v=lgCNTuLBMK4",
    "https://www.youtube.com/watch?v=ItZlTixh6Bs",
    "https://www.youtube.com/watch?v=zXnQNytHCPM",
    "https://www.youtube.com/watch?v=_jmiEGZ6PIY",
    "https://www.youtube.com/watch?v=Hfx1X9WSGYQ",
  ],
  "sql-data-wrangling": [
    "https://www.youtube.com/watch?v=h0nxCDiD-zg",
    "https://www.youtube.com/watch?v=2HVMiPPuPIM",
    "https://www.youtube.com/watch?v=nNrgRVIzeHg",
    "https://www.youtube.com/watch?v=K1WeoKxLZ5o",
    "https://www.youtube.com/watch?v=gMymeinwF8A",
    "https://www.youtube.com/watch?v=bMtuPFLCljg",
  ],
  "machine-learning-essentials": [
    "https://www.youtube.com/watch?v=ZyhVh-qRZPA",
    "https://www.youtube.com/watch?v=-o3AxdVcUtQ",
    "https://www.youtube.com/watch?v=O2Cw82YR5Bo",
    "https://www.youtube.com/watch?v=J5bXOOmkopc",
    "https://www.youtube.com/watch?v=C-Cd2ZGXBH4",
    "https://www.youtube.com/watch?v=pYVScuY-GPk",
  ],
  "marketing-fundamentals": [
    "https://www.youtube.com/watch?v=O9j9aLo9waY",
    "https://www.youtube.com/watch?v=v6EWN4EjHM0",
    "https://www.youtube.com/watch?v=SI0XD9e9Tl8",
    "https://www.youtube.com/watch?v=OD-GVCZvcTU",
    "https://www.youtube.com/watch?v=VnbaIbo6z5k",
  ],
  "growth-performance-marketing": [
    "https://www.youtube.com/watch?v=NFAxZg1cGwA",
    "https://www.youtube.com/watch?v=16-dF2p0kKo",
    "https://www.youtube.com/watch?v=hcPxMuxh5Tc",
    "https://www.youtube.com/watch?v=KZe0C0Qq4p0",
    "https://www.youtube.com/watch?v=pRKpaZJJRxk",
    "https://www.youtube.com/watch?v=LQ2eyBztSAs",
  ],
  "entrepreneurship-lean-startups": [
    "https://www.youtube.com/watch?v=9bPgNEDdX3E",
    "https://www.youtube.com/watch?v=KD1NcMTyKs4",
    "https://www.youtube.com/watch?v=1FoCbbbcYT8",
    "https://www.youtube.com/watch?v=AMKgcBzK7cg",
    "https://www.youtube.com/watch?v=Tk-RdCFSrKU",
  ],
  // CapCut Pro Editing — keyframes, speed ramps, color, sound, captions, export.
  "capcut-pro-editing": [
    "https://www.youtube.com/watch?v=TlJR7PAtHks",
    "https://www.youtube.com/watch?v=ImKkcOE3y70",
    "https://www.youtube.com/watch?v=pHMoPh6mzm4",
    "https://www.youtube.com/watch?v=bALqRZTgfuY",
    "https://www.youtube.com/watch?v=u3cm1gbHwJU",
    "https://www.youtube.com/watch?v=c6wA5sWGX5c",
    "https://www.youtube.com/watch?v=ImKkcOE3y70",
    "https://www.youtube.com/watch?v=pHMoPh6mzm4",
  ],
  // CapCut Pro Storytelling — client workflow, story, green screen, brand content, capstone.
  "capcut-pro-storytelling": [
    "https://www.youtube.com/watch?v=TlJR7PAtHks",
    "https://www.youtube.com/watch?v=ImKkcOE3y70",
    "https://www.youtube.com/watch?v=c6wA5sWGX5c",
    "https://www.youtube.com/watch?v=pHMoPh6mzm4",
    "https://www.youtube.com/watch?v=u3cm1gbHwJU",
    "https://www.youtube.com/watch?v=bALqRZTgfuY",
    "https://www.youtube.com/watch?v=ImKkcOE3y70",
    "https://www.youtube.com/watch?v=TlJR7PAtHks",
  ],
  // Photoshop Pro Workflows — frequency separation, composites, actions, print, capstone.
  "photoshop-pro-workflows": [
    "https://www.youtube.com/watch?v=Xt39PClmo4U",
    "https://www.youtube.com/watch?v=0qcWeuWCkJ4",
    "https://www.youtube.com/watch?v=yeQR0qAl_-k",
    "https://www.youtube.com/watch?v=zKiSUBWAObA",
    "https://www.youtube.com/watch?v=dvJ1HxlyEfI",
    "https://www.youtube.com/watch?v=TEQOd6fRSiI",
    "https://www.youtube.com/watch?v=Xt39PClmo4U",
    "https://www.youtube.com/watch?v=5dJl_Lr5TGQ",
  ],
};

const resource = (name: string, url: string): Resource => ({ name, url });

/** Resource links seeded before real files existed point at a never-hosted
 *  placeholder domain (learn.forgex.academy/*.pdf) — they render as dead PDF
 *  cards, so they are dropped from the catalog at seed time. Admins upload
 *  real files through the lesson editor instead. */
const PLACEHOLDER_RESOURCE_HOST = "learn.forgex.academy";

const cleanResources = (r: Array<[string, string]> = []) =>
  r
    .filter(([, u]) => !u.includes(PLACEHOLDER_RESOURCE_HOST))
    .map(([n, u]) => resource(n, u));

function q(
  type: Question["type"],
  question: string,
  opts: { options?: string[]; answer?: string; points?: number; explanation?: string },
): Question {
  return { type, question, options: opts.options, answer: opts.answer, points: opts.points ?? 1, explanation: opts.explanation };
}

/** Every seeded quiz ships with 10 questions and every seeded course with a
 *  30-question final exam. Both builders are shared by the fresh-seed path
 *  (mkCourse) and the self-heal pass, so existing databases reach the same
 *  depth without a wipe. They only ever ADD questions — tutor-authored
 *  questions and exams are never removed or overwritten. */
const QUIZ_QUESTION_TARGET = 10;
const FINAL_EXAM_QUESTION_TARGET = 30;

/** Pads a quiz up to the 10-question target with review items. Quizzes that
 *  already carry 10+ questions are returned untouched. */
/** Deterministic pseudo-shuffle so the correct option never always sits in
 *  the same position — stable across re-seeds (seeded by the question text). */
function seededShuffle<T>(items: T[], seedText: string): T[] {
  const arr = [...items];
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = arr.length - 1; i > 0; i -= 1) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h ^= h >>> 13;
    const j = Math.abs(h) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Shuffle a multiple-choice question's options (true/false stays True/False). */
function withShuffledOptions(item: Question): Question {
  if (
    item.type !== "multiple-choice" ||
    !item.options ||
    item.options.length < 2
  ) {
    return item;
  }
  return { ...item, options: seededShuffle(item.options, item.question) };
}

/** Matches the old generic review fillers seeded into quizzes/exams so the
 *  self-heal pass can swap them for real, course-specific questions. */
const GENERIC_QUIZ_FILLER = /^Review question \d+ of \d+/;
const GENERIC_EXAM_FILLER =
  /best describes this lesson's main idea|Final exam review question \d+ of \d+|this lesson covers material you will need|In your own words, what is the most important takeaway from lesson/;

/** Brings a quiz up to 10 questions using the course's hand-authored bank
 *  (matched by course slug + quiz order). Falls back to generic review
 *  fillers only if no bank entry exists yet. */
function padQuizQuestions(
  questions: Question[],
  slug?: string,
  quizIndex = 0,
): Question[] {
  const out = [...questions];
  const used = new Set(out.map((item) => item.question.trim().toLowerCase()));
  const add = (item: Question) => {
    const key = item.question.trim().toLowerCase();
    if (used.has(key)) return;
    used.add(key);
    out.push(withShuffledOptions(item));
  };
  if (slug) {
    for (const item of quizAdditionsFor(slug, quizIndex)) {
      if (out.length >= QUIZ_QUESTION_TARGET) break;
      add(item);
    }
  }
  let n = 0;
  while (out.length < QUIZ_QUESTION_TARGET) {
    n += 1;
    const stem = `Review question ${out.length + 1} of ${QUIZ_QUESTION_TARGET} — check your understanding of this course.`;
    if (used.has(stem.toLowerCase())) continue;
    used.add(stem.toLowerCase());
    out.push(
      n % 2 === 0
        ? q("multiple-choice", stem, {
            options: ["Option A", "Option B", "Option C", "Option D"],
            answer: "Option A",
            points: 1,
            explanation: "Revisit the relevant lesson to confirm this concept.",
          })
        : q("true-false", stem, {
            options: ["True", "False"],
            answer: "True",
            points: 1,
            explanation: "Revisit the relevant lesson to confirm this concept.",
          }),
    );
  }
  return out;
}

/** Builds the 30-question final exam for a course. Priority order:
 *   1. the hand-authored bank of course-specific questions,
 *   2. the course's own checkpoint (quiz) questions,
 *   3. recall questions built from the real lesson titles and notes,
 *   4. generic fillers only as a last resort.
 *  Every added multiple-choice question has its options shuffled so the
 *  correct answer is not always in the same slot. */
function buildFinalExamQuestions(
  lessons: Array<{ title: string; notes?: string }>,
  slug?: string,
  quizQuestions: Question[] = [],
): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  const push = (item: Question) => {
    const key = item.question.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(withShuffledOptions(item));
  };

  if (slug) {
    for (const item of bankQuestionsFor(slug)) push(item);
  }
  for (const item of quizQuestions) push(item);

  for (const [i, lesson] of lessons.entries()) {
    if (out.length >= FINAL_EXAM_QUESTION_TARGET) break;
    const desc = (lesson.notes ?? "").trim();
    const others = lessons.filter((_, j) => j !== i);
    const otherNotes = others
      .map((l) => (l.notes ?? "").trim())
      .filter((d) => d && d !== desc)
      .slice(0, 3);
    const otherTitles = others.map((l) => l.title).slice(0, 3);
    if (!desc || otherNotes.length < 3) continue;
    push(
      q(
        "multiple-choice",
        `Which of these best describes what the lesson "${lesson.title}" covers?`,
        { options: [desc, ...otherNotes], answer: desc, points: 2 },
      ),
    );
    if (out.length >= FINAL_EXAM_QUESTION_TARGET) break;
    push(
      q(
        "multiple-choice",
        `In which lesson of this course would you learn: "${desc}"?`,
        { options: [lesson.title, ...otherTitles], answer: lesson.title, points: 2 },
      ),
    );
  }

  let n = out.length;
  while (out.length < FINAL_EXAM_QUESTION_TARGET) {
    n += 1;
    const multipleChoice = n % 2 === 1;
    push(
      q(
        multipleChoice ? "multiple-choice" : "true-false",
        `Final exam review question ${out.length + 1} of ${FINAL_EXAM_QUESTION_TARGET} — revisit the course material to answer this.`,
        multipleChoice
          ? {
              options: ["Option A", "Option B", "Option C", "Option D"],
              answer: "Option A",
              points: 1,
              explanation: "Review the relevant lesson to confirm your understanding.",
            }
          : {
              options: ["True", "False"],
              answer: "True",
              points: 1,
              explanation: "Review the relevant lesson to confirm your understanding.",
            },
      ),
    );
  }
  return out.slice(0, FINAL_EXAM_QUESTION_TARGET);
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

    // New catalog additions (courses added to the seed after a database was
    // already seeded) must still appear. If every expected course exists the
    // seed short-circuits; otherwise it continues and mkCourse() fills in
    // whatever is missing (it is idempotent by slug).
    // Seeded courses an admin deleted are recorded in siteContent — the
    // self-healing seed must never resurrect them.
    const deletedCatalogSlugs = await getDeletedCatalogSlugs(ctx);
    const seededSlugs = new Set(
      (await ctx.db.query("courses").collect()).map((c) => c.slug),
    );
    const missingCourses = EXPECTED_COURSE_SLUGS.filter(
      (s) => !seededSlugs.has(s) && !deletedCatalogSlugs.has(s),
    );
    // ------------------------------------------------------------------
    // Quiz depth + final exam self-heal for the seeded catalog. Called both
    // before the short-circuit (so already-seeded databases are repaired)
    // and again after seeding (so freshly created courses — including the AI
    // catalog — are covered in the same run). Idempotent: it only fills gaps
    // and never rewrites tutor-authored questions or exams.
    // ------------------------------------------------------------------
    const healQuizAndExamDepth = async () => {
      const seededSlugSet = new Set(EXPECTED_COURSE_SLUGS);
      for (const course of await ctx.db.query("courses").collect()) {
        if (!seededSlugSet.has(course.slug) || deletedCatalogSlugs.has(course.slug)) {
          continue;
        }
        // Every seeded quiz carries at least 10 questions.
        const courseQuizzes = await ctx.db
          .query("quizzes")
          .withIndex("by_course", (q2) => q2.eq("courseId", course._id))
          .collect();
        for (const quiz of courseQuizzes) {
          if (quiz.questions.length < QUIZ_QUESTION_TARGET) {
            await ctx.db.patch(quiz._id, {                questions: padQuizQuestions(
                  quiz.questions,
                  course.slug,
                  i,
                ),
              updatedAt: Date.now(),
            });
          }
        }
        // Every seeded course has one published 30-question final exam.
        const existingExam = await ctx.db
          .query("finalExams")
          .withIndex("by_course", (q2) => q2.eq("courseId", course._id))
          .first();
        if (existingExam) continue;
        const courseLessons = await ctx.db
          .query("lessons")
          .withIndex("by_courseId", (q2) => q2.eq("courseId", course._id))
          .collect();
        if (courseLessons.length === 0) continue;
        const titles = [...courseLessons]
          .sort((a, b) => a.order - b.order)
          .map((l) => l.title);
        await ctx.db.insert("finalExams", {
          courseId: course._id,
          tutorId: course.tutorId,
          title: `Final Exam — ${course.title}`,
          description: `A ${FINAL_EXAM_QUESTION_TARGET}-question final exam covering every lesson in ${course.title}. Pass with 60% to earn your certificate.`,
          questionCount: FINAL_EXAM_QUESTION_TARGET,
          totalMarks: 60,
          passPercent: 60,
          timeLimitMinutes: 45,
          questions: buildFinalExamQuestions(
            courseLessons.map((l) => ({ title: l.title, notes: l.notes })),
            course.slug,
            courseQuizzes.flatMap((q) => q.questions),
          ),
          published: true,
          createdAt: Date.now(),
        });
      }
    };

    // Heal an already-seeded database before the short-circuit below.
    await healQuizAndExamDepth();

    // ------------------------------------------------------------------
    // Broken-cover repair — runs BEFORE the short-circuit so an existing,
    // already-complete database still gets its dead seeded cover photos
    // swapped for the fresh seed images (e.g. a stock-photo URL that died
    // upstream). Only exact matches of known-dead URLs are patched; the
    // repair is a no-op once every match has been fixed.
    // ------------------------------------------------------------------
    if (KNOWN_DEAD_IMAGE_URLS.length > 0 && seededSlugs.size > 0) {
      const deadSet = new Set(KNOWN_DEAD_IMAGE_URLS);
      for (const c of await ctx.db.query("courses").collect()) {
        if (c.image && deadSet.has(c.image)) {
          const fresh = SEED_IMAGE_FIXES[c.slug] ?? SEED_IMAGE_FIXES["*"];
          if (fresh) {
            await ctx.db.patch(c._id, { image: fresh });
          }
        }
      }
    }
    if (
      existing &&
      anyCourse &&
      anyRoadmap &&
      missingCourses.length === 0 &&
      !force
    )
      return { seeded: false };
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
    // AI & modern-work courses — Build Websites with AI, Data Analysis with
    // Excel, AI Video Generation, AI Automation & Productivity, Prompt
    // Engineering, AI Productivity & Digital Work. Self-contained and
    // idempotent by slug, so databases seeded before these existed receive
    // the full catalog on re-run (no duplicate content, no demo clips).
    // ------------------------------------------------------------------
    await seedAiCourses(ctx);

    // AI-catalog courses ship their quizzes/exams through the same builders as
    // the rest of the catalog — heal them right after they are seeded.
    await healQuizAndExamDepth();

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
      lessons: Array<{ t: string; m: number; n: string; tr: string; r?: Array<[string, string]>; v?: string }>;
      quizzes: Array<{ t: string; d: string; time: number; qs: Question[] }>;
      assignment?: { t: string; d: string; i: string; days: number };
      assignments?: Array<{ t: string; d: string; i: string; days: number }>;
    }) => {
      const slug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      // Respect admin deletions of seeded catalog courses.
      if (deletedCatalogSlugs.has(slug)) return null;
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
        // Self-heal: swap seeded placeholder clips (sample movies) for the
        // real educational videos mapped for this course (per lesson order).
        const realFor = REAL_LESSON_VIDEOS[slug];
        if (realFor) {
          const existingLessons = await ctx.db
            .query("lessons")
            .withIndex("by_course", (q) => q.eq("courseId", existingCourse._id))
            .collect();
          for (const l of existingLessons) {
            const real =
              c.lessons[l.order - 1]?.v ?? realFor[l.order - 1];
            if (
              real &&
              l.videoUrl !== "" &&
              (!l.videoUrl || l.videoUrl.includes("gtv-videos-bucket"))
            ) {
              await ctx.db.patch(l._id, { videoUrl: real, videoType: "youtube" });
            }
          }
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
      const realFor = REAL_LESSON_VIDEOS[slug];
      for (const [i, l] of c.lessons.entries()) {
        const real = l.v ?? realFor?.[i];
        await ctx.db.insert("lessons", {
          courseId: courseId as never, title: l.t, order: i + 1,
          durationMinutes: l.m,
          videoUrl: real ?? VIDS[i % VIDS.length],
          videoType: real ? "youtube" : "mp4",
          notes: l.n, transcript: l.tr,
          resources: cleanResources(l.r),
        });
      }
      for (const quiz of c.quizzes) {
        await ctx.db.insert("quizzes", {
          courseId: courseId as never, tutorId: c.tutorId as never,
          title: quiz.t, description: quiz.d,
          timeLimitMinutes: quiz.time,            questions: padQuizQuestions(quiz.qs, undefined, j), createdAt: Date.now(),
        });
      }

      // One final exam per course — 30 questions, 60 marks, 60% to pass,
      // 45 minutes. Built from the course's lesson titles so it feels
      // topical rather than generic, with a mix of multiple-choice,
      // true/false and a couple of short-answer reflections.
      {
        await ctx.db.insert("finalExams", {
          courseId: courseId as never,
          tutorId: c.tutorId as never,
          title: `Final Exam — ${c.title}`,
          description: `A ${FINAL_EXAM_QUESTION_TARGET}-question final exam covering every lesson in ${c.title}. Pass with 60% to earn your certificate.`,
          questionCount: FINAL_EXAM_QUESTION_TARGET,
          totalMarks: 60,
          passPercent: 60,
          timeLimitMinutes: 45,
          questions: buildFinalExamQuestions(
            c.lessons.map((l) => ({ title: l.t, notes: l.n })),
            SLUG(c.title),
            c.quizzes.flatMap((q) => q.qs),
          ),
          published: true,
          createdAt: Date.now(),
        });
      }

      const assignmentList =
        c.assignments ?? (c.assignment ? [c.assignment] : []);
      for (const a of assignmentList) {
        await ctx.db.insert("assignments", {
          courseId: courseId as never, tutorId: c.tutorId as never,
          title: a.t, description: a.d,
          instructions: a.i,
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
        { t: "Welcome to Design Fundamentals", v: "https://www.youtube.com/watch?v=YqQx75OPRa0", m: 12, n: "Course structure, materials and how to get the most from the program.", tr: "We'll cover the roadmap, the design briefs you'll complete, and the tools you need to install. Download the workbook from resources.", r: [["Workbook (PDF)", "https://learn.forgex.academy/workbook.pdf"]] },
        { t: "The Elements of Design", v: "https://www.youtube.com/watch?v=MshxnTQW4qU", m: 18, n: "Line, shape, form, space, texture and value — the raw materials of every composition.", tr: "Elements are the ingredients; principles are the recipe. Learn to spot elements in the world around you and use them deliberately in your work.", r: [["Cheat sheet", "https://learn.forgex.academy/elements.pdf"]] },
        { t: "Color: Theory & Emotion", v: "https://www.youtube.com/watch?v=_2LLXnUdUIc", m: 22, n: "Color wheels, harmonies, psychology and accessibility contrast.", tr: "We break down hue, saturation and value, explore classic harmonies, and look at how brands use color to trigger emotion. Always check contrast for accessibility." },
        { t: "Typography That Works", v: "https://www.youtube.com/watch?v=sByzHoiYFX0", m: 20, n: "Type anatomy, pairing, hierarchy and legibility systems.", tr: "Great type is invisible. Learn to pair serif and sans, build a type scale, and set comfortable reading experiences." },
        { t: "Composition & Layout", v: "https://www.youtube.com/watch?v=a5KYlHNKQB8", m: 24, n: "Grids, alignment, whitespace and the rule of thirds.", tr: "Grids give structure; whitespace gives breathing room. We'll rebuild a cluttered poster into a calm, focused layout." },
        { t: "Mini Brand: Putting It Together", v: "https://www.youtube.com/watch?v=tvYDYtQhreo", m: 26, n: "Capstone exercise: design a one-page brand identity system.", tr: "You'll apply everything to a fictional coffee brand: palette, type system and a simple logo mark. This becomes portfolio piece #1." },
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
        { t: "What Branding Actually Is", v: "https://www.youtube.com/watch?v=5D8sWNq-WUI", m: 14, n: "Brand vs logo: identity as a system of meaning.", tr: "A logo is a mark; a brand is the feeling people have. We start by defining the difference and why strategy comes first." },
        { t: "Research & Positioning", v: "https://www.youtube.com/watch?v=NPqEdQDraho", m: 20, n: "Audiences, competitors, and the positioning statement.", tr: "Interviews, competitive audits and positioning statements are the raw materials of identity. You'll write one for your own brand." },
        { t: "Logo Design Process", v: "https://www.youtube.com/watch?v=4MxRhjHmiVw", m: 24, n: "Moodboards, sketching, iteration and vectorizing.", tr: "From 50 rough sketches to 3 refined concepts to one final mark — the classic designer's funnel." },
        { t: "Color, Type & Voice", v: "https://www.youtube.com/watch?v=VTDycrlT1hI", m: 18, n: "Assembling the toolkit that makes a brand consistent.", tr: "Palette, type system, tone of voice. Consistent use is what makes a brand feel premium." },
        { t: "Brand Guidelines & Handoff", v: "https://www.youtube.com/watch?v=4n7dC8AcfH8", m: 16, n: "Document your system so anyone can apply it.", tr: "A guideline deck protects the brand. Learn what to include and how to present it to clients." },
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
        { t: "Information Architecture", m: 16, n: "Organize content so users never get lost.", tr: "Sitemaps, user flows and card sorting. Good IA is invisible — bad IA is a maze.", v: "https://www.youtube.com/watch?v=SjbQ21klQP8" },
        { t: "Wireframes & Low-Fi Prototypes", m: 20, n: "Layout first, polish later.", tr: "Quick grayscale wireframes let you test structure before investing in pixels.", v: "https://www.youtube.com/watch?v=6t_dYhXyYjI" },
        { t: "High-Fidelity UI in Figma", m: 26, n: "From wireframe to polished screen: spacing, states and detail.", tr: "We build a real screen component by component, obsessing over the details that make UI feel professional.", v: "https://www.youtube.com/watch?v=XT59i0Nyq-c" },
        { t: "Design Systems & Components", m: 22, n: "Tokens, components and consistency at scale.", tr: "Colors, type scales, spacing tokens and reusable components — the language of scalable design teams.", v: "https://www.youtube.com/watch?v=_uva2dQPlV8" },
        { t: "Prototyping & Handoff", m: 18, n: "Interactions, developer handoff and design specs.", tr: "Turn static screens into clickable prototypes and hand developers everything they need.", v: "https://www.youtube.com/watch?v=E-H06QNkHTU" },
        { t: "Usability Testing Basics", m: 14, n: "Watch real users, learn fast, iterate.", tr: "Five users find most problems. Learn to write tasks, moderate tests and prioritize fixes.", v: "https://www.youtube.com/watch?v=EYUL0N1Fjhg" },
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
        { t: "Case Study Anatomy", v: "https://www.youtube.com/watch?v=cqHM7pay82E", m: 18, n: "Problem → process → outcome. Tell the story of your work.", tr: "Hiring managers skim case studies. Lead with the problem and the result; keep process tight and visual." },
        { t: "Building Your Portfolio Site", v: "https://www.youtube.com/watch?v=mmgxspm9JWs", m: 22, n: "Tools, structure, and the 3 projects that matter.", tr: "Three strong, focused projects beat ten shallow ones. We'll structure a one-page site that scrolls beautifully." },
        { t: "Resume & LinkedIn", v: "https://www.youtube.com/watch?v=Y7wD38n7yl4", m: 14, n: "Translate design skills into language recruiters scan.", tr: "Action verbs, measurable outcomes, and a headline that positions you." },
        { t: "Applying & Interviewing", v: "https://www.youtube.com/watch?v=RYssJ_m60vE", m: 16, n: "Portfolio reviews, whiteboard exercises and salary talks.", tr: "Practice your pitch, handle critiques gracefully, and know what you're worth." },
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

    // --- Professional Graphic Design (project-focused, client-style) ---
    await mkCourse({
      title: "Professional Graphic Design", subtitle: "Client work, campaigns and a portfolio that sells",
      description: "Work like a real designer: branding projects, advertising campaigns and a client-style capstone delivered from brief to final files.",
      long: "This is the serious, career-oriented stage of the design path. You'll take a fictional business from brief to brand system, run a full advertising campaign, and finish a client-style capstone where you plan, research, design, revise and deliver — exactly how professional design work actually happens.",
      categoryId: catDesign, tutorId: tSofia, roadmapId: design.id, levelId: design.levelIds[4],
      difficulty: "professional", hours: 24, rating: 4.9, ratingCount: 176, gradient: "violet", icon: "💼", image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&q=80",
      prerequisites: ["Branding Essentials", "UI Design Mastery"], skills: ["Brand identity systems", "Advertising design", "Client workflow", "Presentation", "Portfolio delivery"],
      featured: false,
      lessons: [
        { t: "The Client Design Process", v: "https://www.youtube.com/watch?v=tvYDYtQhreo", m: 18, n: "Brief → research → concept → design → revise → deliver.", tr: "Real design work is a process, not a single file. Learn how to run a project from the first client call to the final handoff — and how to manage feedback without losing your vision.", r: [["Client brief template", "https://learn.forgex.academy/client-brief.pdf"]] },
        { t: "Brand Identity Systems", v: "https://www.youtube.com/watch?v=5D8sWNq-WUI", m: 24, n: "Logo, palette, type and guidelines working as one system.", tr: "A brand system is a toolkit. We build a complete identity: primary and secondary logos, a color system with usage rules, typography pairing, and the guidelines that keep it consistent." },
        { t: "Business Card & Stationery", v: "https://www.youtube.com/watch?v=4MxRhjHmiVw", m: 20, n: "Print-ready business cards that feel premium.", tr: "Print requires precision: bleed, safe margins, CMYK and dieline thinking. Design a business card that actually gets kept." },
        { t: "Social Media Templates", v: "https://www.youtube.com/watch?v=VTDycrlT1hI", m: 18, n: "A template system for Instagram, LinkedIn and X.", tr: "Consistency across platforms builds recognition. Create a template set that scales to every post the brand will ever make." },
        { t: "Brand Presentation", v: "https://www.youtube.com/watch?v=NPqEdQDraho", m: 16, n: "Present the identity like a studio would.", tr: "The presentation sells the work. Structure a brand deck that tells the strategy story and walks the client through every decision." },
        { t: "Advertising Campaign Design", v: "https://www.youtube.com/watch?v=YqQx75OPRa0", m: 22, n: "Campaign concept, key visual and multi-format rollout.", tr: "A campaign starts with one idea, then adapts everywhere: feed ads, banners, posters and stories. You'll design a full campaign for one product." },
        { t: "Promotional Flyer & Print", v: "https://www.youtube.com/watch?v=a5KYlHNKQB8", m: 18, n: "Flyers that get read: hierarchy, offer and action.", tr: "Print promotions live or die on hierarchy. Design a promotional flyer with a clear offer, strong typography and a single call to action." },
        { t: "Design Variations & Iteration", v: "https://www.youtube.com/watch?v=MshxnTQW4qU", m: 16, n: "Deliver options, not opinions — then refine.", tr: "Clients need choices. Create multiple design variations, learn to present them honestly, and iterate to a final that everyone believes in." },
        { t: "Capstone: Client Project End-to-End", v: "https://www.youtube.com/watch?v=cqHM7pay82E", m: 28, n: "Full client project: brief → research → concept → design → revision → delivery.", tr: "Your final project mirrors real studio work. Take the fictional brief, run the whole process, and deliver a brand system plus a campaign — portfolio-ready." },
      ],
      quizzes: [
        {
          t: "Professional Design Checkpoint", d: "Client work and delivery.", time: 10,
          qs: [
            q("multiple-choice", "What is the first step in a professional design project?", { options: ["Opening Photoshop", "Understanding the brief and researching", "Designing the logo", "Sending an invoice"], answer: "Understanding the brief and researching", points: 2 }),
            q("multiple-choice", "Why do professional designers present multiple variations?", { options: ["To confuse the client", "Clients need choices to react to", "To charge more", "It's faster"], answer: "Clients need choices to react to", points: 2 }),
            q("true-false", "A brand guidelines document protects consistency after handoff.", { options: ["True", "False"], answer: "True", points: 2 }),
            q("short-answer", "Name one thing you must check before sending a file to print.", { answer: "", points: 3 }),
          ],
        },
      ],
      assignment: {
        t: "Capstone: full brand + campaign delivery", d: "A client-style project from brief to final files.",
        i: "Pick a fictional business. Deliver: brand strategy (positioning + audience), logo system (2 variations), color palette with hex codes, typography system, business card, 3 social media templates, a promotional flyer, and a 5-slide brand presentation. Submit a PDF or link to your files.",
        days: 21,
      },
    });

    // --- Photoshop Mastery (intermediate → professional, hands-on) ---
    await mkCourse({
      title: "Photoshop Mastery", subtitle: "Real photo editing and design skills, hands-on",
      description: "Layers, masks, selections, retouching, color correction and social media design — with follow-along practicals in every lesson.",
      long: "Stop watching and start doing. This course takes you through the Photoshop skills working designers actually use: the interface, layers, masks, the pen tool, adjustment layers, blending modes, smart objects, retouching, background removal and color correction — each topic with a follow-along practical and a deliverable you can submit.",
      categoryId: catDesign, tutorId: tSofia, roadmapId: design.id, levelId: design.levelIds[2],
      difficulty: "intermediate", hours: 30, rating: 4.9, ratingCount: 388, gradient: "sky", icon: "🖌️", image: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1200&q=80",
      prerequisites: ["Design Fundamentals"], skills: ["Photoshop", "Layer masks", "Pen tool", "Retouching", "Color correction"],
      featured: true,
      lessons: [
        { t: "The Photoshop Interface", v: "https://www.youtube.com/watch?v=PeD7uhc8R4U", m: 16, n: "Workspace, panels, tools and shortcuts that speed you up.", tr: "Learn the layout once and everything else gets faster. We tour the workspace, the layers panel, and the shortcuts you'll use every single day.", r: [["Photoshop shortcuts cheat sheet", "https://learn.forgex.academy/ps-shortcuts.pdf"]] },
        { t: "Layers Explained", v: "https://www.youtube.com/watch?v=PeD7uhc8R4U", m: 20, n: "The stack that makes Photoshop powerful.", tr: "Layers are the heart of Photoshop. Understand stacking order, opacity, visibility and how to keep files organized like a professional." },
        { t: "Layer Masks", v: "https://www.youtube.com/watch?v=fE1_nHllIp8", m: 22, n: "Non-destructive editing with black and white.", tr: "Masks let you hide and reveal without deleting. Paint with black and white to blend images seamlessly — the single most important Photoshop skill." },
        { t: "Selection Tools", v: "https://www.youtube.com/watch?v=0qcWeuWCkJ4", m: 20, n: "Marquee, lasso, quick selection and refine edge.", tr: "Selections are the starting point of most edits. Master the quick selection and refine edge workflow for clean cutouts." },
        { t: "The Pen Tool", v: "https://www.youtube.com/watch?v=dvJ1HxlyEfI", m: 24, n: "Precise paths for cutouts and shapes.", tr: "The pen tool is the most precise way to select. Learn anchor points, curves and how to convert a path into a clean selection." },
        { t: "Adjustment Layers", v: "https://www.youtube.com/watch?v=TEQOd6fRSiI", m: 18, n: "Levels, curves, hue/saturation — non-destructive color control.", tr: "Adjustment layers change color without destroying pixels. Build a global color grade that stays editable forever." },
        { t: "Blending Modes", v: "https://www.youtube.com/watch?v=zKiSUBWAObA", m: 18, n: "Multiply, screen, overlay and friends.", tr: "Blending modes control how layers interact. Learn the ones that matter and when to reach for each." },
        { t: "Smart Objects", v: "https://www.youtube.com/watch?v=yeQR0qAl_-k", m: 14, n: "Non-destructive scaling and filters.", tr: "Smart objects keep edits reversible. Resize, filter and re-edit without ever degrading quality." },
        { t: "Photo Retouching", v: "https://www.youtube.com/watch?v=Xt39PClmo4U", m: 22, n: "Heal, clone and clean up portraits and products.", tr: "Retouching is subtlety. Use the healing brush, clone stamp and frequency separation to clean images without the plastic look." },
        { t: "Background Removal", v: "https://www.youtube.com/watch?v=0qcWeuWCkJ4", m: 20, n: "Clean cutouts for products and people.", tr: "Combine selection tools, masks and refine edge to remove backgrounds cleanly — a skill you'll bill for." },
        { t: "Color Correction", v: "https://www.youtube.com/watch?v=Xt39PClmo4U", m: 20, n: "Fix white balance, exposure and casts.", tr: "Correct color with a 4-point technique: white balance, exposure, contrast and saturation. Before-and-after that sells." },
        { t: "Social Media Graphics & Flyers", v: "https://www.youtube.com/watch?v=5dJl_Lr5TGQ", m: 24, n: "Design social posts and promotional flyers in Photoshop.", tr: "Combine everything: layout, type, masks and color into finished social graphics and a professional flyer you can submit." },
      ],
      quizzes: [
        {
          t: "Photoshop Checkpoint", d: "Non-destructive editing essentials.", time: 12,
          qs: [
            q("multiple-choice", "What do layer masks use to hide and reveal pixels?", { options: ["Colors", "Black and white", "Filters", "Blur"], answer: "Black and white", points: 2 }),
            q("multiple-choice", "Which tool is most precise for creating cutout paths?", { options: ["Brush", "Pen", "Eraser", "Gradient"], answer: "Pen", points: 2 }),
            q("true-false", "Adjustment layers destroy the original pixels.", { options: ["True", "False"], answer: "False", points: 2, explanation: "Adjustment layers are non-destructive — the original stays editable." }),
            q("short-answer", "Name one benefit of using smart objects.", { answer: "", points: 3 }),
          ],
        },
      ],
      assignment: {
        t: "Photo edit + social media graphic", d: "Retouch a photo and design a social post.",
        i: "Take a photo of a person or product. Remove the background cleanly, retouch it, correct the color, and design a social media graphic with text. Submit your before/after as images (JPG/PNG) or a PDF.",
        days: 14,
      },
    });

    // --- Video Editing with CapCut (beginner → professional) ---
    await mkCourse({
      title: "Video Editing with CapCut", subtitle: "Edit videos people actually watch",
      description: "From your first cut to a professional edit: CapCut fundamentals, keyframes, captions, color, sound and a client-style capstone.",
      long: "Video is the most engaging medium on the internet — and CapCut puts a professional editor in your pocket. This course takes you from importing your first clip to delivering a polished, color-graded, captioned video: cutting, transitions, speed ramps, keyframes, captions, green screen, sound design and storytelling, with a practical project at every level.",
      categoryId: catDesign, tutorId: tSofia, roadmapId: design.id, levelId: design.levelIds[1],
      difficulty: "beginner", hours: 28, rating: 4.8, ratingCount: 512, gradient: "rose", icon: "🎬", image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&q=80",
      prerequisites: [], skills: ["CapCut", "Video editing", "Keyframes", "Captions", "Color grading"],
      featured: true,
      lessons: [
        { t: "Introduction to Video Editing", v: "https://www.youtube.com/watch?v=TlJR7PAtHks", m: 16, n: "What editing is and the mindset that makes a good editor.", tr: "Editing is storytelling with time. Learn the editor's mindset, the vocabulary (cuts, shots, sequences) and what makes a great edit feel effortless." },
        { t: "The CapCut Interface", v: "https://www.youtube.com/watch?v=ImKkcOE3y70", m: 18, n: "Preview, timeline, tools and the media bin.", tr: "CapCut is free on desktop and mobile. Tour the interface: the preview, the timeline, the toolbars and where everything lives.", r: [["CapCut desktop download", "https://www.capcut.com"]] },
        { t: "Importing Media & Creating a Project", v: "https://www.youtube.com/watch?v=pHMoPh6mzm4", m: 14, n: "Start a project, import footage and set up your canvas.", tr: "Create your first project, import clips and photos, and choose the right resolution and frame rate for where the video will live." },
        { t: "Timeline Fundamentals", v: "https://www.youtube.com/watch?v=c6wA5sWGX5c", m: 20, n: "Tracks, layers and the language of the timeline.", tr: "The timeline is where edits happen. Understand video and audio tracks, how clips stack, and how to read your footage at a glance." },
        { t: "Cutting & Trimming", v: "https://www.youtube.com/watch?v=ImKkcOE3y70", m: 18, n: "The most important skill: knowing what to remove.", tr: "Good editing is subtraction. Learn to trim dead air, cut on action and keep a natural rhythm." },
        { t: "Splitting & Rearranging Clips", v: "https://www.youtube.com/watch?v=c6wA5sWGX5c", m: 16, n: "Split, move, reorder — build your story.", tr: "Split clips at the right moments and rearrange them into a sequence that tells your story clearly." },
        { t: "Adding Music", v: "https://www.youtube.com/watch?v=bALqRZTgfuY", m: 14, n: "Pick music that fits and sync it to the edit.", tr: "Music sets emotion. Choose tracks from CapCut's library, trim them to length and sync the edit to the beat." },
        { t: "Adding Text & Titles", v: "https://www.youtube.com/watch?v=u3cm1gbHwJU", m: 16, n: "Titles, lower thirds and animated text.", tr: "Text turns raw video into content. Add titles, style them and animate them so they feel part of the video." },
        { t: "Basic Transitions", v: "https://www.youtube.com/watch?v=ImKkcOE3y70", m: 14, n: "Cuts, fades and the transitions that don't scream.", tr: "Transitions should serve the story. Master the cut, the fade and a few subtle transitions before touching the flashy ones." },
        { t: "Exporting Videos", v: "https://www.youtube.com/watch?v=pHMoPh6mzm4", m: 12, n: "Resolution, frame rate and the right export settings.", tr: "Export for the platform: 1080p for YouTube, vertical for Reels and TikTok. Learn the settings that keep quality high and files small." },
      ],
      quizzes: [
        {
          t: "CapCut Fundamentals Checkpoint", d: "The basics that matter.", time: 8,
          qs: [
            q("multiple-choice", "What is the most important skill in editing?", { options: ["Adding effects", "Knowing what to remove", "Using every transition", "Making it loud"], answer: "Knowing what to remove", points: 2 }),
            q("multiple-choice", "Where do you arrange your clips in CapCut?", { options: ["The preview", "The timeline", "The media bin", "The export menu"], answer: "The timeline", points: 2 }),
            q("true-false", "Transitions should serve the story, not dominate it.", { options: ["True", "False"], answer: "True", points: 2 }),
            q("short-answer", "Name one export setting you'd change for TikTok vs YouTube.", { answer: "", points: 3 }),
          ],
        },
      ],
      assignment: {
        t: "Edit your first 30–60 second video", d: "Cut raw footage into a short, watchable edit.",
        i: "Record 2–5 minutes of raw footage on your phone (any subject). Edit it in CapCut into a 30–60 second video: trim the best moments, add music, one text title and one transition, then export. Submit your video file (MP4) or a link.",
        days: 10,
      },
    });

    // --- CapCut Pro Editing (intermediate — real production workflows) ---
    await mkCourse({
      title: "CapCut Pro Editing", subtitle: "From first cut to a polished, professional edit",
      description: "Keyframes, speed ramps, color grading, sound design and captions — the intermediate toolkit that makes edits feel professional.",
      long: "The beginner course taught you the tools; this course teaches you the craft. You'll move into real production workflows: keyframe animation, speed ramps, color grading, sound design, captions that convert, and multi-clip storytelling. Every lesson is a follow-along practical with a deliverable you can submit.",
      categoryId: catDesign, tutorId: tSofia, roadmapId: design.id, levelId: design.levelIds[2],
      difficulty: "intermediate", hours: 26, rating: 4.8, ratingCount: 317, gradient: "rose", icon: "🎬", image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&q=80",
      prerequisites: ["Video Editing with CapCut"], skills: ["Keyframes", "Speed ramps", "Color grading", "Sound design", "Captions"],
      featured: true,
      lessons: [
        { t: "Keyframes: Motion & Animation", v: "https://www.youtube.com/watch?v=TlJR7PAtHks", m: 20, n: "Animate position, scale, rotation and opacity with keyframes.", tr: "Keyframes are the heart of motion in CapCut. Learn to set a start and end state, then let CapCut fill the movement between them — the foundation of every animated title, zoom and effect." },
        { t: "Speed Ramps & Time Effects", v: "https://www.youtube.com/watch?v=ImKkcOE3y70", m: 18, n: "Slow motion, fast motion and the speed curve.", tr: "Speed is emotion: slow-motion drama, fast-cut energy. Use the speed curve to ramp smoothly from slow to fast and back, exactly like professional sports and travel edits." },
        { t: "Color Grading Fundamentals", v: "https://www.youtube.com/watch?v=pHMoPh6mzm4", m: 22, n: "Exposure, contrast, saturation and the cinematic look.", tr: "Color grading is where edits start to feel like films. Balance exposure, shape contrast with curves, and build a consistent look across every clip in your project." },
        { t: "Sound Design & Audio Mixing", v: "https://www.youtube.com/watch?v=bALqRZTgfuY", m: 20, n: "Clean dialogue, layered music, and audio that breathes.", tr: "Viewers forgive a rough picture but not bad audio. Learn to duck music under voice, balance levels, and add subtle sound effects that sell the edit." },
        { t: "Captions That Convert", v: "https://www.youtube.com/watch?v=u3cm1gbHwJU", m: 16, n: "Auto-captions, styling and the rhythm of on-screen text.", tr: "Most social video is watched on mute. Master auto-caption workflows, styling that matches your brand, and the timing that keeps viewers reading and watching." },
        { t: "Multi-Clip Storytelling", v: "https://www.youtube.com/watch?v=c6wA5sWGX5c", m: 22, n: "Cut between angles and shots to build a narrative.", tr: "One take is a video; two angles is a story. Learn to assemble multiple clips into a sequence with rhythm, coverage and a clear beginning, middle and end." },
        { t: "Transitions, Effects & Overlays", v: "https://www.youtube.com/watch?v=ImKkcOE3y70", m: 18, n: "Use effects with restraint and purpose.", tr: "Effects are seasoning, not the meal. Choose transitions and overlays that support the story, and learn the professional habit of using fewer, better ones." },
        { t: "Exporting for Every Platform", v: "https://www.youtube.com/watch?v=pHMoPh6mzm4", m: 14, n: "Vertical, square and 1080p — the right settings every time.", tr: "Export settings decide how your work looks in the feed. Match resolution, frame rate and bitrate to each platform, and keep a master copy you can always reuse." },
      ],
      quizzes: [
        {
          t: "CapCut Pro Editing Checkpoint", d: "Production workflows.", time: 10,
          qs: [
            q("multiple-choice", "What are keyframes used for in CapCut?", { options: ["Storing backup files", "Animating properties like position and scale over time", "Changing the video resolution", "Adding subtitles automatically"], answer: "Animating properties like position and scale over time", points: 2 }),
            q("multiple-choice", "What does a speed curve let you do?", { options: ["Change the frame rate", "Ramp smoothly between slow and fast motion", "Export faster", "Add more tracks"], answer: "Ramp smoothly between slow and fast motion", points: 2 }),
            q("true-false", "Sound design matters even when viewers watch on mute.", { options: ["True", "False"], answer: "True", points: 2, explanation: "Good audio keeps people watching with sound on — and captions cover the mute case." }),
            q("short-answer", "Why would you keep a master export of every project?", { answer: "", points: 3 }),
          ],
        },
      ],
      assignment: {
        t: "Pro edit: keyframes + grade + captions", d: "A 60–90 second edit with motion, color and captions.",
        i: "Edit a 60–90 second video using at least: one keyframe animation, one speed ramp, a color grade, music with ducked audio, and styled captions. Export at the right settings for one platform and submit your video file (MP4) or a link.",
        days: 14,
      },
    });

    // --- CapCut Pro Storytelling (professional — client-style capstone) ---
    await mkCourse({
      title: "CapCut Pro Storytelling", subtitle: "Client edits, brand content and a portfolio that sells",
      description: "Work like a professional editor: brand content, green screen, advanced color, and a client-style capstone delivered from raw footage to final cut.",
      long: "This is the serious, career-oriented stage of the video path. You'll take a fictional client brief from raw footage to a finished branded video: planning the story, shooting with the edit in mind, green screen compositing, advanced grading, and delivering a client-style capstone exactly how professional editors work.",
      categoryId: catDesign, tutorId: tSofia, roadmapId: design.id, levelId: design.levelIds[4],
      difficulty: "professional", hours: 30, rating: 4.9, ratingCount: 148, gradient: "rose", icon: "🎬", image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&q=80",
      prerequisites: ["CapCut Pro Editing"], skills: ["Client workflow", "Green screen", "Advanced color", "Brand content", "Storytelling"],
      featured: false,
      lessons: [
        { t: "The Client Editing Process", v: "https://www.youtube.com/watch?v=TlJR7PAtHks", m: 18, n: "Brief → ingest → rough cut → review → final delivery.", tr: "Professional editing is a process with deliverables at every step. Learn how to run a project from the first client call to the final export — and how to manage feedback without losing your vision." },
        { t: "Story Structure for Video", v: "https://www.youtube.com/watch?v=ImKkcOE3y70", m: 20, n: "Hook, build, payoff — the structure every good edit follows.", tr: "Great edits are built on story, not effects. Learn the hook in the first three seconds, the build that keeps attention, and the payoff that makes viewers share." },
        { t: "Green Screen & Compositing", v: "https://www.youtube.com/watch?v=c6wA5sWGX5c", m: 24, n: "Chroma key, clean edges and believable backgrounds.", tr: "Green screen turns one location into any location. Master chroma key settings, edge cleanup and lighting notes so the composite actually looks real." },
        { t: "Advanced Color & Looks", v: "https://www.youtube.com/watch?v=pHMoPh6mzm4", m: 22, n: "LUTs, matching shots and a signature look.", tr: "Move beyond basic grading: apply LUTs, match color across dozens of clips, and develop a consistent signature look a brand can rely on." },
        { t: "Brand Content Systems", v: "https://www.youtube.com/watch?v=u3cm1gbHwJU", m: 18, n: "Templates, intros and a repeatable style for any brand.", tr: "Brands need content every week, not once. Build a reusable edit system — intro, captions, music bed, outro — that keeps every post on-brand." },
        { t: "Working With Raw Footage", v: "https://www.youtube.com/watch?v=bALqRZTgfuY", m: 20, n: "Ingest, organize, cull and log like a professional.", tr: "Professionals never start editing in a mess. Learn a culling and logging workflow that turns hours of footage into a clean, findable timeline." },
        { t: "Feedback & Revision Rounds", v: "https://www.youtube.com/watch?v=ImKkcOE3y70", m: 16, n: "Take notes, protect the cut, deliver on time.", tr: "Client feedback is part of the job. Learn to organize notes, make targeted revisions, and communicate what changes and why." },
        { t: "Capstone: Client Edit End-to-End", v: "https://www.youtube.com/watch?v=TlJR7PAtHks", m: 28, n: "Full client project: brief → rough cut → revisions → final delivery.", tr: "Your final project mirrors real client work. Take the fictional brief, plan the story, edit the footage, apply a grade and captions, and deliver a finished branded video — portfolio-ready." },
      ],
      quizzes: [
        {
          t: "CapCut Pro Storytelling Checkpoint", d: "Client work and delivery.", time: 10,
          qs: [
            q("multiple-choice", "What is the first step in a professional editing project?", { options: ["Adding effects", "Understanding the brief and planning the story", "Exporting", "Buying music"], answer: "Understanding the brief and planning the story", points: 2 }),
            q("multiple-choice", "What does chroma key let you do?", { options: ["Speed up a clip", "Replace a green background with another image or video", "Add captions", "Change the frame rate"], answer: "Replace a green background with another image or video", points: 2 }),
            q("true-false", "A brand content system should be reusable across many posts.", { options: ["True", "False"], answer: "True", points: 2 }),
            q("short-answer", "Name one thing you check before delivering a final export.", { answer: "", points: 3 }),
          ],
        },
      ],
      assignment: {
        t: "Capstone: client-style brand video", d: "From raw footage to a finished branded edit.",
        i: "Take the fictional brief (in the assignment resources). Plan the story, edit the provided raw footage into a 60–90 second branded video: hook, keyframe motion, color grade, captions, music with ducked audio, and a clean outro. Export at platform settings and submit your video file (MP4) or a link.",
        days: 21,
      },
    });

    // --- Photoshop Pro Workflows (professional — advanced techniques) ---
    await mkCourse({
      title: "Photoshop Pro Workflows", subtitle: "Advanced techniques and client-ready delivery",
      description: "Frequency separation, advanced compositing, actions, batch processing and client delivery — the professional Photoshop toolkit.",
      long: "You know the tools; now work like a professional. This course covers the advanced techniques working designers and retouchers use daily: frequency separation retouching, advanced composites, smart workflows, actions and batch processing, print-ready delivery and client-style projects.",
      categoryId: catDesign, tutorId: tSofia, roadmapId: design.id, levelId: design.levelIds[4],
      difficulty: "professional", hours: 28, rating: 4.9, ratingCount: 203, gradient: "sky", icon: "🖌️", image: "https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=1200&q=80",
      prerequisites: ["Photoshop Mastery"], skills: ["Frequency separation", "Compositing", "Actions & batch", "Print delivery", "Client workflow"],
      featured: false,
      lessons: [
        { t: "Advanced Retouching: Frequency Separation", v: "https://www.youtube.com/watch?v=Xt39PClmo4U", m: 24, n: "Separate texture from tone for natural, clean retouching.", tr: "Frequency separation splits an image into texture and color layers, so you can smooth skin without losing detail. The professional retoucher's core technique." },
        { t: "Advanced Compositing", v: "https://www.youtube.com/watch?v=0qcWeuWCkJ4", m: 26, n: "Match light, color and perspective across multiple images.", tr: "A convincing composite is about consistency: matching light direction, color temperature and perspective so separate photos feel like one scene." },
        { t: "Smart Objects & Non-Destructive Workflows", v: "https://www.youtube.com/watch?v=yeQR0qAl_-k", m: 20, n: "Keep every edit reversible and every file flexible.", tr: "Professionals never flatten what can stay editable. Smart objects, adjustment layers and smart filters keep your work flexible for clients and revisions." },
        { t: "Actions & Batch Processing", v: "https://www.youtube.com/watch?v=zKiSUBWAObA", m: 18, n: "Record once, apply to hundreds of files.", tr: "Anything you do twice, automate. Record actions, batch-process folders of images, and reclaim hours of repetitive work." },
        { t: "Print-Ready Delivery", v: "https://www.youtube.com/watch?v=dvJ1HxlyEfI", m: 22, n: "CMYK, bleed, safe margins and the right file formats.", tr: "Print has rules that screens don't. Prepare CMYK files with bleed and safe margins, and deliver the formats printers actually request." },
        { t: "Client File Organization & Handoff", v: "https://www.youtube.com/watch?v=TEQOd6fRSiI", m: 16, n: "Name files, package layers and hand off like a studio.", tr: "Clients judge your professionalism by your files. Learn naming conventions, layer organization and handoff packages that make you easy to work with." },
        { t: "Portfolio Retouching Project", v: "https://www.youtube.com/watch?v=Xt39PClmo4U", m: 24, n: "A before/after retouch worthy of your portfolio.", tr: "Apply everything to one hero image: frequency separation, color correction, compositing and a clean, non-destructive file — a portfolio piece that shows process, not just result." },
        { t: "Capstone: Client Delivery End-to-End", v: "https://www.youtube.com/watch?v=5dJl_Lr5TGQ", m: 28, n: "Full client project: brief → retouch → composite → deliver.", tr: "Your final project mirrors real client work. Take the fictional brief, retouch and composite the images, prepare print and screen deliverables, and hand off a professional file package." },
      ],
      quizzes: [
        {
          t: "Photoshop Pro Checkpoint", d: "Advanced workflows.", time: 10,
          qs: [
            q("multiple-choice", "What does frequency separation separate?", { options: ["Layers and folders", "Texture from color/tone", "RGB channels", "File formats"], answer: "Texture from color/tone", points: 2 }),
            q("multiple-choice", "What is the main benefit of recording an action?", { options: ["It makes images sharper", "You can apply the same steps to many files automatically", "It changes the file format", "It adds filters"], answer: "You can apply the same steps to many files automatically", points: 2 }),
            q("true-false", "Print files should include bleed and safe margins.", { options: ["True", "False"], answer: "True", points: 2 }),
            q("short-answer", "Name one reason to keep a file non-destructive.", { answer: "", points: 3 }),
          ],
        },
      ],
      assignment: {
        t: "Capstone: retouch + composite + deliver", d: "A client-style project from brief to final files.",
        i: "Take the fictional brief (in the assignment resources). Retouch the hero image with frequency separation, build one composite, correct color, and deliver both a print-ready file (CMYK, bleed) and a screen file. Submit your files as a PDF or a link to your package.",
        days: 21,
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
        { t: "How the Web Works", v: "https://www.youtube.com/watch?v=KVBfmtQ2Wlk", m: 10, n: "Browsers, servers, URLs and the request cycle.", tr: "Understanding the fundamentals demystifies everything else. We trace a request from your browser to a server and back." },
        { t: "Semantic HTML", v: "https://www.youtube.com/watch?v=kX3TfdUqpuU", m: 20, n: "Structure content with meaning: header, nav, main, article, footer.", tr: "Semantic HTML is good for accessibility, SEO and maintainability. You'll build the skeleton of a real page." },
        { t: "Modern CSS Fundamentals", v: "https://www.youtube.com/watch?v=yfoY53QXEnI", m: 22, n: "Selectors, cascade, box model and custom properties.", tr: "CSS is a language of rules and inheritance. Custom properties (variables) change the game — we use them everywhere." },
        { t: "Flexbox & Grid", v: "https://www.youtube.com/watch?v=z62f2k38s64", m: 24, n: "The two layout engines that power modern interfaces.", tr: "Flexbox for one-dimensional rows, Grid for two-dimensional layouts. You'll build a responsive card grid." },
        { t: "Responsive Design", v: "https://www.youtube.com/watch?v=69IbzTWg5PM", m: 18, n: "Media queries, fluid type and mobile-first thinking.", tr: "Design for the smallest screen first, then enhance. Your page will look great on every device." },
        { t: "Ship It: Deploy Your Site", v: "https://www.youtube.com/watch?v=RGOj5yH7evk", m: 14, n: "Git, GitHub and free hosting so the world can see your work.", tr: "Push your code to GitHub and deploy with free static hosting. You now have a live URL to share." },
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
        { t: "Values, Types & Variables", v: "https://www.youtube.com/watch?v=L9-3VBOjNH4", m: 18, n: "Primitives, objects, coercion and const/let.", tr: "Everything in JS is a value. Understanding types and coercion prevents a whole class of bugs." },
        { t: "Functions & Closures", v: "https://www.youtube.com/watch?v=1S8SBDhA7HA", m: 22, n: "First-class functions, scope, closures and higher-order functions.", tr: "Functions are values you can pass around. Closures are how JavaScript remembers — this unlocks functional patterns." },
        { t: "The DOM & Events", v: "https://www.youtube.com/watch?v=5fb2aPlgoys", m: 24, n: "Select, create, update and listen. Build interactive UI.", tr: "The DOM is your API to the page. We build a working to-do list with events and rendering." },
        { t: "Arrays & Objects in Depth", v: "https://www.youtube.com/watch?v=8MoElay6dWU", m: 20, n: "map, filter, reduce and modern object patterns.", tr: "Transform data fluently with array methods instead of loops. This is the bread and butter of real codebases." },
        { t: "Async JavaScript", v: "https://www.youtube.com/watch?v=VmQ6dHvnKIM", m: 26, n: "Promises, async/await, fetch and error handling.", tr: "The web is async. We fetch real data from an API, handle loading and errors, and render it." },
        { t: "Modules & Tooling", v: "https://www.youtube.com/watch?v=s9kNndJLOjg", m: 16, n: "import/export, npm and the modern dev workflow.", tr: "Break code into modules, install packages, and meet the tools real developers use daily." },
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
        { t: "HTTP & REST in Practice", v: "https://www.youtube.com/watch?v=Q-BpqyOT3a8", m: 16, n: "Methods, status codes, resources and idempotency.", tr: "REST is a set of conventions, not a framework. Master the verbs and status codes first." },
        { t: "Your First Server", v: "https://www.youtube.com/watch?v=32M1al-Y6Ag", m: 20, n: "Routing, middleware and JSON responses.", tr: "We scaffold a server, add routes, and handle requests and responses cleanly." },
        { t: "Working with Databases", v: "https://www.youtube.com/watch?v=_7UQPve99r4", m: 24, n: "Models, CRUD and query patterns.", tr: "Persist data with a database and model your resources. CRUD becomes second nature." },
        { t: "Authentication Basics", v: "https://www.youtube.com/watch?v=favjC6EKFgw", m: 22, n: "Passwords, hashing, tokens and protected routes.", tr: "Never store plaintext passwords. We implement hashing, sessions and protected endpoints." },
        { t: "Errors, Validation & Testing", v: "https://www.youtube.com/watch?v=8gHEv5iNRKk", m: 18, n: "Fail loudly and early — then verify it works.", tr: "Input validation, structured errors and a few automated tests turn a demo into a product." },
        { t: "Documenting & Shipping", v: "https://www.youtube.com/watch?v=5aryMKiBEKY", m: 14, n: "OpenAPI docs, environment config and deployment.", tr: "Document your API, keep secrets out of code, and deploy so others can call it." },
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
        { t: "Planning & Architecture", v: "https://www.youtube.com/watch?v=9aZcnf2_py0", m: 16, n: "Requirements, data model, and the stack decision.", tr: "Great products start on paper. We define features, sketch the data model, and choose our stack deliberately." },
        { t: "Database & Data Model", v: "https://www.youtube.com/watch?v=xsg9BDiwiJE", m: 22, n: "Users, courses, enrollments — relationships done right.", tr: "We model the core entities and their relationships, then migrate and seed." },
        { t: "Auth & Roles", v: "https://www.youtube.com/watch?v=305q6IJHy0w", m: 20, n: "Sign up, sign in, protected routes and role guards.", tr: "Users, sessions and role-based access. Students see the app; admins see the admin." },
        { t: "Building the Product UI", v: "https://www.youtube.com/watch?v=O3BUHwfHf84", m: 26, n: "Catalog, course pages and the student dashboard.", tr: "We build the public catalog and the dashboard, connecting every screen to real data." },
        { t: "Admin, Testing & Polish", v: "https://www.youtube.com/watch?v=8Xwq35cPwYg", m: 20, n: "Admin screens, edge cases and QA pass.", tr: "Admins manage content; testers break things. We fix the rough edges before launch." },
        { t: "Deploy & Walkthrough", v: "https://www.youtube.com/watch?v=l134cBAJCuc", m: 18, n: "Ship it and record the story.", tr: "Deploy to production, then record a 5-minute walkthrough that becomes your capstone deliverable." },
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
        { t: "Analytical Thinking", v: "https://www.youtube.com/watch?v=lgCNTuLBMK4", m: 14, n: "Ask better questions before touching data.", tr: "The best analysts are curious and structured. We practice turning vague questions into measurable ones." },
        { t: "Metrics That Matter", v: "https://www.youtube.com/watch?v=ItZlTixh6Bs", m: 18, n: "KPIs, vanity vs actionable metrics, and benchmarking.", tr: "A metric is only useful if it drives a decision. Learn to separate signals from noise." },
        { t: "Spreadsheet Superpowers", v: "https://www.youtube.com/watch?v=zXnQNytHCPM", m: 24, n: "Formulas, pivots, lookups and clean modeling.", tr: "Spreadsheets are still the world's most-used analytics tool. We go deep on the functions that matter." },
        { t: "Data Hygiene 101", v: "https://www.youtube.com/watch?v=_jmiEGZ6PIY", m: 16, n: "Clean data is half the battle: dedupe, validate, document.", tr: "Garbage in, garbage out. We build habits that keep datasets trustworthy." },
        { t: "First Analysis: From Question to Slides", v: "https://www.youtube.com/watch?v=Hfx1X9WSGYQ", m: 20, n: "Structure an analysis and present it with confidence.", tr: "Framing, analysis, and a tight narrative. You'll present your first insight deck." },
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
        { t: "SELECT, FROM, WHERE", v: "https://www.youtube.com/watch?v=h0nxCDiD-zg", m: 18, n: "The query skeleton and filtering with precision.", tr: "Every query starts the same. Master projection and filtering before touching anything advanced." },
        { t: "Joins: Connecting Tables", v: "https://www.youtube.com/watch?v=2HVMiPPuPIM", m: 22, n: "INNER, LEFT, RIGHT and when to reach for each.", tr: "Real data lives in many tables. Joins are how you bring it together without duplicating it." },
        { t: "Aggregations & GROUP BY", v: "https://www.youtube.com/watch?v=nNrgRVIzeHg", m: 20, n: "SUM, COUNT, AVG and grouping by dimension.", tr: "From rows to answers: group, aggregate, and filter groups with HAVING." },
        { t: "Subqueries & CTEs", v: "https://www.youtube.com/watch?v=K1WeoKxLZ5o", m: 20, n: "Compose complex questions from simple pieces.", tr: "WITH clauses make monster queries readable. We break hard problems into steps." },
        { t: "Window Functions", v: "https://www.youtube.com/watch?v=gMymeinwF8A", m: 22, n: "Rankings, running totals and comparisons across rows.", tr: "Window functions unlock analytics like rank, lag, and rolling averages — the daily tools of data teams." },
        { t: "Wrangling Dirty Data", v: "https://www.youtube.com/watch?v=bMtuPFLCljg", m: 18, n: "CASE, COALESCE, parsing and deduplication patterns.", tr: "Real data is messy. Learn the standard cleanup moves and when to automate them." },
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
        { t: "Python for Data", v: "https://www.youtube.com/watch?v=ZyhVh-qRZPA", m: 20, n: "Notebooks, pandas and the data workflow.", tr: "A fast tour of the Python data stack: notebooks, DataFrames and the classic load-explore-clean loop." },
        { t: "Exploratory Data Analysis", v: "https://www.youtube.com/watch?v=-o3AxdVcUtQ", m: 22, n: "Describe, visualize, hypothesize.", tr: "Plots and statistics that reveal what your data is really saying before any model sees it." },
        { t: "Regression: Predicting Numbers", v: "https://www.youtube.com/watch?v=O2Cw82YR5Bo", m: 24, n: "Linear models, error metrics and baseline thinking.", tr: "Always beat a baseline. We train, evaluate with RMSE/MAE, and sanity-check our predictions." },
        { t: "Classification: Predicting Categories", v: "https://www.youtube.com/watch?v=J5bXOOmkopc", m: 26, n: "Logistic regression, trees, accuracy and confusion matrices.", tr: "Spam or not? Churn or stay? We build classifiers and learn why accuracy can lie." },
        { t: "Overfitting & Validation", v: "https://www.youtube.com/watch?v=C-Cd2ZGXBH4", m: 22, n: "Train/test splits, cross-validation and regularization.", tr: "Models that memorize don't generalize. We use validation honestly and keep complexity in check." },
        { t: "Feature Engineering & Final Model", v: "https://www.youtube.com/watch?v=pYVScuY-GPk", m: 24, n: "Turn raw fields into signals, then ship a model.", tr: "Great features beat fancy algorithms. You'll engineer features and deliver a final evaluated model." },
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
