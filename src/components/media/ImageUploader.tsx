import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Camera,
  GalleryHorizontalEnd,
  ImagePlus,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdminToken } from "@/lib/admin-session";

export type UploadedImage = {
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

const ACCEPT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPT_ATTR = "image/jpeg,image/png,image/webp";
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024; // 15 MB

type CloudinaryResponse = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

/**
 * Reusable, device-first image uploader — works on Android, iPhone, tablet and
 * desktop:
 *   - Gallery / file picker
 *   - Camera / photo capture on mobile
 *   - Drag & drop on desktop
 *   - Live preview, replace, remove
 *   - Upload progress + friendly error handling
 *   - JPG / JPEG / PNG / WEBP only
 *
 * Uploads straight to Cloudinary via the unsigned preset (secrets stay
 * server-side) and returns the Cloudinary metadata. When `record` is set, the
 * upload is also saved into the media library (with the admin token when an
 * admin session is active, otherwise as the signed-in user).
 */
export function ImageUploader({
  value,
  label = "Upload image",
  hint,
  onUploaded,
  onClear,
  className,
  record,
  maxBytes = DEFAULT_MAX_BYTES,
  compact = false,
}: {
  value?: string | null;
  label?: string;
  hint?: string;
  onUploaded: (img: UploadedImage) => void;
  onClear?: () => void;
  className?: string;
  /** Auto-add to the media library on upload. */
  record?: { kind: string; label?: string };
  maxBytes?: number;
  compact?: boolean;
}) {
  const config = useQuery(api.cloudinary.mediaConfig);
  const mediaRecord = useMutation(api.cloudinary.mediaRecord);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const token = getAdminToken();

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

  const validate = (file: File): string | null => {
    if (!ACCEPT_TYPES.includes(file.type)) {
      return "Unsupported file type — please choose a JPG, PNG or WEBP image.";
    }
    if (file.size > maxBytes) {
      return `File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`;
    }
    return null;
  };

  const upload = async (file: File) => {
    if (!config?.configured) return;
    const vErr = validate(file);
    if (vErr) {
      setError(vErr);
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", config.uploadPreset);
      const result = await new Promise<CloudinaryResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
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

      const img: UploadedImage = {
        publicId: result.public_id,
        secureUrl: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      };

      if (record) {
        try {
          await mediaRecord({
            publicId: img.publicId,
            secureUrl: img.secureUrl,
            kind: record.kind,
            label: record.label,
            width: img.width,
            height: img.height,
            format: img.format,
            bytes: img.bytes,
            token: token ?? undefined,
          });
        } catch {
          // Recording must never block a successful upload.
        }
      }

      onUploaded(img);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const pick = (ref: React.RefObject<HTMLInputElement | null>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = "";
    if (ref.current) ref.current.value = "";
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
      <div className={cn("rounded-xl border border-dashed border-amber-400/30 bg-amber-400/5 p-4 text-xs text-amber-200/90", className)}>
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
      {/* Gallery / file picker */}
      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={pick(galleryRef)}
      />
      {/* Camera / photo capture (mobile) */}
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPT_ATTR}
        capture="environment"
        className="hidden"
        onChange={pick(cameraRef)}
      />

      {value ? (
        <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/30" {...dropProps}>
          <img src={value} alt="" className={cn("w-full object-cover", compact ? "h-24" : "h-36")} />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Button type="button" size="sm" variant="outline" className="gap-1.5 border-white/25" onClick={() => galleryRef.current?.click()}>
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
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm transition-colors",
            compact ? "h-24" : "h-36",
            dragging
              ? "border-lime-400/60 bg-lime-400/10 text-lime-300"
              : "border-white/15 bg-black/20 text-muted-foreground hover:border-lime-400/40 hover:text-lime-300",
          )}
        >
          {busy ? (
            <>
              <Loader2 className="size-6 animate-spin text-lime-300" />
              <span className="text-xs">Uploading… {progress > 0 ? `${progress}%` : ""}</span>
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
              <span className="text-[11px]">Drop here, or use the buttons below</span>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-white/20"
                  onClick={() => galleryRef.current?.click()}
                >
                  <GalleryHorizontalEnd className="size-3.5" /> Gallery / files
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-white/20"
                  onClick={() => cameraRef.current?.click()}
                >
                  <Camera className="size-3.5" /> Camera
                </Button>
              </div>
              <span className="text-[11px] text-muted-foreground/70">JPG · PNG · WEBP (max {Math.round(maxBytes / 1024 / 1024)} MB)</span>
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
