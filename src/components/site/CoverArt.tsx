import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { coverClass, glowClass } from "@/lib/format";
import { courseCoverFor } from "@/lib/course-covers";

/**
 * A course cover: layered dark surface with a category-colored glow,
 * subtle grid and a big icon/emoji. Cover sources are tried in order —
 * admin-uploaded image → curated photo for the course slug → gradient +
 * icon — so a dead or deleted URL (expired Cloudinary asset, removed stock
 * photo) silently steps down to the next source instead of ever showing a
 * broken image or a bare icon where a photo should be.
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
  // URLs that failed to load this session. A URL is only given one chance;
  // the browser won't re-request a dead asset on every render anyway.
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const curated = courseCoverFor(slug);

  // Reset when the sources change (e.g. admin re-uploads a course cover).
  useEffect(() => {
    setFailed(new Set());
  }, [image, curated]);

  const chain = [image, curated].filter(
    (src): src is string => !!src && !failed.has(src),
  );
  const effectiveImage = chain[0];

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
      {effectiveImage ? (
        <img
          key={effectiveImage}
          src={effectiveImage}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() =>
            setFailed((prev) => {
              const next = new Set(prev);
              next.add(effectiveImage);
              return next;
            })
          }
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
