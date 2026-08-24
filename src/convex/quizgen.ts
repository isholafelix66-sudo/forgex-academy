"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { YoutubeTranscript } from "youtube-transcript";
import type { Id } from "./_generated/dataModel";
import type { Question } from "./schema";

function youtubeIdFromUrl(url: string): string | null {
  const m =
    url.match(/youtu\.be\/([\w-]+)/) ||
    url.match(/youtube\.com\/watch\?v=([\w-]+)/) ||
    url.match(/youtube\.com\/embed\/([\w-]+)/);
  return m ? m[1] : null;
}

/** AI provider config — Groq cloud API preferred (OpenAI-compatible endpoint),
 *  falling back to OpenAI or Novita AI. Keys live in the server environment
 *  only, never in the client bundle. */
function aiConfig(): { key: string; base: string; model: string; sttModel: string } {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      key: groqKey,
      base: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
      model:
        process.env.GROQ_MODEL ??
        process.env.OPENAI_MODEL ??
        "openai/gpt-oss-120b",
      sttModel: process.env.OPENAI_STT_MODEL ?? "whisper-large-v3",
    };
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  const novitaKey = process.env.NOVITA_API_KEY;
  const key = openaiKey ?? novitaKey;
  if (!key) {
    throw new Error(
      "AI isn't configured yet — add GROQ_API_KEY (or OPENAI_API_KEY / NOVITA_API_KEY) to your project's environment keys, then try again.",
    );
  }
  if (openaiKey) {
    return {
      key,
      base: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      sttModel: process.env.OPENAI_STT_MODEL ?? "whisper-1",
    };
  }
  return {
    key,
    base: "https://api.novita.ai/v3/openai",
    model: process.env.OPENAI_MODEL ?? "meta-llama/llama-3.1-8b-instruct",
    sttModel: process.env.OPENAI_STT_MODEL ?? "whisper-1",
  };
}

async function requireActiveTutor(ctx: any): Promise<Id<"users">> {
  const userId = (await getAuthUserId(ctx)) as Id<"users"> | null;
  if (userId === null) throw new Error("You must be signed in to do that.");
  const user = await ctx.runQuery(internal.users.internalCurrentUser);
  if (!user) throw new Error("Account not found.");
  if (user.role === "admin") return userId;
  if (user.role !== "tutor" || !user.verified) {
    throw new Error("A verified tutor account is required.");
  }
  return userId;
}

// ---------------------------------------------------------------------------
// LLM plumbing
// ---------------------------------------------------------------------------

async function chat(
  cfg: ReturnType<typeof aiConfig>,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 4000,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("The AI returned an empty response — try again.");
  return content;
}

function parseQuestions(raw: string, want: number): Question[] {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) {
    throw new Error("The AI response couldn't be parsed as questions — try again.");
  }
  const arr = JSON.parse(cleaned.slice(start, end + 1)) as Array<Record<string, unknown>>;
  const questions = arr
    .map((q): Question => {
      const type =
        q.type === "true-false" || q.type === "short-answer"
          ? q.type
          : "multiple-choice";
      const options = Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : [];
      return {
        type,
        question: String(q.question ?? "").trim(),
        options: type === "multiple-choice" ? options : undefined,
        answer: String(q.answer ?? "").trim(),
        points: 1,
        explanation: q.explanation ? String(q.explanation).trim() : undefined,
      };
    })
    .filter(
      (q) =>
        q.question.length > 0 &&
        !!q.answer &&
        q.answer.length > 0 &&
        (q.type !== "multiple-choice" || (q.options?.length ?? 0) >= 2),
    );
  if (questions.length === 0) {
    throw new Error("The AI returned no usable questions — try again.");
  }
  return questions.slice(0, want);
}

// ---------------------------------------------------------------------------
// Question generation (draft only — never published automatically)
// ---------------------------------------------------------------------------

