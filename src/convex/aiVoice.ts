"use node";

/**
 * ForgeX AI Support — Voice actions.
 *
 * Speech-to-Text: Groq Whisper (recordings transcribed in-memory, never stored).
 * Text-to-Speech: GOOGLE GEMINI TTS — a dedicated speech provider, fully
 * separate from the AI text generation (which stays on Groq in aiSupport.ts).
 *
 * Architecture: existing AI generates the text → this action converts that
 * exact text to speech via Gemini → audio is stored as a Convex file and
 * played automatically by the client. The GEMINI/GROQ keys never leave the
 * server.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ---------------------------------------------------------------------------
// Provider config — mirrors aiSupport.ts / quizgen.ts priority order
// ---------------------------------------------------------------------------

function voiceConfig(): { key: string; base: string; sttModel: string } {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      key: groqKey,
      base: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
      sttModel: process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo",
    };
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      key: openaiKey,
      base: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      sttModel: process.env.OPENAI_STT_MODEL ?? "whisper-1",
    };
  }
  throw new Error(
    "Voice isn't configured yet — add GROQ_API_KEY (or OPENAI_API_KEY) to your project's environment keys.",
  );
}

async function requireUser(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("You must be signed in to use voice support.");
}

// ---------------------------------------------------------------------------
// Speech-to-Text
// ---------------------------------------------------------------------------

const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // ~15MB ≈ several minutes of webm audio

/** Transcribe a recorded voice message. Audio is never stored. */
export const transcribeVoice = action({
  args: {
    audioBase64: v.string(),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const base64 = args.audioBase64.includes(",")
      ? args.audioBase64.slice(args.audioBase64.indexOf(",") + 1)
      : args.audioBase64;
    const buf = Buffer.from(base64, "base64");
    if (buf.length === 0) throw new Error("No audio was received — please try recording again.");
    if (buf.length > MAX_AUDIO_BYTES) throw new Error("Recording too long — please keep voice messages under ~2 minutes.");

    const cfg = voiceConfig();
    const mime = args.mimeType || "audio/webm";
    const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : mime.includes("wav") ? "wav" : "webm";

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)], { type: mime }), `voice.${ext}`);
    form.append("model", cfg.sttModel);
    form.append("response_format", "json");
    form.append("temperature", "0");

    let res: Response;
    try {
      res = await fetch(`${cfg.base}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.key}` },
        body: form,
      });
    } catch (err: any) {
      console.error("[aiVoice.transcribeVoice] network error:", err?.message ?? err);
      throw new Error("Network problem while reaching the transcription service. Check your connection and try again.");
    }
    if (!res.ok) {
      const detail = await res.text();
      // Technical details go to SERVER LOGS ONLY.
      console.error(`[aiVoice.transcribeVoice] STT ${res.status} (${cfg.sttModel}):`, detail.slice(0, 500));
      throw new Error("Transcription failed on our side. Please try again, or type your message instead.");
    }
    // Speech validation happens here: short clips (even a single word) are
    // accepted — only audio where Whisper detects no actual speech is rejected.
    const json = (await res.json()) as { text?: string };
    const text = (json.text ?? "").trim();
    if (!text) {
      throw new Error(
        "No speech was detected in that recording. Please try speaking a bit closer to the microphone, or type your message instead.",
      );
    }
    return { text };
  },
});


// ---------------------------------------------------------------------------
// Text-to-Speech — GOOGLE GEMINI (dedicated speech provider)
//
// Architecture notes:
//  - Gemini returns raw headerless PCM (24 kHz, 16-bit, mono). We wrap it in
//    a proper WAV header server-side before storing.
//  - Convex caps function RETURN values (~1MB), so: ONE chunk per call,
//    delivered as a Convex STORAGE FILE URL instead of inline base64.
//  - We try the modern Interactions API first and fall back to the legacy
//    generateContent TTS endpoint — both are parsed defensively.
// ---------------------------------------------------------------------------

const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-3.1-flash-tts-preview";
const GEMINI_TTS_FALLBACK_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_TTS_VOICE = process.env.GEMINI_TTS_VOICE ?? "Kore";
// Gemini handles long input well; ~1000 chars ≈ 60 s of audio per request
// keeps responses fast and comfortably inside provider limits.
const MAX_TTS_CHUNK_CHARS = 1000;

function geminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) {
    console.error("[aiVoice.speakText] GEMINI_API_KEY is not set — add it to your project's environment keys.");
    throw new Error("Voice replies aren't configured yet. Please try again later.");
  }
  return key;
}

