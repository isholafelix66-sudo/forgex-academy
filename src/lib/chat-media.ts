/**
 * Chat attachments — photos, files and voice notes sent through the chat.
 *
 * Files are uploaded to Convex private file storage (unguessable URL, same
 * mechanism the rest of the app uses for private documents). The upload flow:
 *   1. ask the backend for a one-time upload URL (storage.generateUploadUrl)
 *   2. PUT the file bytes to that URL
 *   3. derive the stable public URL + storage id from the upload URL
 *   4. send those as part of the message via messages.sendMessage
 */

export type ChatAttachment = {
  kind: "image" | "file" | "voice";
  storageId: string;
  url: string;
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

  const uploadUrl = await generateUploadUrl();
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error("Upload failed — please try again.");

  // The upload URL encodes the storage id in its path: /api/storage/<id>.
  const u = new URL(uploadUrl);
  const storageId = u.pathname.split("/").pop() ?? "";
  const url = `${u.origin}${u.pathname}`;

  return {
    kind,
    storageId,
    url,
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