export const generateQuizQuestions = action({
  args: {
    courseId: v.id("courses"),
    scope: v.union(v.literal("lesson"), v.literal("course")),
    lessonId: v.optional(v.id("lessons")),
    count: v.optional(v.number()),
  },
  handler: async (ctx, { courseId, scope, lessonId, count }) => {
    const userId = await requireActiveTutor(ctx);
    const cfg = aiConfig();
    const want = Math.min(15, Math.max(1, Math.round(count ?? 5)));

    // Gather content STRICTLY from the course material — never the model's
    // own knowledge.
    let content = "";
    let source = "";
    if (scope === "lesson" && lessonId) {
      const { course, lesson } = await ctx.runQuery(
        internal.quizgenInternal.getLessonContent,
        { courseId, lessonId, userId },
      );
      const ytId = youtubeIdFromUrl(lesson.videoUrl ?? "");
      if (ytId) {
        try {
          const t = await YoutubeTranscript.fetchTranscript(ytId);
          content = t.map((x) => x.text).join(" ");
          source = "YouTube transcript";
        } catch {
          content = "";
        }
      }
      if (!content && lesson.transcript.trim()) {
        content = lesson.transcript;
        source = "lesson transcript";
      }
      if (!content && lesson.notes.trim()) {
        content = lesson.notes;
        source = "lesson notes";
      }
      if (!content) {
        throw new Error(
          "No transcript is available for this lesson. Paste the lesson notes or a transcript (or add a YouTube video with captions), then generate again.",
        );
      }
      content = `Course: ${course.title}\nLesson: ${lesson.title}\n\n${content}`;
    } else {
      const { course, lessons } = await ctx.runQuery(
        internal.quizgenInternal.getCourseContent,
        { courseId, userId },
      );
      const parts = lessons
        .map((l) => {
          const ytId = youtubeIdFromUrl(l.videoUrl ?? "");
          let text = "";
          if (l.transcript.trim()) text += `\n${l.transcript}`;
          if (l.notes.trim()) text += `\n${l.notes}`;
          return `[Lesson ${l.order}: ${l.title}]${text}`;
        })
        .join("\n\n");
      if (!parts.trim()) {
        throw new Error(
          "None of the lessons have a transcript or notes yet. Add transcripts/notes (or YouTube videos with captions) to generate exam questions from the course.",
        );
      }
      content = `Course: ${course.title}\n${course.longDescription || course.description}\nSkills: ${course.skills.join(", ")}\n\n${parts}`;
      source = "all course lessons";
    }

    const system =
      "You write quiz questions for a course. Generate questions STRICTLY from the provided lesson content — never introduce facts from outside the content. Each question must be answerable from the content alone. Prefer multiple-choice; include a few true/false when the content supports it. Return ONLY a JSON array, no prose, with this exact shape: [{\"type\":\"multiple-choice\"|\"true-false\",\"question\":\"...\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"answer\":\"<exact option text>\",\"explanation\":\"<1-2 sentence explanation from the content>\"}]. For true-false questions use options [\"True\",\"False\"] and answer \"True\" or \"False\". Do not use outside knowledge.";
    const user = `Lesson content:\n${content.slice(0, 16000)}\n\nGenerate ${want} questions as a JSON array.`;

    const raw = await chat(cfg, system, user);
    const questions = parseQuestions(raw, want);
    return { source, questions };
  },
});

/** Speech-to-text for uploaded videos (MP4/Mux). Returns the raw transcript —
 *  the tutor reviews and saves it, it is never published automatically. */
export const transcribeVideo = action({
  args: {
    courseId: v.id("courses"),
    lessonId: v.optional(v.id("lessons")),
    url: v.string(),
  },
  handler: async (ctx, { courseId, lessonId, url }) => {
    const userId = await requireActiveTutor(ctx);
    const cfg = aiConfig();
    // Verify the tutor owns the course (a saved lesson isn't required — the
    // tutor may transcribe before saving the lesson).
    await ctx.runQuery(internal.quizgenInternal.getCourseContent, {
      courseId,
      userId,
    });
    if (lessonId) {
      await ctx.runQuery(internal.quizgenInternal.getLessonContent, {
        courseId,
        lessonId,
        userId,
      });
    }

    const videoRes = await fetch(url);
    if (!videoRes.ok) {
      throw new Error(`Could not download the video (${videoRes.status}).`);
    }
    const buf = await videoRes.arrayBuffer();
    if (buf.byteLength > 60 * 1024 * 1024) {
      throw new Error("Video is too large to transcribe (max 60 MB).");
    }

    const form = new FormData();
    form.append("file", new Blob([buf], { type: "video/mp4" }), "lesson.mp4");
    form.append("model", cfg.sttModel);
    const res = await fetch(`${cfg.base}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}` },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Speech-to-text failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const json = await res.json();
    const text = String(json?.text ?? "").trim();
    if (!text) throw new Error("The transcription came back empty — try again.");
    return { text };
  },
});