/** Wrap raw headerless PCM into a playable WAV container. */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Split long text at sentence/paragraph boundaries within limits. */
function splitForTts(text: string): string[] {
  if (text.length <= MAX_TTS_CHUNK_CHARS) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > MAX_TTS_CHUNK_CHARS) {
    let cut = -1;
    for (const sep of ["\n\n", ". ", "! ", "? ", "\n", "; ", ", "]) {
      const idx = rest.lastIndexOf(sep, MAX_TTS_CHUNK_CHARS);
      if (idx > MAX_TTS_CHUNK_CHARS * 0.4) {
        cut = idx + sep.length;
        break;
      }
    }
    if (cut <= 0) cut = MAX_TTS_CHUNK_CHARS;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter((c) => c.length > 0);
}

/** Deep-search a JSON response for the base64 audio payload + sample rate. */
function extractAudio(json: unknown): { pcm: Buffer; sampleRate: number } | null {
  const seen = new Set<unknown>();
  const visit = (node: any): { pcm: Buffer; sampleRate: number } | null => {
    if (!node || typeof node !== "object" || seen.has(node)) return null;
    seen.add(node);
    if (typeof node.data === "string" && node.data.length > 100) {
      const mime = typeof node.mimeType === "string" ? node.mimeType : "";
      if (/audio|pcm|L16/i.test(mime) || !mime) {
        const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
        return { pcm: Buffer.from(node.data, "base64"), sampleRate: rate };
      }
    }
    for (const v of Object.values(node)) {
      const found = visit(v);
      if (found) return found;
    }
    return null;
  };
  return visit(json);
}

/** Call Gemini TTS via one endpoint shape; returns decoded PCM or null. */
async function geminiTtsAttempt(
  key: string,
  input: string,
): Promise<{ pcm: Buffer; sampleRate: number } | null> {
  // Attempt 1 — Interactions API (current recommended surface).
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_TTS_MODEL,
        input,
        response_format: { type: "audio" },
        generation_config: { speech_config: [{ voice: GEMINI_TTS_VOICE }] },
      }),
    });
    if (res.ok) {
      const audio = extractAudio(await res.json());
      if (audio && audio.pcm.length > 100) return audio;
      console.error("[aiVoice.speakText] interactions OK but no audio payload found");
    } else {
      console.error(`[aiVoice.speakText] interactions ${res.status}:`, (await res.text()).slice(0, 400));
    }
  } catch (err: any) {
    console.error("[aiVoice.speakText] interactions network error:", err?.message ?? err);
  }

  // Attempt 2 — legacy generateContent TTS endpoint.
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_FALLBACK_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: input }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE } } },
        },
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text();
    // Technical detail: SERVER LOGS ONLY.
    console.error(`[aiVoice.speakText] legacy TTS ${res.status} (${GEMINI_TTS_FALLBACK_MODEL}/${GEMINI_TTS_VOICE}):`, detail.slice(0, 400));
    throw new Error(`tts-${res.status}`);
  }
  const audio = extractAudio(await res.json());
  if (!audio || audio.pcm.length < 100) {
    console.error("[aiVoice.speakText] legacy TTS returned no usable audio payload");
    throw new Error("tts-empty");
  }
  return audio;
}

async function ttsRequest(input: string): Promise<Buffer> {
  const key = geminiApiKey();
  const audio = await geminiTtsAttempt(key, input);
  if (!audio) throw new Error("tts-empty");
  return pcmToWav(audio.pcm, audio.sampleRate);
}

export const speakText = action({
  args: { text: v.string(), chunkIndex: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    // Only completely empty text is rejected — single words like "Hi." are fine.
    const cleaned = args.text.trim();
    if (!cleaned) {
      console.error("[aiVoice.speakText] rejected empty text");
      throw new Error("Nothing to read aloud.");
    }

    // Markdown → natural spoken text before synthesis.
    const speechText =
      cleaned
        .replace(/```[\s\S]*?```/g, " code block omitted. ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_#`>~]/g, "")
        .replace(/\s+/g, " ") || "Sorry, I have nothing to say.";

    const chunks = splitForTts(speechText);
    const index = Math.max(0, Math.min(args.chunkIndex ?? 0, chunks.length - 1));

    try {
      const buf = await ttsRequest(chunks[index]);
      // Store as a Convex file — served back as an https URL with no function-
      // return size limit. This is what makes LONG replies work reliably.
      const storageId = await ctx.storage.store(
        new Blob([new Uint8Array(buf)], { type: "audio/wav" }),
      );
      return { storageId, chunkCount: chunks.length, chunkIndex: index };
    } catch (err: any) {
      console.error("[aiVoice.speakText] final failure:", err?.message ?? err);
      // Client receives a stable non-technical message only.
      throw new Error("Audio couldn't be played. Please try again.");
    }
  },
});

