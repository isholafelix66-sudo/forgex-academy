import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
export const ROLES = {
  ADMIN: "admin",
  TUTOR: "tutor",
  STUDENT: "student",
} as const;

export const roleValidator = v.union(
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
  points: v.optional(v.number()),
  explanation: v.optional(v.string()),
});
export type Question = Infer<typeof questionValidator>;

export const resourceValidator = v.object({
  name: v.string(),
  url: v.string(),
});
export type Resource = Infer<typeof resourceValidator>;

export const socialsValidator = v.object({
  website: v.optional(v.string()),
  github: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  twitter: v.optional(v.string()),
  youtube: v.optional(v.string()),
});
export type Socials = Infer<typeof socialsValidator>;

const schema = defineSchema(
  {
    // -----------------------------------------------------------------------
    // Auth (do not remove)
    // -----------------------------------------------------------------------
    ...authTables,

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
      isSeed: v.optional(v.boolean()), // demo/system account created by the seed
      adminAccess: v.optional(v.boolean()), // unlocked via the /admin password gate
      suspended: v.optional(v.boolean()), // account disabled by an admin
      lastActivity: v.optional(v.number()), // ms epoch of last sign-in activity
      // gamification
      streak: v.optional(v.number()),
      streakLastDay: v.optional(v.number()), // yyyymmdd
      badges: v.optional(v.array(v.string())),
    }).index("email", ["email"]),

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
      videoUrl: v.optional(v.string()),
      videoType: v.optional(
        v.union(
          v.literal("youtube"),
          v.literal("mp4"),
          v.literal("vimeo"),
          v.literal("loom"),
        ),
      ),
      // Lesson cover image — stored on Cloudinary (never binary data).
      image: v.optional(v.string()),
      muxAssetId: v.optional(v.string()),
      muxPlaybackId: v.optional(v.string()),
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
      deadline: v.optional(v.number()),
      maxScore: v.number(),
      files: v.array(resourceValidator),
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

    enrollments: defineTable({
      studentId: v.id("users"),
      courseId: v.id("courses"),
      enrolledAt: v.number(),
      status: v.union(v.literal("in-progress"), v.literal("completed")),
      completedLessons: v.array(v.id("lessons")),
      progress: v.number(), // 0-100
    })
      .index("by_student", ["studentId"])
      .index("by_course", ["courseId"]),

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
    }).index("by_token", ["token"]),

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
      uploadedBy: v.id("users"),
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
  },
  {
    schemaValidation: false,
  },
);

export default schema;
