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
import { uploadFileToConvex } from "@/lib/convex-upload";
import { friendlyError } from "@/lib/errors";

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
const VIDEO_ACCEPT_TYPES = [
  ...ACCEPT_TYPES,
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
const VIDEO_ACCEPT_ATTR = `${ACCEPT_ATTR},video/mp4,video/webm,video/quicktime`;
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
  adminToken,
  getUploadUrl,
  resolveUploadUrl,
  accept,
  acceptTypes,
  allowVideo = false,
  mux,
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
  /**
   * When set (password-gated admin portal), uploads fall back to built-in
   * Convex file storage when Cloudinary isn't configured — so branding
   * images (robot mascot, logo, about images) can always be uploaded with
   * zero external services.
   */
  adminToken?: string;
  /**
   * Anything that can hand out a one-time Convex storage upload URL (e.g. a
   * Portfolio creator or Portfolio admin session). When provided, uploads
   * work even without Cloudinary keys and without an Academy account.
   */
  getUploadUrl?: () => Promise<string>;
  /** Resolves an uploaded storage id to its public URL. */
  resolveUploadUrl?: (storageId: string) => Promise<string>;
  /** Override the accepted MIME types (e.g. to allow video). */
  accept?: string;
  acceptTypes?: string[];
  /** Accept videos too (camera roll, screen recordings) — Mux first. */
  allowVideo?: boolean;
  /** Optional Mux direct upload (adaptive streaming). */
  mux?: {
    createUpload: () => Promise<{ uploadId: string; uploadUrl: string }>;
    getPlaybackId: (
      uploadId: string,
    ) => Promise<{ url: string; mp4Url?: string } | null>;
  };
}) {
  const ACCEPTED = acceptTypes ?? (allowVideo ? VIDEO_ACCEPT_TYPES : ACCEPT_TYPES);
  const ACCEPT = accept ?? (allowVideo ? VIDEO_ACCEPT_ATTR : ACCEPT_ATTR);
  const config = useQuery(api.cloudinary.mediaConfig);
  const mediaRecord = useMutation(api.cloudinary.mediaRecord);
  const adminUploadUrl = useMutation(api.storage.adminGenerateUploadUrl);
  const adminResolveUrl = useMutation(api.storage.adminResolveUploadUrl);
  const useStorageFallback = !!adminToken;
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

  const isVideoFile = (file: File) => file.type.startsWith("video/");

  /**
   * Videos: Mux first (adaptive streaming), then Cloudinary video, then
   * built-in Convex storage — the first one that is configured wins, so a
   * missing key never blocks the upload.
   */
  const uploadVideo = async (file: File) => {
    setProgress(10);

    // 1) Mux direct upload.
    if (mux) {
      try {
        const { uploadId, uploadUrl } = await mux.createUpload();
        const put = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "video/mp4" },
          body: file,
        });
        if (!put.ok) throw new Error(`Mux upload failed (${put.status}).`);
        setProgress(70);
        // Mux processes asynchronously — poll briefly for the playback ID.
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const ready = await mux.getPlaybackId(uploadId);
          if (ready) {
            setProgress(100);
            onUploaded({
              publicId: uploadId,
              secureUrl: ready.mp4Url ?? ready.url,
              format: "mux",
              bytes: file.size,
            });
            return;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        throw new Error("Mux is still processing this video.");
      } catch (err) {
        // Fall through to Cloudinary / storage so the upload still succeeds.
        console.warn("[upload] Mux unavailable, falling back:", err);
      }
    }

    // 2) Cloudinary video (unsigned preset).
    if (config?.configured) {
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", config.uploadPreset);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${config.cloudName}/video/upload`,
        { method: "POST", body: form },
      );
      if (res.ok) {
        const result = (await res.json()) as CloudinaryResponse & {
          secure_url?: string;
        };
        setProgress(100);
        onUploaded({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
        return;
      }
    }

    // 3) Built-in storage (works with zero external keys).
    if (getUploadUrl && resolveUploadUrl) {
      const { storageId } = await uploadFileToConvex(file, getUploadUrl);
      const url = await resolveUploadUrl(storageId);
      if (!url) throw new Error("The video couldn't be stored — please try again.");
      setProgress(100);
      onUploaded({
        publicId: storageId,
        secureUrl: url,
        format: file.type.split("/")[1],
        bytes: file.size,
      });
      return;
    }

    throw new Error("Video uploads aren't available right now — try again shortly.");
  };

  const validate = (file: File): string | null => {
    if (!ACCEPTED.includes(file.type)) {
      return allowVideo
        ? "Unsupported file type — choose a JPG, PNG, WEBP, MP4, MOV or WEBM file."
        : "Unsupported file type — please choose a JPG, PNG or WEBP image.";
    }
    if (file.size > maxBytes) {
      return `File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`;
    }
    return null;
  };

  const upload = async (file: File) => {
    const vErr = validate(file);
    if (vErr) {
      setError(vErr);
      return;
    }
    if (!config?.configured && !useStorageFallback && !getUploadUrl) {
      setError("Uploads are unavailable right now — try again in a moment.");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      if (isVideoFile(file)) {
        await uploadVideo(file);
        return;
      }
      if (config?.configured) {
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
        return;
      }

      // Cloudinary not configured — session fallback: upload straight to
      // built-in Convex file storage (no external keys needed) and hand the
      // resolved public URL back to the caller.
      if (getUploadUrl && resolveUploadUrl) {
        setProgress(30);
        const { storageId } = await uploadFileToConvex(file, getUploadUrl);
        setProgress(70);
        const url = await resolveUploadUrl(storageId);
        if (!url) {
          throw new Error("The file couldn't be stored — please upload it again.");
        }
        setProgress(100);
        onUploaded({
          publicId: storageId,
          secureUrl: url,
          format: file.type.split("/")[1],
          bytes: file.size,
        });
        return;
      }

      // Admin portal fallback: built-in Convex file storage via admin session.
      if (useStorageFallback && adminToken) {
        setProgress(30);
        const { storageId } = await uploadFileToConvex(file, () =>
          adminUploadUrl({ token: adminToken }),
        );
        setProgress(70);
        const url = await adminResolveUrl({
          storageId: storageId as never,
          token: adminToken,
        });
        if (!url) {
          throw new Error("The image couldn't be stored — please upload it again.");
        }
        setProgress(100);
        onUploaded({
          publicId: storageId,
          secureUrl: url,
          format: file.type.split("/")[1],
          bytes: file.size,
        });
      }
    } catch (err) {
      setError(friendlyError(err, "Upload failed."));
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

  if (!config.configured && !useStorageFallback) {
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
        accept={ACCEPT}
        className="hidden"
        onChange={pick(galleryRef)}
      />
      {/* Camera / photo capture (mobile) */}
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPT}
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
