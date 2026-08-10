import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Clapperboard,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type UploadedVideo = {
  publicId: string;
  url: string; // playable Cloudinary URL (MP4-transcoded)
  format?: string;
  bytes?: number;
};

const ACCEPT_ATTR = "video/mp4,video/quicktime,video/webm,video/x-m4v";
const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

type CloudinaryVideoResponse = {
  public_id: string;
  secure_url: string;
  format?: string;
  bytes?: number;
};

/**
 * Device-first video uploader — the video twin of `ImageUploader`.
 *
 * Uploads MP4 / MOV / WebM straight from the browser to Cloudinary's
 * `/video/upload` endpoint using the SAME unsigned preset as images (no extra
 * keys, no Mux account needed). Cloudinary transcodes on delivery, so the
 * stored URL always plays everywhere.
 */
export function VideoUploader({
  value,
  label = "Upload video",
  onUploaded,
  onClear,
  className,
}: {
  value?: string | null;
  label?: string;
  onUploaded: (video: UploadedVideo) => void;
  onClear?: () => void;
  className?: string;
}) {
  const config = useQuery(api.cloudinary.mediaConfig);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Prevent the browser from navigating away when a file is dropped elsewhere.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const upload = async (file: File) => {
    if (!config?.configured) return;
    const isVideo =
      file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
    if (!isVideo) {
      setError("Unsupported file — please choose an MP4, MOV, WebM or M4V video.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Video is too large (max 500 MB).");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", config.uploadPreset);
      const result = await new Promise<CloudinaryVideoResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `https://api.cloudinary.com/v1_1/${config.cloudName}/video/upload`,
        );
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("Invalid upload response."));
            }
          } else {
            reject(new Error("Upload failed. Check your Cloudinary preset."));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.send(form);
      });

      // Force Cloudinary to deliver an MP4 (it transcodes MOV/WebM on the fly),
      // so the video plays in every browser.
      let url = result.secure_url;
      const marker = "/video/upload/";
      if (url.includes(marker)) {
        url = url.replace(marker, `${marker}f_mp4,q_auto/`);
      } else {
        url = url.replace("/upload/", "/upload/f_mp4,q_auto/");
      }

      onUploaded({
        publicId: result.public_id,
        url,
        format: result.format,
        bytes: result.bytes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = "";
    if (inputRef.current) inputRef.current.value = "";
  };

  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  if (config === undefined) return null;

  if (!config.configured) {
    return (
      <div className="rounded-xl border border-dashed border-amber-400/30 bg-amber-400/5 p-4 text-xs text-amber-200/90">
        <p className="font-semibold">Cloudinary is not configured yet.</p>
        <p className="mt-1 leading-relaxed">
          Add <code className="rounded bg-black/40 px-1">CLOUDINARY_CLOUD_NAME</code>,{" "}
          <code className="rounded bg-black/40 px-1">CLOUDINARY_UPLOAD_PRESET</code>{" "}
          (unsigned), <code className="rounded bg-black/40 px-1">CLOUDINARY_API_KEY</code>{" "}
          and <code className="rounded bg-black/40 px-1">CLOUDINARY_API_SECRET</code> in the
          Keys tab to enable device uploads.
        </p>
      </div>
    );
  }

  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: drop,
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={pick}
      />

      {value ? (
        <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/30" {...dropProps}>
          <video src={value} muted playsInline preload="metadata" className="h-36 w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Button type="button" size="sm" variant="outline" className="gap-1.5 border-white/25" onClick={() => inputRef.current?.click()}>
              <RefreshCw className="size-3.5" /> Replace
            </Button>
            {onClear && (
              <Button type="button" size="sm" variant="outline" className="gap-1.5 border-rose-400/40 text-rose-300 hover:bg-rose-400/10" onClick={onClear}>
                <Trash2 className="size-3.5" /> Remove
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          {...dropProps}
          className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 p-4 text-sm text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
        >
          {busy ? (
            <>
              <Loader2 className="size-6 animate-spin text-lime-300" />
              <span className="text-xs">Uploading… {progress > 0 ? `${progress}%` : ""}</span>
              <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-lime-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : (
            <>
              <span className="flex size-10 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                <Clapperboard className="size-5" />
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <UploadCloud className="size-4" /> {label}
              </span>
              <span className="text-[11px]">Drop here, or click to choose a file</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 border-white/20"
                onClick={() => inputRef.current?.click()}
              >
                <UploadCloud className="size-3.5" /> Choose video
              </Button>
              <span className="text-[11px] text-muted-foreground/70">MP4 · MOV · WebM (max 500 MB)</span>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-lg border border-rose-400/25 bg-rose-400/8 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
