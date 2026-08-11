/**
 * Voice recorder for chat voice messages — built on the browser's
 * MediaRecorder API (no libraries, no LiveKit).
 *
 * Format strategy (goal: the note plays on EVERY device — iPhone, Android,
 * Windows, Mac, all browsers):
 *  - Prefer MP4/AAC (Safari + iOS + Android + Chrome macOS — AAC plays
 *    everywhere), then WebM/Opus (Chrome Windows / Android, Firefox, Edge),
 *    then Ogg/Opus (older Firefox).
 *  - WebM/Opus and Ogg/Opus cannot be decoded by iOS Safari. So when the
 *    captured format is webm or ogg, the audio is re-encoded client-side to
 *    16-bit PCM WAV (via the Web Audio API) before upload — WAV is playable
 *    on every device since the 1990s. MP4/AAC notes are uploaded as-is.
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

// AAC first: it plays on every device. WebM/Opus only where it's the only
// option — those notes get transcoded to WAV before upload anyway.
const RECORD_MIME_PREFERENCE = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
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

/** 16-bit PCM mono WAV — plays on absolutely every device. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Decode a webm/ogg blob and return it as 16-bit PCM WAV (mono). */
async function transcodeToWav(blob: Blob): Promise<Blob> {
  type AudioCtor = typeof AudioContext;
  const AC: AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: AudioCtor }).webkitAudioContext;
  if (!AC) throw new Error("Audio conversion isn't supported in this browser.");
  const ctx = new AC();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const length = audioBuffer.length;
    const data = new Float32Array(length);
    const channels = audioBuffer.numberOfChannels;
    for (let c = 0; c < channels; c++) {
      const ch = audioBuffer.getChannelData(c);
      for (let i = 0; i < length; i++) data[i] += ch[i] / channels;
    }
    return encodeWav(data, audioBuffer.sampleRate);
  } finally {
    try {
      await ctx.close();
    } catch {
      /* already closed */
    }
  }
}

/**
 * Start a voice recording. Throws a friendly `Error` when the browser can't
 * record or the microphone is unavailable/denied. The caller drives the
 * recording timer UI and calls `stop()`/`cancel()` on the returned handle.
 *
 * `stop()` may take a moment longer when transcoding webm/ogg → WAV; the
 * final blob is guaranteed to play on every device.
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
  // Timeslice keeps data flowing continuously (some browsers only emit one
  // chunk at stop, and a few emit nothing for very short recordings).
  recorder.start(250);
  const startedAt = performance.now();

  return {
    stop: () =>
      new Promise<{ blob: Blob; mime: string; seconds: number }>(
        (resolve, reject) => {
          recorder.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            const mimeType = recorder.mimeType || "audio/webm";
            const seconds = Math.max(
              1,
              Math.round((performance.now() - startedAt) / 1000),
            );
            let blob = new Blob(chunks, { type: mimeType });
            let finalMime = mimeType;
            // WebM/Opus and Ogg/Opus can't be decoded by iOS Safari. Re-encode
            // to WAV so the note plays on every device.
            if (
              (mimeType.includes("webm") || mimeType.includes("ogg")) &&
              blob.size > 0
            ) {
              try {
                blob = await transcodeToWav(blob);
                finalMime = "audio/wav";
              } catch (err) {
                // Keep the original if transcoding fails — it still plays on
                // the device that recorded it.
                console.error("[ForgeX] webm→wav transcode failed:", err);
              }
            }
            resolve({ blob, mime: finalMime, seconds });
          };
          try {
            recorder.stop();
          } catch (err) {
            stream.getTracks().forEach((t) => t.stop());
            reject(err);
          }
        },
      ),
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

/** File extension for a recorded MIME type (wav / m4a / ogg / webm default). */
export function voiceFileExtension(mime: string): string {
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}
