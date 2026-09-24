import { useRef, useState, type ReactNode } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { uploadFileToConvex } from "@/lib/convex-upload";
import { friendlyError } from "@/lib/errors";
import { getPortfolioUserToken } from "@/lib/portfolio-user-session";

/** True for URLs that should be rendered as video rather than a still. */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    /\.(mp4|webm|mov|m4v|m3u8)(\?|#|$)/i.test(url) ||
    url.includes("stream.mux.com") ||
    url.includes("res.cloudinary.com/video/upload")
  );
}

/** Small labelled field wrapper used across the portfolio editor. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  // Deliberately a div, not a <label>: these fields often contain buttons
  // (upload / camera) and a wrapping label would also activate the first
  // hidden file input, opening two file pickers at once.
  return (
    <div className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground/80">{hint}</span>}
    </div>
  );
}

/**
 * Image picker that uploads straight into Convex file storage — no external
 * service or keys required, and it works the same on phone, tablet and
 * desktop (gallery picker + camera capture).
 */
export function ImageField({
  value,
  onChange,
  label = "Upload image",
  height = "h-36",
  allowVideo = true,
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  height?: string;
  /** Accept a short video as well as an image (Mux → Cloudinary → storage). */
  allowVideo?: boolean;
}) {
  // Portfolio creator session (NOT the Academy user upload endpoints — a
  // creator has no Academy account), with Cloudinary preferred when the
  // project has keys and built-in storage as the always-available fallback.
  const creatorUploadUrl = useMutation(api.portfolioUploads.creatorUploadUrl);
  const creatorResolveUrl = useMutation(api.portfolioUploads.creatorResolveUrl);
  const muxCreate = useAction(api.portfolioVideo.createUpload);
  const muxPlayback = useAction(api.portfolioVideo.playbackId);
  const mediaConfig = useQuery(api.cloudinary.mediaConfig);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = getPortfolioUserToken() ?? "";

  const upload = async (file: File) => {
    const isVideo = file.type.startsWith("video/");
    if (isVideo && !allowVideo) {
      setError("Please choose an image (JPG, PNG or WEBP).");
      return;
    }
    if (!isVideo && !file.type.startsWith("image/")) {
      setError("Please choose an image (JPG, PNG or WEBP).");
      return;
    }
    const limit = isVideo ? 200 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > limit) {
      setError(
        isVideo
          ? "That video is larger than 200 MB — please choose a smaller clip."
          : "That image is larger than 15 MB — please pick a smaller one.",
      );
      return;
    }
    if (!token) {
      setError("Sign in to your Portfolio account to upload.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Videos: Mux (adaptive streaming) first, then Cloudinary video, then
      // built-in storage.
      if (isVideo) {
        if (mediaConfig?.configured) {
          const form = new FormData();
          form.append("file", file);
          form.append("upload_preset", mediaConfig.uploadPreset);
          const res = await fetch(
            `https://api.cloudinary.com/v1_1/${mediaConfig.cloudName}/video/upload`,
            { method: "POST", body: form },
          );
          if (res.ok) {
            const data = (await res.json()) as { secure_url?: string };
            if (data.secure_url) {
              onChange(data.secure_url);
              return;
            }
          }
        }
        try {
          const { uploadId, uploadUrl } = await muxCreate({
            token,
            role: "creator" as const,
            title: file.name,
          });
          const put = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "video/mp4" },
            body: file,
          });
          if (!put.ok) throw new Error(`Mux upload failed (${put.status}).`);
          for (let attempt = 0; attempt < 20; attempt += 1) {
            const ready = await muxPlayback({
              token,
              role: "creator" as const,
              uploadId,
            });
            if (ready?.url) {
              onChange(ready.mp4Url ?? ready.url);
              return;
            }
            await new Promise((r) => setTimeout(r, 2000));
          }
          throw new Error("Mux is still processing this video — try again shortly.");
        } catch (err) {
          console.warn("[portfolio upload] Mux unavailable, using storage:", err);
        }
      } else if (mediaConfig?.configured) {
        const form = new FormData();
        form.append("file", file);
        form.append("upload_preset", mediaConfig.uploadPreset);
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${mediaConfig.cloudName}/image/upload`,
          { method: "POST", body: form },
        );
        if (res.ok) {
          const data = (await res.json()) as { secure_url?: string };
          if (data.secure_url) {
            onChange(data.secure_url);
            return;
          }
        }
      }

      // Always-available fallback: built-in file storage.
      const { storageId } = await uploadFileToConvex(file, () =>
        creatorUploadUrl({ token }),
      );
      const url = await creatorResolveUrl({ token, storageId: storageId as never });
      if (!url) throw new Error("The file couldn't be stored.");
      onChange(url);
    } catch (err) {
      setError(friendlyError(err, "Upload failed."));
    } finally {
      setBusy(false);
    }
  };

  const pick =
    (ref: React.RefObject<HTMLInputElement | null>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void upload(file);
      e.target.value = "";
      if (ref.current) ref.current.value = "";
    };

  return (
    <div>
      <input
        ref={galleryRef}
        type="file"
        accept={allowVideo ? "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp"}
        className="hidden"
        onChange={pick(galleryRef)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={pick(cameraRef)}
      />

      {value ? (
        <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
          {isVideoUrl(value) ? (
            <video
              src={value}
              className={cn("w-full object-cover", height)}
              muted
              loop
              playsInline
              controls
            />
          ) : (
            <img src={value} alt="" className={cn("w-full object-cover", height)} />
          )}
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/25"
              onClick={() => galleryRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-rose-400/40 text-rose-300 hover:bg-rose-400/10"
              onClick={() => onChange(null)}
            >
              <Trash2 className="size-3.5" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 text-sm text-muted-foreground",
            height,
          )}
        >
          {busy ? (
            <>
              <Loader2 className="size-5 animate-spin text-lime-300" />
              <span className="text-xs">Uploading…</span>
            </>
          ) : (
            <>
              <span className="flex size-9 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                <ImagePlus className="size-4" />
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-white/20"
                  onClick={() => galleryRef.current?.click()}
                >
                  <UploadCloud className="size-3.5" /> {label}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-white/20"
                  onClick={() => cameraRef.current?.click()}
                >
                  Camera
                </Button>
              </div>
              <span className="text-[11px] text-muted-foreground/70">
                {allowVideo
                  ? "JPG · PNG · WEBP · MP4 · MOV (video up to 200 MB)"
                  : "JPG · PNG · WEBP (max 15 MB)"}
              </span>
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

/**
 * Repeatable list editor used by skills, experience, education, services and
 * social links. Items render into whatever card body the caller provides.
 */
export function ListEditor<T>({
  items,
  onChange,
  emptyLabel,
  addLabel,
  makeItem,
  renderItem,
  title,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  emptyLabel: string;
  addLabel: string;
  makeItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  title: (item: T, index: number) => string;
}) {
  const update = (index: number, patch: Partial<T>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/12 bg-black/20 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      )}

      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-2xl border border-white/10 bg-black/20 p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{title(item, index)}</p>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Move up"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Move down"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label="Remove"
                className="rounded-lg p-1.5 text-rose-300 transition-colors hover:bg-rose-400/10"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
          {renderItem(item, (patch) => update(index, patch))}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 border-dashed border-white/20 text-muted-foreground hover:border-lime-400/40 hover:text-lime-300"
        onClick={() => onChange([...items, makeItem()])}
      >
        <Plus className="size-4" /> {addLabel}
      </Button>
    </div>
  );
}

/** Plain text input styled for the editor (keeps labels consistent). */
export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="border-white/10 bg-black/20"
    />
  );
}
