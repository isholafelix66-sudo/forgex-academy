import { useEffect } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, Lock, MessageCircle, Users } from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

export default function Communities() {
  const { user } = useAuth();
  const sync = useMutation(api.community.syncMyCommunities);
  const communities = useQuery(api.community.myCommunities);
  const unreadTotal = useQuery(api.community.communityUnreadCount);

  useEffect(() => {
    if (user?._id) void sync().catch(() => undefined);
  }, [user?._id, sync]);

  const loading = communities === undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Communities"
        description="Every course you're enrolled in has its own community — chat with classmates, ask your tutor questions and share resources. You're automatically a member, no registration needed."
        actions={
          unreadTotal && unreadTotal > 0 ? (
            <Badge className="gap-1.5 border-lime-400/25 bg-lime-400/10 text-lime-300">
              <span className="size-1.5 rounded-full bg-lime-400" />
              {unreadTotal} unread
            </Badge>
          ) : undefined
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : communities && communities.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {communities.map((c) => (
            <Link
              key={c.community._id}
              to={`/dashboard/communities/${c.community._id}`}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-lime-400/40 hover:shadow-lg hover:shadow-lime-400/5"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl border border-lime-400/25 bg-lime-400/10 text-lime-300">
                  <MessageCircle className="size-5" />
                </span>
                {c.community.status === "active" ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-lime-300">
                    <span className="size-1.5 animate-pulse rounded-full bg-lime-400" /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                    <Lock className="size-3" />
                    {c.community.status}
                  </span>
                )}
              </div>

              <h3 className="font-display mt-4 text-base font-bold leading-snug group-hover:text-lime-300">
                {c.community.name}
              </h3>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {c.course?.title ?? "Course community"}
              </p>

              <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" /> {c.memberCount} members
                </span>
                {c.capacity.capacity !== null && (
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold tabular-nums",
                      c.capacity.state === "closed"
                        ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
                        : c.capacity.state === "full"
                          ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
                          : "border-lime-400/25 bg-lime-400/10 text-lime-300",
                    )}
                  >
                    {c.capacity.state === "closed" ? (
                      <>
                        <Lock className="size-3" /> Enrollment closed
                      </>
                    ) : c.capacity.state === "full" ? (
                      <>
                        <span className="size-1.5 rounded-full bg-rose-400" /> Full · {c.capacity.studentCount}/{c.capacity.capacity}
                      </>
                    ) : (
                      <>
                        <span className="size-1.5 rounded-full bg-lime-400" /> {c.capacity.studentCount}/{c.capacity.capacity}
                      </>
                    )}
                  </span>
                )}
              </div>
              {c.lastMessageAt && (
                <p className="mt-1.5 text-[10px] text-muted-foreground/70">Last active {timeAgo(c.lastMessageAt)}</p>
              )}

              {c.unread > 0 && (
                <span className="absolute right-4 top-4 flex size-6 items-center justify-center rounded-full bg-lime-400 text-[11px] font-bold text-black">
                  {c.unread > 99 ? "99+" : c.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<MessageCircle className="size-6" />}
          title="No communities yet"
          description="Enroll in a course and its community appears here automatically — you'll be able to chat with classmates and your tutor."
          action={
            <Link
              to="/courses"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
            >
              Browse courses
            </Link>
          }
        />
      )}

      {loading && communities === undefined && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Syncing your communities…
        </div>
      )}
    </div>
  );
}
