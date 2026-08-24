"use node";

/**
 * ForgeX resilience gateway — centralized infrastructure for EVERY external
 * API integration.
 *
 * Layers applied per request:
 *
 *   caller action
 *     → rate limit (already exists via lib.checkRateLimit)
 *     → global + per-provider concurrency semaphore (queue w/ cap)
 *     → circuit breaker (DB-backed, survives across isolates)
 *     → provider chain w/ timeouts + failover (Gemini → Groq → OpenAI…)
 *     → metrics log (externalApiLogs) + safe errors only
 *
 * All configuration is environment-overridable — no magic numbers scattered
 * in feature code. Raw upstream errors NEVER leave this module: callers and
 * clients only ever see stable, human-safe messages.
 */

import { internal } from "./_generated/api";
// DB persistence lives in the V8 runtime (Convex only allows actions in node
// files) — breaker state, monitoring logs and rate limiting all flow through
// internal.resilienceData.*.

// ---------------------------------------------------------------------------
// Configuration (env-overridable, centralized)
// ---------------------------------------------------------------------------

function numEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export const RESILIENCE = {
  /** Primary provider budget — fail over quickly so users never wait long. */
  primaryTimeoutMs: numEnv("AI_PRIMARY_TIMEOUT_MS", 5_000),
  /** Fallback providers get a longer budget (big completions). */
  fallbackTimeoutMs: numEnv("AI_FALLBACK_TIMEOUT_MS", 30_000),
  /** Consecutive failures before a provider's circuit opens. */
  breakerThreshold: numEnv("AI_BREAKER_THRESHOLD", 4),
  /** How long an OPEN circuit waits before allowing a HALF_OPEN probe. */
  breakerCooldownMs: numEnv("AI_BREAKER_COOLDOWN_MS", 60_000),
  /** Max in-flight external calls across the whole isolate. */
  maxConcurrent: numEnv("AI_MAX_CONCURRENT", 20),
  /** Max in-flight calls per provider. */
  maxPerProvider: numEnv("AI_PROVIDER_MAX_CONCURRENT", 10),
  /** Waiting jobs allowed before shedding load with a friendly busy error. */
  queueCap: numEnv("AI_QUEUE_CAP", 100),
};

// ---------------------------------------------------------------------------
// Safe error classification
// ---------------------------------------------------------------------------

export interface SafeFailure {
  code: string;
  message: string; // user-safe, non-technical
  retryable: boolean;
  status?: number;
}

/** HTTP statuses / conditions that justify trying the next provider. */
function classifyStatus(status: number): SafeFailure {
  if (status === 429) {
    return {
      code: "rate_limited",
      message: "The AI service is busy. Trying another available service.",
      retryable: true,
      status,
    };
  }
  if (status >= 500) {
    return {
      code: "provider_down",
      message: "One of our services is temporarily unavailable. Trying another one.",
      retryable: true,
      status,
    };
  }
  if (status === 408 || status === 425) {
    return {
      code: "timeout",
      message: "The service took too long to respond. Trying another one.",
      retryable: true,
      status,
    };
  }
  // 400/401/403/404 … — misconfiguration or bad request; retrying won't help
  // but another provider may still serve the user.
  return {
    code: "request_rejected",
    message: "This request couldn't be completed right now. Please try again shortly.",
    retryable: false,
    status,
  };
}

function classifyError(err: unknown): SafeFailure {
  if (err instanceof GatewayAbortError) {
    return {
      code: "timeout",
      message: "The service took too long to respond. Trying another one.",
      retryable: true,
    };
  }
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/fetch failed|network|ENOTFOUND|ECONNRESET|EAI_AGAIN|socket|aborted/i.test(msg)) {
    return {
      code: "network",
      message: "Connection interrupted. Your request will be retried automatically.",
      retryable: true,
    };
  }
  return {
    code: "unknown",
    message: "Something went wrong on our side. Please try again shortly.",
    retryable: false,
  };
}

