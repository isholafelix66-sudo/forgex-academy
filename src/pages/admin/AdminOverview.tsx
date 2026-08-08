import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  GraduationCap,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { StatCard } from "@/components/dash/StatCard";
import { Avatar } from "@/components/site/Avatar";
import { StatusChip } from "@/pages/tutor/status";
import { getAdminToken } from "@/lib/admin-session";

export default function AdminOverview() {
  const token = getAdminToken() ?? "";
  const stats = useQuery(api.admin.stats, token ? { token } : "skip");
  const applications = useQuery(api.admin.tutorApplications, token ? { token } : "skip");
  const pendingCourses = useQuery(api.admin.coursesPendingReview, token ? { token } : "skip");

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
        <StatCard icon={<BookOpen className="size-5" />} label="Courses" value={stats?.courses ?? "…"} hint={`${stats?.publishedCourses ?? 0} published`} accent />
        <StatCard icon={<GraduationCap className="size-5" />} label="Enrollments" value={stats?.enrollments.toLocaleString() ?? "…"} hint="across all courses" />
        <StatCard icon={<Award className="size-5" />} label="Certificates" value={stats?.certificates ?? "…"} hint="issued to learners" />
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
