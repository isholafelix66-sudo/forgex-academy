import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dash/PageHeader";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { getAdminToken } from "@/lib/admin-session";

export type FormField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  enabled: boolean;
  help?: string;
};

const FIELD_TYPES = [
  "short-text",
  "long-text",
  "email",
  "phone",
  "number",
  "date",
  "dropdown",
  "multiple-choice",
  "checkbox",
  "file",
  "profile-image",
] as const;

export const FORM_FIELDS_KEY = "tutorFormFields";

export function parseFormFields(value: unknown): FormField[] {
  if (!Array.isArray(value)) return [];
  return value.filter((f): f is FormField => !!f && typeof f === "object" && typeof (f as FormField).label === "string");
}

export default function AdminFormBuilder() {
  const token = getAdminToken() ?? "";
  const content = useQuery(api.public.siteContentAll);
  const contentSet = useMutation(api.admin.contentSet);
  const [fields, setFields] = useState<FormField[] | null>(null);
  const [draft, setDraft] = useState<FormField | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loaded = fields ?? parseFormFields(content?.tutorFormFields);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= loaded.length) return;
    const next = [...loaded];
    [next[i], next[j]] = [next[j], next[i]];
    setFields(next);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await contentSet({ key: FORM_FIELDS_KEY, value: loaded, token });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tutor registration form"
        description="Design the application form. Enabled fields appear on the public Become-a-Tutor page."
      />

      <section className="rounded-2xl border border-white/10 bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">Fields ({loaded.length})</h2>
            <p className="text-sm text-muted-foreground">
              Reorder, mark required/optional, or disable fields. Save to apply
              instantly to new tutor applications.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 border-white/15" onClick={() => setDraft({ key: `field_${Date.now()}`, label: "", type: "short-text", required: false, enabled: true })}>
            <Plus className="size-3.5" /> Add field
          </Button>
        </div>

        <div className="mt-5 space-y-2">
          {loaded.map((f, i) => (
            <div key={f.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5">
              <div className="flex flex-col gap-0.5">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === loaded.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="size-3.5" />
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {f.label || <span className="text-muted-foreground">Untitled field</span>}
                  {f.required && <span className="ml-2 text-rose-300">*</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {f.type} {f.help ? `· ${f.help}` : ""} {f.enabled ? "" : "· disabled"}
                </p>
              </div>
              <button
                onClick={() => {
                  const next = loaded.map((x) => (x.key === f.key ? { ...x, enabled: !x.enabled } : x));
                  setFields(next);
                }}
                className="text-muted-foreground hover:text-lime-300"
                title={f.enabled ? "Disable" : "Enable"}
              >
                {f.enabled ? <ToggleRight className="size-5 text-lime-300" /> : <ToggleLeft className="size-5" />}
              </button>
              <button
                onClick={() => {
                  const next = loaded.map((x) => (x.key === f.key ? { ...x, required: !x.required } : x));
                  setFields(next);
                }}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${f.required ? "bg-rose-400/12 text-rose-300" : "bg-white/8 text-muted-foreground"}`}
                title="Toggle required"
              >
                {f.required ? "Required" : "Optional"}
              </button>
              <Button variant="ghost" size="icon" onClick={() => setDraft({ ...f })}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-300" onClick={() => setRemoving(f.key)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {loaded.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
              No custom fields yet. The built-in application sections (personal,
              professional, teaching, verification) always apply — add extra
              fields on top.
            </p>
          )}
        </div>

        <Button
          onClick={() => void saveAll()}
          disabled={saving}
          className={saved ? "mt-4 gap-1.5 border border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/15" : "mt-4 gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : <Save className="size-4" />}
          {saved ? "Saved — live on the public form" : "Save form configuration"}
        </Button>
      </section>

      {/* Field editor */}
      {draft && (
        <div className="rounded-2xl border border-white/10 bg-card p-6">
          <h3 className="font-display text-base font-semibold">{loaded.some((f) => f.key === draft.key && f.label) ? "Edit field" : "New field"}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Field label *</Label>
              <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Portfolio link" className="border-white/10 bg-black/20" />
            </div>
            <div className="space-y-2">
              <Label>Field type</Label>
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Help text (optional)</Label>
              <Textarea value={draft.help ?? ""} onChange={(e) => setDraft({ ...draft, help: e.target.value })} rows={2} placeholder="Shown under the field to guide applicants…" className="border-white/10 bg-black/20" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button
              className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              disabled={!draft.label.trim()}
              onClick={() => {
                const exists = loaded.some((f) => f.key === draft.key);
                setFields(exists ? loaded.map((f) => (f.key === draft.key ? draft : f)) : [...loaded, { ...draft, key: draft.key || `field_${Date.now()}` }]);
                setDraft(null);
              }}
            >
              <Plus className="size-4" /> {loaded.some((f) => f.key === draft.key) ? "Save field" : "Add field"}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this field?"
        description="The field is removed from the tutor registration form. Applicant answers already submitted are kept."
        confirmLabel="Remove field"
        onConfirm={() => {
          if (removing) setFields(loaded.filter((f) => f.key !== removing));
          setRemoving(null);
        }}
      />
    </div>
  );
}
