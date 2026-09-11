import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";
import { ArrowRight, Loader2, UserCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { friendlyError } from "@/lib/errors";

/**
 * First-time profile name setup.
 *
 * Mounted once for the whole app: whenever the signed-in account has no name
 * yet, this compact modal asks for one. It is deliberately NOT a page — the
 * name is saved to the same authenticated profile document used everywhere in
 * ForgeX, the popup closes itself, and the learner lands on ForgeX Home.
 *
 * Because it is driven purely by the profile record:
 *   • accounts that already have a name never see it,
 *   • leaving or refreshing before saving simply shows it again,
 *   • once saved, it never appears again unless the name is removed.
 */
export function NameSetupDialog() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const initializeUser = useMutation(api.users.initializeUser);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // `needsName` is computed server-side from the profile record, so a name
  // the learner never chose (missing, legacy "Anonymous", or the auth
  // provider's email-derived placeholder) counts as "no name".
  const open = !isLoading && isAuthenticated && !!user && !!user.needsName;

  // Prefill with a name typed during signup — the learner never has to enter
  // it twice. Optional: the field is still editable and required.
  useEffect(() => {
    if (!open || prefilled) return;
    const stored = sessionStorage.getItem("fx-pending-name");
    if (stored) setName(stored);
    setPrefilled(true);
  }, [open, prefilled]);

  if (!open) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name to continue.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Tutor signups carry their intent from the Become-a-Tutor flow so the
      // account is created as a tutor account, never a student one.
      const intent = sessionStorage.getItem("fx-intended-role");
      await initializeUser({
        name: trimmed,
        intendedRole: intent === "tutor" ? "tutor" : undefined,
      });
      sessionStorage.removeItem("fx-pending-name");
      sessionStorage.removeItem("fx-intended-role");
      // Admins belong in their own workspace; everyone else goes to ForgeX
      // Home, never to profile settings.
      if (user?.role !== "admin") navigate("/", { replace: true });
    } catch (err) {
      console.error("Name setup error:", err);
      setError(
        friendlyError(
          err,
          "We couldn't save your name just now. Please try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fx-name-setup-title"
          className="w-full max-w-sm rounded-3xl border border-lime-400/25 bg-card p-6 shadow-2xl shadow-black/60 sm:p-7"
        >
          <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
            <UserCheck className="size-5" />
          </div>

          <h2
            id="fx-name-setup-title"
            className="font-display mt-4 text-center text-xl font-bold tracking-tight text-foreground"
          >
            Welcome to ForgeX 👋
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            What should we call you?
          </p>

          <form onSubmit={(e) => void save(e)} className="mt-5 space-y-3">
            <Input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter your name"
              aria-label="Your name"
              autoComplete="name"
              disabled={saving}
              className="h-11 border-white/10 bg-black/30 text-center"
            />

            {error && (
              <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-center text-sm text-rose-300">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Continue"}
              {!saving && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
            This is the name we'll use across ForgeX and on your certificates.
          </p>
        </div>
      </div>
    </div>
  );
}
