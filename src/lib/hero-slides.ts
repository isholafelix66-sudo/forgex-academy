/**
 * Homepage hero slideshow — shared contract between the landing page and the
 * admin "Website & branding" manager.
 *
 * Slides are stored in `siteContent` under the key `heroSlides` as a JSON
 * array. The landing page renders whatever the admin saved (any number of
 * slides, 1 or more); when nothing valid is stored it falls back to the
 * built-in defaults below, so the hero is never empty.
 */

export type HeroSlide = {
  tag: string;
  headline: string;
  support: string;
  ctaLabel: string;
  ctaTo: string;
  /** Primary photo (admin upload or URL). */
  src: string;
  /** Optional backup photo shown if the primary fails to load. */
  fallbackSrc?: string;
  alt: string;
};

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    tag: "Learn",
    headline: "Learn Skills That Matter.",
    support: "Build practical skills for the real world.",
    ctaLabel: "Start Learning",
    ctaTo: "/courses",
    src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80",
    fallbackSrc:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80",
    alt: "Young people learning and building digital skills together",
  },
  {
    tag: "Career Roadmap",
    headline: "Find Your Career Path.",
    support: "Discover where your skills can take you.",
    ctaLabel: "Explore Roadmap",
    ctaTo: "/roadmap",
    src: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&q=80",
    fallbackSrc:
      "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1200&q=80",
    alt: "A young professional charting their next career step in a bright workspace",
  },
  {
    tag: "Build",
    headline: "Build. Practice. Grow.",
    support: "Turn knowledge into real experience.",
    ctaLabel: "Start Building",
    ctaTo: "/courses",
    src: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80",
    fallbackSrc:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&q=80",
    alt: "A person building a real project on a laptop",
  },
  {
    tag: "Opportunities",
    headline: "Turn Skills Into Opportunities.",
    support: "Connect your learning to your future.",
    ctaLabel: "Explore Opportunities",
    ctaTo: "/dashboard",
    src: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80",
    fallbackSrc:
      "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=1200&q=80",
    alt: "Students collaborating on career opportunities",
  },
];

/** Defensive read of the admin value: never throws, never renders an empty
 *  hero. Slides missing an image or headline are dropped; if nothing valid
 *  remains, the built-in defaults are used. */
export function normalizeHeroSlides(raw: unknown): HeroSlide[] {
  if (!Array.isArray(raw)) return DEFAULT_HERO_SLIDES;
  const out: HeroSlide[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const src = typeof o.src === "string" ? o.src.trim() : "";
    const headline = typeof o.headline === "string" ? o.headline.trim() : "";
    if (!src || !headline) continue;
    const tag =
      typeof o.tag === "string" && o.tag.trim() ? o.tag.trim() : "ForgeX";
    const ctaLabel =
      typeof o.ctaLabel === "string" && o.ctaLabel.trim()
        ? o.ctaLabel.trim()
        : "Start Learning";
    const ctaTo =
      typeof o.ctaTo === "string" && o.ctaTo.trim() ? o.ctaTo.trim() : "/courses";
    const fallbackSrc =
      typeof o.fallbackSrc === "string" && o.fallbackSrc.trim()
        ? o.fallbackSrc.trim()
        : undefined;
    out.push({
      tag,
      headline,
      support: typeof o.support === "string" ? o.support : "",
      ctaLabel,
      ctaTo,
      src,
      fallbackSrc,
      alt:
        typeof o.alt === "string" && o.alt.trim() ? o.alt.trim() : headline,
    });
  }
  return out.length > 0 ? out : DEFAULT_HERO_SLIDES;
}
