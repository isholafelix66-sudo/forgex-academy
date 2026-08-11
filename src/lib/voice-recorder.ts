/**
 * Voice recorder for chat voice messages — built on the browser's
 * MediaRecorder API (no libraries, no LiveKit).
 *
 * Format strategy:
 *  - Primary: WebM/Opus (Chrome, Firefox, Edge, Android — small + high
 *    quality).
 *  - Fallback when WebM is unavailable: MP4/AAC (Safari + iOS — and mp4
 *    audio plays everywhere), then Ogg/Opus (older Firefox).
 *
 * The microphone is requested here, inside the user's tap, so permission
 * prompts and iOS audio-activation rules behave correctly. All failures are
 * mapped to clear, user-friendly messages.
 */

export type VoiceRecording = {
  /** Stop recording, finalize the file and release the microphone. */
  stop: () => Promise<{ blob: Blob; mime: string; seconds: number }>;
  /** Discard the recording and release the microphone (no file produced). */
  cancel: () => void;
};

const RECORD_MIME_PREFERENCE = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickRecordingMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return RECORD_MIME_PREFERENCE.find((m) => MediaRecorder.isTypeSupported(m));
}

/** Translate getUserMedia failures into copy users actually understand. */
function friendlyMicError(err: unknown): Error {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return new Error(
      "Microphone access was denied — allow the mic in your browser settings, then try again.",
    );
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return new Error("No microphone was found — connect one and try again.");
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return new Error(
      "Your microphone is busy in another app — close it and try again.",
    );
  }
  if (name === "AbortError") {
    return new Error("Microphone access was cancelled.");
  }
  return new Error("Could not access the microphone — please try again.");
}

/**
 * Start a voice recording. Throws a friendly `Error` when the browser can't
 * record or the microphone is unavailable/denied. The caller drives the
 * recording timer UI and calls `stop()`/`cancel()` on the returned handle.
 */
export async function startVoiceRecording(): Promise<VoiceRecording> {
  if (
    typeof window === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    throw new Error("Voice recording isn't supported in this browser.");
  }
  if (typeof MediaRecorder === "undefined") {
    throw new Error(
      "Voice recording isn't supported in this browser — try Chrome, Safari or Firefox.",
    );
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
  } catch (err) {
    throw friendlyMicError(err);
  }

  const mime = pickRecordingMime();
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error(
      "Could not start recording with this browser — try Chrome, Safari or Firefox.",
    );
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();
  const startedAt = performance.now();

  return {
    stop: () =>
      new Promise<{ blob: Blob; mime: string; seconds: number }>((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const mimeType = recorder.mimeType || "audio/webm";
          resolve({
            blob: new Blob(chunks, { type: mimeType }),
            mime: mimeType,
            seconds: Math.max(
              1,
              Math.round((performance.now() - startedAt) / 1000),
            ),
          });
        };
        try {
          recorder.stop();
        } catch {
          stream.getTracks().forEach((t) => t.stop());
        }
      }),
    cancel: () => {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/** File extension for a recorded MIME type (webm / m4a / ogg / webm default). */
export function voiceFileExtension(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}
