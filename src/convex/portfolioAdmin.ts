import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { hashPassword, randomHex, verifyPassword } from "./adminCrypto";

/* ═══════════════════════════════════════════════════════════════════════════
   ForgeX Network PORTFOLIO — admin settings, credential and sessions.

   Intentionally separate from every Academy surface:

     • its own settings document  → `portfolioSettings`
     • its own credential         → PBKDF2-SHA256 (hashPassword/verifyPassword)
     • its own sessions           → `portfolioAdminSessions` (token stored hash)
     • its own SMTP configuration → used only for Portfolio email

   Nothing here reads or writes Academy site content, Academy admin sessions,
   Academy users or Academy mail settings, so the two products cannot conflict.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SETTINGS_KEY = "portfolio";

/**
 * Default credential for a fresh install — the PBKDF2-SHA256 `salt:hash` of
 * the initial Portfolio admin password.
 *
 * Only the salt and hash live in source; the plaintext password is not
 * present in this repository nor in the client bundle. It is verified
 * server-side and should be changed from Admin → Access on first login.
 */
const DEFAULT_CREDENTIAL =
  "fdefc85b673e9b3646ef38c8b3a3249a:668eb4c4e81beb9a0de3790f3396bae972901d0a0a305d9e43f65fa763ada5a9";

/** Sessions last 12 hours; a new token is issued on every sign-in. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** SHA-256 (hex) of a session token — only the hash is ever persisted. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** The singleton settings row, created on first use. */
async function ensureSettingsRow(
  ctx: MutationCtx,
): Promise<Doc<"portfolioSettings">> {
  const existing = await ctx.db
    .query("portfolioSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .first();
  if (existing) return existing;

  const id = await ctx.db.insert("portfolioSettings", {
    key: SETTINGS_KEY,
    adminPasswordHash: DEFAULT_CREDENTIAL,
    adminPasswordUpdatedAt: Date.now(),
    auth: {
      allowSignups: true,
      requireEmailVerification: false,
      resetLinkTtlMinutes: 60,
    },
    seo: {
      titleTemplate: "{name} — {headline}",
      defaultDescription: "A professional portfolio built with ForgeX Network.",
      defaultImage: "",
    },
    updatedAt: Date.now(),
  });

  const created = await ctx.db.get(id);
  if (!created) throw new Error("Could not initialise Portfolio settings.");
  return created;
}

/** Require a live Portfolio admin session; returns the session row. */
async function assertSession(ctx: MutationCtx, token: string) {
  if (!token) throw new Error("Portfolio admin session required.");
  const tokenHash = await sha256Hex(token);
  const session = await ctx.db
    .query("portfolioAdminSessions")
    .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
    .first();
  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Your Portfolio admin session has expired. Sign in again.");
  }
  return session;
}

async function sessionForToken(ctx: MutationCtx, token: string) {
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const session = await ctx.db
    .query("portfolioAdminSessions")
    .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
    .first();
  if (!session || session.expiresAt < Date.now()) return null;
  return session;
}

/* ── Public (unauthenticated) ──────────────────────────────────────────── */

/** Fresh-install status, for the portal's first-run messaging. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("portfolioSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .first();
    return {
      initialised: !!doc,
      smtpConfigured: !!(doc?.smtp?.host && doc?.smtp?.username && doc?.smtp?.password),
      passwordUpdatedAt: doc?.adminPasswordUpdatedAt ?? null,
      /** True while the installer credential is still in place. */
      usingDefaultCredential: !doc || doc.adminPasswordHash === DEFAULT_CREDENTIAL,
    };
  },
});

/* ── Authenticated reads ───────────────────────────────────────────────── */

/** Settings for the portal (the SMTP password is included for editing). */
export const settings = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token) return null;
    const tokenHash = await sha256Hex(token);
    const session = await ctx.db
      .query("portfolioAdminSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!session || session.expiresAt < Date.now()) return null;

    const doc = await ctx.db
      .query("portfolioSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .first();
    if (!doc) return null;

    return {
      smtp: doc.smtp ?? null,
      auth: doc.auth ?? null,
      seo: doc.seo ?? null,
      adminPasswordUpdatedAt: doc.adminPasswordUpdatedAt,
      usingDefaultCredential: doc.adminPasswordHash === DEFAULT_CREDENTIAL,
      updatedAt: doc.updatedAt,
    };
  },
});

/**
 * SMTP config for a live Portfolio session — read by the Portfolio email
 * actions so Portfolio mail can never fall back to Academy mail settings.
 */
export const smtpForToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token) return null;
    const tokenHash = await sha256Hex(token);
    const session = await ctx.db
      .query("portfolioAdminSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!session || session.expiresAt < Date.now()) return null;

    const doc = await ctx.db
      .query("portfolioSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .first();
    return doc?.smtp ?? null;
  },
});

/** Route guard: is this Portfolio session still valid? */
export const sessionValid = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token) return false;
    const tokenHash = await sha256Hex(token);
    const session = await ctx.db
      .query("portfolioAdminSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .first();
    return !!session && session.expiresAt > Date.now();
  },
});

/* ── Portfolio-owned public content ────────────────────────────────────── */

/** One Portfolio content value (public read — this is published site copy). */
export const publicContent = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const doc = await ctx.db
      .query("portfolioContent")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    return doc?.value ?? null;
  },
});

/** All Portfolio content, keyed — used by the portal and public pages. */
export const publicContentAll = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("portfolioContent").collect();
    return Object.fromEntries(docs.map((d) => [d.key, d.value]));
  },
});

