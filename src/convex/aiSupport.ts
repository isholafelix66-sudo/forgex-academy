"use node";

/**
 * ForgeX AI Support Assistant — LLM actions.
 *
 * The AI is the first line of support: it answers from the approved knowledge
 * base, asks clarifying questions when an issue is unclear, and escalates a
 * complete conversation snapshot to the right human team when it cannot help.
 *
 * Safety rules enforced in the system prompt AND in code:
 *  - The knowledge base is the primary source of truth.
 *  - Never invent platform features or claim actions were completed.
 *  - Always offer human escalation — never block it.
 *  - Say clearly when uncertain.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// AI provider config (same pattern as quizgen.ts)
// ---------------------------------------------------------------------------

function aiConfig(): { key: string; base: string; model: string } {
  // Preferred: Groq cloud API (OpenAI-compatible endpoint).
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      key: groqKey,
      base: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
      model:
        process.env.GROQ_MODEL ??
        process.env.OPENAI_MODEL ??
        "openai/gpt-oss-120b",
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
    };
  }
  return {
    key,
    base: "https://api.novita.ai/v3/openai",
    model: process.env.OPENAI_MODEL ?? "meta-llama/llama-3.1-8b-instruct",
  };
}

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

async function chatCompletion(cfg: ReturnType<typeof aiConfig>, messages: ChatMsg[]): Promise<string> {
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: 0.3,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("The AI returned an empty response — try again.");
  return content.trim();
}

// ---------------------------------------------------------------------------
// Routing helpers
// ---------------------------------------------------------------------------

const KB_CATEGORIES = [
  "student-support",
  "tutor-support",
  "course-management",
  "platform-features",
  "technical",
  "account",
  "community",
  "ai-hub",
  "general",
] as const;

/** Category + user role → responsible human team. */
function routeTeam(userRole: string, category: string): string {
  if (category === "course-management" || category === "academic") return "academic";
  if (category === "ai-hub") return "ai-support";
  if (category === "tutor-support") return "tutor-support";
  if (category === "account" || category === "community" || category === "technical") return "admin";
  if (userRole === "tutor") return "tutor-support";
  return "student-support";
}

/** Lightweight keyword classifier — fast local signal used for routing even
 *  when the LLM also classifies, and as a full fallback without an API key. */
function classifyKeywords(text: string, userRole: string): string {
  const t = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));
  if (has("tutor", "payout", "my course upload", "tutor dashboard")) return "tutor-support";
  if (has("can't access my course", "cannot access my course", "course access", "enroll", "enrolled")) return "student-support";
  if (has("password", "login", "log in", "sign in", "account", "email change")) return "account";
  if (has("error", "bug", "crash", "not loading", "broken", "upload fails")) return "technical";
  if (has("quiz question wrong", "content is wrong", "typo in", "curriculum", "lesson quality")) return "course-management";
  if (has("community", "harassment", "report user")) return "community";
  if (has("ai hub", "prompt library", "ai tool")) return "ai-hub";
  if (userRole === "tutor") return "tutor-support";
  return "general";
}

