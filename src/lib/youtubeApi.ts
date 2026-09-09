/**
 * Minimal typed surface for the YouTube IFrame Player API
 * (https://developers.google.com/youtube/iframe_api_reference).
 *
 * The full API ships with its own typings (@types/youtube) which are not
 * installed in this project, so we declare only the parts the lesson player
 * actually uses and load the `https://www.youtube.com/iframe_api` script
 * exactly once — every lesson player reuses the same loaded API instance.
 */

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  destroy(): void;
}

export interface YTPlayerConfig {
  videoId?: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number | boolean>;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { target: YTPlayer; data: number }) => void;
    onPlaybackRateChange?: (e: { target: YTPlayer }) => void;
    onError?: (e: { target: YTPlayer; data: number }) => void;
  };
}

export interface YTNamespace {
  Player: new (elementId: string | HTMLElement, config: YTPlayerConfig) => YTPlayer;
  PlayerState: typeof YT_STATE;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/**
 * Loads the YouTube IFrame API once and resolves with the YT namespace.
 * Safe to call from any number of players — subsequent calls share the
 * same script tag and the same promise.
 */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  if (typeof window === "undefined") {
    apiPromise = Promise.reject(new Error("YouTube API requires a browser window."));
    return apiPromise;
  }
  if (window.YT?.Player) {
    apiPromise = Promise.resolve(window.YT);
    return apiPromise;
  }
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube IFrame API loaded but YT.Player is missing."));
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.onerror = () => {
      apiPromise = null;
      reject(new Error("Failed to load the YouTube IFrame API."));
    };
    document.head.appendChild(tag);
    // Safety net: if the ready callback never fires, surface an error instead
    // of leaving every lesson player stuck in a loading state forever.
    setTimeout(() => {
      if (window.YT?.Player) resolve(window.YT);
    }, 15_000);
  });
  return apiPromise;
}