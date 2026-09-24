"use node";

/**
 * ForgeX Network PORTFOLIO — Mux video uploads (Node action).
 *
 * Creators and the Portfolio admin can upload a video straight from their
 * device. The file goes to Mux (adaptive streaming + a public playback URL);
 * when Mux isn't configured the browser falls back to Cloudinary video and,
 * finally, to built-in Convex file storage — so a video upload never fails
 * because a key is missing.
 *
 * Auth: Portfolio creator session token, or the Portfolio admin token. The
 * Academy user table is never consulted here.
 */

import { action, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

const API = "https://api.mux.com/video/v1";

function authHeader(): string {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Mux is not configured — add MUX_TOKEN_ID and MUX_TOKEN_SECRET in the Keys tab, or the upload will use Cloudinary / built-in storage instead.",
    );
  }
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function muxFetch(path: string, init?: RequestInit): Promise<unknown> {
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

type MuxUpload = { data?: { id?: string; url?: string } };
type MuxUploadStatus = { data?: { asset_id?: string } };
type MuxAsset = { data?: { playback_ids?: Array<{ id?: string }> } };

/** Creator or Portfolio admin? Both may upload video. */
async function requirePortfolioUploader(
  ctx: ActionCtx,
  token: string,
  role: "creator" | "admin",
): Promise<void> {
  if (!token) throw new Error("Sign in to upload a video.");
  if (role === "admin") {
    const valid = await ctx.runQuery(api.portfolioAdmin.sessionValid, { token });
    if (!valid) throw new Error("Portfolio admin access required.");
    return;
  }
  const creator = await ctx.runQuery(
    internal.portfolioUsers.internalCreatorByToken,
    { token },
  );
  if (!creator) throw new Error("Sign in to your Portfolio account to upload.");
}

/** Step 1: create a Mux direct upload → the URL the browser PUTs the file to. */
export const createUpload = action({
  args: {
    token: v.string(),
    role: v.union(v.literal("creator"), v.literal("admin")),
    title: v.optional(v.string()),
  },
  handler: async (ctx, { token, role, title }) => {
    await requirePortfolioUploader(ctx, token, role);
    const json = (await muxFetch("/uploads", {
      method: "POST",
      body: JSON.stringify({
        new_asset_settings: {
          playback_policy: ["public"],
          mp4_support: "standard",
          ...(title ? { passthrough: title.slice(0, 200) } : {}),
        },
        cors_origin: "*",
      }),
    })) as MuxUpload;

    const uploadId = json.data?.id;
    const uploadUrl = json.data?.url;
    if (!uploadId || !uploadUrl) {
      throw new Error("Mux didn't return an upload URL — try Cloudinary instead.");
    }
    return { uploadId, uploadUrl };
  },
});

/**
 * Step 2: poll until Mux has finished processing the upload. Returns the
 * public playback id (or null while it's still processing).
 */
export const playbackId = action({
  args: {
    token: v.string(),
    role: v.union(v.literal("creator"), v.literal("admin")),
    uploadId: v.string(),
  },
  handler: async (ctx, { token, role, uploadId }) => {
    await requirePortfolioUploader(ctx, token, role);
    const upload = (await muxFetch(`/uploads/${uploadId}`)) as MuxUploadStatus;
    const assetId = upload.data?.asset_id;
    if (!assetId) return null;
    const asset = (await muxFetch(`/assets/${assetId}`)) as MuxAsset;
    const playback = asset.data?.playback_ids?.[0]?.id;
    if (!playback) return null;
    return {
      assetId,
      playbackId: playback,
      /** Ready-to-embed MP4/HLS URL, stored on the portfolio item. */
      url: `https://stream.mux.com/${playback}.m3u8`,
      mp4Url: `https://stream.mux.com/${playback}/high.mp4`,
    };
  },
});
