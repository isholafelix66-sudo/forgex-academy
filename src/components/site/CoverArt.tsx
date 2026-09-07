import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { coverClass, glowClass } from "@/lib/format";
import { courseCoverFor } from "@/lib/course-covers";

/**
 * A course cover: layered dark surface with a category-colored glow,
 * subtle grid and a big icon/emoji. If an uploaded cover image is missing
 * or fails to load, the cover gracefully falls back to the gradient + icon
 * treatment instead of showing a broken image. Passing the course `slug`
 * also supplies a real curated photo for seeded courses until an admin
 * uploads a custom cover (uploads always win).
 */
export function CoverArt({
  gradient,
  icon,
  image,
  slug,
  className,
  iconClassName,
}: {
  gradient?: string | null;
  icon?: string | null;
  image?: string | null;
  slug?: string | null;
  className?: string;
  iconClassName?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  // Admin-uploaded cover wins; otherwise use the curated photo for this
  // seeded course (if any).
  const effectiveImage = image ?? courseCoverFor(slug);

  // Reset when the image changes (e.g. admin re-uploads a course cover).
  useEffect(() => {
    setImgFailed(false);
  }, [effectiveImage]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/10 bg-[#10130d]",
        className,
      )}
    >
      <div className="absolute inset-0 bg-grid opacity-60" />
      <div
        className={cn(
          "absolute -top-10 left-1/2 h-40 w-3/4 -translate-x-1/2 rounded-full blur-3xl",
          glowClass(gradient),
        )}
      />
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br",
          coverClass(gradient),
        )}
      />
      {effectiveImage && !imgFailed ? (
        <img
          src={effectiveImage}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          className="relative size-full object-cover"
        />
      ) : (
        icon && (
          <span
            className={cn(
              "relative flex h-full w-full items-center justify-center text-5xl drop-shadow-lg",
              iconClassName,
            )}
          >
            {icon}
          </span>
        )
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
    </div>
  );
}
