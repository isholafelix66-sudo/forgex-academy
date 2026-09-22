import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Check,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  Rocket,
  Save,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dash/PageHeader";
import { getAdminToken } from "@/lib/admin-session";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

type State = "active" | "locked" | "hidden";

const STATE_COPY: Record<State, { label: string; blurb: string }> = {
  active: { label: "Active", blurb: "Live — users have full access." },
  locked: { label: "Locked", blurb: "Coming Soon page — no functional access." },
  hidden: { label: "Hidden", blurb: "No public route at all." },
};

/**
 * Admin · Products & waitlist.
 *
 * Feature flags are how a product launches: Projects is ACTIVE, Academy and
 * Opportunity Hub are LOCKED. Flipping a flag changes the live site with no
 * code change or deploy. Copy on the Coming Soon pages is editable here too.
 */
export default function AdminWaitlist() {
  const token = getAdminToken();
  const flags = useQuery(api.projects.featureFlags);
  const waitlist = useQuery(
    api.projects.adminListWaitlist,
    token ? { token } : "skip",
  );
  const overview = useQuery(
    api.projects.adminProjectsOverview,
    token ? { token } : "skip",
  );

  const setFlag = useMutation(api.projects.adminSetFeatureFlag);
  const refreshStats = useMutation(api.projects.adminRefreshStats);

  type Draft = {
    key: string;
    state: State;
    tagline: string;
    comingSoonCopy: string;
  };
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!flags) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const f of flags) {
        if (!next[f.key]) {
          next[f.key] = {
            key: f.key,
            state: f.state as State,
            tagline: f.tagline,
            comingSoonCopy: f.comingSoonCopy,
          };
        }
      }
      return next;
    });
  }, [flags]);

  const patch = (key: string, p: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [key]: { ...d[key], ...p } }));

  const save = async (key: string) => {
    const draft = drafts[key];
    if (!draft) return;
    setBusy(key);
    try {
      await setFlag({
        token: token!,
        key,
        state: draft.state,
        tagline: draft.tagline,
        comingSoonCopy: draft.comingSoonCopy,
      });
      toast.success("Product updated — the live site reflects this immediately.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not update the product."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & waitlist"
        description="Turn future products on or off, edit their Coming Soon copy, and see who asked to be notified."
        actions={
          <Button
            variant="outline"
            className="gap-2 border-white/15"
            disabled={busy === "__stats"}
            onClick={() => {
              setBusy("__stats");
              void refreshStats({ token: token! })
                .then(() => toast.success("Platform stats refreshed."))
                .catch((err) => toast.error(friendlyError(err, "Could not refresh stats.")))
                .finally(() => setBusy(null));
            }}
          >
            {busy === "__stats" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh stats
          </Button>
        }
      />

      {/* Feature flags */}
      <div className="grid gap-4 lg:grid-cols-3">
        {(flags ?? []).map((f) => {
          const draft = drafts[f.key] ?? {
            key: f.key,
            state: f.state as State,
            tagline: f.tagline,
            comingSoonCopy: f.comingSoonCopy,
          };
          const active = draft.state === "active";
          return (
            <section
              key={f.key}
              className={cn(
                "flex flex-col rounded-3xl border p-5",
                active
                  ? "border-lime-400/35 bg-gradient-to-br from-lime-400/10 to-card"
                  : "border-white/10 bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-2xl",
                      active
                        ? "bg-lime-400/15 text-lime-300"
                        : "bg-white/5 text-muted-foreground",
                    )}
                  >
                    {active ? <Rocket className="size-5" /> : <Lock className="size-5" />}
                  </span>
                  <div>
                    <p className="font-display text-base font-bold">{f.label}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{f.key}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  State
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(STATE_COPY) as State[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => patch(f.key, { state: s })}
                      className={cn(
                        "rounded-xl border px-2 py-2 text-[11px] font-bold transition-colors",
                        draft.state === s
                          ? "border-lime-400/50 bg-lime-400/12 text-lime-300"
                          : "border-white/10 text-muted-foreground hover:border-white/25",
                      )}
                    >
                      {STATE_COPY[s].label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {STATE_COPY[draft.state].blurb}
                </p>
              </div>

              {!active && (
                <>
                  <label className="mt-4 block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Tagline
                    </span>
                    <Input
                      value={draft.tagline}
                      onChange={(e) => patch(f.key, { tagline: e.target.value })}
                      className="border-white/10 bg-black/20"
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Coming Soon copy
                    </span>
                    <Textarea
                      rows={3}
                      value={draft.comingSoonCopy}
                      onChange={(e) => patch(f.key, { comingSoonCopy: e.target.value })}
                      className="border-white/10 bg-black/20"
                    />
                  </label>
                </>
              )}

              <div className="mt-5 flex-1" />
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => void save(f.key)}
                  disabled={busy === f.key}
                  className="flex-1 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                >
                  {busy === f.key ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save
                </Button>
                {f.key === "projects" ? (
                  <Link to="/explore" target="_blank">
                    <Button variant="outline" className="gap-2 border-white/15">
                      <ExternalLink className="size-4" />
                    </Button>
                  </Link>
                ) : (
                  <Link to={f.key === "academy" ? "/academy" : "/opportunity-hub"} target="_blank">
                    <Button variant="outline" className="gap-2 border-white/15">
                      <Unlock className="size-4" />
                    </Button>
                  </Link>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Waitlist */}
      <section className="rounded-3xl border border-white/10 bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold">Launch waitlist</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              People who asked to be notified when a locked product goes live.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(overview?.waitlistByProduct ?? []).map((w) => (
              <span
                key={w.product}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold"
              >
                {w.product}: {w.count}
              </span>
            ))}
          </div>
        </div>

        {waitlist === undefined ? (
          <div className="flex min-h-[20vh] items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : waitlist.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No sign-ups yet — the Coming Soon pages collect them automatically.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">Joined</th>
                  <th className="py-2">Account</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map((w) => (
                  <tr key={w._id} className="border-b border-white/5">
                    <td className="py-2 pr-4">{w.email}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                      {w.product}
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {formatDate(w.createdAt)}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {w.userId ? (
                        <span className="inline-flex items-center gap-1.5 text-lime-300">
                          <Check className="size-3.5" /> signed-in
                        </span>
                      ) : (
                        "guest"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
