import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { randomHex, sha256Hex, requirePortfolioAdminSession } from "./portfolioAdmin";

/* ═════════════════════════════════════════ account boundaries ═════════════
   PORTFOLIO CREATOR AUTH — separate from BOTH other systems:

     • Academy accounts live in `users` (Convex Auth, email-OTP via the
       Academy flow). Nothing here reads or writes that table.
     • Portfolio admin credentials live in `portfolioSettings` +
       `portfolioAdminSessions`. Nothing here touches them either.

   A Portfolio creator signs in with Email → OTP → session token. Sessions
   are only ever created by `verifyOtp` below and only ever accepted by the
   `requirePortfolioUser` guard, so an Academy session or an admin session
   can never be mistaken for a creator session (and vice versa).
   ══════════════════════════════════════════════════════════════════════════ */

export const PORTFOLIO_USER_ROLE = "portfolio_user" as const;

/** Session lifetime: 30 days (persisted across browser restarts). */
export const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** OTP validity window. */
const OTP_TTL_MS = 10 * 60 * 1000;
/** Max verification attempts per code before it is burned. */
const OTP_MAX_ATTEMPTS = 5;
/** Resend cooldown per email. */
const OTP_RESEND_COOLDOWN_MS = 45 * 1000;
/** Max live (unconsumed, unexpired) codes per email — older ones are deleted. */
const OTP_MAX_LIVE = 3;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** The signed-in Portfolio creator, or null (guest / expired session). */
export async function getPortfolioUser(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<Doc<"portfolioUsers"> | null> {
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const session = await ctx.db
    .query("portfolioUserSessions")
    .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
    .first();
  if (!session || session.expiresAt < Date.now()) return null;
  const user = await ctx.db.get(session.userId);
  if (!user || user.status === "suspended") return null;
  // Sessions are extended at sign-in time only (30-day TTL) — reads here are
  // side-effect-free so this helper is safe from queries and mutations alike.
  return user;
}

/** Require a signed-in Portfolio creator — throws when not authenticated. */
export async function requirePortfolioUser(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<Doc<"portfolioUsers">> {
  const user = await getPortfolioUser(ctx, token);
  if (!user) {
    throw new Error("Sign in to your Portfolio account to continue.");
  }
  return user;
}

/* ── Rate limiting ─────────────────────────────────────────────────────── */

/** Fixed-window counter (per email/action) using the shared rateLimits table. */
async function rateLimit(
  ctx: MutationCtx,
  key: string,
  max: number,
  windowMs: number,
) {
  const now = Date.now();
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (!row || now - row.windowStart > windowMs) {
    if (row) await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    else await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    return;
  }
  if (row.count >= max) {
    throw new Error(
      "Too many attempts — please wait a few minutes and try again.",
    );
  }
  await ctx.db.patch(row._id, { count: row.count + 1 });
}

/* ── Email templates for auth mail ─────────────────────────────────────── */

function otpEmailHtml(code: string, isNew: boolean) {
  const minutes = OTP_TTL_MS / 60_000;
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0d08;color:#f2f6ec;padding:32px;border-radius:16px;max-width:520px;margin:0 auto">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#a3e635">ForgeX Network · Portfolio</p>
    <h2 style="margin:0 0 12px;font-size:22px">${isNew ? "Confirm your email" : "Your sign-in code"}</h2>
    <p style="margin:0 0 20px;line-height:1.6;color:#c9d1c2">
      ${isNew ? "Welcome! Use this one-time code to finish creating your Portfolio account." : "Use this one-time code to sign in to your Portfolio."}
      It expires in ${minutes} minutes.
    </p>
    <div style="font-size:34px;font-weight:800;letter-spacing:0.35em;color:#a3e635;padding:14px 20px;border:1px dashed rgba(163,230,53,0.4);border-radius:12px;text-align:center">${code}</div>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#8b977f">
      If you didn't request this, ignore this email — nothing changes on your account.
    </p>
  </div>`;
}

/* ── Step 1: request an OTP ────────────────────────────────────────────── */

/**
 * Email → OTP step 1. Works for both sign-in (existing account) and sign-up
 * (new account). An account is ONLY created at verification time, so a
 * mistyped email can never create a stray account, and this flow can never
 * create an Academy account — it writes only to `portfolioUsers`.
 */
export const requestOtp = mutation({
  args: { email: v.string(), purpose: v.union(v.literal("signin"), v.literal("signup")) },
  handler: async (ctx, { email, purpose }) => {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      throw new Error("Enter a valid email address.");
    }
    await rateLimit(ctx, `pf-otp:${normalized}`, 6, 15 * 60 * 1000);

    const existing = await ctx.db
      .query("portfolioUsers")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();

    if (existing && existing.status === "suspended") {
      throw new Error(
        "This account has been suspended. Contact support for help.",
      );
    }

    // Purpose must match reality: you cannot "sign up" into an existing
    // account and you cannot "sign in" without one.
    if (purpose === "signup" && existing) {
      throw new Error(
        "An account with this email already exists — use Sign In instead.",
      );
    }
    if (purpose === "signin" && !existing) {
      throw new Error(
        "No Portfolio account with this email yet — create one first.",
      );
    }

    // Resend cooldown: one code per email per cooldown window.
    const recent = await ctx.db
      .query("portfolioAuthCodes")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .order("desc")
      .first();
    if (
      recent &&
      !recent.consumed &&
      Date.now() - recent.createdAt < OTP_RESEND_COOLDOWN_MS
    ) {
      const secs = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt)) / 1000,
      );
      throw new Error(`Please wait ${secs}s before requesting another code.`);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await ctx.db.insert("portfolioAuthCodes", {
      email: normalized,
      codeHash: await sha256Hex(code),
      purpose,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
      consumed: false,
      createdAt: Date.now(),
    });

    // Bind the code to the queue row so the sender can read it (internal).
    await ctx.scheduler.runAfter(0, internal.portfolioUsers.sendOtpEmail, {
      email: normalized,
      code,
      isNew: purpose === "signup",
    });

    // Is the Portfolio mail service paused? The code is still created and
    // queued — we just tell the person the truth instead of pretending the
    // email is already in their inbox.
    const settings = await ctx.db
      .query("portfolioSettings")
      .withIndex("by_key", (q) => q.eq("key", "portfolio"))
      .first();
    const deliveryOnHold = !!settings?.emailPaused;

    return {
      isNew: purpose === "signup",
      deliveryOnHold,
      message: deliveryOnHold
        ? "Portfolio email is paused at the moment — your code is queued and will be sent as soon as email resumes."
        : `We sent a 6-digit code to ${maskedEmail(normalized)}.`,
    };
  },
});

function maskedEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const shown = user.slice(0, 2);
  return `${shown}${"•".repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

/* ── Step 1b: deliver the OTP email (internal, via Portfolio SMTP) ─────── */

/**
 * internalMutation wrapper so the scheduler can send the OTP email through
 * the Portfolio email action. Sent via the Portfolio SMTP transport
 * (`portfolioEmail.deliverPortfolioMail`) — never the Academy mailer.
 */
export const sendOtpEmail = internalMutation({
  args: { email: v.string(), code: v.string(), isNew: v.boolean() },
  handler: async (ctx, { email, code, isNew }) => {
    const subject = isNew
      ? "Your ForgeX Portfolio verification code"
      : "Your ForgeX Portfolio sign-in code";
    await ctx.scheduler.runAfter(0, internal.portfolioEmailLog.deliver, {
      to: email,
      subject,
      html: otpEmailHtml(code, isNew),
      template: "otp",
      kind: "auth",
    });
  },
});

/* ── Step 2: verify the OTP → session ──────────────────────────────────── */

/**
 * Email → OTP step 2. Verifies the hashed code, then:
 *   • sign-in  → issues a session for the existing account
 *   • sign-up  → creates the account (still `onboarded: false`) and issues
 *                a session; profile details are collected next.
 */
export const verifyOtp = mutation({
  args: {
    email: v.string(),
    code: v.string(),
    purpose: v.union(v.literal("signin"), v.literal("signup")),
  },
  handler: async (ctx, { email, code, purpose }) => {
    const normalized = normalizeEmail(email);
    await rateLimit(ctx, `pf-verify:${normalized}`, 12, 15 * 60 * 1000);

    const row = await ctx.db
      .query("portfolioAuthCodes")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .order("desc")
      .first();

    if (!row || row.consumed || row.purpose !== purpose) {
      throw new Error("Request a new code, then try again.");
    }
    if (row.expiresAt < Date.now()) {
      throw new Error("That code has expired — request a new one.");
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      throw new Error("Too many attempts. Request a new code.");
    }

    const ok = row.codeHash === (await sha256Hex(code.trim()));
    if (!ok) {
      await ctx.db.patch(row._id, { attempts: row.attempts + 1 });
      throw new Error("That code isn't right. Double-check and try again.");
    }

    await ctx.db.patch(row._id, { consumed: true });

    const now = Date.now();
    let user = await ctx.db
      .query("portfolioUsers")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();

    let created = false;
    if (!user && purpose === "signup") {
      const id = await ctx.db.insert("portfolioUsers", {
        email: normalized,
        role: PORTFOLIO_USER_ROLE,
        status: "active",
        onboarded: false,
        createdAt: now,
      });
      user = await ctx.db.get(id);
      created = true;
    }
    if (!user) throw new Error("No account found. Create one first.");

    if (user.status === "suspended") {
      throw new Error("This account has been suspended.");
    }

    await ctx.db.patch(user._id, { lastLoginAt: now });

    const token = randomHex(32);
    await ctx.db.insert("portfolioUserSessions", {
      tokenHash: await sha256Hex(token),
      userId: user._id,
      createdAt: now,
      lastUsedAt: now,
      expiresAt: now + USER_SESSION_TTL_MS,
    });

    return {
      token,
      expiresAt: now + USER_SESSION_TTL_MS,
      needsOnboarding: !user.onboarded,
      created,
      email: user.email,
    };
  },
});

/** Step 3 (new accounts only): collect name / title / bio / photo. */
export const completeOnboarding = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    title: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { token, name, title, bio, avatarUrl }) => {
    const user = await requirePortfolioUser(ctx, token);
    const cleanName = name.trim().slice(0, 80);
    if (cleanName.length < 2) throw new Error("Enter your full name.");
    await ctx.db.patch(user._id, {
      name: cleanName,
      title: title?.trim().slice(0, 120) || undefined,
      bio: bio?.trim().slice(0, 600) || undefined,
      avatarUrl: avatarUrl || undefined,
      onboarded: true,
    });
    return true;
  },
});

/* ── Session helpers for the client ────────────────────────────────────── */

/**
 * Internal: resolve a creator session token to its account id. Used by Node
 * actions (video uploads) that cannot call the public query directly with
 * extra arguments.
 */
export const internalCreatorByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getPortfolioUser(ctx, token);
    if (!user) return null;
    return { _id: user._id as string, email: user.email, name: user.name ?? null };
  },
});

