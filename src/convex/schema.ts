import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  TUTOR: "tutor",
  STUDENT: "student",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.OWNER),
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.TUTOR),
  v.literal(ROLES.STUDENT),
);
export type Role = Infer<typeof roleValidator>;

export const DIFFICULTIES = [
  "beginner",
  "intermediate",
  "advanced",
  "professional",
  "expert",
] as const;
export const difficultyValidator = v.union(
  v.literal("beginner"),
  v.literal("intermediate"),
  v.literal("advanced"),
  v.literal("professional"),
  v.literal("expert"),
);
export type Difficulty = Infer<typeof difficultyValidator>;

export const QUESTION_TYPES = [
  "multiple-choice",
  "true-false",
  "short-answer",
] as const;

export const questionValidator = v.object({
  type: v.union(
    v.literal("multiple-choice"),
    v.literal("true-false"),
    v.literal("short-answer"),
  ),
  question: v.string(),
  options: v.optional(v.array(v.string())),
  answer: v.optional(v.string()),
  // Short-answer: extra accepted answers matched case-insensitively.
  acceptedAnswers: v.optional(v.array(v.string())),
  points: v.optional(v.number()),
  explanation: v.optional(v.string()),
});
export type Question = Infer<typeof questionValidator>;

/** One structured question inside an assignment builder document. */
export const assignmentQuestionValidator = v.object({
  type: v.union(
    v.literal("short-text"),
    v.literal("long-text"),
    v.literal("file"),
    v.literal("link"),
    v.literal("text-and-file"),
  ),
  question: v.string(),
  maxMarks: v.optional(v.number()),
  modelAnswer: v.optional(v.string()),
  markingInstructions: v.optional(v.string()),
});
export type AssignmentQuestion = Infer<typeof assignmentQuestionValidator>;

/** Instructor-configured completion rules for a course. Absent fields fall
 *  back to the defaults in `courseRequirements` (learn.ts). */
export const courseCompletionRequirementsValidator = v.object({
  videoWatchPercent: v.number(), // default 90; allowed 70/80/90/95/100
  requireQuizzes: v.boolean(),
  quizPassPercent: v.number(), // required passing score for course quizzes
  requireAssignments: v.boolean(),
  requireAllLessons: v.boolean(),
});
export type CourseCompletionRequirements = Infer<
  typeof courseCompletionRequirementsValidator
>;

export const resourceValidator = v.object({
  name: v.string(),
  /** External link URL (kind: "link") or the resolved public URL for legacy
   *  resources. For storage-backed files this is left empty — the URL is
   *  resolved server-side from `storageId` at read time. */
  url: v.string(),
  /** Convex file-storage id for uploaded files (PDFs, docs…). */
  storageId: v.optional(v.id("_storage")),
  kind: v.optional(v.union(v.literal("file"), v.literal("link"))),
  fileType: v.optional(v.string()),
  fileSize: v.optional(v.number()),
  uploadedBy: v.optional(v.id("users")),
  createdAt: v.optional(v.number()),
});
export type Resource = Infer<typeof resourceValidator>;

/** A single input field in the dynamic prompt builder. `key` is the
 *  placeholder name used inside the template as `{{key}}`. */
export const promptFieldValidator = v.object({
  key: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("text"),
    v.literal("textarea"),
    v.literal("select"),
  ),
  placeholder: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
  required: v.optional(v.boolean()),
});
export type PromptField = Infer<typeof promptFieldValidator>;

export const socialsValidator = v.object({
  website: v.optional(v.string()),
  github: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  twitter: v.optional(v.string()),
  youtube: v.optional(v.string()),
});
export type Socials = Infer<typeof socialsValidator>;

// --- Database fallback & sync -------------------------------------------
// Convex stays the primary. The secondary store is only ever a dumb,
// temporary transport for essential writes during a Convex outage. Every op
// carries a stable client-side id, so retries/replays are idempotent and can
// never create duplicates. Authorization happens at apply time on Convex —
// never in the fallback store.
// ---------------------------------------------------------------------------

/** Idempotency ledger: one row per op id ever applied on Convex. */
const syncAppliedOpsTable = defineTable({
  opId: v.string(),
  kind: v.string(),
  userId: v.optional(v.id("users")),
  appliedAt: v.number(),
  serverAt: v.optional(v.number()),
  result: v.optional(v.string()),
  error: v.optional(v.string()),
})
  .index("by_op", ["opId"])
  .index("by_appliedAt", ["appliedAt"])
  .index("by_user_at", ["userId", "appliedAt"]);

/** Compact counters for the admin Sync dashboard (one row per kind). */
const syncCountersTable = defineTable({
  kind: v.string(),
  applied: v.number(),
  failed: v.number(),
  lastAppliedAt: v.optional(v.number()),
  lastError: v.optional(v.string()),
  lastErrorAt: v.optional(v.number()),
}).index("by_kind", ["kind"]);

/** Recently failed sync ops (bounded, for admin visibility + retry). */
const syncFailuresTable = defineTable({
  opId: v.string(),
  kind: v.string(),
  userId: v.optional(v.id("users")),
  error: v.string(),
  firstFailedAt: v.number(),
  lastFailedAt: v.number(),
  attempts: v.number(),
  lastPayload: v.optional(v.any()),
})
  .index("by_op", ["opId"])
  .index("by_lastFailedAt", ["lastFailedAt"]);

/**
 * Cached rollup for the public landing page stats, recomputed hourly by a
 * cron (replaces three whole-collection scans on every visitor view).
 */
const siteStatsCacheTable = defineTable({
  key: v.string(),
  courses: v.optional(v.number()),
  students: v.optional(v.number()),
  tutors: v.optional(v.number()),
  certificates: v.optional(v.number()),
  // Projects platform rollup (key: "projects").
  portfolios: v.optional(v.number()),
  projects: v.optional(v.number()),
  creators: v.optional(v.number()),
  discoverable: v.optional(v.number()),
  views: v.optional(v.number()),
  updatedAt: v.number(),
}).index("by_key", ["key"]);

/**
 * Fallback-mode tracking — written only when a real failure happens, so
 * tracking itself costs nothing during normal operation.
 */
const syncUsageBudgetTable = defineTable({
  key: v.string(),
  degradedSince: v.optional(v.number()),
  lastProbeOk: v.optional(v.number()),
  totalFallbackOps: v.number(),
  note: v.optional(v.string()),
}).index("by_key", ["key"]);

// ---------------------------------------------------------------------------
// ForgeX Projects — portfolio platform
// ---------------------------------------------------------------------------
// Academy + Opportunity Hub remain in the codebase and database, but they are
// LOCKED future products: `featureFlags` is the single source of truth for
// which product is live, so launching a product is a flag change, not a
// rebuild. Projects is the active product.
// ---------------------------------------------------------------------------

export const PRODUCT_KEYS = ["projects", "academy", "opportunity-hub"] as const;
export type ProductKey = (typeof PRODUCT_KEYS)[number];

export const featureStateValidator = v.union(
  v.literal("active"),
  v.literal("locked"),
  v.literal("hidden"),
);
export type FeatureState = Infer<typeof featureStateValidator>;

const featureFlagsTable = defineTable({
  key: v.string(), // ProductKey
  label: v.string(),
  tagline: v.optional(v.string()),
  state: featureStateValidator,
  comingSoonCopy: v.optional(v.string()),
  order: v.optional(v.number()),
  updatedAt: v.number(),
}).index("by_key", ["key"]);

/** Three deliberate visibility levels for a portfolio (see docs in UI). */
export const portfolioVisibilityValidator = v.union(
  v.literal("draft"), // only the owner
  v.literal("published"), // anyone with the link
  v.literal("discoverable"), // link + the public Explore section
);
export type PortfolioVisibility = Infer<
  typeof portfolioVisibilityValidator
>;

export const portfolioTemplateValidator = v.union(
  v.literal("carbon"),
  v.literal("aurora"),
  v.literal("paper"),
);
export type PortfolioTemplate = Infer<typeof portfolioTemplateValidator>;

export const portfolioSkillValidator = v.object({
  name: v.string(),
  level: v.optional(v.number()), // 1–5, optional
});

export const portfolioExperienceValidator = v.object({
  role: v.string(),
  org: v.string(),
  location: v.optional(v.string()),
  start: v.optional(v.string()),
  end: v.optional(v.string()),
  current: v.optional(v.boolean()),
  description: v.optional(v.string()),
});

export const portfolioEducationValidator = v.object({
  school: v.string(),
  qualification: v.optional(v.string()),
  field: v.optional(v.string()),
  start: v.optional(v.string()),
  end: v.optional(v.string()),
  description: v.optional(v.string()),
});

export const portfolioServiceValidator = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  price: v.optional(v.string()),
});

export const portfolioLinkValidator = v.object({
  label: v.string(),
  url: v.string(),
});

