import { internal } from "./_generated/api";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { checkRateLimit, getValidAdminSession, ADMIN_ACCESS_PASSWORD } from "./lib";
import { hashPassword, verifyPassword, generateOtp } from "./adminCrypto";
import { otpEmail } from "./emailTemplates";

/**
 * Owner-level admin security.
 *
 * Everything in this module is enforced SERVER-SIDE:
 *  - The singleton `adminSecurity` document IS the Owner identity. There is
 *    exactly one and it can never be replaced or duplicated.
 *  - Sessions in `adminSessions` carry `revokedAt`; `getValidAdminSession`
 *    (used by EVERY admin function via `requireAdminSession`) rejects
 *    revoked tokens, so a revoked device can no longer reach the dashboard.
 *  - Password change requires: valid session → current password → OTP sent
 *    to the verified security email → correct OTP. Wrong/expired OTP never
 *    changes the password. On success every OTHER session is revoked.
 *  - Owner identity/security email can only be changed by an Owner session
 *    (minted exclusively with the Owner security password).
 */

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_SESSIONS_PER_IDENTITY = 50;
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** The singleton security doc, or null before Owner bootstrap. */
async function getSecurityDoc(ctx: QueryCtx | MutationCtx) {
  return ctx.db
    .query("adminSecurity")
    .withIndex("by_kind", (q) => q.eq("kind", "singleton"))
    .first();
}

async function getSecurityDocOrThrow(ctx: MutationCtx | QueryCtx) {
  const doc = await getSecurityDoc(ctx);
  if (!doc) {
    throw new Error(
      "Owner security is not set up yet. Complete the one-time Owner setup first.",
    );
  }
  return doc;
}

/** Password strength: min 10 chars, letters + digits. */
function validateNewPassword(pw: string): string | null {
  if (pw.length < 10) return "at least 10 characters";
  if (!/[A-Za-z]/.test(pw)) return "at least one letter";
  if (!/[0-9]/.test(pw)) return "at least one number";
  return null;
}

/** `fe•••••@gmail.com` — safe display of the security email. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••";
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

/** Revoke every admin session except `keepToken`. Returns count revoked. */
async function revokeOtherSessions(
  ctx: MutationCtx,
  keepToken: string,
): Promise<number> {
  const sessions = await ctx.db.query("adminSessions").collect();
  const now = Date.now();
  let count = 0;
  for (const s of sessions) {
    if (s.token === keepToken) continue;
    if (s.revokedAt) continue;
    await ctx.db.patch(s._id, { revokedAt: now });
    count += 1;
  }
  return count;
}

/** Mint a fresh admin session row; returns the token. */
async function mintSession(
  ctx: MutationCtx,
  opts: { ownerSession: boolean; label?: string },
): Promise<string> {
  // Opportunistic cleanup: drop revoked sessions and anything older than the
  // 12h TTL (2x grace) so the table stays small.
  const staleBefore = Date.now() - 2 * ADMIN_SESSION_TTL_MS;
  const all = await ctx.db.query("adminSessions").collect();
  for (const s of all) {
    if (s.revokedAt || s.createdAt < staleBefore) {
      await ctx.db.delete(s._id);
    }
  }
  // Hard cap so the table can never grow unbounded.
  const live = all.filter((s) => !s.revokedAt && s.createdAt >= staleBefore);
  if (live.length >= MAX_SESSIONS_PER_IDENTITY) {
    const oldest = live.sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest) await ctx.db.delete(oldest._id);
  }

  const token =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");
  await ctx.db.insert("adminSessions", {
    token,
    createdAt: Date.now(),
    label: opts.label,
    lastSeenAt: Date.now(),
    ownerSession: opts.ownerSession,
  });
  return token;
}

/** Public helper used by the admin gate: mint a session with Owner powers. */
export async function createOwnerSession(
  ctx: MutationCtx,
  label?: string,
): Promise<string> {
  return mintSession(ctx, { ownerSession: true, label });
}

/**
 * Throws unless the session token belongs to the Owner. Used by this module
 * and by other backend modules for operations only the Owner may perform.
 */
