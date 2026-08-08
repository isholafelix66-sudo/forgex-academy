import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dash/PageHeader";
import { ImageUploader, type UploadedImage } from "@/components/admin/ImageUploader";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { formatDateShort } from "@/lib/format";
import { getAdminToken } from "@/lib/admin-session";

export default function AdminMedia() {
  const token = getAdminToken() ?? "";
  const media = useQuery(api.cloudinary.mediaList, token ? { token } : "skip");
  const mediaRecord = useMutation(api.cloudinary.mediaRecord);
  const mediaDelete = useAction(api.cloudinary.mediaDelete);
  const [label, setLabel] = useState("");
  const [deleting, setDeleting] = useState<NonNullable<typeof media>[number] | null>(null);
  const [busy, setBusy] = useState(false);

  const handleUploaded = async (img: UploadedImage) => {
    await mediaRecord({
      publicId: img.publicId,
      secureUrl: img.secureUrl,
      kind: "general",
      label: label.trim() || undefined,
      token,
    });
    setLabel("");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Media library"
        description="Images uploaded across the platform — stored on Cloudinary and managed here."
      />

      <section className="rounded-2xl border border-white/10 bg-card p-6">
        <h2 className="font-display text-base font-semibold">Upload an image</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Uploads go straight from your device to Cloudinary and are added to
          the library. Unused images can be deleted here at any time.
        </p>
        <div className="mt-4 max-w-md space-y-3">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional, e.g. 'Launch banner')"
            className="border-white/10 bg-black/20"
          />
          <ImageUploader label="Upload from device" hint="Media library" onUploaded={(img) => void handleUploaded(img)} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-card">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-display flex items-center gap-2 text-base font-semibold">
            <ImageIcon className="size-4 text-lime-300" /> Library ({media?.length ?? 0})
          </h2>
        </div>
        {media === undefined ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl border border-white/8 bg-black/20" />
            ))}
          </div>
        ) : media.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <UploadCloud className="size-8 text-white/20" />
            <p>No images yet. Upload your first image above.</p>
          </div>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((m) => (
              <div key={m._id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <img src={m.secureUrl} alt={m.label ?? m.kind} className="h-40 w-full object-cover" />
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="truncate text-xs font-semibold">{m.label ?? m.kind}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {m.publicId} · {formatDateShort(m.createdAt)}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-fit gap-1.5 border-rose-400/40 text-rose-300 hover:bg-rose-400/10"
                    onClick={() => setDeleting(m)}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this image?"
        description="The image is destroyed on Cloudinary and removed from the library. Anything still referencing it will show a placeholder."
        confirmLabel="Delete image"
        busy={busy}
        onConfirm={() => {
          if (!deleting) return;
          setBusy(true);
          void mediaDelete({ id: deleting._id as never, token }).finally(() => {
            setBusy(false);
            setDeleting(null);
          });
        }}
      />

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 text-lime-300" />
        Sensitive tutor documents (NIN, CV) are never stored here — they stay in
        private storage and are only visible to admins.
      </p>
    </div>
  );
}
