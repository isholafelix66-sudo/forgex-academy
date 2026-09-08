/**
 * ForgeX Academy — AI & Modern-Work course catalog.
 *
 * Six complete, practical courses (Beginner → Intermediate → Professional)
 * built on the ForgeX philosophy: Discover. Express. Build.
 *
 * Every course ships with:
 *   • level-grouped lessons (Beginner / Intermediate / Professional)
 *   • a per-level checkpoint quiz
 *   • two practical assignments plus a final capstone project
 *   • downloadable resource placeholders
 *
 * Video lessons are deliberately NOT shipped with fake clips. Each lesson
 * carries the sentinel `PLANNED_VIDEO` value (see seed.ts) so the player
 * renders an honest “Video coming soon — planned recording” placeholder and
 * the demo-video repair pass never attaches sample movies. When real,
 * relevant recordings exist they should be added as YouTube URLs per lesson.
 */
import type { MutationCtx } from "./_generated/server";
import { ROLES, type Question } from "./schema";

/** Sentinel stored as `lesson.videoUrl` — renders the “video coming soon” state. */
export const PLANNED_VIDEO = "planned-recording";

type Lesson = {
  t: string;
  m: number;
  n: string;
  tr: string;
  r?: Array<[string, string]>;
};

type Quiz = { t: string; d: string; time: number; qs: Question[] };

type Assignment = { t: string; d: string; i: string; days: number };

export type AiCourseDef = {
  title: string;
  subtitle: string;
  description: string;
  long: string;
  category: "development" | "data-ai" | "design" | "marketing" | "business";
  tutor: "daniel" | "layla" | "nneka";
  difficulty: "beginner" | "intermediate" | "advanced" | "professional" | "expert";
  hours: number;
  rating: number;
  ratingCount: number;
  gradient: string;
  icon: string;
  image: string;
  prerequisites: string[];
  skills: string[];
  featured: boolean;
  lessons: Lesson[];
  quizzes: Quiz[];
  assignments: Assignment[];
};

function q(
  type: Question["type"],
  question: string,
  opts: { options?: string[]; answer?: string; points?: number; explanation?: string },
): Question {
  return {
    type,
    question,
    options: opts.options,
    answer: opts.answer,
    points: opts.points ?? 1,
    explanation: opts.explanation,
  };
}

const PLANNED =
  "🎥 Video lesson — planned recording (coming soon). Follow the notes, resources and practical task below and keep building.";

