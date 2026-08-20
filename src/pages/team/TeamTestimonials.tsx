import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTeamAuth } from "@/hooks/use-team-auth";
import { motion } from "framer-motion";
import { Loader2, MessageSquare, CheckCircle2, XCircle, Clock } from "lucide-react";

export default function TeamTestimonials() {
  const { token } = useTeamAuth();
  const workspace = useQuery(
    api.teamAuthWorkspace.getTeamWorkspace,
    token ? { token } : "skip",
  );
  const team = workspace?.team as any;

  const stories = useQuery(api.public.siteContentAll);
  const allStories = useQuery(
    api.teamAuthWorkspace.getTeamWorkItems,
    token ? { token } : "skip",
  );

  const [tab, setTab] = useState<"all" | "pending" | "approved">("all");

  if (!team) {
    return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-lime-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-lime-400/15 bg-gradient-to-br from-lime-400/5 to-transparent p-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="size-6 text-lime-400" />
          <div>
            <h2 className="font-display text-xl font-bold text-white">Testimonials & Stories</h2>
            <p className="text-sm text-white/50">Review student-submitted testimonials and stories. Recommend for the homepage.</p>
          </div>
        </div>
      </motion.div>

      <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
        <MessageSquare className="mx-auto size-8 text-white/20" />
        <p className="mt-3 text-sm text-white/40">
          Testimonials submitted by students will appear here for review.
          Use the Content Submissions page to create and submit new testimonials for Admin approval.
        </p>
      </div>
    </div>
  );
}
