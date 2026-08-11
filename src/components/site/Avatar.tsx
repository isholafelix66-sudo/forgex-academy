import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { SafeImage } from "./SafeImage";

const GRADIENT_AVATARS = [
  "from-lime-400/80 to-emerald-500/80 text-black",
  "from-violet-400/80 to-fuchsia-500/80 text-black",
  "from-cyan-400/80 to-sky-500/80 text-black",
  "from-amber-400/80 to-orange-500/80 text-black",
  "from-rose-400/80 to-pink-500/80 text-black",
];

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  const grad = GRADIENT_AVATARS[hashString(name || "?") % GRADIENT_AVATARS.length];
  // Rendered when the photo is missing OR fails to load — never a broken img.
  const initialsBadge = (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold ring-1 ring-white/15",
        grad,
        className,
      )}
    >
      {initials(name || "?")}
    </span>
  );

  if (image) {
    return (
      <SafeImage
        src={image}
        alt={name}
        loading="lazy"
        decoding="async"
        className={cn(
          "size-10 rounded-full object-cover ring-1 ring-white/15",
          className,
        )}
        fallback={initialsBadge}
      />
    );
  }
  return initialsBadge;
}
