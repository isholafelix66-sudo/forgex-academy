import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Code2,
  GraduationCap,
  Map,
  Palette,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";

// ---------------------------------------------------------------------------
// The built-in "ForgeX in two minutes" motion film.
//
// A self-contained, on-brand motion graphic (no video file needed) driven by a
// requestAnimationFrame clock: five scenes animate in sequence with a real
// player UI — play/pause, restart, scene dots and a clickable progress bar.
// ---------------------------------------------------------------------------

const SCENE_MS = 7000;
const SCENES = [
  { label: "Welcome" },
  { label: "Learn" },
  { label: "Build" },
  { label: "Succeed" },
  { label: "Grow" },
] as const;
const TOTAL_MS = SCENES.length * SCENE_MS;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.28, delayChildren: 0.15 } },
};
const item = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const bg = (
  <div className="pointer-events-none absolute inset-0" aria-hidden>
    <div
      className="absolute inset-0 opacity-[0.08]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
      }}
    />
    <div className="absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-lime-400/15 blur-3xl" />
  </div>
);

function SceneIntro() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      {bg}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex size-20 items-center justify-center rounded-2xl bg-lime-400 text-black shadow-[0_0_0_14px_rgba(163,230,53,0.14),0_0_60px_rgba(163,230,53,0.5)]"
      >
        <Sparkles className="size-10" />
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="font-display relative mt-6 text-3xl font-bold tracking-tight sm:text-4xl"
      >
        ForgeX <span className="text-gradient">Academy</span>
      </motion.h3>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        className="relative mt-3 text-base font-semibold tracking-[0.3em] text-lime-300"
      >
        LEARN · BUILD · SUCCEED
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.0 }}
        className="relative mt-5 max-w-md text-sm leading-relaxed text-muted-foreground"
      >
        One platform that turns curiosity into career-ready skills — free to
        start, forever useful.
      </motion.p>
    </div>
  );
}

function SceneLearn() {
  const levels = [
    "Design Fundamentals",
    "UI Design Mastery",
    "Portfolio & Career",
  ];
  const steps = ["Structured roadmaps", "Level-locked progress", "Expert tutors"];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
      {bg}
      <motion.div variants={container} initial="hidden" animate="show" className="relative w-full max-w-lg">
        <motion.div variants={item} className="flex items-center justify-center gap-2 text-lime-300">
          <Map className="size-5" />
          <span className="text-xs font-bold uppercase tracking-[0.25em]">Step 01 — Learn</span>
        </motion.div>
        <motion.h3 variants={item} className="font-display mt-3 text-center text-2xl font-bold sm:text-3xl">
          Follow a path, not a playlist
        </motion.h3>
        <div className="mt-6 space-y-2.5">
          {steps.map((s, i) => (
            <motion.div
              key={s}
              variants={item}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-[11px] font-bold text-lime-300">
                {i + 1}
              </span>
              <span className="text-sm font-medium">{s}</span>
              <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: SCENE_MS / 1000 - 1, ease: "linear" }}
                  className="h-full rounded-full bg-lime-400"
                />
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div variants={item} className="mt-5 flex flex-wrap justify-center gap-2">
          {levels.map((l) => (
            <span key={l} className="rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-xs font-medium text-lime-200">
              {l}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

function SceneBuild() {
  const cards = [
    { icon: Code2, title: "Hands-on projects", desc: "Build real things, not demos" },
    { icon: Palette, title: "Quizzes & checkpoints", desc: "Auto-graded, 70% to pass" },
    { icon: BarChart3, title: "Tutor feedback", desc: "Assignments graded by experts" },
  ];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
      {bg}
      <motion.div variants={container} initial="hidden" animate="show" className="relative w-full max-w-lg">
        <motion.div variants={item} className="flex items-center justify-center gap-2 text-lime-300">
          <Rocket className="size-5" />
          <span className="text-xs font-bold uppercase tracking-[0.25em]">Step 02 — Build</span>
        </motion.div>
        <motion.h3 variants={item} className="font-display mt-3 text-center text-2xl font-bold sm:text-3xl">
          Skills you prove, not just watch
        </motion.h3>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <motion.div
              key={c.title}
              variants={item}
              className="relative rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur"
            >
              <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
                <c.icon className="size-5" />
              </span>
              <p className="mt-3 text-sm font-semibold">{c.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
              <motion.span
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9, type: "spring", stiffness: 300, damping: 16 }}
                className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-lime-400 text-black"
              >
                <CheckCircle2 className="size-4" />
              </motion.span>
            </motion.div>
          ))}
        </div>
        <motion.p variants={item} className="mt-5 text-center text-xs text-muted-foreground">
          Every lesson ends in something you ship to your portfolio.
        </motion.p>
      </motion.div>
    </div>
  );
}

