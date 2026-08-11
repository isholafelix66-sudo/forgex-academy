/**
 * Chat attachments — photos, files and voice notes sent through the chat.
 *
 * Files are uploaded to Convex file storage using the documented browser
 * flow:
 *   1. ask the backend for a one-time upload URL (storage.generateUploadUrl)
 *   2. PUT the file bytes to that URL
 *   3. the storage id is the last path segment of the upload URL
 *   4. send storageId + metadata with the message — the SERVER resolves the
 *      authoritative playback URL via ctx.storage.getUrl(storageId), so we
 *      never rely on a client-derived URL for playback.
 */

export type ChatAttachment = {
  kind: "image" | "file" | "voice";
  storageId: string;
  /** Client-derived hint; the server replaces it with the real URL. */
  url?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number; // seconds, for voice notes
};

export const MAX_CHAT_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

type GenerateUploadUrl = () => Promise<string>;

export async function uploadChatFile(
  file: File,
  kind: ChatAttachment["kind"],
  generateUploadUrl: GenerateUploadUrl,
  duration?: number,
): Promise<ChatAttachment> {
  if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new Error("File is too large (max 25 MB).");
  }

  let uploadUrl: string;
  try {
    uploadUrl = await generateUploadUrl();
  } catch {
    throw new Error(
      "Couldn't start the upload — check your connection and try again.",
    );
  }
  if (!uploadUrl) {
    throw new Error("Upload is unavailable right now — please try again.");
  }

  // The storage id is the last path segment of the upload URL
  // (…/api/storage/<storageId>). Parse defensively — never trust the exact
  // URL shape blindly.
  let storageId = "";
  try {
    storageId = new URL(uploadUrl).pathname.split("/").pop() ?? "";
  } catch {
    storageId = uploadUrl.split("/").pop() ?? "";
  }
  if (!storageId) {
    throw new Error("Upload failed — please try again.");
  }

  // PUT the bytes, retrying once for transient network failures.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (res.ok) break;
    } catch {
      res = null; // network error — one retry below
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
  }
  if (!res || !res.ok) {
    throw new Error(
      "Upload failed — check your connection and try again.",
    );
  }

  // Best-effort client URL (the server re-resolves it via getUrl, so a
  // failure here is not fatal).
  let url = "";
  try {
    const u = new URL(uploadUrl);
    url = `${u.origin}${u.pathname}`;
  } catch {
    url = "";
  }

  return {
    kind,
    storageId,
    ...(url ? { url } : {}),
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    ...(duration !== undefined ? { duration } : {}),
  };
}

/** m:ss voice-note duration, e.g. 0:07 or 1:03. */
export function formatVoiceDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
