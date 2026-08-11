/**
 * Universal voice recorder.
 *
 * Why WAV? iOS Safari cannot decode the webm/opus audio that Chrome/Android
 * record with MediaRecorder, so a MediaRecorder-based voice note only played
 * on the device that recorded it. A 16-bit PCM WAV recorded through the Web
 * Audio API (ScriptProcessorNode) plays on EVERY browser — iPhone, Android,
 * PC, Safari — since the dawn of time.
 *
 * Trade-off: WAV is uncompressed (~5 MB/min mono). Voice notes are capped at
 * 60 s, so the largest note is ~5 MB — well under the chat's 25 MB limit.
 *
 * If Web Audio is somehow unavailable, we fall back to MediaRecorder with
 * mp4 (AAC) preferred, which Safari and modern Chrome both support.
 */

export type VoiceRecording = {
  /** Stop recording, encode the file and release the mic. */
  stop: () => Promise<{ blob: Blob; mime: string; seconds: number }>;
  /** Discard the recording and release the mic (no file produced). */
  cancel: () => void;
};

/**
 * Start recording. Requests the microphone (throws NotAllowedError when the
 * user denies it) and returns a handle to stop/cancel. The caller is
 * responsible for the recording timer UI.
 */
export async function startVoiceRecording(): Promise<VoiceRecording> {
  if (
    typeof window === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    throw new Error("Voice recording isn't supported in this browser.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  try {
    return startWavRecording(stream);
  } catch {
    try {
      return startMediaRecorderRecording(stream);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Primary path: Web Audio → 16-bit PCM WAV (plays on every device)
// ---------------------------------------------------------------------------

function getAudioCtor(): typeof AudioContext | null {
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  return AC ?? null;
}

function startWavRecording(stream: MediaStream): VoiceRecording {
  const AC = getAudioCtor();
  if (!AC || typeof AC.prototype.createScriptProcessor !== "function") {
    throw new Error("Web Audio unavailable");
  }
  const ctx = new AC();
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let totalSamples = 0;

  processor.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    const copy = new Float32Array(data.length);
    copy.set(data);
    chunks.push(copy);
    totalSamples += data.length;
  };

  source.connect(processor);
  // ScriptProcessor only fires on iOS when its output is connected too.
  processor.connect(ctx.destination);
  // Created inside the user gesture (mic tap) — start it if the browser left
  // it suspended, so the recording actually captures audio on iOS.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});

  const startedAt = performance.now();

  const release = () => {
    try {
      processor.disconnect();
      source.disconnect();
    } catch {
      /* already disconnected */
    }
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
  };

  return {
    stop: () => {
      const seconds = Math.max(
        1,
        Math.round((performance.now() - startedAt) / 1000),
      );
      const blob = encodeWav(chunks, totalSamples, ctx.sampleRate);
      release();
      return Promise.resolve({ blob, mime: "audio/wav", seconds });
    },
    cancel: () => {
      release();
    },
  };
}

/** Encode the captured PCM into a 16-bit mono WAV blob. */
function encodeWav(
  chunks: Float32Array[],
  totalSamples: number,
  sampleRate: number,
): Blob {
  const total = Math.max(1, totalSamples);
  const data = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    data.set(c, offset);
    offset += c.length;
  }

  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + total * bytesPerSample);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + total * bytesPerSample, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, total * bytesPerSample, true);

  let p = 44;
  for (let i = 0; i < total; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    p += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

// ---------------------------------------------------------------------------
// Fallback: MediaRecorder (mp4/AAC preferred — plays on Safari too)
// ---------------------------------------------------------------------------

function pickMediaMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

function startMediaRecorderRecording(stream: MediaStream): VoiceRecording {
  const Ctor = window.MediaRecorder;
  if (!Ctor) throw new Error("No media recorder available");
  const mime = pickMediaMime();
  const recorder = new Ctor(stream, mime ? { mimeType: mime } : undefined);
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
