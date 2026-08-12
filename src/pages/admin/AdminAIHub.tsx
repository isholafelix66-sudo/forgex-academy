import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  PlayCircle,
  Pencil,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { SafeImage } from "@/components/site/SafeImage";
import { ImageUploader } from "@/components/media/ImageUploader";
import { AI_CATEGORIES, AI_RESOURCE_TYPES, AI_PRICING_TYPES } from "@/convex/aiResources";
import { formatDate, timeAgo } from "@/lib/format";
import { getAdminToken } from "@/lib/admin-session";

type Resource = NonNullable<
  ReturnType<typeof useQuery<typeof api.aiResources.listAll>>
>[number];

const TYPE_LABEL: Record<string, string> = {
  tool: "Tool",
  article: "Article",
  tutorial: "Tutorial",
  "setup-guide": "Setup guide",
  "learning-resource": "Learning resource",
};

const PRICING_LABEL: Record<string, string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
};

const FILTERS: Array<{ key: "all" | "published" | "draft"; label: string }> = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
];

function PricingBadge({ pricing }: { pricing: string }) {
  const styles =
    pricing === "free"
      ? "border-lime-400/30 bg-lime-400/10 text-lime-300"
      : pricing === "freemium"
        ? "border-sky-400/30 bg-sky-400/10 text-sky-300"
        : "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${styles}`}
    >
      {PRICING_LABEL[pricing] ?? pricing}
    </span>
  );
}

/** A bare-minimum valid thumbnail for grid rows (used when none is set). */
function ThumbFallback({ title }: { title: string }) {
  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime-400/25 to-emerald-500/10 text-lime-300">
      <Bot className="size-5" />
    </div>
  );
}

type FormState = {
  title: string;
  description: string;
  category: string;
  resourceType: string;
  url: string;
  thumbnailUrl: string;
  thumbnailPublicId: string;
  pricingType: string;
  noCreditCard: boolean;
  instructions: string[];
  videoUrl: string;
  body: string;
  lastVerified: string; // yyyy-mm-dd, empty = unset
  published: boolean;
  featured: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  category: "",
  resourceType: "tool",
  url: "",
  thumbnailUrl: "",
  thumbnailPublicId: "",
  pricingType: "free",
  noCreditCard: false,
  instructions: [],
  videoUrl: "",
  body: "",
  lastVerified: "",
  published: false,
  featured: false,
};