/** Thrown internally when a fetch exceeds its timeout budget. */
export class GatewayAbortError extends Error {
  constructor() {
    super("upstream timeout");
  }
}

/** Stable, user-safe error thrown when every provider failed. */
export class GatewayUnavailableError extends Error {}

// ---------------------------------------------------------------------------
// Concurrency control — in-isolate semaphore with a bounded waiting queue.
// NOTE: limits apply per server instance; the DB-backed rate limiting in
// lib.checkRateLimit complements this across instances.
// ---------------------------------------------------------------------------

class Semaphore {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(
    private readonly limit: number,
    private readonly queueCap: number,
    private readonly label: string,
  ) {}

  async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return;
    }
    if (this.queue.length >= this.queueCap) {
      throw new GatewayUnavailableError(
        "We're experiencing very high demand right now. Please try again in a few seconds.",
      );
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }

  depth(): number {
    return this.active + this.queue.length;
  }
}

const globalSem = new Semaphore(RESILIENCE.maxConcurrent, RESILIENCE.queueCap, "global");
const providerSems = new Map<string, Semaphore>();

function semFor(provider: string): Semaphore {
  let s = providerSems.get(provider);
  if (!s) {
    s = new Semaphore(RESILIENCE.maxPerProvider, RESILIENCE.queueCap, provider);
    providerSems.set(provider, s);
  }
  return s;
}

export function currentQueueDepth(): number {
  return globalSem.depth();
}

// ---------------------------------------------------------------------------
// Circuit breaker — DB-backed so state is shared across isolates/restarts.
// ---------------------------------------------------------------------------

type Ctx = any; // action ctx (runQuery/runMutation only)

export async function breakerAllows(ctx: Ctx, provider: string): Promise<boolean> {
  const doc = await ctx.runQuery(internal.resilienceData.internalGetBreaker, { provider });
  if (!doc || doc.state === "closed") return true;
  const now = Date.now();
  if (doc.state === "open" && doc.openedAt && now - doc.openedAt >= RESILIENCE.breakerCooldownMs) {
    // Cooldown elapsed → allow ONE limited probe through.
    await ctx.runMutation(internal.resilienceData.internalSetBreaker, {
      provider,
      state: "half_open",
      lastError: doc.lastError,
    });
    return true;
  }
  return doc.state === "half_open"; // half-open lets limited traffic probe
}

export async function recordProviderSuccess(ctx: Ctx, provider: string): Promise<void> {
  try {
    await ctx.runMutation(internal.resilienceData.internalRecordSuccess, { provider });
  } catch (err) {
    console.warn("[resilience] success record failed:", err instanceof Error ? err.message : err);
  }
}

