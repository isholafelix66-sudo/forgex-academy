import { useRef, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
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
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  height?: string;
}) {
  const generateUrl = useMutation(api.storage.generateUploadUrl);
  const resolveUrl = useMutation(api.storage.resolveUploadedFile);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image (JPG, PNG or WEBP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("That image is larger than 10 MB — please pick a smaller one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { storageId } = await uploadFileToConvex(file, () => generateUrl({}));
      const url = await resolveUrl({ storageId: storageId as never });
      if (!url) throw new Error("The image couldn't be stored.");
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
        accept="image/jpeg,image/png,image/webp"
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
          <img src={value} alt="" className={cn("w-full object-cover", height)} />
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
                JPG · PNG · WEBP (max 10 MB)
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
