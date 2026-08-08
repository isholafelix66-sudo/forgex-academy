import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, Save, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import { ImageUploader } from "@/components/media/ImageUploader";
import { getAdminToken } from "@/lib/admin-session";

type AdminProfileData = {
  name?: string;
  title?: string;
  image?: string;
};

export default function AdminProfile() {
  const token = getAdminToken() ?? "";
  const content = useQuery(api.public.siteContentAll);
  const contentSet = useMutation(api.admin.contentSet);

  const current = (content?.adminProfile ?? {}) as AdminProfileData;
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const hydrated = useRef(false);

  // Hydrate once site content arrives (it loads async after the admin gate).
  useEffect(() => {
    if (!content || hydrated.current) return;
    hydrated.current = true;
    setName(current.name ?? "");
    setTitle(current.title ?? "");
    setImage(current.image ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await contentSet({
      key: "adminProfile",
      value: { name: name.trim(), title: title.trim(), image },
      token,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin profile"
        description="The name and photo shown in the admin dashboard header and tutor-dashboard previews. No account needed — stored safely in site content."
        actions={
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saved ? (
              <ShieldCheck className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        {/* Preview */}
        <div className="h-fit rounded-3xl border border-white/10 bg-card p-6">
          <div className="flex flex-col items-center text-center">
            <Avatar
              name={name || "Administrator"}
              image={image || undefined}
              className="size-24 text-3xl"
            />
            <h2 className="font-display mt-4 text-xl font-bold">
              {name || "Administrator"}
            </h2>
            {title && (
              <p className="mt-0.5 text-sm text-muted-foreground">{title}</p>
            )}
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-300">
              <ShieldCheck className="size-3.5" /> Administrator
            </span>
          </div>
          <p className="mt-6 border-t border-white/10 pt-5 text-xs leading-relaxed text-muted-foreground">
            This identity appears in the admin dashboard sidebar, and in the
            tutor-dashboard preview banner when you view it as an admin.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-6 rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Display name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amina Forge"
                className="border-white/10 bg-black/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Title / role</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Platform Administrator"
                className="border-white/10 bg-black/20"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Profile photo</label>
            <ImageUploader
              value={image || null}
              label="Upload photo"
              hint="Shown in the admin dashboard header — uploads to Cloudinary."
              record={{ kind: "profile", label: `${name || "Admin"} profile photo` }}
              onUploaded={(img) => setImage(img.secureUrl)}
              onClear={() => setImage("")}
              compact
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground">
            <User className="size-4 shrink-0 text-lime-300" />
            The admin dashboard is password-gated, so this profile is optional —
            but it makes your admin sessions feel personal.
          </div>
        </div>
      </div>
    </div>
  );
}
