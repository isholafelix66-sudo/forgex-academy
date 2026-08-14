import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  Clock,
  Copy,
  ExternalLink,
  GraduationCap,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { StatCard } from "@/components/dash/StatCard";
import { EmptyState } from "@/components/site/EmptyState";
import { Avatar } from "@/components/site/Avatar";
import { copyText } from "@/lib/copy";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Resolves + displays the tutor's shareable public page link. */
function TutorPageLink() {
  const claim = useMutation(api.tutor.claimMySlug);
  const [slug, setSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    claim()
      .then((s) => {
        if (alive) setSlug(s);
      })
      .catch(() => {
        if (alive) setSlug("");
      });
    return () => {
      alive = false;
    };
  }, [claim]);

  if (slug === null) {
    return (
      <div className="h-10 animate-pulse rounded-xl border border-white/8 bg-black/20" />
    );
  }
  if (slug === "") {
    return (
      <p className="text-xs text-muted-foreground">
        Your public page will be ready once your account is fully verified.
      </p>
    );
  }
  const url = `${window.location.origin}/tutor/${slug}`;
  const onCopy = async () => {
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      toast.success("Link copied — share it anywhere.");
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-lime-200">
        {url.replace(/^https?:\/\//, "")}
      </code>
      <Button
        size="sm"
        variant="outline"
        onClick={() => void onCopy()}
        className="shrink-0 border-white/10"
        aria-label="Copy link"
      >
        {copied ? <Check className="size-3.5 text-lime-300" /> : <Copy className="size-3.5" />}
      </Button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
        aria-label="Open your tutor page"
      >
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}

const CAPACITY_STATE: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "border-lime-400/25 bg-lime-400/10 text-lime-300" },
  full: { label: "Full", cls: "border-rose-400/25 bg-rose-400/10 text-rose-300" },
  closed: { label: "Enrollment closed", cls: "border-amber-400/25 bg-amber-400/10 text-amber-300" },
};