export async function requireOwnerSession(
  ctx: MutationCtx | QueryCtx,
  token: string,
): Promise<Doc<"adminSessions">> {
  const session = await getValidAdminSession(ctx, token);
  if (!session.ownerSession) {
    throw new Error("Owner access required.");
  }
  return session;
}

// ---------------------------------------------------------------------------
// Bootstrap — one-time Owner identity creation
// ---------------------------------------------------------------------------

/**
 * One-time Owner setup. Two admission paths, both audited:
 *  1. `bootstrapKey` matches the OWNER_BOOTSTRAP_KEY environment value, or
 *  2. no Owner exists yet AND `accessPassword` matches the current admin
 *     access password — i.e. only someone who already controls the admin
 *     dashboard can initialize Owner security.
 * Fails explicitly if the Owner already exists: the identity can never be
 * replaced, duplicated, or transferred.
 */
export const bootstrapOwner = mutation({
  args: {
    bootstrapKey: v.optional(v.string()),
    accessPassword: v.optional(v.string()),
    ownerName: v.string(),
    securityEmail: v.string(),
    password: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { bootstrapKey, accessPassword, ownerName, securityEmail, password, label },
  ) => {
    await checkRateLimit(
      ctx,
      "admin-owner-bootstrap",
      5,
      60 * 60 * 1000,
      "Too many setup attempts. Try again later.",
    );
    const existing = await getSecurityDoc(ctx);
    if (existing) {
      throw new Error(
        "Owner already exists. The Owner identity cannot be replaced.",
      );
    }

    let admitted = false;
    const expectedKey = process.env.OWNER_BOOTSTRAP_KEY;
    if (bootstrapKey && expectedKey && bootstrapKey === expectedKey) {
      admitted = true;
    }
    if (!admitted && accessPassword) {
      const ok = accessPassword.trim().toLowerCase() ===
        ADMIN_ACCESS_PASSWORD.trim().toLowerCase();
      if (ok) admitted = true;
    }
    if (!admitted) {
      throw new Error(
        "Setup requires the current admin access password (or the owner bootstrap key).",
      );
    }

    const email = securityEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid security email.");
    }
    const weak = validateNewPassword(password);
    if (weak) throw new Error(`Password needs ${weak}.`);
    if (!ownerName.trim()) throw new Error("Enter the Owner name.");

    await ctx.db.insert("adminSecurity", {
      kind: "singleton",
      ownerName: ownerName.trim().slice(0, 80),
      securityEmail: email,
      passwordHash: await hashPassword(password),
      updatedAt: Date.now(),
    });
    const token = await mintSession(ctx, { ownerSession: true, label });
    await ctx.db.insert("auditLogs", {
      action: "owner-bootstrap",
      detail: `Owner security identity initialized for ${maskEmail(email)}`,
      createdAt: Date.now(),
    });
    return { token };
  },
});

/** Whether the Owner identity exists (public info for the gate UI). */
export const ownerExists = query({
  args: {},
  handler: async (ctx) => {
    const doc = await getSecurityDoc(ctx);
    return {
      exists: !!doc,
      email: doc ? maskEmail(doc.securityEmail) : null,
    };
  },
});

// ---------------------------------------------------------------------------
// Identity (read) — current session + owner profile
// ---------------------------------------------------------------------------

/**
 * Identity of the current session. Returns null instead of throwing when the
 * token is invalid/expired/revoked so the Security section can never crash
 * the page mid-render.
 */
export const sessionIdentity = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    let session: Doc<"adminSessions">;
    try {
      session = await getValidAdminSession(ctx, token);
    } catch {
      return null;
    }
    const doc = await getSecurityDoc(ctx);
    return {
      isOwner: !!session.ownerSession,
      sessionId: session._id,
      label: session.label ?? "This device",
      createdAt: session.createdAt,
      expiresAt: session.createdAt + ADMIN_SESSION_TTL_MS,
      ownerName: doc?.ownerName ?? null,
      securityEmail: doc ? maskEmail(doc.securityEmail) : null,
      securityEmailFull: doc?.securityEmail ?? null,
      pendingPasswordChange: !!doc?.pendingPasswordChange,
    };
  },
});

// ---------------------------------------------------------------------------
// Sessions — list, heartbeat, revoke one, revoke all others
// ---------------------------------------------------------------------------

