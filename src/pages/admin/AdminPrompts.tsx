import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  ArrowDown,
  ArrowUp,
  Braces,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  X,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { DIFFICULTY_META } from "@/lib/format";
import { timeAgo } from "@/lib/format";
import { getAdminToken } from "@/lib/admin-session";
import type { PromptField } from "@/convex/schema";

type Prompt = NonNullable<
  ReturnType<typeof useQuery<typeof api.prompts.listAll>>
>["prompts"][number];
type Category = NonNullable<
  ReturnType<typeof useQuery<typeof api.prompts.listAll>>
>["categories"][number];

const DIFFICULTIES = [
  "beginner",
  "intermediate",
  "advanced",
  "professional",
  "expert",
] as const;

const FILTERS: Array<{ key: "all" | "published" | "draft"; label: string }> = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
];

const EMPTY_FIELD: PromptFieldInput = {
  key: "",
  label: "",
  type: "text",
  placeholder: "",
  options: "",
  required: false,
};

type PromptFieldInput = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder: string;
  options: string;
  required: boolean;
};

type PromptForm = {
  title: string;
  description: string;
  categoryId: string;
  subcategory: string;
  tags: string;
  difficulty: string;
  usefulFor: string;
  requiredInputs: string[];
  template: string;
  fields: PromptFieldInput[];
  featured: boolean;
  published: boolean;
};

const EMPTY_FORM: PromptForm = {
  title: "",
  description: "",
  categoryId: "",
  subcategory: "",
  tags: "",
  difficulty: "",
  usefulFor: "",
  requiredInputs: [],
  template: "",
  fields: [],
  featured: false,
  published: false,
};

function difficultyBadge(d: string | undefined) {
  if (!d || !(d in DIFFICULTY_META)) return null;
  const meta = DIFFICULTY_META[d as keyof typeof DIFFICULTY_META];
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
      {meta.label}
    </span>
  );
}

