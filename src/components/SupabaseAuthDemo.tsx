import { useState, type FormEvent } from "react";
import { hasSupabaseConfig } from "@/lib/supabase";
import { signInWithEmail } from "@/lib/supabase-auth";

export function SupabaseAuthDemo() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseConfig) {
      setStatus("Supabase is not configured. Convex remains the active auth system.");
      return;
    }

    setLoading(true);
    setStatus(null);

    const result = await signInWithEmail({
      email,
      redirectTo: `${window.location.origin}/academy/login`,
    });

    setLoading(false);

    if (!result.ok) {
      setStatus(result.error ?? "Sign-in failed.");
      return;
    }

    setStatus("Magic-link email sent. Check your inbox.");
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-12">
      <form onSubmit={handleSubmit} className="w-full space-y-5 rounded-3xl border border-white/10 bg-card p-8 shadow-xl">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-300">
            Supabase parallel auth
          </p>
          <h2 className="font-display text-2xl font-bold text-foreground">Test email login</h2>
        </div>

        {!hasSupabaseConfig && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Supabase is not configured yet. Convex auth stays active.
          </div>
        )}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-muted-foreground">Email address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-white/10 bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-lime-400 focus:outline-none"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Sending magic link..." : "Send magic link"}
        </button>

        {status && (
          <p className="text-sm text-muted-foreground">{status}</p>
        )}
      </form>
    </div>
  );
}