function SceneSucceed() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
      {bg}
      <motion.div variants={container} initial="hidden" animate="show" className="relative w-full max-w-lg">
        <motion.div variants={item} className="flex items-center justify-center gap-2 text-lime-300">
          <Award className="size-5" />
          <span className="text-xs font-bold uppercase tracking-[0.25em]">Step 03 — Succeed</span>
        </motion.div>
        <motion.h3 variants={item} className="font-display mt-3 text-center text-2xl font-bold sm:text-3xl">
          Earn proof that opens doors
        </motion.h3>

        <motion.div
          variants={item}
          className="relative mx-auto mt-6 max-w-sm rounded-2xl border border-lime-400/30 bg-gradient-to-br from-lime-400/10 via-white/5 to-white/5 p-5 shadow-2xl shadow-lime-400/10"
        >
          <div className="flex items-center justify-between">
            <span className="flex size-8 items-center justify-center rounded-lg bg-lime-400 text-black">
              <GraduationCap className="size-5" />
            </span>
            <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-300">
              Verified
            </span>
          </div>
          <p className="font-display mt-4 text-lg font-bold">Certificate of Completion</p>
          <p className="mt-0.5 text-xs text-muted-foreground">ForgeX Academy</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="space-y-1.5">
              {["Unique ID", "QR verification"].map((row) => (
                <p key={row} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="size-3.5 text-lime-400" /> {row}
                </p>
              ))}
            </div>
            <div
              className="grid h-14 w-14 grid-cols-3 gap-[3px] rounded-lg border border-white/10 bg-white p-1.5"
              aria-hidden
            >
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className={`rounded-[2px] ${[0, 1, 3, 5, 7, 8].includes(i) ? "bg-black" : "bg-black/20"}`} />
              ))}
            </div>
          </div>
        </motion.div>

        <motion.p variants={item} className="mt-5 text-center text-xs text-muted-foreground">
          Recruiters check your certificate in seconds — from anywhere.
        </motion.p>
      </motion.div>
    </div>
  );
}

function SceneGrow() {
  const opps = [
    { icon: Briefcase, label: "Internships" },
    { icon: Trophy, label: "Jobs" },
    { icon: GraduationCap, label: "Scholarships" },
    { icon: Rocket, label: "Entrepreneurship" },
  ];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      {bg}
      <motion.div variants={container} initial="hidden" animate="show" className="relative">
        <motion.div variants={item} className="flex items-center justify-center gap-2 text-lime-300">
          <BookOpen className="size-5" />
          <span className="text-xs font-bold uppercase tracking-[0.25em]">Then the ForgeX Network</span>
        </motion.div>
        <motion.h3 variants={item} className="font-display mt-3 text-2xl font-bold sm:text-3xl">
          Your skills, matched to opportunity
        </motion.h3>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {opps.map((o) => (
            <motion.span
              key={o.label}
              variants={item}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur"
            >
              <o.icon className="size-4 text-lime-300" /> {o.label}
            </motion.span>
          ))}
        </div>
        <motion.div variants={item} className="mt-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-lime-400 px-6 py-2.5 text-sm font-bold text-black shadow-[0_0_30px_rgba(163,230,53,0.4)]">
            <Sparkles className="size-4" /> Start learning free
          </span>
        </motion.div>
        <motion.p variants={item} className="mt-5 text-xs tracking-[0.3em] text-lime-300/80">
          FORGEX ACADEMY · LEARN. BUILD. SUCCEED.
        </motion.p>
      </motion.div>
    </div>
  );
}

function Scene({ index }: { index: number }) {
  switch (index) {
    case 0:
      return <SceneIntro />;
    case 1:
      return <SceneLearn />;
    case 2:
      return <SceneBuild />;
    case 3:
      return <SceneSucceed />;
    default:
      return <SceneGrow />;
  }
}

