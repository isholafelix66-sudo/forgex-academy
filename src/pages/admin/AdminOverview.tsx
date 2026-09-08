import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Eraser,
  GraduationCap,
  RefreshCcw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { StatCard } from "@/components/dash/StatCard";
import { Avatar } from "@/components/site/Avatar";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StatusChip } from "@/pages/tutor/status";
import { formatDateShort, timeAgo } from "@/lib/format";
import { getAdminToken } from "@/lib/admin-session";
import { useMutation } from "convex/react";
import AiEscalatedTickets from "@/components/team/AiEscalatedTickets";

export default function AdminOverview() {
  const token = getAdminToken() ?? "";
  const [confirmPurge, setConfirmPurge] = useState(false);
  const stats = useQuery(api.admin.stats, token ? { token } : "skip");
  const applications = useQuery(api.admin.tutorApplications, token ? { token } : "skip");
  const pendingCourses = useQuery(api.admin.coursesPendingReview, token ? { token } : "skip");
  const purgeDemoData = useMutation(api.admin.purgeDemoData);
  const updateCatalog = useMutation(api.seed.ensureSeedData);
  const [updatingCatalog, setUpdatingCatalog] = useState(false);

  const pendingApps = (applications ?? []).filter(
    (a) => a.status === "submitted" || a.status === "under-review",
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform overview"
        description="Everything happening across ForgeX Academy."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="size-5" />} label="Total users" value={stats?.users.toLocaleString() ?? "…"} hint={`${stats?.students ?? 0} students · ${stats?.tutors ?? 0} tutors`} />
        <StatCard icon={<BadgeCheck className="size-5" />} label="Pending applications" value={stats?.pendingApplications ?? "…"} hint={`${stats?.verifiedTutors ?? 0} verified tutors`} accent />
        <StatCard icon={<BookOpen className="size-5" />} label="Courses" value={stats?.courses ?? "…"} hint={`${stats?.publishedCourses ?? 0} published · ${stats?.archivedCourses ?? 0} archived`} />
        <StatCard icon={<GraduationCap className="size-5" />} label="Enrollments" value={stats?.enrollments.toLocaleString() ?? "…"} hint={`${stats?.certificates ?? 0} certificates issued`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tutor applications */}
        <section className="rounded-2xl border border-white/10 bg-card">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-base font-semibold">Tutor applications</h2>
            <Link to="/admin/applications">
              <Button variant="ghost" size="sm" className="gap-1 text-lime-300 hover:text-lime-200">
                Review <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
          {pendingApps.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No applications waiting. New applications appear here for verification.
            </p>
          ) : (
            <div className="space-y-2 p-4">
              {pendingApps.slice(0, 4).map((a) => (
                <Link
                  key={a._id}
                  to="/admin/applications"
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3 transition-colors hover:border-lime-400/40"
                >
                  <Avatar name={a.user?.name ?? a.fullName} image={a.user?.image} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.professionalTitle}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-400/12 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                    Pending
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Course reviews */}
        <section className="rounded-2xl border border-white/10 bg-card">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-base font-semibold">Courses awaiting review</h2>
            <Link to="/admin/courses">
              <Button variant="ghost" size="sm" className="gap-1 text-lime-300 hover:text-lime-200">
                Review <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
          {(pendingCourses ?? []).length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No courses waiting for approval.
            </p>
          ) : (
            <div className="space-y-2 p-4">
              {(pendingCourses ?? []).slice(0, 4).map((c) => (
                <Link
                  key={c._id}
                  to="/admin/courses"
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3 transition-colors hover:border-lime-400/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/12 text-lime-300">
                    <BookOpen className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      by {c.tutor?.name ?? "Unknown tutor"}
                    </p>
                  </div>
                  <StatusChip status={c.status} published={c.published} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-white/10 bg-card">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="font-display flex items-center gap-2 text-base font-semibold">
              <Users className="size-4 text-lime-300" /> Recent users
            </h2>
          </div>
          <div className="space-y-2 p-4">
            {(stats?.recentUsers ?? []).map((u) => (
              <Link key={u._id} to="/admin/users" className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/5">
                <Avatar name={u.name} image={u.image} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email ?? "—"}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(u.createdAt)}</span>
              </Link>
            ))}
            {(stats?.recentUsers ?? []).length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">No new users yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-card">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-base font-semibold">Recent applications</h2>
          </div>
          <div className="space-y-2 p-4">
            {(stats?.recentApplications ?? []).map((a) => (
              <Link key={a._id} to="/admin/applications" className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.professionalTitle}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
                  {a.status.replace("-", " ")}
                </span>
              </Link>
            ))}
            {(stats?.recentApplications ?? []).length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">No applications yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-card">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-base font-semibold">Recent courses</h2>
          </div>
          <div className="space-y-2 p-4">
            {(stats?.recentCourses ?? []).map((c) => (
              <div key={c._id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDateShort(c.createdAt)}</p>
                </div>
                <StatusChip status={c.status as never} published={c.published} />
              </div>
            ))}
            {(stats?.recentCourses ?? []).length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">No courses yet.</p>
            )}
          </div>
        </section>
      </div>

      {/* AI Support escalation log — live, with inline reply */}
      <section className="rounded-2xl border border-white/10 bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold">AI Support escalations</h2>
            <p className="text-xs text-muted-foreground">
              Issues the AI assistant couldn't resolve — live log, reply inline. Full queue in{" "}
              <Link to="/admin/ai-support" className="text-lime-300 hover:underline">
                AI Support
              </Link>
              .
            </p>
          </div>
        </div>
        <AiEscalatedTickets />
      </section>

      {/* Demo data control */}
      <section className="flex flex-col gap-4 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-6 sm:flex-row sm:items-center">
        <Eraser className="size-7 shrink-0 text-rose-300" />
        <div className="flex-1">
          <p className="font-display font-semibold">Demo data control</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            The platform ships with seeded demo content — courses, tutors,
            announcements and updates. Wipe it all from the database to start
            fresh with your own ForgeX Academy content. Real student accounts
            are never removed.
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0 gap-1.5 border-rose-400/40 text-rose-300 hover:bg-rose-400/10"
          onClick={() => setConfirmPurge(true)}
        >
          <Eraser className="size-4" /> Delete all demo data
        </Button>
      </section>

      <ConfirmDialog
        open={confirmPurge}
        onOpenChange={setConfirmPurge}
        title="Delete all demo data?"
        description="This permanently removes every demo course, lesson, quiz, assignment, category, roadmap, update, announcement, tutor application and demo account from the database. Real users are kept. This cannot be undone."
        confirmLabel="Delete demo data"
        onConfirm={() => {
          void purgeDemoData({ token });
          setConfirmPurge(false);
        }}
      />

      {/* Catalog update control */}
      <section className="flex flex-col gap-4 rounded-2xl border border-lime-400/20 bg-lime-400/5 p-6 sm:flex-row sm:items-center">
        <RefreshCcw className="size-7 shrink-0 text-lime-300" />
        <div className="flex-1">
          <p className="font-display font-semibold">Update course catalog</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Newly shipped ForgeX courses (Build Websites with AI, Data Analysis
            with Excel, AI Video Generation, AI Automation, Prompt Engineering
            and AI Productivity) are added to this database with one click. It
            only inserts what's missing — your content and student progress are
            never touched.
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0 gap-1.5 border-lime-400/40 text-lime-300 hover:bg-lime-400/10"
          disabled={updatingCatalog}
          onClick={() => {
            setUpdatingCatalog(true);
            void updateCatalog({ force: false }).finally(() =>
              setUpdatingCatalog(false),
            );
          }}
        >
          <RefreshCcw className={`size-4 ${updatingCatalog ? "animate-spin" : ""}`} />
          {updatingCatalog ? "Updating…" : "Update catalog"}
        </Button>
      </section>

      {/* Quick tips */}
      <section className="rounded-2xl border border-lime-400/20 bg-lime-400/5 p-6">
        <div className="flex items-start gap-3">
          <BadgeCheck className="size-5 shrink-0 text-lime-300" />
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Verification workflow</p>
            <p className="mt-1 leading-relaxed">
              Tutors apply via <Link to="/become-tutor" className="text-lime-300 hover:underline">become-a-tutor</Link>,
              you review their credentials under <Link to="/admin/applications" className="text-lime-300 hover:underline">Tutor verification</Link>,
              and their dashboard unlocks only after approval. Tutor-created courses
              additionally need your approval before going live.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