/** All live sessions for the Security section. Returns [] when unauthorized. */
export const listSessions = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    let current: Doc<"adminSessions">;
    try {
      current = await getValidAdminSession(ctx, token);
    } catch {
      return [];
    }
    const now = Date.now();
    return (await ctx.db.query("adminSessions").collect())
      .filter((s) => !s.revokedAt && now - s.createdAt <= ADMIN_SESSION_TTL_MS)
      .sort(
        (a, b) =>
          (b.lastSeenAt ?? b.createdAt) - (a.lastSeenAt ?? a.createdAt) ||
          b.createdAt - a.createdAt,
      )
      .slice(0, MAX_SESSIONS_PER_IDENTITY)
      .map((s) => ({
        _id: s._id,
        label: s.label ?? "Admin session",
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt ?? s.createdAt,
        ownerSession: !!s.ownerSession,
        isCurrent: s._id === current._id,
      }));
  },
});

/** Activity heartbeat from the open dashboard — keeps lastSeenAt fresh. */
export const heartbeatSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await getValidAdminSession(ctx, token);
    const now = Date.now();
    if (!session.lastSeenAt || now - session.lastSeenAt > 60 * 1000) {
      await ctx.db.patch(session._id, { lastSeenAt: now });
    }
    return true;
  },
});

/** Revoke one specific other session by id. */
export const revokeSession = mutation({
  args: { token: v.string(), sessionId: v.id("adminSessions") },
  handler: async (ctx, { token, sessionId }) => {
    const current = await getValidAdminSession(ctx, token);
    if (sessionId === current._id) {
      throw new Error("Use sign out to end the current session.");
    }
    const target = await ctx.db.get(sessionId);
    if (!target || target.revokedAt) {
      throw new Error("That session is no longer active.");
    }
    await ctx.db.patch(sessionId, { revokedAt: Date.now() });
    await ctx.db.insert("auditLogs", {
      action: "admin-session-revoked",
      detail: `Session "${target.label ?? "Admin session"}" signed out remotely`,
      createdAt: Date.now(),
    });
    return true;
  },
});

/**
 * Sign out every OTHER admin session; the current device stays signed in.
 * Revocation is enforced server-side by `getValidAdminSession`.
 */
export const signOutOtherDevices = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const current = await getValidAdminSession(ctx, token);
    const count = await revokeOtherSessions(ctx, current.token);
    await ctx.db.insert("auditLogs", {
      action: "admin-signout-others",
      detail: `Signed out ${count} other admin session${count === 1 ? "" : "s"}`,
      createdAt: Date.now(),
    });
    return { revoked: count };
  },
});

// ---------------------------------------------------------------------------
// Password change — Current password → OTP → confirm
// ---------------------------------------------------------------------------

/**
 * Step 1+2 of the flow: verify the CURRENT password, stage the new password
 * (hashed — plaintext is never stored), generate a 6-digit OTP and email it
 * to the verified security email. The password is NOT changed yet.
 * Owner session required: a plain admin gate session cannot change it.
 */
