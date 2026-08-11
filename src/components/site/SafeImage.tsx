import { useEffect, useState } from "react";
import type { ImgHTMLAttributes, ReactNode } from "react";

/**
 * An <img> that never shows a broken-image icon.
 *
 * When the URL fails to load — an expired Convex storage link, a deleted
 * Cloudinary asset, a flaky network, a wrong path — SafeImage renders
 * `fallback` instead: initials for avatars, a gradient cover, or a small
 * "photo unavailable" card. The surrounding layout keeps its shape because
 * the fallback usually occupies the same space.
 *
 * The failed state resets whenever `src` changes, so re-uploaded or
 * re-resolved URLs render normally instead of staying stuck on the
 * placeholder.
 */
export function SafeImage({
  src,
  alt,
  className,
  fallback,
  ...rest
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: ReactNode;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "className">) {
  const [state, setState] = useState<{
    src: string | null | undefined;
    failed: boolean;
  }>({ src, failed: false });

  useEffect(() => {
    setState({ src, failed: false });
  }, [src]);

  if (!state.src || state.failed) return <>{fallback ?? null}</>;

  return (
    <img
      src={state.src}
      alt={alt}
      className={className}
      onError={() => setState((s) => ({ ...s, failed: true }))}
      {...rest}
    />
  );
}