function fmt(ms: number) {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function ForgeXMotionVideo({ title = "ForgeX in two minutes" }: { title?: string }) {
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const barRef = useRef<HTMLDivElement | null>(null);

  const sceneIndex = Math.min(SCENES.length - 1, Math.floor(elapsed / SCENE_MS));
  const ended = elapsed >= TOTAL_MS;
  const ratio = Math.min(1, elapsed / TOTAL_MS);

  // Master clock
  useEffect(() => {
    if (!playing) return;
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = now - lastRef.current;
      lastRef.current = now;
      setElapsed((e) => Math.min(TOTAL_MS, e + dt));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  // Stop at the end
  useEffect(() => {
    if (elapsed >= TOTAL_MS && playing) setPlaying(false);
  }, [elapsed, playing]);

  const toggle = () => {
    if (ended) {
      setElapsed(0);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  };

  const restart = () => {
    setElapsed(0);
    setPlaying(true);
  };

  const seek = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const r = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setElapsed(r * TOTAL_MS);
    setPlaying(r < 1);
  };

  return (
    <div className="relative h-full w-full select-none bg-[#0d0f0c]">
      <AnimatePresence mode="wait">
        <motion.div
          key={sceneIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          className="absolute inset-0"
        >
          <Scene index={sceneIndex} />
        </motion.div>
      </AnimatePresence>

      {/* Scene label chip */}
      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur">
        <Sparkles className="size-3.5 text-lime-300" />
        {title}
        <span className="text-lime-300/80">
          · {SCENES[sceneIndex].label}
        </span>
      </div>

      {/* Replay overlay at the end */}
      {ended && (
        <button
          type="button"
          onClick={restart}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-[2px]"
          aria-label="Replay the tour"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-lime-400 text-black shadow-[0_0_0_12px_rgba(163,230,53,0.15),0_0_40px_rgba(163,230,53,0.45)]">
            <RotateCcw className="size-7" />
          </span>
          <span className="text-sm font-semibold text-lime-200">Replay the tour</span>
        </button>
      )}

      {/* Player controls */}
      <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/8 bg-black/60 px-4 pb-3 pt-2 backdrop-blur-md">
        <div
          ref={barRef}
          className="group relative h-1.5 cursor-pointer rounded-full bg-white/10"
          onPointerDown={(e) => seek(e.clientX)}
          role="slider"
          aria-label="Tour progress"
          aria-valuemin={0}
          aria-valuemax={TOTAL_MS}
          aria-valuenow={Math.round(elapsed)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setElapsed((x) => Math.min(TOTAL_MS, x + SCENE_MS));
            if (e.key === "ArrowLeft") setElapsed((x) => Math.max(0, x - SCENE_MS));
          }}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-lime-400 to-lime-300"
            style={{ width: `${ratio * 100}%` }}
          />
          {/* scene markers */}
          {SCENES.slice(1).map((_, i) => (
            <span
              key={i}
              className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-black/60"
              style={{ left: `${((i + 1) / SCENES.length) * 100}%` }}
            />
          ))}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="flex size-9 items-center justify-center rounded-full bg-lime-400 text-black transition-transform hover:scale-105 active:scale-95"
            aria-label={playing ? "Pause" : ended ? "Replay" : "Play"}
          >
            {playing ? <Pause className="size-4 fill-black" /> : <Play className="ml-0.5 size-4 fill-black" />}
          </button>
          <button
            type="button"
            onClick={restart}
            className="flex size-8 items-center justify-center rounded-full border border-white/15 text-muted-foreground transition-colors hover:text-lime-300"
            aria-label="Restart"
          >
            <RotateCcw className="size-3.5" />
          </button>

          {/* scene dots */}
          <div className="ml-2 flex items-center gap-1.5">
            {SCENES.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setElapsed(i * SCENE_MS);
                  setPlaying(true);
                }}
                className={`h-1.5 rounded-full transition-all ${i === sceneIndex ? "w-5 bg-lime-400" : "w-1.5 bg-white/25 hover:bg-white/40"}`}
                aria-label={`Go to ${s.label}`}
              />
            ))}
          </div>

          <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
            {fmt(elapsed)} / {fmt(TOTAL_MS)}
          </span>
        </div>
      </div>
    </div>
  );
}
