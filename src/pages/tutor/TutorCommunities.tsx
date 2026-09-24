import { useEffect } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  BookOpen,
  Loader2,
  Lock,
  MessageCircle,
  MessageSquare,
  Plus,
  Settings2,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { SafeImage } from "@/components/site/SafeImage";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  active: "border-lime-400/25 bg-lime-400/10 text-lime-300",
  locked: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  archived: "border-white/15 bg-white/5 text-muted-foreground",
};

export default function TutorCommunities() {
  const { user } = useAuth();
  const sync = useMutation(api.community.syncMyCommunities);
  const communities = useQuery(api.community.tutorCommunities);

  // Ensure the tutor is a member of every cohort of their courses so the
  // management pages (messages, members) can read them immediately.
  useEffect(() => {
    if (user?._id) void sync().catch(() => undefined);
  }, [user?._id, sync]);

  const loading = communities === undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Communities"
        description="Every community belonging to courses you teach — manage members, cohorts, messaging and community controls from here. You can only manage communities of your own courses."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : communities && communities.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {communities.map((c) => {
            const cap = c.capacity;
            return (
              <div
                key={c._id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-card transition-all hover:-translate-y-0.5 hover:border-lime-400/40 hover:shadow-lg hover:shadow-lime-400/5"
              >
                <div className="flex items-start gap-3 p-5 pb-0">
                  {c.course?.image ? (
                    <SafeImage
                      src={c.course.image}
                      alt={c.course.title}
                      className="size-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                      <BookOpen className="size-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-muted-foreground">{c.course?.title ?? "Course community"}</p>
                    <h3 className="font-display mt-0.5 truncate text-base font-bold group-hover:text-lime-300">
                      {c.name}
                    </h3>
                    {c.cohortLabel && (
                      <span className="mt-1 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        Cohort · {c.cohortLabel}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3">
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      STATUS_STYLE[c.status] ?? "",
                    )}
                  >
                    {c.status === "locked" && <Lock className="size-3" />}
                    {c.status}
                  </span>
                  {c.messageMode === "tutors_only" && (
                    <span className="rounded-full border border-lime-400/25 bg-lime-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lime-300">
                      Tutors only
                    </span>
                  )}
                  {cap.capacity !== null && (
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                        cap.state === "closed"
                          ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
                          : cap.state === "full"
                            ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
                            : "border-lime-400/25 bg-lime-400/10 text-lime-300",
                      )}
                    >
                      {cap.state === "closed" ? (
                        <>
                          <Lock className="size-3" /> Enrollment closed
                        </>
                      ) : cap.state === "full" ? (
                        <>
                          <span className="size-1.5 rounded-full bg-rose-400" /> {cap.studentCount}/{cap.capacity} · full
                        </>
                      ) : (
                        <>
                          <span className="size-1.5 rounded-full bg-lime-400" /> {cap.studentCount}/{cap.capacity}
                        </>
                      )}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4 px-5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5" /> {cap.studentCount} students
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="size-3.5" /> {c.messageCount} messages
                  </span>
                  <span className="ml-auto shrink-0">
                    {c.lastActivityAt ? `Active ${timeAgo(c.lastActivityAt)}` : "No activity yet"}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 p-4">
                  <Link
                    to={`/tutor/communities/${c._id}`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
                  >
                    <Settings2 className="size-4" /> Manage Community
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<MessageCircle className="size-6" />}
          title="No course communities yet"
          description="Communities are created automatically when students enroll in your courses — or ask an admin to create a cohort for you. They'll appear here as soon as they exist."
          action={
            <Link
              to="/academy/tutor"/courses"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
            >
              <Plus className="size-4" /> View my courses
            </Link>
          }
        />
      )}

      {loading && communities === undefined && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your communities…
        </div>
      )}
    </div>
  );
}