export const requestPasswordChange = mutation({
  args: {
    token: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { token, currentPassword, newPassword }) => {
    const session = await requireOwnerSession(ctx, token);
    const doc = await getSecurityDocOrThrow(ctx);

    await checkRateLimit(
      ctx,
      "admin-pwchange",
      5,
      15 * 60 * 1000,
      "Too many password-change attempts. Try again in 15 minutes.",
    );

    // 1) Current password must match.
    const ok = doc.passwordHash
      ? await verifyPassword(currentPassword, doc.passwordHash)
      : false;
    if (!ok) {
      await ctx.db.insert("auditLogs", {
        action: "admin-pwchange-failed",
        detail: "Password change blocked: current password did not match",
        createdAt: Date.now(),
      });
      throw new Error("Current password is incorrect.");
    }

    // 2) New password must be strong and different.
    const weak = validateNewPassword(newPassword);
    if (weak) throw new Error(`New password needs ${weak}.`);
    if (
      doc.passwordHash &&
      (await verifyPassword(newPassword, doc.passwordHash))
    ) {
      throw new Error("New password must be different from the current one.");
    }

    // 3) Cooldown between OTP sends.
    const pending = doc.pendingPasswordChange;
    if (pending && Date.now() - pending.requestedAt < OTP_RESEND_COOLDOWN_MS) {
      throw new Error("A code was just sent — check the security email.");
    }

    // 4) Stage everything; nothing changes until the OTP confirms.
    const otp = generateOtp(6);
    await ctx.db.patch(doc._id, {
      pendingPasswordChange: {
        newPasswordHash: await hashPassword(newPassword),
        otpHash: await hashPassword(otp),
        otpExpiresAt: Date.now() + OTP_TTL_MS,
        otpAttempts: 0,
        requestedAt: Date.now(),
        sessionToken: session.token,
      },
      updatedAt: Date.now(),
    });

    // 5) Email the OTP to the VERIFIED security email (server-side address,
    //    never client-supplied). Scheduled so delivery issues can't fail the
    //    mutation, and so the code never lands in logs.
    const tpl = otpEmail({ code: otp, expiryMinutes: 10 });
    await ctx.scheduler.runAfter(0, internal.email.sendEmail, {
      to: doc.securityEmail,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    await ctx.db.insert("auditLogs", {
      action: "admin-pwchange-otp-sent",
      detail: "Password change OTP emailed to the verified security email",
      createdAt: Date.now(),
    });
    return {
      sentTo: maskEmail(doc.securityEmail),
      expiresAt: Date.now() + OTP_TTL_MS,
    };
  },
});

/**
 * Step 3: confirm the OTP. Only a correct, unexpired OTP swaps in the new
 * password — wrong or expired codes never change it. On success every OTHER
 * admin session is revoked (previously signed-in devices are signed out),
 * while the device that performed the change stays logged in.
 */
export const confirmPasswordChange = mutation({
  args: { token: v.string(), otp: v.string() },
  handler: async (ctx, { token, otp }) => {
    const session = await requireOwnerSession(ctx, token);
    const doc = await getSecurityDocOrThrow(ctx);
    const pending = doc.pendingPasswordChange;
    if (!pending) throw new Error("No password change is in progress.");
    // The OTP can only be consumed by the session that requested it.
    if (pending.sessionToken !== session.token) {
      throw new Error("This code belongs to a different session.");
    }

    if (Date.now() > pending.otpExpiresAt) {
      await ctx.db.patch(doc._id, { pendingPasswordChange: undefined });
      throw new Error("That code expired. Start the password change again.");
    }
    if (pending.otpAttempts >= OTP_MAX_ATTEMPTS) {
      await ctx.db.patch(doc._id, { pendingPasswordChange: undefined });
      throw new Error("Too many wrong codes. Start the password change again.");
    }

    const ok = await verifyPassword(otp.trim(), pending.otpHash);
    if (!ok) {
      await ctx.db.patch(doc._id, {
        pendingPasswordChange: {
          ...pending,
          otpAttempts: pending.otpAttempts + 1,
        },
      });
      const left = OTP_MAX_ATTEMPTS - (pending.otpAttempts + 1);
      throw new Error(
        `Incorrect code.${
          left > 0
            ? ` ${left} attempt${left === 1 ? "" : "s"} left.`
            : " Start the password change again."
        }`,
      );
    }

    // Correct OTP → commit the new password hash and drop the pending state.
    await ctx.db.patch(doc._id, {
      passwordHash: pending.newPasswordHash,
      pendingPasswordChange: undefined,
      updatedAt: Date.now(),
    });

    // Invalidate all other admin sessions — other devices are signed out.
    const revoked = await revokeOtherSessions(ctx, session.token);

    await ctx.db.insert("auditLogs", {
      action: "admin-password-changed",
      detail: `Admin password changed via OTP; ${revoked} other session${
        revoked === 1 ? "" : "s"
      } signed out`,
      createdAt: Date.now(),
    });
    return { revoked };
  },
});

/** Cancel an in-flight password change (e.g. the user backs out). */
export const cancelPasswordChange = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await requireOwnerSession(ctx, token);
    const doc = await getSecurityDocOrThrow(ctx);
    if (doc.pendingPasswordChange) {
      await ctx.db.patch(doc._id, {
        pendingPasswordChange: undefined,
        updatedAt: Date.now(),
      });
    }
    return true;
  },
});

