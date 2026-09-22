import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  Award,
  Flame,
  Loader2,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import { AccountManagement } from "@/components/dash/AccountManagement";
import { useAuth } from "@/hooks/use-auth";
import { ImageUploader } from "@/components/media/ImageUploader";
import { resilientMutation } from "@/lib/resilience";

export default function Profile() {
  const { user } = useAuth();
  const updateProfile = useMutation(api.users.updateProfile);
  const certificates = useQuery(api.certificates.myCertificates);

  const [name, setName] = useState(user?.name ?? "");
  const [image, setImage] = useState(user?.image ?? "");
  const [headline, setHeadline] = useState(user?.headline ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [skills, setSkills] = useState<string[]>(user?.skills ?? []);
  const [skillInput, setSkillInput] = useState("");
  const [website, setWebsite] = useState(user?.socials?.website ?? "");
  const [github, setGithub] = useState(user?.socials?.github ?? "");
  const [linkedin, setLinkedin] = useState(user?.socials?.linkedin ?? "");
  const [twitter, setTwitter] = useState(user?.socials?.twitter ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s) && skills.length < 10) {
      setSkills((v) => [...v, s]);
    }
    setSkillInput("");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const payload = {
      name: name || undefined,
      headline: headline || undefined,
      bio: bio || undefined,
      skills,
      socials: {
        website: website || undefined,
        github: github || undefined,
        linkedin: linkedin || undefined,
        twitter: twitter || undefined,
      },
    };
    // Essential write with outage protection: if Convex is unreachable the
    // profile change is queued (and mirrored to the fallback store) and
    // replayed automatically — the user just sees "Saved!" as normal.
    const result = await resilientMutation({
      kind: "profile-update",
      payload,
      live: () =>
        updateProfile({
          ...payload,
          image: image || undefined, // image uploads still require Convex storage
        }),
    });
    if (result.status === "queued") {
      toast.info("Sync temporarily unavailable — your changes are safely queued.");
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const badges = user?.badges ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Profile"
        description="Your public student profile across ForgeX Academy."
        actions={
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <ShieldCheck className="size-4" /> : <Save className="size-4" />}
            {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        {/* Summary card */}
        <div className="h-fit space-y-6 rounded-3xl border border-white/10 bg-card p-6">
          <div className="flex flex-col items-center text-center">
            <Avatar name={name || "Student"} image={image || user?.image} className="size-24 text-3xl" />
            <h2 className="font-display mt-4 text-xl font-bold">{name || "Student"}</h2>
            {headline && <p className="mt-0.5 text-sm text-muted-foreground">{headline}</p>}
            {user?.verified && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-xs font-semibold text-lime-300">
                <ShieldCheck className="size-3" /> Verified tutor
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-5 text-center">
            <div>
              <p className="flex items-center justify-center gap-1 font-display text-2xl font-bold">
                <Flame className="size-5 text-lime-400" />
                {user?.streak ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">Day streak</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold">{certificates?.length ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">Certificates</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold">{skills.length}</p>
              <p className="text-[11px] text-muted-foreground">Skills</p>
            </div>
          </div>

          {badges.length > 0 && (
            <div className="border-t border-white/10 pt-5">
              <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Award className="size-3.5 text-lime-300" /> Earned badges
              </p>
              <div className="flex flex-wrap gap-2">
                {badges.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-medium text-lime-300"
                  >
                    <Award className="size-3" /> {b}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Edit form */}
        <div className="space-y-6 rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Full name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="border-white/10 bg-black/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Profile photo</label>
              <ImageUploader
                value={image || null}
                label="Upload photo"
                hint="Profile photo"
                record={{ kind: "profile", label: `${name || "Student"} profile photo` }}
                onUploaded={(img) => setImage(img.secureUrl)}
                onClear={() => setImage("")}
                compact
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Headline</label>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Aspiring product designer" className="border-white/10 bg-black/20" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Bio</label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Tell the community about yourself…" className="border-white/10 bg-black/20" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Skills</label>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                placeholder="e.g. Figma, SQL, React…"
                className="border-white/10 bg-black/20"
              />
              <Button type="button" variant="outline" onClick={addSkill}>
                Add
              </Button>
            </div>
            {skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs"
                  >
                    {s}
                    <button onClick={() => setSkills((v) => v.filter((x) => x !== s))} className="text-muted-foreground hover:text-rose-300">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Website</label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className="border-white/10 bg-black/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">GitHub</label>
              <Input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/…" className="border-white/10 bg-black/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">LinkedIn</label>
              <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" className="border-white/10 bg-black/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Twitter / X</label>
              <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/…" className="border-white/10 bg-black/20" />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground">
            <User className="size-4 shrink-0 text-lime-300" />
            Your name and photo appear on certificates and public tutor-facing pages.
          </div>
        </div>
      </div>

      {/* Account management — logout + delete account (confirmation required) */}
      <AccountManagement />
    </div>
  );
}
