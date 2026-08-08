import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Download,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Lock,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/dash/PageHeader";
import { ImageUploader, type UploadedImage } from "@/components/media/ImageUploader";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { formatBytes, muxThumb } from "@/lib/media";
import { formatDateShort } from "@/lib/format";
import { getAdminToken } from "@/lib/admin-session";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  uploading: { label: "Uploading", cls: "bg-amber-400/12 text-amber-300" },
  processing: { label: "Processing", cls: "bg-sky-400/12 text-sky-300" },
  ready: { label: "Ready", cls: "bg-lime-400/12 text-lime-300" },
};

export default function AdminMedia() {
  const token = getAdminToken() ?? "";
  const media = useQuery(api.cloudinary.mediaList, token ? { token } : "skip");
  const videos = useQuery(api.media.videosList, token ? { token } : "skip");
  const documents = useQuery(api.storage.documentsList, token ? { token } : "skip");
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
      width: img.width,
      height: img.height,
      format: img.format,
      bytes: img.bytes,
      token,
    });
    setLabel("");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Media library"
        description="Everything in one place — separated by type: Images (Cloudinary), Videos (Mux) and private Documents."
      />

      <Tabs defaultValue="images">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="images" className="gap-1.5">
            <ImageIcon className="size-4" /> Images
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-1.5">
            <Film className="size-4" /> Videos
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="size-4" /> Documents
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------ IMAGES ------------------------------ */}
        <TabsContent value="images" className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-card p-6">
            <h2 className="font-display text-base font-semibold">Upload an image → Cloudinary</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              JPG, PNG or WebP from any device — auto-optimized by Cloudinary and
              added to the library with its dimensions & format. Videos never go here.
            </p>
            <div className="mt-4 max-w-md space-y-3">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (optional, e.g. 'Launch banner')"
                className="border-white/10 bg-black/20"
              />
              <ImageUploader label="Upload from device" hint="Media library" record={{ kind: "general" }} onUploaded={(img) => void handleUploaded(img)} />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-card">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="font-display flex items-center gap-2 text-base font-semibold">
                <ImageIcon className="size-4 text-lime-300" /> Image library ({media?.length ?? 0})
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
                        {m.publicId}
                        {m.format ? ` · ${m.format.toUpperCase()}` : ""}
                        {m.width && m.height ? ` · ${m.width}×${m.height}` : ""}
                        {m.bytes ? ` · ${formatBytes(m.bytes)}` : ""}
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
        </TabsContent>

        {/* ------------------------------ VIDEOS ------------------------------ */}
        <TabsContent value="videos" className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-card p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                <Video className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold">Mux video library ({videos?.length ?? 0})</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Every course video uploaded through Mux appears here with its
                  playback ID and generated thumbnail. Videos are streamed and
                  processed by Mux — separate from Cloudinary image records.
                </p>
              </div>
            </div>
          </section>

          {videos === undefined ? (
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-xl border border-white/8 bg-black/20" />
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-card p-10 text-center text-sm text-muted-foreground">
              <Film className="size-8 text-white/20" />
              <p>No Mux videos yet. Tutors upload course videos from their course editor.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => {
                const meta = STATUS_META[v.status] ?? STATUS_META.uploading;
                const thumb = muxThumb(v.playbackId);
                return (
                  <div key={v._id} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    <div className="relative aspect-video w-full bg-black">
                      {thumb ? (
                        <img src={thumb} alt={v.title} className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Film className="size-8 text-white/20" />
                        </div>
                      )}
                      <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="truncate text-sm font-medium">{v.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {v.uploaderName} · {formatDateShort(v.createdAt)}
                      </p>
                      {v.courseTitle && (
                        <p className="truncate text-[11px] text-lime-300/80">Course: {v.courseTitle}</p>
                      )}
                      {v.playbackId && (
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          playback: {v.playbackId}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ---------------------------- DOCUMENTS ----------------------------- */}
        <TabsContent value="documents" className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-card p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-400/12 text-sky-300">
                <Lock className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold">Private documents ({documents?.length ?? 0})</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  CVs and verification files uploaded by tutors. They live in secure
                  private storage with unguessable URLs — never public Cloudinary
                  images. Only admins can list them here.
                </p>
              </div>
            </div>
          </section>

          {documents === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-white/8 bg-black/20" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-card p-10 text-center text-sm text-muted-foreground">
              <FileText className="size-8 text-white/20" />
              <p>No private documents yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
              <div className="divide-y divide-white/5">
                {documents.map((d) => (
                  <div key={d._id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-400/12 text-sky-300">
                      <FileText className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {d.uploaderName} · {d.purpose} · {formatBytes(d.size)} · {formatDateShort(d.createdAt)}
                      </p>
                    </div>
                    {d.url && (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-lime-300 transition-colors hover:bg-lime-400/10"
                      >
                        <Download className="size-3.5" /> Open
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
        Sensitive tutor documents (NIN, CV) are never stored as public Cloudinary
        images — they stay in private storage and are only visible to admins.
      </p>
    </div>
  );
}
