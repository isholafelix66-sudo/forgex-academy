import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  FolderKanban,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dash/PageHeader";
import {
  Field,
  ImageField,
  TextInput,
  isVideoUrl,
} from "@/components/portfolio/PortfolioFields";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { getPortfolioUserToken } from "@/lib/portfolio-user-session";

type ProjectForm = {
  title: string;
  summary: string;
  description: string;
  imageUrl: string | null;
  category: string;
  tags: string;
  liveUrl: string;
  repoUrl: string;
  year: string;
  featured: boolean;
};

const EMPTY: ProjectForm = {
  title: "",
  summary: "",
  description: "",
  imageUrl: null,
  category: "",
  tags: "",
  liveUrl: "",
  repoUrl: "",
  year: "",
  featured: false,
};

/** Suggested work categories for the Explore filters — free text is allowed. */
const CATEGORY_SUGGESTIONS = [
  "Web",
  "Design",
  "Video",
  "Branding",
  "Mobile App",
  "Writing",
  "Photography",
];

export default function PortfolioProjects() {
  const userToken = getPortfolioUserToken();
  const data = useQuery(
    api.projects.myPortfolio,
    userToken ? { token: userToken } : "skip",
  );
  const createProject = useMutation(api.projects.createProject);
  const updateProject = useMutation(api.projects.updateProject);
  const deleteProject = useMutation(api.projects.deleteProject);
  const moveProject = useMutation(api.projects.moveProject);

  const [editing, setEditing] = useState<null | { id: Id<"portfolioProjects"> | null }>(null);
  const [form, setForm] = useState<ProjectForm>(EMPTY);
  const [busy, setBusy] = useState(false);

  const projects = useMemo(() => data?.projects ?? [], [data]);

  const openNew = () => {
    setForm(EMPTY);
    setEditing({ id: null });
  };

  const openEdit = (id: Id<"portfolioProjects">) => {
    const p = projects.find((x) => x._id === id);
    if (!p) return;
    setForm({
      title: p.title,
      summary: p.summary,
      description: p.description ?? "",
      imageUrl: p.imageUrl ?? null,
      category: p.category ?? "",
      tags: p.tags.join(", "),
      liveUrl: p.liveUrl ?? "",
      repoUrl: p.repoUrl ?? "",
      year: p.year ?? "",
      featured: !!p.featured,
    });
    setEditing({ id });
  };

  const submit = async () => {
    if (form.title.trim().length < 2) {
      toast.error("Give your project a title.");
      return;
    }
    setBusy(true);
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      if (editing?.id) {
        await updateProject({
          token: userToken ?? "",
          projectId: editing.id,
          title: form.title,
          summary: form.summary,
          description: form.description,
          imageUrl: form.imageUrl ?? undefined,
          category: form.category,
          tags,
          liveUrl: form.liveUrl,
          repoUrl: form.repoUrl,
          year: form.year,
          featured: form.featured,
        });
        toast.success("Project updated.");
      } else {
        await createProject({
          token: userToken ?? "",
          title: form.title,
          summary: form.summary,
          description: form.description,
          imageUrl: form.imageUrl ?? undefined,
          category: form.category,
          tags,
          liveUrl: form.liveUrl,
          repoUrl: form.repoUrl,
          year: form.year,
        });
        toast.success("Project added to your portfolio.");
      }
      setEditing(null);
    } catch (err) {
      toast.error(friendlyError(err, "Could not save the project."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: Id<"portfolioProjects">) => {
    try {
      await deleteProject({ token: userToken ?? "", projectId: id });
      toast.success("Project removed.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not remove the project."));
    }
  };

  const move = async (id: Id<"portfolioProjects">, direction: -1 | 1) => {
    try {
      await moveProject({ token: userToken ?? "", projectId: id, direction });
    } catch (err) {
      toast.error(friendlyError(err, "Could not reorder."));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="The work you want people to remember. Add live links, tags and images."
        actions={
          <Button
            onClick={openNew}
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            <Plus className="size-4" /> New project
          </Button>
        }
      />

      {!data ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/12 bg-card p-12 text-center">
          <FolderKanban className="mx-auto size-10 text-lime-300/70" />
          <h3 className="font-display mt-4 text-lg font-semibold">No projects yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Add your best work — a design, an app, a campaign, a piece of
            research. Three strong projects beat ten weak ones.
          </p>
          <Button
            onClick={openNew}
            className="mt-6 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            <Plus className="size-4" /> Add your first project
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((p, index) => (
            <li
              key={p._id}
              className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-card p-4 sm:flex-row sm:items-center"
            >
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/5">
                {p.imageUrl ? (
                  isVideoUrl(p.imageUrl) ? (
                    <video
                      src={p.imageUrl}
                      className="size-full object-cover"
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <img src={p.imageUrl} alt="" className="size-full object-cover" />
                  )
                ) : (
                  <FolderKanban className="size-5 text-muted-foreground" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{p.title}</p>
                  {p.featured && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold text-lime-300">
                      <Star className="size-2.5 fill-lime-400" /> Highlight
                    </span>
                  )}
                  {p.year && (
                    <span className="text-xs text-muted-foreground">{p.year}</span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.summary}</p>
                {p.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => void move(p._id, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  onClick={() => void move(p._id, 1)}
                  disabled={index === projects.length - 1}
                  aria-label="Move down"
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  onClick={() => openEdit(p._id)}
                  aria-label="Edit project"
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-lime-300"
                >
                  <Pencil className="size-4" />
                </button>
                {p.liveUrl && (
                  <a
                    href={p.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open live project"
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-lime-300"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
                <button
                  onClick={() => void remove(p._id)}
                  aria-label="Delete project"
                  className="rounded-lg p-2 text-rose-300 transition-colors hover:bg-rose-400/10"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Editor sheet */}
      {editing && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setEditing(null)}
        >
          <div
            className="my-8 w-full max-w-2xl rounded-3xl border border-white/10 bg-card p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-bold">
                {editing.id ? "Edit project" : "New project"}
              </h3>
              <button
                onClick={() => !busy && setEditing(null)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <TextInput
                  value={form.title}
                  onChange={(v) => setForm({ ...form, title: v })}
                  placeholder="Brand identity for Kola Foods"
                />
              </Field>
              <Field label="Year">
                <TextInput
                  value={form.year}
                  onChange={(v) => setForm({ ...form, year: v })}
                  placeholder="2025"
                />
              </Field>
              <Field
                label="Category (optional)"
                className="sm:col-span-2"
                hint={`Powers the Explore filters — e.g. ${CATEGORY_SUGGESTIONS.slice(0, 4).join(", ")}.`}
              >
                <TextInput
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                  placeholder="Web"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, category: c })}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        form.category === c
                          ? "border-lime-400/50 bg-lime-400/12 text-lime-300"
                          : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Summary" className="sm:col-span-2" hint="One or two lines shown on the card.">
                <Textarea
                  rows={2}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="A packaging and identity system for a Lagos food brand."
                  className="border-white/10 bg-black/20"
                />
              </Field>
              <Field label="Full description (optional)" className="sm:col-span-2">
                <Textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="border-white/10 bg-black/20"
                />
              </Field>
              <Field label="Tags" hint="Comma separated — e.g. Branding, Figma, Print">
                <TextInput
                  value={form.tags}
                  onChange={(v) => setForm({ ...form, tags: v })}
                  placeholder="Branding, Packaging"
                />
              </Field>
              <Field label="Live link (optional)">
                <TextInput
                  value={form.liveUrl}
                  onChange={(v) => setForm({ ...form, liveUrl: v })}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Source link (optional)">
                <TextInput
                  value={form.repoUrl}
                  onChange={(v) => setForm({ ...form, repoUrl: v })}
                  placeholder="https://github.com/…"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label="Cover media"
                  hint="Upload a photo or a short video straight from your device — it's shown on your public project card."
                >
                  <ImageField
                    value={form.imageUrl}
                    onChange={(url) => setForm({ ...form, imageUrl: url })}
                    label="Upload from device"
                    height="h-40"
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="accent-lime-400"
                />
                Highlight this project at the top of my portfolio
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="border-white/15"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void submit()}
                disabled={busy}
                className={cn(
                  "gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300",
                )}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {editing.id ? "Save changes" : "Add project"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
