import { PlayCircle } from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";

export function youtubeId(url: string): string | null {
  const m =
    url.match(/youtu\.be\/([\w-]+)/) ||
    url.match(/youtube\.com\/watch\?v=([\w-]+)/) ||
    url.match(/youtube\.com\/embed\/([\w-]+)/);
  return m ? m[1] : null;
}

export function vimeoId(url: string): string | null {
  const m = url.match(/(?:vimeo\.com\/)(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export function loomId(url: string): string | null {
  const m = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  return m ? m[1] : null;
}

export function VideoPlayer({
  url,
  type,
  title,
  muxPlaybackId,
  image,
}: {
  url?: string | null;
  type?: string | null;
  title?: string;
  /** Mux asset playback ID — streams via the Mux player when present. */
  muxPlaybackId?: string | null;
  /** Lesson cover image (Cloudinary) shown when the lesson has no video. */
  image?: string | null;
}) {
  if (muxPlaybackId) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <MuxPlayer
          playbackId={muxPlaybackId}
          streamType="on-demand"
          accentColor="#a3e635"
          metadata={{
            video_title: title ?? "Lesson video",
            player_name: "ForgeX Academy",
          }}
          className="size-full"
        />
      </div>
    );
  }

  if (!url) {
    if (image) {
      return (
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
          <img
            src={image}
            alt={title ?? "Lesson image"}
            className="size-full object-cover"
          />
        </div>
      );
    }
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

  const vimeo = vimeoId(url);
  if (vimeo) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <iframe
          src={`https://player.vimeo.com/video/${vimeo}`}
          title={title ?? "Lesson video"}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  }

  const loom = loomId(url);
  if (loom) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <iframe
          src={`https://www.loom.com/embed/${loom}`}
          title={title ?? "Lesson video"}
          allow="autoplay; fullscreen"
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
