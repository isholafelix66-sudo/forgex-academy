/**
 * Real cover photos for the seeded ForgeX catalog, keyed by course slug.
 * Used only when a course has no uploaded cover image yet — an admin-uploaded
 * cover (or one set on the course record) always wins. Kept in one place so
 * the Courses grid, course page and admin preview all stay in sync.
 */
export const COURSE_COVER_IMAGES: Record<string, string> = {
  "design-fundamentals":
    "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&q=80",
  "branding-essentials":
    "https://images.unsplash.com/photo-1634942537034-2531766767d1?w=1200&q=80",
  "ui-design-mastery":
    "https://images.unsplash.com/photo-1559028012-481c04fa702d?w=1200&q=80",
  "portfolio-career-launchpad":
    "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=1200&q=80",
  "html-css-the-modern-web":
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&q=80",
  "javascript-deep-dive":
    "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=1200&q=80",
  "backend-apis-with-node":
    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80",
  "full-stack-project-build-an-lms":
    "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?w=1200&q=80",
  "data-analytics-foundations":
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
  "sql-data-wrangling":
    "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&q=80",
  "machine-learning-essentials":
    "https://images.unsplash.com/photo-1527430253228-e93688616381?w=1200&q=80",
  "marketing-fundamentals":
    "https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=1200&q=80",
  "growth-performance-marketing":
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80",
  "entrepreneurship-lean-startups":
    "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&q=80",
  "professional-graphic-design":
    "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&q=80",
  "photoshop-mastery":
    "https://images.unsplash.com/photo-1547334411-58a4a0e8e5a5?w=1200&q=80",
  "video-editing-with-capcut":
    "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&q=80",
  // AI & modern-work courses
  "build-websites-with-ai":
    "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200&q=80",
  "data-analysis-with-excel":
    "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=1200&q=80",
  "ai-video-generation-content-creation":
    "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&q=80",
  "ai-automation-productivity":
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80",
  "prompt-engineering":
    "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&q=80",
  "ai-productivity-digital-work":
    "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&q=80",
};

export function courseCoverFor(
  slug: string | null | undefined,
): string | undefined {
  if (!slug) return undefined;
  return COURSE_COVER_IMAGES[slug];
}