const portfoliosTable = defineTable({
  /** Legacy owner (pre-separation accounts created via Academy auth). */
  userId: v.optional(v.id("users")),
  /** Owner Portfolio creator account — the primary owner since the
   *  Portfolio got its own authentication system. */
  creatorId: v.optional(v.id("portfolioUsers")),
  slug: v.string(),
  displayName: v.string(),
  headline: v.optional(v.string()),
  bio: v.optional(v.string()),
  about: v.optional(v.string()),
  location: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  // e.g. "Open to opportunities" — shown on the public portfolio's About card.
  availability: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  coverUrl: v.optional(v.string()),
  template: portfolioTemplateValidator,
  accent: v.optional(v.string()), // accent colour key
  visibility: portfolioVisibilityValidator,
  skills: v.array(portfolioSkillValidator),
  experience: v.array(portfolioExperienceValidator),
  education: v.array(portfolioEducationValidator),
  services: v.array(portfolioServiceValidator),
  links: v.array(portfolioLinkValidator),
  seoTitle: v.optional(v.string()),
  seoDescription: v.optional(v.string()),
  // Owner-controlled ordering of the public sections.
  sectionOrder: v.optional(v.array(v.string())),
  // Admin moderation
  featured: v.boolean(),
  suspended: v.boolean(),
  views: v.number(),
  publishedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_creator", ["creatorId"])
  .index("by_slug", ["slug"])
  .index("by_visibility", ["visibility"])
  .index("by_featured", ["featured"]);

const portfolioProjectsTable = defineTable({
  portfolioId: v.id("portfolios"),
  userId: v.optional(v.id("users")),
  /** Creator account that owns this project (creator auth system). */
  creatorId: v.optional(v.id("portfolioUsers")),
  title: v.string(),
  summary: v.string(),
  description: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  // Work category used by the Explore filters, e.g. "Web", "Branding".
  category: v.optional(v.string()),
  tags: v.array(v.string()),
  liveUrl: v.optional(v.string()),
  repoUrl: v.optional(v.string()),
  year: v.optional(v.string()),
  order: v.number(),
  featured: v.boolean(),
  removed: v.optional(v.boolean()), // moderator-removed
  removedReason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_portfolio", ["portfolioId", "order"])
  .index("by_user", ["userId"])
  .index("by_creator", ["creatorId"])
  .index("by_featured", ["featured"])
  .index("by_createdAt", ["createdAt"]);

/**
 * ForgeX Network Portfolio — its OWN settings document.
 *
 * This is deliberately a separate table from every Academy/admin setting so
 * the two products can never overwrite each other's configuration:
 *   - Portfolio admin credential (scrypt hash + per-install salt; the
 *     plaintext password never exists in this repo or the client bundle)
 *   - Portfolio-only SMTP credentials (never the Academy mail config)
 *   - Portfolio-only auth policy, SEO/share defaults
 *
 * Singleton row keyed "portfolio".
 */
const portfolioSettingsTable = defineTable({
  key: v.string(),
  /** PBKDF2-SHA256 `salt:hash` — the plaintext password is never stored. */
  adminPasswordHash: v.string(),
  adminPasswordUpdatedAt: v.number(),
  /** Sign-in throttling: consecutive failures + when the last one happened. */
  failedAttempts: v.optional(v.number()),
  lastFailedAt: v.optional(v.number()),
  smtp: v.optional(
    v.object({
      host: v.string(),
      port: v.number(),
      username: v.string(),
      password: v.string(),
      fromEmail: v.string(),
      fromName: v.string(),
      secure: v.boolean(),
    }),
  ),
  auth: v.optional(
    v.object({
      allowSignups: v.boolean(),
      requireEmailVerification: v.boolean(),
      resetLinkTtlMinutes: v.number(),
    }),
  ),
  /**
   * Portfolio email pause — when true, Portfolio mail is still queued (OTP
   * codes, notifications, admin composes) but nothing is sent until it is
   * resumed. Lets the portal be quiet without losing a single message.
   */
  emailPaused: v.optional(v.boolean()),
  emailPausedAt: v.optional(v.number()),
  seo: v.optional(
    v.object({
      titleTemplate: v.string(),
      defaultDescription: v.string(),
      defaultImage: v.string(),
    }),
  ),
  updatedAt: v.number(),
}).index("by_key", ["key"]);

/**
 * Portfolio-owned public content (branding, home slides, contact, socials,
 * SEO…). Kept in this table rather than the Academy `siteContent` so editing
 * the Portfolio can never overwrite an Academy setting, and vice versa.
 */
const portfolioContentTable = defineTable({
  key: v.string(),
  value: v.any(),
  updatedAt: v.number(),
}).index("by_key", ["key"]);

/**
 * Portfolio admin sessions — fully independent of Academy authentication.
 * Only the SHA-256 hash of a session token is stored; the raw token lives in
 * the browser under its own storage key.
 */
const portfolioAdminSessionsTable = defineTable({
  tokenHash: v.string(),
  createdAt: v.number(),
  lastUsedAt: v.number(),
  expiresAt: v.number(),
}).index("by_token", ["tokenHash"]);

/** "Notify me" sign-ups from the locked product pages. */
const productWaitlistTable = defineTable({
  product: v.string(), // ProductKey
  email: v.string(),
  userId: v.optional(v.id("users")),
  createdAt: v.number(),
  notified: v.optional(v.boolean()),
})
  .index("by_product", ["product", "createdAt"])
  .index("by_email", ["email"]);

/* ═════════════════════════════════════════════════════════════════════════
   PORTFOLIO CREATOR ACCOUNTS — a completely separate identity system.

   These accounts are NOT Academy accounts (the Academy `users` table above is
   untouched by every mutation here) and NOT Portfolio admin credentials
   (`portfolioSettings` / `portfolioAdminSessions`). A Portfolio creator signs
   in with Email → OTP and can only ever manage their own portfolio.
   ═════════════════════════════════════════════════════════════════════════ */

export const PORTFOLIO_USER_ROLE = "portfolio_user" as const;

const portfolioUsersTable = defineTable({
  email: v.string(), // lowercased, unique per account
  name: v.optional(v.string()),
  /** Professional title, e.g. "UI/UX Designer". */
  title: v.optional(v.string()),
  bio: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  role: v.literal(PORTFOLIO_USER_ROLE), // always portfolio_user — never admin
  status: v.union(v.literal("active"), v.literal("suspended")),
  /** False until the post-OTP profile step (name/title/bio/photo) is done. */
  onboarded: v.boolean(),
  invitedByAdmin: v.optional(v.boolean()),
  lastLoginAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_email", ["email"])
  .index("by_status", ["status"])
  .index("by_createdAt", ["createdAt"]);

/** Portfolio creator sessions — token stored hashed, separate storage key on
 *  the client, separate table here. An Academy session can never satisfy this
 *  check and vice versa. */
const portfolioUserSessionsTable = defineTable({
  tokenHash: v.string(),
  userId: v.id("portfolioUsers"),
  createdAt: v.number(),
  lastUsedAt: v.number(),
  expiresAt: v.number(),
})
  .index("by_token", ["tokenHash"])
  .index("by_user", ["userId"]);

/** One-time email codes for Portfolio sign-in / sign-up. Only the hash of the
 *  6-digit code is stored; codes expire quickly and expire after attempts. */
const portfolioAuthCodesTable = defineTable({
  email: v.string(),
  codeHash: v.string(),
  purpose: v.union(v.literal("signin"), v.literal("signup")),
  expiresAt: v.number(),
  attempts: v.number(),
  consumed: v.boolean(),
  createdAt: v.number(),
})
  .index("by_email", ["email", "createdAt"])
  .index("by_createdAt", ["createdAt"]);

/**
 * Portfolio email log — EVERY email the Portfolio system sends is recorded
 * here (OTP, notifications, admin composes) with its status and failure
 * reason, powering the Email management screens in /adminbrand.
 */
const portfolioEmailLogsTable = defineTable({
  to: v.string(),
  subject: v.string(),
  html: v.string(),
  template: v.string(), // otp | welcome | published | update | admin_notification | custom
  kind: v.union(
    v.literal("auth"),
    v.literal("notification"),
    v.literal("custom"),
  ),
  status: v.union(
    v.literal("pending"),
    v.literal("sent"),
    v.literal("failed"),
  ),
  error: v.optional(v.string()),
  attempts: v.number(),
  sentAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_createdAt", ["createdAt"])
  .index("by_status", ["status"]);

/**
 * Academy email pause switch (singleton, key "email"). When paused, the shared
 * email queue keeps collecting every message but the worker claims nothing, so
 * turning the Academy back on resumes delivery exactly where it stopped — no
 * email is ever lost while the service is quiet.
 */
const emailPauseTable = defineTable({
  key: v.string(),
  paused: v.boolean(),
  pausedAt: v.optional(v.number()),
  pausedBy: v.optional(v.string()),
  updatedAt: v.number(),
}).index("by_key", ["key"]);

/**
 * Portfolio announcements — the header notification banner shown on the public
 * Portfolio website. FULLY Portfolio-owned: created, published and deleted
 * from the Portfolio admin portal (/adminbrand), with no connection to the
 * Academy `announcements` / `notifications` tables.
 */
const portfolioNotificationsTable = defineTable({
  title: v.string(),
  body: v.string(),
  /** Optional call-to-action target (in-app path or absolute URL). */
  link: v.optional(v.string()),
  linkLabel: v.optional(v.string()),
  /** Visual tone of the pill in the header. */
  tone: v.union(
    v.literal("info"),
    v.literal("success"),
    v.literal("warning"),
  ),
  /** Published items are visible to every visitor; drafts stay admin-only. */
  published: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_published", ["published", "createdAt"])
  .index("by_createdAt", ["createdAt"]);

/* ═════════════════════════════════════════════════════════════════════════
   PORTFOLIO MESSAGING — visitor ↔ portfolio owner conversations.

   Same architecture and UI as the ForgeX chat (thread + message rows, one
   conversation per visitor, unread counters, read receipts), but stored in
   Portfolio-owned tables keyed to a portfolio + creator. Guests message
   without an account using a server-issued guest token kept in the browser.
   ═════════════════════════════════════════════════════════════════════════ */

const portfolioThreadsTable = defineTable({
  portfolioId: v.id("portfolios"),
  portfolioSlug: v.string(),
  /** Owner account — recipients of this conversation. */
  creatorId: v.id("portfolioUsers"),
  /** SHA-256 of the guest's conversation token (never the raw token). */
  guestTokenHash: v.string(),
  /** Minimum identity for a guest sender: a display name + optional contact. */
  guestName: v.string(),
  guestEmail: v.optional(v.string()),
  /** Which portfolio project/section the visitor came from (optional). */
  context: v.optional(v.string()),
  status: v.union(
    v.literal("open"),
    v.literal("archived"),
    v.literal("spam"),
  ),
  lastMessageAt: v.number(),
  lastMessagePreview: v.string(),
  lastFrom: v.union(v.literal("guest"), v.literal("owner")),
  /** Unread counters for each side (guest counter drives the visitor badge). */
  guestUnread: v.number(),
  ownerUnread: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_token", ["guestTokenHash"])
  .index("by_creator", ["creatorId", "lastMessageAt"])
  .index("by_portfolio", ["portfolioId", "lastMessageAt"])
  .index("by_lastMessageAt", ["lastMessageAt"]);

const portfolioMessagesTable = defineTable({
  threadId: v.id("portfolioThreads"),
  /** Who wrote it — the guest visitor or the portfolio owner. */
  from: v.union(v.literal("guest"), v.literal("owner")),
  body: v.string(),
  /** Optional attachment (image / file / voice) in Convex file storage. */
  kind: v.optional(
    v.union(
      v.literal("text"),
      v.literal("image"),
      v.literal("file"),
      v.literal("voice"),
    ),
  ),
  storageId: v.optional(v.id("_storage")),
  url: v.optional(v.string()),
  fileName: v.optional(v.string()),
  fileSize: v.optional(v.number()),
  mimeType: v.optional(v.string()),
  duration: v.optional(v.number()),
  createdAt: v.number(),
  readAt: v.optional(v.number()),
})
  .index("by_thread", ["threadId", "createdAt"])
  .index("by_thread_unread", ["threadId", "from", "readAt"]);

/**
 * Portfolio help requests — the "Get help / report an issue" channel.
 *
 * Anyone (visitor, creator, or admin) can send one without an account. The
 * Portfolio admin portal has a dedicated Help desk to read, reply to and
 * resolve them; replies are queued through the Portfolio mail service.
 */
const portfolioHelpRequestsTable = defineTable({
  name: v.string(),
  email: v.string(),
  topic: v.union(
    v.literal("bug"),
    v.literal("account"),
    v.literal("portfolio"),
    v.literal("billing"),
    v.literal("other"),
  ),
  subject: v.string(),
  message: v.string(),
  /** Where they were when they hit the problem (path + optional email). */
  pageUrl: v.optional(v.string()),
  /** Signed-in creator, when they were logged in (guests have no id). */
  creatorId: v.optional(v.id("portfolioUsers")),
  status: v.union(
    v.literal("open"),
    v.literal("answered"),
    v.literal("resolved"),
  ),
  /** Threaded staff replies (newest last) — keeps the whole history. */
  replies: v.array(
    v.object({
      body: v.string(),
      adminName: v.string(),
      createdAt: v.number(),
      emailed: v.boolean(),
    }),
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_createdAt", ["createdAt"])
  .index("by_status", ["status", "createdAt"])
  .index("by_creator", ["creatorId", "createdAt"]);

/** Reports raised against a public portfolio. */
const portfolioReportsTable = defineTable({
  portfolioId: v.id("portfolios"),
  slug: v.string(),
  reason: v.string(),
  details: v.optional(v.string()),
  reportedBy: v.optional(v.id("users")),
  createdAt: v.number(),
  resolved: v.optional(v.boolean()),
  resolvedAt: v.optional(v.number()),
})
  .index("by_createdAt", ["createdAt"])
  .index("by_resolved", ["resolved"])
  .index("by_portfolio", ["portfolioId"]);

const schema = defineSchema(
  {
    // -----------------------------------------------------------------------
    // Auth (do not remove)
    // -----------------------------------------------------------------------
    ...authTables,

    // Database fallback & sync tables (defined above the schema for clarity).
    syncAppliedOps: syncAppliedOpsTable,
    syncCounters: syncCountersTable,
    syncFailures: syncFailuresTable,
    siteStatsCache: siteStatsCacheTable,
    syncUsageBudget: syncUsageBudgetTable,

    // ForgeX Projects — portfolio platform + product feature flags.
    featureFlags: featureFlagsTable,
    portfolios: portfoliosTable,
    portfolioProjects: portfolioProjectsTable,
    portfolioNotifications: portfolioNotificationsTable,
    portfolioThreads: portfolioThreadsTable,
    portfolioMessages: portfolioMessagesTable,
    portfolioHelpRequests: portfolioHelpRequestsTable,
    emailPause: emailPauseTable,
    productWaitlist: productWaitlistTable,
    portfolioReports: portfolioReportsTable,
    portfolioSettings: portfolioSettingsTable,
    portfolioAdminSessions: portfolioAdminSessionsTable,
    portfolioContent: portfolioContentTable,
    portfolioUsers: portfolioUsersTable,
    portfolioUserSessions: portfolioUserSessionsTable,
    portfolioAuthCodes: portfolioAuthCodesTable,
    portfolioEmailLogs: portfolioEmailLogsTable,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),

      // academy profile
      role: v.optional(roleValidator),
      headline: v.optional(v.string()),
      bio: v.optional(v.string()),
      skills: v.optional(v.array(v.string())),
      socials: v.optional(socialsValidator),
      verified: v.optional(v.boolean()), // verified tutor
      onboarded: v.optional(v.boolean()),
      // True only once the learner has chosen their own display name (the
      // first-time name popup or profile editing). The auth provider seeds
      // brand-new accounts with an email-derived placeholder that must never
      // be treated as a real name.
      nameConfirmed: v.optional(v.boolean()),
      isSeed: v.optional(v.boolean()), // demo/system account created by the seed
      adminAccess: v.optional(v.boolean()), // unlocked via the /admin password gate
      suspended: v.optional(v.boolean()), // account disabled by an admin
      lastActivity: v.optional(v.number()), // ms epoch of last sign-in activity
      // gamification
      streak: v.optional(v.number()),
      streakLastDay: v.optional(v.number()), // yyyymmdd
      badges: v.optional(v.array(v.string())),
      // Public tutor page slug — e.g. /tutor/david-ogunleye. Assigned when
      // a tutor application is approved/verified; unique per user.
      slug: v.optional(v.string()),
      featuredOnHomepage: v.optional(v.boolean()),
      // Team Workspace — role-based team access (admin-assigned).
      teamRole: v.optional(
        v.union(
          v.literal("academic"),
          v.literal("ai-support"),
          v.literal("tutor-support"),
          v.literal("student-support"),
          v.literal("content"),
        ),
      ),
      teamRoleAssignedAt: v.optional(v.number()),
    })
      .index("email", ["email"])
      .index("by_slug", ["slug"])
      // Lets Owner-account reconciliation find the (at most one) Owner row
      // with an indexed lookup instead of scanning the whole table.
      .index("by_role", ["role"]),

    // -----------------------------------------------------------------------
    // Catalog
    // -----------------------------------------------------------------------
    categories: defineTable({
      name: v.string(),
      slug: v.string(),
      description: v.string(),
      icon: v.string(), // lucide icon name
      color: v.string(), // gradient preset key
      order: v.optional(v.number()),
    }).index("by_slug", ["slug"]),

    roadmaps: defineTable({
      name: v.string(),
      slug: v.string(),
      tagline: v.string(),
      description: v.string(),
      icon: v.string(),
      color: v.string(),
      featured: v.optional(v.boolean()),
    }).index("by_slug", ["slug"]),

    roadmapLevels: defineTable({
      roadmapId: v.id("roadmaps"),
      title: v.string(),
      order: v.number(),
      description: v.string(),
    }).index("by_roadmap", ["roadmapId", "order"]),

    courses: defineTable({
      title: v.string(),
      slug: v.string(),
      subtitle: v.string(),
      description: v.string(),
      longDescription: v.string(),
      categoryId: v.id("categories"),
      tutorId: v.id("users"),
      roadmapId: v.optional(v.id("roadmaps")),
      levelId: v.optional(v.id("roadmapLevels")),
      difficulty: difficultyValidator,
      durationHours: v.number(),
      rating: v.number(),
      ratingCount: v.number(),
      image: v.optional(v.string()), // external image URL (optional)
      // Device-uploaded thumbnail lives in Convex file storage; the id lets
      // the backend resolve the authoritative URL and clean up files.
      imageStorageId: v.optional(v.id("_storage")),
      gradient: v.optional(v.string()), // gradient preset key
      icon: v.optional(v.string()), // emoji or lucide name
      prerequisites: v.array(v.string()),
      skills: v.array(v.string()), // what you'll learn
      featured: v.boolean(),
      published: v.boolean(),
      status: v.optional(
        v.union(
          v.literal("draft"),
          v.literal("pending"),
          v.literal("approved"),
          v.literal("rejected"),
        ),
      ),
      reviewNote: v.optional(v.string()),
      enrolledCount: v.number(),
      archived: v.optional(v.boolean()), // soft-deleted by an admin
      /** When true the course issues a verifiable certificate on completion.
       *  Admins/tutors toggle this per course — certificates are NOT auto-issued. */
      hasCertificate: v.optional(v.boolean()),
      // LMS completion rules configured by the tutor/admin in the builder.
      completionRequirements: v.optional(
        courseCompletionRequirementsValidator,
      ),
      createdAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_category", ["categoryId"])
      .index("by_tutor", ["tutorId"])
      .index("by_roadmap", ["roadmapId", "levelId"])
      .index("by_published", ["published"]),

    lessons: defineTable({
      courseId: v.id("courses"),
      title: v.string(),
      order: v.number(),
      durationMinutes: v.number(),
      // Authoritative lesson length in seconds once the actual video's
      // duration is known (YouTube IFrame API / Mux metadata). When set it
      // overrides `durationMinutes` everywhere durations are shown.
      videoDurationSeconds: v.optional(v.number()),
      videoUrl: v.optional(v.string()),
      videoType: v.optional(
        v.union(
          v.literal("youtube"),
          v.literal("mp4"),
          v.literal("vimeo"),
          v.literal("loom"),
          v.literal("mux"),
        ),
      ),
      // Lesson cover image — stored on Cloudinary (never binary data).
      image: v.optional(v.string()),
      muxAssetId: v.optional(v.string()),
      muxPlaybackId: v.optional(v.string()),
      // Direct device uploads live in Convex file storage; the id lets the
      // backend resolve the authoritative playback URL and clean up files.
      videoStorageId: v.optional(v.id("_storage")),
      notes: v.string(),
      transcript: v.string(),
      resources: v.array(resourceValidator),
    })
      .index("by_course", ["courseId", "order"])
      .index("by_courseId", ["courseId"]),

    assignments: defineTable({
      courseId: v.id("courses"),
      tutorId: v.id("users"),
      title: v.string(),
      description: v.string(),
      instructions: v.string(),
      maxScore: v.number(),
      files: v.array(resourceValidator),
      // Assignment Builder: structured questions. Legacy assignments keep an
      // empty array and behave exactly as before (single text submission).
      questions: v.optional(v.array(assignmentQuestionValidator)),
      published: v.optional(v.boolean()),
      createdAt: v.number(),
    }).index("by_course", ["courseId"]),

    submissions: defineTable({
      assignmentId: v.id("assignments"),
      courseId: v.id("courses"),
      studentId: v.id("users"),
      text: v.string(),
      links: v.array(v.string()),
      files: v.array(resourceValidator),
      submittedAt: v.number(),
      grade: v.optional(v.number()),
      feedback: v.optional(v.string()),
      gradedAt: v.optional(v.number()),
      // Per-question answers + grading for built assignments.
      answers: v.optional(
        v.array(
          v.object({
            questionIndex: v.number(),
            text: v.optional(v.string()),
            url: v.optional(v.string()),
            fileName: v.optional(v.string()),
            fileUrl: v.optional(v.string()),
          }),
        ),
      ),
      questionGrades: v.optional(
        v.array(
          v.object({
            questionIndex: v.number(),
            score: v.number(),
            comment: v.optional(v.string()),
          }),
        ),
      ),
      status: v.optional(
        v.union(v.literal("submitted"), v.literal("graded")),
      ),
    })
      .index("by_assignment", ["assignmentId"])
      .index("by_student", ["studentId"])
      .index("by_course", ["courseId"]),

    quizzes: defineTable({
      courseId: v.id("courses"),
      tutorId: v.id("users"),
      title: v.string(),
      description: v.string(),
      timeLimitMinutes: v.number(),
      questions: v.array(questionValidator),
      // Quiz Builder settings (optional → legacy quizzes behave as before:
      // auto-published, 70% pass, unlimited attempts).
      passingScorePercent: v.optional(v.number()), // default 70
      attemptLimit: v.optional(v.number()), // 0/undefined = unlimited retakes
      published: v.optional(v.boolean()),
      updatedAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_course", ["courseId"]),

    quizAttempts: defineTable({
      quizId: v.id("quizzes"),
      courseId: v.id("courses"),
      studentId: v.id("users"),
      answers: v.array(v.object({ questionIndex: v.number(), answer: v.string() })),
      score: v.number(),
      maxScore: v.number(),
      pendingReview: v.boolean(), // has short-answer questions awaiting grading
      passed: v.boolean(),
      submittedAt: v.number(),
      timeTakenSeconds: v.optional(v.number()),
    })
      .index("by_student", ["studentId"])
      .index("by_quiz", ["quizId"]),

    /** Per-lesson (video) quizzes. Each lesson may optionally have one.
     *  Unlocks after the learner watches ≥90% of the video; passing marks the
     *  lesson complete and unlocks the next one. `published: false` hides it
     *  from learners while the tutor drafts it. */
    lessonQuizzes: defineTable({
      courseId: v.id("courses"),
      lessonId: v.id("lessons"),
      tutorId: v.id("users"),
      title: v.string(),
      description: v.string(),
      passPercent: v.number(), // e.g. 70
      timeLimitMinutes: v.number(),
      questions: v.array(questionValidator),
      published: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_lesson", ["lessonId"])
      .index("by_course", ["courseId"]),

    lessonQuizAttempts: defineTable({
      quizId: v.id("lessonQuizzes"),
      lessonId: v.id("lessons"),
      courseId: v.id("courses"),
      studentId: v.id("users"),
      answers: v.array(v.object({ questionIndex: v.number(), answer: v.string() })),
      score: v.number(),
      maxScore: v.number(),
      passed: v.boolean(),
      submittedAt: v.number(),
      timeTakenSeconds: v.optional(v.number()),
    })
      .index("by_student", ["studentId"])
      .index("by_quiz", ["quizId"]),

    /** One final exam per course. Published exams sit after all required
     *  lessons: the learner must complete every lesson first, and passing the
     *  exam is what completes the course + unlocks the certificate. */
    finalExams: defineTable({
      courseId: v.id("courses"),
      tutorId: v.id("users"),
      title: v.string(),
      description: v.string(),
      questionCount: v.number(),
      totalMarks: v.number(),
      passPercent: v.number(),
      timeLimitMinutes: v.number(),
      questions: v.array(questionValidator),
      published: v.boolean(),
      createdAt: v.number(),
    }).index("by_course", ["courseId"]),

    finalExamAttempts: defineTable({
      examId: v.id("finalExams"),
      courseId: v.id("courses"),
      studentId: v.id("users"),
      answers: v.array(v.object({ questionIndex: v.number(), answer: v.string() })),
      score: v.number(),
      totalMarks: v.number(),
      percent: v.number(),
      passed: v.boolean(),
      submittedAt: v.number(),
      timeTakenSeconds: v.optional(v.number()),
      examTitle: v.string(),
      examPassPercent: v.number(),
    })
      .index("by_student", ["studentId"])
      .index("by_exam", ["examId"]),

    /** Continuous watch progress per (student, lesson). The watch gate for
     *  lesson quizzes reads this table. Anti-cheat: `watchedRanges` stores
     *  the unique [start,end] seconds segments genuinely played through,
     *  merged server-side with wall-clock validation — seeking to the end
     *  without playing credits nothing. `percent` is derived from those
     *  ranges, never from client-supplied values. */
    watchProgress: defineTable({
      studentId: v.id("users"),
      courseId: v.id("courses"),
      lessonId: v.id("lessons"),
      percent: v.number(), // 0-100 unique coverage of the video
      watchedRanges: v.optional(v.array(v.number())), // flattened pairs [s0,e0,s1,e1,…]
      positionSeconds: v.optional(v.number()), // resume point
      durationSeconds: v.optional(v.number()),
      lastPosition: v.optional(v.number()), // last validated heartbeat position
      lastSeenAt: v.optional(v.number()), // wall clock of that heartbeat
      updatedAt: v.number(),
      // Which player reported this progress (mux | youtube | mp4 | vimeo | loom).
      videoSource: v.optional(
        v.union(
          v.literal("mux"),
          v.literal("youtube"),
          v.literal("mp4"),
          v.literal("vimeo"),
          v.literal("loom"),
        ),
      ),
    })
      .index("by_student_course", ["studentId", "courseId"])
      .index("by_lesson", ["lessonId"]),

    enrollments: defineTable({
      studentId: v.id("users"),
      courseId: v.id("courses"),
      enrolledAt: v.number(),
      status: v.union(v.literal("in-progress"), v.literal("completed")),
      completedLessons: v.array(v.id("lessons")),
      progress: v.number(), // 0-100
      lastActivityAt: v.optional(v.number()), // ms epoch of last learning activity
      inactivityStage: v.optional(v.number()), // highest reminder stage sent (0|3|7|14 days)
    })
      .index("by_student", ["studentId"])
      .index("by_course", ["courseId"])
      .index("by_inactivity", ["status", "inactivityStage"]),

    /** Learner reviews + ratings for a course (one review per user per course).
     *  The course's `rating` / `ratingCount` fields are derived from these
     *  docs and recomputed whenever a review is added, updated or removed.
     */
    courseReviews: defineTable({
      courseId: v.id("courses"),
      userId: v.id("users"),
      rating: v.number(), // 1–5 stars
      comment: v.string(), // may be empty
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_course", ["courseId", "createdAt"])
      .index("by_user_course", ["userId", "courseId"]),

    certificates: defineTable({
      certificateId: v.string(),
      studentId: v.id("users"),
      courseId: v.id("courses"),
      issuedAt: v.number(),
      studentName: v.string(),
      courseTitle: v.string(),
    })
      .index("by_certificateId", ["certificateId"])
      .index("by_student", ["studentId"])
      .index("by_course", ["courseId"]),

    // -----------------------------------------------------------------------
    // Communication & content
    // -----------------------------------------------------------------------
    announcements: defineTable({
      authorId: v.optional(v.id("users")),
      title: v.string(),
      body: v.string(),
      category: v.union(
        v.literal("Announcement"),
        v.literal("Event"),
        v.literal("Competition"),
        v.literal("Maintenance"),
        v.literal("News"),
      ),
      pinned: v.boolean(),
      published: v.boolean(),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    updates: defineTable({
      type: v.union(
        v.literal("new-course"),
        v.literal("maintenance"),
        v.literal("event"),
        v.literal("competition"),
        v.literal("platform-news"),
      ),
      title: v.string(),
      body: v.string(),
      date: v.number(),
      link: v.optional(v.string()),
      published: v.boolean(),
    }).index("by_date", ["date"]),

    siteContent: defineTable({
      key: v.string(),
      value: v.any(),
    }).index("by_key", ["key"]),

    /** Student stories — public "Share Your ForgeX Story" submissions.
     *  Every submission starts as `pending` and only becomes visible once an
     *  admin approves it. Only approved stories can be featured (enforced in
     *  stories.ts). The optional photo lives in Convex file storage; the
     *  display URL is resolved server-side. */
    studentStories: defineTable({
      userId: v.optional(v.id("users")), // submitter, when signed in
      name: v.string(),
      course: v.string(), // course / program
      story: v.string(),
      photoStorageId: v.optional(v.id("_storage")),
      photoUrl: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      featured: v.boolean(),
      showOnHomepage: v.optional(v.boolean()),
      reviewedAt: v.optional(v.number()),
      reviewedBy: v.optional(v.id("users")),
      adminNote: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    })
      .index("by_status", ["status"])
      .index("by_created", ["createdAt"])
      .index("by_user", ["userId"]),

    /** AI Hub — curated AI resources, fully controlled from the admin
     *  portal. Only `published` rows ever appear publicly; `featured` rows
     *  surface on the homepage and at the top of the public hub. */
    aiResources: defineTable({
      title: v.string(),
      slug: v.string(),
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
      featured: v.boolean(),
      published: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastVerifiedAt: v.optional(v.number()),
    })
      .index("by_published", ["published"])
      .index("by_category", ["category"])
      .index("by_slug", ["slug"])
      .index("by_created", ["createdAt"]),

    /** AI Prompt Library — searchable, curated prompts with a dynamic
     *  variable builder. Categories and subcategories are admin-defined so
     *  new topics (Social Media, Coding, Career…) can be added later without
     *  any code changes. Every prompt stores its template with `{{key}}`
     *  placeholders plus the matching input-field definitions; the frontend
     *  builds the final prompt by replacing variables — no AI API required.
     */
    promptCategories: defineTable({
      name: v.string(),
      slug: v.string(),
      description: v.string(),
      subcategories: v.array(v.string()),
      order: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_order", ["order"]),

    prompts: defineTable({
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      categoryId: v.id("promptCategories"),
      subcategory: v.optional(v.string()),
      tags: v.array(v.string()),
      difficulty: v.optional(difficultyValidator),
      usefulFor: v.string(), // what the prompt is useful for
      requiredInputs: v.array(v.string()),
      template: v.string(), // prompt text with {{field-key}} placeholders
      fields: v.array(promptFieldValidator), // dynamic builder input fields
      featured: v.boolean(),
      published: v.boolean(),
      order: v.number(),
      views: v.number(), // popularity counter
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_category", ["categoryId"])
      .index("by_published", ["published"])
      .index("by_created", ["createdAt"])
      .index("by_order", ["order"]),


    tutorApplications: defineTable({
      userId: v.id("users"),
      status: v.union(
        v.literal("draft"),
        v.literal("submitted"),
        v.literal("under-review"),
        v.literal("information-required"),
        v.literal("approved"),
        v.literal("verified"),
        v.literal("rejected"),
        v.literal("suspended"),
      ),
      wasVerified: v.optional(v.boolean()),
      // Step 1 — personal
      fullName: v.string(),
      email: v.string(),
      phone: v.string(),
      profilePictureUrl: v.optional(v.string()),
      residentialAddress: v.string(),
      city: v.string(),
      state: v.string(),
      country: v.string(),
      // Step 2 — professional
      professionalTitle: v.string(),
      biography: v.string(),
      yearsOfExperience: v.string(),
      currentOccupation: v.string(),
      highestQualification: v.string(),
      fieldOfStudy: v.string(),
      institution: v.string(),
      graduationYear: v.string(),
      // Step 3 — skills & expertise
      skills: v.array(v.string()),
      areasOfExpertise: v.string(),
      // Step 4 — teaching
      teachingExperience: v.string(),
      teachingSubjects: v.array(v.string()),
      teachingFormat: v.string(),
      teachingStatement: v.string(),
      whyForgeX: v.string(),
      // Step 5 — CV & verification (private: admin-only)
      cvUrl: v.optional(v.string()),
      cvFileName: v.optional(v.string()),
      nin: v.string(),
      // Step 6 — links
      linkedin: v.optional(v.string()),
      website: v.optional(v.string()),
      portfolio: v.optional(v.string()),
      github: v.optional(v.string()),
      youtube: v.optional(v.string()),
      otherLink: v.optional(v.string()),
      // Step 7 — agreement
      acceptedAgreement: v.boolean(),
      submittedAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
      reviewedAt: v.optional(v.number()),
      reviewedBy: v.optional(v.id("users")),
      reviewNote: v.optional(v.string()),
      // custom fields from the admin-controlled tutor registration form
      customAnswers: v.optional(
        v.record(v.string(), v.union(v.string(), v.array(v.string()))),
      ),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"]),

    auditLogs: defineTable({
      adminId: v.optional(v.id("users")),
      tutorId: v.optional(v.id("users")),
      action: v.string(),
      detail: v.string(),
      reason: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_tutor", ["tutorId"]),

    /** Password-unlocked admin sessions (no user account required). */
    adminSessions: defineTable({
      token: v.string(),
      createdAt: v.number(),
      /** Short human-readable label ("Admin profile") identifying the device
       *  that minted this session — shown in the Security section. */
      label: v.optional(v.string()),
      /** Epoch ms of the last verified activity on this session (heartbeat
       *  from the dashboard) — lets the Security section list active sessions
       *  and lets revoked sessions be distinguished from expired ones. */
      lastSeenAt: v.optional(v.number()),
      /** Epoch ms at which the session was revoked (sign-out-all-devices,
       *  owner password change, or manual revocation). Revoked sessions are
       *  rejected server-side even before the 12h TTL check. */
      revokedAt: v.optional(v.number()),
      /** True ONLY for sessions minted by the Owner security gate
       *  (bootstrap/verifyOwner). Only these sessions can perform
       *  Owner-level actions (password change, security email, role guards). */
      ownerSession: v.optional(v.boolean()),
    }).index("by_token", ["token"]),

    /**
     * Owner-level admin security identity — separate from `users`.
     *
     * There is at most ONE document in this table (guarded by
     * `adminSecurity.ensureOwner`). It holds:
     *  - the immutable Owner identity and security email (OTP target),
     *  - the hashed admin access password (Owner can change it via OTP),
     *  - in-flight password-change OTPs and one-time recovery codes.
     *
     * Everything here is only ever mutated by Owner-authenticated calls.
     */
    adminSecurity: defineTable({
      /** Fixed 1 for the singleton. */
      kind: v.literal("singleton"),
      /** Human-readable Owner name shown in the Security section. */
      ownerName: v.string(),
      /** Verified security email — the ONLY destination for security OTPs. */
      securityEmail: v.string(),
      /** PBKDF2 hash (`salt:hash`) of the admin access password. */
      passwordHash: v.optional(v.string()),
      /** In-flight password change: current-password verified until this ms. */
      pendingPasswordChange: v.optional(
        v.object({
          newPasswordHash: v.string(),
          otpHash: v.string(),
          otpExpiresAt: v.number(),
          otpAttempts: v.number(),
          requestedAt: v.number(),
          /** Session token that initiated the change (kept logged in). */
          sessionToken: v.string(),
        }),
      ),
      /** In-flight security-email change: OTP-confirmed by the Owner. */
      pendingEmailChange: v.optional(
        v.object({
          newEmail: v.string(),
          otpHash: v.string(),
          otpExpiresAt: v.number(),
          otpAttempts: v.number(),
          requestedAt: v.number(),
          sessionToken: v.string(),
        }),
      ),
      /** One-time recovery code hash for the password gate (owner only). */
      recoveryCodeHash: v.optional(v.string()),
      recoveryCodeExpiresAt: v.optional(v.number()),
      updatedAt: v.number(),
    }).index("by_kind", ["kind"]),

    /** Fixed-window rate-limit counters. One doc per bucket key (e.g.
     *  `contact:<email>`, `msg:<userId>`, `quiz:<userId>`, `upload:<userId>`).
     *  Convex serializes writes to the same document, so concurrent calls are
     *  safe. Windows reset lazily on the next hit, keeping the table tiny. */
    rateLimits: defineTable({
      key: v.string(),
      windowStart: v.number(),
      count: v.number(),
    }).index("by_key", ["key"]),

    /** Media library — IMAGES ONLY. Uploaded images tracked for admin
     *  management. Stored on Cloudinary (public_id + optimized URL, never the
     *  binary data). Videos live in `mediaVideos`, private docs in `documents`.
     */
    media: defineTable({
      publicId: v.string(), // Cloudinary public id
      secureUrl: v.string(), // optimized Cloudinary URL
      kind: v.string(), // e.g. logo | hero | course | profile | general
      label: v.optional(v.string()),
      width: v.optional(v.number()), // intrinsic width (px)
      height: v.optional(v.number()), // intrinsic height (px)
      format: v.optional(v.string()), // jpg | png | webp
      bytes: v.optional(v.number()), // file size in bytes
      alt: v.optional(v.string()),
      uploadedBy: v.optional(v.id("users")),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    /** Mux videos — every hosted course video is tracked here. */
    mediaVideos: defineTable({
      uploadId: v.string(), // Mux direct-upload id
      assetId: v.optional(v.string()),
      playbackId: v.optional(v.string()),
      title: v.string(),
      status: v.union(
        v.literal("uploading"),
        v.literal("processing"),
        v.literal("ready"),
      ),
      // Optional: password-gated admin portal uploads have no user account.
      uploadedBy: v.optional(v.id("users")),
      courseId: v.optional(v.id("courses")),
      lessonId: v.optional(v.id("lessons")),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_upload", ["uploadId"]),

    /** Private documents — CVs, verification files. Never public images. */
    documents: defineTable({
      name: v.string(), // original file name
      mime: v.string(),
      size: v.optional(v.number()),
      storageId: v.optional(v.id("_storage")),
      url: v.optional(v.string()),
      purpose: v.string(), // e.g. cv | verification
      uploadedBy: v.id("users"),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    messages: defineTable({
      threadId: v.string(),
      senderId: v.id("users"),
      receiverId: v.id("users"),
      body: v.string(),
      // Optional attachment — a photo, file or voice note sent with the
      // message. `kind` is absent for plain text messages. Files live in
      // Convex private file storage; `url` is the unguessable storage URL.
      kind: v.optional(
        v.union(
          v.literal("text"),
          v.literal("image"),
          v.literal("file"),
          v.literal("voice"),
        ),
      ),
      storageId: v.optional(v.id("_storage")),
      url: v.optional(v.string()),
      fileName: v.optional(v.string()),
      fileSize: v.optional(v.number()),
      mimeType: v.optional(v.string()),
      duration: v.optional(v.number()), // seconds, for voice notes
      createdAt: v.number(),
      readAt: v.optional(v.number()),
    })
      .index("by_thread", ["threadId", "createdAt"])
      .index("by_receiver", ["receiverId", "readAt"])
      .index("by_sender", ["senderId", "createdAt"]),

    /** Public contact form submissions — the admin “Inbox”. Signed-in users'
     *  contact messages go straight into the chat system instead (see
     *  contact.submitContact), so this holds visitor reports that admins
     *  answer by email. */
    contactSubmissions: defineTable({
      name: v.string(),
      email: v.string(),
      subject: v.string(),
      body: v.string(),
      status: v.union(
        v.literal("new"),
        v.literal("replied"),
        v.literal("resolved"),
      ),
      reply: v.optional(v.string()),
      repliedAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    notifications: defineTable({
      userId: v.id("users"),
      title: v.string(),
      body: v.string(),
      type: v.string(),
      link: v.optional(v.string()),
      read: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_user", ["userId", "read", "createdAt"])
      .index("by_userId", ["userId"]),

    /** Tutor → Admin issue reports / messages. A structured, lightweight
     *  support channel: the tutor submits a report, an admin replies with a
     *  note and marks it responded/resolved. The tutor is notified when the
     *  admin responds. */
    tutorSupportMessages: defineTable({
      tutorId: v.id("users"),
      category: v.union(
        v.literal("bug"),
        v.literal("feature"),
        v.literal("account"),
        v.literal("content"),
        v.literal("other"),
      ),
      subject: v.string(),
      body: v.string(),
      status: v.union(
        v.literal("open"),
        v.literal("responded"),
        v.literal("resolved"),
      ),
      adminNote: v.optional(v.string()),
      adminNoteAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_tutor", ["tutorId", "createdAt"])
      .index("by_status", ["status"])
      .index("by_created", ["createdAt"]),

    // -----------------------------------------------------------------------
    // Communication & Community module (independent of the existing
    // tutor ↔ student `messages` chat — that system is untouched)
    // -----------------------------------------------------------------------

    /** One community per course. Created on demand (first enrollment or
     *  first sync) and managed by admins: active → locked → archived. */
    courseCommunities: defineTable({
      courseId: v.id("courses"),
      name: v.string(), // e.g. "Graphic Design Community"
      status: v.union(
        v.literal("active"),
        v.literal("locked"),
        v.literal("archived"),
      ),
      /** Messaging permission mode (independent of `status`):
       *  everyone — all members can post; tutors_only — only community
       *  tutors + admins can post, students read-only. Absent = "everyone".
       */
      messageMode: v.optional(
        v.union(v.literal("everyone"), v.literal("tutors_only")),
      ),
      lockedReason: v.optional(v.string()),
      /** Student capacity & cohort management. `studentCapacity` caps how many
       *  students can be enrolled (0/absent = unlimited); `enrollmentClosed`
       *  is a manual stop. Capacity state is derived: OPEN when below the
       *  limit, FULL at the limit, CLOSED when manually stopped — spaces free
       *  up automatically when students leave or are moved. */
      studentCapacity: v.optional(v.number()),
      enrollmentClosed: v.optional(v.boolean()),
      description: v.optional(v.string()),
      rules: v.optional(v.string()),
      image: v.optional(v.string()),
      cohortLabel: v.optional(v.string()),
      createdAt: v.number(),
      lastActivityAt: v.optional(v.number()),
    })
      .index("by_course", ["courseId"])
      .index("by_status", ["status"]),

    /** Membership join table. Enrollment determines default eligibility;
     *  membership status determines current access. Removing someone from a
     *  community never touches their enrollment. */
    communityMembers: defineTable({
      communityId: v.id("courseCommunities"),
      userId: v.id("users"),
      role: v.union(
        v.literal("student"),
        v.literal("tutor"),
        v.literal("admin"),
        v.literal("moderator"),
      ),
      status: v.union(
        v.literal("active"),
        v.literal("restricted"),
        v.literal("removed"),
      ),
      joinedAt: v.number(),
      lastReadAt: v.optional(v.number()),
      /** Set on every keystroke while the member is typing (debounced). The
       *  typing query treats members with a recent `typingAt` as “currently
       *  typing” — no extra table needed. */
      typingAt: v.optional(v.number()),
      removedAt: v.optional(v.number()),
      removedReason: v.optional(v.string()),
    })
      .index("by_community", ["communityId", "userId"])
      .index("by_user", ["userId"]),

    /** Community chat messages. `senderId` is absent for moderator/system
     *  posts (password-gated admins have no user account); those use
     *  `senderKind: "admin"` + `senderLabel: "ForgeX Admin"`. */
    communityMessages: defineTable({
      communityId: v.id("courseCommunities"),
      senderId: v.optional(v.id("users")),
      senderKind: v.union(
        v.literal("user"),
        v.literal("admin"),
        v.literal("system"),
      ),
      senderLabel: v.optional(v.string()),
      body: v.string(),
      kind: v.optional(
        v.union(
          v.literal("text"),
          v.literal("image"),
          v.literal("file"),
          v.literal("voice"),
        ),
      ),
      storageId: v.optional(v.id("_storage")),
      url: v.optional(v.string()),
      fileName: v.optional(v.string()),
      fileSize: v.optional(v.number()),
      mimeType: v.optional(v.string()),
      duration: v.optional(v.number()),
      replyToId: v.optional(v.id("communityMessages")),
      /** Learning-thread support: when set, this message is a reply inside the
       *  discussion whose root message has `_id === discussionId`. Replies to
       *  a discussion never appear in the main feed. */
      discussionId: v.optional(v.id("communityMessages")),
      /** This message is the root of a learning discussion. */
      isDiscussion: v.optional(v.boolean()),
      /** Official tutor announcement — staff-only, visually distinct. */
      isAnnouncement: v.optional(v.boolean()),
      /** Staff-pinned message (announcements, resources, important answers). */
      pinned: v.optional(v.boolean()),
      pinnedBy: v.optional(v.id("users")),
      pinnedAt: v.optional(v.number()),
      /** Marked as the verified tutor answer to a question/discussion. */
      tutorAnswer: v.optional(v.boolean()),
      tutorAnswerBy: v.optional(v.id("users")),
      /** User ids mentioned via @name (parsed at send time, server-validated). */
      mentions: v.optional(v.array(v.string())),
      /** When set, this message carries a poll rendered as an interactive card. */
      pollId: v.optional(v.id("communityPolls")),
      reactions: v.array(
        v.object({
          emoji: v.string(),
          count: v.number(),
          userIds: v.array(v.string()),
        }),
      ),
      deleted: v.boolean(),
      deletedBy: v.optional(v.union(v.literal("user"), v.literal("admin"))),
      deletedById: v.optional(v.id("users")),
      deletedAt: v.optional(v.number()),
      editedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_community", ["communityId", "createdAt"])
      .index("by_sender", ["senderId"])
      .index("by_discussion", ["discussionId", "createdAt"])
      .searchIndex("search_body", {
        searchField: "body",
        filterFields: ["communityId"],
      }),

    /** A private student ↔ student DM thread. `key` is the sorted pair of
     *  user ids, matching the existing messages thread convention. */
    studentConversations: defineTable({
      key: v.string(),
      userAId: v.id("users"),
      userBId: v.id("users"),
      status: v.union(v.literal("active"), v.literal("locked")),
      lockedReason: v.optional(v.string()),
      createdAt: v.number(),
      lastActivityAt: v.optional(v.number()),
    })
      .index("by_key", ["key"])
      .index("by_userA", ["userAId", "lastActivityAt"])
      .index("by_userB", ["userBId", "lastActivityAt"]),

    /** Per-participant state (last read cursor) for a student DM thread. */
    studentConversationParticipants: defineTable({
      conversationId: v.id("studentConversations"),
      userId: v.id("users"),
      lastReadAt: v.optional(v.number()),
    })
      .index("by_user", ["userId"])
      .index("by_conversation", ["conversationId", "userId"]),

    /** Messages inside a student DM thread. */
    studentMessages: defineTable({
      conversationId: v.id("studentConversations"),
      senderId: v.id("users"),
      body: v.string(),
      kind: v.optional(
        v.union(
          v.literal("text"),
          v.literal("image"),
          v.literal("file"),
          v.literal("voice"),
        ),
      ),
      storageId: v.optional(v.id("_storage")),
      url: v.optional(v.string()),
      fileName: v.optional(v.string()),
      fileSize: v.optional(v.number()),
      mimeType: v.optional(v.string()),
      duration: v.optional(v.number()),
      replyToId: v.optional(v.id("studentMessages")),
      reactions: v.array(
        v.object({
          emoji: v.string(),
          count: v.number(),
          userIds: v.array(v.string()),
        }),
      ),
      deleted: v.boolean(),
      deletedBy: v.optional(v.union(v.literal("user"), v.literal("admin"))),
      deletedById: v.optional(v.id("users")),
      deletedAt: v.optional(v.number()),
      editedAt: v.optional(v.number()),
      createdAt: v.number(),
      readAt: v.optional(v.number()),
    })
      .index("by_conversation", ["conversationId", "createdAt"])
      .index("by_sender", ["senderId"]),

    /** Student ↔ student connection (friend) requests. `key` is the sorted
     *  user-id pair so a pair always maps to exactly one row. A "blocked"
     *  row blocks DMs between the pair in both directions. */
    studentConnections: defineTable({
      key: v.string(),
      requesterId: v.id("users"),
      addresseeId: v.id("users"),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("declined"),
        v.literal("blocked"),
        v.literal("removed"),
      ),
      blockedBy: v.optional(v.id("users")),
      createdAt: v.number(),
      respondedAt: v.optional(v.number()),
    })
      .index("by_key", ["key"])
      .index("by_requester", ["requesterId", "status"])
      .index("by_addressee", ["addresseeId", "status"]),

    /** Polls attached to community messages. Votes are stored per-user so
     *  duplicates are impossible; `anonymous` polls only ever expose counts.
     */
    communityPolls: defineTable({
      communityId: v.id("courseCommunities"),
      messageId: v.id("communityMessages"),
      createdBy: v.id("users"),
      question: v.string(),
      options: v.array(v.string()),
      votes: v.array(
        v.object({ optionIndex: v.number(), userId: v.id("users") }),
      ),
      multiple: v.boolean(),
      anonymous: v.boolean(),
      closesAt: v.optional(v.number()),
      closed: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_community", ["communityId", "createdAt"])
      .index("by_message", ["messageId"]),

    /** Private per-user bookmarks for important community messages. */
    savedCommunityMessages: defineTable({
      userId: v.id("users"),
      communityId: v.id("courseCommunities"),
      messageId: v.id("communityMessages"),
      createdAt: v.number(),
    })
      .index("by_user", ["userId", "createdAt"])
      .index("by_user_message", ["userId", "messageId"])
      .index("by_message", ["messageId"]),

    /** Student-submitted reports (messages, users, communities, DMs). */
    communicationReports: defineTable({
      reporterId: v.id("users"),
      targetType: v.union(
        v.literal("message"),
        v.literal("user"),
        v.literal("community"),
        v.literal("conversation"),
      ),
      scope: v.union(v.literal("community"), v.literal("dm")),
      communityId: v.optional(v.id("courseCommunities")),
      conversationId: v.optional(v.id("studentConversations")),
      messageId: v.optional(v.string()),
      targetUserId: v.optional(v.id("users")),
      reason: v.string(),
      details: v.optional(v.string()),
      status: v.union(
        v.literal("open"),
        v.literal("under-review"),
        v.literal("resolved"),
        v.literal("dismissed"),
      ),
      adminNote: v.optional(v.string()),
      createdAt: v.number(),
      resolvedAt: v.optional(v.number()),
    })
      .index("by_status", ["status"])
      .index("by_created", ["createdAt"])
      .index("by_target", ["targetUserId"]),

    /** Moderation actions taken against users/communities/conversations. */
    moderationActions: defineTable({
      action: v.string(),
      userId: v.optional(v.id("users")),
      communityId: v.optional(v.id("courseCommunities")),
      conversationId: v.optional(v.id("studentConversations")),
      messageId: v.optional(v.string()),
      reason: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_user", ["userId"]),

    /** Every sensitive admin moderation/view action, logged for audit. */
    moderationAuditLogs: defineTable({
      action: v.string(),
      targetType: v.optional(v.string()),
      targetId: v.optional(v.string()),
      communityId: v.optional(v.id("courseCommunities")),
      conversationId: v.optional(v.id("studentConversations")),
      messageId: v.optional(v.string()),
      userId: v.optional(v.id("users")),
      reason: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_community", ["communityId"])
      .index("by_conversation", ["conversationId"])
      .index("by_user", ["userId"]),

    // -----------------------------------------------------------------------
    // Team Workspace
    // -----------------------------------------------------------------------
    teams: defineTable({
      name: v.string(),
      slug: v.string(),
      description: v.string(),
      leadUserId: v.optional(v.id("users")),
      memberCount: v.number(),
      activeWorkCount: v.number(),
      status: v.union(
        v.literal("active"),
        v.literal("disabled"),
      ),
      createdAt: v.number(),
    })
      .index("by_slug", ["slug"]),

    teamApplications: defineTable({
      userId: v.optional(v.id("users")),
      teamAccountId: v.optional(v.id("teamAccounts")),
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      skill: v.string(),
      preferredTeamId: v.optional(v.id("teams")),
      introduction: v.string(),
      password: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      reviewNote: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_team_account", ["teamAccountId"])
      .index("by_status", ["status"]),

    teamMemberships: defineTable({
      userId: v.optional(v.id("users")),
      teamAccountId: v.optional(v.id("teamAccounts")),
      teamId: v.id("teams"),
      role: v.union(
        v.literal("teamLead"),
        v.literal("teamMember"),
      ),
      status: v.union(
        v.literal("active"),
        v.literal("deactivated"),
      ),
      joinedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_team_account", ["teamAccountId"])
      .index("by_team", ["teamId"]),

    // Independent Team Auth Tables (no Academy dependency)
    teamAccounts: defineTable({
      teamId: v.string(),
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      skill: v.string(),
      introduction: v.string(),
      passwordHash: v.string(),
      clerkId: v.optional(v.string()),
      teamSlug: v.optional(v.string()),
      role: v.union(
        v.literal("teamMember"),
        v.literal("teamLead"),
        v.literal("admin"),
      ),
      status: v.union(
        v.literal("active"),
        v.literal("suspended"),
        v.literal("pending"),
      ),
      mustChangePassword: v.boolean(),
      lastLoginAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_team_id", ["teamId"])
      .index("by_email", ["email"])
      .index("by_status", ["status"]),

    teamSessions: defineTable({
      teamAccountId: v.id("teamAccounts"),
      token: v.string(),
      expiresAt: v.number(),
      createdAt: v.number(),
    })
      .index("by_token", ["token"])
      .index("by_account", ["teamAccountId"]),

    teamPasswordRecovery: defineTable({
      teamAccountId: v.id("teamAccounts"),
      teamId: v.string(),
      name: v.string(),
      email: v.string(),
      reason: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      newTempPassword: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_team_account", ["teamAccountId"]),

    workItems: defineTable({
      title: v.string(),
      description: v.string(),
      teamId: v.id("teams"),
      courseId: v.optional(v.id("courses")),
      assignedTo: v.optional(v.id("users")),
      createdBy: v.optional(v.id("users")),
      teamAccountId: v.optional(v.string()), // for Hub accounts without users records
      priority: v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
      ),
      status: v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("in_review"),
        v.literal("completed"),
      ),
      deadline: v.optional(v.number()),
      commentCount: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_team", ["teamId"])
      .index("by_assignee", ["assignedTo"])
      .index("by_course", ["courseId"]),

    workComments: defineTable({
      workItemId: v.id("workItems"),
      userId: v.optional(v.id("users")),
      teamAccountId: v.optional(v.string()), // for Hub accounts
      content: v.string(),
      createdAt: v.number(),
    })
      .index("by_workItem", ["workItemId", "createdAt"]),

    teamReviews: defineTable({
      courseId: v.id("courses"),
      teamId: v.id("teams"),
      userId: v.id("users"),
      section: v.union(
        v.literal("lessons"),
        v.literal("quizzes"),
        v.literal("resources"),
        v.literal("objectives"),
        v.literal("general"),
      ),
      decision: v.union(
        v.literal("approved"),
        v.literal("revision_required"),
        v.literal("pending"),
      ),
      note: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_course", ["courseId"])
      .index("by_team", ["teamId"]),

    teamActivity: defineTable({
      userId: v.optional(v.id("users")),
      teamAccountId: v.optional(v.string()), // for Hub accounts
      teamId: v.optional(v.id("teams")),
      action: v.string(),
      targetType: v.optional(v.string()),
      targetId: v.optional(v.string()),
      targetLabel: v.optional(v.string()),
      details: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_team", ["teamId", "createdAt"])
      .index("by_user", ["userId", "createdAt"]),

    // -----------------------------------------------------------------
    // Team Hub — per-team password access
    // -----------------------------------------------------------------

    /** Per-team access configuration. One row per team: stores the password
     *  hash and active/disabled status. The Admin manages these from the
     *  Team Access Management page. */
    teamAccess: defineTable({
      teamSlug: v.string(),
      teamName: v.string(),
      passwordHash: v.string(),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_slug", ["teamSlug"]),

    /** Sessions for team-hub password-based access. One row per active
     *  session. Tokens expire after 7 days. */
    teamAccessSessions: defineTable({
      teamSlug: v.string(),
      token: v.string(),
      expiresAt: v.number(),
      createdAt: v.number(),
    })
      .index("by_token", ["token"])
      .index("by_slug", ["teamSlug"]),

    // -----------------------------------------------------------------
    // Team Workspace — Role-specific tables
    // -----------------------------------------------------------------

    /** Internal case notes — usable by any team for any target. */
    teamCaseNotes: defineTable({
      teamId: v.id("teams"),
      userId: v.optional(v.id("users")),
      targetType: v.string(),
      targetId: v.string(),
      targetLabel: v.optional(v.string()),
      content: v.string(),
      isPrivate: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_team", ["teamId", "createdAt"])
      .index("by_target", ["targetType", "targetId"]),

    /** Academic Team — tutor application reviews. */
    teamTutorReviews: defineTable({
      applicationId: v.id("tutorApplications"),
      teamId: v.id("teams"),
      userId: v.optional(v.id("users")),
      status: v.union(
        v.literal("reviewing"),
        v.literal("approved"),
        v.literal("revision_required"),
        v.literal("rejected"),
      ),
      note: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_application", ["applicationId"])
      .index("by_team", ["teamId"]),

    /** Content Team — content submissions for Admin approval. */
    teamContentSubmissions: defineTable({
      teamId: v.id("teams"),
      userId: v.optional(v.id("users")),
      type: v.union(
        v.literal("testimonial"),
        v.literal("resource"),
        v.literal("content-edit"),
      ),
      title: v.string(),
      description: v.string(),
      content: v.string(),
      targetId: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      adminNote: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_team", ["teamId", "createdAt"])
      .index("by_status", ["status"]),

    /** AI Team — AI tool submissions for Admin approval. */
    teamAiToolDrafts: defineTable({
      teamId: v.id("teams"),
      userId: v.optional(v.id("users")),
      title: v.string(),
      description: v.string(),
      category: v.string(),
      url: v.string(),
      pricingType: v.union(
        v.literal("free"),
        v.literal("freemium"),
        v.literal("paid"),
      ),
      status: v.union(
        v.literal("draft"),
        v.literal("submitted"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      adminNote: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_team", ["teamId", "createdAt"])
      .index("by_status", ["status"]),

    /** AI Team — prompt submissions for Admin approval. */
    teamPromptDrafts: defineTable({
      teamId: v.id("teams"),
      userId: v.optional(v.id("users")),
      title: v.string(),
      description: v.string(),
      category: v.string(),
      template: v.string(),
      status: v.union(
        v.literal("draft"),
        v.literal("submitted"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      adminNote: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_team", ["teamId", "createdAt"])
      .index("by_status", ["status"]),

    /** Support cases — wraps tutorSupportMessages with team assignment. */
    teamSupportCases: defineTable({
      teamId: v.id("teams"),
      supportMessageId: v.id("tutorSupportMessages"),
      assignedTo: v.optional(v.id("users")),
      status: v.union(
        v.literal("open"),
        v.literal("in_progress"),
        v.literal("escalated"),
        v.literal("resolved"),
      ),
      escalationTeamId: v.optional(v.id("teams")),
      escalationNote: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_team", ["teamId", "createdAt"])
      .index("by_status", ["status"])
      .index("by_support", ["supportMessageId"]),

    /** Escalation records — to Admin or other teams. */
    teamEscalations: defineTable({
      teamId: v.id("teams"),
      userId: v.optional(v.id("users")),
      targetType: v.string(),
      targetId: v.string(),
      targetLabel: v.optional(v.string()),
      escalateTo: v.union(v.literal("admin"), v.literal("team")),
      escalateToTeamId: v.optional(v.id("teams")),
      reason: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("acknowledged"),
        v.literal("resolved"),
      ),
      adminResponse: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_team", ["teamId", "createdAt"])
      .index("by_status", ["status"]),

    /** Student support cases — students submit issues from the student dashboard. */
    studentSupportCases: defineTable({
      studentId: v.id("users"),
      caseNumber: v.string(), // e.g. SUP-2026-000124
      category: v.union(
        v.literal("course"),
        v.literal("video"),
        v.literal("quiz"),
        v.literal("account"),
        v.literal("technical"),
        v.literal("academic"),
        v.literal("learning"),
        v.literal("general"),
        v.literal("other"),
      ),
      subject: v.string(),
      description: v.string(),
      courseId: v.optional(v.id("courses")),
      moduleLesson: v.optional(v.string()),
      attachmentUrl: v.optional(v.string()),
      assignedTo: v.optional(v.id("users")),
      status: v.union(
        v.literal("open"),
        v.literal("in_progress"),
        v.literal("waiting_for_student"),
        v.literal("escalated"),
        v.literal("resolved"),
        v.literal("closed"),
      ),
      escalatedTo: v.optional(v.union(v.literal("admin"), v.literal("academic"))),
      escalationNote: v.optional(v.string()),
      resolvedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_student", ["studentId", "createdAt"])
      .index("by_status", ["status"])
      .index("by_case_number", ["caseNumber"]),

    /** Reusable conversation threads — attached to any entity. */
    teamConversations: defineTable({
      entityType: v.string(), // "course" | "support_case" | "student_support" | "ai_tool" | "prompt"
      entityId: v.string(),
      teamId: v.optional(v.id("teams")),
      subject: v.string(),
      status: v.union(v.literal("open"), v.literal("closed")),
      lastMessageAt: v.number(),
      createdAt: v.number(),
    })
      .index("by_entity", ["entityType", "entityId"])
      .index("by_team", ["teamId", "lastMessageAt"]),

    /** Messages inside a team conversation thread. */
    teamConversationMessages: defineTable({
      conversationId: v.id("teamConversations"),
      senderId: v.id("users"),
      senderRole: v.string(), // "admin" | "academic" | "tutor" | "student" | "tutor-support" | etc.
      body: v.string(),
      isInternal: v.boolean(), // private notes visible only to team members
      createdAt: v.number(),
    })
      .index("by_conversation", ["conversationId", "createdAt"]),

    /** Who participates in a conversation (for access control). */
    teamConversationParticipants: defineTable({
      conversationId: v.id("teamConversations"),
      userId: v.id("users"),
      role: v.string(), // their role in this conversation
      joinedAt: v.number(),
      lastReadAt: v.optional(v.number()),
    })
      .index("by_conversation", ["conversationId"])
      .index("by_user", ["userId"]),

    /** Activity history for support cases — tracks who handled what. */
    teamCaseHistory: defineTable({
      caseId: v.id("teamSupportCases"),
      userId: v.optional(v.id("users")),
      action: v.string(),
      details: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_case", ["caseId", "createdAt"]),

    // ---------------------------------------------------------------------
    // AI Support Assistant
    // ---------------------------------------------------------------------

    /** Approved support knowledge base — the AI's primary source of truth. */
    aiKnowledgeBase: defineTable({
      title: v.string(),
      category: v.string(), // "student-support" | "tutor-support" | "course-management" | "platform-features" | "technical" | "account" | "community" | "ai-hub" | "general"
      keywords: v.optional(v.array(v.string())),
      content: v.string(), // step-by-step answer / troubleshooting guide
      enabled: v.boolean(),
      createdBy: v.optional(v.id("users")),
      timesUsed: v.optional(v.number()),
      helpfulCount: v.optional(v.number()),
      notHelpfulCount: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_category", ["category"])
      .index("by_enabled", ["enabled"]),

    /** One AI support conversation between a user and the assistant. */
    aiSupportSessions: defineTable({
      userId: v.id("users"),
      userRole: v.string(), // "student" | "tutor" | team role | "admin"
      status: v.union(
        v.literal("active"),
        v.literal("resolved"),
        v.literal("escalated"),
      ),
      messages: v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("ai")),
          body: v.string(),
          at: v.number(),
        }),
      ),
      suggestedCategory: v.optional(v.string()),
      summary: v.optional(v.string()),
      rating: v.optional(v.union(v.literal("helpful"), v.literal("not_helpful"))),
      ticketId: v.optional(v.id("aiSupportTickets")),
      // Conversation lifecycle for the AI↔human handoff:
      //   AI_ACTIVE        assistant is answering
      //   AI_LIMIT_REACHED provider hit a limit/outage → auto-transferred
      //   WAITING_FOR_HUMAN ticket created, no human reply yet
      //   HUMAN_ACTIVE     a support member has joined the conversation
      //   RESOLVED         closed by the team or the user
      aiState: v.optional(
        v.union(
          v.literal("AI_ACTIVE"),
          v.literal("AI_LIMIT_REACHED"),
          v.literal("WAITING_FOR_HUMAN"),
          v.literal("HUMAN_ACTIVE"),
          v.literal("RESOLVED"),
        ),
      ),
      // Consecutive AI-provider failures inside this session (reset on any
      // successful reply). Drives automatic escalation.
      aiFailureCount: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
      resolvedAt: v.optional(v.number()),
    })
      .index("by_user", ["userId", "createdAt"])
      .index("by_status", ["status"]),

    /** Tickets created when the AI cannot resolve an issue (or user opts out). */
    aiSupportTickets: defineTable({
      ticketNumber: v.string(), // e.g. FX-1024
      sessionId: v.id("aiSupportSessions"),
      userId: v.id("users"),
      userRole: v.string(),
      category: v.string(), // routing category label
      assignedTeam: v.string(), // "student-support" | "tutor-support" | "technical" | "academic" | "ai-support" | "admin"
      subject: v.string(),
      aiSummary: v.string(),
      // INTERNAL ONLY — why the AI handed off (e.g. "rate_limited",
      // "provider_down", "timeout"). Never shown to users.
      escalationReason: v.optional(v.string()),
      additionalDetails: v.optional(v.string()),
      assignedTo: v.optional(v.id("users")),
      status: v.union(
        v.literal("pending_escalation"),
        v.literal("open"),
        v.literal("assigned"),
        v.literal("in_progress"),
        v.literal("waiting_for_user"),
        v.literal("resolved"),
        v.literal("closed"),
      ),
      resolvedAt: v.optional(v.number()),
      userLastSeenAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_team_status", ["assignedTeam", "status"])
      .index("by_user", ["userId", "createdAt"])
      .index("by_session", ["sessionId"]),

    /** Replies inside an escalated AI support ticket (user ↔ human team). */
    aiSupportTicketMessages: defineTable({
      ticketId: v.id("aiSupportTickets"),
      senderId: v.optional(v.id("users")), // null = system
      senderType: v.union(v.literal("user"), v.literal("team"), v.literal("system")),
      body: v.string(),
      isInternalNote: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_ticket", ["ticketId", "createdAt"]),

    // ---------------------------------------------------------------------
    // Resilience infrastructure (circuit breakers, monitoring, jobs)
    // ---------------------------------------------------------------------

    /** Circuit-breaker state per external provider ("gemini", "groq",
     *  "gemini-tts", "groq-stt", "mux", "cloudinary"…). CLOSED = normal,
     *  OPEN = provider bypassed until the cooldown elapses, HALF_OPEN = a
     *  limited test request is allowed through. */
    providerHealth: defineTable({
      provider: v.string(),
      state: v.union(
        v.literal("closed"),
        v.literal("open"),
        v.literal("half_open"),
      ),
      consecutiveFailures: v.number(),
      openedAt: v.optional(v.number()), // when the breaker last opened
      lastError: v.optional(v.string()), // safe, non-sensitive error code
      lastSuccessAt: v.optional(v.number()),
      lastFailureAt: v.optional(v.number()),
      updatedAt: v.number(),
    }).index("by_provider", ["provider"]),

    /** Observability log for every wrapped external API call. Pruned by a
     *  scheduled job; never contains secrets or user content. */
    externalApiLogs: defineTable({
      provider: v.string(),
      operation: v.string(),
      ok: v.boolean(),
      statusCode: v.optional(v.number()),
      latencyMs: v.number(),
      attempts: v.optional(v.number()),
      fallbackUsed: v.optional(v.boolean()),
      errorCode: v.optional(v.string()), // safe classification only
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_provider", ["provider"]),

    /** Durable background-job queue with retry + dead-letter semantics.
     *  Jobs that exhaust their attempts land in status "dead" (the dead
     *  letter state) where an admin can inspect or safely re-run them. */
    backgroundJobs: defineTable({
      idempotencyKey: v.string(), // duplicate enqueue is a no-op
      type: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("retrying"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("dead"),
      ),
      payload: v.any(),
      attemptCount: v.number(),
      maxAttempts: v.number(),
      nextAttemptAt: v.number(), // earliest time a pending/retrying job may run
      lastError: v.optional(v.string()),
      failureCategory: v.optional(v.string()),
      createdBy: v.optional(v.id("users")),
      createdAt: v.number(),
      updatedAt: v.number(),
      completedAt: v.optional(v.number()),
    })
      .index("by_status_next", ["status", "nextAttemptAt"])
      .index("by_idempotency", ["idempotencyKey"])
      .index("by_type", ["type"]),

    /** Transactional email log (Gmail SMTP). One row per recipient per send.
     *  OTP codes / auth secrets are NEVER stored here — only metadata and the
     *  rendered HTML for admin resend of non-auth emails. */
    emailLogs: defineTable({
      to: v.string(), // recipient email
      subject: v.string(),
      emailType: v.string(), // otp | welcome | password_reset | enrollment | quiz | exam | certificate | support | admin_broadcast
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("sent"),
        v.literal("failed"),
        v.literal("retrying"),
        v.literal("cancelled"),
      ),
      automated: v.boolean(), // system-triggered vs admin-composed
      sentBy: v.optional(v.id("users")), // admin who composed it, if any
      html: v.optional(v.string()), // rendered body (never contains OTP)
      retryCount: v.number(),
      lastError: v.optional(v.string()), // safe classification only
      createdAt: v.number(),
      sentAt: v.optional(v.number()),
      failedAt: v.optional(v.number()),
      // --- queue extensions ---
      priority: v.optional(
        v.union(v.literal("normal"), v.literal("high"), v.literal("critical")),
      ), // default normal; critical (system/escalation) drains first
      scheduledAt: v.optional(v.number()), // send only at/after this time
      lastRetryAt: v.optional(v.number()),
      nextRetryAt: v.optional(v.number()), // when a "retrying" row becomes due
      dedupeKey: v.optional(v.string()), // prevents duplicate automated sends
      automationKey: v.optional(v.string()), // which email automation produced it
    })
      .index("by_status_created", ["status", "createdAt"])
      .index("by_type_created", ["emailType", "createdAt"])
      .index("by_created", ["createdAt"])
      .index("by_dedupe", ["dedupeKey"])
      .index("by_retrying_next", ["status", "nextRetryAt"]),

    /** Per-automation configuration for the Email Center — enable/disable each
     *  trigger and override its subject line. Missing row = enabled defaults. */
    emailAutomations: defineTable({
      key: v.string(), // see AUTOMATIONS in emailTriggers.ts
      enabled: v.boolean(),
      subjectOverride: v.optional(v.string()),
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    /** Queue settings singleton (row key "queue") — configurable retry limit. */
    emailSettings: defineTable({
      key: v.string(), // always "queue"
      maxRetries: v.number(), // default 3
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    // -------------------------------------------------------------------
    // Monitoring / observability (admin System Health center)
    // Real data only: rows are created by actual application activity.
    // Privacy: no passwords, tokens, message bodies or AI conversations --
    // enforced by redaction in monitorCore.ts before any write here.
    // -------------------------------------------------------------------

    /** One row per distinct error fingerprint (an "error group"). */
    monitorErrors: defineTable({
      fingerprint: v.string(),
      module: v.string(),
      action: v.optional(v.string()),
      kind: v.union(v.literal("error"), v.literal("security")),
      severity: v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low"),
      ),
      title: v.string(),
      lastMessage: v.optional(v.string()),
      sampleMeta: v.optional(v.any()),
      occurrences: v.number(),
      affectedUsers: v.optional(v.number()),
      firstSeenAt: v.number(),
      lastSeenAt: v.number(),
      route: v.optional(v.string()),
      requestId: v.optional(v.string()),
      env: v.optional(v.string()),
      resolvedAt: v.optional(v.number()),
    })
      .index("by_fingerprint", ["fingerprint"])
      .index("by_lastSeen", ["lastSeenAt"])
      .index("by_module_lastSeen", ["module", "lastSeenAt"])
      .index("by_severity_lastSeen", ["severity", "lastSeenAt"]),

    /** Individual occurrences (short-lived; pruned by retention cron). */
    monitorOccurrences: defineTable({
      fingerprint: v.string(),
      module: v.string(),
      severity: v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low"),
      ),
      kind: v.union(v.literal("error"), v.literal("security")),
      message: v.optional(v.string()),
      meta: v.optional(v.any()),
      userId: v.optional(v.id("users")),
      route: v.optional(v.string()),
      requestId: v.optional(v.string()),
      env: v.optional(v.string()),
      at: v.number(),
    })
      .index("by_fingerprint_at", ["fingerprint", "at"])
      .index("by_at", ["at"])
      .index("by_module_at", ["module", "at"]),

    /** Auto-detected incidents (grouped, threshold-triggered). */
    monitorIncidents: defineTable({
      number: v.number(),
      title: v.string(),
      fingerprint: v.string(),
      module: v.string(),
      action: v.optional(v.string()),
      severity: v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low"),
      ),
      status: v.union(
        v.literal("open"),
        v.literal("investigating"),
        v.literal("acknowledged"),
        v.literal("resolved"),
        v.literal("ignored"),
      ),
      ruleKey: v.string(),
      occurrences: v.number(),
      affectedUsers: v.optional(v.number()),
      sampleMessage: v.optional(v.string()),
      route: v.optional(v.string()),
      firstSeenAt: v.number(),
      lastSeenAt: v.number(),
      detectedAt: v.number(),
      resolvedAt: v.optional(v.number()),
      updatedBy: v.optional(v.string()),
      updatedAt: v.optional(v.number()),
      resolvedBy: v.optional(v.string()),
    })
      .index("by_status_detected", ["status", "detectedAt"])
      .index("by_fingerprint_status", ["fingerprint", "status"])
      .index("by_detected", ["detectedAt"]),

    /** Incident status timeline (who changed what, when). */
    monitorIncidentEvents: defineTable({
      incidentId: v.id("monitorIncidents"),
      type: v.union(
        v.literal("detected"),
        v.literal("status"),
        v.literal("note"),
      ),
      fromStatus: v.optional(v.string()),
      toStatus: v.optional(v.string()),
      by: v.optional(v.string()),
      note: v.optional(v.string()),
      at: v.number(),
    }).index("by_incident_at", ["incidentId", "at"]),

    /** Alert rules (admin-configurable) -- missing row = default behavior. */
    monitorAlertRules: defineTable({
      key: v.string(),
      enabled: v.boolean(),
      minSeverity: v.optional(
        v.union(
          v.literal("critical"),
          v.literal("high"),
          v.literal("medium"),
          v.literal("low"),
        ),
      ),
      cooldownMinutes: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    }).index("by_key", ["key"]),

    /** One row per alert actually sent (dedupe + history). */
    monitorAlerts: defineTable({
      ruleKey: v.string(),
      fingerprint: v.optional(v.string()),
      incidentId: v.optional(v.id("monitorIncidents")),
      severity: v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low"),
      ),
      title: v.string(),
      summary: v.optional(v.string()),
      channel: v.union(v.literal("email"), v.literal("inapp")),
      deliveredAt: v.number(),
    }).index("by_delivered", ["deliveredAt"]),

    /** Alert dedupe/cooldown state. */
    monitorAlertState: defineTable({
      key: v.string(),
      lastSentAt: v.number(),
    }).index("by_key", ["key"]),

    /** Service health rollup -- written by the sweeper from REAL counters. */
    monitorServiceHealth: defineTable({
      serviceId: v.string(),
      status: v.union(
        v.literal("operational"),
        v.literal("degraded"),
        v.literal("down"),
        v.literal("unknown"),
      ),
      ok: v.number(),
      fail: v.number(),
      latencyMs: v.optional(v.number()),
      lastActivityAt: v.optional(v.number()),
      recentFailures: v.number(),
      evaluatedAt: v.number(),
    }).index("by_service", ["serviceId"]),

    /** Activity trail of IMPORTANT platform actions (user + admin). */
    monitorActivity: defineTable({
      userId: v.optional(v.id("users")),
      actorLabel: v.optional(v.string()),
      action: v.string(),
      module: v.string(),
      result: v.union(v.literal("success"), v.literal("failure")),
      resourceType: v.optional(v.string()),
      resourceId: v.optional(v.string()),
      requestId: v.optional(v.string()),
      route: v.optional(v.string()),
      detail: v.optional(v.string()),
      at: v.number(),
    })
      .index("by_at", ["at"])
      .index("by_module_at", ["module", "at"])
      .index("by_user_at", ["userId", "at"])
      .index("by_action_at", ["action", "at"]),

    /** Health check heartbeat (proves DB + writes are alive). */
    monitorHeartbeats: defineTable({
      source: v.string(),
      latencyMs: v.optional(v.number()),
      at: v.number(),
    }).index("by_at", ["at"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
