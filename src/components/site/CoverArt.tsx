import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { coverClass, glowClass } from "@/lib/format";

/**
 * A course cover: layered dark surface with a category-colored glow,
 * subtle grid and a big icon/emoji. If an uploaded cover image is missing
 * or fails to load, the cover gracefully falls back to the gradient + icon
 * treatment instead of showing a broken image.
 */
export function CoverArt({
  gradient,
  icon,
  image,
  className,
  iconClassName,
}: {
  gradient?: string | null;
  icon?: string | null;
  image?: string | null;
  className?: string;
  iconClassName?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  // Reset when the image changes (e.g. admin re-uploads a course cover).
  useEffect(() => {
    setImgFailed(false);
  }, [image]);

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
      {image && !imgFailed ? (
        <img
          src={image}
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
