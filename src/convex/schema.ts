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
      // Public tutor page slug — e.g. /tutor/david-ogunleye. Assigned when
      // a tutor application is approved/verified; unique per user.
      slug: v.optional(v.string()),
    })
      .index("email", ["email"])
      .index("by_slug", ["slug"]),

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
    })
      .index("by_student", ["studentId"])
      .index("by_exam", ["examId"]),

    /** Continuous watch progress per (student, lesson). The 90% watch gate
     *  for lesson quizzes reads this table. */
    watchProgress: defineTable({
      studentId: v.id("users"),
      courseId: v.id("courses"),
      lessonId: v.id("lessons"),
      percent: v.number(), // 0-100 of the video watched
      updatedAt: v.number(),
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
  },
  {
    schemaValidation: false,
  },
);

export default schema;
