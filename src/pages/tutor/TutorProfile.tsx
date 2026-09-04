import { useState } from "react";
import { Link } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ExternalLink, Loader2, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dash/PageHeader";
import { AccountManagement } from "@/components/dash/AccountManagement";
import { Avatar } from "@/components/site/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { ImageUploader } from "@/components/media/ImageUploader";

export default function TutorProfile() {
  const { user } = useAuth();
  const updateProfile = useMutation(api.users.updateProfile);

  const [name, setName] = useState(user?.name ?? "");
  const [image, setImage] = useState(user?.image ?? "");
  const [headline, setHeadline] = useState(user?.headline ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [expertise, setExpertise] = useState<string[]>(user?.skills ?? []);
  const [skillInput, setSkillInput] = useState("");
  const [website, setWebsite] = useState(user?.socials?.website ?? "");
  const [linkedin, setLinkedin] = useState(user?.socials?.linkedin ?? "");
  const [twitter, setTwitter] = useState(user?.socials?.twitter ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !expertise.includes(s) && expertise.length < 10) {
      setExpertise((v) => [...v, s]);
    }
    setSkillInput("");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile({
        name: name || undefined,
        image: image || undefined,
        headline: headline || undefined,
        bio: bio || undefined,
        skills: expertise,
        socials: {
          website: website || undefined,
          linkedin: linkedin || undefined,
          twitter: twitter || undefined,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tutor Profile"
        description="This is what students see on your public tutor page — keep it current so visitors know exactly what you teach."
        actions={
          <Button
            onClick={() => void handleSave()}
            disabled={saving}
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <ShieldCheck className="size-4" /> : <Save className="size-4" />}
            {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
          </Button>
        }
      />

      <div className="grid min-w-0 gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Preview card */}
        <div className="h-fit space-y-6 rounded-3xl border border-white/10 bg-card p-6">
          <div className="flex flex-col items-center text-center">
            <Avatar name={name || "Tutor"} image={image || user?.image} className="size-24 text-3xl" />
            <h2 className="font-display mt-4 text-xl font-bold">{name || "Tutor"}</h2>
            {headline && <p className="mt-0.5 text-sm text-muted-foreground">{headline}</p>}
            {user?.verified && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-xs font-semibold text-lime-300">
                <ShieldCheck className="size-3" /> Verified tutor
              </span>
            )}
          </div>

          {expertise.length > 0 && (
            <div className="border-t border-white/10 pt-5">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expertise</p>
              <div className="flex flex-wrap gap-2">
                {expertise.map((s) => (
                  <span key={s} className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-medium text-lime-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {user?.verified && (
            <Link
              to={`/tutor/${user.slug ?? ""}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-lime-400/30 bg-lime-400/10 px-4 py-2.5 text-sm font-semibold text-lime-300 transition-colors hover:bg-lime-400/20"
            >
              <ExternalLink className="size-4" /> View public page
            </Link>
          )}
        </div>

        {/* Edit form */}
        <div className="space-y-6 rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Full name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="border-white/10 bg-black/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Headline</label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Graphic design tutor · 5+ years experience"
                className="border-white/10 bg-black/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Profile photo</label>
            <ImageUploader value={image || undefined} label="Upload photo" onUploaded={(img) => setImage(img.secureUrl)} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Bio</label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              placeholder="Tell students what you teach, your experience and how you help them learn."
              className="border-white/10 bg-black/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Expertise</label>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="e.g. UI Design, Branding, Figma"
                className="border-white/10 bg-black/20"
              />
              <Button type="button" variant="outline" onClick={addSkill} className="shrink-0 border-white/10">
                Add
              </Button>
            </div>
            {expertise.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {expertise.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
                    {s}
                    <button
                      type="button"
                      onClick={() => setExpertise((v) => v.filter((x) => x !== s))}
                      className="text-muted-foreground transition-colors hover:text-rose-300"
                      aria-label={`Remove ${s}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Website</label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className="border-white/10 bg-black/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">LinkedIn</label>
              <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" className="border-white/10 bg-black/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Twitter / X</label>
              <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/…" className="border-white/10 bg-black/20" />
            </div>
          </div>

          <Button
            onClick={() => void handleSave()}
            disabled={saving}
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <ShieldCheck className="size-4" /> : <Save className="size-4" />}
            {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* Account management — logout + delete account (confirmation required) */}
      <AccountManagement />
    </div>
  );
}