export async function recordProviderFailure(ctx: Ctx, provider: string, failure: SafeFailure): Promise<void> {
  try {
    await ctx.runMutation(internal.resilienceData.internalRecordFailure, {
      provider,
      lastError: failure.code,
      threshold: RESILIENCE.breakerThreshold,
    });
  } catch (err) {
    console.warn("[resilience] failure record failed:", err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Monitoring — one log row per wrapped external call (pruned by crons).
// ---------------------------------------------------------------------------

export async function logExternalCall(
  ctx: Ctx,
  entry: {
    provider: string;
    operation: string;
    ok: boolean;
    latencyMs: number;
    statusCode?: number;
    attempts?: number;
    fallbackUsed?: boolean;
    errorCode?: string;
  },
): Promise<void> {
  try {
    await ctx.runMutation(internal.resilienceData.internalLogCall, entry);
  } catch {
    // Observability must never break the request path.
  }
}

// ---------------------------------------------------------------------------
// Generic guarded external call — use for STT/TTS/Mux/Cloudinary/etc.
// Applies: concurrency → circuit breaker → timeout → metrics → safe errors.
// ---------------------------------------------------------------------------

export async function guardedExternalCall<T>(
  ctx: Ctx,
  opts: { provider: string; operation: string; timeoutMs?: number },
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  await globalSem.acquire();
  try {
    if (!(await breakerAllows(ctx, opts.provider))) {
      throw new GatewayUnavailableError(
        "This service is temporarily unavailable. Please try again in a minute.",
      );
    }
    const sem = semFor(opts.provider);
    await sem.acquire();
    try {
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        opts.timeoutMs ?? RESILIENCE.fallbackTimeoutMs,
      );
      let ok = false;
      let status: number | undefined;
      let errorCode: string | undefined;
      try {
        const result = await fn(controller.signal);
        ok = true;
        return result;
      } catch (err) {
        const failure =
          err instanceof GatewayAbortError
            ? classifyError(err)
            : err && typeof err === "object" && "status" in (err as any)
              ? classifyStatus((err as any).status as number)
              : classifyError(err);
        status = failure.status;
        errorCode = failure.code;
        console.error(
          `[resilience] ${opts.provider}:${opts.operation} failed (${failure.code}) after ${Date.now() - started}ms`,
          err instanceof Error ? err.message.slice(0, 300) : err,
        );
        await recordProviderFailure(ctx, opts.provider, failure);
        throw new GatewayUnavailableError(failure.message);
      } finally {
        clearTimeout(timer);
        await logExternalCall(ctx, {
          provider: opts.provider,
          operation: opts.operation,
          ok,
          latencyMs: Date.now() - started,
          statusCode: status,
          attempts: 1,
          errorCode,
        });
        if (ok) await recordProviderSuccess(ctx, opts.provider);
      }
    } finally {
      sem.release();
    }
  } finally {
    globalSem.release();
  }
}

// ---------------------------------------------------------------------------
// Unified AI gateway — chat completions with automatic provider failover.
//
//   Request → [gemini → groq → openai/novita] (first healthy provider wins)
//
// Every provider speaks the OpenAI-compatible /chat/completions shape, so
// requests are normalized once and responses normalized once. The caller gets
// identical output regardless of which provider answered.
// ---------------------------------------------------------------------------

interface ProviderDef {
  name: string;
  base: string;
  key: string;
  model: string;
}

/** Ordered provider chain for TEXT generation (primary first). */
export function textProviders(): ProviderDef[] {
  const chain: ProviderDef[] = [];
  const gemini = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (gemini) {
    chain.push({
      name: "gemini",
      base: "https://generativelanguage.googleapis.com/v1beta/openai",
      key: gemini,
      model: process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash",
    });
  }
  const groq = process.env.GROQ_API_KEY;
  if (groq) {
    chain.push({
      name: "groq",
      base: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
      key: groq,
      model: process.env.GROQ_MODEL ?? process.env.OPENAI_MODEL ?? "openai/gpt-oss-120b",
    });
  }
  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    chain.push({
      name: "openai",
      base: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      key: openai,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    });
  }
  const novita = process.env.NOVITA_API_KEY;
  if (novita) {
    chain.push({
      name: "novita",
      base: "https://api.novita.ai/v3/openai",
      key: novita,
      model: process.env.OPENAI_MODEL ?? "meta-llama/llama-3.1-8b-instruct",
    });
  }
  return chain;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GatewayChatResult {
  content: string;
  provider: string;
  latencyMs: number;
  fallbackUsed: boolean;
}

/**
 * One normalized chat completion with full failover. Throws a
 * GatewayUnavailableError carrying a USER-SAFE message when every provider
 * fails — feature code catches this and degrades gracefully (KB answers,
 * plain text, queued retries).
 */
export async function gatewayChat(
  ctx: Ctx,
  opts: {
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    /** Operation label for monitoring, e.g. "support-chat". */
    operation?: string;
  },
): Promise<GatewayChatResult> {
  const providers = textProviders();
  if (providers.length === 0) {
    throw new GatewayUnavailableError("The AI service isn't configured yet.");
  }

  await globalSem.acquire();
  const startedAll = Date.now();
  let lastFailure: SafeFailure | null = null;
  let attempts = 0;
  try {
    for (let i = 0; i < providers.length; i++) {
      const p = providers[i];
      if (!(await breakerAllows(ctx, p.name))) continue; // unhealthy → skip instantly

      const sem = semFor(p.name);
      let acquired = false;
      try {
        await sem.acquire();
        acquired = true;
      } catch {
        continue; // this provider saturated → try the next one
      }
      try {
        attempts++;
        const started = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          i === 0 ? RESILIENCE.primaryTimeoutMs : RESILIENCE.fallbackTimeoutMs,
        );
        let ok = false;
        let status: number | undefined;
        let errorCode: string | undefined;
        try {
          const res = await fetch(`${p.base}/chat/completions`, {
            method: "POST",
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${p.key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: p.model,
              messages: opts.messages,
              temperature: opts.temperature ?? 0.3,
              max_tokens: opts.maxTokens ?? 1200,
            }),
          });
          status = res.status;
          if (!res.ok) {
            // Technical detail: SERVER LOG ONLY.
            console.error(`[gateway] ${p.name} ${res.status}:`, (await res.text()).slice(0, 300));
            throw Object.assign(new Error(`provider ${res.status}`), { status: res.status });
          }
          const json = await res.json();
          const content: string = json?.choices?.[0]?.message?.content ?? "";
          if (!content.trim()) throw Object.assign(new Error("empty completion"), { status: 502 });
          ok = true;
          const result: GatewayChatResult = {
            content: content.trim(),
            provider: p.name,
            latencyMs: Date.now() - started,
            fallbackUsed: i > 0,
          };
          await recordProviderSuccess(ctx, p.name);
          await logExternalCall(ctx, {
            provider: p.name,
            operation: opts.operation ?? "chat",
            ok: true,
            latencyMs: result.latencyMs,
            statusCode: status,
            attempts,
            fallbackUsed: i > 0,
          });
          return result;
        } catch (err) {
          const failure =
            err instanceof GatewayAbortError || (err as any)?.name === "AbortError"
              ? classifyError(new GatewayAbortError())
              : classifyStatus((err as any)?.status ?? 0);
          status = failure.status;
          errorCode = failure.code;
          lastFailure = failure;
          console.error(
            `[gateway] ${p.name}:${opts.operation ?? "chat"} attempt ${attempts} failed (${failure.code})`,
            err instanceof Error ? err.message.slice(0, 200) : err,
          );
          await recordProviderFailure(ctx, p.name, failure);
          await logExternalCall(ctx, {
            provider: p.name,
            operation: opts.operation ?? "chat",
            ok: false,
            latencyMs: Date.now() - started,
            statusCode: status,
            attempts,
            fallbackUsed: i > 0,
            errorCode: failure.code,
          });
          // Continue down the chain.
        } finally {
          clearTimeout(timer);
        }
      } finally {
        if (acquired) sem.release();
      }
    }

    // Every provider failed (or was circuit-open).
    console.error(`[gateway] all providers failed after ${attempts} attempts`);
    throw new GatewayUnavailableError(
      lastFailure?.message ??
        "The AI service is temporarily unavailable. Your message is safe — please try again shortly.",
    );
  } finally {
    globalSem.release();
    if (attempts === 0) {
      await logExternalCall(ctx, {
        provider: "any",
        operation: opts.operation ?? "chat",
        ok: false,
        latencyMs: Date.now() - startedAll,
        errorCode: "circuit_open",
      }).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Internal breaker/log persistence (queries & mutations)
// ---------------------------------------------------------------------------

export const internalGetBreaker = internalQuery({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("providerHealth")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .first();
  },
});

export const internalSetBreaker = internalMutation({
  args: {
    provider: v.string(),
    state: v.union(v.literal("closed"), v.literal("open"), v.literal("half_open")),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("providerHealth")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .first();
    if (!existing) {
      await ctx.db.insert("providerHealth", {
        provider: args.provider,
        state: args.state,
        consecutiveFailures: 0,
        openedAt: args.state === "open" ? Date.now() : undefined,
        lastError: args.lastError,
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.patch(existing._id, {
      state: args.state,
      openedAt:
        args.state === "open"
          ? (existing.openedAt ?? Date.now()) // keep original opening time for cooldown math
          : existing.state === "half_open" && args.state === "half_open"
            ? existing.openedAt
            : undefined,
      lastError: args.lastError,
      updatedAt: Date.now(),
    });
  },
});

export const internalRecordSuccess = internalMutation({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("providerHealth")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .first();
    if (!existing) {
      await ctx.db.insert("providerHealth", {
        provider: args.provider,
        state: "closed",
        consecutiveFailures: 0,
        lastSuccessAt: Date.now(),
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.patch(existing._id, {
      state: "closed",
      consecutiveFailures: 0,
      lastSuccessAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const internalRecordFailure = internalMutation({
  args: { provider: v.string(), lastError: v.string(), threshold: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("providerHealth")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .first();
    const failures = (existing?.consecutiveFailures ?? 0) + 1;
    const shouldOpen = failures >= args.threshold;
    if (!existing) {
      await ctx.db.insert("providerHealth", {
        provider: args.provider,
        state: shouldOpen ? "open" : "closed",
        consecutiveFailures: failures,
        openedAt: shouldOpen ? Date.now() : undefined,
        lastError: args.lastError,
        lastFailureAt: Date.now(),
        updatedAt: Date.now(),
      });
      if (shouldOpen) {
        console.error(`[breaker] ${args.provider} OPENED after ${failures} consecutive failures`);
      }
      return;
    }
    await ctx.db.patch(existing._id, {
      consecutiveFailures: failures,
      state: shouldOpen ? "open" : existing.state,
      openedAt: shouldOpen ? Date.now() : existing.openedAt,
      lastError: args.lastError,
      lastFailureAt: Date.now(),
      updatedAt: Date.now(),
    });
    if (shouldOpen && existing.state !== "open") {
      console.error(`[breaker] ${args.provider} OPENED after ${failures} consecutive failures`);
    }
  },
});

export const internalLogCall = internalMutation({
  args: {
    provider: v.string(),
    operation: v.string(),
    ok: v.boolean(),
    latencyMs: v.number(),
    statusCode: v.optional(v.number()),
    attempts: v.optional(v.number()),
    fallbackUsed: v.optional(v.boolean()),
    errorCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("externalApiLogs", { ...args, createdAt: Date.now() });
  },
});

// ---------------------------------------------------------------------------
// Per-user rate limiting for EXPENSIVE operations (AI chat, quiz generation,
// transcription, TTS…). DB-backed fixed-window counters — safe across
// concurrent instances because Convex serializes writes to one document.
// ---------------------------------------------------------------------------

export const internalConsumeRateLimit = internalMutation({
  args: { key: v.string(), limit: v.number(), windowMs: v.number() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!existing) {
      await ctx.db.insert("rateLimits", { key: args.key, windowStart: now, count: 1 });
      return true;
    }
    if (now - existing.windowStart >= args.windowMs) {
      await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
      return true;
    }
    if (existing.count >= args.limit) return false;
    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return true;
  },
});

/**
 * Enforce a per-user limit on an expensive operation. Throws a friendly
 * GatewayUnavailableError (never a raw quota error) when exceeded.
 */
export async function enforceUserLimit(
  ctx: Ctx,
  userId: string,
  operation: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const ok = await ctx.runMutation(internal.resilienceGateway.internalConsumeRateLimit, {
    key: `ai:${operation}:${userId}`,
    limit,
    windowMs,
  });
  if (!ok) {
    throw new GatewayUnavailableError(
      "You're doing that a little too quickly — please wait a moment and try again.",
    );
  }
}
