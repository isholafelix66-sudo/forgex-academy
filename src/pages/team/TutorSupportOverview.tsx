export default function TutorSupportOverview() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <h2 className="font-display text-xl font-bold text-white">Tutor Support</h2>
        <p className="mt-2 text-sm text-white/40">
          Tutor onboarding, support tickets, and tutor management.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/30">Tutors</p>
          <p className="mt-2 font-display text-3xl font-bold text-white">0</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/30">Open Tickets</p>
          <p className="mt-2 font-display text-3xl font-bold text-amber-400">0</p>
        </div>
      </div>
    </div>
  );
}
