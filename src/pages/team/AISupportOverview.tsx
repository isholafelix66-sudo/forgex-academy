export default function AISupportOverview() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <h2 className="font-display text-xl font-bold text-white">AI Hub</h2>
        <p className="mt-2 text-sm text-white/40">
          AI resources, prompt library, and AI-related tools management.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/30">AI Resources</p>
          <p className="mt-2 font-display text-3xl font-bold text-white">0</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/30">Prompts</p>
          <p className="mt-2 font-display text-3xl font-bold text-purple-400">0</p>
        </div>
      </div>
    </div>
  );
}