export default function TutorOverview() {
  const analytics = useQuery(api.tutor.analyticsOverview);
  const pending = useQuery(api.tutor.pendingSubmissions);
  const courses = useQuery(api.tutor.myCourses);

  const counts = analytics?.counts;
  const cohorts = analytics?.cohorts ?? [];
  const firstName = (analytics?.tutor.name ?? "tutor").split(" ")[0];
  const recentPending = (pending ?? []).slice(0, 5);

  const totalStudents = counts?.totalStudents ?? 0;
  const unanswered = counts?.unansweredQuestions ?? 0;
  const activeCommunities = counts?.activeCommunities ?? 0;
  const announcementCount = counts?.announcements ?? 0;
  const pendingCount = counts?.pendingAssignments ?? 0;

  return (
    <div className="space-y-8">
      {/* Greeting hero */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-lime-400/15 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-300">
              <Sparkles className="size-3.5" /> Tutor analytics
            </p>
            <h1 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Your classes at a glance — who's learning, what's waiting, and
              where students might need a hand.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link to="/tutor/support">
              <Button variant="outline" className="gap-2 border-white/10">
                <LifeBuoy className="size-4" /> Report an issue
              </Button>
            </Link>
            <Link to="/tutor/students">
              <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                <Users className="size-4" /> View students
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          icon={<Users className="size-5" />}
          label="Students"
          value={analytics === undefined ? "…" : totalStudents.toLocaleString()}
          hint="across your courses"
        />
        <StatCard
          icon={<MessageSquare className="size-5" />}
          label="Unanswered questions"
          value={analytics === undefined ? "…" : String(unanswered)}
          hint={unanswered > 0 ? "in course communities" : "all caught up 🎉"}
          accent={unanswered > 0}
        />
        <StatCard
          icon={<BookOpen className="size-5" />}
          label="Active communities"
          value={analytics === undefined ? "…" : String(activeCommunities)}
          hint="cohorts you teach"
        />
        <StatCard
          icon={<Megaphone className="size-5" />}
          label="Announcements"
          value={analytics === undefined ? "…" : String(announcementCount)}
          hint="published by you"
        />
        <StatCard
          icon={<ClipboardCheck className="size-5" />}
          label="Pending assignments"
          value={analytics === undefined ? "…" : String(pendingCount)}
          hint="submissions to grade"
          accent={pendingCount > 0}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* Learning progress per cohort */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
                <TrendingUp className="size-4 text-lime-300" /> Learning progress
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                How many students completed each module, per cohort — spot the drop-offs at a glance.
              </p>
            </div>
            <Link to="/dashboard/communities" className="shrink-0 text-xs text-lime-300 hover:underline">
              Open communities <ArrowRight className="ml-0.5 inline size-3" />
            </Link>
          </div>

          {analytics === undefined ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-52 animate-pulse rounded-2xl border border-white/8 bg-black/20" />
              ))}
            </div>
          ) : cohorts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-card p-6">
              <EmptyState
                icon={<GraduationCap className="size-6" />}
                title="No communities yet"
                description="Join or create a course community to see per-cohort learning progress here."
              />
            </div>
          ) : (
            cohorts.map((cohort) => {
              const lowest = [...cohort.modules].sort(
                (a, b) =>
                  (a.total ? a.completed / a.total : 1) -
                  (b.total ? b.completed / b.total : 1),
              )[0];
              const capState = CAPACITY_STATE[cohort.capacityState] ?? CAPACITY_STATE.open;
              return (
                <div key={cohort.communityId} className="rounded-2xl border border-white/10 bg-card">
                  <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-semibold">
                        {cohort.name}
                        {cohort.cohortLabel && (
                          <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {cohort.cohortLabel}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{cohort.courseTitle}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold", capState.cls)}>
                      {cohort.capacity > 0
                        ? `${cohort.studentCount}/${cohort.capacity} students`
                        : `${cohort.studentCount} students`}
                    </span>
                    <span className="shrink-0 rounded-full bg-white/8 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {cohort.avgProgress}% avg progress
                    </span>
                  </div>

                  <div className="space-y-3 px-5 py-4">
                    {cohort.modules.slice(0, 6).map((m) => {
                      const ratio = m.total ? m.completed / m.total : 0;
                      const isLowest = lowest && m.lessonId === lowest.lessonId && ratio < 0.5;
                      return (
                        <div key={m.lessonId}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">Module {m.order}:</span>{" "}
                              {m.title}
                            </p>
                            <span className={cn("shrink-0 text-xs", isLowest ? "font-semibold text-amber-300" : "text-muted-foreground")}>
                              {m.completed}/{m.total} completed
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isLowest ? "bg-amber-400" : "bg-lime-400",
                              )}
                              style={{ width: `${Math.round(ratio * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {cohort.modules.length > 6 && (
                      <p className="text-xs text-muted-foreground">
                        +{cohort.modules.length - 6} more modules
                      </p>
                    )}
                  </div>

                  {cohort.atRisk.length > 0 && (
                    <div className="border-t border-amber-400/15 bg-amber-400/5 px-5 py-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                        <AlertTriangle className="size-3.5" /> May need help · below 50% progress
                      </p>
                      <div className="mt-3 space-y-2.5">
                        {cohort.atRisk.map((r) => (
                          <div key={r.student?._id} className="flex items-center gap-3">
                            <Avatar
                              name={r.student?.name ?? "Student"}
                              image={r.student?.image}
                              className="size-8 text-xs"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{r.student?.name ?? "Student"}</p>
                              <p className="text-xs text-muted-foreground">
                                {r.progress}% complete
                                {r.lastActivity ? ` · active ${timeAgo(r.lastActivity)}` : ""}
                              </p>
                            </div>
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/8">
                              <div className="h-full rounded-full bg-amber-400" style={{ width: `${r.progress}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* Right rail */}
        <div className="space-y-6">
          {/* Shareable tutor page */}
          <section className="rounded-2xl border border-lime-400/25 bg-lime-400/8 p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
                <ExternalLink className="size-4" />
              </span>
              <div>
                <h3 className="font-display text-sm font-semibold">Your tutor page</h3>
                <p className="text-xs text-muted-foreground">
                  A free mini website — share it with students, parents and socials.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <TutorPageLink />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Shows your picture, bio, expertise and courses. Visitors can
              enroll directly and message you.
            </p>
          </section>

          {/* Needs attention */}
          <section className="rounded-2xl border border-white/10 bg-card">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="font-display text-sm font-semibold">Needs your attention</h3>
            </div>
            <div className="divide-y divide-white/5">
              <AttentionRow
                to="/dashboard/communities"
                icon={<MessageSquare className="size-4 text-amber-300" />}
                label="Unanswered questions"
                value={analytics === undefined ? "…" : String(unanswered)}
              />
              <AttentionRow
                to="/tutor/grading"
                icon={<ClipboardCheck className="size-4 text-amber-300" />}
                label="Submissions to grade"
                value={analytics === undefined ? "…" : String(pendingCount)}
              />
              <AttentionRow
                to="/dashboard/communities"
                icon={<BookOpen className="size-4 text-lime-300" />}
                label="Active communities"
                value={analytics === undefined ? "…" : String(activeCommunities)}
              />
              <AttentionRow
                to="/tutor/announcements"
                icon={<Megaphone className="size-4 text-lime-300" />}
                label="Published announcements"
                value={analytics === undefined ? "…" : String(announcementCount)}
              />
            </div>
          </section>

          {/* Recent submissions */}
          <section className="rounded-2xl border border-white/10 bg-card">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="font-display text-sm font-semibold">Latest submissions</h3>
              <Link to="/tutor/grading" className="text-xs text-lime-300 hover:underline">
                Grade now
              </Link>
            </div>
            {recentPending.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">
                No submissions waiting. Nice!
              </p>
            ) : (
              <div className="space-y-2 p-4">
                {recentPending.map((s) => (
                  <Link
                    key={s._id}
                    to="/tutor/grading"
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 transition-colors hover:border-lime-400/40"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/12 text-amber-300">
                      <Clock className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.student?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.assignment?.title ?? "Assignment"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(s.submittedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Courses quick stats */}
          <section className="rounded-2xl border border-white/10 bg-card">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="font-display text-sm font-semibold">Your courses</h3>
              <Link to="/tutor/courses" className="text-xs text-lime-300 hover:underline">
                Manage
              </Link>
            </div>
            <div className="space-y-2 p-4">
              {(courses ?? []).slice(0, 3).map((c) => (
                <Link
                  key={c._id}
                  to={`/tutor/courses/${c._id}`}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 transition-colors hover:border-lime-400/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.totalStudents ?? 0} students · {c.lessonsCount} lessons
                    </p>
                  </div>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                </Link>
              ))}
              {(courses ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No courses yet —{" "}
                  <Link to="/tutor/courses/new" className="text-lime-300 hover:underline">
                    create your first
                  </Link>
                  .
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function AttentionRow({
  to,
  icon,
  label,
  value,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <span className="shrink-0 font-display text-base font-bold">{value}</span>
    </Link>
  );
}
