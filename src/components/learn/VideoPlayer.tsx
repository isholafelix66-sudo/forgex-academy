import { PlayCircle } from "lucide-react";

export function youtubeId(url: string): string | null {
  const m =
    url.match(/youtu\.be\/([\w-]+)/) ||
    url.match(/youtube\.com\/watch\?v=([\w-]+)/) ||
    url.match(/youtube\.com\/embed\/([\w-]+)/);
  return m ? m[1] : null;
}

export function VideoPlayer({
  url,
  type,
  title,
}: {
  url?: string | null;
  type?: string | null;
  title?: string;
}) {
  if (!url) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/40 text-center">
        <PlayCircle className="size-10 text-lime-400/70" />
        <p className="text-sm text-muted-foreground">
          No video for this lesson — follow the notes and resources below.
        </p>
      </div>
    );
  }

  const yt = youtubeId(url);
  if (yt) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${yt}`}
          title={title ?? "Lesson video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      <video controls className="size-full" src={url}>
        Your browser doesn't support video playback.
      </video>
    </div>
  );
}
