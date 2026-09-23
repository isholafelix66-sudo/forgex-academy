/**
 * Shared feature-flag vocabulary.
 *
 * ForgeX Network is one ecosystem with three products:
 *   Portfolio        → ACTIVE
 *   Academy          → LOCKED (coming soon)
 *   Opportunity Hub  → LOCKED (coming soon)
 *
 * Locked products stay in the codebase and database, but normal users have no
 * functional access — every route that belongs to a product is wrapped in
 * <FeatureGate>. Launching a product later is a flag change in the admin
 * dashboard, never a rebuild.
 */

export type FeatureState = "active" | "locked" | "hidden";

export type ProductKey = "projects" | "academy" | "opportunity-hub";

export type ProductFlag = {
  key: string;
  label: string;
  tagline: string;
  state: FeatureState;
  comingSoonCopy: string;
  order: number;
};

/** Presentation metadata for a locked product's "coming soon" page. */
export const PRODUCT_META: Record<
  ProductKey,
  { label: string; tagline: string; blurb: string; highlights: string[] }
> = {
  projects: {
    label: "Portfolio",
    tagline: "Create your portfolio once. Share one link.",
    blurb:
      "Portfolio is where you build your professional portfolio and turn it into your own website — the live product of ForgeX Network.",
    highlights: [
      "One portfolio, one shareable link",
      "Projects, skills, experience and services",
      "Public profile you can share anywhere",
    ],
  },
  academy: {
    label: "Academy",
    tagline: "Learn. Build. Succeed.",
    blurb:
      "Academy is the learning side of ForgeX — structured paths, practical projects, assessments and certificates that verify what you can do.",
    highlights: [
      "Structured learning roadmaps from beginner to expert",
      "Tutors, assignments, quizzes and graded feedback",
      "Verifiable certificates you can share",
    ],
  },
  "opportunity-hub": {
    label: "Opportunity Hub",
    tagline: "Turn skills into real opportunities.",
    blurb:
      "Opportunity Hub connects what you've built to what's next — internships, jobs, scholarships and entrepreneurship.",
    highlights: [
      "Internships, jobs and graduate roles",
      "Scholarships and funding opportunities",
      "Founder and entrepreneurship programmes",
    ],
  },
};

export const LOCKED_STATES: FeatureState[] = ["locked", "hidden"];