/** Validate a session token (used by the router guard and pages). */
export const validateSession = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getPortfolioUser(ctx, token);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email,
      name: user.name ?? null,
      title: user.title ?? null,
      avatarUrl: user.avatarUrl ?? null,
      onboarded: user.onboarded,
      role: user.role,
      status: user.status,
    };
  },
});

/** Sign out — deletes the session row so the token can't be reused. */
export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token) return true;
    const tokenHash = await sha256Hex(token);
    const session = await ctx.db
      .query("portfolioUserSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (session) await ctx.db.delete(session._id);
    return true;
  },
});

/* ── Profile management (creator's own record) ─────────────────────────── */

/** Update the creator's own profile fields. */
export const updateProfile = mutation({
  args: {
    token: v.string(),
    name: v.optional(v.string()),
    title: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...patch }) => {
    const user = await requirePortfolioUser(ctx, token);
    const next: Partial<Doc<"portfolioUsers">> = {};
    if (patch.name !== undefined) {
      const clean = patch.name.trim().slice(0, 80);
      if (clean.length < 2) throw new Error("Name needs at least 2 characters.");
      next.name = clean;
    }
    if (patch.title !== undefined)
      next.title = patch.title.trim().slice(0, 120) || undefined;
    if (patch.bio !== undefined)
      next.bio = patch.bio.trim().slice(0, 600) || undefined;
    if (patch.avatarUrl !== undefined) {
      next.avatarUrl = patch.avatarUrl || undefined;

      // The creator account and the public portfolio are two records, but the
      // profile photo is one identity. Keep the public frame in sync whenever
      // a creator changes their account photo, otherwise the dashboard and the
      // public portfolio can show different images.
      const portfolio = await ctx.db
        .query("portfolios")
        .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
        .first();
      if (portfolio) {
        await ctx.db.patch(portfolio._id, {
          avatarUrl: patch.avatarUrl || undefined,
          updatedAt: Date.now(),
        });
      }
    }
    await ctx.db.patch(user._id, next);
    return true;
  },
});

