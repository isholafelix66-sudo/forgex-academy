/**
 * Persistence layer for the resilience system (circuit breakers, external
 * API monitoring, action-side rate limiting).
 *
 * Lives in the standard V8 runtime because Convex only allows actions in
 * Node.js files — the gateway (resilienceGateway.ts) calls these internals
 * via ctx.runQuery / ctx.runMutation.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ---------------------------------------------------------------------------
// Circuit breaker state
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

// ---------------------------------------------------------------------------
// External API monitoring log
// ---------------------------------------------------------------------------

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
// Fixed-window rate limiting for expensive operations
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
