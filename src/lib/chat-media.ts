/**
 * Chat attachments — photos, files and voice notes sent through the chat.
 *
 * Files are uploaded to Convex file storage using the current browser flow
 * (implemented in `convex-upload.ts`):
 *   1. ask the backend for a one-time upload URL (storage.generateUploadUrl)
 *   2. POST the file bytes to that URL — the JSON response carries the
 *      storage id
 *   3. send storageId + metadata with the message — the SERVER resolves the
 *      authoritative playback URL via ctx.storage.getUrl(storageId), so we
 *      never rely on a client-derived URL for playback.
 */

import {
  MAX_CONVEX_UPLOAD_BYTES,
  uploadFileToConvex,
} from "./convex-upload";

export type ChatAttachment = {
  kind: "image" | "file" | "voice";
  storageId: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number; // seconds, for voice notes
};

/** 25 MB per chat attachment (matches the backend limit). */
export const MAX_CHAT_ATTACHMENT_BYTES = MAX_CONVEX_UPLOAD_BYTES;

type GenerateUploadUrl = () => Promise<string>;

export async function uploadChatFile(
  file: File,
  kind: ChatAttachment["kind"],
  generateUploadUrl: GenerateUploadUrl,
  duration?: number,
): Promise<ChatAttachment> {
  // Size validation happens inside uploadFileToConvex (before any bytes are
  // sent) and throws the exact limit in the message.
  const { storageId } = await uploadFileToConvex(file, generateUploadUrl);

  return {
    kind,
    storageId,
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