export const AI_COURSE_CATALOG: AiCourseDef[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // COURSE 1 — BUILD WEBSITES WITH AI
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: "Build Websites with AI",
    subtitle: "Design, generate, customize and deploy real websites",
    description:
      "Use AI website builders, AI coding assistants and AI design tools to plan, build, customize and ship professional websites — from your first landing page to a production-ready company site.",
    long: "Modern websites are built with AI in the driver's seat. This course teaches you the whole workflow: comparing AI website builders and coding assistants, planning a site before you generate it, writing prompts that produce great results, customizing HTML/CSS/JS output, making everything responsive, connecting APIs, debugging with AI, and deploying to the internet. Every module ends with a Build With Me session and a deliverable you can put in your portfolio.",
    category: "development",
    tutor: "daniel",
    difficulty: "beginner",
    hours: 34,
    rating: 4.9,
    ratingCount: 156,
    gradient: "lime",
    icon: "🤖",
    image:
      "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200&q=80",
    prerequisites: [],
    skills: [
      "AI website builders",
      "AI coding assistants",
      "Prompting for web",
      "Responsive design",
      "Deployment & hosting",
      "SEO & accessibility",
    ],
    featured: true,
    lessons: [
      // ── Beginner ──
      {
        t: "How AI Is Changing Website Creation",
        m: 14,
        n: `${PLANNED} Understand why AI is now the fastest way from idea to live website, and what stays human.`,
        tr: "Learn what AI website builders and AI coding assistants actually do, where they shine, and where a human eye still matters — design taste, content truth, and final quality checks.",
      },
      {
        t: "Websites, Domains, Hosting & Deployment Explained",
        m: 16,
        n: `${PLANNED} Demystify the pieces: what a website is, what a domain costs, and where a site lives.`,
        tr: "Separate the webpages, domain name, hosting, and deployment into clear concepts so every later lesson about shipping feels natural. You'll know what each service does and roughly what it costs.",
        r: [["Website glossary (PDF)", "https://learn.forgex.academy/web-glossary.pdf"]],
      },
      {
        t: "Tour the AI Website Builder & AI Coding Landscape",
        m: 20,
        n: `${PLANNED} Survey the main categories: drag-and-drop AI builders, AI coding assistants, AI design tools, no-code platforms.`,
        tr: "Walk through the current categories of tools — full-site generators from a prompt, page builders with AI copy and layout, AI coding assistants for HTML/CSS/JS/React, and asset generators for images, icons and animations. Platforms change fast; the categories stay useful.",
        r: [["AI website tool comparison sheet", "https://learn.forgex.academy/ai-website-tools.pdf"]],
      },
      {
        t: "Choose the Right AI Platform for Your Project",
        m: 18,
        n: `${PLANNED} A decision framework: project type, control, budget, and how you'll maintain the site.`,
        tr: "Compare AI website builders vs AI coding workflows across five criteria: control, speed, customization, cost, and long-term maintainability. Match the tool to the project — a portfolio, a business site, and a web app need different choices.",
      },
      {
        t: "Plan Before You Generate: Brief, Structure & Content",
        m: 18,
        n: `${PLANNED} A 15-minute plan saves five hours of AI back-and-forth.`,
        tr: "Write a mini brief: goal, audience, pages, sections, content, and a call to action. Sketch the sitemap and wireframe on paper or in a board, then hand that structure to the AI so the output arrives closer to what you need.",
        r: [["Website brief template", "https://learn.forgex.academy/site-brief.pdf"]],
      },
      {
        t: "UI/UX Fundamentals for AI-Generated Websites",
        m: 18,
        n: `${PLANNED} Hierarchy, spacing, contrast and one clear call to action — the rules AI often gets right, and where to fix it.`,
        tr: "Learn the handful of design principles that separate a generated site that looks generic from one that looks professional: clear hierarchy, generous whitespace, consistent spacing, readable contrast, and a single obvious action per screen.",
      },
      // ── Intermediate ──
      {
        t: "Write Prompts That Build Great Websites",
        m: 20,
        n: `${PLANNED} Context, structure, style and constraints — the anatomy of a website prompt.`,
        tr: "Turn a vague request into a structured prompt: describe the business, the audience, the pages, the tone, the palette, the sections, and what to avoid. Compare the output of weak vs strong prompts side by side.",
        r: [["Website prompt template pack", "https://learn.forgex.academy/web-prompts.pdf"]],
      },
      {
        t: "Build With Me: Generate Your First AI Landing Page",
        m: 26,
        n: `${PLANNED} Follow along: brief → prompt → generate → polish a landing page that looks hand-built.`,
        tr: "Watch a complete landing page get built with an AI website builder: writing the brief, prompting the generator, then editing copy, swapping imagery, fixing spacing and shipping it. Your task: build one for your own project.",
      },
      {
        t: "Customize Generated Code: HTML, CSS & JavaScript",
        m: 22,
        n: `${PLANNED} The AI generates; you refine. Learn just enough HTML/CSS/JS to control the output.`,
        tr: "Read the code AI produces like a builder reads a blueprint: structure with semantic HTML, styling with CSS classes, and behavior with a little JavaScript. Practice small, safe edits — change a color, a layout column, a heading style.",
        r: [["HTML/CSS/JS cheat sheet", "https://learn.forgex.academy/web-cheatsheet.pdf"]],
      },
      {
        t: "Responsive & Mobile-First Design with AI",
        m: 20,
        n: `${PLANNED} Make every site look right on phones, tablets and desktops — and prompt for it from the start.`,
        tr: "Learn how responsive design works (fluid grids, flexible images, breakpoints) and how to ask AI for a mobile-first build. Then verify on real devices and fix the common mobile breakages AI leaves behind.",
      },
      {
        t: "Forms, Navigation & Interactive Elements",
        m: 20,
        n: `${PLANNED} Contact forms, menus, buttons, modals and galleries that actually work.`,
        tr: "Add navigation that survives on mobile, build working forms (name, email, message) and connect a simple submission action, and add interactive touches — hover states, accordions, image galleries — with AI-generated code you understand.",
      },
      {
        t: "Animations & Modern UI with AI",
        m: 18,
        n: `${PLANNED} Tasteful motion: scroll reveals, micro-interactions, and transitions that feel premium.`,
        tr: "Use AI to generate CSS animations and scroll effects, then learn the restraint rule: motion should guide attention, not compete with it. Ship animations that work on mobile and respect reduced-motion preferences.",
      },
      // ── Professional ──
      {
        t: "Debug & Improve AI-Generated Code",
        m: 20,
        n: `${PLANNED} When the site breaks, AI fixes it — if you can describe the problem.`,
        tr: "Develop a debugging loop: reproduce the issue, paste the relevant code to an AI assistant with the exact error, apply the fix, and re-test. Learn how to read browser console errors and inspect elements like a professional.",
        r: [["Debugging checklist", "https://learn.forgex.academy/debug-checklist.pdf"]],
      },
      {
        t: "SEO, Accessibility & Performance with AI",
        m: 20,
        n: `${PLANNED} The three quality gates every production site must pass.`,
        tr: "Use AI to write meta titles, descriptions, alt text and clean heading structure for SEO; audit contrast, keyboard navigation and screen-reader labels for accessibility; and compress images and trim heavy scripts for performance.",
      },
      {
        t: "Evaluate AI Code: Quality, Security & Maintainability",
        m: 18,
        n: `${PLANNED} Ask the questions a senior developer would: Is this safe? Is it readable? Can it grow?`,
        tr: "Run AI-generated code through a review checklist: no hardcoded secrets, validated inputs, sensible structure, and comments where needed. Learn what red flags to look for before you publish anything.",
        r: [["Code review checklist", "https://learn.forgex.academy/code-review.pdf"]],
      },
      {
        t: "Deploy, Maintain & Update Websites with AI",
        m: 20,
        n: `${PLANNED} From local preview to a live URL, then keep it fresh.`,
        tr: "Deploy with a hosting platform, connect a custom domain, and set up a simple update routine — editing content with AI, previewing, and publishing. Learn the difference between static hosting and server platforms and pick the right one.",
      },
      {
        t: "Build With Me: Professional Company Website",
        m: 28,
        n: `${PLANNED} A multi-page business site: home, about, services, contact — planned, generated, customized, deployed.`,
        tr: "Follow a full professional build: multi-page structure, brand-consistent styling, working forms, SEO basics, and deployment. This mirrors the kind of client work you can charge for.",
      },
      {
        t: "Final Project: Ship a Complete Responsive Website",
        m: 32,
        n: `${PLANNED} Your capstone: plan, build and deploy a complete responsive website with an AI workflow.`,
        tr: "Choose a real client-style brief (portfolio, business, or community site). Deliver: a brief and structure plan, a generated site customized with your own content and design decisions, a working form, responsive behavior on all devices, SEO and accessibility basics, and a live deployed URL.",
      },
    ],
    quizzes: [
      {
        t: "AI Websites — Beginner Checkpoint",
        d: "Platforms, planning and prompting fundamentals.",
        time: 10,
        qs: [
          q("multiple-choice", "Which of these is the main advantage of an AI website builder over hand-coding?", {
            options: ["Total design control", "Speed from idea to live site", "No hosting needed", "Better security"],
            answer: "Speed from idea to live site",
            points: 2,
          }),
          q("multiple-choice", "What should you do BEFORE generating a website with AI?", {
            options: ["Buy a domain", "Write a brief: goal, audience, pages and content", "Record a video", "Pick a color randomly"],
            answer: "Write a brief: goal, audience, pages and content",
            points: 2,
          }),
          q("true-false", "A strong website prompt describes the audience, tone and structure, not just the topic.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "Name one criterion you would use to choose between an AI website builder and an AI coding assistant.", {
            answer: "",
            points: 3,
          }),
        ],
      },
      {
        t: "AI Websites — Intermediate Checkpoint",
        d: "Customizing generated code and responsive behavior.",
        time: 10,
        qs: [
          q("multiple-choice", "What does 'mobile-first' mean when building with AI?", {
            options: [
              "Designing for the smallest screen first, then enhancing",
              "Building only for phones",
              "Ignoring desktop users",
              "Using a mobile app instead",
            ],
            answer: "Designing for the smallest screen first, then enhancing",
            points: 2,
          }),
          q("multiple-choice", "Which three languages does most generated website code use?", {
            options: ["Python, Java, C++", "HTML, CSS, JavaScript", "SQL, Go, Rust", "Swift, Kotlin, Dart"],
            answer: "HTML, CSS, JavaScript",
            points: 2,
          }),
          q("true-false", "A working form needs a way to actually receive or store the submitted data.", {
            options: ["True", "False"],
            answer: "True",
            points: 1,
            explanation: "A form with no action collects nothing — the data must go somewhere.",
          }),
          q("short-answer", "Name one way to verify a website is responsive on real devices.", {
            answer: "",
            points: 3,
          }),
        ],
      },
      {
        t: "AI Websites — Professional Checkpoint",
        d: "SEO, quality, security and shipping.",
        time: 12,
        qs: [
          q("multiple-choice", "Which of these should you check BEFORE publishing AI-generated code?", {
            options: ["Hardcoded secrets or API keys", "The number of pages", "The domain price", "The color of the footer"],
            answer: "Hardcoded secrets or API keys",
            points: 2,
            explanation: "Secrets in client code are a security hole — validate inputs and keep keys out of the bundle.",
          }),
          q("multiple-choice", "What does 'deployment' mean in web terms?", {
            options: [
              "Writing the website content",
              "Publishing your site to a server so it has a live URL",
              "Buying images",
              "Recording a demo video",
            ],
            answer: "Publishing your site to a server so it has a live URL",
            points: 2,
          }),
          q("true-false", "Alt text on images improves both accessibility and SEO.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "Name one red flag you would look for when reviewing AI-generated code.", {
            answer: "",
            points: 3,
          }),
        ],
      },
    ],
    assignments: [
      {
        t: "Build a personal portfolio website with AI",
        d: "A one-page portfolio generated and customized with an AI workflow.",
        i: "Write a brief for your own portfolio, generate it with an AI website builder or AI coding assistant, customize the content and design (colors, sections, images), make it responsive, and deploy it. Submit the live URL plus a one-page brief explaining which tools you chose and why.",
        days: 10,
      },
      {
        t: "Business landing page for a real product",
        d: "A conversion-focused landing page for a product or service you know.",
        i: "Pick a real business or product. Plan the page structure (hero, problem, solution, proof, pricing, CTA), generate and customize it with AI, add a working form or CTA button, and apply SEO basics. Submit the live URL and a short write-up of your choices.",
        days: 12,
      },
      {
        t: "Final project: complete responsive website",
        d: "A full multi-page website shipped end-to-end with an AI workflow.",
        i: "Choose a client-style brief (portfolio, business, school, or community). Deliver a brief + structure plan, a generated and heavily customized site, a working form, full responsive behavior, SEO/accessibility checks, and a live deployed URL. Submit the URL and a 1-page evaluation of the AI-generated code you reviewed and fixed.",
        days: 18,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // COURSE 2 — DATA ANALYSIS WITH EXCEL
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: "Data Analysis with Excel",
    subtitle: "From raw dataset to insight, dashboard and decision",
    description:
      "Clean, analyze, visualize and present data like an analyst — using Microsoft Excel (and Power Query/Power BI where they help), with realistic datasets and hands-on projects.",
    long: "Excel is still the world's most-used data analysis tool, and this course treats it like a professional instrument. You'll take real datasets from raw and messy to clean, analyzed, visualized and presented: cleaning and deduplication, IF/SUMIF(S)/COUNTIF(S), XLOOKUP, pivot tables and charts, basic statistics, dashboards, Power Query for repeatable cleaning, and an introduction to Power BI. The final project is a complete interactive dashboard you can show employers or clients.",
    category: "data-ai",
    tutor: "layla",
    difficulty: "beginner",
    hours: 32,
    rating: 4.9,
    ratingCount: 142,
    gradient: "cyan",
    icon: "📊",
    image:
      "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=1200&q=80",
    prerequisites: [],
    skills: [
      "Data cleaning",
      "Excel formulas & functions",
      "XLOOKUP",
      "Pivot tables & charts",
      "Dashboards",
      "Power Query & Power BI basics",
    ],
    featured: true,
    lessons: [
      // ── Beginner ──
      {
        t: "What Data Analysis Actually Is",
        m: 14,
        n: `${PLANNED} Analysis is answering questions with data — tools come second.`,
        tr: "Learn the analyst's loop: ask a question, gather data, clean it, analyze it, visualize it, and answer with evidence. Understand the difference between data, information and insight.",
      },
      {
        t: "Load, Explore & Understand a Dataset",
        m: 18,
        n: `${PLANNED} Import real files, meet your columns, and get a feel for the data before touching anything.`,
        tr: "Import CSV/Excel files, understand data types (text, number, date), inspect rows and columns, and ask first questions: how many records, what fields, what's missing, what looks odd?",
        r: [["Sample sales dataset (CSV)", "https://learn.forgex.academy/sales-raw.csv"]],
      },
      {
        t: "Clean a Messy Dataset: Duplicates & Missing Data",
        m: 22,
        n: `${PLANNED} Garbage in, garbage out — remove duplicates and decide what to do with gaps.`,
        tr: "Remove duplicate rows, find and handle missing values (delete, fill, or flag), fix inconsistent text (spacing, casing, typos), and standardize formats so the data behaves predictably.",
        r: [["Cleaning checklist (PDF)", "https://learn.forgex.academy/excel-clean-checklist.pdf"]],
      },
      {
        t: "Sort, Filter & Structure Your Data",
        m: 16,
        n: `${PLANNED} Navigation skills: sort by any column, filter on the fly, and structure tables properly.`,
        tr: "Master sorting and filtering to explore slices of data instantly, and learn the discipline of one row per record with clean column headers — the foundation of every later step.",
      },
      {
        t: "Formulas That Think: IF, SUMIF(S), COUNTIF(S)",
        m: 24,
        n: `${PLANNED} Conditional logic and conditional aggregation — the workhorses of Excel analysis.`,
        tr: "Use IF for logic (high/medium/low, pass/fail), SUMIF/SUMIFS to total by condition (sales by region), COUNTIF/COUNTIFS to count by condition, and combine them into formulas that answer real questions.",
        r: [["Formula cheat sheet (PDF)", "https://learn.forgex.academy/excel-formulas.pdf"]],
      },
      {
        t: "Lookups That Find Anything: XLOOKUP & Friends",
        m: 22,
        n: `${PLANNED} Join data across tables: prices to orders, names to IDs, regions to customers.`,
        tr: "Learn XLOOKUP to fetch values from another table, handle missing matches gracefully, and compare it with classic VLOOKUP/INDEX-MATCH so you can read older workbooks too.",
      },
      // ── Intermediate ──
      {
        t: "Text & Date Functions for Real Data",
        m: 20,
        n: `${PLANNED} Split names, fix formats, and compute with dates like age, month and elapsed time.`,
        tr: "Use LEFT/RIGHT/MID, TRIM, TEXT, and date functions (YEAR, MONTH, TODAY, DATEDIF) to turn messy text and dates into analysis-ready fields.",
      },
      {
        t: "Conditional Formatting & Data Validation",
        m: 16,
        n: `${PLANNED} Make problems visible with color rules, and stop bad data at the door.`,
        tr: "Highlight top/bottom values, duplicates, and thresholds with conditional formatting; restrict inputs with data validation so future data entry stays clean.",
      },
      {
        t: "Build With Me: Clean a Messy Sales Dataset",
        m: 26,
        n: `${PLANNED} Watch a full clean-up: import, inspect, dedupe, fix, validate — then do it yourself.`,
        tr: "Follow along as a messy sales file becomes a clean, analysis-ready table, using every cleaning skill from the module. Your task: clean a second dataset the same way and submit before/after screenshots.",
      },
      {
        t: "Tables, Pivot Tables & Pivot Charts",
        m: 26,
        n: `${PLANNED} Turn raw rows into instant summaries: sales by region, by month, by product.`,
        tr: "Convert data into a proper Excel Table, then master Pivot Tables — drag fields, group by month, add totals and percentages — and visualize summaries with Pivot Charts.",
        r: [["Pivot practice workbook (XLSX)", "https://learn.forgex.academy/pivot-practice.xlsx"]],
      },
      {
        t: "Basic Statistics & Finding Trends",
        m: 20,
        n: `${PLANNED} AVERAGE, MEDIAN, MIN/MAX, counts and simple trend spotting with moving averages.`,
        tr: "Describe a dataset honestly: central tendency, spread, and outliers. Spot trends over time with line charts and moving averages, and learn when a trend is real vs noise.",
      },
      {
        t: "Dashboards That Tell a Story",
        m: 24,
        n: `${PLANNED} Combine KPIs, charts and filters into one clear view.`,
        tr: "Design a one-screen dashboard: headline KPIs, a few well-chosen charts, and slicers for interactivity. Learn what to include, what to cut, and how to guide the viewer's eye.",
      },
      // ── Professional ──
      {
        t: "Intro to Power Query: Repeatable Cleaning",
        m: 22,
        n: `${PLANNED} Turn one-time cleaning into a repeatable recipe that handles next month's file too.`,
        tr: "Connect to a source, clean it with Power Query steps (remove columns, split, replace, unpivot), and refresh — the same transformation applies to every future file automatically.",
      },
      {
        t: "Intro to Power BI: Connect, Model & Visualize",
        m: 24,
        n: `${PLANNED} A first look at professional dashboards: connect Excel data and build an interactive report.`,
        tr: "Load cleaned data into Power BI, build a simple data model with relationships, and create an interactive report with slicers, cards and charts — the bridge from Excel analysis to BI tooling.",
        r: [["Power BI starter guide (PDF)", "https://learn.forgex.academy/powerbi-starter.pdf"]],
      },
      {
        t: "From Data to Business Insight",
        m: 20,
        n: `${PLANNED} The analysis is worthless until it changes a decision.`,
        tr: "Practice the insight sentence: 'Because of [evidence], we should [action].' Work through real scenarios — declining sales, customer churn, campaign performance — and produce recommendations, not just tables.",
      },
      {
        t: "Present Findings Like a Professional Analyst",
        m: 18,
        n: `${PLANNED} Structure a findings deck: question, method, evidence, insight, recommendation.`,
        tr: "Turn an analysis into a short presentation people can follow: one question up front, clean visuals, honest caveats, and a clear recommendation with next steps.",
        r: [["Findings deck template (PPTX)", "https://learn.forgex.academy/findings-deck.pptx"]],
      },
      {
        t: "Quality Checks & Documenting Your Analysis",
        m: 16,
        n: `${PLANNED} The difference between a hobby analysis and a professional one is trust.`,
        tr: "Verify formulas, check totals against source data, document assumptions, and label sheets and files so anyone (including future-you) can re-run the analysis.",
      },
      {
        t: "Final Project: Interactive Dashboard",
        m: 30,
        n: `${PLANNED} Your capstone: a complete raw-data-to-dashboard analysis with a written insight report.`,
        tr: "Choose a real dataset (sales, customers, or finance). Deliver: cleaned dataset, analysis with formulas and pivot tables, an interactive Excel (or Power BI) dashboard with slicers, and a short findings report with a clear recommendation. This becomes a portfolio piece.",
      },
    ],
    quizzes: [
      {
        t: "Excel — Beginner Checkpoint",
        d: "Cleaning, formulas and lookups.",
        time: 10,
        qs: [
          q("multiple-choice", "Which function totals values that match a single condition?", {
            options: ["SUM", "SUMIF", "AVERAGE", "COUNT"],
            answer: "SUMIF",
            points: 2,
          }),
          q("multiple-choice", "What is the safest first step before analyzing a new dataset?", {
            options: [
              "Building a dashboard",
              "Exploring the data: columns, types, missing values",
              "Deleting columns you don't like",
              "Publishing it online",
            ],
            answer: "Exploring the data: columns, types, missing values",
            points: 2,
          }),
          q("true-false", "Duplicate rows can inflate your totals and mislead your conclusions.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "What does XLOOKUP do?", {
            answer: "",
            points: 3,
          }),
        ],
      },
      {
        t: "Excel — Intermediate Checkpoint",
        d: "Pivots, statistics and dashboards.",
        time: 10,
        qs: [
          q("multiple-choice", "What is a Pivot Table best used for?", {
            options: [
              "Storing raw data",
              "Summarizing large datasets by category quickly",
              "Sending emails",
              "Formatting fonts",
            ],
            answer: "Summarizing large datasets by category quickly",
            points: 2,
          }),
          q("multiple-choice", "Which measure best describes the 'middle' of a dataset when outliers exist?", {
            options: ["AVERAGE", "MEDIAN", "MAX", "COUNT"],
            answer: "MEDIAN",
            points: 2,
          }),
          q("true-false", "A dashboard should fit on one screen and guide the viewer to the key insight.", {
            options: ["True", "False"],
            answer: "True",
            points: 1,
          }),
          q("short-answer", "Name one way to make a dashboard interactive.", {
            answer: "",
            points: 3,
          }),
        ],
      },
      {
        t: "Excel — Professional Checkpoint",
        d: "Insight, presentation and quality.",
        time: 10,
        qs: [
          q("multiple-choice", "What makes an analysis 'actionable'?", {
            options: [
              "It uses advanced tools",
              "It leads to a specific decision or recommendation",
              "It has many charts",
              "It is stored in the cloud",
            ],
            answer: "It leads to a specific decision or recommendation",
            points: 2,
          }),
          q("multiple-choice", "Why is Power Query valuable for recurring reports?", {
            options: [
              "It creates pivot tables automatically",
              "The same cleaning steps can be re-applied to new files with a refresh",
              "It replaces Excel entirely",
              "It generates charts for free",
            ],
            answer: "The same cleaning steps can be re-applied to new files with a refresh",
            points: 2,
          }),
          q("true-false", "Documenting assumptions makes an analysis more trustworthy, not less.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "Write one example of an insight sentence: 'Because of [evidence], we should [action]'.", {
            answer: "",
            points: 3,
          }),
        ],
      },
    ],
    assignments: [
      {
        t: "Sales data analysis",
        d: "Clean, analyze and summarize a sales dataset.",
        i: "Use the provided (or your own) sales dataset. Clean it (duplicates, missing values, formats), add at least 5 formulas (including a SUMIFS or COUNTIFS and an XLOOKUP), and build one pivot table plus one chart. Submit your workbook and a 3-bullet summary of what you found.",
        days: 10,
      },
      {
        t: "Customer data analysis",
        d: "Segment customers and find a trend.",
        i: "Analyze a customer dataset: clean it, segment customers (e.g., by region, spend tier, or signup month), use conditional formatting to highlight patterns, and find one trend with a chart. Submit your workbook and a short insight paragraph with a recommendation.",
        days: 12,
      },
      {
        t: "Final project: interactive dashboard",
        d: "Raw data → clean → analyze → visualize → insight → report.",
        i: "Choose a real dataset. Deliver: (1) cleaned data, (2) analysis with formulas and pivots, (3) an interactive dashboard with at least 3 KPIs, 2 charts and a slicer (Excel or Power BI), and (4) a one-page findings report with a clear recommendation. Submit files or links.",
        days: 18,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // COURSE 3 — AI VIDEO GENERATION & CONTENT CREATION
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: "AI Video Generation & Content Creation",
    subtitle: "Script, storyboard, generate, edit and publish professional videos",
    description:
      "Create professional videos with AI: text-to-video and image-to-video platforms, AI voices and avatars, music and captions — with a full idea-to-publish workflow and real projects.",
    long: "Video is the most engaging medium on the internet, and AI has put a studio in your pocket. This course teaches the complete workflow — Idea → Script → Storyboard → Choose tools → Generate visuals → Generate video → Voiceover → Edit → Export → Publish — while building judgment: how to evaluate AI video platforms on quality, rights, cost and control, how to keep characters and scenes consistent, and how to create ethically and responsibly. You'll finish with a professional promotional video you can actually use.",
    category: "marketing",
    tutor: "nneka",
    difficulty: "beginner",
    hours: 30,
    rating: 4.8,
    ratingCount: 121,
    gradient: "rose",
    icon: "🎬",
    image:
      "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&q=80",
    prerequisites: [],
    skills: [
      "Text-to-video & image-to-video",
      "AI voice & avatars",
      "AI storyboarding & scripting",
      "Video editing & captions",
      "Consistency & rights",
      "Platform publishing",
    ],
    featured: false,
    lessons: [
      // ── Beginner ──
      {
        t: "Generative AI for Video: What's Possible Today",
        m: 16,
        n: `${PLANNED} From text to full clips: the state of AI video, honestly.`,
        tr: "See what modern AI video tools can and cannot do: short clips from text, image-to-video motion, voiceovers, avatars, music. Set realistic expectations about length, quality and cost.",
        r: [["AI video glossary (PDF)", "https://learn.forgex.academy/ai-video-glossary.pdf"]],
      },
      {
        t: "Tour the AI Video Tool Landscape",
        m: 20,
        n: `${PLANNED} The categories: text-to-video, image-to-video, avatars, voice, music, editing.`,
        tr: "Survey the current categories of AI video platforms — generation, presentation/avatar, voice, music, and editing/enhancement tools — and understand which category fits which stage of your workflow.",
        r: [["AI video tool comparison sheet", "https://learn.forgex.academy/ai-video-tools.pdf"]],
      },
      {
        t: "Evaluate AI Video Platforms: Quality, Rights, Cost & Control",
        m: 22,
        n: `${PLANNED} A checklist so your choice survives platform changes.`,
        tr: "Compare platforms on output quality, consistency, commercial usage rights, privacy, cost, editing control, and workflow compatibility. Learn the questions to ask before you commit to any tool.",
        r: [["Platform evaluation checklist (PDF)", "https://learn.forgex.academy/video-eval-checklist.pdf"]],
      },
      {
        t: "Write Effective Video Prompts",
        m: 20,
        n: `${PLANNED} Subject, action, camera, lighting, style, duration — the anatomy of a video prompt.`,
        tr: "Build prompts that produce usable clips: describe the subject and action, camera movement, lighting and mood, style, aspect ratio and duration. Compare weak vs strong prompts on the same platform.",
        r: [["Video prompt template pack", "https://learn.forgex.academy/video-prompts.pdf"]],
      },
      {
        t: "Script Writing with AI",
        m: 18,
        n: `${PLANNED} Hooks in the first three seconds, structure, and a clear call to action.`,
        tr: "Use AI to draft scripts with a real structure: hook, problem, solution, proof, CTA. Edit the AI draft for voice and accuracy — the AI drafts, you direct.",
      },
      {
        t: "Storyboard with AI: Plan Scenes Before You Generate",
        m: 20,
        n: `${PLANNED} A shot list saves hours of generation and editing.`,
        tr: "Turn your script into a storyboard: one line per scene with visual description, camera note and duration. Generate storyboard images with AI and approve the plan before generating any video.",
        r: [["Storyboard template (PDF)", "https://learn.forgex.academy/storyboard.pdf"]],
      },
      // ── Intermediate ──
      {
        t: "Generate Images & Visuals for Video",
        m: 20,
        n: `${PLANNED} Concept art, characters, backgrounds and key frames.`,
        tr: "Generate the visual assets your video needs — characters, environments, product shots — and learn prompting techniques for consistent characters and matching styles across images.",
      },
      {
        t: "Generate AI Video Clips: Text-to-Video & Image-to-Video",
        m: 26,
        n: `${PLANNED} From stills to motion: generate each scene as a clip.`,
        tr: "Generate clips from text prompts and from your storyboard images (image-to-video), matching style and motion to the plan. Practice generating several takes and picking the best.",
      },
      {
        t: "AI Voiceovers & Presenters/Avatars",
        m: 22,
        n: `${PLANNED} Narrate with AI voices, or present with an avatar — professionally.`,
        tr: "Generate clean voiceovers (choose voice, pace, emphasis), sync them to scenes, and explore AI presenters and avatars for talking-head content — including when to disclose synthetic media.",
        r: [["Voiceover script template", "https://learn.forgex.academy/vo-script.pdf"]],
      },
      {
        t: "AI Music & Sound Effects",
        m: 16,
        n: `${PLANNED} Sound is half the emotion: generate music beds and effects that fit.`,
        tr: "Generate or source music and SFX that match the mood, learn to layer and duck them under the voiceover, and respect licensing for commercial use.",
      },
      {
        t: "Build With Me: Create a Social-Media Video",
        m: 26,
        n: `${PLANNED} Idea → script → storyboard → generate → voice → edit → export, end to end.`,
        tr: "Follow a complete short-form build: a 30-second social video with hook, generated clips, voiceover, music and captions. Your task: produce your own version and export it.",
      },
      {
        t: "Build With Me: AI Advertisement",
        m: 26,
        n: `${PLANNED} A product ad from brief to final cut.`,
        tr: "Create a 15-30 second advertisement for a product: concept, script, storyboard, generated visuals, voiceover, and a final edit with a clear CTA — the kind of deliverable clients pay for.",
      },
      // ── Professional ──
      {
        t: "Maintain Consistency Across AI-Generated Scenes",
        m: 22,
        n: `${PLANNED} Same character, same style, same world — scene after scene.`,
        tr: "Learn practical consistency techniques: reference images, style keywords, character sheets, seed reuse, and color grading in the edit so every scene feels like the same production.",
        r: [["Consistency workflow guide (PDF)", "https://learn.forgex.academy/consistency.pdf"]],
      },
      {
        t: "Edit, Caption, Format & Export Like a Pro",
        m: 24,
        n: `${PLANNED} Pacing, cuts, captions, aspect ratios and platform export settings.`,
        tr: "Assemble generated clips into a final edit: pacing and rhythm, captions that convert, proper aspect ratios (9:16, 1:1, 16:9), and export settings for each platform.",
      },
      {
        t: "YouTube, TikTok, Reels & Shorts Playbooks",
        m: 20,
        n: `${PLANNED} Different platforms, different rules — optimize each version.`,
        tr: "Adapt one video to each platform: hook styles, lengths, caption treatments, hashtags and thumbnails. Learn what makes short-form content perform and how to repurpose one video into many.",
      },
      {
        t: "Product Promo & Client-Style Campaigns",
        m: 24,
        n: `${PLANNED} Work like an agency: brief, concept, deliverable, revisions.`,
        tr: "Run a client-style video project: read a brief, propose a concept, deliver a first cut, take feedback, and deliver finals in multiple formats — the professional workflow with a paper trail.",
        r: [["Client brief template", "https://learn.forgex.academy/video-brief.pdf"]],
      },
      {
        t: "Copyright, Disclosure & Responsible Use",
        m: 18,
        n: `${PLANNED} What you may use, what you must disclose, and how to stay credible.`,
        tr: "Understand commercial usage rights of generated content, music and voices; follow platform disclosure rules for synthetic media; get consent for real people's likenesses; and keep your audience's trust.",
      },
      {
        t: "Final Project: Professional Promotional Video",
        m: 30,
        n: `${PLANNED} Your capstone: a complete AI-produced promotional video, brief to published.`,
        tr: "Choose a product, service, or cause. Deliver the full workflow: script, storyboard, tool-selection rationale, generated visuals and clips, AI voiceover, music, captions, final edit, and export for at least two platforms. Include a one-page disclosure and rights note.",
      },
    ],
    quizzes: [
      {
        t: "AI Video — Beginner Checkpoint",
        d: "Tools, prompts and planning.",
        time: 10,
        qs: [
          q("multiple-choice", "Which of these is a realistic use of text-to-video AI today?", {
            options: [
              "Generating a 2-hour feature film in one click",
              "Generating short clips from text descriptions",
              "Replacing human editors entirely",
              "Filming real locations",
            ],
            answer: "Generating short clips from text descriptions",
            points: 2,
          }),
          q("multiple-choice", "What should come before generating any video?", {
            options: [
              "Buying a camera",
              "A script and storyboard",
              "Choosing a thumbnail",
              "Publishing",
            ],
            answer: "A script and storyboard",
            points: 2,
          }),
          q("true-false", "A good video prompt describes subject, action, camera and style.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "Name one criterion for evaluating an AI video platform.", {
            answer: "",
            points: 3,
          }),
        ],
      },
      {
        t: "AI Video — Intermediate Checkpoint",
        d: "Generation workflow and editing.",
        time: 10,
        qs: [
          q("multiple-choice", "What is image-to-video generation?", {
            options: [
              "Turning a video into an image",
              "Animating a still image into a short clip",
              "Compressing videos",
              "Adding subtitles",
            ],
            answer: "Animating a still image into a short clip",
            points: 2,
          }),
          q("multiple-choice", "Why do most social videos include captions?", {
            options: [
              "They are required by law",
              "Many viewers watch on mute",
              "Captions make videos longer",
              "They replace thumbnails",
            ],
            answer: "Many viewers watch on mute",
            points: 2,
          }),
          q("true-false", "An AI voiceover should match the pace and emotion of the scenes.", {
            options: ["True", "False"],
            answer: "True",
            points: 1,
          }),
          q("short-answer", "Name one way to keep a character consistent across AI-generated scenes.", {
            answer: "",
            points: 3,
          }),
        ],
      },
      {
        t: "AI Video — Professional Checkpoint",
        d: "Consistency, client work and responsibility.",
        time: 12,
        qs: [
          q("multiple-choice", "Before using AI-generated content commercially, you should check:", {
            options: [
              "The platform's commercial usage rights",
              "The file size",
              "The color scheme",
              "The frame rate",
            ],
            answer: "The platform's commercial usage rights",
            points: 2,
          }),
          q("multiple-choice", "What does disclosing synthetic media mean?", {
            options: [
              "Hiding how the video was made",
              "Clearly telling viewers/partners that AI was used where required",
              "Deleting the project files",
              "Adding more effects",
            ],
            answer: "Clearly telling viewers/partners that AI was used where required",
            points: 2,
          }),
          q("true-false", "A client-style video project should include a brief, a first cut, feedback rounds and final deliverables.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "Name one platform-specific export setting you'd change between TikTok and YouTube.", {
            answer: "",
            points: 3,
          }),
        ],
      },
    ],
    assignments: [
      {
        t: "AI social-media video",
        d: "A 30-second short with the full workflow.",
        i: "Produce a 30-second social video for a topic you know: script, storyboard, AI-generated visuals/clips, voiceover, music and captions. Export in vertical format and submit the video file or link plus your script and storyboard.",
        days: 10,
      },
      {
        t: "AI advertisement",
        d: "A 15-30 second ad with a clear call to action.",
        i: "Create an ad for a real or fictional product: concept, script, storyboard, generated visuals, voiceover, and a final edit with a clear CTA. Submit the video plus a one-paragraph strategy note.",
        days: 12,
      },
      {
        t: "Final project: professional promotional video",
        d: "A complete brief-to-publish AI video production.",
        i: "Produce a professional promotional video (30-90s) for a product, service, or cause: full workflow, consistent style, captions, music, and exports for two platforms. Include your script, storyboard, tool choices with reasons, and a rights/disclosure note. Submit links or files.",
        days: 18,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // COURSE 4 — AI AUTOMATION & PRODUCTIVITY
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: "AI Automation & Productivity",
    subtitle: "Design, build and improve automated workflows that do the boring work",
    description:
      "Automate repetitive tasks with no-code automation platforms, AI agents and connected apps — from email and forms to content and customer support — with transferable workflow-design skills.",
    long: "Every repetitive task is an automation waiting to happen. This course teaches you to see work as workflows: identify what to automate, design trigger→steps→outcome flows, connect apps with no-code platforms, add AI agents for the thinking parts, and test, monitor and document everything. You'll finish by building a complete business automation system you designed yourself.",
    category: "business",
    tutor: "nneka",
    difficulty: "beginner",
    hours: 28,
    rating: 4.8,
    ratingCount: 98,
    gradient: "amber",
    icon: "⚙️",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80",
    prerequisites: [],
    skills: [
      "Workflow design",
      "No-code automation",
      "AI agents & assistants",
      "APIs & webhooks basics",
      "Email & form automation",
      "Testing, monitoring & documentation",
    ],
    featured: false,
    lessons: [
      // ── Beginner ──
      {
        t: "What AI Automation Is & What It Can Automate",
        m: 16,
        n: `${PLANNED} Automation moves data and decisions between apps; AI adds judgment.`,
        tr: "Understand the difference between a rule-based workflow and an AI-assisted one, and see realistic examples: email routing, form processing, report generation, customer support triage.",
      },
      {
        t: "Tour the Automation Platform Landscape",
        m: 18,
        n: `${PLANNED} No-code automation platforms, AI workflow builders, agents, and API tools.`,
        tr: "Survey the categories: visual automation platforms (Zapier/Make-style), AI workflow builders, standalone AI assistants/agents, form + database platforms, and document processors. Platforms change; the categories guide your choices.",
        r: [["Automation tool comparison sheet", "https://learn.forgex.academy/auto-tools.pdf"]],
      },
      {
        t: "Choose the Right Tool for a Workflow",
        m: 18,
        n: `${PLANNED} Match tool capability to task: triggers, integrations, AI steps, and budget.`,
        tr: "A decision framework: which apps must connect, how much AI judgment is needed, volume, cost, and who maintains it. Learn when a simple email filter beats a 20-step automation.",
      },
      {
        t: "Spot Automatable Tasks: The Workflow Audit",
        m: 20,
        n: `${PLANNED} Watch your week and find the repetitive work worth automating.`,
        tr: "Track your repetitive tasks for a day and score them for automation: frequency, time cost, rule-following, error-proneness, and pain. Pick the highest-scoring candidates.",
        r: [["Workflow audit worksheet", "https://learn.forgex.academy/audit-worksheet.pdf"]],
      },
      {
        t: "Design a Workflow: Trigger, Steps, Outcomes",
        m: 20,
        n: `${PLANNED} Every automation is: when X happens, do Y, then Z.`,
        tr: "Sketch workflows before building: trigger event, steps in order, conditions/branches, and the outcome. Learn to draw a simple flowchart that captures the logic without any code.",
        r: [["Workflow diagram template", "https://learn.forgex.academy/workflow-template.pdf"]],
      },
      {
        t: "No-Code Automation Basics",
        m: 22,
        n: `${PLANNED} Build your first automation on a visual platform: trigger, step, test, turn on.`,
        tr: "Create an account on a no-code platform, build a two-step automation (e.g., new spreadsheet row → notification), test it with sample data, and turn it on safely.",
        r: [["No-code automation starter guide (PDF)", "https://learn.forgex.academy/nocode-starter.pdf"]],
      },
      // ── Intermediate ──
      {
        t: "AI Assistants & Agents for Work",
        m: 22,
        n: `${PLANNED} Add judgment to workflows: summarize, draft, classify, decide.`,
        tr: "Use AI steps inside automations — draft replies, classify tickets, summarize documents, extract data — and learn where AI judgment is reliable and where it needs human review.",
      },
      {
        t: "Email Automation",
        m: 20,
        n: `${PLANNED} Welcome emails, follow-ups, alerts and digest emails that send themselves.`,
        tr: "Automate the email workflows businesses run daily: new customer welcome, form-triggered follow-ups, daily digests, and alert emails when something important happens.",
      },
      {
        t: "Form-to-Database Automation",
        m: 20,
        n: `${PLANNED} Every form submission becomes a clean database row — no copy-paste.`,
        tr: "Connect a form to a database/spreadsheet, add AI enrichment (clean names, categorize inquiries), and build a confirmation flow back to the submitter.",
      },
      {
        t: "Content & Social-Media Automation",
        m: 20,
        n: `${PLANNED} Draft, approve and schedule content with AI + automation.`,
        tr: "Build a content pipeline: idea → AI draft → human approval → scheduled post → performance log. Learn where automation helps and where a human must stay in the loop.",
      },
      {
        t: "Document Processing & AI Research",
        m: 20,
        n: `${PLANNED} Invoices, contracts, PDFs and web research — extracted, summarized, filed.`,
        tr: "Automate reading and organizing documents: extract key fields from invoices/PDFs, summarize long documents, and gather research with AI agents that save and cite sources.",
      },
      {
        t: "Build With Me: Automate a Repetitive Business Task",
        m: 26,
        n: `${PLANNED} Watch a full automation get built — audit, design, build, test, document.`,
        tr: "Follow a complete build of a realistic automation (e.g., inquiry form → CRM → AI draft reply → notify team). Your task: build your own version of the same workflow.",
      },
      // ── Professional ──
      {
        t: "Connect Apps: APIs & Webhooks (Beginner Level)",
        m: 24,
        n: `${PLANNED} What APIs and webhooks are, without the jargon — and when your no-code platform uses them for you.`,
        tr: "Understand how apps talk to each other: requests, keys, and webhooks as 'call me when X happens.' Learn to read an API doc enough to configure a connection and troubleshoot a failed one.",
        r: [["APIs & webhooks plain-English guide (PDF)", "https://learn.forgex.academy/api-guide.pdf"]],
      },
      {
        t: "Test, Error-Handle & Monitor Automations",
        m: 20,
        n: `${PLANNED} Automations break; professionals make them fail safely.`,
        tr: "Test with real and edge-case data, add error paths (what happens if a step fails?), set up failure alerts, and review run history — the difference between a demo and a dependable system.",
        r: [["Automation testing checklist", "https://learn.forgex.academy/auto-test-checklist.pdf"]],
      },
      {
        t: "Permissions, Privacy & Responsible Automation",
        m: 18,
        n: `${PLANNED} Least-privilege access, data handling, and knowing when NOT to automate.`,
        tr: "Scope integrations to the minimum permissions, handle personal data responsibly, avoid automating decisions that need human judgment, and keep a human accountable for the system.",
      },
      {
        t: "Document Your Automation: SOP-Style",
        m: 16,
        n: `${PLANNED} A workflow that only you understand is a liability.`,
        tr: "Write simple runbooks: what the automation does, what it needs, how to check it, how to fix common failures, and who owns it. This is what makes automation professional.",
        r: [["Automation runbook template", "https://learn.forgex.academy/runbook.pdf"]],
      },
      {
        t: "Build With Me: Automated Customer-Support Workflow",
        m: 26,
        n: `${PLANNED} A full support triage system: form → AI classification → routing → knowledge-base reply → human escalation.`,
        tr: "Follow a complete customer-support automation: intake form, AI classification and draft answer, routing rules, escalation when confidence is low, and a dashboard log. This is a billable client deliverable.",
      },
      {
        t: "Final Project: AI Business Automation System",
        m: 30,
        n: `${PLANNED} Design, build, test and document a complete automation for a real business process.`,
        tr: "Choose a real business process (yours, a club's, or a fictional company). Deliver: workflow audit, design diagram, working automation with at least one AI step, failure handling and monitoring, permissions review, and a runbook. Submit links and documentation.",
      },
    ],
    quizzes: [
      {
        t: "Automation — Beginner Checkpoint",
        d: "Workflow thinking and tool selection.",
        time: 10,
        qs: [
          q("multiple-choice", "What is a workflow trigger?", {
            options: [
              "The final result of an automation",
              "The event that starts the automation",
              "A type of database",
              "An error message",
            ],
            answer: "The event that starts the automation",
            points: 2,
          }),
          q("multiple-choice", "Which task is a good automation candidate?", {
            options: [
              "A strategic decision with big consequences",
              "A frequent, rule-based task that eats time",
              "A one-off creative project",
              "A conversation you enjoy",
            ],
            answer: "A frequent, rule-based task that eats time",
            points: 2,
          }),
          q("true-false", "You should design a workflow before building it in a tool.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "Name one sign that a task is worth automating.", {
            answer: "",
            points: 3,
          }),
        ],
      },
      {
        t: "Automation — Intermediate Checkpoint",
        d: "AI steps and real workflows.",
        time: 10,
        qs: [
          q("multiple-choice", "Where does AI add the most value inside an automation?", {
            options: [
              "Sending emails faster",
              "Judgment tasks: classifying, drafting, summarizing",
              "Making coffee",
              "Storing files",
            ],
            answer: "Judgment tasks: classifying, drafting, summarizing",
            points: 2,
          }),
          q("multiple-choice", "What should happen when an automation step fails?", {
            options: [
              "Nothing — failures are normal",
              "A defined error path, alert, and a way to retry or escalate",
              "The whole system restarts",
              "You delete the workflow",
            ],
            answer: "A defined error path, alert, and a way to retry or escalate",
            points: 2,
          }),
          q("true-false", "An AI draft should always be reviewed by a human before it goes to customers.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "What is a webhook in one sentence?", {
            answer: "",
            points: 3,
          }),
        ],
      },
      {
        t: "Automation — Professional Checkpoint",
        d: "Reliability, permissions and documentation.",
        time: 10,
        qs: [
          q("multiple-choice", "What does 'least-privilege access' mean for integrations?", {
            options: [
              "Give every app full access to everything",
              "Give each app only the permissions it actually needs",
              "Never connect apps",
              "Use the same password everywhere",
            ],
            answer: "Give each app only the permissions it actually needs",
            points: 2,
          }),
          q("multiple-choice", "Why document automations?", {
            options: [
              "To look busy",
              "So anyone (or future-you) can operate and fix them",
              "To slow down your team",
              "It's required by law",
            ],
            answer: "So anyone (or future-you) can operate and fix them",
            points: 2,
          }),
          q("true-false", "Some decisions should stay with humans even when automation is possible.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "Name one thing to include in an automation runbook.", {
            answer: "",
            points: 3,
          }),
        ],
      },
    ],
    assignments: [
      {
        t: "Automated email workflow",
        d: "Build a real email automation with AI.",
        i: "Build an automation that triggers on a form or spreadsheet row and sends a personalized AI-drafted email (e.g., welcome or follow-up), including a condition and a test run. Submit a link to the workflow and a screenshot of a successful test.",
        days: 8,
      },
      {
        t: "Form-to-database automation",
        d: "Every submission lands in a clean database with AI enrichment.",
        i: "Connect a form to a database/spreadsheet, add an AI step (clean the name, categorize the inquiry), and set up a confirmation email. Test with 3 sample submissions and submit the workflow link plus results.",
        days: 10,
      },
      {
        t: "Final project: AI business automation system",
        d: "Design, build, test and document a complete automation.",
        i: "Choose a real business process. Deliver: audit worksheet, design diagram, working automation with at least one AI step, error handling, permissions review, monitoring setup, and a runbook. Submit workflow links, screenshots and documentation.",
        days: 16,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // COURSE 5 — PROMPT ENGINEERING
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: "Prompt Engineering",
    subtitle: "Design, test, evaluate and improve prompts like a professional",
    description:
      "A serious, systematic course: structure, context, constraints, examples, evaluation and refinement — across text, code, data, image, video and automation platforms.",
    long: "Prompting isn't 'asking better questions' — it's engineering. This course teaches you to systematically design, test, evaluate and improve prompts: structure and constraints, roles and output formats, few-shot examples, iterative refinement, hallucination reduction, evaluation rubrics, and reusable templates. You'll finish with a professional prompt library you can use for business, education, design, coding, content, data, media and automation.",
    category: "data-ai",
    tutor: "nneka",
    difficulty: "beginner",
    hours: 26,
    rating: 4.9,
    ratingCount: 167,
    gradient: "violet",
    icon: "🧠",
    image:
      "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&q=80",
    prerequisites: [],
    skills: [
      "Prompt structure",
      "Few-shot & chain-of-thought techniques",
      "Iterative refinement",
      "Hallucination reduction",
      "Prompt evaluation",
      "Reusable prompt libraries",
    ],
    featured: true,
    lessons: [
      // ── Beginner ──
      {
        t: "What Prompt Engineering Really Is",
        m: 16,
        n: `${PLANNED} Prompting as an engineering discipline: design, test, measure, improve.`,
        tr: "Move beyond 'ask AI better questions.' Learn the prompt lifecycle — design → test → evaluate → refine — and why treating prompts as software (versioned, tested, documented) produces reliable results.",
      },
      {
        t: "How LLMs Respond to Instructions",
        m: 20,
        n: `${PLANNED} Models predict the next token; instructions shape the probability space.`,
        tr: "Understand, in practical terms, how large language models respond to instructions, why wording matters, why models hallucinate, and how temperature and context length affect output.",
        r: [["LLM behavior primer (PDF)", "https://learn.forgex.academy/llm-primer.pdf"]],
      },
      {
        t: "Prompt Structure: Context, Task, Constraints, Output",
        m: 22,
        n: `${PLANNED} The four-part skeleton that makes prompts reproducible.`,
        tr: "Break prompts into parts: context (who/what/why), the task (imperative verb), constraints (limits, rules, exclusions), and output format. Practice labeling each part in real prompts.",
        r: [["Prompt structure cheat sheet", "https://learn.forgex.academy/prompt-structure.pdf"]],
      },
      {
        t: "Roles, Tasks & Output Formatting",
        m: 18,
        n: `${PLANNED} 'Act as…' is a tool, not a magic word — use it with intent.`,
        tr: "Use roles to set expertise and voice, write precise task verbs, and specify output structure (bullets, tables, JSON, code blocks) so results arrive usable.",
      },
      {
        t: "Few-Shot Prompting with Examples",
        m: 20,
        n: `${PLANNED} Show, don't just tell: examples teach format and style better than adjectives.`,
        tr: "Add 1-3 examples (few-shot) of the exact input/output you want. Learn what makes a good example set and when one strong example beats three weak ones.",
      },
      {
        t: "From Weak Prompt to Professional Prompt",
        m: 22,
        n: `${PLANNED} A before/after walkthrough: add context, constraints, examples, format and quality criteria.`,
        tr: "Take a weak prompt ('write about X') and upgrade it step by step into a professional prompt with context, constraints, examples, output format and evaluation criteria. This is the core skill of the course.",
        r: [["Prompt upgrade worksheet", "https://learn.forgex.academy/prompt-upgrade.pdf"]],
      },
      // ── Intermediate ──
      {
        t: "Iterative Refinement: Test, Observe, Improve",
        m: 20,
        n: `${PLANNED} Prompts are hypotheses; runs are experiments.`,
        tr: "Run a prompt, observe what fails (tone, format, omission, hallucination), make one targeted change, and re-test. Keep a changelog so you can see what actually worked.",
      },
      {
        t: "Reduce Hallucinations with References & Verification",
        m: 22,
        n: `${PLANNED} Ground the model in sources and force verification steps.`,
        tr: "Provide reference material, instruct the model to stick to it, ask for citations, and add a self-check step ('only state facts present in the sources; say 'not found' otherwise').",
        r: [["Hallucination-reduction checklist", "https://learn.forgex.academy/hallucination.pdf"]],
      },
      {
        t: "Structured Outputs & Prompt Templates",
        m: 20,
        n: `${PLANNED} JSON, tables and reusable templates with placeholders.`,
        tr: "Design prompts that return structured data (JSON schemas, tables) for automation, and build reusable templates with placeholders ({{topic}}, {{audience}}) so one prompt serves many inputs.",
        r: [["Prompt template library (starters)", "https://learn.forgex.academy/template-starters.pdf"]],
      },
      {
        t: "System Instructions for Reusable Assistants",
        m: 20,
        n: `${PLANNED} One system prompt, many conversations: personas, rules and boundaries.`,
        tr: "Write system instructions that define an assistant's role, rules, tone, capabilities and guardrails — the difference between a one-off prompt and a dependable assistant.",
      },
      {
        t: "Prompting for Writing & Research",
        m: 20,
        n: `${PLANNED} Draft, edit, summarize, compare — prompts for knowledge work.`,
        tr: "Apply the toolkit to writing (structure, voice, revision rounds) and research (planning, source-grounded summaries, gap questions, citation discipline).",
      },
      {
        t: "Prompting for Coding & Debugging",
        m: 22,
        n: `${PLANNED} Specs, constraints, error context and test-first requests.`,
        tr: "Get better code from AI: state the goal, language, constraints, and acceptance criteria; paste exact errors; ask for tests; and review output instead of trusting it.",
      },
      {
        t: "Prompting for Data Analysis",
        m: 20,
        n: `${PLANNED} Ask for methodology, numbers and caveats — not just answers.`,
        tr: "Prompt for analysis that holds up: state the question, provide schema/sample, ask for the method, the key numbers, and the limitations. Learn to request verification of any claim.",
      },
      // ── Professional ──
      {
        t: "Prompting for Image & Video Generation",
        m: 22,
        n: `${PLANNED} Different modalities, different prompt grammars: subject, style, camera, negative prompts.`,
        tr: "Adapt prompting to generative media: structured visual prompts, style and reference consistency, aspect ratios, negative prompts, and how to evaluate visual outputs.",
      },
      {
        t: "Prompting for Business Automation",
        m: 20,
        n: `${PLANNED} Prompts that run inside workflows: classification, extraction, drafting.`,
        tr: "Design prompts for automation steps: classify tickets, extract structured fields, draft replies — with strict output formats, confidence markers, and safe defaults when uncertain.",
      },
      {
        t: "Adapt Prompts Across AI Platforms",
        m: 18,
        n: `${PLANNED} What transfers, what changes: model quirks, context limits, tool differences.`,
        tr: "Learn to port prompts between platforms: adjust for context window, model behavior, tooling differences, and output limits — keeping the core structure intact.",
      },
      {
        t: "Evaluate Prompts with Criteria & Test Inputs",
        m: 22,
        n: `${PLANNED} Define what 'good' means, then measure it.`,
        tr: "Build an evaluation rubric (accuracy, completeness, format, tone, safety), run a prompt against a fixed set of test inputs, score the outputs, and compare prompt versions objectively.",
        r: [["Prompt evaluation rubric", "https://learn.forgex.academy/prompt-rubric.pdf"]],
      },
      {
        t: "Final Project: Build Your Professional Prompt Library",
        m: 30,
        n: `${PLANNED} Your capstone: a reusable, tested, documented prompt library.`,
        tr: "Create a professional prompt library covering business, education, research, design, coding, content creation, data analysis, image/video generation, and automation. Each prompt includes structure, a tested example output, evaluation notes, and a template version.",
      },
    ],
    quizzes: [
      {
        t: "Prompt Engineering — Beginner Checkpoint",
        d: "Structure and fundamentals.",
        time: 10,
        qs: [
          q("multiple-choice", "Which is NOT one of the four core parts of a well-structured prompt?", {
            options: ["Context", "Task", "Constraints", "Password"],
            answer: "Password",
            points: 2,
          }),
          q("multiple-choice", "What is few-shot prompting?", {
            options: [
              "Asking the model to work faster",
              "Providing example input/output pairs to teach format and style",
              "Limiting the model to 5 words",
              "Using a small model",
            ],
            answer: "Providing example input/output pairs to teach format and style",
            points: 2,
          }),
          q("true-false", "Specifying an output format makes results more usable and more consistent.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "Name one part of the prompt skeleton besides the task.", {
            answer: "",
            points: 3,
          }),
        ],
      },
      {
        t: "Prompt Engineering — Intermediate Checkpoint",
        d: "Refinement and reliability.",
        time: 10,
        qs: [
          q("multiple-choice", "When a prompt output is wrong, the professional move is to:", {
            options: [
              "Retry until it looks right",
              "Observe what failed, change one thing, and re-test",
              "Abandon prompting",
              "Blame the model",
            ],
            answer: "Observe what failed, change one thing, and re-test",
            points: 2,
          }),
          q("multiple-choice", "Which technique most directly reduces hallucinations?", {
            options: [
              "Longer prompts",
              "Providing reference material and requiring it to be used/cited",
              "All caps instructions",
              "Asking twice",
            ],
            answer: "Providing reference material and requiring it to be used/cited",
            points: 2,
          }),
          q("true-false", "A system instruction defines rules that apply across many conversations.", {
            options: ["True", "False"],
            answer: "True",
            points: 1,
          }),
          q("short-answer", "Name one thing you would change between the first and second version of a prompt.", {
            answer: "",
            points: 3,
          }),
        ],
      },
      {
        t: "Prompt Engineering — Professional Checkpoint",
        d: "Evaluation, adaptation and libraries.",
        time: 10,
        qs: [
          q("multiple-choice", "What does a prompt evaluation rubric include?", {
            options: [
              "A list of favorite prompts",
              "Criteria like accuracy, completeness, format and tone, scored against test inputs",
              "The price of the model",
              "The model's training date",
            ],
            answer: "Criteria like accuracy, completeness, format and tone, scored against test inputs",
            points: 2,
          }),
          q("multiple-choice", "When porting a prompt to a different platform, you should check:", {
            options: [
              "Context window and output limits",
              "The platform's logo",
              "The model's favorite color",
              "Your internet speed",
            ],
            answer: "Context window and output limits",
            points: 2,
          }),
          q("true-false", "Automation prompts should include strict output formats and safe defaults for uncertainty.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "Name one category you would include in a professional prompt library.", {
            answer: "",
            points: 3,
          }),
        ],
      },
    ],
    assignments: [
      {
        t: "Upgrade a weak prompt",
        d: "Take a weak prompt and make it professional, step by step.",
        i: "Choose a weak prompt ('write about my business' or similar). Upgrade it by adding context, constraints, examples, output format and quality criteria. Document each change and why it helps, with a before/after output comparison.",
        days: 8,
      },
      {
        t: "Prompt evaluation project",
        d: "Build a rubric and test your prompt systematically.",
        i: "Take one of your prompts, define 3-4 evaluation criteria, run it against 5 fixed test inputs, score the outputs, and make one improvement based on the scores. Submit the rubric, scores, and revised prompt.",
        days: 10,
      },
      {
        t: "Final project: professional prompt library",
        d: "A reusable, tested, documented library across domains.",
        i: "Build a prompt library with at least 12 prompts covering business, education, research, design, coding, content, data analysis, image/video generation, and automation. Each prompt needs structure, a tested example, evaluation notes, and a template version. Submit your library document (Notion/Google Doc/Markdown link).",
        days: 16,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // COURSE 6 — AI PRODUCTIVITY & DIGITAL WORK
  // ═══════════════════════════════════════════════════════════════════════
  {
    title: "AI Productivity & Digital Work",
    subtitle: "Work smarter in school, business, freelancing and professional life",
    description:
      "Research, writing, notes, meetings, reports, presentations, project planning, learning, freelancing and career growth — with AI tools and a personal productivity system you actually build.",
    long: "AI turns hours of work into minutes — if you have a system. This practical course covers the everyday ways AI makes knowledge work faster: research and summarization, notes and meetings, emails and reports, presentations, spreadsheets, project planning, learning, freelancing and career development. Every lesson includes a 'Do This Now' activity, and the final project is your own documented Personal AI Productivity System.",
    category: "business",
    tutor: "nneka",
    difficulty: "beginner",
    hours: 24,
    rating: 4.8,
    ratingCount: 87,
    gradient: "emerald",
    icon: "⚡",
    image:
      "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&q=80",
    prerequisites: [],
    skills: [
      "AI research & summarization",
      "AI writing & notes",
      "Meetings & presentations",
      "Project & knowledge management",
      "Freelancing & career growth",
      "Verification & AI ethics",
    ],
    featured: true,
    lessons: [
      // ── Beginner ──
      {
        t: "AI-Powered Work: The New Professional Baseline",
        m: 16,
        n: `${PLANNED} What AI changes about knowledge work — and what stays human.`,
        tr: "See where AI adds real leverage in daily work and where humans stay in charge: judgment, relationships, accountability. Set a personal rule: AI drafts, you decide.",
      },
      {
        t: "Choose Productivity Tools for Your Workflow",
        m: 18,
        n: `${PLANNED} Match tools to your tasks, privacy needs and budget — not hype.`,
        tr: "A framework for choosing AI productivity tools: task fit, accuracy, privacy, integrations, cost and workflow compatibility. Build your personal shortlist as you go.",
        r: [["AI productivity tool worksheet", "https://learn.forgex.academy/prod-tools.pdf"]],
      },
      {
        t: "AI Research & Search That Saves Hours",
        m: 20,
        n: `${PLANNED} Plan research, gather sources, summarize and cite — fast.`,
        tr: "Use AI search and research assistants to scope a topic, collect and read sources, and summarize with citations. Learn the verification habit: check claims against the original sources.",
        r: [["AI research workflow guide (PDF)", "https://learn.forgex.academy/research-guide.pdf"]],
      },
      {
        t: "Summarize Documents & Long Content",
        m: 18,
        n: `${PLANNED} Contracts, articles, reports and videos — digest them in minutes.`,
        tr: "Summarize long documents with structure (TL;DR, key points, action items, questions), and learn how to prompt for the summary shape you need rather than a wall of text.",
      },
      {
        t: "AI Note-Taking & Meeting Assistants",
        m: 20,
        n: `${PLANNED} Never lose a decision again: capture, organize and action meetings.`,
        tr: "Use AI note-taking and meeting assistants to capture, transcribe and summarize meetings into decisions and action items — and learn what to record and how to respect privacy.",
      },
      {
        t: "Write Emails & Reports with AI",
        m: 20,
        n: `${PLANNED} Draft in seconds, edit like a professional.`,
        tr: "Draft clear emails (with tone control) and structured reports with AI, then edit for accuracy, voice and brevity. Practice the loop: draft → review → revise → send.",
        r: [["Email & report prompt templates", "https://learn.forgex.academy/writing-templates.pdf"]],
      },
      // ── Intermediate ──
      {
        t: "Create Presentations with AI",
        m: 20,
        n: `${PLANNED} From outline to slide deck: structure first, visuals second.`,
        tr: "Use AI to outline a presentation, generate slide content and speaker notes, and design visuals — then apply the golden rules: one idea per slide, minimal text, strong visuals.",
      },
      {
        t: "Spreadsheet & Data Assistance with AI",
        m: 20,
        n: `${PLANNED} Describe what you need; get formulas, cleaning steps and interpretations.`,
        tr: "Use AI to write spreadsheet formulas, explain errors, clean data, and interpret results. Learn to describe your data structure precisely so AI gives usable answers.",
      },
      {
        t: "Plan Projects with AI",
        m: 20,
        n: `${PLANNED} From vague goal to actionable plan with phases, tasks and owners.`,
        tr: "Turn a goal into a project plan: break it down, estimate, sequence, assign owners and deadlines, and use AI to spot risks and next steps you missed.",
        r: [["Project plan template", "https://learn.forgex.academy/plan-template.pdf"]],
      },
      {
        t: "Learn Faster with AI",
        m: 18,
        n: `${PLANNED} AI as a tutor: explain, quiz, practice, and connect ideas.`,
        tr: "Use AI to learn anything: ask for explanations at your level, generate practice questions, quiz yourself, and have it correct and explain your mistakes.",
      },
      {
        t: "Career Development with AI: Resume, Portfolio & Interviews",
        m: 20,
        n: `${PLANNED} Stronger applications and interview practice, with honest editing.`,
        tr: "Draft and tailor resumes and cover letters, build portfolio narratives, and run mock interviews with AI feedback — while keeping your documents honest and human.",
      },
      {
        t: "Freelancing with AI: Proposals, Clients & Delivery",
        m: 22,
        n: `${PLANNED} Win clients and deliver faster without overpromising.`,
        tr: "Use AI to draft proposals and scopes, plan client work, communicate progress, and package deliverables professionally. Learn where AI helps close deals and where a human touch is non-negotiable.",
      },
      // ── Professional ──
      {
        t: "Build With Me: Your Personal AI Workflow",
        m: 24,
        n: `${PLANNED} Watch a real knowledge-work task run through a personal AI workflow — then build yours.`,
        tr: "Follow a complete workflow for a real task (e.g., 'research + summarize + draft a client proposal'), then document your own version with your chosen tools for a task you actually do.",
      },
      {
        t: "Connect Productivity Tools into One System",
        m: 20,
        n: `${PLANNED} Notes, tasks, calendar and documents working as one.`,
        tr: "Connect the tools you chose into a personal system: capture in one place, process daily, and let automations move information between apps. Simple beats clever.",
        r: [["Personal system map template", "https://learn.forgex.academy/system-map.pdf"]],
      },
      {
        t: "Review & Verify AI-Generated Work",
        m: 18,
        n: `${PLANNED} Trust but verify: the checklist before anything ships under your name.`,
        tr: "Build a verification routine: check facts against sources, test numbers, review tone and policy compliance, and confirm you can defend everything you publish. Your name on it is the real quality gate.",
        r: [["AI output verification checklist", "https://learn.forgex.academy/verify-checklist.pdf"]],
      },
      {
        t: "AI Ethics & Responsible Use at Work",
        m: 16,
        n: `${PLANNED} Privacy, disclosure, bias and accountability.`,
        tr: "Handle sensitive data carefully, disclose AI use where expected, watch for biased output, and stay accountable for the work you approve — the habits of a trusted professional.",
      },
      {
        t: "Build With Me: A Week of AI-Assisted Work",
        m: 24,
        n: `${PLANNED} Plan a full week with AI: research, writing, meetings, planning, delivery.`,
        tr: "Watch a sample work week run on a personal AI system, then run your own week: pick 5 real tasks, apply your workflows, and log time saved and quality outcomes.",
      },
      {
        t: "Final Project: Build Your Personal AI Productivity System",
        m: 28,
        n: `${PLANNED} Your capstone: a documented system of tools, workflows, templates and routines.`,
        tr: "Deliver your Personal AI Productivity System: chosen tools with reasons, 5+ documented workflows (with prompts/templates), daily routines, verification practices, privacy rules, and automation ideas. Use it for school, business, freelancing, or professional work — and submit the documentation.",
      },
    ],
    quizzes: [
      {
        t: "AI Productivity — Beginner Checkpoint",
        d: "Choosing tools and the basic workflows.",
        time: 10,
        qs: [
          q("multiple-choice", "What is the healthiest default relationship with AI output?", {
            options: [
              "Ship it exactly as generated",
              "AI drafts, you decide — review and edit before it goes out",
              "Never use AI output at all",
              "Only use AI for personal notes",
            ],
            answer: "AI drafts, you decide — review and edit before it goes out",
            points: 2,
          }),
          q("multiple-choice", "When choosing an AI productivity tool, which factor matters most?", {
            options: [
              "How many followers it has",
              "Fit to your actual task, privacy needs and budget",
              "The most features possible",
              "The fanciest logo",
            ],
            answer: "Fit to your actual task, privacy needs and budget",
            points: 2,
          }),
          q("true-false", "Meeting assistants should capture decisions and action items, not just the transcript.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "Name one task where you'd keep a human fully in charge instead of automating it.", {
            answer: "",
            points: 3,
          }),
        ],
      },
      {
        t: "AI Productivity — Intermediate Checkpoint",
        d: "Applying AI across knowledge work.",
        time: 10,
        qs: [
          q("multiple-choice", "What is the best first step when creating a presentation with AI?", {
            options: [
              "Picking a template",
              "Using AI to outline the story and structure",
              "Adding animations",
              "Recording narration",
            ],
            answer: "Using AI to outline the story and structure",
            points: 2,
          }),
          q("multiple-choice", "How can AI best support learning?", {
            options: [
              "Writing your assignments for you",
              "Explaining concepts, generating practice questions and correcting mistakes",
              "Choosing your courses",
              "Skipping your studying",
            ],
            answer: "Explaining concepts, generating practice questions and correcting mistakes",
            points: 2,
          }),
          q("true-false", "A resume or portfolio should stay truthful even when AI helps draft it.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "Name one way AI helps you plan a project.", {
            answer: "",
            points: 3,
          }),
        ],
      },
      {
        t: "AI Productivity — Professional Checkpoint",
        d: "Systems, verification and responsibility.",
        time: 10,
        qs: [
          q("multiple-choice", "What does 'trust but verify' mean when using AI?", {
            options: [
              "Believe everything the AI says",
              "Use AI freely, but check facts, numbers and sources before relying on output",
              "Never use AI",
              "Only verify other people's work",
            ],
            answer: "Use AI freely, but check facts, numbers and sources before relying on output",
            points: 2,
          }),
          q("multiple-choice", "What should a Personal AI Productivity System include?", {
            options: [
              "Only a list of tools",
              "Tools, workflows, templates, routines, verification practices and automation ideas",
              "A collection of prompts with no context",
              "Your passwords",
            ],
            answer: "Tools, workflows, templates, routines, verification practices and automation ideas",
            points: 2,
          }),
          q("true-false", "You remain accountable for work you approve even when AI generated it.", {
            options: ["True", "False"],
            answer: "True",
            points: 2,
          }),
          q("short-answer", "Name one verification step you'd run before sending AI-generated work.", {
            answer: "",
            points: 3,
          }),
        ],
      },
    ],
    assignments: [
      {
        t: "Map your productivity workflow",
        d: "Document how you'd handle a real recurring task with AI.",
        i: "Pick one recurring task you actually do (research a topic, write a report, plan an event). Document your AI workflow: chosen tools with reasons, the prompts you use, the review steps, and time saved. Submit your documentation.",
        days: 8,
      },
      {
        t: "Run a week of AI-assisted work",
        d: "Apply your workflows to 5 real tasks and measure the result.",
        i: "Choose 5 real tasks across research, writing, planning, communication and learning. Run them through AI workflows, record time spent vs before, and note quality outcomes and one thing you'd improve. Submit your log.",
        days: 12,
      },
      {
        t: "Final project: your personal AI productivity system",
        d: "A complete, documented system you can actually use.",
        i: "Deliver your Personal AI Productivity System: chosen tools (with reasons), 5+ documented workflows with prompts/templates, daily routines, verification practices, privacy rules, and 3 automation ideas. Submit as a Notion/Google Doc/Markdown link.",
        days: 16,
      },
    ],
  },
];