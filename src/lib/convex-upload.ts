/**
 * Convex file-storage upload primitive (client-side), shared by every
 * uploader in the app (chat attachments, private documents).
 *
 * Contract (Convex ≥ 1.19 — the version installed here):
 *   1. Call a backend mutation that returns `ctx.storage.generateUploadUrl()`.
 *   2. POST the file bytes to that URL, with `Content-Type` set to the file's
 *      MIME type.
 *   3. The JSON response contains `{ storageId }` — the id to persist in the
 *      database.
 *
 * The pre-1.19 flow PUT the bytes and took the storage id from the last URL
 * path segment. That flow no longer works against current Convex backends:
 * the PUT is rejected at the network layer (no CORS headers on the error),
 * which the browser reports as `TypeError: Failed to fetch`. This module
 * implements the current POST flow.
 *
 * Errors are classified so callers can show the REAL reason — a blanket
 * "check your connection" is only ever shown when the device is genuinely
 * offline. Real error details are logged to the console in development.
 */

export const MAX_CONVEX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB per file

type GenerateUploadUrl = () => Promise<string>;

export type UploadedFile = { storageId: string };

function devLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.error("[ForgeX upload]", ...args);
  }
}

function offlineMessage() {
  return "You're offline — reconnect and try again.";
}

/**
 * Upload `file` to Convex file storage and return the storage id.
 *
 * Throws an `Error` with a user-presentable message. Network failures are
 * retried once; HTTP rejections surface the server's actual status/body.
 */
export async function uploadFileToConvex(
  file: File,
  generateUploadUrl: GenerateUploadUrl,
): Promise<UploadedFile> {
  if (file.size > MAX_CONVEX_UPLOAD_BYTES) {
    throw new Error(
      `File is too large — the limit is ${Math.round(MAX_CONVEX_UPLOAD_BYTES / 1024 / 1024)} MB per attachment.`,
    );
  }

  // 1) Ask the backend for a short-lived upload URL (valid ~1 hour).
  let postUrl: string;
  try {
    postUrl = await generateUploadUrl();
  } catch (err) {
    devLog("generateUploadUrl failed:", err);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error(offlineMessage());
    }
    throw new Error(
      "Couldn't start the upload — the upload service didn't respond. Please try again.",
    );
  }
  if (!postUrl) {
    throw new Error("Upload is unavailable right now — please try again.");
  }

  // 2) POST the bytes. One retry for genuine transient network failures.
  let res: Response | null = null;
  let lastNetworkError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(postUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (res.ok) break;
    } catch (err) {
      lastNetworkError = err;
      res = null; // network-level failure — one retry below
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 700));
  }

  if (!res) {
    devLog("upload POST failed at network level:", lastNetworkError);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error(offlineMessage());
    }
    throw new Error(
      "Network error while uploading — please try again in a moment.",
    );
  }

  if (!res.ok) {
    // Surface the real server reason instead of a generic message.
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      /* no body */
    }
    devLog(`upload rejected (${res.status}):`, detail || "(empty body)");
    if (res.status === 413) {
      throw new Error(
        "Upload failed — the file is too large for the server to accept.",
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Upload failed — your session expired. Sign in again and retry.",
      );
    }
    if (res.status === 400) {
      throw new Error(
        "Upload failed — the file type isn't accepted. Try a different file.",
      );
    }
    throw new Error(
      `Upload failed (server error ${res.status}) — please try again.`,
    );
  }

  // 3) The response is JSON: { storageId: "<id>" }
  let storageId = "";
  try {
    const data = (await res.json()) as { storageId?: unknown };
    if (typeof data.storageId === "string" && data.storageId) {
      storageId = data.storageId;
    }
  } catch (err) {
    devLog("upload response was not JSON:", err);
  }
  if (!storageId) {
    devLog("upload response missing storageId");
    throw new Error(
      "The upload didn't complete properly — please try again.",
    );
  }

  return { storageId };
}
