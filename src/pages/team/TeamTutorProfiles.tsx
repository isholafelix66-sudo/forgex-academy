import { useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Loader2, Users, BookOpen, CheckCircle2, Clock, ExternalLink } from "lucide-react";

export default function TeamTutorProfiles() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const myTeam = useQuery(api.team.getMyTeam);
  const team = myTeam?.team as any;

  const tutors = useQuery(
    api.teamRoles.listTutorProfiles,
    team ? { teamId: team._id } : "skip",
  );

  if (!team) {
    return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-lime-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-lime-400/15 bg-gradient-to-br from-lime-400/5 to-transparent p-6">
        <div className="flex items-center gap-3">
          <Users className="size-6 text-lime-400" />
          <div>
            <h2 className="font-display text-xl font-bold text-white">Tutor Profiles</h2>
            <p className="text-sm text-white/50">View approved/active tutors, their onboarding status, and course information.</p>
          </div>
        </div>
      </motion.div>

      {!tutors ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-lime-400" /></div>
      ) : tutors.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-card p-10 text-center">
          <Users className="mx-auto size-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No tutors found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tutors.map((t: any) => (
            <motion.div key={t._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-white/5 bg-card p-5 transition-colors hover:border-lime-400/20">
              <div className="flex items-start gap-4">
                {t.image ? (
                  <img src={t.image} alt="" className="size-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-lime-400/10 font-display text-lg font-bold text-lime-400">
                    {(t.name ?? "T")[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-sm font-bold text-white">{t.name}</h3>
                    {t.verified && (
                      <span className="rounded-full border border-green-400/30 bg-green-400/10 px-2 py-0.5 text-[10px] font-bold text-green-300">Verified</span>
                    )}
                    {t.application && (
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                        t.application.status === "verified" || t.application.status === "approved"
                          ? "border-green-400/30 bg-green-400/10 text-green-300"
                          : t.application.status === "submitted" || t.application.status === "under-review"
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                          : "border-white/10 bg-white/5 text-white/40"
                      }`}>{t.application.status}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-white/40">{t.email} · {t.application?.professionalTitle}</p>
                  <p className="mt-1 text-xs text-white/30 line-clamp-2">{t.bio || t.application?.biography}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/30">
                    <span className="flex items-center gap-1"><BookOpen className="size-3" /> {t.courseCount} courses ({t.publishedCourses} published)</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