function ResourceEditor({
  initial,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  initial: FormState;
  saving: boolean;
  error: string | null;
  onChange: (next: FormState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...initial, [key]: value });

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ai-title">Resource name</Label>
          <Input
            id="ai-title"
            value={initial.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. ChatGPT, Runway, Midjourney"
            className="h-10 border-white/10 bg-black/20"
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-url">External URL</Label>
          <Input
            id="ai-url"
            value={initial.url}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://…"
            inputMode="url"
            className="h-10 border-white/10 bg-black/20"
            maxLength={2000}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-desc">Short description</Label>
        <Textarea
          id="ai-desc"
          value={initial.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What is this resource and why should ForgeX learners use it?"
          className="min-h-20 resize-y border-white/10 bg-black/20"
          maxLength={600}
        />
        <div className="text-right text-xs text-muted-foreground">
          {initial.description.trim().length}/600
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={initial.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger className="w-full border-white/10 bg-black/20">
              <SelectValue placeholder="Pick a category" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-card">
              {AI_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={initial.resourceType} onValueChange={(v) => set("resourceType", v)}>
            <SelectTrigger className="w-full border-white/10 bg-black/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-card">
              {AI_RESOURCE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Pricing</Label>
          <Select value={initial.pricingType} onValueChange={(v) => set("pricingType", v)}>
            <SelectTrigger className="w-full border-white/10 bg-black/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-card">
              {AI_PRICING_TYPES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRICING_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {initial.resourceType === "article" || initial.resourceType === "learning-resource" ? (
        <div className="space-y-2">
          <Label htmlFor="ai-body">Article / post content</Label>
          <Textarea
            id="ai-body"
            value={initial.body}
            onChange={(e) => set("body", e.target.value)}
            placeholder={
              "Write the article here. Formatting:\n\n## A section heading\n\nA paragraph of text. A blank line starts a new paragraph.\n\n- A bullet point\n- Another bullet point\n\n**Bold** text is supported."
            }
            className="min-h-64 resize-y border-white/10 bg-black/20 font-mono text-sm leading-relaxed"
            maxLength={50000}
          />
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Blank line = new paragraph · <code className="text-lime-300">## </code> = heading ·{" "}
              <code className="text-lime-300">- </code> = bullet · <code className="text-lime-300">**bold**</code>
            </span>
            <span>{initial.body.trim().length}/50000</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="ai-video">Video URL (tutorials / guides)</Label>
          <Input
            id="ai-video"
            value={initial.videoUrl}
            onChange={(e) => set("videoUrl", e.target.value)}
            placeholder="https://www.youtube.com/watch?v=… or direct .mp4 link"
            inputMode="url"
            className="h-10 border-white/10 bg-black/20"
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground">
            YouTube, Vimeo or a direct video file — shown inside the resource detail on the public hub.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Thumbnail / logo</Label>
          <ImageUploader
            compact
            value={initial.thumbnailUrl}
            label="Add thumbnail or logo"
            onUploaded={(img) =>
              onChange({
                ...initial,
                thumbnailUrl: img.secureUrl,
                thumbnailPublicId: img.publicId,
              })
            }
            onClear={() =>
              onChange({ ...initial, thumbnailUrl: "", thumbnailPublicId: "" })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Last verified</Label>
          <Input
            type="date"
            value={initial.lastVerified}
            onChange={(e) => set("lastVerified", e.target.value)}
            className="h-10 border-white/10 bg-black/20"
          />
          <p className="text-xs text-muted-foreground">
            When you last confirmed this resource still works.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Checkbox
            id="ai-nocc"
            checked={initial.noCreditCard}
            onCheckedChange={(v) => set("noCreditCard", v === true)}
          />
          <Label htmlFor="ai-nocc" className="cursor-pointer font-normal">
            Verified — no credit card required
          </Label>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-3">
            <Checkbox
              id="ai-published"
              checked={initial.published}
              onCheckedChange={(v) => set("published", v === true)}
            />
            <Label htmlFor="ai-published" className="cursor-pointer font-normal">
              Published (visible on the public AI Hub)
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="ai-featured"
              checked={initial.featured}
              onCheckedChange={(v) => set("featured", v === true)}
            />
            <Label htmlFor="ai-featured" className="cursor-pointer font-normal">
              Featured (homepage + top of the hub)
            </Label>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Step-by-step instructions (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Short steps — useful for tutorials and setup guides. Add up to 12 steps.
        </p>
        <div className="space-y-2">
          {initial.instructions.map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-xs font-bold text-lime-300">
                {i + 1}
              </span>
              <Textarea
                value={step}
                onChange={(e) => {
                  const next = [...initial.instructions];
                  next[i] = e.target.value;
                  set("instructions", next);
                }}
                placeholder={`Step ${i + 1}`}
                className="min-h-10 resize-y border-white/10 bg-black/20"
                maxLength={400}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-1 size-8 shrink-0 text-muted-foreground hover:text-rose-300"
                onClick={() => set("instructions", initial.instructions.filter((_, j) => j !== i))}
                aria-label={`Remove step ${i + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        {initial.instructions.length < 12 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/15"
            onClick={() => set("instructions", [...initial.instructions, ""])}
          >
            <Plus className="size-3.5" /> Add a step
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <DialogFooter className="gap-2 sm:justify-end">
        <Button variant="outline" className="border-white/15" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={onSave}
          disabled={saving}
          className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {initial.title ? "Save changes" : "Add resource"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function AIHubManager() {
  const token = getAdminToken() ?? "";
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const resources = useQuery(
    api.aiResources.listAll,
    token ? { token } : "skip",
  );
  const createResource = useMutation(api.aiResources.createResource);
  const updateResource = useMutation(api.aiResources.updateResource);
  const deleteResource = useMutation(api.aiResources.deleteResource);
  const setResourcePublished = useMutation(api.aiResources.setResourcePublished);
  const setResourceFeatured = useMutation(api.aiResources.setResourceFeatured);

  const filtered = useMemo(() => {
    if (!resources) return undefined;
    const q = search.trim().toLowerCase();
    return resources.filter((r) => {
      if (filter === "published" && !r.published) return false;
      if (filter === "draft" && r.published) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [resources, filter, search]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (r: Resource) => {
    setForm({
      title: r.title,
      description: r.description,
      category: r.category,
      resourceType: r.resourceType,
      url: r.url,
      thumbnailUrl: r.thumbnailUrl ?? "",
      thumbnailPublicId: r.thumbnailPublicId ?? "",
      pricingType: r.pricingType,
      noCreditCard: r.noCreditCard,
      instructions: r.instructions ?? [],
      videoUrl: r.videoUrl ?? "",
      body: r.body ?? "",
      lastVerified: r.lastVerifiedAt
        ? new Date(r.lastVerifiedAt).toISOString().slice(0, 10)
        : "",
      published: r.published,
      featured: r.featured,
    });
    setEditingId(r._id as string);
    setFormError(null);
    setDialogOpen(true);
  };

  const lastVerifiedTs = form.lastVerified
    ? new Date(`${form.lastVerified}T12:00:00`).getTime()
    : undefined;

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    const payload = {
      token,
      title: form.title,
      description: form.description,
      category: form.category,
      resourceType: form.resourceType,
      url: form.url,
      thumbnailUrl: form.thumbnailUrl || undefined,
      thumbnailPublicId: form.thumbnailPublicId || undefined,
      pricingType: form.pricingType as "free" | "freemium" | "paid",
      noCreditCard: form.noCreditCard,
      instructions: form.instructions.filter((s) => s.trim().length > 0),
      videoUrl: form.videoUrl.trim() || undefined,
      body: form.body.trim() || undefined,
      lastVerifiedAt: lastVerifiedTs,
      published: form.published,
      featured: form.featured,
    };
    try {
      if (editingId) {
        await updateResource({ ...payload, id: editingId as never });
        toast.success("Resource updated.");
      } else {
        await createResource(payload);
        toast.success("Resource added.");
      }
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save the resource. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (r: Resource) => {
    setBusyId(r._id as string);
    try {
      await setResourcePublished({ token, id: r._id as never, published: !r.published });
      toast.success(r.published ? "Unpublished (removed from the public hub)." : "Published to the AI Hub.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update publish status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleFeatured = async (r: Resource) => {
    setBusyId(r._id as string);
    try {
      await setResourceFeatured({ token, id: r._id as never, featured: !r.featured });
      toast.success(r.featured ? "Removed from featured." : "Featured on the homepage & hub.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update featured status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteResource({ token, id: id as never });
      toast.success("Resource deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the resource.");
    } finally {
      setBusyId(null);
    }
  };

  const publishedCount = resources?.filter((r) => r.published).length ?? 0;
  const draftCount = resources?.filter((r) => !r.published).length ?? 0;
  const featuredCount = resources?.filter((r) => r.featured).length ?? 0;

  return (
    <div>
      <PageHeader
        title="AI Hub"
        description="Curate the ForgeX AI Hub. Drafts stay private; only published resources appear on the public site, and only published resources can be featured."
        actions={
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-lime-400" /> {publishedCount} published
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5 text-amber-300" /> {draftCount} drafts
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="size-3.5 fill-lime-400 text-lime-400" /> {featuredCount} featured
            </span>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                  : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resources…"
              className="h-9 w-56 border-white/10 bg-black/20 pl-9"
            />
          </div>
          <Button
            size="sm"
            onClick={openCreate}
            className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">Add resource</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {resources === undefined || filtered === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-black/20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Bot className="size-6" />}
          title={resources.length === 0 ? "No resources yet" : "Nothing matches"}
          description={
            resources.length === 0
              ? "Add your first AI resource, tutorial or setup guide — then publish it to make it live on the public AI Hub."
              : "Try a different search or filter."
          }
          action={
            resources.length === 0 ? (
              <Button onClick={openCreate} className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                <Plus className="size-4" /> Add your first resource
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r._id as string}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {r.thumbnailUrl ? (
                    <SafeImage
                      src={r.thumbnailUrl}
                      alt={r.title}
                      className="size-12 shrink-0 rounded-xl object-cover"
                      fallback={<ThumbFallback title={r.title} />}
                    />
                  ) : (
                    <ThumbFallback title={r.title} />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display truncate text-sm font-semibold">
                        {r.title}
                      </p>
                      {r.featured && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold text-lime-300">
                          <Star className="size-2.5 fill-lime-400" /> Featured
                        </span>
                      )}
                      {!r.published && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          <Clock3 className="size-2.5" /> Draft
                        </span>
                      )}
                      <PricingBadge pricing={r.pricingType} />
                    </div>
                    <p className="mt-0.5 line-clamp-2 max-w-xl text-sm text-muted-foreground">
                      {r.description}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{r.category}</span>
                      <span>·</span>
                      <span className="capitalize">{TYPE_LABEL[r.resourceType] ?? r.resourceType}</span>
                      {r.videoUrl && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-lime-300/80">
                            <PlayCircle className="size-3" /> Video
                          </span>
                        </>
                      )}
                      {r.body && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-lime-300/80">
                            <FileText className="size-3" /> Article
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span>Updated {timeAgo(r.updatedAt)}</span>
                      {r.noCreditCard && <span>· No credit card</span>}
                      {r.lastVerifiedAt && (
                        <span>· Verified {formatDate(r.lastVerifiedAt)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-lime-300"
                    disabled={busyId === (r._id as string)}
                    onClick={() => void handleToggleFeatured(r)}
                    title={r.featured ? "Remove from featured" : "Feature on homepage"}
                  >
                    {busyId === (r._id as string) ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Star className={`size-4 ${r.featured ? "fill-lime-400 text-lime-400" : ""}`} />
                    )}
                    <span className="hidden lg:inline">{r.featured ? "Featured" : "Feature"}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-sky-300"
                    disabled={busyId === (r._id as string)}
                    onClick={() => void handleTogglePublished(r)}
                    title={r.published ? "Unpublish (hide from public)" : "Publish to the hub"}
                  >
                    {busyId === (r._id as string) ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : r.published ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                    <span className="hidden lg:inline">{r.published ? "Published" : "Draft"}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(r)}
                  >
                    <Pencil className="size-4" />
                    <span className="hidden lg:inline">Edit</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground hover:text-rose-300"
                        disabled={busyId === (r._id as string)}
                      >
                        <Trash2 className="size-4" />
                        <span className="hidden lg:inline">Delete</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-white/10 bg-card">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-display">Delete “{r.title}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently removes the resource from the AI Hub and the
                          homepage. This can’t be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/15">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-rose-500 text-white hover:bg-rose-600"
                          onClick={() => void handleDelete(r._id as string)}
                        >
                          {busyId === (r._id as string) ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && !saving && setDialogOpen(false)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-card sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Bot className="size-5 text-lime-400" />
              {editingId ? "Edit AI resource" : "Add an AI resource"}
            </DialogTitle>
            <DialogDescription>
              Save as a draft to keep it private, or publish it to appear on the public AI Hub
              right away.
            </DialogDescription>
          </DialogHeader>
          <ResourceEditor
            initial={form}
            saving={saving}
            error={formError}
            onChange={setForm}
            onSave={() => void handleSave()}
            onCancel={() => !saving && setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminAIHub() {
  return <AIHubManager />;
}
