/**
 * Home-page showcase slideshow.
 *
 * Stored in `siteContent` under the key `portfolioSlides` as a JSON array, so
 * the Portfolio admin portal can replace any slide (image + caption + link)
 * without a code change. When nothing valid is stored the built-in defaults
 * below are used, so the hero is never empty.
 *
 * Note this is deliberately SEPARATE from the Academy hero slides
 * (`hero-slides.ts`, key `heroSlides`) — the two products must not share
 * content.
 */

export type PortfolioSlide = {
  id: string;
  /** Primary image URL (data URL, Convex storage URL, or remote URL). */
  image: string;
  alt: string;
  /** Optional short caption shown on the image. */
  caption?: string;
  /** Optional link the slide opens when clicked. */
  href?: string;
};

/** Unsplash source params — high quality, right-sized, never upscaled. */
const U = "?auto=format&fit=crop&w=1600&q=80";

export const DEFAULT_PORTFOLIO_SLIDES: PortfolioSlide[] = [
  {
    id: "showcase-1",
    image: `https://images.unsplash.com/photo-1460925895917-afdab827c52f${U}`,
    alt: "A designer's website displayed on a laptop on a dark desk",
    caption: "Brand Website Redesign",
  },
  {
    id: "showcase-2",
    image: `https://images.unsplash.com/photo-1558655146-9f40138edfeb${U}`,
    alt: "Brand identity mockups laid out on a studio table",
    caption: "ForgeX Brand Identity",
  },
  {
    id: "showcase-3",
    image: `https://images.unsplash.com/photo-1481487196290-c152efe083f5${U}`,
    alt: "Printed design work arranged in a grid",
    caption: "Editorial & Print System",
  },
  {
    id: "showcase-4",
    image: `https://images.unsplash.com/photo-1499951360447-b19be8fe80f5${U}`,
    alt: "A laptop showing a product interface on a wooden desk",
    caption: "Product Interface Design",
  },
  {
    id: "showcase-5",
    image: `https://images.unsplash.com/photo-1531403009284-440f080d1e12${U}`,
    alt: "Design work in progress with sketches and colour swatches",
    caption: "Creative Direction",
  },
];

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

/** Coerce stored content (any shape) into a clean slide array. */
export function normalizePortfolioSlides(raw: unknown): PortfolioSlide[] {
  if (!Array.isArray(raw)) return DEFAULT_PORTFOLIO_SLIDES;
  const slides = raw
    .map((item, i): PortfolioSlide | null => {
      if (!item || typeof item !== "object") return null;
      const r = item as Record<string, unknown>;
      const image = str(r.image) || str(r.src) || str(r.url);
      if (!image) return null;
      return {
        id: str(r.id) || `slide-${i}`,
        image,
        alt: str(r.alt) || str(r.caption) || "Showcase image",
        caption: str(r.caption) || undefined,
        href: str(r.href) || undefined,
      };
    })
    .filter((s): s is PortfolioSlide => s !== null);
  return slides.length > 0 ? slides : DEFAULT_PORTFOLIO_SLIDES;
}

/** Site-content key that holds the showcase slides. */
export const PORTFOLIO_SLIDES_KEY = "portfolioSlides";
