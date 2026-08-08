"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

const API = "https://api.mux.com/video/v1";

/** Basic-auth header from MUX_TOKEN_ID / MUX_TOKEN_SECRET (server env keys). */
function authHeader(): string {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Mux is not configured. Add MUX_TOKEN_ID and MUX_TOKEN_SECRET to your environment keys.",
    );
  }
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function muxFetch(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mux API error (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Require the caller to be an active (verified) tutor or admin. */
async function requireActiveTutor(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("You must be signed in to do that.");
  const user = await ctx.runQuery(internal.users.internalCurrentUser);
  if (!user) throw new Error("Account not found.");
  if (user.role === "admin") return;
  if (user.role !== "tutor" || !user.verified) {
    throw new Error("A verified tutor account is required to upload videos.");
  }
}

/**
 * Create a direct upload. Returns the tus upload URL the client should hand
 * to <MuxUploader endpoint={url} />. Assets are created with a public
 * playback policy so students can watch without tokens.
 */
export const createUpload = action({
  args: { title: v.optional(v.string()), corsOrigin: v.optional(v.string()) },
  handler: async (ctx, { title, corsOrigin }) => {
    await requireActiveTutor(ctx);
    const body = {
      new_asset_settings: {
        playback_policy: ["public"],
        mp4_support: "standard",
        ...(title ? { passthrough: title } : {}),
      },
      cors_origin: corsOrigin || "*",
    };
    const json = await muxFetch("/uploads", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      uploadId: json.data?.id as string,
      uploadUrl: json.data?.url as string,
    };
  },
});

/**
 * Poll an upload until Mux has processed it into an asset, then return the
 * public playback ID. Returns null while the upload is still processing.
 */
export const getPlaybackId = action({
  args: { uploadId: v.string() },
  handler: async (ctx, { uploadId }) => {
    await requireActiveTutor(ctx);
    const upload = await muxFetch(`/uploads/${uploadId}`);
    const assetId: string | undefined = upload.data?.asset_id;
    if (!assetId) return null; // still uploading / processing

    const asset = await muxFetch(`/assets/${assetId}`);
    const playbackId: string | undefined = asset.data?.playback_ids?.[0]?.id;
    return playbackId ? { assetId, playbackId } : null;
  },
});

/**
 * Mux video records for the media library live in `src/convex/media.ts`
 * (`recordVideo` / `videosList`) — they are mutations/queries that cannot run
 * in this Node-runtime action file.
 */
