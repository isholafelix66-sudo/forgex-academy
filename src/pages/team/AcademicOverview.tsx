import { motion } from "framer-motion";
import { BookOpen, Users, ClipboardList, Activity } from "lucide-react";

export default function AcademicOverview() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-lime-400/15 bg-gradient-to-br from-blue-400/5 to-transparent p-6">
        <h2 className="font-display text-xl font-bold text-white">Academic Support Dashboard</h2>
        <p className="mt-1 text-sm text-white/50">Manage academic operations, course quality, and learning support.</p>
      </motion.div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Courses", value: "—", icon: <BookOpen className="size-5" />, color: "text-blue-400", bg: "bg-blue-400/10" },
          { label: "Tutors", value: "—", icon: <Users className="size-5" />, color: "text-amber-400", bg: "bg-amber-400/10" },
          { label: "Tasks", value: "—", icon: <ClipboardList className="size-5" />, color: "text-lime-400", bg: "bg-lime-400/10" },
          { label: "Activity", value: "—", icon: <Activity className="size-5" />, color: "text-purple-400", bg: "bg-purple-400/10" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="rounded-xl border border-white/5 bg-card p-4">
            <div className={`mb-3 inline-flex rounded-lg p-2 ${s.bg}`}><span className={s.color}>{s.icon}</span></div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-white/40">{s.label}</p>
          </motion.div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/5 bg-card p-6">
        <p className="text-sm text-white/40">Workspace is active. Additional features coming soon.</p>
      </div>
    </div>
  );
}
