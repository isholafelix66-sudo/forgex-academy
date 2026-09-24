import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  Globe,
  GraduationCap,
  Link2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { Avatar } from "@/components/site/Avatar";
import { CourseCard } from "@/components/site/CourseCard";
import { EmptyState } from "@/components/site/EmptyState";
import { useAuth } from "@/hooks/use-auth";
import { copyText } from "@/lib/copy";
import { openChatWith } from "@/lib/chat-open";
import { toExternalHref } from "@/lib/url";
import { toast } from "sonner";

const SOCIAL_LINKS: Array<{
  key: string;
  label: string;
  icon: React.ReactNode;
}> = [
  { key: "website", label: "Website", icon: <Globe className="size-4" /> },
  { key: "github", label: "GitHub", icon: <ArrowUpRight className="size-4" /> },
  { key: "linkedin", label: "LinkedIn", icon: <ArrowUpRight className="size-4" /> },
  { key: "twitter", label: "Twitter / X", icon: <ArrowUpRight className="size-4" /> },
  { key: "youtube", label: "YouTube", icon: <ArrowUpRight className="size-4" /> },
];

export default function TutorPage() {
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);
  const tutor = useQuery(
    api.public.tutorBySlug,
    slug ? { slug } : "skip",
  );

  const pageUrl =
    typeof window !== "undefined" && slug
      ? `${window.location.origin}/tutor/${slug}`
      : "";

  const onCopy = async () => {
    if (!pageUrl) return;
    const ok = await copyText(pageUrl);
    if (ok) {
      setCopied(true);
      toast.success("Link copied — share it anywhere.");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!tutor) {
    return (
      <PageShell>
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <EmptyState
            icon={<GraduationCap className="size-6" />}
            title="Tutor not found"
            description="This tutor page doesn't exist or hasn't been published yet."
            action={
              <Link to="/academy/tutors" className="text-sm text-lime-300 hover:underline">
                ← Browse all tutors
              </Link>
            }
          />
        </section>
      </PageShell>
    );
  }

  const firstName = tutor.name.split(" ")[0];

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6">
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/academy/tutors"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-lime-300"
            >
              <ArrowLeft className="size-4" /> All tutors
            </Link>
            <button
              onClick={() => void onCopy()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-card px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
            >
              {copied ? <Check className="size-4 text-lime-300" /> : <Link2 className="size-4" />}
              {copied ? "Link copied!" : "Share this page"}
            </button>
          </div>
        </Reveal>

        {/* Profile card */}
        <Reveal className="mt-8">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-card">
            <div className="relative h-44 bg-gradient-to-br from-lime-400/30 via-lime-500/10 to-transparent bg-grid">
              <div className="absolute right-6 top-6 hidden items-center gap-1.5 rounded-full border border-lime-400/25 bg-black/40 px-3 py-1 text-xs font-semibold text-lime-300 backdrop-blur sm:inline-flex">
                <Sparkles className="size-3.5" /> Tutor mini-site
              </div>
            </div>
            <div className="px-6 pb-8 sm:px-10">
              <div className="-mt-14 flex flex-col gap-5 sm:flex-row sm:items-end">
                <Avatar
                  name={tutor.name}
                  image={tutor.image}
                  className="size-28 border-4 border-card text-4xl"
                />
                <div className="pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                      {tutor.name}
                    </h1>
                    <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-xs font-semibold text-lime-300">
                      <ShieldCheck className="size-3" /> Verified tutor
                    </span>
                  </div>
                  {tutor.headline && (
                    <p className="mt-1.5 text-muted-foreground">{tutor.headline}</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-foreground">
                    {tutor.avgRating.toFixed(1)}
                  </span>{" "}
                  average rating
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="size-4" /> {tutor.courses.length} courses
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" /> {tutor.studentCount.toLocaleString()} students
                </span>
                <code className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-lime-200/90">
                  <Link2 className="size-3" />
                  {pageUrl.replace(/^https?:\/\//, "")}
                </code>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {isAuthenticated ? (
                  <Button
                    onClick={() => openChatWith(tutor._id)}
                    className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                  >
                    <MessageSquare className="size-4" /> Message {firstName}
                  </Button>
                ) : (
                  <Link to={`/auth?returnTo=${encodeURIComponent(`/tutor/${slug}`)}`}>
                    <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                      <MessageSquare className="size-4" /> Message {firstName}
                    </Button>
                  </Link>
                )}
                {tutor.courses.length > 0 && (
                  <a href="#courses">
                    <Button variant="outline" className="gap-2 border-white/10">
                      <GraduationCap className="size-4" /> Enroll in a course
                    </Button>
                  </a>
                )}
              </div>

              <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
                <div>
                  <h2 className="font-display text-lg font-semibold">About {firstName}</h2>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{tutor.bio}</p>

                  {tutor.skills.length > 0 && (
                    <>
                      <h2 className="font-display mt-8 text-lg font-semibold">Expertise</h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tutor.skills.map((s) => (
                          <span
                            key={s}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {tutor.socials && (
                  <div className="h-fit rounded-2xl border border-white/10 bg-black/20 p-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Connect
                    </h3>
                    <div className="mt-3 space-y-2">
                      {SOCIAL_LINKS.filter(
                        (s) => (tutor.socials as Record<string, string>)[s.key],
                      ).map((s) => (
                        <a
                          key={s.key}
                          href={toExternalHref((tutor.socials as Record<string, string>)[s.key])}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm transition-colors hover:border-lime-400/40 hover:text-lime-300"
                        >
                          <span className="inline-flex items-center gap-2">
                            {s.icon} {s.label}
                          </span>
                          <ArrowUpRight className="size-3.5 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>

        {/* Courses — visitors can enroll straight from these cards */}
        <div id="courses" className="scroll-mt-6">
          <Reveal className="mt-14">
            <h2 className="font-display text-2xl font-bold">
              Courses by {firstName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a course to see the full curriculum and enroll.
            </p>
          </Reveal>
          {tutor.courses.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={<GraduationCap className="size-6" />}
                title="No published courses yet"
                description="This tutor is preparing their first course."
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tutor.courses.map((c, i) => (
                <Reveal key={c._id} delay={(i % 3) * 0.06}>
                  <CourseCard course={c} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