function PromptEditor({
  initial,
  categories,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  initial: PromptForm;
  categories: Category[];
  saving: boolean;
  error: string | null;
  onChange: (next: PromptForm) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = <K extends keyof PromptForm>(key: K, value: PromptForm[K]) =>
    onChange({ ...initial, [key]: value });

  const setField = (i: number, patch: Partial<PromptFieldInput>) => {
    const next = [...initial.fields];
    next[i] = { ...next[i], ...patch };
    set("fields", next);
  };

  const activeCategory = categories.find((c) => c._id === initial.categoryId);

  // Live preview: fill every {{key}} with the field's placeholder (or label),
  // so the admin can see the template working as they build it.
  const preview = useMemo(() => {
    let out = initial.template;
    for (const f of initial.fields) {
      if (!f.key) continue;
      const sample = f.placeholder?.trim() || f.label?.trim() || f.key;
      out = out.replace(
        new RegExp(`\\{\\{${f.key}\\}\\}`, "g"),
        sample || `[${f.key}]`,
      );
    }
    return out.replace(/\s{2,}/g, " ").trim();
  }, [initial.template, initial.fields]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pp-title">Prompt title</Label>
          <Input
            id="pp-title"
            value={initial.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Luxury Product Photography"
            className="h-10 border-white/10 bg-black/20"
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={initial.categoryId || undefined}
            onValueChange={(v) => set("categoryId", v)}
          >
            <SelectTrigger className="w-full border-white/10 bg-black/20">
              <SelectValue placeholder="Pick a category" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-card">
              {categories.map((c) => (
                <SelectItem key={c._id as string} value={c._id as string}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pp-desc">Short description</Label>
        <Textarea
          id="pp-desc"
          value={initial.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What does this prompt do, and who is it for?"
          className="min-h-20 resize-y border-white/10 bg-black/20"
          maxLength={600}
        />
        <div className="text-right text-xs text-muted-foreground">
          {initial.description.trim().length}/600
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pp-useful">What is this prompt useful for?</Label>
        <Textarea
          id="pp-useful"
          value={initial.usefulFor}
          onChange={(e) => set("usefulFor", e.target.value)}
          placeholder="e.g. Premium product shots for e-commerce hero images and brand campaigns."
          className="min-h-16 resize-y border-white/10 bg-black/20"
          maxLength={600}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="pp-sub">Subcategory</Label>
          <Input
            id="pp-sub"
            list="pp-sub-list"
            value={initial.subcategory}
            onChange={(e) => set("subcategory", e.target.value)}
            placeholder="Optional"
            className="h-10 border-white/10 bg-black/20"
          />
          <datalist id="pp-sub-list">
            {(activeCategory?.subcategories ?? []).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pp-tags">Tags</Label>
          <Input
            id="pp-tags"
            value={initial.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="comma, separated, tags"
            className="h-10 border-white/10 bg-black/20"
          />
        </div>
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select
            value={initial.difficulty || undefined}
            onValueChange={(v) => set("difficulty", v)}
          >
            <SelectTrigger className="w-full border-white/10 bg-black/20">
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-card">
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d} value={d}>
                  {DIFFICULTY_META[d].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Required inputs (what the user must provide)</Label>
        <p className="text-xs text-muted-foreground">
          Short labels such as “Product name”, “Background”, “Lighting”. Add up to 12.
        </p>
        <div className="space-y-2">
          {initial.requiredInputs.map((input, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-xs font-bold text-lime-300">
                {i + 1}
              </span>
              <Input
                value={input}
                onChange={(e) => {
                  const next = [...initial.requiredInputs];
                  next[i] = e.target.value;
                  set("requiredInputs", next);
                }}
                placeholder={`Input ${i + 1}`}
                className="h-10 border-white/10 bg-black/20"
                maxLength={200}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 size-8 shrink-0 text-muted-foreground hover:text-rose-300"
                onClick={() =>
                  set("requiredInputs", initial.requiredInputs.filter((_, j) => j !== i))
                }
                aria-label={`Remove input ${i + 1}`}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        {initial.requiredInputs.length < 12 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/15"
            onClick={() => set("requiredInputs", [...initial.requiredInputs, ""])}
          >
            <Plus className="size-3.5" /> Add an input
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="pp-template">Prompt template</Label>
        <Textarea
          id="pp-template"
          value={initial.template}
          onChange={(e) => set("template", e.target.value)}
          placeholder={
            "Write the prompt with {{field-keys}} that the builder will replace, e.g.\n\nPhotograph {{product-name}} ({{product-type}}) for a luxury campaign with {{lighting}} lighting…"
          }
          className="min-h-40 resize-y border-white/10 bg-black/20 font-mono text-sm leading-relaxed"
          maxLength={10000}
        />
        <p className="text-xs text-muted-foreground">
          Use <code className="text-lime-300">{"{{field-key}}"}</code> placeholders — every one
          needs a matching input field below (lowercase letters, numbers and dashes).
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Input fields (dynamic builder)</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/15"
            disabled={initial.fields.length >= 12}
            onClick={() => set("fields", [...initial.fields, { ...EMPTY_FIELD }])}
          >
            <Plus className="size-3.5" /> Add a field
          </Button>
        </div>
        {initial.fields.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/15 bg-black/10 p-3 text-xs text-muted-foreground">
            No fields yet — the prompt will be static (no variables). Add a field for each{" "}
            <code className="text-lime-300">{"{{key}}"}</code> placeholder.
          </p>
        )}
        <div className="space-y-3">
          {initial.fields.map((f, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-black/15 p-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Label
                  </Label>
                  <Input
                    value={f.label}
                    onChange={(e) => setField(i, { label: e.target.value })}
                    placeholder="e.g. Product name"
                    className="h-9 border-white/10 bg-black/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Key (used as {"{{key}}"})
                  </Label>
                  <Input
                    value={f.key}
                    onChange={(e) =>
                      setField(i, { key: e.target.value.toLowerCase() })
                    }
                    placeholder="product-name"
                    className="h-9 border-white/10 bg-black/20 font-mono"
                  />
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Type
                  </Label>
                  <Select
                    value={f.type}
                    onValueChange={(v) =>
                      setField(i, { type: v as PromptFieldInput["type"] })
                    }
                  >
                    <SelectTrigger className="w-full border-white/10 bg-black/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-card">
                      <SelectItem value="text">Short text</SelectItem>
                      <SelectItem value="textarea">Long text</SelectItem>
                      <SelectItem value="select">Dropdown options</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Placeholder / sample
                  </Label>
                  <Input
                    value={f.placeholder}
                    onChange={(e) => setField(i, { placeholder: e.target.value })}
                    placeholder="Optional"
                    className="h-9 border-white/10 bg-black/20"
                  />
                </div>
              </div>
              {f.type === "select" && (
                <div className="mt-3 space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Options (comma separated)
                  </Label>
                  <Input
                    value={f.options}
                    onChange={(e) => setField(i, { options: e.target.value })}
                    placeholder="soft studio light, golden hour, dramatic low-key"
                    className="h-9 border-white/10 bg-black/20"
                  />
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`ppf-req-${i}`}
                    checked={f.required}
                    onCheckedChange={(v) => setField(i, { required: v === true })}
                  />
                  <Label
                    htmlFor={`ppf-req-${i}`}
                    className="cursor-pointer text-xs font-normal text-muted-foreground"
                  >
                    Required
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground hover:text-rose-300"
                  onClick={() =>
                    set("fields", initial.fields.filter((_, j) => j !== i))
                  }
                >
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {preview && (
        <div className="space-y-2">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Live preview
          </Label>
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-lime-400/20 bg-black/25 p-4 font-mono text-xs leading-relaxed text-foreground/85">
            {preview}
          </pre>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-3">
          <Checkbox
            id="pp-published"
            checked={initial.published}
            onCheckedChange={(v) => set("published", v === true)}
          />
          <Label htmlFor="pp-published" className="cursor-pointer font-normal">
            Published (visible on the public Prompt Library)
          </Label>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            id="pp-featured"
            checked={initial.featured}
            onCheckedChange={(v) => set("featured", v === true)}
          />
          <Label htmlFor="pp-featured" className="cursor-pointer font-normal">
            Featured (homepage + top of the library)
          </Label>
        </div>
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
          {initial.title ? "Save changes" : "Add prompt"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function CategoryEditor({
  initial,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  initial: { name: string; description: string; subcategories: string };
  saving: boolean;
  error: string | null;
  onChange: (next: { name: string; description: string; subcategories: string }) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="pc-name">Category name</Label>
        <Input
          id="pc-name"
          value={initial.name}
          onChange={(e) => onChange({ ...initial, name: e.target.value })}
          placeholder="e.g. Social Media"
          className="h-10 border-white/10 bg-black/20"
          maxLength={80}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pc-desc">Short description</Label>
        <Textarea
          id="pc-desc"
          value={initial.description}
          onChange={(e) => onChange({ ...initial, description: e.target.value })}
          placeholder="What kind of prompts live in this category?"
          className="min-h-16 resize-y border-white/10 bg-black/20"
          maxLength={400}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pc-subs">Subcategories</Label>
        <Input
          id="pc-subs"
          value={initial.subcategories}
          onChange={(e) => onChange({ ...initial, subcategories: e.target.value })}
          placeholder="comma, separated, subcategories"
          className="h-10 border-white/10 bg-black/20"
        />
        <p className="text-xs text-muted-foreground">
          Optional — shown as suggestions when assigning prompts, and filterable on the public page.
        </p>
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
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function AdminPrompts() {
  const token = getAdminToken() ?? "";
  const data = useQuery(api.prompts.listAll, token ? { token } : "skip");

  // Prompt list state
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [promptOpen, setPromptOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromptForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Category state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({
    name: "",
    description: "",
    subcategories: "",
  });
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  const createPrompt = useMutation(api.prompts.createPrompt);
  const updatePrompt = useMutation(api.prompts.updatePrompt);
  const deletePrompt = useMutation(api.prompts.deletePrompt);
  const setPromptPublished = useMutation(api.prompts.setPromptPublished);
  const setPromptFeatured = useMutation(api.prompts.setPromptFeatured);
  const movePrompt = useMutation(api.prompts.movePrompt);
  const createCategory = useMutation(api.prompts.createCategory);
  const updateCategory = useMutation(api.prompts.updateCategory);
  const deleteCategory = useMutation(api.prompts.deleteCategory);
  const moveCategory = useMutation(api.prompts.moveCategory);

  const prompts = data?.prompts;
  const categories = data?.categories ?? [];

  const filtered = useMemo(() => {
    if (!prompts) return undefined;
    const q = search.trim().toLowerCase();
    return prompts.filter((p) => {
      if (filter === "published" && !p.published) return false;
      if (filter === "draft" && p.published) return false;
      if (catFilter !== "all" && p.categoryId !== catFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.usefulFor.toLowerCase().includes(q)
      );
    });
  }, [prompts, filter, search, catFilter]);

  const openCreate = () => {
    setForm({
      ...EMPTY_FORM,
      categoryId: categories[0]?._id as string | "",
      published: true,
    });
    setEditingId(null);
    setFormError(null);
    setPromptOpen(true);
  };

  const openEdit = (p: Prompt) => {
    setForm({
      title: p.title,
      description: p.description,
      categoryId: p.categoryId as string,
      subcategory: p.subcategory ?? "",
      tags: p.tags.join(", "),
      difficulty: p.difficulty ?? "",
      usefulFor: p.usefulFor,
      requiredInputs: p.requiredInputs,
      template: p.template,
      fields: p.fields.map((f: PromptField) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        placeholder: f.placeholder ?? "",
        options: (f.options ?? []).join(", "),
        required: f.required === true,
      })),
      featured: p.featured,
      published: p.published,
    });
    setEditingId(p._id as string);
    setFormError(null);
    setPromptOpen(true);
  };

  const handleSavePrompt = async () => {
    if (!form.categoryId) {
      setFormError("Please pick a category first.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      token,
      title: form.title,
      description: form.description,
      categoryId: form.categoryId as never,
      subcategory: form.subcategory.trim() || undefined,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      difficulty:
        (form.difficulty as Prompt["difficulty"]) || undefined,
      usefulFor: form.usefulFor,
      requiredInputs: form.requiredInputs.filter((s) => s.trim().length > 0),
      template: form.template,
      fields: form.fields
        .filter((f) => f.label.trim() || f.key.trim())
        .map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          placeholder: f.placeholder.trim() || undefined,
          options:
            f.type === "select"
              ? f.options
                  .split(",")
                  .map((o) => o.trim())
                  .filter(Boolean)
              : undefined,
          required: f.required,
        })),
      featured: form.featured,
      published: form.published,
    };
    try {
      if (editingId) {
        await updatePrompt({ ...payload, id: editingId as never });
        toast.success("Prompt updated.");
      } else {
        await createPrompt(payload);
        toast.success("Prompt added.");
      }
      setPromptOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save the prompt. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (p: Prompt) => {
    setBusyId(p._id as string);
    try {
      await setPromptPublished({ token, id: p._id as never, published: !p.published });
      toast.success(p.published ? "Unpublished (hidden from the public library)." : "Published to the Prompt Library.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update publish status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleFeatured = async (p: Prompt) => {
    setBusyId(p._id as string);
    try {
      await setPromptFeatured({ token, id: p._id as never, featured: !p.featured });
      toast.success(p.featured ? "Removed from featured." : "Featured on the homepage & library.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update featured status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleMove = async (p: Prompt, direction: "up" | "down") => {
    setBusyId(p._id as string);
    try {
      await movePrompt({ token, id: p._id as never, direction });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reorder.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    setBusyId(id);
    try {
      await deletePrompt({ token, id: id as never });
      toast.success("Prompt deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the prompt.");
    } finally {
      setBusyId(null);
    }
  };

  // ----- Categories -----
  const openCatCreate = () => {
    setCatForm({ name: "", description: "", subcategories: "" });
    setEditingCatId(null);
    setCatError(null);
    setCatDialogOpen(true);
  };

  const openCatEdit = (c: Category) => {
    setCatForm({
      name: c.name,
      description: c.description,
      subcategories: c.subcategories.join(", "),
    });
    setEditingCatId(c._id as string);
    setCatError(null);
    setCatDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    setCatSaving(true);
    setCatError(null);
    const payload = {
      token,
      name: catForm.name,
      description: catForm.description,
      subcategories: catForm.subcategories
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      if (editingCatId) {
        await updateCategory({ ...payload, id: editingCatId as never });
        toast.success("Category updated.");
      } else {
        await createCategory(payload);
        toast.success("Category added.");
      }
      setCatDialogOpen(false);
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Couldn't save the category.");
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setBusyId(id);
    try {
      await deleteCategory({ token, id: id as never });
      toast.success("Category deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the category.");
    } finally {
      setBusyId(null);
    }
  };

  const handleMoveCategory = async (c: Category, direction: "up" | "down") => {
    setBusyId(c._id as string);
    try {
      await moveCategory({ token, id: c._id as never, direction });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reorder.");
    } finally {
      setBusyId(null);
    }
  };

  const publishedCount = prompts?.filter((p) => p.published).length ?? 0;
  const draftCount = prompts?.filter((p) => !p.published).length ?? 0;
  const featuredCount = prompts?.filter((p) => p.featured).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Prompt Library"
        description="Manage prompts, categories and the dynamic prompt builder. Drafts stay private; only published prompts appear on the public library, and only published prompts can be featured."
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

      <Tabs defaultValue="prompts">
        <TabsList className="border border-white/10 bg-black/20">
          <TabsTrigger value="prompts" className="gap-1.5">
            <Braces className="size-3.5" /> Prompts
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5">
            <Layers className="size-3.5" /> Categories ({categories.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="mt-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
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
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger className="h-9 w-44 border-white/10 bg-black/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-card">
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c._id as string} value={c._id as string}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search prompts…"
                  className="h-9 w-56 border-white/10 bg-black/20 pl-9"
                />
              </div>
              <Button
                size="sm"
                onClick={openCreate}
                className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">Add prompt</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>

          {data === undefined || filtered === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-black/20" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Braces className="size-6" />}
              title={prompts?.length === 0 ? "No prompts yet" : "Nothing matches"}
              description={
                prompts?.length === 0
                  ? "Add your first prompt — write a template, add input fields, and publish it to make it live on the public Prompt Library."
                  : "Try a different search or filter."
              }
              action={
                prompts?.length === 0 ? (
                  <Button onClick={openCreate} className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                    <Plus className="size-4" /> Add your first prompt
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((p, i) => {
                const cat = categories.find((c) => c._id === p.categoryId);
                const first = i === 0;
                const last = i === filtered.length - 1;
                return (
                  <div
                    key={p._id as string}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-lime-300 disabled:opacity-30"
                            disabled={first || busyId === (p._id as string)}
                            onClick={() => void handleMove(p, "up")}
                            title="Move up"
                          >
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-lime-300 disabled:opacity-30"
                            disabled={last || busyId === (p._id as string)}
                            onClick={() => void handleMove(p, "down")}
                            title="Move down"
                          >
                            <ArrowDown className="size-3.5" />
                          </Button>
                        </div>
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime-400/25 to-emerald-500/10 text-lime-300">
                          <Braces className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-display truncate text-sm font-semibold">
                              {p.title}
                            </p>
                            {p.featured && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold text-lime-300">
                                <Star className="size-2.5 fill-lime-400" /> Featured
                              </span>
                            )}
                            {!p.published && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                <Clock3 className="size-2.5" /> Draft
                              </span>
                            )}
                            {difficultyBadge(p.difficulty)}
                          </div>
                          <p className="mt-0.5 line-clamp-2 max-w-xl text-sm text-muted-foreground">
                            {p.description}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span>{cat?.name ?? "Uncategorized"}</span>
                            {p.subcategory && <span>· {p.subcategory}</span>}
                            {p.tags.length > 0 && (
                              <span>· {p.tags.slice(0, 3).join(", ")}</span>
                            )}
                            <span>· {p.fields.length} field{p.fields.length === 1 ? "" : "s"}</span>
                            <span>· {p.views} views</span>
                            <span>· Updated {timeAgo(p.updatedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground hover:text-lime-300"
                          disabled={busyId === (p._id as string)}
                          onClick={() => void handleToggleFeatured(p)}
                          title={p.featured ? "Remove from featured" : "Feature on homepage"}
                        >
                          {busyId === (p._id as string) ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Star className={`size-4 ${p.featured ? "fill-lime-400 text-lime-400" : ""}`} />
                          )}
                          <span className="hidden lg:inline">{p.featured ? "Featured" : "Feature"}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground hover:text-sky-300"
                          disabled={busyId === (p._id as string)}
                          onClick={() => void handleTogglePublished(p)}
                          title={p.published ? "Unpublish (hide from public)" : "Publish to the library"}
                        >
                          {busyId === (p._id as string) ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : p.published ? (
                            <Eye className="size-4" />
                          ) : (
                            <EyeOff className="size-4" />
                          )}
                          <span className="hidden lg:inline">{p.published ? "Published" : "Draft"}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(p)}
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
                              disabled={busyId === (p._id as string)}
                            >
                              <Trash2 className="size-4" />
                              <span className="hidden lg:inline">Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="border-white/10 bg-card">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-display">Delete “{p.title}”?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently removes the prompt from the library and homepage.
                                This can’t be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-white/15">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-rose-500 text-white hover:bg-rose-600"
                                onClick={() => void handleDeletePrompt(p._id as string)}
                              >
                                {busyId === (p._id as string) ? (
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
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Categories control how prompts are organized on the public library.
              New topics (Social Media, Coding, Career…) can be added any time without code changes.
            </p>
            <Button
              size="sm"
              onClick={openCatCreate}
              className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              <Plus className="size-3.5" /> Add category
            </Button>
          </div>

          {data === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-black/20" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <EmptyState
              icon={<Layers className="size-6" />}
              title="No categories yet"
              description="Create your first category — prompts are organized into categories and subcategories."
              action={
                <Button onClick={openCatCreate} className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                  <Plus className="size-4" /> Add your first category
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {categories.map((c, i) => {
                const count =
                  prompts?.filter((p) => p.categoryId === c._id).length ?? 0;
                const first = i === 0;
                const last = i === categories.length - 1;
                return (
                  <div
                    key={c._id as string}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-lime-300 disabled:opacity-30"
                            disabled={first || busyId === (c._id as string)}
                            onClick={() => void handleMoveCategory(c, "up")}
                            title="Move up"
                          >
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-lime-300 disabled:opacity-30"
                            disabled={last || busyId === (c._id as string)}
                            onClick={() => void handleMoveCategory(c, "down")}
                            title="Move down"
                          >
                            <ArrowDown className="size-3.5" />
                          </Button>
                        </div>
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime-400/25 to-emerald-500/10 text-lime-300">
                          <Layers className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-sm font-semibold">{c.name}</p>
                          <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted-foreground">
                            {c.description}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="text-lime-300/90">{count} prompt{count === 1 ? "" : "s"}</span>
                            {c.subcategories.length > 0 && (
                              <span>· {c.subcategories.slice(0, 4).join(", ")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground hover:text-foreground"
                          onClick={() => openCatEdit(c)}
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
                              disabled={busyId === (c._id as string)}
                            >
                              <Trash2 className="size-4" />
                              <span className="hidden lg:inline">Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="border-white/10 bg-card">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-display">Delete “{c.name}”?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {count > 0
                                  ? `This category still contains ${count} prompt${count === 1 ? "" : "s"} — move or delete them first before removing it.`
                                  : "This permanently removes the category. This can’t be undone."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-white/15">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-rose-500 text-white hover:bg-rose-600"
                                disabled={count > 0}
                                onClick={() => void handleDeleteCategory(c._id as string)}
                              >
                                {busyId === (c._id as string) ? (
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
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={promptOpen} onOpenChange={(o) => !o && !saving && setPromptOpen(false)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-card sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Wand2 className="size-5 text-lime-400" />
              {editingId ? "Edit prompt" : "Add a prompt"}
            </DialogTitle>
            <DialogDescription>
              Write the template, add variable input fields, then save as a draft or publish it to
              the public Prompt Library right away.
            </DialogDescription>
          </DialogHeader>
          <PromptEditor
            initial={form}
            categories={categories}
            saving={saving}
            error={formError}
            onChange={setForm}
            onSave={() => void handleSavePrompt()}
            onCancel={() => !saving && setPromptOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={catDialogOpen} onOpenChange={(o) => !o && !catSaving && setCatDialogOpen(false)}>
        <DialogContent className="border-white/10 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="size-5 text-lime-400" />
              {editingCatId ? "Edit category" : "Add a category"}
            </DialogTitle>
            <DialogDescription>
              Categories appear on the public Prompt Library filter bar in the order you set here.
            </DialogDescription>
          </DialogHeader>
          <CategoryEditor
            initial={catForm}
            saving={catSaving}
            error={catError}
            onChange={setCatForm}
            onSave={() => void handleSaveCategory()}
            onCancel={() => !catSaving && setCatDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
