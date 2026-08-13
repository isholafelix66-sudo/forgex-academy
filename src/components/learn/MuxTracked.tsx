import { useEffect, useRef } from "react";
import MuxPlayer from "@mux/mux-player-react";

/**
 * Mux-backed lesson player. Kept in its own module so the ~1MB
 * @mux/mux-player-react chunk (media-chrome, hls.js, mux elements) only
 * loads when a Mux-backed lesson actually plays — VideoPlayer pulls it in
 * lazily, so course and landing pages stay lean.
 */
export function MuxTracked({
  playbackId,
  title,
  emit,
}: {
  playbackId: string;
  title: string;
  emit: (pct: number) => void;
}) {
  const ref = useRef<any>(null);
  const emitRef = useRef(emit);
  emitRef.current = emit;

  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;
    const onTime = () => {
      try {
        if (el.duration > 0) emitRef.current((el.currentTime / el.duration) * 100);
      } catch {
        // ignore
      }
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, []);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      <MuxPlayer
        ref={ref}
        playbackId={playbackId}
        streamType="on-demand"
        accentColor="#a3e635"
        metadata={{
          video_title: title,
          player_name: "ForgeX Academy",
        }}
        className="size-full"
      />
    </div>
  );
}
