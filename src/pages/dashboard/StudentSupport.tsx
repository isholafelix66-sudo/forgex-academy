import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useAction, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Bot,
  Send,
  Loader2,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Sparkles,
  LifeBuoy,
  ChevronDown,
  MessageCircle,
  ArrowRight,
  Mic,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";

const QUICK_ACTIONS = [
  "I cannot access my course",
  "I have an account problem",
  "I need help with my learning",
  "I am having a technical issue",
  "I need help using the platform",
] as const;

type AiMessage = { role: "user" | "ai"; body: string; at: number };

function fmtTime(t: number) {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type PageMode = "ask" | "chat" | "thread";
type VoicePhase = "idle" | "recording" | "transcribing" | "speaking";

// ---------------------------------------------------------------------------
// Voice engine — record → transcribe (server) → speak reply (server)
// Recordings live only in memory; nothing is persisted.
// The waveform is driven by REAL microphone levels via AnalyserNode.
// ---------------------------------------------------------------------------

/** Normalized RMS above which we consider the mic to be "hearing sound". */
const SOUND_THRESHOLD = 0.015;

function useVoiceChat(
  onTranscribed: (text: string) => Promise<string | null>,
  echoTranscriptToInput: (text: string) => void,
  shouldSpeakReply?: () => boolean,
) {
  const transcribe = useAction(api.aiVoice.transcribeVoice);
  const speak = useAction(api.aiVoice.speakText);

  const [phase, setPhase] = useState<VoicePhase>("idle");
  const phaseRef = useRef<VoicePhase>("idle");
  phaseRef.current = phase;
  const [transcriptPreview, setTranscriptPreview] = useState("");
  const [soundDetected, setSoundDetected] = useState(false); // live mic feedback
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const convex = useConvex();

  // Real-time audio analysis
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  /** Live normalized mic level (0..1), read by the waveform at 60fps. */
  const levelRef = useRef(0);
  /** Highest level seen this recording — used to reject true silence. */
  const peakLevelRef = useRef(0);
  const soundDetectedRef = useRef(false);
  const bytesRef = useRef(0); // actual audio bytes captured so far

  const stopLevelMetering = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    try {
      void audioCtxRef.current?.close();
    } catch {
      // ignore
    }
    audioCtxRef.current = null;
    levelRef.current = 0;
  }, []);

  const cleanupRecording = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    stopLevelMetering();
    // Always release the microphone tracks.
    streamRef.current?.getTracks().forEach((t) => {
      if (t.readyState !== "ended") t.stop();
    });
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    bytesRef.current = 0;
    setSoundDetected(false);
  }, [stopLevelMetering]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPhase((p) => (p === "speaking" ? "idle" : p));
  }, []);

  useEffect(() => () => {
    // Unmount: never leave a mic hot or audio playing.
    cleanupRecording();
    if (audioRef.current) audioRef.current.pause();
  }, [cleanupRecording]);

  const speakReply = useCallback(
    async (text: string) => {
      if (shouldSpeakReply && !shouldSpeakReply()) return; // muted → text only
      setPhase("speaking");
      const owner: AudioOwner = {
        stop: () => {
          audioRef.current?.pause();
        },
      };
      claimAudio(owner); // stops any SpeakButton playback app-wide
      try {
        // New backend contract: one small action per chunk, each returning a
        // Convex storage ID that we resolve to a playable https URL.
        const first = (await speak({ text, chunkIndex: 0 })) as unknown as {
          storageId: string;
          chunkCount: number;
        };
        const storageIds: string[] = [first.storageId];
        for (let i = 1; i < first.chunkCount; i++) {
          if (phaseRef.current !== "speaking") break;
          const next = (await speak({ text, chunkIndex: i })) as unknown as { storageId: string };
          storageIds.push(next.storageId);
        }
        for (const sid of storageIds) {
          if (phaseRef.current !== "speaking") break;
          const url = await convex.query(api.aiSupportData.getAudioUrl, {
            storageId: sid as never,
          });
          if (!url || phaseRef.current !== "speaking") break;
          const audio = new Audio(url);
          audioRef.current = audio;
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve(); // skip a bad chunk rather than failing the reply
            audio.play().catch(() => resolve()); // autoplay block → stop quietly
          });
        }
        setPhase("idle");
      } catch (err) {
        console.warn("[speakReply] TTS failed", err); // technical detail: logs only
        setPhase("idle");
        // Friendly, fixed message — NEVER surface raw Convex/server errors.
        toast.error("Audio couldn’t be played. You can still read the reply above.");
      } finally {
        releaseAudio(owner);
      }
    },
    [convex, shouldSpeakReply, speak],
  );

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice input isn't supported in this browser. Please type your message instead.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError" || err?.name === "SecurityError") {
        toast.error("Microphone permission denied. Allow mic access in your browser settings, or type your message.");
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError" || err?.name === "OverconstrainedError") {
        toast.error("Microphone unavailable — no mic was found on this device. Please type your message instead.");
      } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
        toast.error("Your microphone is in use by another app. Close it and try again, or type your message.");
      } else {
        toast.error(`Couldn't access the microphone${err?.name ? ` (${err.name})` : ""}. Please try again or type your message.`);
      }
      return;
    }

    // Verify the track is actually live before wiring anything up.
    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState !== "live" || track.muted) {
      stream.getTracks().forEach((t) => t.stop());
      toast.error("Microphone unavailable — the audio track did not start. Please check your device and try again.");
      return;
    }

    try {
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
              ? "audio/ogg;codecs=opus"
              : "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      streamRef.current = stream;
      chunksRef.current = [];
      bytesRef.current = 0;
      peakLevelRef.current = 0;
      soundDetectedRef.current = false;
      setSoundDetected(false);

      let started = false;
      recorder.onstart = () => {
        started = true;
        setPhase("recording"); // only show "recording" once capture truly began
      };
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          bytesRef.current += e.data.size;
        }
      };
      recorder.onerror = () => {
        cleanupRecording();
        setPhase("idle");
        toast.error("Recording failed unexpectedly. Please try again or type your message.");
      };
      recorder.onstop = async () => {
        const mimeType = (recorder.mimeType || "audio/webm").replace(/;.*$/, "");

        // Snapshot everything we need BEFORE cleanup wipes the buffers.
        const blob = new Blob(chunksRef.current.slice(), { type: mimeType });
        const capturedBytes = bytesRef.current;
        const peakLevel = peakLevelRef.current;
        cleanupRecording();
        setPhase((p) => (p === "recording" ? "transcribing" : p));

        // 1) Did MediaRecorder actually capture bytes?
        if (capturedBytes === 0 || blob.size === 0) {
          setPhase("idle");
          toast.error("No audio was captured from your microphone. Please try again.");
          return;
        }
        // 2) Did the microphone actually hear anything (real level metering)?
        if (peakLevel < SOUND_THRESHOLD) {
          setPhase("idle");
          toast.error("No sound detected. Please try again — speak a little closer to the microphone.");
          return;
        }

        // 3) Transcribe — any duration accepted, even a single word.
        try {
          const base64: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Could not process the recording."));
            reader.readAsDataURL(blob);
          });
          let out: { text: string };
          try {
            out = (await transcribe({ audioBase64: base64, mimeType })) as { text: string };
          } catch (err: any) {
            const msg = String(err?.message ?? "");
            throw new Error(
              /network|fetch|failed to fetch/i.test(msg)
                ? "Network error while transcribing. Check your connection and try again."
                : msg || "Transcription failed. Please try again or type your message.",
            );
          }
          const text = out.text.trim();
          if (!text) {
            setPhase("idle");
            toast.error("I couldn't hear any speech. Please try again.");
            return;
          }
          echoTranscriptToInput(text); // transcript lands in the chat input
          setTranscriptPreview(text); // …and is shown on the status strip
          const reply = await onTranscribed(text);
          if (reply) await speakReply(reply);
          else setPhase("idle");
        } catch (err: any) {
          setPhase("idle");
          toast.error(err?.message ?? "Transcription failed. Please try again or type your message.");
        } finally {
          setTimeout(() => setTranscriptPreview(""), 4000);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      // Safari/Firefox sometimes never fire onstart if capture fails — guard it.
      setTimeout(() => {
        if (!started) {
          cleanupRecording();
          setPhase("idle");
          toast.error("Recording failed to start. Please try again or type your message.");
        }
      }, 2000);

      // ---- REAL live level metering (AnalyserNode → levelRef → waveform) ----
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Float32Array(analyser.fftSize);
      const tick = () => {
        if (!analyserRef.current || !streamRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.min(1, Math.sqrt(sum / buf.length) * 4); // perceptual boost
        levelRef.current = rms;
        if (rms > peakLevelRef.current) peakLevelRef.current = rms;
        if (rms >= SOUND_THRESHOLD && !soundDetectedRef.current) {
          soundDetectedRef.current = true;
          setSoundDetected(true);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      // Hard cap at 2 minutes so uploads stay small (maximum, not minimum).
      timerRef.current = setTimeout(() => {
        if (recorderRef.current?.state === "recording") recorder.stop();
      }, 120_000);
    } catch (err: any) {
      cleanupRecording();
      setPhase("idle");
      toast.error(
        err instanceof Error
          ? `Recording failed: ${err.message}. Please try again or type your message.`
          : "Recording failed to start. Please try again or type your message.",
      );
    }
  }, [cleanupRecording, echoTranscriptToInput, onTranscribed, speakReply, transcribe]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  return {
    phase,
    transcriptPreview,
    startRecording,
    stopRecording,
    stopAudio,
    busy: phase !== "idle",
    levelRef,
    soundDetected,
  };
}

// ---------------------------------------------------------------------------
// Live waveform — canvas bars driven by REAL microphone RMS levels.
// This is not decorative: it renders levelRef, which AnalyserNode updates
// from the actual mic signal 60 times per second.
// ---------------------------------------------------------------------------

function VoiceWaveform({ levelRef, active }: { levelRef: React.MutableRefObject<number>; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const ctx2d = canvas?.getContext("2d");
    if (!canvas || !ctx2d) return;
    const BARS = 28;
    const history = new Array<number>(BARS).fill(0);
    let raf: number | null = null;

    const draw = () => {
      // Push the current real mic level into the bar history.
      history.push(Math.max(0.04, Math.min(1, levelRef.current)));
      history.shift();

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, w, h);

      const gap = 2;
      const barW = (w - gap * (BARS - 1)) / BARS;
      for (let i = 0; i < BARS; i++) {
        const v = history[i];
        const barH = Math.max(3, v * (h - 4));
        const x = i * (barW + gap);
        const y = (h - barH) / 2;
        ctx2d.fillStyle = v > 0.6 ? "rgba(163,230,53,0.95)" : v > 0.25 ? "rgba(163,230,53,0.65)" : "rgba(163,230,53,0.3)";
        ctx2d.beginPath();
        ctx2d.roundRect(x, y, barW, barH, 2);
        ctx2d.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [active, levelRef]);

  return (
    <canvas
      ref={canvasRef}
      className="h-8 w-36 shrink-0 sm:w-48"
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// SpeakButton — "Play text as audio" under AI replies.
// Never exposes server/Convex errors; caches generated audio so replays are
// free; plays chunks sequentially; handles mobile autoplay restrictions.
// ---------------------------------------------------------------------------

type TtsResult = { storageIds: string[] };

/** Generated-audio cache keyed by exact reply text — replay never re-bills. */
const ttsCache = new Map<string, TtsResult>();

/**
 * Generate ALL chunks for a reply, one small action call each.
 * Each call stores its audio as a Convex file and returns just an ID —
 * this is what makes LONG replies work (no oversized function results).
 */
async function generateTtsChunks(
  speak: (args: { text: string; chunkIndex?: number }) => Promise<unknown>,
  text: string,
  isCurrent: () => boolean,
): Promise<TtsResult> {
  const first = (await speak({ text, chunkIndex: 0 })) as { storageId: string; chunkCount: number };
  const storageIds: string[] = [first.storageId];
  for (let i = 1; i < first.chunkCount; i++) {
    if (!isCurrent()) return { storageIds };
    const next = (await speak({ text, chunkIndex: i })) as { storageId: string };
    storageIds.push(next.storageId);
  }
  return { storageIds };
}

// ---------------------------------------------------------------------------
// Global audio ownership — exactly ONE audio may play app-wide.
// Starting a new playback stops whoever owned the audio before.
// ---------------------------------------------------------------------------

type AudioOwner = { stop: () => void };
let currentOwner: AudioOwner | null = null;

function claimAudio(owner: AudioOwner) {
  if (currentOwner && currentOwner !== owner) {
    try {
      currentOwner.stop();
    } catch {
      // ignore
    }
  }
  currentOwner = owner;
}

function releaseAudio(owner: AudioOwner) {
  if (currentOwner === owner) currentOwner = null;
}

/** The auto-play engine's single audio element + its stop handle. */
let engineAudioEl: HTMLAudioElement | null = null;
let engineStopCurrent: (() => void) | null = null;
function stopEngineAudio() {
  try {
    engineStopCurrent?.();
  } catch {
    // ignore
  }
}

/**
 * Browser autoplay unlock: audio may auto-play once the user has interacted
 * with the page (any tap/click). Persisted per tab session so we ask once.
 */
const VOICE_UNLOCK_KEY = "fx_voice_unlocked_v1";
let voiceUnlocked = false;
try {
  voiceUnlocked = sessionStorage.getItem(VOICE_UNLOCK_KEY) === "1";
} catch {
  // storage unavailable — start locked; first tap unlocks for this session
}

// ---------------------------------------------------------------------------
// SpeakButton — "Play text as audio" under AI replies.
//
// State machine: idle → generating → loading → playing ⇄ paused → idle
//                                                     ↘ blocked / error
//
// Correctness rules enforced here:
//  - play() resolving = playback STARTED = success. Never an error later.
//  - AbortError is NOT a failure (it's our own stop/new-source interrupt).
//  - Every async continuation checks its request ID first — stale requests
//    can never overwrite the state of a newer one.
//  - Chunks play strictly sequentially (wait for 'ended').
// ---------------------------------------------------------------------------

function SpeakButton({ text }: { text: string }) {
  const speak = useAction(api.aiVoice.speakText);
  const convex = useConvex();
  const [phase, setPhase] = useState<
    "idle" | "generating" | "loading" | "playing" | "paused" | "blocked" | "error"
  >("idle");

  const reqIdRef = useRef(0); // request identity — stale requests can't write state
  const audioRef = useRef<HTMLAudioElement | null>(null); // ONE stable element
  const urlRef = useRef<string | null>(null); // current object URL (revoked properly)
  const resultRef = useRef<TtsResult | null>(null); // cached generation for this session
  const chunkIdxRef = useRef(0);
  const everPlayedRef = useRef(false); // distinguishes "Play" vs "Play again"
  const stopFlagRef = useRef(false); // user-requested stop of current run
  const startedRef = useRef(false); // did THIS chunk actually start playing?

  /** Only the current request may touch UI state. */
  const isCurrent = useCallback((id: number) => reqIdRef.current === id, []);

  /** Tear down the audio element + object URL completely. */
  const destroyAudio = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.onplay = null;
      el.onpause = null;
      el.onended = null;
      el.onerror = null;
      el.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  /** Stop whatever this button is doing right now (used by global takeover). */
  const stopCurrentRun = useCallback(() => {
    reqIdRef.current += 1; // invalidate everything in flight
    stopFlagRef.current = true;
    destroyAudio();
  }, [destroyAudio]);

  // Stable per-instance owner object — same identity across runs so that
  // re-claiming audio for a second playback never self-aborts.
  const ownerRef = useRef<AudioOwner | null>(null);
  if (!ownerRef.current) {
    ownerRef.current = { stop: () => {} };
  }
  ownerRef.current.stop = stopCurrentRun;

  // Unmount: always stop + clean up listeners/object URLs.
  useEffect(
    () => () => {
      reqIdRef.current += 1;
      releaseAudio({ stop: () => {} });
      destroyAudio();
    },
    [destroyAudio],
  );

  /** Create/refresh the single Audio element for a chunk source. */
  const prepareChunk = useCallback((sourceUrl: string): HTMLAudioElement => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    // Reset previous source & handlers before assigning the new one.
    audio.onplay = null;
    audio.onpause = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    // Storage URLs are https links — nothing to revoke between chunks.
    audio.src = sourceUrl;
    audio.load(); // explicit load of the new source
    return audio;
  }, []);

  /** Play one chunk fully. Resolves ONLY when the chunk ends or is stopped. */
  const playChunkToCompletion = useCallback(
    (id: number, sourceUrl: string): Promise<"done" | "stopped" | "blocked" | "failed"> =>
      new Promise((resolve) => {
        if (!isCurrent(id)) return resolve("stopped");
        startedRef.current = false;
        stopFlagRef.current = false;
        const audio = prepareChunk(sourceUrl);

        let settled = false;
        const finish = (outcome: "done" | "stopped" | "blocked" | "failed") => {
          if (settled || !isCurrent(id)) {
            settled = true;
            return;
          }
          settled = true;
          resolve(outcome);
        };

        audio.onplay = () => {
          if (!isCurrent(id)) return;
          startedRef.current = true;
          everPlayedRef.current = true;
          setPhase("playing"); // success — playback confirmed by the browser
        };

        audio.onended = () => finish("done");

        audio.onerror = () => {
          // Only a genuine failure if playback NEVER started. An error after
          // successful playback start must not flag the whole run as broken.
          finish(startedRef.current ? "done" : "failed");
        };

        audio.play().then(
          () => {
            // Playback STARTED successfully. Do nothing further here —
            // 'onended'/'onplay'/stop drive the rest. Never an error after this.
          },
          (err: DOMException) => {
            if (err?.name === "NotAllowedError") {
              finish("blocked"); // mobile autoplay policy — needs another tap
            } else if (err?.name === "AbortError") {
              // Interrupted by our own stop/new source. If sound had already
              // begun, treat as success-completed; otherwise just stopped.
              finish(startedRef.current ? "done" : "stopped");
            } else if (err?.name === "NotSupportedError") {
              finish("failed");
            } else {
              // Unknown rejection before start → genuine playback failure.
              console.warn("[speakText] play() rejected:", err?.name, err?.message);
              finish("failed");
            }
          },
        );
      }),
    [isCurrent, prepareChunk],
  );

  /** Full sequential playback of every chunk in the cached result. */
  const runPlayback = useCallback(
    async (id: number, result: TtsResult): Promise<void> => {
      // Take over app-wide audio (stops any other playing reply/mic audio).
      claimAudio(ownerRef.current!);
      try {
        setPhase("loading");
        for (let i = 0; i < result.storageIds.length; i++) {
          if (!isCurrent(id)) return; // superseded — touch nothing
          chunkIdxRef.current = i;
          // Resolve the stored file to a fresh signed URL right before playing
          // (URLs expire, so never reuse an old one across sessions).
          let sourceUrl: string | null = null;
          try {
            sourceUrl = await convex.query(api.aiSupportData.getAudioUrl, {
              storageId: result.storageIds[i] as never,
            });
          } catch (err) {
            console.warn("[speakText] could not resolve audio URL", err);
          }
          if (!sourceUrl) throw new Error("audio-url-unavailable");
          if (!isCurrent(id)) return;
          const outcome = await playChunkToCompletion(id, sourceUrl);
          if (!isCurrent(id)) return;
          if (outcome === "stopped") return; // user stop / superseded — stay quiet
          if (outcome === "blocked") {
            setPhase("blocked"); // one more tap starts from loaded audio
            return;
          }
          if (outcome === "failed") throw new Error("chunk-failed");
          // "done" → move to the next chunk (strictly sequential).
        }
        if (isCurrent(id)) setPhase("idle"); // finished naturally → Play again
      } catch (err) {
        // Genuine generation/load/playback failure — and ONLY that lands here.
        console.warn("[speakText] playback failed", err);
        if (isCurrent(id)) {
          destroyAudio();
          setPhase("error");
        }
      } finally {
        // Natural finish / stop / blocked: free global ownership.
        releaseAudio(ownerRef.current!);
      }
    },
    [convex, destroyAudio, isCurrent, ownerRef, playChunkToCompletion],
  );

  const handleTap = useCallback(async () => {
    switch (phase) {
      case "generating":
        return; // repeated taps: no duplicate requests
      case "loading":
        return; // buffering — avoid double-starting the same element
      case "playing": {
        // Pause (element survives; resume continues from position).
        audioRef.current?.pause();
        setPhase("paused");
        return;
      }
      case "paused": {
        const id = ++reqIdRef.current;
        const audio = audioRef.current;
        if (audio) {
          setPhase("loading");
          try {
            await audio.play(); // resumes from paused position
            if (isCurrent(id)) setPhase("playing");
          } catch {
            if (isCurrent(id)) setPhase("paused");
          }
        } else {
          setPhase("idle");
        }
        return;
      }
      default:
        break;
    }

    const trimmed = (text ?? "").trim();
    if (!trimmed) return; // empty handled gracefully — nothing to read

    // Fresh request identity — invalidates any older run instantly.
    const id = ++reqIdRef.current;
    stopFlagRef.current = false;

    // Replay from cache without hitting the server again.
    const cached = ttsCache.get(trimmed);
    if (cached && cached.storageIds.length > 0) {
      resultRef.current = cached;
      void runPlayback(id, cached);
      return;
    }

    setPhase("generating");
    try {
      const res = await generateTtsChunks(
        (args) => speak(args as never),
        trimmed,
        () => isCurrent(id),
      );
      if (!isCurrent(id)) return; // stale response — ignore entirely
      if (res.storageIds.length === 0) throw new Error("no audio returned");
      ttsCache.set(trimmed, res);
      resultRef.current = res;
      if (!isCurrent(id)) return;
      await runPlayback(id, res);
    } catch (err) {
      console.warn("[speakText] generation failed", err); // technical: console only
      if (isCurrent(id)) setPhase("error");
    }
    }, [isCurrent, phase, runPlayback, speak, text]);

  const label = (() => {
    switch (phase) {
      case "generating":
        return (
          <>
            <Loader2 className="size-3 animate-spin" /> Generating…
          </>
        );
      case "loading":
        return (
          <>
            <Loader2 className="size-3 animate-spin" /> Loading audio…
          </>
        );
      case "playing":
        return (
          <>
            <Square className="size-3" /> Pause
          </>
        );
      case "paused":
        return (
          <>
            <Volume2 className="size-3" /> Resume
          </>
        );
      case "blocked":
        return (
          <>
            <Volume2 className="size-3" /> Tap to play
          </>
        );
      case "error":
        return (
          <>
            <Volume2 className="size-3" /> Try again
          </>
        );
      default:
        return (
          <>
            <Volume2 className="size-3" /> {everPlayedRef.current ? "Play again" : "Play"}
          </>
        );
    }
  })();

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void handleTap()}
        disabled={phase === "generating"}
        aria-label={
          phase === "playing" ? "Pause audio" : phase === "paused" ? "Resume audio" : "Play this reply as audio"
        }
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
          phase === "playing" || phase === "paused"
            ? "border-lime-400/40 bg-lime-400/15 text-lime-300"
            : phase === "error"
              ? "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
              : "border-white/10 bg-black/20 text-white/50 hover:border-lime-400/30 hover:text-lime-300"
        }`}
      >
        {label}
      </button>
      {phase === "error" && (
        <span className="text-[10px] font-medium text-amber-300/80">Couldn’t play audio. Tap “Try again”.</span>
      )}
    </div>
  );
}

export default function StudentSupport() {
  // appears here instantly without refreshing the page.
  const latest = useQuery(api.aiSupportData.getMyLatestSession);
  const myTickets = useQuery(api.aiSupportData.myTickets, {});
  const startSession = useMutation(api.aiSupportData.startSession);
  const resolveSession = useMutation(api.aiSupportData.resolveSession);
  const markSeen = useMutation(api.aiSupportData.markTicketSeen);
  const sendAi = useAction(api.aiSupport.sendAiMessage);
  const escalate = useAction(api.aiSupport.escalateToHuman);

  const [mode, setMode] = useState<PageMode>("ask");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [askedSolved, setAskedSolved] = useState(false);
  const [showEscalateForm, setShowEscalateForm] = useState(false);
  const [extraDetails, setExtraDetails] = useState("");
  const [escalating, setEscalating] = useState(false);
  const [justResolved, setJustResolved] = useState<"helpful" | "not_helpful" | null>(null);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const sessionId = latest?._id ?? null;
  const messages: AiMessage[] = (latest?.messages ?? []) as AiMessage[];
  const safeTickets = Array.isArray(myTickets) ? myTickets : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending, mode]);

  // If an escalated ticket gains a team reply while the user is on the page,
  // surface it immediately (realtime — no refresh needed).
  const activeTicketUnseen = !!latest?.ticket?.hasUnseenTeamReply;

  const handleSend = async (text?: string, opts?: { voice?: boolean }): Promise<string | null> => {
    const body = (text ?? input).trim();
    if (!body || sending || !sessionId) return null;
    setInput("");
    setAskedSolved(false);
    setShowEscalateForm(false);
    setSending(true);
    try {
      const res = (await sendAi({ sessionId, text: body, voice: opts?.voice })) as { reply: string };
      setAskedSolved(true);
      return res?.reply ?? null;
    } catch (err: any) {
      toast.error(err?.message ?? "Could not reach the assistant. Try again.");
      return null;
    } finally {
      setSending(false);
    }
  };

  // Voice pipeline: transcribed text flows through the SAME AI support system.
  // The transcript first lands in the chat input, then is sent automatically.
  const voice = useVoiceChat(
    async (spoken) => handleSend(spoken, { voice: true }),
    (text) => setInput(text),
    () => voiceOnRef.current,
  );

  // -----------------------------------------------------------------------
  // Automatic voice-reply engine.
  // Every NEW AI response is spoken automatically — no buttons. Chunks are
  // generated one small request each, queued, and played strictly in order.
  // A single failure NEVER blocks the next response (each item isolated).
  // -----------------------------------------------------------------------
  const speak = useAction(api.aiVoice.speakText);
  const convex = useConvex();

  const [voiceOn, setVoiceOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem("fx_voice_on") !== "0";
    } catch {
      return true;
    }
  });
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const unlockedRef = useRef(voiceUnlocked);
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;

  const toggleVoice = useCallback(() => {
    setVoiceOn((v) => {
      const next = !v;
      try {
        localStorage.setItem("fx_voice_on", next ? "1" : "0");
      } catch {
        // ignore
      }
      if (!next) stopEngineAudio();
      return next;
    });
  }, []);

  /** Play one storage URL to completion on the engine's own element. */
  const enginePlayUrl = useCallback(
    (url: string): Promise<"done" | "blocked"> =>
      new Promise((resolve) => {
        const audio = new Audio(url);
        engineAudioEl = audio;
        let settled = false;
        const owner: AudioOwner = { stop: () => undefined };
        const finish = (r: "done" | "blocked") => {
          if (settled) return;
          settled = true;
          if (engineAudioEl === audio) engineAudioEl = null;
          releaseAudio(owner);
          resolve(r);
        };
        owner.stop = () => {
          try {
            audio.pause();
          } catch {
            // ignore
          }
          finish("done");
        };
        claimAudio(owner); // mic replies / other buttons stop us cleanly
        engineStopCurrent = owner.stop;
        audio.onended = () => finish("done");
        audio.onerror = () => finish("done"); // skip a bad chunk, never fail the run
        audio.play().catch((err: DOMException) => {
          finish(err?.name === "NotAllowedError" ? "blocked" : "done");
        });
      }),
    [],
  );

  /** Generate + play one full reply. Isolated: throws never escape upward. */
  const generateAndPlay = useCallback(
    async (text: string): Promise<void> => {
      try {
        const trimmed = text.trim();
        if (!trimmed) return; // empty AI response → nothing to speak

        const resolveUrl = async (storageId: string): Promise<string | null> => {
          try {
            return await convex.query(api.aiSupportData.getAudioUrl, {
              storageId: storageId as never,
            });
          } catch (err) {
            console.warn("[voiceEngine] URL resolve failed", err); // logs only
            return null;
          }
        };

        const speakChunk = (i: number) =>
          speak({ text: trimmed, chunkIndex: i }) as Promise<{
            storageId: string;
            chunkCount: number;
          }>;

        // Wait ONLY for the short lead chunk — speech starts within seconds.
        let current = await speakChunk(0);
        let index = 0;
        // Prefetch chunk 2 in parallel WHILE chunk 1 plays.
        let prefetch: Promise<{ storageId: string; chunkCount: number } | null> =
          current.chunkCount > 1 ? speakChunk(1).catch(() => null) : Promise.resolve(null);

        while (current) {
          if (!unlockedRef.current || !voiceOnRef.current) return;
          const url = await resolveUrl(current.storageId);
          if (url && unlockedRef.current && voiceOnRef.current) {
            const outcome = await enginePlayUrl(url); // resolves when chunk finishes
            if (outcome === "blocked") {
              // Browser blocked autoplay → ask ONCE for a tap.
              unlockedRef.current = false;
              try {
                sessionStorage.removeItem(VOICE_UNLOCK_KEY);
              } catch {
                // ignore
              }
              setNeedsUnlock(true);
              return;
            }
          }
          // Advance to the prefetched chunk (already generated during playback).
          const next = prefetch ? await prefetch : null;
          prefetch = null;
          if (!next) break;
          current = next;
          index += 1;
          // Keep the pipeline full — fetch the following chunk while this plays.
          if (index + 1 < current.chunkCount) {
            prefetch = speakChunk(index + 1).catch(() => null);
          }
        }
      } catch (err) {
        // One failed response must never affect the next. Log internally only.
        console.warn("[voiceEngine] TTS failed for this response", err);
      }
    },
    [convex, enginePlayUrl, speak],
  );

  type QueueItem = { key: string; text: string };
  const queueRef = useRef<QueueItem[]>([]);
  const runningRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (runningRef.current) return;
    if (!unlockedRef.current || !voiceOnRef.current) return;
    runningRef.current = true;
    try {
      while (queueRef.current.length > 0 && unlockedRef.current && voiceOnRef.current) {
        const item = queueRef.current.shift()!;
        await generateAndPlay(item.text);
      }
    } finally {
      runningRef.current = false;
    }
  }, [generateAndPlay]);

  /** Unlock on the user's very first interaction anywhere (autoplay policy). */
  useEffect(() => {
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      voiceUnlocked = true;
      try {
        sessionStorage.setItem(VOICE_UNLOCK_KEY, "1");
      } catch {
        // ignore
      }
      setNeedsUnlock(false);
      void processQueue();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [processQueue]);

  // Stop engine audio when leaving the page or toggling voice off.
  useEffect(
    () => () => {
      engineStopCurrent?.();
    },
    [],
  );

  // Enqueue every NEW AI response exactly once (dedup by stable key).
  const ttsProcessedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (mode !== "chat" || !sessionId) return;
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];
    if (!last || last.role !== "ai") return;
    const key = `${sessionId}:${lastIdx}:${last.body.length}`;
    if (ttsProcessedRef.current.has(key)) return;
    ttsProcessedRef.current.add(key); // StrictMode / re-render proof
    if (!voiceOnRef.current) return; // muted → text-only
    // Cap pending items so a burst can't pile up stale speech.
    if (queueRef.current.length >= 2) queueRef.current.shift();
    queueRef.current.push({ key, text: last.body });
    if (unlockedRef.current) {
      void processQueue();
    } else {
      setNeedsUnlock(true); // ask once for the enabling tap
    }
  }, [messages, mode, processQueue, sessionId]);

  const handleStartNew = async () => {
    try {
      await startSession({});
      setJustResolved(null);
      setAskedSolved(false);
      setShowEscalateForm(false);
      setMode("chat");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not start a new conversation.");
    }
  };

  const markResolved = async (rating?: "helpful" | "not_helpful") => {
    if (!sessionId) return;
    try {
      await resolveSession({ sessionId, rating });
      setJustResolved(rating ?? null);
      setAskedSolved(false);
      toast.success("Great! Your AI support session is marked as resolved.");
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong.");
    }
  };

  const handleEscalate = async () => {
    if (!sessionId) return;
    setEscalating(true);
    try {
      const ticketNumber = (await escalate({
        sessionId,
        additionalDetails: extraDetails.trim() || undefined,
      })) as unknown as string;
      toast.success(`Ticket ${ticketNumber} created — our team has the full conversation.`);
      setExtraDetails("");
      setShowEscalateForm(false);
      setMode("thread"); // jump straight into the human-support thread
    } catch (err: any) {
      toast.error(err?.message ?? "Escalation failed. Please try again.");
    } finally {
      setEscalating(false);
    }
  };

  const openTicket = (id: string) => {
    setOpenTicketId(id);
    void markSeen({ ticketId: id as never }).catch(() => {});
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      open: "bg-amber-400/10 text-amber-300",
      assigned: "bg-blue-400/10 text-blue-300",
      in_progress: "bg-blue-400/10 text-blue-300",
      waiting_for_user: "bg-purple-400/10 text-purple-300",
      resolved: "bg-lime-400/10 text-lime-300",
      closed: "bg-white/5 text-white/40",
    };
    return map[s] ?? "bg-white/5 text-white/40";
  };

  // ------------------------------------------------------------------ render
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-lime-400/20 bg-lime-400/5 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
            <Bot className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="font-display truncate text-base font-bold">ForgeX Support Assistant</p>
            <p className="truncate text-xs text-muted-foreground">
              AI first-line support · humans join when needed · live updates
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={voiceOn ? "Mute voice replies" : "Unmute voice replies"}
            title={voiceOn ? "Voice replies on" : "Voice replies muted"}
            className={`inline-flex size-9 items-center justify-center rounded-lg border transition-colors ${
              voiceOn
                ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                : "border-white/10 bg-black/20 text-white/40 hover:text-white/70"
            }`}
          >
            {voiceOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
          <button
            type="button"
            onClick={handleStartNew}
            disabled={latest === undefined}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:border-lime-400/30 hover:text-lime-300 disabled:opacity-40"
          >
            <RefreshCw className="size-3.5" /> New chat
          </button>
        </div>
      </div>

      {/* One-time autoplay unlock — appears only if the browser blocked audio */}
      {needsUnlock && !unlockedRef.current && (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-400/20"
        >
          🔊 Tap anywhere to enable voice replies (one time)
        </button>
      )}

      {/* Live team-reply banner (shows anywhere on the page, realtime) */}
      {activeTicketUnseen && latest?.ticket && (
        <button
          type="button"
          onClick={() => {
            setMode("thread");
            openTicket(latest.ticket!._id);
          }}
          className="flex w-full items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/8 p-3.5 text-left transition-colors hover:bg-amber-400/15"
        >
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-amber-400" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-200">
              👤 A support team member replied to your ticket {latest.ticket.ticketNumber}
            </p>
            {latest.ticket.lastMessagePreview && (
              <p className="truncate text-xs text-amber-200/60">{latest.ticket.lastMessagePreview}</p>
            )}
          </div>
          <ArrowRight className="size-4 shrink-0 text-amber-300" />
        </button>
      )}

      {latest === undefined ? (
        <div className="rounded-2xl border border-white/10 bg-card py-14 text-center">
          <Loader2 className="mx-auto size-6 animate-spin text-lime-400" />
        </div>
      ) : mode === "ask" && latest ? (
        /* ------------------------- RESUME PROMPT ------------------------- */
        <ResumeCard
          latest={latest}
          justResolved={justResolved}
          onContinue={() => setMode(latest.status === "escalated" && latest.ticket ? "thread" : "chat")}
          onStartNew={handleStartNew}
        />
      ) : (
        <>
          {/* Resolved confirmation */}
          {justResolved && (
            <div className="rounded-2xl border border-lime-400/25 bg-lime-400/8 p-6 text-center">
              <CheckCircle2 className="mx-auto size-10 text-lime-300" />
              <p className="font-display mt-3 text-lg font-bold">Glad we could help! 🎉</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your conversation was saved as resolved{justResolved === "helpful" ? " and rated helpful" : ""}. You can
                start a new conversation anytime.
              </p>
              <button
                type="button"
                onClick={() => {
                  setJustResolved(null);
                  setMode("ask");
                }}
                className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/5"
              >
                Back to support home
              </button>
            </div>
          )}

          {!justResolved && (
            <div className="rounded-2xl border border-white/10 bg-card">
              {/* Chat transcript */}
              <div className="max-h-[52vh] min-h-[240px] space-y-3 overflow-y-auto p-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "rounded-br-sm bg-lime-400 text-black"
                          : "rounded-bl-sm border border-white/10 bg-black/20 text-white/85"
                      }`}
                    >
                      {m.role === "ai" && (
                        <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-lime-300/70">
                          🤖 AI Assistant
                        </p>
                      )}
                      {m.body}
                      <span className={`mt-1 block text-right text-[10px] ${m.role === "user" ? "text-black/50" : "text-white/25"}`}>
                        {fmtTime(m.at)}
                      </span>
                    </div>
                    {/* Voice replies play automatically — see the engine below.
                        Manual per-message buttons were intentionally removed. */}
                  </div>
                ))}
                {sending && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-lime-400" /> Assistant is thinking…
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* Solve check — only in an active chat */}
              {mode === "chat" && askedSolved && !sending && messages.length > 1 && (
                <div className="border-t border-white/10 bg-lime-400/[0.04] p-3">
                  <p className="mb-2 text-center text-sm font-medium">Did this solve your problem?</p>
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => void markResolved("helpful")}
                      className="rounded-xl bg-lime-400 px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-lime-300"
                    >
                      Yes, my problem is solved
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEscalateForm(true)}
                      className="rounded-xl border border-rose-400/30 px-4 py-2 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-400/10"
                    >
                      No, I still need help
                    </button>
                  </div>
                </div>
              )}

              {/* Escalation panel */}
              {showEscalateForm && sessionId && (
                <div className="border-t border-white/10 p-4">
                  <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
                    <LifeBuoy className="mt-0.5 size-4 shrink-0 text-amber-300" />
                    <p className="text-xs leading-relaxed text-amber-200/80">
                      I'm sorry I couldn't fully resolve this issue. Request support from our team — they'll receive
                      everything we've already discussed, so you won't need to start over.
                    </p>
                  </div>
                  <textarea
                    value={extraDetails}
                    onChange={(e) => setExtraDetails(e.target.value)}
                    rows={3}
                    placeholder="Add any extra details for the support team (optional)…"
                    className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm placeholder:text-white/25 focus:border-lime-400/40 focus:outline-none"
                  />
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEscalateForm(false)}
                      className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/50 hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={escalating}
                      onClick={() => void handleEscalate()}
                      className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-lime-300 disabled:opacity-50"
                    >
                      {escalating ? <Loader2 className="size-4 animate-spin" /> : <HelpCircle className="size-4" />}
                      Request Human Support
                    </button>
                  </div>
                </div>
              )}

              {/* Voice status strip */}
              {sessionId && latest!.status === "active" && voice.phase !== "idle" && (
                <div className="border-t border-white/10 bg-black/20 p-3">
                  {voice.phase === "recording" && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="flex min-w-0 items-center gap-2 text-xs font-medium text-rose-300">
                          <span className="size-2 shrink-0 animate-pulse rounded-full bg-rose-400" />
                          🎙️ Microphone active — speak now (short answers are fine)
                        </p>
                        <VoiceWaveform levelRef={voice.levelRef} active />
                        <button
                          type="button"
                          onClick={voice.stopRecording}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-400/15 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-400/25"
                        >
                          <Square className="size-3" /> Stop &amp; send
                        </button>
                      </div>
                      {!voice.soundDetected && (
                        <p className="text-[11px] text-amber-300/80">
                          No sound detected yet — please check your mic and speak a little louder.
                        </p>
                      )}
                    </div>
                  )}
                  {voice.phase === "transcribing" && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin text-lime-400" /> Transcribing your message…
                      {voice.transcriptPreview && <span className="truncate text-lime-300">“{voice.transcriptPreview}”</span>}
                    </p>
                  )}
                  {voice.phase === "speaking" && (
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-xs font-medium text-lime-300">
                        <Volume2 className="size-4 animate-pulse" /> 🔊 Assistant is speaking…
                      </p>
                      <button
                        type="button"
                        onClick={voice.stopAudio}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/5"
                      >
                        <Square className="size-3" /> Stop audio
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Input / CTAs */}
              <div className="border-t border-white/10 p-3">
                {!sessionId || latest!.status !== "active" ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setMode("ask")}
                      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 text-sm font-medium text-white/70 hover:bg-white/5"
                    >
                      <MessageCircle className="size-4" /> Back to conversations
                    </button>
                    <button
                      type="button"
                      onClick={handleStartNew}
                      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-lime-400 text-sm font-semibold text-black hover:bg-lime-300"
                    >
                      <Sparkles className="size-4" /> Start a new conversation
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSend();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={voice.busy ? "Voice in progress…" : "Describe your issue — type or tap the mic…"}
                      maxLength={1200}
                      disabled={voice.phase === "recording" || voice.phase === "transcribing"}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 text-sm placeholder:text-white/25 focus:border-lime-400/40 focus:outline-none disabled:opacity-50"
                    />
                    {/* Microphone */}
                    <button
                      type="button"
                      onClick={() => {
                        if (voice.phase === "recording") voice.stopRecording();
                        else if (!voice.busy) void voice.startRecording();
                      }}
                      disabled={sending || (voice.busy && voice.phase !== "recording")}
                      aria-label={voice.phase === "recording" ? "Stop recording and send" : "Record a voice message"}
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-40 ${
                        voice.phase === "recording"
                          ? "animate-pulse border-rose-400/50 bg-rose-500/25 text-rose-200"
                          : "border-white/10 bg-black/20 text-white/60 hover:border-lime-400/40 hover:text-lime-300"
                      }`}
                    >
                      {voice.phase === "transcribing" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : voice.phase === "recording" ? (
                        <Square className="size-4" />
                      ) : (
                        <Mic className="size-4" />
                      )}
                    </button>
                    <button
                      type="submit"
                      disabled={sending || !input.trim() || voice.busy}
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-black transition-colors hover:bg-lime-300 disabled:opacity-40"
                      aria-label="Send message"
                    >
                      {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Quick actions */}
          {mode === "chat" && messages.length <= 1 && !sending && (
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={sending}
                  onClick={() => void handleSend(q)}
                  className="rounded-full border border-white/10 bg-card px-3.5 py-1.5 text-xs text-white/60 transition-colors hover:border-lime-400/30 hover:text-lime-300 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Escalated tickets — live threads */}
      {safeTickets.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-white/40">Your support tickets</p>
          {safeTickets.map((t: any) => (
            <TicketCard
              key={t._id}
              ticket={t}
              forceOpen={mode === "thread" && latest?.ticket?._id === t._id && openTicketId === t._id}
              open={openTicketId === t._id}
              onToggle={() => (openTicketId === t._id ? setOpenTicketId(null) : openTicket(t._id))}
              statusBadge={statusBadge}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resume prompt — asks whether to continue a previous conversation
// ---------------------------------------------------------------------------

function ResumeCard({
  latest,
  justResolved,
  onContinue,
  onStartNew,
}: {
  latest: any;
  justResolved: "helpful" | "not_helpful" | null;
  onContinue: () => void;
  onStartNew: () => void;
}) {
  const msgs: AiMessage[] = latest.messages ?? [];
  const lastUserMsg = [...msgs].reverse().find((m) => m.role === "user");
  const ticket = latest.ticket;

  let title = "Continue your previous conversation?";
  let description = lastUserMsg
    ? `You were asking about: "${lastUserMsg.body.slice(0, 120)}${lastUserMsg.body.length > 120 ? "…" : ""}"`
    : "Pick up right where you left off.";

  if (latest.status === "escalated" && ticket) {
    title = "Your issue is with our support team";
    description = `Ticket ${ticket.ticketNumber} · ${ticket.teamLabel}. The full AI conversation was handed over — you can keep chatting with the team there.`;
  } else if (latest.status === "resolved") {
    title = "Your last conversation was resolved";
    description = "Would you like to review it, or start something new?";
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-lime-400/20 bg-card">
      <div className="border-b border-white/10 bg-lime-400/[0.04] p-5">
        <p className="font-display flex items-center gap-2 text-base font-bold">
          <Bot className="size-5 text-lime-300" /> {title}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>

        {latest.status === "escalated" && ticket?.hasUnseenTeamReply && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/8 p-3">
            <span className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full bg-amber-400" />
            <p className="text-xs font-medium text-amber-200">
              👤 A support team member has replied to your ticket — their response is waiting for you.
            </p>
          </div>
        )}
      </div>

      {/* Transcript preview */}
      {msgs.length > 0 && (
        <div className="max-h-40 space-y-2 overflow-y-auto border-b border-white/10 bg-black/20 p-4">
          {msgs.slice(-4).map((m, i) => (
            <p key={i} className={`truncate text-xs ${m.role === "user" ? "text-white/70" : "text-lime-200/60"}`}>
              <span className="mr-1 font-semibold">{m.role === "user" ? "You:" : "🤖 AI:"}</span>
              {m.body}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 p-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onContinue}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors ${
            latest.status === "escalated" && ticket?.hasUnseenTeamReply
              ? "bg-amber-400 text-black hover:bg-amber-300"
              : "bg-lime-400 text-black hover:bg-lime-300"
          }`}
        >
          {latest.status === "escalated" ? (
            <>
              <MessageCircle className="size-4" /> View conversation &amp; replies
            </>
          ) : (
            <>
              <MessageCircle className="size-4" /> Continue conversation
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onStartNew}
          disabled={!!justResolved}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/5 disabled:opacity-40"
        >
          <Sparkles className="size-4" /> Start another conversation
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ticket card with human-support thread (live via reactive query)
// ---------------------------------------------------------------------------

function TicketCard({
  ticket,
  open,
  forceOpen,
  onToggle,
  statusBadge,
}: {
  ticket: any;
  open: boolean;
  forceOpen?: boolean;
  onToggle: () => void;
  statusBadge: (s: string) => string;
}) {
  const isOpen = open || forceOpen;
  const thread = useQuery(
    api.aiSupportData.getTicketThread,
    isOpen ? { ticketId: ticket._id } : "skip",
  );
  const reply = useMutation(api.aiSupportData.replyToMyTicket);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showAiHistory, setShowAiHistory] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) endRef.current?.scrollIntoView({ block: "end" });
  }, [isOpen, thread?.messages.length]);

  const handleReply = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await reply({ ticketId: ticket._id, body: body.trim() });
      setBody("");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send your message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left hover:bg-white/[0.02]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-bold text-lime-300">{ticket.ticketNumber}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(ticket.status)}`}>
              {String(ticket.status).replace(/_/g, " ").toUpperCase()}
            </span>
            <span className="text-[10px] text-white/30">{ticket.category}</span>
          </div>
          <p className="mt-1 truncate text-sm text-white/70">{ticket.subject}</p>
        </div>
        {ticket.hasUnseenTeamReply && (
          <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
            NEW REPLY
          </span>
        )}
        <ChevronDown className={`size-4 shrink-0 text-white/30 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="border-t border-white/10">
          {thread === undefined ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-lime-400" />
            </div>
          ) : (
            <>
              <div className="max-h-72 space-y-3 overflow-y-auto p-4">
                {thread.ticket.aiSummary && (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Issue summary</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/60">{thread.ticket.aiSummary}</p>
                  </div>
                )}

                {thread.messages.map((m: any) => (
                  <div key={m._id} className="flex justify-start">
                    <div className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                        {m.senderType === "system" ? "⚙️ System" : `👤 ${m.senderName ?? "Human Support Team"}`}
                      </p>
                      <p className="text-white/80">{m.body}</p>
                      <span className="mt-1 block text-right text-[10px] text-white/20">{fmtTime(m.createdAt)}</span>
                    </div>
                  </div>
                ))}

                {thread.aiConversation.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAiHistory((v) => !v)}
                      className="text-xs font-medium text-lime-300/80 underline-offset-2 hover:underline"
                    >
                      {showAiHistory ? "Hide" : "Show"} full AI conversation ({thread.aiConversation.length})
                    </button>
                    {showAiHistory && (
                      <div className="mt-2 space-y-2 rounded-xl border border-dashed border-white/10 bg-black/30 p-3">
                        {thread.aiConversation.map((m: any, i: number) => (
                          <p key={i} className={`text-xs leading-relaxed ${m.role === "user" ? "text-white/70" : "text-lime-200/60"}`}>
                            <span className="mr-1 font-semibold">{m.role === "user" ? "You:" : "🤖 AI:"}</span>
                            {m.body}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {ticket.status !== "closed" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleReply();
                  }}
                  className="flex gap-2 border-t border-white/10 p-3"
                >
                  <input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Reply to the support team…"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm placeholder:text-white/25 focus:border-lime-400/40 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !body.trim()}
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-black disabled:opacity-40"
                    aria-label="Send reply"
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
