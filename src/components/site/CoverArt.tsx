import { cn } from "@/lib/utils";
import { coverClass, glowClass } from "@/lib/format";

/**
 * A course cover: layered dark surface with a category-colored glow,
 * subtle grid and a big icon/emoji. Uses no external images, so covers
 * always render.
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
      {image ? (
        <img
          src={image}
          alt=""
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
