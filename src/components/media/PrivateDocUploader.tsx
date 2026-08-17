import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FileText, Loader2, Paperclip, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/media";
import { uploadFileToConvex } from "@/lib/convex-upload";
import { friendlyError } from "@/lib/errors";

export type PrivateDoc = {
  storageId: string;
  url: string;
  name: string;
  size: number;
  mime: string;
};

const ACCEPT_ATTR =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Private document uploader (CVs, verification files).
 *
 * Files go to Convex private file storage (unguessable URL, never in the
 * public Cloudinary media library) and are recorded in the `documents` table
 * so only admins can list them. Works from any device file picker. The
 * upload uses the current Convex POST contract and the display URL is
 * resolved server-side by `recordDocument`.
 */
export function PrivateDocUploader({
  value,
  purpose,
  onUploaded,
  onClear,
  label = "Upload file",
  hint,
}: {
  value?: { name?: string | null; url?: string | null } | null;
  purpose: string;
  onUploaded: (doc: PrivateDoc) => void;
  onClear?: () => void;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const recordDocument = useMutation(api.storage.recordDocument);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) {
      setError(
        `File is too large — the limit is ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // POST to Convex storage (the current contract) — returns the real
      // storage id. The authoritative display URL is resolved server-side by
      // recordDocument below; never derive it from the upload endpoint.
      const { storageId } = await uploadFileToConvex(file, () =>
        generateUploadUrl({}),
      );

      const doc = await recordDocument({
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        storageId: storageId as never,
        purpose,
      });
      if (!doc?.url) {
        throw new Error(
          "The upload didn't complete properly — please try again.",
        );
      }

      onUploaded({
        storageId,
        url: doc.url,
        name: file.name,
        size: file.size,
        mime: file.type,
      });
    } catch (err) {
      setError(friendlyError(err, "Upload failed."));
    } finally {
      setBusy(false);
    }
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = "";
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept={ACCEPT_ATTR} className="hidden" onChange={pick} />

      {value?.url ? (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/12 text-lime-300">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <a href={value.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-lime-300 hover:underline">
              {value.name ?? "Document"}
            </a>
            <p className="text-[11px] text-muted-foreground">Stored privately — visible to admins only</p>
          </div>
          {onClear && (
            <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-300" onClick={onClear}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300 disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin text-lime-300" /> Uploading…
            </>
          ) : (
            <>
              <UploadCloud className="size-4" /> {label}
              <span className="hidden text-[11px] text-muted-foreground/70 sm:inline">
                PDF · DOC · DOCX (max {Math.round(MAX_BYTES / 1024 / 1024)} MB)
              </span>
            </>
          )}
        </button>
      )}

      {hint && !value?.url && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Paperclip className="size-3" /> {hint}
        </p>
      )}

      {error && (
        <p className="mt-2 rounded-lg border border-rose-400/25 bg-rose-400/8 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}

export { formatBytes };
