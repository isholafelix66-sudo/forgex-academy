import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Internal email relay — lets the V8-runtime auth provider (@convex-dev/auth
 * sendVerificationRequest) reach the node-runtime Gmail SMTP action.
 *
 * Auth: shared internal key (INTERNAL_EMAIL_KEY env var, or the deployment
 * default). The endpoint only accepts {to, code, kind} and builds the branded
 * template itself — it can never be used to send arbitrary content.
 */
const INTERNAL_KEY = process.env.INTERNAL_EMAIL_KEY ?? "fx-internal-relay-v1";

export const internalEmailRelay = httpAction(async (ctx, request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const key = request.headers.get("x-internal-key");
  if (key !== INTERNAL_KEY) return new Response("Unauthorized", { status: 401 });

  let body: { to?: string; code?: string; kind?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { to, code, kind } = body;
  if (!to || !code || (kind !== "otp" && kind !== "password_reset")) {
    return new Response("Bad request", { status: 400 });
  }

  try {
    const result = await ctx.runAction(internal.emailService.sendAuthCodeEmail, {
      to,
      code,
      kind,
    });
    return Response.json(result);
  } catch (err) {
    // Full detail in server logs; the caller only needs "try fallback".
    console.error("[email-relay] failed:", err);
    return Response.json({ sent: false, fallback: true });
  }
});

http.route({
  path: "/api/internal/email-relay",
  method: "POST",
  handler: internalEmailRelay,
});

export default http;
