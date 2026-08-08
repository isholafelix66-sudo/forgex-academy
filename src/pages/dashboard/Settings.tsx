import { Link, useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { BadgeCheck, GraduationCap, LogOut, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { useAuth } from "@/hooks/use-auth";

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const emailVerified = !!user?.emailVerificationTime;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your account and access."
      />

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
                <p className="text-sm font-medium">{user?.email ?? "No email"}</p>
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
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-muted-foreground">
                <ShieldCheck className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium capitalize">{user?.role ?? "student"}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.role === "tutor" && user.verified
                    ? "Verified tutor — your dashboard is unlocked"
                    : "Your account role"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Tutor */}
        <section className="rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold">Teaching</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {user?.role === "tutor" && user.verified
              ? "You're a verified tutor. Manage your courses and students."
              : "Want to share your skills? Apply to become a verified tutor — an admin reviews every application before your dashboard unlocks."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {user?.role === "tutor" && user.verified ? (
              <Link to="/tutor">
                <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                  <GraduationCap className="size-4" /> Open tutor dashboard
                </Button>
              </Link>
            ) : (
              <Link to="/become-tutor">
                <Button variant="outline" className="gap-2 border-lime-400/30 text-lime-300 hover:bg-lime-400/10">
                  <GraduationCap className="size-4" /> Apply to teach
                </Button>
              </Link>
            )}
          </div>
        </section>

        {/* Danger zone */}
        <section className="rounded-3xl border border-rose-400/20 bg-card p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold text-rose-200">Session</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign out of ForgeX Academy on this device.
          </p>
          <Button
            variant="outline"
            className="mt-4 gap-2 border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </section>
      </div>
    </div>
  );
}
