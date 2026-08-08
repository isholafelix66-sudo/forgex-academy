import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Bell,
  CalendarDays,
  Megaphone,
  Pin,
  Rocket,
  Sparkles,
  Wrench,
} from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { Avatar } from "@/components/site/Avatar";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const ANNOUNCE_ICONS: Record<string, React.ReactNode> = {
  Announcement: <Megaphone className="size-5" />,
  Event: <CalendarDays className="size-5" />,
  Competition: <Rocket className="size-5" />,
  Maintenance: <Wrench className="size-5" />,
  News: <Bell className="size-5" />,
};

const UPDATE_TYPES = [
  "all",
  "new-course",
  "event",
  "competition",
  "maintenance",
  "platform-news",
] as const;

export default function Updates() {
  const announcements = useQuery(api.public.announcementsList);
  const updates = useQuery(api.public.updatesList);
  const [tab, setTab] = useState<(typeof UPDATE_TYPES)[number]>("all");

  const visibleUpdates = updates?.filter(
    (u) => tab === "all" || u.type === tab,
  );

  return (
    <PageShell>
      <section className="mx-auto max-w-5xl px-4 pb-24 pt-14 sm:px-6">
        <Reveal>
          <span className="w-fit rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-lime-300">
            Updates
          </span>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            News, events & platform updates
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            New courses, scheduled maintenance, competitions and announcements
            — all in one place.
          </p>
        </Reveal>

        <Reveal delay={0.05} className="mt-8 flex flex-wrap gap-2">
          {UPDATE_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors",
                tab === t
                  ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
                  : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground",
              )}
            >
              {t.replace("-", " ")}
            </button>
          ))}
        </Reveal>

        {/* Announcements */}
        {tab === "all" && (
          <div className="mt-10 space-y-4">
            {announcements?.map((a, i) => (
              <Reveal key={a._id} delay={i * 0.04}>
                <article className="rounded-2xl border border-white/10 bg-card p-6 transition-colors hover:border-lime-400/25">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl",
                        a.category === "Maintenance"
                          ? "bg-amber-400/12 text-amber-300"
                          : "bg-lime-400/12 text-lime-300",
                      )}
                    >
                      {ANNOUNCE_ICONS[a.category]}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-lime-400/80">
                        {a.category}
                      </span>
                      {a.pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-lime-400/15 px-2 py-0.5 text-[10px] font-semibold text-lime-300">
                          <Pin className="size-3" /> Pinned
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                  </div>
                  <h2 className="font-display mt-4 text-xl font-semibold">{a.title}</h2>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{a.body}</p>
                  {a.author && (
                    <div className="mt-5 flex items-center gap-2.5 border-t border-white/8 pt-4">
                      <Avatar name={a.author.name} image={a.author.image} className="size-7 text-[10px]" />
                      <span className="text-xs text-muted-foreground">
                        Posted by <span className="font-medium text-foreground">{a.author.name}</span>
                      </span>
                    </div>
                  )}
                </article>
              </Reveal>
            ))}
          </div>
        )}

        {/* Updates */}
        <div className="mt-10 space-y-4">
          {visibleUpdates === undefined ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/8 bg-card" />
              ))}
            </div>
          ) : visibleUpdates.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nothing here yet — check back soon.
            </p>
          ) : (
            visibleUpdates.map((u, i) => (
              <Reveal key={u._id} delay={i * 0.04}>
                <div className="flex gap-4 rounded-2xl border border-white/10 bg-card p-6 transition-colors hover:border-lime-400/25">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-lime-300">
                    <Sparkles className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-lime-400/80">
                        {u.type.replace("-", " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">{timeAgo(u.date)}</span>
                    </div>
                    <h2 className="font-display mt-1.5 text-lg font-semibold">{u.title}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{u.body}</p>
                  </div>
                </div>
              </Reveal>
            ))
          )}
        </div>
      </section>
    </PageShell>
  );
}