/** Change the account email (re-verification happens on next sign-in). */
export const updateEmail = mutation({
  args: { token: v.string(), email: v.string() },
  handler: async (ctx, { token, email }) => {
    const user = await requirePortfolioUser(ctx, token);
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      throw new Error("Enter a valid email address.");
    }
    if (normalized === user.email) return true;
    const clash = await ctx.db
      .query("portfolioUsers")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (clash) throw new Error("That email is already in use.");
    await ctx.db.patch(user._id, { email: normalized });
    return true;
  },
});

/* ════════════════════════════ ADMIN bridge ══════════════════════════════
   The Portfolio admin (/adminbrand) manages creators. These helpers are
   guarded by the ADMIN session — a creator session can never call them.
   ════════════════════════════════════════════════════════════════════════ */

/** List creators with search (admin only). */
export const adminListUsers = query({
  args: { token: v.string(), q: v.optional(v.string()) },
  handler: async (ctx, { token, q }) => {
    await requirePortfolioAdminSession(ctx, token);
    const needle = (q ?? "").trim().toLowerCase();
    const rows = await ctx.db
      .query("portfolioUsers")
      .withIndex("by_createdAt")
      .order("desc")
      .take(500);
    const filtered = needle
      ? rows.filter((u) =>
          `${u.email} ${u.name ?? ""} ${u.title ?? ""}`
            .toLowerCase()
            .includes(needle),
        )
      : rows;
    return Promise.all(
      filtered.slice(0, 200).map(async (u) => {
        const sessions = await ctx.db
          .query("portfolioUserSessions")
          .withIndex("by_user", (qq) => qq.eq("userId", u._id))
          .collect();
        return {
          _id: u._id,
          email: u.email,
          name: u.name ?? null,
          title: u.title ?? null,
          avatarUrl: u.avatarUrl ?? null,
          status: u.status,
          onboarded: u.onboarded,
          invitedByAdmin: !!u.invitedByAdmin,
          lastLoginAt: u.lastLoginAt ?? null,
          createdAt: u.createdAt,
          activeSessions: sessions.filter((s) => s.expiresAt > Date.now()).length,
        };
      }),
    );
  },
});

