import { Link, useNavigate } from "react-router";
import { BadgeCheck, GraduationCap, LogOut, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { useAuth } from "@/hooks/use-auth";

export default function TutorSettings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const emailVerified = !!user?.emailVerificationTime;

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Manage your tutor account and access." />

      <div className="space-y-6">
        {/* Account */}
        <section className="rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold">Account</h2>
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-muted-foreground">
                <Mail className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user?.email ?? "No email"}</p>
                <p className="text-xs text-muted-foreground">Your sign-in email</p>
              </div>
              {emailVerified ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-300">
                  <BadgeCheck className="size-3.5" /> Verified
                </span>
              ) : (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                  Unverified
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                <GraduationCap className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Tutor account</p>
                <p className="text-xs text-muted-foreground">
                  {user?.verified ? "Verified — you can teach and manage your communities." : "Waiting for verification."}
                </p>
              </div>
              {user?.verified && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-300">
                  <ShieldCheck className="size-3.5" /> Active
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Public page */}
        {user?.verified && (
          <section className="flex flex-col gap-4 rounded-3xl border border-lime-400/20 bg-lime-400/5 p-6 sm:flex-row sm:items-center">
            <GraduationCap className="size-8 shrink-0 text-lime-300" />
            <div className="flex-1">
              <p className="font-display font-semibold">Your public tutor page</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A shareable mini website — edit the content under Tutor Profile.
              </p>
            </div>
            <Link to="/academy/tutor"/profile">
              <Button variant="outline" className="border-lime-400/30 text-lime-300 hover:bg-lime-400/10">
                Edit profile
              </Button>
            </Link>
          </section>
        )}

        {/* Danger zone */}
        <section className="rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold">Session</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign out of ForgeX Academy on this device.</p>
          <Button
            variant="outline"
            onClick={() => void handleSignOut()}
            className="mt-4 gap-2 border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </section>
      </div>
    </div>
  );
}
