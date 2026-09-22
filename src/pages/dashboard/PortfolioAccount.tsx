import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, LogOut, Mail, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dash/PageHeader";
import { Field, ImageField } from "@/components/portfolio/PortfolioFields";
import { AccountManagement } from "@/components/dash/AccountManagement";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

/**
 * Projects account settings.
 *
 * The account belongs to Projects: your name and photo here are the identity
 * behind your portfolio and are used as the defaults when you first create it.
 */
export default function PortfolioAccount() {
  const { user, signOut } = useAuth();
  const updateProfile = useMutation(api.users.updateProfile);

  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setImage(user.image ?? null);
  }, [user]);

  const save = async () => {
    if (name.trim().length < 2) {
      toast.error("Please enter your name.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), image: image ?? undefined });
      toast.success("Account updated.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not save your account."));
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      window.location.href = "/";
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account"
        description="Your Projects account — the identity behind your portfolio."
      />

      <section className="rounded-3xl border border-white/10 bg-card p-5 sm:p-6">
        <h3 className="font-display text-lg font-bold">Profile</h3>
        <div className="mt-4 grid gap-5 sm:grid-cols-[200px_1fr]">
          <Field label="Photo">
            <ImageField
              value={image}
              onChange={setImage}
              label="Upload photo"
              height="h-40"
            />
          </Field>
          <div className="space-y-4">
            <Field label="Full name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Felix Ishola Ayomide"
                className="border-white/10 bg-black/20"
              />
            </Field>
            <Field label="Email" hint="Your sign-in email — contact support to change it.">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-muted-foreground">
                <Mail className="size-4" />
                <span className="truncate">{user?.email ?? "—"}</span>
              </div>
            </Field>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-lime-400" />
              {user?.emailVerificationTime
                ? "Email verified"
                : "Your email is verified automatically by a sign-in code."}
            </div>
            <Button
              onClick={() => void save()}
              disabled={saving}
              className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-card p-5 sm:p-6">
        <h3 className="font-display text-lg font-bold">Session</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Signing out ends this session on this device.
        </p>
        <Button
          variant="outline"
          onClick={() => void logout()}
          disabled={signingOut}
          className="mt-4 w-full gap-2 border-lime-400/30 text-lime-300 hover:bg-lime-400/10 hover:text-lime-200 sm:w-auto"
        >
          {signingOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          Log out
        </Button>
      </section>

      <AccountManagement />
    </div>
  );
}
