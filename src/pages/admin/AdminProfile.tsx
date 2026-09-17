import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  CheckCircle2,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  Mail,
  MonitorSmartphone,
  RefreshCw,
  Save,
  ShieldCheck,
  ShieldAlert,
  Timer,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import { ImageUploader } from "@/components/media/ImageUploader";
import { getAdminToken } from "@/lib/admin-session";
import { toast } from "sonner";

type AdminProfileData = {
  name?: string;
  title?: string;
  image?: string;
};

type SessionRow = {
  _id: string;
  label: string;
  createdAt: number;
  lastSeenAt: number;
  ownerSession: boolean;
  isCurrent: boolean;
};

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

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

      {/* --------------------------------------------------------------- */}
      {/* Security — OTP-protected password change, sessions, Owner setup */}
      {/* --------------------------------------------------------------- */}
      <SecuritySection token={token} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Security section
// ---------------------------------------------------------------------------

function SecuritySection({ token }: { token: string }) {
  const ownerInfo = useQuery(api.adminSecurity.ownerExists);
  const identity = useQuery(
    api.adminSecurity.sessionIdentity,
    token ? { token } : "skip",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Password changes require a one-time code sent to the verified security email. Sign out other devices and review active sessions."
      />
      {!ownerInfo ? (
        <div className="flex items-center gap-2 rounded-3xl border border-white/10 bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading security settings…
        </div>
      ) : !ownerInfo.exists ? (
        <OwnerSetup token={token} />
      ) : (
        <>
          <PasswordChangeCard token={token} identity={identity} />
          <SecurityEmailCard token={token} identity={identity} />
          <SessionsCard token={token} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One-time Owner setup
// ---------------------------------------------------------------------------

function OwnerSetup({ token }: { token: string }) {
  const bootstrap = useMutation(api.adminSecurity.bootstrapOwner);
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentAccess, setCurrentAccess] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await bootstrap({
        ownerName: ownerName.trim(),
        securityEmail: email.trim(),
        password,
        accessPassword: currentAccess,
        label: "Owner setup",
      });
      toast.success("Owner security initialized. Use the new password at the gate next time.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-lime-400/25 bg-card p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
          <ShieldAlert className="size-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold">One-time Owner setup</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create the permanent Owner security identity. It unlocks the OTP-protected
            password change, the verified security email, and remote session control.
            This can only be done once.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Current admin access password</label>
          <Input
            type="password"
            value={currentAccess}
            onChange={(e) => setCurrentAccess(e.target.value)}
            placeholder="Confirm your identity"
            className="border-white/10 bg-black/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Owner name</label>
          <Input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="e.g. Felix Ishola"
            className="border-white/10 bg-black/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Security email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border-white/10 bg-black/20"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Verification codes are sent here. Choose an inbox you control.
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">New admin password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 10 chars, letters + numbers"
            className="border-white/10 bg-black/20"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            This becomes the dashboard access password.
          </p>
        </div>
      </div>
      <Button
        onClick={() => void submit()}
        disabled={busy || !ownerName.trim() || !email.trim() || !password || !currentAccess}
        className="mt-6 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        Initialize Owner security
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Password change — current → new → OTP → confirm
// ---------------------------------------------------------------------------

function PasswordChangeCard({
  token,
  identity,
}: {
  token: string;
  identity:
    | {
        isOwner: boolean;
        label: string;
        ownerName: string | null;
        securityEmail: string | null;
        pendingPasswordChange: boolean;
      }
    | null
    | undefined;
}) {
  const requestChange = useMutation(api.adminSecurity.requestPasswordChange);
  const confirmChange = useMutation(api.adminSecurity.confirmPasswordChange);
  const cancelChange = useMutation(api.adminSecurity.cancelPasswordChange);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"form" | "otp">("form");
  const [busy, setBusy] = useState(false);

  const clientMismatch =
    stage === "form" && confirmNew.length > 0 && confirmNew !== newPassword;

  const sendCode = async () => {
    if (newPassword !== confirmNew) {
      toast.error("New passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await requestChange({
        token,
        currentPassword,
        newPassword,
      });
      setStage("otp");
      setOtp("");
      toast.success(`Code sent to ${res.sentTo}. It expires in 10 minutes.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await confirmChange({ token, otp });
      toast.success(
        `Password changed. ${res.revoked} other device${res.revoked === 1 ? "" : "s"} signed out.`,
      );
      setStage("form");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNew("");
      setOtp("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Confirmation failed.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await cancelChange({ token });
    } catch {
      // non-fatal
    }
    setStage("form");
    setOtp("");
    setBusy(false);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
          <KeyRound className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold">Change admin password</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {identity?.securityEmail ? (
              <>
                A one-time code will be sent to your verified security email{" "}
                <span className="font-medium text-foreground">
                  {identity.securityEmail}
                </span>
                . After the change, every other signed-in device is logged out
                automatically.
              </>
            ) : (
              "A one-time code will be sent to your verified security email."
            )}
          </p>
        </div>
      </div>

      {stage === "form" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Current password</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="border-white/10 bg-black/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">New password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 10 chars, letters + numbers"
              className="border-white/10 bg-black/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Confirm new password</label>
            <Input
              type="password"
              value={confirmNew}
              onChange={(e) => setConfirmNew(e.target.value)}
              className="border-white/10 bg-black/20"
            />
            {clientMismatch && (
              <p className="mt-1.5 text-xs text-rose-300">Passwords don't match.</p>
            )}
          </div>
          <div className="sm:col-span-3">
            <Button
              onClick={() => void sendCode()}
              disabled={
                busy ||
                !currentPassword ||
                !newPassword ||
                !confirmNew ||
                clientMismatch
              }
              className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Send verification code
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-lime-400/25 bg-lime-400/8 p-3 text-sm text-lime-200">
            <Timer className="size-4 shrink-0" />
            Code sent to {identity?.securityEmail ?? "your security email"}. Enter
            it below to confirm the change — the password is not changed until
            then.
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <label className="mb-1.5 block text-sm font-medium">Verification code</label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                className="border-white/10 bg-black/20 text-center font-mono text-lg tracking-[0.3em]"
              />
            </div>
            <Button
              onClick={() => void confirm()}
              disabled={busy || otp.length !== 6}
              className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Confirm password change
            </Button>
            <Button
              variant="ghost"
              onClick={() => void cancel()}
              disabled={busy}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Security email — Owner only, OTP-confirmed
// ---------------------------------------------------------------------------

function SecurityEmailCard({
  token,
  identity,
}: {
  token: string;
  identity:
    | {
        isOwner: boolean;
        securityEmailFull: string | null;
      }
    | null
    | undefined;
}) {
  const requestEmail = useMutation(api.adminSecurity.requestSecurityEmailChange);
  const confirmEmail = useMutation(api.adminSecurity.confirmSecurityEmailChange);
  const cancelEmail = useMutation(api.adminSecurity.cancelSecurityEmailChange);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"form" | "otp">("form");
  const [busy, setBusy] = useState(false);

  // Only the Owner can manage the security email — hide the action entirely
  // for other sessions (the backend enforces this regardless).
  if (identity && !identity.isOwner) return null;

  const send = async () => {
    setBusy(true);
    try {
      const res = await requestEmail({ token, currentPassword, newEmail: newEmail.trim() });
      setStage("otp");
      setOtp("");
      toast.success(`Code sent to ${res.sentTo}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await confirmEmail({ token, otp });
      toast.success("Security email updated.");
      setStage("form");
      setCurrentPassword("");
      setNewEmail("");
      setOtp("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Confirmation failed.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await cancelEmail({ token });
    } catch {
      // non-fatal
    }
    setStage("form");
    setOtp("");
    setBusy(false);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
          <Mail className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold">Security email</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {identity?.securityEmailFull
              ? `Verification codes are delivered to ${identity.securityEmailFull}. Changing it requires your current password and a code sent to the new address.`
              : "Verification codes are delivered to the verified security email."}
          </p>
        </div>
      </div>

      {stage === "form" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Current password</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="border-white/10 bg-black/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">New security email</label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new-inbox@example.com"
              className="border-white/10 bg-black/20"
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              onClick={() => void send()}
              disabled={busy || !currentPassword || !newEmail.trim()}
              className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              Send code to new email
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="mb-1.5 block text-sm font-medium">Verification code</label>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className="border-white/10 bg-black/20 text-center font-mono text-lg tracking-[0.3em]"
            />
          </div>
          <Button
            onClick={() => void confirm()}
            disabled={busy || otp.length !== 6}
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Confirm email change
          </Button>
          <Button
            variant="ghost"
            onClick={() => void cancel()}
            disabled={busy}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" /> Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active sessions — current device, other devices, sign-out controls
// ---------------------------------------------------------------------------

function SessionsCard({ token }: { token: string }) {
  const sessions = useQuery(
    api.adminSecurity.listSessions,
    token ? { token } : "skip",
  );
  const signOutOthers = useMutation(api.adminSecurity.signOutOtherDevices);
  const revokeOne = useMutation(api.adminSecurity.revokeSession);
  const [busy, setBusy] = useState(false);

  const { current, others } = useMemo(() => {
    const list = sessions ?? [];
    return {
      current: list.find((s) => s.isCurrent) ?? null,
      others: list.filter((s) => !s.isCurrent),
    };
  }, [sessions]);

  const signOutAll = async () => {
    setBusy(true);
    try {
      const res = await signOutOthers({ token });
      toast.success(
        `Signed out ${res.revoked} other device${res.revoked === 1 ? "" : "s"}. This device stays signed in.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign out other devices.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (s: SessionRow) => {
    try {
      await revokeOne({ token, sessionId: s._id as never });
      toast.success(`Signed out "${s.label}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign out that device.");
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
            <MonitorSmartphone className="size-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold">Active sessions</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Revoked sessions lose access to the admin dashboard immediately.
            </p>
          </div>
        </div>
        <Button
          onClick={() => void signOutAll()}
          disabled={busy || others.length === 0}
          variant="outline"
          className="gap-2 border-rose-400/30 text-rose-300 hover:bg-rose-400/10 hover:text-rose-200"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          Sign out all other devices
        </Button>
      </div>

      {!sessions ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading sessions…
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {current && <SessionRow row={current} />}
          {others.map((s) => (
            <SessionRow key={s._id} row={s} onRevoke={() => void revoke(s)} />
          ))}
          {sessions.length === 0 && (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          )}
        </div>
      )}
    </div>
  );
}

function SessionRow({ row, onRevoke }: { row: SessionRow; onRevoke?: () => void }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
        row.isCurrent
          ? "border-lime-400/25 bg-lime-400/5"
          : "border-white/10 bg-black/20"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
            row.isCurrent ? "bg-lime-400/12 text-lime-300" : "bg-white/5 text-muted-foreground"
          }`}
        >
          <Laptop className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {row.label}
            {row.isCurrent && (
              <span className="ml-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 text-[10px] font-semibold text-lime-300">
                This device
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Started {timeAgo(row.createdAt)} · Active {timeAgo(row.lastSeenAt)}
          </p>
        </div>
      </div>
      {!row.isCurrent && onRevoke && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onRevoke}
          className="gap-1.5 text-muted-foreground hover:bg-rose-400/10 hover:text-rose-300"
        >
          <X className="size-3.5" /> Sign out
        </Button>
      )}
    </div>
  );
}