/** Create a creator account directly (admin invite — passwordless). */
export const adminCreateUser = mutation({
  args: {
    token: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, { token, email, name, title }) => {
    await requirePortfolioAdminSession(ctx, token);
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      throw new Error("Enter a valid email address.");
    }
    const clash = await ctx.db
      .query("portfolioUsers")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (clash) throw new Error("An account with that email already exists.");

    const id = await ctx.db.insert("portfolioUsers", {
      email: normalized,
      name: name?.trim().slice(0, 80) || undefined,
      title: title?.trim().slice(0, 120) || undefined,
      role: PORTFOLIO_USER_ROLE,
      status: "active",
      onboarded: false,
      invitedByAdmin: true,
      createdAt: Date.now(),
    });
    return id;
  },
});

/** Suspend / restore a creator (admin). Suspended creators cannot sign in. */
export const adminSetUserStatus = mutation({
  args: {
    token: v.string(),
    userId: v.id("portfolioUsers"),
    status: v.union(v.literal("active"), v.literal("suspended")),
  },
  handler: async (ctx, { token, userId, status }) => {
    await requirePortfolioAdminSession(ctx, token);
    await ctx.db.patch(userId, { status });
    if (status === "suspended") {
      // Kill live sessions immediately.
      const sessions = await ctx.db
        .query("portfolioUserSessions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const s of sessions) await ctx.db.delete(s._id);
    }
    return true;
  },
});

/** Admin edit of a creator's profile (name/title/bio/avatar). */
export const adminUpdateUser = mutation({
  args: {
    token: v.string(),
    userId: v.id("portfolioUsers"),
    name: v.optional(v.string()),
    title: v.optional(v.string()),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, { token, userId, ...patch }) => {
    await requirePortfolioAdminSession(ctx, token);
    const next: Partial<Doc<"portfolioUsers">> = {};
    if (patch.name !== undefined) {
      const clean = patch.name.trim().slice(0, 80);
      if (clean.length < 2) throw new Error("Name needs at least 2 characters.");
      next.name = clean;
    }
    if (patch.title !== undefined)
      next.title = patch.title.trim().slice(0, 120) || undefined;
    if (patch.bio !== undefined)
      next.bio = patch.bio.trim().slice(0, 600) || undefined;
    await ctx.db.patch(userId, next);
    return true;
  },
});

/** Revoke all sessions for one creator (admin "revoke access"). */
export const adminRevokeSessions = mutation({
  args: { token: v.string(), userId: v.id("portfolioUsers") },
  handler: async (ctx, { token, userId }) => {
    await requirePortfolioAdminSession(ctx, token);
    const sessions = await ctx.db
      .query("portfolioUserSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);
    return sessions.length;
  },
});

/** Delete a creator account (admin, dangerous). */
export const adminDeleteUser = mutation({
  args: { token: v.string(), userId: v.id("portfolioUsers") },
  handler: async (ctx, { token, userId }) => {
    await requirePortfolioAdminSession(ctx, token);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Account not found.");
    // Remove their portfolio + projects first (keep the DB consistent).
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .first();
    if (portfolio) {
      const projects = await ctx.db
        .query("portfolioProjects")
        .withIndex("by_portfolio", (q) => q.eq("portfolioId", portfolio._id))
        .collect();
      for (const p of projects) await ctx.db.delete(p._id);
      await ctx.db.delete(portfolio._id);
    }
    const sessions = await ctx.db
      .query("portfolioUserSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);
    await ctx.db.delete(userId);
    return true;
  },
});

/** Email a creator from the admin portal (goes through Portfolio mail). */
export const adminEmailUser = mutation({
  args: {
    token: v.string(),
    userId: v.id("portfolioUsers"),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { token, userId, subject, body }) => {
    await requirePortfolioAdminSession(ctx, token);
    const user = await ctx.db.get(userId);
    if (!user?.email) throw new Error("That account has no email address.");
    await ctx.scheduler.runAfter(0, internal.portfolioEmailLog.deliver, {
      to: user.email,
      subject: subject.trim().slice(0, 200) || "A message from ForgeX Network",
      html: `<div style="font-family:system-ui,sans-serif;background:#0b0d08;color:#f2f6ec;padding:32px;border-radius:16px">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#a3e635">ForgeX Network · Portfolio</p>
        <div style="margin-top:12px;line-height:1.7;color:#c9d1c2">${body
          .split("\n")
          .map((l) => `<p style="margin:0 0 10px">${escapeHtml(l) || "&nbsp;"}</p>`)
          .join("")}</div>
      </div>`,
      template: "custom",
      kind: "custom",
    });
    return true;
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Admin stats for the creators tab. */
export const adminUsersStats = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requirePortfolioAdminSession(ctx, token);
    const rows = await ctx.db.query("portfolioUsers").collect();
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
      total: rows.length,
      active: rows.filter((u) => u.status === "active").length,
      suspended: rows.filter((u) => u.status === "suspended").length,
      pendingOnboarding: rows.filter((u) => !u.onboarded).length,
      newToday: rows.filter((u) => u.createdAt > dayAgo).length,
    };
  },
});

/* Re-export for route guards elsewhere. */
export type PortfolioUserPublic = {
  _id: Id<"portfolioUsers">;
  email: string;
  name: string | null;
  title: string | null;
  avatarUrl: string | null;
  onboarded: boolean;
  role: string;
  status: string;
};
