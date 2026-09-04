import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, LogOut, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

/**
 * Account Management block for the bottom of Profile Settings:
 * a styled Logout button and a destructive Delete Account flow that
 * requires an explicit confirmation modal before the deletion runs.
 */
export function AccountManagement() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const deleteAccount = useMutation(api.users.deleteMyAccount);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate("/");
    } finally {
      setLoggingOut(false);
    }
  };

  const isTutor = user?.role === "tutor";

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount({});
      toast.success("Your account has been deleted.");
      await signOut();
      navigate("/");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete the account.",
      );
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-card p-6">
      <h3 className="font-display flex items-center gap-2 text-lg font-bold">
        <ShieldAlert className="size-5 text-lime-300" />
        Account Management
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your session and your ForgeX Academy account.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="w-full gap-2 border-lime-400/30 text-lime-300 hover:bg-lime-400/10 hover:text-lime-200 sm:w-auto"
        >
          {loggingOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          Logout
        </Button>

        <Button
          variant="destructive"
          onClick={() => setConfirmOpen(true)}
          disabled={deleting || isTutor}
          title={
            isTutor
              ? "Tutor accounts are deleted by an administrator."
              : undefined
          }
          className="w-full gap-2 border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 sm:ml-auto sm:w-auto"
        >
          <Trash2 className="size-4" />
          Delete Account
        </Button>
      </div>

      {isTutor && (
        <p className="mt-3 text-xs text-muted-foreground">
          Tutor accounts must be deleted by an administrator — contact support
          to close a tutor account.
        </p>
      )}

      {/* ── Delete confirmation modal ──────────────────────────────── */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm account deletion"
          onClick={() => !deleting && setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-rose-500/25 bg-card p-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">
                <Trash2 className="size-5" />
              </span>
              <div>
                <h4 className="font-display text-lg font-bold">
                  Delete your account?
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  This permanently removes your profile, enrollments,
                  certificates, submissions and messages.{" "}
                  <span className="font-medium text-rose-300">
                    This action cannot be undone.
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="w-full border-white/15 sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="w-full gap-2 bg-rose-500 text-white hover:bg-rose-400 sm:w-auto"
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {deleting ? "Deleting…" : "Yes, delete my account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