/** Write a Portfolio content value (Portfolio admin session required). */
export const setContent = mutation({
  args: { token: v.string(), key: v.string(), value: v.any() },
  handler: async (ctx, { token, key, value }) => {
    await assertSession(ctx, token);
    const cleanKey = key.trim().slice(0, 60);
    if (!cleanKey) throw new Error("A content key is required.");

    const existing = await ctx.db
      .query("portfolioContent")
      .withIndex("by_key", (q) => q.eq("key", cleanKey))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("portfolioContent", {
        key: cleanKey,
        value,
        updatedAt: Date.now(),
      });
    }
    return true;
  },
});

/** Remove a Portfolio content value (falls back to built-in defaults). */
export const deleteContent = mutation({
  args: { token: v.string(), key: v.string() },
  handler: async (ctx, { token, key }) => {
    await assertSession(ctx, token);
    const existing = await ctx.db
      .query("portfolioContent")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return true;
  },
});

/* ── Sign in / out ─────────────────────────────────────────────────────── */

/**
 * Portfolio admin sign-in. Verifies the password server-side and issues a
 * Portfolio-only session token — no Academy session is created or consulted.
 */
export const signIn = mutation({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    if (!password) throw new Error("Enter your Portfolio admin password.");
    const row = await ensureSettingsRow(ctx);
    const now = Date.now();

    // Brute-force throttle: after 8 consecutive failures the gate locks for
    // 10 minutes. Counters live on the settings row and reset on success.
    const lockWindowMs = 10 * 60 * 1000;
    const failures = row.failedAttempts ?? 0;
    const lastFailedAt = row.lastFailedAt ?? 0;
    if (failures >= 8 && now - lastFailedAt < lockWindowMs) {
      const minutes = Math.ceil((lockWindowMs - (now - lastFailedAt)) / 60_000);
      throw new Error(
        `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      );
    }

    const ok = await verifyPassword(password, row.adminPasswordHash);
    if (!ok) {
      const stale = now - lastFailedAt > lockWindowMs;
      await ctx.db.patch(row._id, {
        failedAttempts: stale ? 1 : failures + 1,
        lastFailedAt: now,
      });
      throw new Error("Incorrect Portfolio admin password.");
    }

    const token = randomHex(32);
    const tokenHash = await sha256Hex(token);
    await ctx.db.insert("portfolioAdminSessions", {
      tokenHash,
      createdAt: now,
      lastUsedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });

    if (failures > 0) {
      await ctx.db.patch(row._id, { failedAttempts: 0, lastFailedAt: undefined });
    }

    return {
      token,
      expiresAt: now + SESSION_TTL_MS,
      usingDefaultCredential: row.adminPasswordHash === DEFAULT_CREDENTIAL,
    };
  },
});

/** Sign out — deletes the session row so the token can't be reused. */
export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await sessionForToken(ctx, token);
    if (session) await ctx.db.delete(session._id);
    return true;
  },
});

/* ── Settings + credential management ─────────────────────────────────── */

export const updateSettings = mutation({
  args: {
    token: v.string(),
    smtp: v.optional(
      v.object({
        host: v.string(),
        port: v.number(),
        username: v.string(),
        password: v.string(),
        fromEmail: v.string(),
        fromName: v.string(),
        secure: v.boolean(),
      }),
    ),
    auth: v.optional(
      v.object({
        allowSignups: v.boolean(),
        requireEmailVerification: v.boolean(),
        resetLinkTtlMinutes: v.number(),
      }),
    ),
    seo: v.optional(
      v.object({
        titleTemplate: v.string(),
        defaultDescription: v.string(),
        defaultImage: v.string(),
      }),
    ),
  },
  handler: async (ctx, { token, ...patch }) => {
    await assertSession(ctx, token);
    const row = await ensureSettingsRow(ctx);

    const next: Partial<Doc<"portfolioSettings">> = { updatedAt: Date.now() };
    if (patch.smtp !== undefined) {
      next.smtp = {
        host: patch.smtp.host.trim(),
        port: patch.smtp.port,
        username: patch.smtp.username.trim(),
        password: patch.smtp.password,
        fromEmail: patch.smtp.fromEmail.trim(),
        fromName: patch.smtp.fromName.trim(),
        secure: patch.smtp.secure,
      };
    }
    if (patch.auth !== undefined) next.auth = patch.auth;
    if (patch.seo !== undefined) {
      next.seo = {
        titleTemplate: patch.seo.titleTemplate.slice(0, 120),
        defaultDescription: patch.seo.defaultDescription.slice(0, 300),
        defaultImage: patch.seo.defaultImage,
      };
    }

    await ctx.db.patch(row._id, next);
    return true;
  },
});

/** Change the Portfolio admin password (hashed before it is ever stored). */
export const changePassword = mutation({
  args: { token: v.string(), current: v.string(), next: v.string() },
  handler: async (ctx, { token, current, next }) => {
    await assertSession(ctx, token);
    const row = await ensureSettingsRow(ctx);

    if (next.trim().length < 8) {
      throw new Error("Use at least 8 characters for the new password.");
    }
    const ok = await verifyPassword(current, row.adminPasswordHash);
    if (!ok) throw new Error("Your current password is incorrect.");

    const hash = await hashPassword(next);
    await ctx.db.patch(row._id, {
      adminPasswordHash: hash,
      adminPasswordUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Any other live sessions are invalidated when the password changes.
    const sessions = await ctx.db.query("portfolioAdminSessions").collect();
    for (const s of sessions) await ctx.db.delete(s._id);

    return true;
  },
});
