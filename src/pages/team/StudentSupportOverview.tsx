import { motion } from "framer-motion";
import { HeartHandshake, MessageSquare, AlertTriangle, Users } from "lucide-react";

export default function StudentSupportOverview() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-lime-400/15 bg-gradient-to-br from-lime-400/5 to-transparent p-6">
        <h2 className="font-display text-xl font-bold text-white">Student Support Dashboard</h2>
        <p className="mt-1 text-sm text-white/50">Manage student-facing support, issues, and student experience.</p>
      </motion.div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Students", value: "—", icon: <Users className="size-5" />, color: "text-lime-400", bg: "bg-lime-400/10" },
          { label: "Tickets", value: "—", icon: <HeartHandshake className="size-5" />, color: "text-green-400", bg: "bg-green-400/10" },
          { label: "Feedback", value: "—", icon: <MessageSquare className="size-5" />, color: "text-blue-400", bg: "bg-blue-400/10" },
          { label: "Escalations", value: "—", icon: <AlertTriangle className="size-5" />, color: "text-red-400", bg: "bg-red-400/10" },
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
