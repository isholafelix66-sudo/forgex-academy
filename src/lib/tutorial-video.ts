/**
 * Homepage "ForgeX in two minutes" video configuration.
 *
 * The admin can pick one of three modes, stored in `siteContent` under the
 * `tutorialVideo` key:
 *   • motion — built-in animated motion film (no upload needed, default)
 *   • url    — a YouTube / Vimeo / Loom / MP4 link
 *   • mux    — a video uploaded via Mux (streamed with adaptive bitrate)
 */
export type TutorialVideoConfig =
  | { mode: "motion"; title?: string }
  | { mode: "url"; url: string; title?: string }
  | { mode: "mux"; playbackId: string; title?: string };

/** Parse whatever is stored in `siteContent.tutorialVideo` (object config or
 *  a legacy plain-string URL) into a typed config, or null if unset. */
export function parseTutorialVideo(raw: unknown): TutorialVideoConfig | null {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const mode = r.mode;
    if (mode === "motion") {
      return {
        mode,
        title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : undefined,
      };
    }
    if (mode === "url" && typeof r.url === "string" && r.url.trim()) {
      return {
        mode,
        url: r.url.trim(),
        title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : undefined,
      };
    }
    if (mode === "mux" && typeof r.playbackId === "string" && r.playbackId.trim()) {
      return {
        mode,
        playbackId: r.playbackId.trim(),
        title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : undefined,
      };
    }
  }
  // Legacy shape: a plain video URL string.
  if (typeof raw === "string" && raw.trim()) {
    return { mode: "url", url: raw.trim() };
  }
  return null;
}
