import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check, Loader2, PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dash/PageHeader";

const FIELDS: Array<{ key: string; label: string; hint: string; rows: number }> = [
  { key: "mission", label: "Mission", hint: "Shown on the About page.", rows: 4 },
  { key: "vision", label: "Vision", hint: "Shown on the About page.", rows: 4 },
  { key: "about", label: "About us", hint: "Long-form About page copy.", rows: 8 },
  { key: "heroTitle", label: "Homepage hero title", hint: "Headline on the landing page.", rows: 3 },
  { key: "heroSubtitle", label: "Homepage hero subtitle", hint: "Supporting line under the hero.", rows: 3 },
  { key: "ctaTitle", label: "CTA section title", hint: "Bottom call-to-action heading.", rows: 3 },
];

function EditorRow({
  field,
  initial,
  onSave,
}: {
  field: (typeof FIELDS)[number];
  initial?: string;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(field.key, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{field.label}</p>
          <p className="text-xs text-muted-foreground">{field.hint}</p>
        </div>
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={saving}
          className={
            saved
              ? "gap-1.5 border border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/15"
              : "gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          }
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : saved ? <Check className="size-3.5" /> : "Save"}
          {saved ? "Saved" : ""}
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={field.rows}
        className="mt-3 border-white/10 bg-black/20"
      />
    </div>
  );
}

export default function AdminContent() {
  const content = useQuery(api.public.siteContentAll);
  const contentSet = useMutation(api.admin.contentSet);

  const save = async (key: string, value: string) => {
    await contentSet({ key, value });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Site content"
        description="Edit homepage and About copy without touching code."
      />

      {content === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {FIELDS.map((f) => {
            const v = content[f.key];
            const initial = typeof v === "string" ? v : undefined;
            return <EditorRow key={f.key} field={f} initial={initial} onSave={save} />;
          })}

          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <PenSquare className="size-4 text-lime-300" /> How this works
            </p>
            <p className="mt-2 leading-relaxed">
              Saving a field writes it to the site-content store and the public
              pages render it live. If a field has never been saved, pages fall
              back to their built-in defaults.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