function buildLocalSummary(
  session: { messages: Array<{ role: string; body: string }>; userRole: string },
  extra?: string,
): string {
  const userMsgs = session.messages.filter((m) => m.role === "user").map((m) => m.body);
  const aiSteps = session.messages
    .filter((m) => m.role === "ai")
    .map((m) => m.body.split("\n").slice(0, 3).join(" "));
  return [
    `The user (${session.userRole}) reported: ${userMsgs[0] ?? "an issue"}.`,
    userMsgs.length > 1 ? `They also added: ${userMsgs.slice(1).join("; ")}.` : "",
    aiSteps.length ? `The AI assistant already shared these steps: ${aiSteps.join(" | ")}` : "",
    extra ? `Additional details from the user: ${extra}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

const SYSTEM_PROMPT = `You are the ForgeX Academy Support Assistant 🤖 — the first line of support for ForgeX Academy, an online learning platform with students, tutors, courses, quizzes, certificates, a community, and an AI Hub.

STRICT RULES (never break these):
1. Your PRIMARY source of truth is the APPROVED KNOWLEDGE BASE provided below. If the answer is in it, follow its steps closely.
2. NEVER invent platform features, pages, buttons, or settings that do not exist.
3. NEVER claim you completed an action (refunds, password resets, enrollment fixes). You cannot take actions on accounts — humans do that.
4. If the issue is unclear, ask ONE short clarifying question before answering.
5. If you are not confident or the knowledge base doesn't cover it, say so honestly and recommend requesting human support.
6. NEVER discourage or block the user from reaching human support — escalation is always allowed.
7. Avoid misleading technical instructions. Prefer simple, safe steps (refresh, re-login, check enrollment, correct browser).
8. Keep answers clear and step-by-step. Use numbered steps when giving instructions. Be friendly but concise (max ~180 words).

FORMAT: Reply with plain helpful text. End with a short line offering further help or escalation if you're unsure.`;

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireUser(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("You must be signed in to use support.");
  const user = await ctx.runQuery(internal.users.internalCurrentUser);
  if (!user) throw new Error("Account not found.");
  return {
    userId: userId as Id<"users">,
    role: (user.role as string) ?? "student",
  };
}

// ---------------------------------------------------------------------------
// Knowledge-base retrieval
// ---------------------------------------------------------------------------

type KbEntry = { _id: Id<"aiKnowledgeBase">; title: string; category: string; keywords?: string[]; content: string };

function scoreEntry(entry: KbEntry, text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of entry.keywords ?? []) {
    const k = kw.toLowerCase().trim();
    if (k.length > 2 && lower.includes(k)) score += 3;
  }
  for (const word of entry.title.toLowerCase().split(/\W+/)) {
    if (word.length > 3 && lower.includes(word)) score += 1;
  }
  return score;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const ESCALATION_OFFER =
  "I'm sorry I couldn't fully resolve this issue. You can request support from our team, and they will receive the details of everything we have already discussed so you won't need to start over.";

export const sendAiMessage = action({
  args: { sessionId: v.id("aiSupportSessions"), text: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx);
    const session = (await ctx.runQuery(internal.aiSupportData.internalGetSession, {
      sessionId: args.sessionId,
    })) as any;
    if (!session) throw new Error("Support session not found.");
    if (session.userId !== userId) throw new Error("Not your session.");
    if (session.status !== "active") throw new Error("This session has ended — start a new one.");

    const cleanText = args.text.trim();
    if (!cleanText) throw new Error("Please describe your issue first.");

    // Retrieve top KB matches for grounding.
    const kb = (await ctx.runQuery(internal.aiSupportData.internalListEnabledKb, {})) as KbEntry[];
    const scored = kb
      .map((entry) => ({ entry, score: scoreEntry(entry, cleanText) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const kbContext = scored.length
      ? scored.map((s, i) => `[${i + 1}] (${s.entry.category}) ${s.entry.title}\n${s.entry.content}`).join("\n\n")
      : "(No directly matching knowledge base articles. Be honest about this and recommend human support if unsure.)";

    const history: ChatMsg[] = session.messages.slice(-12).map((m: any) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.body,
    }));

    let reply: string;
    try {
      reply = await chatCompletion(aiConfig(), [
        { role: "system", content: `${SYSTEM_PROMPT}\n\nAPPROVED KNOWLEDGE BASE:\n${kbContext}` },
        ...history,
        { role: "user", content: cleanText },
      ]);
    } catch {
      // Graceful degradation: answer from the best KB match without the LLM.
      const best = scored[0]?.entry;
      reply = best
        ? `Here's what our knowledge base says about "${best.title}":\n\n${best.content}\n\nIf this doesn't solve your issue, you can request human support below.`
        : `${ESCALATION_OFFER}`;
    }

    const suggestedCategory = classifyKeywords(cleanText, session.userRole);

    await ctx.runMutation(internal.aiSupportData.internalAppendMessages, {
      sessionId: args.sessionId,
      userMessage: cleanText,
      aiReply: reply,
      suggestedCategory,
      usedKbIds: scored.map((s) => s.entry._id),
    });

    return { reply, hasMatches: scored.length > 0 };
  },
});

export const escalateToHuman = action({
  args: { sessionId: v.id("aiSupportSessions"), additionalDetails: v.optional(v.string()) },
  handler: async (ctx, args): Promise<string> => {
    const { userId, role } = await requireUser(ctx);
    const session = (await ctx.runQuery(internal.aiSupportData.internalGetSession, {
      sessionId: args.sessionId,
    })) as any;
    if (!session) throw new Error("Session not found.");
    if (session.userId !== userId) throw new Error("Not your session.");

    // Idempotent: already escalated → return existing ticket number.
    const existing = (await ctx.runQuery(internal.aiSupportData.internalTicketBySession, {
      sessionId: args.sessionId,
    })) as { ticketNumber: string } | null;
    if (existing && session.status === "escalated") return existing.ticketNumber;

    const lastUserMsg =
      [...session.messages].reverse().find((m) => m.role === "user")?.body ?? "Support requested";

    let category = classifyKeywords(lastUserMsg, session.userRole);
    let subject = lastUserMsg.slice(0, 90);
    let summary = buildLocalSummary(session, args.additionalDetails);

    try {
      const transcript = session.messages
        .map((m: any) => `${m.role === "user" ? "USER" : "AI"}: ${m.body}`)
        .join("\n")
        .slice(-4000);
      const raw = await chatCompletion(aiConfig(), [
        {
          role: "system",
          content:
            'You classify ForgeX Academy support conversations. Respond ONLY with minified JSON: {"subject": "<max 80 chars>", "category": "<one of: ' +
            KB_CATEGORIES.join("|") +
            '>", "summary": "<3-5 sentence handoff summary: the user\'s problem, troubleshooting the AI already attempted, current state>"}.',
        },
        {
          role: "user",
          content: `User role: ${session.userRole}\nConversation:\n${transcript}${
            args.additionalDetails ? `\nExtra details from user: ${args.additionalDetails}` : ""
          }`,
        },
      ]);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) {
        const parsed = JSON.parse(cleaned.slice(start, end)) as {
          subject?: string;
          category?: string;
          summary?: string;
        };
        if (parsed.subject) subject = String(parsed.subject).slice(0, 120);
        if (parsed.category && (KB_CATEGORIES as readonly string[]).includes(parsed.category)) {
          category = parsed.category;
        }
        if (parsed.summary) summary = String(parsed.summary).slice(0, 1500);
      }
    } catch {
      // Keep keyword-based values when classification fails.
    }
    const team = routeTeam(session.userRole, category);

    const result = (await ctx.runMutation(internal.aiSupportData.internalCreateEscalatedTicket, {
      sessionId: args.sessionId,
      userId,
      userRole: role,
      category,
      assignedTeam: team,
      subject,
      aiSummary: summary,
      additionalDetails: args.additionalDetails,
    })) as { ticketNumber: string };
    return result.ticketNumber;
  },
});