// ---------------------------------------------------------------------------
// Security email management — Owner session only, OTP-confirmed
// ---------------------------------------------------------------------------

/**
 * Change the verified security email. Requires an Owner session AND the
 * current password. The new address must confirm via an OTP sent to it, so
 * nobody can point the OTP target at an inbox they don't control.
 */
export const requestSecurityEmailChange = mutation({
  args: {
    token: v.string(),
    currentPassword: v.string(),
    newEmail: v.string(),
  },
  handler: async (ctx, { token, currentPassword, newEmail }) => {
    const session = await requireOwnerSession(ctx, token);
    const doc = await getSecurityDocOrThrow(ctx);
    await checkRateLimit(
      ctx,
      "admin-emailchange",
      5,
      15 * 60 * 1000,
      "Too many attempts. Try again in 15 minutes.",
    );

    const ok = doc.passwordHash
      ? await verifyPassword(currentPassword, doc.passwordHash)
      : false;
    if (!ok) throw new Error("Current password is incorrect.");

    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    if (email === doc.securityEmail) {
      throw new Error("That is already the security email.");
    }
    if (doc.pendingEmailChange) {
      throw new Error(
        "An email change is already in progress — confirm or cancel it first.",
      );
    }

    const otp = generateOtp(6);
    await ctx.db.patch(doc._id, {
      pendingEmailChange: {
        newEmail: email,
        otpHash: await hashPassword(otp),
        otpExpiresAt: Date.now() + OTP_TTL_MS,
        otpAttempts: 0,
        requestedAt: Date.now(),
        sessionToken: session.token,
      },
      updatedAt: Date.now(),
    });

    const tpl = otpEmail({ code: otp, expiryMinutes: 10 });
    await ctx.scheduler.runAfter(0, internal.email.sendEmail, {
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    await ctx.db.insert("auditLogs", {
      action: "owner-emailchange-otp-sent",
      detail: "Security email change OTP sent to the new address",
      createdAt: Date.now(),
    });
    return { sentTo: maskEmail(email) };
  },
});

/** Confirm the security-email change with the emailed OTP. */
export const confirmSecurityEmailChange = mutation({
  args: { token: v.string(), otp: v.string() },
  handler: async (ctx, { token, otp }) => {
    const session = await requireOwnerSession(ctx, token);
    const doc = await getSecurityDocOrThrow(ctx);
    const pending = doc.pendingEmailChange;
    if (!pending) throw new Error("No email change is in progress.");
    if (pending.sessionToken !== session.token) {
      throw new Error("This code belongs to a different session.");
    }
    if (Date.now() > pending.otpExpiresAt) {
      await ctx.db.patch(doc._id, { pendingEmailChange: undefined });
      throw new Error("That code expired. Start the email change again.");
    }
    if (pending.otpAttempts >= OTP_MAX_ATTEMPTS) {
      await ctx.db.patch(doc._id, { pendingEmailChange: undefined });
      throw new Error("Too many wrong codes. Start the email change again.");
    }
    const ok = await verifyPassword(otp.trim(), pending.otpHash);
    if (!ok) {
      await ctx.db.patch(doc._id, {
        pendingEmailChange: { ...pending, otpAttempts: pending.otpAttempts + 1 },
      });
      throw new Error("Incorrect code. Check the new email address's inbox.");
    }
    await ctx.db.patch(doc._id, {
      securityEmail: pending.newEmail,
      pendingEmailChange: undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLogs", {
      action: "owner-security-email-changed",
      detail: `Owner security email changed to ${maskEmail(pending.newEmail)}`,
      createdAt: Date.now(),
    });
    return true;
  },
});

/** Cancel an in-flight security email change. */
export const cancelSecurityEmailChange = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await requireOwnerSession(ctx, token);
    const doc = await getSecurityDocOrThrow(ctx);
    if (doc.pendingEmailChange) {
      await ctx.db.patch(doc._id, {
        pendingEmailChange: undefined,
        updatedAt: Date.now(),
      });
    }
    return true;
  },
});

export type { Id };
