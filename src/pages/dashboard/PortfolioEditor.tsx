import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Check,
  ExternalLink,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dash/PageHeader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { getPortfolioUserToken } from "@/lib/portfolio-user-session";
import {
  Field,
  ImageField,
  ListEditor,
  TextInput,
} from "@/components/portfolio/PortfolioFields";

type Skill = { name: string; level?: number };
type Experience = {
  role: string;
  org: string;
  location?: string;
  start?: string;
  end?: string;
  current?: boolean;
  description?: string;
};
type Education = {
  school: string;
  qualification?: string;
  field?: string;
  start?: string;
  end?: string;
  description?: string;
};
type Service = { title: string; description?: string; price?: string };
type LinkItem = { label: string; url: string };
type Template = "carbon" | "aurora" | "paper";

type FormState = {
  displayName: string;
  headline: string;
  bio: string;
  about: string;
  location: string;
  email: string;
  phone: string;
  availability: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  template: Template;
  accent: string;
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  services: Service[];
  links: LinkItem[];
};

const SECTIONS = [
  { id: "profile", label: "Basics", blurb: "Your name, headline, photo and the look of your site." },
  { id: "about", label: "About Me", blurb: "A short story of who you are and what you do." },
  { id: "skills", label: "Skills", blurb: "What you're good at — with optional levels." },
  { id: "experience", label: "Experience", blurb: "Roles, internships and freelance work." },
  { id: "education", label: "Education", blurb: "Schools, courses and qualifications." },
  { id: "services", label: "Services", blurb: "What you offer and what it costs." },
  { id: "links", label: "Social Links", blurb: "GitHub, LinkedIn, Behance, X, your site…" },
  { id: "theme", label: "Template", blurb: "Pick a template and accent colour." },
] as const;

const ACCENT_OPTIONS = [
  { key: "lime", hex: "#a3e635", label: "Lime" },
  { key: "emerald", hex: "#34d399", label: "Emerald" },
  { key: "cyan", hex: "#22d3ee", label: "Cyan" },
  { key: "violet", hex: "#a78bfa", label: "Violet" },
  { key: "amber", hex: "#fbbf24", label: "Amber" },
  { key: "rose", hex: "#fb7185", label: "Rose" },
];

const TEMPLATE_OPTIONS: { key: Template; label: string; blurb: string }[] = [
  { key: "carbon", label: "Carbon", blurb: "Electric black with your accent colour." },
  { key: "aurora", label: "Aurora", blurb: "Deep navy with a cool, glowing feel." },
  { key: "paper", label: "Paper", blurb: "Light, editorial and print-like." },
];

