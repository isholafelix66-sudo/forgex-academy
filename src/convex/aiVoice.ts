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
      ttsVoice: process.env.GROQ_TTS_VOICE ?? "tara",
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
    if (buf.length < 800) throw new Error("That recording was too short or silent. Please try again.");
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
    const json = (await res.json()) as { text?: string };
    const text = (json.text ?? "").trim();
    if (!text) throw new Error("We couldn't hear any clear speech in that recording. Try again or type your message.");
    return { text };
  },
});

// ---------------------------------------------------------------------------
// Text-to-Speech
// ---------------------------------------------------------------------------

export const speakText = action({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const cleaned =
      args.text
        .replace(/```[\s\S]*?```/g, " code block omitted. ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_#`>~]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 900) || "Sorry, I have nothing to say.";

    const cfg = voiceConfig();
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
          voice: cfg.ttsVoice,
          input: cleaned,
          response_format: "wav",
        }),
      });
    } catch {
      throw new Error("Network problem while generating the voice reply.");
    }
    if (!res.ok) {
      const detail = await res.text();
      if (detail.includes("terms acceptance")) {
        throw new Error(
          "Voice replies need a one-time setup: an admin of your Groq organization must open https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english and accept the model terms once.",
        );
      }
      throw new Error(`Text-to-speech failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    const audioBuf = Buffer.from(await res.arrayBuffer());
    return { audioBase64: audioBuf.toString("base64"), mimeType: "audio/wav" };
  },
});

