"use node";

/**
 * ForgeX AI Support — Voice actions.
 *
 * Speech-to-Text and Text-to-Speech backed by the Groq API (OpenAI-compatible
 * endpoints). The GROQ_API_KEY never leaves the server: the browser records
 * audio, this action transcribes it, and spoken replies are synthesized here
 * and returned as base64 audio for the client to play locally.
 *
 * Privacy: recordings are transcribed in-memory and NEVER persisted.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ---------------------------------------------------------------------------
// Provider config — mirrors aiSupport.ts / quizgen.ts priority order
// ---------------------------------------------------------------------------

function voiceConfig(): { key: string; base: string; sttModel: string; ttsModel: string; ttsVoice: string } {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      key: groqKey,
      base: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
      sttModel: process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo",
      ttsModel: process.env.GROQ_TTS_MODEL ?? "canopylabs/orpheus-v1-english",
      // Valid Orpheus voices: autumn | diana | hannah | austin | daniel | troy
      ttsVoice: process.env.GROQ_TTS_VOICE ?? "autumn",
    };
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      key: openaiKey,
      base: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      sttModel: process.env.OPENAI_STT_MODEL ?? "whisper-1",
      ttsModel: process.env.OPENAI_TTS_MODEL ?? "tts-1",
      ttsVoice: process.env.OPENAI_TTS_VOICE ?? "nova",
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
    } catch {
      throw new Error("Network problem while reaching the transcription service. Check your connection and try again.");
    }
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`Speech-to-text failed (${res.status}): ${detail}`);
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
// Text-to-Speech
// ---------------------------------------------------------------------------

const ORPHEUS_VOICES = new Set(["autumn", "diana", "hannah", "austin", "daniel", "troy"]);
const MAX_TTS_CHUNK_CHARS = 800;

/** Split long text into sentence-boundary chunks within provider limits. */
function splitForTts(text: string): string[] {
  if (text.length <= MAX_TTS_CHUNK_CHARS) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > MAX_TTS_CHUNK_CHARS) {
    let cut = -1;
    for (const sep of [". ", "! ", "? ", "\n", "; ", ", "]) {
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

async function ttsRequest(cfg: ReturnType<typeof voiceConfig>, input: string): Promise<Buffer> {
  let res: Response;
  try {
    res = await fetch(`${cfg.base}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.ttsModel,
        voice: ORPHEUS_VOICES.has(cfg.ttsVoice) ? cfg.ttsVoice : "autumn",
        input,
        response_format: "wav",
      }),
    });
  } catch (err: any) {
    console.error("[aiVoice.speakText] network error reaching TTS API:", err?.message ?? err);
    throw new Error("network");
  }
  if (!res.ok) {
    const detail = await res.text();
    // Detailed technical errors go to SERVER LOGS ONLY — never to clients.
    console.error(`[aiVoice.speakText] TTS ${res.status} (${cfg.ttsModel}/${cfg.ttsVoice}):`, detail.slice(0, 500));
    throw new Error(`tts-${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export const speakText = action({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    // Only completely empty text is rejected — single words are fine.
    const cleaned = args.text.trim();
    if (!cleaned) {
      console.error("[aiVoice.speakText] rejected empty text");
      throw new Error("Nothing to read aloud.");
    }

    const speechText =
      cleaned
        .replace(/```[\s\S]*?```/g, " code block omitted. ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_#`>~]/g, "")
        .replace(/\s+/g, " ") || "Sorry, I have nothing to say.";

    const cfg = voiceConfig();
    const chunks = splitForTts(speechText);

    try {
      // Generate ALL chunks before returning so playback never starts on a
      // request that will fail halfway through.
      const parts: Array<{ audioBase64: string }> = [];
      for (const chunk of chunks) {
        const buf = await ttsRequest(cfg, chunk);
        parts.push({ audioBase64: buf.toString("base64") });
      }
      return { chunks: parts, mimeType: "audio/wav" };
    } catch (err: any) {
      console.error("[aiVoice.speakText] final failure:", err?.message ?? err);
      // Client receives a stable non-technical message only.
      throw new Error("Audio couldn't be played. Please try again.");
    }
  },
});