export default function PortfolioEditor() {
  const { section = "profile" } = useParams();
  const userToken = getPortfolioUserToken();
  const data = useQuery(
    api.projects.myPortfolio,
    userToken ? { token: userToken } : "skip",
  );
  const savePortfolio = useMutation(api.projects.updatePortfolio);

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const portfolio = data?.portfolio ?? null;

  useEffect(() => {
    if (!portfolio || form) return;
    setForm({
      displayName: portfolio.displayName,
      headline: portfolio.headline ?? "",
      bio: portfolio.bio ?? "",
      about: portfolio.about ?? "",
      location: portfolio.location ?? "",
      email: portfolio.email ?? "",
      phone: portfolio.phone ?? "",
      availability: portfolio.availability ?? "",
      avatarUrl: portfolio.avatarUrl ?? null,
      coverUrl: portfolio.coverUrl ?? null,
      template: portfolio.template,
      accent: portfolio.accent ?? "lime",
      skills: portfolio.skills,
      experience: portfolio.experience,
      education: portfolio.education,
      services: portfolio.services,
      links: portfolio.links,
    });
  }, [portfolio, form]);

  const active = useMemo(
    () => SECTIONS.find((s) => s.id === section) ?? SECTIONS[0],
    [section],
  );

  const patch = (p: Partial<FormState>) => setForm((f) => (f ? { ...f, ...p } : f));

  const save = async () => {
    if (!form) return;
    if (form.displayName.trim().length < 2) {
      toast.error("Your portfolio needs a display name.");
      return;
    }
    setSaving(true);
    try {
      await savePortfolio({
        token: userToken ?? "",
        displayName: form.displayName,
        headline: form.headline,
        bio: form.bio,
        about: form.about,
        location: form.location,
        email: form.email,
        phone: form.phone,
        availability: form.availability,
        avatarUrl: form.avatarUrl ?? undefined,
        coverUrl: form.coverUrl ?? undefined,
        template: form.template,
        accent: form.accent,
        skills: form.skills,
        experience: form.experience,
        education: form.education,
        services: form.services,
        links: form.links,
      });
      setSavedAt(Date.now());
      toast.success("Portfolio saved.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not save your portfolio."));
    } finally {
      setSaving(false);
    }
  };

  if (!form || !portfolio) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My Portfolio"
        description={active.blurb}
        actions={
          <>
            <Link to={`/p/${portfolio.slug}`} target="_blank">
              <Button variant="outline" className="gap-2 border-white/15">
                <ExternalLink className="size-4" /> Preview
              </Button>
            </Link>
            <Button
              onClick={() => void save()}
              disabled={saving}
              className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : savedAt ? (
                <Check className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      {/* Section tabs (deep links from the sidebar land on these) */}
      <div className="mb-6 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {SECTIONS.map((s) => (
          <Link
            key={s.id}
            to={s.id === "profile" ? "/portfolio/edit" : `/portfolio/edit/${s.id}`}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
              active.id === s.id
                ? "border-lime-400/50 bg-lime-400/12 text-lime-300"
                : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="rounded-3xl border border-white/10 bg-card p-5 sm:p-6">
        {active.id === "profile" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Display name">
              <TextInput
                value={form.displayName}
                onChange={(v) => patch({ displayName: v })}
                placeholder="Felix Ishola Ayomide"
              />
            </Field>
            <Field label="Headline" hint="A one-line summary under your name.">
              <TextInput
                value={form.headline}
                onChange={(v) => patch({ headline: v })}
                placeholder="Nutrition & Dietetics Student · Designer"
              />
            </Field>
            <Field label="Short bio" hint="Used in Explore and previews." className="lg:col-span-2">
              <Textarea
                rows={3}
                value={form.bio}
                onChange={(e) => patch({ bio: e.target.value })}
                placeholder="I design brands and products people remember."
                className="border-white/10 bg-black/20"
              />
            </Field>
            <Field label="Location">
              <TextInput
                value={form.location}
                onChange={(v) => patch({ location: v })}
                placeholder="Lagos, Nigeria"
              />
            </Field>
            <Field label="Contact email">
              <TextInput
                type="email"
                value={form.email}
                onChange={(v) => patch({ email: v })}
                placeholder="hello@example.com"
              />
            </Field>
            <Field label="Phone (optional)">
              <TextInput
                value={form.phone}
                onChange={(v) => patch({ phone: v })}
                placeholder="+234…"
              />
            </Field>
            <Field
              label="Availability (optional)"
              hint="Shown on your site — e.g. Open to opportunities."
            >
              <TextInput
                value={form.availability}
                onChange={(v) => patch({ availability: v })}
                placeholder="Open to opportunities"
              />
            </Field>
            <div className="lg:col-span-2 grid gap-5 sm:grid-cols-2">
              <Field label="Profile photo">
                <ImageField
                  value={form.avatarUrl}
                  onChange={(url) => patch({ avatarUrl: url })}
                  label="Upload photo"
                  height="h-40"
                />
              </Field>
              <Field label="Cover image (optional)">
                <ImageField
                  value={form.coverUrl}
                  onChange={(url) => patch({ coverUrl: url })}
                  label="Upload cover"
                  height="h-40"
                />
              </Field>
            </div>
          </div>
        )}

        {active.id === "about" && (
          <Field
            label="About me"
            hint="Write it the way you'd tell it to a person. Line breaks are kept."
          >
            <Textarea
              rows={12}
              value={form.about}
              onChange={(e) => patch({ about: e.target.value })}
              placeholder="I'm a final-year Nutrition & Dietetics student who designs…"
              className="border-white/10 bg-black/20"
            />
          </Field>
        )}

        {active.id === "skills" && (
          <ListEditor<Skill>
            items={form.skills}
            onChange={(skills) => patch({ skills })}
            emptyLabel="No skills yet — add the ones you want people to notice."
            addLabel="Add skill"
            makeItem={() => ({ name: "", level: 4 })}
            title={(s) => s.name || "New skill"}
            renderItem={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <TextInput
                  value={item.name}
                  onChange={(v) => update({ name: v })}
                  placeholder="Brand design"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Level</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-label={`Level ${n}`}
                        onClick={() => update({ level: n })}
                        className={cn(
                          "size-6 rounded-md border text-[11px] font-bold transition-colors",
                          (item.level ?? 0) >= n
                            ? "border-lime-400/50 bg-lime-400/20 text-lime-300"
                            : "border-white/10 text-muted-foreground hover:border-white/25",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          />
        )}

        {active.id === "experience" && (
          <ListEditor<Experience>
            items={form.experience}
            onChange={(experience) => patch({ experience })}
            emptyLabel="No experience yet — add roles, internships or freelance work."
            addLabel="Add experience"
            makeItem={() => ({ role: "", org: "", current: false })}
            title={(e) => e.role || "New role"}
            renderItem={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Role">
                  <TextInput
                    value={item.role}
                    onChange={(v) => update({ role: v })}
                    placeholder="Product Designer"
                  />
                </Field>
                <Field label="Organisation">
                  <TextInput
                    value={item.org}
                    onChange={(v) => update({ org: v })}
                    placeholder="ForgeX"
                  />
                </Field>
                <Field label="Start">
                  <TextInput
                    value={item.start ?? ""}
                    onChange={(v) => update({ start: v })}
                    placeholder="Jan 2024"
                  />
                </Field>
                <Field label="End">
                  <TextInput
                    value={item.end ?? ""}
                    onChange={(v) => update({ end: v })}
                    placeholder="Present"
                  />
                </Field>
                <Field label="Location" className="sm:col-span-2">
                  <TextInput
                    value={item.location ?? ""}
                    onChange={(v) => update({ location: v })}
                    placeholder="Remote"
                  />
                </Field>
                <Field label="What you did" className="sm:col-span-2">
                  <Textarea
                    rows={3}
                    value={item.description ?? ""}
                    onChange={(e) => update({ description: e.target.value })}
                    className="border-white/10 bg-black/20"
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={!!item.current}
                    onChange={(e) => update({ current: e.target.checked })}
                    className="accent-lime-400"
                  />
                  I currently work here
                </label>
              </div>
            )}
          />
        )}

        {active.id === "education" && (
          <ListEditor<Education>
            items={form.education}
            onChange={(education) => patch({ education })}
            emptyLabel="No education added yet."
            addLabel="Add education"
            makeItem={() => ({ school: "" })}
            title={(e) => e.school || "New entry"}
            renderItem={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="School / institution">
                  <TextInput
                    value={item.school}
                    onChange={(v) => update({ school: v })}
                    placeholder="University of Lagos"
                  />
                </Field>
                <Field label="Qualification">
                  <TextInput
                    value={item.qualification ?? ""}
                    onChange={(v) => update({ qualification: v })}
                    placeholder="BSc"
                  />
                </Field>
                <Field label="Field of study">
                  <TextInput
                    value={item.field ?? ""}
                    onChange={(v) => update({ field: v })}
                    placeholder="Nutrition & Dietetics"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start">
                    <TextInput
                      value={item.start ?? ""}
                      onChange={(v) => update({ start: v })}
                      placeholder="2022"
                    />
                  </Field>
                  <Field label="End">
                    <TextInput
                      value={item.end ?? ""}
                      onChange={(v) => update({ end: v })}
                      placeholder="2026"
                    />
                  </Field>
                </div>
                <Field label="Notes" className="sm:col-span-2">
                  <Textarea
                    rows={2}
                    value={item.description ?? ""}
                    onChange={(e) => update({ description: e.target.value })}
                    className="border-white/10 bg-black/20"
                  />
                </Field>
              </div>
            )}
          />
        )}

        {active.id === "services" && (
          <ListEditor<Service>
            items={form.services}
            onChange={(services) => patch({ services })}
            emptyLabel="No services yet — add what you can be hired for."
            addLabel="Add service"
            makeItem={() => ({ title: "" })}
            title={(s) => s.title || "New service"}
            renderItem={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Service">
                  <TextInput
                    value={item.title}
                    onChange={(v) => update({ title: v })}
                    placeholder="Brand identity design"
                  />
                </Field>
                <Field label="Price (optional)">
                  <TextInput
                    value={item.price ?? ""}
                    onChange={(v) => update({ price: v })}
                    placeholder="From ₦150,000"
                  />
                </Field>
                <Field label="Description" className="sm:col-span-2">
                  <Textarea
                    rows={3}
                    value={item.description ?? ""}
                    onChange={(e) => update({ description: e.target.value })}
                    className="border-white/10 bg-black/20"
                  />
                </Field>
              </div>
            )}
          />
        )}

        {active.id === "links" && (
          <ListEditor<LinkItem>
            items={form.links}
            onChange={(links) => patch({ links })}
            emptyLabel="No links yet — add your GitHub, LinkedIn, Behance, portfolio…"
            addLabel="Add link"
            makeItem={() => ({ label: "", url: "https://" })}
            title={(l) => l.label || l.url || "New link"}
            renderItem={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                <Field label="Label">
                  <TextInput
                    value={item.label}
                    onChange={(v) => update({ label: v })}
                    placeholder="GitHub"
                  />
                </Field>
                <Field label="URL">
                  <TextInput
                    value={item.url}
                    onChange={(v) => update({ url: v })}
                    placeholder="https://github.com/…"
                  />
                </Field>
              </div>
            )}
          />
        )}

        {active.id === "theme" && (
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Template
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {TEMPLATE_OPTIONS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => patch({ template: t.key })}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-colors",
                      form.template === t.key
                        ? "border-lime-400/50 bg-lime-400/10"
                        : "border-white/10 hover:border-white/25",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-3 h-16 rounded-lg border",
                        t.key === "paper"
                          ? "border-black/10 bg-[#f7f6f2]"
                          : t.key === "aurora"
                            ? "border-white/10 bg-[#0b0d1a]"
                            : "border-white/10 bg-[#070906]",
                      )}
                    />
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t.blurb}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Accent colour
              </p>
              <div className="flex flex-wrap gap-2">
                {ACCENT_OPTIONS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => patch({ accent: a.key })}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      form.accent === a.key
                        ? "border-white/40 text-foreground"
                        : "border-white/10 text-muted-foreground hover:border-white/25",
                    )}
                  >
                    <span
                      className="size-3 rounded-full"
                      style={{ background: a.hex }}
                    />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-20 z-20 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-background/85 px-4 py-3 backdrop-blur md:bottom-4">
        <p className="hidden text-xs text-muted-foreground sm:block">
          {savedAt
            ? "Saved — your public page is up to date."
            : "Changes aren't live until you save."}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Link to={`/p/${portfolio.slug}`} target="_blank">
            <Button variant="ghost" className="gap-2 text-muted-foreground">
              <Sparkles className="size-4" /> View live
            </Button>
          </Link>
          <Button
            onClick={() => void save()}
            disabled={saving}
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
