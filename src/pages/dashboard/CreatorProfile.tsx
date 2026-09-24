import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, LogOut } from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/site/Avatar";
import { ImageUploader } from "@/components/media/ImageUploader";
import { Field } from "@/components/portfolio/PortfolioFields";
import { TextInput } from "@/components/portfolio/PortfolioFields";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import {
  getPortfolioUserToken,
  clearPortfolioUserToken,
  PORTFOLIO_AUTH_PATH,
} from "@/lib/portfolio-user-session";

/**
 * Creator Profile — the creator's own account details (name, professional
 * title, bio, photo, email). Scope: THIS account only. There are no
 * platform-wide controls on this page; those live in /adminbrand.
 */
export default function CreatorProfile() {
  const userToken = getPortfolioUserToken();
  const session = useQuery(
    api.portfolioUsers.validateSession,
    userToken ? { token: userToken } : "skip",
  );
  const updateProfile = useMutation(api.portfolioUsers.updateProfile);
  const updateEmail = useMutation(api.portfolioUsers.updateEmail);
  const signOut = useMutation(api.portfolioUsers.signOut);
  // Device uploads for the creator's own photo: Cloudinary when configured,
  // otherwise Portfolio storage scoped to this creator session.
  const creatorUploadUrl = useMutation(api.portfolioUploads.creatorUploadUrl);
  const creatorResolveUrl = useMutation(api.portfolioUploads.creatorResolveUrl);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session || loaded) return;
    setName(session.name ?? "");
    setTitle(session.title ?? "");
    setAvatarUrl(session.avatarUrl ?? "");
    setEmail(session.email);
    setLoaded(true);
  }, [session, loaded]);

  if (!userToken || session === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const save = async () => {
    if (!userToken) return;
    setBusy(true);
    try {
      await updateProfile({
        token: userToken,
        name: name || undefined,
        title: title,
        bio: bio,
        avatarUrl: avatarUrl || undefined,
      });
      if (email && email !== session.email) {
        await updateEmail({ token: userToken, email });
      }
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not save your profile."));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (!userToken) return;
    try {
      await signOut({ token: userToken });
    } catch {
      /* the local token is cleared regardless */
    }
    clearPortfolioUserToken();
    window.location.href = PORTFOLIO_AUTH_PATH;
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Profile"
        description="Your account details — shown on your portfolio and used to introduce you."
      />

      <div className="rounded-3xl border border-white/10 bg-card p-6 sm:p-7">
        <div className="flex items-center gap-4">
          <Avatar
            name={name || session.email}
            image={avatarUrl || session.avatarUrl}
            className="size-16"
          />
          <div className="min-w-0">
            <p className="font-display truncate text-lg font-bold">
              {name || session.email}
            </p>
            <p className="truncate text-sm text-muted-foreground">{title || "Creator"}</p>
          </div>
        </div>

        <div className="mt-5">
          <ImageUploader
            label="Upload a photo from this device"
            hint="JPG, PNG or WEBP — up to 15 MB. Crop to a square before uploading."
            crop
            value={avatarUrl || null}
            getUploadUrl={() =>
              creatorUploadUrl({ token: userToken as string })
            }
            resolveUploadUrl={(storageId) =>
              creatorResolveUrl({
                token: userToken as string,
                storageId: storageId as never,
              })
            }
            onUploaded={(img) => setAvatarUrl(img.secureUrl)}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <TextInput
              value={name}
              onChange={setName}
              placeholder="Ada Lovelace"
            />
          </Field>
          <Field label="Professional title">
            <TextInput
              value={title}
              onChange={setTitle}
              placeholder="UI/UX Designer"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Label className="text-xs">Short bio</Label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="One or two lines about what you do."
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-lime-400/50"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Profile image URL">
            <TextInput
              value={avatarUrl}
              onChange={setAvatarUrl}
              placeholder="https://…"
            />
          </Field>
          <Field label="Email address">
            <TextInput
              value={email}
              onChange={setEmail}
              placeholder="name@example.com"
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => void save()}
            disabled={busy}
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-card p-6 sm:p-7">
        <h2 className="font-display text-base font-bold">Session</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {session.email}. Signing out ends this session on this
          device only.
        </p>
        <Button
          onClick={() => void logout()}
          variant="outline"
          className="mt-4 gap-2 border-rose-400/30 text-rose-300 hover:border-rose-400/60 hover:bg-rose-400/10 hover:text-rose-200"
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}
