import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Camera, ImagePlus, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export type UploadedImage = { publicId: string; secureUrl: string };

/**
 * Device-first image uploader: file picker, camera (mobile), drag & drop on
 * desktop, live preview and progress. Uploads straight to Cloudinary with the
 * admin's unsigned preset — no image-URL copy/paste needed.
 */
export function ImageUploader({
  value,
  label = "Upload image",
  hint,
  onUploaded,
  onClear,
  className,
}: {
  value?: string | null;
  label?: string;
  hint?: string;
  onUploaded: (img: UploadedImage) => void;
  onClear?: () => void;
  className?: string;
}) {
  const config = useQuery(api.cloudinary.mediaConfig);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onDrop = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", onDrop);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDrop);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const upload = async (file: File) => {
    if (!config?.configured) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", config.uploadPreset);
      const xhr = new XMLHttpRequest();
      const result = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`);
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
      onUploaded({ publicId: result.public_id, secureUrl: result.secure_url });
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
  };

  if (config === undefined) return null;

  if (!config.configured) {
    return (
      <div className={`rounded-xl border border-dashed border-amber-400/30 bg-amber-400/5 p-4 text-xs text-amber-200/90 ${className ?? ""}`}>
        <p className="font-semibold">Cloudinary is not configured yet.</p>
        <p className="mt-1 leading-relaxed">
          Add <code className="rounded bg-black/40 px-1">CLOUDINARY_CLOUD_NAME</code>,{" "}
          <code className="rounded bg-black/40 px-1">CLOUDINARY_UPLOAD_PRESET</code> (unsigned),
          <code className="rounded bg-black/40 px-1">CLOUDINARY_API_KEY</code> and{" "}
          <code className="rounded bg-black/40 px-1">CLOUDINARY_API_SECRET</code> in the Keys tab to
          enable device uploads.
        </p>
      </div>
    );
  }

  return (
    <div className={className ?? ""}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        capture="environment"
        className="hidden"
        onChange={pick}
      />

      {value ? (
        <div
          className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/30"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
        >
          <img src={value} alt="" className="h-36 w-full object-cover" />
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          className={`flex h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm transition-colors ${
            dragging
              ? "border-lime-400/60 bg-lime-400/10 text-lime-300"
              : "border-white/15 bg-black/20 text-muted-foreground hover:border-lime-400/40 hover:text-lime-300"
          }`}
        >
          {busy ? (
            <>
              <Loader2 className="size-6 animate-spin text-lime-300" />
              <span className="text-xs">
                Uploading… {progress > 0 ? `${progress}%` : ""}
              </span>
              <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-lime-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : (
            <>
              <span className="flex size-10 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                {hint ? <Camera className="size-5" /> : <ImagePlus className="size-5" />}
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <UploadCloud className="size-4" /> {label}
              </span>
              <span className="text-[11px]">Gallery · Camera · Drag & drop · JPG/PNG/WebP</span>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="mt-2 rounded-lg border border-rose-400/25 bg-rose-400/8 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
